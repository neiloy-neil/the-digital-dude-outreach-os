'use client';

import { Badge } from '@/components/reachmira/ui';
import StatusBadge from '@/components/leads/StatusBadge';
import { getLeadStatusLabel } from '@/lib/leads/status';
import { formatDate } from '@/components/leads/workspace/utils';
import type { SentEmail } from '@/types/database.types';

type EmailHistoryPanelProps = {
  sentEmails: SentEmail[];
  refreshing: boolean;
  sending: boolean;
  onSelectEmail: (email: SentEmail) => void;
  onCopyEmail: (email: SentEmail) => void;
  onUseAsFollowUp: (email: SentEmail) => void;
  onResend: (email: SentEmail) => void;
};

export default function EmailHistoryPanel({
  sentEmails,
  refreshing,
  sending,
  onSelectEmail,
  onCopyEmail,
  onUseAsFollowUp,
  onResend,
}: EmailHistoryPanelProps) {
  return (
    <div className="rounded-3xl border border-[var(--border)] bg-white p-6 shadow-[0_12px_40px_rgba(15,23,42,0.04)]">
      <div className="mb-5 flex flex-col gap-3 border-b border-[var(--border)] pb-4 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-base font-semibold text-zinc-950">Email History</h3>
        <div className="flex items-center gap-3">
          {refreshing && (
            <span className="inline-flex items-center gap-2 rounded-full bg-violet-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-violet-700 ring-1 ring-violet-100">
              <span className="h-2 w-2 animate-spin rounded-full border border-violet-400 border-t-transparent" />
              Refreshing
            </span>
          )}
          <span className="text-xs text-zinc-500">{sentEmails.length || 0} emails</span>
        </div>
      </div>
      {refreshing && <div className="mb-4 rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 text-sm text-zinc-600">Refreshing email history...</div>}
      {sentEmails.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-[var(--border)] bg-[var(--surface-muted)] p-8 text-center">
          <div className="text-sm font-semibold text-zinc-950">No sent emails yet</div>
          <p className="mt-2 text-sm text-zinc-500">Send a manual email or run a campaign step and the sent messages will appear here.</p>
        </div>
      ) : (
        <>
          <div className="hidden overflow-x-auto lg:block">
            <table className="min-w-[1100px] w-full text-left text-sm">
              <thead className="border-b border-[var(--border)] text-xs uppercase tracking-[0.18em] text-zinc-400">
                <tr>
                  <th className="px-3 py-3">Sent At</th>
                  <th className="px-3 py-3">Type</th>
                  <th className="px-3 py-3">Sender</th>
                  <th className="px-3 py-3">Recipient</th>
                  <th className="px-3 py-3">Subject</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3">Provider</th>
                  <th className="px-3 py-3">Signals</th>
                  <th className="px-3 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {sentEmails.map((email) => (
                  <tr key={email.id} className="cursor-pointer transition hover:bg-violet-50/50" onClick={() => onSelectEmail(email)}>
                    <td className="px-3 py-3 text-zinc-600">{formatDate(email.sent_at)}</td>
                    <td className="px-3 py-3 text-zinc-600">{getLeadStatusLabel(email.email_type)}</td>
                    <td className="px-3 py-3 text-zinc-600">{email.sender_email}</td>
                    <td className="px-3 py-3 text-zinc-600">{email.recipient_email}</td>
                    <td className="px-3 py-3 font-medium text-zinc-900">{email.subject}</td>
                    <td className="px-3 py-3"><StatusBadge status={email.status} /></td>
                    <td className="px-3 py-3 text-zinc-600">{email.provider}</td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-1">
                        {(email.opened_at || email.clicked_at) && <Badge tone="sky">Opened</Badge>}
                        {email.clicked_at && <Badge tone="indigo">Clicked</Badge>}
                        {email.replied_at && <Badge tone="emerald">Replied</Badge>}
                        {email.bounced_at && <Badge tone="rose">Bounced</Badge>}
                        {!email.opened_at && !email.clicked_at && !email.replied_at && !email.bounced_at && (
                          <span className="text-xs text-zinc-400">—</span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-2">
                        <button onClick={(event) => { event.stopPropagation(); onSelectEmail(email); }} className="rounded-lg border border-[var(--border)] bg-white px-2.5 py-1.5 text-xs font-semibold text-zinc-700 transition hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700">View</button>
                        <button onClick={(event) => { event.stopPropagation(); onCopyEmail(email); }} className="rounded-lg border border-[var(--border)] bg-white px-2.5 py-1.5 text-xs font-semibold text-zinc-700 transition hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700">Copy</button>
                        <button onClick={(event) => { event.stopPropagation(); onUseAsFollowUp(email); }} className="rounded-lg border border-[var(--border)] bg-white px-2.5 py-1.5 text-xs font-semibold text-zinc-700 transition hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700">Follow-up</button>
                        <button onClick={(event) => { event.stopPropagation(); onResend(email); }} disabled={sending} className="rounded-lg border border-teal-200 bg-teal-50 px-2.5 py-1.5 text-xs font-semibold text-teal-700 transition hover:bg-teal-100 disabled:opacity-50">Resend</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="grid gap-4 lg:hidden">
            {sentEmails.map((email) => (
              <div key={email.id} onClick={() => onSelectEmail(email)} className="cursor-pointer rounded-3xl border border-[var(--border)] bg-[var(--surface-muted)] p-4 text-left transition hover:border-violet-200 hover:bg-violet-50/50">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-zinc-950">{email.subject}</div>
                    <div className="mt-1 text-xs text-zinc-500">{formatDate(email.sent_at)} · {getLeadStatusLabel(email.email_type)}</div>
                  </div>
                  <StatusBadge status={email.status} />
                </div>
                <div className="mt-3 grid gap-1 text-sm text-zinc-600">
                  <div><span className="font-medium text-zinc-900">From:</span> {email.sender_email}</div>
                  <div><span className="font-medium text-zinc-900">To:</span> {email.recipient_email}</div>
                  <div><span className="font-medium text-zinc-900">Provider:</span> {email.provider}</div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button onClick={(event) => { event.stopPropagation(); onSelectEmail(email); }} className="rounded-lg border border-[var(--border)] bg-white px-2.5 py-1.5 text-xs font-semibold text-zinc-700">View</button>
                  <button onClick={(event) => { event.stopPropagation(); onCopyEmail(email); }} className="rounded-lg border border-[var(--border)] bg-white px-2.5 py-1.5 text-xs font-semibold text-zinc-700">Copy</button>
                  <button onClick={(event) => { event.stopPropagation(); onUseAsFollowUp(email); }} className="rounded-lg border border-[var(--border)] bg-white px-2.5 py-1.5 text-xs font-semibold text-zinc-700">Follow-up</button>
                  <button onClick={(event) => { event.stopPropagation(); onResend(email); }} disabled={sending} className="rounded-lg border border-teal-200 bg-teal-50 px-2.5 py-1.5 text-xs font-semibold text-teal-700 disabled:opacity-50">Resend</button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
