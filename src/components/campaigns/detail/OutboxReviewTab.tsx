'use client';

import { Sparkles } from 'lucide-react';
import Spinner from '@/components/reachmira/Spinner';
import CampaignPagination from '@/components/campaigns/detail/CampaignPagination';

type ReviewFilter = 'all' | 'pending_review' | 'approved' | 'skipped';

const REVIEW_FILTER_OPTIONS: Array<{ id: ReviewFilter; label: string }> = [
  { id: 'pending_review', label: 'Pending Review' },
  { id: 'approved', label: 'Approved' },
  { id: 'skipped', label: 'Skipped' },
  { id: 'all', label: 'All AI Generated' },
];

type OutboxReviewTabProps = {
  leads: any[];
  reviewFilter: ReviewFilter;
  onSelectReviewFilter: (filter: ReviewFilter) => void;
  pendingBulkApprovalCount: number;
  onRequestBulkApprove: () => void;
  reviewLeads: any[];
  paginatedReviewLeads: any[];
  selectedLeadId: string | null;
  onSelectLead: (leadId: string) => void;
  reviewPage: number;
  reviewTotalPages: number;
  pageSize: number;
  onReviewPageChange: (page: number) => void;
  selectedLead: any | null;
  editedSubject: string;
  onEditedSubjectChange: (value: string) => void;
  editedBody: string;
  onEditedBodyChange: (value: string) => void;
  approvingLeadId: string | null;
  onApproveLead: (leadId: string, action: 'approve' | 'skip') => void;
  onGoToPersonalize: () => void;
};

export default function OutboxReviewTab({
  leads,
  reviewFilter,
  onSelectReviewFilter,
  pendingBulkApprovalCount,
  onRequestBulkApprove,
  reviewLeads,
  paginatedReviewLeads,
  selectedLeadId,
  onSelectLead,
  reviewPage,
  reviewTotalPages,
  pageSize,
  onReviewPageChange,
  selectedLead,
  editedSubject,
  onEditedSubjectChange,
  editedBody,
  onEditedBodyChange,
  approvingLeadId,
  onApproveLead,
  onGoToPersonalize,
}: OutboxReviewTabProps) {
  return (
    <div className="space-y-6">
      {/* Review Header / Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white/40 p-4 border border-[var(--border)] rounded-xl backdrop-blur-sm">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-zinc-600 font-semibold uppercase tracking-wider mr-2">Filter Leads:</span>
          {REVIEW_FILTER_OPTIONS.map((btn) => (
            <button
              key={btn.id}
              onClick={() => onSelectReviewFilter(btn.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                reviewFilter === btn.id
                  ? 'bg-violet-600/10 text-violet-400 border-violet-500/20'
                  : 'bg-white border-[var(--border)] text-zinc-600 hover:text-zinc-900'
              }`}
            >
              {btn.label}
            </button>
          ))}
        </div>

        <button
          onClick={onRequestBulkApprove}
          disabled={approvingLeadId === 'bulk' || pendingBulkApprovalCount === 0}
          className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-violet-600 to-teal-500 rounded-lg text-xs font-semibold text-white hover:opacity-90 shadow-md shadow-violet-500/10 disabled:opacity-50 cursor-pointer"
        >
          <Sparkles className="h-4 w-4" /> Bulk Approve All Pending
        </button>
      </div>

      {leads.filter((l) => l.personalization_strategy).length === 0 ? (
        <div className="flex flex-col items-center justify-center h-72 border border-dashed border-[var(--border)] rounded-xl p-8 bg-white/10 text-center">
          <Sparkles className="h-10 w-10 text-zinc-700 mb-3 animate-pulse" />
          <h4 className="text-sm font-semibold text-zinc-700">No AI-Personalized Leads Found</h4>
          <p className="text-xs text-zinc-500 max-w-sm mt-1">
            Run AI Personalization on your imported leads first to review custom strategy, subjects, and email drafts here.
          </p>
          <button
            onClick={onGoToPersonalize}
            className="mt-4 text-xs font-semibold text-violet-400 hover:text-violet-300 transition-colors"
          >
            Go to AI Personalization &rarr;
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Leads List Side Pane */}
          <div className="lg:col-span-1 rounded-xl border border-[var(--border)] bg-white/20 p-4 backdrop-blur-sm h-[600px] flex flex-col">
            <div className="mb-3">
              <h4 className="font-bold text-white text-sm">Personalized Leads ({reviewLeads.length})</h4>
              <p className="text-[11px] text-zinc-500">Select a lead to edit and approve their outreach email.</p>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {paginatedReviewLeads.map((lead) => {
                const isSelected = selectedLeadId === lead.id;
                return (
                  <button
                    key={lead.id}
                    onClick={() => onSelectLead(lead.id)}
                    className={`w-full text-left p-3 rounded-lg border transition-all cursor-pointer flex flex-col gap-1 ${
                      isSelected
                        ? 'bg-white border-violet-500/50 shadow-md shadow-violet-500/5'
                        : 'bg-white/40 border-[var(--border)] hover:bg-white/30'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="text-xs font-semibold text-zinc-900 truncate max-w-[120px]">
                        {lead.first_name || lead.last_name
                          ? `${lead.first_name || ''} ${lead.last_name || ''}`.trim()
                          : lead.email.split('@')[0]}
                      </span>
                      <span className={`inline-flex px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                        lead.approval_status === 'approved'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : lead.approval_status === 'skipped'
                          ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                          : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                      }`}>
                        {lead.approval_status === 'pending_review' ? 'pending' : lead.approval_status}
                      </span>
                    </div>
                    <span className="text-[10px] text-zinc-600 truncate w-full">{lead.company_name || lead.company || lead.email}</span>
                    {lead.personalization_strategy && (
                      <span className="text-[10px] text-violet-400 italic truncate w-full mt-0.5" title={lead.personalization_strategy}>
                        {lead.personalization_strategy}
                      </span>
                    )}
                  </button>
                );
              })}

              {reviewLeads.length === 0 && (
                <div className="flex items-center justify-center h-48 text-zinc-500 text-xs">
                  No leads matching this filter.
                </div>
              )}
            </div>
            {reviewLeads.length > pageSize && (
              <CampaignPagination
                currentPage={reviewPage}
                totalPages={reviewTotalPages}
                totalItems={reviewLeads.length}
                pageSize={pageSize}
                onPageChange={onReviewPageChange}
              />
            )}
          </div>

          {/* Lead Detail & Actions Pane */}
          <div className="lg:col-span-2 rounded-xl border border-[var(--border)] bg-white/20 p-6 backdrop-blur-sm h-[600px] flex flex-col">
            {selectedLead ? (
              <div className="flex flex-col h-full justify-between">
                <div className="space-y-4 overflow-y-auto pr-1">
                  {/* Profile Info Row */}
                  <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-[var(--border)]/80">
                    <div>
                      <h3 className="font-bold text-white text-base">
                        {selectedLead.first_name || ''} {selectedLead.last_name || ''}
                      </h3>
                      <p className="text-xs text-zinc-600">{selectedLead.decision_maker_title || 'Decision Maker'} at <span className="text-violet-400 font-semibold">{selectedLead.company_name || selectedLead.company || 'Unknown Company'}</span></p>
                    </div>
                    <div className="text-right text-xs text-zinc-600 space-y-1">
                      <div>Email: <span className="font-mono text-zinc-700">{selectedLead.email}</span></div>
                      {selectedLead.website && (
                        <div>Website: <a href={selectedLead.website.startsWith('http') ? selectedLead.website : `https://${selectedLead.website}`} target="_blank" rel="noreferrer" className="text-violet-400 hover:underline inline-flex items-center gap-0.5">{selectedLead.website}</a></div>
                      )}
                    </div>
                  </div>

                  {/* Tech Stack & Pain Points */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {selectedLead.tech_stack && (
                      <div className="p-3 bg-white/60 rounded-lg border border-[var(--border)] text-xs">
                        <span className="block text-[10px] uppercase font-bold text-zinc-500 mb-1">Tech Stack</span>
                        <span className="text-zinc-700">{selectedLead.tech_stack}</span>
                      </div>
                    )}
                    {selectedLead.pain_points && (
                      <div className="p-3 bg-white/60 rounded-lg border border-[var(--border)] text-xs">
                        <span className="block text-[10px] uppercase font-bold text-zinc-500 mb-1">Pain Points / Trigger</span>
                        <span className="text-zinc-700">{selectedLead.pain_points}</span>
                      </div>
                    )}
                    {selectedLead.solution && (
                      <div className="p-3 bg-white/60 rounded-lg border border-[var(--border)] text-xs md:col-span-2">
                        <span className="block text-[10px] uppercase font-bold text-zinc-500 mb-1">Solution / Offer</span>
                        <span className="text-zinc-700">{selectedLead.solution}</span>
                      </div>
                    )}
                  </div>

                  {/* AI Strategy Box */}
                  <div className="rounded-lg bg-gradient-to-r from-violet-50 to-teal-50 border border-violet-500/20 p-4">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-violet-400 uppercase tracking-wider mb-1.5">
                      <Sparkles className="h-4 w-4" /> Outreach Strategy
                    </div>
                    <p className="text-xs text-zinc-700 leading-relaxed italic">
                      "{selectedLead.personalization_strategy}"
                    </p>
                  </div>

                  {/* Inputs */}
                  <div className="space-y-3 pt-2">
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Outreach Subject Line</label>
                      <input
                        type="text"
                        value={editedSubject}
                        onChange={(e) => onEditedSubjectChange(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-[var(--border)] bg-white py-2 px-3 text-xs text-zinc-900 focus:border-violet-500 focus:outline-none transition-colors"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Email Body (Markdown/HTML)</label>
                      <textarea
                        rows={8}
                        value={editedBody}
                        onChange={(e) => onEditedBodyChange(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-[var(--border)] bg-white py-2.5 px-3 text-xs text-zinc-900 focus:border-violet-500 focus:outline-none transition-colors font-sans leading-relaxed"
                      />
                    </div>
                  </div>
                </div>

                {/* Detail Buttons Row */}
                <div className="flex items-center justify-between border-t border-[var(--border)] pt-4 mt-4">
                  <button
                    onClick={() => onApproveLead(selectedLead.id, 'skip')}
                    disabled={approvingLeadId !== null}
                    className="px-4 py-2 border border-[var(--border)] hover:bg-rose-500/5 hover:border-rose-500/20 text-xs font-semibold text-zinc-600 hover:text-rose-400 rounded-lg transition-all cursor-pointer disabled:opacity-50"
                  >
                    Skip Prospect
                  </button>

                  <div className="flex items-center gap-3">
                    {selectedLead.approval_status === 'approved' && (
                      <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1">
                        Approved & Queued
                      </span>
                    )}
                    <button
                      onClick={() => onApproveLead(selectedLead.id, 'approve')}
                      disabled={approvingLeadId !== null || !editedSubject || !editedBody}
                      className="px-5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 rounded-lg text-xs font-semibold text-white hover:opacity-90 shadow-md shadow-emerald-500/10 cursor-pointer disabled:opacity-50"
                    >
                      {approvingLeadId === selectedLead.id ? (
                        <Spinner size={16} className="text-white" />
                      ) : selectedLead.approval_status === 'approved' ? (
                        'Save changes'
                      ) : (
                        'Approve & Queue Send'
                      )}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-zinc-500 text-xs text-center">
                <Sparkles className="h-8 w-8 text-zinc-700 mb-2" />
                Select a prospect from the review queue side pane to draft their email.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
