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
import { getLeadStatusLabel, isRepliedStatus } from '@/lib/leads/status';
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
  const [aiStats, setAiStats] = useState({ callsToday: 0, cached: 0, skipped: 0 });

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;

        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);

        const [campaignsResponse, leadsResponse, sentEmailsResponse, auditLogsResponse, aiUsageResponse] = await Promise.all([
          supabase.from('campaigns').select('id').eq('user_id', user.id),
          supabase
            .from('leads')
            .select('id,status,priority,next_follow_up_at,next_follow_up_date,manual_personalization_status,pain_points,email,company_name,company,decision_maker_name,first_name,last_name')
            .order('created_at', { ascending: false }),
          supabase
            .from('sent_emails')
            .select('id,status,replied_at,bounced_at,sent_at')
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
        ]);

        setCampaignCount(campaignsResponse.data?.length || 0);
        setLeads((leadsResponse.data || []) as LeadRow[]);
        setSentEmails((sentEmailsResponse.data || []) as SentEmailRow[]);
        setRecentActivities((auditLogsResponse.data || []) as AuditRow[]);
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

  const metrics = useMemo(() => {
    const totalLeads = leads.length;
    const readyToSend = leads.filter((lead) => ['manual_email_draft', 'ai_generated', 'email_approved'].includes(String(lead.status || ''))).length;
    const repliedLeads = leads.filter((lead) => isRepliedStatus(lead.status)).length;
    const sentEmailReplies = sentEmails.filter((email) => Boolean(email.replied_at) || email.status === 'replied').length;
    const replies = Math.max(repliedLeads, sentEmailReplies);
    const bounces = sentEmails.filter((email) => Boolean(email.bounced_at) || email.status === 'bounced').length;
    const bounceRate = sentEmails.length > 0 ? Math.round((bounces / sentEmails.length) * 100) : 0;
    const followUpsDue = leads.filter((lead) => {
      const nextFollowUp = lead.next_follow_up_at || lead.next_follow_up_date;
      if (!nextFollowUp) return false;
      return nextFollowUp <= nowIso;
    }).length;

    return {
      totalLeads,
      readyToSend,
      emailsSent: sentEmails.length,
      replies,
      followUpsDue,
      bounceRate,
    };
  }, [leads, sentEmails, nowIso]);

  const needsAction = [
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
    {
      title: 'Leads missing pain point',
      description: 'These leads need richer context before outreach.',
      count: leads.filter((lead) => !lead.pain_points?.trim()).length,
      actionLabel: 'Improve context',
      actionHref: '/leads?missing=pain_points',
      tone: 'sky' as const,
    },
    {
      title: 'Replies waiting response',
      description: 'Use the timeline to reply or update lead state.',
      count: metrics.replies,
      actionLabel: 'Open replied leads',
      actionHref: '/leads?status=replied',
      tone: 'teal' as const,
    },
    {
      title: 'Bounced leads to review',
      description: 'Check delivery issues and suppression list entries.',
      count: sentEmails.filter((email) => Boolean(email.bounced_at) || email.status === 'bounced').length,
      actionLabel: 'Review bounces',
      actionHref: '/leads?status=bounced',
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
        <div className="flex h-64 items-center justify-center">
          <div className="h-9 w-9 animate-spin rounded-full border-4 border-violet-500 border-t-transparent" />
        </div>
      ) : (
        <div className="space-y-8">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
            <MetricCard label="Total Leads" value={metrics.totalLeads} description="All leads in your workspace" icon={Users} tone="slate" trend={`${campaignCount} campaigns`} />
            <MetricCard label="Ready to Send" value={metrics.readyToSend} description="Approved or draft-ready leads" icon={Mail} tone="violet" trend="Manual-first" />
            <MetricCard label="Emails Sent" value={metrics.emailsSent} description="Tracked sent messages" icon={Send} tone="teal" trend={`${metrics.replies} replies`} />
            <MetricCard label="Replies" value={metrics.replies} description="Replies detected in history" icon={Reply} tone="sky" trend="Keep conversations warm" />
            <MetricCard label="Follow-ups Due" value={metrics.followUpsDue} description="Needs a next step today" icon={CalendarClock} tone="amber" trend="High priority" />
            <MetricCard label="Bounce Rate" value={`${metrics.bounceRate}%`} description="Delivery issues to review" icon={TrendingUp} tone="rose" trend={`${aiStats.callsToday} AI calls today`} />
          </div>

          <section>
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
