'use client';

export const dynamic = 'force-dynamic';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import StatusBadge from '@/components/leads/StatusBadge';
import { createClient } from '@/utils/supabase/client';
import Link from 'next/link';
import { Plus, Search } from 'lucide-react';

type LeadRow = {
  id: string;
  email: string;
  first_name?: string | null;
  last_name?: string | null;
  decision_maker_name?: string | null;
  company_name?: string | null;
  company?: string | null;
  lead_list_id?: string | null;
  lead_lists?: { name?: string | null } | null;
  status?: string | null;
  priority?: string | null;
  data_quality_label?: string | null;
  last_email_sent_at?: string | null;
  sent_emails?: Array<{ email_type?: string | null }>;
};

type CampaignOption = {
  id: string;
  name: string;
};

type LeadListOption = {
  id: string;
  name: string;
};

export default function LeadsPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignOption[]>([]);
  const [leadLists, setLeadLists] = useState<LeadListOption[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [qualityFilter, setQualityFilter] = useState('all');
  const [leadListFilter, setLeadListFilter] = useState('all');
  const [emailTypeFilter, setEmailTypeFilter] = useState('all');
  const [repliedFilter, setRepliedFilter] = useState('all');
  const [followUpStageFilter, setFollowUpStageFilter] = useState('all');
  const [contactGuardFilter, setContactGuardFilter] = useState('all');
  const [campaignId, setCampaignId] = useState('');
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (priorityFilter !== 'all') params.set('priority', priorityFilter);
      if (leadListFilter !== 'all') params.set('leadListId', leadListFilter);
      if (emailTypeFilter !== 'all') params.set('lastEmailType', emailTypeFilter);
      if (repliedFilter !== 'all') params.set('replied', repliedFilter);
      if (followUpStageFilter !== 'all') params.set('followUpStage', followUpStageFilter);
      if (contactGuardFilter === 'do_not_contact') params.set('doNotContact', 'yes');
      if (contactGuardFilter === 'bounced') params.set('bounced', 'yes');
      if (contactGuardFilter === 'unsubscribed') params.set('unsubscribed', 'yes');

      const [campaignResponse, leadsResponse, leadListsResponse] = await Promise.all([
        supabase.from('campaigns').select('id, name').order('created_at', { ascending: false }),
        fetch(`/api/leads?${params.toString()}`).then(async (res) => ({ ok: res.ok, data: await res.json() })),
        fetch('/api/lead-lists').then(async (res) => ({ ok: res.ok, data: await res.json() })),
      ]);

      setLeads(Array.isArray(leadsResponse.data?.leads) ? leadsResponse.data.leads : []);
      setCampaigns(campaignResponse.data || []);
      setLeadLists(Array.isArray(leadListsResponse.data?.leadLists) ? leadListsResponse.data.leadLists : []);
      setCampaignId(campaignResponse.data?.[0]?.id || '');
    } catch (loadError: unknown) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load leads');
    } finally {
      setLoading(false);
    }
  }, [contactGuardFilter, emailTypeFilter, leadListFilter, priorityFilter, repliedFilter, search, statusFilter, supabase, followUpStageFilter]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadData();
  }, [loadData]);

  const filteredLeads = useMemo(() => {
    if (qualityFilter === 'all') return leads;
    return leads.filter((lead) => lead.data_quality_label === qualityFilter);
  }, [leads, qualityFilter]);

  const toggleSelected = (leadId: string) => {
    setSelected((prev) => (prev.includes(leadId) ? prev.filter((id) => id !== leadId) : [...prev, leadId]));
  };

  const runBulkAction = async (action: string) => {
    setError(null);
    const response = await fetch('/api/leads/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, leadIds: selected, campaignId }),
    });
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error || 'Bulk update failed');
      return;
    }
    setSelected([]);
    await loadData();
  };

  return (
    <div className="flex min-h-screen bg-zinc-950 text-zinc-100">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-extrabold tracking-tight text-white">Lead Library</h2>
            <p className="mt-1 text-sm text-zinc-400">Filter by status, outreach stage, and email history before you open a lead.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/lead-lists" className="rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-2 text-sm font-semibold text-zinc-200">Lead Lists</Link>
            <Link href="/leads/new" className="inline-flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-2 text-sm font-semibold text-zinc-200">
              <Plus className="h-4 w-4" /> Add Manual Lead
            </Link>
            <Link href="/leads/import" className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-violet-600 to-blue-600 px-4 py-2 text-sm font-semibold text-white">
              <Plus className="h-4 w-4" /> Import Leads
            </Link>
          </div>
        </div>

        {error && <div className="mb-6 rounded-lg border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-400">{error}</div>}

        <div className="rounded-xl border border-zinc-800 bg-zinc-900/20 p-4 space-y-4">
          <div className="grid gap-3 xl:grid-cols-4">
            <div className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2">
              <Search className="h-4 w-4 text-zinc-500" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search leads..." className="w-full bg-transparent text-sm outline-none" />
            </div>
            <select value={leadListFilter} onChange={(e) => setLeadListFilter(e.target.value)} className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm">
              <option value="all">All Lead Lists</option>
              {leadLists.map((list) => <option key={list.id} value={list.id}>{list.name}</option>)}
            </select>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm">
              <option value="all">All Statuses</option>
              {['new', 'imported', 'data_reviewed', 'ai_generated', 'manual_email_draft', 'email_approved', 'mail_sent', 'manual_email_sent', 'follow_up_1_sent', 'follow_up_2_sent', 'follow_up_3_sent', 'replied', 'interested', 'not_interested', 'demo_scheduled', 'proposal_sent', 'won', 'lost', 'bounced', 'unsubscribed', 'do_not_contact', 'excluded'].map((status) => <option key={status} value={status}>{status.replace(/_/g, ' ')}</option>)}
            </select>
            <button onClick={loadData} className="rounded-lg bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-950">Apply Filters</button>
          </div>

          <div className="grid gap-3 xl:grid-cols-5">
            <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)} className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm">
              <option value="all">All Priorities</option>
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
            <select value={qualityFilter} onChange={(e) => setQualityFilter(e.target.value)} className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm">
              <option value="all">All Data Quality</option>
              <option value="poor">Poor</option>
              <option value="fair">Fair</option>
              <option value="good">Good</option>
              <option value="excellent">Excellent</option>
            </select>
            <select value={emailTypeFilter} onChange={(e) => setEmailTypeFilter(e.target.value)} className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm">
              <option value="all">Any Last Email Type</option>
              <option value="first_email">First Email</option>
              <option value="follow_up_1">Follow-up 1</option>
              <option value="follow_up_2">Follow-up 2</option>
              <option value="follow_up_3">Follow-up 3</option>
              <option value="custom_email">Custom Email</option>
              <option value="proposal_email">Proposal</option>
            </select>
            <select value={repliedFilter} onChange={(e) => setRepliedFilter(e.target.value)} className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm">
              <option value="all">Reply State</option>
              <option value="yes">Replied</option>
              <option value="no">Not Replied</option>
            </select>
            <select value={followUpStageFilter} onChange={(e) => setFollowUpStageFilter(e.target.value)} className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm">
              <option value="all">Follow-up Stage</option>
              <option value="0">None</option>
              <option value="1">Stage 1</option>
              <option value="2">Stage 2</option>
              <option value="3">Stage 3</option>
            </select>
          </div>

          <div className="grid gap-3 xl:grid-cols-3">
            <select value={contactGuardFilter} onChange={(e) => setContactGuardFilter(e.target.value)} className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm">
              <option value="all">Contact Safety</option>
              <option value="do_not_contact">Do Not Contact</option>
              <option value="bounced">Bounced</option>
              <option value="unsubscribed">Unsubscribed</option>
            </select>
            <select value={campaignId} onChange={(e) => setCampaignId(e.target.value)} className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm">
              {campaigns.map((campaign) => <option key={campaign.id} value={campaign.id}>{campaign.name}</option>)}
            </select>
            <div className="text-xs text-zinc-500 self-center">{filteredLeads.length} visible leads</div>
          </div>

          {selected.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 border-t border-zinc-800 pt-4">
              <span className="text-xs font-semibold text-zinc-400">{selected.length} selected</span>
              <button onClick={() => runBulkAction('mark_interested')} className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-400">Mark Interested</button>
              <button onClick={() => runBulkAction('mark_not_interested')} className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-300">Mark Not Interested</button>
              <button onClick={() => runBulkAction('mark_do_not_contact')} className="rounded-lg border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-300">Mark Do Not Contact</button>
              <button onClick={() => runBulkAction('mark_excluded')} className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs font-semibold text-zinc-300">Mark Excluded</button>
              <button onClick={() => runBulkAction('add_to_campaign')} className="rounded-lg border border-violet-500/20 bg-violet-500/10 px-3 py-2 text-xs font-semibold text-violet-300">Add to Campaign</button>
            </div>
          )}
        </div>

        <div className="mt-6 rounded-xl border border-zinc-800 bg-zinc-900/20 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-zinc-800 bg-zinc-900/40 text-xs uppercase text-zinc-500">
                <tr>
                  <th className="px-4 py-3 w-10" />
                  <th className="px-4 py-3">Lead</th>
                  <th className="px-4 py-3">Company</th>
                  <th className="px-4 py-3">List</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Last Email Type</th>
                  <th className="px-4 py-3">Last Contacted</th>
                  <th className="px-4 py-3">Open</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {loading ? (
                  <tr><td colSpan={8} className="py-10 text-center text-zinc-500">Loading leads...</td></tr>
                ) : filteredLeads.length === 0 ? (
                  <tr><td colSpan={8} className="py-10 text-center text-zinc-500">No leads match your filters.</td></tr>
                ) : filteredLeads.map((lead) => (
                  <tr key={lead.id}>
                    <td className="px-4 py-3"><input type="checkbox" checked={selected.includes(lead.id)} onChange={() => toggleSelected(lead.id)} /></td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-white">{lead.decision_maker_name || `${lead.first_name || ''} ${lead.last_name || ''}`.trim() || 'Prospect'}</div>
                      <div className="text-xs text-zinc-500">{lead.email}</div>
                    </td>
                    <td className="px-4 py-3 text-zinc-300">{lead.company_name || lead.company || '-'}</td>
                    <td className="px-4 py-3 text-zinc-400">{lead.lead_lists?.name || '-'}</td>
                    <td className="px-4 py-3"><StatusBadge status={lead.status} /></td>
                    <td className="px-4 py-3 text-zinc-300">{lead.sent_emails?.[0]?.email_type?.replace(/_/g, ' ') || '-'}</td>
                    <td className="px-4 py-3 text-zinc-300">{lead.last_email_sent_at ? new Date(lead.last_email_sent_at).toLocaleDateString() : '-'}</td>
                    <td className="px-4 py-3">
                      <Link href={`/leads/${lead.id}`} className="font-semibold text-violet-400 hover:text-violet-300">Open</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
