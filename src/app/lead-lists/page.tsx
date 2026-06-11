'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { FolderOpen, Plus, ArrowRight, Sparkles, Trash2 } from 'lucide-react';
import AppShell from '@/components/reachmira/AppShell';
import PageHeader from '@/components/reachmira/PageHeader';
import EmptyState from '@/components/reachmira/EmptyState';
import Spinner from '@/components/reachmira/Spinner';
import { Banner, useConfirm } from '@/components/reachmira/ui';

type LeadListRow = {
  id: string;
  name: string;
  description?: string | null;
  source?: string | null;
  created_at?: string;
};

export default function LeadListsPage() {
  const { confirm, confirmDialog } = useConfirm();
  const [loading, setLoading] = useState(true);
  const [lists, setLists] = useState<LeadListRow[]>([]);
  const [leadCounts, setLeadCounts] = useState<Record<string, number>>({});
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [source, setSource] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/lead-lists');
      const data = await response.json();
      if (!response.ok) {
        setLists([]);
        setLeadCounts({});
        throw new Error(data.error || 'Failed to load lead lists');
      }

      setLists((data.leadLists || []) as LeadListRow[]);
      setLeadCounts((data.leadCounts || {}) as Record<string, number>);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load lead lists');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void (async () => {
      await loadData();
    })();
  }, []);

  const totalLeads = useMemo(
    () => Object.values(leadCounts).reduce((sum, count) => sum + count, 0),
    [leadCounts]
  );

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const response = await fetch('/api/lead-lists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description, source }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to create lead list');
      setName('');
      setDescription('');
      setSource('');
      await loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create lead list');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!(await confirm({
      title: 'Delete lead list?',
      description: 'The list will be removed. Leads will stay in the library.',
      confirmLabel: 'Delete List',
    }))) return;
    try {
      const response = await fetch(`/api/lead-lists/${id}`, { method: 'DELETE' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to delete lead list');
      await loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete lead list');
    }
  };

  return (
    <AppShell>
      <PageHeader
        eyebrow="Lead lists"
        title="Lead Lists"
        subtitle="Organize global leads into reusable lists before campaigns."
        actions={
          <Link href="/leads/import" className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-700">
            <Sparkles className="h-4 w-4" />
            Import Leads
          </Link>
        }
      />

      {error && <Banner tone="error" className="mb-6" onDismiss={() => setError(null)}>{error}</Banner>}

      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <form onSubmit={handleCreate} className="rounded-3xl border border-[var(--border)] bg-white p-6 shadow-[0_12px_40px_rgba(15,23,42,0.04)]">
          <div className="flex items-center gap-2 text-sm font-semibold text-zinc-900">
            <Plus className="h-4 w-4 text-violet-600" />
            Create lead list
          </div>
          <p className="mt-2 text-sm leading-6 text-zinc-500">Group imported or manually added leads for easier campaign targeting.</p>

          <div className="mt-5 space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 text-sm text-zinc-900 outline-none focus:border-violet-300 focus:bg-white" placeholder="UK Real Estate Leads" />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Description</label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} className="mt-1 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 text-sm text-zinc-900 outline-none focus:border-violet-300 focus:bg-white" placeholder="Leads from LinkedIn manual research" />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Source</label>
              <input value={source} onChange={(e) => setSource(e.target.value)} className="mt-1 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 text-sm text-zinc-900 outline-none focus:border-violet-300 focus:bg-white" placeholder="CSV / Google Sheets / Manual" />
            </div>
          </div>

          <button disabled={saving || !name.trim()} className="mt-5 inline-flex w-full items-center justify-center rounded-2xl bg-zinc-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:opacity-50">
            {saving ? 'Creating...' : 'Create Lead List'}
          </button>

          <div className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 text-xs text-zinc-500">
            Total leads across all lists: <span className="font-semibold text-zinc-900">{totalLeads}</span>
          </div>
        </form>

        <div className="space-y-4">
          {loading ? (
            <div className="flex h-64 items-center justify-center rounded-3xl border border-[var(--border)] bg-white text-violet-500">
              <Spinner size={32} />
            </div>
          ) : lists.length === 0 ? (
            <EmptyState
              icon={FolderOpen}
              title="No lead lists yet"
              description="Create a list to organize imported leads, then open it to add more leads or move them into campaigns."
              actionLabel="Import Leads"
              actionHref="/leads/import"
              actionIcon={Sparkles}
            />
          ) : (
            <div className="grid gap-4">
              {lists.map((list) => (
                <div key={list.id} className="rounded-3xl border border-[var(--border)] bg-white p-5 shadow-[0_12px_40px_rgba(15,23,42,0.04)]">
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-semibold text-zinc-950">{list.name}</h3>
                        <span className="rounded-full bg-violet-50 px-2.5 py-1 text-[11px] font-semibold text-violet-700">
                          {leadCounts[list.id] || 0} leads
                        </span>
                      </div>
                      <p className="mt-2 text-sm leading-6 text-zinc-500">{list.description || 'No description provided.'}</p>
                      <p className="mt-1 text-xs text-zinc-400">Source: {list.source || 'Manual'}</p>
                    </div>

                    <div className="flex items-center gap-2">
                      <Link href={`/lead-lists/${list.id}`} className="inline-flex items-center gap-1 rounded-xl border border-[var(--border)] bg-white px-4 py-2.5 text-sm font-semibold text-zinc-700 hover:bg-violet-50 hover:text-violet-700">
                        Open <ArrowRight className="h-4 w-4" />
                      </Link>
                      <button onClick={() => handleDelete(list.id)} aria-label={`Delete list ${list.name}`} className="inline-flex cursor-pointer items-center justify-center rounded-xl border border-[var(--border)] bg-white p-2.5 text-zinc-500 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      {confirmDialog}
    </AppShell>
  );
}
