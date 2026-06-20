import 'server-only';

import { checkSendingLimits } from '@/lib/billing/limits';
import { createServiceClient } from '@/utils/supabase/service';
import { claimLeadsForEmailSending, getAvailableSendCapacity, getCampaignDailySendCount, incrementDailySentCount } from '@/lib/queue/queue';
import { sendEmail } from '@/lib/mailers/send-email';
import { createAuditLog } from '@/lib/audit/create-audit-log';
import { getStatusForEmailType, type EmailType } from '@/lib/leads/status';
import { checkSuppression } from '@/lib/suppression/check-suppression';
import { buildEmailMessageBodies } from '@/lib/email/html';
import { generateTrackingToken, instrumentEmailHtml } from '@/lib/email/tracking';
import { appendEmailSignature } from '@/lib/email/signature';
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
  condition?: string;
};

type SequenceCondition = 'always' | 'opened' | 'not_opened' | 'clicked';

const CONDITION_LABELS: Record<SequenceCondition, string> = {
  always: 'always send',
  opened: 'previous email opened',
  not_opened: 'previous email not opened',
  clicked: 'link in previous email clicked',
};

const BLOCKED_VERIFICATION_STATUSES = new Set(['invalid', 'disposable', 'suppressed']);
const SKIPPED_VERIFICATION_STATUSES = new Set(['not_checked', 'unknown', 'risky', 'failed']);

const VERIFICATION_STATUS_LABELS: Record<string, string> = {
  not_checked: 'not checked',
  valid: 'valid',
  risky: 'risky',
  invalid: 'invalid',
  role_based: 'role-based',
  disposable: 'disposable',
  suppressed: 'suppressed',
  unknown: 'unknown',
  failed: 'failed',
};

function isSupportedProvider(provider: string): provider is EmailProviderType {
  return ['smtp', 'mailgun', 'resend', 'amazon_ses', 'gmail', 'outlook'].includes(provider);
}

function isMissingColumnError(error: { message?: string; code?: string } | null | undefined) {
  const message = String(error?.message || '').toLowerCase();
  return (
    error?.code === '42703' ||
    message.includes('does not exist') ||
    message.includes('undefined column')
  );
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
  email_verification_status?: string | null;
  email_verification_reason?: string | null;
  variables?: Record<string, unknown> | null;
};

function interpolateTemplate(template: string, lead: QueueLead, sender: { name?: string | null; email?: string | null } = {}): string {
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
  const senderName = sender.name || sender.email || '';
  const senderEmail = sender.email || '';

  text = text
    .replace(/\[Your Name\]/g, senderName)
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
    .replace(/\{\{sender_name\}\}/g, senderName)
    .replace(/\{\{from_name\}\}/g, senderName)
    .replace(/\{\{sender_email\}\}/g, senderEmail)
    .replace(/\{\{from_email\}\}/g, senderEmail)
    .replace(/\{\{ai_personalization\}\}/g, lead.ai_personalized_first_line || lead.ai_personalization || '');

  if (lead.variables && typeof lead.variables === 'object') {
    Object.entries(lead.variables).forEach(([key, val]) => {
      text = text.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), String(val ?? ''));
    });
  }

  return text;
}

export async function sendDueEmails() {
  const supabase = createServiceClient();
  const batchLimit = 10;
  const perCampaignLimit = 5;
  const summary: CronResult[] = [];
  let totalSent = 0;

  const campaignSelect =
    'id, user_id, name, sender_name, status, daily_limit, require_approval_before_send, allow_template_fallback, allow_risky_emails, email_account_id, email_accounts (id, provider, email_address, sender_name, config, daily_send_limit, daily_sent_count, last_sent_reset_date, status)';
  const legacyCampaignSelect =
    'id, user_id, name, sender_name, status, daily_limit, require_approval_before_send, allow_template_fallback, email_account_id, email_accounts (id, provider, email_address, sender_name, config, daily_send_limit, daily_sent_count, last_sent_reset_date, status)';

  let campaigns: Array<Record<string, any>> | null = null;
  let error: { message?: string } | null = null;

  const campaignResponse = await supabase
    .from('campaigns')
    .select(campaignSelect)
    .eq('status', 'active')
    .not('email_account_id', 'is', null);

  campaigns = campaignResponse.data as Array<Record<string, any>> | null;
  error = campaignResponse.error as { message?: string } | null;

  if (error && String(error.message || '').toLowerCase().includes('allow_risky_emails')) {
    const legacyResponse = await supabase
      .from('campaigns')
      .select(legacyCampaignSelect)
      .eq('status', 'active')
      .not('email_account_id', 'is', null);
    campaigns = legacyResponse.data as Array<Record<string, any>> | null;
    error = legacyResponse.error as { message?: string } | null;
  }

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

    const senderName = emailAccount.sender_name || campaign.sender_name || emailAccount.email_address;
    const senderEmail = emailAccount.email_address;
    const allowRiskyEmails = Boolean((campaign as { allow_risky_emails?: boolean | null }).allow_risky_emails);

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

    const billingLimits = await checkSendingLimits(supabase, campaign.user_id, 1);
    if (!billingLimits.allowed) {
      summary.push({ campaignId: campaign.id, sent: 0, skipped: 0, failed: 0, reasons: [`Billing limit: ${billingLimits.reason}`] });
      continue;
    }

    const maxForThisCampaign = Math.min(perCampaignLimit, batchLimit - totalSent, campaignRemaining, accountRemaining);
    const dueLeads = await claimLeadsForEmailSending(campaign.id, maxForThisCampaign);
    if (dueLeads.length === 0) {
      summary.push({ campaignId: campaign.id, sent: 0, skipped: 0, failed: 0, reasons: ['No due leads'] });
      continue;
    }

    let { data: sequences, error: sequencesError } = await supabase
      .from('sequences')
      .select('id, step_number, delay_days, subject, body, condition')
      .eq('campaign_id', campaign.id)
      .order('step_number', { ascending: true });

    if (sequencesError && isMissingColumnError(sequencesError)) {
      // Databases without the conditions migration behave as 'always'.
      const legacySequencesResponse = await supabase
        .from('sequences')
        .select('id, step_number, delay_days, subject, body')
        .eq('campaign_id', campaign.id)
        .order('step_number', { ascending: true });
      sequences = (legacySequencesResponse.data || []).map((seq) => ({ ...seq, condition: 'always' }));
      sequencesError = legacySequencesResponse.error;
    }

    const sequenceByStep = new Map<number, SequenceStep>((sequences || []).map((seq) => [seq.step_number, seq]));
    let sent = 0;
    let skipped = 0;
    let failed = 0;
    const reasons: string[] = [];

    // Bulk-prefetch all suppressions for this batch in one query instead of
    // one round-trip per lead. Matches on email address OR domain.
    const leadEmails = (dueLeads as QueueLead[]).map((l) => l.email.trim().toLowerCase());
    const leadDomains = [...new Set(leadEmails.map((e) => e.includes('@') ? e.split('@').pop()! : ''))];
    const { data: suppressionRows } = await supabase
      .from('suppressions')
      .select('email, domain, reason')
      .eq('user_id', campaign.user_id)
      .or(`email.in.(${leadEmails.map((e) => `"${e}"`).join(',')}),domain.in.(${leadDomains.filter(Boolean).map((d) => `"${d}"`).join(',')})`);
    const suppressedEmails = new Set(
      (suppressionRows || []).flatMap((r) => [
        r.email?.trim().toLowerCase(),
        r.domain?.trim().toLowerCase(),
      ]).filter(Boolean)
    );

    for (const lead of dueLeads as QueueLead[]) {
      if (totalSent >= batchLimit || sent >= perCampaignLimit) {
        break;
      }

      const emailsSentCount = Number(lead.emails_sent_count || 0);
      const currentStep = Number(lead.current_step || 0);
      const nextStepNumber = emailsSentCount <= 0 ? 1 : currentStep + 1;
      const isFirstEmail = nextStepNumber === 1;
      const sequence = sequenceByStep.get(nextStepNumber);

      if (!sequence) {
        skipped++;
        reasons.push(`Lead ${lead.email}: no sequence step ${nextStepNumber} configured`);
        continue;
      }

      // Conditional follow-ups: gate this step on engagement with the previous
      // email. Step 1 has no previous email, so its condition is ignored.
      const stepCondition = (sequence.condition || 'always') as SequenceCondition;
      if (!isFirstEmail && stepCondition !== 'always') {
        const { data: lastSentEmail } = await supabase
          .from('sent_emails')
          .select('opened_at, clicked_at')
          .eq('lead_id', lead.id)
          .eq('campaign_id', campaign.id)
          .order('sent_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        const wasOpened = Boolean(lastSentEmail?.opened_at || lastSentEmail?.clicked_at);
        const wasClicked = Boolean(lastSentEmail?.clicked_at);
        const conditionMet =
          stepCondition === 'opened' ? wasOpened :
          stepCondition === 'not_opened' ? !wasOpened :
          stepCondition === 'clicked' ? wasClicked :
          true;

        if (!conditionMet) {
          // Skip this step and advance the lead so the sequence never stalls.
          const followingSequence = sequenceByStep.get(nextStepNumber + 1);
          const followingEmailAt = followingSequence
            ? new Date(Date.now() + Number(followingSequence.delay_days || 0) * 24 * 60 * 60 * 1000).toISOString()
            : null;
          const skipIso = new Date().toISOString();

          const { error: skipUpdateError } = await supabase
            .from('leads')
            .update({
              current_step: nextStepNumber,
              next_email_at: followingEmailAt,
              next_follow_up_at: followingEmailAt,
              updated_at: skipIso,
            })
            .eq('id', lead.id);

          if (skipUpdateError && isMissingColumnError(skipUpdateError)) {
            await supabase
              .from('leads')
              .update({ current_step: nextStepNumber, next_email_at: followingEmailAt, updated_at: skipIso })
              .eq('id', lead.id);
          }

          await createAuditLog({
            userId: campaign.user_id,
            campaignId: campaign.id,
            leadId: lead.id,
            action: 'sequence_step_skipped',
            message: `Step ${nextStepNumber} skipped for ${lead.email}: condition "${CONDITION_LABELS[stepCondition]}" not met`,
            metadata: {
              step_number: nextStepNumber,
              condition: stepCondition,
              was_opened: wasOpened,
              was_clicked: wasClicked,
              next_email_at: followingEmailAt,
            },
          });

          skipped++;
          reasons.push(`Lead ${lead.email}: step ${nextStepNumber} skipped (condition '${stepCondition}' not met)`);
          continue;
        }
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
            subject = interpolateTemplate(sequence.subject, lead, { name: senderName, email: senderEmail });
            body = interpolateTemplate(sequence.body, lead, { name: senderName, email: senderEmail });
          } else {
            skipped++;
            reasons.push(`Lead ${lead.email}: waiting for approval`);
            continue;
          }
        } else if (hasAiCopy) {
          subject = interpolateTemplate(aiSubject, lead, { name: senderName, email: senderEmail });
          body = interpolateTemplate(aiBody, lead, { name: senderName, email: senderEmail });
        } else if (campaign.allow_template_fallback) {
          subject = interpolateTemplate(sequence.subject, lead, { name: senderName, email: senderEmail });
          body = interpolateTemplate(sequence.body, lead, { name: senderName, email: senderEmail });
        } else {
          skipped++;
          reasons.push(`Lead ${lead.email}: missing AI copy`);
          continue;
        }
      } else {
        subject = interpolateTemplate(sequence.subject, lead, { name: senderName, email: senderEmail });
        body = interpolateTemplate(sequence.body, lead, { name: senderName, email: senderEmail });
      }

      const appBaseUrl = (() => {
        const url = process.env.NEXT_PUBLIC_APP_URL;
        if (!url && process.env.NODE_ENV === 'production') {
          throw new Error(
            '[send-due-emails] NEXT_PUBLIC_APP_URL is not set. Cannot build unsubscribe URLs — refusing to send emails with broken compliance links.'
          );
        }
        return url || 'http://localhost:3000';
      })();
      const unsubscribeUrl = `${appBaseUrl}/unsubscribe?token=${lead.unsubscribe_token}`;
      const bodyWithSignature = appendEmailSignature(body, emailAccount.config || {}, senderName, true);
      const { html, text } = buildEmailMessageBodies(bodyWithSignature, unsubscribeUrl);
      const trackingToken = generateTrackingToken();
      const trackedHtml = instrumentEmailHtml(html, trackingToken, appBaseUrl);
      const replyTo = emailAccount.email_address;
      const verificationStatus = String((lead as QueueLead & { email_verification_status?: string | null }).email_verification_status || 'not_checked').trim().toLowerCase();
      const verificationReason = String((lead as QueueLead & { email_verification_reason?: string | null }).email_verification_reason || '').trim();

      if (BLOCKED_VERIFICATION_STATUSES.has(verificationStatus)) {
        skipped++;
        reasons.push(`Lead ${lead.email}: blocked by email verification (${VERIFICATION_STATUS_LABELS[verificationStatus] || verificationStatus})`);
        await createAuditLog({
          userId: campaign.user_id,
          campaignId: campaign.id,
          leadId: lead.id,
          action: verificationStatus === 'suppressed' ? 'send_blocked_suppressed' : 'send_blocked_invalid_email',
          message: `Blocked automated email to ${lead.email}`,
          metadata: {
            email: lead.email,
            verification_status: verificationStatus,
            verification_reason: verificationReason || null,
            policy: 'campaign_verification_block',
          },
        });
        continue;
      }

      if (!allowRiskyEmails && SKIPPED_VERIFICATION_STATUSES.has(verificationStatus)) {
        skipped++;
        reasons.push(`Lead ${lead.email}: skipped by email verification (${VERIFICATION_STATUS_LABELS[verificationStatus] || verificationStatus})`);
        await createAuditLog({
          userId: campaign.user_id,
          campaignId: campaign.id,
          leadId: lead.id,
          action: 'send_skipped_email_verification',
          message: `Skipped automated email to ${lead.email}`,
          metadata: {
            email: lead.email,
            verification_status: verificationStatus,
            verification_reason: verificationReason || null,
            allow_risky_emails: allowRiskyEmails,
          },
        });
        continue;
      }

      // Check suppression using the pre-fetched set (email or domain match).
      const normalizedEmail = lead.email.trim().toLowerCase();
      const emailDomain = normalizedEmail.includes('@') ? normalizedEmail.split('@').pop()! : '';
      const isSuppressed = suppressedEmails.has(normalizedEmail) || (emailDomain && suppressedEmails.has(emailDomain));

      if (isSuppressed) {
        skipped++;
        reasons.push(`Lead ${lead.email}: suppressed`);
        await createAuditLog({
          userId: campaign.user_id,
          campaignId: campaign.id,
          leadId: lead.id,
          action: 'send_blocked_suppressed',
          message: `Blocked automated email to ${lead.email}`,
          metadata: {
            email: lead.email,
            reason: 'suppressed',
            matched_on: suppressedEmails.has(normalizedEmail) ? 'email' : 'domain',
          },
        });
        continue;
      }

      const sendResult = await sendEmail(emailAccount.provider, { ...(emailAccount.config || {}), __account_id: emailAccount.id }, {
        to: lead.email,
        fromName: senderName,
        fromEmail: senderEmail,
        replyTo,
        subject,
        html: trackedHtml,
        text,
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

      const modernSentEmailRow = {
        user_id: campaign.user_id,
        campaign_id: campaign.id,
        lead_id: lead.id,
        email_account_id: emailAccount.id,
        sequence_id: sequence.id,
        provider: emailAccount.provider,
        recipient_email: lead.email,
        sender_email: senderEmail,
        sender_name: senderName,
        subject,
        body_html: html,
        body_text: text,
        email_type: emailType,
        step_number: nextStepNumber,
        provider_message_id: sendResult.messageId || null,
        tracking_token: trackingToken,
        status: 'sent',
        sent_by: 'automation',
        sent_at: nowIso,
        raw_provider_response: {
          ...((sendResult.raw && typeof sendResult.raw === 'object') ? sendResult.raw as Record<string, unknown> : {}),
          step_number: nextStepNumber,
        },
      };

      const { error: insertError } = await supabase.from('sent_emails').insert(modernSentEmailRow);
      if (insertError) {
        if (isMissingColumnError(insertError)) {
          const legacyRow = {
            campaign_id: campaign.id,
            lead_id: lead.id,
            email_account_id: emailAccount.id,
            sequence_id: sequence.id,
            provider: emailAccount.provider,
            message_id: sendResult.messageId || null,
            subject,
            status: 'sent',
            sent_at: nowIso,
            metadata: {
              source: 'cron_send_due_emails',
              campaign_name: campaign.name,
              email_type: emailType,
              step_number: nextStepNumber,
              recipient_email: lead.email,
              sender_email: senderEmail,
              sender_name: senderName,
              body_html: html,
              body_text: text,
              raw_provider_response:
                sendResult.raw && typeof sendResult.raw === 'object'
                  ? (sendResult.raw as Record<string, unknown>)
                  : {},
            },
          };

          const { error: legacyInsertError } = await supabase.from('sent_emails').insert(legacyRow);
          if (legacyInsertError) {
            throw legacyInsertError;
          }
        } else {
          throw insertError;
        }
      }

      const leadUpdatePayload = {
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
      };

      const { error: leadUpdateError } = await supabase
        .from('leads')
        .update(leadUpdatePayload)
        .eq('id', lead.id);

      if (leadUpdateError && isMissingColumnError(leadUpdateError)) {
        const legacyLeadUpdatePayload = {
          status: getStatusForEmailType(emailType),
          current_step: nextStepNumber,
          last_email_sent_at: nowIso,
          next_email_at: nextEmailAt,
          updated_at: nowIso,
        };

        const { error: legacyLeadUpdateError } = await supabase
          .from('leads')
          .update(legacyLeadUpdatePayload)
          .eq('id', lead.id);

        if (legacyLeadUpdateError) {
          throw legacyLeadUpdateError;
        }
      } else if (leadUpdateError) {
        throw leadUpdateError;
      }

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
