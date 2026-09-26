export interface ContentValidationResult {
  valid: boolean;
  reason?: string;
}

const MIN_SUBJECT_LENGTH = 2;
const MAX_SUBJECT_LENGTH = 200;
const MIN_BODY_LENGTH = 20;
const MAX_BODY_LENGTH = 5000;
const UNRESOLVED_PLACEHOLDER_PATTERN = /\{\{\s*[a-zA-Z0-9_]+\s*\}\}/;

/**
 * Sanity-checks AI-generated (already per-lead-personalized) email content
 * before it's approved or sent. Not a substitute for human review — catches
 * empty/truncated output, leftover unresolved {{tokens}}, and obviously
 * malformed length, all of which indicate the content isn't safe to send.
 */
export function validateAiEmailContent(subject: string, body: string): ContentValidationResult {
  const trimmedSubject = (subject || '').trim();
  const trimmedBody = (body || '').trim();

  if (!trimmedSubject) return { valid: false, reason: 'Subject is empty.' };
  if (!trimmedBody) return { valid: false, reason: 'Body is empty.' };
  if (trimmedSubject.length < MIN_SUBJECT_LENGTH) return { valid: false, reason: 'Subject is too short.' };
  if (trimmedSubject.length > MAX_SUBJECT_LENGTH) return { valid: false, reason: 'Subject is too long.' };
  if (trimmedBody.length < MIN_BODY_LENGTH) return { valid: false, reason: 'Body is too short.' };
  if (trimmedBody.length > MAX_BODY_LENGTH) return { valid: false, reason: 'Body is too long.' };
  if (UNRESOLVED_PLACEHOLDER_PATTERN.test(trimmedSubject)) {
    return { valid: false, reason: 'Subject contains an unresolved {{placeholder}} token.' };
  }
  if (UNRESOLVED_PLACEHOLDER_PATTERN.test(trimmedBody)) {
    return { valid: false, reason: 'Body contains an unresolved {{placeholder}} token.' };
  }

  return { valid: true };
}
