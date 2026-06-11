'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import AppShell from '@/components/reachmira/AppShell';
import PageHeader from '@/components/reachmira/PageHeader';
import EmptyState from '@/components/reachmira/EmptyState';
import { Activity, ArrowUpRight } from 'lucide-react';
import Spinner from '@/components/reachmira/Spinner';

type AuditRow = {
  id: string;
  action: string;
  message?: string | null;
  created_at: string;
  lead_id?: string | null;
  campaign_id?: string | null;
};

export default function ActivityPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<AuditRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 12;

  useEffect(() => {
    const load = async () => {
      try {
        const { data, error: loadError } = await supabase
          .from('audit_logs')
          .select('id,action,message,created_at,lead_id,campaign_id')
          .order('created_at', { ascending: false })
          .limit(100);

        if (loadError) throw loadError;
        setLogs((data || []) as AuditRow[]);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load activity');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [supabase]);

  const totalPages = Math.max(1, Math.ceil(logs.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedLogs = logs.slice((safeCurrentPage - 1) * pageSize, safeCurrentPage * pageSize);

  return (
    <AppShell>
      <PageHeader
        eyebrow="Activity"
        title="Activity"
        subtitle="A single timeline for imports, AI generation, sends, replies, and suppression events."
      />

      {error && <div className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Spinner size={32} className="text-violet-500" />
        </div>
      ) : logs.length === 0 ? (
        <EmptyState
          icon={Activity}
          title="No activity yet"
          description="Once you import leads or send emails, the audit trail will appear here."
          actionLabel="Import Leads"
          actionHref="/leads/import"
          actionIcon={ArrowUpRight}
        />
      ) : (
        <div className="space-y-3">
          {paginatedLogs.map((log) => (
            <div key={log.id} className="rounded-3xl border border-[var(--border)] bg-white p-5 shadow-[0_12px_40px_rgba(15,23,42,0.04)]">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-violet-50 px-2.5 py-1 text-[11px] font-semibold text-violet-700">{log.action}</span>
                <span className="text-xs text-zinc-500">{new Date(log.created_at).toLocaleString()}</span>
              </div>
              <p className="mt-2 text-sm text-zinc-600">{log.message || 'No details provided.'}</p>
            </div>
          ))}
          {logs.length > pageSize && (
            <div className="flex flex-col gap-3 rounded-3xl border border-[var(--border)] bg-white px-5 py-4 text-xs text-zinc-500 shadow-[0_12px_40px_rgba(15,23,42,0.04)] sm:flex-row sm:items-center sm:justify-between">
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
    </AppShell>
  );
}
