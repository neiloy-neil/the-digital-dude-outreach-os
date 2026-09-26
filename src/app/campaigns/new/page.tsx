'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import AppShell from '@/components/reachmira/AppShell';
import { useRouter } from 'next/navigation';
import Papa from 'papaparse';
import { Banner } from '@/components/reachmira/ui';
import { calculateLeadDataQuality } from '@/utils/data-quality';
import { useEmailAccounts } from '@/hooks/useEmailAccounts';
import { useSequenceSteps } from '@/hooks/useSequenceSteps';
import WizardHeader from '@/components/campaigns/wizard/WizardHeader';
import Step1Basics from '@/components/campaigns/wizard/Step1Basics';
import Step2Import, { DESTINATION_FIELDS } from '@/components/campaigns/wizard/Step2Import';
import Step3AiStrategy from '@/components/campaigns/wizard/Step3AiStrategy';
import Step4Sequence from '@/components/campaigns/wizard/Step4Sequence';
import Step5Review from '@/components/campaigns/wizard/Step5Review';

type TemplateOption = {
  id: string;
  name: string;
  category?: string | null;
  subject: string;
  body?: string | null;
};

export default function CampaignWizardPage() {
  const router = useRouter();
  const supabase = createClient();
  const [currentStep, setCurrentStep] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const { emailAccounts } = useEmailAccounts();
  const [templateOptions, setTemplateOptions] = useState<TemplateOption[]>([]);

  // STEP 1: Campaign Basics
  const [campaignName, setCampaignName] = useState('');
  const [targetIndustry, setTargetIndustry] = useState('');
  const [offerType, setOfferType] = useState('Custom Web Application');
  const [senderName, setSenderName] = useState('');
  const [senderEmail, setSenderEmail] = useState('');
  const [dailyLimit, setDailyLimit] = useState('100');
  const [emailAccountId, setEmailAccountId] = useState('');

  // Replicate the wizard's original default-account auto-select (useEmailAccounts
  // itself doesn't auto-select, since the campaign detail page doesn't need that).
  useEffect(() => {
    if (!emailAccountId && emailAccounts.length > 0) {
      const defaultAccount = emailAccounts.find((account) => account.is_default) || emailAccounts[0];
      if (defaultAccount) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setEmailAccountId(defaultAccount.id);
      }
    }
  }, [emailAccounts, emailAccountId]);

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
  const [libraryPage, setLibraryPage] = useState(1);
  const [totalLibraryLeads, setTotalLibraryLeads] = useState(0);
  const [loadingLibraryLeads, setLoadingLibraryLeads] = useState(false);
  const libraryPageSize = 10;
  const [debouncedLibrarySearch, setDebouncedLibrarySearch] = useState('');

  // STEP 3: AI Strategy
  const [aiMode, setAiMode] = useState<'template_only' | 'basic_ai' | 'standard_ai' | 'deep_ai' | 'manual_only' | 'hybrid_smart'>('hybrid_smart');
  const [aiDepth, setAiDepth] = useState<'none' | 'basic' | 'standard' | 'deep'>('standard');
  const [defaultAiDepth, setDefaultAiDepth] = useState<'none' | 'basic' | 'standard' | 'deep'>('standard');
  const [minDataQualityForAi, setMinDataQualityForAi] = useState('45');
  const [fullAiMinSolutionScore, setFullAiMinSolutionScore] = useState('65');
  const [autoRunAiAfterImport, setAutoRunAiAfterImport] = useState(false);
  const [fetchWebsiteHomepage, setFetchWebsiteHomepage] = useState(true);
  const [requireApprovalBeforeSend, setRequireApprovalBeforeSend] = useState(true);
  const [allowRiskyEmails, setAllowRiskyEmails] = useState(false);
  const [allowDeepAi, setAllowDeepAi] = useState(true);
  const [requireManualApprovalForDeepAi, setRequireManualApprovalForDeepAi] = useState(false);
  const [useTemplateFallback, setUseTemplateFallback] = useState(true);

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
    const t = setTimeout(() => setDebouncedLibrarySearch(librarySearch), 300);
    return () => clearTimeout(t);
  }, [librarySearch]);

  useEffect(() => {
    setLibraryPage(1);
  }, [debouncedLibrarySearch]);

  useEffect(() => {
    const loadLibraryLeads = async () => {
      setLoadingLibraryLeads(true);
      try {
        const params = new URLSearchParams({
          page: libraryPage.toString(),
          limit: libraryPageSize.toString()
        });
        if (debouncedLibrarySearch) params.set('search', debouncedLibrarySearch);

        const response = await fetch(`/api/leads?${params.toString()}`);
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to load lead library');
        setLibraryLeads(Array.isArray(data.leads) ? data.leads : []);
        setTotalLibraryLeads(data.total || 0);
      } catch (err: any) {
        setError(err.message || 'Error loading lead library');
      } finally {
        setLoadingLibraryLeads(false);
      }
    };

    loadLibraryLeads();
  }, [libraryPage, debouncedLibrarySearch]);

  // STEP 4: Sequences (shared CRUD/save logic; wizard keeps its own step-factory
  // below so "Add Follow-up Step" preserves this wizard's own template text,
  // which genuinely differs from the campaign detail page's defaults).
  const { sequences, setSequences, updateStepField, removeStep, saveSequences } = useSequenceSteps([
    {
      step_number: 1,
      delay_days: 0,
      condition: 'always',
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

  const libraryTotalPages = Math.max(1, Math.ceil(totalLibraryLeads / libraryPageSize));
  const safeLibraryPage = Math.min(libraryPage, libraryTotalPages);
  const paginatedLibraryLeads = libraryLeads;

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

  // Add step to sequence (wizard-local factory: keeps this wizard's own
  // follow-up template text, distinct from useSequenceSteps' addStep()).
  const addSeqStep = () => {
    setSequences((current) => [
      ...current,
      {
        step_number: current.length + 1,
        delay_days: 2,
        condition: 'always',
        subject: 'Re: Quick question',
        body: 'Hi {{first_name}},\n\nJust following up on my previous note. Would you be open to a 5-minute call next week?\n\nBest,\n{{sender_name}}'
      }
    ]);
  };

  const handleInsertTemplateIntoSequence = (idx: number, templateId: string) => {
    const template = templateOptions.find((item) => item.id === templateId);
    if (!template) return;

    setSequences((current) => {
      const updated = [...current];
      updated[idx] = {
        ...updated[idx],
        template_id: template.id,
        subject: template.subject || updated[idx].subject,
        body: template.body || updated[idx].body,
      } as any;
      return updated;
    });
  };

  // Final wizard submit
  const handleCreateCampaign = async () => {
    setProcessing(true);
    setError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Authentication required');

      // 1. Create Campaign
      const campaignInsertPayload = {
        user_id: user.id,
        name: campaignName,
        target_industry: targetIndustry,
        offer_type: offerType,
        sender_name: senderName,
        sender_email: senderEmail,
        daily_limit: Number(dailyLimit) || 100,
        email_account_id: emailAccountId || null,
        require_approval_before_send: requireApprovalBeforeSend,
        allow_risky_emails: allowRiskyEmails,
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
      };

      let { data: campaign, error: campError } = await supabase
        .from('campaigns')
        .insert(campaignInsertPayload)
        .select()
        .single();

      if (campError && String(campError.message || '').toLowerCase().includes('allow_risky_emails')) {
        const legacyPayload = { ...campaignInsertPayload } as Record<string, unknown>;
        delete legacyPayload.allow_risky_emails;

        const legacyResponse = await supabase
          .from('campaigns')
          .insert(legacyPayload)
          .select()
          .single();

        campaign = legacyResponse.data;
        campError = legacyResponse.error;
      }

      if (campError) throw campError;

      // 2. Create Sequences
      await saveSequences(campaign.id);

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
        <WizardHeader currentStep={currentStep} onStepChange={setCurrentStep} />

        {error && (
          <Banner tone="error" className="mb-6" onDismiss={() => setError(null)}>
            {error}
          </Banner>
        )}

        {currentStep === 1 && (
          <Step1Basics
            campaignName={campaignName}
            onCampaignNameChange={setCampaignName}
            targetIndustry={targetIndustry}
            onTargetIndustryChange={setTargetIndustry}
            offerType={offerType}
            onOfferTypeChange={setOfferType}
            dailyLimit={dailyLimit}
            onDailyLimitChange={setDailyLimit}
            senderName={senderName}
            onSenderNameChange={setSenderName}
            senderEmail={senderEmail}
            onSenderEmailChange={setSenderEmail}
            emailAccountId={emailAccountId}
            onEmailAccountIdChange={setEmailAccountId}
            emailAccounts={emailAccounts}
            onNext={() => {
              if (!campaignName || !senderEmail) {
                setError('Campaign Name and Sender Email are required.');
                return;
              }
              setError(null);
              setCurrentStep(2);
            }}
          />
        )}

        {currentStep === 2 && (
          <Step2Import
            importTab={importTab}
            onImportTabChange={setImportTab}
            selectedLibraryLeadIds={selectedLibraryLeadIds}
            librarySearch={librarySearch}
            onLibrarySearchChange={(value) => { setLibrarySearch(value); setLibraryPage(1); }}
            loadingLibraryLeads={loadingLibraryLeads}
            paginatedLibraryLeads={paginatedLibraryLeads}
            onToggleLibraryLead={toggleLibraryLead}
            onToggleAllVisibleLibraryLeads={toggleAllVisibleLibraryLeads}
            totalLibraryLeads={totalLibraryLeads}
            libraryPageSize={libraryPageSize}
            safeLibraryPage={safeLibraryPage}
            libraryTotalPages={libraryTotalPages}
            onLibraryPageChange={setLibraryPage}
            onCSVUpload={handleCSVUpload}
            googleSheetUrl={googleSheetUrl}
            onGoogleSheetUrlChange={setGoogleSheetUrl}
            onSheetPreview={handleSheetPreview}
            loadingPreview={loadingPreview}
            previewError={previewError}
            headers={headers}
            rows={rows}
            mappings={mappings}
            onMappingsChange={setMappings}
            onResetPreview={() => { setHeaders([]); setRows([]); }}
            onMapAndRegisterLeads={handleMapAndRegisterLeads}
            onBack={() => setCurrentStep(1)}
            onNext={() => {
              setError(null);
              setCurrentStep(3);
            }}
          />
        )}

        {currentStep === 3 && (
          <Step3AiStrategy
            aiMode={aiMode}
            onAiModeChange={setAiMode}
            aiDepth={aiDepth}
            onAiDepthChange={setAiDepth}
            autoRunAiAfterImport={autoRunAiAfterImport}
            onAutoRunAiAfterImportChange={setAutoRunAiAfterImport}
            fetchWebsiteHomepage={fetchWebsiteHomepage}
            onFetchWebsiteHomepageChange={setFetchWebsiteHomepage}
            requireApprovalBeforeSend={requireApprovalBeforeSend}
            onRequireApprovalBeforeSendChange={setRequireApprovalBeforeSend}
            allowRiskyEmails={allowRiskyEmails}
            onAllowRiskyEmailsChange={setAllowRiskyEmails}
            allowDeepAi={allowDeepAi}
            onAllowDeepAiChange={setAllowDeepAi}
            requireManualApprovalForDeepAi={requireManualApprovalForDeepAi}
            onRequireManualApprovalForDeepAiChange={setRequireManualApprovalForDeepAi}
            useTemplateFallback={useTemplateFallback}
            onUseTemplateFallbackChange={setUseTemplateFallback}
            minDataQualityForAi={minDataQualityForAi}
            onMinDataQualityForAiChange={setMinDataQualityForAi}
            fullAiMinSolutionScore={fullAiMinSolutionScore}
            onFullAiMinSolutionScoreChange={setFullAiMinSolutionScore}
            onBack={() => setCurrentStep(2)}
            onNext={() => setCurrentStep(4)}
          />
        )}

        {currentStep === 4 && (
          <Step4Sequence
            sequences={sequences}
            templateOptions={templateOptions}
            onAddStep={addSeqStep}
            onUpdateStepField={updateStepField}
            onRemoveStep={removeStep}
            onInsertTemplateIntoSequence={handleInsertTemplateIntoSequence}
            onBack={() => setCurrentStep(3)}
            onNext={() => setCurrentStep(5)}
          />
        )}

        {currentStep === 5 && (
          <Step5Review
            campaignName={campaignName}
            offerType={offerType}
            targetIndustry={targetIndustry}
            senderName={senderName}
            senderEmail={senderEmail}
            emailAccounts={emailAccounts}
            emailAccountId={emailAccountId}
            dailyLimit={dailyLimit}
            aiMode={aiMode}
            defaultAiDepth={defaultAiDepth}
            fetchWebsiteHomepage={fetchWebsiteHomepage}
            requireApprovalBeforeSend={requireApprovalBeforeSend}
            allowRiskyEmails={allowRiskyEmails}
            autoRunAiAfterImport={autoRunAiAfterImport}
            allowDeepAi={allowDeepAi}
            requireManualApprovalForDeepAi={requireManualApprovalForDeepAi}
            useTemplateFallback={useTemplateFallback}
            importedLeadsCount={importedLeads.length}
            selectedLibraryLeadsCount={selectedLibraryLeadIds.length}
            sequencesCount={sequences.length}
            processing={processing}
            onBack={() => setCurrentStep(4)}
            onCreateCampaign={handleCreateCampaign}
          />
        )}
      </main>
    </AppShell>
  );
}
