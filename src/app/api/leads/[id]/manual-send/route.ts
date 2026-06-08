import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createServiceClient } from '@/utils/supabase/service';
import { sendEmail } from '@/lib/mailers/send-email';
import { createAuditLog } from '@/lib/audit/create-audit-log';
import { buildEmailMessageBodies } from '@/lib/email/html';
import { getStatusForEmailType, isBlockedLeadStatus, type EmailType } from '@/lib/leads/status';
import { isMissingTableError } from '@/lib/supabase/schema-errors';
import type { EmailProviderType } from '@/types/email-provider';

function isSupportedProvider(provider: string): provider is EmailProviderType {
  return ['smtp', 'mailgun', 'resend', 'amazon_ses'].includes(provider);
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
    const { mode = 'send_now', targetEmail, emailAccountId, subject, body: bodyInput, emailType = 'custom_email', stepNumber } = await request.json();
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

    if (isBlockedLeadStatus(lead.status)) {
      return NextResponse.json({ error: 'This lead is blocked from sending' }, { status: 400 });
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

    const { data: profile } = await supabase.from('profiles').select('gemini_api_key').eq('id', user.id).single();

    const emailSubject =
      subject ||
      lead.manual_email_subject ||
      lead.ai_subject ||
      lead.personalized_subject ||
      `Quick question for ${lead.company_name || lead.company || lead.email}`;
    const baseBody =
      bodyInput ||
      lead.manual_email_body ||
      lead.ai_email_body ||
      lead.personalized_body ||
      `Hi ${lead.decision_maker_name || lead.first_name || 'there'},\n\nThought it might be worth reaching out.\n\nBest,\n${emailAccount.sender_name || emailAccount.email_address}`;

    const unsubscribeUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/unsubscribe?token=${lead.unsubscribe_token}`;
    const { html, text } = buildEmailMessageBodies(baseBody, unsubscribeUrl);
    const to = mode === 'test' ? targetEmail || user.email || lead.email : targetEmail || lead.email;

    if (!to || !String(to).includes('@')) {
      return NextResponse.json({ error: 'Recipient email is required' }, { status: 400 });
    }

    const result = await sendEmail(emailAccount.provider, emailAccount.config || {}, {
      to,
      fromName: emailAccount.sender_name || emailAccount.email_address,
      fromEmail: emailAccount.email_address,
      replyTo: emailAccount.email_address,
      subject: emailSubject,
      html,
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
      const updatePayload = {
        status: nextStatus,
        manual_email_approved: true,
        manual_email_sent_at: nowIso,
        last_manual_email_account_id: emailAccount.id,
        manual_personalization_status: 'sent',
        last_email_sent_at: nowIso,
        manual_email_subject: emailSubject,
        manual_email_body: html,
        updated_at: nowIso,
      };

      const { error: updateError } = await serviceSupabase.from('leads').update(updatePayload).eq('id', lead.id);
      if (updateError) throw updateError;

      await serviceSupabase.from('sent_emails').insert({
        user_id: user.id,
        campaign_id: lead.campaign_id || null,
        lead_id: lead.id,
        email_account_id: emailAccount.id,
        provider: emailAccount.provider,
        recipient_email: to,
        sender_email: emailAccount.email_address,
        sender_name: emailAccount.sender_name || null,
        subject: emailSubject,
        body_html: html,
        body_text: text,
        email_type: emailType,
        step_number: typeof stepNumber === 'number' ? stepNumber : null,
        provider_message_id: result.messageId || null,
        status: 'sent',
        sent_by: 'manual',
        sent_at: nowIso,
        raw_provider_response: {
          source: 'manual_send',
          mode,
          to,
          ...(result.raw && typeof result.raw === 'object' ? (result.raw as Record<string, unknown>) : {}),
        },
      });

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
