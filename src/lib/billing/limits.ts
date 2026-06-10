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
}
