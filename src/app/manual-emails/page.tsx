'use client';

export const dynamic = 'force-dynamic';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import AppShell from '@/components/reachmira/AppShell';
import PageHeader from '@/components/reachmira/PageHeader';
import EmptyState from '@/components/reachmira/EmptyState';
import StatusBadge from '@/components/leads/StatusBadge';
import RichTextEditor from '@/components/leads/RichTextEditor';
import { Button, Field, Input, Modal, Select, useConfirm } from '@/components/reachmira/ui';
import Link from 'next/link';
import { MailPlus, PenSquare, Send, Sparkles, Clock3 } from 'lucide-react';
import { getLeadStatusLabel } from '@/lib/leads/status';
import Spinner from '@/components/reachmira/Spinner';
import { useToast } from '@/lib/toast/toast-context';
import type { EmailAccount } from '@/types/database.types';

type DraftRow = {
  id: string;
  email?: string | null;
  company_name?: string | null;
  company?: string | null;
  decision_maker_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  manual_email_subject?: string | null;
  manual_personalization_status?: string | null;
  updated_at: string;
  status?: string | null;
};

type SentEmailRow = {
  id: string;
  subject?: string | null;
  recipient_email?: string | null;
  sender_email?: string | null;
  sent_at: string;
  status?: string | null;
  email_type?: string | null;
  metadata?: Record<string, unknown> | null;
};

const EMPTY_COMPOSE_FORM = { to: '', subject: '', body: '', emailAccountId: '', includeSignature: true };

export default function ManualEmailsPage() {
  const supabase = createClient();
  const toast = useToast();
  const { confirm, confirmDialog } = useConfirm();
  const [loading, setLoading] = useState(true);
  const [drafts, setDrafts] = useState<DraftRow[]>([]);
  const [sentEmails, setSentEmails] = useState<SentEmailRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [draftPage, setDraftPage] = useState(1);
  const [sentPage, setSentPage] = useState(1);
  const pageSize = 8;

  const [emailAccounts, setEmailAccounts] = useState<EmailAccount[]>([]);
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeForm, setComposeForm] = useState(EMPTY_COMPOSE_FORM);
  const [composeSending, setComposeSending] = useState(false);

  const load = useCallback(async () => {
    try {
      const [{ data: draftData, error: draftError }, { data: sentData, error: sentError }, accountsResponse] = await Promise.all([
        supabase
          .from('leads')
          .select('id,email,company_name,company,decision_maker_name,first_name,last_name,manual_email_subject,manual_personalization_status,updated_at,status')
          .not('manual_email_body', 'is', null)
          .order('updated_at', { ascending: false })
          .limit(50),
        supabase
          .from('sent_emails')
          .select('*')
          .order('sent_at', { ascending: false })
          .limit(50),
        fetch('/api/email-accounts'),
      ]);

      if (draftError) throw draftError;
      if (sentError) throw sentError;
      setDrafts((draftData || []) as DraftRow[]);
      setSentEmails(
        (sentData || []).map((row: Record<string, unknown>) => {
          const metadata = (row.metadata && typeof row.metadata === 'object' ? row.metadata : {}) as Record<string, unknown>;
          return {
            ...row,
            subject: String(row.subject || ''),
            recipient_email: String(row.recipient_email || metadata.recipient_email || metadata.to || '') || null,
            sender_email: String(row.sender_email || metadata.sender_email || '') || null,
            status: String(row.status || 'sent'),
            email_type: String(row.email_type || metadata.email_type || 'custom_email'),
            metadata,
          } as SentEmailRow;
        })
      );

      const accountsPayload = (await accountsResponse.json()) as EmailAccount[] | { error?: string };
      if (accountsResponse.ok && Array.isArray(accountsPayload)) {
        const activeAccounts = accountsPayload.filter((account) => account.status === 'active');
        setEmailAccounts(activeAccounts);
        setComposeForm((current) => (current.emailAccountId ? current : { ...current, emailAccountId: activeAccounts[0]?.id || '' }));
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load manual emails');
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const handleCompose = async () => {
    const recipient = composeForm.to.trim();
    if (!recipient || !composeForm.subject.trim() || !composeForm.body.trim() || composeForm.body === '<p><br></p>') {
      toast.error('Recipient, subject, and body are all required.');
      return;
    }

    const confirmed = await confirm({
      title: 'Send this email?',
      description: `Send this email to ${recipient}?`,
      confirmLabel: 'Send Now',
    });
    if (!confirmed) return;

    setComposeSending(true);
    try {
      const sendRequest = async (confirmVerificationRisk = false) =>
        fetch('/api/manual-emails/compose', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: recipient,
            subject: composeForm.subject,
            body: composeForm.body,
            emailAccountId: composeForm.emailAccountId || null,
            includeSignature: composeForm.includeSignature,
            confirmVerificationRisk,
          }),
        });

      let response = await sendRequest(false);
      let payload = (await response.json()) as {
        error?: string;
        requiresConfirmation?: boolean;
        warning?: { message?: string };
      };

      if (response.status === 409 && payload.requiresConfirmation) {
        const confirmedRisk = await confirm({
          title: 'Send despite warning?',
          description: payload.warning?.message || payload.error || 'This email has a verification warning. Send anyway?',
          confirmLabel: 'Send Anyway',
          tone: 'danger',
        });
        if (!confirmedRisk) {
          toast.info('Send canceled.');
          return;
        }

        response = await sendRequest(true);
        payload = (await response.json()) as { error?: string; requiresConfirmation?: boolean; warning?: { message?: string } };
      }

      if (!response.ok) throw new Error(payload.error || 'Failed to send email');
      toast.success('Email sent successfully.');
      setComposeOpen(false);
      setComposeForm((current) => ({ ...EMPTY_COMPOSE_FORM, emailAccountId: current.emailAccountId }));
      await load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to send email');
    } finally {
      setComposeSending(false);
    }
  };

  const tabs = useMemo(
    () => [
      { label: 'Drafts', count: drafts.length, href: '#drafts' },
      { label: 'Approved', count: drafts.filter((item) => item.manual_personalization_status === 'approved').length, href: '#drafts' },
      { label: 'Sent', count: sentEmails.length, href: '#sent' },
      { label: 'Follow-up Due', count: drafts.filter((item) => item.status?.includes('follow_up')).length, href: '#sent' },
    ],
    [drafts, sentEmails]
  );
  const draftTotalPages = Math.max(1, Math.ceil(drafts.length / pageSize));
  const safeDraftPage = Math.min(draftPage, draftTotalPages);
  const paginatedDrafts = drafts.slice((safeDraftPage - 1) * pageSize, safeDraftPage * pageSize);
  const sentTotalPages = Math.max(1, Math.ceil(sentEmails.length / pageSize));
  const safeSentPage = Math.min(sentPage, sentTotalPages);
  const paginatedSentEmails = sentEmails.slice((safeSentPage - 1) * pageSize, safeSentPage * pageSize);

  const renderPagination = (currentPage: number, totalPages: number, totalItems: number, onPageChange: (page: number) => void) => (
    <div className="mt-4 flex flex-col gap-3 border-t border-[var(--border)] pt-4 text-xs text-zinc-500 sm:flex-row sm:items-center sm:justify-between">
      <span>
        Showing {totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1}-{Math.min(currentPage * pageSize, totalItems)} of {totalItems}
      </span>
      <div className="flex items-center gap-2">
        <button onClick={() => onPageChange(Math.max(1, currentPage - 1))} disabled={currentPage <= 1} className="rounded-lg border border-[var(--border)] bg-white px-3 py-1.5 font-semibold text-zinc-700 hover:bg-violet-50 disabled:opacity-50">
          Previous
        </button>
        <span className="font-semibold text-zinc-700">Page {currentPage} / {totalPages}</span>
        <button onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))} disabled={currentPage >= totalPages} className="rounded-lg border border-[var(--border)] bg-white px-3 py-1.5 font-semibold text-zinc-700 hover:bg-violet-50 disabled:opacity-50">
          Next
        </button>
      </div>
    </div>
  );

  return (
    <AppShell>
      <PageHeader
        eyebrow="Manual emails"
        title="Manual Emails"
        subtitle="Manage drafts, approvals, and sent messages in one place."
        actions={
          <>
            <Link href="/leads" className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-white px-4 py-2.5 text-sm font-semibold text-zinc-700 hover:bg-violet-50 hover:text-violet-700">
              <MailPlus className="h-4 w-4" />
              View Leads
            </Link>
            <Button variant="primary" onClick={() => setComposeOpen(true)}>
              <PenSquare className="h-4 w-4" />
              Compose
            </Button>
            <Link href="/leads/import" className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-700">
              <Sparkles className="h-4 w-4" />
              Import Leads
            </Link>
          </>
        }
      />

      {error && <div className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}

      <div className="mb-6 grid gap-3 md:grid-cols-4">
        {tabs.map((tab) => (
          <a key={tab.label} href={tab.href} className="rounded-2xl border border-[var(--border)] bg-white p-4 shadow-[0_12px_40px_rgba(15,23,42,0.04)]">
            <div className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">{tab.label}</div>
            <div className="mt-2 text-2xl font-semibold text-zinc-950">{tab.count}</div>
          </a>
        ))}
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Spinner size={32} className="text-violet-500" />
        </div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-2">
          <section id="drafts" className="rounded-3xl border border-[var(--border)] bg-white p-6 shadow-[0_12px_40px_rgba(15,23,42,0.04)]">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-zinc-950">Drafts</h2>
                <p className="text-sm text-zinc-500">Manual drafts and email-ready leads.</p>
              </div>
              <Clock3 className="h-5 w-5 text-violet-600" />
            </div>
            {drafts.length === 0 ? (
              <EmptyState
                icon={MailPlus}
                title="No manual drafts yet"
                description="Open a lead and start writing a personalized email."
                actionLabel="View Leads"
                actionHref="/leads"
                actionIcon={MailPlus}
              />
            ) : (
              <div className="space-y-3">
                {paginatedDrafts.map((draft) => (
                  <div key={draft.id} className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)]/60 p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="font-semibold text-zinc-950">{draft.manual_email_subject || 'Untitled draft'}</div>
                        <div className="mt-1 text-sm text-zinc-500">
                          {draft.decision_maker_name || `${draft.first_name || ''} ${draft.last_name || ''}`.trim() || 'Prospect'} · {draft.company_name || draft.company || '-'}
                        </div>
                      </div>
                      <StatusBadge status={draft.status} />
                    </div>
                    <div className="mt-3 flex items-center justify-between text-sm text-zinc-500">
                      <span>{getLeadStatusLabel(draft.manual_personalization_status)}</span>
                      <Link href={`/leads/${draft.id}`} className="font-semibold text-violet-700">Open lead</Link>
                    </div>
                  </div>
                ))}
                {drafts.length > pageSize && renderPagination(safeDraftPage, draftTotalPages, drafts.length, setDraftPage)}
              </div>
            )}
          </section>

          <section id="sent" className="rounded-3xl border border-[var(--border)] bg-white p-6 shadow-[0_12px_40px_rgba(15,23,42,0.04)]">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-zinc-950">Sent</h2>
                <p className="text-sm text-zinc-500">Latest sent messages and follow-ups.</p>
              </div>
              <Send className="h-5 w-5 text-teal-600" />
            </div>
            {sentEmails.length === 0 ? (
              <EmptyState
                icon={Send}
                title="No sent emails yet"
                description="Send a manual email from a lead to see it appear here."
                actionLabel="Open Leads"
                actionHref="/leads"
                actionIcon={Sparkles}
              />
            ) : (
              <div className="space-y-3">
                {paginatedSentEmails.map((email) => (
                  <div key={email.id} className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)]/60 p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="font-semibold text-zinc-950">{email.subject || '(No subject)'}</div>
                        <div className="mt-1 text-sm text-zinc-500">
                          {email.sender_email || 'Unknown sender'} → {email.recipient_email || 'Unknown recipient'}
                        </div>
                      </div>
                      <StatusBadge status={email.status || 'sent'} />
                    </div>
                    <div className="mt-3 text-sm text-zinc-500">
                      {getLeadStatusLabel(email.email_type || 'custom_email')} · {new Date(email.sent_at).toLocaleString()}
                    </div>
                  </div>
                ))}
                {sentEmails.length > pageSize && renderPagination(safeSentPage, sentTotalPages, sentEmails.length, setSentPage)}
              </div>
            )}
          </section>
        </div>
      )}

      <Modal open={composeOpen} onClose={() => setComposeOpen(false)} title="Compose Email" maxWidth="2xl">
        <div className="space-y-4">
          <Field label="To">
            <Input
              type="email"
              placeholder="prospect@company.com"
              value={composeForm.to}
              onChange={(e) => setComposeForm((current) => ({ ...current, to: e.target.value }))}
            />
          </Field>

          <Field label="Send From" hint={emailAccounts.length === 0 ? 'No connected email accounts found.' : undefined}>
            <Select
              value={composeForm.emailAccountId}
              onChange={(e) => setComposeForm((current) => ({ ...current, emailAccountId: e.target.value }))}
            >
              {emailAccounts.length === 0 && <option value="">No accounts connected</option>}
              {emailAccounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.sender_name || account.email_address}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Subject">
            <Input
              placeholder="Quick question about..."
              value={composeForm.subject}
              onChange={(e) => setComposeForm((current) => ({ ...current, subject: e.target.value }))}
            />
          </Field>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500">Body</label>
            <div className="mt-1 rounded-xl border border-[var(--border)] bg-white">
              <RichTextEditor
                value={composeForm.body}
                onChange={(value) => setComposeForm((current) => ({ ...current, body: value }))}
                placeholder="Write your message..."
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-zinc-600">
            <input
              type="checkbox"
              checked={composeForm.includeSignature}
              onChange={(e) => setComposeForm((current) => ({ ...current, includeSignature: e.target.checked }))}
              className="rounded border-[var(--border)]"
            />
            Include email signature
          </label>

          <div className="flex items-center justify-end gap-3 border-t border-[var(--border)] pt-4">
            <Button variant="secondary" onClick={() => setComposeOpen(false)} disabled={composeSending}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleCompose} loading={composeSending} disabled={emailAccounts.length === 0}>
              <Send className="h-4 w-4" />
              Send Now
            </Button>
          </div>
        </div>
      </Modal>

      {confirmDialog}
    </AppShell>
  );
}
