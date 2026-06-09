import 'server-only';

import { resolveMx } from 'node:dns/promises';

import { checkSuppression } from '@/lib/suppression/check-suppression';

export type EmailVerificationStatus =
  | 'not_checked'
  | 'valid'
  | 'risky'
  | 'invalid'
  | 'role_based'
  | 'disposable'
  | 'suppressed'
  | 'unknown'
  | 'failed';

export type LocalVerificationResult = {
  status: EmailVerificationStatus;
  score: number;
  reason: string;
  provider: 'local';
  checks: {
    normalizedEmail: string;
    isEmpty: boolean;
    syntaxValid: boolean;
    domain: string | null;
    roleBased: boolean;
    rolePrefix: string | null;
    disposable: boolean;
    disposableDomain: string | null;
    suppressed: boolean;
    suppressionReason: string | null;
    suppressionMatchedOn: 'email' | 'domain' | null;
    mxChecked: boolean;
    mxValid: boolean | null;
    mxRecords: string[];
    error: string | null;
  };
};

const ROLE_BASED_PREFIXES = new Set([
  'info',
  'support',
  'admin',
  'sales',
  'contact',
  'hello',
  'noreply',
  'no-reply',
]);

const DISPOSABLE_DOMAINS = new Set([
  'mailinator.com',
  'tempmail.com',
  '10minutemail.com',
  'guerrillamail.com',
]);

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmail(email: string) {
  return String(email || '').trim().toLowerCase();
}

function getDomain(email: string) {
  if (!email.includes('@')) return null;
  return email.split('@').pop()?.trim().toLowerCase() || null;
}

function getLocalPart(email: string) {
  if (!email.includes('@')) return '';
  return email.split('@')[0]?.trim().toLowerCase() || '';
}

export async function verifyEmailLocally({
  email,
  userId,
  checkMx = false,
}: {
  email: string;
  userId: string;
  checkMx?: boolean;
}): Promise<LocalVerificationResult> {
  const normalizedEmail = normalizeEmail(email);
  const domain = getDomain(normalizedEmail);
  const localPart = getLocalPart(normalizedEmail);
  const rolePrefix = ROLE_BASED_PREFIXES.has(localPart) ? localPart : null;
  const disposableDomain = domain && DISPOSABLE_DOMAINS.has(domain) ? domain : null;

  const baseChecks: LocalVerificationResult['checks'] = {
    normalizedEmail,
    isEmpty: !normalizedEmail,
    syntaxValid: EMAIL_REGEX.test(normalizedEmail),
    domain,
    roleBased: Boolean(rolePrefix),
    rolePrefix,
    disposable: Boolean(disposableDomain),
    disposableDomain,
    suppressed: false,
    suppressionReason: null,
    suppressionMatchedOn: null,
    mxChecked: Boolean(checkMx),
    mxValid: null,
    mxRecords: [],
    error: null,
  };

  try {
    if (!normalizedEmail) {
      return {
        status: 'invalid',
        score: 0,
        reason: 'Email is empty.',
        provider: 'local',
        checks: baseChecks,
      };
    }

    if (!baseChecks.syntaxValid || !domain) {
      return {
        status: 'invalid',
        score: 0,
        reason: 'Email syntax is invalid.',
        provider: 'local',
        checks: baseChecks,
      };
    }

    const suppression = await checkSuppression(userId, normalizedEmail);
    if (suppression) {
      return {
        status: 'suppressed',
        score: 0,
        reason: suppression.reason || 'Email is on the suppression list.',
        provider: 'local',
        checks: {
          ...baseChecks,
          suppressed: true,
          suppressionReason: suppression.reason || null,
          suppressionMatchedOn: suppression.matchedOn,
        },
      };
    }

    if (disposableDomain) {
      return {
        status: 'disposable',
        score: 10,
        reason: `Disposable domain detected: ${disposableDomain}.`,
        provider: 'local',
        checks: baseChecks,
      };
    }

    if (rolePrefix) {
      return {
        status: 'role_based',
        score: 60,
        reason: `Role-based email detected: ${rolePrefix}.`,
        provider: 'local',
        checks: baseChecks,
      };
    }

    if (!checkMx) {
      return {
        status: 'valid',
        score: 80,
        reason: 'Valid email syntax.',
        provider: 'local',
        checks: baseChecks,
      };
    }

    try {
      const mxRecords = await resolveMx(domain);
      if (mxRecords.length > 0) {
        return {
          status: 'valid',
          score: 90,
          reason: 'Valid email syntax and MX records found.',
          provider: 'local',
          checks: {
            ...baseChecks,
            mxValid: true,
            mxRecords: mxRecords.map((record) => record.exchange),
          },
        };
      }

      return {
        status: 'unknown',
        score: 50,
        reason: 'MX lookup returned no records.',
        provider: 'local',
        checks: {
          ...baseChecks,
          mxValid: false,
        },
      };
    } catch (error: unknown) {
      return {
        status: 'unknown',
        score: 50,
        reason: 'MX lookup failed.',
        provider: 'local',
        checks: {
          ...baseChecks,
          mxValid: false,
          error: error instanceof Error ? error.message : 'MX lookup failed.',
        },
      };
    }
  } catch (error: unknown) {
    return {
      status: 'failed',
      score: 0,
      reason: 'Local email verification failed.',
      provider: 'local',
      checks: {
        ...baseChecks,
        error: error instanceof Error ? error.message : 'Local email verification failed.',
      },
    };
  }
}

export function buildLeadEmailVerificationFields(
  verification: LocalVerificationResult,
  checkedAt = new Date().toISOString()
) {
  return {
    email_verified: verification.status === 'valid',
    email_verification_status: verification.status,
    email_verification_score: verification.score,
    email_verification_provider: verification.provider,
    email_verification_reason: verification.reason,
    email_verified_at: checkedAt,
    email_verification_raw: verification,
  };
}
