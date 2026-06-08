'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import AppShell from '@/components/reachmira/AppShell';
import PageHeader from '@/components/reachmira/PageHeader';
import EmptyState from '@/components/reachmira/EmptyState';
import StatusBadge from '@/components/leads/StatusBadge';
import Link from 'next/link';
import { MailPlus, Send, Sparkles, Clock3 } from 'lucide-react';
import { getLeadStatusLabel } from '@/lib/leads/status';

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

export default function ManualEmailsPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [drafts, setDrafts] = useState<DraftRow[]>([]);
  const [sentEmails, setSentEmails] = useState<SentEmailRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const [{ data: draftData, error: draftError }, { data: sentData, error: sentError }] = await Promise.all([
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
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load manual emails');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [supabase]);

  const tabs = useMemo(
    () => [
      { label: 'Drafts', count: drafts.length, href: '#drafts' },
      { label: 'Approved', count: drafts.filter((item) => item.manual_personalization_status === 'approved').length, href: '#drafts' },
      { label: 'Sent', count: sentEmails.length, href: '#sent' },
      { label: 'Follow-up Due', count: drafts.filter((item) => item.status?.includes('follow_up')).length, href: '#sent' },
    ],
    [drafts, sentEmails]
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
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-violet-500 border-t-transparent" />
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
                {drafts.map((draft) => (
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
                {sentEmails.map((email) => (
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
              </div>
            )}
          </section>
        </div>
      )}
    </AppShell>
  );
}
