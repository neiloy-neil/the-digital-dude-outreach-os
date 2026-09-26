'use client';

import { Settings } from 'lucide-react';
import type { EmailAccountOption } from '@/hooks/useEmailAccounts';

type Step1BasicsProps = {
  campaignName: string;
  onCampaignNameChange: (value: string) => void;
  targetIndustry: string;
  onTargetIndustryChange: (value: string) => void;
  offerType: string;
  onOfferTypeChange: (value: string) => void;
  dailyLimit: string;
  onDailyLimitChange: (value: string) => void;
  senderName: string;
  onSenderNameChange: (value: string) => void;
  senderEmail: string;
  onSenderEmailChange: (value: string) => void;
  emailAccountId: string;
  onEmailAccountIdChange: (value: string) => void;
  emailAccounts: EmailAccountOption[];
  onNext: () => void;
};

export default function Step1Basics({
  campaignName,
  onCampaignNameChange,
  targetIndustry,
  onTargetIndustryChange,
  offerType,
  onOfferTypeChange,
  dailyLimit,
  onDailyLimitChange,
  senderName,
  onSenderNameChange,
  senderEmail,
  onSenderEmailChange,
  emailAccountId,
  onEmailAccountIdChange,
  emailAccounts,
  onNext,
}: Step1BasicsProps) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-white/20 p-6 backdrop-blur-sm space-y-4">
      <h3 className="font-bold text-zinc-950 text-md border-b border-[var(--border)] pb-3 flex items-center gap-2"><Settings className="h-5 w-5 text-violet-400" /> Campaign Parameters</h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Campaign Name</label>
          <input
            type="text"
            value={campaignName}
            onChange={(e) => onCampaignNameChange(e.target.value)}
            placeholder="e.g. Q3 SaaS Enterprise Outreach"
            className="mt-1 w-full rounded border border-[var(--border)] bg-white py-2 px-3 text-xs text-zinc-900 focus:border-violet-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Target Industry</label>
          <input
            type="text"
            value={targetIndustry}
            onChange={(e) => onTargetIndustryChange(e.target.value)}
            placeholder="e.g. Healthcare, Fintech, E-commerce"
            className="mt-1 w-full rounded border border-[var(--border)] bg-white py-2 px-3 text-xs text-zinc-900 focus:border-violet-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Pitch Offer Type</label>
          <select
            value={offerType}
            onChange={(e) => onOfferTypeChange(e.target.value)}
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
            onChange={(e) => onDailyLimitChange(e.target.value)}
            placeholder="100"
            className="mt-1 w-full rounded border border-[var(--border)] bg-white py-2 px-3 text-xs text-zinc-900 focus:border-violet-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Sender Display Name</label>
          <input
            type="text"
            value={senderName}
            onChange={(e) => onSenderNameChange(e.target.value)}
            placeholder="e.g. Wazid from ReachMira"
            className="mt-1 w-full rounded border border-[var(--border)] bg-white py-2 px-3 text-xs text-zinc-900 focus:border-violet-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Sender Outbound Email</label>
          <input
            type="email"
            value={senderEmail}
            onChange={(e) => onSenderEmailChange(e.target.value)}
            placeholder="wazid@innovatewave.online"
            className="mt-1 w-full rounded border border-[var(--border)] bg-white py-2 px-3 text-xs text-zinc-900 focus:border-violet-500 focus:outline-none"
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Email Account</label>
          <select
            value={emailAccountId}
            onChange={(e) => onEmailAccountIdChange(e.target.value)}
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
          onClick={onNext}
          className="px-6 py-2 bg-gradient-to-r from-violet-600 to-teal-500 rounded-lg text-xs font-semibold text-white hover:opacity-90"
        >
          Proceed to Lead Imports
        </button>
      </div>
    </div>
  );
}
