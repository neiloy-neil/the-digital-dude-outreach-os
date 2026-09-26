'use client';

import { Copy, Edit3, Send, X } from 'lucide-react';
import StatusBadge from '@/components/leads/StatusBadge';
import { getLeadStatusLabel } from '@/lib/leads/status';
import { htmlToPlainText } from '@/lib/email/html';
import { sanitizeEmailHtml } from '@/lib/email/sanitize-html';
import type { SentEmail } from '@/types/database.types';

type SentEmailModalProps = {
  email: SentEmail | null;
  sending: boolean;
  onClose: () => void;
  onCopyEmail: (email: SentEmail) => void;
  onCopyFollowUpPrompt: (email: SentEmail) => void;
  onUseAsFollowUp: (email: SentEmail) => void;
  onResend: (email: SentEmail) => void;
};

export default function SentEmailModal({
  email,
  sending,
  onClose,
  onCopyEmail,
  onCopyFollowUpPrompt,
  onUseAsFollowUp,
  onResend,
}: SentEmailModalProps) {
  if (!email) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm sm:p-6">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-auto rounded-3xl border border-[var(--border)] bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-start justify-between gap-4 border-b border-[var(--border)] pb-4">
          <div>
            <h3 className="text-lg font-semibold text-zinc-950">{email.subject}</h3>
            <p className="mt-1 text-sm text-zinc-500">{email.sender_email} to {email.recipient_email}</p>
          </div>
          <button onClick={onClose} className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] text-zinc-500 transition hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mb-4 flex flex-wrap gap-2">
          <StatusBadge status={email.status} />
          <span className="rounded-full bg-violet-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-violet-700 ring-1 ring-violet-100">
            {getLeadStatusLabel(email.email_type)}
          </span>
          <span className="rounded-full bg-teal-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-teal-700 ring-1 ring-teal-100">
            {email.provider}
          </span>
        </div>
        <div className="mb-4 flex flex-wrap gap-2">
          <button onClick={() => onCopyEmail(email)} className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-xs font-semibold text-zinc-700 transition hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700">
            <Copy className="h-3.5 w-3.5" /> Copy Email
          </button>
          <button onClick={() => onCopyFollowUpPrompt(email)} className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-xs font-semibold text-zinc-700 transition hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700">
            <Copy className="h-3.5 w-3.5" /> Copy Follow-up Prompt
          </button>
          <button onClick={() => onUseAsFollowUp(email)} className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-xs font-semibold text-zinc-700 transition hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700">
            <Edit3 className="h-3.5 w-3.5" /> Use as Follow-up Context
          </button>
          <button onClick={() => onResend(email)} disabled={sending} className="inline-flex items-center gap-2 rounded-xl border border-teal-200 bg-teal-50 px-3 py-2 text-xs font-semibold text-teal-700 transition hover:bg-teal-100 disabled:opacity-50">
            <Send className="h-3.5 w-3.5" /> Resend
          </button>
        </div>
        {email.body_html ? (
          <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface-muted)] p-5 text-sm text-zinc-900">
            <div dangerouslySetInnerHTML={{ __html: sanitizeEmailHtml(email.body_html) }} />
          </div>
        ) : (
          <pre className="whitespace-pre-wrap rounded-3xl border border-[var(--border)] bg-[var(--surface-muted)] p-5 text-sm leading-6 text-zinc-900">
            {email.body_text || htmlToPlainText(email.body_html || '') || 'No body available.'}
          </pre>
        )}
      </div>
    </div>
  );
}
