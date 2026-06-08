import { NextResponse } from 'next/server';
import { createServiceClient } from '@/utils/supabase/service';
import { verifyMailgunSignature } from '@/utils/mailgun';
import { createAuditLog } from '@/lib/audit/create-audit-log';

export async function POST(request: Request) {
  const supabase = createServiceClient();

  try {
    const payload = await request.json();
    const signatureInfo = payload.signature;
    const eventData = payload['event-data'];

    if (!eventData) {
      return NextResponse.json({ error: 'Invalid payload: missing event-data' }, { status: 400 });
    }

    const userVars = eventData['user-variables'] || {};
    const campaignId = userVars['campaign-id'] || userVars['campaign_id'];
    const leadId = userVars['lead-id'] || userVars['lead_id'];
    const outboxId = userVars['outbox-id'] || userVars['outbox_id'];
    const providerMessageId =
      eventData?.message?.headers?.['message-id'] ||
      eventData?.message?.headers?.['Message-Id'] ||
      eventData?.message?.headers?.['Message-ID'] ||
      null;

    if (!campaignId || !leadId) {
      return NextResponse.json({ error: 'Missing campaign-id or lead-id in user variables' }, { status: 400 });
    }

    // 1. Fetch user's profile to get their Mailgun API key for signature verification
    const { data: campaign } = await supabase
      .from('campaigns')
      .select(`
        id,
        user_id,
        email_account_id,
        email_accounts (
          id,
          config
        )
      `)
      .eq('id', campaignId)
      .single();

    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    const emailAccount = Array.isArray(campaign.email_accounts)
      ? campaign.email_accounts[0]
      : campaign.email_accounts;
    const signingKey = emailAccount?.config && typeof emailAccount.config === 'object'
      ? (emailAccount.config as Record<string, unknown>).webhook_signing_key
      : null;

    if (!emailAccount || !signingKey || typeof signingKey !== 'string') {
      return NextResponse.json({ error: 'Mailgun webhook signing key is missing for this sender' }, { status: 400 });
    }

    // 2. Verify Signature (Skip only in local development environment to facilitate local curls)
    const isDev = process.env.NODE_ENV === 'development';
    if (!isDev && !signatureInfo) {
      return NextResponse.json({ error: 'Missing webhook signature' }, { status: 401 });
    }

    if (!isDev && signatureInfo) {
      const isValid = await verifyMailgunSignature(
        signingKey,
        signatureInfo.timestamp,
        signatureInfo.token,
        signatureInfo.signature
      );
      if (!isValid) {
        return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 401 });
      }
    }

    // 3. Handle specific event types
    const eventType = eventData.event; // delivered, opened, clicked, failed, complained, unsubscribed
    const leadEmail = eventData.recipient;

    // Log the event in activity_logs
    await supabase.from('activity_logs').insert({
      campaign_id: campaignId,
      lead_id: leadId,
      outbox_id: outboxId || null,
      event_type: eventType,
      payload: { mailgun_event_id: eventData.id, timestamp: eventData.timestamp },
    });

    const updateSentEmailRow = async (updatePayload: Record<string, unknown>) => {
      if (providerMessageId) {
        const { data: matchedRows } = await supabase
          .from('sent_emails')
          .select('id')
          .eq('provider_message_id', providerMessageId)
          .limit(1);

        if (matchedRows && matchedRows.length > 0) {
          await supabase.from('sent_emails').update(updatePayload).eq('id', matchedRows[0].id);
          return;
        }
      }

      const { data: fallbackRows } = await supabase
        .from('sent_emails')
        .select('id')
        .eq('lead_id', leadId)
        .eq('campaign_id', campaignId)
        .order('sent_at', { ascending: false })
        .limit(1);

      if (fallbackRows && fallbackRows.length > 0) {
        await supabase.from('sent_emails').update(updatePayload).eq('id', fallbackRows[0].id);
      }
    };

    if (eventType === 'delivered') {
      await updateSentEmailRow({ delivered_at: new Date().toISOString(), status: 'delivered' });
    } else if (eventType === 'opened') {
      await updateSentEmailRow({ opened_at: new Date().toISOString(), status: 'opened' });
    } else if (eventType === 'clicked') {
      await updateSentEmailRow({ clicked_at: new Date().toISOString(), status: 'clicked' });
    } else if (eventType === 'failed' && eventData.severity === 'permanent') {
      // Bounce event
      await supabase.from('leads').update({ status: 'bounced' }).eq('id', leadId);
      await updateSentEmailRow({ bounced_at: new Date().toISOString(), status: 'bounced' });
      
      // Cancel all pending outbox entries for this lead
      await supabase.from('outbox').update({ status: 'cancelled', error_message: 'Lead bounced' }).eq('lead_id', leadId).eq('status', 'pending');
      
      // Add to suppressions
      await supabase.from('suppressions').upsert({
        user_id: campaign.user_id,
        email: leadEmail.toLowerCase(),
        reason: 'bounce',
      }, { onConflict: 'user_id,email' });

      await createAuditLog({
        userId: campaign.user_id,
        campaignId,
        leadId,
        action: 'email_bounced',
        message: `Email bounced for ${leadEmail}`,
        metadata: { event_id: eventData.id, severity: eventData.severity },
      });

    } else if (eventType === 'complained') {
      await supabase.from('leads').update({ status: 'do_not_contact' }).eq('id', leadId);
      await updateSentEmailRow({ bounced_at: new Date().toISOString(), status: 'complained' });
      
      // Cancel all pending outbox entries for this lead
      await supabase.from('outbox').update({ status: 'cancelled', error_message: 'Lead complained' }).eq('lead_id', leadId).eq('status', 'pending');
      
      // Add to suppressions
      await supabase.from('suppressions').upsert({
        user_id: campaign.user_id,
        email: leadEmail.toLowerCase(),
        reason: 'complaint',
      }, { onConflict: 'user_id,email' });

      await createAuditLog({
        userId: campaign.user_id,
        campaignId,
        leadId,
        action: 'email_bounced',
        message: `Complaint received for ${leadEmail}`,
        metadata: { event_id: eventData.id, event_type: eventType },
      });

    } else if (eventType === 'unsubscribed') {
      // Unsubscribed via Mailgun header
      await supabase.from('leads').update({ status: 'unsubscribed' }).eq('id', leadId);
      await updateSentEmailRow({ status: 'unsubscribed' });
      
      // Cancel all pending outbox entries for this lead
      await supabase.from('outbox').update({ status: 'cancelled', error_message: 'Lead unsubscribed' }).eq('lead_id', leadId).eq('status', 'pending');
      
      // Add to suppressions
      await supabase.from('suppressions').upsert({
        user_id: campaign.user_id,
        email: leadEmail.toLowerCase(),
        reason: 'unsubscribe',
      }, { onConflict: 'user_id,email' });

      await createAuditLog({
        userId: campaign.user_id,
        campaignId,
        leadId,
        action: 'lead_unsubscribed',
        message: `Lead unsubscribed: ${leadEmail}`,
        metadata: { event_id: eventData.id, event_type: eventType },
      });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error('Mailgun webhook processing error:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Internal server error' }, { status: 500 });
  }
}
