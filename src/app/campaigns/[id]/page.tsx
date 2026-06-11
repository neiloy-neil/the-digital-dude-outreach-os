'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, use } from 'react';
import AppShell from '@/components/reachmira/AppShell';
import { createClient } from '@/utils/supabase/client';
import { 
  ArrowLeft, 
  Upload, 
  Trash2, 
  Plus, 
  Sparkles, 
  Play, 
  Pause, 
  ChevronRight, 
  Save, 
  AlertCircle,
  FileText,
  UserPlus,
  X
} from 'lucide-react';
import Link from 'next/link';

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
  const [loading, setLoading] = useState(true);
  const [campaign, setCampaign] = useState<any>(null);
  const [leads, setLeads] = useState<any[]>([]);
  const [sequences, setSequences] = useState<any[]>([]);
  const [emailAccounts, setEmailAccounts] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [sentEmails, setSentEmails] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

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

  // Sequence state
  const [savingSequence, setSavingSequence] = useState(false);

  // Review Queue Edit States
  const [editingLeadId, setEditingLeadId] = useState<string | null>(null);
  const [editedSubject, setEditedSubject] = useState('');
  const [editedBody, setEditedBody] = useState('');
  const [approvingLeadId, setApprovingLeadId] = useState<string | null>(null);
  const [bulkApproveModalOpen, setBulkApproveModalOpen] = useState(false);
  const [launchModalOpen, setLaunchModalOpen] = useState(false);

  useEffect(() => {
    loadCampaignData();
  }, [campaignId]);

  const loadCampaignData = async () => {
    try {
      // 1. Fetch Campaign
      const { data: camp, error: campError } = await supabase
        .from('campaigns')
        .select('*')
        .eq('id', campaignId)
        .single();

      if (campError) throw campError;
      setCampaign(camp);

      // 2. Fetch Leads
      const { data: leadList } = await supabase
        .from('leads')
        .select('*')
        .eq('campaign_id', campaignId)
        .order('created_at', { ascending: false });
      setLeads(leadList || []);

      // 3. Fetch Sequences
      const { data: seqList } = await supabase
        .from('sequences')
        .select('*')
        .eq('campaign_id', campaignId)
        .order('step_number', { ascending: true });
      setSequences(seqList || []);

      const { data: accounts } = await supabase
        .from('email_accounts')
        .select('id, provider, email_address, sender_name, status, is_default')
        .eq('status', 'active')
        .order('is_default', { ascending: false });
      setEmailAccounts(accounts || []);

      const { data: logs } = await supabase
        .from('audit_logs')
        .select('*')
        .eq('campaign_id', campaignId)
        .order('created_at', { ascending: false })
        .limit(10);
      setAuditLogs(logs || []);

      const { data: campaignSentEmails } = await supabase
        .from('sent_emails')
        .select('*')
        .eq('campaign_id', campaignId)
        .order('sent_at', { ascending: false });
      setSentEmails(campaignSentEmails || []);

    } catch (err: any) {
      setError(err.message || 'Error loading campaign details');
    } finally {
      setLoading(false);
    }
  };

  const handleCampaignEmailAccountChange = async (emailAccountId: string) => {
    try {
      const { error: updateError } = await supabase
        .from('campaigns')
        .update({ email_account_id: emailAccountId || null, updated_at: new Date().toISOString() })
        .eq('id', campaignId);

      if (updateError) throw updateError;

      setCampaign((prev: any) => (prev ? { ...prev, email_account_id: emailAccountId || null } : prev));
      setSuccess('Email account saved for this campaign.');
    } catch (err: any) {
      setError(err.message || 'Error saving campaign email account');
    }
  };

  const handleAllowRiskyEmailsChange = async (nextValue: boolean) => {
    try {
      const { error: updateError } = await supabase
        .from('campaigns')
        .update({ allow_risky_emails: nextValue, updated_at: new Date().toISOString() })
        .eq('id', campaignId);

      if (updateError) {
        if (String(updateError.message || '').toLowerCase().includes('allow_risky_emails')) {
          throw new Error('Apply the latest database migration to save the risky-email campaign setting.');
        }
        throw updateError;
      }

      setCampaign((prev: any) => (prev ? { ...prev, allow_risky_emails: nextValue } : prev));
      setSuccess(nextValue ? 'Campaign will allow risky or unchecked emails during automation.' : 'Campaign will now skip risky or unchecked emails during automation.');
    } catch (err: any) {
      setError(err.message || 'Error saving risky-email setting');
    }
  };

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

  // --- SEQUENCE OPERATIONS ---
  const handleAddSequenceStep = () => {
    const nextStepNum = sequences.length + 1;
    setSequences([
      ...sequences,
      {
        campaign_id: campaignId,
        step_number: nextStepNum,
        delay_days: nextStepNum === 1 ? 0 : 2, // step 1 defaults to 0 (immediate), subsequent steps to 2 days
        condition: 'always',
        subject: 'Quick question {{first_name}}',
        body: 'Hi {{first_name}},\n\n{{ai_personalization}}\n\nWould you be open to a quick call next week?\n\nBest,\n{{sender_name}}',
      }
    ]);
  };

  const handleUpdateSequenceField = (index: number, field: string, value: any) => {
    const updated = [...sequences];
    updated[index] = { ...updated[index], [field]: value };
    setSequences(updated);
  };

  const handleRemoveSequenceStep = (index: number) => {
    const updated = sequences.filter((_, i) => i !== index).map((step, idx) => ({
      ...step,
      step_number: idx + 1, // Re-index step numbers
    }));
    setSequences(updated);
  };

  const handleSaveSequence = async () => {
    setSavingSequence(true);
    setError(null);
    setSuccess(null);

    try {
      // 1. Delete all current sequences for this campaign
      const { error: deleteError } = await supabase
        .from('sequences')
        .delete()
        .eq('campaign_id', campaignId);

      if (deleteError) throw deleteError;

      // 2. Insert new sequences if any
      if (sequences.length > 0) {
        const insertPayload = sequences.map(({ step_number, delay_days, subject, body, condition }, idx) => ({
          campaign_id: campaignId,
          step_number,
          delay_days: Number(delay_days),
          subject,
          body,
          condition: idx === 0 ? 'always' : (condition || 'always'),
        }));

        let { error: insertError } = await supabase
          .from('sequences')
          .insert(insertPayload);

        if (insertError && String(insertError.message || '').toLowerCase().includes('condition')) {
          // Databases without the conditions migration still accept plain steps.
          const legacyPayload = insertPayload.map(({ condition: _condition, ...rest }) => rest);
          const legacyResponse = await supabase.from('sequences').insert(legacyPayload);
          insertError = legacyResponse.error;
        }

        if (insertError) throw insertError;
      }

      setSuccess('Outreach sequence steps saved successfully!');
      await loadCampaignData();
    } catch (err: any) {
      setError(err.message || 'Error saving sequence steps');
    } finally {
      setSavingSequence(false);
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

  // --- CAMPAIGN LAUNCH CONTROL ---
  const handleLaunchCampaign = async () => {
    if (sequences.length === 0) {
      setError('Please add at least one email sequence step before launching.');
      return;
    }
    if (!campaign?.email_account_id) {
      setError('Please add an email account before starting a campaign.');
      return;
    }

    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`/api/campaigns/${campaignId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'active' }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Error launching campaign');

      setSuccess('Campaign launched! Approved leads will now be dispatched.');
      await loadCampaignData();
    } catch (err: any) {
      setError(err.message || 'Error launching campaign');
    }
  };

  const handlePauseCampaign = async () => {
    try {
      const response = await fetch(`/api/campaigns/${campaignId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'paused' }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Error pausing campaign');

      setSuccess('Campaign paused. Outbox dispatches are temporarily halted.');
      await loadCampaignData();
    } catch (err: any) {
      setError(err.message || 'Error pausing campaign');
    }
  };

  const handleClearLeads = async () => {
    if (!confirm('Are you sure you want to delete ALL leads in this campaign? This will also cancel any pending emails.')) return;
    try {
      const { error } = await supabase
        .from('leads')
        .delete()
        .eq('campaign_id', campaignId);
      if (error) throw error;
      setSuccess('All leads deleted.');
      await loadCampaignData();
    } catch (err: any) {
      setError(err.message || 'Error clearing leads');
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
        {/* Back and Title */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <Link href="/campaigns" className="p-2 bg-white border border-[var(--border)] rounded-lg text-zinc-600 hover:text-violet-700 transition-all">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            {campaign && (
              <div>
                <h2 className="text-2xl font-bold text-zinc-950 tracking-tight">{campaign.name}</h2>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-medium uppercase border ${
                    campaign.status === 'active' 
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                      : campaign.status === 'paused'
                      ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                      : 'bg-[var(--surface-muted)] text-zinc-600 border-zinc-700'
                  }`}>
                    {campaign.status}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Campaign Action buttons */}
          {campaign && (
            <div className="flex items-center gap-3">
              {campaign.status === 'draft' || campaign.status === 'paused' ? (
                <button
                  onClick={() => setLaunchModalOpen(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 rounded-lg text-sm font-semibold text-white hover:opacity-90 shadow-md shadow-emerald-500/10 cursor-pointer"
                >
                  <Play className="h-4 w-4" /> Launch Campaign
                </button>
              ) : (
                <button
                  onClick={handlePauseCampaign}
                  className="flex items-center gap-2 px-4 py-2 bg-white border border-[var(--border)] rounded-lg text-sm font-semibold text-amber-400 hover:text-amber-300 hover:bg-violet-50 cursor-pointer"
                >
                  <Pause className="h-4 w-4" /> Pause Campaign
                </button>
              )}
            </div>
          )}
        </div>

        {/* Global Notifications */}
        {error && (
          <div className="mb-6 rounded-lg bg-rose-500/10 p-3 text-xs text-rose-400 border border-rose-500/20 flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
        )}
        {success && (
          <div className="mb-6 rounded-lg bg-emerald-500/10 p-3 text-xs text-emerald-400 border border-emerald-500/20">
            {success}
          </div>
        )}

        {!loading && campaign && (
          <div className="mb-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-xl border border-[var(--border)] bg-white/20 p-4 backdrop-blur-sm">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div>
                  <h3 className="text-sm font-bold text-zinc-950">Email Account</h3>
                  <p className="text-xs text-zinc-500">Choose the sender account used for this campaign.</p>
                </div>
                <Link href="/settings/email-accounts" className="text-xs font-semibold text-violet-400 hover:text-violet-300">
                  Manage accounts
                </Link>
              </div>
              <select
                value={campaign.email_account_id || ''}
                onChange={(e) => handleCampaignEmailAccountChange(e.target.value)}
                className="w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm text-zinc-900 focus:border-violet-500 focus:outline-none"
              >
                <option value="">Select an active email account</option>
                {emailAccounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.email_address} - {account.provider.toUpperCase()}
                    {account.is_default ? ' (Default)' : ''}
                  </option>
                ))}
              </select>
              {!emailAccounts.length && (
                <p className="mt-3 text-xs text-amber-400">
                  Please add an email account before starting a campaign.
                </p>
              )}
            </div>

            <div className="rounded-xl border border-[var(--border)] bg-white/20 p-4 backdrop-blur-sm">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div>
                  <h3 className="text-sm font-bold text-zinc-950">Latest Activity</h3>
                  <p className="text-xs text-zinc-500">Recent campaign audit trail.</p>
                </div>
                <Link href={`/campaigns/${campaignId}/activity`} className="text-xs font-semibold text-violet-400 hover:text-violet-300">
                  View all
                </Link>
              </div>
              <div className="space-y-2">
                {auditLogs.length === 0 ? (
                  <p className="text-xs text-zinc-500">No audit logs yet.</p>
                ) : (
                  auditLogs.slice(0, 4).map((log) => (
                    <div key={log.id} className="flex items-start justify-between gap-3 rounded-lg border border-[var(--border)] bg-white/60 px-3 py-2">
                      <div>
                        <div className="text-xs font-semibold text-zinc-900">{log.action}</div>
                        <div className="text-[11px] text-zinc-600">{log.message || 'No message'}</div>
                      </div>
                      <div className="text-[10px] text-zinc-500 font-mono">
                        {new Date(log.created_at).toLocaleString()}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {!loading && campaign && (
          <div className="mb-6 rounded-xl border border-[var(--border)] bg-white/20 p-4 backdrop-blur-sm">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h3 className="text-sm font-bold text-zinc-950">Email Verification Safety</h3>
                <p className="text-xs text-zinc-500">Automation always blocks `invalid`, `disposable`, and `suppressed` leads. This setting controls whether `not_checked`, `unknown`, and `risky` leads are skipped or allowed.</p>
              </div>
              <label className="inline-flex items-center gap-3 rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm font-semibold text-zinc-800">
                <input
                  type="checkbox"
                  checked={Boolean(campaign.allow_risky_emails)}
                  onChange={(e) => handleAllowRiskyEmailsChange(e.target.checked)}
                  className="rounded border-zinc-300 text-violet-600 focus:ring-violet-500"
                />
                Allow risky email statuses
              </label>
            </div>
            <div className="mt-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 text-xs text-zinc-600">
              Current policy: <span className="font-semibold text-zinc-900">{campaign.allow_risky_emails ? 'Allow risky/unchecked campaign sends' : 'Skip risky/unchecked campaign sends'}</span>
            </div>
          </div>
        )}

        {!loading && campaign && (
          <section className="mb-6 rounded-3xl border border-[var(--border)] bg-white p-5 shadow-[0_12px_40px_rgba(15,23,42,0.04)]">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h3 className="text-sm font-bold text-zinc-950">Launch Readiness</h3>
                <p className="mt-1 text-xs text-zinc-500">A quick safety pass before campaign automation starts sending.</p>
              </div>
              <div className={`rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-wide ${
                launchBlockingIssues.length === 0
                  ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100'
                  : 'bg-amber-50 text-amber-700 ring-1 ring-amber-100'
              }`}>
                {launchBlockingIssues.length === 0 ? 'Ready to launch' : `${launchBlockingIssues.length} issue${launchBlockingIssues.length === 1 ? '' : 's'} to fix`}
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {launchChecklist.map((item) => (
                <div key={item.label} className={`rounded-2xl border p-4 ${
                  item.ok
                    ? 'border-emerald-100 bg-emerald-50/60'
                    : 'border-amber-200 bg-amber-50'
                }`}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold text-zinc-950">{item.label}</div>
                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${
                      item.ok ? 'bg-white text-emerald-700 ring-1 ring-emerald-100' : 'bg-white text-amber-700 ring-1 ring-amber-100'
                    }`}>
                      {item.ok ? 'Ready' : 'Needs fix'}
                    </span>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-zinc-600">{item.detail}</p>
                </div>
              ))}
            </div>

            <div className="mt-4 grid gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] p-4 text-xs text-zinc-600 sm:grid-cols-3">
              <div><span className="font-semibold text-zinc-950">{approvedLeadsCount}</span> approved or queued</div>
              <div><span className="font-semibold text-zinc-950">{pendingReviewCount}</span> pending review</div>
              <div><span className="font-semibold text-zinc-950">{campaign.daily_limit || 0}</span> campaign daily limit</div>
            </div>
          </section>
        )}

        {!loading && campaign && (
          <section className="mb-6 rounded-3xl border border-[var(--border)] bg-white p-5 shadow-[0_12px_40px_rgba(15,23,42,0.04)]">
            <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h3 className="text-sm font-bold text-zinc-950">Campaign Analytics</h3>
                <p className="text-xs text-zinc-500">Live delivery and lead outcomes for this campaign.</p>
              </div>
              <Link href={`/campaigns/${campaignId}/activity`} className="text-xs font-semibold text-violet-700 hover:text-violet-900">
                View timeline
              </Link>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
              {([
                ['Leads', analytics.leads, 'text-slate-700 bg-slate-50 border-slate-200', null],
                ['Sent', analytics.sent, 'text-violet-700 bg-violet-50 border-violet-200', null],
                ['Delivered', analytics.delivered, 'text-teal-700 bg-teal-50 border-teal-200', null],
                ['Opened', analytics.opened, 'text-sky-700 bg-sky-50 border-sky-200', rateOfSent(analytics.opened)],
                ['Clicked', analytics.clicked, 'text-indigo-700 bg-indigo-50 border-indigo-200', rateOfSent(analytics.clicked)],
                ['Replied', analytics.replied, 'text-emerald-700 bg-emerald-50 border-emerald-200', rateOfSent(analytics.replied)],
                ['Bounced', analytics.bounced, 'text-rose-700 bg-rose-50 border-rose-200', null],
                ['Unsubscribed', analytics.unsubscribed, 'text-amber-700 bg-amber-50 border-amber-200', null],
              ] as [string, number, string, string | null][]).map(([label, value, tone, rate]) => (
                <div key={label} className={`rounded-2xl border px-3 py-3 ${tone}`}>
                  <div className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-75">{label}</div>
                  <div className="mt-2 text-2xl font-black tracking-tight">{value}</div>
                  {rate && <div className="mt-0.5 text-[10px] font-semibold opacity-70">{rate}</div>}
                </div>
              ))}
            </div>
          </section>
        )}

        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-violet-500 border-t-transparent" />
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
              <div className="space-y-4">
                {/* Upload & Google Sheets / CSV Help Panel Banner */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-6 rounded-xl border border-[var(--border)] bg-white/20 p-6 backdrop-blur-sm">
                  <div>
                    <h3 className="font-bold text-zinc-950 text-md">Campaign Prospects & Leads</h3>
                    <p className="text-xs text-zinc-600">Import your leads from a local CSV spreadsheet or a public Google Sheet URL using our advanced column mapper.</p>
                  </div>
                  <div className="flex items-center gap-3">
                    {leads.length > 0 && (
                      <button
                        onClick={handleClearLeads}
                        className="px-4 py-2 bg-rose-500/5 border border-rose-500/10 hover:bg-rose-500/10 text-rose-400 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                      >
                        Clear Leads
                      </button>
                    )}
                    <Link
                      href={`/campaigns/${campaignId}/leads/import`}
                      className="px-5 py-2 bg-gradient-to-r from-violet-600 to-teal-500 hover:opacity-90 rounded-lg text-xs font-semibold text-white shadow-lg shadow-violet-500/10 transition-opacity whitespace-nowrap"
                    >
                      Import Leads Wizard &rarr;
                    </Link>
                  </div>
                </div>

                {/* Leads Table */}
                <div className="rounded-xl border border-[var(--border)] bg-white/20 p-6 backdrop-blur-sm">
                  <h3 className="font-bold text-zinc-950 mb-4 text-md">Leads ({leads.length})</h3>
                  {leads.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-48 text-zinc-500">
                      <UserPlus className="h-10 w-10 text-zinc-700 mb-2" />
                      <p className="text-sm font-medium">No leads added to this campaign yet.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto max-h-96">
                      <table className="w-full text-left text-sm text-zinc-600">
                        <thead className="text-xs font-semibold uppercase text-zinc-500 border-b border-[var(--border)] bg-white/30 sticky top-0">
                          <tr>
                            <th className="py-2.5 px-4">Name</th>
                            <th className="py-2.5 px-4">Email</th>
                            <th className="py-2.5 px-4">Company</th>
                            <th className="py-2.5 px-4">AI Intro</th>
                            <th className="py-2.5 px-4">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--border)]">
                          {paginatedLeads.map((lead) => (
                            <tr key={lead.id} className="hover:bg-white/20">
                              <td className="py-3 px-4 text-zinc-900 font-medium">
                                <Link href={`/campaigns/${campaignId}/leads/${lead.id}`} className="text-violet-400 hover:underline">
                                  {lead.decision_maker_name || lead.first_name || lead.last_name 
                                    ? `${lead.first_name || ''} ${lead.last_name || ''}`.trim() || lead.decision_maker_name
                                    : lead.email.split('@')[0]}
                                </Link>
                              </td>
                              <td className="py-3 px-4 font-mono text-xs text-zinc-700">{lead.email}</td>
                              <td className="py-3 px-4 text-zinc-700">{lead.company_name || lead.company || '-'}</td>
                              <td className="py-3 px-4 text-xs italic max-w-xs truncate text-violet-300" title={lead.ai_personalized_first_line || lead.ai_personalization}>
                                {lead.ai_personalized_first_line || lead.ai_personalization || 'Not generated'}
                              </td>
                              <td className="py-3 px-4">
                                <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase border ${
                                  lead.status === 'replied'
                                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                    : lead.status === 'sending' || lead.status === 'sent'
                                    ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                                    : lead.status === 'unsubscribed' || lead.status === 'bounced' || lead.status === 'complained'
                                    ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                                    : 'bg-[var(--surface-muted)] text-zinc-600 border-zinc-700'
                                }`}>
                                  {lead.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {renderPagination(safeLeadsPage, leadTotalPages, leads.length, setLeadsPage)}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB CONTENT: SEQUENCE BUILDER */}
            {activeTab === 'sequence' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-zinc-950 text-md">Email Follow-up Steps</h3>
                    <p className="text-xs text-zinc-600">Configure email subjects, delay timers, and markdown templates for follow-ups.</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={handleAddSequenceStep}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-[var(--border)] hover:bg-violet-50 hover:text-violet-700 rounded-lg text-xs font-semibold text-zinc-700 transition-colors cursor-pointer"
                    >
                      <Plus className="h-4 w-4 text-violet-400" /> Add Step
                    </button>
                    <button
                      onClick={handleSaveSequence}
                      disabled={savingSequence}
                      className="flex items-center gap-1.5 px-4 py-1.5 bg-gradient-to-r from-violet-600 to-teal-500 rounded-lg text-xs font-semibold text-white hover:opacity-90 shadow-md shadow-violet-500/10 transition-colors disabled:opacity-50 cursor-pointer"
                    >
                      {savingSequence ? (
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      ) : (
                        <>
                          <Save className="h-4 w-4" /> Save Sequence
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {sequences.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-64 border border-dashed border-[var(--border)] rounded-lg p-6">
                    <FileText className="h-10 w-10 text-zinc-700 mb-3" />
                    <p className="text-sm text-zinc-500 font-medium">No sequence steps added.</p>
                    <button onClick={handleAddSequenceStep} className="mt-3 text-xs text-violet-400 hover:text-violet-300 font-semibold">
                      Create step 1 now &rarr;
                    </button>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {sequences.map((step, index) => (
                      <div key={index} className="rounded-xl border border-[var(--border)] bg-white/20 p-6 backdrop-blur-sm space-y-4">
                        <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
                          <div className="flex items-center gap-3">
                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-violet-600/10 text-xs font-bold text-violet-400 border border-violet-500/20">
                              {step.step_number}
                            </span>
                            <h4 className="font-bold text-zinc-950">Step {step.step_number} Email</h4>
                          </div>

                          <div className="flex items-center gap-4">
                            {/* Send condition (vs previous email engagement) */}
                            {index > 0 && (
                              <select
                                value={step.condition || 'always'}
                                onChange={(e) => handleUpdateSequenceField(index, 'condition', e.target.value)}
                                className="rounded border border-[var(--border)] bg-white px-2 py-1 text-xs text-zinc-700 focus:border-violet-500 focus:outline-none"
                                title="Send this step only when the condition on the previous email is met"
                              >
                                <option value="always">Always send</option>
                                <option value="not_opened">Only if NOT opened</option>
                                <option value="opened">Only if opened</option>
                                <option value="clicked">Only if link clicked</option>
                              </select>
                            )}

                            {/* Delay Days */}
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-zinc-600">Delay:</span>
                              <input
                                type="number"
                                min="0"
                                value={step.delay_days}
                                onChange={(e) => handleUpdateSequenceField(index, 'delay_days', e.target.value)}
                                className="w-16 rounded border border-[var(--border)] bg-white px-2 py-0.5 text-center text-xs font-semibold text-zinc-900 focus:outline-none focus:border-violet-500"
                              />
                              <span className="text-xs text-zinc-600">days</span>
                            </div>

                            {/* Remove Step */}
                            <button
                              onClick={() => handleRemoveSequenceStep(index)}
                              className="p-1 rounded text-zinc-500 hover:text-rose-400 hover:bg-rose-500/5 transition-colors cursor-pointer"
                              title="Delete Step"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>

                        {/* Subject */}
                        <div>
                          <label className="block text-[10px] text-zinc-500 font-semibold uppercase tracking-wider">Subject Line</label>
                          <input
                            type="text"
                            value={step.subject}
                            onChange={(e) => handleUpdateSequenceField(index, 'subject', e.target.value)}
                            placeholder="E.g. Quick question"
                            className="mt-1 w-full rounded-lg border border-[var(--border)] bg-white py-2 px-3 text-sm text-zinc-900 focus:border-violet-500 focus:outline-none transition-colors"
                          />
                        </div>

                        {/* Body */}
                        <div>
                          <label className="block text-[10px] text-zinc-500 font-semibold uppercase tracking-wider">Email Body (Plain/Markdown)</label>
                          <textarea
                            rows={8}
                            value={step.body}
                            onChange={(e) => handleUpdateSequenceField(index, 'body', e.target.value)}
                            placeholder="Write your email outreach template here..."
                            className="mt-1 w-full rounded-lg border border-[var(--border)] bg-white py-2.5 px-3 text-sm text-zinc-900 focus:border-violet-500 focus:outline-none transition-colors font-sans"
                          />
                        </div>

                        {/* Formatting Variables Info */}
                        <div className="flex flex-wrap gap-2 text-[10px] text-zinc-600 font-medium">
                          <span>Placeholders:</span>
                          <code className="text-violet-400 font-mono">{"{{first_name}}"}</code>
                          <code className="text-violet-400 font-mono">{"{{last_name}}"}</code>
                          <code className="text-violet-400 font-mono">{"{{company}}"}</code>
                          <code className="text-violet-400 font-mono">{"{{ai_personalization}}"}</code>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB CONTENT: AI PERSONALIZATION */}
            {activeTab === 'personalize' && (
              <div className="space-y-6">
                <div className="rounded-xl border border-[var(--border)] bg-white/20 p-6 backdrop-blur-sm space-y-4">
                  <div>
                    <h3 className="font-bold text-zinc-950 text-md">Gemini AI Personalization Prompt</h3>
                    <p className="text-xs text-zinc-600">Configure instructions for the AI to personalize an introduction sentence for each prospect before emails are sent.</p>
                  </div>

                  <div>
                    <label className="block text-xs text-zinc-600 font-semibold uppercase">AI Instruction Template</label>
                    <textarea
                      rows={4}
                      value={promptInstructions}
                      onChange={(e) => setPromptInstructions(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-[var(--border)] bg-white py-2.5 px-3 text-sm text-zinc-900 focus:border-violet-500 focus:outline-none transition-colors font-sans"
                    />
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={handleRunAIPersonalization}
                      disabled={personalizing}
                      className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-violet-600 to-teal-500 rounded-lg text-xs font-semibold text-white hover:opacity-90 shadow-lg shadow-violet-600/20 disabled:opacity-50 cursor-pointer"
                    >
                      <Sparkles className="h-4 w-4" /> Run Gemini AI Personalization
                    </button>
                    <Link
                      href={`/campaigns/${campaignId}/personalization`}
                      className="px-5 py-2.5 bg-white border border-[var(--border)] hover:bg-violet-50 rounded-lg text-xs font-semibold text-zinc-700 hover:text-violet-700 transition-all shadow-md"
                    >
                      Go to Personalization Review Dashboard &rarr;
                    </Link>
                    {personalizeProgress && (
                      <span className="text-xs text-violet-400 font-medium animate-pulse">{personalizeProgress}</span>
                    )}
                  </div>

                  <div className="text-[11px] text-zinc-500 border-t border-[var(--border)] pt-4">
                    <strong>Note:</strong> This runs only for leads currently in <code className="font-mono">imported</code> status who do not yet have an generated AI introduction. It calls Gemini <code className="font-mono">gemini-2.5-flash</code>. Ensure your Gemini API Key is saved in Settings first.
                  </div>
                </div>

                {/* Preview Personalizations */}
                <div className="rounded-xl border border-[var(--border)] bg-white/20 p-6 backdrop-blur-sm">
                  <h3 className="font-bold text-zinc-950 mb-4 text-md">AI Personalization Previews</h3>
                  <div className="overflow-x-auto max-h-80">
                    <table className="w-full text-left text-sm text-zinc-600">
                      <thead className="text-xs font-semibold uppercase text-zinc-500 border-b border-[var(--border)] bg-white/30">
                        <tr>
                          <th className="py-2.5 px-4">Prospect</th>
                          <th className="py-2.5 px-4">Company</th>
                          <th className="py-2.5 px-4">Generated Personalization</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--border)]">
                        {paginatedPersonalizationLeads.map((lead) => (
                          <tr key={lead.id} className="hover:bg-white/20">
                            <td className="py-3 px-4">
                              <Link
                                href={`/campaigns/${campaignId}/leads/${lead.id}`}
                                className="font-semibold text-violet-700 transition hover:text-violet-800 hover:underline"
                                title="Open lead profile"
                              >
                                {lead.first_name || lead.email}
                              </Link>
                            </td>
                            <td className="py-3 px-4 text-zinc-700">{lead.company || '-'}</td>
                            <td className="py-3 px-4 text-xs italic text-violet-300">
                              {lead.ai_personalization || <span className="text-zinc-600">No personalization generated yet.</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {renderPagination(safePersonalizationPage, personalizationTotalPages, leads.length, setPersonalizationPage)}
                  </div>
                </div>
              </div>
            )}

            {/* TAB CONTENT: OUTBOX REVIEW */}
            {activeTab === 'review' && (
              <div className="space-y-6">
                {/* Review Header / Controls */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white/40 p-4 border border-[var(--border)] rounded-xl backdrop-blur-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-zinc-600 font-semibold uppercase tracking-wider mr-2">Filter Leads:</span>
                    {[
                      { id: 'pending_review', label: 'Pending Review' },
                      { id: 'approved', label: 'Approved' },
                      { id: 'skipped', label: 'Skipped' },
                      { id: 'all', label: 'All AI Generated' }
                    ].map(btn => (
                      <button
                        key={btn.id}
                        onClick={() => {
                          setReviewFilter(btn.id as any);
                          setSelectedLeadId(null);
                          setReviewPage(1);
                        }}
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
                    onClick={requestBulkApprove}
                    disabled={approvingLeadId === 'bulk' || pendingBulkApprovalLeads.length === 0}
                    className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-violet-600 to-teal-500 rounded-lg text-xs font-semibold text-white hover:opacity-90 shadow-md shadow-violet-500/10 disabled:opacity-50 cursor-pointer"
                  >
                    <Sparkles className="h-4 w-4" /> Bulk Approve All Pending
                  </button>
                </div>

                {leads.filter(l => l.personalization_strategy).length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-72 border border-dashed border-[var(--border)] rounded-xl p-8 bg-white/10 text-center">
                    <Sparkles className="h-10 w-10 text-zinc-700 mb-3 animate-pulse" />
                    <h4 className="text-sm font-semibold text-zinc-700">No AI-Personalized Leads Found</h4>
                    <p className="text-xs text-zinc-500 max-w-sm mt-1">
                      Run AI Personalization on your imported leads first to review custom strategy, subjects, and email drafts here.
                    </p>
                    <button
                      onClick={() => setActiveTab('personalize')}
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
                              onClick={() => setSelectedLeadId(lead.id)}
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
                      {reviewLeads.length > pageSize && renderPagination(safeReviewPage, reviewTotalPages, reviewLeads.length, setReviewPage)}
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
                                  onChange={(e) => setEditedSubject(e.target.value)}
                                  className="mt-1 w-full rounded-lg border border-[var(--border)] bg-white py-2 px-3 text-xs text-zinc-900 focus:border-violet-500 focus:outline-none transition-colors"
                                />
                              </div>

                              <div>
                                <label className="block text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Email Body (Markdown/HTML)</label>
                                <textarea
                                  rows={8}
                                  value={editedBody}
                                  onChange={(e) => setEditedBody(e.target.value)}
                                  className="mt-1 w-full rounded-lg border border-[var(--border)] bg-white py-2.5 px-3 text-xs text-zinc-900 focus:border-violet-500 focus:outline-none transition-colors font-sans leading-relaxed"
                                />
                              </div>
                            </div>
                          </div>

                          {/* Detail Buttons Row */}
                          <div className="flex items-center justify-between border-t border-[var(--border)] pt-4 mt-4">
                            <button
                              onClick={() => handleApproveLead(selectedLead.id, 'skip')}
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
                                onClick={() => handleApproveLead(selectedLead.id, 'approve')}
                                disabled={approvingLeadId !== null || !editedSubject || !editedBody}
                                className="px-5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 rounded-lg text-xs font-semibold text-white hover:opacity-90 shadow-md shadow-emerald-500/10 cursor-pointer disabled:opacity-50"
                              >
                                {approvingLeadId === selectedLead.id ? (
                                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
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
            )}
          </div>
        )}
      </main>

      {bulkApproveModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl border border-[var(--border)] bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] pb-4">
              <div>
                <div className="mb-2 inline-flex rounded-full bg-amber-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-amber-700 ring-1 ring-amber-100">
                  Bulk send safety check
                </div>
                <h3 className="text-lg font-semibold text-zinc-950">Approve and queue {pendingBulkApprovalLeads.length} leads?</h3>
                <p className="mt-2 text-sm leading-6 text-zinc-500">
                  This will approve every pending personalized email and add them to the campaign outbox. If the campaign is active, ReachMira can send them during the next automation run while respecting campaign and email-account limits.
                </p>
              </div>
              <button
                onClick={() => setBulkApproveModalOpen(false)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] text-zinc-500 transition hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 grid gap-3 rounded-2xl border border-amber-100 bg-amber-50 p-4 text-sm text-amber-900">
              <div className="font-semibold">Before continuing, confirm:</div>
              <div>Each selected lead has been reviewed enough for automated sending.</div>
              <div>Your sequence, sender account, suppression checks, and daily limits are ready.</div>
            </div>

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                onClick={() => setBulkApproveModalOpen(false)}
                className="rounded-xl border border-[var(--border)] bg-white px-4 py-2.5 text-sm font-semibold text-zinc-700 transition hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkApprove}
                disabled={approvingLeadId === 'bulk'}
                className="rounded-xl bg-gradient-to-r from-violet-600 to-teal-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-600/15 transition hover:opacity-95 disabled:opacity-50"
              >
                Confirm Bulk Queue
              </button>
            </div>
          </div>
        </div>
      )}

      {launchModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-3xl border border-[var(--border)] bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] pb-4">
              <div>
                <div className="mb-2 inline-flex rounded-full bg-emerald-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 ring-1 ring-emerald-100">
                  Campaign launch
                </div>
                <h3 className="text-lg font-semibold text-zinc-950">Launch {campaign?.name}?</h3>
                <p className="mt-2 text-sm leading-6 text-zinc-500">
                  Once active, ReachMira will send approved campaign emails during automation runs while respecting suppression checks, campaign limits, and email-account limits.
                </p>
              </div>
              <button
                onClick={() => setLaunchModalOpen(false)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] text-zinc-500 transition hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-5 grid gap-3">
              {launchChecklist.map((item) => (
                <div key={item.label} className="flex items-start justify-between gap-4 rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] p-4">
                  <div>
                    <div className="text-sm font-semibold text-zinc-950">{item.label}</div>
                    <div className="mt-1 text-xs leading-5 text-zinc-500">{item.detail}</div>
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${
                    item.ok ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100' : 'bg-amber-50 text-amber-700 ring-1 ring-amber-100'
                  }`}>
                    {item.ok ? 'Ready' : 'Fix'}
                  </span>
                </div>
              ))}
            </div>

            {launchBlockingIssues.length > 0 && (
              <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-800">
                Fix the required launch items before starting this campaign. We’ll keep the launch button disabled until the checklist is clean.
              </div>
            )}

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                onClick={() => setLaunchModalOpen(false)}
                className="rounded-xl border border-[var(--border)] bg-white px-4 py-2.5 text-sm font-semibold text-zinc-700 transition hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setLaunchModalOpen(false);
                  handleLaunchCampaign();
                }}
                disabled={launchBlockingIssues.length > 0}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-600/15 transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Play className="h-4 w-4" /> Confirm Launch
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
