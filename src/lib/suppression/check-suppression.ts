import 'server-only';

import { createServiceClient } from '@/utils/supabase/service';

export type SuppressionMatch = {
  id: string;
  reason: string | null;
  domain: string | null;
  source: string | null;
  email: string | null;
  matchedOn: 'email' | 'domain';
};

function normalizeEmail(email: string) {
  return String(email || '').trim().toLowerCase();
}

function getEmailDomain(email: string) {
  if (!email.includes('@')) return '';
  return email.split('@').pop()?.trim().toLowerCase() || '';
}

function isMissingColumnError(error: { message?: string; code?: string } | null | undefined) {
  const message = String(error?.message || '').toLowerCase();
  return error?.code === '42703' || message.includes('does not exist') || message.includes('undefined column');
}

export async function checkSuppression(userId: string, email: string): Promise<SuppressionMatch | null> {
  const normalizedEmail = normalizeEmail(email);
  const domain = getEmailDomain(normalizedEmail);

  if (!userId || !normalizedEmail) {
    return null;
  }

  const supabase = createServiceClient();
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
    return {
      ...emailMatch,
      matchedOn: 'email',
    };
  }

  if (!domain) {
    return null;
  }

  const { data: domainMatch, error: domainError } = await supabase
    .from('suppressions')
    .select('id, reason, domain, source, email')
    .eq('user_id', userId)
    .eq('domain', domain)
    .maybeSingle();

  if (domainError) {
    if (isMissingColumnError(domainError)) {
      return null;
    }

    console.error('Error checking suppression domain match:', domainError);
    return null;
  }

  if (!domainMatch) {
    return null;
  }

  return {
    ...domainMatch,
    matchedOn: 'domain',
  };
}
