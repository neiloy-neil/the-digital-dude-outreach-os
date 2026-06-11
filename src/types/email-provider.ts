export type EmailProviderType = 'smtp' | 'mailgun' | 'resend' | 'amazon_ses' | 'gmail' | 'outlook';

export interface SMTPConfig {
  host: string;
  port: number;
  secure: boolean;
  username: string;
  password?: string;
}

export interface MailgunConfig {
  api_key?: string;
  domain: string;
  region: 'us' | 'eu';
  webhook_signing_key?: string;
}

export interface ResendConfig {
  api_key?: string;
  from_domain?: string;
}

export interface AmazonSESConfig {
  access_key_id: string;
  secret_access_key?: string;
  region: string;
  from_domain?: string;
}

export interface OAuthMailConfig {
  refresh_token?: string;
  access_token?: string;
  token_expires_at?: string; // ISO timestamp for access_token expiry
  connected_at?: string;
}

export type EmailProviderConfig = SMTPConfig | MailgunConfig | ResendConfig | AmazonSESConfig | OAuthMailConfig;

export type MaskedEmailAccountConfig = {
  [key: string]: string | number | boolean | null | undefined;
};

/**
 * Masks sensitive credential values in the email account config before sending to the client UI.
 */
export function maskEmailAccountConfig(
  providerOrConfig: EmailProviderType | Record<string, unknown>,
  config?: Record<string, unknown>,
): MaskedEmailAccountConfig {
  const sourceConfig = (config || providerOrConfig) as Record<string, unknown>;
  const provider = typeof providerOrConfig === 'string' ? providerOrConfig : undefined;
  const masked = { ...sourceConfig } as MaskedEmailAccountConfig;

  const maskKey = (key: string) => {
    if (masked[key] !== undefined && masked[key] !== null && masked[key] !== '') {
      masked[key] = '********';
    }
  };

  if (!provider || provider === 'smtp') {
    maskKey('password');
  }
  if (!provider || provider === 'mailgun') {
    maskKey('api_key');
    maskKey('webhook_signing_key');
  }
  if (!provider || provider === 'resend') {
    maskKey('api_key');
  }
  if (!provider || provider === 'amazon_ses') {
    maskKey('secret_access_key');
  }
  if (!provider || provider === 'gmail' || provider === 'outlook') {
    maskKey('refresh_token');
    maskKey('access_token');
  }

  return masked;
}
