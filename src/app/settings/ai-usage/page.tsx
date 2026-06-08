'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useMemo, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import { createClient } from '@/utils/supabase/client';
import { Bot, CalendarDays, CheckCircle, Clock3, Layers3, ShieldAlert, Sparkles, Save } from 'lucide-react';

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
  const [recentLogs, setRecentLogs] = useState<any[]>([]);

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

        if (settings) {
          setDefaultModel(settings.default_model || 'gemini-3.1-flash-lite');
          setDeepModel(settings.deep_model || 'gemini-2.5-flash');
          setDailyAiCallLimit(String(settings.daily_ai_limit ?? 75));
          setDailyDeepAiLimit(String(settings.daily_deep_ai_limit ?? 20));
          setMonthlyAiCallLimit(String(settings.monthly_ai_limit ?? 1500));
          setMaxBulkAiBatchSize(String(settings.max_bulk_ai_batch_size ?? 5));
          setMinDataQualityForAi(String(settings.min_data_quality_for_ai ?? 45));
          setFullAiMinSolutionScore(String(settings.full_ai_min_solution_score ?? 65));
          setUseFlashLiteByDefault(settings.use_flash_lite_by_default ?? true);
          setDeepAiOnlyForHighPriority(settings.deep_ai_only_for_high_priority ?? true);
          setStopAiWhenLimitReached(settings.stop_ai_when_limit_reached ?? true);
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
          deepRemaining: Math.max(0, (Number(dailyDeepAiLimit) || 0) - (flash25Today.count || 0)),
          totalRemaining: Math.max(0, (Number(dailyAiCallLimit) || 0) - (todayUsage.count || 0)),
          cacheHits: cacheHits.count || 0,
          skipped: skipped.count || 0,
        });
        setRecentLogs(logRows.data || []);
      } catch (err: any) {
        setError(err.message || 'Failed to load AI usage settings');
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
    } catch (err: any) {
      setError(err.message || 'Failed to save AI usage settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-zinc-950 text-zinc-100">
      <Sidebar />
      <main className="flex-1 p-8 overflow-y-auto max-w-6xl">
        <div className="flex items-center gap-3 mb-8">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-600/10 text-violet-400">
            <Bot className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white tracking-tight">AI Usage Controls</h2>
            <p className="text-sm text-zinc-400">Set global Gemini budgets, batch limits, and gating thresholds.</p>
          </div>
        </div>

        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-violet-500 border-t-transparent" />
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs uppercase tracking-wider text-zinc-500">Calls Today</span>
                  <Clock3 className="h-4 w-4 text-violet-400" />
                </div>
                <div className="mt-3 text-2xl font-bold text-white">{stats.callsToday}</div>
              </div>
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs uppercase tracking-wider text-zinc-500">Flash Lite Today</span>
                  <CalendarDays className="h-4 w-4 text-violet-400" />
                </div>
                <div className="mt-3 text-2xl font-bold text-white">{stats.flashLiteToday}</div>
              </div>
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs uppercase tracking-wider text-zinc-500">2.5 Flash Today</span>
                  <Layers3 className="h-4 w-4 text-emerald-400" />
                </div>
                <div className="mt-3 text-2xl font-bold text-white">{stats.flash25Today}</div>
                <p className="mt-1 text-[11px] text-zinc-500">{stats.deepRemaining ?? '∞'} deep credits left</p>
              </div>
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs uppercase tracking-wider text-zinc-500">Total Remaining</span>
                  <ShieldAlert className="h-4 w-4 text-amber-400" />
                </div>
                <div className="mt-3 text-2xl font-bold text-white">{stats.totalRemaining ?? '∞'}</div>
              </div>
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs uppercase tracking-wider text-zinc-500">Cache Hits</span>
                  <Layers3 className="h-4 w-4 text-emerald-400" />
                </div>
                <div className="mt-3 text-2xl font-bold text-white">{stats.cacheHits}</div>
                <p className="mt-1 text-[11px] text-zinc-500">{cacheRate}% of visible AI activity</p>
              </div>
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs uppercase tracking-wider text-zinc-500">Skipped Leads</span>
                  <ShieldAlert className="h-4 w-4 text-amber-400" />
                </div>
                <div className="mt-3 text-2xl font-bold text-white">{stats.skipped}</div>
              </div>
            </div>

            <form onSubmit={handleSave} className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              <div className="xl:col-span-2 rounded-xl border border-zinc-800 bg-zinc-900/40 p-6 space-y-5">
                <div className="flex items-center gap-2 text-white font-semibold">
                  <Sparkles className="h-5 w-5 text-violet-400" />
                  <h3>Global AI Budget Rules</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] text-zinc-400 font-semibold uppercase">Daily AI Call Limit</label>
                    <input
                      type="number"
                      value={dailyAiCallLimit}
                      onChange={(e) => setDailyAiCallLimit(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950 py-2 px-3 text-sm text-zinc-200 focus:border-violet-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-zinc-400 font-semibold uppercase">Monthly AI Call Limit</label>
                    <input
                      type="number"
                      value={monthlyAiCallLimit}
                      onChange={(e) => setMonthlyAiCallLimit(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950 py-2 px-3 text-sm text-zinc-200 focus:border-violet-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-zinc-400 font-semibold uppercase">Max Bulk AI Batch Size</label>
                    <input
                      type="number"
                      value={maxBulkAiBatchSize}
                      onChange={(e) => setMaxBulkAiBatchSize(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950 py-2 px-3 text-sm text-zinc-200 focus:border-violet-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-zinc-400 font-semibold uppercase">Minimum Data Quality</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={minDataQualityForAi}
                      onChange={(e) => setMinDataQualityForAi(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950 py-2 px-3 text-sm text-zinc-200 focus:border-violet-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-zinc-400 font-semibold uppercase">Full AI Minimum Solution Score</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={fullAiMinSolutionScore}
                      onChange={(e) => setFullAiMinSolutionScore(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950 py-2 px-3 text-sm text-zinc-200 focus:border-violet-500 focus:outline-none"
                    />
                  </div>
                </div>

                <label className="flex items-start gap-3 p-4 rounded-xl border border-zinc-800 bg-zinc-950/40">
                  <input
                    type="checkbox"
                    checked={stopAiWhenLimitReached}
                    onChange={(e) => setStopAiWhenLimitReached(e.target.checked)}
                    className="mt-1 rounded border-zinc-800 bg-zinc-950 text-violet-500 focus:ring-0"
                  />
                  <div>
                    <span className="block text-sm font-semibold text-white">Stop Gemini when a limit is reached</span>
                    <span className="block text-xs text-zinc-500">When enabled, the system falls back to local template paths instead of making new AI calls.</span>
                  </div>
                </label>

                {error && (
                  <div className="rounded-lg bg-rose-500/10 p-3 text-xs text-rose-400 border border-rose-500/20">
                    {error}
                  </div>
                )}

                {success && (
                  <div className="rounded-lg bg-emerald-500/10 p-3 text-xs text-emerald-400 border border-emerald-500/20 flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-emerald-400" />
                    {success}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={saving}
                  className="px-6 py-2.5 rounded-lg bg-gradient-to-r from-violet-600 to-blue-600 font-semibold text-white shadow-lg shadow-violet-600/20 hover:opacity-90 active:scale-[0.98] transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer"
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

              <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6">
                <h3 className="font-semibold text-white flex items-center gap-2">
                  <Layers3 className="h-5 w-5 text-violet-400" />
                  Recent AI Logs
                </h3>
                <div className="mt-4 space-y-3">
                  {recentLogs.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-zinc-800 p-6 text-center text-sm text-zinc-500">
                      No AI logs recorded yet.
                    </div>
                  ) : (
                    recentLogs.map((log, index) => (
                      <div key={index} className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-white uppercase">{log.action || log.operation}</span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full border ${
                            log.cached || log.cache_hit
                              ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400'
                              : log.skipped
                                ? 'border-amber-500/20 bg-amber-500/10 text-amber-400'
                                : 'border-violet-500/20 bg-violet-500/10 text-violet-400'
                          }`}>
                            {log.cached || log.cache_hit ? 'cache' : log.skipped ? 'skipped' : 'ai'}
                          </span>
                        </div>
                        <p className="mt-2 text-[11px] text-zinc-500">
                          {new Date(log.created_at).toLocaleString()} · {log.model || log.model_used || 'local'} · {log.total_tokens || log.tokens_total || 0} tokens
                        </p>
                        {log.skip_reason && (
                          <p className="mt-1 text-[11px] text-amber-400">{log.skip_reason}</p>
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
    </div>
  );
}
