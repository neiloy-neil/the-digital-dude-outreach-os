import 'server-only';

import crypto from 'node:crypto';
import * as cheerio from 'cheerio';

function getTrackingSecret() {
  return process.env.TRACKING_SECRET || process.env.CRON_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
}

export function generateTrackingToken(): string {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * Click URLs carry an HMAC signature over token+destination so the redirect
 * endpoint cannot be abused as an open redirect from our domain.
 */
export function signClickUrl(token: string, destinationUrl: string): string {
  return crypto
    .createHmac('sha256', getTrackingSecret())
    .update(`${token}:${destinationUrl}`)
    .digest('hex')
    .slice(0, 32);
}

export function verifyClickSignature(token: string, destinationUrl: string, signature: string): boolean {
  const expected = signClickUrl(token, destinationUrl);
  return (
    signature.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(signature, 'utf8'), Buffer.from(expected, 'utf8'))
  );
}

export function buildClickUrl(baseUrl: string, token: string, destinationUrl: string): string {
  const params = new URLSearchParams({ u: destinationUrl, s: signClickUrl(token, destinationUrl) });
  return `${baseUrl}/api/track/click/${token}?${params.toString()}`;
}

export function buildOpenPixelUrl(baseUrl: string, token: string): string {
  return `${baseUrl}/api/track/open/${token}`;
}

function isTrackableHref(href: string, baseUrl: string): boolean {
  const value = href.trim();
  if (!/^https?:\/\//i.test(value)) return false; // mailto:, tel:, #anchors, relative
  if (value.toLowerCase().includes('/unsubscribe')) return false; // keep compliance links direct
  if (value.startsWith(`${baseUrl}/api/track/`)) return false; // already instrumented
  return true;
}

/**
 * Rewrites links to pass through the click-tracking redirect and appends an
 * open-tracking pixel. Send the returned HTML; store the original in
 * `sent_emails.body_html` so in-app previews never fire false opens.
 */
export function instrumentEmailHtml(html: string, token: string, baseUrl: string): string {
  let output = html;

  try {
    const $ = cheerio.load(html, undefined, false);
    $('a[href]').each((_index, element) => {
      const href = $(element).attr('href') || '';
      if (isTrackableHref(href, baseUrl)) {
        $(element).attr('href', buildClickUrl(baseUrl, token, href));
      }
    });
    output = $.html();
  } catch {
    // If parsing fails, fall back to the untouched HTML — still append the pixel.
    output = html;
  }

  const pixel = `<img src="${buildOpenPixelUrl(baseUrl, token)}" width="1" height="1" style="display:none;max-width:1px;max-height:1px;" alt="" />`;
  if (/<\/body>/i.test(output)) {
    return output.replace(/<\/body>/i, `${pixel}</body>`);
  }
  return `${output}${pixel}`;
}
