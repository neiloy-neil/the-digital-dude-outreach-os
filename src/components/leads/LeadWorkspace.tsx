'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Sidebar from '@/components/Sidebar';
import StatusBadge from '@/components/leads/StatusBadge';
import { buildLeadContextPrompt } from '@/lib/leads/context-prompt';
import { htmlToPlainText, normalizeDraftHtml } from '@/lib/email/html';
import { EMAIL_TYPES, getLeadStatusLabel } from '@/lib/leads/status';
import { createClient } from '@/utils/supabase/client';
import RichTextEditor from '@/components/leads/RichTextEditor';
import type { AuditLog, EmailAccount, Lead, SentEmail } from '@/types/database.types';
import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  Copy,
  Database,
  ExternalLink,
  History,
  Mail,
  Save,
  Send,
  Sparkles,
  WandSparkles,
  X,
} from 'lucide-react';

type LeadDetail = Lead & {
  lead_lists?: { id: string; name: string; description?: string | null } | null;
  campaigns?: { id: string; name: string; offer_type?: string | null } | null;
  sent_emails?: SentEmail[];
};

type TabId = 'lead-data' | 'ai' | 'manual' | 'history' | 'timeline';

const TABS: Array<{ id: TabId; label: string; icon: typeof Database }> = [
  { id: 'lead-data', label: 'Lead Data', icon: Database },
  { id: 'ai', label: 'AI / Lead Intelligence', icon: WandSparkles },
  { id: 'manual', label: 'Manual Email', icon: Mail },
  { id: 'history', label: 'Email History', icon: History },
  { id: 'timeline', label: 'Timeline', icon: Clock3 },
];

type Props = {
  leadId: string;
  title: string;
  subtitle: string;
  backHref: string;
  backLabel: string;
};

function normalizeWebsite(website?: string | null) {
  if (!website) return '';
  return website.startsWith('http') ? website : `https://${website}`;
}

function formatDate(value?: string | null) {
  if (!value) return '-';
  return new Date(value).toLocaleString();
}

function eventTimestamp(event: { created_at?: string; sent_at?: string }) {
  return event.created_at || event.sent_at || '';
}

export default function LeadWorkspace({ leadId, title, subtitle, backHref, backLabel }: Props) {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>('lead-data');
  const [lead, setLead] = useState<LeadDetail | null>(null);
  const [emailAccounts, setEmailAccounts] = useState<EmailAccount[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [selectedEmailAccountId, setSelectedEmailAccountId] = useState('');
  const [targetEmail, setTargetEmail] = useState('');
  const [selectedEmail, setSelectedEmail] = useState<SentEmail | null>(null);
  const [manualEmailType, setManualEmailType] = useState<(typeof EMAIL_TYPES)[number]>('custom_email');

  const [form, setForm] = useState({
    lead_list_id: '',
    email: '',
    first_name: '',
    last_name: '',
    decision_maker_name: '',
    decision_maker_title: '',
    company_name: '',
    company: '',
    website: '',
    industry: '',
    sub_industry: '',
    country: '',
    city: '',
    company_size: '',
    estimated_revenue: '',
    priority: 'normal',
    status: 'new',
    pain_points: '',
    solution: '',
    recommended_offer: '',
    notes: '',
    raw_data: {} as Record<string, unknown>,
    ai_company_summary: '',
    ai_lead_analysis: '',
    ai_outreach_strategy: '',
    ai_personalized_first_line: '',
    ai_solution_angle: '',
    manual_email_subject: '',
    manual_email_body: '',
    manual_email_approved: false,
  });

  const loadLead = useCallback(async (options?: { silent?: boolean }) => {
    const silent = options?.silent ?? false;
    if (silent) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    try {
      const [leadResponse, accountsResponse] = await Promise.all([
        fetch(`/api/leads/${leadId}`),
        supabase
          .from('email_accounts')
          .select('id, user_id, provider, email_address, sender_name, daily_send_limit, daily_sent_count, last_sent_reset_date, is_default, warmup_enabled, status, created_at, updated_at')
          .eq('status', 'active')
          .order('is_default', { ascending: false }),
      ]);

      const leadPayload = (await leadResponse.json()) as { lead?: LeadDetail; auditLogs?: AuditLog[]; error?: string };
      if (!leadResponse.ok || !leadPayload.lead) {
        throw new Error(leadPayload.error || 'Failed to load lead');
      }

      const nextLead = leadPayload.lead;
      setLead(nextLead);
      setAuditLogs(leadPayload.auditLogs || []);
      setEmailAccounts((accountsResponse.data as EmailAccount[]) || []);
      setSelectedEmailAccountId(nextLead.last_manual_email_account_id || accountsResponse.data?.[0]?.id || '');
      setTargetEmail(nextLead.email || '');
      setManualEmailType((nextLead.sent_emails?.[0]?.email_type as (typeof EMAIL_TYPES)[number]) || 'custom_email');

      setForm({
        lead_list_id: nextLead.lead_list_id || '',
        email: nextLead.email || '',
        first_name: nextLead.first_name || '',
        last_name: nextLead.last_name || '',
        decision_maker_name: nextLead.decision_maker_name || '',
        decision_maker_title: nextLead.decision_maker_title || '',
        company_name: nextLead.company_name || nextLead.company || '',
        company: nextLead.company || nextLead.company_name || '',
        website: nextLead.website || '',
        industry: nextLead.industry || '',
        sub_industry: nextLead.sub_industry || '',
        country: nextLead.country || '',
        city: nextLead.city || '',
        company_size: nextLead.company_size || '',
        estimated_revenue: nextLead.estimated_revenue || '',
        priority: nextLead.priority || 'normal',
        status: nextLead.status || 'new',
        pain_points: nextLead.pain_points || '',
        solution: nextLead.solution || '',
        recommended_offer: nextLead.recommended_offer || '',
        notes: nextLead.notes || '',
        raw_data: nextLead.raw_data || {},
        ai_company_summary: nextLead.ai_company_summary || '',
        ai_lead_analysis: nextLead.ai_lead_analysis || '',
        ai_outreach_strategy: nextLead.ai_outreach_strategy || '',
        ai_personalized_first_line: nextLead.ai_personalized_first_line || '',
        ai_solution_angle: nextLead.ai_solution_angle || '',
        manual_email_subject: nextLead.manual_email_subject || nextLead.ai_subject || nextLead.personalized_subject || '',
        manual_email_body: normalizeDraftHtml(nextLead.manual_email_body || nextLead.ai_email_body || nextLead.personalized_body || ''),
        manual_email_approved: Boolean(nextLead.manual_email_approved),
      });
    } catch (loadError: unknown) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load lead');
    } finally {
      if (silent) {
        setRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  }, [leadId, supabase]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadLead();
  }, [loadLead]);

  const timeline = useMemo(() => {
    const emailEvents = (lead?.sent_emails || []).map((email) => ({
      id: `email-${email.id}`,
      title: `${getLeadStatusLabel(email.email_type)} sent`,
      message: `${email.subject} to ${email.recipient_email}`,
      sent_at: email.sent_at,
      metadata: {
        provider: email.provider,
        status: email.status,
        sender: email.sender_email,
      },
    }));

    const auditEvents = auditLogs.map((log) => ({
      id: `audit-${log.id}`,
      title: getLeadStatusLabel(log.action),
      message: log.message || 'No details',
      created_at: log.created_at,
      metadata: log.metadata,
    }));

    return [...emailEvents, ...auditEvents].sort((a, b) => new Date(eventTimestamp(b)).getTime() - new Date(eventTimestamp(a)).getTime());
  }, [auditLogs, lead?.sent_emails]);

  const leadName = lead?.decision_maker_name || `${lead?.first_name || ''} ${lead?.last_name || ''}`.trim() || 'Prospect';
  const leadContextPrompt = useMemo(() => buildLeadContextPrompt({ ...lead, recommended_offer: form.recommended_offer }), [form.recommended_offer, lead]);
  const manualEmailBodyText = useMemo(() => htmlToPlainText(form.manual_email_body), [form.manual_email_body]);
  const isInitialLoading = loading && !lead;

  const handleSaveLead = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const nextStatus =
        form.manual_email_subject.trim() || manualEmailBodyText
          ? ['new', 'imported', 'data_reviewed'].includes(form.status)
            ? 'manual_email_draft'
            : form.status
          : form.status;

      const response = await fetch(`/api/leads/${leadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          status: nextStatus,
          company_name: form.company_name || form.company,
          company: form.company || form.company_name,
          last_manual_email_account_id: selectedEmailAccountId || null,
          manual_personalization_status: form.manual_email_subject || manualEmailBodyText ? 'drafted' : 'not_started',
        }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error || 'Failed to save lead');
      setSuccess('Lead changes saved.');
      await loadLead({ silent: true });
    } catch (saveError: unknown) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to save lead');
    } finally {
      setSaving(false);
    }
  };

  const handleApproveManualEmail = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch(`/api/leads/${leadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          manual_email_approved: true,
          manual_personalization_status: 'approved',
          status: form.manual_email_subject || manualEmailBodyText ? 'email_approved' : form.status,
          company_name: form.company_name || form.company,
          company: form.company || form.company_name,
          last_manual_email_account_id: selectedEmailAccountId || null,
        }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error || 'Failed to approve manual email');
      setSuccess('Manual email approved.');
      await loadLead({ silent: true });
    } catch (approveError: unknown) {
      setError(approveError instanceof Error ? approveError.message : 'Failed to approve manual email');
    } finally {
      setSaving(false);
    }
  };

  const handleGenerateAi = async (requestedDepth?: 'none' | 'basic' | 'standard' | 'deep', requestedMode?: string) => {
    if (requestedDepth === 'deep') {
      const confirmed = window.confirm('This will use a Deep AI request. You have only 20/day.');
      if (!confirmed) return;
    }
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch(`/api/leads/${leadId}/personalize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          offerType: lead?.campaigns?.offer_type || form.recommended_offer || 'Custom software development',
          requestedDepth,
          requestedMode,
        }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error || 'Failed to generate AI');
      setSuccess('AI draft refreshed.');
      setActiveTab('ai');
      await loadLead({ silent: true });
    } catch (generateError: unknown) {
      setError(generateError instanceof Error ? generateError.message : 'Failed to generate AI');
    } finally {
      setSaving(false);
    }
  };

  const handleSendManual = async (mode: 'test' | 'send_now') => {
    setSending(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch(`/api/leads/${leadId}/manual-send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode,
          targetEmail,
          emailAccountId: selectedEmailAccountId || null,
          subject: form.manual_email_subject,
          body: form.manual_email_body,
          emailType: manualEmailType,
        }),
      });
      const payload = (await response.json()) as { error?: string; to?: string };
      if (!response.ok) throw new Error(payload.error || 'Failed to send email');
      setSuccess(mode === 'test' ? `Test email sent to ${payload.to}.` : 'Email sent successfully.');
      setActiveTab('history');
      await loadLead({ silent: true });
    } catch (sendError: unknown) {
      setError(sendError instanceof Error ? sendError.message : 'Failed to send email');
    } finally {
      setSending(false);
    }
  };

  const handleSkipAi = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const { error: updateError } = await supabase
        .from('leads')
        .update({
          ai_status: 'skipped',
          ai_depth: 'none',
          ai_usage_notes: 'Skipped AI to save credits.',
          updated_at: new Date().toISOString(),
        })
        .eq('id', leadId);

      if (updateError) throw updateError;
      setSuccess('This lead has poor data. AI skipped to save credits.');
      await loadLead({ silent: true });
    } catch (skipError: unknown) {
      setError(skipError instanceof Error ? skipError.message : 'Failed to skip AI');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-zinc-950 text-zinc-100">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-8">
        <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-3">
            <Link href={backHref} className="mt-1 rounded-lg border border-zinc-800 bg-zinc-900 p-2 text-zinc-400 hover:text-white">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-zinc-500">{backLabel}</div>
              <h2 className="mt-1 text-3xl font-extrabold tracking-tight text-white">{title}</h2>
              <p className="mt-1 text-sm text-zinc-400">{subtitle}</p>
              <p className="mt-2 text-lg font-semibold text-zinc-100">{leadName}</p>
            </div>
          </div>

          {lead && (
            <div className="flex flex-wrap gap-2">
              <StatusBadge status={lead.status} />
              <span className="inline-flex rounded-full border border-zinc-700 bg-zinc-900 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-300">
                {lead.data_quality_label || 'poor'} quality
              </span>
            </div>
          )}
        </div>

        {error && <div className="mb-6 rounded-lg border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-300">{error}</div>}
        {success && <div className="mb-6 rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs text-emerald-300">{success}</div>}

        {isInitialLoading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-violet-500 border-t-transparent" />
          </div>
        ) : lead ? (
          <div className="space-y-6">
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/20 p-2">
              <div className="flex flex-wrap gap-2">
                {TABS.map((tab) => {
                  const Icon = tab.icon;
                  const active = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold ${active ? 'bg-zinc-100 text-zinc-950' : 'bg-zinc-950/40 text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100'}`}
                    >
                      <Icon className="h-4 w-4" />
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {activeTab === 'lead-data' && (
              <div className="grid gap-6 lg:grid-cols-[1.7fr_1fr]">
                <div className="rounded-xl border border-zinc-800 bg-zinc-900/20 p-6">
                  <div className="mb-4 flex items-center justify-between border-b border-zinc-800 pb-3">
                    <h3 className="text-base font-bold text-white">Lead Data</h3>
                    <button onClick={handleSaveLead} disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-violet-600 to-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
                      <Save className="h-4 w-4" /> Save Lead
                    </button>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    {[
                      { key: 'decision_maker_name', label: 'Decision Maker', multi: false },
                      { key: 'decision_maker_title', label: 'Title', multi: false },
                      { key: 'email', label: 'Email', multi: false },
                      { key: 'company_name', label: 'Company', multi: false },
                      { key: 'website', label: 'Website', multi: false },
                      { key: 'industry', label: 'Industry', multi: false },
                      { key: 'pain_points', label: 'Pain Points', multi: true },
                      { key: 'solution', label: 'Solution', multi: true },
                      { key: 'recommended_offer', label: 'Recommended Offer', multi: true },
                    ].map(({ key, label, multi }) => (
                      <div key={key} className={multi ? 'md:col-span-2' : ''}>
                        <label className="mb-1 block text-xs font-semibold uppercase text-zinc-500">{label}</label>
                        {multi ? (
                          <textarea value={form[key as keyof typeof form] as string} onChange={(e) => setForm((current) => ({ ...current, [key]: e.target.value }))} rows={3} className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm" />
                        ) : (
                          <input value={form[key as keyof typeof form] as string} onChange={(e) => setForm((current) => ({ ...current, [key]: e.target.value }))} className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm" />
                        )}
                      </div>
                    ))}
                    <div>
                      <label className="mb-1 block text-xs font-semibold uppercase text-zinc-500">Status</label>
                      <input value={form.status} onChange={(e) => setForm((current) => ({ ...current, status: e.target.value }))} className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm" />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold uppercase text-zinc-500">Priority</label>
                      <select value={form.priority} onChange={(e) => setForm((current) => ({ ...current, priority: e.target.value }))} className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm">
                        <option value="low">Low</option>
                        <option value="normal">Normal</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                      </select>
                    </div>
                    <div className="md:col-span-2">
                      <label className="mb-1 block text-xs font-semibold uppercase text-zinc-500">Notes</label>
                      <textarea value={form.notes} onChange={(e) => setForm((current) => ({ ...current, notes: e.target.value }))} rows={4} className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm" />
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="rounded-xl border border-zinc-800 bg-zinc-900/20 p-6">
                    <h3 className="mb-4 text-base font-bold text-white">Quick Facts</h3>
                    <div className="space-y-3 text-sm">
                      <div className="flex items-start justify-between gap-4"><span className="text-zinc-500">Company</span><span className="text-right text-zinc-200">{lead.company_name || lead.company || '-'}</span></div>
                      <div className="flex items-start justify-between gap-4"><span className="text-zinc-500">Email</span><span className="text-right text-zinc-200">{lead.email}</span></div>
                      <div className="flex items-start justify-between gap-4"><span className="text-zinc-500">Website</span>{lead.website ? <a href={normalizeWebsite(lead.website)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-violet-400 hover:text-violet-300">Visit <ExternalLink className="h-3.5 w-3.5" /></a> : <span>-</span>}</div>
                      <div className="flex items-start justify-between gap-4"><span className="text-zinc-500">Last Contacted</span><span className="text-right text-zinc-200">{formatDate(lead.last_email_sent_at || lead.last_contacted_at || lead.last_contacted)}</span></div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-zinc-800 bg-zinc-900/20 p-6">
                    <div className="mb-4 flex items-center justify-between border-b border-zinc-800 pb-3">
                      <h3 className="text-base font-bold text-white">Raw Data</h3>
                      <button onClick={() => navigator.clipboard.writeText(JSON.stringify(lead.raw_data || {}, null, 2))} className="text-sm font-semibold text-violet-400 hover:text-violet-300">Copy</button>
                    </div>
                    <div className="max-h-80 overflow-auto rounded-lg border border-zinc-800 bg-zinc-950/70">
                      <table className="w-full text-left text-xs">
                        <tbody className="divide-y divide-zinc-800">
                          {Object.entries(lead.raw_data || {})
                            .filter(([, value]) => value !== null && value !== undefined && value !== '')
                            .map(([key, value]) => (
                              <tr key={key}>
                                <td className="w-40 px-3 py-2 font-semibold text-zinc-400">{key}</td>
                                <td className="px-3 py-2 text-zinc-200">{String(value)}</td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'ai' && (
              <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
                <div className="rounded-xl border border-zinc-800 bg-zinc-900/20 p-6">
                  <div className="mb-4 flex items-center justify-between border-b border-zinc-800 pb-3">
                    <h3 className="text-base font-bold text-white">AI / Lead Intelligence</h3>
                    <button onClick={() => navigator.clipboard.writeText(leadContextPrompt)} className="inline-flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-2 text-sm font-semibold text-zinc-200"><Copy className="h-4 w-4" /> Copy Lead Context for AI</button>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    {[
                      ['ai_company_summary', 'Company Summary'],
                      ['ai_lead_analysis', 'Lead Analysis'],
                      ['ai_outreach_strategy', 'Outreach Strategy'],
                      ['ai_personalized_first_line', 'Personalized First Line'],
                      ['ai_solution_angle', 'Solution Angle'],
                    ].map(([key, label]) => (
                      <div key={key} className={key === 'ai_personalized_first_line' ? 'md:col-span-2' : ''}>
                        <label className="mb-1 block text-xs font-semibold uppercase text-zinc-500">{label}</label>
                        <textarea value={form[key as keyof typeof form] as string} onChange={(e) => setForm((current) => ({ ...current, [key]: e.target.value }))} rows={4} className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm" />
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-xl border border-zinc-800 bg-zinc-900/20 p-6">
                  <h3 className="mb-4 text-base font-bold text-white">AI Actions</h3>
                  <div className="space-y-2">
                    <button onClick={() => handleGenerateAi('basic', 'basic_ai')} disabled={saving} className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-violet-600 to-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"><Sparkles className="h-4 w-4" /> Generate Basic AI</button>
                    <button onClick={() => handleGenerateAi('standard', 'standard_ai')} disabled={saving} className="flex w-full items-center justify-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-2 text-sm font-semibold text-zinc-200"><Sparkles className="h-4 w-4 text-cyan-400" /> Generate Standard AI</button>
                    <button onClick={() => handleGenerateAi('deep', 'deep_ai')} disabled={saving} className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-2 text-sm font-semibold text-white"><Sparkles className="h-4 w-4" /> Generate Deep AI</button>
                    <button onClick={() => handleGenerateAi('none', 'template_only')} disabled={saving} className="flex w-full items-center justify-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-2 text-sm font-semibold text-zinc-200"><Database className="h-4 w-4 text-emerald-400" /> Use Template Only</button>
                    <button onClick={handleSkipAi} className="flex w-full items-center justify-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-2 text-sm font-semibold text-zinc-200"><X className="h-4 w-4 text-rose-400" /> Skip AI</button>
                  </div>
                  <div className="mt-4 rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-200">
                    This will use a Deep AI request. You have only 20/day. Flash Lite is recommended for bulk personalization.
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'manual' && (
              <div className="grid gap-6 lg:grid-cols-[1.1fr_1.2fr]">
                <div className="rounded-xl border border-zinc-800 bg-zinc-900/20 p-6">
                  <h3 className="mb-4 text-base font-bold text-white">Lead Context</h3>
                  <div className="space-y-3 text-sm">
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
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-3">
                        <div className="mb-1 text-xs font-semibold uppercase text-zinc-500">{label}</div>
                        <div className="text-zinc-100">{value}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl border border-zinc-800 bg-zinc-900/20 p-6">
                  <div className="mb-4 flex items-center justify-between border-b border-zinc-800 pb-3">
                    <h3 className="text-base font-bold text-white">Manual Email</h3>
                    <div className="flex items-center gap-2">
                      <button onClick={() => handleSendManual('test')} disabled={sending} className="inline-flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-2 text-sm font-semibold text-zinc-200 disabled:opacity-50"><Send className="h-4 w-4" /> Send Test</button>
                      <button onClick={() => handleSendManual('send_now')} disabled={sending} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"><CheckCircle2 className="h-4 w-4" /> Send Now</button>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-xs font-semibold uppercase text-zinc-500">From Email Account</label>
                        <select value={selectedEmailAccountId} onChange={(e) => setSelectedEmailAccountId(e.target.value)} className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm">
                          <option value="">Use default</option>
                          {emailAccounts.map((account) => <option key={account.id} value={account.id}>{account.sender_name || account.email_address}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-semibold uppercase text-zinc-500">To Email</label>
                        <input value={targetEmail} onChange={(e) => setTargetEmail(e.target.value)} className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm" />
                      </div>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold uppercase text-zinc-500">Email Type</label>
                      <select value={manualEmailType} onChange={(e) => setManualEmailType(e.target.value as (typeof EMAIL_TYPES)[number])} className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm">
                        {EMAIL_TYPES.map((emailType) => <option key={emailType} value={emailType}>{getLeadStatusLabel(emailType)}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold uppercase text-zinc-500">Subject</label>
                      <input value={form.manual_email_subject} onChange={(e) => setForm((current) => ({ ...current, manual_email_subject: e.target.value }))} className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm" />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold uppercase text-zinc-500">Body</label>
                      <RichTextEditor
                        value={form.manual_email_body}
                        onChange={(value) => setForm((current) => ({ ...current, manual_email_body: value }))}
                        placeholder="Write a polished email. Use the toolbar to bold text, add lists, or insert links."
                        className="mt-1"
                      />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button onClick={handleSaveLead} disabled={saving} className="inline-flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-2 text-sm font-semibold text-zinc-200 disabled:opacity-50"><Save className="h-4 w-4" /> Save Draft</button>
                      <button onClick={handleApproveManualEmail} disabled={saving} className="inline-flex items-center gap-2 rounded-lg border border-teal-200 bg-teal-50 px-4 py-2 text-sm font-semibold text-teal-700 disabled:opacity-50"><CheckCircle2 className="h-4 w-4" /> Approve Draft</button>
                      <button onClick={() => navigator.clipboard.writeText(leadContextPrompt)} className="inline-flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-2 text-sm font-semibold text-zinc-200"><Copy className="h-4 w-4" /> Copy Lead Context for AI</button>
                      <button onClick={() => navigator.clipboard.writeText(manualEmailBodyText || '')} className="inline-flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-2 text-sm font-semibold text-zinc-200"><Copy className="h-4 w-4" /> Copy Plain Text</button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'history' && (
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/20 p-6">
                <div className="mb-4 flex items-center justify-between border-b border-zinc-800 pb-3">
                  <h3 className="text-base font-bold text-white">Email History</h3>
                  <div className="flex items-center gap-3">
                    {refreshing && (
                      <span className="inline-flex items-center gap-2 rounded-full border border-violet-500/20 bg-violet-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-violet-300">
                        <span className="h-2 w-2 animate-spin rounded-full border border-violet-300 border-t-transparent" />
                        Refreshing
                      </span>
                    )}
                    <span className="text-xs text-zinc-500">{lead.sent_emails?.length || 0} emails</span>
                  </div>
                </div>
                {refreshing && (
                  <div className="mb-4 rounded-lg border border-zinc-800 bg-zinc-950/50 p-4 text-sm text-zinc-400">
                    Refreshing email history...
                  </div>
                )}
                {(lead.sent_emails || []).length === 0 ? (
                  <div className="rounded-lg border border-dashed border-zinc-800 bg-zinc-950/40 p-8 text-center">
                    <div className="text-sm font-semibold text-zinc-200">No sent emails yet</div>
                    <p className="mt-2 text-sm text-zinc-500">
                      Send a manual email or run a campaign step and the sent messages will appear here.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="border-b border-zinc-800 text-xs uppercase text-zinc-500">
                        <tr>
                          <th className="px-3 py-2">Sent At</th>
                          <th className="px-3 py-2">Type</th>
                          <th className="px-3 py-2">Sender</th>
                          <th className="px-3 py-2">Recipient</th>
                          <th className="px-3 py-2">Subject</th>
                          <th className="px-3 py-2">Status</th>
                          <th className="px-3 py-2">Provider</th>
                          <th className="px-3 py-2">Signals</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-800">
                        {(lead.sent_emails || []).map((email) => (
                          <tr key={email.id} className="cursor-pointer hover:bg-zinc-900/30" onClick={() => setSelectedEmail(email)}>
                            <td className="px-3 py-3 text-zinc-300">{formatDate(email.sent_at)}</td>
                            <td className="px-3 py-3 text-zinc-300">{getLeadStatusLabel(email.email_type)}</td>
                            <td className="px-3 py-3 text-zinc-300">{email.sender_email}</td>
                            <td className="px-3 py-3 text-zinc-300">{email.recipient_email}</td>
                            <td className="px-3 py-3 text-zinc-100">{email.subject}</td>
                            <td className="px-3 py-3"><StatusBadge status={email.status} /></td>
                            <td className="px-3 py-3 text-zinc-300">{email.provider}</td>
                            <td className="px-3 py-3 text-xs text-zinc-400">
                              {email.opened_at ? 'Opened ' : ''}
                              {email.clicked_at ? 'Clicked ' : ''}
                              {email.replied_at ? 'Replied ' : ''}
                              {email.bounced_at ? 'Bounced' : ''}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'timeline' && (
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/20 p-6">
                <div className="mb-4 flex items-center justify-between border-b border-zinc-800 pb-3">
                  <h3 className="text-base font-bold text-white">Timeline</h3>
                  <span className="text-xs text-zinc-500">{timeline.length} events</span>
                </div>
                <div className="space-y-3">
                  {timeline.map((item) => (
                    <div key={item.id} className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="font-semibold text-white">{item.title}</div>
                          <div className="mt-1 text-sm text-zinc-300">{item.message}</div>
                        </div>
                        <div className="text-xs text-zinc-500">{formatDate(eventTimestamp(item))}</div>
                      </div>
                      {item.metadata && Object.keys(item.metadata).length > 0 && (
                        <pre className="mt-3 overflow-x-auto rounded-lg bg-zinc-950 p-3 text-[11px] text-zinc-400">{JSON.stringify(item.metadata, null, 2)}</pre>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-6 text-sm text-rose-200">
            <div className="font-semibold text-rose-100">Lead could not be loaded</div>
            <p className="mt-2 text-rose-200/80">{error || 'Please go back and try again.'}</p>
          </div>
        )}

        {selectedEmail && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6">
              <div className="max-h-[85vh] w-full max-w-3xl overflow-auto rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-white">{selectedEmail.subject}</h3>
                    <p className="text-sm text-zinc-400">{selectedEmail.sender_email} to {selectedEmail.recipient_email}</p>
                  </div>
                  <button onClick={() => setSelectedEmail(null)} className="rounded-lg border border-zinc-800 p-2 text-zinc-400 hover:text-white">
                    <X className="h-4 w-4" />
                  </button>
                </div>
                {selectedEmail.body_html ? (
                  <div className="rounded-lg border border-zinc-800 bg-white p-5 text-sm text-zinc-900">
                    <div dangerouslySetInnerHTML={{ __html: selectedEmail.body_html }} />
                  </div>
                ) : (
                  <pre className="whitespace-pre-wrap rounded-lg border border-zinc-800 bg-zinc-900/40 p-4 text-sm text-zinc-100">{selectedEmail.body_text || htmlToPlainText(selectedEmail.body_html || '') || 'No body available.'}</pre>
                )}
              </div>
            </div>
          )}
      </main>
    </div>
  );
}
