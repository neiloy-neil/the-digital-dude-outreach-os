import { EmailPayload, SendEmailResult } from '../types';
import { ResendConfig } from '@/types/email-provider';

export async function sendResendEmail(config: ResendConfig, payload: EmailPayload): Promise<SendEmailResult> {
  return {
    success: false,
    provider: 'resend',
    error: 'Resend provider is not implemented yet. Coming soon!',
  };
}
