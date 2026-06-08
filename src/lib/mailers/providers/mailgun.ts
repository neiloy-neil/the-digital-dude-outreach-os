import { EmailPayload, SendEmailResult } from '../types';
import { MailgunConfig } from '@/types/email-provider';

export async function sendMailgunEmail(config: MailgunConfig, payload: EmailPayload): Promise<SendEmailResult> {
  try {
    const { api_key, domain, region } = config;
    if (!api_key || !domain) {
      throw new Error('Mailgun config requires api_key and domain.');
    }

    const host = region === 'eu' ? 'api.eu.mailgun.net' : 'api.mailgun.net';
    const url = `https://${host}/v3/${domain}/messages`;

    const form = new URLSearchParams();
    form.append('from', payload.fromName ? `"${payload.fromName}" <${payload.fromEmail}>` : payload.fromEmail);
    form.append('to', payload.to);
    form.append('subject', payload.subject);
    form.append('html', payload.html);
    if (payload.text) {
      form.append('text', payload.text);
    } else {
      form.append('text', payload.html.replace(/<[^>]*>/g, ''));
    }

    if (payload.replyTo) {
      form.append('h:Reply-To', payload.replyTo);
    }

    // Custom metadata / variables for tracking
    if (payload.campaignId) {
      form.append('v:campaign_id', payload.campaignId);
    }
    if (payload.leadId) {
      form.append('v:lead_id', payload.leadId);
    }
    if (payload.stepNumber) {
      form.append('v:step_number', String(payload.stepNumber));
    }

    if (payload.metadata) {
      for (const [key, val] of Object.entries(payload.metadata)) {
        form.append(`v:${key}`, typeof val === 'object' ? JSON.stringify(val) : String(val));
      }
    }

    const authHeader = 'Basic ' + Buffer.from(`api:${api_key}`).toString('base64');

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: form.toString(),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.message || JSON.stringify(data));
    }

    return {
      success: true,
      provider: 'mailgun',
      messageId: data.id,
      raw: data,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      provider: 'mailgun',
      error: message,
    };
  }
}
