import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/utils/supabase/server';
import { exchangeGoogleCode } from '@/lib/oauth/google';
import { exchangeMicrosoftCode } from '@/lib/oauth/microsoft';
import { OAUTH_STATE_COOKIE, getAppBaseUrl } from '@/lib/oauth/shared';
import { createAuditLog } from '@/lib/audit/create-audit-log';

function settingsRedirect(baseUrl: string, query: Record<string, string>) {
  const params = new URLSearchParams(query);
  const response = NextResponse.redirect(`${baseUrl}/settings/email-accounts?${params.toString()}`);
  response.cookies.set(OAUTH_STATE_COOKIE, '', { path: '/', maxAge: 0 });
  return response;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { provider } = await params;
  const baseUrl = getAppBaseUrl(request);
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const providerError = url.searchParams.get('error_description') || url.searchParams.get('error');

  if (provider !== 'gmail' && provider !== 'outlook') {
    return settingsRedirect(baseUrl, { oauth_error: `Unsupported OAuth provider: ${provider}` });
  }

  const providerLabel = provider === 'gmail' ? 'Gmail' : 'Outlook';

  if (providerError) {
    return settingsRedirect(baseUrl, { oauth_error: `${providerLabel} connection was cancelled: ${providerError}` });
  }
  if (!code || !state) {
    return settingsRedirect(baseUrl, { oauth_error: `Missing authorization code from ${providerLabel}.` });
  }

  const cookieStore = await cookies();
  const storedState = cookieStore.get(OAUTH_STATE_COOKIE)?.value;
  if (!storedState || storedState !== state) {
    return settingsRedirect(baseUrl, { oauth_error: 'OAuth state mismatch. Please try connecting again.' });
  }

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.redirect(`${baseUrl}/login`);
  }

  try {
    const redirectUri = `${baseUrl}/api/email-accounts/oauth/${provider}/callback`;
    const tokens = provider === 'gmail'
      ? await exchangeGoogleCode(code, redirectUri)
      : await exchangeMicrosoftCode(code, redirectUri);

    const oauthConfig = {
      refresh_token: tokens.refreshToken,
      access_token: tokens.accessToken,
      token_expires_at: tokens.expiresAt,
      connected_at: new Date().toISOString(),
    };

    // Re-connecting an already linked mailbox refreshes its tokens in place.
    const { data: existingAccount } = await supabase
      .from('email_accounts')
      .select('id, config')
      .eq('user_id', user.id)
      .eq('provider', provider)
      .eq('email_address', tokens.email)
      .maybeSingle();

    if (existingAccount) {
      const { error: updateError } = await supabase
        .from('email_accounts')
        .update({
          config: { ...(existingAccount.config || {}), ...oauthConfig },
          status: 'active',
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingAccount.id);
      if (updateError) throw new Error(updateError.message);
    } else {
      const { count, error: countError } = await supabase
        .from('email_accounts')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);
      const forceDefault = Boolean(countError) || count === 0;

      const { data: newAccount, error: insertError } = await supabase
        .from('email_accounts')
        .insert({
          user_id: user.id,
          provider,
          email_address: tokens.email,
          sender_name: null,
          config: oauthConfig,
          daily_send_limit: 30,
          is_default: forceDefault,
          warmup_enabled: false,
          status: 'active',
        })
        .select()
        .single();
      if (insertError) throw new Error(insertError.message);

      await createAuditLog({
        userId: user.id,
        action: 'email_account_created',
        message: `Email account ${tokens.email} (${provider}) connected via OAuth.`,
        metadata: { provider, email_address: tokens.email, account_id: newAccount.id },
      });
    }

    return settingsRedirect(baseUrl, {
      oauth_success: `${providerLabel} account ${tokens.email} connected successfully.`,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : `Failed to connect ${providerLabel} account`;
    return settingsRedirect(baseUrl, { oauth_error: message });
  }
}
