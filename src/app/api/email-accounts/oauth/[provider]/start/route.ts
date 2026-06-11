import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { buildGoogleAuthUrl } from '@/lib/oauth/google';
import { buildMicrosoftAuthUrl } from '@/lib/oauth/microsoft';
import { OAUTH_STATE_COOKIE, getAppBaseUrl } from '@/lib/oauth/shared';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { provider } = await params;
  const baseUrl = getAppBaseUrl(request);

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.redirect(`${baseUrl}/login`);
  }

  if (provider !== 'gmail' && provider !== 'outlook') {
    return NextResponse.json({ error: `Unsupported OAuth provider: ${provider}` }, { status: 400 });
  }

  const redirectUri = `${baseUrl}/api/email-accounts/oauth/${provider}/callback`;
  const state = crypto.randomBytes(16).toString('hex');

  let authUrl: string;
  try {
    authUrl = provider === 'gmail'
      ? buildGoogleAuthUrl(redirectUri, state)
      : buildMicrosoftAuthUrl(redirectUri, state);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'OAuth is not configured';
    return NextResponse.redirect(
      `${baseUrl}/settings/email-accounts?oauth_error=${encodeURIComponent(message)}`
    );
  }

  const response = NextResponse.redirect(authUrl);
  response.cookies.set(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: baseUrl.startsWith('https'),
    sameSite: 'lax',
    path: '/',
    maxAge: 600,
  });
  return response;
}
