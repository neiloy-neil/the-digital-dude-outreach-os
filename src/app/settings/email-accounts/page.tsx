'use client';

export const dynamic = 'force-dynamic';

import { useMemo, useState, useEffect } from 'react';
import AppShell from '@/components/reachmira/AppShell';
import PageHeader from '@/components/reachmira/PageHeader';
import RichTextEditor from '@/components/leads/RichTextEditor';
import { buildEmailSignatureHtml, buildSendSignatureHtml, sanitizeSignatureHtml } from '@/lib/email/signature';
import { 
  Mail, Plus, Trash2, AlertCircle,
  Flame, Zap, CheckCircle2, X, RefreshCw, Eye, Wand2
} from 'lucide-react';

type EmailAccountConfig = Record<string, string | number | boolean | null | undefined>;

interface EmailAccount {
  id: string;
  provider: 'smtp' | 'mailgun' | 'resend' | 'amazon_ses';
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
  const [provider, setProvider] = useState<'smtp' | 'mailgun'>('smtp');
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
    setProvider(account.provider === 'mailgun' ? 'mailgun' : 'smtp');
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
    if (provider === 'smtp') {
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

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this email account? This campaign links will be orphaned.')) return;
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

  return (
    <AppShell showSearch={false}>
      <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
        <PageHeader
          eyebrow="Sending setup"
          title="Email Accounts"
          subtitle="Add and manage SMTP, Mailgun, and custom sending accounts with safe daily limits."
          actions={
            <button
              onClick={openAddModal}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-teal-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-600/20 transition hover:opacity-95 active:scale-[0.98]"
            >
              <Plus className="h-4 w-4" /> Add Account
            </button>
          }
        />

        {error && (
          <div className="mb-6 flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="mb-6 flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
            <CheckCircle2 className="h-5 w-5 shrink-0" />
            <span>{success}</span>
          </div>
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
              Set up SMTP or Mailgun connections to start launching outreach campaigns.
            </p>
            <button
              onClick={openAddModal}
              className="mt-6 rounded-xl bg-gradient-to-r from-violet-600 to-teal-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-600/20 transition hover:opacity-95"
            >
              Configure First Account
            </button>
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

                <div className="flex items-center gap-2 self-end md:self-auto">
                  {!account.is_default && (
                    <button
                      onClick={() => handleSetDefault(account)}
                      className="cursor-pointer rounded-lg border border-[var(--border)] bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 transition hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700"
                    >
                      Make Default
                    </button>
                  )}
                  <button
                    onClick={() => setShowTestModal(account.id)}
                    disabled={account.status !== 'active'}
                    className="flex cursor-pointer items-center gap-1 rounded-lg border border-[var(--border)] bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 transition hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Zap className="h-3 w-3 text-amber-400" /> Test Connection
                  </button>
                  <button
                    onClick={() => handleStatusToggle(account)}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all cursor-pointer ${
                      account.status === 'active'
                        ? 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100'
                        : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                    }`}
                  >
                    {account.status === 'active' ? 'Disable' : 'Activate'}
                  </button>
                  <button
                    onClick={() => openEditModal(account)}
                    className="cursor-pointer rounded-lg border border-[var(--border)] bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 transition hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(account.id)}
                    className="cursor-pointer rounded-lg border border-rose-200 bg-rose-50 p-2 text-rose-700 transition hover:bg-rose-100"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Add/Edit Modal */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="relative max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-[var(--border)] bg-white p-6 shadow-2xl">
              <button
                onClick={() => setIsModalOpen(false)}
                className="absolute right-4 top-4 cursor-pointer rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-1.5 text-zinc-500 transition hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700"
              >
                <X className="h-5 w-5" />
              </button>

              <h3 className="mb-6 text-xl font-bold text-zinc-950">
                {editingAccount ? 'Edit Email Account' : 'Add Email Account'}
              </h3>

              <form onSubmit={handleSave} className="space-y-4">
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

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase text-zinc-500">Email Address</label>
                    <input
                      type="email"
                      required
                      value={emailAddress}
                      onChange={(e) => setEmailAddress(e.target.value)}
                      placeholder="sender@domain.com"
                      className="mt-1 w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm text-zinc-900 transition-colors placeholder:text-zinc-400 focus:border-violet-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase text-zinc-500">Sender Display Name</label>
                    <input
                      type="text"
                      value={senderName}
                      onChange={(e) => setSenderName(e.target.value)}
                      placeholder="John Doe"
                      className="mt-1 w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm text-zinc-900 transition-colors placeholder:text-zinc-400 focus:border-violet-500 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Dynamic Configuration Forms */}
                {provider === 'smtp' ? (
                  <div className="space-y-4 border-t border-[var(--border)] pt-4">
                    <div className="grid grid-cols-3 gap-4">
                      <div className="col-span-2">
                        <label className="block text-xs font-semibold uppercase text-zinc-500">SMTP Host</label>
                        <input
                          type="text"
                          required
                          value={smtpHost}
                          onChange={(e) => setSmtpHost(e.target.value)}
                          placeholder="mail.domain.com"
                          className="mt-1 w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm text-zinc-900 transition-colors placeholder:text-zinc-400 focus:border-violet-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold uppercase text-zinc-500">SMTP Port</label>
                        <input
                          type="number"
                          required
                          value={smtpPort}
                          onChange={(e) => setSmtpPort(Number(e.target.value))}
                          placeholder="465"
                          className="mt-1 w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm text-zinc-900 transition-colors placeholder:text-zinc-400 focus:border-violet-500 focus:outline-none"
                        />
                      </div>
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
                      <div>
                        <label className="block text-xs font-semibold uppercase text-zinc-500">SMTP Username</label>
                        <input
                          type="text"
                          required
                          value={smtpUsername}
                          onChange={(e) => setSmtpUsername(e.target.value)}
                          placeholder="sender@domain.com"
                          className="mt-1 w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm text-zinc-900 transition-colors placeholder:text-zinc-400 focus:border-violet-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold uppercase text-zinc-500">SMTP Password</label>
                        <input
                          type="password"
                          required={!editingAccount}
                          value={smtpPassword}
                          onChange={(e) => setSmtpPassword(e.target.value)}
                          placeholder={editingAccount ? "••••••••" : "Password"}
                          className="mt-1 w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm text-zinc-900 transition-colors placeholder:text-zinc-400 focus:border-violet-500 focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4 border-t border-[var(--border)] pt-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold uppercase text-zinc-500">Mailgun Domain</label>
                        <input
                          type="text"
                          required
                          value={mgDomain}
                          onChange={(e) => setMgDomain(e.target.value)}
                          placeholder="mg.yourdomain.com"
                          className="mt-1 w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm text-zinc-900 transition-colors placeholder:text-zinc-400 focus:border-violet-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold uppercase text-zinc-500">API Key</label>
                        <input
                          type="password"
                          required={!editingAccount}
                          value={mgApiKey}
                          onChange={(e) => setMgApiKey(e.target.value)}
                          placeholder={editingAccount ? "••••••••" : "API Private Key"}
                          className="mt-1 w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm text-zinc-900 transition-colors placeholder:text-zinc-400 focus:border-violet-500 focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold uppercase text-zinc-500">Region</label>
                        <select
                          value={mgRegion}
                          onChange={(e) => setMgRegion(e.target.value as 'us' | 'eu')}
                          className="mt-1 w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm text-zinc-900 transition-colors focus:border-violet-500 focus:outline-none"
                        >
                          <option value="us">United States (US)</option>
                          <option value="eu">Europe (EU)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold uppercase text-zinc-500">Webhook Signing Key (Optional)</label>
                        <input
                          type="password"
                          value={mgWebhookKey}
                          onChange={(e) => setMgWebhookKey(e.target.value)}
                          placeholder={editingAccount?.config.webhook_signing_key ? "••••••••" : "Signing Key"}
                          className="mt-1 w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm text-zinc-900 transition-colors placeholder:text-zinc-400 focus:border-violet-500 focus:outline-none"
                        />
                      </div>
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
                    <div>
                      <label className="block text-xs font-semibold uppercase text-zinc-500">Name</label>
                      <input value={signatureName} onChange={(e) => setSignatureName(e.target.value)} placeholder={senderName || 'Jane Doe'} className="mt-1 w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-violet-500" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold uppercase text-zinc-500">Title</label>
                      <input value={signatureTitle} onChange={(e) => setSignatureTitle(e.target.value)} placeholder="Founder" className="mt-1 w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-violet-500" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold uppercase text-zinc-500">Company</label>
                      <input value={signatureCompany} onChange={(e) => setSignatureCompany(e.target.value)} placeholder="ReachMira" className="mt-1 w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-violet-500" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold uppercase text-zinc-500">Website</label>
                      <input value={signatureWebsite} onChange={(e) => setSignatureWebsite(e.target.value)} placeholder="https://example.com" className="mt-1 w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-violet-500" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold uppercase text-zinc-500">Phone</label>
                      <input value={signaturePhone} onChange={(e) => setSignaturePhone(e.target.value)} placeholder="+1 555 123 4567" className="mt-1 w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-violet-500" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold uppercase text-zinc-500">Logo URL</label>
                      <input value={signatureLogoUrl} onChange={(e) => setSignatureLogoUrl(e.target.value)} placeholder="https://example.com/logo.png" className="mt-1 w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-violet-500" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold uppercase text-zinc-500">LinkedIn URL</label>
                      <input value={signatureLinkedInUrl} onChange={(e) => setSignatureLinkedInUrl(e.target.value)} placeholder="https://linkedin.com/in/..." className="mt-1 w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-violet-500" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold uppercase text-zinc-500">Social URL</label>
                      <input value={signatureTwitterUrl} onChange={(e) => setSignatureTwitterUrl(e.target.value)} placeholder="https://x.com/..." className="mt-1 w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-violet-500" />
                    </div>
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
                  <div>
                    <label className="block text-xs font-semibold uppercase text-zinc-500">Daily Send Limit</label>
                    <input
                      type="number"
                      required
                      value={dailySendLimit}
                      onChange={(e) => setDailySendLimit(Number(e.target.value))}
                      className="mt-1 w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm text-zinc-900 transition-colors focus:border-violet-500 focus:outline-none"
                    />
                  </div>
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
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="cursor-pointer rounded-xl border border-[var(--border)] bg-white px-4 py-2 text-sm font-semibold text-zinc-700 transition hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="cursor-pointer rounded-xl bg-gradient-to-r from-violet-600 to-teal-500 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-violet-600/15 transition-all hover:opacity-90 active:scale-[0.98]"
                  >
                    {editingAccount ? 'Save Changes' : 'Create Account'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Test Email Destination Prompt Modal */}
        {showTestModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="relative w-full max-w-sm rounded-3xl border border-[var(--border)] bg-white p-5 shadow-2xl">
              <button
                onClick={() => setShowTestModal(null)}
                className="absolute right-3 top-3 cursor-pointer rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-1 text-zinc-500 transition hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700"
              >
                <X className="h-4 w-4" />
              </button>

              <h4 className="mb-3 text-base font-bold text-zinc-950">Send Verification Email</h4>
              <p className="mb-4 text-xs text-zinc-500">
                Enter an inbox address where we can deliver the credentials verification test email.
              </p>

              <form onSubmit={handleTestConnection} className="space-y-4">
                <div>
                  <input
                    type="email"
                    required
                    value={testEmailRecipient}
                    onChange={(e) => setTestEmailRecipient(e.target.value)}
                    placeholder="recipient@example.com"
                    className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm text-zinc-900 transition-colors placeholder:text-zinc-400 focus:border-violet-500 focus:outline-none"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowTestModal(null)}
                    className="cursor-pointer rounded-xl border border-[var(--border)] bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 transition hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!!testingId}
                    className="flex cursor-pointer items-center gap-1.5 rounded-xl bg-violet-600 px-4 py-1.5 text-xs font-semibold text-white transition-all hover:bg-violet-500 disabled:opacity-50"
                  >
                    {testingId ? (
                      <>
                        <RefreshCw className="h-3 w-3 animate-spin" /> Verifying...
                      </>
                    ) : (
                      'Send Test'
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {previewSignatureAccount && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="relative w-full max-w-lg rounded-3xl border border-[var(--border)] bg-white p-6 shadow-2xl">
              <button
                onClick={() => setPreviewSignatureAccount(null)}
                className="absolute right-4 top-4 cursor-pointer rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-1.5 text-zinc-500 transition hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700"
              >
                <X className="h-5 w-5" />
              </button>

              <div className="mb-5 pr-10">
                <h4 className="text-lg font-bold text-zinc-950">Signature Preview</h4>
                <p className="mt-1 text-sm text-zinc-500">
                  This is what ReachMira appends for {previewSignatureAccount.email_address}.
                </p>
              </div>

              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] p-5 text-sm text-zinc-900">
                <div dangerouslySetInnerHTML={{
                  __html: buildSendSignatureHtml(
                    previewSignatureAccount.config,
                    previewSignatureAccount.sender_name || previewSignatureAccount.email_address
                  )
                }} />
              </div>

              {!buildEmailSignatureHtml(previewSignatureAccount.config, previewSignatureAccount.sender_name || previewSignatureAccount.email_address) && (
                <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  No custom signature is configured, so emails will use the email account name fallback.
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </AppShell>
  );
}
