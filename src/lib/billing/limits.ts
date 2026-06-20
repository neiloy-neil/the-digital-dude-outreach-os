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
  // TODO: enforce after pricing is finalized — intentionally deferred.
  // Billing limit enforcement is disabled until plans are finalized.
  // Do not remove the BILLING_LIMITS constants or this function signature;
  // simply re-implement the body when ready to enforce.
  return { allowed: true };
}
