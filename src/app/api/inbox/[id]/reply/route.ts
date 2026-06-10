import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createServiceClient } from '@/utils/supabase/service';
import { sendEmail } from '@/lib/mailers/send-email';
import { createAuditLog } from '@/lib/audit/create-audit-log';
import { buildEmailMessageBodies } from '@/lib/email/html';
import { appendEmailSignature } from '@/lib/email/signature';
import { checkSendingLimits } from '@/lib/billing/limits';
import { getAvailableSendCapacity, incrementDailySentCount } from '@/lib/queue/queue';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const serviceSupabase = createServiceClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { body: emailBody } = await request.json();

    if (!emailBody) {
      return NextResponse.json({ error: 'Body is required' }, { status: 400 });
    }

    const { data: inboxMessage } = await supabase
      .from('inbox_messages')
      .select('*, leads(*)')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (!inboxMessage || !inboxMessage.leads) {
      return NextResponse.json({ error: 'Message or lead not found' }, { status: 404 });
    }

    const lead = inboxMessage.leads;

    // Billing check
    const billingLimits = await checkSendingLimits(serviceSupabase, user.id, 1);
    if (!billingLimits.allowed) {
      return NextResponse.json({ error: billingLimits.reason }, { status: 402 });
    }

    // Get email account
    const { data: emailAccount } = await supabase
      .from('email_accounts')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .order('is_default', { ascending: false })
      .limit(1)
      .single();

    if (!emailAccount) {
      return NextResponse.json({ error: 'No active email account' }, { status: 400 });
    }

    const availableCapacity = await getAvailableSendCapacity(emailAccount.id);
    if (availableCapacity <= 0) {
      return NextResponse.json({ error: 'Daily send limit reached' }, { status: 429 });
    }

    const senderName = emailAccount.sender_name || emailAccount.email_address;
    const senderEmail = emailAccount.email_address;
    const subject = inboxMessage.subject.toLowerCase().startsWith('re:') ? inboxMessage.subject : `Re: ${inboxMessage.subject}`;
    
    const bodyWithSignature = appendEmailSignature(emailBody, emailAccount.config || {}, senderName, true);
    const { html, text } = buildEmailMessageBodies(bodyWithSignature, '');

    const result = await sendEmail(emailAccount.provider, emailAccount.config || {}, {
      to: inboxMessage.sender_email,
      fromName: senderName,
      fromEmail: senderEmail,
      replyTo: senderEmail,
      subject,
      html,
      text,
      leadId: lead.id,
      campaignId: lead.campaign_id || undefined,
      metadata: { source: 'inbox_reply' }
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    const nowIso = new Date().toISOString();

    // Insert to sent_emails
    await serviceSupabase.from('sent_emails').insert({
      user_id: user.id,
      campaign_id: lead.campaign_id || null,
      lead_id: lead.id,
      email_account_id: emailAccount.id,
      provider: emailAccount.provider,
      recipient_email: inboxMessage.sender_email,
      sender_email: senderEmail,
      sender_name: senderName,
      subject,
      body_html: html,
      body_text: text,
      email_type: 'reply_follow_up',
      status: 'sent',
      sent_by: 'manual',
      sent_at: nowIso,
    });

    // Mark inbox message as replied
    await serviceSupabase.from('inbox_messages').update({ status: 'replied' }).eq('id', inboxMessage.id);
    
    // Update lead
    await serviceSupabase.from('leads').update({
      last_email_sent_at: nowIso,
      updated_at: nowIso,
      last_email_type: 'reply_follow_up'
    }).eq('id', lead.id);

    await incrementDailySentCount(emailAccount.id, 1);
    
    await createAuditLog({
      userId: user.id,
      leadId: lead.id,
      action: 'email_sent',
      message: `Replied via Unified Inbox to ${inboxMessage.sender_email}`,
      metadata: { source: 'inbox' }
    });

    return NextResponse.json({ success: true });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
