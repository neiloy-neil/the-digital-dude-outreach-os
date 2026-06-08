import 'server-only';

import { EmailPayload, SendEmailResult } from './types';
import { sendSMTPEmail } from './providers/smtp';
import { sendMailgunEmail } from './providers/mailgun';
import { sendResendEmail } from './providers/resend';
import { sendAmazonSESEmail } from './providers/amazon-ses';
import { EmailProviderType } from '@/types/email-provider';

export async function sendEmail(
  provider: EmailProviderType,
  config: Record<string, unknown>,
  payload: EmailPayload
): Promise<SendEmailResult> {
  switch (provider) {
    case 'smtp':
      return sendSMTPEmail(config as unknown as Parameters<typeof sendSMTPEmail>[0], payload);
    case 'mailgun':
      return sendMailgunEmail(config as unknown as Parameters<typeof sendMailgunEmail>[0], payload);
    case 'resend':
      return sendResendEmail(config as unknown as Parameters<typeof sendResendEmail>[0], payload);
    case 'amazon_ses':
      return sendAmazonSESEmail(config as unknown as Parameters<typeof sendAmazonSESEmail>[0], payload);
    default:
      return {
        success: false,
        provider,
        error: `Unsupported provider: ${provider}`,
      };
  }
}
