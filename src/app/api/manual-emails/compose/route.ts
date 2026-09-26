import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { POST as sendManualEmail } from '@/app/api/leads/[id]/manual-send/route';

const EMAIL_FORMAT = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const {
      to,
      subject,
      body,
      emailAccountId,
      includeSignature = true,
      confirmVerificationRisk = false,
    } = await request.json();

    const recipientEmail = String(to || '').trim().toLowerCase();
    if (!recipientEmail || !EMAIL_FORMAT.test(recipientEmail)) {
      return NextResponse.json({ error: 'A valid recipient email is required' }, { status: 400 });
    }
    if (!String(subject || '').trim()) {
      return NextResponse.json({ error: 'Subject is required' }, { status: 400 });
    }
    if (!String(body || '').trim()) {
      return NextResponse.json({ error: 'Email body is required' }, { status: 400 });
    }

    // Every sent email needs a lead row to hang tracking, suppression, and
    // unsubscribe links off of, so find-or-create a minimal library lead
    // for this recipient rather than requiring one to exist beforehand.
    const { data: existingLead } = await supabase
      .from('leads')
      .select('id, manual_email_approved')
      .eq('user_id', user.id)
      .eq('email', recipientEmail)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    let leadId = existingLead?.id as string | undefined;

    if (!leadId) {
      const { data: newLead, error: insertError } = await supabase
        .from('leads')
        .insert({
          user_id: user.id,
          campaign_id: null,
          email: recipientEmail,
          is_global: true,
          owner_type: 'library',
          status: 'new',
          manual_personalization_status: 'not_started',
          manual_email_approved: true,
        })
        .select('id')
        .single();

      if (insertError || !newLead) {
        throw insertError || new Error('Failed to create lead for this recipient');
      }
      leadId = newLead.id;
    } else if (!existingLead?.manual_email_approved) {
      await supabase.from('leads').update({ manual_email_approved: true }).eq('id', leadId);
    }

    const innerRequest = new Request(request.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: 'send_now',
        targetEmail: recipientEmail,
        emailAccountId: emailAccountId || null,
        subject,
        body,
        emailType: 'custom_email',
        includeSignature,
        confirmVerificationRisk,
      }),
    });

    return sendManualEmail(innerRequest, { params: Promise.resolve({ id: leadId as string }) });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to send email';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
