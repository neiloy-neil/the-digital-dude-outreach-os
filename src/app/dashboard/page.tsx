'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import { createClient } from '@/utils/supabase/client';
import {
  Send, 
  MailOpen, 
  MessageSquare, 
  AlertTriangle, 
  Zap, 
  TrendingUp,
  Clock,
  ExternalLink,
  Bot,
  Layers3,
  ShieldAlert
} from 'lucide-react';
import Link from 'next/link';

export default function Dashboard() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    sent: 0,
    opened: 0,
    replied: 0,
    bounced: 0,
    unsubscribed: 0,
  });
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [recentActivities, setRecentActivities] = useState<any[]>([]);
  const [aiStats, setAiStats] = useState({
    callsToday: 0,
    flashLiteToday: 0,
    flash25Today: 0,
    deepRemaining: 0 as number | null,
    totalRemaining: 0 as number | null,
    cacheHits: 0,
    skipped: 0,
  });

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // 1. Fetch campaigns and count stats
        const { data: campaignData } = await supabase
          .from('campaigns')
          .select('id, name, status, created_at')
          .eq('user_id', user.id);

        const loadedCampaigns = campaignData || [];
        setCampaigns(loadedCampaigns);

        if (loadedCampaigns.length > 0) {
          const campaignIds = loadedCampaigns.map(c => c.id);

          // 2. Fetch all activity logs
          const { data: logs } = await supabase
            .from('activity_logs')
            .select('event_type, created_at, leads (email, first_name, last_name, company)')
            .in('campaign_id', campaignIds);

          const newStats = { sent: 0, opened: 0, replied: 0, bounced: 0, unsubscribed: 0 };
          
          logs?.forEach(log => {
            if (log.event_type === 'sent') newStats.sent++;
            else if (log.event_type === 'opened') newStats.opened++;
            else if (log.event_type === 'replied') newStats.replied++;
            else if (log.event_type === 'bounced') newStats.bounced++;
            else if (log.event_type === 'unsubscribed') newStats.unsubscribed++;
          });

          setStats(newStats);

          // Order logs for recent activity feed
          const sortedActivities = (logs || [])
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
            .slice(0, 5);

          setRecentActivities(sortedActivities);
        }

        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);

        const usageQuery = (query: ReturnType<typeof supabase.from>) =>
          query
            .select('id', { count: 'exact', head: true })
            .eq('user_id', user.id)
            .eq('skipped', false)
            .eq('cache_hit', false);

        const [todayUsage, flashLiteToday, flash25Today, cacheHits, skipped, settingsResult] = await Promise.all([
          usageQuery(supabase.from('ai_usage_logs')).gte('created_at', startOfDay.toISOString()).catch(() => ({ count: 0 })),
          usageQuery(supabase.from('ai_usage_logs'))
            .gte('created_at', startOfMonth.toISOString())
            .catch(() => ({ count: 0 })),
          usageQuery(supabase.from('ai_usage_logs'))
            .eq('model', 'gemini-3.1-flash-lite')
            .gte('created_at', startOfDay.toISOString())
            .catch(() => ({ count: 0 })),
          usageQuery(supabase.from('ai_usage_logs'))
            .eq('model', 'gemini-2.5-flash')
            .gte('created_at', startOfDay.toISOString())
            .catch(() => ({ count: 0 })),
          supabase
            .from('ai_usage_logs')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', user.id)
            .eq('cache_hit', true)
            .gte('created_at', startOfDay.toISOString())
            .catch(() => ({ count: 0 })),
          supabase
            .from('ai_usage_logs')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', user.id)
            .eq('skipped', true)
            .gte('created_at', startOfDay.toISOString())
            .catch(() => ({ count: 0 })),
          supabase
            .from('ai_settings')
            .select('daily_ai_limit, daily_deep_ai_limit')
            .eq('user_id', user.id)
            .maybeSingle()
            .catch(() => ({ data: null })),
        ]);

        const settings = settingsResult?.data || null;

        setAiStats({
          callsToday: todayUsage.count || 0,
          flashLiteToday: flashLiteToday.count || 0,
          flash25Today: flash25Today.count || 0,
          deepRemaining: Math.max(0, (Number(settings?.daily_deep_ai_limit ?? 20) || 0) - (flash25Today.count || 0)),
          totalRemaining: Math.max(0, (Number(settings?.daily_ai_limit ?? 75) || 0) - (todayUsage.count || 0)),
          cacheHits: cacheHits.count || 0,
          skipped: skipped.count || 0,
        });
      } catch (e) {
        console.error('Error fetching dashboard data:', e);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [supabase]);

  // Calculations
  const openRate = stats.sent > 0 ? Math.round((stats.opened / stats.sent) * 100) : 0;
  const replyRate = stats.sent > 0 ? Math.round((stats.replied / stats.sent) * 100) : 0;

  const cards = [
    { name: 'Emails Sent', value: stats.sent, desc: 'Outbound dispatched', icon: Send, color: 'text-blue-400 bg-blue-500/10' },
    { name: 'Unique Opens', value: stats.opened, desc: `${openRate}% Open Rate`, icon: MailOpen, color: 'text-violet-400 bg-violet-500/10' },
    { name: 'Replies Received', value: stats.replied, desc: `${replyRate}% Reply Rate`, icon: MessageSquare, color: 'text-emerald-400 bg-emerald-500/10' },
    { name: 'Bounces / Spam', value: stats.bounced, desc: 'Delivery failures', icon: AlertTriangle, color: 'text-rose-400 bg-rose-500/10' },
  ];

  const aiCards = [
    { name: 'AI Calls Today', value: aiStats.callsToday, desc: 'Gemini usage that counted against budget', icon: Bot, color: 'text-violet-400 bg-violet-500/10' },
    { name: 'Flash Lite Calls', value: aiStats.flashLiteToday, desc: 'Recommended for bulk personalization', icon: Bot, color: 'text-blue-400 bg-blue-500/10' },
    { name: '2.5 Flash Calls', value: aiStats.flash25Today, desc: `${aiStats.deepRemaining ?? '∞'} deep calls remaining`, icon: Layers3, color: 'text-emerald-400 bg-emerald-500/10' },
    { name: 'Total Remaining', value: aiStats.totalRemaining ?? '∞', desc: 'Calls left today', icon: ShieldAlert, color: 'text-amber-400 bg-amber-500/10' },
    { name: 'Cache Reuse', value: aiStats.cacheHits, desc: 'Cached AI output reused', icon: Layers3, color: 'text-emerald-400 bg-emerald-500/10' },
    { name: 'Skipped Leads', value: aiStats.skipped, desc: 'Low-value leads or budget stops', icon: ShieldAlert, color: 'text-amber-400 bg-amber-500/10' },
  ];

  return (
    <div className="flex min-h-screen bg-zinc-950 text-zinc-100">
      <Sidebar />
      <main className="flex-1 p-8 overflow-y-auto">
        {/* Welcome */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-3xl font-extrabold text-white tracking-tight">Overview Dashboard</h2>
            <p className="text-zinc-400 text-sm mt-1">Here is how your cold email campaigns are performing.</p>
          </div>
          <Link
            href="/campaigns"
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-violet-600 to-blue-600 rounded-lg text-sm font-semibold text-white hover:opacity-90 shadow-md shadow-violet-500/15 cursor-pointer"
          >
            <Zap className="h-4 w-4" /> Create Campaign
          </Link>
        </div>

        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-violet-500 border-t-transparent" />
          </div>
        ) : (
          <div className="space-y-8">
            {/* Metric Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {cards.map((card) => {
                const Icon = card.icon;
                return (
                  <div key={card.name} className="p-6 rounded-xl border border-zinc-800 bg-zinc-900/40 backdrop-blur-sm relative overflow-hidden group">
                    <div className="absolute top-0 right-0 h-24 w-24 bg-zinc-800/10 rounded-full blur-2xl group-hover:bg-violet-600/5 transition-all duration-500" />
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">{card.name}</span>
                        <h4 className="text-3xl font-extrabold text-white mt-2 font-mono">{card.value}</h4>
                      </div>
                      <div className={`p-3 rounded-lg ${card.color}`}>
                        <Icon className="h-5 w-5" />
                      </div>
                    </div>
                    <p className="text-xs text-zinc-400 mt-4 flex items-center gap-1">
                      <TrendingUp className="h-3.5 w-3.5 text-violet-400" />
                      {card.desc}
                    </p>
                  </div>
                );
              })}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {aiCards.map((card) => {
                const Icon = card.icon;
                return (
                  <div key={card.name} className="p-6 rounded-xl border border-zinc-800 bg-zinc-900/40 backdrop-blur-sm relative overflow-hidden group">
                    <div className="absolute top-0 right-0 h-24 w-24 bg-zinc-800/10 rounded-full blur-2xl group-hover:bg-violet-600/5 transition-all duration-500" />
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">{card.name}</span>
                        <h4 className="text-3xl font-extrabold text-white mt-2 font-mono">{card.value}</h4>
                      </div>
                      <div className={`p-3 rounded-lg ${card.color}`}>
                        <Icon className="h-5 w-5" />
                      </div>
                    </div>
                    <p className="text-xs text-zinc-400 mt-4 flex items-center gap-1">
                      <TrendingUp className="h-3.5 w-3.5 text-violet-400" />
                      {card.desc}
                    </p>
                  </div>
                );
              })}
            </div>

            {/* Campaign & Activities layout */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Campaigns List */}
              <div className="lg:col-span-2 rounded-xl border border-zinc-800 bg-zinc-900/20 p-6 backdrop-blur-sm">
                <h3 className="font-bold text-white mb-4 text-lg">Your Campaigns</h3>
                {campaigns.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-48 border border-dashed border-zinc-800 rounded-lg">
                    <p className="text-sm text-zinc-500">No campaigns found.</p>
                    <Link href="/campaigns" className="mt-3 text-sm text-violet-400 hover:text-violet-300 font-medium">Create your first campaign &rarr;</Link>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-zinc-400">
                      <thead className="text-xs font-semibold uppercase text-zinc-500 border-b border-zinc-800 bg-zinc-900/30">
                        <tr>
                          <th className="py-3 px-4">Name</th>
                          <th className="py-3 px-4">Status</th>
                          <th className="py-3 px-4">Created</th>
                          <th className="py-3 px-4 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-800">
                        {campaigns.map((camp) => (
                          <tr key={camp.id} className="hover:bg-zinc-900/30 transition-colors">
                            <td className="py-3.5 px-4 font-semibold text-zinc-100">{camp.name}</td>
                            <td className="py-3.5 px-4">
                              <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${
                                camp.status === 'active' 
                                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                                  : camp.status === 'paused'
                                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                  : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
                              }`}>
                                <span className={`h-1.5 w-1.5 rounded-full ${
                                  camp.status === 'active' ? 'bg-emerald-400 animate-pulse' : camp.status === 'paused' ? 'bg-amber-400' : 'bg-zinc-500'
                                }`} />
                                {camp.status}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 text-xs font-mono">{new Date(camp.created_at).toLocaleDateString()}</td>
                            <td className="py-3.5 px-4 text-right">
                              <Link 
                                href={`/campaigns/${camp.id}`} 
                                className="inline-flex items-center gap-1 text-xs text-violet-400 hover:text-violet-300 font-medium cursor-pointer"
                              >
                                Manage <ExternalLink className="h-3 w-3" />
                              </Link>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Recent Activities */}
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/20 p-6 backdrop-blur-sm">
                <h3 className="font-bold text-white mb-4 text-lg">Activity Feed</h3>
                {recentActivities.length === 0 ? (
                  <div className="flex items-center justify-center h-48 border border-dashed border-zinc-800 rounded-lg text-zinc-500 text-sm">
                    No recent activities recorded.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {recentActivities.map((act, idx) => {
                      const lead = act.leads as any;
                      const name = lead ? `${lead.first_name || ''} ${lead.last_name || ''}`.trim() || lead.email : 'Unknown Lead';
                      return (
                        <div key={idx} className="flex items-start gap-3 border-b border-zinc-800 pb-3 last:border-b-0 last:pb-0">
                          <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-zinc-800 text-zinc-400">
                            <Clock className="h-4 w-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-semibold text-zinc-200">
                              {name}
                            </p>
                            <p className="text-xs text-zinc-400 mt-0.5">
                              Event: <span className="font-semibold text-violet-400 uppercase">{act.event_type}</span>
                            </p>
                            <span className="text-[10px] text-zinc-500 font-mono block mt-1">
                              {new Date(act.created_at).toLocaleTimeString()}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
