'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/utils/supabase/client';
import AppShell from '@/components/reachmira/AppShell';
import PageHeader from '@/components/reachmira/PageHeader';
import MetricCard from '@/components/reachmira/MetricCard';
import EmptyState from '@/components/reachmira/EmptyState';
import NextActionCard from '@/components/reachmira/NextActionCard';
import Spinner from '@/components/reachmira/Spinner';
import AnalyticsCharts from '@/components/reachmira/AnalyticsCharts';
import { getLeadStatusLabel, isRepliedStatus } from '@/lib/leads/status';
import { getLeadReadiness } from '@/lib/leads/library';
import {
  ArrowUpRight,
  Activity,
  Send,
  Reply,
  CalendarClock,
  TrendingUp,
  Sparkles,
  CheckCircle2,
  Mail,
  Database,
  Users,
  FolderOpen,
  CircleDashed,
  Eye,
  MousePointerClick,
} from 'lucide-react';

type LeadRow = {
  id: string;
  status?: string | null;
  priority?: string | null;
  next_follow_up_at?: string | null;
  next_follow_up_date?: string | null;
  manual_personalization_status?: string | null;
  pain_points?: string | null;
  email?: string | null;
  company_name?: string | null;
  company?: string | null;
  decision_maker_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  email_verification_status?: string | null;
  recommended_offer?: string | null;
  last_email_type?: string | null;
  solution?: string | null;
  manual_email_subject?: string | null;
  manual_email_body?: string | null;
  manual_email_approved?: boolean | null;
  emails_sent_count?: number | null;
  next_email_at?: string | null;
};

type AuditRow = {
  id: string;
  action: string;
  message?: string | null;
  created_at: string;
};

type SentEmailRow = {
  id: string;
  status?: string | null;
  replied_at?: string | null;
  bounced_at?: string | null;
  opened_at?: string | null;
  clicked_at?: string | null;
  sent_at: string;
};

export default function Dashboard() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [nowIso] = useState(() => new Date().toISOString());
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [campaignCount, setCampaignCount] = useState(0);
  const [recentActivities, setRecentActivities] = useState<AuditRow[]>([]);
  const [sentEmails, setSentEmails] = useState<SentEmailRow[]>([]);
  const [hasEmailAccount, setHasEmailAccount] = useState(false);
  const [aiStats, setAiStats] = useState({ callsToday: 0, cached: 0, skipped: 0 });
  const [dateRange, setDateRange] = useState<'7d' | '30d' | 'this_month' | 'all_time'>('30d');

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;

        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);

        const [campaignsResponse, leadsResponse, sentEmailsResponse, auditLogsResponse, aiUsageResponse, emailAccountsResponse] = await Promise.all([
          supabase.from('campaigns').select('id').eq('user_id', user.id),
          supabase
            .from('leads')
            .select('id,status,priority,next_follow_up_at,next_follow_up_date,manual_personalization_status,pain_points,email,company_name,company,decision_maker_name,first_name,last_name')
            .order('created_at', { ascending: false }),
          supabase
            .from('sent_emails')
            .select('id,status,replied_at,bounced_at,opened_at,clicked_at,sent_at')
            .order('sent_at', { ascending: false })
            .limit(500),
          supabase
            .from('audit_logs')
            .select('id,action,message,created_at')
            .order('created_at', { ascending: false })
            .limit(12),
          supabase
            .from('ai_usage_logs')
            .select('id,cache_hit,skipped,created_at')
            .eq('user_id', user.id)
            .gte('created_at', startOfDay.toISOString()),
          supabase.from('email_accounts').select('id').eq('user_id', user.id).limit(1),
        ]);

        setCampaignCount(campaignsResponse.data?.length || 0);
        setLeads((leadsResponse.data || []) as LeadRow[]);
        setSentEmails((sentEmailsResponse.data || []) as SentEmailRow[]);
        setRecentActivities((auditLogsResponse.data || []) as AuditRow[]);
        setHasEmailAccount((emailAccountsResponse.data?.length || 0) > 0);
        setAiStats({
          callsToday: aiUsageResponse.data?.filter((row) => !row.skipped && !row.cache_hit).length || 0,
          cached: aiUsageResponse.data?.filter((row) => row.cache_hit).length || 0,
          skipped: aiUsageResponse.data?.filter((row) => row.skipped).length || 0,
        });
      } finally {
        setLoading(false);
      }
    };

    loadDashboard();
  }, [supabase]);

  const filteredSentEmails = useMemo(() => {
    if (dateRange === 'all_time') return sentEmails;
    const now = new Date();
    let startDate = now;
    if (dateRange === '7d') startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    else if (dateRange === '30d') startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    else if (dateRange === 'this_month') startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    
    return sentEmails.filter(email => new Date(email.sent_at) >= startDate);
  }, [sentEmails, dateRange]);

  const metrics = useMemo(() => {
    const totalLeads = leads.length;
    const readyToSend = leads.filter((lead) => {
      // 8 readiness states mapping
      const status = String(lead.status || '').toLowerCase();
      if (['do_not_contact', 'unsubscribed', 'bounced', 'excluded'].includes(status)) return false;
      if (['mail_sent', 'manual_email_sent', 'follow_up_1_sent', 'follow_up_2_sent', 'follow_up_3_sent', 'sent', 'manually_sent', 'replied'].includes(status)) return false;
      const emailStatus = String(lead.email_verification_status || 'not_checked').toLowerCase();
      if (['invalid', 'disposable', 'suppressed'].includes(emailStatus)) return false;
      if (['role_based', 'risky', 'unknown', 'not_checked', 'failed'].includes(emailStatus)) return false;
      if (!String(lead.pain_points || '').trim()) return false;
      return true;
    }).length;
    const needsVerification = leads.filter((lead) => {
      const status = String(lead.status || '').toLowerCase();
      if (['do_not_contact', 'unsubscribed', 'bounced', 'excluded'].includes(status)) return false;
      const emailStatus = String(lead.email_verification_status || 'not_checked').toLowerCase();
      return ['role_based', 'risky', 'unknown', 'not_checked', 'failed'].includes(emailStatus);
    }).length;
    const missingSolution = leads.filter((lead) => {
      const status = String(lead.status || '').toLowerCase();
      if (['do_not_contact', 'unsubscribed', 'bounced', 'excluded'].includes(status)) return false;
      return !String(lead.pain_points || '').trim();
    }).length;

    const repliedLeads = leads.filter((lead) => isRepliedStatus(lead.status)).length;
    const sentEmailReplies = filteredSentEmails.filter((email) => Boolean(email.replied_at) || email.status === 'replied').length;
    const replies = Math.max(repliedLeads, sentEmailReplies);
    const bounces = filteredSentEmails.filter((email) => Boolean(email.bounced_at) || email.status === 'bounced').length;
    const bounceRate = filteredSentEmails.length > 0 ? Math.round((bounces / filteredSentEmails.length) * 100) : 0;
    // A click implies an open even when the tracking pixel was blocked.
    const opens = filteredSentEmails.filter((email) => Boolean(email.opened_at) || Boolean(email.clicked_at) || email.status === 'opened').length;
    const clicks = filteredSentEmails.filter((email) => Boolean(email.clicked_at) || email.status === 'clicked').length;
    const openRate = filteredSentEmails.length > 0 ? Math.round((opens / filteredSentEmails.length) * 100) : 0;
    const clickRate = filteredSentEmails.length > 0 ? Math.round((clicks / filteredSentEmails.length) * 100) : 0;
    const followUpsDue = leads.filter((lead) => {
      const nextFollowUp = lead.next_follow_up_at || lead.next_follow_up_date;
      if (!nextFollowUp) return false;
      return nextFollowUp <= nowIso;
    }).length;

    // Workspace Analytics Lite
    const validEmailsCount = leads.filter((lead) => lead.email_verification_status === 'valid').length;
    const validEmailRate = totalLeads ? Math.round((validEmailsCount / totalLeads) * 100) : 0;

    const readinessDistribution = {
      ready_to_send: 0,
      needs_email_verification: 0,
      missing_pain_point: 0,
      missing_solution_angle: 0,
      needs_personalization: 0,
      follow_up_due: 0,
      already_contacted: 0,
      do_not_contact: 0,
    };
    leads.forEach((lead) => {
      const r = getLeadReadiness(lead as Parameters<typeof getLeadReadiness>[0]);
      if (readinessDistribution[r] !== undefined) {
        readinessDistribution[r]++;
      }
    });

    const interestedCount = leads.filter((lead) =>
      ['interested', 'demo_scheduled', 'proposal_sent', 'won'].includes(String(lead.status || '').toLowerCase())
    ).length;

    const offerCounts: Record<string, number> = {};
    leads.forEach((lead) => {
      if (lead.recommended_offer) {
        offerCounts[lead.recommended_offer] = (offerCounts[lead.recommended_offer] || 0) + 1;
      }
    });
    let mostUsedOffer = 'None';
    let maxOfferCount = 0;
    Object.entries(offerCounts).forEach(([offer, count]) => {
      if (count > maxOfferCount) {
        maxOfferCount = count;
        mostUsedOffer = offer;
      }
    });

    const templateCounts: Record<string, number> = {};
    leads.forEach((lead) => {
      if (lead.last_email_type) {
        templateCounts[lead.last_email_type] = (templateCounts[lead.last_email_type] || 0) + 1;
      }
    });
    let bestUsedTemplate = 'None';
    let maxTemplateCount = 0;
    Object.entries(templateCounts).forEach(([template, count]) => {
      if (count > maxTemplateCount) {
        maxTemplateCount = count;
        bestUsedTemplate = template;
      }
    });

    return {
      totalLeads,
      readyToSend,
      needsVerification,
      missingSolution,
      emailsSent: filteredSentEmails.length,
      replies,
      followUpsDue,
      bounceRate,
      opens,
      clicks,
      openRate,
      clickRate,
      validEmailRate,
      readinessDistribution,
      interestedCount,
      mostUsedOffer,
      bestUsedTemplate,
    };
  }, [leads, filteredSentEmails, nowIso]);

  const needsAction = [
    {
      title: 'Leads Ready to Send',
      description: 'Leads fully verified, with pain points, ready for outreach.',
      count: metrics.readyToSend,
      actionLabel: 'View ready leads',
      actionHref: '/leads?readiness=ready_to_send',
      tone: 'violet' as const,
    },
    {
      title: 'Needing email verification',
      description: 'Leads with unchecked or risky email status needing check.',
      count: metrics.needsVerification,
      actionLabel: 'Verify emails',
      actionHref: '/leads?readiness=needs_email_verification',
      tone: 'amber' as const,
    },
    {
      title: 'Leads missing solution angle',
      description: 'Leads missing pain points or recommended offer tags.',
      count: metrics.missingSolution,
      actionLabel: 'Add context',
      actionHref: '/leads?readiness=missing_pain_point',
      tone: 'sky' as const,
    },
    {
      title: 'Follow-ups due today',
      description: 'Leads with a follow-up date that is due now.',
      count: metrics.followUpsDue,
      actionLabel: 'View follow-ups',
      actionHref: '/leads?filter=followups_due',
      tone: 'amber' as const,
    },
    {
      title: 'Drafts waiting approval',
      description: 'Manual drafts that should be reviewed before sending.',
      count: leads.filter((lead) => lead.manual_personalization_status === 'drafted').length,
      actionLabel: 'Open drafts',
      actionHref: '/leads?status=manual_email_draft',
      tone: 'violet' as const,
    },
    {
      title: 'High-priority untouched',
      description: 'Priority leads that still need a first touch.',
      count: leads.filter((lead) => lead.priority === 'high' && !lead.status?.includes('sent')).length,
      actionLabel: 'Review leads',
      actionHref: '/leads?priority=high&contacted=false',
      tone: 'rose' as const,
    },
  ];

  return (
    <AppShell>
      <PageHeader
        eyebrow="ReachMira dashboard"
        title="Welcome back to ReachMira"
        subtitle="Manage leads, write personalized emails, and track every follow-up from one place."
        actions={
          <>
            <Link href="/campaigns/new" className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-white px-4 py-2.5 text-sm font-semibold text-zinc-700 hover:bg-violet-50 hover:text-violet-700">
              <Sparkles className="h-4 w-4" />
              Create Campaign
            </Link>
            <Link href="/leads" className="inline-flex items-center gap-2 rounded-xl bg-zinc-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800">
              <ArrowUpRight className="h-4 w-4" />
              Open Follow-ups
            </Link>
          </>
        }
      />

      {loading ? (
        <div className="flex h-64 items-center justify-center text-violet-500">
          <Spinner size={36} />
        </div>
      ) : (
        <div className="space-y-8">
          {(!hasEmailAccount || leads.length === 0 || sentEmails.length === 0) && (
            <section className="rounded-3xl border border-[var(--border)] bg-gradient-to-br from-violet-600 via-violet-700 to-indigo-800 p-8 shadow-xl text-white relative overflow-hidden">
              <div className="absolute top-0 right-0 p-12 opacity-10">
                <Sparkles className="w-64 h-64" />
              </div>
              <div className="relative z-10 max-w-3xl">
                <h2 className="text-2xl font-bold tracking-tight text-white mb-2">Welcome to ReachMira! Let's get you set up.</h2>
                <p className="text-violet-100 mb-8 text-base">Complete these 3 simple steps to start turning cold leads into warm conversations.</p>
                
                <div className="space-y-4">
                  {/* Step 1 */}
                  <div className={`flex items-center gap-4 rounded-2xl p-4 transition-all ${hasEmailAccount ? 'bg-white/10 opacity-70' : 'bg-white/20 shadow-lg border border-white/20'}`}>
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${hasEmailAccount ? 'bg-emerald-500/20 text-emerald-300' : 'bg-white text-violet-700'}`}>
                      {hasEmailAccount ? <CheckCircle2 className="h-5 w-5" /> : <Mail className="h-5 w-5" />}
                    </div>
                    <div className="flex-1">
                      <h3 className={`font-semibold text-lg ${hasEmailAccount ? 'text-violet-200 line-through' : 'text-white'}`}>1. Connect an Email Account</h3>
                      <p className={`text-sm ${hasEmailAccount ? 'text-violet-300' : 'text-violet-100'}`}>Connect via SMTP or Mailgun to start sending.</p>
                    </div>
                    {!hasEmailAccount && (
                      <Link href="/settings/email-accounts" className="rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-violet-700 hover:bg-violet-50 shadow-sm transition-colors">
                        Connect Account
                      </Link>
                    )}
                  </div>

                  {/* Step 2 */}
                  <div className={`flex items-center gap-4 rounded-2xl p-4 transition-all ${leads.length > 0 ? 'bg-white/10 opacity-70' : (!hasEmailAccount ? 'bg-white/5 opacity-50' : 'bg-white/20 shadow-lg border border-white/20')}`}>
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${leads.length > 0 ? 'bg-emerald-500/20 text-emerald-300' : 'bg-white text-violet-700'}`}>
                      {leads.length > 0 ? <CheckCircle2 className="h-5 w-5" /> : <Database className="h-5 w-5" />}
                    </div>
                    <div className="flex-1">
                      <h3 className={`font-semibold text-lg ${leads.length > 0 ? 'text-violet-200 line-through' : 'text-white'}`}>2. Import your first Leads</h3>
                      <p className={`text-sm ${leads.length > 0 ? 'text-violet-300' : 'text-violet-100'}`}>Upload a CSV or paste a Google Sheet link.</p>
                    </div>
                    {hasEmailAccount && leads.length === 0 && (
                      <Link href="/leads/import" className="rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-violet-700 hover:bg-violet-50 shadow-sm transition-colors">
                        Import Leads
                      </Link>
                    )}
                  </div>

                  {/* Step 3 */}
                  <div className={`flex items-center gap-4 rounded-2xl p-4 transition-all ${sentEmails.length > 0 ? 'bg-white/10 opacity-70' : (leads.length === 0 ? 'bg-white/5 opacity-50' : 'bg-white/20 shadow-lg border border-white/20')}`}>
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${sentEmails.length > 0 ? 'bg-emerald-500/20 text-emerald-300' : 'bg-white text-violet-700'}`}>
                      {sentEmails.length > 0 ? <CheckCircle2 className="h-5 w-5" /> : <Send className="h-5 w-5" />}
                    </div>
                    <div className="flex-1">
                      <h3 className={`font-semibold text-lg ${sentEmails.length > 0 ? 'text-violet-200 line-through' : 'text-white'}`}>3. Add a Lead Manually</h3>
                      <p className={`text-sm ${sentEmails.length > 0 ? 'text-violet-300' : 'text-violet-100'}`}>Write their info by hand to test outreach.</p>
                    </div>
                    {leads.length > 0 && sentEmails.length === 0 && (
                      <Link href="/leads/new" className="rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-violet-700 hover:bg-violet-50 shadow-sm transition-colors">
                        Add Lead
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            </section>
          )}

          <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <h2 className="text-xl font-semibold tracking-tight text-zinc-950">Overview</h2>
            <div className="flex shrink-0 items-center gap-2 rounded-xl bg-white p-1 border border-[var(--border)] shadow-sm">
              {(['7d', '30d', 'this_month', 'all_time'] as const).map((range) => {
                const labels: Record<string, string> = {
                  '7d': '7 Days',
                  '30d': '30 Days',
                  'this_month': 'This Month',
                  'all_time': 'All Time'
                };
                return (
                  <button
                    key={range}
                    onClick={() => setDateRange(range)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                      dateRange === range
                        ? 'bg-violet-100 text-violet-700 shadow-sm'
                        : 'text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900'
                    }`}
                  >
                    {labels[range]}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Total Leads" value={metrics.totalLeads} description="All leads in your workspace" icon={Users} tone="slate" trend={`${campaignCount} campaigns`} />
            <MetricCard label="Ready to Send" value={metrics.readyToSend} description="Approved or draft-ready leads" icon={Mail} tone="violet" trend="Manual-first" />
            <MetricCard label="Emails Sent" value={metrics.emailsSent} description="In selected period" icon={Send} tone="teal" trend={`${metrics.replies} replies`} />
            <MetricCard label="Replies" value={metrics.replies} description="In selected period" icon={Reply} tone="sky" trend="Keep conversations warm" />
            <MetricCard label="Open Rate" value={`${metrics.openRate}%`} description={`${metrics.opens} opened in period`} icon={Eye} tone="violet" trend="Tracked via pixel" />
            <MetricCard label="Click Rate" value={`${metrics.clickRate}%`} description={`${metrics.clicks} clicked in period`} icon={MousePointerClick} tone="teal" trend="Tracked links" />
            <MetricCard label="Follow-ups Due" value={metrics.followUpsDue} description="Needs a next step today" icon={CalendarClock} tone="amber" trend="High priority" />
            <MetricCard label="Bounce Rate" value={`${metrics.bounceRate}%`} description="Delivery issues to review" icon={TrendingUp} tone="rose" trend={`${aiStats.callsToday} AI calls today`} />
          </div>

          <AnalyticsCharts leads={leads} sentEmails={filteredSentEmails} dateRange={dateRange} />

          <section className="mt-8">
            <div className="mb-4 flex items-end justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold tracking-tight text-zinc-950">What needs action</h2>
                <p className="mt-1 text-sm text-zinc-500">Always surface the next best move so outreach keeps moving.</p>
              </div>
              <div className="rounded-full border border-[var(--border)] bg-white px-3 py-1.5 text-xs font-semibold text-zinc-600">
                AI calls today: {aiStats.callsToday} · Cached: {aiStats.cached} · Skipped: {aiStats.skipped}
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              {needsAction.map((item) => (
                <NextActionCard key={item.title} {...item} />
              ))}
            </div>
          </section>

          <section className="rounded-3xl border border-[var(--border)] bg-white p-6 shadow-[0_12px_40px_rgba(15,23,42,0.04)]">
            <div className="mb-6">
              <h2 className="text-xl font-semibold tracking-tight text-zinc-950">Workspace Analytics Lite</h2>
              <p className="mt-1 text-sm text-zinc-500">A simple, high-level summary of lead quality, template usage, and readiness distribution.</p>
            </div>
            
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-2xl border border-[var(--border)] bg-zinc-50/50 p-4 text-center">
                <div className="text-2xl font-bold text-violet-700">{metrics.validEmailRate}%</div>
                <div className="mt-1 text-xs font-bold uppercase tracking-wider text-zinc-400">Valid Email Rate</div>
                <p className="mt-1 text-[11px] text-zinc-500">Percentage of leads verified as safe to send</p>
              </div>
              <div className="rounded-2xl border border-[var(--border)] bg-zinc-50/50 p-4 text-center">
                <div className="text-2xl font-bold text-teal-700">{metrics.interestedCount}</div>
                <div className="mt-1 text-xs font-bold uppercase tracking-wider text-zinc-400">Interested Leads</div>
                <p className="mt-1 text-[11px] text-zinc-500">Leads tagged with an interested stage</p>
              </div>
              <div className="rounded-2xl border border-[var(--border)] bg-zinc-50/50 p-4 text-center">
                <div className="text-sm font-bold text-zinc-800 truncate px-2" title={metrics.mostUsedOffer}>{metrics.mostUsedOffer}</div>
                <div className="mt-1 text-xs font-bold uppercase tracking-wider text-zinc-400">Most Used Offer</div>
                <p className="mt-1 text-[11px] text-zinc-500">Top offer assigned to lead records</p>
              </div>
              <div className="rounded-2xl border border-[var(--border)] bg-zinc-50/50 p-4 text-center">
                <div className="text-sm font-bold text-zinc-800 truncate px-2" title={metrics.bestUsedTemplate}>{metrics.bestUsedTemplate.replace(/_/g, ' ')}</div>
                <div className="mt-1 text-xs font-bold uppercase tracking-wider text-zinc-400">Best Used Template</div>
                <p className="mt-1 text-[11px] text-zinc-500">Most frequent cold or follow-up email type</p>
              </div>
            </div>

            <div className="mt-6 border-t border-[var(--border)] pt-6">
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-4">Outreach Readiness Distribution</h3>
              <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-8 text-center">
                <div className="rounded-xl bg-emerald-50 p-3 border border-emerald-100">
                  <div className="text-lg font-bold text-emerald-700">{metrics.readinessDistribution.ready_to_send}</div>
                  <div className="text-[10px] uppercase font-bold text-zinc-500">Ready to Send</div>
                </div>
                <div className="rounded-xl bg-yellow-50 p-3 border border-yellow-100">
                  <div className="text-lg font-bold text-yellow-700">{metrics.readinessDistribution.needs_email_verification}</div>
                  <div className="text-[10px] uppercase font-bold text-zinc-500">Needs Verif.</div>
                </div>
                <div className="rounded-xl bg-orange-50 p-3 border border-orange-100">
                  <div className="text-lg font-bold text-orange-700">{metrics.readinessDistribution.missing_pain_point}</div>
                  <div className="text-[10px] uppercase font-bold text-zinc-500">Missing Pain</div>
                </div>
                <div className="rounded-xl bg-amber-50 p-3 border border-amber-100">
                  <div className="text-lg font-bold text-amber-700">{metrics.readinessDistribution.missing_solution_angle}</div>
                  <div className="text-[10px] uppercase font-bold text-zinc-500">Missing Offer</div>
                </div>
                <div className="rounded-xl bg-violet-50 p-3 border border-violet-100">
                  <div className="text-lg font-bold text-violet-700">{metrics.readinessDistribution.needs_personalization}</div>
                  <div className="text-[10px] uppercase font-bold text-zinc-500">Needs Pers.</div>
                </div>
                <div className="rounded-xl bg-rose-50 p-3 border border-rose-100">
                  <div className="text-lg font-bold text-rose-700">{metrics.readinessDistribution.follow_up_due}</div>
                  <div className="text-[10px] uppercase font-bold text-zinc-500">Follow-up Due</div>
                </div>
                <div className="rounded-xl bg-blue-50 p-3 border border-blue-100">
                  <div className="text-lg font-bold text-blue-700">{metrics.readinessDistribution.already_contacted}</div>
                  <div className="text-[10px] uppercase font-bold text-zinc-500">Contacted</div>
                </div>
                <div className="rounded-xl bg-zinc-100 p-3 border border-zinc-200">
                  <div className="text-lg font-bold text-zinc-700">{metrics.readinessDistribution.do_not_contact}</div>
                  <div className="text-[10px] uppercase font-bold text-zinc-500">Do Not Contact</div>
                </div>
              </div>
            </div>
          </section>

          <div className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
            <section className="rounded-3xl border border-[var(--border)] bg-white p-6 shadow-[0_12px_40px_rgba(15,23,42,0.04)]">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-zinc-950">Recent activity</h2>
                  <p className="text-sm text-zinc-500">A quick view of imports, AI actions, approvals, and replies.</p>
                </div>
                <Link href="/activity" className="text-sm font-semibold text-violet-700 hover:text-violet-800">
                  View all
                </Link>
              </div>

              <div className="space-y-3">
                {recentActivities.length === 0 ? (
                  <EmptyState
                    icon={Activity}
                    title="No activity yet"
                    description="Import a lead list or send your first email to see the timeline come alive."
                    actionLabel="Import Leads"
                    actionHref="/leads/import"
                    actionIcon={Database}
                  />
                ) : (
                  recentActivities.map((item) => (
                    <div key={item.id} className="flex items-start gap-4 rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)]/80 p-4">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-violet-600 ring-1 ring-violet-100">
                        <Activity className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="font-medium text-zinc-950">{getLeadStatusLabel(item.action)}</div>
                          <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-zinc-500 ring-1 ring-[var(--border)]">
                            {new Date(item.created_at).toLocaleString()}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-zinc-500">{item.message || 'No details provided.'}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>

            <section className="space-y-4">
              <div className="rounded-3xl border border-[var(--border)] bg-gradient-to-br from-violet-50 via-white to-teal-50 p-6 shadow-[0_12px_40px_rgba(15,23,42,0.04)]">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.22em] text-violet-600">ReachMira assistant</div>
                    <h3 className="mt-2 text-lg font-semibold text-zinc-950">Smarter outreach without the complexity</h3>
                  </div>
                  <div className="rounded-2xl bg-white px-3 py-2 text-xs font-semibold text-zinc-600 ring-1 ring-[var(--border)]">
                    Manual-first
                  </div>
                </div>
                <p className="mt-3 text-sm leading-6 text-zinc-500">
                  Import leads, generate context, draft manually, approve safely, and keep every follow-up visible in one calm workspace.
                </p>
                <div className="mt-5 flex flex-wrap gap-2">
                  <Link href="/leads/import" className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-700">
                    <Sparkles className="h-4 w-4" />
                    Import leads
                  </Link>
                  <Link href="/manual-emails" className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-white px-4 py-2.5 text-sm font-semibold text-zinc-700 hover:bg-teal-50 hover:text-teal-700">
                    <CircleDashed className="h-4 w-4" />
                    Open drafts
                  </Link>
                </div>
              </div>

              <div className="rounded-3xl border border-[var(--border)] bg-white p-6 shadow-[0_12px_40px_rgba(15,23,42,0.04)]">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-zinc-950">Campaigns</h3>
                    <p className="text-sm text-zinc-500">Track active outreach programs.</p>
                  </div>
                  <div className="rounded-full bg-violet-50 px-2.5 py-1 text-[11px] font-semibold text-violet-700">
                    {campaignCount} total
                  </div>
                </div>
                <div className="mt-4 space-y-3">
                  {campaignCount === 0 ? (
                    <EmptyState
                      icon={FolderOpen}
                      title="No campaigns yet"
                      description="Create a campaign when you are ready to send a sequence."
                      actionLabel="Create Campaign"
                      actionHref="/campaigns/new"
                      actionIcon={Sparkles}
                    />
                  ) : (
                    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)]/70 p-4">
                      <div className="flex items-center gap-2 text-sm font-medium text-zinc-700">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        Campaigns are active and ready for follow-up tracking.
                      </div>
                      <p className="mt-2 text-sm text-zinc-500">
                        Keep sequences short, human, and easy to approve.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </section>
          </div>
        </div>
      )}
    </AppShell>
  );
}
