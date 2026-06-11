import 'server-only';

const MS_AUTH_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize';
const MS_TOKEN_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';

const MS_SCOPES = ['offline_access', 'https://graph.microsoft.com/Mail.Send', 'https://graph.microsoft.com/User.Read'].join(' ');

export function getMicrosoftClientCredentials() {
  const clientId = process.env.MICROSOFT_OAUTH_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('Microsoft OAuth is not configured. Set MICROSOFT_OAUTH_CLIENT_ID and MICROSOFT_OAUTH_CLIENT_SECRET.');
  }
  return { clientId, clientSecret };
}

export function buildMicrosoftAuthUrl(redirectUri: string, state: string) {
  const { clientId } = getMicrosoftClientCredentials();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    response_mode: 'query',
    scope: MS_SCOPES,
    prompt: 'select_account',
    state,
  });
  return `${MS_AUTH_URL}?${params.toString()}`;
}

type MicrosoftTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
};

export async function exchangeMicrosoftCode(code: string, redirectUri: string) {
  const { clientId, clientSecret } = getMicrosoftClientCredentials();
  const response = await fetch(MS_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
      scope: MS_SCOPES,
    }),
  });

  const data = (await response.json()) as MicrosoftTokenResponse;
  if (!response.ok || !data.access_token || !data.refresh_token) {
    throw new Error(data.error_description || data.error || 'Microsoft token exchange failed');
  }

  const profileResponse = await fetch('https://graph.microsoft.com/v1.0/me?$select=mail,userPrincipalName', {
    headers: { Authorization: `Bearer ${data.access_token}` },
  });
  const profile = (await profileResponse.json()) as { mail?: string | null; userPrincipalName?: string | null };
  const email = (profile.mail || profile.userPrincipalName || '').toLowerCase();
  if (!email) {
    throw new Error('Could not determine the Outlook address for the connected account.');
  }

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: new Date(Date.now() + (data.expires_in || 3600) * 1000).toISOString(),
    email,
  };
}

export async function refreshMicrosoftAccessToken(refreshToken: string) {
  const { clientId, clientSecret } = getMicrosoftClientCredentials();
  const response = await fetch(MS_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
      scope: MS_SCOPES,
    }),
  });

  const data = (await response.json()) as MicrosoftTokenResponse;
  if (!response.ok || !data.access_token) {
    throw new Error(data.error_description || data.error || 'Microsoft token refresh failed. Reconnect the Outlook account.');
  }

  return {
    accessToken: data.access_token,
    expiresAt: new Date(Date.now() + (data.expires_in || 3600) * 1000).toISOString(),
    // Microsoft rotates refresh tokens; persist the new one when present.
    refreshToken: data.refresh_token,
  };
}
