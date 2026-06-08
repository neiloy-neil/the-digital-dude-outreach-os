import 'server-only';

import { createServiceClient } from '@/utils/supabase/service';

export async function getSuppressionForEmail(userId: string, email: string) {
  const supabase = createServiceClient();
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const emailDomain = normalizedEmail.includes('@') ? normalizedEmail.split('@').pop() || '' : '';

  if (!userId || !normalizedEmail) {
    return null;
  }

  const { data: emailMatch, error: emailError } = await supabase
    .from('suppressions')
    .select('id, reason, domain, source, email')
    .eq('user_id', userId)
    .eq('email', normalizedEmail)
    .maybeSingle();

  if (emailError) {
    console.error('Error checking suppression email match:', emailError);
    return null;
  }

  if (emailMatch) {
    return emailMatch;
  }

  if (!emailDomain) {
    return null;
  }

  try {
    const { data: domainMatch, error: domainError } = await supabase
      .from('suppressions')
      .select('id, reason, domain, source, email')
      .eq('user_id', userId)
      .eq('domain', emailDomain)
      .maybeSingle();

    if (domainError) {
      if (String(domainError.message || '').toLowerCase().includes('does not exist')) {
        return null;
      }
      console.error('Error checking suppression domain match:', domainError);
      return null;
    }

    return domainMatch || null;
  } catch (error) {
    console.error('Error checking suppression domain match:', error);
    return null;
  }
}
