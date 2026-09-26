'use client';

import { Button } from '@/components/reachmira/ui';
import type { EmailAccountOption } from '@/hooks/useEmailAccounts';

type Step5ReviewProps = {
  campaignName: string;
  offerType: string;
  targetIndustry: string;
  senderName: string;
  senderEmail: string;
  emailAccounts: EmailAccountOption[];
  emailAccountId: string;
  dailyLimit: string;
  aiMode: string;
  defaultAiDepth: string;
  fetchWebsiteHomepage: boolean;
  requireApprovalBeforeSend: boolean;
  allowRiskyEmails: boolean;
  autoRunAiAfterImport: boolean;
  allowDeepAi: boolean;
  requireManualApprovalForDeepAi: boolean;
  useTemplateFallback: boolean;
  importedLeadsCount: number;
  selectedLibraryLeadsCount: number;
  sequencesCount: number;
  processing: boolean;
  onBack: () => void;
  onCreateCampaign: () => void;
};

export default function Step5Review({
  campaignName,
  offerType,
  targetIndustry,
  senderName,
  senderEmail,
  emailAccounts,
  emailAccountId,
  dailyLimit,
  aiMode,
  defaultAiDepth,
  fetchWebsiteHomepage,
  requireApprovalBeforeSend,
  allowRiskyEmails,
  autoRunAiAfterImport,
  allowDeepAi,
  requireManualApprovalForDeepAi,
  useTemplateFallback,
  importedLeadsCount,
  selectedLibraryLeadsCount,
  sequencesCount,
  processing,
  onBack,
  onCreateCampaign,
}: Step5ReviewProps) {
  return (
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
            <div>Allow Risky Emails: <span className="text-zinc-900 font-medium">{allowRiskyEmails ? 'Yes' : 'No'}</span></div>
            <div>Auto-run AI After Import: <span className="text-zinc-900 font-medium">{autoRunAiAfterImport ? 'Yes' : 'No'}</span></div>
            <div>Deep AI Allowed: <span className="text-zinc-900 font-medium">{allowDeepAi ? 'Yes' : 'No'}</span></div>
            <div>Deep AI Needs Approval: <span className="text-zinc-900 font-medium">{requireManualApprovalForDeepAi ? 'Yes' : 'No'}</span></div>
            <div>Template Fallback: <span className="text-zinc-900 font-medium">{useTemplateFallback ? 'Allowed' : 'Not Allowed'}</span></div>
          </div>
        </div>

        <div className="md:col-span-2 space-y-2 bg-white/20 p-4 border border-[var(--border)] rounded-lg">
          <span className="block text-xs font-bold text-violet-400">Leads List & Sequence</span>
          <div className="text-xs text-zinc-600 space-y-1.5 pt-1.5">
            <div>Total Leads Mapped: <span className="text-zinc-900 font-medium">{importedLeadsCount} leads</span></div>
            <div>Library Leads Selected: <span className="text-zinc-900 font-medium">{selectedLibraryLeadsCount} leads</span></div>
            <div>Sequence Steps: <span className="text-zinc-900 font-medium">{sequencesCount} emails configured</span></div>
            <div>Estimated Send Duration: <span className="text-zinc-900 font-medium">{Math.ceil((importedLeadsCount + selectedLibraryLeadsCount) / (Number(dailyLimit) || 100))} days</span></div>
          </div>
        </div>
      </div>

      <div className="flex justify-between pt-4 border-t border-[var(--border)]">
        <button onClick={onBack} className="text-xs text-zinc-600 hover:text-violet-700" disabled={processing}>Back</button>
        <Button variant="primary" size="sm" onClick={onCreateCampaign} loading={processing}>
          Create &amp; Start Campaign
        </Button>
      </div>
    </div>
  );
}
