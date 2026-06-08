'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import Link from 'next/link';
import { ArrowLeft, Save, Sparkles } from 'lucide-react';

export default function NewLeadPage() {
  const [lists, setLists] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [leadListId, setLeadListId] = useState('');
  const [form, setForm] = useState({
    email: '',
    first_name: '',
    last_name: '',
    company_name: '',
    website: '',
    industry: '',
    city: '',
    country: '',
    decision_maker_name: '',
    decision_maker_title: '',
    priority: 'normal',
    tags: '',
    notes: '',
    follow_up_note: '',
    lead_owner: '',
    pipeline_stage: 'New',
  });

  useEffect(() => {
    const load = async () => {
      const response = await fetch('/api/lead-lists');
      const data = await response.json();
      if (!response.ok) {
        setLists([]);
        setLeadListId('');
        return;
      }
      setLists(data.leadLists || []);
      setLeadListId(data.leadLists?.[0]?.id || '');
    };
    load();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lead_list_id: leadListId || null,
          ...form,
          raw_data: { source: 'manual_add' },
          status: 'new',
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to create lead');
      setSuccess('Lead saved.');
      setForm({
        email: '',
        first_name: '',
        last_name: '',
        company_name: '',
        website: '',
        industry: '',
        city: '',
        country: '',
        decision_maker_name: '',
        decision_maker_title: '',
        priority: 'normal',
        tags: '',
        notes: '',
        follow_up_note: '',
        lead_owner: '',
        pipeline_stage: 'New',
      });
    } catch (err: any) {
      setError(err.message || 'Failed to create lead');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-zinc-950 text-zinc-100">
      <Sidebar />
      <main className="flex-1 p-8 overflow-y-auto max-w-5xl">
        <div className="flex items-center gap-3 mb-8">
          <Link href="/leads" className="p-2 rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-400">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h2 className="text-3xl font-extrabold text-white tracking-tight">Add Lead</h2>
            <p className="text-sm text-zinc-400 mt-1">Create a new global lead manually.</p>
          </div>
        </div>

        {error && <div className="mb-6 rounded-lg border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-400">{error}</div>}
        {success && <div className="mb-6 rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs text-emerald-400">{success}</div>}

        <form onSubmit={handleSave} className="space-y-6 rounded-xl border border-zinc-800 bg-zinc-900/20 p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-zinc-400 font-semibold uppercase">Lead List</label>
              <select value={leadListId} onChange={(e) => setLeadListId(e.target.value)} className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm">
                <option value="">No List</option>
                {lists.map((list) => <option key={list.id} value={list.id}>{list.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-zinc-400 font-semibold uppercase">Email</label>
              <input required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm" />
            </div>
            <div><label className="block text-xs text-zinc-400 font-semibold uppercase">First Name</label><input value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm" /></div>
            <div><label className="block text-xs text-zinc-400 font-semibold uppercase">Last Name</label><input value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm" /></div>
            <div><label className="block text-xs text-zinc-400 font-semibold uppercase">Company</label><input value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm" /></div>
            <div><label className="block text-xs text-zinc-400 font-semibold uppercase">Website</label><input value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm" /></div>
            <div><label className="block text-xs text-zinc-400 font-semibold uppercase">Decision Maker Name</label><input value={form.decision_maker_name} onChange={(e) => setForm({ ...form, decision_maker_name: e.target.value })} className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm" /></div>
            <div><label className="block text-xs text-zinc-400 font-semibold uppercase">Title</label><input value={form.decision_maker_title} onChange={(e) => setForm({ ...form, decision_maker_title: e.target.value })} className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm" /></div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div><label className="block text-xs text-zinc-400 font-semibold uppercase">Industry</label><input value={form.industry} onChange={(e) => setForm({ ...form, industry: e.target.value })} className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm" /></div>
            <div><label className="block text-xs text-zinc-400 font-semibold uppercase">City</label><input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm" /></div>
            <div><label className="block text-xs text-zinc-400 font-semibold uppercase">Country</label><input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm" /></div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div><label className="block text-xs text-zinc-400 font-semibold uppercase">Priority</label><select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"><option value="normal">Normal</option><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></div>
            <div><label className="block text-xs text-zinc-400 font-semibold uppercase">Lead Owner</label><input value={form.lead_owner} onChange={(e) => setForm({ ...form, lead_owner: e.target.value })} className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm" /></div>
            <div><label className="block text-xs text-zinc-400 font-semibold uppercase">Pipeline Stage</label><input value={form.pipeline_stage} onChange={(e) => setForm({ ...form, pipeline_stage: e.target.value })} className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm" /></div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><label className="block text-xs text-zinc-400 font-semibold uppercase">Tags</label><input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm" /></div>
            <div><label className="block text-xs text-zinc-400 font-semibold uppercase">Follow-up Note</label><input value={form.follow_up_note} onChange={(e) => setForm({ ...form, follow_up_note: e.target.value })} className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm" /></div>
          </div>

          <div>
            <label className="block text-xs text-zinc-400 font-semibold uppercase">Notes</label>
            <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={4} className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm" />
          </div>

          <button disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-violet-600 to-blue-600 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
            {saving ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> : <><Save className="h-4 w-4" /> Save Lead</>}
          </button>

          <div className="text-xs text-zinc-500 flex items-center gap-1.5">
            <Sparkles className="h-4 w-4 text-violet-400" />
            After saving, you can generate AI, edit a manual email, approve it, or send it from the lead detail page.
          </div>
        </form>
      </main>
    </div>
  );
}
