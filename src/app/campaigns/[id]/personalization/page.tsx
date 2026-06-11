'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, use } from 'react';
import { createClient } from '@/utils/supabase/client';
import AppShell from '@/components/reachmira/AppShell';
import PageHeader from '@/components/reachmira/PageHeader';
import { 
  ArrowLeft, 
  Sparkles, 
  Check, 
  X, 
  Eye, 
  Edit3, 
  Mail, 
  Trash2, 
  SlidersHorizontal,
  CheckSquare,
  Square,
  AlertCircle
} from 'lucide-react';
import Link from 'next/link';
import Spinner from '@/components/reachmira/Spinner';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function PersonalizationReviewPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const campaignId = resolvedParams.id;
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [campaign, setCampaign] = useState<any>(null);
  const [leads, setLeads] = useState<any[]>([]);
  const [selectedLeads, setSelectedLeads] = useState<string[]>([]);
  
  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<boolean>(false);
  const [scoreFilter, setScoreFilter] = useState<boolean>(false);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 12;

  // Modal Editing States
  const [activeLead, setActiveLead] = useState<any | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  
  // Field Editing States
  const [editedSubject, setEditedSubject] = useState('');
  const [editedBody, setEditedBody] = useState('');
  const [editedFirstLine, setEditedFirstLine] = useState('');
  const [editedCta, setEditedCta] = useState('');
  const [editedAngle, setEditedAngle] = useState('');
  const [editedNotes, setEditedNotes] = useState('');
  
  // Status/Notifications
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [bulkActionType, setBulkActionType] = useState('');
  const [bulkApproveModalOpen, setBulkApproveModalOpen] = useState(false);

  useEffect(() => {
    loadData();
  }, [campaignId]);

  const loadData = async () => {
    try {
      const { data: camp } = await supabase
        .from('campaigns')
        .select('*')
        .eq('id', campaignId)
        .single();
      setCampaign(camp);

      const { data: leadList } = await supabase
        .from('leads')
        .select('*')
        .eq('campaign_id', campaignId)
        .order('created_at', { ascending: false });
      setLeads(leadList || []);
    } catch (err: any) {
      setError(err.message || 'Error loading dashboard data');
    } finally {
      setLoading(false);
    }
  };

  // Open Edit Modal
  const openEditModal = (lead: any) => {
    setActiveLead(lead);
    setEditedSubject(lead.ai_subject || lead.personalized_subject || '');
    setEditedBody(lead.ai_email_body || lead.personalized_body || '');
    setEditedFirstLine(lead.ai_personalized_first_line || '');
    setEditedCta(lead.ai_cta || '');
    setEditedAngle(lead.ai_solution_angle || '');
    setEditedNotes(lead.notes || '');
    setModalOpen(true);
  };

  // Save Edits
  const handleSaveEdits = async () => {
    if (!activeLead) return;
    setProcessing(true);
    setError(null);

    try {
      const isActuallyChanged = 
        editedSubject !== activeLead.ai_subject ||
        editedBody !== activeLead.ai_email_body ||
        editedFirstLine !== activeLead.ai_personalized_first_line ||
        editedCta !== activeLead.ai_cta ||
        editedAngle !== activeLead.ai_solution_angle ||
        editedNotes !== activeLead.notes;

      const updates: Record<string, any> = {
        ai_subject: editedSubject,
        ai_email_body: editedBody,
        ai_personalized_first_line: editedFirstLine,
        ai_cta: editedCta,
        ai_solution_angle: editedAngle,
        notes: editedNotes,
        updated_at: new Date().toISOString()
      };

      if (isActuallyChanged) {
        updates.ai_status = 'edited';
        updates.ai_edited_at = new Date().toISOString();
      }

      const { error: updateError } = await supabase
        .from('leads')
        .update(updates)
        .eq('id', activeLead.id);

      if (updateError) throw updateError;

      setSuccess('Lead email updated successfully.');
      setModalOpen(false);
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Error saving edits');
    } finally {
      setProcessing(false);
    }
  };

  // Approve Lead
  const handleApproveLead = async (leadId: string) => {
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch(`/api/campaigns/${campaignId}/approve-lead`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId, action: 'approve' }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to approve lead');
      setSuccess('Lead approved and queued in outbox.');
      await loadData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Skip / Exclude Lead
  const handleExcludeLead = async (leadId: string) => {
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch(`/api/campaigns/${campaignId}/approve-lead`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId, action: 'skip' }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to exclude lead');
      setSuccess('Lead excluded from campaign.');
      await loadData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Regenerate Lead
  const handleRegenerateLead = async (leadId: string) => {
    setError(null);
    setSuccess(null);
    setProcessing(true);
    try {
      const response = await fetch('/api/ai/analyze-lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId, campaignId }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to regenerate email');
      setSuccess(data.skipped ? `Lead skipped: ${data.reason || 'local fallback used'}` : 'Lead personalization regenerated successfully.');
      await loadData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setProcessing(false);
    }
  };

  // Bulk Actions Executor
  const handleBulkAction = async (action: 'approve' | 'regenerate' | 'exclude') => {
    if (selectedLeads.length === 0) return;
    setBulkApproveModalOpen(false);
    setProcessing(true);
    setBulkActionType(action);
    setError(null);
    setSuccess(null);

    try {
      let successCount = 0;
      for (const leadId of selectedLeads) {
        if (action === 'approve') {
          const response = await fetch(`/api/campaigns/${campaignId}/approve-lead`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ leadId, action: 'approve' }),
          });
          if (response.ok) successCount++;
        } else if (action === 'exclude') {
          const response = await fetch(`/api/campaigns/${campaignId}/approve-lead`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ leadId, action: 'skip' }),
          });
          if (response.ok) successCount++;
        } else if (action === 'regenerate') {
          const response = await fetch('/api/ai/analyze-lead', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ leadId, campaignId }),
          });
          if (response.ok) successCount++;
        }
      }

      setSuccess(`Bulk action completed: ${successCount} leads updated successfully.`);
      setSelectedLeads([]);
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Error during bulk operation');
    } finally {
      setProcessing(false);
      setBulkActionType('');
    }
  };

  // Select logic
  const toggleSelectAll = () => {
    if (selectedLeads.length === filteredLeads.length) {
      setSelectedLeads([]);
    } else {
      setSelectedLeads(filteredLeads.map(l => l.id));
    }
  };

  const toggleSelectLead = (id: string) => {
    setSelectedLeads(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  // Filter application
  const filteredLeads = leads.filter(lead => {
    // 1. Status Filter
    if (statusFilter === 'pending' && lead.ai_status !== 'pending') return false;
    if (statusFilter === 'generated' && !['generated', 'edited'].includes(lead.ai_status)) return false;
    if (statusFilter === 'skipped' && lead.ai_status !== 'skipped') return false;
    if (statusFilter === 'approved' && lead.ai_status !== 'approved' && lead.approval_status !== 'approved') return false;
    if (statusFilter === 'failed' && lead.ai_status !== 'failed') return false;
    
    // 2. High priority Filter
    if (priorityFilter && lead.priority?.toLowerCase() !== 'high') return false;

    // 3. Score > 60 Filter
    if (scoreFilter && (lead.solution_fit_score || 0) < 61) return false;

    return true;
  });
  const totalPages = Math.max(1, Math.ceil(filteredLeads.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedLeads = filteredLeads.slice((safeCurrentPage - 1) * pageSize, safeCurrentPage * pageSize);

  const inputClass = 'rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-xs text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-violet-500';
  const modalInputClass = 'mt-1 w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-xs text-zinc-900 outline-none transition focus:border-violet-500';

  return (
    <AppShell showSearch={false}>
      <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <PageHeader
          eyebrow="Campaign personalization"
          title="AI Personalization Center"
          subtitle={`Review outreach copy for: ${campaign?.name || 'Loading campaign...'}`}
          actions={
            <div className="flex flex-wrap items-center gap-3">
              <Link href={`/campaigns/${campaignId}`} className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-white px-4 py-2.5 text-sm font-semibold text-zinc-700 transition hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700">
                <ArrowLeft className="h-4 w-4" />
                Back to Campaign
              </Link>
              {campaign && (
                <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold ${
                  campaign.require_approval_before_send
                    ? 'border-amber-200 bg-amber-50 text-amber-700'
                    : 'border-emerald-200 bg-emerald-50 text-emerald-700'
                }`}>
                  {campaign.require_approval_before_send ? 'Requires Approval' : 'Auto-Send Allowed'}
                </span>
              )}
            </div>
          }
        />

        {/* Global Notifications */}
        {error && (
          <div className="mb-6 flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-3.5 text-xs text-rose-700">
            <AlertCircle className="h-4.5 w-4.5" />
            {error}
          </div>
        )}
        {success && (
          <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-3.5 text-xs text-emerald-700">
            {success}
          </div>
        )}

        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <Spinner size={32} className="text-violet-500" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Filters panel */}
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-[var(--border)] bg-white p-4 shadow-[0_12px_40px_rgba(15,23,42,0.04)]">
              <div className="flex flex-wrap items-center gap-3">
                <SlidersHorizontal className="h-4 w-4 text-zinc-500" />
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">Filters:</span>
                
                {/* Status selector */}
                <select
                  value={statusFilter}
                  onChange={(e) => { setStatusFilter(e.target.value); setSelectedLeads([]); setCurrentPage(1); }}
                  className={inputClass}
                >
                  <option value="all">All AI Statuses</option>
                  <option value="pending">AI Pending</option>
                  <option value="generated">AI Generated</option>
                  <option value="skipped">AI Skipped</option>
                  <option value="approved">Approved & Queued</option>
                  <option value="failed">Generation Failed</option>
                </select>

                {/* Checks */}
                <label className="flex cursor-pointer select-none items-center gap-1.5 text-xs text-zinc-600">
                  <input
                    type="checkbox"
                    checked={priorityFilter}
                    onChange={(e) => { setPriorityFilter(e.target.checked); setSelectedLeads([]); setCurrentPage(1); }}
                    className="rounded border-zinc-300 text-violet-600 focus:ring-violet-500"
                  />
                  High Priority
                </label>

                <label className="flex cursor-pointer select-none items-center gap-1.5 text-xs text-zinc-600">
                  <input
                    type="checkbox"
                    checked={scoreFilter}
                    onChange={(e) => { setScoreFilter(e.target.checked); setSelectedLeads([]); setCurrentPage(1); }}
                    className="rounded border-zinc-300 text-violet-600 focus:ring-violet-500"
                  />
                  Score &gt; 60
                </label>
              </div>

              {/* Bulk actions */}
              {selectedLeads.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="mr-1 text-xs font-semibold text-zinc-500">{selectedLeads.length} selected</span>
                  <button
                    onClick={() => setBulkApproveModalOpen(true)}
                    disabled={processing}
                    className="cursor-pointer rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700 transition-colors hover:bg-emerald-100"
                  >
                    {bulkActionType === 'approve' ? 'Approving...' : 'Approve'}
                  </button>
                  <button
                    onClick={() => handleBulkAction('regenerate')}
                    disabled={processing}
                    className="cursor-pointer rounded-lg border border-violet-200 bg-violet-50 px-2.5 py-1 text-[11px] font-bold text-violet-700 transition-colors hover:bg-violet-100"
                  >
                    {bulkActionType === 'regenerate' ? 'Regenerating...' : 'Regenerate'}
                  </button>
                  <button
                    onClick={() => handleBulkAction('exclude')}
                    disabled={processing}
                    className="cursor-pointer rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1 text-[11px] font-bold text-rose-700 transition-colors hover:bg-rose-100"
                  >
                    {bulkActionType === 'exclude' ? 'Excluding...' : 'Exclude'}
                  </button>
                </div>
              )}
            </div>

            {/* Table list */}
            <div className="overflow-hidden rounded-3xl border border-[var(--border)] bg-white shadow-[0_12px_40px_rgba(15,23,42,0.04)]">
              <div className="overflow-x-auto max-h-[500px]">
                <table className="w-full text-left text-xs text-zinc-600">
                  <thead className="sticky top-0 border-b border-[var(--border)] bg-[var(--surface-muted)] text-[10px] font-bold uppercase text-zinc-500">
                    <tr>
                      <th className="py-3 px-4 w-10">
                        <button onClick={toggleSelectAll} className="text-zinc-500 hover:text-violet-700">
                          {selectedLeads.length === filteredLeads.length && filteredLeads.length > 0 ? (
                            <CheckSquare className="h-4.5 w-4.5 text-violet-700" />
                          ) : (
                            <Square className="h-4.5 w-4.5" />
                          )}
                        </button>
                      </th>
                      <th className="py-3 px-4">Company Name</th>
                      <th className="py-3 px-4">Contact</th>
                      <th className="py-3 px-4">Subject Preview</th>
                      <th className="py-3 px-4">Confidence</th>
                      <th className="py-3 px-4 text-center">Score</th>
                      <th className="py-3 px-4 text-center">Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {paginatedLeads.map((lead) => {
                      const isSelected = selectedLeads.includes(lead.id);
                      const displaySubject = lead.ai_subject || lead.personalized_subject || '';
                      
                      return (
                        <tr key={lead.id} className={`transition-colors hover:bg-violet-50/50 ${isSelected ? 'bg-violet-50' : ''}`}>
                          {/* Selection Checkbox */}
                          <td className="py-3.5 px-4">
                            <button onClick={() => toggleSelectLead(lead.id)} className="text-zinc-400 hover:text-violet-700">
                              {isSelected ? (
                                <CheckSquare className="h-4.5 w-4.5 text-violet-700" />
                              ) : (
                                <Square className="h-4.5 w-4.5" />
                              )}
                            </button>
                          </td>

                          {/* Company */}
                          <td className="py-3.5 px-4 font-semibold text-zinc-950">
                            {lead.company_name || lead.company || '-'}
                            {lead.priority?.toLowerCase() === 'high' && (
                              <span className="ml-1.5 rounded border border-rose-200 bg-rose-50 px-1 py-0.5 text-[9px] font-bold uppercase text-rose-700">High</span>
                            )}
                          </td>

                          {/* Contact */}
                          <td className="py-3.5 px-4">
                            <Link
                              href={`/campaigns/${campaignId}/leads/${lead.id}`}
                              className="block font-semibold text-violet-700 transition hover:text-violet-800 hover:underline"
                              title="Open lead profile"
                            >
                              {lead.decision_maker_name || `${lead.first_name || ''} ${lead.last_name || ''}`.trim() || 'Prospect'}
                            </Link>
                            <span className="block text-[10px] text-zinc-500 truncate max-w-[120px]">{lead.email}</span>
                          </td>

                          {/* Subject Preview */}
                          <td className="max-w-[200px] truncate px-4 py-3.5 font-mono italic text-zinc-500" title={displaySubject}>
                            {displaySubject || <span className="text-zinc-400">No copy generated</span>}
                          </td>

                          {/* AI Confidence */}
                          <td className="py-3.5 px-4">
                            {lead.ai_confidence_score !== null ? (
                              <span className={`font-semibold ${
                                lead.ai_confidence_score >= 80 ? 'text-emerald-700' : lead.ai_confidence_score >= 50 ? 'text-amber-700' : 'text-rose-700'
                              }`}>{lead.ai_confidence_score}%</span>
                            ) : '-'}
                          </td>

                          {/* solution fit score */}
                          <td className="py-3.5 px-4 text-center font-bold">
                            {lead.solution_fit_score !== null ? (
                              <span className={lead.solution_fit_score >= 75 ? 'text-emerald-700' : lead.solution_fit_score >= 40 ? 'text-amber-700' : 'text-zinc-500'}>
                                {lead.solution_fit_score}
                              </span>
                            ) : '-'}
                          </td>

                          {/* Status Badge */}
                          <td className="py-3.5 px-4 text-center">
                            <span className={`inline-flex px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                              lead.approval_status === 'approved' || lead.ai_status === 'approved'
                                ? 'border border-emerald-200 bg-emerald-50 text-emerald-700'
                                : lead.ai_status === 'failed'
                                ? 'border border-rose-200 bg-rose-50 text-rose-700'
                                : lead.ai_status === 'skipped'
                                ? 'border border-amber-200 bg-amber-50 text-amber-700'
                                : lead.ai_status === 'generated'
                                ? 'border border-violet-200 bg-violet-50 text-violet-700'
                                : lead.ai_status === 'edited'
                                ? 'border border-teal-200 bg-teal-50 text-teal-700'
                                : 'border border-[var(--border)] bg-[var(--surface-muted)] text-zinc-500'
                            }`}>
                              {lead.approval_status === 'approved' ? 'approved' : lead.ai_status}
                            </span>
                          </td>

                          {/* Actions */}
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {lead.ai_status !== 'pending' && lead.ai_status !== 'failed' && (
                                <button
                                  onClick={() => openEditModal(lead)}
                                  className="rounded-lg border border-[var(--border)] bg-white p-1 text-zinc-600 transition hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700"
                                  title="Review & Edit Draft"
                                >
                                  <Edit3 className="h-3.5 w-3.5" />
                                </button>
                              )}
                              {lead.approval_status !== 'approved' && lead.ai_status !== 'pending' && (
                                <button
                                  onClick={() => handleApproveLead(lead.id)}
                                  className="rounded-lg border border-emerald-200 bg-emerald-50 p-1 text-emerald-700 transition hover:bg-emerald-100"
                                  title="Approve outreach"
                                >
                                  <Check className="h-3.5 w-3.5" />
                                </button>
                              )}
                              <button
                                onClick={() => handleRegenerateLead(lead.id)}
                                className="rounded-lg border border-violet-200 bg-violet-50 p-1 text-violet-700 transition hover:bg-violet-100"
                                title="Run/Regenerate AI Analysis"
                              >
                                <Sparkles className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => handleExcludeLead(lead.id)}
                                className="rounded-lg border border-rose-200 bg-rose-50 p-1 text-rose-700 transition hover:bg-rose-100"
                                title="Exclude Prospect"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}

                    {filteredLeads.length === 0 && (
                      <tr>
                        <td colSpan={8} className="py-12 text-center text-zinc-500 font-medium">
                          No leads matching selected filters found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-col gap-3 border-t border-[var(--border)] bg-white px-5 py-4 text-xs text-zinc-500 sm:flex-row sm:items-center sm:justify-between">
                <span>
                  Showing {filteredLeads.length === 0 ? 0 : (safeCurrentPage - 1) * pageSize + 1}-{Math.min(safeCurrentPage * pageSize, filteredLeads.length)} of {filteredLeads.length} filtered leads
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                    disabled={safeCurrentPage <= 1}
                    className="rounded-lg border border-[var(--border)] bg-white px-3 py-1.5 font-semibold text-zinc-700 transition hover:bg-violet-50 disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <span className="font-semibold text-zinc-700">Page {safeCurrentPage} / {totalPages}</span>
                  <button
                    onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                    disabled={safeCurrentPage >= totalPages}
                    className="rounded-lg border border-[var(--border)] bg-white px-3 py-1.5 font-semibold text-zinc-700 transition hover:bg-violet-50 disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* DETAILED LEAD EDIT POPUP MODAL */}
      {modalOpen && activeLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
          <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-[var(--border)] bg-white shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--surface-muted)] p-4">
              <div>
                <h3 className="text-md font-bold text-zinc-950">Review & Edit Outreach Email</h3>
                <p className="text-[11px] text-zinc-500">{activeLead.decision_maker_name || 'Prospect'} at {activeLead.company_name || activeLead.company}</p>
              </div>
              <button 
                onClick={() => setModalOpen(false)}
                className="rounded-xl border border-[var(--border)] bg-white p-1 text-zinc-500 transition hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Scroll Content */}
            <div className="p-6 overflow-y-auto space-y-4 flex-1">
              {/* Strategic Insights Info panel */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] p-3 text-xs">
                  <span className="block text-[10px] uppercase font-bold text-zinc-500 mb-1">AI Company Summary</span>
                  <span className="text-zinc-700">{activeLead.ai_company_summary || '-'}</span>
                </div>
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] p-3 text-xs">
                  <span className="block text-[10px] uppercase font-bold text-zinc-500 mb-1">AI Solution Angle</span>
                  <span className="text-zinc-700">{activeLead.ai_solution_angle || '-'}</span>
                </div>
              </div>

              {/* Angle Inputs */}
              <div>
                <label className="block text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Solution Angle</label>
                <input
                  type="text"
                  value={editedAngle}
                  onChange={(e) => setEditedAngle(e.target.value)}
                  className={modalInputClass}
                />
              </div>

              {/* Personalized Intro Line */}
              <div>
                <label className="block text-[10px] uppercase font-bold text-zinc-500 tracking-wider">AI Personalized First Line</label>
                <input
                  type="text"
                  value={editedFirstLine}
                  onChange={(e) => setEditedFirstLine(e.target.value)}
                  className={modalInputClass}
                />
              </div>

              {/* Subject */}
              <div>
                <label className="block text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Outreach Subject Line</label>
                <input
                  type="text"
                  value={editedSubject}
                  onChange={(e) => setEditedSubject(e.target.value)}
                  className={modalInputClass}
                />
              </div>

              {/* Body */}
              <div>
                <label className="block text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Email Body (Plain/Markdown)</label>
                <textarea
                  rows={6}
                  value={editedBody}
                  onChange={(e) => setEditedBody(e.target.value)}
                  className={`${modalInputClass} font-sans`}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* CTA */}
                <div>
                  <label className="block text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Soft Call-To-Action</label>
                  <input
                    type="text"
                    value={editedCta}
                    onChange={(e) => setEditedCta(e.target.value)}
                    className={modalInputClass}
                  />
                </div>
                {/* Notes */}
                <div>
                  <label className="block text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Prospect Notes</label>
                  <input
                    type="text"
                    value={editedNotes}
                    onChange={(e) => setEditedNotes(e.target.value)}
                    className={modalInputClass}
                  />
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between border-t border-[var(--border)] bg-[var(--surface-muted)] p-4">
              <span className="text-[10px] text-zinc-500">Manual edits set status to "edited".</span>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setModalOpen(false)}
                  className="cursor-pointer rounded-xl border border-[var(--border)] bg-white px-4 py-2 text-xs font-semibold text-zinc-700 transition hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveEdits}
                  disabled={processing}
                  className="flex cursor-pointer items-center gap-1.5 rounded-xl bg-gradient-to-r from-violet-600 to-teal-500 px-5 py-2 text-xs font-semibold text-white shadow-md shadow-violet-500/10 hover:opacity-95 disabled:opacity-50"
                >
                  {processing ? (
                    <Spinner size={16} className="text-white" />
                  ) : (
                    <>Save Email Draft</>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {bulkApproveModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl border border-[var(--border)] bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] pb-4">
              <div>
                <div className="mb-2 inline-flex rounded-full bg-amber-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-amber-700 ring-1 ring-amber-100">
                  Bulk send safety check
                </div>
                <h3 className="text-lg font-semibold text-zinc-950">Approve and queue {selectedLeads.length} selected leads?</h3>
                <p className="mt-2 text-sm leading-6 text-zinc-500">
                  This approves the selected outreach drafts and queues them for campaign sending. If the campaign is active, automation can send them on the next run within daily limits.
                </p>
              </div>
              <button
                onClick={() => setBulkApproveModalOpen(false)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] text-zinc-500 transition hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 rounded-2xl border border-amber-100 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
              Confirm these emails have been reviewed and are safe to queue. Suppression checks and daily limits still apply when sending.
            </div>

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                onClick={() => setBulkApproveModalOpen(false)}
                className="rounded-xl border border-[var(--border)] bg-white px-4 py-2.5 text-sm font-semibold text-zinc-700 transition hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700"
              >
                Cancel
              </button>
              <button
                onClick={() => handleBulkAction('approve')}
                disabled={processing}
                className="rounded-xl bg-gradient-to-r from-violet-600 to-teal-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-600/15 transition hover:opacity-95 disabled:opacity-50"
              >
                Confirm Bulk Queue
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
