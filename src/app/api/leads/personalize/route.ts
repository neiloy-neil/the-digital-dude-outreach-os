import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { createClient } from '@/utils/supabase/server';
import { createServiceClient } from '@/utils/supabase/service';
import {
  type CompactCampaignContext,
  type CompactLeadContext,
  AI_PROMPT_VERSION,
  buildCompactAiPrompt,
  buildInputHash,
  buildTemplateFallbackPrompt,
  determineAiDecision,
  estimateAiCost,
  estimateTokensFromText,
  type CompactAiPromptInput,
  getLeadCompany,
  getLeadDomain,
  sanitizeLeadForAi,
  truncateText,
} from '@/lib/ai/efficiency';
import {
  getAiSettingsForUser,
  getCompanyEnrichmentCache,
  recordAiUsageLog,
  upsertCompanyEnrichmentCache,
} from '@/lib/ai/runtime';
import { createAuditLog } from '@/lib/audit/create-audit-log';

function cleanHtml(html: string): string {
  let text = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  text = text.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
  text = text.replace(/<!--[\s\S]*?-->/g, '');
  text = text.replace(/<[^>]+>/g, ' ');
  text = text.replace(/\s+/g, ' ');
  return text.trim();
}

async function scrapeWebsite(url: string): Promise<string> {
  const targetUrl = url.startsWith('http') ? url : `https://${url}`;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(targetUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      },
    });
    clearTimeout(timeoutId);

    if (!response.ok) return '';

    const html = await response.text();
    return cleanHtml(html).slice(0, 2800);
  } catch {
    return '';
  }
}

function parseJsonResponse(responseText: string): Record<string, unknown> {
  const trimmed = responseText.trim().replace(/^```json\s*/i, '').replace(/```$/i, '');
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start >= 0 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1));
    }
    return {};
  }
}

function startOfDayIso() {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now.toISOString();
}

function startOfMonthIso() {
  const now = new Date();
  now.setDate(1);
  now.setHours(0, 0, 0, 0);
  return now.toISOString();
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const serviceSupabase = createServiceClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { leadIds, promptInstructions, requestedDepth, requestedMode } = await request.json();

    if (!leadIds || !Array.isArray(leadIds) || leadIds.length === 0) {
      return NextResponse.json({ error: 'Missing or empty leadIds array' }, { status: 400 });
    }

    if (!promptInstructions) {
      return NextResponse.json({ error: 'Missing promptInstructions' }, { status: 400 });
    }

    const [{ data: profile }, aiSettings] = await Promise.all([
      supabase.from('profiles').select('gemini_api_key').eq('id', user.id).single(),
      getAiSettingsForUser(supabase, user.id),
    ]);

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 400 });
    }

    const batchLimit = Math.max(1, Number(aiSettings.max_bulk_ai_batch_size || 5));
    const limitedLeadIds = leadIds.slice(0, batchLimit);

    const { data: leads, error: fetchError } = await supabase
      .from('leads')
      .select(
        `*, campaigns!inner (user_id, name, target_industry, offer_type, ai_mode, ai_depth, default_ai_depth, allow_deep_ai, require_manual_approval_for_deep_ai, fetch_website_homepage, min_data_quality_for_ai, full_ai_min_solution_score, allow_template_fallback, use_template_fallback)`
      )
      .in('id', limitedLeadIds);

    if (fetchError || !leads || leads.length === 0) {
      return NextResponse.json({ error: fetchError?.message || 'Failed to fetch leads' }, { status: 500 });
    }

    const unauthorizedLeads = (leads as Array<{ campaigns?: { user_id?: string | null } | null }>).filter(
      (lead) => lead.campaigns?.user_id !== user.id
    );
    if (unauthorizedLeads.length > 0) {
      return NextResponse.json({ error: 'Access denied to some leads' }, { status: 403 });
    }

    const campaignId = leads[0].campaign_id;

    const { data: sequenceStep } = await supabase
      .from('sequences')
      .select('subject, body')
      .eq('campaign_id', campaignId)
      .eq('step_number', 1)
      .maybeSingle();

    const sequenceTemplate = {
      subject: sequenceStep?.subject || 'Outreach from {{company}}',
      body: sequenceStep?.body || 'Hi {{first_name}},\n\nI was looking into {{company}} and noticed...',
    };

    const dailyFrom = startOfDayIso();
    const monthlyFrom = startOfMonthIso();
    const [dailyUsage, monthlyUsage, deepUsage] = await Promise.all([
      serviceSupabase
        .from('ai_usage_logs')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('skipped', false)
        .eq('cache_hit', false)
        .gte('created_at', dailyFrom),
      serviceSupabase
        .from('ai_usage_logs')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('skipped', false)
        .eq('cache_hit', false)
        .gte('created_at', monthlyFrom),
      serviceSupabase
        .from('ai_usage_logs')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('skipped', false)
        .eq('cache_hit', false)
        .eq('model', 'gemini-2.5-flash')
        .gte('created_at', dailyFrom),
    ]);

    const dailyLimit = aiSettings.daily_ai_limit ?? 0;
    const monthlyLimit = aiSettings.monthly_ai_limit ?? 0;
    const deepLimit = aiSettings.daily_deep_ai_limit ?? 0;
    const budgetExceeded =
      Boolean(aiSettings.stop_ai_when_limit_reached) &&
      ((dailyLimit > 0 && (dailyUsage.count || 0) >= dailyLimit) ||
        (monthlyLimit > 0 && (monthlyUsage.count || 0) >= monthlyLimit) ||
        (deepLimit > 0 && (deepUsage.count || 0) >= deepLimit));

    const results = [];

    for (const lead of leads) {
      try {
        const campaign = lead.campaigns as CompactCampaignContext & { user_id: string };
        const leadContext: CompactLeadContext & {
          id: string;
          email: string | null;
          company_name: string | null;
          company: string | null;
          website: string | null;
          data_quality_score: number | null;
          ai_depth: string | null;
        } = {
          ...sanitizeLeadForAi(lead),
          id: lead.id,
          email: lead.email,
          company_name: lead.company_name,
          company: lead.company,
          website: lead.website,
          solution: lead.solution ?? null,
          data_quality_score: lead.data_quality_score ?? null,
          ai_depth: lead.ai_depth ?? null,
        };

        const effectiveMode = requestedMode || campaign.ai_mode || 'hybrid_smart';
        const campaignContext: CompactCampaignContext = {
          id: lead.campaign_id,
          name: campaign.name,
          target_industry: campaign.target_industry,
          offer_type: campaign.offer_type,
          ai_mode: effectiveMode,
          ai_depth: campaign.ai_depth,
          default_ai_depth: campaign.default_ai_depth,
          allow_deep_ai: campaign.allow_deep_ai,
          require_manual_approval_for_deep_ai: campaign.require_manual_approval_for_deep_ai,
          fetch_website_homepage: campaign.fetch_website_homepage,
          min_data_quality_for_ai: campaign.min_data_quality_for_ai ?? aiSettings.min_data_quality_for_ai ?? null,
          full_ai_min_solution_score: campaign.full_ai_min_solution_score ?? aiSettings.full_ai_min_solution_score ?? null,
          allow_template_fallback: campaign.allow_template_fallback,
          use_template_fallback: campaign.use_template_fallback,
        };

        const decision = determineAiDecision({
          campaign: campaignContext,
          lead: leadContext,
          budget: {
            daily_ai_call_limit: aiSettings.daily_ai_limit,
            monthly_ai_call_limit: aiSettings.monthly_ai_limit,
            max_bulk_ai_batch_size: aiSettings.max_bulk_ai_batch_size,
            min_data_quality_for_ai: aiSettings.min_data_quality_for_ai,
            full_ai_min_solution_score: aiSettings.full_ai_min_solution_score,
            stop_ai_when_limit_reached: aiSettings.stop_ai_when_limit_reached,
          },
          settings: aiSettings,
          requestedDepth: requestedDepth || null,
        });

        const leadDomain = getLeadDomain(lead.website);
        const cacheKey = leadDomain || `${getLeadCompany(lead) || lead.email}`.toLowerCase().replace(/\s+/g, '-');
        let websiteText = '';
        let companySummary = lead.company_name || lead.company || campaign.name;
        let companyCacheId: string | null = null;
        const shouldFetchWebsite = campaign.fetch_website_homepage !== false;

        const cachedCompany = leadDomain
          ? await getCompanyEnrichmentCache(serviceSupabase, user.id, leadDomain)
          : null;
        if (cachedCompany) {
          companyCacheId = cachedCompany.id;
          websiteText = truncateText(cachedCompany.website_text || '', 2800);
          companySummary =
            cachedCompany.enrichment_json?.company_summary ||
            cachedCompany.enrichment_summary ||
            companySummary;
        } else if (decision.useWebsite && shouldFetchWebsite && lead.website) {
          websiteText = await scrapeWebsite(lead.website);
        }

        const promptInput: CompactAiPromptInput = {
          campaign: campaignContext,
          lead: { ...leadContext, ai_depth: decision.depth, ai_company_summary: companySummary },
          websiteText,
          companySummary,
          companyCacheHit: Boolean(cachedCompany),
          sequenceSubject: sequenceTemplate.subject,
          sequenceBody: sequenceTemplate.body,
        };

        const basePrompt = buildCompactAiPrompt(promptInput);
        const prompt = `${basePrompt}\n\nCUSTOM INSTRUCTIONS:\n${promptInstructions}`;
        const promptTokens = estimateTokensFromText(prompt);
        const inputHash = buildInputHash({
          campaign: campaignContext,
          lead: { ...leadContext, ai_depth: decision.depth, ai_company_summary: companySummary },
          websiteText,
          companySummary,
          sequenceSubject: sequenceTemplate.subject,
          sequenceBody: sequenceTemplate.body,
          extraContext: promptInstructions,
        });

        const existingLeadState =
          lead.ai_input_hash === inputHash && lead.ai_prompt_version === AI_PROMPT_VERSION && lead.personalized_body;

        if (existingLeadState) {
          await supabase
            .from('leads')
            .update({
              ai_cached: true,
              ai_usage_notes: 'Reused cached personalization output.',
              ai_prompt_version: AI_PROMPT_VERSION,
              ai_input_hash: inputHash,
              ai_depth: decision.depth,
              updated_at: new Date().toISOString(),
            })
            .eq('id', lead.id);

          await recordAiUsageLog(serviceSupabase, {
            user_id: user.id,
            campaign_id: campaignId,
            lead_id: lead.id,
            company_cache_id: companyCacheId,
            operation: 'personalize_leads',
            ai_mode: campaignContext.ai_mode || 'hybrid_smart',
            ai_depth: decision.depth,
            model_used: 'cache',
            input_hash: inputHash,
            prompt_version: AI_PROMPT_VERSION,
            cache_hit: true,
            skipped: false,
            skip_reason: null,
            tokens_prompt: 0,
            tokens_completion: 0,
            tokens_total: 0,
            estimated_cost: 0,
            usage_notes: 'Reused cached personalization output.',
          });

          results.push({ id: lead.id, success: true, cached: true });
          continue;
        }

        const localFallback = buildTemplateFallbackPrompt({
          campaign: campaignContext,
          lead: { ...leadContext, ai_depth: decision.depth, ai_company_summary: companySummary },
          websiteText,
          companySummary,
          companyCacheHit: Boolean(cachedCompany),
          sequenceSubject: sequenceTemplate.subject,
          sequenceBody: sequenceTemplate.body,
        });

        const shouldUseTemplateFallback = decision.mode === 'template';
        let personalizationResult = shouldUseTemplateFallback
          ? {
              strategy: localFallback.outreach_strategy,
              subject: localFallback.subject,
              body: localFallback.email_body,
              skipped: true,
              reason: decision.reason,
              model: 'local-template',
            }
          : {
              strategy: decision.reason,
              subject: '',
              body: '',
              skipped: true,
              reason: decision.reason,
              model: 'skip',
            };

        let aiModelUsed = shouldUseTemplateFallback ? 'local-template' : 'skip';
        let skipped = true;
        let completionTokens = 0;
        let totalTokens = promptTokens;
        const skipReasonText = budgetExceeded
          ? 'AI budget limit reached; local fallback used.'
          : personalizationResult.reason || decision.reason;

        if (!budgetExceeded && decision.allowGemini) {
          const selectedModel = decision.model === 'gemini-2.5-flash' ? 'gemini-2.5-flash' : 'gemini-3.1-flash-lite';
          const ai = new GoogleGenAI({ apiKey: profile.gemini_api_key! });
          const response = await ai.models.generateContent({
            model: selectedModel,
            contents: prompt,
            config: { responseMimeType: 'application/json' },
          });

          const responseText = response.text || '{}';
          const parsed = parseJsonResponse(responseText);
          personalizationResult = {
            strategy: parsed.outreach_strategy || parsed.strategy || localFallback.outreach_strategy,
            subject: parsed.subject || localFallback.subject,
            body: parsed.email_body || parsed.body || localFallback.email_body,
            skipped: false,
            reason: '',
            model: selectedModel,
          };
          aiModelUsed = selectedModel;
          skipped = false;
          completionTokens = estimateTokensFromText(responseText);
          totalTokens = promptTokens + completionTokens;
        }

        const updatePayload: Record<string, unknown> = {
          personalization_strategy: personalizationResult.strategy,
          personalized_subject: personalizationResult.subject,
          personalized_body: personalizationResult.body,
          approval_status: 'pending_review',
          ai_status: skipped ? 'skipped' : 'generated',
          ai_input_hash: inputHash,
          ai_prompt_version: AI_PROMPT_VERSION,
          ai_model_used: aiModelUsed,
          ai_cached: false,
          ai_token_estimate: totalTokens,
          ai_usage_notes: skipped ? skipReasonText : 'AI generated successfully.',
          ai_depth: decision.depth,
          ai_generated_at: skipped ? lead.ai_generated_at || null : new Date().toISOString(),
          processing_started_at: null,
          processing_error: null,
          updated_at: new Date().toISOString(),
        };

        const { error: updateError } = await supabase.from('leads').update(updatePayload).eq('id', lead.id);
        if (updateError) {
          results.push({ id: lead.id, success: false, error: updateError.message });
          continue;
        }

        await recordAiUsageLog(serviceSupabase, {
          user_id: user.id,
          campaign_id: campaignId,
          lead_id: lead.id,
          company_cache_id: companyCacheId,
          operation: 'personalize_leads',
          ai_mode: campaignContext.ai_mode || 'hybrid_smart',
          ai_depth: decision.depth,
          model_used: aiModelUsed,
          input_hash: inputHash,
          prompt_version: AI_PROMPT_VERSION,
          cache_hit: false,
          skipped,
          skip_reason: skipped ? skipReasonText : null,
          tokens_prompt: promptTokens,
          tokens_completion: completionTokens,
          tokens_total: totalTokens,
          estimated_cost: estimateAiCost(totalTokens),
          usage_notes: updatePayload.ai_usage_notes,
        });

        if (companyCacheId === null && shouldUseTemplateFallback) {
          await upsertCompanyEnrichmentCache(serviceSupabase, {
            user_id: user.id,
            domain_key: cacheKey,
            company_name: lead.company_name || lead.company || null,
            website_url: lead.website || null,
            website_text: websiteText || null,
            source_hash: inputHash,
            enrichment_summary: companySummary || null,
            enrichment_json: {
              company_summary: companySummary || null,
            },
            ai_model_used: aiModelUsed,
            ai_prompt_version: AI_PROMPT_VERSION,
            ai_token_estimate: totalTokens,
            last_used_at: new Date().toISOString(),
          });
        }

        await createAuditLog({
          userId: user.id,
          campaignId,
          leadId: lead.id,
          action: skipped ? 'ai_skipped' : 'ai_generated',
          message: skipped
            ? `Personalization skipped for ${lead.email}: ${skipReasonText}`
            : `Personalized outreach generated for ${lead.email}`,
          metadata: {
            subject: personalizationResult.subject,
            strategy: personalizationResult.strategy,
            cached: false,
            reason: skipReasonText || null,
          },
        });

        results.push({ id: lead.id, success: true, skipped, cached: false });
      } catch (err: unknown) {
        results.push({
          id: lead.id,
          success: false,
          error: err instanceof Error ? err.message : 'Error executing AI personalization',
        });
      }
    }

    return NextResponse.json({ results });
  } catch (err: unknown) {
    console.error('Personalization route crash:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Server error' },
      { status: 500 }
    );
  }
}
