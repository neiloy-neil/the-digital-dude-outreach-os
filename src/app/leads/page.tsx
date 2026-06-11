'use client';

export const dynamic = 'force-dynamic';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import EmailVerificationBadge from '@/components/leads/EmailVerificationBadge';
import StatusBadge from '@/components/leads/StatusBadge';
import { createClient } from '@/utils/supabase/client';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Search, ArrowUpRight, Sparkles, Filter, MailPlus, Users, Download, SlidersHorizontal } from 'lucide-react';
import AppShell from '@/components/reachmira/AppShell';
import PageHeader from '@/components/reachmira/PageHeader';
import EmptyState from '@/components/reachmira/EmptyState';
import QualityScoreBadge from '@/components/reachmira/QualityScoreBadge';
import Spinner from '@/components/reachmira/Spinner';
import { Button, ConfirmDialog, Field, Input, Modal } from '@/components/reachmira/ui';
import { getLeadReadiness } from '@/lib/leads/library';
import { useToast } from '@/lib/toast/toast-context';

type LeadRow = {
  id: string;
  email: string;
  first_name?: string | null;
  last_name?: string | null;
  decision_maker_name?: string | null;
  company_name?: string | null;
  company?: string | null;
  industry?: string | null;
  country?: string | null;
  pain_points?: string | null;
  tags?: string | null;
  lead_list_id?: string | null;
  lead_lists?: { name?: string | null } | null;
  status?: string | null;
  priority?: string | null;
  data_quality_label?: string | null;
  last_email_sent_at?: string | null;
  last_contacted_at?: string | null;
  last_contacted?: string | null;
  next_follow_up_at?: string | null;
  next_follow_up_date?: string | null;
  next_email_at?: string | null;
  emails_sent_count?: number | null;
  ai_status?: string | null;
  manual_personalization_status?: string | null;
  email_verification_status?: string | null;
  email_verification_reason?: string | null;
};

type CampaignOption = {
  id: string;
  name: string;
};

type LeadListOption = {
  id: string;
  name: string;
};

function ReadinessBadge({ readiness }: { readiness: string }) {
  const styles: Record<string, string> = {
    ready_to_send: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/10',
    needs_email_verification: 'bg-yellow-50 text-yellow-700 ring-1 ring-yellow-600/10',
    missing_pain_point: 'bg-orange-50 text-orange-700 ring-1 ring-orange-600/10',
    missing_solution_angle: 'bg-amber-50 text-amber-700 ring-1 ring-amber-600/10',
    needs_personalization: 'bg-violet-50 text-violet-700 ring-1 ring-violet-600/10',
    follow_up_due: 'bg-rose-50 text-rose-700 ring-1 ring-rose-600/10',
    already_contacted: 'bg-blue-50 text-blue-700 ring-1 ring-blue-600/10',
    do_not_contact: 'bg-zinc-100 text-zinc-700 ring-1 ring-zinc-600/10',
  };
  const labelMap: Record<string, string> = {
    ready_to_send: 'Ready to Send',
    needs_email_verification: 'Needs Verification',
    missing_pain_point: 'Missing Pain',
    missing_solution_angle: 'Missing Offer',
    needs_personalization: 'Needs Personalization',
    follow_up_due: 'Follow-up Due',
    already_contacted: 'Contacted',
    do_not_contact: 'Do Not Contact',
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold ${styles[readiness] || 'bg-zinc-50 text-zinc-600'}`}>
      {labelMap[readiness] || readiness}
    </span>
  );
}

function LeadsPageContent() {
  const supabase = createClient();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignOption[]>([]);
  const [leadLists, setLeadLists] = useState<LeadListOption[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(() => searchParams.get('status') || 'all');
  const [priorityFilter, setPriorityFilter] = useState(() => searchParams.get('priority') || 'all');
  const [aiStatusFilter, setAiStatusFilter] = useState(() => searchParams.get('aiStatus') || 'all');
  const [emailStatusFilter, setEmailStatusFilter] = useState(() => searchParams.get('emailStatus') || 'all');
  const [readinessFilter, setReadinessFilter] = useState(() => searchParams.get('readiness') || 'all');
  const [qualityFilter, setQualityFilter] = useState('all');
  const [leadListFilter, setLeadListFilter] = useState('all');
  const [industryFilter, setIndustryFilter] = useState(() => searchParams.get('industry') || '');
  const [countryFilter, setCountryFilter] = useState(() => searchParams.get('country') || '');
  const [tagFilter, setTagFilter] = useState(() => searchParams.get('tags') || '');
  const [lastContactedFrom, setLastContactedFrom] = useState(() => searchParams.get('lastContactedFrom') || '');
  const [lastContactedTo, setLastContactedTo] = useState(() => searchParams.get('lastContactedTo') || '');
  const [emailTypeFilter, setEmailTypeFilter] = useState('all');
  const [repliedFilter, setRepliedFilter] = useState('all');
  const [followUpStageFilter, setFollowUpStageFilter] = useState('all');
  const [followUpDueFilter, setFollowUpDueFilter] = useState(() => searchParams.get('filter') === 'followups_due');
  const [missingPainFilter, setMissingPainFilter] = useState(() => searchParams.get('missing') === 'pain_points');
  const [missingSolutionFilter, setMissingSolutionFilter] = useState(() => searchParams.get('missing') === 'solution_angle');
  const [notContactedFilter, setNotContactedFilter] = useState(() => searchParams.get('contacted') === 'false');
  const [contactGuardFilter, setContactGuardFilter] = useState('all');
  const [campaignId, setCampaignId] = useState('');
  const [bulkTag, setBulkTag] = useState('');
  const [bulkPriority, setBulkPriority] = useState('normal');
  const [bulkListId, setBulkListId] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);
  const [error, setError] = useState<string | null>(null);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [savingView, setSavingView] = useState(false);
  const toast = useToast();

  // Saved Views State
  const [savedViews, setSavedViews] = useState<Array<{ id: string; name: string; filters: Record<string, unknown>; is_default: boolean }>>([]);
  const [activeViewId, setActiveViewId] = useState<string>('all');
  const [showSaveViewModal, setShowSaveViewModal] = useState(false);
  const [newViewName, setNewViewName] = useState('');

  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('leads_table_columns');
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch {
          // ignore
        }
      }
    }
    return {
      company: true,
      contact: true,
      email: true,
      emailStatus: false,
      industry: false,
      painPoint: false,
      priority: false,
      dataQuality: false,
      aiStatus: false,
      readiness: true,
      status: true,
      lastContacted: false,
      nextFollowUp: false,
    };
  });

  const [showColumnDropdown, setShowColumnDropdown] = useState(false);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  useEffect(() => {
    localStorage.setItem('leads_table_columns', JSON.stringify(visibleColumns));
  }, [visibleColumns]);

  const applyPresetView = useCallback((viewName: string) => {
    setActiveViewId(viewName);
    setSearch('');
    setStatusFilter('all');
    setPriorityFilter('all');
    setAiStatusFilter('all');
    setEmailStatusFilter('all');
    setReadinessFilter('all');
    setLeadListFilter('all');
    setIndustryFilter('');
    setCountryFilter('');
    setTagFilter('');
    setLastContactedFrom('');
    setLastContactedTo('');
    setFollowUpDueFilter(false);
    setMissingPainFilter(false);
    setMissingSolutionFilter(false);
    setNotContactedFilter(false);
    setContactGuardFilter('all');

    if (viewName === 'valid_emails') {
      setEmailStatusFilter('valid');
    } else if (viewName === 'ready_to_send') {
      setReadinessFilter('ready_to_send');
    } else if (viewName === 'followups_due') {
      setFollowUpDueFilter(true);
    } else if (viewName === 'high_priority') {
      setPriorityFilter('high');
      setNotContactedFilter(true);
    } else if (viewName === 'missing_pain') {
      setMissingPainFilter(true);
    } else if (viewName === 'not_contacted') {
      setNotContactedFilter(true);
    }
  }, []);

  const applyCustomView = useCallback((view: { id: string; filters?: Record<string, unknown> }) => {
    setActiveViewId(view.id);
    const f = view.filters || {};
    setSearch(String(f.search || ''));
    setStatusFilter(String(f.status || 'all'));
    setPriorityFilter(String(f.priority || 'all'));
    setAiStatusFilter(String(f.aiStatus || 'all'));
    setEmailStatusFilter(String(f.emailStatus || 'all'));
    setReadinessFilter(String(f.readiness || 'all'));
    setLeadListFilter(String(f.leadListId || 'all'));
    setIndustryFilter(String(f.industry || ''));
    setCountryFilter(String(f.country || ''));
    setTagFilter(String(f.tags || ''));
    setLastContactedFrom(String(f.lastContactedFrom || ''));
    setLastContactedTo(String(f.lastContactedTo || ''));
    setFollowUpDueFilter(!!f.followups_due);
    setMissingPainFilter(!!f.missing_pain);
    setMissingSolutionFilter(!!f.missing_solution);
    setNotContactedFilter(!!f.not_contacted);
    setContactGuardFilter(String(f.contactGuard || 'all'));
  }, []);

  const loadSavedViews = useCallback(async () => {
    try {
      const response = await fetch('/api/saved-views');
      const data = await response.json();
      if (response.ok && data.savedViews) {
        setSavedViews(data.savedViews);
        // Apply default view if no query parameters exist
        const hasParams = Array.from(searchParams.keys()).length > 0;
        if (!hasParams) {
          const defaultView = data.savedViews.find((v: { is_default: boolean }) => v.is_default);
          if (defaultView) {
            applyCustomView(defaultView);
          }
        }
      }
    } catch {
      // ignore
    }
  }, [searchParams, applyCustomView]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setCurrentPage(1);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (priorityFilter !== 'all') params.set('priority', priorityFilter);
      if (aiStatusFilter !== 'all') params.set('aiStatus', aiStatusFilter);
      if (emailStatusFilter !== 'all') params.set('emailStatus', emailStatusFilter);
      if (readinessFilter !== 'all') params.set('readiness', readinessFilter);
      if (leadListFilter !== 'all') params.set('leadListId', leadListFilter);
      if (industryFilter) params.set('industry', industryFilter);
      if (countryFilter) params.set('country', countryFilter);
      if (tagFilter) params.set('tags', tagFilter);
      if (lastContactedFrom) params.set('lastContactedFrom', lastContactedFrom);
      if (lastContactedTo) params.set('lastContactedTo', lastContactedTo);
      if (followUpDueFilter) params.set('filter', 'followups_due');
      if (missingPainFilter) params.set('missing', 'pain_points');
      if (missingSolutionFilter) params.set('missing', 'solution_angle');
      if (notContactedFilter) params.set('contacted', 'false');
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
      toast.error(loadError instanceof Error ? loadError.message : 'Failed to load leads');
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aiStatusFilter, contactGuardFilter, countryFilter, emailStatusFilter, emailTypeFilter, followUpDueFilter, industryFilter, lastContactedFrom, lastContactedTo, leadListFilter, missingPainFilter, missingSolutionFilter, notContactedFilter, priorityFilter, readinessFilter, repliedFilter, search, statusFilter, supabase, followUpStageFilter, tagFilter]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadData();
    loadSavedViews();
  }, [loadData, loadSavedViews]);

  const filteredLeads = useMemo(() => {
    if (qualityFilter === 'all') return leads;
    return leads.filter((lead) => lead.data_quality_label === qualityFilter);
  }, [leads, qualityFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredLeads.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedLeads = useMemo(() => {
    const start = (safeCurrentPage - 1) * pageSize;
    return filteredLeads.slice(start, start + pageSize);
  }, [filteredLeads, pageSize, safeCurrentPage]);

  const toggleSelected = (leadId: string) => {
    setSelected((prev) => (prev.includes(leadId) ? prev.filter((id) => id !== leadId) : [...prev, leadId]));
  };

  const [pendingBulkAction, setPendingBulkAction] = useState<{
    action: string;
    extras: Record<string, unknown>;
    label: string;
  } | null>(null);

  const runBulkAction = (action: string, extras: Record<string, unknown> = {}) => {
    const actionLabels: Record<string, string> = {
      mark_interested: 'mark as interested',
      mark_not_interested: 'mark as not interested',
      mark_do_not_contact: 'mark as do not contact',
      mark_excluded: 'mark as excluded',
      add_to_campaign: 'add to campaign',
      add_tag: 'add tag',
      change_priority: 'change priority',
      verify_selected: 'verify emails',
      deep_verify_selected: 'deep verify emails',
      mark_contacted: 'mark as contacted',
      assign_to_list: 'assign to list',
    };
    const label = actionLabels[action] || action.replace(/_/g, ' ');
    setPendingBulkAction({ action, extras, label });
  };

  const executeBulkAction = async () => {
    if (!pendingBulkAction) return;
    const { action, extras, label } = pendingBulkAction;
    setPendingBulkAction(null);

    setBulkLoading(true);
    try {
      if (action === 'verify_selected' || action === 'deep_verify_selected') {
        const response = await fetch('/api/leads/verify-bulk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lead_ids: selected,
            checkMx: action === 'deep_verify_selected',
          }),
        });
        const payload = await response.json();
        if (!response.ok) {
          toast.error(payload.error || 'Bulk verification failed');
          return;
        }
        const s = payload.summary;
        toast.success(`Verified ${s?.total ?? selected.length} leads — ${s?.valid ?? 0} valid, ${s?.unknown ?? 0} unknown.`);
        setSelected([]);
        await loadData();
        return;
      }

      const response = await fetch('/api/leads/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, leadIds: selected, campaignId, ...extras }),
      });
      const payload = await response.json();
      if (!response.ok) {
        toast.error(payload.error || 'Bulk update failed');
        return;
      }
      toast.success(`Applied "${label}" to ${selected.length} lead${selected.length === 1 ? '' : 's'}.`);
      setSelected([]);
      await loadData();
    } finally {
      setBulkLoading(false);
    }
  };

  const exportSelectedLeads = () => {
    const rows = leads.filter((lead) => selected.includes(lead.id));
    if (rows.length === 0) return;

    const headers = [
      'Company',
      'Contact',
      'Email',
      'Industry',
      'Email Status',
      'Country',
      'Pain Point',
      'Priority',
      'Data Quality',
      'AI Status',
      'Status',
      'Last Contacted',
      'Next Follow-up',
      'Tags',
    ];
    const csvRows = rows.map((lead) =>
      [
        lead.company_name || lead.company || '',
        lead.decision_maker_name || `${lead.first_name || ''} ${lead.last_name || ''}`.trim(),
        lead.email,
        lead.industry || '',
        lead.email_verification_status || 'not_checked',
        lead.country || '',
        lead.pain_points || '',
        lead.priority || '',
        lead.data_quality_label || '',
        lead.ai_status || '',
        lead.status || '',
        lead.last_email_sent_at || lead.last_contacted_at || lead.last_contacted || '',
        lead.next_follow_up_at || lead.next_follow_up_date || lead.next_email_at || '',
        lead.tags || '',
      ].map((value) => `"${String(value).replace(/"/g, '""')}"`).join(',')
    );

    const blob = new Blob([[headers.join(','), ...csvRows].join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `reachmira-selected-leads-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };



  const saveCurrentView = async () => {
    if (!newViewName.trim()) return;
    setSavingView(true);
    try {
      const filters = {
        search,
        status: statusFilter,
        priority: priorityFilter,
        aiStatus: aiStatusFilter,
        emailStatus: emailStatusFilter,
        readiness: readinessFilter,
        leadListId: leadListFilter,
        industry: industryFilter,
        country: countryFilter,
        tags: tagFilter,
        lastContactedFrom,
        lastContactedTo,
        followups_due: followUpDueFilter,
        missing_pain: missingPainFilter,
        missing_solution: missingSolutionFilter,
        not_contacted: notContactedFilter,
        contactGuard: contactGuardFilter,
      };

      const response = await fetch('/api/saved-views', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newViewName, filters }),
      });

      if (response.ok) {
        toast.success(`View "${newViewName}" saved.`);
        setNewViewName('');
        setShowSaveViewModal(false);
        await loadSavedViews();
      } else {
        toast.error('Failed to save view.');
      }
    } catch {
      toast.error('Failed to save view.');
    } finally {
      setSavingView(false);
    }
  };

  const [deleteViewId, setDeleteViewId] = useState<string | null>(null);

  const deleteSavedView = async (id: string) => {
    try {
      const response = await fetch(`/api/saved-views?id=${id}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        if (activeViewId === id) setActiveViewId('all');
        await loadSavedViews();
      }
    } catch {
      // ignore
    }
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

      {/* errors are now shown as toasts — inline banner removed */}

      {/* Saved Views Preset Bar */}
      <div className="mb-6 rounded-3xl border border-[var(--border)] bg-white p-4 shadow-[0_12px_40px_rgba(15,23,42,0.02)]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-400 mr-2">Saved Views:</span>
            <button
              onClick={() => applyPresetView('all')}
              className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                activeViewId === 'all' ? 'bg-violet-600 text-white' : 'bg-zinc-50 text-zinc-600 hover:bg-zinc-100'
              }`}
            >
              All Leads
            </button>
            <button
              onClick={() => applyPresetView('valid_emails')}
              className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                activeViewId === 'valid_emails' ? 'bg-violet-600 text-white' : 'bg-zinc-50 text-zinc-600 hover:bg-zinc-100'
              }`}
            >
              Valid Emails Only
            </button>
            <button
              onClick={() => applyPresetView('ready_to_send')}
              className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                activeViewId === 'ready_to_send' ? 'bg-violet-600 text-white' : 'bg-zinc-50 text-zinc-600 hover:bg-zinc-100'
              }`}
            >
              Ready to Send
            </button>
            <button
              onClick={() => applyPresetView('followups_due')}
              className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                activeViewId === 'followups_due' ? 'bg-violet-600 text-white' : 'bg-zinc-50 text-zinc-600 hover:bg-zinc-100'
              }`}
            >
              Follow-ups Due Today
            </button>
            <button
              onClick={() => applyPresetView('high_priority')}
              className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                activeViewId === 'high_priority' ? 'bg-violet-600 text-white' : 'bg-zinc-50 text-zinc-600 hover:bg-zinc-100'
              }`}
            >
              High Priority Leads
            </button>
            <button
              onClick={() => applyPresetView('missing_pain')}
              className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                activeViewId === 'missing_pain' ? 'bg-violet-600 text-white' : 'bg-zinc-50 text-zinc-600 hover:bg-zinc-100'
              }`}
            >
              Missing Pain Point
            </button>
            <button
              onClick={() => applyPresetView('not_contacted')}
              className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                activeViewId === 'not_contacted' ? 'bg-violet-600 text-white' : 'bg-zinc-50 text-zinc-600 hover:bg-zinc-100'
              }`}
            >
              Not Contacted Yet
            </button>

            {/* Custom Saved Views */}
            {savedViews.map((view) => (
              <div
                key={view.id}
                onClick={() => applyCustomView(view)}
                className={`group flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
                  activeViewId === view.id ? 'bg-violet-600 text-white' : 'bg-zinc-50 text-zinc-600 hover:bg-zinc-100'
                }`}
              >
                <span>{view.name}</span>
                {view.is_default ? (
                  <span className="text-[10px] text-amber-500 font-bold" title="Default view">★</span>
                ) : (
                  <button
                    onClick={async (e) => {
                      e.stopPropagation();
                      try {
                        const response = await fetch('/api/saved-views', {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ id: view.id, is_default: true }),
                        });
                        if (response.ok) {
                          await loadSavedViews();
                        }
                      } catch {
                        // ignore
                      }
                    }}
                    className="opacity-0 group-hover:opacity-100 text-[10px] text-zinc-400 hover:text-amber-500 transition-all"
                    title="Set as Default"
                  >
                    ☆
                  </button>
                )}
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteViewId(view.id);
                  }}
                  className="rounded p-0.5 hover:bg-black/10 text-zinc-400 group-hover:text-current transition-colors"
                  title="Delete view"
                >
                  &times;
                </span>
              </div>
            ))}
          </div>

          <button
            onClick={() => setShowSaveViewModal(true)}
            className="rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
          >
            + Save Current View
          </button>
        </div>
      </div>

      <Modal open={showSaveViewModal} onClose={() => setShowSaveViewModal(false)} title="Save Current Filter Preset" maxWidth="md">
        <p className="-mt-4 mb-4 text-xs text-zinc-500">Name this view to quickly re-apply all your current filters later.</p>
        <Field label="View name" htmlFor="save-view-name">
          <Input
            id="save-view-name"
            type="text"
            required
            value={newViewName}
            onChange={(e) => setNewViewName(e.target.value)}
            placeholder="e.g. Agency Leads with Valid Emails"
          />
        </Field>
        <div className="mt-6 flex justify-end gap-3">
          <Button size="sm" onClick={() => setShowSaveViewModal(false)}>
            Cancel
          </Button>
          <Button size="sm" variant="primary" onClick={saveCurrentView} loading={savingView}>
            {savingView ? 'Saving...' : 'Save View'}
          </Button>
        </div>
      </Modal>

      <section className="rounded-3xl border border-[var(--border)] bg-white p-5 shadow-[0_12px_40px_rgba(15,23,42,0.04)]">
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-12">
          <div className="flex items-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 lg:col-span-4">
            <Search className="h-4 w-4 text-zinc-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search leads..." className="w-full bg-transparent text-sm outline-none placeholder:text-zinc-400" />
          </div>
          <select value={leadListFilter} onChange={(e) => setLeadListFilter(e.target.value)} className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 text-sm text-zinc-700 lg:col-span-3">
            <option value="all">All Lead Lists</option>
            {leadLists.map((list) => <option key={list.id} value={list.id}>{list.name}</option>)}
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 text-sm text-zinc-700 lg:col-span-2">
            <option value="all">All Statuses</option>
            {['new', 'imported', 'data_reviewed', 'ai_generated', 'manual_email_draft', 'email_approved', 'mail_sent', 'manual_email_sent', 'follow_up_1_sent', 'follow_up_2_sent', 'follow_up_3_sent', 'replied', 'interested', 'not_interested', 'demo_scheduled', 'proposal_sent', 'won', 'lost', 'bounced', 'unsubscribed', 'do_not_contact', 'excluded'].map((status) => <option key={status} value={status}>{status.replace(/_/g, ' ')}</option>)}
          </select>
          <button
            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            className={`inline-flex items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-semibold transition cursor-pointer lg:col-span-2 ${showAdvancedFilters ? 'bg-zinc-100 text-zinc-900 border-zinc-300' : 'bg-white text-zinc-700 border-[var(--border)] hover:bg-zinc-50'}`}
          >
            <Filter className="h-4 w-4" />
            {showAdvancedFilters ? 'Less Filters' : 'More Filters'}
          </button>
          <button onClick={loadData} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-zinc-950 px-4 py-3 text-sm font-semibold text-white hover:bg-zinc-800 cursor-pointer lg:col-span-1">
            Apply
          </button>
        </div>

        {showAdvancedFilters && (
          <div className="mt-4 space-y-4 border-t border-[var(--border)] pt-4">
            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 px-1">Readiness</span>
                <select value={readinessFilter} onChange={(e) => setReadinessFilter(e.target.value)} className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 text-sm text-zinc-700">
                  <option value="all">All Readiness</option>
                  <option value="ready_to_send">Ready to Send</option>
                  <option value="needs_email_verification">Needs Verification</option>
                  <option value="missing_pain_point">Missing Pain Point</option>
                  <option value="missing_solution_angle">Missing Solution Angle</option>
                  <option value="needs_personalization">Needs Personalization</option>
                  <option value="follow_up_due">Follow-up Due</option>
                  <option value="already_contacted">Already Contacted</option>
                  <option value="do_not_contact">Do Not Contact</option>
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 px-1">Priority</span>
                <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)} className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 text-sm text-zinc-700">
                  <option value="all">All Priorities</option>
                  <option value="low">Low</option>
                  <option value="normal">Normal</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 px-1">AI Status</span>
                <select value={aiStatusFilter} onChange={(e) => setAiStatusFilter(e.target.value)} className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 text-sm text-zinc-700">
                  <option value="all">All AI Statuses</option>
                  <option value="pending">Pending</option>
                  <option value="processing">Processing</option>
                  <option value="generated">Generated</option>
                  <option value="approved">Approved</option>
                  <option value="edited">Edited</option>
                  <option value="skipped">Skipped</option>
                  <option value="failed">Failed</option>
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 px-1">Email Status</span>
                <select value={emailStatusFilter} onChange={(e) => setEmailStatusFilter(e.target.value)} className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 text-sm text-zinc-700">
                  <option value="all">All Email Statuses</option>
                  <option value="valid">Valid</option>
                  <option value="risky">Risky</option>
                  <option value="invalid">Invalid</option>
                  <option value="role_based">Role-based</option>
                  <option value="disposable">Disposable</option>
                  <option value="suppressed">Suppressed</option>
                  <option value="unknown">Unknown</option>
                  <option value="not_checked">Not Checked</option>
                  <option value="failed">Failed</option>
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 px-1">Data Quality</span>
                <select value={qualityFilter} onChange={(e) => setQualityFilter(e.target.value)} className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 text-sm text-zinc-700">
                  <option value="all">All Data Quality</option>
                  <option value="poor">Poor</option>
                  <option value="fair">Fair</option>
                  <option value="good">Good</option>
                  <option value="excellent">Excellent</option>
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 px-1">Last Email Type</span>
                <select value={emailTypeFilter} onChange={(e) => setEmailTypeFilter(e.target.value)} className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 text-sm text-zinc-700">
                  <option value="all">Any Last Email Type</option>
                  <option value="first_email">First Email</option>
                  <option value="follow_up_1">Follow-up 1</option>
                  <option value="follow_up_2">Follow-up 2</option>
                  <option value="follow_up_3">Follow-up 3</option>
                  <option value="custom_email">Custom Email</option>
                  <option value="proposal_email">Proposal</option>
                </select>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 px-1">Industry</span>
                <input value={industryFilter} onChange={(e) => setIndustryFilter(e.target.value)} placeholder="Industry filter" className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 text-sm text-zinc-700 outline-none placeholder:text-zinc-400" />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 px-1">Country</span>
                <input value={countryFilter} onChange={(e) => setCountryFilter(e.target.value)} placeholder="Country filter" className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 text-sm text-zinc-700 outline-none placeholder:text-zinc-400" />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 px-1">Tags</span>
                <input value={tagFilter} onChange={(e) => setTagFilter(e.target.value)} placeholder="Tag filter" className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 text-sm text-zinc-700 outline-none placeholder:text-zinc-400" />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 px-1">Reply State</span>
                <select value={repliedFilter} onChange={(e) => setRepliedFilter(e.target.value)} className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 text-sm text-zinc-700">
                  <option value="all">Reply State</option>
                  <option value="yes">Replied</option>
                  <option value="no">Not Replied</option>
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 px-1">Follow-up Stage</span>
                <select value={followUpStageFilter} onChange={(e) => setFollowUpStageFilter(e.target.value)} className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 text-sm text-zinc-700">
                  <option value="all">Follow-up Stage</option>
                  <option value="0">None</option>
                  <option value="1">Stage 1</option>
                  <option value="2">Stage 2</option>
                  <option value="3">Stage 3</option>
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 px-1">Safety & Campaign</span>
                <select value={contactGuardFilter} onChange={(e) => setContactGuardFilter(e.target.value)} className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 text-sm text-zinc-700">
                  <option value="all">Contact Safety</option>
                  <option value="do_not_contact">Do Not Contact</option>
                  <option value="bounced">Bounced</option>
                  <option value="unsubscribed">Unsubscribed</option>
                </select>
              </div>
            </div>

            <div className="grid gap-3 lg:grid-cols-3">
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 px-1">Last Contacted (From / To)</span>
                <div className="grid grid-cols-2 gap-2">
                  <input type="date" value={lastContactedFrom} onChange={(e) => setLastContactedFrom(e.target.value)} className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 text-sm text-zinc-700" aria-label="Last contacted from" />
                  <input type="date" value={lastContactedTo} onChange={(e) => setLastContactedTo(e.target.value)} className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 text-sm text-zinc-700" aria-label="Last contacted to" />
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 px-1">Campaign</span>
                <select value={campaignId} onChange={(e) => setCampaignId(e.target.value)} className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 text-sm text-zinc-700">
                  {campaigns.map((campaign) => <option key={campaign.id} value={campaign.id}>{campaign.name}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 px-1">Outreach Statuses</span>
                <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 h-full">
                  <label className="inline-flex items-center gap-2 text-sm font-medium text-zinc-700 cursor-pointer">
                    <input type="checkbox" checked={followUpDueFilter} onChange={(e) => setFollowUpDueFilter(e.target.checked)} className="rounded border-zinc-300 text-violet-600 focus:ring-violet-500" />
                    Follow-up Due
                  </label>
                  <label className="inline-flex items-center gap-2 text-sm font-medium text-zinc-700 cursor-pointer">
                    <input type="checkbox" checked={missingPainFilter} onChange={(e) => setMissingPainFilter(e.target.checked)} className="rounded border-zinc-300 text-violet-600 focus:ring-violet-500" />
                    Missing Pain Point
                  </label>
                  <label className="inline-flex items-center gap-2 text-sm font-medium text-zinc-700 cursor-pointer">
                    <input type="checkbox" checked={missingSolutionFilter} onChange={(e) => setMissingSolutionFilter(e.target.checked)} className="rounded border-zinc-300 text-violet-600 focus:ring-violet-500" />
                    Missing Solution Angle
                  </label>
                  <label className="inline-flex items-center gap-2 text-sm font-medium text-zinc-700 cursor-pointer">
                    <input type="checkbox" checked={notContactedFilter} onChange={(e) => setNotContactedFilter(e.target.checked)} className="rounded border-zinc-300 text-violet-600 focus:ring-violet-500" />
                    Not Contacted
                  </label>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3">
          <div className="text-sm text-zinc-500">
            {filteredLeads.length} lead{filteredLeads.length === 1 ? '' : 's'} found
          </div>
          <div className="flex flex-wrap items-center gap-4">
            {/* Column Selector */}
            <div className="relative">
              <button
                onClick={() => setShowColumnDropdown(!showColumnDropdown)}
                className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 transition"
              >
                <SlidersHorizontal className="h-4 w-4 text-zinc-400" />
                Customize Columns
              </button>
              {showColumnDropdown && (
                <>
                  <div className="fixed inset-0 z-20" onClick={() => setShowColumnDropdown(false)} />
                  <div
                    className="absolute right-0 mt-2 z-30 w-56 rounded-2xl border border-[var(--border)] bg-white p-3 shadow-xl ring-1 ring-black ring-opacity-5 max-h-[350px] overflow-y-auto"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-400 px-2">Show Columns</div>
                    <div className="space-y-1.5">
                      {[
                        { key: 'company', label: 'Company' },
                        { key: 'contact', label: 'Contact' },
                        { key: 'email', label: 'Email' },
                        { key: 'emailStatus', label: 'Email Status' },
                        { key: 'industry', label: 'Industry' },
                        { key: 'painPoint', label: 'Pain Point' },
                        { key: 'priority', label: 'Priority' },
                        { key: 'dataQuality', label: 'Data Quality' },
                        { key: 'aiStatus', label: 'AI Status' },
                        { key: 'readiness', label: 'Outreach Readiness' },
                        { key: 'status', label: 'Status' },
                        { key: 'lastContacted', label: 'Last Contacted' },
                        { key: 'nextFollowUp', label: 'Next Follow-up' },
                      ].map((col) => (
                        <label key={col.key} className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-zinc-50 cursor-pointer text-sm text-zinc-700 font-medium transition">
                          <input
                            type="checkbox"
                            checked={!!visibleColumns[col.key]}
                            onChange={(e) => {
                              setVisibleColumns(prev => ({
                                ...prev,
                                [col.key]: e.target.checked
                              }));
                            }}
                            className="rounded border-zinc-300 text-violet-600 focus:ring-violet-500"
                          />
                          {col.label}
                        </label>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Page Size */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400">Page size</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm text-zinc-700 outline-none"
              >
                {[12, 24, 36, 48].map((size) => (
                  <option key={size} value={size}>
                    {size} / page
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {selected.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)]/60 p-3">
            <span className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">
              {bulkLoading ? (
                <span className="inline-flex items-center gap-1.5"><Spinner size={12} className="text-violet-500" /> Processing...</span>
              ) : (
                `${selected.length} selected`
              )}
            </span>
            <button onClick={() => runBulkAction('mark_interested')} disabled={bulkLoading} className="rounded-xl bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">Mark Interested</button>
            <button onClick={() => runBulkAction('mark_not_interested')} disabled={bulkLoading} className="rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">Mark Not Interested</button>
            <button onClick={() => runBulkAction('mark_do_not_contact')} disabled={bulkLoading} className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">Mark Do Not Contact</button>
            <button onClick={() => runBulkAction('mark_excluded')} disabled={bulkLoading} className="rounded-xl bg-zinc-100 px-3 py-2 text-xs font-semibold text-zinc-700 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">Mark Excluded</button>
            <button onClick={() => runBulkAction('mark_contacted')} disabled={bulkLoading} className="rounded-xl bg-violet-50 px-3 py-2 text-xs font-semibold text-violet-700 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">Mark as Contacted</button>
            <button onClick={() => runBulkAction('add_to_campaign')} disabled={bulkLoading} className="rounded-xl bg-violet-50 px-3 py-2 text-xs font-semibold text-violet-700 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">Add to Campaign</button>
            <button onClick={() => runBulkAction('verify_selected')} disabled={bulkLoading} className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
              {bulkLoading ? <Spinner size={12} className="text-emerald-600" /> : null}
              Verify Emails
            </button>
            <button onClick={() => runBulkAction('deep_verify_selected')} disabled={bulkLoading} className="inline-flex items-center gap-1.5 rounded-xl bg-sky-50 px-3 py-2 text-xs font-semibold text-sky-700 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
              {bulkLoading ? <Spinner size={12} className="text-sky-600" /> : null}
              Deep Verify
            </button>
            <div className="flex items-center gap-2 rounded-xl bg-white px-2 py-1 ring-1 ring-[var(--border)]">
              <input value={bulkTag} onChange={(e) => setBulkTag(e.target.value)} placeholder="Tag" className="w-28 bg-transparent px-2 py-1 text-xs outline-none placeholder:text-zinc-400" />
              <button onClick={() => runBulkAction('add_tag', { tag: bulkTag })} disabled={bulkLoading} className="rounded-lg bg-teal-50 px-2.5 py-1.5 text-xs font-semibold text-teal-700 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">Add Tag</button>
            </div>
            <div className="flex items-center gap-2 rounded-xl bg-white px-2 py-1 ring-1 ring-[var(--border)]">
              <select value={bulkPriority} onChange={(e) => setBulkPriority(e.target.value)} className="bg-transparent px-2 py-1 text-xs text-zinc-700 outline-none">
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
              <button onClick={() => runBulkAction('change_priority', { priority: bulkPriority })} disabled={bulkLoading} className="rounded-lg bg-sky-50 px-2.5 py-1.5 text-xs font-semibold text-sky-700 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">Change Priority</button>
            </div>
            <div className="flex items-center gap-2 rounded-xl bg-white px-2 py-1 ring-1 ring-[var(--border)]">
              <select value={bulkListId} onChange={(e) => setBulkListId(e.target.value)} className="bg-transparent px-2 py-1 text-xs text-zinc-700 outline-none">
                <option value="">-- Select List --</option>
                {leadLists.map((list) => <option key={list.id} value={list.id}>{list.name}</option>)}
              </select>
              <button onClick={() => runBulkAction('assign_to_list', { leadListId: bulkListId })} disabled={!bulkListId || bulkLoading} className="rounded-lg bg-teal-50 px-2.5 py-1.5 text-xs font-semibold text-teal-700 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed">Assign to List</button>
            </div>
            <button onClick={exportSelectedLeads} disabled={bulkLoading} className="inline-flex items-center gap-1 rounded-xl bg-white px-3 py-2 text-xs font-semibold text-zinc-700 ring-1 ring-[var(--border)] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
              <Download className="h-3.5 w-3.5" /> Export Selected
            </button>
          </div>
        )}

      </section>

      <section className="mt-6 rounded-3xl border border-[var(--border)] bg-white shadow-[0_12px_40px_rgba(15,23,42,0.04)]">
        {loading ? (
          <div className="flex h-64 items-center justify-center text-violet-500">
            <Spinner size={32} />
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
              <table className="w-full text-left text-sm table-auto">
                <thead className="sticky top-0 z-10 border-b border-[var(--border)] bg-white text-xs uppercase tracking-[0.18em] text-zinc-400">
                  <tr>
                    <th className="w-10 px-4 py-4" />
                    {visibleColumns.company && <th className="px-4 py-4">Company</th>}
                    {visibleColumns.contact && <th className="px-4 py-4">Contact</th>}
                    {visibleColumns.email && <th className="px-4 py-4">Email</th>}
                    {visibleColumns.emailStatus && <th className="px-4 py-4">Email Status</th>}
                    {visibleColumns.industry && <th className="px-4 py-4">Industry</th>}
                    {visibleColumns.painPoint && <th className="px-4 py-4">Pain Point</th>}
                    {visibleColumns.priority && <th className="px-4 py-4">Priority</th>}
                    {visibleColumns.dataQuality && <th className="px-4 py-4">Data Quality</th>}
                    {visibleColumns.aiStatus && <th className="px-4 py-4">AI Status</th>}
                    {visibleColumns.readiness && <th className="px-4 py-4">Readiness</th>}
                    {visibleColumns.status && <th className="px-4 py-4">Status</th>}
                    {visibleColumns.lastContacted && <th className="px-4 py-4">Last Contacted</th>}
                    {visibleColumns.nextFollowUp && <th className="px-4 py-4">Next Follow-up</th>}
                    <th className="px-4 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {paginatedLeads.map((lead) => (
                    <tr key={lead.id} className="transition hover:bg-violet-50/50">
                      <td className="px-4 py-4">
                        <input type="checkbox" checked={selected.includes(lead.id)} onChange={() => toggleSelected(lead.id)} className="h-4 w-4 rounded border-zinc-300 text-violet-600 focus:ring-violet-500" />
                      </td>
                      {visibleColumns.company && (
                        <td className="px-4 py-4">
                          <div className="truncate font-semibold text-zinc-950 max-w-[200px]" title={lead.company_name || lead.company || ''}>
                            {lead.company_name || lead.company || '-'}
                          </div>
                        </td>
                      )}
                      {visibleColumns.contact && (
                        <td className="px-4 py-4">
                          <Link
                            href={`/leads/${lead.id}`}
                            className="block truncate font-semibold text-violet-700 transition hover:text-violet-800 hover:underline max-w-[150px]"
                            title="Open lead profile"
                          >
                            {lead.decision_maker_name || `${lead.first_name || ''} ${lead.last_name || ''}`.trim() || 'Prospect'}
                          </Link>
                        </td>
                      )}
                      {visibleColumns.email && (
                        <td className="px-4 py-4 text-zinc-600">
                          <div className="truncate max-w-[200px]" title={lead.email}>{lead.email}</div>
                        </td>
                      )}
                      {visibleColumns.emailStatus && (
                        <td className="px-4 py-4">
                          <EmailVerificationBadge status={lead.email_verification_status} />
                        </td>
                      )}
                      {visibleColumns.industry && (
                        <td className="px-4 py-4 text-zinc-600">
                          <div className="truncate max-w-[150px]">{lead.industry || lead.lead_lists?.name || '-'}</div>
                        </td>
                      )}
                      {visibleColumns.painPoint && (
                        <td className="max-w-[220px] px-4 py-4 text-zinc-600">
                          <div className="line-clamp-2">{lead.pain_points || '-'}</div>
                        </td>
                      )}
                      {visibleColumns.priority && (
                        <td className="px-4 py-4 text-zinc-600 capitalize">{lead.priority || '-'}</td>
                      )}
                      {visibleColumns.dataQuality && (
                        <td className="px-4 py-4">
                          <QualityScoreBadge score={lead.data_quality_label === 'excellent' ? 95 : lead.data_quality_label === 'good' ? 75 : lead.data_quality_label === 'fair' ? 55 : 35} label={lead.data_quality_label || 'Data quality'} />
                        </td>
                      )}
                      {visibleColumns.aiStatus && (
                        <td className="px-4 py-4 text-zinc-600 capitalize">{lead.ai_status || '-'}</td>
                      )}
                      {visibleColumns.readiness && (
                        <td className="px-4 py-4">
                          <ReadinessBadge readiness={getLeadReadiness(lead as Parameters<typeof getLeadReadiness>[0])} />
                        </td>
                      )}
                      {visibleColumns.status && (
                        <td className="px-4 py-4">
                          <StatusBadge status={lead.status} />
                        </td>
                      )}
                      {visibleColumns.lastContacted && (
                        <td className="px-4 py-4 text-zinc-600">
                          {lead.last_email_sent_at || lead.last_contacted_at || lead.last_contacted ? new Date(lead.last_email_sent_at || lead.last_contacted_at || lead.last_contacted || '').toLocaleDateString() : '-'}
                        </td>
                      )}
                      {visibleColumns.nextFollowUp && (
                        <td className="px-4 py-4 text-zinc-600">
                          {lead.next_follow_up_at || lead.next_follow_up_date || lead.next_email_at ? new Date(lead.next_follow_up_at || lead.next_follow_up_date || lead.next_email_at || '').toLocaleDateString() : '-'}
                        </td>
                      )}
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

            <div className="grid gap-4 p-4 sm:grid-cols-2 lg:hidden">
              {paginatedLeads.map((lead) => (
                <div key={lead.id} className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)]/60 p-4 shadow-[0_8px_24px_rgba(15,23,42,0.03)]">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold text-zinc-950">{lead.company_name || lead.company || '-'}</div>
                      <Link href={`/leads/${lead.id}`} className="text-sm font-semibold text-violet-700 hover:text-violet-800 hover:underline">
                        {lead.decision_maker_name || `${lead.first_name || ''} ${lead.last_name || ''}`.trim() || 'Prospect'}
                      </Link>
                    </div>
                    <input type="checkbox" checked={selected.includes(lead.id)} onChange={() => toggleSelected(lead.id)} className="mt-1 h-4 w-4 rounded border-zinc-300 text-violet-600" />
                  </div>
                  <div className="mt-3 grid gap-2 text-sm text-zinc-600">
                    <div><span className="font-medium text-zinc-900">Email:</span> {lead.email}</div>
                    <div className="flex flex-wrap items-center gap-2"><span className="font-medium text-zinc-900">Email Status:</span> <EmailVerificationBadge status={lead.email_verification_status} /></div>
                    <div><span className="font-medium text-zinc-900">Industry:</span> {lead.industry || '-'}</div>
                    <div><span className="font-medium text-zinc-900">Pain:</span> {lead.pain_points || '-'}</div>
                    <div><span className="font-medium text-zinc-900">AI:</span> {lead.ai_status || '-'}</div>
                    <div><span className="font-medium text-zinc-900">Last:</span> {lead.last_email_sent_at || lead.last_contacted_at || lead.last_contacted ? new Date(lead.last_email_sent_at || lead.last_contacted_at || lead.last_contacted || '').toLocaleDateString() : '-'}</div>
                    <div><span className="font-medium text-zinc-900">Next:</span> {lead.next_follow_up_at || lead.next_follow_up_date || lead.next_email_at ? new Date(lead.next_follow_up_at || lead.next_follow_up_date || lead.next_email_at || '').toLocaleDateString() : '-'}</div>
                    <div className="flex flex-wrap items-center gap-2"><span className="font-medium text-zinc-900">Status:</span> <StatusBadge status={lead.status} /></div>
                    <div className="flex flex-wrap items-center gap-2"><span className="font-medium text-zinc-900">Quality:</span> <QualityScoreBadge score={lead.data_quality_label === 'excellent' ? 95 : lead.data_quality_label === 'good' ? 75 : lead.data_quality_label === 'fair' ? 55 : 35} label={lead.data_quality_label || 'Data quality'} /></div>
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

            <div className="flex flex-col gap-3 border-t border-[var(--border)] px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm text-zinc-500">
                Showing{' '}
                <span className="font-semibold text-zinc-900">
                  {filteredLeads.length === 0 ? 0 : (safeCurrentPage - 1) * pageSize + 1}
                </span>{' '}
                to{' '}
                <span className="font-semibold text-zinc-900">
                  {Math.min(currentPage * pageSize, filteredLeads.length)}
                </span>{' '}
                of <span className="font-semibold text-zinc-900">{filteredLeads.length}</span> leads
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                  disabled={currentPage <= 1}
                  className="rounded-xl border border-[var(--border)] bg-white px-4 py-2 text-sm font-semibold text-zinc-700 transition hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Previous
                </button>
                <div className="rounded-xl bg-[var(--surface-muted)] px-4 py-2 text-sm font-semibold text-zinc-700">
                  Page {safeCurrentPage} of {totalPages}
                </div>
                <button
                  onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                  disabled={currentPage >= totalPages}
                  className="rounded-xl border border-[var(--border)] bg-white px-4 py-2 text-sm font-semibold text-zinc-700 transition hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </section>

      <ConfirmDialog
        open={Boolean(pendingBulkAction)}
        title="Apply bulk action?"
        description={`Apply "${pendingBulkAction?.label || ''}" to ${selected.length} selected lead${selected.length === 1 ? '' : 's'}?`}
        confirmLabel="Apply"
        tone="default"
        onConfirm={executeBulkAction}
        onCancel={() => setPendingBulkAction(null)}
      />

      <ConfirmDialog
        open={Boolean(deleteViewId)}
        title="Delete saved view?"
        description="This filter preset will be removed. Your leads are not affected."
        confirmLabel="Delete View"
        onConfirm={async () => {
          if (deleteViewId) await deleteSavedView(deleteViewId);
          setDeleteViewId(null);
        }}
        onCancel={() => setDeleteViewId(null)}
      />
    </AppShell>
  );
}

export default function LeadsPage() {
  return (
    <Suspense
      fallback={
        <AppShell>
          <div className="flex h-64 items-center justify-center text-violet-500">
            <Spinner size={32} />
          </div>
        </AppShell>
      }
    >
      <LeadsPageContent />
    </Suspense>
  );
}
