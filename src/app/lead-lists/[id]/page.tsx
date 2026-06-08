'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useMemo, useState, use } from 'react';
import Sidebar from '@/components/Sidebar';
import { createClient } from '@/utils/supabase/client';
import Link from 'next/link';
import { ArrowLeft, Plus, Search, Send, ExternalLink } from 'lucide-react';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function LeadListDetailPage({ params }: PageProps) {
  const { id } = use(params);
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [list, setList] = useState<any>(null);
  const [leads, setLeads] = useState<any[]>([]);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [campaignId, setCampaignId] = useState('');
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      const [{ data: listData }, { data: leadData }, { data: campaignData }] = await Promise.all([
        fetch(`/api/lead-lists/${id}`).then(async (res) => (await res.json()) as { leadList?: any; error?: string }),
        fetch(`/api/leads?leadListId=${id}`).then(async (res) => (await res.json()) as { leads?: any[]; error?: string }),
        supabase.from('campaigns').select('id, name').order('created_at', { ascending: false }),
      ]);
      setList(listData?.leadList || null);
      setLeads(Array.isArray(leadData?.leads) ? leadData.leads : []);
      setCampaigns(campaignData || []);
      setCampaignId(campaignData?.[0]?.id || '');
    } catch (err: any) {
      setError(err.message || 'Failed to load lead list');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [id]);

  const filteredLeads = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return leads;
    return leads.filter((lead) =>
      [lead.email, lead.company_name, lead.company, lead.decision_maker_name, lead.website, lead.tags]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(q)
    );
  }, [search, leads]);

  const toggleSelected = (leadId: string) => {
    setSelected((prev) => (prev.includes(leadId) ? prev.filter((id) => id !== leadId) : [...prev, leadId]));
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
    <div className="flex min-h-screen bg-zinc-950 text-zinc-100">
      <Sidebar />
      <main className="flex-1 p-8 overflow-y-auto">
        <div className="flex items-center gap-3 mb-8">
          <Link href="/lead-lists" className="p-2 rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-400">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h2 className="text-3xl font-extrabold text-white tracking-tight">{list?.name || 'Lead List'}</h2>
            <p className="text-sm text-zinc-400 mt-1">{list?.description || 'Global lead library list'}</p>
          </div>
        </div>

        {error && <div className="mb-6 rounded-lg border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-400">{error}</div>}

        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-violet-500 border-t-transparent" />
          </div>
        ) : (
          <div className="space-y-6">
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/20 p-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div className="flex items-center gap-3">
                <div>
                  <div className="text-xs uppercase text-zinc-500">Leads</div>
                  <div className="text-2xl font-bold text-white">{leads.length}</div>
                </div>
                <div>
                  <div className="text-xs uppercase text-zinc-500">Source</div>
                  <div className="text-sm text-zinc-300">{list?.source || 'Manual'}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Link href={`/leads/import?listId=${id}`} className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-violet-600 to-blue-600 px-4 py-2 text-sm font-semibold text-white">
                  <Plus className="h-4 w-4" /> Import Leads
                </Link>
                <Link href="/leads/new" className="inline-flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-2 text-sm font-semibold text-zinc-200">
                  Add Manual Lead
                </Link>
              </div>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-zinc-900/20 p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="flex items-center gap-2 w-full md:max-w-md rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2">
                <Search className="h-4 w-4 text-zinc-500" />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search leads..." className="w-full bg-transparent text-sm text-zinc-100 outline-none" />
              </div>
              <div className="flex items-center gap-2">
                <select value={campaignId} onChange={(e) => setCampaignId(e.target.value)} className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm">
                  {campaigns.map((campaign) => (
                    <option key={campaign.id} value={campaign.id}>{campaign.name}</option>
                  ))}
                </select>
                <button disabled={!campaignId || selected.length === 0} onClick={handleAddSelectedToCampaign} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
                  <Send className="h-4 w-4" /> Add Selected
                </button>
              </div>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-zinc-900/20 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-zinc-800 bg-zinc-900/40 text-xs uppercase text-zinc-500">
                    <tr>
                      <th className="px-4 py-3 w-10"> </th>
                      <th className="px-4 py-3">Name</th>
                      <th className="px-4 py-3">Company</th>
                      <th className="px-4 py-3">Email</th>
                      <th className="px-4 py-3">Readiness</th>
                      <th className="px-4 py-3 text-right">Open</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {filteredLeads.map((lead) => (
                      <tr key={lead.id} className={selected.includes(lead.id) ? 'bg-zinc-900/30' : ''}>
                        <td className="px-4 py-3">
                          <input type="checkbox" checked={selected.includes(lead.id)} onChange={() => toggleSelected(lead.id)} />
                        </td>
                        <td className="px-4 py-3 text-white">{lead.decision_maker_name || `${lead.first_name || ''} ${lead.last_name || ''}`.trim() || 'Prospect'}</td>
                        <td className="px-4 py-3 text-zinc-300">{lead.company_name || lead.company || '-'}</td>
                        <td className="px-4 py-3 text-zinc-400">{lead.email}</td>
                        <td className="px-4 py-3 text-xs text-violet-400">{lead.data_quality_label || 'poor'}</td>
                        <td className="px-4 py-3 text-right">
                          <Link href={`/leads/${lead.id}`} className="inline-flex items-center gap-1 text-violet-400 hover:text-violet-300 text-sm font-semibold">
                            View <ExternalLink className="h-4 w-4" />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
