'use client';

import { Search, Filter, Download, SlidersHorizontal } from 'lucide-react';
import Spinner from '@/components/reachmira/Spinner';

type CampaignOption = { id: string; name: string };
type LeadListOption = { id: string; name: string };

type PendingBulkExtras = Record<string, unknown>;

type ColumnSelectorProps = {
  showColumnDropdown: boolean;
  onToggleDropdown: () => void;
  visibleColumns: Record<string, boolean>;
  onToggleColumn: (key: string, checked: boolean) => void;
};

const COLUMN_OPTIONS = [
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
];

function ColumnSelector({ showColumnDropdown, onToggleDropdown, visibleColumns, onToggleColumn }: ColumnSelectorProps) {
  return (
    <div className="relative">
      <button
        onClick={onToggleDropdown}
        className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 transition"
      >
        <SlidersHorizontal className="h-4 w-4 text-zinc-400" />
        Customize Columns
      </button>
      {showColumnDropdown && (
        <>
          <div className="fixed inset-0 z-20" onClick={onToggleDropdown} />
          <div
            className="absolute right-0 mt-2 z-30 w-56 rounded-2xl border border-[var(--border)] bg-white p-3 shadow-xl ring-1 ring-black ring-opacity-5 max-h-[350px] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-400 px-2">Show Columns</div>
            <div className="space-y-1.5">
              {COLUMN_OPTIONS.map((col) => (
                <label key={col.key} className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-zinc-50 cursor-pointer text-sm text-zinc-700 font-medium transition">
                  <input
                    type="checkbox"
                    checked={!!visibleColumns[col.key]}
                    onChange={(e) => onToggleColumn(col.key, e.target.checked)}
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
  );
}

type BulkActionsBarProps = {
  selectedCount: number;
  bulkLoading: boolean;
  onRunBulkAction: (action: string, extras?: PendingBulkExtras) => void;
  bulkTag: string;
  onBulkTagChange: (value: string) => void;
  bulkPriority: string;
  onBulkPriorityChange: (value: string) => void;
  bulkListId: string;
  onBulkListIdChange: (value: string) => void;
  leadLists: LeadListOption[];
  onExportSelected: () => void;
};

function BulkActionsBar({
  selectedCount,
  bulkLoading,
  onRunBulkAction,
  bulkTag,
  onBulkTagChange,
  bulkPriority,
  onBulkPriorityChange,
  bulkListId,
  onBulkListIdChange,
  leadLists,
  onExportSelected,
}: BulkActionsBarProps) {
  return (
    <div className="mt-4 flex flex-wrap items-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)]/60 p-3">
      <span className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">
        {bulkLoading ? (
          <span className="inline-flex items-center gap-1.5"><Spinner size={12} className="text-violet-500" /> Processing...</span>
        ) : (
          `${selectedCount} selected`
        )}
      </span>
      <button onClick={() => onRunBulkAction('mark_interested')} disabled={bulkLoading} className="rounded-xl bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">Mark Interested</button>
      <button onClick={() => onRunBulkAction('mark_not_interested')} disabled={bulkLoading} className="rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">Mark Not Interested</button>
      <button onClick={() => onRunBulkAction('mark_do_not_contact')} disabled={bulkLoading} className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">Mark Do Not Contact</button>
      <button onClick={() => onRunBulkAction('mark_excluded')} disabled={bulkLoading} className="rounded-xl bg-zinc-100 px-3 py-2 text-xs font-semibold text-zinc-700 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">Mark Excluded</button>
      <button onClick={() => onRunBulkAction('mark_contacted')} disabled={bulkLoading} className="rounded-xl bg-violet-50 px-3 py-2 text-xs font-semibold text-violet-700 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">Mark as Contacted</button>
      <button onClick={() => onRunBulkAction('add_to_campaign')} disabled={bulkLoading} className="rounded-xl bg-violet-50 px-3 py-2 text-xs font-semibold text-violet-700 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">Add to Campaign</button>
      <button onClick={() => onRunBulkAction('verify_selected')} disabled={bulkLoading} className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
        {bulkLoading ? <Spinner size={12} className="text-emerald-600" /> : null}
        Verify Emails
      </button>
      <button onClick={() => onRunBulkAction('deep_verify_selected')} disabled={bulkLoading} className="inline-flex items-center gap-1.5 rounded-xl bg-sky-50 px-3 py-2 text-xs font-semibold text-sky-700 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
        {bulkLoading ? <Spinner size={12} className="text-sky-600" /> : null}
        Deep Verify
      </button>
      <div className="flex items-center gap-2 rounded-xl bg-white px-2 py-1 ring-1 ring-[var(--border)]">
        <input value={bulkTag} onChange={(e) => onBulkTagChange(e.target.value)} placeholder="Tag" className="w-28 bg-transparent px-2 py-1 text-xs outline-none placeholder:text-zinc-400" />
        <button onClick={() => onRunBulkAction('add_tag', { tag: bulkTag })} disabled={bulkLoading} className="rounded-lg bg-teal-50 px-2.5 py-1.5 text-xs font-semibold text-teal-700 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">Add Tag</button>
      </div>
      <div className="flex items-center gap-2 rounded-xl bg-white px-2 py-1 ring-1 ring-[var(--border)]">
        <select value={bulkPriority} onChange={(e) => onBulkPriorityChange(e.target.value)} className="bg-transparent px-2 py-1 text-xs text-zinc-700 outline-none">
          <option value="low">Low</option>
          <option value="normal">Normal</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>
        <button onClick={() => onRunBulkAction('change_priority', { priority: bulkPriority })} disabled={bulkLoading} className="rounded-lg bg-sky-50 px-2.5 py-1.5 text-xs font-semibold text-sky-700 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">Change Priority</button>
      </div>
      <div className="flex items-center gap-2 rounded-xl bg-white px-2 py-1 ring-1 ring-[var(--border)]">
        <select value={bulkListId} onChange={(e) => onBulkListIdChange(e.target.value)} className="bg-transparent px-2 py-1 text-xs text-zinc-700 outline-none">
          <option value="">-- Select List --</option>
          {leadLists.map((list) => <option key={list.id} value={list.id}>{list.name}</option>)}
        </select>
        <button onClick={() => onRunBulkAction('assign_to_list', { leadListId: bulkListId })} disabled={!bulkListId || bulkLoading} className="rounded-lg bg-teal-50 px-2.5 py-1.5 text-xs font-semibold text-teal-700 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed">Assign to List</button>
      </div>
      <button onClick={onExportSelected} disabled={bulkLoading} className="inline-flex items-center gap-1 rounded-xl bg-white px-3 py-2 text-xs font-semibold text-zinc-700 ring-1 ring-[var(--border)] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
        <Download className="h-3.5 w-3.5" /> Export Selected
      </button>
    </div>
  );
}

export type FilterToolbarProps = {
  // Primary row
  search: string;
  onSearchChange: (value: string) => void;
  leadListFilter: string;
  onLeadListFilterChange: (value: string) => void;
  leadLists: LeadListOption[];
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  showAdvancedFilters: boolean;
  onToggleAdvancedFilters: () => void;
  onApply: () => void;

  // Advanced filters
  readinessFilter: string;
  onReadinessFilterChange: (value: string) => void;
  priorityFilter: string;
  onPriorityFilterChange: (value: string) => void;
  aiStatusFilter: string;
  onAiStatusFilterChange: (value: string) => void;
  emailStatusFilter: string;
  onEmailStatusFilterChange: (value: string) => void;
  qualityFilter: string;
  onQualityFilterChange: (value: string) => void;
  emailTypeFilter: string;
  onEmailTypeFilterChange: (value: string) => void;
  industryFilter: string;
  onIndustryFilterChange: (value: string) => void;
  countryFilter: string;
  onCountryFilterChange: (value: string) => void;
  tagFilter: string;
  onTagFilterChange: (value: string) => void;
  repliedFilter: string;
  onRepliedFilterChange: (value: string) => void;
  followUpStageFilter: string;
  onFollowUpStageFilterChange: (value: string) => void;
  contactGuardFilter: string;
  onContactGuardFilterChange: (value: string) => void;
  lastContactedFrom: string;
  onLastContactedFromChange: (value: string) => void;
  lastContactedTo: string;
  onLastContactedToChange: (value: string) => void;
  campaignId: string;
  onCampaignIdChange: (value: string) => void;
  campaigns: CampaignOption[];
  followUpDueFilter: boolean;
  onFollowUpDueFilterChange: (checked: boolean) => void;
  missingPainFilter: boolean;
  onMissingPainFilterChange: (checked: boolean) => void;
  missingSolutionFilter: boolean;
  onMissingSolutionFilterChange: (checked: boolean) => void;
  notContactedFilter: boolean;
  onNotContactedFilterChange: (checked: boolean) => void;

  // Results / column selector / page size
  filteredCount: number;
  showColumnDropdown: boolean;
  onToggleColumnDropdown: () => void;
  visibleColumns: Record<string, boolean>;
  onToggleColumn: (key: string, checked: boolean) => void;
  pageSize: number;
  onPageSizeChange: (size: number) => void;

  // Bulk actions bar
  selectedCount: number;
  bulkLoading: boolean;
  onRunBulkAction: (action: string, extras?: PendingBulkExtras) => void;
  bulkTag: string;
  onBulkTagChange: (value: string) => void;
  bulkPriority: string;
  onBulkPriorityChange: (value: string) => void;
  bulkListId: string;
  onBulkListIdChange: (value: string) => void;
  onExportSelected: () => void;
};

const STATUS_OPTIONS = ['new', 'imported', 'data_reviewed', 'ai_generated', 'manual_email_draft', 'email_approved', 'mail_sent', 'manual_email_sent', 'follow_up_1_sent', 'follow_up_2_sent', 'follow_up_3_sent', 'replied', 'interested', 'not_interested', 'demo_scheduled', 'proposal_sent', 'won', 'lost', 'bounced', 'unsubscribed', 'do_not_contact', 'excluded'];

export default function FilterToolbar({
  search, onSearchChange,
  leadListFilter, onLeadListFilterChange, leadLists,
  statusFilter, onStatusFilterChange,
  showAdvancedFilters, onToggleAdvancedFilters, onApply,
  readinessFilter, onReadinessFilterChange,
  priorityFilter, onPriorityFilterChange,
  aiStatusFilter, onAiStatusFilterChange,
  emailStatusFilter, onEmailStatusFilterChange,
  qualityFilter, onQualityFilterChange,
  emailTypeFilter, onEmailTypeFilterChange,
  industryFilter, onIndustryFilterChange,
  countryFilter, onCountryFilterChange,
  tagFilter, onTagFilterChange,
  repliedFilter, onRepliedFilterChange,
  followUpStageFilter, onFollowUpStageFilterChange,
  contactGuardFilter, onContactGuardFilterChange,
  lastContactedFrom, onLastContactedFromChange,
  lastContactedTo, onLastContactedToChange,
  campaignId, onCampaignIdChange, campaigns,
  followUpDueFilter, onFollowUpDueFilterChange,
  missingPainFilter, onMissingPainFilterChange,
  missingSolutionFilter, onMissingSolutionFilterChange,
  notContactedFilter, onNotContactedFilterChange,
  filteredCount,
  showColumnDropdown, onToggleColumnDropdown, visibleColumns, onToggleColumn,
  pageSize, onPageSizeChange,
  selectedCount, bulkLoading, onRunBulkAction,
  bulkTag, onBulkTagChange, bulkPriority, onBulkPriorityChange, bulkListId, onBulkListIdChange,
  onExportSelected,
}: FilterToolbarProps) {
  return (
    <section className="rounded-3xl border border-[var(--border)] bg-white p-5 shadow-[0_12px_40px_rgba(15,23,42,0.04)]">
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-12">
        <div className="flex items-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 lg:col-span-4">
          <Search className="h-4 w-4 text-zinc-400" />
          <input value={search} onChange={(e) => onSearchChange(e.target.value)} placeholder="Search leads..." className="w-full bg-transparent text-sm outline-none placeholder:text-zinc-400" />
        </div>
        <select value={leadListFilter} onChange={(e) => onLeadListFilterChange(e.target.value)} className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 text-sm text-zinc-700 lg:col-span-3">
          <option value="all">All Lead Lists</option>
          {leadLists.map((list) => <option key={list.id} value={list.id}>{list.name}</option>)}
        </select>
        <select value={statusFilter} onChange={(e) => onStatusFilterChange(e.target.value)} className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 text-sm text-zinc-700 lg:col-span-2">
          <option value="all">All Statuses</option>
          {STATUS_OPTIONS.map((status) => <option key={status} value={status}>{status.replace(/_/g, ' ')}</option>)}
        </select>
        <button
          onClick={onToggleAdvancedFilters}
          className={`inline-flex items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-semibold transition cursor-pointer lg:col-span-2 ${showAdvancedFilters ? 'bg-zinc-100 text-zinc-900 border-zinc-300' : 'bg-white text-zinc-700 border-[var(--border)] hover:bg-zinc-50'}`}
        >
          <Filter className="h-4 w-4" />
          {showAdvancedFilters ? 'Less Filters' : 'More Filters'}
        </button>
        <button onClick={onApply} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-zinc-950 px-4 py-3 text-sm font-semibold text-white hover:bg-zinc-800 cursor-pointer lg:col-span-1">
          Apply
        </button>
      </div>

      {showAdvancedFilters && (
        <div className="mt-4 space-y-4 border-t border-[var(--border)] pt-4">
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 px-1">Readiness</span>
              <select value={readinessFilter} onChange={(e) => onReadinessFilterChange(e.target.value)} className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 text-sm text-zinc-700">
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
              <select value={priorityFilter} onChange={(e) => onPriorityFilterChange(e.target.value)} className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 text-sm text-zinc-700">
                <option value="all">All Priorities</option>
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 px-1">AI Status</span>
              <select value={aiStatusFilter} onChange={(e) => onAiStatusFilterChange(e.target.value)} className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 text-sm text-zinc-700">
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
              <select value={emailStatusFilter} onChange={(e) => onEmailStatusFilterChange(e.target.value)} className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 text-sm text-zinc-700">
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
              <select value={qualityFilter} onChange={(e) => onQualityFilterChange(e.target.value)} className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 text-sm text-zinc-700">
                <option value="all">All Data Quality</option>
                <option value="poor">Poor</option>
                <option value="fair">Fair</option>
                <option value="good">Good</option>
                <option value="excellent">Excellent</option>
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 px-1">Last Email Type</span>
              <select value={emailTypeFilter} onChange={(e) => onEmailTypeFilterChange(e.target.value)} className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 text-sm text-zinc-700">
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
              <input value={industryFilter} onChange={(e) => onIndustryFilterChange(e.target.value)} placeholder="Industry filter" className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 text-sm text-zinc-700 outline-none placeholder:text-zinc-400" />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 px-1">Country</span>
              <input value={countryFilter} onChange={(e) => onCountryFilterChange(e.target.value)} placeholder="Country filter" className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 text-sm text-zinc-700 outline-none placeholder:text-zinc-400" />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 px-1">Tags</span>
              <input value={tagFilter} onChange={(e) => onTagFilterChange(e.target.value)} placeholder="Tag filter" className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 text-sm text-zinc-700 outline-none placeholder:text-zinc-400" />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 px-1">Reply State</span>
              <select value={repliedFilter} onChange={(e) => onRepliedFilterChange(e.target.value)} className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 text-sm text-zinc-700">
                <option value="all">Reply State</option>
                <option value="yes">Replied</option>
                <option value="no">Not Replied</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 px-1">Follow-up Stage</span>
              <select value={followUpStageFilter} onChange={(e) => onFollowUpStageFilterChange(e.target.value)} className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 text-sm text-zinc-700">
                <option value="all">Follow-up Stage</option>
                <option value="0">None</option>
                <option value="1">Stage 1</option>
                <option value="2">Stage 2</option>
                <option value="3">Stage 3</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 px-1">Safety &amp; Campaign</span>
              <select value={contactGuardFilter} onChange={(e) => onContactGuardFilterChange(e.target.value)} className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 text-sm text-zinc-700">
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
                <input type="date" value={lastContactedFrom} onChange={(e) => onLastContactedFromChange(e.target.value)} className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 text-sm text-zinc-700" aria-label="Last contacted from" />
                <input type="date" value={lastContactedTo} onChange={(e) => onLastContactedToChange(e.target.value)} className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 text-sm text-zinc-700" aria-label="Last contacted to" />
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 px-1">Campaign</span>
              <select value={campaignId} onChange={(e) => onCampaignIdChange(e.target.value)} className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 text-sm text-zinc-700">
                {campaigns.map((campaign) => <option key={campaign.id} value={campaign.id}>{campaign.name}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 px-1">Outreach Statuses</span>
              <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 h-full">
                <label className="inline-flex items-center gap-2 text-sm font-medium text-zinc-700 cursor-pointer">
                  <input type="checkbox" checked={followUpDueFilter} onChange={(e) => onFollowUpDueFilterChange(e.target.checked)} className="rounded border-zinc-300 text-violet-600 focus:ring-violet-500" />
                  Follow-up Due
                </label>
                <label className="inline-flex items-center gap-2 text-sm font-medium text-zinc-700 cursor-pointer">
                  <input type="checkbox" checked={missingPainFilter} onChange={(e) => onMissingPainFilterChange(e.target.checked)} className="rounded border-zinc-300 text-violet-600 focus:ring-violet-500" />
                  Missing Pain Point
                </label>
                <label className="inline-flex items-center gap-2 text-sm font-medium text-zinc-700 cursor-pointer">
                  <input type="checkbox" checked={missingSolutionFilter} onChange={(e) => onMissingSolutionFilterChange(e.target.checked)} className="rounded border-zinc-300 text-violet-600 focus:ring-violet-500" />
                  Missing Solution Angle
                </label>
                <label className="inline-flex items-center gap-2 text-sm font-medium text-zinc-700 cursor-pointer">
                  <input type="checkbox" checked={notContactedFilter} onChange={(e) => onNotContactedFilterChange(e.target.checked)} className="rounded border-zinc-300 text-violet-600 focus:ring-violet-500" />
                  Not Contacted
                </label>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3">
        <div className="text-sm text-zinc-500">
          {filteredCount} lead{filteredCount === 1 ? '' : 's'} found
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <ColumnSelector
            showColumnDropdown={showColumnDropdown}
            onToggleDropdown={onToggleColumnDropdown}
            visibleColumns={visibleColumns}
            onToggleColumn={onToggleColumn}
          />

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400">Page size</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
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

      {selectedCount > 0 && (
        <BulkActionsBar
          selectedCount={selectedCount}
          bulkLoading={bulkLoading}
          onRunBulkAction={onRunBulkAction}
          bulkTag={bulkTag}
          onBulkTagChange={onBulkTagChange}
          bulkPriority={bulkPriority}
          onBulkPriorityChange={onBulkPriorityChange}
          bulkListId={bulkListId}
          onBulkListIdChange={onBulkListIdChange}
          leadLists={leadLists}
          onExportSelected={onExportSelected}
        />
      )}
    </section>
  );
}
