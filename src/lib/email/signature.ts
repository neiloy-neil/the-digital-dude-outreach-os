import { htmlToPlainText, normalizeDraftHtml } from './html';

const SIGNATURE_MARKER = 'reachmira-email-signature';

function asString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttribute(value: string) {
  return escapeHtml(value).replace(/`/g, '&#96;');
}

export function sanitizeSignatureHtml(value?: string | null) {
  return normalizeDraftHtml(value || '')
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, '')
    .replace(/\son\w+=(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/\s(?:href|src)=["']?\s*javascript:[^"'\s>]*/gi, '')
    .replace(/<(iframe|object|embed|form|input|button|textarea|select|meta|link)[\s\S]*?>[\s\S]*?<\/\1>/gi, '')
    .replace(/<(iframe|object|embed|form|input|button|textarea|select|meta|link)\b[^>]*\/?>/gi, '');
}

export function buildEmailSignatureHtml(config?: Record<string, unknown> | null, fallbackName?: string | null) {
  if (!config?.signature_enabled) return '';

  const customHtml = sanitizeSignatureHtml(asString(config.signature_html));
  const hasCustomHtml = htmlToPlainText(customHtml).trim().length > 0;
  const signatureName = asString(config.signature_name) || asString(fallbackName);
  const signatureTitle = asString(config.signature_title);
  const signatureCompany = asString(config.signature_company);
  const signatureWebsite = asString(config.signature_website);
  const signaturePhone = asString(config.signature_phone);
  const signatureLogoUrl = asString(config.signature_logo_url);
  const signatureLinkedInUrl = asString(config.signature_linkedin_url);
  const signatureTwitterUrl = asString(config.signature_twitter_url);

  const lines = [
    signatureName ? `<strong>${escapeHtml(signatureName)}</strong>` : '',
    signatureTitle ? escapeHtml(signatureTitle) : '',
    signatureCompany ? escapeHtml(signatureCompany) : '',
    signaturePhone ? `Phone: ${escapeHtml(signaturePhone)}` : '',
    signatureWebsite
      ? `<a href="${escapeAttribute(signatureWebsite)}" style="color:#2563eb;text-decoration:none;">${escapeHtml(signatureWebsite)}</a>`
      : '',
  ].filter(Boolean);

  const socialLinks = [
    signatureLinkedInUrl
      ? `<a href="${escapeAttribute(signatureLinkedInUrl)}" style="color:#2563eb;text-decoration:none;">LinkedIn</a>`
      : '',
    signatureTwitterUrl
      ? `<a href="${escapeAttribute(signatureTwitterUrl)}" style="color:#2563eb;text-decoration:none;">Social</a>`
      : '',
  ].filter(Boolean);

  const generatedHtml = [
    signatureLogoUrl
      ? `<img src="${escapeAttribute(signatureLogoUrl)}" alt="${escapeAttribute(signatureCompany || signatureName || 'Signature logo')}" style="max-width:120px;max-height:48px;margin-bottom:8px;" />`
      : '',
    lines.length > 0 ? `<div>${lines.join('<br />')}</div>` : '',
    socialLinks.length > 0 ? `<div style="margin-top:6px;">${socialLinks.join(' &middot; ')}</div>` : '',
  ].filter(Boolean).join('');

  const body = hasCustomHtml ? customHtml : generatedHtml;
  if (!body) return '';

  return `<div data-reachmira-signature="true" class="${SIGNATURE_MARKER}" style="margin-top:24px;">${body}</div>`;
}

export function buildFallbackSenderSignatureHtml(fallbackName?: string | null) {
  const senderName = asString(fallbackName);
  if (!senderName) return '';

  return `<div data-reachmira-signature="true" class="${SIGNATURE_MARKER}" style="margin-top:24px;"><strong>${escapeHtml(senderName)}</strong></div>`;
}

export function buildSendSignatureHtml(config?: Record<string, unknown> | null, fallbackName?: string | null) {
  return buildEmailSignatureHtml(config, fallbackName) || buildFallbackSenderSignatureHtml(fallbackName);
}

export function appendEmailSignature(body: string, config?: Record<string, unknown> | null, fallbackName?: string | null, includeSignature = true) {
  const normalizedBody = normalizeDraftHtml(body);
  if (!includeSignature || normalizedBody.includes('data-reachmira-signature="true"') || normalizedBody.includes(SIGNATURE_MARKER)) {
    return normalizedBody;
  }

  const signatureHtml = buildSendSignatureHtml(config, fallbackName);
  if (!signatureHtml) return normalizedBody;

  if (/<\/body>/i.test(normalizedBody)) {
    return normalizedBody.replace(/<\/body>/i, `${signatureHtml}</body>`);
  }

  return `${normalizedBody}${signatureHtml}`;
}

export function buildEmailSignatureText(config?: Record<string, unknown> | null, fallbackName?: string | null) {
  const configuredText = asString(config?.signature_text);
  if (configuredText) return configuredText;
  return htmlToPlainText(buildEmailSignatureHtml(config, fallbackName));
}
