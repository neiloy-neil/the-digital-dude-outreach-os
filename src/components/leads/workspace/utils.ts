import { htmlToPlainText } from '@/lib/email/html';

export function normalizeWebsite(website?: string | null) {
  if (!website) return '';
  return website.startsWith('http') ? website : `https://${website}`;
}

export function formatDate(value?: string | null) {
  if (!value) return '-';
  return new Date(value).toLocaleString();
}

export function eventTimestamp(event: { created_at?: string; sent_at?: string }) {
  return event.created_at || event.sent_at || '';
}

export function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function metadataString(metadata: Record<string, unknown>, key: string) {
  const value = metadata[key];
  if (typeof value === 'string') return value;
  if (value === null || value === undefined) return '';
  return String(value);
}

export function metadataRecord(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

export function isReplyAction(value?: string | null) {
  return ['reply_received', 'replied', 'email_replied', 'lead_replied'].includes(String(value || '').toLowerCase());
}

export function getReplyBodyText(reply: { bodyText?: string; bodyHtml?: string; snippet?: string }) {
  return reply.bodyText || htmlToPlainText(reply.bodyHtml || '') || reply.snippet || '';
}
