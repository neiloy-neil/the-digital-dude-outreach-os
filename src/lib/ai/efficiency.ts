import crypto from 'crypto';
import type { Lead } from '@/types/database.types';

export const AI_PROMPT_VERSION = '2026-06-ai-efficiency-v1';
export const AI_DEFAULT_MODEL = 'gemini-3.1-flash-lite';
export const AI_DEEP_MODEL = 'gemini-2.5-flash';
export const AI_MODEL = AI_DEEP_MODEL;

export type AiMode =
  | 'template_only'
  | 'basic_ai'
  | 'standard_ai'
  | 'deep_ai'
  | 'hybrid_smart'
  | 'manual_only'
  | 'light_ai'
  | 'full_ai';
export type AiDepth = 'none' | 'basic' | 'standard' | 'deep';
export type AiModelName = 'gemini-3.1-flash-lite' | 'gemini-2.5-flash';

export type AiExecutionMode = 'gemini' | 'cached' | 'template' | 'skip';

export interface AiBudgetRules {
  daily_ai_call_limit?: number | null;
  monthly_ai_call_limit?: number | null;
  max_bulk_ai_batch_size?: number | null;
  min_data_quality_for_ai?: number | null;
  full_ai_min_solution_score?: number | null;
  stop_ai_when_limit_reached?: boolean | null;
}

export interface AiSettings {
  id?: string;
  user_id?: string;
  default_model?: AiModelName | string | null;
  deep_model?: AiModelName | string | null;
  daily_ai_limit?: number | null;
  daily_deep_ai_limit?: number | null;
  monthly_ai_limit?: number | null;
  max_bulk_ai_batch_size?: number | null;
  min_data_quality_for_ai?: number | null;
  full_ai_min_solution_score?: number | null;
  use_flash_lite_by_default?: boolean | null;
  deep_ai_only_for_high_priority?: boolean | null;
  stop_ai_when_limit_reached?: boolean | null;
}

export interface AiDecision {
  mode: AiExecutionMode;
  reason: string;
  depth: AiDepth;
  model: AiModelName | 'local-template' | 'skip';
  useWebsite: boolean;
  allowGemini: boolean;
  shouldUseCache: boolean;
}

export interface CompactLeadContext {
  id: string;
  email: string;
  first_name?: string | null;
  last_name?: string | null;
  company_name?: string | null;
  company?: string | null;
  website?: string | null;
  industry?: string | null;
  sub_industry?: string | null;
  country?: string | null;
  city?: string | null;
  company_size?: string | null;
  estimated_revenue?: string | null;
  decision_maker_name?: string | null;
  decision_maker_title?: string | null;
  linkedin_url?: string | null;
  tech_stack?: string | null;
  pain_points?: string | null;
  solution?: string | null;
  solution_fit_score?: number | null;
  lead_source?: string | null;
  priority?: string | null;
  assigned_to?: string | null;
  tags?: string | null;
  notes?: string | null;
  data_quality_score?: number | null;
  ai_depth?: AiDepth | null;
  ai_company_summary?: string | null;
  ai_solution_angle?: string | null;
  ai_outreach_strategy?: string | null;
}

export interface CompactCampaignContext {
  id: string;
  name: string;
  target_industry?: string | null;
  offer_type?: string | null;
  ai_mode?: AiMode | null;
  ai_depth?: AiDepth | null;
  default_ai_depth?: AiDepth | null;
  fetch_website_homepage?: boolean | null;
  min_data_quality_for_ai?: number | null;
  full_ai_min_solution_score?: number | null;
  allow_deep_ai?: boolean | null;
  require_manual_approval_for_deep_ai?: boolean | null;
  allow_template_fallback?: boolean | null;
  use_template_fallback?: boolean | null;
}

export interface CompactAiPromptInput {
  campaign: CompactCampaignContext;
  lead: CompactLeadContext;
  websiteText?: string;
  companySummary?: string | null;
  companyCacheHit?: boolean;
  sequenceSubject?: string;
  sequenceBody?: string;
  extraContext?: string;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function stableSort(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => stableSort(item));
  }

  if (isPlainObject(value)) {
    return Object.keys(value)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        const nested = value[key];
        if (nested !== undefined && nested !== null && nested !== '') {
          acc[key] = stableSort(nested);
        }
        return acc;
      }, {});
  }

  return value;
}

function normalizeAiMode(mode?: AiMode | null): AiMode {
  if (!mode) return 'hybrid_smart';
  if (mode === 'light_ai') return 'basic_ai';
  if (mode === 'full_ai') return 'deep_ai';
  return mode;
}

function normalizeModelName(value?: string | null, fallback: AiModelName): AiModelName {
  return value === AI_DEEP_MODEL ? AI_DEEP_MODEL : fallback;
}

export function stableStringify(value: unknown): string {
  return JSON.stringify(stableSort(value));
}

export function normalizeText(value: unknown): string {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function truncateText(value: unknown, maxLength: number): string {
  const text = normalizeText(value);
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trim();
}

export function getLeadDisplayName(lead: Pick<Lead, 'decision_maker_name' | 'first_name' | 'last_name' | 'email'>): string {
  const name = normalizeText(lead.decision_maker_name || `${lead.first_name || ''} ${lead.last_name || ''}`);
  return name || normalizeText(lead.email);
}

export function getLeadCompany(lead: Pick<Lead, 'company_name' | 'company'>): string {
  return normalizeText(lead.company_name || lead.company || '');
}

export function getLeadDomain(website?: string | null): string {
  if (!website) return '';
  const trimmed = normalizeText(website);
  if (!trimmed) return '';

  try {
    const url = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`);
    return url.hostname.replace(/^www\./i, '').toLowerCase();
  } catch {
    return trimmed.replace(/^https?:\/\//i, '').replace(/^www\./i, '').split('/')[0].toLowerCase();
  }
}

export function getLeadPromptDepth(
  campaignDepth: AiDepth | null | undefined,
  lead: Pick<Lead, 'data_quality_score' | 'solution_fit_score' | 'priority'>,
  mode: AiMode
): AiDepth {
  const normalizedMode = normalizeAiMode(mode);
  if (campaignDepth && campaignDepth !== 'none') return campaignDepth;
  if (normalizedMode === 'deep_ai') return 'deep';
  if (normalizedMode === 'basic_ai') return 'basic';
  if (normalizedMode === 'standard_ai') return 'standard';
  if ((lead.data_quality_score || 0) >= 80 && (lead.solution_fit_score || 0) >= 70) return 'deep';
  if ((lead.data_quality_score || 0) >= 55) return 'standard';
  if ((lead.priority || '').toLowerCase() === 'high') return 'standard';
  return 'basic';
}

export function resolveAiModel(params: {
  depth: AiDepth;
  requestedDepth?: AiDepth | null;
  lead: Pick<Lead, 'priority' | 'solution_fit_score'>;
  settings?: AiSettings | null;
}): AiModelName {
  const settings = params.settings || {};
  const defaultModel = normalizeModelName(settings.default_model || null, settings.use_flash_lite_by_default === false ? AI_DEEP_MODEL : AI_DEFAULT_MODEL);
  const deepModel = normalizeModelName(settings.deep_model || null, AI_DEEP_MODEL);
  const priority = normalizeText(params.lead.priority).toLowerCase();
  const highPriority = priority === 'high';
  const solutionQualified = Number(params.lead.solution_fit_score || 0) >= 70;
  const manualDeep = params.requestedDepth === 'deep';
  const deepAllowed =
    !settings.deep_ai_only_for_high_priority ||
    highPriority ||
    solutionQualified ||
    manualDeep;

  if (params.depth === 'deep' && deepAllowed) {
    return deepModel;
  }

  return defaultModel;
}

export function sanitizeLeadForAi(lead: Record<string, unknown>) {
  const compactLead: Record<string, unknown> = {};
  const excludedKeys = new Set([
    'id',
    'campaign_id',
    'created_at',
    'updated_at',
    'processing_started_at',
    'processing_error',
    'unsubscribe_token',
    'variables',
    'raw_data',
  ]);

  Object.entries(lead || {}).forEach(([key, value]) => {
    if (excludedKeys.has(key)) return;
    if (value === null || value === undefined || value === '') return;

    if (typeof value === 'string') {
      const normalized = normalizeText(value);
      if (normalized) compactLead[key] = normalized;
      return;
    }

    if (typeof value === 'number' || typeof value === 'boolean') {
      compactLead[key] = value;
      return;
    }

    if (Array.isArray(value)) {
      const deduped = Array.from(new Set(value.map((item) => normalizeText(item)).filter(Boolean)));
      if (deduped.length > 0) compactLead[key] = deduped;
      return;
    }

    if (isPlainObject(value)) {
      const entries = Object.entries(value)
        .filter(([, nested]) => nested !== null && nested !== undefined && nested !== '')
        .map(([nestedKey, nestedValue]) => [nestedKey, typeof nestedValue === 'string' ? normalizeText(nestedValue) : nestedValue]);
      if (entries.length > 0) {
        compactLead[key] = Object.fromEntries(entries);
      }
    }
  });

  return compactLead;
}

export function buildTemplateFallbackPrompt({
  campaign,
  lead,
  sequenceSubject,
  sequenceBody,
}: CompactAiPromptInput): {
  company_summary: string;
  lead_analysis: string;
  pain_point_summary: string;
  solution_angle: string;
  outreach_strategy: string;
  personalized_first_line: string;
  recommended_offer: string;
  subject: string;
  email_body: string;
  cta: string;
  confidence_score: number;
  data_quality_notes: string;
  missing_data: string[];
} {
  const firstName = lead.first_name || lead.decision_maker_name || 'there';
  const company = getLeadCompany(lead) || 'the company';
  const offer = campaign.offer_type || 'custom software';
  const painPoint = lead.pain_points || lead.tech_stack || campaign.target_industry || 'operational inefficiency';
  const solution = lead.solution || offer;
  const subject = truncateText(sequenceSubject || `Quick question about ${company}`, 60) || `Quick question about ${company}`;
  const body = truncateText(
    sequenceBody ||
      `Hi ${firstName},\n\nI took a quick look at ${company} and thought ${painPoint} might be worth a conversation. Positioning ${solution} here could be useful.\n\nOpen to a short email exchange?\n\n{{unsubscribe_url}}`,
    900
  );

  return {
    company_summary: `${company} appears to be a ${campaign.target_industry || 'B2B'} business with an opportunity around ${painPoint}.`,
    lead_analysis: `Local fallback generated from available lead data without Gemini.`,
    pain_point_summary: `The strongest signal appears to be ${painPoint}.`,
    solution_angle: `We can position ${solution} around reducing friction and improving execution.`,
    outreach_strategy: `Use a concise, low-friction message grounded in the data we already have.`,
    personalized_first_line: `I was taking a quick look at ${company} and thought it might be worth reaching out.`,
    recommended_offer: offer,
    subject,
    email_body: body.includes('{{unsubscribe_url}}') ? body : `${body}\n\n{{unsubscribe_url}}`,
    cta: 'Open to a short email exchange?',
    confidence_score: Math.max(35, Math.min(70, Number(lead.data_quality_score || 45))),
    data_quality_notes: 'Template fallback used because the campaign or lead did not qualify for Gemini.',
    missing_data: [lead.solution ? '' : 'solution', 'lead_enrichment'].filter(Boolean),
  };
}

export function buildCompactAiPrompt(input: CompactAiPromptInput): string {
  const leadName = getLeadDisplayName(input.lead);
  const company = getLeadCompany(input.lead);
  const websiteText = truncateText(input.websiteText || '', 2800);
  const sequenceSubject = truncateText(input.sequenceSubject || '', 120);
  const sequenceBody = truncateText(input.sequenceBody || '', 1200);
  const offer = input.campaign.offer_type || 'custom software development';

  return `You are an expert B2B outreach strategist.
Your job is to return a single compact JSON object with outreach copy and strategy.

RULES:
- Use only the provided data.
- Do not invent facts.
- Prefer concise, natural language.
- If website text is missing, rely on lead and campaign context.
- Use the lead's pain point and solution fields together when writing the personalized angle.
- Keep the email conversational and low pressure.
- The final email body must include the exact token {{unsubscribe_url}} at the very bottom.

CAMPAIGN:
${stableStringify({
  id: input.campaign.id,
  name: input.campaign.name,
  target_industry: input.campaign.target_industry,
  offer_type: input.campaign.offer_type,
  ai_mode: input.campaign.ai_mode,
  ai_depth: input.campaign.ai_depth,
  fetch_website_homepage: input.campaign.fetch_website_homepage,
  min_data_quality_for_ai: input.campaign.min_data_quality_for_ai,
  full_ai_min_solution_score: input.campaign.full_ai_min_solution_score,
})}

LEAD:
${stableStringify({
  id: input.lead.id,
  email: input.lead.email,
  name: leadName,
  company,
  website: input.lead.website,
  industry: input.lead.industry,
  sub_industry: input.lead.sub_industry,
  country: input.lead.country,
  city: input.lead.city,
  company_size: input.lead.company_size,
  estimated_revenue: input.lead.estimated_revenue,
  decision_maker_title: input.lead.decision_maker_title,
  tech_stack: input.lead.tech_stack,
  pain_points: input.lead.pain_points,
  solution: input.lead.solution,
  solution_fit_score: input.lead.solution_fit_score,
  lead_source: input.lead.lead_source,
  priority: input.lead.priority,
  tags: input.lead.tags,
  notes: input.lead.notes,
  data_quality_score: input.lead.data_quality_score,
  ai_depth: input.lead.ai_depth,
  ai_company_summary: input.lead.ai_company_summary,
  ai_solution_angle: input.lead.ai_solution_angle,
})}

${websiteText ? `WEBSITE TEXT (trimmed):\n${websiteText}` : 'WEBSITE TEXT: none'}

${sequenceSubject ? `SEQUENCE SUBJECT: ${sequenceSubject}` : ''}
${sequenceBody ? `SEQUENCE BODY: ${sequenceBody}` : ''}

Offer context: ${offer}
Proposed solution: ${normalizeText(input.lead.solution) || 'none'}

Respond with this JSON shape:
{
  "company_summary": "string",
  "lead_analysis": "string",
  "pain_point_summary": "string",
  "solution_angle": "string",
  "outreach_strategy": "string",
  "personalized_first_line": "string",
  "recommended_offer": "string",
  "subject": "string",
  "email_body": "string",
  "cta": "string",
  "confidence_score": 0,
  "data_quality_notes": "string",
  "missing_data": ["string"]
}`;
}

export function estimateTokensFromText(value: string): number {
  const text = normalizeText(value);
  if (!text) return 0;
  return Math.max(1, Math.ceil(text.length / 4));
}

export function estimateAiCost(totalTokens: number): number {
  if (!totalTokens || totalTokens <= 0) return 0;
  return Number((totalTokens * 0.0000025).toFixed(6));
}

export function buildInputHash(input: CompactAiPromptInput): string {
  const normalized = {
    prompt_version: AI_PROMPT_VERSION,
    campaign: stableSort(input.campaign),
    lead: stableSort(input.lead),
    websiteText: truncateText(input.websiteText || '', 2800),
    companySummary: truncateText(input.companySummary || '', 500),
    sequenceSubject: truncateText(input.sequenceSubject || '', 120),
    sequenceBody: truncateText(input.sequenceBody || '', 1200),
    extraContext: truncateText(input.extraContext || '', 1200),
  };

  return crypto.createHash('sha256').update(stableStringify(normalized)).digest('hex');
}

export function determineAiDecision({
  campaign,
  lead,
  budget,
  settings,
  requestedDepth,
}: {
  campaign: CompactCampaignContext;
  lead: CompactLeadContext;
  budget?: AiBudgetRules;
  settings?: AiSettings | null;
  requestedDepth?: AiDepth | null;
}): AiDecision {
  const mode = normalizeAiMode(campaign.ai_mode || 'hybrid_smart');
  const effectiveSettings = settings || {};
  const qualityThreshold =
    budget?.min_data_quality_for_ai ??
    campaign.min_data_quality_for_ai ??
    effectiveSettings.min_data_quality_for_ai ??
    45;
  const fullSolutionThreshold =
    budget?.full_ai_min_solution_score ??
    campaign.full_ai_min_solution_score ??
    effectiveSettings.full_ai_min_solution_score ??
    65;
  const qualityScore = Number(lead.data_quality_score || 0);
  const solutionScore = Number(lead.solution_fit_score || 0);
  const priority = normalizeText(lead.priority).toLowerCase();
  const highPriority = priority === 'high';
  const mediumPriority = priority === 'medium';
  const lowQuality = qualityScore < qualityThreshold;
  const belowSolutionGate = solutionScore > 0 && solutionScore < fullSolutionThreshold;
  const allowTemplateFallback =
    campaign.allow_template_fallback !== false || campaign.use_template_fallback === true;
  const allowDeepAi = campaign.allow_deep_ai !== false;
  const defaultDepth = requestedDepth || campaign.default_ai_depth || campaign.ai_depth || 'standard';
  const selectedDepth =
    defaultDepth === 'none'
      ? 'none'
      : defaultDepth === 'basic'
        ? 'basic'
        : defaultDepth === 'deep'
          ? 'deep'
          : mode === 'deep_ai'
            ? 'deep'
            : mode === 'basic_ai'
              ? 'basic'
              : mode === 'standard_ai'
                ? 'standard'
                : getLeadPromptDepth(campaign.ai_depth, lead, mode);
  const deepEligible = highPriority || solutionScore >= 70 || requestedDepth === 'deep';
  const selectedModel = resolveAiModel({
    depth: selectedDepth,
    requestedDepth,
    lead,
    settings: effectiveSettings,
  });

  if (mode === 'manual_only') {
    return {
      mode: 'skip',
      reason: 'Campaign is set to manual-only AI handling.',
      depth: 'none',
      model: 'skip',
      useWebsite: false,
      allowGemini: false,
      shouldUseCache: false,
    };
  }

  if (mode === 'template_only') {
    return {
      mode: 'template',
      reason: 'Campaign is set to template-only AI handling.',
      depth: 'none',
      model: 'local-template',
      useWebsite: false,
      allowGemini: false,
      shouldUseCache: true,
    };
  }

  if (lowQuality) {
    return {
      mode: allowTemplateFallback ? 'template' : 'skip',
      reason: `This lead has poor data. AI skipped to save credits. Quality ${qualityScore} is below the minimum ${qualityThreshold}.`,
      depth: selectedDepth === 'none' ? 'basic' : selectedDepth,
      model: allowTemplateFallback ? 'local-template' : 'skip',
      useWebsite: false,
      allowGemini: false,
      shouldUseCache: true,
    };
  }

  if (mode === 'basic_ai') {
    return {
      mode: 'gemini',
      reason: 'Basic AI allowed for this lead.',
      depth: 'basic',
      model: AI_DEFAULT_MODEL,
      useWebsite: false,
      allowGemini: true,
      shouldUseCache: true,
    };
  }

  if (mode === 'standard_ai') {
    return {
      mode: 'gemini',
      reason: 'Standard AI allowed for this lead.',
      depth: 'standard',
      model: AI_DEFAULT_MODEL,
      useWebsite: true,
      allowGemini: true,
      shouldUseCache: true,
    };
  }

  if (mode === 'deep_ai') {
    if (!allowDeepAi) {
      return {
        mode: allowTemplateFallback ? 'template' : 'skip',
        reason: 'Deep AI is disabled for this campaign.',
        depth: 'deep',
        model: allowTemplateFallback ? 'local-template' : 'skip',
        useWebsite: false,
        allowGemini: false,
        shouldUseCache: true,
      };
    }

    if (!deepEligible) {
      return {
        mode: allowTemplateFallback ? 'template' : 'skip',
        reason: 'Deep AI requires a high-priority lead or a strong solution-fit score.',
        depth: 'deep',
        model: allowTemplateFallback ? 'local-template' : 'skip',
        useWebsite: true,
        allowGemini: false,
        shouldUseCache: true,
      };
    }

    return {
      mode: 'gemini',
      reason: 'Deep AI approved for this lead.',
      depth: 'deep',
      model: selectedModel,
      useWebsite: true,
      allowGemini: true,
      shouldUseCache: true,
    };
  }

  const eligibleForGemini =
    qualityScore >= qualityThreshold || highPriority || mediumPriority || selectedDepth !== 'none';

  if (belowSolutionGate && !highPriority) {
    return {
      mode: allowTemplateFallback ? 'template' : 'skip',
      reason: allowTemplateFallback
        ? `Solution fit score ${solutionScore} is below the preferred threshold ${fullSolutionThreshold}.`
        : `Solution fit score ${solutionScore} is below the preferred threshold ${fullSolutionThreshold} and template fallback is disabled.`,
      depth: selectedDepth === 'deep' ? 'standard' : selectedDepth,
      model: allowTemplateFallback ? 'local-template' : 'skip',
      useWebsite: qualityScore >= 60,
      allowGemini: false,
      shouldUseCache: true,
    };
  }

  if (!eligibleForGemini) {
    return {
      mode: allowTemplateFallback ? 'template' : 'skip',
      reason: allowTemplateFallback
        ? 'Lead is not eligible for Gemini under the hybrid smart rules.'
        : 'Lead is not eligible for Gemini and template fallback is disabled.',
      depth: 'basic',
      model: allowTemplateFallback ? 'local-template' : 'skip',
      useWebsite: false,
      allowGemini: false,
      shouldUseCache: true,
    };
  }

    return {
      mode: 'gemini',
      reason: 'Lead passed hybrid smart gating.',
      depth: selectedDepth === 'none' ? 'basic' : selectedDepth,
      model: selectedModel,
      useWebsite: true,
      allowGemini: true,
      shouldUseCache: true,
    };
  }
