'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import AppShell from '@/components/reachmira/AppShell';
import PageHeader from '@/components/reachmira/PageHeader';
import EmptyState from '@/components/reachmira/EmptyState';
import { Banner, useConfirm } from '@/components/reachmira/ui';
import { ShieldAlert, MailPlus, Trash2, Plus } from 'lucide-react';

type SuppressionRow = {
  id?: string;
  email: string;
  reason?: string | null;
  domain?: string | null;
  source?: string | null;
  created_at?: string;
};

export default function SuppressionListPage() {
  const { confirm, confirmDialog } = useConfirm();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<SuppressionRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [email, setEmail] = useState('');
  const [domain, setDomain] = useState('');
  const [reason, setReason] = useState('manual');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 12;

  const loadData = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/suppressions');
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to load suppression list');
      setItems((data.suppressions || []) as SuppressionRow[]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load suppression list');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void (async () => {
      await loadData();
    })();
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const response = await fetch('/api/suppressions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, domain, reason, source: domain ? 'domain' : 'manual' }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to add suppression');
      setEmail('');
      setDomain('');
      setReason('manual');
      await loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to add suppression');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id?: string) => {
    if (!id) return;
    if (!(await confirm({
      title: 'Remove suppression entry?',
      description: 'This address or domain will become contactable again in future sends.',
      confirmLabel: 'Remove Entry',
    }))) return;
    try {
      const response = await fetch(`/api/suppressions/${id}`, { method: 'DELETE' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to remove suppression');
      await loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to remove suppression');
    }
  };

  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedItems = items.slice((safeCurrentPage - 1) * pageSize, safeCurrentPage * pageSize);

  return (
    <AppShell>
      <PageHeader
        eyebrow="Safety"
        title="Suppression List"
        subtitle="Keep bounced, unsubscribed, and do-not-contact records out of future sends."
      />

      {error && <Banner tone="error" className="mb-6" onDismiss={() => setError(null)}>{error}</Banner>}

      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        <form onSubmit={handleAdd} className="rounded-3xl border border-[var(--border)] bg-white p-6 shadow-[0_12px_40px_rgba(15,23,42,0.04)]">
          <div className="flex items-center gap-2 text-sm font-semibold text-zinc-900">
            <Plus className="h-4 w-4 text-violet-600" />
            Add suppression
          </div>

          <div className="mt-5 space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Email</label>
              <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="bad@domain.com" className="mt-1 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 text-sm outline-none focus:border-violet-300 focus:bg-white" />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Domain</label>
              <input value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="example.com" className="mt-1 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 text-sm outline-none focus:border-violet-300 focus:bg-white" />
              <p className="mt-2 text-xs leading-5 text-zinc-500">Use a domain to suppress all addresses at that domain.</p>
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Reason</label>
              <select value={reason} onChange={(e) => setReason(e.target.value)} className="mt-1 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 text-sm outline-none focus:border-violet-300 focus:bg-white">
                <option value="manual">Manual</option>
                <option value="unsubscribe">Unsubscribe</option>
                <option value="bounce">Bounce</option>
                <option value="complaint">Complaint</option>
                <option value="do_not_contact">Do Not Contact</option>
              </select>
            </div>
          </div>

          <button disabled={saving || (!email.trim() && !domain.trim())} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-zinc-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:opacity-50">
            <MailPlus className="h-4 w-4" />
            {saving ? 'Adding...' : 'Add suppression'}
          </button>
        </form>

        <div className="space-y-4">
          {loading ? (
            <div className="flex h-64 items-center justify-center rounded-3xl border border-[var(--border)] bg-white">
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
                    <th className="px-5 py-4">Email / Domain</th>
                    <th className="px-5 py-4">Reason</th>
                    <th className="px-5 py-4">Source</th>
                    <th className="px-5 py-4">Added</th>
                    <th className="px-5 py-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {paginatedItems.map((item) => (
                    <tr key={`${item.id || item.email}-${item.created_at || ''}`} className="hover:bg-violet-50/40">
                      <td className="px-5 py-4 font-medium text-zinc-950">{item.domain ? `@${item.domain}` : item.email}</td>
                      <td className="px-5 py-4 text-zinc-600">{item.reason || 'Suppressed'}</td>
                      <td className="px-5 py-4 text-zinc-600">{item.source || 'manual'}</td>
                      <td className="px-5 py-4 text-zinc-600">{item.created_at ? new Date(item.created_at).toLocaleString() : '-'}</td>
                      <td className="px-5 py-4 text-right">
                        <button onClick={() => handleDelete(item.id)} className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm font-semibold text-zinc-700 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700">
                          <Trash2 className="h-4 w-4" />
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {items.length > pageSize && (
                <div className="flex flex-col gap-3 border-t border-[var(--border)] px-5 py-4 text-xs text-zinc-500 sm:flex-row sm:items-center sm:justify-between">
                  <span>
                    Showing {(safeCurrentPage - 1) * pageSize + 1}-{Math.min(safeCurrentPage * pageSize, items.length)} of {items.length} suppressions
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
        </div>
      </div>
      {confirmDialog}
    </AppShell>
  );
}
