'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useMemo, useState } from 'react';
import AppShell from '@/components/reachmira/AppShell';
import PageHeader from '@/components/reachmira/PageHeader';
import { createClient } from '@/utils/supabase/client';
import { CalendarDays, CheckCircle, Clock3, Layers3, ShieldAlert, Sparkles, Save } from 'lucide-react';

type AiSettingsRow = {
  default_model?: string | null;
  deep_model?: string | null;
  daily_ai_limit?: number | null;
  daily_deep_ai_limit?: number | null;
  monthly_ai_limit?: number | null;
  max_bulk_ai_batch_size?: number | null;
  min_data_quality_for_ai?: number | null;
  full_ai_min_solution_score?: number | null;
  use_flash_lite_by_default?: boolean | null;
  deep_ai_only_for_high_priority?: boolean | null;
  stop_ai_when_limit_reached?: boolean | null;
};

type AiUsageLogRow = {
  action?: string | null;
  operation?: string | null;
  model?: string | null;
  model_used?: string | null;
  ai_depth?: string | null;
  cached?: boolean | null;
  cache_hit?: boolean | null;
  skipped?: boolean | null;
  skip_reason?: string | null;
  total_tokens?: number | null;
  tokens_total?: number | null;
  created_at: string;
};

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

export default function AiUsageSettingsPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [defaultModel, setDefaultModel] = useState('gemini-3.1-flash-lite');
  const [deepModel, setDeepModel] = useState('gemini-2.5-flash');
  const [dailyAiCallLimit, setDailyAiCallLimit] = useState('75');
  const [dailyDeepAiLimit, setDailyDeepAiLimit] = useState('20');
  const [monthlyAiCallLimit, setMonthlyAiCallLimit] = useState('1500');
  const [maxBulkAiBatchSize, setMaxBulkAiBatchSize] = useState('5');
  const [minDataQualityForAi, setMinDataQualityForAi] = useState('45');
  const [fullAiMinSolutionScore, setFullAiMinSolutionScore] = useState('65');
  const [useFlashLiteByDefault, setUseFlashLiteByDefault] = useState(true);
  const [deepAiOnlyForHighPriority, setDeepAiOnlyForHighPriority] = useState(true);
  const [stopAiWhenLimitReached, setStopAiWhenLimitReached] = useState(true);

  const [stats, setStats] = useState({
    callsToday: 0,
    flashLiteToday: 0,
    flash25Today: 0,
    deepRemaining: 0 as number | null,
    totalRemaining: 0 as number | null,
    cacheHits: 0,
    skipped: 0,
  });
  const [recentLogs, setRecentLogs] = useState<AiUsageLogRow[]>([]);
  const inputClass = 'mt-1 w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-violet-500';
  const labelClass = 'block text-[10px] font-semibold uppercase text-zinc-500';

  useEffect(() => {
    const loadPage = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;

        const { data: settings, error: settingsError } = await supabase
          .from('ai_settings')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();

        if (settingsError) throw settingsError;

        const typedSettings = settings as AiSettingsRow | null;
        const loadedDailyLimit = typedSettings?.daily_ai_limit ?? 75;
        const loadedDeepLimit = typedSettings?.daily_deep_ai_limit ?? 20;

        if (typedSettings) {
          setDefaultModel(typedSettings.default_model || 'gemini-3.1-flash-lite');
          setDeepModel(typedSettings.deep_model || 'gemini-2.5-flash');
          setDailyAiCallLimit(String(loadedDailyLimit));
          setDailyDeepAiLimit(String(loadedDeepLimit));
          setMonthlyAiCallLimit(String(typedSettings.monthly_ai_limit ?? 1500));
          setMaxBulkAiBatchSize(String(typedSettings.max_bulk_ai_batch_size ?? 5));
          setMinDataQualityForAi(String(typedSettings.min_data_quality_for_ai ?? 45));
          setFullAiMinSolutionScore(String(typedSettings.full_ai_min_solution_score ?? 65));
          setUseFlashLiteByDefault(typedSettings.use_flash_lite_by_default ?? true);
          setDeepAiOnlyForHighPriority(typedSettings.deep_ai_only_for_high_priority ?? true);
          setStopAiWhenLimitReached(typedSettings.stop_ai_when_limit_reached ?? true);
        }

        const dailyFrom = startOfDayIso();
        const monthFrom = startOfMonthIso();
        const now = new Date().toISOString();

        const [todayUsage, flashLiteToday, flash25Today, cacheHits, skipped, logRows] = await Promise.all([
          supabase
            .from('ai_usage_logs')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', user.id)
            .eq('skipped', false)
            .eq('cache_hit', false)
            .gte('created_at', dailyFrom)
            .lt('created_at', now),
          supabase
            .from('ai_usage_logs')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', user.id)
            .eq('skipped', false)
            .eq('cache_hit', false)
            .gte('created_at', dailyFrom)
            .lt('created_at', now),
          supabase
            .from('ai_usage_logs')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', user.id)
            .eq('skipped', false)
            .eq('cache_hit', false)
            .eq('model', 'gemini-3.1-flash-lite')
            .gte('created_at', dailyFrom)
            .lt('created_at', now),
          supabase
            .from('ai_usage_logs')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', user.id)
            .eq('skipped', false)
            .eq('cache_hit', false)
            .eq('model', 'gemini-2.5-flash')
            .gte('created_at', dailyFrom)
            .lt('created_at', now),
          supabase
            .from('ai_usage_logs')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', user.id)
            .eq('cache_hit', true)
            .gte('created_at', monthFrom)
            .lt('created_at', now),
          supabase
            .from('ai_usage_logs')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', user.id)
            .eq('skipped', true)
            .gte('created_at', monthFrom)
            .lt('created_at', now),
          supabase
            .from('ai_usage_logs')
            .select('action, model, ai_depth, cached, skipped, skip_reason, total_tokens, created_at')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(8),
        ]);

        setStats({
          callsToday: todayUsage.count || 0,
          flashLiteToday: flashLiteToday.count || 0,
          flash25Today: flash25Today.count || 0,
          deepRemaining: Math.max(0, loadedDeepLimit - (flash25Today.count || 0)),
          totalRemaining: Math.max(0, loadedDailyLimit - (todayUsage.count || 0)),
          cacheHits: cacheHits.count || 0,
          skipped: skipped.count || 0,
        });
        setRecentLogs(((logRows.data || []) as unknown) as AiUsageLogRow[]);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load AI usage settings');
      } finally {
        setLoading(false);
      }
    };

    loadPage();
  }, [supabase]);

  const cacheRate = useMemo(() => {
    const totalVisible = stats.callsToday + stats.cacheHits + stats.skipped;
    if (totalVisible === 0) return 0;
    return Math.round((stats.cacheHits / totalVisible) * 100);
  }, [stats]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('User session not found');

      const { error: updateError } = await supabase
        .from('ai_settings')
        .upsert({
          user_id: user.id,
          default_model: defaultModel,
          deep_model: deepModel,
          daily_ai_limit: Number(dailyAiCallLimit) || 0,
          daily_deep_ai_limit: Number(dailyDeepAiLimit) || 0,
          monthly_ai_limit: Number(monthlyAiCallLimit) || 0,
          max_bulk_ai_batch_size: Number(maxBulkAiBatchSize) || 0,
          min_data_quality_for_ai: Number(minDataQualityForAi) || 0,
          full_ai_min_solution_score: Number(fullAiMinSolutionScore) || 0,
          use_flash_lite_by_default: useFlashLiteByDefault,
          deep_ai_only_for_high_priority: deepAiOnlyForHighPriority,
          stop_ai_when_limit_reached: stopAiWhenLimitReached,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });

      if (updateError) throw updateError;
      setSuccess('AI usage settings saved.');
      setTimeout(() => setSuccess(null), 2500);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save AI usage settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell showSearch={false}>
      <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <PageHeader
          eyebrow="AI controls"
          title="AI Usage Controls"
          subtitle="Set global Gemini budgets, batch limits, and gating thresholds."
        />

        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-violet-500 border-t-transparent" />
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              <div className="rounded-3xl border border-[var(--border)] bg-white p-4 shadow-[0_12px_40px_rgba(15,23,42,0.04)]">
                <div className="flex items-center justify-between">
                  <span className="text-xs uppercase tracking-wider text-zinc-500">Calls Today</span>
                  <Clock3 className="h-4 w-4 text-violet-600" />
                </div>
                <div className="mt-3 text-2xl font-bold text-zinc-950">{stats.callsToday}</div>
              </div>
              <div className="rounded-3xl border border-[var(--border)] bg-white p-4 shadow-[0_12px_40px_rgba(15,23,42,0.04)]">
                <div className="flex items-center justify-between">
                  <span className="text-xs uppercase tracking-wider text-zinc-500">Flash Lite Today</span>
                  <CalendarDays className="h-4 w-4 text-violet-600" />
                </div>
                <div className="mt-3 text-2xl font-bold text-zinc-950">{stats.flashLiteToday}</div>
              </div>
              <div className="rounded-3xl border border-[var(--border)] bg-white p-4 shadow-[0_12px_40px_rgba(15,23,42,0.04)]">
                <div className="flex items-center justify-between">
                  <span className="text-xs uppercase tracking-wider text-zinc-500">2.5 Flash Today</span>
                  <Layers3 className="h-4 w-4 text-teal-600" />
                </div>
                <div className="mt-3 text-2xl font-bold text-zinc-950">{stats.flash25Today}</div>
                <p className="mt-1 text-[11px] text-zinc-500">{stats.deepRemaining ?? '∞'} deep credits left</p>
              </div>
              <div className="rounded-3xl border border-[var(--border)] bg-white p-4 shadow-[0_12px_40px_rgba(15,23,42,0.04)]">
                <div className="flex items-center justify-between">
                  <span className="text-xs uppercase tracking-wider text-zinc-500">Total Remaining</span>
                  <ShieldAlert className="h-4 w-4 text-amber-500" />
                </div>
                <div className="mt-3 text-2xl font-bold text-zinc-950">{stats.totalRemaining ?? '∞'}</div>
              </div>
              <div className="rounded-3xl border border-[var(--border)] bg-white p-4 shadow-[0_12px_40px_rgba(15,23,42,0.04)]">
                <div className="flex items-center justify-between">
                  <span className="text-xs uppercase tracking-wider text-zinc-500">Cache Hits</span>
                  <Layers3 className="h-4 w-4 text-teal-600" />
                </div>
                <div className="mt-3 text-2xl font-bold text-zinc-950">{stats.cacheHits}</div>
                <p className="mt-1 text-[11px] text-zinc-500">{cacheRate}% of visible AI activity</p>
              </div>
              <div className="rounded-3xl border border-[var(--border)] bg-white p-4 shadow-[0_12px_40px_rgba(15,23,42,0.04)]">
                <div className="flex items-center justify-between">
                  <span className="text-xs uppercase tracking-wider text-zinc-500">Skipped Leads</span>
                  <ShieldAlert className="h-4 w-4 text-amber-500" />
                </div>
                <div className="mt-3 text-2xl font-bold text-zinc-950">{stats.skipped}</div>
              </div>
            </div>

            <form onSubmit={handleSave} className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              <div className="xl:col-span-2 space-y-5 rounded-3xl border border-[var(--border)] bg-white p-6 shadow-[0_12px_40px_rgba(15,23,42,0.04)]">
                <div className="flex items-center gap-2 font-semibold text-zinc-950">
                  <Sparkles className="h-5 w-5 text-violet-600" />
                  <h3>Global AI Budget Rules</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>Daily AI Call Limit</label>
                    <input
                      type="number"
                      value={dailyAiCallLimit}
                      onChange={(e) => setDailyAiCallLimit(e.target.value)}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Monthly AI Call Limit</label>
                    <input
                      type="number"
                      value={monthlyAiCallLimit}
                      onChange={(e) => setMonthlyAiCallLimit(e.target.value)}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Max Bulk AI Batch Size</label>
                    <input
                      type="number"
                      value={maxBulkAiBatchSize}
                      onChange={(e) => setMaxBulkAiBatchSize(e.target.value)}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Minimum Data Quality</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={minDataQualityForAi}
                      onChange={(e) => setMinDataQualityForAi(e.target.value)}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Full AI Minimum Solution Score</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={fullAiMinSolutionScore}
                      onChange={(e) => setFullAiMinSolutionScore(e.target.value)}
                      className={inputClass}
                    />
                  </div>
                </div>

                <label className="flex items-start gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] p-4">
                  <input
                    type="checkbox"
                    checked={stopAiWhenLimitReached}
                    onChange={(e) => setStopAiWhenLimitReached(e.target.checked)}
                    className="mt-1 rounded border-zinc-300 text-violet-600 focus:ring-violet-500"
                  />
                  <div>
                    <span className="block text-sm font-semibold text-zinc-950">Stop Gemini when a limit is reached</span>
                    <span className="block text-xs text-zinc-500">When enabled, the system falls back to local template paths instead of making new AI calls.</span>
                  </div>
                </label>

                {error && (
                  <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
                    {error}
                  </div>
                )}

                {success && (
                  <div className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-700">
                    <CheckCircle className="h-4 w-4 text-emerald-600" />
                    {success}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={saving}
                  className="flex cursor-pointer items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-teal-500 px-6 py-2.5 font-semibold text-white shadow-lg shadow-violet-600/20 transition-all hover:opacity-95 active:scale-[0.98] disabled:opacity-50"
                >
                  {saving ? (
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  ) : (
                    <>
                      <Save className="h-4 w-4" /> Save AI Rules
                    </>
                  )}
                </button>
              </div>

              <div className="rounded-3xl border border-[var(--border)] bg-white p-6 shadow-[0_12px_40px_rgba(15,23,42,0.04)]">
                <h3 className="flex items-center gap-2 font-semibold text-zinc-950">
                  <Layers3 className="h-5 w-5 text-violet-600" />
                  Recent AI Logs
                </h3>
                <div className="mt-4 space-y-3">
                  {recentLogs.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-[var(--border)] p-6 text-center text-sm text-zinc-500">
                      No AI logs recorded yet.
                    </div>
                  ) : (
                    recentLogs.map((log, index) => (
                      <div key={index} className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] p-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold uppercase text-zinc-950">{log.action || log.operation}</span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full border ${
                            log.cached || log.cache_hit
                              ? 'border-emerald-100 bg-emerald-50 text-emerald-700'
                              : log.skipped
                                ? 'border-amber-100 bg-amber-50 text-amber-700'
                                : 'border-violet-100 bg-violet-50 text-violet-700'
                          }`}>
                            {log.cached || log.cache_hit ? 'cache' : log.skipped ? 'skipped' : 'ai'}
                          </span>
                        </div>
                        <p className="mt-2 text-[11px] text-zinc-500">
                          {new Date(log.created_at).toLocaleString()} · {log.model || log.model_used || 'local'} · {log.total_tokens || log.tokens_total || 0} tokens
                        </p>
                        {log.skip_reason && (
                          <p className="mt-1 text-[11px] text-amber-700">{log.skip_reason}</p>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </form>
          </div>
        )}
      </main>
    </AppShell>
  );
}
