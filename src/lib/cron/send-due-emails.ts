import 'server-only';

import { createServiceClient } from '@/utils/supabase/service';
import { claimLeadsForEmailSending, getAvailableSendCapacity, getCampaignDailySendCount, incrementDailySentCount } from '@/lib/queue/queue';
import { sendEmail } from '@/lib/mailers/send-email';
import { createAuditLog } from '@/lib/audit/create-audit-log';
import { getStatusForEmailType, type EmailType } from '@/lib/leads/status';
import { getSuppressionForEmail } from '@/lib/suppressions';
import type { EmailProviderType } from '@/types/email-provider';

type CronResult = {
  campaignId: string;
  sent: number;
  skipped: number;
  failed: number;
  reasons: string[];
};

type SequenceStep = {
  id: string;
  step_number: number;
  delay_days: number;
  subject: string;
  body: string;
};

function isSupportedProvider(provider: string): provider is EmailProviderType {
  return ['smtp', 'mailgun', 'resend', 'amazon_ses'].includes(provider);
}

type QueueLead = {
  id: string;
  email: string;
  first_name?: string | null;
  last_name?: string | null;
  decision_maker_name?: string | null;
  company?: string | null;
  company_name?: string | null;
  website?: string | null;
  industry?: string | null;
  decision_maker_title?: string | null;
  pain_points?: string | null;
  solution?: string | null;
  ai_solution_angle?: string | null;
  ai_personalized_first_line?: string | null;
  ai_personalization?: string | null;
  unsubscribe_token: string;
  current_step?: number | null;
  emails_sent_count?: number | null;
  ai_status?: string | null;
  approval_status?: string | null;
  ai_subject?: string | null;
  personalized_subject?: string | null;
  ai_email_body?: string | null;
  personalized_body?: string | null;
  variables?: Record<string, unknown> | null;
};

function interpolateTemplate(template: string, lead: QueueLead): string {
  let text = template;
  const firstName =
    lead.first_name ||
    lead.decision_maker_name?.split(' ')[0] ||
    String(lead.variables?.first_name ?? '') ||
    String(lead.variables?.['first name'] ?? '') ||
    String(lead.variables?.firstname ?? '') ||
    lead.email.split('@')[0];
  const lastName =
    lead.last_name ||
    lead.decision_maker_name?.split(' ').slice(1).join(' ') ||
    String(lead.variables?.last_name ?? '') ||
    String(lead.variables?.['last name'] ?? '') ||
    String(lead.variables?.lastname ?? '') ||
    '';
  const company = lead.company_name || lead.company || '';

  text = text
    .replace(/\{\{first_name\}\}/g, firstName || '')
    .replace(/\{\{last_name\}\}/g, lastName || '')
    .replace(/\{\{company\}\}/g, company)
    .replace(/\{\{company_name\}\}/g, company)
    .replace(/\{\{website\}\}/g, lead.website || '')
    .replace(/\{\{industry\}\}/g, lead.industry || '')
    .replace(/\{\{decision_maker_title\}\}/g, lead.decision_maker_title || '')
    .replace(/\{\{pain_points\}\}/g, lead.pain_points || '')
    .replace(/\{\{solution\}\}/g, lead.solution || '')
    .replace(/\{\{solution_angle\}\}/g, lead.ai_solution_angle || '')
    .replace(/\{\{personalized_first_line\}\}/g, lead.ai_personalized_first_line || '')
    .replace(/\{\{email\}\}/g, lead.email || '')
    .replace(/\{\{ai_personalization\}\}/g, lead.ai_personalized_first_line || lead.ai_personalization || '');

  if (lead.variables && typeof lead.variables === 'object') {
    Object.entries(lead.variables).forEach(([key, val]) => {
      text = text.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), String(val ?? ''));
    });
  }

  return text;
}

function buildEmailHtml(body: string, unsubscribeUrl: string): string {
  const escapedUnsubscribe = unsubscribeUrl.replace(/"/g, '&quot;');
  const footer = `<hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" /><p style="font-size:12px;color:#6b7280;">If you do not wish to receive further emails, you can unsubscribe <a href="${escapedUnsubscribe}">here</a>.</p>`;
  return `${body}${footer}`;
}

export async function sendDueEmails() {
  const supabase = createServiceClient();
  const batchLimit = 10;
  const perCampaignLimit = 5;
  const summary: CronResult[] = [];
  let totalSent = 0;

  const { data: campaigns, error } = await supabase
    .from('campaigns')
    .select('id, user_id, name, sender_name, status, daily_limit, require_approval_before_send, allow_template_fallback, email_account_id, email_accounts (id, provider, email_address, sender_name, config, daily_send_limit, daily_sent_count, last_sent_reset_date, status)')
    .eq('status', 'active')
    .not('email_account_id', 'is', null);

  if (error) {
    throw new Error(error.message);
  }

  for (const campaign of campaigns || []) {
    if (totalSent >= batchLimit) {
      break;
    }

    const emailAccount = Array.isArray(campaign.email_accounts)
      ? campaign.email_accounts[0]
      : campaign.email_accounts;

    if (!emailAccount) {
      summary.push({ campaignId: campaign.id, sent: 0, skipped: 0, failed: 0, reasons: ['Missing email account'] });
      continue;
    }

    if (!isSupportedProvider(emailAccount.provider)) {
      summary.push({ campaignId: campaign.id, sent: 0, skipped: 0, failed: 0, reasons: [`Unsupported provider: ${emailAccount.provider}`] });
      continue;
    }

    if (emailAccount.status !== 'active') {
      summary.push({ campaignId: campaign.id, sent: 0, skipped: 0, failed: 0, reasons: ['Email account inactive'] });
      continue;
    }

    const campaignDailySent = await getCampaignDailySendCount(campaign.id);
    const campaignRemaining = Math.max(0, (campaign.daily_limit || 0) - campaignDailySent);
    if (campaignRemaining <= 0) {
      summary.push({ campaignId: campaign.id, sent: 0, skipped: 0, failed: 0, reasons: ['Campaign daily limit reached'] });
      continue;
    }

    const accountRemaining = await getAvailableSendCapacity(emailAccount.id);
    if (accountRemaining <= 0) {
      summary.push({ campaignId: campaign.id, sent: 0, skipped: 0, failed: 0, reasons: ['Email account daily limit reached'] });
      continue;
    }

    const maxForThisCampaign = Math.min(perCampaignLimit, batchLimit - totalSent, campaignRemaining, accountRemaining);
    const dueLeads = await claimLeadsForEmailSending(campaign.id, maxForThisCampaign);
    if (dueLeads.length === 0) {
      summary.push({ campaignId: campaign.id, sent: 0, skipped: 0, failed: 0, reasons: ['No due leads'] });
      continue;
    }

    const { data: sequences } = await supabase
      .from('sequences')
      .select('id, step_number, delay_days, subject, body')
      .eq('campaign_id', campaign.id)
      .order('step_number', { ascending: true });

    const sequenceByStep = new Map<number, SequenceStep>((sequences || []).map((seq) => [seq.step_number, seq]));
    let sent = 0;
    let skipped = 0;
    let failed = 0;
    const reasons: string[] = [];

    for (const lead of dueLeads as QueueLead[]) {
      if (totalSent >= batchLimit || sent >= perCampaignLimit) {
        break;
      }

      const currentStep = Number(lead.current_step || 0);
      const isFirstEmail = currentStep <= 0;
      const nextStepNumber = isFirstEmail ? 1 : currentStep + 1;
      const sequence = sequenceByStep.get(nextStepNumber) || sequenceByStep.get(1);

      if (!sequence) {
        skipped++;
        reasons.push(`Lead ${lead.email}: missing sequence step ${nextStepNumber}`);
        continue;
      }

      let subject = '';
      let body = '';

      if (isFirstEmail) {
        const aiApproved =
          lead.ai_status === 'approved' ||
          lead.approval_status === 'approved' ||
          Boolean((lead as { manual_email_approved?: boolean }).manual_email_approved);
        const aiSubject = lead.ai_subject || lead.personalized_subject || '';
        const aiBody = lead.ai_email_body || lead.personalized_body || '';
        const hasAiCopy = Boolean(aiSubject && aiBody);

        if (campaign.require_approval_before_send && !aiApproved) {
          if (campaign.allow_template_fallback && !hasAiCopy) {
            subject = interpolateTemplate(sequence.subject, lead);
            body = interpolateTemplate(sequence.body, lead);
          } else {
            skipped++;
            reasons.push(`Lead ${lead.email}: waiting for approval`);
            continue;
          }
        } else if (hasAiCopy) {
          subject = aiSubject;
          body = aiBody;
        } else if (campaign.allow_template_fallback) {
          subject = interpolateTemplate(sequence.subject, lead);
          body = interpolateTemplate(sequence.body, lead);
        } else {
          skipped++;
          reasons.push(`Lead ${lead.email}: missing AI copy`);
          continue;
        }
      } else {
        subject = interpolateTemplate(sequence.subject, lead);
        body = interpolateTemplate(sequence.body, lead);
      }

      const unsubscribeUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/unsubscribe?token=${lead.unsubscribe_token}`;
      const html = buildEmailHtml(body, unsubscribeUrl);
      const replyTo = emailAccount.email_address;
      const suppression = await getSuppressionForEmail(campaign.user_id, lead.email);

      if (suppression) {
        skipped++;
        reasons.push(`Lead ${lead.email}: suppressed (${suppression.reason || 'suppressed'})`);
        continue;
      }

      const sendResult = await sendEmail(emailAccount.provider, emailAccount.config || {}, {
        to: lead.email,
        fromName: emailAccount.sender_name || campaign.sender_name || emailAccount.email_address,
        fromEmail: emailAccount.email_address,
        replyTo,
        subject,
        html,
        text: body,
        campaignId: campaign.id,
        leadId: lead.id,
        stepNumber: nextStepNumber,
        metadata: {
          campaign_name: campaign.name,
          unsubscribe_url: unsubscribeUrl,
        },
      });

      if (!sendResult.success) {
        failed++;
        reasons.push(`Lead ${lead.email}: ${sendResult.error || 'Send failed'}`);
        await supabase
          .from('leads')
          .update({
            processing_error: sendResult.error || 'Send failed',
            updated_at: new Date().toISOString(),
          })
          .eq('id', lead.id);
        continue;
      }

      const nextSequence = sequenceByStep.get(nextStepNumber + 1);
      const nextEmailAt = nextSequence
        ? new Date(Date.now() + Number(nextSequence.delay_days || 0) * 24 * 60 * 60 * 1000).toISOString()
        : null;

      const emailType = (nextStepNumber <= 1 ? 'first_email' : `follow_up_${Math.min(nextStepNumber - 1, 3)}`) as EmailType;
      const nowIso = new Date().toISOString();

      await supabase.from('sent_emails').insert({
        user_id: campaign.user_id,
        campaign_id: campaign.id,
        lead_id: lead.id,
        email_account_id: emailAccount.id,
        sequence_id: sequence.id,
        provider: emailAccount.provider,
        recipient_email: lead.email,
        sender_email: emailAccount.email_address,
        sender_name: emailAccount.sender_name || campaign.sender_name || null,
        subject,
        body_html: html,
        body_text: body,
        email_type: emailType,
        step_number: nextStepNumber,
        provider_message_id: sendResult.messageId || null,
        status: 'sent',
        sent_by: 'automation',
        sent_at: nowIso,
        raw_provider_response: {
          ...((sendResult.raw && typeof sendResult.raw === 'object') ? sendResult.raw as Record<string, unknown> : {}),
          step_number: nextStepNumber,
        },
      });

      await supabase
        .from('leads')
        .update({
          status: getStatusForEmailType(emailType),
          current_step: nextStepNumber,
          last_email_sent_at: nowIso,
          next_email_at: nextEmailAt,
          next_follow_up_at: nextEmailAt,
          last_email_type: emailType,
          last_contacted_at: nowIso,
          emails_sent_count: Number(lead.emails_sent_count || 0) + 1,
          reply_status: 'no_reply',
          updated_at: nowIso,
        })
        .eq('id', lead.id);

      await incrementDailySentCount(emailAccount.id, 1);

      await createAuditLog({
        userId: campaign.user_id,
        campaignId: campaign.id,
        leadId: lead.id,
        action: 'email_sent',
        message: `Email sent to ${lead.email}`,
        metadata: {
          provider: emailAccount.provider,
          messageId: sendResult.messageId || null,
          step_number: nextStepNumber,
        },
      });

      sent++;
      totalSent++;
    }

    summary.push({ campaignId: campaign.id, sent, skipped, failed, reasons });
  }

  return {
    processed: summary.reduce((acc, item) => acc + item.sent + item.skipped + item.failed, 0),
    sent: summary.reduce((acc, item) => acc + item.sent, 0),
    skipped: summary.reduce((acc, item) => acc + item.skipped, 0),
    failed: summary.reduce((acc, item) => acc + item.failed, 0),
    totalSent,
    campaigns: summary,
  };
}
