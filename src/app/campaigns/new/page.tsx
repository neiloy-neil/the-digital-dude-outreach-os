'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import AppShell from '@/components/reachmira/AppShell';
import { 
  ArrowLeft, 
  Settings, 
  Upload, 
  FileSpreadsheet, 
  Bot, 
  Mail, 
  Eye, 
  CheckCircle,
  AlertCircle,
  Plus,
  Trash2,
  HelpCircle,
  Database,
  Users
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Papa from 'papaparse';
import { calculateLeadDataQuality } from '@/utils/data-quality';

type TemplateOption = {
  id: string;
  name: string;
  category?: string | null;
  subject: string;
  body?: string | null;
};

const DESTINATION_FIELDS = [
  { key: 'email', label: 'Email Address (Required)', aliases: ['email', 'email address', 'email_address', 'mail'] },
  { key: 'first_name', label: 'First Name', aliases: ['first_name', 'first name', 'firstname', 'first'] },
  { key: 'last_name', label: 'Last Name', aliases: ['last_name', 'last name', 'lastname', 'last'] },
  { key: 'company_name', label: 'Company Name', aliases: ['company_name', 'company name', 'company', 'org', 'organization', 'firm'] },
  { key: 'website', label: 'Website URL', aliases: ['website', 'web', 'site', 'url'] },
  { key: 'industry', label: 'Industry', aliases: ['industry', 'sector'] },
  { key: 'sub_industry', label: 'Sub-Industry', aliases: ['sub_industry', 'sub industry', 'subsector'] },
  { key: 'country', label: 'Country', aliases: ['country', 'nation'] },
  { key: 'city', label: 'City', aliases: ['city', 'town', 'location'] },
  { key: 'company_size', label: 'Company Size', aliases: ['company_size', 'company size', 'size', 'employees'] },
  { key: 'estimated_revenue', label: 'Estimated Revenue', aliases: ['estimated_revenue', 'estimated revenue', 'revenue', 'rev'] },
  { key: 'decision_maker_name', label: 'Decision Maker Name', aliases: ['decision_maker_name', 'decision maker name', 'contact name', 'contact', 'name', 'full name', 'fullname', 'full_name'] },
  { key: 'decision_maker_title', label: 'Decision Maker Title', aliases: ['decision_maker_title', 'decision maker title', 'title', 'role', 'position'] },
  { key: 'linkedin_url', label: 'LinkedIn URL', aliases: ['linkedin_url', 'linkedin url', 'linkedin'] },
  { key: 'tech_stack', label: 'Tech Stack', aliases: ['tech_stack', 'tech stack', 'technologies', 'tech'] },
  { key: 'pain_points', label: 'Pain Points / Trigger', aliases: ['pain_points', 'pain points', 'pains', 'trigger', 'pain points / trigger', 'trigger event'] },
  { key: 'solution', label: 'Solution / Offer', aliases: ['solution', 'our solution', 'proposed solution', 'recommended solution', 'offer solution'] },
  { key: 'solution_score', label: 'Solution Score (0-100)', aliases: ['solution_score', 'solution score'] },
  { key: 'solution_fit_score', label: 'Solution Fit Score (0-100)', aliases: ['solution_fit_score', 'solution fit score'] },
  { key: 'lead_source', label: 'Lead Source', aliases: ['lead_source', 'lead source', 'source'] },
  { key: 'qc_by', label: 'QC BY', aliases: ['qc_by', 'qc by', 'qc'] },
  { key: 'outreach_channel', label: 'Outreach Channel', aliases: ['outreach_channel', 'outreach channel', 'channel'] },
  { key: 'outreach_status', label: 'Outreach Status', aliases: ['outreach_status', 'outreach status', 'outreach'] },
  { key: 'priority', label: 'Priority', aliases: ['priority', 'lead priority'] },
  { key: 'assigned_to', label: 'Assigned To', aliases: ['assigned_to', 'assigned to', 'assignee'] },
  { key: 'tags', label: 'Tags', aliases: ['tags', 'tag'] },
  { key: 'notes', label: 'Notes', aliases: ['notes', 'note', 'comment'] }
];

export default function CampaignWizardPage() {
  const router = useRouter();
  const supabase = createClient();
  const [currentStep, setCurrentStep] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [emailAccounts, setEmailAccounts] = useState<any[]>([]);
  const [templateOptions, setTemplateOptions] = useState<TemplateOption[]>([]);

  // STEP 1: Campaign Basics
  const [campaignName, setCampaignName] = useState('');
  const [targetIndustry, setTargetIndustry] = useState('');
  const [offerType, setOfferType] = useState('Custom Web Application');
  const [senderName, setSenderName] = useState('');
  const [senderEmail, setSenderEmail] = useState('');
  const [dailyLimit, setDailyLimit] = useState('100');
  const [emailAccountId, setEmailAccountId] = useState('');

  // STEP 2: Lead Import
  const [importTab, setImportTab] = useState<'library' | 'csv' | 'sheet'>('library');
  const [googleSheetUrl, setGoogleSheetUrl] = useState('');
  const [sheetGid, setSheetGid] = useState('');
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<any[][]>([]);
  const [mappings, setMappings] = useState<Record<string, string>>({});
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [importedLeads, setImportedLeads] = useState<any[]>([]); // Saved mapped lead list in-memory until Wizard completes
  const [libraryLeads, setLibraryLeads] = useState<any[]>([]);
  const [selectedLibraryLeadIds, setSelectedLibraryLeadIds] = useState<string[]>([]);
  const [librarySearch, setLibrarySearch] = useState('');
  const [loadingLibraryLeads, setLoadingLibraryLeads] = useState(false);
  const [libraryPage, setLibraryPage] = useState(1);
  const libraryPageSize = 10;

  // STEP 3: AI Strategy
  const [aiMode, setAiMode] = useState<'template_only' | 'basic_ai' | 'standard_ai' | 'deep_ai' | 'manual_only' | 'hybrid_smart'>('hybrid_smart');
  const [aiDepth, setAiDepth] = useState<'none' | 'basic' | 'standard' | 'deep'>('standard');
  const [defaultAiDepth, setDefaultAiDepth] = useState<'none' | 'basic' | 'standard' | 'deep'>('standard');
  const [minDataQualityForAi, setMinDataQualityForAi] = useState('45');
  const [fullAiMinSolutionScore, setFullAiMinSolutionScore] = useState('65');
  const [autoRunAiAfterImport, setAutoRunAiAfterImport] = useState(false);
  const [fetchWebsiteHomepage, setFetchWebsiteHomepage] = useState(true);
  const [requireApprovalBeforeSend, setRequireApprovalBeforeSend] = useState(true);
  const [allowDeepAi, setAllowDeepAi] = useState(true);
  const [requireManualApprovalForDeepAi, setRequireManualApprovalForDeepAi] = useState(false);
  const [useTemplateFallback, setUseTemplateFallback] = useState(true);

  useEffect(() => {
    const loadEmailAccounts = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from('email_accounts')
        .select('id, email_address, provider, is_default, status')
        .eq('status', 'active')
        .order('is_default', { ascending: false });

      const accounts = data || [];
      setEmailAccounts(accounts);

      const defaultAccount = accounts.find((account) => account.is_default) || accounts[0];
      if (defaultAccount) {
        setEmailAccountId(defaultAccount.id);
      }
    };

    loadEmailAccounts();
  }, []);

  useEffect(() => {
    const loadTemplates = async () => {
      try {
        const response = await fetch('/api/templates');
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to load templates');
        setTemplateOptions(Array.isArray(data.templates) ? data.templates : []);
      } catch (err: any) {
        setError(err.message || 'Error loading templates');
      }
    };

    loadTemplates();
  }, []);

  useEffect(() => {
    const loadLibraryLeads = async () => {
      setLoadingLibraryLeads(true);
      try {
        const response = await fetch('/api/leads');
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to load lead library');
        setLibraryLeads(Array.isArray(data.leads) ? data.leads : []);
      } catch (err: any) {
        setError(err.message || 'Error loading lead library');
      } finally {
        setLoadingLibraryLeads(false);
      }
    };

    loadLibraryLeads();
  }, []);

  // STEP 4: Sequences
  const [sequences, setSequences] = useState<any[]>([
    {
      step_number: 1,
      delay_days: 0,
      subject: 'Quick question {{first_name}}',
      body: 'Hi {{first_name}},\n\nI was looking at {{company_name}} and noticed {{pain_points}}.\n\n{{ai_personalized_first_line}}\n\nWould you be open to a quick call?\n\nBest,\n{{sender_name}}'
    }
  ]);

  // Handle CSV upload
  const handleCSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoadingPreview(true);
    setPreviewError(null);

    Papa.parse(file, {
      complete: (results) => {
        const parsedRows = results.data as string[][];
        if (parsedRows.length < 2) {
          setPreviewError('CSV must contain a header row.');
          setLoadingPreview(false);
          return;
        }
        const csvHeaders = parsedRows[0].map(h => String(h || '').trim());
        const csvRows = parsedRows.slice(1).filter(r => r.some(cell => cell !== ''));
        setHeaders(csvHeaders);
        setRows(csvRows);
        autoMapHeaders(csvHeaders);
        setLoadingPreview(false);
      },
      error: (err) => {
        setPreviewError(err.message);
        setLoadingPreview(false);
      }
    });
  };

  // Handle Sheet Preview
  const handleSheetPreview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!googleSheetUrl) return;

    setLoadingPreview(true);
    setPreviewError(null);

    try {
      const response = await fetch('/api/campaigns/dummy-id-for-wizard/import-sheets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: googleSheetUrl, gid: sheetGid }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to fetch Google Sheet.');

      setHeaders(data.headers || []);
      setRows(data.rows || []);
      autoMapHeaders(data.headers || []);
    } catch (err: any) {
      setPreviewError(err.message || 'Error occurred');
    } finally {
      setLoadingPreview(false);
    }
  };

  const autoMapHeaders = (availableHeaders: string[]) => {
    const initialMappings: Record<string, string> = {};
    DESTINATION_FIELDS.forEach(field => {
      const matchingHeader = availableHeaders.find(h => {
        const lowerH = h.toLowerCase();
        return field.aliases.some(alias => lowerH === alias || lowerH.replace(/[?_\s-]/g, '') === alias.replace(/[?_\s-]/g, ''));
      });
      if (matchingHeader) {
        initialMappings[field.key] = matchingHeader;
      }
    });
    setMappings(initialMappings);
  };

  const handleMapAndRegisterLeads = () => {
    if (!mappings['email']) {
      setError('You must map the Email field.');
      return;
    }

    const mapped = rows.map(row => {
      const leadObj: Record<string, any> = { raw_data: {} };
      headers.forEach((h, idx) => {
        leadObj.raw_data[h] = row[idx] || '';
      });

      DESTINATION_FIELDS.forEach(field => {
        const mappedHeader = mappings[field.key];
        if (mappedHeader) {
          const headerIndex = headers.indexOf(mappedHeader);
          if (headerIndex !== -1) {
            const value = row[headerIndex];
            if (value !== undefined && value !== null) {
              if (field.key === 'email_verified') {
                leadObj[field.key] = ['true', 'yes', 'y', '1'].includes(String(value).toLowerCase().trim());
              } else if (field.key === 'solution_score' || field.key === 'solution_fit_score') {
                const parsed = Number(value);
                leadObj[field.key] = Number.isNaN(parsed) ? null : parsed;
              } else {
                leadObj[field.key] = String(value).trim();
              }
            }
          }
        }
      });
      return leadObj;
    });

    setImportedLeads(mapped);
    setError(null);
    setHeaders([]);
    setRows([]);
    setMappings({});
    setCurrentStep(3); // Advance
  };

  const filteredLibraryLeads = libraryLeads.filter((lead) => {
    if (!librarySearch.trim()) return true;
    const haystack = [
      lead.email,
      lead.first_name,
      lead.last_name,
      lead.decision_maker_name,
      lead.company_name,
      lead.company,
      lead.industry,
      lead.country,
      lead.tags,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return haystack.includes(librarySearch.trim().toLowerCase());
  });
  const libraryTotalPages = Math.max(1, Math.ceil(filteredLibraryLeads.length / libraryPageSize));
  const safeLibraryPage = Math.min(libraryPage, libraryTotalPages);
  const paginatedLibraryLeads = filteredLibraryLeads.slice((safeLibraryPage - 1) * libraryPageSize, safeLibraryPage * libraryPageSize);

  const toggleLibraryLead = (leadId: string) => {
    setSelectedLibraryLeadIds((current) =>
      current.includes(leadId)
        ? current.filter((id) => id !== leadId)
        : [...current, leadId]
    );
  };

  const toggleAllVisibleLibraryLeads = () => {
    const visibleIds = paginatedLibraryLeads.map((lead) => lead.id);
    const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedLibraryLeadIds.includes(id));

    setSelectedLibraryLeadIds((current) =>
      allVisibleSelected
        ? current.filter((id) => !visibleIds.includes(id))
        : Array.from(new Set([...current, ...visibleIds]))
    );
  };

  // Add step to sequence
  const addSeqStep = () => {
    setSequences([
      ...sequences,
      {
        step_number: sequences.length + 1,
        delay_days: 2,
        subject: 'Re: Quick question',
        body: 'Hi {{first_name}},\n\nJust following up on my previous note. Would you be open to a 5-minute call next week?\n\nBest,\n{{sender_name}}'
      }
    ]);
  };

  // Remove step
  const removeSeqStep = (idx: number) => {
    const updated = sequences.filter((_, i) => i !== idx).map((s, i) => ({
      ...s,
      step_number: i + 1
    }));
    setSequences(updated);
  };

  const handleUpdateSequenceField = (idx: number, field: string, value: any) => {
    const updated = [...sequences];
    updated[idx] = { ...updated[idx], [field]: value };
    setSequences(updated);
  };

  const handleInsertTemplateIntoSequence = (idx: number, templateId: string) => {
    const template = templateOptions.find((item) => item.id === templateId);
    if (!template) return;

    const updated = [...sequences];
    updated[idx] = {
      ...updated[idx],
      template_id: template.id,
      subject: template.subject || updated[idx].subject,
      body: template.body || updated[idx].body,
    };
    setSequences(updated);
  };

  // Final wizard submit
  const handleCreateCampaign = async () => {
    setProcessing(true);
    setError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Authentication required');

      // 1. Create Campaign
      const { data: campaign, error: campError } = await supabase
        .from('campaigns')
        .insert({
          user_id: user.id,
          name: campaignName,
          target_industry: targetIndustry,
          offer_type: offerType,
          sender_name: senderName,
          sender_email: senderEmail,
          daily_limit: Number(dailyLimit) || 100,
          email_account_id: emailAccountId || null,
          require_approval_before_send: requireApprovalBeforeSend,
          allow_template_fallback: useTemplateFallback,
          use_template_fallback: useTemplateFallback,
          auto_generate_ai_before_send: false,
          ai_mode: aiMode,
          ai_depth: aiDepth,
          default_ai_depth: defaultAiDepth,
          auto_run_ai_after_import: autoRunAiAfterImport,
          fetch_website_homepage: fetchWebsiteHomepage,
          min_data_quality_for_ai: minDataQualityForAi ? Number(minDataQualityForAi) : null,
          full_ai_min_solution_score: fullAiMinSolutionScore ? Number(fullAiMinSolutionScore) : null,
          allow_deep_ai: allowDeepAi,
          require_manual_approval_for_deep_ai: requireManualApprovalForDeepAi,
          status: 'draft'
        })
        .select()
        .single();

      if (campError) throw campError;

      // 2. Create Sequences
      if (sequences.length > 0) {
        const seqPayload = sequences.map(s => ({
          campaign_id: campaign.id,
          step_number: s.step_number,
          delay_days: Number(s.delay_days) || 0,
          subject: s.subject,
          body: s.body
        }));

        const { error: seqError } = await supabase
          .from('sequences')
          .insert(seqPayload);

        if (seqError) throw seqError;
      }

      // 3. Import Leads
      if (importedLeads.length > 0) {
        const mappedPayload = importedLeads.map(lead => {
          const { score, label } = calculateLeadDataQuality(lead);
          return {
            campaign_id: campaign.id,
            email: lead.email,
            first_name: lead.first_name || null,
            last_name: lead.last_name || null,
            company: lead.company_name || lead.company || null,
            company_name: lead.company_name || lead.company || null,
            website: lead.website || null,
            industry: lead.industry || null,
            sub_industry: lead.sub_industry || null,
            country: lead.country || null,
            city: lead.city || null,
            company_size: lead.company_size || null,
            estimated_revenue: lead.estimated_revenue || null,
            decision_maker_name: lead.decision_maker_name || null,
            decision_maker_title: lead.decision_maker_title || null,
            email_verified: !!lead.email_verified,
            linkedin_url: lead.linkedin_url || null,
            tech_stack: lead.tech_stack || null,
            pain_points: lead.pain_points || null,
            solution: lead.solution || null,
            solution_score: lead.solution_score !== undefined && lead.solution_score !== null && lead.solution_score !== '' ? Number(lead.solution_score) : null,
            solution_fit_score: lead.solution_fit_score !== undefined && lead.solution_fit_score !== null && lead.solution_fit_score !== '' ? Number(lead.solution_fit_score) : null,
            lead_source: lead.lead_source || null,
            qc_by: lead.qc_by || null,
            outreach_channel: lead.outreach_channel || null,
            outreach_status: lead.outreach_status || null,
            priority: lead.priority || null,
            assigned_to: lead.assigned_to || null,
            tags: lead.tags || null,
            notes: lead.notes || null,
            raw_data: lead.raw_data || {},
            data_quality_score: score,
            data_quality_label: label,
            status: 'imported',
            ai_status: 'pending'
          };
        });

        // Insert using the batch import endpoint for safety and stats calculations
        const response = await fetch(`/api/campaigns/${campaign.id}/import-leads`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ leads: mappedPayload }),
        });

        if (!response.ok) {
          const errData = await response.json();
          throw new Error(errData.error || 'Failed to insert campaign leads.');
        }
      }

      if (selectedLibraryLeadIds.length > 0) {
        const response = await fetch('/api/lead-campaigns', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ campaignId: campaign.id, leadIds: selectedLibraryLeadIds }),
        });

        if (!response.ok) {
          const errData = await response.json();
          throw new Error(errData.error || 'Failed to attach selected library leads.');
        }
      }

      router.push(`/campaigns/${campaign.id}`);
    } catch (err: any) {
      setError(err.message || 'Error occurred creating campaign');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <AppShell showSearch={false}>
      <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Top Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link href="/campaigns" className="p-2 bg-white border border-[var(--border)] rounded-lg text-zinc-600 hover:text-violet-700 transition-all">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h2 className="text-2xl font-bold text-zinc-950 tracking-tight">Campaign Creation Wizard</h2>
            <p className="text-xs text-zinc-600">Step {currentStep} of 5 — {
              currentStep === 1 ? 'Configure Basics' :
              currentStep === 2 ? 'Import Prospect Leads' :
              currentStep === 3 ? 'AI Strategy Setup' :
              currentStep === 4 ? 'Sequence Templates' : 'Final Review & Creation'
            }</p>
          </div>
        </div>

        {/* Step Progress indicators */}
        <div className="flex gap-2 mb-6">
          {[1, 2, 3, 4, 5].map(step => (
            <div 
              key={step} 
              className={`h-2 flex-1 rounded-full transition-all ${
                step === currentStep ? 'bg-violet-500 shadow-md shadow-violet-500/25' : 
                step < currentStep ? 'bg-violet-800' : 'bg-[var(--surface-muted)]'
              }`}
            />
          ))}
        </div>

        {error && (
          <div className="mb-6 rounded-lg bg-rose-500/10 p-3.5 text-xs text-rose-400 border border-rose-500/20 flex items-center gap-2">
            <AlertCircle className="h-4.5 w-4.5" />
            {error}
          </div>
        )}

        {/* STEP 1: CAMPAIGN BASICS */}
        {currentStep === 1 && (
          <div className="rounded-xl border border-[var(--border)] bg-white/20 p-6 backdrop-blur-sm space-y-4">
            <h3 className="font-bold text-zinc-950 text-md border-b border-[var(--border)] pb-3 flex items-center gap-2"><Settings className="h-5 w-5 text-violet-400" /> Campaign Parameters</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Campaign Name</label>
                <input 
                  type="text" 
                  value={campaignName}
                  onChange={(e) => setCampaignName(e.target.value)}
                  placeholder="e.g. Q3 SaaS Enterprise Outreach"
                  className="mt-1 w-full rounded border border-[var(--border)] bg-white py-2 px-3 text-xs text-zinc-900 focus:border-violet-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Target Industry</label>
                <input 
                  type="text" 
                  value={targetIndustry}
                  onChange={(e) => setTargetIndustry(e.target.value)}
                  placeholder="e.g. Healthcare, Fintech, E-commerce"
                  className="mt-1 w-full rounded border border-[var(--border)] bg-white py-2 px-3 text-xs text-zinc-900 focus:border-violet-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Pitch Offer Type</label>
                <select 
                  value={offerType}
                  onChange={(e) => setOfferType(e.target.value)}
                  className="mt-1 w-full rounded border border-[var(--border)] bg-white py-2 px-3 text-xs text-zinc-900 focus:border-violet-500 focus:outline-none"
                >
                  <option value="Custom web applications">Custom web applications</option>
                  <option value="ERP systems">Enterprise Resource Planning (ERP) systems</option>
                  <option value="CRM systems">Customer Relationship Management (CRM) systems</option>
                  <option value="SaaS platforms">SaaS platforms</option>
                  <option value="AI chatbots">AI chatbots</option>
                  <option value="Workflow automation">Workflow automation</option>
                  <option value="Custom dashboards">Custom dashboards</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Daily Send Limit</label>
                <input 
                  type="number" 
                  value={dailyLimit}
                  onChange={(e) => setDailyLimit(e.target.value)}
                  placeholder="100"
                  className="mt-1 w-full rounded border border-[var(--border)] bg-white py-2 px-3 text-xs text-zinc-900 focus:border-violet-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Sender Display Name</label>
                <input 
                  type="text" 
                  value={senderName}
                  onChange={(e) => setSenderName(e.target.value)}
                  placeholder="e.g. Wazid from ReachMira"
                  className="mt-1 w-full rounded border border-[var(--border)] bg-white py-2 px-3 text-xs text-zinc-900 focus:border-violet-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Sender Outbound Email</label>
                <input 
                  type="email" 
                  value={senderEmail}
                  onChange={(e) => setSenderEmail(e.target.value)}
                  placeholder="wazid@innovatewave.online"
                  className="mt-1 w-full rounded border border-[var(--border)] bg-white py-2 px-3 text-xs text-zinc-900 focus:border-violet-500 focus:outline-none"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Email Account</label>
                <select
                  value={emailAccountId}
                  onChange={(e) => setEmailAccountId(e.target.value)}
                  className="mt-1 w-full rounded border border-[var(--border)] bg-white py-2 px-3 text-xs text-zinc-900 focus:border-violet-500 focus:outline-none"
                >
                  <option value="">Choose an active email account</option>
                  {emailAccounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.email_address} - {account.provider.toUpperCase()}
                      {account.is_default ? ' (Default)' : ''}
                    </option>
                  ))}
                </select>
                {!emailAccounts.length && (
                  <p className="mt-2 text-[11px] text-amber-400">
                    Please add an email account first. Campaigns can still be drafted, but launch will be blocked until one is selected.
                  </p>
                )}
              </div>
            </div>

            <div className="flex justify-end pt-4">
              <button
                onClick={() => {
                  if (!campaignName || !senderEmail) {
                    setError('Campaign Name and Sender Email are required.');
                    return;
                  }
                  setError(null);
                  setCurrentStep(2);
                }}
                className="px-6 py-2 bg-gradient-to-r from-violet-600 to-teal-500 rounded-lg text-xs font-semibold text-white hover:opacity-90"
              >
                Proceed to Lead Imports
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: LEAD IMPORT */}
        {currentStep === 2 && (
          <div className="space-y-6">
            <div className="rounded-xl border border-[var(--border)] bg-white/20 p-6 backdrop-blur-sm space-y-4">
              <div className="flex border-b border-[var(--border)] gap-6 mb-4">
                <button
                  onClick={() => setImportTab('library')}
                  className={`pb-3 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
                    importTab === 'library' ? 'border-violet-500 text-violet-700' : 'border-transparent text-zinc-600 hover:text-zinc-900'
                  }`}
                >
                  <Users className="h-4 w-4" /> Lead Library
                </button>
                <button 
                  onClick={() => setImportTab('csv')}
                  className={`pb-3 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
                    importTab === 'csv' ? 'border-violet-500 text-violet-700' : 'border-transparent text-zinc-600 hover:text-zinc-900'
                  }`}
                >
                  <Upload className="h-4 w-4" /> Upload CSV
                </button>
                <button 
                  onClick={() => setImportTab('sheet')}
                  className={`pb-3 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
                    importTab === 'sheet' ? 'border-violet-500 text-violet-700' : 'border-transparent text-zinc-600 hover:text-zinc-900'
                  }`}
                >
                  <FileSpreadsheet className="h-4 w-4" /> Google Sheets
                </button>
              </div>

              {importTab === 'library' && (
                <div className="space-y-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-zinc-950">Select Existing Lead Library Prospects</h3>
                      <p className="text-xs text-zinc-500">Attach saved ReachMira leads to this campaign during setup.</p>
                    </div>
                    <div className="rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700">
                      {selectedLibraryLeadIds.length} selected
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row">
                    <input
                      value={librarySearch}
                      onChange={(e) => { setLibrarySearch(e.target.value); setLibraryPage(1); }}
                      placeholder="Search by email, company, industry..."
                      className="w-full rounded-xl border border-[var(--border)] bg-white px-4 py-2.5 text-xs text-zinc-900 outline-none focus:border-violet-400"
                    />
                    <button
                      onClick={toggleAllVisibleLibraryLeads}
                      disabled={paginatedLibraryLeads.length === 0}
                      className="rounded-xl border border-[var(--border)] bg-white px-4 py-2.5 text-xs font-semibold text-zinc-700 hover:bg-violet-50 disabled:opacity-50"
                    >
                      Toggle visible
                    </button>
                  </div>

                  {loadingLibraryLeads ? (
                    <div className="rounded-2xl border border-[var(--border)] bg-white/60 p-8 text-center text-xs text-zinc-500">
                      Loading lead library...
                    </div>
                  ) : filteredLibraryLeads.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-[var(--border)] bg-white/60 p-8 text-center">
                      <Users className="mx-auto mb-2 h-8 w-8 text-zinc-300" />
                      <p className="text-sm font-semibold text-zinc-700">No library leads found</p>
                      <p className="mt-1 text-xs text-zinc-500">Import leads into the Lead Library first, or use CSV/Google Sheets for this campaign.</p>
                    </div>
                  ) : (
                    <div className="max-h-96 overflow-y-auto rounded-2xl border border-[var(--border)] bg-white">
                      <table className="w-full text-left text-xs">
                        <thead className="sticky top-0 bg-violet-50 text-[10px] font-bold uppercase tracking-[0.18em] text-violet-700">
                          <tr>
                            <th className="px-4 py-3">Select</th>
                            <th className="px-4 py-3">Lead</th>
                            <th className="px-4 py-3">Company</th>
                            <th className="px-4 py-3">Status</th>
                            <th className="px-4 py-3">Quality</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--border)]">
                          {paginatedLibraryLeads.map((lead) => {
                            const selected = selectedLibraryLeadIds.includes(lead.id);
                            return (
                              <tr key={lead.id} className={selected ? 'bg-violet-50/70' : 'hover:bg-zinc-50'}>
                                <td className="px-4 py-3">
                                  <input
                                    type="checkbox"
                                    checked={selected}
                                    onChange={() => toggleLibraryLead(lead.id)}
                                    className="rounded border-zinc-300 text-violet-600 focus:ring-violet-500"
                                  />
                                </td>
                                <td className="px-4 py-3">
                                  <div className="font-semibold text-zinc-950">
                                    {lead.first_name || lead.last_name
                                      ? `${lead.first_name || ''} ${lead.last_name || ''}`.trim()
                                      : lead.decision_maker_name || lead.email}
                                  </div>
                                  <div className="font-mono text-[11px] text-zinc-500">{lead.email}</div>
                                </td>
                                <td className="px-4 py-3 text-zinc-700">
                                  <div>{lead.company_name || lead.company || '-'}</div>
                                  <div className="text-[11px] text-zinc-500">{lead.industry || 'General'}</div>
                                </td>
                                <td className="px-4 py-3">
                                  <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2 py-1 text-[10px] font-semibold uppercase text-zinc-600">
                                    {lead.status || 'new'}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-zinc-600">
                                  {lead.data_quality_label || 'unknown'}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {filteredLibraryLeads.length > libraryPageSize && (
                    <div className="flex flex-col gap-3 border-t border-[var(--border)] pt-4 text-xs text-zinc-500 sm:flex-row sm:items-center sm:justify-between">
                      <span>
                        Showing {(safeLibraryPage - 1) * libraryPageSize + 1}-{Math.min(safeLibraryPage * libraryPageSize, filteredLibraryLeads.length)} of {filteredLibraryLeads.length} library leads
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setLibraryPage((page) => Math.max(1, page - 1))}
                          disabled={safeLibraryPage <= 1}
                          className="rounded-lg border border-[var(--border)] bg-white px-3 py-1.5 font-semibold text-zinc-700 transition hover:bg-violet-50 disabled:opacity-50"
                        >
                          Previous
                        </button>
                        <span className="font-semibold text-zinc-700">Page {safeLibraryPage} / {libraryTotalPages}</span>
                        <button
                          onClick={() => setLibraryPage((page) => Math.min(libraryTotalPages, page + 1))}
                          disabled={safeLibraryPage >= libraryTotalPages}
                          className="rounded-lg border border-[var(--border)] bg-white px-3 py-1.5 font-semibold text-zinc-700 transition hover:bg-violet-50 disabled:opacity-50"
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="flex justify-between border-t border-[var(--border)] pt-4">
                    <button onClick={() => setCurrentStep(1)} className="text-xs text-zinc-600 hover:text-zinc-950">Back</button>
                    <button
                      onClick={() => {
                        setError(null);
                        setCurrentStep(3);
                      }}
                      className="px-5 py-2 bg-gradient-to-r from-violet-600 to-teal-500 rounded text-xs font-semibold text-white"
                    >
                      Continue with {selectedLibraryLeadIds.length} Library Leads
                    </button>
                  </div>
                </div>
              )}

              {importTab === 'csv' && !headers.length && (
                <div className="border border-dashed border-[var(--border)] p-8 rounded-lg text-center flex flex-col items-center">
                  <Upload className="h-8 w-8 text-violet-400 mb-2" />
                  <span className="block text-xs text-zinc-700 font-semibold mb-3">Choose CSV file</span>
                  <label className="px-4 py-2 bg-white border border-[var(--border)] hover:bg-violet-50 rounded text-xs text-zinc-700 cursor-pointer font-semibold">
                    Select File
                    <input type="file" accept=".csv" onChange={handleCSVUpload} className="hidden" />
                  </label>
                </div>
              )}

              {importTab === 'sheet' && !headers.length && (
                <form onSubmit={handleSheetPreview} className="space-y-4 max-w-xl">
                  <div>
                    <label className="block text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Spreadsheet Sharing URL</label>
                    <input 
                      type="url" 
                      required
                      value={googleSheetUrl}
                      onChange={(e) => setGoogleSheetUrl(e.target.value)}
                      placeholder="https://docs.google.com/spreadsheets/d/.../edit"
                      className="mt-1 w-full rounded border border-[var(--border)] bg-white py-2 px-3 text-xs text-zinc-900 focus:border-violet-500 focus:outline-none"
                    />
                  </div>
                  <button type="submit" className="px-4 py-2 bg-white border border-[var(--border)] text-xs text-zinc-700 font-semibold rounded">
                    Preview Sheets Content
                  </button>
                </form>
              )}

              {loadingPreview && (
                <div className="py-8 text-center text-xs text-zinc-500">Parsing data columns...</div>
              )}

              {previewError && (
                <div className="p-3 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20 text-xs">{previewError}</div>
              )}
            </div>

            {/* If headers loaded, show Mapper */}
            {headers.length > 0 && (
              <div className="space-y-6">
                {/* Row preview */}
                <div className="rounded-xl border border-[var(--border)] bg-white/20 p-6 backdrop-blur-sm overflow-hidden">
                  <span className="block text-xs font-bold text-zinc-950 mb-2">Rows Preview ({rows.length} total)</span>
                  <div className="overflow-x-auto max-h-32 border border-[var(--border)] rounded">
                    <table className="w-full text-left text-[11px] text-zinc-600">
                      <thead className="bg-white text-zinc-500">
                        <tr>
                          {headers.map((h, i) => (
                            <th key={i} className="py-2 px-3">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {rows.slice(0, 3).map((r, ri) => (
                          <tr key={ri} className="border-t border-[var(--border)]">
                            {headers.map((_, ci) => (
                              <td key={ci} className="py-1.5 px-3 max-w-xs truncate">{r[ci]}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Mappings */}
                <div className="rounded-xl border border-[var(--border)] bg-white/20 p-6 backdrop-blur-sm space-y-4">
                  <span className="block text-xs font-bold text-zinc-950 mb-2">Map Destination Fields</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {DESTINATION_FIELDS.slice(0, 12).map((field) => {
                      const isMapped = !!mappings[field.key];
                      return (
                        <div key={field.key} className="p-3 rounded bg-white/40 border border-[var(--border)]">
                          <label className="block text-[10px] font-bold text-zinc-600">{field.label}</label>
                          <select
                            value={mappings[field.key] || ''}
                            onChange={(e) => setMappings({ ...mappings, [field.key]: e.target.value })}
                            className="mt-1 w-full rounded border border-[var(--border)] bg-white py-1 px-2 text-xs text-zinc-700 focus:outline-none"
                          >
                            <option value="">-- Ignore Column --</option>
                            {headers.map((h, i) => (
                              <option key={i} value={h}>{h}</option>
                            ))}
                          </select>
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex justify-between pt-4 border-t border-[var(--border)]">
                    <button onClick={() => { setHeaders([]); setRows([]); }} className="text-xs text-zinc-600 hover:text-zinc-950">Back / Reset</button>
                    <button
                      onClick={handleMapAndRegisterLeads}
                      disabled={!mappings['email']}
                      className="px-5 py-2 bg-gradient-to-r from-violet-600 to-teal-500 rounded text-xs font-semibold text-white disabled:opacity-50"
                    >
                      Map & Register {rows.length} Leads
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* STEP 3: AI STRATEGY SETUP */}
        {currentStep === 3 && (
          <div className="rounded-xl border border-[var(--border)] bg-white/20 p-6 backdrop-blur-sm space-y-6">
            <h3 className="font-bold text-zinc-950 text-md border-b border-[var(--border)] pb-3 flex items-center gap-2"><Bot className="h-5 w-5 text-violet-400" /> AI Strategy Configuration</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] text-zinc-500 font-bold uppercase tracking-wider mb-2">AI Mode</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                    {[
                    { id: 'hybrid_smart', title: 'Hybrid Smart', desc: 'Local scoring first, cache second, Gemini only for eligible leads.' },
                    { id: 'basic_ai', title: 'Basic AI', desc: 'Flash Lite copy for low-cost personalization.' },
                    { id: 'standard_ai', title: 'Standard AI', desc: 'Flash Lite with more context and website use.' },
                    { id: 'deep_ai', title: 'Deep AI', desc: 'Use 2.5 Flash only on high-priority, strong-fit leads.' },
                    { id: 'template_only', title: 'Template Only', desc: 'Never call Gemini. Use templates and local fallback copy only.' },
                    { id: 'manual_only', title: 'Manual Only', desc: 'No automated AI generation. Drafts stay manual.' },
                  ].map((mode) => (
                    <button
                      key={mode.id}
                      onClick={() => setAiMode(mode.id as typeof aiMode)}
                      className={`p-4 rounded-xl border text-left flex flex-col justify-between cursor-pointer transition-all ${
                        aiMode === mode.id
                          ? 'bg-violet-600/10 border-violet-500 shadow-md shadow-violet-500/5'
                          : 'bg-white/20 border-[var(--border)] text-zinc-600 hover:bg-white/40'
                      }`}
                    >
                      <span className="block text-xs font-bold text-zinc-950 mb-1">{mode.title}</span>
                      <span className="block text-[10px] text-zinc-500 leading-relaxed">{mode.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div className="rounded-xl border border-[var(--border)] bg-white/30 p-4 space-y-2">
                  <label className="block text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Lead AI Depth</label>
                  <select
                    value={aiDepth}
                      onChange={(e) => setAiDepth(e.target.value as typeof aiDepth)}
                    className="w-full rounded border border-[var(--border)] bg-white py-2 px-3 text-xs text-zinc-900 focus:border-violet-500 focus:outline-none"
                  >
                    <option value="none">None</option>
                    <option value="basic">Basic</option>
                    <option value="standard">Standard</option>
                    <option value="deep">Deep</option>
                  </select>
                  <p className="text-[10px] text-zinc-500">Controls how much context the AI layer should include for each lead.</p>
                </div>

                <label className="flex items-start gap-3 p-4 bg-white/40 border border-[var(--border)] rounded-lg cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoRunAiAfterImport}
                    onChange={(e) => setAutoRunAiAfterImport(e.target.checked)}
                    className="rounded border-[var(--border)] bg-white text-violet-500 focus:ring-0 mt-0.5"
                  />
                  <div>
                    <span className="block text-xs font-semibold text-zinc-950">Auto-run AI after import</span>
                    <span className="block text-[10px] text-zinc-500">Keep this off unless you explicitly want new imports queued for analysis.</span>
                  </div>
                </label>

                <label className="flex items-start gap-3 p-4 bg-white/40 border border-[var(--border)] rounded-lg cursor-pointer">
                  <input
                    type="checkbox"
                    checked={fetchWebsiteHomepage}
                    onChange={(e) => setFetchWebsiteHomepage(e.target.checked)}
                    className="rounded border-[var(--border)] bg-white text-violet-500 focus:ring-0 mt-0.5"
                  />
                  <div>
                    <span className="block text-xs font-semibold text-zinc-950">Fetch Website Homepage</span>
                    <span className="block text-[10px] text-zinc-500">Crawl website visible text when the lead qualifies for Gemini.</span>
                  </div>
                </label>

                <label className="flex items-start gap-3 p-4 bg-white/40 border border-[var(--border)] rounded-lg cursor-pointer">
                  <input
                    type="checkbox"
                    checked={requireApprovalBeforeSend}
                    onChange={(e) => setRequireApprovalBeforeSend(e.target.checked)}
                    className="rounded border-[var(--border)] bg-white text-violet-500 focus:ring-0 mt-0.5"
                  />
                  <div>
                    <span className="block text-xs font-semibold text-zinc-950">Require Manual Approval</span>
                    <span className="block text-[10px] text-zinc-500">Prevent cron from sending emails until drafts are manually approved.</span>
                  </div>
                </label>

                <label className="flex items-start gap-3 p-4 bg-white/40 border border-[var(--border)] rounded-lg cursor-pointer">
                  <input
                    type="checkbox"
                    checked={allowDeepAi}
                    onChange={(e) => setAllowDeepAi(e.target.checked)}
                    className="rounded border-[var(--border)] bg-white text-violet-500 focus:ring-0 mt-0.5"
                  />
                  <div>
                    <span className="block text-xs font-semibold text-zinc-950">Allow Deep AI</span>
                    <span className="block text-[10px] text-zinc-500">Only use 2.5 Flash for deep personalization.</span>
                  </div>
                </label>

                <label className="flex items-start gap-3 p-4 bg-white/40 border border-[var(--border)] rounded-lg cursor-pointer">
                  <input
                    type="checkbox"
                    checked={requireManualApprovalForDeepAi}
                    onChange={(e) => setRequireManualApprovalForDeepAi(e.target.checked)}
                    className="rounded border-[var(--border)] bg-white text-violet-500 focus:ring-0 mt-0.5"
                  />
                  <div>
                    <span className="block text-xs font-semibold text-zinc-950">Require Manual Approval for Deep AI</span>
                    <span className="block text-[10px] text-zinc-500">Deep AI drafts need a human review before send.</span>
                  </div>
                </label>

                <label className="flex items-start gap-3 p-4 bg-white/40 border border-[var(--border)] rounded-lg cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useTemplateFallback}
                    onChange={(e) => setUseTemplateFallback(e.target.checked)}
                    className="rounded border-[var(--border)] bg-white text-violet-500 focus:ring-0 mt-0.5"
                  />
                  <div>
                    <span className="block text-xs font-semibold text-zinc-950">Use Template Fallback</span>
                    <span className="block text-[10px] text-zinc-500">Fallback to local templates instead of spending a credit when the lead is weak.</span>
                  </div>
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="block text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Minimum Data Quality for AI</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={minDataQualityForAi}
                    onChange={(e) => setMinDataQualityForAi(e.target.value)}
                    className="mt-1 w-full rounded border border-[var(--border)] bg-white py-2 px-3 text-xs text-zinc-900 focus:border-violet-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Full AI Minimum Solution Score</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={fullAiMinSolutionScore}
                    onChange={(e) => setFullAiMinSolutionScore(e.target.value)}
                    className="mt-1 w-full rounded border border-[var(--border)] bg-white py-2 px-3 text-xs text-zinc-900 focus:border-violet-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-between pt-4 border-t border-[var(--border)]">
              <button onClick={() => setCurrentStep(2)} className="text-xs text-zinc-600 hover:text-zinc-950">Back</button>
              <button onClick={() => setCurrentStep(4)} className="px-6 py-2 bg-gradient-to-r from-violet-600 to-teal-500 rounded-lg text-xs font-semibold text-white hover:opacity-90">Continue to Sequence</button>
            </div>
          </div>
        )}

        {/* STEP 4: EMAIL SEQUENCE */}
        {currentStep === 4 && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-zinc-950 text-md">Email Follow-up Sequence</h3>
                <p className="text-xs text-zinc-600">Add follow-up templates. Step 1 can be upgraded by Gemini only when the selected AI mode allows it.</p>
              </div>
              <button 
                onClick={addSeqStep}
                className="px-3 py-1.5 border border-[var(--border)] hover:bg-violet-50 rounded-lg text-xs font-semibold text-zinc-700 cursor-pointer"
              >
                Add Follow-up Step
              </button>
            </div>

            <div className="space-y-4">
              {sequences.map((step, idx) => (
                <div key={idx} className="rounded-xl border border-[var(--border)] bg-white/20 p-6 backdrop-blur-sm space-y-4">
                  <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
                    <span className="text-xs font-bold text-violet-400">Step {step.step_number} {idx === 0 ? '(First Contact)' : `(Follow-up)`}</span>
                    <div className="flex items-center gap-4">
                      {idx > 0 && (
                        <div className="flex items-center gap-1.5 text-xs text-zinc-600">
                          <span>Delay:</span>
                          <input 
                            type="number"
                            min="1"
                            value={step.delay_days}
                            onChange={(e) => handleUpdateSequenceField(idx, 'delay_days', e.target.value)}
                            className="w-12 border border-[var(--border)] bg-white text-center rounded text-xs font-semibold text-zinc-900"
                          />
                          <span>days</span>
                        </div>
                      )}
                      {idx > 0 && (
                        <button onClick={() => removeSeqStep(idx)} className="text-zinc-500 hover:text-rose-400"><Trash2 className="h-4 w-4" /></button>
                      )}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-violet-100 bg-violet-50/70 p-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
                      <div className="flex-1">
                        <label className="block text-[10px] text-violet-700 font-bold uppercase tracking-wider">Use Saved Template</label>
                        <select
                          value={step.template_id || ''}
                          onChange={(e) => handleInsertTemplateIntoSequence(idx, e.target.value)}
                          className="mt-1 w-full rounded-xl border border-violet-100 bg-white py-2.5 px-3 text-xs text-zinc-900 focus:border-violet-500 focus:outline-none"
                        >
                          <option value="">Select a template to fill this step</option>
                          {templateOptions.map((template) => (
                            <option key={template.id} value={template.id}>
                              {template.name}{template.category ? ` - ${template.category}` : ''}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="text-xs leading-relaxed text-violet-700 lg:max-w-sm">
                        Templates copy their saved subject and body into this sequence step. You can still edit the copy after inserting.
                      </div>
                    </div>
                    {templateOptions.length === 0 && (
                      <p className="mt-3 text-xs text-violet-700">
                        No saved templates yet. Create one from Templates, or keep writing this sequence manually.
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Subject Line</label>
                    <input 
                      type="text"
                      value={step.subject}
                      onChange={(e) => handleUpdateSequenceField(idx, 'subject', e.target.value)}
                      placeholder="Subject Line"
                      className="mt-1 w-full rounded border border-[var(--border)] bg-white py-2 px-3 text-xs text-zinc-900 focus:border-violet-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Email Body</label>
                    <textarea 
                      rows={5}
                      value={step.body}
                      onChange={(e) => handleUpdateSequenceField(idx, 'body', e.target.value)}
                      placeholder="Hi {{first_name}}..."
                      className="mt-1 w-full rounded border border-[var(--border)] bg-white p-2.5 text-xs text-zinc-900 focus:border-violet-500 focus:outline-none font-sans"
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-between pt-4">
              <button onClick={() => setCurrentStep(3)} className="text-xs text-zinc-600 hover:text-zinc-950">Back</button>
              <button onClick={() => setCurrentStep(5)} className="px-6 py-2 bg-gradient-to-r from-violet-600 to-teal-500 rounded-lg text-xs font-semibold text-white hover:opacity-90">Review Details</button>
            </div>
          </div>
        )}

        {/* STEP 5: FINAL REVIEW */}
        {currentStep === 5 && (
          <div className="rounded-xl border border-[var(--border)] bg-white/20 p-6 backdrop-blur-sm space-y-6">
            <h3 className="font-bold text-zinc-950 text-md border-b border-[var(--border)] pb-3">Review & Create Campaign</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
              <div className="space-y-2 bg-white/20 p-4 border border-[var(--border)] rounded-lg">
                <span className="block text-xs font-bold text-violet-400">Basics & Configuration</span>
                <div className="text-xs text-zinc-600 space-y-1.5 pt-1.5">
                  <div>Campaign Name: <span className="text-zinc-900 font-medium">{campaignName}</span></div>
                  <div>Pitch Offer: <span className="text-zinc-900 font-medium">{offerType}</span></div>
                  <div>Industry: <span className="text-zinc-900 font-medium">{targetIndustry || 'General'}</span></div>
                  <div>Sender Name: <span className="text-zinc-900 font-medium">{senderName}</span></div>
                  <div>Sender Email: <span className="text-zinc-900 font-medium">{senderEmail}</span></div>
                  <div>Email Account: <span className="text-zinc-900 font-medium">{emailAccounts.find((account) => account.id === emailAccountId)?.email_address || 'Not selected'}</span></div>
                  <div>Daily limit: <span className="text-zinc-900 font-medium">{dailyLimit} emails/day</span></div>
                </div>
              </div>

              <div className="space-y-2 bg-white/20 p-4 border border-[var(--border)] rounded-lg">
                <span className="block text-xs font-bold text-violet-400">AI Personalization Rules</span>
                <div className="text-xs text-zinc-600 space-y-1.5 pt-1.5">
                  <div>AI Mode: <span className="text-zinc-900 font-medium capitalize">{aiMode.replace('_', ' ')}</span></div>
                  <div>Lead Depth: <span className="text-zinc-900 font-medium capitalize">{defaultAiDepth}</span></div>
                  <div>Fetch Website Homepage: <span className="text-zinc-900 font-medium">{fetchWebsiteHomepage ? 'Yes' : 'No'}</span></div>
                  <div>Require Manual Approval: <span className="text-zinc-900 font-medium">{requireApprovalBeforeSend ? 'Yes' : 'No'}</span></div>
                  <div>Auto-run AI After Import: <span className="text-zinc-900 font-medium">{autoRunAiAfterImport ? 'Yes' : 'No'}</span></div>
                  <div>Deep AI Allowed: <span className="text-zinc-900 font-medium">{allowDeepAi ? 'Yes' : 'No'}</span></div>
                  <div>Deep AI Needs Approval: <span className="text-zinc-900 font-medium">{requireManualApprovalForDeepAi ? 'Yes' : 'No'}</span></div>
                  <div>Template Fallback: <span className="text-zinc-900 font-medium">{useTemplateFallback ? 'Allowed' : 'Not Allowed'}</span></div>
                </div>
              </div>

              <div className="md:col-span-2 space-y-2 bg-white/20 p-4 border border-[var(--border)] rounded-lg">
                <span className="block text-xs font-bold text-violet-400">Leads List & Sequence</span>
                <div className="text-xs text-zinc-600 space-y-1.5 pt-1.5">
                  <div>Total Leads Mapped: <span className="text-zinc-900 font-medium">{importedLeads.length} leads</span></div>
                  <div>Library Leads Selected: <span className="text-zinc-900 font-medium">{selectedLibraryLeadIds.length} leads</span></div>
                  <div>Sequence Steps: <span className="text-zinc-900 font-medium">{sequences.length} emails configured</span></div>
                  <div>Estimated Send Duration: <span className="text-zinc-900 font-medium">{Math.ceil((importedLeads.length + selectedLibraryLeadIds.length) / (Number(dailyLimit) || 100))} days</span></div>
                </div>
              </div>
            </div>

            <div className="flex justify-between pt-4 border-t border-[var(--border)]">
              <button onClick={() => setCurrentStep(4)} className="text-xs text-zinc-600 hover:text-violet-700" disabled={processing}>Back</button>
              <button
                onClick={handleCreateCampaign}
                disabled={processing}
                className="px-6 py-2.5 bg-gradient-to-r from-violet-600 to-teal-500 hover:opacity-90 rounded-lg text-xs font-semibold text-white shadow-lg shadow-violet-500/10 flex items-center gap-1.5"
              >
                {processing ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  <>Create & Start Campaign</>
                )}
              </button>
            </div>
          </div>
        )}
      </main>
    </AppShell>
  );
}
