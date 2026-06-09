import { NextResponse } from 'next/server';
import { createServiceClient } from '@/utils/supabase/service';
import { sendTelegramReport } from '@/utils/telegram';
import { createAuditLog } from '@/lib/audit/create-audit-log';
import { resolveLeadOwnerFromLead } from '@/lib/leads/resolve-lead-owner';

function isMissingColumnError(error: { message?: string; code?: string } | null | undefined) {
  const message = String(error?.message || '').toLowerCase();
  return error?.code === '42703' || message.includes('does not exist') || message.includes('undefined column');
}

export async function POST(request: Request) {
  const supabase = createServiceClient();

  try {
    const formData = await request.formData();
    const sender = (formData.get('sender') as string || '').trim();
    const recipient = (formData.get('recipient') as string || '').trim();
    const subject = (formData.get('subject') as string || '').trim();
    const bodyText = (formData.get('stripped-text') as string || formData.get('body-plain') as string || '').trim();
    const bodyHtml = (formData.get('stripped-html') as string || formData.get('body-html') as string || '').trim();
    const replyMetadata = {
      sender,
      recipient,
      subject,
      snippet: bodyText.substring(0, 300),
      body_text: bodyText,
      body_html: bodyHtml,
    };

    if (!sender) {
      return NextResponse.json({ error: 'Missing sender' }, { status: 400 });
    }

    // 1. Find the most recently active lead with this email address
    // We look for leads that are in 'sending' or 'sent' status first
    const { data: leads, error: leadError } = await supabase
      .from('leads')
      .select(`
        id,
        first_name,
        last_name,
        company,
        email,
        user_id,
        campaign_id,
        lead_list_id,
        campaigns (
          id,
          name,
          user_id
        ),
        lead_lists (
          id,
          user_id
        )
      `)
      .eq('email', sender.toLowerCase())
      .order('updated_at', { ascending: false });

    if (leadError || !leads || leads.length === 0) {
      console.log(`Reply received from ${sender} but no corresponding lead found in DB.`);
      return NextResponse.json({ success: true, message: 'No matching lead found.' });
    }

    // Pick the first lead (the most recently active one)
    const targetLead = leads[0];
    const owner = resolveLeadOwnerFromLead(targetLead);
    const campaign = Array.isArray(targetLead.campaigns)
      ? targetLead.campaigns[0]
      : (targetLead.campaigns as { id: string; name: string; user_id: string } | null);
    const campaignId = owner.campaignId;
    const userId = owner.userId;

    if (!userId) {
      return NextResponse.json({ success: true, message: 'No owning user found for lead.' });
    }

    // 2. Update Lead Status to 'replied'
    const repliedAt = new Date().toISOString();
    await supabase
      .from('leads')
      .update({
        status: 'replied',
        reply_status: 'replied',
        next_email_at: null,
        next_follow_up_at: null,
        updated_at: repliedAt,
      })
      .eq('id', targetLead.id);

    const { data: latestSentEmail, error: latestSentEmailError } = await supabase
      .from('sent_emails')
      .select('id')
      .eq('lead_id', targetLead.id)
      .order('sent_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestSentEmailError && !isMissingColumnError(latestSentEmailError)) {
      throw latestSentEmailError;
    }

    if (latestSentEmail?.id) {
      const { error: replyUpdateError } = await supabase
        .from('sent_emails')
        .update({ replied_at: repliedAt, status: 'replied' })
        .eq('id', latestSentEmail.id);

      if (replyUpdateError) {
        if (!isMissingColumnError(replyUpdateError)) {
          throw replyUpdateError;
        }

        const { error: legacyReplyUpdateError } = await supabase
          .from('sent_emails')
          .update({
            status: 'replied',
            metadata: {
              event_type: 'replied',
              replied_at: repliedAt,
              body_snippet: bodyText.substring(0, 300),
              ...replyMetadata,
            },
          })
          .eq('id', latestSentEmail.id);

        if (legacyReplyUpdateError) {
          throw legacyReplyUpdateError;
        }
      }
    }

    // 3. Cancel all pending outbox entries for this lead
    await supabase
      .from('outbox')
      .update({ status: 'cancelled', error_message: 'Lead replied' })
      .eq('lead_id', targetLead.id)
      .eq('status', 'pending');

    // 4. Log Reply Activity for compatibility when a campaign exists
    if (campaignId) {
      await supabase.from('activity_logs').insert({
        campaign_id: campaignId,
        lead_id: targetLead.id,
        event_type: 'replied',
        payload: {
          ...replyMetadata,
          source: 'inbound_webhook',
        },
      });
    }

    await createAuditLog({
      userId,
      campaignId: campaignId || null,
      leadId: targetLead.id,
      action: 'reply_received',
      message: `Reply received from ${sender}`,
      metadata: {
        ...replyMetadata,
        source: 'inbound_webhook',
        reply_received_at: repliedAt,
      },
    });

    // 5. Instantly alert the user via Telegram (if configured)
    const { data: profile } = await supabase
      .from('profiles')
      .select('telegram_chat_id, telegram_bot_token')
      .eq('id', userId)
      .single();

    if (profile && profile.telegram_bot_token && profile.telegram_chat_id) {
      const name = `${targetLead.first_name || ''} ${targetLead.last_name || ''}`.trim() || 'Someone';
      const companyStr = targetLead.company ? ` at *${targetLead.company}*` : '';
      const telegramMessage = 
`🔔 *New Lead Reply Detected!*
📬 Campaign: *${campaign?.name || 'ReachMira outreach'}*
👤 From: *${name}* (${targetLead.email})${companyStr}

💬 *Subject*: ${subject}
📝 *Body snippet*:
_"${bodyText.substring(0, 200)}${bodyText.length > 200 ? '...' : ''}"_

🛑 _All future follow-ups for this lead have been automatically cancelled._`;

      await sendTelegramReport(
        profile.telegram_bot_token,
        profile.telegram_chat_id,
        telegramMessage
      );
    }

    return NextResponse.json({ success: true, matched_lead_id: targetLead.id });
  } catch (err: unknown) {
    console.error('Crash in inbound reply webhook:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Server crash' }, { status: 500 });
  }
}
