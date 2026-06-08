'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import AppShell from '@/components/reachmira/AppShell';
import PageHeader from '@/components/reachmira/PageHeader';
import EmptyState from '@/components/reachmira/EmptyState';
import { ShieldAlert, MailPlus } from 'lucide-react';

type SuppressionRow = {
  id?: string;
  email: string;
  reason?: string | null;
  created_at?: string;
};

export default function SuppressionListPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<SuppressionRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const { data, error: loadError } = await supabase
          .from('suppressions')
          .select('id,email,reason,created_at')
          .order('created_at', { ascending: false })
          .limit(100);

        if (loadError) throw loadError;
        setItems((data || []) as SuppressionRow[]);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load suppression list');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [supabase]);

  return (
    <AppShell>
      <PageHeader
        eyebrow="Safety"
        title="Suppression List"
        subtitle="Keep bounced, unsubscribed, and do-not-contact records out of future sends."
      />

      {error && <div className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-violet-500 border-t-transparent" />
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={ShieldAlert}
          title="No suppression records yet"
          description="Bounces, unsubscribes, and complaints will appear here automatically."
          actionLabel="View Leads"
          actionHref="/leads"
          actionIcon={MailPlus}
        />
      ) : (
        <div className="overflow-hidden rounded-3xl border border-[var(--border)] bg-white shadow-[0_12px_40px_rgba(15,23,42,0.04)]">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[var(--border)] bg-[var(--surface-muted)] text-xs uppercase tracking-[0.18em] text-zinc-400">
              <tr>
                <th className="px-5 py-4">Email</th>
                <th className="px-5 py-4">Reason</th>
                <th className="px-5 py-4">Added</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {items.map((item) => (
                <tr key={`${item.email}-${item.created_at}`} className="hover:bg-violet-50/40">
                  <td className="px-5 py-4 font-medium text-zinc-950">{item.email}</td>
                  <td className="px-5 py-4 text-zinc-600">{item.reason || 'Suppressed'}</td>
                  <td className="px-5 py-4 text-zinc-600">{item.created_at ? new Date(item.created_at).toLocaleString() : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AppShell>
  );
}
