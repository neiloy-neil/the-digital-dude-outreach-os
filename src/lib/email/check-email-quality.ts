import type { Lead } from '@/types/database.types';

export type EmailQualityIssue = {
  severity: 'error' | 'warning';
  message: string;
};

const BLOCKED_STATUSES = new Set(['bounced', 'unsubscribed', 'do_not_contact', 'excluded']);
const CTA_PATTERN = /\b(reply|call|chat|meet|demo|interested|open to|worth|available|schedule|talk)\b/i;
const VARIABLE_PATTERN = /\{\{[^}]+\}\}/;

export function checkEmailQuality(input: {
  subject?: string | null;
  bodyText?: string | null;
  bodyHtml?: string | null;
  lead?: Partial<Lead> | null;
}) {
  const subject = String(input.subject || '').trim();
  const bodyText = String(input.bodyText || '').trim();
  const bodyHtml = String(input.bodyHtml || '').trim();
  const combinedBody = `${bodyText}\n${bodyHtml}`;
  const issues: EmailQualityIssue[] = [];

  if (!subject) {
    issues.push({ severity: 'error', message: 'Subject is required.' });
  }

  if (!bodyText) {
    issues.push({ severity: 'error', message: 'Body is required.' });
  }

  if (bodyText.length > 2500) {
    issues.push({ severity: 'warning', message: 'Body is longer than 2,500 characters.' });
  }

  if (!/unsubscribe|\{\{unsubscribe_url\}\}/i.test(combinedBody)) {
    issues.push({ severity: 'warning', message: 'No unsubscribe language found. ReachMira will append it on send.' });
  }

  const bodyWithoutUnsubscribe = combinedBody.replace(/\{\{unsubscribe_url\}\}/gi, '');
  const subjectWithoutUnsubscribe = subject.replace(/\{\{unsubscribe_url\}\}/gi, '');

  if (VARIABLE_PATTERN.test(bodyWithoutUnsubscribe) || VARIABLE_PATTERN.test(subjectWithoutUnsubscribe)) {
    issues.push({ severity: 'error', message: 'Unreplaced template variables are still present.' });
  }

  if (bodyText && !CTA_PATTERN.test(bodyText)) {
    issues.push({ severity: 'warning', message: 'No clear call to action detected.' });
  }

  if (BLOCKED_STATUSES.has(String(input.lead?.status || '').toLowerCase())) {
    issues.push({ severity: 'error', message: 'This lead status blocks sending.' });
  }

  return issues;
}

export function hasBlockingEmailQualityIssue(issues: EmailQualityIssue[]) {
  return issues.some((issue) => issue.severity === 'error');
}
