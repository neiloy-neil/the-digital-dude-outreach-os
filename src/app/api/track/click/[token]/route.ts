import { NextResponse } from 'next/server';
import { createServiceClient } from '@/utils/supabase/service';
import { verifyClickSignature } from '@/lib/email/tracking';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const url = new URL(request.url);
  const destination = url.searchParams.get('u') || '';
  const signature = url.searchParams.get('s') || '';

  const fallbackUrl = process.env.NEXT_PUBLIC_APP_URL || url.origin;

  const isValidDestination = /^https?:\/\//i.test(destination);
  const isValidSignature =
    Boolean(token && destination && signature) && verifyClickSignature(token, destination, signature);

  if (!isValidDestination || !isValidSignature) {
    return NextResponse.redirect(fallbackUrl, 302);
  }

  try {
    const supabase = createServiceClient();
    const nowIso = new Date().toISOString();

    const { data: sentEmail } = await supabase
      .from('sent_emails')
      .select('id, opened_at, clicked_at')
      .eq('tracking_token', token)
      .maybeSingle();

    if (sentEmail) {
      await supabase
        .from('sent_emails')
        .update({
          clicked_at: sentEmail.clicked_at || nowIso,
          // A click implies the email was opened, even if the pixel was blocked.
          opened_at: sentEmail.opened_at || nowIso,
        })
        .eq('id', sentEmail.id);
    }
  } catch (err) {
    console.error('Click tracking failed:', err);
  }

  // The destination must always work, even if tracking fails.
  return NextResponse.redirect(destination, 302);
}
