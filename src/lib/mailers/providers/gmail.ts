import crypto from 'node:crypto';
import { EmailPayload, SendEmailResult } from '../types';
import { ensureAccessToken } from '@/lib/oauth/token-manager';

function encodeHeaderValue(value: string) {
  // RFC 2047 encoded-word for non-ASCII header values (e.g. subjects, names)
  return /[^\x20-\x7E]/.test(value) ? `=?UTF-8?B?${Buffer.from(value, 'utf8').toString('base64')}?=` : value;
}

function formatFromHeader(fromName: string, fromEmail: string) {
  if (!fromName) return fromEmail;
  const safeName = encodeHeaderValue(fromName.replace(/"/g, "'"));
  return `"${safeName}" <${fromEmail}>`;
}

function buildRawMime(payload: EmailPayload) {
  const boundary = `reachmira_${crypto.randomBytes(12).toString('hex')}`;
  const text = payload.text || payload.html.replace(/<[^>]*>/g, '');

  const headers = [
    `From: ${formatFromHeader(payload.fromName, payload.fromEmail)}`,
    `To: ${payload.to}`,
    `Reply-To: ${payload.replyTo || payload.fromEmail}`,
    `Subject: ${encodeHeaderValue(payload.subject)}`,
    payload.campaignId ? `X-Campaign-ID: ${payload.campaignId}` : '',
    payload.leadId ? `X-Lead-ID: ${payload.leadId}` : '',
    payload.stepNumber ? `X-Step-Number: ${payload.stepNumber}` : '',
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
  ].filter(Boolean);

  const body = [
    `--${boundary}`,
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    Buffer.from(text, 'utf8').toString('base64'),
    `--${boundary}`,
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    Buffer.from(payload.html, 'utf8').toString('base64'),
    `--${boundary}--`,
  ];

  return `${headers.join('\r\n')}\r\n\r\n${body.join('\r\n')}`;
}

export async function sendGmailEmail(
  config: Record<string, unknown>,
  payload: EmailPayload
): Promise<SendEmailResult> {
  try {
    const accessToken = await ensureAccessToken('gmail', config);
    const raw = Buffer.from(buildRawMime(payload), 'utf8').toString('base64url');

    const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ raw }),
    });

    const data = (await response.json()) as { id?: string; error?: { message?: string } };
    if (!response.ok) {
      return {
        success: false,
        provider: 'gmail',
        error: data.error?.message || `Gmail API error (${response.status})`,
        raw: data,
      };
    }

    return {
      success: true,
      provider: 'gmail',
      messageId: data.id,
      raw: data,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      provider: 'gmail',
      error: message,
    };
  }
}
