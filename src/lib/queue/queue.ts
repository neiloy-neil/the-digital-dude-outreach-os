import 'server-only';

import { createServiceClient } from '@/utils/supabase/service';
import { Lead } from '@/types/database.types';

/**
 * Claims leads that are pending AI analysis.
 * Handles retry for stuck leads (processing for > 15 minutes).
 */
export async function claimLeadsForAIProcessing(limit: number): Promise<Lead[]> {
  const supabase = createServiceClient();
  const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();

  const [pendingResult, staleResult] = await Promise.all([
    supabase
      .from('leads')
      .select('*')
      .eq('ai_status', 'pending')
      .order('created_at', { ascending: true })
      .limit(limit),
    supabase
      .from('leads')
      .select('*')
      .eq('ai_status', 'processing')
      .lt('processing_started_at', fifteenMinutesAgo)
      .order('processing_started_at', { ascending: true })
      .limit(limit),
  ]);

  const selectError = pendingResult.error || staleResult.error;
  const pendingLeads = [...(pendingResult.data || []), ...(staleResult.data || [])]
    .slice(0, limit);

  if (selectError || pendingLeads.length === 0) {
    return [];
  }

  const ids = pendingLeads.map((l) => l.id);

  // 2. Mark them as processing
  const { error: updateError } = await supabase
    .from('leads')
    .update({
      ai_status: 'processing',
      processing_started_at: new Date().toISOString(),
      processing_error: null,
    })
    .in('id', ids);

  if (updateError) {
    console.error('Error claiming leads for AI processing:', updateError);
    return [];
  }

  // Fetch fresh claimed data to return
  const { data: claimedLeads } = await supabase
    .from('leads')
    .select('*')
    .in('id', ids);

  return claimedLeads || [];
}

/**
 * Resets leads stuck in 'processing' status back to 'pending'.
 */
export async function releaseStuckProcessingLeads(): Promise<number> {
  const supabase = createServiceClient();
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
export async function claimLeadsForEmailSending(campaignId: string, limit: number): Promise<Lead[]> {
  const supabase = createServiceClient();
  const now = new Date().toISOString();

  const excludedStatuses = ['replied', 'bounced', 'unsubscribed', 'do_not_contact', 'excluded', 'interested', 'not_interested', 'won', 'lost'];

  const { data: leads, error } = await supabase
    .from('leads')
    .select('*')
    .eq('campaign_id', campaignId)
    .not('status', 'in', `(${excludedStatuses.join(',')})`)
    .or(`next_email_at.is.null,next_email_at.lte.${now}`)
    .order('next_email_at', { ascending: true, nullsFirst: true })
    .limit(limit);

  if (error) {
    console.error('Error fetching due leads for campaign:', error);
    return [];
  }

  return leads || [];
}

export async function getCampaignDailySendCount(campaignId: string): Promise<number> {
  const supabase = createServiceClient();
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
export async function getAvailableSendCapacity(emailAccountId: string): Promise<number> {
  const supabase = createServiceClient();
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
export async function incrementDailySentCount(emailAccountId: string, count: number = 1): Promise<void> {
  const supabase = createServiceClient();
  
  // We fetch first, then increment
  const { data: account, error: getError } = await supabase
    .from('email_accounts')
    .select('daily_sent_count')
    .eq('id', emailAccountId)
    .single();

  if (getError || !account) {
    console.error('Error reading sent count for increment:', getError);
    return;
  }

  const { error: updateError } = await supabase
    .from('email_accounts')
    .update({
      daily_sent_count: account.daily_sent_count + count,
      updated_at: new Date().toISOString(),
    })
    .eq('id', emailAccountId);

  if (updateError) {
    console.error('Error incrementing daily sent count:', updateError);
  }
}
