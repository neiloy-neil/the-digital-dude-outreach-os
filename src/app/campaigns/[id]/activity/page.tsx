'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState, use } from 'react';
import type { ComponentType } from 'react';
import AppShell from '@/components/reachmira/AppShell';
import PageHeader from '@/components/reachmira/PageHeader';
import { createClient } from '@/utils/supabase/client';
import Link from 'next/link';
import { ArrowLeft, Activity, CheckCircle2, Mail, Pause, Play, Ban, Bot, Inbox, Undo2, ChevronDown } from 'lucide-react';

interface PageProps {
  params: Promise<{ id: string }>;
}

const iconMap: Record<string, ComponentType<{ className?: string }>> = {
  campaign_started: Play,
  campaign_paused: Pause,
  campaign_completed: CheckCircle2,
  email_sent: Mail,
  email_approved: CheckCircle2,
  ai_generated: Bot,
  reply_received: Undo2,
  lead_unsubscribed: Ban,
  email_bounced: Inbox,
  lead_imported: Activity,
};

export default function CampaignActivityPage({ params }: PageProps) {
  const resolved = use(params);
  const campaignId = resolved.id;
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [campaign, setCampaign] = useState<any>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 12;

  useEffect(() => {
    const load = async () => {
      try {
        const { data: camp } = await supabase
          .from('campaigns')
          .select('*')
          .eq('id', campaignId)
          .single();
        setCampaign(camp);

        const { data } = await supabase
          .from('audit_logs')
          .select('*, leads(email, first_name, last_name, company)')
          .eq('campaign_id', campaignId)
          .order('created_at', { ascending: false })
          .limit(100);
        setLogs(data || []);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [campaignId]);

  const totalPages = Math.max(1, Math.ceil(logs.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedLogs = logs.slice((safeCurrentPage - 1) * pageSize, safeCurrentPage * pageSize);

  return (
    <AppShell showSearch={false}>
      <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <PageHeader
          eyebrow="Campaign activity"
          title="Campaign Activity"
          subtitle={campaign ? campaign.name : 'Loading campaign...'}
          actions={
            <Link href={`/campaigns/${campaignId}`} className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-white px-4 py-2.5 text-sm font-semibold text-zinc-700 transition hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700">
              <ArrowLeft className="h-4 w-4" />
              Back to Campaign
            </Link>
          }
        />

        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-violet-500 border-t-transparent" />
          </div>
        ) : (
          <div className="overflow-hidden rounded-3xl border border-[var(--border)] bg-white shadow-[0_12px_40px_rgba(15,23,42,0.04)]">
            <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
              <div>
                <h3 className="font-bold text-zinc-950">Audit Timeline</h3>
                <p className="text-xs text-zinc-500">Latest audit entries for this campaign.</p>
              </div>
              <span className="text-xs text-zinc-500">{logs.length} events</span>
            </div>

            <div className="divide-y divide-[var(--border)]">
              {logs.length === 0 ? (
                <div className="p-8 text-center text-sm text-zinc-500">No audit logs yet.</div>
              ) : (
                paginatedLogs.map((log) => {
                  const Icon = iconMap[log.action] || Activity;
                  const lead = log.leads as any;
                  return (
                    <div key={log.id} className="p-5 transition-colors hover:bg-violet-50/50">
                      <div className="flex items-start gap-4">
                        <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-xl border border-violet-100 bg-violet-50 text-violet-700">
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-semibold text-zinc-950">{log.action}</span>
                            <span className="rounded-full border border-[var(--border)] bg-[var(--surface-muted)] px-2 py-0.5 text-[10px] uppercase tracking-wider text-zinc-500">
                              {new Date(log.created_at).toLocaleString()}
                            </span>
                          </div>
                          <p className="mt-1 text-sm text-zinc-700">{log.message || 'No message'}</p>
                          <p className="mt-2 text-xs text-zinc-500">
                            {lead ? `${lead.first_name || ''} ${lead.last_name || ''}`.trim() || lead.company || lead.email : 'No lead context'}
                          </p>

                          {log.metadata && Object.keys(log.metadata).length > 0 && (
                            <details className="mt-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] p-3">
                              <summary className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-zinc-700">
                                Metadata <ChevronDown className="h-3.5 w-3.5" />
                              </summary>
                              <pre className="mt-3 overflow-x-auto whitespace-pre-wrap text-[11px] text-zinc-600">
                                {JSON.stringify(log.metadata, null, 2)}
                              </pre>
                            </details>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            {logs.length > pageSize && (
              <div className="flex flex-col gap-3 border-t border-[var(--border)] px-5 py-4 text-xs text-zinc-500 sm:flex-row sm:items-center sm:justify-between">
                <span>
                  Showing {(safeCurrentPage - 1) * pageSize + 1}-{Math.min(safeCurrentPage * pageSize, logs.length)} of {logs.length} events
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                    disabled={safeCurrentPage <= 1}
                    className="rounded-lg border border-[var(--border)] bg-white px-3 py-1.5 font-semibold text-zinc-700 transition hover:bg-violet-50 disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <span className="font-semibold text-zinc-700">Page {safeCurrentPage} / {totalPages}</span>
                  <button
                    onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                    disabled={safeCurrentPage >= totalPages}
                    className="rounded-lg border border-[var(--border)] bg-white px-3 py-1.5 font-semibold text-zinc-700 transition hover:bg-violet-50 disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </AppShell>
  );
}
