import 'server-only';

import { createServiceClient } from '@/utils/supabase/service';

export async function getSuppressionForEmail(userId: string, email: string) {
  const supabase = createServiceClient();
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const emailDomain = normalizedEmail.includes('@') ? normalizedEmail.split('@').pop() || '' : '';

  if (!userId || !normalizedEmail) {
    return null;
  }

  const { data, error } = await supabase
    .from('suppressions')
    .select('id, reason, domain, source, email')
    .eq('user_id', userId)
    .or(emailDomain
      ? `email.eq.${normalizedEmail},domain.eq.${emailDomain}`
      : `email.eq.${normalizedEmail}`)
    .maybeSingle();

  if (error) {
    console.error('Error checking suppression list:', error);
    return null;
  }

  return data || null;
}
