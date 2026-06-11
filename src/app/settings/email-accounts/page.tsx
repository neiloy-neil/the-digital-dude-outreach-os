'use client';

export const dynamic = 'force-dynamic';

import { useMemo, useState, useEffect } from 'react';
import AppShell from '@/components/reachmira/AppShell';
import PageHeader from '@/components/reachmira/PageHeader';
import RichTextEditor from '@/components/leads/RichTextEditor';
import { buildEmailSignatureHtml, buildSendSignatureHtml, sanitizeSignatureHtml } from '@/lib/email/signature';
import {
  Mail, Plus, Trash2,
  Flame, Zap, Eye, Wand2
} from 'lucide-react';
import { Button, Banner, Modal, ConfirmDialog, Field, Input, Select } from '@/components/reachmira/ui';

type EmailAccountConfig = Record<string, string | number | boolean | null | undefined>;

interface EmailAccount {
  id: string;
  provider: 'smtp' | 'mailgun' | 'resend' | 'amazon_ses' | 'gmail' | 'outlook';
  email_address: string;
  sender_name?: string | null;
  config: EmailAccountConfig;
  daily_send_limit: number;
  daily_sent_count: number;
  is_default: boolean;
  warmup_enabled: boolean;
  status: 'active' | 'inactive';
}

export default function EmailAccountsPage() {
  const [accounts, setAccounts] = useState<EmailAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<EmailAccount | null>(null);
  const [provider, setProvider] = useState<'smtp' | 'mailgun' | 'gmail' | 'outlook'>('smtp');
  const [emailAddress, setEmailAddress] = useState('');
  const [senderName, setSenderName] = useState('');
  const [dailySendLimit, setDailySendLimit] = useState(30);
  const [warmupEnabled, setWarmupEnabled] = useState(false);
  const [isDefault, setIsDefault] = useState(false);
  const [signatureEnabled, setSignatureEnabled] = useState(false);
  const [signatureName, setSignatureName] = useState('');
  const [signatureTitle, setSignatureTitle] = useState('');
  const [signatureCompany, setSignatureCompany] = useState('');
  const [signatureWebsite, setSignatureWebsite] = useState('');
  const [signaturePhone, setSignaturePhone] = useState('');
  const [signatureLogoUrl, setSignatureLogoUrl] = useState('');
  const [signatureLinkedInUrl, setSignatureLinkedInUrl] = useState('');
  const [signatureTwitterUrl, setSignatureTwitterUrl] = useState('');
  const [signatureHtml, setSignatureHtml] = useState('<p><br></p>');

  // SMTP config states
  const [smtpHost, setSmtpHost] = useState('');
  const [smtpPort, setSmtpPort] = useState(465);
  const [smtpSecure, setSmtpSecure] = useState(true);
  const [smtpUsername, setSmtpUsername] = useState('');
  const [smtpPassword, setSmtpPassword] = useState('');

  // Mailgun config states
  const [mgDomain, setMgDomain] = useState('');
  const [mgApiKey, setMgApiKey] = useState('');
  const [mgRegion, setMgRegion] = useState<'us' | 'eu'>('us');
  const [mgWebhookKey, setMgWebhookKey] = useState('');

  // Connection testing states
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testEmailRecipient, setTestEmailRecipient] = useState('');
  const [showTestModal, setShowTestModal] = useState<string | null>(null); // holds accountId being tested
  const [previewSignatureAccount, setPreviewSignatureAccount] = useState<EmailAccount | null>(null);
  const signaturePreviewHtml = useMemo(
    () =>
      buildEmailSignatureHtml(
        {
          signature_enabled: signatureEnabled,
          signature_name: signatureName,
          signature_title: signatureTitle,
          signature_company: signatureCompany,
          signature_website: signatureWebsite,
          signature_phone: signaturePhone,
          signature_logo_url: signatureLogoUrl,
          signature_linkedin_url: signatureLinkedInUrl,
          signature_twitter_url: signatureTwitterUrl,
          signature_html: signatureHtml,
        },
        senderName || emailAddress
      ),
    [emailAddress, senderName, signatureCompany, signatureEnabled, signatureHtml, signatureLinkedInUrl, signatureLogoUrl, signatureName, signaturePhone, signatureTitle, signatureTwitterUrl, signatureWebsite]
  );
  const sendSignaturePreviewHtml = useMemo(
    () =>
      buildSendSignatureHtml(
        {
          signature_enabled: signatureEnabled,
          signature_name: signatureName,
          signature_title: signatureTitle,
          signature_company: signatureCompany,
          signature_website: signatureWebsite,
          signature_phone: signaturePhone,
          signature_logo_url: signatureLogoUrl,
          signature_linkedin_url: signatureLinkedInUrl,
          signature_twitter_url: signatureTwitterUrl,
          signature_html: signatureHtml,
        },
        senderName || emailAddress
      ),
    [emailAddress, senderName, signatureCompany, signatureEnabled, signatureHtml, signatureLinkedInUrl, signatureLogoUrl, signatureName, signaturePhone, signatureTitle, signatureTwitterUrl, signatureWebsite]
  );

  const handleUseSenderAsSignature = () => {
    const fallbackName = senderName || emailAddress;
    setSignatureEnabled(true);
    setSignatureName(fallbackName);
    if (!signatureHtml || signatureHtml === '<p><br></p>') {
      setSignatureHtml('<p><br></p>');
    }
  };

  const handleCreateSimpleSignature = () => {
    const fallbackName = signatureName || senderName || emailAddress;
    setSignatureEnabled(true);
    setSignatureName(fallbackName);
    setSignatureHtml('<p><br></p>');
  };

  const fetchAccounts = async () => {
    try {
      const res = await fetch('/api/email-accounts');
      if (!res.ok) throw new Error('Failed to load email accounts');
      const data = (await res.json()) as EmailAccount[];
      setAccounts(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error fetching email accounts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchAccounts();

    // Surface OAuth redirect results (?oauth_success= / ?oauth_error=) once, then clean the URL.
    const searchParams = new URLSearchParams(window.location.search);
    const oauthSuccess = searchParams.get('oauth_success');
    const oauthError = searchParams.get('oauth_error');
    if (oauthSuccess) setSuccess(oauthSuccess);
    if (oauthError) setError(oauthError);
    if (oauthSuccess || oauthError) {
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const openAddModal = () => {
    setEditingAccount(null);
    setProvider('smtp');
    setEmailAddress('');
    setSenderName('');
    setDailySendLimit(30);
    setWarmupEnabled(false);
    setIsDefault(false);
    setSignatureEnabled(false);
    setSignatureName('');
    setSignatureTitle('');
    setSignatureCompany('');
    setSignatureWebsite('');
    setSignaturePhone('');
    setSignatureLogoUrl('');
    setSignatureLinkedInUrl('');
    setSignatureTwitterUrl('');
    setSignatureHtml('<p><br></p>');
    
    // reset smtp
    setSmtpHost('');
    setSmtpPort(465);
    setSmtpSecure(true);
    setSmtpUsername('');
    setSmtpPassword('');

    // reset mg
    setMgDomain('');
    setMgApiKey('');
    setMgRegion('us');
    setMgWebhookKey('');

    setIsModalOpen(true);
  };

  const openEditModal = (account: EmailAccount) => {
    setEditingAccount(account);
    setProvider(
      account.provider === 'mailgun' || account.provider === 'gmail' || account.provider === 'outlook'
        ? account.provider
        : 'smtp'
    );
    setEmailAddress(account.email_address);
    setSenderName(account.sender_name || '');
    setDailySendLimit(account.daily_send_limit);
    setWarmupEnabled(account.warmup_enabled);
    setIsDefault(account.is_default);
    setSignatureEnabled(Boolean(account.config.signature_enabled));
    setSignatureName(String(account.config.signature_name || account.sender_name || ''));
    setSignatureTitle(String(account.config.signature_title || ''));
    setSignatureCompany(String(account.config.signature_company || ''));
    setSignatureWebsite(String(account.config.signature_website || ''));
    setSignaturePhone(String(account.config.signature_phone || ''));
    setSignatureLogoUrl(String(account.config.signature_logo_url || ''));
    setSignatureLinkedInUrl(String(account.config.signature_linkedin_url || ''));
    setSignatureTwitterUrl(String(account.config.signature_twitter_url || ''));
    setSignatureHtml(String(account.config.signature_html || '<p><br></p>'));

    if (account.provider === 'smtp') {
      setSmtpHost(String(account.config.host || ''));
      setSmtpPort(Number(account.config.port || 465));
      setSmtpSecure(typeof account.config.secure === 'boolean' ? account.config.secure : true);
      setSmtpUsername(String(account.config.username || ''));
      setSmtpPassword('********');
    } else if (account.provider === 'mailgun') {
      setMgDomain(String(account.config.domain || ''));
      setMgApiKey('********');
      setMgRegion(account.config.region === 'eu' ? 'eu' : 'us');
      setMgWebhookKey(account.config.webhook_signing_key ? '********' : '');
    }

    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const configPayload: EmailAccountConfig = {};
    if (provider === 'gmail' || provider === 'outlook') {
      // OAuth accounts keep their tokens server-side; only signature/profile fields are editable.
    } else if (provider === 'smtp') {
      configPayload.host = smtpHost;
      configPayload.port = Number(smtpPort);
      configPayload.secure = smtpSecure;
      configPayload.username = smtpUsername;
      if (smtpPassword) {
        configPayload.password = smtpPassword;
      }
    } else {
      configPayload.domain = mgDomain;
      if (mgApiKey) {
        configPayload.api_key = mgApiKey;
      }
      configPayload.region = mgRegion;
      if (mgWebhookKey) {
        configPayload.webhook_signing_key = mgWebhookKey;
      }
    }
    configPayload.signature_enabled = signatureEnabled;
    configPayload.signature_name = signatureName;
    configPayload.signature_title = signatureTitle;
    configPayload.signature_company = signatureCompany;
    configPayload.signature_website = signatureWebsite;
    configPayload.signature_phone = signaturePhone;
    configPayload.signature_logo_url = signatureLogoUrl;
    configPayload.signature_linkedin_url = signatureLinkedInUrl;
    configPayload.signature_twitter_url = signatureTwitterUrl;
    configPayload.signature_html = sanitizeSignatureHtml(signatureHtml);

    const payload = {
      provider,
      email_address: emailAddress,
      sender_name: senderName || null,
      daily_send_limit: dailySendLimit,
      warmup_enabled: warmupEnabled,
      is_default: isDefault,
      config: configPayload
    };

    try {
      let res;
      if (editingAccount) {
        res = await fetch(`/api/email-accounts/${editingAccount.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } else {
        res = await fetch('/api/email-accounts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      }

      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error || 'Failed to save email account');

      setSuccess(editingAccount ? 'Account updated successfully!' : 'Account added successfully!');
      setIsModalOpen(false);
      fetchAccounts();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error saving email account');
    }
  };

  const [deleteTarget, setDeleteTarget] = useState<EmailAccount | null>(null);

  const handleDelete = async (id: string) => {
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch(`/api/email-accounts/${id}`, {
        method: 'DELETE'
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error || 'Failed to delete email account');

      setSuccess('Account deleted successfully!');
      fetchAccounts();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error deleting account');
    } finally {
      setDeleteTarget(null);
    }
  };

  const handleSetDefault = async (account: EmailAccount) => {
    try {
      const res = await fetch(`/api/email-accounts/${account.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_default: true })
      });
      if (!res.ok) throw new Error('Failed to set default account');
      fetchAccounts();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error updating default account');
    }
  };

  const handleWarmupToggle = async (account: EmailAccount) => {
    try {
      const res = await fetch(`/api/email-accounts/${account.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ warmup_enabled: !account.warmup_enabled })
      });
      if (!res.ok) throw new Error('Failed to update warmup setting');
      fetchAccounts();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error updating warmup setting');
    }
  };

  const handleStatusToggle = async (account: EmailAccount) => {
    const nextStatus = account.status === 'active' ? 'inactive' : 'active';
    try {
      const res = await fetch(`/api/email-accounts/${account.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus })
      });
      if (!res.ok) throw new Error(`Failed to ${nextStatus === 'active' ? 'activate' : 'disable'} account`);
      setSuccess(`Account ${nextStatus === 'active' ? 'activated' : 'disabled'}.`);
      fetchAccounts();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error updating account status');
    }
  };

  const handleTestConnection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showTestModal || !testEmailRecipient) return;

    setTestingId(showTestModal);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch(`/api/email-accounts/${showTestModal}/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetEmail: testEmailRecipient })
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error || 'Verification email failed');

      setSuccess(`Connection tested successfully! Check ${testEmailRecipient}`);
      setShowTestModal(null);
      setTestEmailRecipient('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Verification failed');
    } finally {
      setTestingId(null);
    }
  };

  const isOAuthProvider = provider === 'gmail' || provider === 'outlook';

  return (
    <AppShell showSearch={false}>
      <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
        <PageHeader
          eyebrow="Sending setup"
          title="Email Accounts"
          subtitle="Connect Gmail or Outlook in one click, or add SMTP and Mailgun accounts with safe daily limits."
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="secondary" onClick={() => window.location.assign('/api/email-accounts/oauth/gmail/start')}>
                <Mail className="h-4 w-4 text-rose-500" /> Connect Gmail
              </Button>
              <Button variant="secondary" onClick={() => window.location.assign('/api/email-accounts/oauth/outlook/start')}>
                <Mail className="h-4 w-4 text-sky-500" /> Connect Outlook
              </Button>
              <Button variant="primary" onClick={openAddModal}>
                <Plus className="h-4 w-4" /> Add Account
              </Button>
            </div>
          }
        />

        {error && (
          <Banner tone="error" className="mb-6" onDismiss={() => setError(null)}>
            {error}
          </Banner>
        )}

        {success && (
          <Banner tone="success" className="mb-6" onDismiss={() => setSuccess(null)}>
            {success}
          </Banner>
        )}

        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-violet-500 border-t-transparent" />
          </div>
        ) : accounts.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-[var(--border)] bg-white p-12 text-center shadow-[0_12px_40px_rgba(15,23,42,0.04)]">
            <Mail className="mx-auto mb-4 h-12 w-12 text-violet-500" />
            <h3 className="text-lg font-semibold text-zinc-950">No sending accounts configured</h3>
            <p className="mx-auto mt-2 max-w-sm text-sm text-zinc-500">
              Connect Gmail or Outlook in one click, or set up SMTP / Mailgun to start launching outreach campaigns.
            </p>
            <Button variant="primary" className="mt-6" onClick={openAddModal}>
              Configure First Account
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {accounts.map((account) => (
              <div 
                key={account.id}
                className="flex flex-col justify-between gap-4 rounded-3xl border border-[var(--border)] bg-white p-5 shadow-[0_12px_40px_rgba(15,23,42,0.04)] transition hover:border-violet-200 hover:shadow-[0_18px_50px_rgba(124,58,237,0.08)] md:flex-row md:items-center"
              >
                <div className="flex items-start gap-4">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-50 to-teal-50 text-xs font-bold text-violet-700 ring-1 ring-violet-100">
                    {account.provider.toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-zinc-950">{account.email_address}</h4>
                      {account.is_default && (
                        <span className="rounded-full border border-violet-100 bg-violet-50 px-2 py-0.5 text-[10px] font-medium text-violet-700">
                          Default
                        </span>
                      )}
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium border ${
                        account.status === 'active'
                          ? 'border-emerald-100 bg-emerald-50 text-emerald-700'
                          : 'border-zinc-200 bg-zinc-50 text-zinc-600'
                      }`}>
                        {account.status.toUpperCase()}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-zinc-500">
                      Sender Name: <span className="text-zinc-800">{account.sender_name || 'N/A'}</span>
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                        buildEmailSignatureHtml(account.config, account.sender_name || account.email_address)
                          ? 'border-teal-200 bg-teal-50 text-teal-700'
                          : 'border-zinc-200 bg-zinc-50 text-zinc-600'
                      }`}>
                        {buildEmailSignatureHtml(account.config, account.sender_name || account.email_address) ? 'Signature added' : 'Fallback sender name'}
                      </span>
                      <button
                        onClick={() => setPreviewSignatureAccount(account)}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-violet-700 hover:text-violet-900"
                      >
                        <Eye className="h-3.5 w-3.5" /> Preview signature
                      </button>
                    </div>
                    <div className="flex items-center gap-4 mt-2">
                      <div className="flex items-center gap-1.5 text-xs text-zinc-500">
                        <Flame className={`h-3.5 w-3.5 ${account.warmup_enabled ? 'animate-pulse text-orange-500' : 'text-zinc-400'}`} />
                        Warmup: 
                        <button 
                          onClick={() => handleWarmupToggle(account)}
                          className="cursor-pointer font-medium text-violet-700 hover:underline"
                        >
                          {account.warmup_enabled ? 'ON' : 'OFF'}
                        </button>
                      </div>
                      <div className="text-xs text-zinc-500">
                        Today sent: <span className="font-medium text-zinc-900">{account.daily_sent_count}</span> / <span className="text-zinc-700">{account.daily_send_limit}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 self-end md:self-auto">
                  {!account.is_default && (
                    <Button size="sm" onClick={() => handleSetDefault(account)}>
                      Make Default
                    </Button>
                  )}
                  <Button size="sm" onClick={() => setShowTestModal(account.id)} disabled={account.status !== 'active'}>
                    <Zap className="h-3 w-3 text-amber-400" /> Test Connection
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleStatusToggle(account)}
                    className={
                      account.status === 'active'
                        ? '!border-amber-200 !bg-amber-50 !text-amber-700 hover:!bg-amber-100'
                        : '!border-emerald-200 !bg-emerald-50 !text-emerald-700 hover:!bg-emerald-100'
                    }
                  >
                    {account.status === 'active' ? 'Disable' : 'Activate'}
                  </Button>
                  <Button size="sm" onClick={() => openEditModal(account)}>
                    Edit
                  </Button>
                  <Button size="sm" variant="danger" aria-label={`Delete ${account.email_address}`} onClick={() => setDeleteTarget(account)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Add/Edit Modal */}
        <Modal
          open={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title={editingAccount ? 'Edit Email Account' : 'Add Email Account'}
        >
              <form onSubmit={handleSave} className="space-y-4">
                {!isOAuthProvider && (
                <div className="grid grid-cols-2 gap-2 rounded-2xl bg-[var(--surface-muted)] p-1 sm:grid-cols-4">
                  <button
                    type="button"
                    onClick={() => setProvider('smtp')}
                    className={`py-2 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                      provider === 'smtp'
                        ? 'bg-white text-violet-700 shadow-sm ring-1 ring-violet-100'
                        : 'text-zinc-500 hover:text-zinc-800'
                    }`}
                  >
                    SMTP
                  </button>
                  <button
                    type="button"
                    onClick={() => setProvider('mailgun')}
                    className={`py-2 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                      provider === 'mailgun'
                        ? 'bg-white text-violet-700 shadow-sm ring-1 ring-violet-100'
                        : 'text-zinc-500 hover:text-zinc-800'
                    }`}
                  >
                    Mailgun
                  </button>
                  <button
                    type="button"
                    disabled
                    className="cursor-not-allowed rounded-md border border-[var(--border)] bg-white/70 py-2 text-xs font-semibold text-zinc-400 transition-all"
                  >
                    Resend Coming Soon
                  </button>
                  <button
                    type="button"
                    disabled
                    className="cursor-not-allowed rounded-md border border-[var(--border)] bg-white/70 py-2 text-xs font-semibold text-zinc-400 transition-all"
                  >
                    Amazon SES Soon
                  </button>
                </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <Field label="Email Address" htmlFor="account-email">
                    <Input
                      id="account-email"
                      type="email"
                      required
                      readOnly={isOAuthProvider}
                      value={emailAddress}
                      onChange={(e) => setEmailAddress(e.target.value)}
                      placeholder="sender@domain.com"
                      className={isOAuthProvider ? 'cursor-not-allowed bg-[var(--surface-muted)]' : ''}
                    />
                  </Field>
                  <Field label="Sender Display Name" htmlFor="account-sender-name">
                    <Input
                      id="account-sender-name"
                      type="text"
                      value={senderName}
                      onChange={(e) => setSenderName(e.target.value)}
                      placeholder="John Doe"
                    />
                  </Field>
                </div>

                {/* Dynamic Configuration Forms */}
                {isOAuthProvider ? (
                  <div className="rounded-2xl border border-teal-100 bg-teal-50 p-4 text-xs text-teal-800">
                    This account is connected via {provider === 'gmail' ? 'Google' : 'Microsoft'} OAuth. Credentials are
                    managed automatically — reconnect from the buttons above if sending stops working.
                  </div>
                ) : provider === 'smtp' ? (
                  <div className="space-y-4 border-t border-[var(--border)] pt-4">
                    <div className="grid grid-cols-3 gap-4">
                      <div className="col-span-2">
                        <Field label="SMTP Host" htmlFor="smtp-host">
                          <Input id="smtp-host" type="text" required value={smtpHost} onChange={(e) => setSmtpHost(e.target.value)} placeholder="mail.domain.com" />
                        </Field>
                      </div>
                      <Field label="SMTP Port" htmlFor="smtp-port">
                        <Input id="smtp-port" type="number" required value={smtpPort} onChange={(e) => setSmtpPort(Number(e.target.value))} placeholder="465" />
                      </Field>
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="smtpSecure"
                        checked={smtpSecure}
                        onChange={(e) => setSmtpSecure(e.target.checked)}
                        className="rounded border-zinc-300 text-violet-600 focus:ring-violet-500"
                      />
                      <label htmlFor="smtpSecure" className="select-none text-xs font-medium text-zinc-700">
                        Use SSL/TLS (Check if using port 465)
                      </label>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <Field label="SMTP Username" htmlFor="smtp-username">
                        <Input id="smtp-username" type="text" required value={smtpUsername} onChange={(e) => setSmtpUsername(e.target.value)} placeholder="sender@domain.com" />
                      </Field>
                      <Field label="SMTP Password" htmlFor="smtp-password">
                        <Input id="smtp-password" type="password" required={!editingAccount} value={smtpPassword} onChange={(e) => setSmtpPassword(e.target.value)} placeholder={editingAccount ? '••••••••' : 'Password'} />
                      </Field>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4 border-t border-[var(--border)] pt-4">
                    <div className="grid grid-cols-2 gap-4">
                      <Field label="Mailgun Domain" htmlFor="mg-domain">
                        <Input id="mg-domain" type="text" required value={mgDomain} onChange={(e) => setMgDomain(e.target.value)} placeholder="mg.yourdomain.com" />
                      </Field>
                      <Field label="API Key" htmlFor="mg-api-key">
                        <Input id="mg-api-key" type="password" required={!editingAccount} value={mgApiKey} onChange={(e) => setMgApiKey(e.target.value)} placeholder={editingAccount ? '••••••••' : 'API Private Key'} />
                      </Field>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <Field label="Region" htmlFor="mg-region">
                        <Select id="mg-region" value={mgRegion} onChange={(e) => setMgRegion(e.target.value as 'us' | 'eu')}>
                          <option value="us">United States (US)</option>
                          <option value="eu">Europe (EU)</option>
                        </Select>
                      </Field>
                      <Field label="Webhook Signing Key (Optional)" htmlFor="mg-webhook-key">
                        <Input id="mg-webhook-key" type="password" value={mgWebhookKey} onChange={(e) => setMgWebhookKey(e.target.value)} placeholder={editingAccount?.config.webhook_signing_key ? '••••••••' : 'Signing Key'} />
                      </Field>
                    </div>
                  </div>
                )}

                <div className="space-y-4 border-t border-[var(--border)] pt-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h4 className="text-sm font-bold text-zinc-950">Email Signature</h4>
                      <p className="mt-1 text-xs text-zinc-500">Appended automatically to manual and campaign emails. If no custom signature exists, ReachMira appends the sender name.</p>
                    </div>
                    <label className="flex items-center gap-2 text-xs font-semibold text-zinc-700">
                      <input
                        type="checkbox"
                        checked={signatureEnabled}
                        onChange={(e) => setSignatureEnabled(e.target.checked)}
                        className="rounded border-zinc-300 text-violet-600 focus:ring-violet-500"
                      />
                      Enable signature
                    </label>
                  </div>

                  <div className="grid gap-3 rounded-2xl border border-violet-100 bg-violet-50/70 p-4 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={handleUseSenderAsSignature}
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-violet-700 shadow-sm ring-1 ring-violet-100 transition hover:bg-violet-100"
                    >
                      <Wand2 className="h-4 w-4" /> Use account name
                    </button>
                    <button
                      type="button"
                      onClick={handleCreateSimpleSignature}
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-teal-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-95"
                    >
                      <Plus className="h-4 w-4" /> Create simple signature
                    </button>
                    <p className="text-xs leading-relaxed text-violet-700 sm:col-span-2">
                      Quick setup: fill the account sender name, click one button, then preview below before saving.
                    </p>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label="Name" htmlFor="sig-name">
                      <Input id="sig-name" value={signatureName} onChange={(e) => setSignatureName(e.target.value)} placeholder={senderName || 'Jane Doe'} />
                    </Field>
                    <Field label="Title" htmlFor="sig-title">
                      <Input id="sig-title" value={signatureTitle} onChange={(e) => setSignatureTitle(e.target.value)} placeholder="Founder" />
                    </Field>
                    <Field label="Company" htmlFor="sig-company">
                      <Input id="sig-company" value={signatureCompany} onChange={(e) => setSignatureCompany(e.target.value)} placeholder="ReachMira" />
                    </Field>
                    <Field label="Website" htmlFor="sig-website">
                      <Input id="sig-website" value={signatureWebsite} onChange={(e) => setSignatureWebsite(e.target.value)} placeholder="https://example.com" />
                    </Field>
                    <Field label="Phone" htmlFor="sig-phone">
                      <Input id="sig-phone" value={signaturePhone} onChange={(e) => setSignaturePhone(e.target.value)} placeholder="+1 555 123 4567" />
                    </Field>
                    <Field label="Logo URL" htmlFor="sig-logo">
                      <Input id="sig-logo" value={signatureLogoUrl} onChange={(e) => setSignatureLogoUrl(e.target.value)} placeholder="https://example.com/logo.png" />
                    </Field>
                    <Field label="LinkedIn URL" htmlFor="sig-linkedin">
                      <Input id="sig-linkedin" value={signatureLinkedInUrl} onChange={(e) => setSignatureLinkedInUrl(e.target.value)} placeholder="https://linkedin.com/in/..." />
                    </Field>
                    <Field label="Social URL" htmlFor="sig-social">
                      <Input id="sig-social" value={signatureTwitterUrl} onChange={(e) => setSignatureTwitterUrl(e.target.value)} placeholder="https://x.com/..." />
                    </Field>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase text-zinc-500">Rich Text Signature</label>
                    <RichTextEditor value={signatureHtml} onChange={setSignatureHtml} placeholder="Add a custom sign-off, disclaimer, or styled signature block." />
                    <p className="mt-2 text-xs text-zinc-500">Unsafe scripts and event handlers are stripped before saving.</p>
                  </div>

                  <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] p-4 text-sm text-zinc-900">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500">Send Preview</div>
                      {!signaturePreviewHtml && (
                        <span className="rounded-full border border-zinc-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-zinc-500">
                          Fallback sender name
                        </span>
                      )}
                    </div>
                    {sendSignaturePreviewHtml ? (
                      <div dangerouslySetInnerHTML={{ __html: sendSignaturePreviewHtml }} />
                    ) : (
                      <div className="text-zinc-500">Add a sender name or signature details to preview what will be appended.</div>
                    )}
                  </div>
                </div>

                {/* Common Limits & Warmup flags */}
                <div className="grid grid-cols-2 gap-4 border-t border-[var(--border)] pt-4">
                  <Field label="Daily Send Limit" htmlFor="daily-send-limit">
                    <Input
                      id="daily-send-limit"
                      type="number"
                      required
                      value={dailySendLimit}
                      onChange={(e) => setDailySendLimit(Number(e.target.value))}
                    />
                  </Field>
                  <div className="flex flex-col justify-end gap-2.5">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="isDefault"
                        checked={isDefault}
                        onChange={(e) => setIsDefault(e.target.checked)}
                        className="rounded border-zinc-300 text-violet-600 focus:ring-violet-500"
                      />
                      <label htmlFor="isDefault" className="cursor-pointer select-none text-xs font-medium text-zinc-700">
                        Set as Default Sender
                      </label>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="warmupEnabled"
                        checked={warmupEnabled}
                        onChange={(e) => setWarmupEnabled(e.target.checked)}
                        className="rounded border-zinc-300 text-violet-600 focus:ring-violet-500"
                      />
                      <label htmlFor="warmupEnabled" className="cursor-pointer select-none text-xs font-medium text-zinc-700">
                        Enable Warmup Mode
                      </label>
                    </div>
                  </div>
                </div>

                <div className="mt-6 flex justify-end gap-2 border-t border-[var(--border)] pt-4">
                  <Button onClick={() => setIsModalOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" variant="primary">
                    {editingAccount ? 'Save Changes' : 'Create Account'}
                  </Button>
                </div>
              </form>
        </Modal>

        {/* Test Email Destination Prompt Modal */}
        <Modal open={Boolean(showTestModal)} onClose={() => setShowTestModal(null)} title="Send Verification Email" maxWidth="md">
          <p className="-mt-3 mb-4 text-xs text-zinc-500">
            Enter an inbox address where we can deliver the credentials verification test email.
          </p>

          <form onSubmit={handleTestConnection} className="space-y-4">
            <Field label="Recipient" htmlFor="test-email-recipient">
              <Input
                id="test-email-recipient"
                type="email"
                required
                value={testEmailRecipient}
                onChange={(e) => setTestEmailRecipient(e.target.value)}
                placeholder="recipient@example.com"
              />
            </Field>
            <div className="flex justify-end gap-2">
              <Button size="sm" onClick={() => setShowTestModal(null)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" variant="primary" loading={!!testingId}>
                {testingId ? 'Verifying...' : 'Send Test'}
              </Button>
            </div>
          </form>
        </Modal>

        {previewSignatureAccount && (
          <Modal open onClose={() => setPreviewSignatureAccount(null)} title="Signature Preview" maxWidth="lg">
            <p className="-mt-4 mb-5 text-sm text-zinc-500">
              This is what ReachMira appends for {previewSignatureAccount.email_address}.
            </p>

            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] p-5 text-sm text-zinc-900">
              <div dangerouslySetInnerHTML={{
                __html: buildSendSignatureHtml(
                  previewSignatureAccount.config,
                  previewSignatureAccount.sender_name || previewSignatureAccount.email_address
                )
              }} />
            </div>

            {!buildEmailSignatureHtml(previewSignatureAccount.config, previewSignatureAccount.sender_name || previewSignatureAccount.email_address) && (
              <Banner tone="warning" className="mt-4">
                No custom signature is configured, so emails will use the email account name fallback.
              </Banner>
            )}
          </Modal>
        )}
        <ConfirmDialog
          open={Boolean(deleteTarget)}
          title="Delete email account?"
          description={`${deleteTarget?.email_address || 'This account'} will be removed and its campaign links will be orphaned. This cannot be undone.`}
          confirmLabel="Delete Account"
          onConfirm={async () => {
            if (deleteTarget) await handleDelete(deleteTarget.id);
          }}
          onCancel={() => setDeleteTarget(null)}
        />
      </main>
    </AppShell>
  );
}
