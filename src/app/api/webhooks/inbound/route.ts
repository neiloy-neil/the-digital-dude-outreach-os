import { NextResponse } from 'next/server';
import { createServiceClient } from '@/utils/supabase/service';
import { sendTelegramReport } from '@/utils/telegram';
import { createAuditLog } from '@/lib/audit/create-audit-log';

export async function POST(request: Request) {
  const supabase = createServiceClient();

  try {
    const formData = await request.formData();
    const sender = (formData.get('sender') as string || '').trim();
    const recipient = (formData.get('recipient') as string || '').trim();
    const subject = (formData.get('subject') as string || '').trim();
    const bodyText = (formData.get('stripped-text') as string || formData.get('body-plain') as string || '').trim();

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
    const campaign = Array.isArray(targetLead.campaigns)
      ? targetLead.campaigns[0]
      : (targetLead.campaigns as { id: string; name: string; user_id: string });
    const campaignId = targetLead.campaign_id;
    const leadList = Array.isArray(targetLead.lead_lists)
      ? targetLead.lead_lists[0]
      : (targetLead.lead_lists as { id: string; user_id: string } | null);
    const userId = targetLead.user_id || campaign?.user_id || leadList?.user_id;

    if (!userId) {
      return NextResponse.json({ success: true, message: 'No owning user found for lead.' });
    }

    // 2. Update Lead Status to 'replied'
    await supabase
      .from('leads')
      .update({ status: 'replied', updated_at: new Date().toISOString() })
      .eq('id', targetLead.id);

    await supabase
      .from('sent_emails')
      .update({ replied_at: new Date().toISOString(), status: 'replied' })
      .eq('lead_id', targetLead.id)
      .is('replied_at', null);

    // 3. Cancel all pending outbox entries for this lead when it belongs to a campaign
    if (campaignId) {
      await supabase
        .from('outbox')
        .update({ status: 'cancelled', error_message: 'Lead replied' })
        .eq('lead_id', targetLead.id)
        .eq('status', 'pending');
    }

    // 4. Log Reply Activity for compatibility when a campaign exists
    if (campaignId) {
      await supabase.from('activity_logs').insert({
        campaign_id: campaignId,
        lead_id: targetLead.id,
        event_type: 'replied',
        payload: {
          subject,
          snippet: bodyText.substring(0, 300),
          recipient,
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
        subject,
        recipient,
        snippet: bodyText.substring(0, 300),
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
