import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { sendOutreachEmail } from '@/utils/mailgun';
import { sendSMTPEmail } from '@/utils/smtp';

export async function POST(request: Request) {
  const supabase = await createClient();

  // 1. Authenticate user
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { 
      targetEmail, 
      mailgunApiKey, 
      mailgunDomain, 
      mailgunFromEmail, 
      mailgunFromName,
      smtpHost,
      smtpPort,
      smtpUser,
      smtpPass
    } = await request.json();

    if (!targetEmail) {
      return NextResponse.json({ error: 'Recipient email is required' }, { status: 400 });
    }

    const hasSMTP = !!(smtpHost && smtpUser && smtpPass);
    const hasMailgun = !!(mailgunApiKey && mailgunDomain && mailgunFromEmail);

    if (!hasSMTP && !hasMailgun) {
      return NextResponse.json({ error: 'Please configure either SMTP or Mailgun settings first' }, { status: 400 });
    }

    const subject = '🔔 Outreach OS - Test Connection Email';
    const body = `Hi there,

This is a test email sent from your outreach system ("The Digital Dude Outreach OS") to verify your mail delivery credentials connection.

If you received this, your outbound sending setup is working correctly! 🚀

Best,
The Digital Dude Outreach OS Team`;

    if (hasSMTP) {
      const result = await sendSMTPEmail({
        host: smtpHost,
        port: smtpPort ? Number(smtpPort) : 465,
        user: smtpUser,
        pass: smtpPass,
        fromName: mailgunFromName || 'Outreach OS Test',
        fromEmail: smtpUser,
        to: targetEmail,
        subject,
        text: body,
      });

      if (!result.success) {
        return NextResponse.json({ error: result.error || 'SMTP sending failed' }, { status: 500 });
      }
      return NextResponse.json({ success: true, message: 'SMTP test email sent successfully!' });
    } else {
      const result = await sendOutreachEmail({
        apiKey: mailgunApiKey,
        domain: mailgunDomain,
        fromName: mailgunFromName || 'Outreach OS Test',
        fromEmail: mailgunFromEmail,
        to: targetEmail,
        subject,
        text: body,
        campaignId: 'test-campaign-id',
        leadId: 'test-lead-id',
        outboxId: 'test-outbox-id',
      });

      if (!result.success) {
        return NextResponse.json({ error: result.error || 'Mailgun sending failed' }, { status: 500 });
      }
      return NextResponse.json({ success: true, message: 'Mailgun test email sent successfully!' });
    }
  } catch (err: any) {
    console.error('Test email route crash:', err);
    return NextResponse.json({ error: err.message || 'Server error sending test email' }, { status: 500 });
  }
}
