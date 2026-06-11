'use client';

export const dynamic = 'force-dynamic';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Plus, Search, Send, ExternalLink, Users } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import AppShell from '@/components/reachmira/AppShell';
import PageHeader from '@/components/reachmira/PageHeader';
import EmptyState from '@/components/reachmira/EmptyState';
import Spinner from '@/components/reachmira/Spinner';

type LeadListRow = {
  id: string;
  name: string;
  description?: string | null;
  source?: string | null;
};

type LeadRow = {
  id: string;
  decision_maker_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  company_name?: string | null;
  company?: string | null;
  email: string;
  data_quality_label?: string | null;
};

type CampaignRow = {
  id: string;
  name: string;
};

export default function LeadListDetailPage() {
  const params = useParams();
  const id = String(params.id || '');
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [list, setList] = useState<LeadListRow | null>(null);
  const [leadCount, setLeadCount] = useState(0);
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [campaignId, setCampaignId] = useState('');
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [listResponse, leadResponse, campaignResponse] = await Promise.all([
        fetch(`/api/lead-lists/${id}`).then(async (res) => (await res.json()) as { leadList?: LeadListRow; leadCount?: number; error?: string }),
        fetch(`/api/leads?leadListId=${id}`).then(async (res) => (await res.json()) as { leads?: LeadRow[]; error?: string }),
        supabase.from('campaigns').select('id,name').order('created_at', { ascending: false }),
      ]);

      setList(listResponse.leadList || null);
      setLeadCount(listResponse.leadCount || 0);
      setLeads(Array.isArray(leadResponse.leads) ? leadResponse.leads : []);
      setCampaigns((campaignResponse.data || []) as CampaignRow[]);
      setCampaignId(campaignResponse.data?.[0]?.id || '');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load lead list');
    } finally {
      setLoading(false);
    }
  }, [id, supabase]);

  useEffect(() => {
    if (!id) return;
    void (async () => {
      await loadData();
    })();
  }, [id, loadData]);

  const filteredLeads = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return leads;
    return leads.filter((lead) =>
      [lead.email, lead.company_name, lead.company, lead.decision_maker_name]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(q)
    );
  }, [search, leads]);

  const toggleSelected = (leadId: string) => {
    setSelected((prev) => (prev.includes(leadId) ? prev.filter((item) => item !== leadId) : [...prev, leadId]));
  };

  const handleAddSelectedToCampaign = async () => {
    if (!campaignId || selected.length === 0) return;
    const response = await fetch('/api/lead-campaigns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ campaignId, leadIds: selected }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Failed to add leads');
    setSelected([]);
    await loadData();
  };

  return (
    <AppShell>
      <PageHeader
        eyebrow="Lead list"
        title={list?.name || 'Lead List'}
        subtitle={list?.description || 'Global lead library list'}
        actions={
          <>
            <Link href="/lead-lists" className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-white px-4 py-2.5 text-sm font-semibold text-zinc-700 hover:bg-zinc-50">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Link>
            <Link href={`/leads/import?listId=${id}`} className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-700">
              <Plus className="h-4 w-4" />
              Import Leads
            </Link>
            <Link href="/leads/new" className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-white px-4 py-2.5 text-sm font-semibold text-zinc-700 hover:bg-violet-50 hover:text-violet-700">
              Add Manual Lead
            </Link>
          </>
        }
      />

      {error && <div className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}

      {loading ? (
        <div className="flex h-64 items-center justify-center rounded-3xl border border-[var(--border)] bg-white">
          <Spinner size={32} className="text-violet-500" />
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-3xl border border-[var(--border)] bg-white p-5 shadow-[0_12px_40px_rgba(15,23,42,0.04)]">
              <div className="text-xs uppercase tracking-[0.22em] text-zinc-400">Leads</div>
              <div className="mt-2 text-3xl font-semibold text-zinc-950">{leadCount}</div>
            </div>
            <div className="rounded-3xl border border-[var(--border)] bg-white p-5 shadow-[0_12px_40px_rgba(15,23,42,0.04)]">
              <div className="text-xs uppercase tracking-[0.22em] text-zinc-400">Source</div>
              <div className="mt-2 text-sm text-zinc-600">{list?.source || 'Manual'}</div>
            </div>
            <div className="rounded-3xl border border-[var(--border)] bg-white p-5 shadow-[0_12px_40px_rgba(15,23,42,0.04)]">
              <div className="text-xs uppercase tracking-[0.22em] text-zinc-400">Campaigns</div>
              <div className="mt-2 text-sm text-zinc-600">{campaigns.length} available</div>
            </div>
          </div>

          <div className="rounded-3xl border border-[var(--border)] bg-white p-5 shadow-[0_12px_40px_rgba(15,23,42,0.04)]">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3">
                <Search className="h-4 w-4 text-zinc-400" />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search leads..." className="w-full bg-transparent text-sm outline-none placeholder:text-zinc-400" />
              </div>

              <div className="flex items-center gap-2">
                <select value={campaignId} onChange={(e) => setCampaignId(e.target.value)} className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 text-sm text-zinc-700">
                  {campaigns.map((campaign) => (
                    <option key={campaign.id} value={campaign.id}>{campaign.name}</option>
                  ))}
                </select>
                <button disabled={!campaignId || selected.length === 0} onClick={handleAddSelectedToCampaign} className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">
                  <Send className="h-4 w-4" />
                  Add Selected
                </button>
              </div>
            </div>
          </div>

          {filteredLeads.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No leads in this list yet"
              description="Import leads into this list or add a manual lead to start building outreach."
              actionLabel="Import Leads"
              actionHref={`/leads/import?listId=${id}`}
              actionIcon={Plus}
            />
          ) : (
            <div className="overflow-hidden rounded-3xl border border-[var(--border)] bg-white shadow-[0_12px_40px_rgba(15,23,42,0.04)]">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-[var(--border)] bg-[var(--surface-muted)] text-xs uppercase tracking-[0.18em] text-zinc-400">
                    <tr>
                      <th className="w-10 px-4 py-4" />
                      <th className="px-4 py-4">Name</th>
                      <th className="px-4 py-4">Company</th>
                      <th className="px-4 py-4">Email</th>
                      <th className="px-4 py-4">Readiness</th>
                      <th className="px-4 py-4 text-right">Open</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {filteredLeads.map((lead) => (
                      <tr key={lead.id} className={selected.includes(lead.id) ? 'bg-violet-50/50' : 'hover:bg-violet-50/30'}>
                        <td className="px-4 py-4">
                          <input type="checkbox" checked={selected.includes(lead.id)} onChange={() => toggleSelected(lead.id)} className="h-4 w-4 rounded border-zinc-300 text-violet-600 focus:ring-violet-500" />
                        </td>
                        <td className="px-4 py-4">
                          <Link
                            href={`/leads/${lead.id}`}
                            className="font-semibold text-violet-700 transition hover:text-violet-800 hover:underline"
                            title="Open lead profile"
                          >
                            {lead.decision_maker_name || `${lead.first_name || ''} ${lead.last_name || ''}`.trim() || 'Prospect'}
                          </Link>
                        </td>
                        <td className="px-4 py-4 text-zinc-600">{lead.company_name || lead.company || '-'}</td>
                        <td className="px-4 py-4 text-zinc-600">{lead.email}</td>
                        <td className="px-4 py-4 text-violet-700">{lead.data_quality_label || 'poor'}</td>
                        <td className="px-4 py-4 text-right">
                          <Link href={`/leads/${lead.id}`} className="inline-flex items-center gap-1 font-semibold text-violet-700 hover:text-violet-800">
                            View <ExternalLink className="h-4 w-4" />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </AppShell>
  );
}
