import nodemailer from 'nodemailer';

interface SendSMTPParams {
  host: string;
  port: number;
  user: string;
  pass: string;
  fromName: string;
  fromEmail: string;
  to: string;
  subject: string;
  text: string;
}

export async function sendSMTPEmail({
  host,
  port,
  user,
  pass,
  fromName,
  fromEmail,
  to,
  subject,
  text,
}: SendSMTPParams): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const isSecure = port === 465; // Port 465 usually utilizes implicit SSL/TLS

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: isSecure,
      auth: {
        user,
        pass,
      },
      tls: {
        // Do not fail on invalid certs (especially useful for cPanel / private mail servers)
        rejectUnauthorized: false,
      },
    });

    const mailOptions = {
      from: `"${fromName}" <${fromEmail}>`,
      to,
      subject,
      text,
    };

    const info = await transporter.sendMail(mailOptions);

    return {
      success: true,
      messageId: info.messageId,
    };
  } catch (error: any) {
    console.error('SMTP send error:', error);
    return {
      success: false,
      error: error.message || 'Unknown SMTP transfer error',
    };
  }
}
