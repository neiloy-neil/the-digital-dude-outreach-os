'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import AppShell from '@/components/reachmira/AppShell';
import PageHeader from '@/components/reachmira/PageHeader';
import Link from 'next/link';
import { ArrowLeft, Save, Sparkles } from 'lucide-react';

type LeadListOption = {
  id: string;
  name: string;
};

type LeadListsResponse = {
  leadLists?: LeadListOption[];
  error?: string;
};

type CreateLeadResponse = {
  error?: string;
};

export default function NewLeadPage() {
  const [lists, setLists] = useState<LeadListOption[]>([]);
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
      const data = (await response.json()) as LeadListsResponse;
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
      const data = (await response.json()) as CreateLeadResponse;
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
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create lead');
    } finally {
      setSaving(false);
    }
  };

  const inputClass = 'mt-1 w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-violet-500';
  const labelClass = 'block text-xs font-semibold uppercase text-zinc-500';

  return (
    <AppShell showSearch={false}>
      <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
        <PageHeader
          eyebrow="Lead library"
          title="Add Lead"
          subtitle="Create a new global lead manually, then personalize and send from the lead workspace."
          actions={
            <Link href="/leads" className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-white px-4 py-2.5 text-sm font-semibold text-zinc-700 transition hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700">
              <ArrowLeft className="h-4 w-4" />
              Back to Leads
            </Link>
          }
        />

        {error && <div className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}
        {success && <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{success}</div>}

        <form onSubmit={handleSave} className="space-y-6 rounded-3xl border border-[var(--border)] bg-white p-6 shadow-[0_12px_40px_rgba(15,23,42,0.04)]">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Lead List</label>
              <select value={leadListId} onChange={(e) => setLeadListId(e.target.value)} className={inputClass}>
                <option value="">No List</option>
                {lists.map((list) => <option key={list.id} value={list.id}>{list.name}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Email</label>
              <input required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={inputClass} />
            </div>
            <div><label className={labelClass}>First Name</label><input value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} className={inputClass} /></div>
            <div><label className={labelClass}>Last Name</label><input value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} className={inputClass} /></div>
            <div><label className={labelClass}>Company</label><input value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} className={inputClass} /></div>
            <div><label className={labelClass}>Website</label><input value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} className={inputClass} /></div>
            <div><label className={labelClass}>Decision Maker Name</label><input value={form.decision_maker_name} onChange={(e) => setForm({ ...form, decision_maker_name: e.target.value })} className={inputClass} /></div>
            <div><label className={labelClass}>Title</label><input value={form.decision_maker_title} onChange={(e) => setForm({ ...form, decision_maker_title: e.target.value })} className={inputClass} /></div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div><label className={labelClass}>Industry</label><input value={form.industry} onChange={(e) => setForm({ ...form, industry: e.target.value })} className={inputClass} /></div>
            <div><label className={labelClass}>City</label><input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} className={inputClass} /></div>
            <div><label className={labelClass}>Country</label><input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} className={inputClass} /></div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div><label className={labelClass}>Priority</label><select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} className={inputClass}><option value="normal">Normal</option><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></div>
            <div><label className={labelClass}>Lead Owner</label><input value={form.lead_owner} onChange={(e) => setForm({ ...form, lead_owner: e.target.value })} className={inputClass} /></div>
            <div><label className={labelClass}>Pipeline Stage</label><input value={form.pipeline_stage} onChange={(e) => setForm({ ...form, pipeline_stage: e.target.value })} className={inputClass} /></div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><label className={labelClass}>Tags</label><input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} className={inputClass} /></div>
            <div><label className={labelClass}>Follow-up Note</label><input value={form.follow_up_note} onChange={(e) => setForm({ ...form, follow_up_note: e.target.value })} className={inputClass} /></div>
          </div>

          <div>
            <label className={labelClass}>Notes</label>
            <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={4} className={inputClass} />
          </div>

          <button disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-teal-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-600/20 transition hover:opacity-95 disabled:opacity-50">
            {saving ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> : <><Save className="h-4 w-4" /> Save Lead</>}
          </button>

          <div className="flex items-center gap-1.5 text-xs text-zinc-500">
            <Sparkles className="h-4 w-4 text-violet-500" />
            After saving, you can generate AI, edit a manual email, approve it, or send it from the lead detail page.
          </div>
        </form>
      </main>
    </AppShell>
  );
}
