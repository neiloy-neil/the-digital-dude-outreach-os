'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import Sidebar from '@/components/Sidebar';
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
  Database
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Papa from 'papaparse';
import { calculateLeadDataQuality } from '@/utils/data-quality';

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

  // STEP 1: Campaign Basics
  const [campaignName, setCampaignName] = useState('');
  const [targetIndustry, setTargetIndustry] = useState('');
  const [offerType, setOfferType] = useState('Custom Web Application');
  const [senderName, setSenderName] = useState('');
  const [senderEmail, setSenderEmail] = useState('');
  const [dailyLimit, setDailyLimit] = useState('100');
  const [emailAccountId, setEmailAccountId] = useState('');

  // STEP 2: Lead Import
  const [importTab, setImportTab] = useState<'csv' | 'sheet'>('csv');
  const [googleSheetUrl, setGoogleSheetUrl] = useState('');
  const [sheetGid, setSheetGid] = useState('');
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<any[][]>([]);
  const [mappings, setMappings] = useState<Record<string, string>>({});
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [importedLeads, setImportedLeads] = useState<any[]>([]); // Saved mapped lead list in-memory until Wizard completes

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

  // STEP 4: Sequences
  const [sequences, setSequences] = useState<any[]>([
    {
      step_number: 1,
      delay_days: 0,
      subject: 'Quick question {{first_name}}',
      body: 'Hi {{first_name}},\n\nI was looking at {{company_name}} and noticed {{pain_points}}.\n\n{{ai_personalized_first_line}}\n\nWould you be open to a quick call?\n\nBest,\n[Your Name]'
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

  // Add step to sequence
  const addSeqStep = () => {
    setSequences([
      ...sequences,
      {
        step_number: sequences.length + 1,
        delay_days: 2,
        subject: 'Re: Quick question',
        body: 'Hi {{first_name}},\n\nJust following up on my previous note. Would you be open to a 5-minute call next week?\n\nBest,\n[Your Name]'
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

      router.push(`/campaigns/${campaign.id}`);
    } catch (err: any) {
      setError(err.message || 'Error occurred creating campaign');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-zinc-950 text-zinc-100 font-sans">
      <Sidebar />
      <main className="flex-1 p-8 overflow-y-auto max-w-5xl">
        {/* Top Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link href="/campaigns" className="p-2 bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-400 hover:text-white transition-all">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h2 className="text-2xl font-bold text-white tracking-tight">Campaign Creation Wizard</h2>
            <p className="text-xs text-zinc-400">Step {currentStep} of 5 — {
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
                step < currentStep ? 'bg-violet-800' : 'bg-zinc-800'
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
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/20 p-6 backdrop-blur-sm space-y-4">
            <h3 className="font-bold text-white text-md border-b border-zinc-850 pb-3 flex items-center gap-2"><Settings className="h-5 w-5 text-violet-400" /> Campaign Parameters</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Campaign Name</label>
                <input 
                  type="text" 
                  value={campaignName}
                  onChange={(e) => setCampaignName(e.target.value)}
                  placeholder="e.g. Q3 SaaS Enterprise Outreach"
                  className="mt-1 w-full rounded border border-zinc-800 bg-zinc-950 py-2 px-3 text-xs text-zinc-200 focus:border-violet-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Target Industry</label>
                <input 
                  type="text" 
                  value={targetIndustry}
                  onChange={(e) => setTargetIndustry(e.target.value)}
                  placeholder="e.g. Healthcare, Fintech, E-commerce"
                  className="mt-1 w-full rounded border border-zinc-800 bg-zinc-950 py-2 px-3 text-xs text-zinc-200 focus:border-violet-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Pitch Offer Type</label>
                <select 
                  value={offerType}
                  onChange={(e) => setOfferType(e.target.value)}
                  className="mt-1 w-full rounded border border-zinc-800 bg-zinc-950 py-2 px-3 text-xs text-zinc-200 focus:border-violet-500 focus:outline-none"
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
                  className="mt-1 w-full rounded border border-zinc-800 bg-zinc-950 py-2 px-3 text-xs text-zinc-200 focus:border-violet-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Sender Display Name</label>
                <input 
                  type="text" 
                  value={senderName}
                  onChange={(e) => setSenderName(e.target.value)}
                  placeholder="e.g. Wazid from The Digital Dude"
                  className="mt-1 w-full rounded border border-zinc-800 bg-zinc-950 py-2 px-3 text-xs text-zinc-200 focus:border-violet-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Sender Outbound Email</label>
                <input 
                  type="email" 
                  value={senderEmail}
                  onChange={(e) => setSenderEmail(e.target.value)}
                  placeholder="wazid@innovatewave.online"
                  className="mt-1 w-full rounded border border-zinc-800 bg-zinc-950 py-2 px-3 text-xs text-zinc-200 focus:border-violet-500 focus:outline-none"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Email Account</label>
                <select
                  value={emailAccountId}
                  onChange={(e) => setEmailAccountId(e.target.value)}
                  className="mt-1 w-full rounded border border-zinc-800 bg-zinc-950 py-2 px-3 text-xs text-zinc-200 focus:border-violet-500 focus:outline-none"
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
                className="px-6 py-2 bg-gradient-to-r from-violet-600 to-blue-600 rounded-lg text-xs font-semibold text-white hover:opacity-90"
              >
                Proceed to Lead Imports
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: LEAD IMPORT */}
        {currentStep === 2 && (
          <div className="space-y-6">
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/20 p-6 backdrop-blur-sm space-y-4">
              <div className="flex border-b border-zinc-800 gap-6 mb-4">
                <button 
                  onClick={() => setImportTab('csv')}
                  className={`pb-3 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
                    importTab === 'csv' ? 'border-violet-500 text-white' : 'border-transparent text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <Upload className="h-4 w-4" /> Upload CSV
                </button>
                <button 
                  onClick={() => setImportTab('sheet')}
                  className={`pb-3 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
                    importTab === 'sheet' ? 'border-violet-500 text-white' : 'border-transparent text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <FileSpreadsheet className="h-4 w-4" /> Google Sheets
                </button>
              </div>

              {importTab === 'csv' && !headers.length && (
                <div className="border border-dashed border-zinc-800 p-8 rounded-lg text-center flex flex-col items-center">
                  <Upload className="h-8 w-8 text-violet-400 mb-2" />
                  <span className="block text-xs text-zinc-350 font-semibold mb-3">Choose CSV file</span>
                  <label className="px-4 py-2 bg-zinc-900 border border-zinc-800 hover:bg-zinc-850 rounded text-xs text-zinc-350 cursor-pointer font-semibold">
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
                      className="mt-1 w-full rounded border border-zinc-800 bg-zinc-950 py-2 px-3 text-xs text-zinc-200 focus:border-violet-500 focus:outline-none"
                    />
                  </div>
                  <button type="submit" className="px-4 py-2 bg-zinc-900 border border-zinc-800 text-xs text-zinc-300 font-semibold rounded">
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
                <div className="rounded-xl border border-zinc-800 bg-zinc-900/20 p-6 backdrop-blur-sm overflow-hidden">
                  <span className="block text-xs font-bold text-white mb-2">Rows Preview ({rows.length} total)</span>
                  <div className="overflow-x-auto max-h-32 border border-zinc-800 rounded">
                    <table className="w-full text-left text-[11px] text-zinc-400">
                      <thead className="bg-zinc-900 text-zinc-500">
                        <tr>
                          {headers.map((h, i) => (
                            <th key={i} className="py-2 px-3">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {rows.slice(0, 3).map((r, ri) => (
                          <tr key={ri} className="border-t border-zinc-900">
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
                <div className="rounded-xl border border-zinc-800 bg-zinc-900/20 p-6 backdrop-blur-sm space-y-4">
                  <span className="block text-xs font-bold text-white mb-2">Map Destination Fields</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {DESTINATION_FIELDS.slice(0, 12).map((field) => {
                      const isMapped = !!mappings[field.key];
                      return (
                        <div key={field.key} className="p-3 rounded bg-zinc-950/40 border border-zinc-900">
                          <label className="block text-[10px] font-bold text-zinc-400">{field.label}</label>
                          <select
                            value={mappings[field.key] || ''}
                            onChange={(e) => setMappings({ ...mappings, [field.key]: e.target.value })}
                            className="mt-1 w-full rounded border border-zinc-800 bg-zinc-950 py-1 px-2 text-xs text-zinc-300 focus:outline-none"
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

                  <div className="flex justify-between pt-4 border-t border-zinc-850">
                    <button onClick={() => { setHeaders([]); setRows([]); }} className="text-xs text-zinc-400 hover:text-white">Back / Reset</button>
                    <button
                      onClick={handleMapAndRegisterLeads}
                      disabled={!mappings['email']}
                      className="px-5 py-2 bg-gradient-to-r from-violet-600 to-blue-600 rounded text-xs font-semibold text-white disabled:opacity-50"
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
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/20 p-6 backdrop-blur-sm space-y-6">
            <h3 className="font-bold text-white text-md border-b border-zinc-850 pb-3 flex items-center gap-2"><Bot className="h-5 w-5 text-violet-400" /> AI Strategy Configuration</h3>
            
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
                          : 'bg-zinc-950/20 border-zinc-900 text-zinc-400 hover:bg-zinc-950/40'
                      }`}
                    >
                      <span className="block text-xs font-bold text-white mb-1">{mode.title}</span>
                      <span className="block text-[10px] text-zinc-500 leading-relaxed">{mode.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div className="rounded-xl border border-zinc-900 bg-zinc-950/30 p-4 space-y-2">
                  <label className="block text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Lead AI Depth</label>
                  <select
                    value={aiDepth}
                      onChange={(e) => setAiDepth(e.target.value as typeof aiDepth)}
                    className="w-full rounded border border-zinc-800 bg-zinc-950 py-2 px-3 text-xs text-zinc-200 focus:border-violet-500 focus:outline-none"
                  >
                    <option value="none">None</option>
                    <option value="basic">Basic</option>
                    <option value="standard">Standard</option>
                    <option value="deep">Deep</option>
                  </select>
                  <p className="text-[10px] text-zinc-500">Controls how much context the AI layer should include for each lead.</p>
                </div>

                <label className="flex items-start gap-3 p-4 bg-zinc-950/40 border border-zinc-900 rounded-lg cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoRunAiAfterImport}
                    onChange={(e) => setAutoRunAiAfterImport(e.target.checked)}
                    className="rounded border-zinc-800 bg-zinc-950 text-violet-500 focus:ring-0 mt-0.5"
                  />
                  <div>
                    <span className="block text-xs font-semibold text-white">Auto-run AI after import</span>
                    <span className="block text-[10px] text-zinc-500">Keep this off unless you explicitly want new imports queued for analysis.</span>
                  </div>
                </label>

                <label className="flex items-start gap-3 p-4 bg-zinc-950/40 border border-zinc-900 rounded-lg cursor-pointer">
                  <input
                    type="checkbox"
                    checked={fetchWebsiteHomepage}
                    onChange={(e) => setFetchWebsiteHomepage(e.target.checked)}
                    className="rounded border-zinc-800 bg-zinc-950 text-violet-500 focus:ring-0 mt-0.5"
                  />
                  <div>
                    <span className="block text-xs font-semibold text-white">Fetch Website Homepage</span>
                    <span className="block text-[10px] text-zinc-500">Crawl website visible text when the lead qualifies for Gemini.</span>
                  </div>
                </label>

                <label className="flex items-start gap-3 p-4 bg-zinc-950/40 border border-zinc-900 rounded-lg cursor-pointer">
                  <input
                    type="checkbox"
                    checked={requireApprovalBeforeSend}
                    onChange={(e) => setRequireApprovalBeforeSend(e.target.checked)}
                    className="rounded border-zinc-800 bg-zinc-950 text-violet-500 focus:ring-0 mt-0.5"
                  />
                  <div>
                    <span className="block text-xs font-semibold text-white">Require Manual Approval</span>
                    <span className="block text-[10px] text-zinc-500">Prevent cron from sending emails until drafts are manually approved.</span>
                  </div>
                </label>

                <label className="flex items-start gap-3 p-4 bg-zinc-950/40 border border-zinc-900 rounded-lg cursor-pointer">
                  <input
                    type="checkbox"
                    checked={allowDeepAi}
                    onChange={(e) => setAllowDeepAi(e.target.checked)}
                    className="rounded border-zinc-800 bg-zinc-950 text-violet-500 focus:ring-0 mt-0.5"
                  />
                  <div>
                    <span className="block text-xs font-semibold text-white">Allow Deep AI</span>
                    <span className="block text-[10px] text-zinc-500">Only use 2.5 Flash for deep personalization.</span>
                  </div>
                </label>

                <label className="flex items-start gap-3 p-4 bg-zinc-950/40 border border-zinc-900 rounded-lg cursor-pointer">
                  <input
                    type="checkbox"
                    checked={requireManualApprovalForDeepAi}
                    onChange={(e) => setRequireManualApprovalForDeepAi(e.target.checked)}
                    className="rounded border-zinc-800 bg-zinc-950 text-violet-500 focus:ring-0 mt-0.5"
                  />
                  <div>
                    <span className="block text-xs font-semibold text-white">Require Manual Approval for Deep AI</span>
                    <span className="block text-[10px] text-zinc-500">Deep AI drafts need a human review before send.</span>
                  </div>
                </label>

                <label className="flex items-start gap-3 p-4 bg-zinc-950/40 border border-zinc-900 rounded-lg cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useTemplateFallback}
                    onChange={(e) => setUseTemplateFallback(e.target.checked)}
                    className="rounded border-zinc-800 bg-zinc-950 text-violet-500 focus:ring-0 mt-0.5"
                  />
                  <div>
                    <span className="block text-xs font-semibold text-white">Use Template Fallback</span>
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
                    className="mt-1 w-full rounded border border-zinc-800 bg-zinc-950 py-2 px-3 text-xs text-zinc-200 focus:border-violet-500 focus:outline-none"
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
                    className="mt-1 w-full rounded border border-zinc-800 bg-zinc-950 py-2 px-3 text-xs text-zinc-200 focus:border-violet-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-between pt-4 border-t border-zinc-850">
              <button onClick={() => setCurrentStep(2)} className="text-xs text-zinc-400 hover:text-white">Back</button>
              <button onClick={() => setCurrentStep(4)} className="px-6 py-2 bg-gradient-to-r from-violet-600 to-blue-600 rounded-lg text-xs font-semibold text-white hover:opacity-90">Continue to Sequence</button>
            </div>
          </div>
        )}

        {/* STEP 4: EMAIL SEQUENCE */}
        {currentStep === 4 && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-white text-md">Email Follow-up Sequence</h3>
                <p className="text-xs text-zinc-400">Add follow-up templates. Step 1 can be upgraded by Gemini only when the selected AI mode allows it.</p>
              </div>
              <button 
                onClick={addSeqStep}
                className="px-3 py-1.5 border border-zinc-800 hover:bg-zinc-850 rounded-lg text-xs font-semibold text-zinc-350 cursor-pointer"
              >
                Add Follow-up Step
              </button>
            </div>

            <div className="space-y-4">
              {sequences.map((step, idx) => (
                <div key={idx} className="rounded-xl border border-zinc-800 bg-zinc-900/20 p-6 backdrop-blur-sm space-y-4">
                  <div className="flex items-center justify-between border-b border-zinc-850 pb-3">
                    <span className="text-xs font-bold text-violet-400">Step {step.step_number} {idx === 0 ? '(First Contact)' : `(Follow-up)`}</span>
                    <div className="flex items-center gap-4">
                      {idx > 0 && (
                        <div className="flex items-center gap-1.5 text-xs text-zinc-400">
                          <span>Delay:</span>
                          <input 
                            type="number"
                            min="1"
                            value={step.delay_days}
                            onChange={(e) => handleUpdateSequenceField(idx, 'delay_days', e.target.value)}
                            className="w-12 border border-zinc-800 bg-zinc-950 text-center rounded text-xs font-semibold text-zinc-200"
                          />
                          <span>days</span>
                        </div>
                      )}
                      {idx > 0 && (
                        <button onClick={() => removeSeqStep(idx)} className="text-zinc-500 hover:text-rose-400"><Trash2 className="h-4 w-4" /></button>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Subject Line</label>
                    <input 
                      type="text"
                      value={step.subject}
                      onChange={(e) => handleUpdateSequenceField(idx, 'subject', e.target.value)}
                      placeholder="Subject Line"
                      className="mt-1 w-full rounded border border-zinc-800 bg-zinc-950 py-2 px-3 text-xs text-zinc-250 focus:border-violet-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Email Body</label>
                    <textarea 
                      rows={5}
                      value={step.body}
                      onChange={(e) => handleUpdateSequenceField(idx, 'body', e.target.value)}
                      placeholder="Hi {{first_name}}..."
                      className="mt-1 w-full rounded border border-zinc-800 bg-zinc-950 p-2.5 text-xs text-zinc-250 focus:border-violet-500 focus:outline-none font-sans"
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-between pt-4">
              <button onClick={() => setCurrentStep(3)} className="text-xs text-zinc-400 hover:text-white">Back</button>
              <button onClick={() => setCurrentStep(5)} className="px-6 py-2 bg-gradient-to-r from-violet-600 to-blue-600 rounded-lg text-xs font-semibold text-white hover:opacity-90">Review Details</button>
            </div>
          </div>
        )}

        {/* STEP 5: FINAL REVIEW */}
        {currentStep === 5 && (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/20 p-6 backdrop-blur-sm space-y-6">
            <h3 className="font-bold text-white text-md border-b border-zinc-850 pb-3">Review & Create Campaign</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
              <div className="space-y-2 bg-zinc-950/20 p-4 border border-zinc-900 rounded-lg">
                <span className="block text-xs font-bold text-violet-400">Basics & Configuration</span>
                <div className="text-xs text-zinc-400 space-y-1.5 pt-1.5">
                  <div>Campaign Name: <span className="text-zinc-200 font-medium">{campaignName}</span></div>
                  <div>Pitch Offer: <span className="text-zinc-200 font-medium">{offerType}</span></div>
                  <div>Industry: <span className="text-zinc-200 font-medium">{targetIndustry || 'General'}</span></div>
                  <div>Sender Name: <span className="text-zinc-200 font-medium">{senderName}</span></div>
                  <div>Sender Email: <span className="text-zinc-200 font-medium">{senderEmail}</span></div>
                  <div>Email Account: <span className="text-zinc-200 font-medium">{emailAccounts.find((account) => account.id === emailAccountId)?.email_address || 'Not selected'}</span></div>
                  <div>Daily limit: <span className="text-zinc-200 font-medium">{dailyLimit} emails/day</span></div>
                </div>
              </div>

              <div className="space-y-2 bg-zinc-950/20 p-4 border border-zinc-900 rounded-lg">
                <span className="block text-xs font-bold text-violet-400">AI Personalization Rules</span>
                <div className="text-xs text-zinc-400 space-y-1.5 pt-1.5">
                  <div>AI Mode: <span className="text-zinc-200 font-medium capitalize">{aiMode.replace('_', ' ')}</span></div>
                  <div>Lead Depth: <span className="text-zinc-200 font-medium capitalize">{defaultAiDepth}</span></div>
                  <div>Fetch Website Homepage: <span className="text-zinc-200 font-medium">{fetchWebsiteHomepage ? 'Yes' : 'No'}</span></div>
                  <div>Require Manual Approval: <span className="text-zinc-200 font-medium">{requireApprovalBeforeSend ? 'Yes' : 'No'}</span></div>
                  <div>Auto-run AI After Import: <span className="text-zinc-200 font-medium">{autoRunAiAfterImport ? 'Yes' : 'No'}</span></div>
                  <div>Deep AI Allowed: <span className="text-zinc-200 font-medium">{allowDeepAi ? 'Yes' : 'No'}</span></div>
                  <div>Deep AI Needs Approval: <span className="text-zinc-200 font-medium">{requireManualApprovalForDeepAi ? 'Yes' : 'No'}</span></div>
                  <div>Template Fallback: <span className="text-zinc-200 font-medium">{useTemplateFallback ? 'Allowed' : 'Not Allowed'}</span></div>
                </div>
              </div>

              <div className="md:col-span-2 space-y-2 bg-zinc-950/20 p-4 border border-zinc-900 rounded-lg">
                <span className="block text-xs font-bold text-violet-400">Leads List & Sequence</span>
                <div className="text-xs text-zinc-400 space-y-1.5 pt-1.5">
                  <div>Total Leads Mapped: <span className="text-zinc-200 font-medium">{importedLeads.length} leads</span></div>
                  <div>Sequence Steps: <span className="text-zinc-200 font-medium">{sequences.length} emails configured</span></div>
                  <div>Estimated Send Duration: <span className="text-zinc-200 font-medium">{Math.ceil(importedLeads.length / (Number(dailyLimit) || 100))} days</span></div>
                </div>
              </div>
            </div>

            <div className="flex justify-between pt-4 border-t border-zinc-850">
              <button onClick={() => setCurrentStep(4)} className="text-xs text-zinc-400 hover:text-white" disabled={processing}>Back</button>
              <button
                onClick={handleCreateCampaign}
                disabled={processing}
                className="px-6 py-2.5 bg-gradient-to-r from-violet-600 to-blue-600 hover:opacity-90 rounded-lg text-xs font-semibold text-white shadow-lg shadow-violet-500/10 flex items-center gap-1.5"
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
    </div>
  );
}
