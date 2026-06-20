import { GoogleGenAI } from '@google/genai';
import { createAuditLog } from '@/lib/audit/create-audit-log';
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

const budgetCache = new Map<string, {
  dailyCalls: number;
  monthlyCalls: number;
  dailyDeepCalls: number;
  expiresAt: number;
}>();

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
  } catch (error) {
    console.warn(`Could not fetch website ${targetUrl}:`, error);
    return '';
  }
}

function parseJsonResponse(responseText: string): Record<string, unknown> {
  const trimmed = responseText.trim().replace(/^```json\s*/i, '').replace(/```$/i, '');
  try {
    return JSON.parse(trimmed);
  } catch (error) {
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(trimmed.slice(start, end + 1));
      } catch {}
    }
    throw error;
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

function mergeCompanySummary(
  cacheRow: { enrichment_json?: { company_summary?: string | null } | null; enrichment_summary?: string | null } | null,
  fallbackLead: { company_name?: string | null; company?: string | null }
): string {
  const cached = cacheRow?.enrichment_json?.company_summary || cacheRow?.enrichment_summary;
  if (cached) return cached;
  return fallbackLead.company_name || fallbackLead.company || '';
}

export async function analyzeSingleLead({
  supabase,
  serviceSupabase,
  user,
  leadId,
  campaignId,
  requestedDepth,
  requestedMode,
}: {
  supabase: any;
  serviceSupabase: any;
  user: { id: string };
  leadId: string;
  campaignId: string;
  requestedDepth?: string | null;
  requestedMode?: string | null;
}) {
  const [{ data: campaign, error: campError }, { data: lead, error: leadError }, { data: profile }] =
    await Promise.all([
      supabase
        .from('campaigns')
        .select('*')
        .eq('id', campaignId)
        .eq('user_id', user.id)
        .single(),
      supabase.from('leads').select('*').eq('id', leadId).eq('campaign_id', campaignId).single(),
      supabase.from('profiles').select('gemini_api_key').eq('id', user.id).single(),
    ]);

  if (campError || !campaign) {
    throw new Error('Campaign not found or access denied');
  }

  if (leadError || !lead) {
    throw new Error('Lead not found');
  }

  if (!profile) {
    throw new Error('Profile not found');
  }

  const aiSettings = await getAiSettingsForUser(supabase, user.id);

  const leadContext: CompactLeadContext & {
    id: string;
    email: string | null;
    company_name: string | null;
    company: string | null;
    website: string | null;
    solution: string | null;
    data_quality_score: number | null;
    ai_company_summary: string | null;
    ai_solution_angle: string | null;
    ai_outreach_strategy: string | null;
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
    ai_company_summary: lead.ai_company_summary ?? null,
    ai_solution_angle: lead.ai_solution_angle ?? null,
    ai_outreach_strategy: lead.ai_outreach_strategy ?? null,
  };

  const effectiveMode = requestedMode || campaign.ai_mode || 'hybrid_smart';
  const campaignContext: CompactCampaignContext = {
    id: campaign.id,
    name: campaign.name,
    target_industry: campaign.target_industry,
    offer_type: campaign.offer_type,
    ai_mode: effectiveMode,
    ai_depth: campaign.ai_depth,
    default_ai_depth: campaign.default_ai_depth,
    fetch_website_homepage: campaign.fetch_website_homepage,
    min_data_quality_for_ai: campaign.min_data_quality_for_ai ?? aiSettings.min_data_quality_for_ai ?? null,
    full_ai_min_solution_score:
      campaign.full_ai_min_solution_score ?? aiSettings.full_ai_min_solution_score ?? null,
    allow_deep_ai: campaign.allow_deep_ai,
    require_manual_approval_for_deep_ai: campaign.require_manual_approval_for_deep_ai,
    allow_template_fallback: campaign.allow_template_fallback,
    use_template_fallback: campaign.use_template_fallback,
  };

  const { data: sequenceStep } = await supabase
    .from('sequences')
    .select('subject, body')
    .eq('campaign_id', campaignId)
    .eq('step_number', 1)
    .maybeSingle();

  const sequenceSubject = sequenceStep?.subject || 'Outreach from {{company}}';
  const sequenceBody =
    sequenceStep?.body || 'Hi {{first_name}},\n\nI was looking into {{company}} and noticed...';

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
    requestedDepth: (requestedDepth as any) || null,
  });

  const leadDomain = getLeadDomain(lead.website);
  const companyName = getLeadCompany(lead);
  const cacheKey = leadDomain || `${companyName || lead.email}`.toLowerCase().replace(/\s+/g, '-');
  const existingInputHash = buildInputHash({
    campaign: campaignContext,
    lead: { ...leadContext, ai_depth: decision.depth },
    sequenceSubject,
    sequenceBody,
  });

  const shouldFetchWebsite = campaign.fetch_website_homepage !== false;
  const existingLeadState = lead.ai_input_hash === existingInputHash && lead.ai_prompt_version === AI_PROMPT_VERSION;

  if (
    existingLeadState &&
    lead.ai_subject &&
    lead.ai_email_body &&
    ['generated', 'edited', 'skipped'].includes(lead.ai_status)
  ) {
    const cacheNote = 'Reused cached AI output because the prompt hash matched.';
    await supabase
      .from('leads')
      .update({
        ai_cached: true,
        ai_usage_notes: cacheNote,
        ai_model_used: lead.ai_model_used || 'cache',
        ai_prompt_version: AI_PROMPT_VERSION,
        ai_input_hash: existingInputHash,
        ai_depth: decision.depth,
        updated_at: new Date().toISOString(),
      })
      .eq('id', lead.id);

    await recordAiUsageLog(serviceSupabase, {
      user_id: user.id,
      campaign_id: campaignId,
      lead_id: lead.id,
      company_cache_id: null,
      operation: 'analyze_lead',
      ai_mode: campaignContext.ai_mode || 'hybrid_smart',
      ai_depth: decision.depth,
      model_used: lead.ai_model_used || 'cache',
      input_hash: existingInputHash,
      prompt_version: AI_PROMPT_VERSION,
      cache_hit: true,
      skipped: false,
      skip_reason: null,
      tokens_prompt: 0,
      tokens_completion: 0,
      tokens_total: 0,
      estimated_cost: 0,
      usage_notes: cacheNote,
    });

    await createAuditLog({
      userId: user.id,
      campaignId,
      leadId: lead.id,
      action: 'ai_cached',
      message: `Cached AI output reused for ${lead.email}`,
      metadata: { input_hash: existingInputHash },
    });

    return {
      success: true,
      cached: true,
      skipped: false,
      reason: cacheNote,
      result: {
        company_summary: lead.ai_company_summary,
        lead_analysis: lead.ai_lead_analysis,
        pain_point_summary: lead.ai_pain_point_summary,
        solution_angle: lead.ai_solution_angle,
        outreach_strategy: lead.ai_outreach_strategy,
        personalized_first_line: lead.ai_personalized_first_line,
        recommended_offer: campaign.offer_type,
        subject: lead.ai_subject,
        email_body: lead.ai_email_body,
        cta: lead.ai_cta,
        confidence_score: lead.ai_confidence_score,
        data_quality_notes: 'Cached result reused.',
        missing_data: [],
      },
    };
  }

  let usageSkipReason: string | null = null;
  let websiteText = '';
  let companySummary = '';
  let companyCacheId: string | null = null;
  let companyCacheHit = false;

  const cachedCompany = leadDomain
    ? await getCompanyEnrichmentCache(serviceSupabase, user.id, leadDomain)
    : null;

  if (cachedCompany) {
    companyCacheHit = true;
    companyCacheId = cachedCompany.id;
    companySummary = mergeCompanySummary(cachedCompany, lead);
    websiteText = truncateText(cachedCompany.website_text || '', 2800);
    await serviceSupabase
      .from('company_enrichment_cache')
      .update({
        last_used_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', cachedCompany.id);
  } else if (decision.useWebsite && shouldFetchWebsite && lead.website) {
    websiteText = await scrapeWebsite(lead.website);
  }

  if (!companySummary) {
    companySummary = companyName || lead.website || campaign.name;
  }

  const promptInput = {
    campaign: campaignContext,
    lead: { ...leadContext, ai_depth: decision.depth, ai_company_summary: companySummary },
    websiteText,
    companySummary,
    companyCacheHit,
    sequenceSubject,
    sequenceBody,
  };

  const prompt = buildCompactAiPrompt(promptInput);
  const promptTokens = estimateTokensFromText(prompt);

  const dailyFrom = startOfDayIso();
  const monthlyFrom = startOfMonthIso();
  const nowIso = new Date().toISOString();

  const budgetCacheKey = `${user.id}:${dailyFrom}`;
  const cachedBudget = budgetCache.get(budgetCacheKey);
  let dailyCalls = 0;
  let monthlyCalls = 0;
  let dailyDeepCalls = 0;

  if (cachedBudget && cachedBudget.expiresAt > Date.now()) {
    dailyCalls = cachedBudget.dailyCalls;
    monthlyCalls = cachedBudget.monthlyCalls;
    dailyDeepCalls = cachedBudget.dailyDeepCalls;
  } else {
    const [dailyUsage, monthlyUsage, dailyDeepUsage] = await Promise.all([
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

    dailyCalls = dailyUsage.count || 0;
    monthlyCalls = monthlyUsage.count || 0;
    dailyDeepCalls = dailyDeepUsage.count || 0;

    budgetCache.set(budgetCacheKey, {
      dailyCalls,
      monthlyCalls,
      dailyDeepCalls,
      expiresAt: Date.now() + 30 * 1000,
    });
  }
  const dailyLimit = aiSettings.daily_ai_limit ?? 0;
  const monthlyLimit = aiSettings.monthly_ai_limit ?? 0;
  const dailyDeepLimit = aiSettings.daily_deep_ai_limit ?? 0;
  const budgetExceeded =
    Boolean(aiSettings.stop_ai_when_limit_reached) &&
    ((dailyLimit > 0 && dailyCalls >= dailyLimit) || (monthlyLimit > 0 && monthlyCalls >= monthlyLimit));
  const deepLimitExceeded =
    decision.model === 'gemini-2.5-flash' &&
    dailyDeepLimit > 0 &&
    dailyDeepCalls >= dailyDeepLimit;

  if (budgetExceeded) {
    usageSkipReason = `AI budget limit reached (${dailyCalls}/${dailyLimit} today, ${monthlyCalls}/${monthlyLimit} this month).`;
  }
  if (deepLimitExceeded) {
    usageSkipReason = `Deep AI daily limit reached (${dailyDeepCalls}/${dailyDeepLimit}).`;
  }

  const shouldUseGemini = decision.allowGemini && !budgetExceeded && !deepLimitExceeded && Boolean(profile.gemini_api_key);
  const localFallback = buildTemplateFallbackPrompt({
    campaign: campaignContext,
    lead: { ...leadContext, ai_depth: decision.depth, ai_company_summary: companySummary },
    websiteText,
    companySummary,
    companyCacheHit,
    sequenceSubject,
    sequenceBody,
  });

  const shouldUseTemplateFallback = decision.mode === 'template';
  let resultPayload: Record<string, unknown> | null = shouldUseTemplateFallback ? localFallback : null;
  let aiModelUsed = shouldUseTemplateFallback ? 'local-template' : 'skip';
  const aiCached = false;
  let aiStatus: 'generated' | 'skipped' = 'skipped';
  let completionTokens = 0;
  let totalTokens = promptTokens;

  if (shouldUseGemini) {
    const ai = new GoogleGenAI({ apiKey: profile.gemini_api_key! });
    await supabase
      .from('leads')
      .update({
        ai_status: 'processing',
        processing_started_at: nowIso,
        processing_error: null,
        ai_depth: decision.depth,
        updated_at: nowIso,
      })
      .eq('id', lead.id);

    const response = await ai.models.generateContent({
      model: decision.model === 'gemini-2.5-flash' ? 'gemini-2.5-flash' : 'gemini-3.1-flash-lite',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const responseText = response.text || '{}';
    const parsed = parseJsonResponse(responseText);
    resultPayload = {
      ...parsed,
      missing_data: Array.isArray(parsed.missing_data) ? parsed.missing_data : [],
    };
    aiModelUsed = decision.model === 'gemini-2.5-flash' ? 'gemini-2.5-flash' : 'gemini-3.1-flash-lite';
    aiStatus = 'generated';
    completionTokens = estimateTokensFromText(responseText);
    totalTokens = promptTokens + completionTokens;
  } else if (usageSkipReason) {
    aiStatus = 'skipped';
  } else if (decision.mode === 'template') {
    aiStatus = 'skipped';
    usageSkipReason = decision.reason;
  } else if (!profile.gemini_api_key) {
    aiStatus = 'skipped';
    usageSkipReason = 'Gemini API key is not configured.';
  } else if (decision.mode === 'skip') {
    aiStatus = 'skipped';
    usageSkipReason = decision.reason;
    aiModelUsed = 'skip';
    resultPayload = null;
  }

  const inputHash = existingInputHash;
  const companyCacheSummary = resultPayload?.company_summary || companySummary;

  const leadUpdate: Record<string, unknown> = {
    ai_input_hash: inputHash,
    ai_prompt_version: AI_PROMPT_VERSION,
    ai_model_used: aiModelUsed,
    ai_cached: aiCached,
    ai_token_estimate: totalTokens,
    ai_usage_notes: usageSkipReason || (companyCacheHit ? 'Company enrichment reused from cache.' : 'AI generated successfully.'),
    ai_depth: decision.depth,
    processing_started_at: null,
    processing_error: null,
    updated_at: nowIso,
  };

  if (resultPayload) {
    leadUpdate.ai_company_summary = resultPayload.company_summary || null;
    leadUpdate.ai_lead_analysis = resultPayload.lead_analysis || null;
    leadUpdate.ai_pain_point_summary = resultPayload.pain_point_summary || null;
    leadUpdate.ai_solution_angle = resultPayload.solution_angle || null;
    leadUpdate.ai_outreach_strategy = resultPayload.outreach_strategy || null;
    leadUpdate.ai_personalized_first_line = resultPayload.personalized_first_line || null;
    leadUpdate.ai_subject = resultPayload.subject || null;
    leadUpdate.ai_email_body = resultPayload.email_body || null;
    leadUpdate.ai_cta = resultPayload.cta || null;
    leadUpdate.recommended_offer = resultPayload.recommended_offer || campaign.offer_type || null;
    leadUpdate.ai_confidence_score =
      resultPayload.confidence_score !== undefined ? Number(resultPayload.confidence_score) : null;
    leadUpdate.ai_status = aiStatus;
    leadUpdate.status = aiStatus === 'generated' ? 'ai_generated' : lead.status;
    leadUpdate.ai_generated_at = aiStatus === 'generated' ? nowIso : lead.ai_generated_at || null;
  } else {
    leadUpdate.ai_status = 'skipped';
  }

  const { error: updateError } = await supabase.from('leads').update(leadUpdate).eq('id', lead.id);
  if (updateError) {
    throw updateError;
  }

  await recordAiUsageLog(serviceSupabase, {
    user_id: user.id,
    campaign_id: campaignId,
    lead_id: lead.id,
    company_cache_id: companyCacheId,
    operation: 'analyze_lead',
    ai_mode: campaignContext.ai_mode || 'hybrid_smart',
    ai_depth: decision.depth,
    model_used: aiModelUsed,
    input_hash: inputHash,
    prompt_version: AI_PROMPT_VERSION,
    cache_hit: aiCached,
    skipped: aiStatus === 'skipped',
    skip_reason: usageSkipReason || (aiStatus === 'skipped' ? decision.reason : null),
    tokens_prompt: promptTokens,
    tokens_completion: completionTokens,
    tokens_total: totalTokens,
    estimated_cost: estimateAiCost(totalTokens),
    usage_notes: usageSkipReason || (companyCacheHit ? 'Company enrichment reused from cache.' : null),
  });

  if (resultPayload && companyCacheId === null) {
    await upsertCompanyEnrichmentCache(serviceSupabase, {
      user_id: user.id,
      domain_key: cacheKey,
      company_name: companyName || null,
      website_url: lead.website || null,
      website_text: websiteText || null,
      source_hash: inputHash,
      enrichment_summary: typeof companyCacheSummary === 'string' ? companyCacheSummary : String(companyCacheSummary || ''),
      enrichment_json: {
        company_summary: typeof resultPayload.company_summary === 'string' ? resultPayload.company_summary : null,
        lead_analysis: resultPayload.lead_analysis || null,
        pain_point_summary: resultPayload.pain_point_summary || null,
        solution_angle: resultPayload.solution_angle || null,
        outreach_strategy: resultPayload.outreach_strategy || null,
      },
      ai_model_used: aiModelUsed,
      ai_prompt_version: AI_PROMPT_VERSION,
      ai_token_estimate: totalTokens,
      last_used_at: nowIso,
    });
  }

  await createAuditLog({
    userId: user.id,
    campaignId,
    leadId: lead.id,
    action: aiStatus === 'generated' ? 'ai_generated' : 'ai_skipped',
    message:
      aiStatus === 'generated'
        ? `AI personalization generated for ${lead.email}`
        : `AI skipped for ${lead.email}: ${usageSkipReason || decision.reason}`,
    metadata: {
      cached: aiCached,
      input_hash: inputHash,
      model_used: aiModelUsed,
      reason: usageSkipReason || decision.reason,
    },
  });

  return {
    success: true,
    cached: aiCached,
    skipped: aiStatus === 'skipped',
    reason: usageSkipReason || decision.reason,
    result: resultPayload,
  };
}
