import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { createClient } from '@/utils/supabase/server';
import { createServiceClient } from '@/utils/supabase/service';
import { createAuditLog } from '@/lib/audit/create-audit-log';
import { isMissingTableError } from '@/lib/supabase/schema-errors';
import {
  AI_DEEP_MODEL,
  AI_DEFAULT_MODEL,
  AI_PROMPT_VERSION,
  buildCompactAiPrompt,
  buildInputHash,
  buildTemplateFallbackPrompt,
  determineAiDecision,
  estimateAiCost,
  estimateTokensFromText,
  type CompactCampaignContext,
  type CompactLeadContext,
  getLeadCompany,
  getLeadDomain,
  sanitizeLeadForAi,
  truncateText,
  type CompactAiPromptInput,
} from '@/lib/ai/efficiency';
import {
  getAiSettingsForUser,
  getCompanyEnrichmentCache,
  recordAiUsageLog,
  reserveAiCallBudget,
  updateAiUsageLog,
  upsertCompanyEnrichmentCache,
} from '@/lib/ai/runtime';
import { parseJsonResponse, scrapeWebsite } from '@/lib/ai/analyze-lead';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
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
    const body = (await request.json().catch(() => ({}))) as {
      offerType?: string;
      customInstructions?: string;
      requestedDepth?: 'none' | 'basic' | 'standard' | 'deep';
      requestedMode?: 'template_only' | 'basic_ai' | 'standard_ai' | 'deep_ai' | 'hybrid_smart' | 'manual_only';
    };

    const { data: lead, error: leadError } = await supabase.from('leads').select('*').eq('id', id).maybeSingle();

    if (leadError || !lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    const leadList = lead.lead_list_id
      ? await supabase.from('lead_lists').select('id, name, user_id').eq('id', lead.lead_list_id).maybeSingle()
      : { data: null, error: null };

    if (lead.user_id === user.id) {
      // Global library lead owned by the current user.
    } else if (lead.lead_list_id) {
      const list = leadList.data;
      const listError = leadList.error;
      if ((listError && isMissingTableError(listError, 'lead_lists')) || !list || list.user_id !== user.id) {
        if (listError && isMissingTableError(listError, 'lead_lists')) {
          return NextResponse.json(
            { error: 'Lead lists are not available in this database yet. Apply the migration first.' },
            { status: 503 }
          );
        }
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
    } else {
      const { data: camp } = await supabase
        .from('campaigns')
        .select('user_id')
        .eq('id', lead.campaign_id)
        .single();
      if (!camp || camp.user_id !== user.id) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
    }

    const aiSettings = await getAiSettingsForUser(supabase, user.id);
    const { data: profile } = await supabase
      .from('profiles')
      .select('gemini_api_key')
      .eq('id', user.id)
      .single();

    if (!profile?.gemini_api_key) {
      return NextResponse.json({ error: 'Gemini API key is not configured.' }, { status: 400 });
    }

    const leadDomain = getLeadDomain(lead.website);
    const companyCache = leadDomain
      ? await getCompanyEnrichmentCache(serviceSupabase, user.id, leadDomain)
      : null;
    const companySummary =
      companyCache?.enrichment_json?.company_summary ||
      companyCache?.enrichment_summary ||
      lead.company_name ||
      lead.company ||
      lead.website ||
      'Prospect';

    let websiteText = companyCache ? truncateText(companyCache.website_text || '', 2400) : '';
    if (!websiteText && lead.website) {
      websiteText = await scrapeWebsite(lead.website);
    }

    const requestedMode = body.requestedMode || 'hybrid_smart';
    const promptInput: CompactAiPromptInput = {
      campaign: {
        id: leadList.data?.id || 'library',
        name: leadList.data?.name || 'Lead Library',
        target_industry: lead.industry || null,
        offer_type: body.offerType || 'Custom software development',
        ai_mode: requestedMode,
        ai_depth: body.requestedDepth || 'standard',
        default_ai_depth: body.requestedDepth || 'standard',
        allow_deep_ai: true,
        require_manual_approval_for_deep_ai: true,
        fetch_website_homepage: true,
        min_data_quality_for_ai: aiSettings.min_data_quality_for_ai,
        full_ai_min_solution_score: aiSettings.full_ai_min_solution_score,
        allow_template_fallback: true,
        use_template_fallback: true,
      },
      lead: {
        ...sanitizeLeadForAi(lead),
        id: lead.id,
        email: lead.email,
        company_name: lead.company_name,
        company: lead.company,
        website: lead.website,
        solution: lead.solution ?? null,
        ai_depth: body.requestedDepth || 'standard',
      },
      websiteText,
      companySummary,
      companyCacheHit: Boolean(companyCache),
      sequenceSubject: '',
      sequenceBody: '',
      extraContext:
        body.customInstructions || 'Create a concise outreach email for a global lead in the library.',
    };

    const prompt = buildCompactAiPrompt(promptInput);
    const inputHash = buildInputHash(promptInput);
    const existingLeadState =
      lead.ai_input_hash === inputHash && lead.ai_prompt_version === AI_PROMPT_VERSION && lead.personalized_body;

    if (existingLeadState) {
      const { error: updateError } = await supabase
        .from('leads')
        .update({
          ai_cached: true,
          ai_usage_notes: 'Reused cached personalization output.',
          ai_prompt_version: AI_PROMPT_VERSION,
          ai_input_hash: inputHash,
          ai_depth: body.requestedDepth || lead.ai_depth || 'standard',
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);
      if (updateError) throw updateError;

      await recordAiUsageLog(serviceSupabase, {
        user_id: user.id,
        lead_id: id,
        action: 'personalize_lead',
        model: AI_DEFAULT_MODEL,
        ai_depth: body.requestedDepth || lead.ai_depth || 'standard',
        input_tokens: 0,
        output_tokens: 0,
        total_tokens: 0,
        cached: true,
        skipped: false,
        skip_reason: null,
        campaign_id: lead.campaign_id || null,
        operation: 'personalize_lead',
        model_used: AI_DEFAULT_MODEL,
        input_hash: inputHash,
        prompt_version: AI_PROMPT_VERSION,
        cache_hit: true,
        tokens_prompt: 0,
        tokens_completion: 0,
        tokens_total: 0,
        estimated_cost: 0,
        usage_notes: 'Reused cached personalization output.',
      });

      await createAuditLog({
        userId: user.id,
        leadId: id,
        action: 'ai_cached',
        message: `Lead library AI personalization reused cache for ${lead.email}`,
        metadata: { input_hash: inputHash, model_used: AI_DEFAULT_MODEL },
      });

      return NextResponse.json({ success: true, cached: true, result: null });
    }

    const decision = determineAiDecision({
      campaign: promptInput.campaign as CompactCampaignContext,
      lead: promptInput.lead as CompactLeadContext,
      budget: {
        daily_ai_call_limit: aiSettings.daily_ai_limit ?? null,
        monthly_ai_call_limit: aiSettings.monthly_ai_limit ?? null,
        max_bulk_ai_batch_size: aiSettings.max_bulk_ai_batch_size ?? null,
        min_data_quality_for_ai: aiSettings.min_data_quality_for_ai ?? null,
        full_ai_min_solution_score: aiSettings.full_ai_min_solution_score ?? null,
        stop_ai_when_limit_reached: aiSettings.stop_ai_when_limit_reached ?? null,
      },
      settings: aiSettings,
      requestedDepth: body.requestedDepth || null,
    });

    const localFallback = buildTemplateFallbackPrompt(promptInput);
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
    const promptTokens = estimateTokensFromText(prompt);
    let totalTokens = promptTokens;
    let skipReasonText = personalizationResult.reason || decision.reason;

    // Atomically reserve a budget slot (rather than checking a stale count)
    // so this route can't race bulk-analyze/analyze-lead into overshooting
    // the configured daily/monthly/deep limits.
    const dailyLimit = aiSettings.daily_ai_limit ?? 0;
    const monthlyLimit = aiSettings.monthly_ai_limit ?? 0;
    const deepLimit = aiSettings.daily_deep_ai_limit ?? 0;
    const stopWhenLimitReached = Boolean(aiSettings.stop_ai_when_limit_reached);
    let reservationId: string | null = null;
    if (decision.allowGemini) {
      const reservation = await reserveAiCallBudget(serviceSupabase, {
        userId: user.id,
        dailyLimit: stopWhenLimitReached ? dailyLimit : 0,
        monthlyLimit: stopWhenLimitReached ? monthlyLimit : 0,
        dailyDeepLimit: deepLimit,
        isDeep: decision.model === AI_DEEP_MODEL,
        model: decision.model,
      });
      reservationId = reservation.reservationId;
      if (!reservationId) {
        skipReasonText =
          reservation.reason === 'deep'
            ? `Deep AI daily limit reached (${reservation.dailyDeepCalls}/${deepLimit}).`
            : `AI budget limit reached (${reservation.dailyCalls}/${dailyLimit} today, ${reservation.monthlyCalls}/${monthlyLimit} this month).`;
      }
    }

    if (reservationId) {
      const selectedModel = decision.model === AI_DEEP_MODEL ? AI_DEEP_MODEL : AI_DEFAULT_MODEL;
      try {
        const ai = new GoogleGenAI({ apiKey: profile.gemini_api_key });
        const response = await ai.models.generateContent({
          model: selectedModel,
          contents: prompt,
          config: { responseMimeType: 'application/json' },
        });

        const responseText = response.text || '{}';
        const parsed = parseJsonResponse(responseText);
        personalizationResult = {
          strategy: typeof parsed.outreach_strategy === 'string' ? parsed.outreach_strategy : localFallback.outreach_strategy,
          subject: typeof parsed.subject === 'string' ? parsed.subject : localFallback.subject,
          body:
            typeof parsed.email_body === 'string'
              ? parsed.email_body
              : typeof parsed.body === 'string'
                ? parsed.body
                : localFallback.email_body,
          skipped: false,
          reason: '',
          model: selectedModel,
        };
        aiModelUsed = selectedModel;
        skipped = false;
        completionTokens = estimateTokensFromText(responseText);
        totalTokens = promptTokens + completionTokens;
      } catch (aiError: unknown) {
        console.error('AI personalization failed, falling back to template:', aiError);
        personalizationResult = {
          strategy: localFallback.outreach_strategy,
          subject: localFallback.subject,
          body: localFallback.email_body,
          skipped: true,
          reason: aiError instanceof Error ? aiError.message : 'AI generation failed; template fallback used.',
          model: 'local-template',
        };
        aiModelUsed = 'local-template';
        skipped = true;
      }
    }

    const leadUpdate = {
      ai_company_summary: companySummary,
      ai_lead_analysis: personalizationResult.strategy,
      ai_pain_point_summary:
        personalizationResult.reason || companySummary || null,
      ai_solution_angle: personalizationResult.strategy,
      ai_outreach_strategy: personalizationResult.strategy,
      ai_personalized_first_line: localFallback.email_body ? localFallback.email_body.split('\n')[0] : null,
      ai_subject: personalizationResult.subject,
      ai_email_body: personalizationResult.body,
      ai_cta: null,
      ai_confidence_score: skipped ? 0 : 75,
      ai_status: skipped ? 'skipped' : 'generated',
      ai_input_hash: inputHash,
      ai_prompt_version: AI_PROMPT_VERSION,
      ai_model_used: aiModelUsed,
      ai_cached: false,
      ai_token_estimate: totalTokens,
      ai_usage_notes: skipped ? skipReasonText : 'AI generated successfully.',
      ai_depth: body.requestedDepth || lead.ai_depth || 'standard',
      status: skipped ? lead.status : 'ai_generated',
      manual_personalization_status: 'drafted',
      manual_email_subject: personalizationResult.subject,
      manual_email_body: personalizationResult.body,
      manual_email_approved: false,
      updated_at: new Date().toISOString(),
    };

    const { error: updateError } = await serviceSupabase.from('leads').update(leadUpdate).eq('id', id);
    if (updateError) throw updateError;

    if (reservationId) {
      // The reservation already inserted a real usage-log row atomically as
      // part of the budget check. If the Gemini call subsequently failed
      // (caught above, falling back to the template), mark it skipped so it
      // doesn't count against the budget — matching the pre-reservation
      // behavior where only successful attempts were counted.
      await updateAiUsageLog(serviceSupabase, reservationId, {
        action: skipped ? 'ai_skipped' : 'ai_generated',
        operation: skipped ? 'ai_skipped' : 'ai_generated',
        campaign_id: lead.campaign_id || null,
        lead_id: id,
        ai_depth: body.requestedDepth || lead.ai_depth || 'standard',
        model_used: aiModelUsed,
        input_hash: inputHash,
        prompt_version: AI_PROMPT_VERSION,
        skipped,
        skip_reason: skipped ? skipReasonText : null,
        tokens_prompt: promptTokens,
        tokens_completion: completionTokens,
        tokens_total: totalTokens,
        estimated_cost: estimateAiCost(totalTokens),
        usage_notes: leadUpdate.ai_usage_notes,
      });
    } else {
      await recordAiUsageLog(serviceSupabase, {
        user_id: user.id,
        campaign_id: lead.campaign_id || null,
        lead_id: id,
        action: skipped ? 'ai_skipped' : 'ai_generated',
        model: aiModelUsed,
        ai_depth: body.requestedDepth || lead.ai_depth || 'standard',
        input_tokens: promptTokens,
        output_tokens: completionTokens,
        total_tokens: totalTokens,
        cached: false,
        skipped,
        skip_reason: skipped ? skipReasonText : null,
        operation: skipped ? 'ai_skipped' : 'ai_generated',
        model_used: aiModelUsed,
        input_hash: inputHash,
        prompt_version: AI_PROMPT_VERSION,
        cache_hit: false,
        tokens_prompt: promptTokens,
        tokens_completion: completionTokens,
        tokens_total: totalTokens,
        estimated_cost: estimateAiCost(totalTokens),
        usage_notes: leadUpdate.ai_usage_notes,
      });
    }

    await createAuditLog({
      userId: user.id,
      leadId: id,
      action: skipped ? 'ai_skipped' : 'ai_generated',
      message: skipped
        ? `Lead library AI personalization skipped for ${lead.email}: ${skipReasonText}`
        : `Lead library AI personalization generated for ${lead.email}`,
      metadata: {
        input_hash: inputHash,
        model_used: aiModelUsed,
        cached: false,
        reason: skipReasonText || null,
      },
    });

    if (companyCache === null && shouldUseTemplateFallback) {
      await upsertCompanyEnrichmentCache(serviceSupabase, {
        user_id: user.id,
        domain_key: leadDomain || `${getLeadCompany(lead) || lead.email}`.toLowerCase().replace(/\s+/g, '-'),
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

    return NextResponse.json({ success: true, result: personalizationResult, cached: false });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error generating personalization';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
