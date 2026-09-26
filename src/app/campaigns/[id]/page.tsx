'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, use } from 'react';
import AppShell from '@/components/reachmira/AppShell';
import { createClient } from '@/utils/supabase/client';
import Spinner from '@/components/reachmira/Spinner';
import { useEmailAccounts } from '@/hooks/useEmailAccounts';
import CampaignModals from '@/components/campaigns/detail/CampaignModals';
import LeadsTab from '@/components/campaigns/detail/LeadsTab';
import SequenceBuilderTab from '@/components/campaigns/detail/SequenceBuilderTab';
import { useSequenceSteps } from '@/hooks/useSequenceSteps';
import PersonalizeTab from '@/components/campaigns/detail/PersonalizeTab';
import OutboxReviewTab from '@/components/campaigns/detail/OutboxReviewTab';
import CampaignHeader from '@/components/campaigns/detail/CampaignHeader';
import { useCampaignDetail } from '@/hooks/useCampaignDetail';

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result.map(cell => cell.replace(/^["']|["']$/g, '').trim());
}

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function CampaignDetailPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const campaignId = resolvedParams.id;
  
  const supabase = createClient();
  const { sequences, setSequences, savingSequence, addStep: handleAddSequenceStep, updateStepField: handleUpdateSequenceField, removeStep: handleRemoveSequenceStep, saveSequences } = useSequenceSteps();
  const { emailAccounts } = useEmailAccounts();
  const {
    loading,
    campaign,
    leads,
    auditLogs,
    sentEmails,
    error,
    success,
    setError,
    setSuccess,
    loadCampaignData,
    handleCampaignEmailAccountChange,
    handleAllowRiskyEmailsChange,
    handleLaunchCampaign: launchCampaign,
    handlePauseCampaign,
    handleClearLeads: clearLeads,
  } = useCampaignDetail(campaignId, setSequences);

  // Tabs: 'leads' | 'sequence' | 'personalize' | 'review'
  const [activeTab, setActiveTab] = useState<'leads' | 'sequence' | 'personalize' | 'review'>('leads');
  const [reviewFilter, setReviewFilter] = useState<'all' | 'pending_review' | 'approved' | 'skipped'>('pending_review');
  const [leadsPage, setLeadsPage] = useState(1);
  const [personalizationPage, setPersonalizationPage] = useState(1);
  const [reviewPage, setReviewPage] = useState(1);
  const pageSize = 10;

  // Google Sheets state
  const [googleSheetUrl, setGoogleSheetUrl] = useState('');
  const [importingSheet, setImportingSheet] = useState(false);

  // Lead CSV state
  const [uploading, setUploading] = useState(false);

  // AI Personalization state
  const [promptInstructions, setPromptInstructions] = useState('Using the first name {{first_name}} and company name {{company}}, write a brief one-sentence observation about their business that makes this message feel completely personal.');
  const [personalizing, setPersonalizing] = useState(false);
  const [personalizeProgress, setPersonalizeProgress] = useState('');

  // Review Queue Edit States
  const [editingLeadId, setEditingLeadId] = useState<string | null>(null);
  const [editedSubject, setEditedSubject] = useState('');
  const [editedBody, setEditedBody] = useState('');
  const [approvingLeadId, setApprovingLeadId] = useState<string | null>(null);
  const [bulkApproveModalOpen, setBulkApproveModalOpen] = useState(false);
  const [launchModalOpen, setLaunchModalOpen] = useState(false);

  // --- CSV PARSING AND UPLOAD ---
  const handleCSVUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);
    setSuccess(null);

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        if (!text) return;

        // Simple CSV Parser splitting by line
        const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
        if (lines.length < 2) {
          throw new Error('CSV is empty or missing data rows');
        }

        // Parse headers using clean quote parsing
        const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase().trim());
        
        // Find indices using flexible matching rules
        const indices = {
          email: headers.findIndex(h => ['email', 'email address', 'email_address', 'mail'].includes(h)),
          first_name: headers.findIndex(h => ['first_name', 'first name', 'firstname', 'first'].includes(h)),
          last_name: headers.findIndex(h => ['last_name', 'last name', 'lastname', 'last'].includes(h)),
          fullName: headers.findIndex(h => ['name', 'full name', 'fullname', 'full_name'].includes(h)),
          company: headers.findIndex(h => ['company', 'company name', 'company_name', 'org', 'organization', 'firm'].includes(h)),
          company_name: headers.findIndex(h => ['company_name', 'company name', 'company'].includes(h)),
          website: headers.findIndex(h => ['website', 'web', 'site', 'url'].includes(h)),
          industry: headers.findIndex(h => ['industry', 'sector'].includes(h)),
          sub_industry: headers.findIndex(h => ['sub_industry', 'sub industry', 'subsector'].includes(h)),
          country: headers.findIndex(h => ['country', 'nation'].includes(h)),
          city: headers.findIndex(h => ['city', 'town', 'location'].includes(h)),
          company_size: headers.findIndex(h => ['company_size', 'company size', 'size', 'employees'].includes(h)),
          estimated_revenue: headers.findIndex(h => ['estimated_revenue', 'estimated revenue', 'revenue', 'rev'].includes(h)),
          decision_maker_name: headers.findIndex(h => ['decision_maker_name', 'decision maker name', 'contact name', 'contact'].includes(h)),
          decision_maker_title: headers.findIndex(h => ['decision_maker_title', 'decision maker title', 'title', 'role', 'position'].includes(h)),
          linkedin_url: headers.findIndex(h => ['linkedin_url', 'linkedin url', 'linkedin'].includes(h)),
          tech_stack: headers.findIndex(h => ['tech_stack', 'tech stack', 'technologies', 'tech'].includes(h)),
          pain_points: headers.findIndex(h => ['pain_points', 'pain points', 'pains', 'trigger', 'pain points / trigger', 'trigger event'].includes(h)),
          solution: headers.findIndex(h => ['solution', 'our solution', 'proposed solution', 'recommended solution', 'offer solution'].includes(h)),
          solution_score: headers.findIndex(h => ['solution_score', 'solution score'].includes(h)),
          solution_fit_score: headers.findIndex(h => ['solution_fit_score', 'solution fit score'].includes(h)),
          lead_source: headers.findIndex(h => ['lead_source', 'lead source', 'source'].includes(h)),
          priority: headers.findIndex(h => ['priority'].includes(h)),
          assigned_to: headers.findIndex(h => ['assigned_to', 'assigned to', 'assignee'].includes(h)),
          tags: headers.findIndex(h => ['tags', 'tag'].includes(h)),
          notes: headers.findIndex(h => ['notes', 'note', 'comment'].includes(h)),
        };

        if (indices.email === -1) {
          throw new Error('CSV must contain an "email" column');
        }

        const parsedLeads = [];
        for (let i = 1; i < lines.length; i++) {
          const row = parseCSVLine(lines[i]);
          if (row.length < headers.length) continue; // Skip malformed rows

          const email = row[indices.email];
          if (!email || !email.includes('@')) continue;

          let first_name = indices.first_name !== -1 ? row[indices.first_name] || null : null;
          let last_name = indices.last_name !== -1 ? row[indices.last_name] || null : null;

          if (!first_name && indices.fullName !== -1 && row[indices.fullName]) {
            const nameParts = row[indices.fullName].split(/\s+/);
            first_name = nameParts[0] || null;
            last_name = nameParts.slice(1).join(' ') || null;
          }

          const company = indices.company !== -1 ? row[indices.company] || null : null;
          const company_name = indices.company_name !== -1 ? row[indices.company_name] || null : company;
          const website = indices.website !== -1 ? row[indices.website] || null : null;
          const industry = indices.industry !== -1 ? row[indices.industry] || null : null;
          const sub_industry = indices.sub_industry !== -1 ? row[indices.sub_industry] || null : null;
          const country = indices.country !== -1 ? row[indices.country] || null : null;
          const city = indices.city !== -1 ? row[indices.city] || null : null;
          const company_size = indices.company_size !== -1 ? row[indices.company_size] || null : null;
          const estimated_revenue = indices.estimated_revenue !== -1 ? row[indices.estimated_revenue] || null : null;
          const decision_maker_name = indices.decision_maker_name !== -1 ? row[indices.decision_maker_name] || null : null;
          const decision_maker_title = indices.decision_maker_title !== -1 ? row[indices.decision_maker_title] || null : null;
          const linkedin_url = indices.linkedin_url !== -1 ? row[indices.linkedin_url] || null : null;
          const tech_stack = indices.tech_stack !== -1 ? row[indices.tech_stack] || null : null;
          const pain_points = indices.pain_points !== -1 ? row[indices.pain_points] || null : null;
          const solution = indices.solution !== -1 ? row[indices.solution] || null : null;

          let solution_score: number | null = null;
          if (indices.solution_score !== -1 && row[indices.solution_score]) {
            const parsedScore = Number(row[indices.solution_score]);
            if (!Number.isNaN(parsedScore)) {
              solution_score = parsedScore;
            }
          }

          let solution_fit_score: number | null = null;
          if (indices.solution_fit_score !== -1 && row[indices.solution_fit_score]) {
            const parsedScore = Number(row[indices.solution_fit_score]);
            if (!Number.isNaN(parsedScore)) {
              solution_fit_score = parsedScore;
            }
          }

          const lead_source = indices.lead_source !== -1 ? row[indices.lead_source] || null : null;
          const priority = indices.priority !== -1 ? row[indices.priority] || null : null;
          const assigned_to = indices.assigned_to !== -1 ? row[indices.assigned_to] || null : null;
          const tags = indices.tags !== -1 ? row[indices.tags] || null : null;
          const notes = indices.notes !== -1 ? row[indices.notes] || null : null;

          const variables: Record<string, any> = {};
          const knownIndices = Object.values(indices);
          headers.forEach((header, idx) => {
            if (!knownIndices.includes(idx) && header !== 'email') {
              variables[header] = row[idx] || '';
            }
          });

          parsedLeads.push({
            campaign_id: campaignId,
            email,
            first_name,
            last_name,
            company,
            company_name,
            website,
            industry,
            sub_industry,
            country,
            city,
            company_size,
            estimated_revenue,
            decision_maker_name,
            decision_maker_title,
            linkedin_url,
            tech_stack,
            pain_points,
            solution,
            solution_score,
            solution_fit_score,
            lead_source,
            priority,
            assigned_to,
            tags,
            notes,
            variables,
            status: 'imported',
            approval_status: 'pending_review'
          });
        }

        if (parsedLeads.length === 0) {
          throw new Error('No valid leads parsed from CSV');
        }

        const { error: insertError } = await supabase
          .from('leads')
          .insert(parsedLeads);

        if (insertError) throw insertError;

        setSuccess(`Successfully uploaded ${parsedLeads.length} leads!`);
        await loadCampaignData();
      } catch (err: any) {
        setError(err.message || 'Error processing CSV');
      } finally {
        setUploading(false);
      }
    };

    reader.readAsText(file);
  };

  const handleSaveSequence = async () => {
    setError(null);
    setSuccess(null);
    try {
      await saveSequences(campaignId, { deleteExisting: true });
      setSuccess('Outreach sequence steps saved successfully!');
      await loadCampaignData();
    } catch (err: any) {
      setError(err.message || 'Error saving sequence steps');
    }
  };

  // --- AI PERSONALIZATION RUNNER ---
  const handleRunAIPersonalization = async () => {
    const importedLeads = leads.filter(l => l.status === 'imported' && !l.personalization_strategy);
    if (importedLeads.length === 0) {
      setError('No pending imported leads requiring personalization.');
      return;
    }

    setPersonalizing(true);
    setError(null);
    setSuccess(null);
    setPersonalizeProgress(`Personalizing ${importedLeads.length} leads in progress...`);

    try {
      const leadIds = importedLeads.map(l => l.id);
      
      const response = await fetch('/api/leads/personalize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          leadIds,
          promptInstructions,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to personalize');

      setSuccess(`Successfully personalized ${data.results?.filter((r: any) => r.success).length} leads using Gemini!`);
      await loadCampaignData();
    } catch (err: any) {
      setError(err.message || 'Error running AI personalization');
    } finally {
      setPersonalizing(false);
      setPersonalizeProgress('');
    }
  };

  // --- GOOGLE SHEETS IMPORT ---
  const handleGoogleSheetsImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!googleSheetUrl) return;

    setImportingSheet(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`/api/campaigns/${campaignId}/import-sheets`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: googleSheetUrl }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to import Google Sheets');

      setSuccess(`Successfully imported ${data.count} leads from Google Sheets!`);
      setGoogleSheetUrl('');
      await loadCampaignData();
    } catch (err: any) {
      setError(err.message || 'Error importing Google Sheet');
    } finally {
      setImportingSheet(false);
    }
  };

  // --- APPROVE/SKIP LEAD ---
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const selectedLead = leads.find(l => l.id === selectedLeadId);

  useEffect(() => {
    if (selectedLead) {
      setEditedSubject(selectedLead.personalized_subject || '');
      setEditedBody(selectedLead.personalized_body || '');
    } else {
      setEditedSubject('');
      setEditedBody('');
    }
  }, [selectedLeadId, leads]);

  const handleApproveLead = async (leadId: string, action: 'approve' | 'skip') => {
    setApprovingLeadId(leadId);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`/api/campaigns/${campaignId}/approve-lead`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          leadId,
          action,
          subject: action === 'approve' ? editedSubject : undefined,
          body: action === 'approve' ? editedBody : undefined,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to process lead');

      setSuccess(`Lead was successfully ${action === 'approve' ? 'approved & email queued' : 'skipped'}!`);
      
      // Auto-advance to the next lead pending review
      const pendingReviewLeads = leads.filter(l => l.id !== leadId && l.personalization_strategy && l.approval_status === 'pending_review');
      if (pendingReviewLeads.length > 0) {
        setSelectedLeadId(pendingReviewLeads[0].id);
      } else {
        setSelectedLeadId(null);
      }

      await loadCampaignData();
    } catch (err: any) {
      setError(err.message || 'Error approving/skipping lead');
    } finally {
      setApprovingLeadId(null);
    }
  };

  const pendingBulkApprovalLeads = leads.filter(l => l.personalization_strategy && l.approval_status === 'pending_review');

  const requestBulkApprove = () => {
    if (sequences.length === 0) {
      setError('Please add at least one email sequence step first.');
      return;
    }
    if (pendingBulkApprovalLeads.length === 0) {
      setError('No leads pending review with AI personalizations.');
      return;
    }

    setError(null);
    setBulkApproveModalOpen(true);
  };

  const handleBulkApprove = async () => {
    const pendingReviewLeads = pendingBulkApprovalLeads;
    if (pendingReviewLeads.length === 0) {
      setBulkApproveModalOpen(false);
      setError('No leads pending review with AI personalizations.');
      return;
    }

    setBulkApproveModalOpen(false);
    setApprovingLeadId('bulk');
    setError(null);
    setSuccess(null);

    try {
      let approvedCount = 0;
      for (const lead of pendingReviewLeads) {
        const response = await fetch(`/api/campaigns/${campaignId}/approve-lead`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            leadId: lead.id,
            action: 'approve',
            subject: lead.personalized_subject,
            body: lead.personalized_body,
          }),
        });

        if (response.ok) approvedCount++;
      }

      setSuccess(`Successfully bulk-approved ${approvedCount} leads!`);
      setSelectedLeadId(null);
      await loadCampaignData();
    } catch (err: any) {
      setError(err.message || 'Error during bulk approval');
    } finally {
      setApprovingLeadId(null);
    }
  };

  const handleLaunchCampaign = () => launchCampaign(sequences.length > 0);

  const [clearLeadsConfirmOpen, setClearLeadsConfirmOpen] = useState(false);

  const handleClearLeads = async () => {
    try {
      await clearLeads();
    } finally {
      setClearLeadsConfirmOpen(false);
    }
  };

  const analytics = {
    leads: leads.length,
    sent: sentEmails.length,
    delivered: sentEmails.filter((email) => email.status === 'delivered' || Boolean(email.delivered_at)).length,
    // A click implies an open even when the tracking pixel was blocked.
    opened: sentEmails.filter((email) => email.status === 'opened' || Boolean(email.opened_at) || Boolean(email.clicked_at)).length,
    clicked: sentEmails.filter((email) => email.status === 'clicked' || Boolean(email.clicked_at)).length,
    replied: leads.filter((lead) => ['replied', 'interested', 'not_interested', 'demo_scheduled', 'proposal_sent', 'won', 'lost'].includes(String(lead.status || ''))).length,
    bounced: leads.filter((lead) => ['bounced', 'complained'].includes(String(lead.status || ''))).length,
    unsubscribed: leads.filter((lead) => lead.status === 'unsubscribed').length,
  };
  const rateOfSent = (count: number) => (analytics.sent > 0 ? `${Math.round((count / analytics.sent) * 100)}% of sent` : null);
  const selectedEmailAccount = emailAccounts.find((account) => account.id === campaign?.email_account_id);
  const approvedLeadsCount = leads.filter((lead) => lead.approval_status === 'approved' || lead.ai_status === 'approved').length;
  const pendingReviewCount = leads.filter((lead) => lead.personalization_strategy && lead.approval_status === 'pending_review').length;
  const launchChecklist = [
    {
      label: 'Email account selected',
      detail: selectedEmailAccount ? `${selectedEmailAccount.email_address} is active` : 'Choose an active sender account.',
      ok: Boolean(selectedEmailAccount),
      required: true,
    },
    {
      label: 'Sequence exists',
      detail: sequences.length > 0 ? `${sequences.length} step${sequences.length === 1 ? '' : 's'} configured` : 'Add at least one sequence step.',
      ok: sequences.length > 0,
      required: true,
    },
    {
      label: 'Leads added',
      detail: leads.length > 0 ? `${leads.length} lead${leads.length === 1 ? '' : 's'} in campaign` : 'Add or import leads before launching.',
      ok: leads.length > 0,
      required: true,
    },
    {
      label: 'Approved leads ready',
      detail: approvedLeadsCount > 0 ? `${approvedLeadsCount} approved/queued lead${approvedLeadsCount === 1 ? '' : 's'}` : 'Approve at least one lead or disable approval rules before automation.',
      ok: approvedLeadsCount > 0 || campaign?.require_approval_before_send === false,
      required: true,
    },
    {
      label: 'Daily campaign limit',
      detail: `${campaign?.daily_limit || 0} email${Number(campaign?.daily_limit || 0) === 1 ? '' : 's'} per day`,
      ok: Number(campaign?.daily_limit || 0) > 0,
      required: true,
    },
    {
      label: 'Safety stops enabled',
      detail: 'Replies, bounces, unsubscribes, suppression matches, and email-verification rules stop unsafe sends.',
      ok: true,
      required: false,
    },
  ];
  const launchBlockingIssues = launchChecklist.filter((item) => item.required && !item.ok);
  const leadTotalPages = Math.max(1, Math.ceil(leads.length / pageSize));
  const safeLeadsPage = Math.min(leadsPage, leadTotalPages);
  const paginatedLeads = leads.slice((safeLeadsPage - 1) * pageSize, safeLeadsPage * pageSize);
  const personalizationTotalPages = Math.max(1, Math.ceil(leads.length / pageSize));
  const safePersonalizationPage = Math.min(personalizationPage, personalizationTotalPages);
  const paginatedPersonalizationLeads = leads.slice((safePersonalizationPage - 1) * pageSize, safePersonalizationPage * pageSize);
  const reviewLeads = leads.filter((lead) => {
    if (!lead.personalization_strategy) return false;
    if (reviewFilter === 'all') return true;
    return lead.approval_status === reviewFilter;
  });
  const reviewTotalPages = Math.max(1, Math.ceil(reviewLeads.length / pageSize));
  const safeReviewPage = Math.min(reviewPage, reviewTotalPages);
  const paginatedReviewLeads = reviewLeads.slice((safeReviewPage - 1) * pageSize, safeReviewPage * pageSize);

  const renderPagination = (currentPage: number, totalPages: number, totalItems: number, onPageChange: (page: number) => void) => (
    <div className="mt-4 flex flex-col gap-3 border-t border-[var(--border)] pt-4 text-xs text-zinc-500 sm:flex-row sm:items-center sm:justify-between">
      <span>
        Showing {totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1}-{Math.min(currentPage * pageSize, totalItems)} of {totalItems}
      </span>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage <= 1}
          className="rounded-lg border border-[var(--border)] bg-white px-3 py-1.5 font-semibold text-zinc-700 transition hover:bg-violet-50 disabled:opacity-50"
        >
          Previous
        </button>
        <span className="font-semibold text-zinc-700">Page {currentPage} / {totalPages}</span>
        <button
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage >= totalPages}
          className="rounded-lg border border-[var(--border)] bg-white px-3 py-1.5 font-semibold text-zinc-700 transition hover:bg-violet-50 disabled:opacity-50"
        >
          Next
        </button>
      </div>
    </div>
  );

  return (
    <AppShell showSearch={false}>
      <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <CampaignHeader
          campaignId={campaignId}
          campaign={campaign}
          loading={loading}
          error={error}
          success={success}
          onDismissError={() => setError(null)}
          onDismissSuccess={() => setSuccess(null)}
          emailAccounts={emailAccounts}
          auditLogs={auditLogs}
          onEmailAccountChange={handleCampaignEmailAccountChange}
          onAllowRiskyEmailsChange={handleAllowRiskyEmailsChange}
          onLaunchClick={() => setLaunchModalOpen(true)}
          onPauseClick={handlePauseCampaign}
          launchChecklist={launchChecklist}
          launchBlockingIssuesCount={launchBlockingIssues.length}
          approvedLeadsCount={approvedLeadsCount}
          pendingReviewCount={pendingReviewCount}
          analytics={analytics}
          rateOfSent={rateOfSent}
        />

        {loading ? (
          <div className="flex h-64 items-center justify-center text-violet-500">
            <Spinner size={32} />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Tab Selectors */}
            <div className="flex border-b border-[var(--border)] gap-6">
              {[
                { id: 'leads', label: 'Leads List' },
                { id: 'sequence', label: 'Outreach Sequence' },
                { id: 'personalize', label: 'AI Personalization' },
                { id: 'review', label: 'Outbox Review' }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`pb-3 text-sm font-semibold border-b-2 transition-all cursor-pointer ${
                    activeTab === tab.id
                      ? 'border-violet-500 text-white'
                      : 'border-transparent text-zinc-600 hover:text-zinc-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* TAB CONTENT: LEADS LIST */}
            {activeTab === 'leads' && (
              <LeadsTab
                campaignId={campaignId}
                leads={leads}
                paginatedLeads={paginatedLeads}
                leadsPage={safeLeadsPage}
                leadTotalPages={leadTotalPages}
                pageSize={pageSize}
                onLeadsPageChange={setLeadsPage}
                onRequestClearLeads={() => setClearLeadsConfirmOpen(true)}
              />
            )}

            {/* TAB CONTENT: SEQUENCE BUILDER */}
            {activeTab === 'sequence' && (
              <SequenceBuilderTab
                sequences={sequences}
                savingSequence={savingSequence}
                onAddStep={handleAddSequenceStep}
                onUpdateStepField={handleUpdateSequenceField}
                onRemoveStep={handleRemoveSequenceStep}
                onSaveSequence={handleSaveSequence}
              />
            )}

            {/* TAB CONTENT: AI PERSONALIZATION */}
            {activeTab === 'personalize' && (
              <PersonalizeTab
                campaignId={campaignId}
                promptInstructions={promptInstructions}
                onPromptInstructionsChange={setPromptInstructions}
                onRunAIPersonalization={handleRunAIPersonalization}
                personalizing={personalizing}
                personalizeProgress={personalizeProgress}
                paginatedPersonalizationLeads={paginatedPersonalizationLeads}
                totalLeadsCount={leads.length}
                personalizationPage={safePersonalizationPage}
                personalizationTotalPages={personalizationTotalPages}
                pageSize={pageSize}
                onPersonalizationPageChange={setPersonalizationPage}
              />
            )}

            {/* TAB CONTENT: OUTBOX REVIEW */}
            {activeTab === 'review' && (
              <OutboxReviewTab
                leads={leads}
                reviewFilter={reviewFilter}
                onSelectReviewFilter={(filter) => {
                  setReviewFilter(filter);
                  setSelectedLeadId(null);
                  setReviewPage(1);
                }}
                pendingBulkApprovalCount={pendingBulkApprovalLeads.length}
                onRequestBulkApprove={requestBulkApprove}
                reviewLeads={reviewLeads}
                paginatedReviewLeads={paginatedReviewLeads}
                selectedLeadId={selectedLeadId}
                onSelectLead={setSelectedLeadId}
                reviewPage={safeReviewPage}
                reviewTotalPages={reviewTotalPages}
                pageSize={pageSize}
                onReviewPageChange={setReviewPage}
                selectedLead={selectedLead}
                editedSubject={editedSubject}
                onEditedSubjectChange={setEditedSubject}
                editedBody={editedBody}
                onEditedBodyChange={setEditedBody}
                approvingLeadId={approvingLeadId}
                onApproveLead={handleApproveLead}
                onGoToPersonalize={() => setActiveTab('personalize')}
              />
            )}
          </div>
        )}
      </main>

      <CampaignModals
        bulkApproveModalOpen={bulkApproveModalOpen}
        onCloseBulkApproveModal={() => setBulkApproveModalOpen(false)}
        pendingBulkApprovalCount={pendingBulkApprovalLeads.length}
        onConfirmBulkApprove={handleBulkApprove}
        bulkApproving={approvingLeadId === 'bulk'}
        launchModalOpen={launchModalOpen}
        onCloseLaunchModal={() => setLaunchModalOpen(false)}
        campaignName={campaign?.name}
        launchChecklist={launchChecklist}
        launchBlockingIssuesCount={launchBlockingIssues.length}
        onConfirmLaunch={() => {
          setLaunchModalOpen(false);
          handleLaunchCampaign();
        }}
        clearLeadsConfirmOpen={clearLeadsConfirmOpen}
        onCloseClearLeadsConfirm={() => setClearLeadsConfirmOpen(false)}
        onConfirmClearLeads={handleClearLeads}
      />
    </AppShell>
  );
}
