'use client';

export const dynamic = 'force-dynamic';

import { useCallback, useEffect, useMemo, useState } from 'react';
import StatusBadge from '@/components/leads/StatusBadge';
import { createClient } from '@/utils/supabase/client';
import Link from 'next/link';
import { Search, ArrowUpRight, Sparkles, Filter, MailPlus } from 'lucide-react';
import AppShell from '@/components/reachmira/AppShell';
import PageHeader from '@/components/reachmira/PageHeader';
import EmptyState from '@/components/reachmira/EmptyState';
import QualityScoreBadge from '@/components/reachmira/QualityScoreBadge';

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
    <AppShell>
      <PageHeader
        eyebrow="Lead library"
        title="Lead Library"
        subtitle="Organize, personalize, and contact every lead from one workspace."
        actions={
          <>
            <Link href="/lead-lists" className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-white px-4 py-2.5 text-sm font-semibold text-zinc-700 hover:bg-zinc-50">
              <ArrowUpRight className="h-4 w-4" />
              Lead Lists
            </Link>
            <Link href="/leads/new" className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-white px-4 py-2.5 text-sm font-semibold text-zinc-700 hover:bg-violet-50 hover:text-violet-700">
              <MailPlus className="h-4 w-4" />
              Add Manual Lead
            </Link>
            <Link href="/leads/import" className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-700">
              <Sparkles className="h-4 w-4" />
              Import Leads
            </Link>
          </>
        }
      />

      {error && <div className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}

      <section className="rounded-3xl border border-[var(--border)] bg-white p-5 shadow-[0_12px_40px_rgba(15,23,42,0.04)]">
        <div className="grid gap-3 xl:grid-cols-4">
          <div className="flex items-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3">
            <Search className="h-4 w-4 text-zinc-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search leads..." className="w-full bg-transparent text-sm outline-none placeholder:text-zinc-400" />
          </div>
          <select value={leadListFilter} onChange={(e) => setLeadListFilter(e.target.value)} className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 text-sm text-zinc-700">
            <option value="all">All Lead Lists</option>
            {leadLists.map((list) => <option key={list.id} value={list.id}>{list.name}</option>)}
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 text-sm text-zinc-700">
            <option value="all">All Statuses</option>
            {['new', 'imported', 'data_reviewed', 'ai_generated', 'manual_email_draft', 'email_approved', 'mail_sent', 'manual_email_sent', 'follow_up_1_sent', 'follow_up_2_sent', 'follow_up_3_sent', 'replied', 'interested', 'not_interested', 'demo_scheduled', 'proposal_sent', 'won', 'lost', 'bounced', 'unsubscribed', 'do_not_contact', 'excluded'].map((status) => <option key={status} value={status}>{status.replace(/_/g, ' ')}</option>)}
          </select>
          <button onClick={loadData} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-zinc-950 px-4 py-3 text-sm font-semibold text-white hover:bg-zinc-800">
            <Filter className="h-4 w-4" />
            Apply Filters
          </button>
        </div>

        <div className="mt-3 grid gap-3 xl:grid-cols-5">
          <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)} className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 text-sm text-zinc-700">
            <option value="all">All Priorities</option>
            <option value="low">Low</option>
            <option value="normal">Normal</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
          <select value={qualityFilter} onChange={(e) => setQualityFilter(e.target.value)} className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 text-sm text-zinc-700">
            <option value="all">All Data Quality</option>
            <option value="poor">Poor</option>
            <option value="fair">Fair</option>
            <option value="good">Good</option>
            <option value="excellent">Excellent</option>
          </select>
          <select value={emailTypeFilter} onChange={(e) => setEmailTypeFilter(e.target.value)} className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 text-sm text-zinc-700">
            <option value="all">Any Last Email Type</option>
            <option value="first_email">First Email</option>
            <option value="follow_up_1">Follow-up 1</option>
            <option value="follow_up_2">Follow-up 2</option>
            <option value="follow_up_3">Follow-up 3</option>
            <option value="custom_email">Custom Email</option>
            <option value="proposal_email">Proposal</option>
          </select>
          <select value={repliedFilter} onChange={(e) => setRepliedFilter(e.target.value)} className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 text-sm text-zinc-700">
            <option value="all">Reply State</option>
            <option value="yes">Replied</option>
            <option value="no">Not Replied</option>
          </select>
          <select value={followUpStageFilter} onChange={(e) => setFollowUpStageFilter(e.target.value)} className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 text-sm text-zinc-700">
            <option value="all">Follow-up Stage</option>
            <option value="0">None</option>
            <option value="1">Stage 1</option>
            <option value="2">Stage 2</option>
            <option value="3">Stage 3</option>
          </select>
        </div>

        <div className="mt-3 grid gap-3 xl:grid-cols-3">
          <select value={contactGuardFilter} onChange={(e) => setContactGuardFilter(e.target.value)} className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 text-sm text-zinc-700">
            <option value="all">Contact Safety</option>
            <option value="do_not_contact">Do Not Contact</option>
            <option value="bounced">Bounced</option>
            <option value="unsubscribed">Unsubscribed</option>
          </select>
          <select value={campaignId} onChange={(e) => setCampaignId(e.target.value)} className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 text-sm text-zinc-700">
            {campaigns.map((campaign) => <option key={campaign.id} value={campaign.id}>{campaign.name}</option>)}
          </select>
          <div className="self-center text-sm text-zinc-500">{filteredLeads.length} visible leads</div>
        </div>

        {selected.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)]/60 p-3">
            <span className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">{selected.length} selected</span>
            <button onClick={() => runBulkAction('mark_interested')} className="rounded-xl bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">Mark Interested</button>
            <button onClick={() => runBulkAction('mark_not_interested')} className="rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700">Mark Not Interested</button>
            <button onClick={() => runBulkAction('mark_do_not_contact')} className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">Mark Do Not Contact</button>
            <button onClick={() => runBulkAction('mark_excluded')} className="rounded-xl bg-zinc-100 px-3 py-2 text-xs font-semibold text-zinc-700">Mark Excluded</button>
            <button onClick={() => runBulkAction('add_to_campaign')} className="rounded-xl bg-violet-50 px-3 py-2 text-xs font-semibold text-violet-700">Add to Campaign</button>
          </div>
        )}
      </section>

      <section className="mt-6 rounded-3xl border border-[var(--border)] bg-white shadow-[0_12px_40px_rgba(15,23,42,0.04)]">
        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-violet-500 border-t-transparent" />
          </div>
        ) : filteredLeads.length === 0 ? (
          <EmptyState
            icon={Users}
            title="Your lead library is empty"
            description="Import a CSV or Google Sheet to start personalizing outreach."
            actionLabel="Import Leads"
            actionHref="/leads/import"
            actionIcon={Sparkles}
          />
        ) : (
          <>
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 z-10 border-b border-[var(--border)] bg-white text-xs uppercase tracking-[0.18em] text-zinc-400">
                  <tr>
                    <th className="w-10 px-4 py-4" />
                    <th className="px-4 py-4">Company</th>
                    <th className="px-4 py-4">Contact</th>
                    <th className="px-4 py-4">Email</th>
                    <th className="px-4 py-4">Industry</th>
                    <th className="px-4 py-4">Pain Point</th>
                    <th className="px-4 py-4">Priority</th>
                    <th className="px-4 py-4">Data Quality</th>
                    <th className="px-4 py-4">Status</th>
                    <th className="px-4 py-4">AI Status</th>
                    <th className="px-4 py-4">Last Contacted</th>
                    <th className="px-4 py-4">Next Follow-up</th>
                    <th className="px-4 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {filteredLeads.map((lead) => (
                    <tr key={lead.id} className="transition hover:bg-violet-50/50">
                      <td className="px-4 py-4">
                        <input type="checkbox" checked={selected.includes(lead.id)} onChange={() => toggleSelected(lead.id)} className="h-4 w-4 rounded border-zinc-300 text-violet-600 focus:ring-violet-500" />
                      </td>
                      <td className="px-4 py-4">
                        <div className="font-semibold text-zinc-950">{lead.company_name || lead.company || '-'}</div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="font-medium text-zinc-900">{lead.decision_maker_name || `${lead.first_name || ''} ${lead.last_name || ''}`.trim() || 'Prospect'}</div>
                      </td>
                      <td className="px-4 py-4 text-zinc-600">{lead.email}</td>
                      <td className="px-4 py-4 text-zinc-600">{lead.lead_lists?.name || '-'}</td>
                      <td className="px-4 py-4 text-zinc-600">{lead.sent_emails?.[0]?.email_type?.replace(/_/g, ' ') || lead.sent_emails?.[0]?.email_type || '-'}</td>
                      <td className="px-4 py-4 text-zinc-600">{lead.priority || '-'}</td>
                      <td className="px-4 py-4"><QualityScoreBadge score={lead.data_quality_label === 'excellent' ? 95 : lead.data_quality_label === 'good' ? 75 : lead.data_quality_label === 'fair' ? 55 : 35} label={lead.data_quality_label || 'Data quality'} /></td>
                      <td className="px-4 py-4"><StatusBadge status={lead.status} /></td>
                      <td className="px-4 py-4 text-zinc-600">{lead.manual_personalization_status || '-'}</td>
                      <td className="px-4 py-4 text-zinc-600">{lead.last_email_sent_at ? new Date(lead.last_email_sent_at).toLocaleDateString() : '-'}</td>
                      <td className="px-4 py-4 text-zinc-600">{lead.next_follow_up_date ? new Date(lead.next_follow_up_date).toLocaleDateString() : '-'}</td>
                      <td className="px-4 py-4 text-right">
                        <Link href={`/leads/${lead.id}`} className="inline-flex items-center gap-1 font-semibold text-violet-700 hover:text-violet-800">
                          View <ArrowUpRight className="h-4 w-4" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="grid gap-4 p-4 lg:hidden">
              {filteredLeads.map((lead) => (
                <div key={lead.id} className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)]/60 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold text-zinc-950">{lead.company_name || lead.company || '-'}</div>
                      <div className="text-sm text-zinc-500">{lead.decision_maker_name || `${lead.first_name || ''} ${lead.last_name || ''}`.trim() || 'Prospect'}</div>
                    </div>
                    <input type="checkbox" checked={selected.includes(lead.id)} onChange={() => toggleSelected(lead.id)} className="mt-1 h-4 w-4 rounded border-zinc-300 text-violet-600" />
                  </div>
                  <div className="mt-3 grid gap-2 text-sm text-zinc-600">
                    <div><span className="font-medium text-zinc-900">Email:</span> {lead.email}</div>
                    <div><span className="font-medium text-zinc-900">Status:</span> <StatusBadge status={lead.status} /></div>
                    <div><span className="font-medium text-zinc-900">Quality:</span> <QualityScoreBadge score={lead.data_quality_label === 'excellent' ? 95 : lead.data_quality_label === 'good' ? 75 : lead.data_quality_label === 'fair' ? 55 : 35} label={lead.data_quality_label || 'Data quality'} /></div>
                  </div>
                  <div className="mt-4 flex items-center justify-between">
                    <Link href={`/leads/${lead.id}`} className="inline-flex items-center gap-2 rounded-xl bg-zinc-950 px-4 py-2.5 text-sm font-semibold text-white">
                      View lead
                    </Link>
                    <Link href={`/leads/${lead.id}`} className="text-sm font-semibold text-violet-700">
                      Open
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </section>
    </AppShell>
  );
}
