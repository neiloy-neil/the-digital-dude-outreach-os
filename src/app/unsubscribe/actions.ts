'use server'

import { createServiceClient } from '@/utils/supabase/service';
import { createAuditLog } from '@/lib/audit/create-audit-log';
import { resolveLeadOwnerFromLead } from '@/lib/leads/resolve-lead-owner';

export async function processUnsubscribe(token: string) {
  const supabase = createServiceClient();
  
  const { data: lead, error: fetchError } = await supabase
    .from('leads')
    .select(`
      id,
      email,
      user_id,
      campaign_id,
      lead_list_id,
      campaigns ( id, user_id ),
      lead_lists ( id, user_id )
    `)
    .eq('unsubscribe_token', token)
    .maybeSingle();

  if (fetchError || !lead) {
    return { status: 'invalid' as const };
  }

  const owner = resolveLeadOwnerFromLead(lead);
  const userId = owner.userId;

  await supabase
    .from('leads')
    .update({
      status: 'unsubscribed',
      reply_status: 'unsubscribed',
      next_email_at: null,
      next_follow_up_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', lead.id);

  await supabase
    .from('outbox')
    .update({ status: 'cancelled', error_message: 'Lead unsubscribed' })
    .eq('lead_id', lead.id)
    .eq('status', 'pending');

  if (userId) {
    await supabase.from('suppressions').upsert({
      user_id: userId,
      email: lead.email.toLowerCase(),
      reason: 'unsubscribe',
      source: 'unsubscribe',
    }, { onConflict: 'user_id,email' });

    await createAuditLog({
      userId,
      campaignId: owner.campaignId,
      leadId: lead.id,
      action: 'lead_unsubscribed',
      message: `Lead unsubscribed: ${lead.email}`,
      metadata: { source: 'unsubscribe_page', lead_list_id: owner.leadListId },
    });
  }

  return { status: 'success' as const };
}
