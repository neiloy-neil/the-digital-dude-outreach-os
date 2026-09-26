'use client';

import { Clock3, Copy, Edit3, MessageSquare } from 'lucide-react';
import { formatDate, getReplyBodyText } from '@/components/leads/workspace/utils';

type ReplyEvent = {
  id: string;
  createdAt: string;
  message?: string | null;
  sender: string;
  recipient: string;
  subject: string;
  snippet: string;
  bodyText: string;
  bodyHtml: string;
  source: string;
};

type RepliesPanelProps = {
  replyEvents: ReplyEvent[];
  refreshing: boolean;
  checkingReplies: boolean;
  onCheckRepliesNow: () => void;
  replyOutcome: string;
  onReplyOutcomeChange: (value: string) => void;
  saving: boolean;
  onSaveOutcome: () => void;
  leadEmail?: string | null;
  onCopyReply: (reply: ReplyEvent) => void;
  onUseAsFollowUp: (reply: ReplyEvent) => void;
};

export default function RepliesPanel({
  replyEvents,
  refreshing,
  checkingReplies,
  onCheckRepliesNow,
  replyOutcome,
  onReplyOutcomeChange,
  saving,
  onSaveOutcome,
  leadEmail,
  onCopyReply,
  onUseAsFollowUp,
}: RepliesPanelProps) {
  return (
    <div className="rounded-3xl border border-[var(--border)] bg-white p-6 shadow-[0_12px_40px_rgba(15,23,42,0.04)]">
      <div className="mb-5 flex flex-col gap-3 border-b border-[var(--border)] pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-base font-semibold text-zinc-950">Replies</h3>
          <p className="mt-1 text-sm text-zinc-500">Read inbound replies captured from Mailgun or IMAP reply detection.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={onCheckRepliesNow}
            disabled={refreshing || checkingReplies}
            className="inline-flex items-center gap-2 rounded-xl border border-teal-200 bg-teal-50 px-3 py-2 text-xs font-semibold text-teal-700 transition hover:bg-teal-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Clock3 className={`h-3.5 w-3.5 ${refreshing || checkingReplies ? 'animate-spin' : ''}`} />
            {checkingReplies ? 'Checking inbox...' : refreshing ? 'Refreshing...' : 'Check inbox'}
          </button>
          {refreshing && (
            <span className="inline-flex items-center gap-2 rounded-full bg-violet-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-violet-700 ring-1 ring-violet-100">
              <span className="h-2 w-2 animate-spin rounded-full border border-violet-400 border-t-transparent" />
              Refreshing
            </span>
          )}
          <span className="rounded-full bg-teal-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-teal-700 ring-1 ring-teal-100">
            {replyEvents.length} replies
          </span>
        </div>
      </div>

      {/* Reply Outcome Classifier Box */}
      <div className="mb-6 rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] p-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="text-sm font-semibold text-zinc-950">Reply Outcome Classification</div>
            <p className="text-xs text-zinc-500 mt-1">Classify the prospect's interest level manually for tracking.</p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={replyOutcome}
              onChange={(e) => onReplyOutcomeChange(e.target.value)}
              className="rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-xs text-zinc-950 outline-none focus:border-violet-500"
            >
              <option value="">-- Unclassified --</option>
              <option value="Interested">Interested</option>
              <option value="Not interested">Not interested</option>
              <option value="Asked for details">Asked for details</option>
              <option value="Demo requested">Demo requested</option>
              <option value="Proposal requested">Proposal requested</option>
            </select>
            <button
              onClick={onSaveOutcome}
              disabled={saving}
              className="rounded-xl bg-violet-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-violet-700 transition"
            >
              Save Outcome
            </button>
          </div>
        </div>
      </div>

      {replyEvents.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-[var(--border)] bg-[var(--surface-muted)] p-8 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-50 text-violet-700">
            <MessageSquare className="h-5 w-5" />
          </div>
          <div className="text-sm font-semibold text-zinc-950">No replies captured yet</div>
          <p className="mt-2 text-sm text-zinc-500">When a lead replies, the message will appear here and future follow-ups will stop automatically.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {replyEvents.map((reply) => {
            const replyBody = getReplyBodyText(reply);
            return (
              <article key={reply.id} className="rounded-3xl border border-[var(--border)] bg-[var(--surface-muted)] p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-violet-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-violet-700 ring-1 ring-violet-100">
                        Reply received
                      </span>
                      <span className="text-xs text-zinc-500">{formatDate(reply.createdAt)}</span>
                    </div>
                    <h4 className="mt-3 text-base font-semibold text-zinc-950">{reply.subject}</h4>
                    <div className="mt-2 grid gap-1 text-sm text-zinc-600">
                      <div><span className="font-medium text-zinc-900">From:</span> {reply.sender || leadEmail || 'Unknown sender'}</div>
                      {reply.recipient && <div><span className="font-medium text-zinc-900">To:</span> {reply.recipient}</div>}
                      <div><span className="font-medium text-zinc-900">Source:</span> {reply.source.replace(/_/g, ' ')}</div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => onCopyReply(reply)} className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-xs font-semibold text-zinc-700 transition hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700">
                      <Copy className="h-3.5 w-3.5" /> Copy Reply
                    </button>
                    <button onClick={() => onUseAsFollowUp(reply)} className="inline-flex items-center gap-2 rounded-xl border border-teal-200 bg-teal-50 px-3 py-2 text-xs font-semibold text-teal-700 transition hover:bg-teal-100">
                      <Edit3 className="h-3.5 w-3.5" /> Use as Follow-up
                    </button>
                  </div>
                </div>
                <pre className="mt-4 max-h-[420px] overflow-auto whitespace-pre-wrap rounded-2xl border border-[var(--border)] bg-white p-4 text-sm leading-6 text-zinc-800">
                  {replyBody || 'Reply body was not stored for this event. New inbound webhook replies will include the full message body.'}
                </pre>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
