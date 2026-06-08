'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, use } from 'react';
import { createClient } from '@/utils/supabase/client';
import Sidebar from '@/components/Sidebar';
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

  return (
    <div className="flex min-h-screen bg-zinc-950 text-zinc-100 font-sans">
      <Sidebar />
      <main className="flex-1 p-8 overflow-y-auto max-w-7xl">
        {/* Top bar */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <Link href={`/campaigns/${campaignId}`} className="p-2 bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-400 hover:text-white transition-all">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div>
              <h2 className="text-2xl font-bold text-white tracking-tight">AI Personalization Center</h2>
              <p className="text-xs text-zinc-400">Review outreach copy for: <span className="text-violet-400 font-semibold">{campaign?.name}</span></p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {campaign && (
              <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${
                campaign.require_approval_before_send 
                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' 
                  : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
              }`}>
                {campaign.require_approval_before_send ? 'Requires Approval' : 'Auto-Send Allowed'}
              </span>
            )}
          </div>
        </div>

        {/* Global Notifications */}
        {error && (
          <div className="mb-6 rounded-lg bg-rose-500/10 p-3.5 text-xs text-rose-400 border border-rose-500/20 flex items-center gap-2">
            <AlertCircle className="h-4.5 w-4.5" />
            {error}
          </div>
        )}
        {success && (
          <div className="mb-6 rounded-lg bg-emerald-500/10 p-3.5 text-xs text-emerald-400 border border-emerald-500/20">
            {success}
          </div>
        )}

        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-violet-500 border-t-transparent" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Filters panel */}
            <div className="rounded-xl border border-zinc-850 bg-zinc-900/10 p-4 flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-3">
                <SlidersHorizontal className="h-4 w-4 text-zinc-500" />
                <span className="text-xs text-zinc-400 font-bold uppercase tracking-wider">Filters:</span>
                
                {/* Status selector */}
                <select
                  value={statusFilter}
                  onChange={(e) => { setStatusFilter(e.target.value); setSelectedLeads([]); }}
                  className="rounded border border-zinc-800 bg-zinc-950 px-2 py-1 text-xs text-zinc-350 focus:outline-none"
                >
                  <option value="all">All AI Statuses</option>
                  <option value="pending">AI Pending</option>
                  <option value="generated">AI Generated</option>
                  <option value="skipped">AI Skipped</option>
                  <option value="approved">Approved & Queued</option>
                  <option value="failed">Generation Failed</option>
                </select>

                {/* Checks */}
                <label className="flex items-center gap-1.5 text-xs text-zinc-400 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={priorityFilter}
                    onChange={(e) => { setPriorityFilter(e.target.checked); setSelectedLeads([]); }}
                    className="rounded border-zinc-800 bg-zinc-950 text-violet-500 focus:ring-0"
                  />
                  High Priority
                </label>

                <label className="flex items-center gap-1.5 text-xs text-zinc-400 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={scoreFilter}
                    onChange={(e) => { setScoreFilter(e.target.checked); setSelectedLeads([]); }}
                    className="rounded border-zinc-800 bg-zinc-950 text-violet-500 focus:ring-0"
                  />
                  Score &gt; 60
                </label>
              </div>

              {/* Bulk actions */}
              {selectedLeads.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-zinc-500 font-semibold mr-1">{selectedLeads.length} selected</span>
                  <button
                    onClick={() => handleBulkAction('approve')}
                    disabled={processing}
                    className="px-2.5 py-1 bg-emerald-600/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-600/20 rounded text-[11px] font-bold cursor-pointer transition-colors"
                  >
                    {bulkActionType === 'approve' ? 'Approving...' : 'Approve'}
                  </button>
                  <button
                    onClick={() => handleBulkAction('regenerate')}
                    disabled={processing}
                    className="px-2.5 py-1 bg-violet-600/10 text-violet-400 border border-violet-500/20 hover:bg-violet-600/20 rounded text-[11px] font-bold cursor-pointer transition-colors"
                  >
                    {bulkActionType === 'regenerate' ? 'Regenerating...' : 'Regenerate'}
                  </button>
                  <button
                    onClick={() => handleBulkAction('exclude')}
                    disabled={processing}
                    className="px-2.5 py-1 bg-rose-600/10 text-rose-400 border border-rose-500/20 hover:bg-rose-600/20 rounded text-[11px] font-bold cursor-pointer transition-colors"
                  >
                    {bulkActionType === 'exclude' ? 'Excluding...' : 'Exclude'}
                  </button>
                </div>
              )}
            </div>

            {/* Table list */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/20 overflow-hidden">
              <div className="overflow-x-auto max-h-[500px]">
                <table className="w-full text-left text-xs text-zinc-400">
                  <thead className="text-[10px] font-bold uppercase text-zinc-500 border-b border-zinc-800 bg-zinc-900/40 sticky top-0">
                    <tr>
                      <th className="py-3 px-4 w-10">
                        <button onClick={toggleSelectAll} className="text-zinc-500 hover:text-white">
                          {selectedLeads.length === filteredLeads.length && filteredLeads.length > 0 ? (
                            <CheckSquare className="h-4.5 w-4.5 text-violet-400" />
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
                  <tbody className="divide-y divide-zinc-900">
                    {filteredLeads.map((lead) => {
                      const isSelected = selectedLeads.includes(lead.id);
                      const displaySubject = lead.ai_subject || lead.personalized_subject || '';
                      
                      return (
                        <tr key={lead.id} className={`hover:bg-zinc-900/10 transition-colors ${isSelected ? 'bg-zinc-900/30' : ''}`}>
                          {/* Selection Checkbox */}
                          <td className="py-3.5 px-4">
                            <button onClick={() => toggleSelectLead(lead.id)} className="text-zinc-600 hover:text-zinc-300">
                              {isSelected ? (
                                <CheckSquare className="h-4.5 w-4.5 text-violet-400" />
                              ) : (
                                <Square className="h-4.5 w-4.5" />
                              )}
                            </button>
                          </td>

                          {/* Company */}
                          <td className="py-3.5 px-4 font-semibold text-zinc-200">
                            {lead.company_name || lead.company || '-'}
                            {lead.priority?.toLowerCase() === 'high' && (
                              <span className="ml-1.5 px-1 py-0.5 bg-rose-500/10 text-rose-400 border border-rose-500/20 text-[9px] rounded uppercase font-bold">High</span>
                            )}
                          </td>

                          {/* Contact */}
                          <td className="py-3.5 px-4">
                            <span className="block text-zinc-300 font-medium">{lead.decision_maker_name || `${lead.first_name || ''} ${lead.last_name || ''}`.trim() || 'Prospect'}</span>
                            <span className="block text-[10px] text-zinc-500 truncate max-w-[120px]">{lead.email}</span>
                          </td>

                          {/* Subject Preview */}
                          <td className="py-3.5 px-4 text-zinc-400 italic font-mono truncate max-w-[200px]" title={displaySubject}>
                            {displaySubject || <span className="text-zinc-650">No copy generated</span>}
                          </td>

                          {/* AI Confidence */}
                          <td className="py-3.5 px-4">
                            {lead.ai_confidence_score !== null ? (
                              <span className={`font-semibold ${
                                lead.ai_confidence_score >= 80 ? 'text-emerald-400' : lead.ai_confidence_score >= 50 ? 'text-amber-400' : 'text-rose-400'
                              }`}>{lead.ai_confidence_score}%</span>
                            ) : '-'}
                          </td>

                          {/* solution fit score */}
                          <td className="py-3.5 px-4 text-center font-bold">
                            {lead.solution_fit_score !== null ? (
                              <span className={lead.solution_fit_score >= 75 ? 'text-emerald-400' : lead.solution_fit_score >= 40 ? 'text-amber-400' : 'text-zinc-500'}>
                                {lead.solution_fit_score}
                              </span>
                            ) : '-'}
                          </td>

                          {/* Status Badge */}
                          <td className="py-3.5 px-4 text-center">
                            <span className={`inline-flex px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                              lead.approval_status === 'approved' || lead.ai_status === 'approved'
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : lead.ai_status === 'failed'
                                ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                                : lead.ai_status === 'skipped'
                                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                : lead.ai_status === 'generated'
                                ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                                : lead.ai_status === 'edited'
                                ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20'
                                : 'bg-zinc-800 text-zinc-500 border border-zinc-700'
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
                                  className="p-1 text-zinc-400 hover:text-white bg-zinc-950 border border-zinc-800/80 rounded"
                                  title="Review & Edit Draft"
                                >
                                  <Edit3 className="h-3.5 w-3.5" />
                                </button>
                              )}
                              {lead.approval_status !== 'approved' && lead.ai_status !== 'pending' && (
                                <button
                                  onClick={() => handleApproveLead(lead.id)}
                                  className="p-1 text-emerald-400 hover:text-emerald-350 bg-zinc-950 border border-zinc-800/80 rounded"
                                  title="Approve outreach"
                                >
                                  <Check className="h-3.5 w-3.5" />
                                </button>
                              )}
                              <button
                                onClick={() => handleRegenerateLead(lead.id)}
                                className="p-1 text-violet-400 hover:text-violet-350 bg-zinc-950 border border-zinc-800/80 rounded"
                                title="Run/Regenerate AI Analysis"
                              >
                                <Sparkles className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => handleExcludeLead(lead.id)}
                                className="p-1 text-rose-400 hover:text-rose-350 bg-zinc-950 border border-zinc-800/80 rounded"
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
            </div>
          </div>
        )}
      </main>

      {/* DETAILED LEAD EDIT POPUP MODAL */}
      {modalOpen && activeLead && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-zinc-950 border border-zinc-800 rounded-xl w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-4 border-b border-zinc-900 flex items-center justify-between bg-zinc-900/20">
              <div>
                <h3 className="font-bold text-white text-md">Review & Edit Outreach Email</h3>
                <p className="text-[11px] text-zinc-500">{activeLead.decision_maker_name || 'Prospect'} at {activeLead.company_name || activeLead.company}</p>
              </div>
              <button 
                onClick={() => setModalOpen(false)}
                className="p-1 hover:bg-zinc-900 rounded text-zinc-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Scroll Content */}
            <div className="p-6 overflow-y-auto space-y-4 flex-1">
              {/* Strategic Insights Info panel */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-3 bg-zinc-900/20 border border-zinc-900 rounded-lg text-xs">
                  <span className="block text-[10px] uppercase font-bold text-zinc-500 mb-1">AI Company Summary</span>
                  <span className="text-zinc-300">{activeLead.ai_company_summary || '-'}</span>
                </div>
                <div className="p-3 bg-zinc-900/20 border border-zinc-900 rounded-lg text-xs">
                  <span className="block text-[10px] uppercase font-bold text-zinc-500 mb-1">AI Solution Angle</span>
                  <span className="text-zinc-300">{activeLead.ai_solution_angle || '-'}</span>
                </div>
              </div>

              {/* Angle Inputs */}
              <div>
                <label className="block text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Solution Angle</label>
                <input
                  type="text"
                  value={editedAngle}
                  onChange={(e) => setEditedAngle(e.target.value)}
                  className="mt-1 w-full rounded border border-zinc-800 bg-zinc-950 py-1.5 px-3 text-xs text-zinc-200 focus:border-violet-500 focus:outline-none"
                />
              </div>

              {/* Personalized Intro Line */}
              <div>
                <label className="block text-[10px] uppercase font-bold text-zinc-500 tracking-wider">AI Personalized First Line</label>
                <input
                  type="text"
                  value={editedFirstLine}
                  onChange={(e) => setEditedFirstLine(e.target.value)}
                  className="mt-1 w-full rounded border border-zinc-800 bg-zinc-950 py-1.5 px-3 text-xs text-zinc-200 focus:border-violet-500 focus:outline-none"
                />
              </div>

              {/* Subject */}
              <div>
                <label className="block text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Outreach Subject Line</label>
                <input
                  type="text"
                  value={editedSubject}
                  onChange={(e) => setEditedSubject(e.target.value)}
                  className="mt-1 w-full rounded border border-zinc-800 bg-zinc-950 py-1.5 px-3 text-xs text-zinc-200 focus:border-violet-500 focus:outline-none"
                />
              </div>

              {/* Body */}
              <div>
                <label className="block text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Email Body (Plain/Markdown)</label>
                <textarea
                  rows={6}
                  value={editedBody}
                  onChange={(e) => setEditedBody(e.target.value)}
                  className="mt-1 w-full rounded border border-zinc-800 bg-zinc-950 py-2.5 px-3 text-xs text-zinc-200 focus:border-violet-500 focus:outline-none font-sans"
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
                    className="mt-1 w-full rounded border border-zinc-800 bg-zinc-950 py-1.5 px-3 text-xs text-zinc-200 focus:border-violet-500 focus:outline-none"
                  />
                </div>
                {/* Notes */}
                <div>
                  <label className="block text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Prospect Notes</label>
                  <input
                    type="text"
                    value={editedNotes}
                    onChange={(e) => setEditedNotes(e.target.value)}
                    className="mt-1 w-full rounded border border-zinc-800 bg-zinc-950 py-1.5 px-3 text-xs text-zinc-200 focus:border-violet-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-zinc-900 flex items-center justify-between bg-zinc-900/20">
              <span className="text-[10px] text-zinc-500">Manual edits set status to "edited".</span>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 border border-zinc-800 hover:bg-zinc-900 rounded-lg text-xs font-semibold text-zinc-400 hover:text-white transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveEdits}
                  disabled={processing}
                  className="px-5 py-2 bg-gradient-to-r from-violet-600 to-blue-600 rounded-lg text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50 cursor-pointer shadow-md shadow-violet-500/10 flex items-center gap-1.5"
                >
                  {processing ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  ) : (
                    <>Save Email Draft</>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
