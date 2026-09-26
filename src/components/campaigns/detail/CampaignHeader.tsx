'use client';

import Link from 'next/link';
import { ArrowLeft, Pause, Play } from 'lucide-react';
import { Banner } from '@/components/reachmira/ui';
import type { EmailAccountOption } from '@/hooks/useEmailAccounts';

type LaunchChecklistItem = { label: string; detail: string; ok: boolean; required: boolean };

type Analytics = {
  leads: number;
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  replied: number;
  bounced: number;
  unsubscribed: number;
};

type CampaignHeaderProps = {
  campaignId: string;
  campaign: any;
  loading: boolean;
  error: string | null;
  success: string | null;
  onDismissError: () => void;
  onDismissSuccess: () => void;
  emailAccounts: EmailAccountOption[];
  auditLogs: any[];
  onEmailAccountChange: (emailAccountId: string) => void;
  onAllowRiskyEmailsChange: (value: boolean) => void;
  onLaunchClick: () => void;
  onPauseClick: () => void;
  launchChecklist: LaunchChecklistItem[];
  launchBlockingIssuesCount: number;
  approvedLeadsCount: number;
  pendingReviewCount: number;
  analytics: Analytics;
  rateOfSent: (count: number) => string | null;
};

export default function CampaignHeader({
  campaignId,
  campaign,
  loading,
  error,
  success,
  onDismissError,
  onDismissSuccess,
  emailAccounts,
  auditLogs,
  onEmailAccountChange,
  onAllowRiskyEmailsChange,
  onLaunchClick,
  onPauseClick,
  launchChecklist,
  launchBlockingIssuesCount,
  approvedLeadsCount,
  pendingReviewCount,
  analytics,
  rateOfSent,
}: CampaignHeaderProps) {
  return (
    <>
      {/* Back and Title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <Link href="/campaigns" className="p-2 bg-white border border-[var(--border)] rounded-lg text-zinc-600 hover:text-violet-700 transition-all">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          {campaign && (
            <div>
              <h2 className="text-2xl font-bold text-zinc-950 tracking-tight">{campaign.name}</h2>
              <div className="flex items-center gap-2 mt-1">
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-medium uppercase border ${
                  campaign.status === 'active'
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                    : campaign.status === 'paused'
                    ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                    : 'bg-[var(--surface-muted)] text-zinc-600 border-zinc-700'
                }`}>
                  {campaign.status}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Campaign Action buttons */}
        {campaign && (
          <div className="flex items-center gap-3">
            {campaign.status === 'draft' || campaign.status === 'paused' ? (
              <button
                onClick={onLaunchClick}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 rounded-lg text-sm font-semibold text-white hover:opacity-90 shadow-md shadow-emerald-500/10 cursor-pointer"
              >
                <Play className="h-4 w-4" /> Launch Campaign
              </button>
            ) : (
              <button
                onClick={onPauseClick}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-[var(--border)] rounded-lg text-sm font-semibold text-amber-400 hover:text-amber-300 hover:bg-violet-50 cursor-pointer"
              >
                <Pause className="h-4 w-4" /> Pause Campaign
              </button>
            )}
          </div>
        )}
      </div>

      {/* Global Notifications */}
      {error && (
        <Banner tone="error" className="mb-6" onDismiss={onDismissError}>
          {error}
        </Banner>
      )}
      {success && (
        <Banner tone="success" className="mb-6" onDismiss={onDismissSuccess}>
          {success}
        </Banner>
      )}

      {!loading && campaign && (
        <div className="mb-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-xl border border-[var(--border)] bg-white/20 p-4 backdrop-blur-sm">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div>
                <h3 className="text-sm font-bold text-zinc-950">Email Account</h3>
                <p className="text-xs text-zinc-500">Choose the sender account used for this campaign.</p>
              </div>
              <Link href="/settings/email-accounts" className="text-xs font-semibold text-violet-400 hover:text-violet-300">
                Manage accounts
              </Link>
            </div>
            <select
              value={campaign.email_account_id || ''}
              onChange={(e) => onEmailAccountChange(e.target.value)}
              className="w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm text-zinc-900 focus:border-violet-500 focus:outline-none"
            >
              <option value="">Select an active email account</option>
              {emailAccounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.email_address} - {account.provider.toUpperCase()}
                  {account.is_default ? ' (Default)' : ''}
                </option>
              ))}
            </select>
            {!emailAccounts.length && (
              <p className="mt-3 text-xs text-amber-400">
                Please add an email account before starting a campaign.
              </p>
            )}
          </div>

          <div className="rounded-xl border border-[var(--border)] bg-white/20 p-4 backdrop-blur-sm">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div>
                <h3 className="text-sm font-bold text-zinc-950">Latest Activity</h3>
                <p className="text-xs text-zinc-500">Recent campaign audit trail.</p>
              </div>
              <Link href={`/campaigns/${campaignId}/activity`} className="text-xs font-semibold text-violet-400 hover:text-violet-300">
                View all
              </Link>
            </div>
            <div className="space-y-2">
              {auditLogs.length === 0 ? (
                <p className="text-xs text-zinc-500">No audit logs yet.</p>
              ) : (
                auditLogs.slice(0, 4).map((log) => (
                  <div key={log.id} className="flex items-start justify-between gap-3 rounded-lg border border-[var(--border)] bg-white/60 px-3 py-2">
                    <div>
                      <div className="text-xs font-semibold text-zinc-900">{log.action}</div>
                      <div className="text-[11px] text-zinc-600">{log.message || 'No message'}</div>
                    </div>
                    <div className="text-[10px] text-zinc-500 font-mono">
                      {new Date(log.created_at).toLocaleString()}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {!loading && campaign && (
        <div className="mb-6 rounded-xl border border-[var(--border)] bg-white/20 p-4 backdrop-blur-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 className="text-sm font-bold text-zinc-950">Email Verification Safety</h3>
              <p className="text-xs text-zinc-500">Automation always blocks `invalid`, `disposable`, and `suppressed` leads. This setting controls whether `not_checked`, `unknown`, and `risky` leads are skipped or allowed.</p>
            </div>
            <label className="inline-flex items-center gap-3 rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm font-semibold text-zinc-800">
              <input
                type="checkbox"
                checked={Boolean(campaign.allow_risky_emails)}
                onChange={(e) => onAllowRiskyEmailsChange(e.target.checked)}
                className="rounded border-zinc-300 text-violet-600 focus:ring-violet-500"
              />
              Allow risky email statuses
            </label>
          </div>
          <div className="mt-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 text-xs text-zinc-600">
            Current policy: <span className="font-semibold text-zinc-900">{campaign.allow_risky_emails ? 'Allow risky/unchecked campaign sends' : 'Skip risky/unchecked campaign sends'}</span>
          </div>
        </div>
      )}

      {!loading && campaign && (
        <section className="mb-6 rounded-3xl border border-[var(--border)] bg-white p-5 shadow-[0_12px_40px_rgba(15,23,42,0.04)]">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 className="text-sm font-bold text-zinc-950">Launch Readiness</h3>
              <p className="mt-1 text-xs text-zinc-500">A quick safety pass before campaign automation starts sending.</p>
            </div>
            <div className={`rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-wide ${
              launchBlockingIssuesCount === 0
                ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100'
                : 'bg-amber-50 text-amber-700 ring-1 ring-amber-100'
            }`}>
              {launchBlockingIssuesCount === 0 ? 'Ready to launch' : `${launchBlockingIssuesCount} issue${launchBlockingIssuesCount === 1 ? '' : 's'} to fix`}
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {launchChecklist.map((item) => (
              <div key={item.label} className={`rounded-2xl border p-4 ${
                item.ok
                  ? 'border-emerald-100 bg-emerald-50/60'
                  : 'border-amber-200 bg-amber-50'
              }`}>
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-zinc-950">{item.label}</div>
                  <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${
                    item.ok ? 'bg-white text-emerald-700 ring-1 ring-emerald-100' : 'bg-white text-amber-700 ring-1 ring-amber-100'
                  }`}>
                    {item.ok ? 'Ready' : 'Needs fix'}
                  </span>
                </div>
                <p className="mt-2 text-xs leading-5 text-zinc-600">{item.detail}</p>
              </div>
            ))}
          </div>

          <div className="mt-4 grid gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] p-4 text-xs text-zinc-600 sm:grid-cols-3">
            <div><span className="font-semibold text-zinc-950">{approvedLeadsCount}</span> approved or queued</div>
            <div><span className="font-semibold text-zinc-950">{pendingReviewCount}</span> pending review</div>
            <div><span className="font-semibold text-zinc-950">{campaign.daily_limit || 0}</span> campaign daily limit</div>
          </div>
        </section>
      )}

      {!loading && campaign && (
        <section className="mb-6 rounded-3xl border border-[var(--border)] bg-white p-5 shadow-[0_12px_40px_rgba(15,23,42,0.04)]">
          <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h3 className="text-sm font-bold text-zinc-950">Campaign Analytics</h3>
              <p className="text-xs text-zinc-500">Live delivery and lead outcomes for this campaign.</p>
            </div>
            <Link href={`/campaigns/${campaignId}/activity`} className="text-xs font-semibold text-violet-700 hover:text-violet-900">
              View timeline
            </Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
            {([
              ['Leads', analytics.leads, 'text-slate-700 bg-slate-50 border-slate-200', null],
              ['Sent', analytics.sent, 'text-violet-700 bg-violet-50 border-violet-200', null],
              ['Delivered', analytics.delivered, 'text-teal-700 bg-teal-50 border-teal-200', null],
              ['Opened', analytics.opened, 'text-sky-700 bg-sky-50 border-sky-200', rateOfSent(analytics.opened)],
              ['Clicked', analytics.clicked, 'text-indigo-700 bg-indigo-50 border-indigo-200', rateOfSent(analytics.clicked)],
              ['Replied', analytics.replied, 'text-emerald-700 bg-emerald-50 border-emerald-200', rateOfSent(analytics.replied)],
              ['Bounced', analytics.bounced, 'text-rose-700 bg-rose-50 border-rose-200', null],
              ['Unsubscribed', analytics.unsubscribed, 'text-amber-700 bg-amber-50 border-amber-200', null],
            ] as [string, number, string, string | null][]).map(([label, value, tone, rate]) => (
              <div key={label} className={`rounded-2xl border px-3 py-3 ${tone}`}>
                <div className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-75">{label}</div>
                <div className="mt-2 text-2xl font-black tracking-tight">{value}</div>
                {rate && <div className="mt-0.5 text-[10px] font-semibold opacity-70">{rate}</div>}
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
