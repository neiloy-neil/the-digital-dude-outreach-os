'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Ban, CheckCircle2, Copy, Database, Edit3, ExternalLink, History, Mail, MessageSquare, PlusCircle, Save, Send, Sparkles, WandSparkles, X, Clock3, AlertTriangle, Trash2, ShieldAlert } from 'lucide-react';
import AppShell from '@/components/reachmira/AppShell';
import Spinner from '@/components/reachmira/Spinner';
import { Badge, useConfirm } from '@/components/reachmira/ui';
import EmailVerificationBadge from '@/components/leads/EmailVerificationBadge';
import StatusBadge from '@/components/leads/StatusBadge';
import RichTextEditor from '@/components/leads/RichTextEditor';
import { buildFollowUpPrompt, buildLeadContextPrompt, buildLeadSummary, type CompanyPromptContext } from '@/lib/leads/context-prompt';
import { htmlToPlainText, normalizeDraftHtml } from '@/lib/email/html';
import { checkEmailQuality, hasBlockingEmailQualityIssue } from '@/lib/email/check-email-quality';
import { buildEmailSignatureHtml, buildSendSignatureHtml } from '@/lib/email/signature';
import { applyTemplateVariables } from '@/lib/templates/template-helpers';
import { EMAIL_TYPES, getLeadStatusLabel } from '@/lib/leads/status';
import { createClient } from '@/utils/supabase/client';
import { useToast } from '@/lib/toast/toast-context';
import type { AuditLog, EmailAccount, Lead, SentEmail } from '@/types/database.types';

type LeadDetail = Lead & {
  lead_lists?: { id: string; name: string; description?: string | null } | null;
  campaigns?: { id: string; name: string; offer_type?: string | null } | null;
  sent_emails?: SentEmail[];
};

type CampaignOption = {
  id: string;
  name: string;
};

type TemplateOption = {
  id: string;
  name: string;
  category?: string | null;
  subject: string;
  body?: string | null;
};

type ReplyEvent = {
  id: string;
  createdAt: string;
  message?: string | null;
  sender: string;
  recipient: string;
  subject: string;
  snippet: string;
  bodyText: string;
  bodyHtml: string;
  source: string;
};

type ActivityLog = {
  id: string;
  campaign_id: string;
  lead_id: string;
  outbox_id?: string | null;
  event_type: string;
  payload: Record<string, unknown>;
  created_at: string;
};

type TabId = 'overview' | 'intelligence' | 'manual' | 'history' | 'replies' | 'timeline' | 'raw-data';

const TABS: Array<{ id: TabId; label: string; icon: typeof Database }> = [
  { id: 'overview', label: 'Overview', icon: Database },
  { id: 'intelligence', label: 'Lead Intelligence', icon: WandSparkles },
  { id: 'manual', label: 'Manual Email', icon: Mail },
  { id: 'history', label: 'Email History', icon: History },
  { id: 'replies', label: 'Replies', icon: MessageSquare },
  { id: 'timeline', label: 'Timeline', icon: Clock3 },
  { id: 'raw-data', label: 'Raw Data', icon: Database },
];

const BLOCKED_EMAIL_VERIFICATION_STATUSES = new Set([
  'invalid',
  'disposable',
  'suppressed',
]);

const WARNING_EMAIL_VERIFICATION_STATUSES = new Set([
  'role_based',
  'risky',
  'unknown',
  'not_checked',
  'failed',
]);

const EMAIL_VERIFICATION_LABELS: Record<string, string> = {
  valid: 'valid',
  risky: 'risky',
  invalid: 'invalid',
  role_based: 'role-based',
  disposable: 'disposable',
  suppressed: 'suppressed',
  not_checked: 'not checked',
  unknown: 'unknown',
  failed: 'failed',
};

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

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function metadataString(metadata: Record<string, unknown>, key: string) {
  const value = metadata[key];
  if (typeof value === 'string') return value;
  if (value === null || value === undefined) return '';
  return String(value);
}

function metadataRecord(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function isReplyAction(value?: string | null) {
  return ['reply_received', 'replied', 'email_replied', 'lead_replied'].includes(String(value || '').toLowerCase());
}

export default function LeadWorkspace({ leadId, title, subtitle, backHref, backLabel }: Props) {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [checkingReplies, setCheckingReplies] = useState(false);
  const [verifyingEmail, setVerifyingEmail] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const toast = useToast();
  const { confirm, confirmDialog } = useConfirm();
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [lead, setLead] = useState<LeadDetail | null>(null);
  const [emailAccounts, setEmailAccounts] = useState<EmailAccount[]>([]);
  const [campaignOptions, setCampaignOptions] = useState<CampaignOption[]>([]);
  const [templateOptions, setTemplateOptions] = useState<TemplateOption[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [companyContext, setCompanyContext] = useState<CompanyPromptContext | null>(null);
  const [selectedEmailAccountId, setSelectedEmailAccountId] = useState('');
  const [targetEmail, setTargetEmail] = useState('');
  const [selectedEmail, setSelectedEmail] = useState<SentEmail | null>(null);
  const [manualEmailType, setManualEmailType] = useState<(typeof EMAIL_TYPES)[number]>('custom_email');
  const [selectedCampaignId, setSelectedCampaignId] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [includeSignature, setIncludeSignature] = useState(true);
  const [offers, setOffers] = useState<any[]>([]);

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
    next_follow_up_at: '',
    reply_outcome: '',
    funding_stage: '',
    total_raised: '',
    employee_count: '',
    year_founded: '',
    tech_stack: '',
    ceo_name: '',
  });

  const loadLead = useCallback(
    async (options?: { silent?: boolean }) => {
      const silent = options?.silent ?? false;
      if (silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      try {
        const [leadResponse, accountsResponse, campaignsResponse, templatesResponse, offersResponse] = await Promise.all([
          fetch(`/api/leads/${leadId}`),
          fetch('/api/email-accounts'),
          supabase
            .from('campaigns')
            .select('id, name')
            .order('created_at', { ascending: false }),
          fetch('/api/templates'),
          supabase
            .from('offers')
            .select('id, name, description')
            .order('created_at', { ascending: false }),
        ]);

        const leadPayload = (await leadResponse.json()) as { lead?: LeadDetail; auditLogs?: AuditLog[]; activityLogs?: ActivityLog[]; companyContext?: CompanyPromptContext; error?: string };
        if (!leadResponse.ok || !leadPayload.lead) {
          throw new Error(leadPayload.error || 'Failed to load lead');
        }
        const accountsPayload = (await accountsResponse.json()) as EmailAccount[] | { error?: string };
        if (!accountsResponse.ok || !Array.isArray(accountsPayload)) {
          throw new Error(!Array.isArray(accountsPayload) ? accountsPayload.error || 'Failed to load email accounts' : 'Failed to load email accounts');
        }
        const templatesPayload = (await templatesResponse.json()) as { templates?: TemplateOption[]; error?: string };
        if (!templatesResponse.ok) {
          throw new Error(templatesPayload.error || 'Failed to load templates');
        }

        const nextLead = leadPayload.lead;
        setLead(nextLead);
        setAuditLogs(leadPayload.auditLogs || []);
        setActivityLogs(leadPayload.activityLogs || []);
        setCompanyContext(leadPayload.companyContext || null);
        const activeAccounts = accountsPayload.filter((account) => account.status === 'active');
        setEmailAccounts(activeAccounts);
        setCampaignOptions((campaignsResponse.data as CampaignOption[]) || []);
        setTemplateOptions(templatesPayload.templates || []);
        setOffers(offersResponse.data || []);
        setSelectedEmailAccountId(nextLead.last_manual_email_account_id || activeAccounts[0]?.id || '');
        setTargetEmail(nextLead.email || '');
        setManualEmailType((nextLead.manual_email_type as (typeof EMAIL_TYPES)[number]) || (nextLead.sent_emails?.[0]?.email_type as (typeof EMAIL_TYPES)[number]) || 'custom_email');
        setSelectedCampaignId(nextLead.campaign_id || campaignsResponse.data?.[0]?.id || '');

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
          next_follow_up_at: nextLead.next_follow_up_at ? nextLead.next_follow_up_at.substring(0, 16) : '',
          reply_outcome: nextLead.reply_outcome || '',
          funding_stage: (nextLead as any).funding_stage || '',
          total_raised: (nextLead as any).total_raised || '',
          employee_count: (nextLead as any).employee_count || '',
          year_founded: (nextLead as any).year_founded ? String((nextLead as any).year_founded) : '',
          tech_stack: Array.isArray((nextLead as any).tech_stack) ? ((nextLead as any).tech_stack).join(', ') : ((nextLead as any).tech_stack || ''),
          ceo_name: (nextLead as any).ceo_name || '',
        });
      } catch (loadError: unknown) {
        toast.error(loadError instanceof Error ? loadError.message : 'Failed to load lead');
      } finally {
        if (silent) setRefreshing(false);
        else setLoading(false);
      }
    },
    [leadId, supabase]
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadLead();
  }, [loadLead]);

  const handleCheckRepliesNow = async () => {
    setCheckingReplies(true);


    try {
      const response = await fetch('/api/cron/check-replies', { method: 'POST' });
      const payload = (await response.json()) as { error?: string; repliesProcessed?: number };
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to check replies');
      }

      await loadLead({ silent: true });
      toast.success(
        (payload.repliesProcessed || 0) > 0
          ? `Inbox checked and ${payload.repliesProcessed} repl${payload.repliesProcessed === 1 ? 'y was' : 'ies were'} synced.`
          : 'Inbox checked. No new matching replies found.'
      );
    } catch (replyError: unknown) {
      toast.error(replyError instanceof Error ? replyError.message : 'Failed to check replies');
    } finally {
      setCheckingReplies(false);
    }
  };

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

    const outcomeEvents = lead?.reply_outcome ? [{
      id: `outcome-${lead.id}`,
      title: 'Reply Outcome Classified',
      message: `Manually classified prospect reply outcome as: ${lead.reply_outcome}`,
      created_at: lead.updated_at || new Date().toISOString(),
      metadata: { outcome: lead.reply_outcome }
    }] : [];

    return [...emailEvents, ...auditEvents, ...outcomeEvents].sort((a, b) => new Date(eventTimestamp(b)).getTime() - new Date(eventTimestamp(a)).getTime());
  }, [auditLogs, lead?.sent_emails, lead?.reply_outcome, lead?.updated_at, lead?.id]);

  const replyEvents = useMemo<ReplyEvent[]>(() => {
    const auditReplyEvents = auditLogs
      .filter((log) => isReplyAction(log.action))
      .map((log) => {
        const metadata = metadataRecord(log.metadata);
        return {
          id: `audit-${log.id}`,
          createdAt: metadataString(metadata, 'reply_received_at') || log.created_at,
          message: log.message,
          sender: metadataString(metadata, 'sender') || lead?.email || '',
          recipient: metadataString(metadata, 'recipient'),
          subject: metadataString(metadata, 'subject') || '(No subject)',
          snippet: metadataString(metadata, 'snippet') || metadataString(metadata, 'body_snippet'),
          bodyText: metadataString(metadata, 'body_text') || metadataString(metadata, 'body'),
          bodyHtml: metadataString(metadata, 'body_html'),
          source: metadataString(metadata, 'source') || 'audit_log',
        };
      });

    const activityReplyEvents = activityLogs
      .filter((log) => isReplyAction(log.event_type))
      .map((log) => {
        const metadata = metadataRecord(log.payload);
        const source = metadataString(metadata, 'source') || 'activity_log';
        return {
          id: `activity-${log.id}`,
          createdAt: log.created_at,
          message: `Reply detected via ${source.replace(/_/g, ' ')}`,
          sender: metadataString(metadata, 'sender') || lead?.email || '',
          recipient: metadataString(metadata, 'recipient'),
          subject: metadataString(metadata, 'subject') || '(No subject)',
          snippet: metadataString(metadata, 'snippet') || metadataString(metadata, 'body_snippet'),
          bodyText: metadataString(metadata, 'body_text') || metadataString(metadata, 'body'),
          bodyHtml: metadataString(metadata, 'body_html'),
          source,
        };
      });

    const sentEmailReplyEvents = (lead?.sent_emails || [])
      .filter((email) => Boolean(email.replied_at) || String(email.status || '').toLowerCase() === 'replied')
      .map((email) => {
        const metadata = metadataRecord(email.raw_provider_response);
        return {
          id: `sent-${email.id}`,
          createdAt: email.replied_at || email.sent_at,
          message: `Reply recorded for ${email.recipient_email}`,
          sender: metadataString(metadata, 'sender') || email.recipient_email || lead?.email || '',
          recipient: metadataString(metadata, 'recipient') || email.sender_email || '',
          subject: metadataString(metadata, 'subject') || email.subject || '(No subject)',
          snippet: metadataString(metadata, 'snippet') || metadataString(metadata, 'body_snippet'),
          bodyText: metadataString(metadata, 'body_text') || metadataString(metadata, 'body'),
          bodyHtml: metadataString(metadata, 'body_html'),
          source: metadataString(metadata, 'source') || 'sent_email_status',
        };
      });

    const seen = new Set<string>();
    return [...auditReplyEvents, ...activityReplyEvents, ...sentEmailReplyEvents]
      .filter((reply) => {
        const key = `${reply.createdAt}-${reply.sender}-${reply.subject}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [activityLogs, auditLogs, lead?.email, lead?.sent_emails]);

  const leadName = lead?.decision_maker_name || `${lead?.first_name || ''} ${lead?.last_name || ''}`.trim() || 'Prospect';
  const leadContextPrompt = useMemo(() => buildLeadContextPrompt({ ...lead, recommended_offer: form.recommended_offer }, companyContext), [companyContext, form.recommended_offer, lead]);
  const leadSummary = useMemo(() => buildLeadSummary({ ...lead, ...form } as Partial<Lead>), [form, lead]);
  const previousEmail = lead?.sent_emails?.[0] || null;
  const followUpPrompt = useMemo(() => buildFollowUpPrompt({ ...lead, ...form } as Partial<Lead>, previousEmail || undefined, companyContext), [companyContext, form, lead, previousEmail]);
  const selectedEmailAccount = useMemo(
    () => emailAccounts.find((account) => account.id === selectedEmailAccountId) || emailAccounts[0] || null,
    [emailAccounts, selectedEmailAccountId]
  );
  const selectedSignatureHtml = useMemo(
    () => buildEmailSignatureHtml(selectedEmailAccount?.config as Record<string, unknown> | undefined, selectedEmailAccount?.sender_name || selectedEmailAccount?.email_address || ''),
    [selectedEmailAccount]
  );
  const selectedSendSignatureHtml = useMemo(
    () => buildSendSignatureHtml(selectedEmailAccount?.config as Record<string, unknown> | undefined, selectedEmailAccount?.sender_name || selectedEmailAccount?.email_address || ''),
    [selectedEmailAccount]
  );
  const manualEmailBodyText = useMemo(() => htmlToPlainText(form.manual_email_body), [form.manual_email_body]);
  const emailQualityIssues = useMemo(
    () =>
      checkEmailQuality({
        subject: form.manual_email_subject,
        bodyText: manualEmailBodyText,
        bodyHtml: form.manual_email_body,
        lead,
      }),
    [form.manual_email_body, form.manual_email_subject, lead, manualEmailBodyText]
  );
  const emailVerificationStatus = String(lead?.email_verification_status || 'not_checked').trim().toLowerCase();
  const emailVerificationIssues = useMemo(() => {
    if (!lead?.email) return [];

    const reason = String(lead.email_verification_reason || '').trim();
    const statusLabel = EMAIL_VERIFICATION_LABELS[emailVerificationStatus] || 'not checked';

    if (BLOCKED_EMAIL_VERIFICATION_STATUSES.has(emailVerificationStatus)) {
      return [
        {
          severity: 'error' as const,
          message: `Lead email is marked ${statusLabel}. ${reason || 'ReachMira will block sending to this address.'}`,
        },
      ];
    }

    if (WARNING_EMAIL_VERIFICATION_STATUSES.has(emailVerificationStatus)) {
      return [
        {
          severity: 'warning' as const,
          message: `Lead email is marked ${statusLabel}. ${reason || 'ReachMira will ask for confirmation before sending.'}`,
        },
      ];
    }

    return [];
  }, [emailVerificationStatus, lead?.email, lead?.email_verification_reason]);
  const sendChecklist = useMemo(
    () => {
      const isAccountConnected = Boolean(selectedEmailAccountId);
      const isDailyLimitSet = Boolean(selectedEmailAccount?.daily_send_limit && selectedEmailAccount.daily_send_limit > 0);
      const isUnsubscribeLinkEnabled = Boolean(form.manual_email_body.toLowerCase().includes('unsubscribe') || form.manual_email_body.toLowerCase().includes('opt-out') || form.manual_email_body.toLowerCase().includes('opt out'));
      const isLeadNotSuppressed = !['unsubscribed', 'bounced', 'do_not_contact'].includes(String(lead?.status || ''));
      
      return [
        { label: 'Subject added', ok: Boolean(form.manual_email_subject.trim()) },
        { label: 'Body added', ok: Boolean(manualEmailBodyText.trim()) },
        { label: 'Email approved', ok: Boolean(form.manual_email_approved) },
        { label: 'Email account connected', ok: isAccountConnected },
        { label: 'Daily limit configured (>0)', ok: isDailyLimitSet },
        { label: 'Unsubscribe check (contains "unsubscribe")', ok: isUnsubscribeLinkEnabled },
        { label: 'Lead is not suppressed/opted-out', ok: isLeadNotSuppressed },
        { label: 'Email verification cleared', ok: emailVerificationIssues.length === 0 },
        { label: 'No blocking quality issues', ok: !hasBlockingEmailQualityIssue(emailQualityIssues) },
      ];
    },
    [emailQualityIssues, emailVerificationIssues.length, form.manual_email_approved, form.manual_email_subject, form.manual_email_body, manualEmailBodyText, lead?.status, selectedEmailAccountId, selectedEmailAccount]
  );
  const isInitialLoading = loading && !lead;

  const getSentEmailBodyText = (email: SentEmail) => email.body_text || htmlToPlainText(email.body_html || '') || '';
  const getReplyBodyText = (reply: ReplyEvent) => reply.bodyText || htmlToPlainText(reply.bodyHtml) || reply.snippet || '';

  const copySentEmail = async (email: SentEmail) => {
    await navigator.clipboard.writeText(`Subject: ${email.subject}\n\n${getSentEmailBodyText(email)}`);
  };

  const copyReply = async (reply: ReplyEvent) => {
    await navigator.clipboard.writeText(`From: ${reply.sender || 'Unknown'}\nSubject: ${reply.subject}\nReceived: ${formatDate(reply.createdAt)}\n\n${getReplyBodyText(reply) || 'No reply body available.'}`);
  };

  const handleUseReplyAsFollowUpContext = (reply: ReplyEvent) => {
    const replyBody = getReplyBodyText(reply);
    const nextSubject = reply.subject.toLowerCase().startsWith('re:') ? reply.subject : `Re: ${reply.subject}`;
    const draft = [
      `<p>Hi ${leadName === 'Prospect' ? 'there' : leadName},</p>`,
      '<p>Thanks for getting back to me.</p>',
      '<p><br></p>',
      '<blockquote style="border-left:3px solid #d4d4d8;margin:16px 0;padding-left:12px;color:#52525b;">',
      `<p><strong>Reply received ${formatDate(reply.createdAt)}</strong></p>`,
      `<p><strong>From:</strong> ${escapeHtml(reply.sender || 'Unknown')}</p>`,
      `<p><strong>Subject:</strong> ${escapeHtml(reply.subject)}</p>`,
      `<p>${escapeHtml(replyBody || reply.snippet || 'No reply body available.').replace(/\n{2,}/g, '</p><p>').replace(/\n/g, '<br />')}</p>`,
      '</blockquote>',
    ].join('');

    setForm((current) => ({
      ...current,
      manual_email_subject: nextSubject,
      manual_email_body: draft,
      manual_email_approved: false,
    }));
    setManualEmailType('reply_follow_up');
    setActiveTab('manual');
    toast.info('Reply loaded as follow-up context.');
  };

  const handleUseEmailAsFollowUpContext = (email: SentEmail) => {
    const previousBody = getSentEmailBodyText(email);
    const nextSubject = email.subject?.toLowerCase().startsWith('re:') ? email.subject : `Re: ${email.subject}`;
    const draft = [
      `<p>Hi ${leadName === 'Prospect' ? 'there' : leadName},</p>`,
      '<p>Wanted to follow up on my note below.</p>',
      '<p><br></p>',
      '<blockquote style="border-left:3px solid #d4d4d8;margin:16px 0;padding-left:12px;color:#52525b;">',
      `<p><strong>Previous email sent ${formatDate(email.sent_at)}</strong></p>`,
      `<p><strong>Subject:</strong> ${escapeHtml(email.subject)}</p>`,
      `<p>${escapeHtml(previousBody).replace(/\n{2,}/g, '</p><p>').replace(/\n/g, '<br />')}</p>`,
      '</blockquote>',
    ].join('');

    setForm((current) => ({
      ...current,
      manual_email_subject: nextSubject,
      manual_email_body: draft,
      manual_email_approved: false,
    }));
    setManualEmailType(email.email_type === 'first_email' ? 'follow_up_1' : 'reply_follow_up');
    setSelectedEmailAccountId(email.email_account_id || selectedEmailAccountId);
    setSelectedEmail(null);
    setActiveTab('manual');
    toast.info('Previous email loaded as follow-up context.');
  };

  const copyPreviousEmailPrompt = async (email: SentEmail) => {
    await navigator.clipboard.writeText(buildFollowUpPrompt({ ...lead, ...form } as Partial<Lead>, email, companyContext));
  };

  const handleResendEmail = async (email: SentEmail) => {
    if (!(await confirm({
      title: 'Resend email?',
      description: `Resend "${email.subject}" to ${email.recipient_email}?`,
      confirmLabel: 'Resend',
    }))) return;
    setSending(true);
    try {
      const response = await fetch(`/api/leads/${leadId}/manual-send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'send_now',
          targetEmail: email.recipient_email,
          emailAccountId: email.email_account_id || selectedEmailAccountId || null,
          subject: email.subject,
          body: email.body_html || email.body_text || '',
          emailType: email.email_type,
          includeSignature: false,
        }),
      });
      const payload = (await response.json()) as { error?: string; to?: string };
      if (!response.ok) throw new Error(payload.error || 'Failed to resend email');
      setSelectedEmail(null);
      toast.success(`Email resent to ${payload.to || email.recipient_email}.`);
      await loadLead({ silent: true });
    } catch (resendError: unknown) {
      toast.error(resendError instanceof Error ? resendError.message : 'Failed to resend email');
    } finally {
      setSending(false);
    }
  };

  const handleSaveLead = async () => {
    setSaving(true);
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
          manual_email_type: manualEmailType,
          manual_email_approved: false,
          manual_personalization_status: form.manual_email_subject || manualEmailBodyText ? 'drafted' : 'not_started',
          reply_outcome: form.reply_outcome || null,
        }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error || 'Failed to save lead');
      toast.success('Lead changes saved.');
      await loadLead({ silent: true });
    } catch (saveError: unknown) {
      toast.error(saveError instanceof Error ? saveError.message : 'Failed to save lead');
    } finally {
      setSaving(false);
    }
  };

  const handleApproveManualEmail = async () => {
    setSaving(true);
    try {
      const response = await fetch(`/api/leads/${leadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          manual_email_approved: true,
          manual_email_type: manualEmailType,
          manual_personalization_status: 'approved',
          status: form.manual_email_subject || manualEmailBodyText ? 'email_approved' : form.status,
          company_name: form.company_name || form.company,
          company: form.company || form.company_name,
          last_manual_email_account_id: selectedEmailAccountId || null,
        }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error || 'Failed to approve manual email');
      toast.success('Manual email approved.');
      await loadLead({ silent: true });
    } catch (approveError: unknown) {
      toast.error(approveError instanceof Error ? approveError.message : 'Failed to approve manual email');
    } finally {
      setSaving(false);
    }
  };

  const handleAutoResearch = async () => {
    setSaving(true);
    try {
      const response = await fetch(`/api/leads/${leadId}/auto-research`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ offers, companyContext }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Failed to auto-research lead');
      
      toast.success('Website scraped and AI research complete!');
      
      // Update form state directly to avoid needing a full reload if they are editing
      setForm((current) => ({
        ...current,
        ai_company_summary: payload.result.company_summary || current.ai_company_summary,
        pain_points: payload.result.pain_points || current.pain_points,
        solution: payload.result.solution_angle || current.solution,
        ai_solution_angle: payload.result.solution_angle || current.ai_solution_angle,
        recommended_offer: payload.result.recommended_offer || current.recommended_offer,
      }));
      
      await loadLead({ silent: true });
    } catch (researchError: unknown) {
      toast.error(researchError instanceof Error ? researchError.message : 'Failed to auto-research');
    } finally {
      setSaving(false);
    }
  };

  const handleEnrichLead = async () => {
    setSaving(true);
    try {
      const response = await fetch('/api/enrich', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          target: form.website || form.email || lead?.website || lead?.email || '', 
          leadId: leadId, 
          isAdminPool: false 
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Failed to enrich lead');
      
      toast.success('Deep enrichment complete!');
      await loadLead({ silent: true });
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Failed to enrich lead');
    } finally {
      setSaving(false);
    }
  };

  const handleGenerateAi = async (requestedDepth?: 'none' | 'basic' | 'standard' | 'deep', requestedMode?: string) => {
    if (requestedDepth === 'deep') {
      const confirmed = await confirm({
        title: 'Use a Deep AI request?',
        description: 'Deep AI runs a more thorough analysis and counts against your limit of 20 requests per day.',
        confirmLabel: 'Run Deep AI',
      });
      if (!confirmed) return;
    }
    setSaving(true);
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
      toast.success('AI draft refreshed.');
      setActiveTab('intelligence');
      await loadLead({ silent: true });
    } catch (generateError: unknown) {
      toast.error(generateError instanceof Error ? generateError.message : 'Failed to generate AI');
    } finally {
      setSaving(false);
    }
  };

  const handleSendManual = async (mode: 'test' | 'send_now') => {
    if (mode === 'send_now') {
      const recipient = targetEmail || lead?.email || 'this lead';
      const confirmed = await confirm({
        title: 'Send this email?',
        description: `Send this ${getLeadStatusLabel(manualEmailType)} to ${recipient}?`,
        confirmLabel: 'Send Now',
      });
      if (!confirmed) return;
    }

    setSending(true);
    try {
      const sendRequest = async (confirmVerificationRisk = false) =>
        fetch(`/api/leads/${leadId}/manual-send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mode,
            targetEmail,
            emailAccountId: selectedEmailAccountId || null,
            subject: form.manual_email_subject,
            body: form.manual_email_body,
            emailType: manualEmailType,
            includeSignature,
            confirmVerificationRisk,
          }),
        });

      let response = await sendRequest(false);
      let payload = (await response.json()) as {
        error?: string;
        to?: string;
        requiresConfirmation?: boolean;
        warning?: { message?: string };
      };

      if (mode === 'send_now' && response.status === 409 && payload.requiresConfirmation) {
        const confirmedRisk = await confirm({
          title: 'Send despite warning?',
          description: payload.warning?.message || payload.error || 'This email has a verification warning. Send anyway?',
          confirmLabel: 'Send Anyway',
          tone: 'danger',
        });
        if (!confirmedRisk) {
          toast.info('Send canceled.');
          return;
        }

        response = await sendRequest(true);
        payload = (await response.json()) as {
          error?: string;
          to?: string;
          requiresConfirmation?: boolean;
          warning?: { message?: string };
        };
      }

      if (!response.ok) throw new Error(payload.error || 'Failed to send email');
      toast.success(mode === 'test' ? `Test email sent to ${payload.to}.` : 'Email sent successfully.');
      setActiveTab('history');
      await loadLead({ silent: true });
    } catch (sendError: unknown) {
      toast.error(sendError instanceof Error ? sendError.message : 'Failed to send email');
    } finally {
      setSending(false);
    }
  };

  const handleInsertTemplate = () => {
    const template = templateOptions.find((item) => item.id === selectedTemplateId);
    if (!template) {
      toast.error('Select a template to insert.');
      return;
    }

    const leadForVariables = { ...lead, ...form } as Partial<Lead>;
    setForm((current) => ({
      ...current,
      manual_email_subject: applyTemplateVariables(template.subject || '', leadForVariables),
      manual_email_body: normalizeDraftHtml(applyTemplateVariables(template.body || '', leadForVariables)),
      manual_email_approved: false,
    }));
    toast.success(`Template inserted: ${template.name}`);
  };

  const handleSkipAi = async () => {
    setSaving(true);
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
      toast.info('This lead has poor data. AI skipped to save credits.');
      await loadLead({ silent: true });
    } catch (skipError: unknown) {
      toast.error(skipError instanceof Error ? skipError.message : 'Failed to skip AI');
    } finally {
      setSaving(false);
    }
  };

  const handleMarkDoNotContact = async () => {
    if (!(await confirm({
      title: 'Mark as do not contact?',
      description: 'This lead will be excluded from all future sends and follow-ups.',
      confirmLabel: 'Mark Do Not Contact',
      tone: 'danger',
    }))) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/leads/${leadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          status: 'do_not_contact',
          company_name: form.company_name || form.company,
          company: form.company || form.company_name,
          last_manual_email_account_id: selectedEmailAccountId || null,
          manual_email_type: manualEmailType,
          manual_email_approved: form.manual_email_approved,
        }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error || 'Failed to update lead');
      toast.success('Lead marked do not contact.');
      await loadLead({ silent: true });
    } catch (markError: unknown) {
      toast.error(markError instanceof Error ? markError.message : 'Failed to mark lead do not contact');
    } finally {
      setSaving(false);
    }
  };

  const handleVerifyEmail = async () => {
    if (!lead?.id) return;

    setVerifyingEmail(true);
    try {
      const response = await fetch('/api/leads/verify-bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lead_ids: [lead.id],
          checkMx: true,
        }),
      });
      const payload = (await response.json()) as { error?: string; summary?: { total?: number } };
      if (!response.ok) throw new Error(payload.error || 'Failed to verify email');

      await loadLead({ silent: true });
      toast.success('Email verification refreshed.');
    } catch (verifyError: unknown) {
      toast.error(verifyError instanceof Error ? verifyError.message : 'Failed to verify email');
    } finally {
      setVerifyingEmail(false);
    }
  };

  const handleDeleteLead = async () => {
    const leadLabel = lead?.company_name || lead?.company || lead?.email || 'this lead';
    const confirmed = await confirm({
      title: 'Delete lead?',
      description: `Delete ${leadLabel}? This cannot be undone.`,
      confirmLabel: 'Delete Lead',
      tone: 'danger',
    });
    if (!confirmed) return;

    setSaving(true);
    try {
      const response = await fetch(`/api/leads/${leadId}`, {
        method: 'DELETE',
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error || 'Failed to delete lead');
      router.push(backHref);
      router.refresh();
    } catch (deleteError: unknown) {
      toast.error(deleteError instanceof Error ? deleteError.message : 'Failed to delete lead');
    } finally {
      setSaving(false);
    }
  };

  const handleAddToCampaign = async () => {
    if (!selectedCampaignId) {
      toast.warning('Select a campaign before adding this lead.');
      return;
    }

    setSaving(true);
    try {
      const response = await fetch('/api/lead-campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadIds: [leadId], campaignId: selectedCampaignId }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error || 'Failed to add lead to campaign');
      toast.success('Lead added to campaign.');
      await loadLead({ silent: true });
    } catch (campaignError: unknown) {
      toast.error(campaignError instanceof Error ? campaignError.message : 'Failed to add lead to campaign');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell showSearch={false}>
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6 rounded-2xl border border-[var(--border)] bg-white p-5 shadow-[0_12px_40px_rgba(15,23,42,0.04)]">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <Link href={backHref} className="mt-1 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--border)] bg-violet-50 text-violet-600 transition hover:border-violet-200 hover:bg-violet-100">
                <ArrowLeft className="h-5 w-5" />
              </Link>
              <div className="min-w-0">
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-600">{backLabel}</div>
                <h2 className="mt-1 truncate text-2xl font-semibold text-zinc-950">{lead?.company_name || lead?.company || title}</h2>
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-zinc-600">
                  <span>{leadName}</span>
                  <span>{lead?.email || 'No email'}</span>
                  {lead?.email ? <EmailVerificationBadge status={lead.email_verification_status} /> : null}
                  {lead?.website ? (
                    <a href={normalizeWebsite(lead.website)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-violet-700 hover:text-violet-800">
                      Website <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  ) : null}
                </div>
                {lead?.email ? (
                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-500">
                    <span>
                      Reason: <span className="font-medium text-zinc-700">{lead.email_verification_reason || 'Not checked yet'}</span>
                    </span>
                    <span>
                      Verified: <span className="font-medium text-zinc-700">{formatDate(lead.email_verified_at)}</span>
                    </span>
                  </div>
                ) : null}
                <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-500">{subtitle}</p>
              </div>
            </div>

            {lead && (
              <div className="flex flex-col gap-3 xl:items-end">
                <div className="flex flex-wrap gap-2 xl:justify-end">
                  <StatusBadge status={lead.status} />
                  <span className="inline-flex rounded-full bg-amber-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-amber-700 ring-1 ring-amber-100">
                    {lead.priority || 'normal'} priority
                  </span>
                  <span className="inline-flex rounded-full bg-violet-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-violet-700 ring-1 ring-violet-100">
                    {lead.data_quality_score ?? '-'} quality
                  </span>
                  <span className="inline-flex rounded-full bg-teal-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-teal-700 ring-1 ring-teal-100">
                    {lead.emails_sent_count || 0} emails sent
                  </span>
                </div>
                <div className="grid gap-2 text-xs text-zinc-500 sm:grid-cols-2 xl:text-right">
                  <div>Last contacted: <span className="font-medium text-zinc-800">{formatDate(lead.last_email_sent_at || lead.last_contacted_at || lead.last_contacted)}</span></div>
                  <div>Next follow-up: <span className="font-medium text-zinc-800">{formatDate(lead.next_follow_up_at || lead.next_follow_up_date)}</span></div>
                </div>
                <div className="flex flex-wrap gap-2 xl:justify-end">
                  <button onClick={() => setActiveTab('overview')} className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-50">
                    <Edit3 className="h-3.5 w-3.5" /> Edit Lead
                  </button>
                  <button onClick={handleVerifyEmail} disabled={verifyingEmail || !lead?.email} className="inline-flex items-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-semibold text-violet-700 transition hover:bg-violet-100 disabled:cursor-not-allowed disabled:opacity-50">
                    <CheckCircle2 className="h-3.5 w-3.5" /> {verifyingEmail ? 'Verifying...' : 'Verify Email'}
                  </button>
                  <button onClick={() => setActiveTab('manual')} className="inline-flex items-center gap-2 rounded-xl bg-zinc-950 px-3 py-2 text-xs font-semibold text-white transition hover:bg-zinc-800">
                    <Mail className="h-3.5 w-3.5" /> Write Manual Email
                  </button>
                  <div className="flex min-w-[220px] overflow-hidden rounded-xl border border-[var(--border)] bg-white">
                    <select value={selectedCampaignId} onChange={(e) => setSelectedCampaignId(e.target.value)} className="min-w-0 flex-1 bg-white px-3 py-2 text-xs text-zinc-700 outline-none">
                      {campaignOptions.length === 0 ? <option value="">No campaigns</option> : campaignOptions.map((campaign) => <option key={campaign.id} value={campaign.id}>{campaign.name}</option>)}
                    </select>
                    <button onClick={handleAddToCampaign} disabled={saving || !selectedCampaignId} className="inline-flex items-center gap-1 border-l border-[var(--border)] px-3 py-2 text-xs font-semibold text-violet-700 transition hover:bg-violet-50 disabled:opacity-50">
                      <PlusCircle className="h-3.5 w-3.5" /> Add
                    </button>
                  </div>
                  <button onClick={handleMarkDoNotContact} disabled={saving} className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 disabled:opacity-50">
                    <Ban className="h-3.5 w-3.5" /> Do Not Contact
                  </button>
                  <button onClick={handleDeleteLead} disabled={saving} className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-white px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-50 disabled:opacity-50">
                    <Trash2 className="h-3.5 w-3.5" /> Delete Lead
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>


        {isInitialLoading ? (
          <div className="flex h-64 items-center justify-center rounded-3xl border border-[var(--border)] bg-white">
            <Spinner size={32} className="text-violet-500" />
          </div>
        ) : lead ? (
          <div className="space-y-6">
            <div className="rounded-3xl border border-[var(--border)] bg-white p-2 shadow-[0_12px_40px_rgba(15,23,42,0.04)]">
              <div className="flex gap-2 overflow-x-auto">
                {TABS.map((tab) => {
                  const Icon = tab.icon;
                  const active = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`inline-flex min-w-max items-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                        active ? 'bg-violet-50 text-violet-700 ring-1 ring-violet-100' : 'bg-white text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {activeTab === 'overview' && (
              <div className="grid gap-6 xl:grid-cols-[1.5fr_0.85fr]">
                <div className="rounded-3xl border border-[var(--border)] bg-white p-6 shadow-[0_12px_40px_rgba(15,23,42,0.04)]">
                  <div className="mb-5 flex flex-col gap-3 border-b border-[var(--border)] pb-4 sm:flex-row sm:items-center sm:justify-between">
                    <h3 className="text-base font-semibold text-zinc-950">Overview</h3>
                    <button onClick={handleSaveLead} disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-teal-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-95 disabled:opacity-50">
                      {saving ? <Spinner size={16} className="text-white" /> : <Save className="h-4 w-4" />}
                      {saving ? 'Saving...' : 'Save Lead'}
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
                    ].map(({ key, label, multi }) => (
                      <div key={key} className={multi ? 'md:col-span-2' : ''}>
                        <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">{label}</label>
                        {multi ? (
                          <textarea value={form[key as keyof typeof form] as string} onChange={(e) => setForm((current) => ({ ...current, [key]: e.target.value }))} rows={3} className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 text-sm text-zinc-900 outline-none transition focus:border-violet-300 focus:ring-2 focus:ring-violet-100" />
                        ) : (
                          <input value={form[key as keyof typeof form] as string} onChange={(e) => setForm((current) => ({ ...current, [key]: e.target.value }))} className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 text-sm text-zinc-900 outline-none transition focus:border-violet-300 focus:ring-2 focus:ring-violet-100" />
                        )}
                      </div>
                    ))}
                    <div className="md:col-span-2">
                      <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 font-bold text-violet-600">Recommended Offer / Service</label>
                      <select
                        value={form.recommended_offer}
                        onChange={(e) => setForm((current) => ({ ...current, recommended_offer: e.target.value }))}
                        className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 text-sm text-zinc-900 outline-none transition focus:border-violet-300 focus:ring-2 focus:ring-violet-100"
                      >
                        <option value="">-- Select or type below --</option>
                        {offers.map((offer) => (
                          <option key={offer.id} value={offer.name}>{offer.name} {offer.description ? `(${offer.description})` : ''}</option>
                        ))}
                      </select>
                      <input
                        value={form.recommended_offer}
                        onChange={(e) => setForm((current) => ({ ...current, recommended_offer: e.target.value }))}
                        placeholder="Or type custom offer here..."
                        className="mt-2 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 text-sm text-zinc-900 outline-none transition focus:border-violet-300 focus:ring-2 focus:ring-violet-100"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">Status</label>
                      <input value={form.status} onChange={(e) => setForm((current) => ({ ...current, status: e.target.value }))} className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 text-sm text-zinc-900 outline-none transition focus:border-violet-300 focus:ring-2 focus:ring-violet-100" />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">Priority</label>
                      <select value={form.priority} onChange={(e) => setForm((current) => ({ ...current, priority: e.target.value }))} className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 text-sm text-zinc-900 outline-none transition focus:border-violet-300 focus:ring-2 focus:ring-violet-100">
                        <option value="low">Low</option>
                        <option value="normal">Normal</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                      </select>
                    </div>
                    <div className="md:col-span-2">
                      <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 font-bold text-violet-600">Next Follow-up Reminder & Snooze</label>
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                        <input
                          type="datetime-local"
                          value={form.next_follow_up_at}
                          onChange={(e) => setForm((current) => ({ ...current, next_follow_up_at: e.target.value }))}
                          className="flex-1 rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 text-sm text-zinc-900 outline-none transition focus:border-violet-300 focus:ring-2 focus:ring-violet-100"
                        />
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              const d = new Date();
                              d.setDate(d.getDate() + 1);
                              setForm((current) => ({ ...current, next_follow_up_at: d.toISOString().substring(0, 16) }));
                              toast.info('Snoozed 1 day. Click "Save Lead" to persist.');
                            }}
                            className="rounded-xl border border-violet-200 bg-violet-50 px-3.5 py-2.5 text-xs font-semibold text-violet-700 transition hover:bg-violet-100"
                          >
                            +1 Day
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const d = new Date();
                              d.setDate(d.getDate() + 3);
                              setForm((current) => ({ ...current, next_follow_up_at: d.toISOString().substring(0, 16) }));
                              toast.info('Snoozed 3 days. Click "Save Lead" to persist.');
                            }}
                            className="rounded-xl border border-violet-200 bg-violet-50 px-3.5 py-2.5 text-xs font-semibold text-violet-700 transition hover:bg-violet-100"
                          >
                            +3 Days
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setForm((current) => ({ ...current, next_follow_up_at: '' }));
                              toast.info('Follow-up cleared. Click "Save Lead" to persist.');
                            }}
                            className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-100"
                          >
                            Clear
                          </button>
                        </div>
                      </div>
                    </div>
                    <div className="md:col-span-2">
                      <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">Notes</label>
                      <textarea value={form.notes} onChange={(e) => setForm((current) => ({ ...current, notes: e.target.value }))} rows={4} className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 text-sm text-zinc-900 outline-none transition focus:border-violet-300 focus:ring-2 focus:ring-violet-100" />
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="rounded-3xl border border-[var(--border)] bg-white p-6 shadow-[0_12px_40px_rgba(15,23,42,0.04)]">
                    <h3 className="mb-4 text-base font-semibold text-zinc-950">Quick Facts</h3>
                    <div className="space-y-3 text-sm">
                      <div className="flex items-start justify-between gap-4 rounded-2xl bg-[var(--surface-muted)] px-4 py-3"><span className="text-zinc-500">Company</span><span className="text-right font-medium text-zinc-900">{lead.company_name || lead.company || '-'}</span></div>
                      <div className="flex items-start justify-between gap-4 rounded-2xl bg-[var(--surface-muted)] px-4 py-3"><span className="text-zinc-500">Email</span><span className="text-right font-medium text-zinc-900">{lead.email}</span></div>
                      <div className="flex items-start justify-between gap-4 rounded-2xl bg-[var(--surface-muted)] px-4 py-3"><span className="text-zinc-500">Website</span><span className="text-right font-medium text-zinc-900">{lead.website ? <a href={normalizeWebsite(lead.website)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-violet-700 hover:text-violet-800">Visit <ExternalLink className="h-3.5 w-3.5" /></a> : <span>-</span>}</span></div>
                      <div className="flex items-start justify-between gap-4 rounded-2xl bg-[var(--surface-muted)] px-4 py-3"><span className="text-zinc-500">Last Contacted</span><span className="text-right font-medium text-zinc-900">{formatDate(lead.last_email_sent_at || lead.last_contacted_at || lead.last_contacted)}</span></div>
                    </div>
                  </div>

                  <div className="rounded-3xl border border-[var(--border)] bg-white p-6 shadow-[0_12px_40px_rgba(15,23,42,0.04)]">
                    <h3 className="mb-4 text-base font-semibold text-zinc-950">Outreach Status</h3>
                    <div className="space-y-3 text-sm">
                      <div className="flex items-start justify-between gap-4 rounded-2xl bg-[var(--surface-muted)] px-4 py-3"><span className="text-zinc-500">Status</span><span className="text-right font-medium text-zinc-900">{getLeadStatusLabel(lead.status)}</span></div>
                      <div className="flex items-start justify-between gap-4 rounded-2xl bg-[var(--surface-muted)] px-4 py-3"><span className="text-zinc-500">Reply status</span><span className="text-right font-medium text-zinc-900">{lead.reply_status || 'no_reply'}</span></div>
                      <div className="flex items-start justify-between gap-4 rounded-2xl bg-[var(--surface-muted)] px-4 py-3"><span className="text-zinc-500">Next follow-up</span><span className="text-right font-medium text-zinc-900">{formatDate(lead.next_follow_up_at || lead.next_follow_up_date)}</span></div>
                      <div className="flex items-start justify-between gap-4 rounded-2xl bg-[var(--surface-muted)] px-4 py-3"><span className="text-zinc-500">Tags</span><span className="text-right font-medium text-zinc-900">{lead.tags || '-'}</span></div>
                      <div className="flex items-start justify-between gap-4 rounded-2xl bg-[var(--surface-muted)] px-4 py-3"><span className="text-zinc-500">Notes</span><span className="text-right font-medium text-zinc-900">{lead.notes || '-'}</span></div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'intelligence' && (
              <div className="grid gap-6 xl:grid-cols-[1.35fr_0.95fr]">
                <div className="rounded-3xl border border-[var(--border)] bg-white p-6 shadow-[0_12px_40px_rgba(15,23,42,0.04)]">
                  <div className="mb-5 flex flex-col gap-3 border-b border-[var(--border)] pb-4 sm:flex-row sm:items-center sm:justify-between">
                    <h3 className="text-base font-semibold text-zinc-950">Lead Intelligence</h3>
                    <div className="flex flex-wrap gap-2">
                      <button onClick={handleAutoResearch} disabled={saving || !lead?.website} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-95 disabled:opacity-50">
                        {saving ? <Spinner size={16} className="text-white" /> : <Sparkles className="h-4 w-4" />}
                        {saving ? 'Researching...' : 'Auto-Research Lead'}
                      </button>
                      <button onClick={handleEnrichLead} disabled={saving || !(lead?.website || lead?.email)} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-95 disabled:opacity-50">
                        {saving ? <Spinner size={16} className="text-white" /> : <Database className="h-4 w-4" />}
                        {saving ? 'Enriching...' : 'Deep Enrich Lead'}
                      </button>
                      <button onClick={handleSaveLead} disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-zinc-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:opacity-50">
                        <Save className="h-4 w-4" /> Save
                      </button>
                      <button onClick={() => navigator.clipboard.writeText(leadSummary)} className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-white px-4 py-2.5 text-sm font-semibold text-zinc-700 transition hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700">
                        <Copy className="h-4 w-4" /> Copy Summary
                      </button>
                      <button onClick={() => navigator.clipboard.writeText(leadContextPrompt)} className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-white px-4 py-2.5 text-sm font-semibold text-zinc-700 transition hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700">
                        <Copy className="h-4 w-4" /> Copy AI Prompt
                      </button>
                    </div>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    {[
                      ['pain_points', 'Pain Point'],
                      ['ai_solution_angle', 'Solution Angle'],
                      ['recommended_offer', 'Recommended Offer'],
                    ].map(([key, label]) => (
                      <div key={key} className="md:col-span-2">
                        <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">{label}</label>
                        <textarea value={form[key as keyof typeof form] as string} onChange={(e) => setForm((current) => ({ ...current, [key]: e.target.value }))} rows={3} className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 text-sm text-zinc-900 outline-none transition focus:border-violet-300 focus:ring-2 focus:ring-violet-100" />
                      </div>
                    ))}
                    {[
                      ['ai_company_summary', 'Company Summary'],
                      ['ai_lead_analysis', 'Lead Analysis'],
                      ['ai_outreach_strategy', 'Outreach Strategy'],
                      ['ai_personalized_first_line', 'Personalized First Line'],
                    ].map(([key, label]) => (
                      <div key={key} className={key === 'ai_personalized_first_line' ? 'md:col-span-2' : ''}>
                        <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">{label}</label>
                        <textarea value={form[key as keyof typeof form] as string} onChange={(e) => setForm((current) => ({ ...current, [key]: e.target.value }))} rows={4} className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 text-sm text-zinc-900 outline-none transition focus:border-violet-300 focus:ring-2 focus:ring-violet-100" />
                      </div>
                    ))}
                  </div>
                  
                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    {[
                      ['ceo_name', 'CEO / Founder'],
                      ['industry', 'Industry'],
                      ['employee_count', 'Employee Count'],
                      ['year_founded', 'Year Founded'],
                      ['funding_stage', 'Funding Stage'],
                      ['total_raised', 'Total Raised'],
                      ['tech_stack', 'Tech Stack'],
                    ].map(([key, label]) => (
                      <div key={key} className={key === 'tech_stack' ? 'md:col-span-2' : ''}>
                        <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">{label}</label>
                        <input value={form[key as keyof typeof form] as string} onChange={(e) => setForm((current) => ({ ...current, [key]: e.target.value }))} className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 text-sm text-zinc-900 outline-none transition focus:border-violet-300 focus:ring-2 focus:ring-violet-100" />
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-3xl border border-[var(--border)] bg-white p-6 shadow-[0_12px_40px_rgba(15,23,42,0.04)]">
                  <h3 className="mb-4 text-base font-semibold text-zinc-950">AI Actions</h3>
                  <div className="space-y-2">
                    <button onClick={() => handleGenerateAi('basic', 'basic_ai')} disabled={saving} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet-600 to-teal-500 px-4 py-3 text-sm font-semibold text-white transition hover:opacity-95 disabled:opacity-50">
                      <Sparkles className="h-4 w-4" /> Generate Basic AI
                    </button>
                    <button onClick={() => handleGenerateAi('standard', 'standard_ai')} disabled={saving} className="flex w-full items-center justify-center gap-2 rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-sm font-semibold text-zinc-700 transition hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700">
                      <Sparkles className="h-4 w-4 text-teal-500" /> Generate Standard AI
                    </button>
                    <button onClick={() => handleGenerateAi('deep', 'deep_ai')} disabled={saving} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-3 text-sm font-semibold text-white transition hover:opacity-95">
                      <Sparkles className="h-4 w-4" /> Generate Deep AI
                    </button>
                    <button onClick={() => handleGenerateAi('none', 'template_only')} disabled={saving} className="flex w-full items-center justify-center gap-2 rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-sm font-semibold text-zinc-700 transition hover:border-teal-200 hover:bg-teal-50 hover:text-teal-700">
                      <Database className="h-4 w-4 text-teal-500" /> Use Template Only
                    </button>
                    <button onClick={handleSkipAi} className="flex w-full items-center justify-center gap-2 rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-sm font-semibold text-zinc-700 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700">
                      <X className="h-4 w-4 text-rose-500" /> Skip AI
                    </button>
                  </div>
                  <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                    This will use a Deep AI request. You have only 20/day. Flash Lite is recommended for bulk personalization.
                  </div>
                  <div className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] p-3 text-xs leading-5 text-zinc-600">
                    Data quality: <span className="font-semibold text-zinc-900">{lead.data_quality_label || 'unknown'}</span>
                    {lead.ai_usage_notes ? <div>{lead.ai_usage_notes}</div> : null}
                    {lead.processing_error ? <div className="text-rose-700">{lead.processing_error}</div> : null}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'raw-data' && (
              <div className="rounded-3xl border border-[var(--border)] bg-white p-6 shadow-[0_12px_40px_rgba(15,23,42,0.04)]">
                <div className="mb-4 flex items-center justify-between border-b border-[var(--border)] pb-3">
                  <h3 className="text-base font-semibold text-zinc-950">Raw Data</h3>
                  <button onClick={() => navigator.clipboard.writeText(JSON.stringify(lead.raw_data || {}, null, 2))} className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-white px-4 py-2.5 text-sm font-semibold text-zinc-700 transition hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700">
                    <Copy className="h-4 w-4" /> Copy Raw Data
                  </button>
                </div>
                <div className="max-h-[560px] overflow-auto rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)]">
                  <table className="w-full text-left text-xs">
                    <tbody className="divide-y divide-[var(--border)]">
                      {Object.entries(lead.raw_data || {})
                        .filter(([, value]) => value !== null && value !== undefined && value !== '')
                        .map(([key, value]) => (
                          <tr key={key}>
                            <td className="w-56 px-3 py-2 font-semibold text-zinc-500">{key}</td>
                            <td className="px-3 py-2 text-zinc-900">{String(value)}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === 'manual' && (
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
                        <button onClick={() => handleSendManual('test')} disabled={sending} className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-white px-4 py-2.5 text-sm font-semibold text-zinc-700 transition hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700 disabled:opacity-50">
                          {sending ? <Spinner size={16} className="text-violet-600" /> : <Send className="h-4 w-4" />}
                          {sending ? 'Sending...' : 'Send Test'}
                        </button>
                        <button onClick={() => handleSendManual('send_now')} disabled={sending} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-95 disabled:opacity-50">
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
                          <select value={selectedEmailAccountId} onChange={(e) => setSelectedEmailAccountId(e.target.value)} className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 text-sm text-zinc-900 outline-none transition focus:border-violet-300 focus:ring-2 focus:ring-violet-100">
                            <option value="">Use default</option>
                            {emailAccounts.map((account) => <option key={account.id} value={account.id}>{account.sender_name || account.email_address}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">To Email</label>
                          <input value={targetEmail} onChange={(e) => setTargetEmail(e.target.value)} className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 text-sm text-zinc-900 outline-none transition focus:border-violet-300 focus:ring-2 focus:ring-violet-100" />
                        </div>
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">Email Type</label>
                        <select value={manualEmailType} onChange={(e) => setManualEmailType(e.target.value as (typeof EMAIL_TYPES)[number])} className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 text-sm text-zinc-900 outline-none transition focus:border-violet-300 focus:ring-2 focus:ring-violet-100">
                          {EMAIL_TYPES.map((emailType) => <option key={emailType} value={emailType}>{getLeadStatusLabel(emailType)}</option>)}
                        </select>
                      </div>
                      <div className="grid gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] p-4 md:grid-cols-[1fr_auto]">
                        <div>
                          <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">Template</label>
                          <select value={selectedTemplateId} onChange={(e) => setSelectedTemplateId(e.target.value)} className="w-full rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-sm text-zinc-900 outline-none transition focus:border-violet-300 focus:ring-2 focus:ring-violet-100">
                            <option value="">Select a template</option>
                            {templateOptions.map((template) => (
                              <option key={template.id} value={template.id}>{template.name} {template.category ? `- ${template.category}` : ''}</option>
                            ))}
                          </select>
                        </div>
                        <button onClick={handleInsertTemplate} disabled={!selectedTemplateId} className="self-end rounded-2xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-violet-700 disabled:opacity-50">
                          Insert Template
                        </button>
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">Subject</label>
                        <input value={form.manual_email_subject} onChange={(e) => setForm((current) => ({ ...current, manual_email_subject: e.target.value }))} className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 text-sm text-zinc-900 outline-none transition focus:border-violet-300 focus:ring-2 focus:ring-violet-100" />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">Body</label>
                        <RichTextEditor value={form.manual_email_body} onChange={(value) => setForm((current) => ({ ...current, manual_email_body: value }))} placeholder="Write a polished email. Use the toolbar to bold text, add lists, or insert links." className="mt-1" />
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
                              onChange={(e) => setIncludeSignature(e.target.checked)}
                              className="rounded border-zinc-300 text-violet-600 focus:ring-violet-500"
                            />
                            Append on send
                          </label>
                        </div>
                        {selectedSendSignatureHtml && includeSignature && (
                          <div className="mt-4 rounded-2xl border border-[var(--border)] bg-white p-4 text-sm text-zinc-900">
                            <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-400">Preview</div>
                            <div dangerouslySetInnerHTML={{ __html: selectedSendSignatureHtml }} />
                          </div>
                        )}
                      </div>
                      <div className="grid gap-4 lg:grid-cols-[1fr_0.8fr]">
                        <div className="flex flex-wrap gap-2">
                          <button onClick={handleSaveLead} disabled={saving} className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-white px-4 py-2.5 text-sm font-semibold text-zinc-700 transition hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700 disabled:opacity-50">
                            <Save className="h-4 w-4" /> Save Draft
                          </button>
                          <button onClick={handleApproveManualEmail} disabled={saving} className="inline-flex items-center gap-2 rounded-xl border border-teal-200 bg-teal-50 px-4 py-2.5 text-sm font-semibold text-teal-700 transition hover:bg-teal-100 disabled:opacity-50">
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
                          DNS & Sending Domain Authentication Guidance
                        </div>
                        <p className="text-xs text-violet-800/80 leading-relaxed">
                          To protect domain reputation and avoid spam folders, verify that your sending domain has correct **SPF**, **DKIM**, and **DMARC** records set up in your DNS provider (e.g. Cloudflare, GoDaddy). If using custom SMTP, matching tracking records with custom bounce domains prevents SPF alignment errors.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'history' && (
              <div className="rounded-3xl border border-[var(--border)] bg-white p-6 shadow-[0_12px_40px_rgba(15,23,42,0.04)]">
                <div className="mb-5 flex flex-col gap-3 border-b border-[var(--border)] pb-4 sm:flex-row sm:items-center sm:justify-between">
                  <h3 className="text-base font-semibold text-zinc-950">Email History</h3>
                  <div className="flex items-center gap-3">
                    {refreshing && (
                      <span className="inline-flex items-center gap-2 rounded-full bg-violet-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-violet-700 ring-1 ring-violet-100">
                        <span className="h-2 w-2 animate-spin rounded-full border border-violet-400 border-t-transparent" />
                        Refreshing
                      </span>
                    )}
                    <span className="text-xs text-zinc-500">{lead.sent_emails?.length || 0} emails</span>
                  </div>
                </div>
                {refreshing && <div className="mb-4 rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 text-sm text-zinc-600">Refreshing email history...</div>}
                {(lead.sent_emails || []).length === 0 ? (
                  <div className="rounded-3xl border border-dashed border-[var(--border)] bg-[var(--surface-muted)] p-8 text-center">
                    <div className="text-sm font-semibold text-zinc-950">No sent emails yet</div>
                    <p className="mt-2 text-sm text-zinc-500">Send a manual email or run a campaign step and the sent messages will appear here.</p>
                  </div>
                ) : (
                  <>
                    <div className="hidden overflow-x-auto lg:block">
                      <table className="min-w-[1100px] w-full text-left text-sm">
                        <thead className="border-b border-[var(--border)] text-xs uppercase tracking-[0.18em] text-zinc-400">
                          <tr>
                            <th className="px-3 py-3">Sent At</th>
                            <th className="px-3 py-3">Type</th>
                            <th className="px-3 py-3">Sender</th>
                            <th className="px-3 py-3">Recipient</th>
                            <th className="px-3 py-3">Subject</th>
                            <th className="px-3 py-3">Status</th>
                            <th className="px-3 py-3">Provider</th>
                            <th className="px-3 py-3">Signals</th>
                            <th className="px-3 py-3">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--border)]">
                          {(lead.sent_emails || []).map((email) => (
                            <tr key={email.id} className="cursor-pointer transition hover:bg-violet-50/50" onClick={() => setSelectedEmail(email)}>
                              <td className="px-3 py-3 text-zinc-600">{formatDate(email.sent_at)}</td>
                              <td className="px-3 py-3 text-zinc-600">{getLeadStatusLabel(email.email_type)}</td>
                              <td className="px-3 py-3 text-zinc-600">{email.sender_email}</td>
                              <td className="px-3 py-3 text-zinc-600">{email.recipient_email}</td>
                              <td className="px-3 py-3 font-medium text-zinc-900">{email.subject}</td>
                              <td className="px-3 py-3"><StatusBadge status={email.status} /></td>
                              <td className="px-3 py-3 text-zinc-600">{email.provider}</td>
                              <td className="px-3 py-3">
                                <div className="flex flex-wrap gap-1">
                                  {(email.opened_at || email.clicked_at) && <Badge tone="sky">Opened</Badge>}
                                  {email.clicked_at && <Badge tone="indigo">Clicked</Badge>}
                                  {email.replied_at && <Badge tone="emerald">Replied</Badge>}
                                  {email.bounced_at && <Badge tone="rose">Bounced</Badge>}
                                  {!email.opened_at && !email.clicked_at && !email.replied_at && !email.bounced_at && (
                                    <span className="text-xs text-zinc-400">—</span>
                                  )}
                                </div>
                              </td>
                              <td className="px-3 py-3">
                                <div className="flex flex-wrap gap-2">
                                  <button onClick={(event) => { event.stopPropagation(); setSelectedEmail(email); }} className="rounded-lg border border-[var(--border)] bg-white px-2.5 py-1.5 text-xs font-semibold text-zinc-700 transition hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700">View</button>
                                  <button onClick={(event) => { event.stopPropagation(); copySentEmail(email); }} className="rounded-lg border border-[var(--border)] bg-white px-2.5 py-1.5 text-xs font-semibold text-zinc-700 transition hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700">Copy</button>
                                  <button onClick={(event) => { event.stopPropagation(); handleUseEmailAsFollowUpContext(email); }} className="rounded-lg border border-[var(--border)] bg-white px-2.5 py-1.5 text-xs font-semibold text-zinc-700 transition hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700">Follow-up</button>
                                  <button onClick={(event) => { event.stopPropagation(); handleResendEmail(email); }} disabled={sending} className="rounded-lg border border-teal-200 bg-teal-50 px-2.5 py-1.5 text-xs font-semibold text-teal-700 transition hover:bg-teal-100 disabled:opacity-50">Resend</button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="grid gap-4 lg:hidden">
                      {(lead.sent_emails || []).map((email) => (
                        <div key={email.id} onClick={() => setSelectedEmail(email)} className="cursor-pointer rounded-3xl border border-[var(--border)] bg-[var(--surface-muted)] p-4 text-left transition hover:border-violet-200 hover:bg-violet-50/50">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="text-sm font-semibold text-zinc-950">{email.subject}</div>
                              <div className="mt-1 text-xs text-zinc-500">{formatDate(email.sent_at)} · {getLeadStatusLabel(email.email_type)}</div>
                            </div>
                            <StatusBadge status={email.status} />
                          </div>
                          <div className="mt-3 grid gap-1 text-sm text-zinc-600">
                            <div><span className="font-medium text-zinc-900">From:</span> {email.sender_email}</div>
                            <div><span className="font-medium text-zinc-900">To:</span> {email.recipient_email}</div>
                            <div><span className="font-medium text-zinc-900">Provider:</span> {email.provider}</div>
                          </div>
                          <div className="mt-4 flex flex-wrap gap-2">
                            <button onClick={(event) => { event.stopPropagation(); setSelectedEmail(email); }} className="rounded-lg border border-[var(--border)] bg-white px-2.5 py-1.5 text-xs font-semibold text-zinc-700">View</button>
                            <button onClick={(event) => { event.stopPropagation(); copySentEmail(email); }} className="rounded-lg border border-[var(--border)] bg-white px-2.5 py-1.5 text-xs font-semibold text-zinc-700">Copy</button>
                            <button onClick={(event) => { event.stopPropagation(); handleUseEmailAsFollowUpContext(email); }} className="rounded-lg border border-[var(--border)] bg-white px-2.5 py-1.5 text-xs font-semibold text-zinc-700">Follow-up</button>
                            <button onClick={(event) => { event.stopPropagation(); handleResendEmail(email); }} disabled={sending} className="rounded-lg border border-teal-200 bg-teal-50 px-2.5 py-1.5 text-xs font-semibold text-teal-700 disabled:opacity-50">Resend</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {activeTab === 'replies' && (
              <div className="rounded-3xl border border-[var(--border)] bg-white p-6 shadow-[0_12px_40px_rgba(15,23,42,0.04)]">
                <div className="mb-5 flex flex-col gap-3 border-b border-[var(--border)] pb-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="text-base font-semibold text-zinc-950">Replies</h3>
                    <p className="mt-1 text-sm text-zinc-500">Read inbound replies captured from Mailgun or IMAP reply detection.</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={handleCheckRepliesNow}
                      disabled={refreshing || checkingReplies}
                      className="inline-flex items-center gap-2 rounded-xl border border-teal-200 bg-teal-50 px-3 py-2 text-xs font-semibold text-teal-700 transition hover:bg-teal-100 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Clock3 className={`h-3.5 w-3.5 ${refreshing || checkingReplies ? 'animate-spin' : ''}`} />
                      {checkingReplies ? 'Checking inbox...' : refreshing ? 'Refreshing...' : 'Check inbox'}
                    </button>
                    {refreshing && (
                      <span className="inline-flex items-center gap-2 rounded-full bg-violet-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-violet-700 ring-1 ring-violet-100">
                        <span className="h-2 w-2 animate-spin rounded-full border border-violet-400 border-t-transparent" />
                        Refreshing
                      </span>
                    )}
                    <span className="rounded-full bg-teal-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-teal-700 ring-1 ring-teal-100">
                      {replyEvents.length} replies
                    </span>
                  </div>
                </div>

                {/* Reply Outcome Classifier Box */}
                <div className="mb-6 rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                      <div className="text-sm font-semibold text-zinc-950">Reply Outcome Classification</div>
                      <p className="text-xs text-zinc-500 mt-1">Classify the prospect's interest level manually for tracking.</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <select
                        value={form.reply_outcome}
                        onChange={(e) => setForm((current) => ({ ...current, reply_outcome: e.target.value }))}
                        className="rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-xs text-zinc-950 outline-none focus:border-violet-500"
                      >
                        <option value="">-- Unclassified --</option>
                        <option value="Interested">Interested</option>
                        <option value="Not interested">Not interested</option>
                        <option value="Asked for details">Asked for details</option>
                        <option value="Demo requested">Demo requested</option>
                        <option value="Proposal requested">Proposal requested</option>
                      </select>
                      <button
                        onClick={handleSaveLead}
                        disabled={saving}
                        className="rounded-xl bg-violet-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-violet-700 transition"
                      >
                        Save Outcome
                      </button>
                    </div>
                  </div>
                </div>

                {replyEvents.length === 0 ? (
                  <div className="rounded-3xl border border-dashed border-[var(--border)] bg-[var(--surface-muted)] p-8 text-center">
                    <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-50 text-violet-700">
                      <MessageSquare className="h-5 w-5" />
                    </div>
                    <div className="text-sm font-semibold text-zinc-950">No replies captured yet</div>
                    <p className="mt-2 text-sm text-zinc-500">When a lead replies, the message will appear here and future follow-ups will stop automatically.</p>
                  </div>
                ) : (
                  <div className="grid gap-4">
                    {replyEvents.map((reply) => {
                      const replyBody = getReplyBodyText(reply);
                      return (
                        <article key={reply.id} className="rounded-3xl border border-[var(--border)] bg-[var(--surface-muted)] p-5">
                          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="rounded-full bg-violet-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-violet-700 ring-1 ring-violet-100">
                                  Reply received
                                </span>
                                <span className="text-xs text-zinc-500">{formatDate(reply.createdAt)}</span>
                              </div>
                              <h4 className="mt-3 text-base font-semibold text-zinc-950">{reply.subject}</h4>
                              <div className="mt-2 grid gap-1 text-sm text-zinc-600">
                                <div><span className="font-medium text-zinc-900">From:</span> {reply.sender || lead?.email || 'Unknown sender'}</div>
                                {reply.recipient && <div><span className="font-medium text-zinc-900">To:</span> {reply.recipient}</div>}
                                <div><span className="font-medium text-zinc-900">Source:</span> {reply.source.replace(/_/g, ' ')}</div>
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <button onClick={() => copyReply(reply)} className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-xs font-semibold text-zinc-700 transition hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700">
                                <Copy className="h-3.5 w-3.5" /> Copy Reply
                              </button>
                              <button onClick={() => handleUseReplyAsFollowUpContext(reply)} className="inline-flex items-center gap-2 rounded-xl border border-teal-200 bg-teal-50 px-3 py-2 text-xs font-semibold text-teal-700 transition hover:bg-teal-100">
                                <Edit3 className="h-3.5 w-3.5" /> Use as Follow-up
                              </button>
                            </div>
                          </div>
                          <pre className="mt-4 max-h-[420px] overflow-auto whitespace-pre-wrap rounded-2xl border border-[var(--border)] bg-white p-4 text-sm leading-6 text-zinc-800">
                            {replyBody || 'Reply body was not stored for this event. New inbound webhook replies will include the full message body.'}
                          </pre>
                        </article>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'timeline' && (
              <div className="rounded-3xl border border-[var(--border)] bg-white p-6 shadow-[0_12px_40px_rgba(15,23,42,0.04)]">
                <div className="mb-5 flex items-center justify-between border-b border-[var(--border)] pb-4">
                  <h3 className="text-base font-semibold text-zinc-950">Timeline</h3>
                  <span className="text-xs text-zinc-500">{timeline.length} events</span>
                </div>
                <div className="grid gap-3">
                  {timeline.map((item) => (
                    <div key={item.id} className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="font-semibold text-zinc-950">{item.title}</div>
                          <div className="mt-1 text-sm leading-6 text-zinc-600">{item.message}</div>
                        </div>
                        <div className="text-xs text-zinc-500">{formatDate(eventTimestamp(item))}</div>
                      </div>
                      {item.metadata && Object.keys(item.metadata).length > 0 && (
                        <pre className="mt-3 overflow-x-auto rounded-2xl bg-white p-3 text-[11px] text-zinc-600">{JSON.stringify(item.metadata, null, 2)}</pre>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-3xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">
            <div className="font-semibold text-rose-800">Lead could not be loaded</div>
            <p className="mt-2 text-rose-700/80">Please go back and try again.</p>
          </div>
        )}

        {selectedEmail && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm sm:p-6">
            <div className="max-h-[90vh] w-full max-w-3xl overflow-auto rounded-3xl border border-[var(--border)] bg-white p-6 shadow-2xl">
              <div className="mb-4 flex items-start justify-between gap-4 border-b border-[var(--border)] pb-4">
                <div>
                  <h3 className="text-lg font-semibold text-zinc-950">{selectedEmail.subject}</h3>
                  <p className="mt-1 text-sm text-zinc-500">{selectedEmail.sender_email} to {selectedEmail.recipient_email}</p>
                </div>
                <button onClick={() => setSelectedEmail(null)} className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] text-zinc-500 transition hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="mb-4 flex flex-wrap gap-2">
                <StatusBadge status={selectedEmail.status} />
                <span className="rounded-full bg-violet-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-violet-700 ring-1 ring-violet-100">
                  {getLeadStatusLabel(selectedEmail.email_type)}
                </span>
                <span className="rounded-full bg-teal-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-teal-700 ring-1 ring-teal-100">
                  {selectedEmail.provider}
                </span>
              </div>
              <div className="mb-4 flex flex-wrap gap-2">
                <button onClick={() => copySentEmail(selectedEmail)} className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-xs font-semibold text-zinc-700 transition hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700">
                  <Copy className="h-3.5 w-3.5" /> Copy Email
                </button>
                <button onClick={() => copyPreviousEmailPrompt(selectedEmail)} className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-xs font-semibold text-zinc-700 transition hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700">
                  <Copy className="h-3.5 w-3.5" /> Copy Follow-up Prompt
                </button>
                <button onClick={() => handleUseEmailAsFollowUpContext(selectedEmail)} className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-xs font-semibold text-zinc-700 transition hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700">
                  <Edit3 className="h-3.5 w-3.5" /> Use as Follow-up Context
                </button>
                <button onClick={() => handleResendEmail(selectedEmail)} disabled={sending} className="inline-flex items-center gap-2 rounded-xl border border-teal-200 bg-teal-50 px-3 py-2 text-xs font-semibold text-teal-700 transition hover:bg-teal-100 disabled:opacity-50">
                  <Send className="h-3.5 w-3.5" /> Resend
                </button>
              </div>
              {selectedEmail.body_html ? (
                <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface-muted)] p-5 text-sm text-zinc-900">
                  <div dangerouslySetInnerHTML={{ __html: selectedEmail.body_html }} />
                </div>
              ) : (
                <pre className="whitespace-pre-wrap rounded-3xl border border-[var(--border)] bg-[var(--surface-muted)] p-5 text-sm leading-6 text-zinc-900">
                  {selectedEmail.body_text || htmlToPlainText(selectedEmail.body_html || '') || 'No body available.'}
                </pre>
              )}
            </div>
          </div>
        )}
      </div>
      {confirmDialog}
    </AppShell>
  );
}
