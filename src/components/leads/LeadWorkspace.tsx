'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Ban, CheckCircle2, Database, Edit3, ExternalLink, History, Mail, MessageSquare, PlusCircle, Send, Sparkles, WandSparkles, Clock3, Trash2 } from 'lucide-react';
import AppShell from '@/components/reachmira/AppShell';
import Spinner from '@/components/reachmira/Spinner';
import { Badge, useConfirm } from '@/components/reachmira/ui';
import EmailVerificationBadge from '@/components/leads/EmailVerificationBadge';
import StatusBadge from '@/components/leads/StatusBadge';
import { buildFollowUpPrompt, buildLeadContextPrompt, buildLeadSummary, type CompanyPromptContext } from '@/lib/leads/context-prompt';
import { htmlToPlainText, normalizeDraftHtml } from '@/lib/email/html';
import { checkEmailQuality, hasBlockingEmailQualityIssue } from '@/lib/email/check-email-quality';
import { buildEmailSignatureHtml, buildSendSignatureHtml } from '@/lib/email/signature';
import { applyTemplateVariables } from '@/lib/templates/template-helpers';
import { EMAIL_TYPES, getLeadStatusLabel } from '@/lib/leads/status';
import { createClient } from '@/utils/supabase/client';
import { useToast } from '@/lib/toast/toast-context';
import type { AuditLog, EmailAccount, Lead, SentEmail } from '@/types/database.types';
import { normalizeWebsite, formatDate, eventTimestamp, escapeHtml, metadataString, metadataRecord, isReplyAction, getReplyBodyText } from '@/components/leads/workspace/utils';
import TimelinePanel from '@/components/leads/workspace/TimelinePanel';
import RawDataPanel from '@/components/leads/workspace/RawDataPanel';
import EmailHistoryPanel from '@/components/leads/workspace/EmailHistoryPanel';
import SentEmailModal from '@/components/leads/workspace/SentEmailModal';
import IntelligencePanel from '@/components/leads/workspace/IntelligencePanel';
import OverviewPanel from '@/components/leads/workspace/OverviewPanel';
import RepliesPanel from '@/components/leads/workspace/RepliesPanel';
import ManualEmailPanel from '@/components/leads/workspace/ManualEmailPanel';

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
              <OverviewPanel
                form={form}
                setForm={setForm}
                offers={offers}
                saving={saving}
                lead={lead}
                onSaveLead={handleSaveLead}
              />
            )}

            {activeTab === 'intelligence' && (
              <IntelligencePanel
                form={form}
                setForm={setForm}
                saving={saving}
                lead={lead}
                leadSummary={leadSummary}
                leadContextPrompt={leadContextPrompt}
                onAutoResearch={handleAutoResearch}
                onEnrichLead={handleEnrichLead}
                onSaveLead={handleSaveLead}
                onGenerateAi={handleGenerateAi}
                onSkipAi={handleSkipAi}
              />
            )}

            {activeTab === 'raw-data' && <RawDataPanel rawData={lead.raw_data || {}} />}

            {activeTab === 'manual' && (
              <ManualEmailPanel
                lead={lead}
                leadName={leadName}
                form={form}
                setForm={setForm}
                leadContextPrompt={leadContextPrompt}
                followUpPrompt={followUpPrompt}
                leadSummary={leadSummary}
                manualEmailBodyText={manualEmailBodyText}
                sending={sending}
                saving={saving}
                selectedEmailAccountId={selectedEmailAccountId}
                onSelectedEmailAccountIdChange={setSelectedEmailAccountId}
                emailAccounts={emailAccounts}
                targetEmail={targetEmail}
                onTargetEmailChange={setTargetEmail}
                manualEmailType={manualEmailType}
                onManualEmailTypeChange={setManualEmailType}
                templateOptions={templateOptions}
                selectedTemplateId={selectedTemplateId}
                onSelectedTemplateIdChange={setSelectedTemplateId}
                onInsertTemplate={handleInsertTemplate}
                includeSignature={includeSignature}
                onIncludeSignatureChange={setIncludeSignature}
                selectedSignatureHtml={selectedSignatureHtml}
                selectedSendSignatureHtml={selectedSendSignatureHtml}
                selectedEmailAccount={selectedEmailAccount}
                onSendManual={handleSendManual}
                onSaveLead={handleSaveLead}
                onApproveManualEmail={handleApproveManualEmail}
                sendChecklist={sendChecklist}
                emailQualityIssues={emailQualityIssues}
                emailVerificationIssues={emailVerificationIssues}
              />
            )}

            {activeTab === 'history' && (
              <EmailHistoryPanel
                sentEmails={lead.sent_emails || []}
                refreshing={refreshing}
                sending={sending}
                onSelectEmail={setSelectedEmail}
                onCopyEmail={copySentEmail}
                onUseAsFollowUp={handleUseEmailAsFollowUpContext}
                onResend={handleResendEmail}
              />
            )}

            {activeTab === 'replies' && (
              <RepliesPanel
                replyEvents={replyEvents}
                refreshing={refreshing}
                checkingReplies={checkingReplies}
                onCheckRepliesNow={handleCheckRepliesNow}
                replyOutcome={form.reply_outcome}
                onReplyOutcomeChange={(value) => setForm((current) => ({ ...current, reply_outcome: value }))}
                saving={saving}
                onSaveOutcome={handleSaveLead}
                leadEmail={lead?.email}
                onCopyReply={copyReply}
                onUseAsFollowUp={handleUseReplyAsFollowUpContext}
              />
            )}

            {activeTab === 'timeline' && <TimelinePanel timeline={timeline} />}
          </div>
        ) : (
          <div className="rounded-3xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">
            <div className="font-semibold text-rose-800">Lead could not be loaded</div>
            <p className="mt-2 text-rose-700/80">Please go back and try again.</p>
          </div>
        )}

        <SentEmailModal
          email={selectedEmail}
          sending={sending}
          onClose={() => setSelectedEmail(null)}
          onCopyEmail={copySentEmail}
          onCopyFollowUpPrompt={copyPreviousEmailPrompt}
          onUseAsFollowUp={handleUseEmailAsFollowUpContext}
          onResend={handleResendEmail}
        />
      </div>
      {confirmDialog}
    </AppShell>
  );
}
