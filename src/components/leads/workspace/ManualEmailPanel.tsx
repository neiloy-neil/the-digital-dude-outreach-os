'use client';

import { AlertTriangle, CheckCircle2, Copy, Save, Send, ShieldAlert } from 'lucide-react';
import Spinner from '@/components/reachmira/Spinner';
import RichTextEditor from '@/components/leads/RichTextEditor';
import { sanitizeEmailHtml } from '@/lib/email/sanitize-html';
import { EMAIL_TYPES, getLeadStatusLabel } from '@/lib/leads/status';
import type { EmailAccount, Lead } from '@/types/database.types';

type TemplateOption = {
  id: string;
  name: string;
  category?: string | null;
  subject: string;
  body?: string | null;
};

type EmailIssue = { severity: 'error' | 'warning'; message: string };
type ChecklistItem = { label: string; ok: boolean };

type ManualEmailForm = {
  pain_points: string;
  ai_solution_angle: string;
  recommended_offer: string;
  notes: string;
  ai_outreach_strategy: string;
  manual_email_subject: string;
  manual_email_body: string;
};

type ManualEmailPanelProps = {
  lead: Pick<Lead, 'company_name' | 'company' | 'website' | 'industry' | 'decision_maker_name' | 'decision_maker_title' | 'email' | 'raw_data'>;
  leadName: string;
  form: ManualEmailForm;
  setForm: (updater: (current: any) => any) => void;
  leadContextPrompt: string;
  followUpPrompt: string;
  leadSummary: string;
  manualEmailBodyText: string;
  sending: boolean;
  saving: boolean;
  selectedEmailAccountId: string;
  onSelectedEmailAccountIdChange: (value: string) => void;
  emailAccounts: EmailAccount[];
  targetEmail: string;
  onTargetEmailChange: (value: string) => void;
  manualEmailType: (typeof EMAIL_TYPES)[number];
  onManualEmailTypeChange: (value: (typeof EMAIL_TYPES)[number]) => void;
  templateOptions: TemplateOption[];
  selectedTemplateId: string;
  onSelectedTemplateIdChange: (value: string) => void;
  onInsertTemplate: () => void;
  includeSignature: boolean;
  onIncludeSignatureChange: (checked: boolean) => void;
  selectedSignatureHtml: string;
  selectedSendSignatureHtml: string;
  selectedEmailAccount: EmailAccount | null;
  onSendManual: (mode: 'test' | 'send_now') => void;
  onSaveLead: () => void;
  onApproveManualEmail: () => void;
  sendChecklist: ChecklistItem[];
  emailQualityIssues: EmailIssue[];
  emailVerificationIssues: EmailIssue[];
};

export default function ManualEmailPanel({
  lead,
  leadName,
  form,
  setForm,
  leadContextPrompt,
  followUpPrompt,
  leadSummary,
  manualEmailBodyText,
  sending,
  saving,
  selectedEmailAccountId,
  onSelectedEmailAccountIdChange,
  emailAccounts,
  targetEmail,
  onTargetEmailChange,
  manualEmailType,
  onManualEmailTypeChange,
  templateOptions,
  selectedTemplateId,
  onSelectedTemplateIdChange,
  onInsertTemplate,
  includeSignature,
  onIncludeSignatureChange,
  selectedSignatureHtml,
  selectedSendSignatureHtml,
  selectedEmailAccount,
  onSendManual,
  onSaveLead,
  onApproveManualEmail,
  sendChecklist,
  emailQualityIssues,
  emailVerificationIssues,
}: ManualEmailPanelProps) {
  return (
    <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
      <div className="space-y-6">
        <div className="rounded-3xl border border-[var(--border)] bg-white p-6 shadow-[0_12px_40px_rgba(15,23,42,0.04)]">
          <div className="mb-4 flex flex-col gap-3 border-b border-[var(--border)] pb-3 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="text-base font-semibold text-zinc-950">Lead Context</h3>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => navigator.clipboard.writeText(leadContextPrompt)} className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-xs font-semibold text-zinc-700 transition hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700">
                <Copy className="h-3.5 w-3.5" /> Copy Context
              </button>
              <button onClick={() => navigator.clipboard.writeText(followUpPrompt)} className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-xs font-semibold text-zinc-700 transition hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700">
                <Copy className="h-3.5 w-3.5" /> Copy Follow-up Prompt
              </button>
              <button onClick={() => navigator.clipboard.writeText(leadSummary)} className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-xs font-semibold text-zinc-700 transition hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700">
                <Copy className="h-3.5 w-3.5" /> Copy Lead Summary
              </button>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              ['Company', lead.company_name || lead.company || '-'],
              ['Website', lead.website || '-'],
              ['Industry', lead.industry || '-'],
              ['Decision Maker', lead.decision_maker_name || leadName],
              ['Title', lead.decision_maker_title || '-'],
              ['Email', lead.email],
              ['Pain Points', form.pain_points || '-'],
              ['Solution Angle', form.ai_solution_angle || '-'],
              ['Recommended Offer', form.recommended_offer || '-'],
              ['Notes', form.notes || '-'],
              ['AI Outreach Strategy', form.ai_outreach_strategy || '-'],
              ['Raw Imported Data', Object.entries(lead.raw_data || {}).slice(0, 4).map(([key, value]) => `${key}: ${value}`).join('\n') || '-'],
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] p-4">
                <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">{label}</div>
                <div className="text-sm leading-6 text-zinc-900">{value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <div className="rounded-3xl border border-[var(--border)] bg-white p-6 shadow-[0_12px_40px_rgba(15,23,42,0.04)]">
          <div className="mb-4 flex flex-col gap-3 border-b border-[var(--border)] pb-4 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="text-base font-semibold text-zinc-950">Manual Email</h3>
            <div className="flex flex-wrap items-center gap-2">
              <button onClick={() => onSendManual('test')} disabled={sending} className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-white px-4 py-2.5 text-sm font-semibold text-zinc-700 transition hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700 disabled:opacity-50">
                {sending ? <Spinner size={16} className="text-violet-600" /> : <Send className="h-4 w-4" />}
                {sending ? 'Sending...' : 'Send Test'}
              </button>
              <button onClick={() => onSendManual('send_now')} disabled={sending} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-95 disabled:opacity-50">
                {sending ? <Spinner size={16} className="text-white" /> : <CheckCircle2 className="h-4 w-4" />}
                {sending ? 'Sending...' : 'Send Now'}
              </button>
              <button onClick={() => navigator.clipboard.writeText(`Subject: ${form.manual_email_subject}\n\n${manualEmailBodyText}`)} className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-white px-4 py-2.5 text-sm font-semibold text-zinc-700 transition hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700">
                <Copy className="h-4 w-4" /> Copy Email
              </button>
            </div>
          </div>
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">From Email Account</label>
                <select value={selectedEmailAccountId} onChange={(e) => onSelectedEmailAccountIdChange(e.target.value)} className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 text-sm text-zinc-900 outline-none transition focus:border-violet-300 focus:ring-2 focus:ring-violet-100">
                  <option value="">Use default</option>
                  {emailAccounts.map((account) => <option key={account.id} value={account.id}>{account.sender_name || account.email_address}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">To Email</label>
                <input value={targetEmail} onChange={(e) => onTargetEmailChange(e.target.value)} className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 text-sm text-zinc-900 outline-none transition focus:border-violet-300 focus:ring-2 focus:ring-violet-100" />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">Email Type</label>
              <select value={manualEmailType} onChange={(e) => onManualEmailTypeChange(e.target.value as (typeof EMAIL_TYPES)[number])} className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 text-sm text-zinc-900 outline-none transition focus:border-violet-300 focus:ring-2 focus:ring-violet-100">
                {EMAIL_TYPES.map((emailType) => <option key={emailType} value={emailType}>{getLeadStatusLabel(emailType)}</option>)}
              </select>
            </div>
            <div className="grid gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] p-4 md:grid-cols-[1fr_auto]">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">Template</label>
                <select value={selectedTemplateId} onChange={(e) => onSelectedTemplateIdChange(e.target.value)} className="w-full rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-sm text-zinc-900 outline-none transition focus:border-violet-300 focus:ring-2 focus:ring-violet-100">
                  <option value="">Select a template</option>
                  {templateOptions.map((template) => (
                    <option key={template.id} value={template.id}>{template.name} {template.category ? `- ${template.category}` : ''}</option>
                  ))}
                </select>
              </div>
              <button onClick={onInsertTemplate} disabled={!selectedTemplateId} className="self-end rounded-2xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-violet-700 disabled:opacity-50">
                Insert Template
              </button>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">Subject</label>
              <input value={form.manual_email_subject} onChange={(e) => setForm((current: any) => ({ ...current, manual_email_subject: e.target.value }))} className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 text-sm text-zinc-900 outline-none transition focus:border-violet-300 focus:ring-2 focus:ring-violet-100" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">Body</label>
              <RichTextEditor value={form.manual_email_body} onChange={(value) => setForm((current: any) => ({ ...current, manual_email_body: value }))} placeholder="Write a polished email. Use the toolbar to bold text, add lists, or insert links." className="mt-1" />
            </div>
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="text-sm font-semibold text-zinc-950">Email signature</div>
                  <p className="mt-1 text-sm text-zinc-500">
                    {selectedSignatureHtml
                      ? `Signature found for ${selectedEmailAccount?.email_address}.`
                      : `No custom signature yet. ReachMira will append ${selectedEmailAccount?.sender_name || selectedEmailAccount?.email_address || 'the sender name'} instead.`}
                  </p>
                </div>
                <label className="inline-flex items-center gap-2 text-sm font-semibold text-zinc-700">
                  <input
                    type="checkbox"
                    checked={includeSignature}
                    onChange={(e) => onIncludeSignatureChange(e.target.checked)}
                    className="rounded border-zinc-300 text-violet-600 focus:ring-violet-500"
                  />
                  Append on send
                </label>
              </div>
              {selectedSendSignatureHtml && includeSignature && (
                <div className="mt-4 rounded-2xl border border-[var(--border)] bg-white p-4 text-sm text-zinc-900">
                  <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-400">Preview</div>
                  <div dangerouslySetInnerHTML={{ __html: sanitizeEmailHtml(selectedSendSignatureHtml) }} />
                </div>
              )}
            </div>
            <div className="grid gap-4 lg:grid-cols-[1fr_0.8fr]">
              <div className="flex flex-wrap gap-2">
                <button onClick={onSaveLead} disabled={saving} className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-white px-4 py-2.5 text-sm font-semibold text-zinc-700 transition hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700 disabled:opacity-50">
                  <Save className="h-4 w-4" /> Save Draft
                </button>
                <button onClick={onApproveManualEmail} disabled={saving} className="inline-flex items-center gap-2 rounded-xl border border-teal-200 bg-teal-50 px-4 py-2.5 text-sm font-semibold text-teal-700 transition hover:bg-teal-100 disabled:opacity-50">
                  <CheckCircle2 className="h-4 w-4" /> Approve Draft
                </button>
                <button onClick={() => navigator.clipboard.writeText(leadContextPrompt)} className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-white px-4 py-2.5 text-sm font-semibold text-zinc-700 transition hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700">
                  <Copy className="h-4 w-4" /> Copy Context
                </button>
                <button onClick={() => navigator.clipboard.writeText(manualEmailBodyText || '')} className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-white px-4 py-2.5 text-sm font-semibold text-zinc-700 transition hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700">
                  <Copy className="h-4 w-4" /> Copy Plain Text
                </button>
              </div>
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] p-4">
                <div className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">Send checklist</div>
                <div className="space-y-2">
                  {sendChecklist.map((item) => (
                    <div key={item.label} className="flex items-center justify-between rounded-xl bg-white px-3 py-2">
                      <span className="text-sm text-zinc-700">{item.label}</span>
                      <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${item.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                        {item.ok ? 'Ready' : 'Needs work'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            {emailQualityIssues.length > 0 && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-amber-900">
                  <AlertTriangle className="h-4 w-4" /> Email quality notes
                </div>
                <div className="space-y-1 text-sm text-amber-800">
                  {emailQualityIssues.map((issue) => (
                    <div key={`${issue.severity}-${issue.message}`}>
                      <span className="font-semibold">{issue.severity === 'error' ? 'Fix' : 'Check'}:</span> {issue.message}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {emailVerificationIssues.length > 0 && (
              <div className={`rounded-2xl p-4 ${emailVerificationIssues.some((issue) => issue.severity === 'error') ? 'border border-rose-200 bg-rose-50' : 'border border-amber-200 bg-amber-50'}`}>
                <div className={`mb-2 flex items-center gap-2 text-sm font-semibold ${emailVerificationIssues.some((issue) => issue.severity === 'error') ? 'text-rose-900' : 'text-amber-900'}`}>
                  <AlertTriangle className="h-4 w-4" /> Email verification notes
                </div>
                <div className={`space-y-1 text-sm ${emailVerificationIssues.some((issue) => issue.severity === 'error') ? 'text-rose-800' : 'text-amber-800'}`}>
                  {emailVerificationIssues.map((issue) => (
                    <div key={`${issue.severity}-${issue.message}`}>
                      <span className="font-semibold">{issue.severity === 'error' ? 'Blocked:' : 'Warning:'}</span> {issue.message}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* DNS / Authentication Guidance Box */}
            <div className="rounded-2xl border border-violet-100 bg-violet-50/70 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-violet-900 mb-1">
                <ShieldAlert className="h-4 w-4 text-violet-600" />
                DNS &amp; Sending Domain Authentication Guidance
              </div>
              <p className="text-xs text-violet-800/80 leading-relaxed">
                To protect domain reputation and avoid spam folders, verify that your sending domain has correct **SPF**, **DKIM**, and **DMARC** records set up in your DNS provider (e.g. Cloudflare, GoDaddy). If using custom SMTP, matching tracking records with custom bounce domains prevents SPF alignment errors.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
