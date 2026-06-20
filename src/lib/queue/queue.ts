import 'server-only';

import { createServiceClient } from '@/utils/supabase/service';
import { Lead } from '@/types/database.types';

/**
 * Claims leads that are pending AI analysis.
 * Handles retry for stuck leads (processing for > 15 minutes).
 */
export async function claimLeadsForAIProcessing(limit: number, supabaseClient?: any): Promise<Lead[]> {
  const supabase = supabaseClient || createServiceClient();
  
  const { data, error } = await supabase.rpc('claim_leads_for_ai', {
    p_limit: limit,
  });

  if (error) {
    console.error('Error claiming leads for AI processing:', error);
    return [];
  }

  return data || [];
}

/**
 * Resets leads stuck in 'processing' status back to 'pending'.
 */
export async function releaseStuckProcessingLeads(supabaseClient?: any): Promise<number> {
  const supabase = supabaseClient || createServiceClient();
  const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('leads')
    .update({
      ai_status: 'pending',
      processing_started_at: null,
      processing_error: 'Released: processing timeout of 15 minutes exceeded.',
    })
    .eq('ai_status', 'processing')
    .lt('processing_started_at', fifteenMinutesAgo)
    .select();

  if (error) {
    console.error('Error releasing stuck leads:', error);
    return 0;
  }

  return data?.length || 0;
}

/**
 * Retrieves leads that are due to receive sequence emails for a campaign.
 */
export async function claimLeadsForEmailSending(campaignId: string, limit: number, supabaseClient?: any): Promise<Lead[]> {
  const supabase = supabaseClient || createServiceClient();
  const now = new Date().toISOString();

  const excludedStatuses = ['replied', 'bounced', 'unsubscribed', 'do_not_contact', 'excluded', 'interested', 'not_interested', 'won', 'lost'];

  const { data: leads, error } = await supabase
    .from('leads')
    .select('*')
    .eq('campaign_id', campaignId)
    .not('status', 'in', `(${excludedStatuses.join(',')})`)
    .or(`next_email_at.is.null,next_email_at.lte.${now}`)
    .order('next_email_at', { ascending: true, nullsFirst: true })
    .limit(Math.max(limit * 5, limit));

  if (error) {
    console.error('Error fetching due leads for campaign:', error);
    return [];
  }

  return (leads || [])
    .filter((lead: any) => {
      const queuedLead = lead as Lead & {
        current_step?: number | null;
        emails_sent_count?: number | null;
        next_email_at?: string | null;
      };

      if (queuedLead.next_email_at) {
        return queuedLead.next_email_at <= now;
      }

      const currentStep = Number(queuedLead.current_step || 0);
      const emailsSentCount = Number(queuedLead.emails_sent_count || 0);

      // A null schedule is due only before the first email. After a sequence is
      // exhausted, next_email_at is intentionally null and must not requeue.
      return emailsSentCount <= 0 && currentStep <= 1;
    })
    .slice(0, limit);
}

export async function getCampaignDailySendCount(campaignId: string, supabaseClient?: any): Promise<number> {
  const supabase = supabaseClient || createServiceClient();
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const { count, error } = await supabase
    .from('sent_emails')
    .select('*', { count: 'exact', head: true })
    .eq('campaign_id', campaignId)
    .gte('sent_at', startOfDay.toISOString());

  if (error) {
    console.error('Error fetching campaign daily send count:', error);
    return 0;
  }

  return count || 0;
}

/**
 * Calculates and manages daily send limit capacity for an email account.
 * Resets the count automatically if the last reset date was before today.
 */
export async function getAvailableSendCapacity(emailAccountId: string, supabaseClient?: any): Promise<number> {
  const supabase = supabaseClient || createServiceClient();
  const todayStr = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

  // Fetch current account status
  const { data: account, error } = await supabase
    .from('email_accounts')
    .select('*')
    .eq('id', emailAccountId)
    .single();

  if (error || !account) {
    console.error('Error fetching email account capacity:', error);
    return 0;
  }

  if (account.status !== 'active') {
    return 0;
  }

  // Reset count if it's a new day
  if (account.last_sent_reset_date < todayStr) {
    const { data: updatedAccount, error: resetError } = await supabase
      .from('email_accounts')
      .update({
        daily_sent_count: 0,
        last_sent_reset_date: todayStr,
      })
      .eq('id', emailAccountId)
      .select()
      .single();

    if (resetError || !updatedAccount) {
      console.error('Error resetting daily sent count:', resetError);
      return account.daily_send_limit;
    }

    return updatedAccount.daily_send_limit;
  }

  const available = account.daily_send_limit - account.daily_sent_count;
  return Math.max(0, available);
}

/**
 * Increments the daily sent count of an email account.
 */
export async function incrementDailySentCount(emailAccountId: string, count: number = 1, supabaseClient?: any): Promise<void> {
  const supabase = supabaseClient || createServiceClient();
  
  const { error } = await supabase.rpc('increment_email_account_sent_count', {
    p_account_id: emailAccountId,
    p_increment: count,
  });

  if (error) {
    console.error('Error incrementing daily sent count:', error);
  }
}
