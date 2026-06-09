import { NextResponse } from 'next/server';
import { createServiceClient } from '@/utils/supabase/service';
import { verifyMailgunSignature } from '@/utils/mailgun';
import { createAuditLog } from '@/lib/audit/create-audit-log';
import { fetchLeadWithOwner, resolveLeadOwnerFromLead } from '@/lib/leads/resolve-lead-owner';

type SentEmailMatch = {
  id: string;
  user_id: string;
  lead_id: string;
  campaign_id: string | null;
  email_account_id: string | null;
};

function isMissingColumnError(error: { message?: string; code?: string } | null | undefined) {
  const message = String(error?.message || '').toLowerCase();
  return error?.code === '42703' || message.includes('does not exist') || message.includes('undefined column');
}

function normalizeEmail(email: unknown) {
  return String(email || '').trim().toLowerCase();
}

async function findSentEmailMatch(params: {
  supabase: ReturnType<typeof createServiceClient>;
  providerMessageId: string | null;
  leadId: string | null;
  campaignId: string | null;
}) {
  const { supabase, providerMessageId, leadId, campaignId } = params;

  if (providerMessageId) {
    const { data, error } = await supabase
      .from('sent_emails')
      .select('id, user_id, lead_id, campaign_id, email_account_id')
      .eq('provider_message_id', providerMessageId)
      .order('sent_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!error && data) {
      return data as SentEmailMatch;
    }
  }

  if (leadId && campaignId) {
    const { data, error } = await supabase
      .from('sent_emails')
      .select('id, user_id, lead_id, campaign_id, email_account_id')
      .eq('lead_id', leadId)
      .eq('campaign_id', campaignId)
      .order('sent_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!error && data) {
      return data as SentEmailMatch;
    }
  }

  if (leadId) {
    const { data, error } = await supabase
      .from('sent_emails')
      .select('id, user_id, lead_id, campaign_id, email_account_id')
      .eq('lead_id', leadId)
      .order('sent_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!error && data) {
      return data as SentEmailMatch;
    }
  }

  return null;
}

async function resolveSigningKey(params: {
  supabase: ReturnType<typeof createServiceClient>;
  campaignId: string | null;
  sentEmailMatch: SentEmailMatch | null;
}) {
  const { supabase, campaignId, sentEmailMatch } = params;

  const emailAccountId = sentEmailMatch?.email_account_id || null;

  if (emailAccountId) {
    const { data } = await supabase
      .from('email_accounts')
      .select('id, config')
      .eq('id', emailAccountId)
      .maybeSingle();

    const signingKey =
      data?.config && typeof data.config === 'object'
        ? (data.config as Record<string, unknown>).webhook_signing_key
        : null;

    if (typeof signingKey === 'string' && signingKey) {
      return signingKey;
    }
  }

  if (!campaignId) {
    return null;
  }

  const { data: campaign } = await supabase
    .from('campaigns')
    .select(`
      id,
      email_account_id,
      email_accounts (
        id,
        config
      )
    `)
    .eq('id', campaignId)
    .maybeSingle();

  const emailAccount = Array.isArray(campaign?.email_accounts)
    ? campaign?.email_accounts[0]
    : campaign?.email_accounts;
  const signingKey =
    emailAccount?.config && typeof emailAccount.config === 'object'
      ? (emailAccount.config as Record<string, unknown>).webhook_signing_key
      : null;

  return typeof signingKey === 'string' && signingKey ? signingKey : null;
}

async function updateSentEmailStatus(params: {
  supabase: ReturnType<typeof createServiceClient>;
  sentEmailId: string | null;
  leadId: string | null;
  campaignId: string | null;
  providerMessageId: string | null;
  updatePayload: Record<string, unknown>;
  legacyMetadata: Record<string, unknown>;
}) {
  const { supabase, sentEmailId, leadId, campaignId, providerMessageId, updatePayload, legacyMetadata } = params;
  const matched = sentEmailId
    ? { id: sentEmailId }
    : await findSentEmailMatch({ supabase, providerMessageId, leadId, campaignId });

  if (!matched?.id) {
    return null;
  }

  const { error: updateError } = await supabase.from('sent_emails').update(updatePayload).eq('id', matched.id);
  if (!updateError) {
    return matched.id;
  }

  if (!isMissingColumnError(updateError)) {
    throw updateError;
  }

  const { error: legacyUpdateError } = await supabase
    .from('sent_emails')
    .update({
      status: String(updatePayload.status || 'sent'),
      metadata: legacyMetadata,
    })
    .eq('id', matched.id);

  if (legacyUpdateError) {
    throw legacyUpdateError;
  }

  return matched.id;
}

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
    const campaignId = String(userVars['campaign-id'] || userVars['campaign_id'] || '').trim() || null;
    const leadId = String(userVars['lead-id'] || userVars['lead_id'] || '').trim() || null;
    const outboxId = String(userVars['outbox-id'] || userVars['outbox_id'] || '').trim() || null;
    const providerMessageId =
      eventData?.message?.headers?.['message-id'] ||
      eventData?.message?.headers?.['Message-Id'] ||
      eventData?.message?.headers?.['Message-ID'] ||
      null;
    const eventType = String(eventData.event || '').trim();
    const leadEmail = normalizeEmail(eventData.recipient);
    const sentEmailMatch = await findSentEmailMatch({ supabase, providerMessageId, leadId, campaignId });

    const isDev = process.env.NODE_ENV === 'development';
    if (!isDev && !signatureInfo) {
      return NextResponse.json({ error: 'Missing webhook signature' }, { status: 401 });
    }

    if (!isDev && signatureInfo) {
      const signingKey = await resolveSigningKey({ supabase, campaignId, sentEmailMatch });
      if (!signingKey) {
        return NextResponse.json({ error: 'Mailgun webhook signing key is missing for this sender' }, { status: 400 });
      }

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

    const resolvedLeadId = sentEmailMatch?.lead_id || leadId;
    if (!resolvedLeadId) {
      return NextResponse.json({ error: 'Could not resolve lead for event' }, { status: 404 });
    }

    const { data: lead, error: leadError } = await fetchLeadWithOwner(resolvedLeadId);
    if (leadError || !lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    const owner = resolveLeadOwnerFromLead(lead);
    if (!owner.userId) {
      return NextResponse.json({ error: 'Could not resolve lead owner' }, { status: 400 });
    }

    if (owner.campaignId) {
      await supabase.from('activity_logs').insert({
        campaign_id: owner.campaignId,
        lead_id: lead.id,
        outbox_id: outboxId || null,
        event_type: eventType,
        payload: { mailgun_event_id: eventData.id, timestamp: eventData.timestamp },
      });
    }

    const updateSentEmail = (updatePayload: Record<string, unknown>) =>
      updateSentEmailStatus({
        supabase,
        sentEmailId: sentEmailMatch?.id || null,
        leadId: lead.id,
        campaignId: owner.campaignId,
        providerMessageId,
        updatePayload,
        legacyMetadata: {
          event_type: eventType,
          mailgun_event_id: eventData.id,
          timestamp: eventData.timestamp,
          ...updatePayload,
        },
      });

    if (eventType === 'delivered') {
      await updateSentEmail({ delivered_at: new Date().toISOString(), status: 'delivered' });
      return NextResponse.json({ success: true });
    }

    if (eventType === 'opened') {
      await updateSentEmail({ opened_at: new Date().toISOString(), status: 'opened' });
      return NextResponse.json({ success: true });
    }

    if (eventType === 'clicked') {
      await updateSentEmail({ clicked_at: new Date().toISOString(), status: 'clicked' });
      return NextResponse.json({ success: true });
    }

    if (eventType === 'failed' && eventData.severity === 'permanent') {
      const nowIso = new Date().toISOString();

      await supabase
        .from('leads')
        .update({
          status: 'bounced',
          reply_status: 'bounced',
          next_email_at: null,
          next_follow_up_at: null,
          updated_at: nowIso,
        })
        .eq('id', lead.id);

      await updateSentEmail({ bounced_at: nowIso, status: 'bounced' });

      await supabase
        .from('outbox')
        .update({ status: 'cancelled', error_message: 'Lead bounced' })
        .eq('lead_id', lead.id)
        .eq('status', 'pending');

      await supabase.from('suppressions').upsert(
        {
          user_id: owner.userId,
          email: leadEmail || normalizeEmail(lead.email),
          reason: 'bounce',
        },
        { onConflict: 'user_id,email' }
      );

      await createAuditLog({
        userId: owner.userId,
        campaignId: owner.campaignId,
        leadId: lead.id,
        action: 'email_bounced',
        message: `Email bounced for ${leadEmail || lead.email}`,
        metadata: { event_id: eventData.id, severity: eventData.severity },
      });

      return NextResponse.json({ success: true });
    }

    if (eventType === 'complained') {
      const nowIso = new Date().toISOString();

      await supabase
        .from('leads')
        .update({
          status: 'do_not_contact',
          reply_status: 'complained',
          next_email_at: null,
          next_follow_up_at: null,
          updated_at: nowIso,
        })
        .eq('id', lead.id);

      await updateSentEmail({ bounced_at: nowIso, status: 'complained' });

      await supabase
        .from('outbox')
        .update({ status: 'cancelled', error_message: 'Lead complained' })
        .eq('lead_id', lead.id)
        .eq('status', 'pending');

      await supabase.from('suppressions').upsert(
        {
          user_id: owner.userId,
          email: leadEmail || normalizeEmail(lead.email),
          reason: 'complaint',
        },
        { onConflict: 'user_id,email' }
      );

      await createAuditLog({
        userId: owner.userId,
        campaignId: owner.campaignId,
        leadId: lead.id,
        action: 'email_bounced',
        message: `Complaint received for ${leadEmail || lead.email}`,
        metadata: { event_id: eventData.id, event_type: eventType },
      });

      return NextResponse.json({ success: true });
    }

    if (eventType === 'unsubscribed') {
      const nowIso = new Date().toISOString();

      await supabase
        .from('leads')
        .update({
          status: 'unsubscribed',
          reply_status: 'unsubscribed',
          next_email_at: null,
          next_follow_up_at: null,
          updated_at: nowIso,
        })
        .eq('id', lead.id);

      await updateSentEmail({ status: 'unsubscribed' });

      await supabase
        .from('outbox')
        .update({ status: 'cancelled', error_message: 'Lead unsubscribed' })
        .eq('lead_id', lead.id)
        .eq('status', 'pending');

      await supabase.from('suppressions').upsert(
        {
          user_id: owner.userId,
          email: leadEmail || normalizeEmail(lead.email),
          reason: 'unsubscribe',
        },
        { onConflict: 'user_id,email' }
      );

      await createAuditLog({
        userId: owner.userId,
        campaignId: owner.campaignId,
        leadId: lead.id,
        action: 'lead_unsubscribed',
        message: `Lead unsubscribed: ${leadEmail || lead.email}`,
        metadata: { event_id: eventData.id, event_type: eventType, lead_list_id: owner.leadListId },
      });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error('Mailgun webhook processing error:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Internal server error' }, { status: 500 });
  }
}
