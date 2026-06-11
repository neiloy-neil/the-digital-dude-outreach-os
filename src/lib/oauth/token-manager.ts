import 'server-only';

import { createServiceClient } from '@/utils/supabase/service';
import { refreshGoogleAccessToken } from './google';
import { refreshMicrosoftAccessToken } from './microsoft';

const EXPIRY_BUFFER_MS = 60 * 1000;

/**
 * Returns a valid OAuth access token for a gmail/outlook email account config,
 * refreshing it when missing or near expiry. When the config carries
 * `__account_id` (injected by send call sites), refreshed tokens are persisted
 * back to `email_accounts.config` so rotated refresh tokens are not lost.
 */
export async function ensureAccessToken(
  provider: 'gmail' | 'outlook',
  config: Record<string, unknown>
): Promise<string> {
  const accessToken = typeof config.access_token === 'string' ? config.access_token : '';
  const expiresAtRaw = typeof config.token_expires_at === 'string' ? config.token_expires_at : '';
  const expiresAt = expiresAtRaw ? Date.parse(expiresAtRaw) : NaN;

  if (accessToken && Number.isFinite(expiresAt) && expiresAt - Date.now() > EXPIRY_BUFFER_MS) {
    return accessToken;
  }

  const refreshToken = typeof config.refresh_token === 'string' ? config.refresh_token : '';
  if (!refreshToken) {
    throw new Error(`No refresh token stored for this ${provider} account. Reconnect it in Settings → Email Accounts.`);
  }

  const refreshed =
    provider === 'gmail'
      ? { ...(await refreshGoogleAccessToken(refreshToken)), refreshToken: undefined as string | undefined }
      : await refreshMicrosoftAccessToken(refreshToken);

  const accountId = typeof config.__account_id === 'string' ? config.__account_id : '';
  if (accountId) {
    try {
      const supabase = createServiceClient();
      const { data: account } = await supabase
        .from('email_accounts')
        .select('config')
        .eq('id', accountId)
        .single();

      if (account) {
        await supabase
          .from('email_accounts')
          .update({
            config: {
              ...(account.config || {}),
              access_token: refreshed.accessToken,
              token_expires_at: refreshed.expiresAt,
              ...(refreshed.refreshToken ? { refresh_token: refreshed.refreshToken } : {}),
            },
            updated_at: new Date().toISOString(),
          })
          .eq('id', accountId);
      }
    } catch (persistError) {
      // Sending should not fail just because the token cache write failed.
      console.error(`Failed to persist refreshed ${provider} tokens for account ${accountId}:`, persistError);
    }
  }

  return refreshed.accessToken;
}
