'use client';

export const dynamic = 'force-dynamic';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowUpRight, Sparkles, MailPlus } from 'lucide-react';
import AppShell from '@/components/reachmira/AppShell';
import PageHeader from '@/components/reachmira/PageHeader';
import Spinner from '@/components/reachmira/Spinner';
import LeadsDialogs from '@/components/leads-page/LeadsDialogs';
import SavedViewsBar from '@/components/leads-page/SavedViewsBar';
import FilterToolbar from '@/components/leads-page/FilterToolbar';
import LeadsTable from '@/components/leads-page/LeadsTable';
import { useToast } from '@/lib/toast/toast-context';
import { useSavedViews } from '@/hooks/useSavedViews';
import { useLeadsFilters } from '@/hooks/useLeadsFilters';

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

function LeadsPageContent() {
  const supabase = createClient();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignOption[]>([]);
  const [leadLists, setLeadLists] = useState<LeadListOption[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const {
    search, setSearch,
    statusFilter, setStatusFilter,
    priorityFilter, setPriorityFilter,
    aiStatusFilter, setAiStatusFilter,
    emailStatusFilter, setEmailStatusFilter,
    readinessFilter, setReadinessFilter,
    qualityFilter, setQualityFilter,
    leadListFilter, setLeadListFilter,
    industryFilter, setIndustryFilter,
    countryFilter, setCountryFilter,
    tagFilter, setTagFilter,
    lastContactedFrom, setLastContactedFrom,
    lastContactedTo, setLastContactedTo,
    emailTypeFilter, setEmailTypeFilter,
    repliedFilter, setRepliedFilter,
    followUpStageFilter, setFollowUpStageFilter,
    followUpDueFilter, setFollowUpDueFilter,
    missingPainFilter, setMissingPainFilter,
    missingSolutionFilter, setMissingSolutionFilter,
    notContactedFilter, setNotContactedFilter,
    contactGuardFilter, setContactGuardFilter,
    currentFilters,
    setFilters,
  } = useLeadsFilters(searchParams);
  const [campaignId, setCampaignId] = useState('');
  const [bulkTag, setBulkTag] = useState('');
  const [bulkPriority, setBulkPriority] = useState('normal');
  const [bulkListId, setBulkListId] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);
  const [totalLeads, setTotalLeads] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [bulkLoading, setBulkLoading] = useState(false);
  const toast = useToast();
  const [prevFiltersStr, setPrevFiltersStr] = useState('');

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

  const {
    savedViews,
    activeViewId,
    showSaveViewModal,
    setShowSaveViewModal,
    newViewName,
    setNewViewName,
    savingView,
    deleteViewId,
    setDeleteViewId,
    applyPresetView,
    applyCustomView,
    loadSavedViews,
    saveCurrentView,
    setDefaultView,
    deleteSavedView,
  } = useSavedViews({ searchParams, currentFilters, setFilters });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const filtersObj = {
        search, statusFilter, priorityFilter, aiStatusFilter, emailStatusFilter,
        readinessFilter, leadListFilter, industryFilter, countryFilter, tagFilter,
        lastContactedFrom, lastContactedTo, followUpDueFilter, missingPainFilter,
        missingSolutionFilter, notContactedFilter, emailTypeFilter, repliedFilter,
        followUpStageFilter, contactGuardFilter
      };
      const currentFiltersStr = JSON.stringify(filtersObj);
      
      let pageToFetch = currentPage;
      if (currentFiltersStr !== prevFiltersStr) {
        pageToFetch = 1;
        setCurrentPage(1);
        setPrevFiltersStr(currentFiltersStr);
      }

      const params = new URLSearchParams();
      params.set('page', pageToFetch.toString());
      params.set('limit', pageSize.toString());
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
      setTotalLeads(leadsResponse.data?.total || 0);
      setCampaigns(campaignResponse.data || []);
      setLeadLists(Array.isArray(leadListsResponse.data?.leadLists) ? leadListsResponse.data.leadLists : []);
      setCampaignId(campaignResponse.data?.[0]?.id || '');
    } catch (loadError: unknown) {
      toast.error(loadError instanceof Error ? loadError.message : 'Failed to load leads');
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aiStatusFilter, contactGuardFilter, countryFilter, emailStatusFilter, emailTypeFilter, followUpDueFilter, industryFilter, lastContactedFrom, lastContactedTo, leadListFilter, missingPainFilter, missingSolutionFilter, notContactedFilter, priorityFilter, readinessFilter, repliedFilter, search, statusFilter, supabase, followUpStageFilter, tagFilter, currentPage, pageSize, prevFiltersStr]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadData();
    loadSavedViews();
  }, [loadData, loadSavedViews]);

  const filteredLeads = useMemo(() => {
    if (qualityFilter === 'all') return leads;
    return leads.filter((lead) => lead.data_quality_label === qualityFilter);
  }, [leads, qualityFilter]);

  const totalPages = Math.max(1, Math.ceil(totalLeads / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedLeads = filteredLeads;

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

      <SavedViewsBar
        activeViewId={activeViewId}
        savedViews={savedViews}
        onApplyPresetView={applyPresetView}
        onApplyCustomView={applyCustomView}
        onSetDefaultView={setDefaultView}
        onRequestDeleteView={setDeleteViewId}
        showSaveViewModal={showSaveViewModal}
        onOpenSaveViewModal={() => setShowSaveViewModal(true)}
        onCloseSaveViewModal={() => setShowSaveViewModal(false)}
        newViewName={newViewName}
        onNewViewNameChange={setNewViewName}
        onSaveCurrentView={saveCurrentView}
        savingView={savingView}
      />

      <FilterToolbar
        search={search}
        onSearchChange={setSearch}
        leadListFilter={leadListFilter}
        onLeadListFilterChange={setLeadListFilter}
        leadLists={leadLists}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        showAdvancedFilters={showAdvancedFilters}
        onToggleAdvancedFilters={() => setShowAdvancedFilters(!showAdvancedFilters)}
        onApply={loadData}
        readinessFilter={readinessFilter}
        onReadinessFilterChange={setReadinessFilter}
        priorityFilter={priorityFilter}
        onPriorityFilterChange={setPriorityFilter}
        aiStatusFilter={aiStatusFilter}
        onAiStatusFilterChange={setAiStatusFilter}
        emailStatusFilter={emailStatusFilter}
        onEmailStatusFilterChange={setEmailStatusFilter}
        qualityFilter={qualityFilter}
        onQualityFilterChange={setQualityFilter}
        emailTypeFilter={emailTypeFilter}
        onEmailTypeFilterChange={setEmailTypeFilter}
        industryFilter={industryFilter}
        onIndustryFilterChange={setIndustryFilter}
        countryFilter={countryFilter}
        onCountryFilterChange={setCountryFilter}
        tagFilter={tagFilter}
        onTagFilterChange={setTagFilter}
        repliedFilter={repliedFilter}
        onRepliedFilterChange={setRepliedFilter}
        followUpStageFilter={followUpStageFilter}
        onFollowUpStageFilterChange={setFollowUpStageFilter}
        contactGuardFilter={contactGuardFilter}
        onContactGuardFilterChange={setContactGuardFilter}
        lastContactedFrom={lastContactedFrom}
        onLastContactedFromChange={setLastContactedFrom}
        lastContactedTo={lastContactedTo}
        onLastContactedToChange={setLastContactedTo}
        campaignId={campaignId}
        onCampaignIdChange={setCampaignId}
        campaigns={campaigns}
        followUpDueFilter={followUpDueFilter}
        onFollowUpDueFilterChange={setFollowUpDueFilter}
        missingPainFilter={missingPainFilter}
        onMissingPainFilterChange={setMissingPainFilter}
        missingSolutionFilter={missingSolutionFilter}
        onMissingSolutionFilterChange={setMissingSolutionFilter}
        notContactedFilter={notContactedFilter}
        onNotContactedFilterChange={setNotContactedFilter}
        filteredCount={filteredLeads.length}
        showColumnDropdown={showColumnDropdown}
        onToggleColumnDropdown={() => setShowColumnDropdown(!showColumnDropdown)}
        visibleColumns={visibleColumns}
        onToggleColumn={(key, checked) => setVisibleColumns((prev) => ({ ...prev, [key]: checked }))}
        pageSize={pageSize}
        onPageSizeChange={(size) => {
          setPageSize(size);
          setCurrentPage(1);
        }}
        selectedCount={selected.length}
        bulkLoading={bulkLoading}
        onRunBulkAction={runBulkAction}
        bulkTag={bulkTag}
        onBulkTagChange={setBulkTag}
        bulkPriority={bulkPriority}
        onBulkPriorityChange={setBulkPriority}
        bulkListId={bulkListId}
        onBulkListIdChange={setBulkListId}
        onExportSelected={exportSelectedLeads}
      />

      <LeadsTable
        loading={loading}
        leads={paginatedLeads}
        visibleColumns={visibleColumns}
        selected={selected}
        onToggleSelected={toggleSelected}
        currentPage={safeCurrentPage}
        totalPages={totalPages}
        totalItems={totalLeads}
        pageSize={pageSize}
        onPageChange={setCurrentPage}
      />

      <LeadsDialogs
        pendingBulkAction={pendingBulkAction}
        selectedCount={selected.length}
        onConfirmBulkAction={executeBulkAction}
        onCancelBulkAction={() => setPendingBulkAction(null)}
        deleteViewId={deleteViewId}
        onConfirmDeleteView={async () => {
          if (deleteViewId) await deleteSavedView(deleteViewId);
          setDeleteViewId(null);
        }}
        onCancelDeleteView={() => setDeleteViewId(null)}
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
