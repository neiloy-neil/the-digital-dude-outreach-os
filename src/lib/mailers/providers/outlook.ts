import { EmailPayload, SendEmailResult } from '../types';
import { ensureAccessToken } from '@/lib/oauth/token-manager';

export async function sendOutlookEmail(
  config: Record<string, unknown>,
  payload: EmailPayload
): Promise<SendEmailResult> {
  try {
    const accessToken = await ensureAccessToken('outlook', config);

    const internetMessageHeaders = [
      payload.campaignId ? { name: 'X-Campaign-ID', value: payload.campaignId } : null,
      payload.leadId ? { name: 'X-Lead-ID', value: payload.leadId } : null,
      payload.stepNumber ? { name: 'X-Step-Number', value: String(payload.stepNumber) } : null,
    ].filter(Boolean);

    const message: Record<string, unknown> = {
      subject: payload.subject,
      body: { contentType: 'HTML', content: payload.html },
      toRecipients: [{ emailAddress: { address: payload.to } }],
      replyTo: [{ emailAddress: { address: payload.replyTo || payload.fromEmail } }],
    };
    if (internetMessageHeaders.length > 0) {
      message.internetMessageHeaders = internetMessageHeaders;
    }

    const response = await fetch('https://graph.microsoft.com/v1.0/me/sendMail', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message, saveToSentItems: true }),
    });

    // Graph returns 202 Accepted with an empty body on success.
    if (response.status === 202) {
      return { success: true, provider: 'outlook' };
    }

    let errorMessage = `Microsoft Graph error (${response.status})`;
    try {
      const data = (await response.json()) as { error?: { message?: string } };
      errorMessage = data.error?.message || errorMessage;
    } catch {
      // empty/non-JSON error body — keep the status-based message
    }

    return { success: false, provider: 'outlook', error: errorMessage };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      provider: 'outlook',
      error: message,
    };
  }
}
