import { SupabaseClient } from '@supabase/supabase-js';

export const BILLING_LIMITS = {
  free: {
    maxDailyEmails: 50,
  },
  active: {
    maxDailyEmails: 99999, // practically unlimited
  },
};

export async function checkSendingLimits(
  supabase: SupabaseClient,
  userId: string,
  emailsToProcess: number = 1
): Promise<{ allowed: boolean; reason?: string }> {
  // Bypassing billing limit checks per user request
  return { allowed: true };

  // 1. Get user profile for subscription status
  const { data: profile } = await supabase
    .from('profiles')
    .select('subscription_status')
    .eq('id', userId)
    .single();

  if (!profile) return { allowed: false, reason: 'Profile not found' };

  const isSubscribed = profile.subscription_status === 'active';
  const limits = isSubscribed ? BILLING_LIMITS.active : BILLING_LIMITS.free;

  // 2. Count emails sent today by this user across all campaigns
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const { count, error } = await supabase
    .from('sent_emails')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('sent_at', today.toISOString());

  if (error) {
    console.error('Error checking sent_emails count:', error);
    return { allowed: false, reason: 'Could not verify usage limits' };
  }

  const sentCount = count || 0;

  if (sentCount + emailsToProcess > limits.maxDailyEmails) {
    return { 
      allowed: false, 
      reason: `Daily limit of ${limits.maxDailyEmails} emails reached. Upgrade your plan to send more.` 
    };
  }

  return { allowed: true };
}
