export interface EmailPayload {
  to: string;
  fromName: string;
  fromEmail: string;
  replyTo?: string;
  subject: string;
  html: string;
  text?: string;
  campaignId?: string;
  leadId?: string;
  stepNumber?: number;
  metadata?: Record<string, unknown>;
}

export interface SendEmailResult {
  success: boolean;
  provider: 'smtp' | 'mailgun' | 'resend' | 'amazon_ses';
  messageId?: string;
  error?: string;
  raw?: unknown;
}
