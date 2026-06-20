import type { SupabaseClient } from '@supabase/supabase-js';
import type { AiSettings, AiUsageLog, CompanyEnrichmentCache } from '@/types/database.types';
import { AI_DEFAULT_MODEL, AI_DEEP_MODEL, type AiModelName } from '@/lib/ai/efficiency';

export interface AiCreditSummary {
  callsToday: number;
  flashLiteCallsToday: number;
  flash25CallsToday: number;
  deepRemaining: number | null;
  totalRemaining: number | null;
  cachedResultsReused: number;
  leadsSkipped: number;
}

function resolveCount(count?: number | null): number {
  return Number(count || 0);
}

function normalizeModelName(model?: string | null): AiModelName | string {
  if (!model) return AI_DEFAULT_MODEL;
  if (model === AI_DEEP_MODEL || model === AI_DEFAULT_MODEL) return model;
  return model;
}

const aiSettingsCache = new Map<string, { settings: AiSettings; expiresAt: number }>();

export async function getAiSettingsForUser(
  supabase: SupabaseClient,
  userId: string
): Promise<AiSettings> {
  const now = Date.now();
  const cached = aiSettingsCache.get(userId);
  if (cached && cached.expiresAt > now) {
    return cached.settings;
  }
  const { data, error } = await supabase
    .from('ai_settings')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    console.error('Failed to load AI settings:', error);
  }

  if (data) {
    return data as AiSettings;
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select(
      'daily_ai_call_limit, monthly_ai_call_limit, max_bulk_ai_batch_size, min_data_quality_for_ai, full_ai_min_solution_score, stop_ai_when_limit_reached'
    )
    .eq('id', userId)
    .maybeSingle();

  const settings = {
    default_model: AI_DEFAULT_MODEL,
    deep_model: AI_DEEP_MODEL,
    daily_ai_limit: profile?.daily_ai_call_limit ?? 75,
    daily_deep_ai_limit: 20,
    monthly_ai_limit: profile?.monthly_ai_call_limit ?? 1500,
    max_bulk_ai_batch_size: profile?.max_bulk_ai_batch_size ?? 5,
    min_data_quality_for_ai: profile?.min_data_quality_for_ai ?? 45,
    full_ai_min_solution_score: profile?.full_ai_min_solution_score ?? 65,
    use_flash_lite_by_default: true,
    deep_ai_only_for_high_priority: true,
    stop_ai_when_limit_reached: profile?.stop_ai_when_limit_reached ?? true,
  };

  aiSettingsCache.set(userId, { settings, expiresAt: now + 5 * 60 * 1000 });
  return settings;
}

export async function recordAiUsageLog(
  supabase: SupabaseClient,
  entry: Omit<AiUsageLog, 'id' | 'created_at'>
) {
  const payload = {
    ...entry,
    action: entry.action || entry.operation,
    model: normalizeModelName(entry.model || entry.model_used || null),
    input_tokens: entry.input_tokens ?? entry.tokens_prompt ?? 0,
    output_tokens: entry.output_tokens ?? entry.tokens_completion ?? 0,
    total_tokens: entry.total_tokens ?? entry.tokens_total ?? 0,
    cached: entry.cached ?? entry.cache_hit ?? false,
    skipped: entry.skipped ?? false,
    skip_reason: entry.skip_reason ?? null,
    operation: entry.operation || entry.action,
    model_used: entry.model_used || entry.model || entry.model_used || null,
    tokens_prompt: entry.tokens_prompt ?? entry.input_tokens ?? 0,
    tokens_completion: entry.tokens_completion ?? entry.output_tokens ?? 0,
    tokens_total: entry.tokens_total ?? entry.total_tokens ?? 0,
    cache_hit: entry.cache_hit ?? entry.cached ?? false,
  } as Record<string, unknown>;

  const { error } = await supabase.from('ai_usage_logs').insert(payload);
  if (error) {
    console.error('Failed to record AI usage log:', error);
  }
}

export async function getCompanyEnrichmentCache(
  supabase: SupabaseClient,
  userId: string,
  domainKey: string
): Promise<CompanyEnrichmentCache | null> {
  const { data, error } = await supabase
    .from('company_enrichment_cache')
    .select('*')
    .eq('user_id', userId)
    .eq('domain_key', domainKey)
    .maybeSingle();

  if (error) {
    console.error('Failed to load company enrichment cache:', error);
    return null;
  }

  return (data as CompanyEnrichmentCache | null) || null;
}

export async function upsertCompanyEnrichmentCache(
  supabase: SupabaseClient,
  payload: Omit<CompanyEnrichmentCache, 'id' | 'created_at' | 'updated_at'>
) {
  const { error } = await supabase
    .from('company_enrichment_cache')
    .upsert(
      {
        ...payload,
        last_used_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as Record<string, unknown>,
      {
        onConflict: 'user_id,domain_key',
      }
    );

  if (error) {
    console.error('Failed to upsert company enrichment cache:', error);
  }
}

export async function getAiUsageCounts(
  supabase: SupabaseClient,
  userId: string,
  dailyFromIso: string,
  dailyToIso: string,
  monthlyFromIso: string,
  monthlyToIso: string
) {
  const { data, error } = await supabase.rpc('get_ai_usage_summary', {
    p_user_id: userId,
    p_daily_from: dailyFromIso,
    p_monthly_from: monthlyFromIso,
  });

  if (error) {
    console.error('Error fetching AI usage summary:', error);
  }

  const summary = data || {};

  return {
    calls: summary.calls || 0,
    flashLiteCallsToday: summary.flashLiteCallsToday || 0,
    flash25CallsToday: summary.flash25CallsToday || 0,
    monthlyCalls: summary.monthlyCalls || 0,
    tokens: summary.tokens || 0,
    monthlyTokens: summary.monthlyTokens || 0,
    cacheHits: summary.monthlyCacheHits || 0,
    skipped: summary.monthlySkipped || 0,
  };
}

export async function getAiCreditSummary(
  supabase: SupabaseClient,
  userId: string,
  settings: AiSettings,
  dailyFromIso: string,
  dailyToIso: string
): Promise<AiCreditSummary> {
  const { data, error } = await supabase.rpc('get_ai_usage_summary', {
    p_user_id: userId,
    p_daily_from: dailyFromIso,
    p_monthly_from: dailyFromIso, // Monthly not strictly needed here, so use daily to limit scan
  });

  if (error) {
    console.error('Error fetching AI credit summary:', error);
  }

  const summary = data || {};
  const totalUsed = summary.calls || 0;
  const deepUsed = summary.flash25CallsToday || 0;

  const totalLimit = settings.daily_ai_limit ?? null;
  const deepLimit = settings.daily_deep_ai_limit ?? null;

  return {
    callsToday: totalUsed,
    flashLiteCallsToday: summary.flashLiteCallsToday || 0,
    flash25CallsToday: deepUsed,
    deepRemaining: deepLimit === null ? null : Math.max(0, deepLimit - deepUsed),
    totalRemaining: totalLimit === null ? null : Math.max(0, totalLimit - totalUsed),
    cachedResultsReused: summary.dailyCacheHits || 0,
    leadsSkipped: summary.dailySkipped || 0,
  };
}
