'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useMemo, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import Link from 'next/link';
import { Plus, FolderOpen, Trash2, ArrowRight, Sparkles } from 'lucide-react';

export default function LeadListsPage() {
  const [loading, setLoading] = useState(true);
  const [lists, setLists] = useState<any[]>([]);
  const [leadCounts, setLeadCounts] = useState<Record<string, number>>({});
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [source, setSource] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const loadData = async () => {
    try {
      const response = await fetch('/api/lead-lists');
      const data = await response.json();
      if (!response.ok) {
        setLists([]);
        setLeadCounts({});
        setError(data.error || 'Failed to load lead lists');
        return;
      }

      setLists(data.leadLists || []);
      setLeadCounts({});
    } catch (err: any) {
      setError(err.message || 'Failed to load lead lists');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
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
    } catch (err: any) {
      setError(err.message || 'Failed to create lead list');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this lead list? Leads will stay in the library.')) return;
    try {
      const response = await fetch(`/api/lead-lists/${id}`, { method: 'DELETE' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to delete lead list');
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to delete lead list');
    }
  };

  return (
    <div className="flex min-h-screen bg-zinc-950 text-zinc-100">
      <Sidebar />
      <main className="flex-1 p-8 overflow-y-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-3xl font-extrabold text-white tracking-tight">Lead Lists</h2>
            <p className="text-sm text-zinc-400 mt-1">Organize global leads into reusable lists before campaigns.</p>
          </div>
          <Link href="/leads/import" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-violet-600 to-blue-600 text-white text-sm font-semibold">
            <Sparkles className="h-4 w-4" /> Import Leads
          </Link>
        </div>

        {error && (
          <div className="mb-6 rounded-lg bg-rose-500/10 p-3 text-xs text-rose-400 border border-rose-500/20">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          <form onSubmit={handleCreate} className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6 space-y-4">
            <div className="flex items-center gap-2 text-white font-semibold">
              <Plus className="h-5 w-5 text-violet-400" /> Create Lead List
            </div>
            <div>
              <label className="block text-xs text-zinc-400 font-semibold uppercase">Name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950 py-2 px-3 text-sm" placeholder="UK Real Estate Leads" />
            </div>
            <div>
              <label className="block text-xs text-zinc-400 font-semibold uppercase">Description</label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950 py-2 px-3 text-sm" placeholder="Leads from LinkedIn manual research" />
            </div>
            <div>
              <label className="block text-xs text-zinc-400 font-semibold uppercase">Source</label>
              <input value={source} onChange={(e) => setSource(e.target.value)} className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950 py-2 px-3 text-sm" placeholder="CSV / Google Sheets / Manual" />
            </div>
            <button disabled={saving || !name.trim()} className="w-full rounded-lg bg-gradient-to-r from-violet-600 to-blue-600 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
              {saving ? 'Creating...' : 'Create Lead List'}
            </button>
          </form>

          <div className="lg:col-span-2 space-y-4">
            {loading ? (
              <div className="flex h-48 items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-violet-500 border-t-transparent" />
              </div>
            ) : lists.length === 0 ? (
              <div className="rounded-xl border border-dashed border-zinc-800 p-10 text-center text-zinc-500">
                <FolderOpen className="mx-auto mb-3 h-10 w-10 text-zinc-700" />
                No lead lists yet. Create one to start organizing your library.
              </div>
            ) : (
              lists.map((list) => (
                <div key={list.id} className="rounded-xl border border-zinc-800 bg-zinc-900/20 p-5 flex items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-white text-lg">{list.name}</h3>
                      <span className="rounded-full border border-violet-500/20 bg-violet-500/10 px-2 py-0.5 text-[10px] font-semibold text-violet-400">
                        {leadCounts[list.id] || 0} leads
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-zinc-400">{list.description || 'No description provided.'}</p>
                    <p className="mt-1 text-[11px] text-zinc-500">Source: {list.source || 'Manual'}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Link href={`/lead-lists/${list.id}`} className="inline-flex items-center gap-1 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm font-semibold text-zinc-200">
                      Open <ArrowRight className="h-4 w-4" />
                    </Link>
                    <button onClick={() => handleDelete(list.id)} className="rounded-lg border border-zinc-800 p-2 text-zinc-500 hover:text-rose-400">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
            <div className="text-xs text-zinc-500">Total leads across lists: {totalLeads}</div>
          </div>
        </div>
      </main>
    </div>
  );
}
