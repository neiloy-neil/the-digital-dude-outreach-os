import nodemailer from 'nodemailer';
import { EmailPayload, SendEmailResult } from '../types';
import { SMTPConfig } from '@/types/email-provider';

export async function sendSMTPEmail(config: SMTPConfig, payload: EmailPayload): Promise<SendEmailResult> {
  try {
    const transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure, // true for 465, false for others (e.g. 587)
      auth: {
        user: config.username,
        pass: config.password,
      },
      tls: {
        rejectUnauthorized: false, // Useful for self-signed cPanel certs
      },
    });

    const mailOptions = {
      from: payload.fromName ? `"${payload.fromName}" <${payload.fromEmail}>` : payload.fromEmail,
      to: payload.to,
      replyTo: payload.replyTo || payload.fromEmail,
      subject: payload.subject,
      html: payload.html,
      text: payload.text || payload.html.replace(/<[^>]*>/g, ''), // Basic html-to-text fallback
      headers: {
        'X-Campaign-ID': payload.campaignId || '',
        'X-Lead-ID': payload.leadId || '',
        'X-Step-Number': payload.stepNumber ? String(payload.stepNumber) : '',
      },
    };

    const info = await transporter.sendMail(mailOptions);

    return {
      success: true,
      provider: 'smtp',
      messageId: info.messageId,
      raw: info,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      provider: 'smtp',
      error: message,
    };
  }
}
