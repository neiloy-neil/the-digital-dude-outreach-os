'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import AppShell from '@/components/reachmira/AppShell';
import PageHeader from '@/components/reachmira/PageHeader';
import EmptyState from '@/components/reachmira/EmptyState';
import { Activity, ArrowUpRight } from 'lucide-react';

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
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-violet-500 border-t-transparent" />
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
          {logs.map((log) => (
            <div key={log.id} className="rounded-3xl border border-[var(--border)] bg-white p-5 shadow-[0_12px_40px_rgba(15,23,42,0.04)]">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-violet-50 px-2.5 py-1 text-[11px] font-semibold text-violet-700">{log.action}</span>
                <span className="text-xs text-zinc-500">{new Date(log.created_at).toLocaleString()}</span>
              </div>
              <p className="mt-2 text-sm text-zinc-600">{log.message || 'No details provided.'}</p>
            </div>
          ))}
        </div>
      )}
    </AppShell>
  );
}
