import { NextResponse } from 'next/server';
import { checkSendingLimits } from '@/lib/billing/limits';
import { createClient } from '@/utils/supabase/server';
import { createServiceClient } from '@/utils/supabase/service';
import { sendEmail } from '@/lib/mailers/send-email';
import { createAuditLog } from '@/lib/audit/create-audit-log';
import { buildEmailMessageBodies } from '@/lib/email/html';
import { generateTrackingToken, instrumentEmailHtml } from '@/lib/email/tracking';
import { appendEmailSignature } from '@/lib/email/signature';
import { checkEmailQuality, hasBlockingEmailQualityIssue } from '@/lib/email/check-email-quality';
import { verifyEmailLocally, type EmailVerificationStatus } from '@/lib/email-verification/local-verify';
import { getStatusForEmailType, isBlockedLeadStatus, type EmailType } from '@/lib/leads/status';
import { isMissingTableError } from '@/lib/supabase/schema-errors';
import { getAvailableSendCapacity, incrementDailySentCount } from '@/lib/queue/queue';
import { checkSuppression } from '@/lib/suppression/check-suppression';
import type { EmailProviderType } from '@/types/email-provider';

function isSupportedProvider(provider: string): provider is EmailProviderType {
  return ['smtp', 'mailgun', 'resend', 'amazon_ses', 'gmail', 'outlook'].includes(provider);
}

function isMissingColumnError(error: { message?: string; code?: string } | null | undefined) {
  const message = String(error?.message || '').toLowerCase();
  return (
    error?.code === '42703' ||
    message.includes('does not exist') ||
    message.includes('undefined column') ||
    message.includes('column') && message.includes('does not exist')
  );
}

function applySenderPlaceholders(text: string, sender: { name?: string | null; email?: string | null }) {
  const senderName = sender.name || sender.email || '';
  const senderEmail = sender.email || '';

  return String(text || '')
    .replace(/\[Your Name\]/g, senderName)
    .replace(/\{\{sender_name\}\}/g, senderName)
    .replace(/\{\{from_name\}\}/g, senderName)
    .replace(/\{\{sender_email\}\}/g, senderEmail)
    .replace(/\{\{from_email\}\}/g, senderEmail);
}

const BLOCKED_VERIFICATION_STATUSES = new Set<EmailVerificationStatus>([
  'invalid',
  'disposable',
  'suppressed',
]);

const WARNING_VERIFICATION_STATUSES = new Set<EmailVerificationStatus>([
  'role_based',
  'risky',
  'unknown',
  'not_checked',
  'failed',
]);

const VERIFICATION_STATUS_LABELS: Record<EmailVerificationStatus, string> = {
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

function normalizeVerificationStatus(value?: string | null): EmailVerificationStatus {
  const candidate = String(value || 'not_checked').trim().toLowerCase() as EmailVerificationStatus;
  if (candidate in VERIFICATION_STATUS_LABELS) {
    return candidate;
  }
  return 'not_checked';
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  const serviceSupabase = createServiceClient();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const {
      mode = 'send_now',
      targetEmail,
      emailAccountId,
      subject,
      body: bodyInput,
      emailType = 'custom_email',
      stepNumber,
      includeSignature = true,
      confirmVerificationRisk = false,
    } = await request.json();
    const { data: lead, error: leadError } = await supabase.from('leads').select('*').eq('id', id).maybeSingle();

    if (leadError || !lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    if (lead.user_id === user.id) {
      // Global library lead owned by the current user.
    } else if (lead.lead_list_id) {
      const { data: list, error: listError } = await supabase.from('lead_lists').select('user_id').eq('id', lead.lead_list_id).single();
      if ((listError && isMissingTableError(listError, 'lead_lists')) || !list || list.user_id !== user.id) {
        if (listError && isMissingTableError(listError, 'lead_lists')) {
          return NextResponse.json(
            { error: 'Lead lists are not available in this database yet. Apply the migration first.' },
            { status: 503 }
          );
        }
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
    } else {
      const { data: camp } = await supabase.from('campaigns').select('user_id').eq('id', lead.campaign_id).single();
      if (!camp || camp.user_id !== user.id) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
    }

    const { data: campaign } = lead.campaign_id
      ? await supabase
          .from('campaigns')
          .select('id, user_id, require_approval_before_send')
          .eq('id', lead.campaign_id)
          .maybeSingle()
      : { data: null };

    if (isBlockedLeadStatus(lead.status)) {
      return NextResponse.json({ error: 'This lead is blocked from sending' }, { status: 400 });
    }

    const recipientEmail = String(targetEmail || lead.email || '').trim().toLowerCase();
    const suppression = await checkSuppression(user.id, recipientEmail);
    if (suppression) {
      await createAuditLog({
        userId: user.id,
        leadId: lead.id,
        campaignId: lead.campaign_id || null,
        action: 'send_blocked_suppressed',
        message: `Blocked manual email to ${recipientEmail}`,
        metadata: {
          email: recipientEmail,
          reason: suppression.reason || 'suppressed',
          matched_on: suppression.matchedOn,
          suppression_id: suppression.id,
        },
      });

      return NextResponse.json(
        { error: `This email is suppressed: ${suppression.reason || 'suppressed'}` },
        { status: 400 }
      );
    }

    if (mode !== 'test') {
      const normalizedLeadEmail = String(lead.email || '').trim().toLowerCase();
      const recipientMatchesLead = Boolean(recipientEmail) && recipientEmail === normalizedLeadEmail;
      const verificationResult = recipientMatchesLead
        ? null
        : await verifyEmailLocally({
            email: recipientEmail,
            userId: user.id,
            checkMx: false,
          });
      const verificationStatus = recipientMatchesLead
        ? normalizeVerificationStatus(lead.email_verification_status)
        : verificationResult?.status || 'failed';
      const verificationReason = recipientMatchesLead
        ? String(lead.email_verification_reason || '').trim() || (verificationStatus === 'not_checked' ? 'Email has not been checked yet.' : 'Email verification requires review.')
        : verificationResult?.reason || 'Email verification failed.';

      if (BLOCKED_VERIFICATION_STATUSES.has(verificationStatus)) {
        await createAuditLog({
          userId: user.id,
          leadId: lead.id,
          campaignId: lead.campaign_id || null,
          action: 'send_blocked_invalid_email',
          message: `Blocked manual email to ${recipientEmail}`,
          metadata: {
            email: recipientEmail,
            verification_status: verificationStatus,
            verification_reason: verificationReason,
            recipient_matches_lead: recipientMatchesLead,
          },
        });

        return NextResponse.json(
          {
            error: `Cannot send to a ${VERIFICATION_STATUS_LABELS[verificationStatus]} email. ${verificationReason}`,
            verificationStatus,
            verificationReason,
          },
          { status: 400 }
        );
      }

      if (WARNING_VERIFICATION_STATUSES.has(verificationStatus) && !confirmVerificationRisk) {
        return NextResponse.json(
          {
            error: `Email verification warning: ${VERIFICATION_STATUS_LABELS[verificationStatus]}.`,
            requiresConfirmation: true,
            warning: {
              status: verificationStatus,
              reason: verificationReason,
              message: `This email is marked ${VERIFICATION_STATUS_LABELS[verificationStatus]}. ${verificationReason} Send anyway?`,
            },
          },
          { status: 409 }
        );
      }
    }

    if (mode !== 'test') {
      const manualApproved = Boolean(lead.manual_email_approved);
      const campaignRequiresApproval = campaign ? campaign.require_approval_before_send !== false : true;

      if (campaignRequiresApproval && !manualApproved) {
        return NextResponse.json(
          { error: 'Approve this manual email before sending.' },
          { status: 400 }
        );
      }
    }

    const accountId = emailAccountId || lead.last_manual_email_account_id || null;
    const { data: emailAccount } = accountId
      ? await supabase
          .from('email_accounts')
          .select('*')
          .eq('id', accountId)
          .eq('user_id', user.id)
          .maybeSingle()
      : await supabase
          .from('email_accounts')
          .select('*')
          .eq('user_id', user.id)
          .eq('status', 'active')
          .order('is_default', { ascending: false })
          .limit(1)
          .maybeSingle();

    if (!emailAccount || !isSupportedProvider(emailAccount.provider)) {
      return NextResponse.json({ error: 'No valid email account available' }, { status: 400 });
    }

    if (emailAccount.status !== 'active') {
      return NextResponse.json({ error: 'Selected email account is inactive' }, { status: 400 });
    }

    if (mode !== 'test') {
      const billingLimits = await checkSendingLimits(serviceSupabase, user.id, 1);
      if (!billingLimits.allowed) {
        return NextResponse.json({ error: billingLimits.reason }, { status: 402 });
      }

      const availableCapacity = await getAvailableSendCapacity(emailAccount.id);
      if (availableCapacity <= 0) {
        return NextResponse.json(
          { error: `Daily send limit reached for ${emailAccount.email_address}` },
          { status: 429 }
        );
      }
    }

    const { data: profile } = await supabase.from('profiles').select('gemini_api_key').eq('id', user.id).single();

    const senderName = emailAccount.sender_name || emailAccount.email_address;
    const senderEmail = emailAccount.email_address;
    const rawEmailSubject =
      subject ||
      lead.manual_email_subject ||
      lead.ai_subject ||
      lead.personalized_subject ||
      `Quick question for ${lead.company_name || lead.company || lead.email}`;
    const rawBaseBody =
      bodyInput ||
      lead.manual_email_body ||
      lead.ai_email_body ||
      lead.personalized_body ||
      `Hi ${lead.decision_maker_name || lead.first_name || 'there'},\n\nThought it might be worth reaching out.\n\nBest,\n${senderName}`;
    const emailSubject = applySenderPlaceholders(rawEmailSubject, { name: senderName, email: senderEmail });
    const baseBody = applySenderPlaceholders(rawBaseBody, { name: senderName, email: senderEmail });

    const qualityIssues = checkEmailQuality({
      subject: emailSubject,
      bodyText: String(baseBody || '').replace(/<[^>]*>/g, ''),
      bodyHtml: String(baseBody || ''),
      lead,
    });

    if (hasBlockingEmailQualityIssue(qualityIssues)) {
      return NextResponse.json(
        { error: qualityIssues.filter((issue) => issue.severity === 'error').map((issue) => issue.message).join(' ') },
        { status: 400 }
      );
    }

    const bodyWithSignature = appendEmailSignature(
      baseBody,
      emailAccount.config || {},
      senderName,
      Boolean(includeSignature)
    );
    const appBaseUrl = process.env.NODE_ENV === 'production'
      ? 'https://reachmira.vercel.app'
      : (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000');
    const unsubscribeUrl = `${appBaseUrl}/unsubscribe?token=${lead.unsubscribe_token}`;
    const { html, text } = buildEmailMessageBodies(bodyWithSignature, unsubscribeUrl);
    const to = mode === 'test' ? targetEmail || user.email || lead.email : recipientEmail || lead.email;

    if (!to || !String(to).includes('@')) {
      return NextResponse.json({ error: 'Recipient email is required' }, { status: 400 });
    }

    // Test sends have no sent_emails row, so there is nothing to track.
    const trackingToken = mode === 'test' ? null : generateTrackingToken();
    const outboundHtml = trackingToken ? instrumentEmailHtml(html, trackingToken, appBaseUrl) : html;

    const result = await sendEmail(emailAccount.provider, { ...(emailAccount.config || {}), __account_id: emailAccount.id }, {
      to,
      fromName: senderName,
      fromEmail: senderEmail,
      replyTo: senderEmail,
      subject: emailSubject,
      html: outboundHtml,
      text,
      leadId: lead.id,
      campaignId: lead.campaign_id || undefined,
      stepNumber: typeof stepNumber === 'number' ? stepNumber : undefined,
      metadata: {
        source: 'manual_send',
        mode,
        lead_list_id: lead.lead_list_id || null,
        email_type: emailType,
      },
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Failed to send email' }, { status: 500 });
    }

    if (mode !== 'test') {
      const nextStatus = getStatusForEmailType(emailType as EmailType);
      const nowIso = new Date().toISOString();
      const followUpDelayDays: Record<EmailType, number | null> = {
        first_email: 3,
        follow_up_1: 4,
        follow_up_2: null,
        follow_up_3: 7,
        custom_email: 3,
        proposal_email: 5,
        demo_follow_up: 7,
        reply_follow_up: null,
      };
      const nextFollowUpDays = followUpDelayDays[emailType as EmailType] ?? null;
      const nextFollowUpAt = nextFollowUpDays
        ? new Date(Date.now() + nextFollowUpDays * 24 * 60 * 60 * 1000).toISOString()
        : null;
      const updatePayload = {
        status: nextStatus,
        manual_email_approved: true,
        manual_email_sent_at: nowIso,
        last_manual_email_account_id: emailAccount.id,
        manual_personalization_status: 'sent',
        last_email_sent_at: nowIso,
        emails_sent_count: Number(lead.emails_sent_count || 0) + 1,
        last_email_type: emailType,
        last_contacted_at: nowIso,
        next_follow_up_at: nextFollowUpAt,
        reply_status: 'no_reply',
        manual_email_type: emailType,
        manual_email_subject: emailSubject,
        manual_email_body: html,
        updated_at: nowIso,
      };

      const { error: updateError } = await serviceSupabase.from('leads').update(updatePayload).eq('id', lead.id);
      if (updateError) {
        if (isMissingColumnError(updateError)) {
          const legacyUpdatePayload = {
            status: nextStatus,
            manual_email_approved: true,
            manual_email_sent_at: nowIso,
            last_manual_email_account_id: emailAccount.id,
            manual_personalization_status: 'sent',
            last_email_sent_at: nowIso,
            manual_email_type: emailType,
            manual_email_subject: emailSubject,
            manual_email_body: html,
            updated_at: nowIso,
          };

          const { error: legacyUpdateError } = await serviceSupabase
            .from('leads')
            .update(legacyUpdatePayload)
            .eq('id', lead.id);

          if (legacyUpdateError) {
            throw legacyUpdateError;
          }
        } else {
          throw updateError;
        }
      }

      const modernSentEmailRow = {
        user_id: user.id,
        campaign_id: lead.campaign_id || null,
        lead_id: lead.id,
        email_account_id: emailAccount.id,
        provider: emailAccount.provider,
        recipient_email: to,
        sender_email: senderEmail,
        sender_name: senderName,
        subject: emailSubject,
        body_html: html,
        body_text: text,
        email_type: emailType,
        step_number: typeof stepNumber === 'number' ? stepNumber : null,
        provider_message_id: result.messageId || null,
        tracking_token: trackingToken,
        status: 'sent',
        sent_by: 'manual',
        sent_at: nowIso,
        raw_provider_response: {
          source: 'manual_send',
          mode,
          to,
          ...(result.raw && typeof result.raw === 'object' ? (result.raw as Record<string, unknown>) : {}),
        },
      };

      const { error: insertError } = await serviceSupabase.from('sent_emails').insert(modernSentEmailRow);
      if (insertError) {
        if (isMissingColumnError(insertError)) {
          const legacyRow = {
            campaign_id: lead.campaign_id || null,
            lead_id: lead.id,
            email_account_id: emailAccount.id,
            sequence_id: null,
            provider: emailAccount.provider,
            message_id: result.messageId || null,
            subject: emailSubject,
            status: 'sent',
            sent_at: nowIso,
            metadata: {
              source: 'manual_send',
              mode,
              email_type: emailType,
              to,
              sender_email: senderEmail,
              sender_name: senderName,
              body_html: html,
              body_text: text,
              step_number: typeof stepNumber === 'number' ? stepNumber : null,
              raw_provider_response:
                result.raw && typeof result.raw === 'object'
                  ? (result.raw as Record<string, unknown>)
                  : {},
            },
          };

          const { error: legacyInsertError } = await serviceSupabase.from('sent_emails').insert(legacyRow);
          if (legacyInsertError) {
            throw legacyInsertError;
          }
        } else {
          throw insertError;
        }
      }

      await createAuditLog({
        userId: user.id,
        leadId: lead.id,
        campaignId: lead.campaign_id || null,
        action: 'email_sent',
        message: `Manual ${emailType} sent to ${lead.email}`,
        metadata: {
          to,
          provider: emailAccount.provider,
          lead_list_id: lead.lead_list_id || null,
          email_type: emailType,
          status: nextStatus,
        },
      });

      await incrementDailySentCount(emailAccount.id, 1);
    }

    return NextResponse.json({
      success: true,
      mode,
      messageId: result.messageId || null,
      to,
      provider: emailAccount.provider,
      geminiConfigured: Boolean(profile?.gemini_api_key),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error sending manual email';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
