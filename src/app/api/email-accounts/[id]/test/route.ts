import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { sendEmail } from '@/lib/mailers/send-email';
import { createAuditLog } from '@/lib/audit/create-audit-log';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { id } = await params;

  // 1. Authenticate user
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { targetEmail } = await request.json();
    if (!targetEmail) {
      return NextResponse.json({ error: 'Recipient email is required' }, { status: 400 });
    }

    // 2. Fetch email account from DB (full config, not masked)
    const { data: account, error: fetchError } = await supabase
      .from('email_accounts')
      .select('*')
      .eq('user_id', user.id)
      .eq('id', id)
      .single();

    if (fetchError || !account) {
      return NextResponse.json({ error: 'Email account not found' }, { status: 404 });
    }

    const subject = '🔔 Outreach OS - Test Connection Email';
    const html = `
      <div style="font-family: sans-serif; padding: 20px; color: #333;">
        <h2>Outreach OS Test Connection</h2>
        <p>Hello,</p>
        <p>This is a test email sent from <strong>The Digital Dude Outreach OS</strong> to verify your outbound mail delivery settings.</p>
        <p>If you are reading this, your connection to <strong>${account.email_address}</strong> via <strong>${account.provider.toUpperCase()}</strong> was verified successfully! 🚀</p>
        <br />
        <p>Best regards,<br/>The Digital Dude Outreach OS Team</p>
      </div>
    `;

    const result = await sendEmail(account.provider, account.config, {
      to: targetEmail,
      fromName: account.sender_name || 'Outreach OS Test',
      fromEmail: account.email_address,
      subject,
      html,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Connection test failed.' }, { status: 500 });
    }

    // Log the audit event
    await createAuditLog({
      userId: user.id,
      action: 'email_account_tested',
      message: `Email account ${account.email_address} tested successfully. Recipient: ${targetEmail}`,
      metadata: { provider: account.provider, email_address: account.email_address, targetEmail }
    });

    return NextResponse.json({ success: true, message: 'Test email sent successfully!' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
