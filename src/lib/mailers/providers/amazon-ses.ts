import { EmailPayload, SendEmailResult } from '../types';
import { AmazonSESConfig } from '@/types/email-provider';

export async function sendAmazonSESEmail(config: AmazonSESConfig, payload: EmailPayload): Promise<SendEmailResult> {
  return {
    success: false,
    provider: 'amazon_ses',
    error: 'Amazon SES provider is not implemented yet. Coming soon!',
  };
}
