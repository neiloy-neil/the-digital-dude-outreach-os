'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import { 
  Mail, Plus, Trash2, Check, AlertCircle, Shield, 
  Flame, Zap, Settings, CheckCircle2, X, RefreshCw 
} from 'lucide-react';

interface EmailAccount {
  id: string;
  provider: 'smtp' | 'mailgun' | 'resend' | 'amazon_ses';
  email_address: string;
  sender_name?: string | null;
  config: Record<string, any>;
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

  const fetchAccounts = async () => {
    try {
      const res = await fetch('/api/email-accounts');
      if (!res.ok) throw new Error('Failed to load email accounts');
      const data = await res.json();
      setAccounts(data);
    } catch (err: any) {
      setError(err.message || 'Error fetching email accounts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
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

    if (account.provider === 'smtp') {
      setSmtpHost(account.config.host || '');
      setSmtpPort(account.config.port || 465);
      setSmtpSecure(account.config.secure ?? true);
      setSmtpUsername(account.config.username || '');
      setSmtpPassword('********');
    } else if (account.provider === 'mailgun') {
      setMgDomain(account.config.domain || '');
      setMgApiKey('********');
      setMgRegion(account.config.region || 'us');
      setMgWebhookKey(account.config.webhook_signing_key ? '********' : '');
    }

    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const configPayload: Record<string, any> = {};
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

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save email account');

      setSuccess(editingAccount ? 'Account updated successfully!' : 'Account added successfully!');
      setIsModalOpen(false);
      fetchAccounts();
    } catch (err: any) {
      setError(err.message || 'Error saving email account');
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
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete email account');

      setSuccess('Account deleted successfully!');
      fetchAccounts();
    } catch (err: any) {
      setError(err.message || 'Error deleting account');
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
    } catch (err: any) {
      setError(err.message || 'Error updating default account');
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
    } catch (err: any) {
      setError(err.message || 'Error updating warmup setting');
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
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Verification email failed');

      setSuccess(`Connection tested successfully! Check ${testEmailRecipient}`);
      setShowTestModal(null);
      setTestEmailRecipient('');
    } catch (err: any) {
      setError(err.message || 'Verification failed');
    } finally {
      setTestingId(null);
    }
  };

  return (
    <div className="flex min-h-screen bg-zinc-950 text-zinc-100">
      <Sidebar />
      <main className="flex-1 p-8 overflow-y-auto max-w-5xl">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-600/10 text-violet-400">
              <Mail className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white tracking-tight">Email Accounts</h2>
              <p className="text-sm text-zinc-400">Add and manage SMTP, Mailgun, and custom sending nodes.</p>
            </div>
          </div>
          <button
            onClick={openAddModal}
            className="px-4 py-2 rounded-lg bg-gradient-to-r from-violet-600 to-blue-600 text-sm font-semibold text-white flex items-center gap-2 hover:opacity-90 active:scale-[0.98] transition-all cursor-pointer shadow-lg shadow-violet-600/10"
          >
            <Plus className="h-4 w-4" /> Add Account
          </button>
        </div>

        {error && (
          <div className="mb-6 rounded-lg bg-rose-500/10 p-4 text-sm text-rose-400 border border-rose-500/20 flex items-center gap-2">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="mb-6 rounded-lg bg-emerald-500/10 p-4 text-sm text-emerald-400 border border-emerald-500/20 flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 shrink-0" />
            <span>{success}</span>
          </div>
        )}

        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-violet-500 border-t-transparent" />
          </div>
        ) : accounts.length === 0 ? (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/10 p-12 text-center">
            <Mail className="h-12 w-12 text-zinc-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-zinc-300">No sending accounts configured</h3>
            <p className="text-sm text-zinc-500 max-w-sm mx-auto mt-2">
              Set up SMTP or Mailgun connections to start launching outreach campaigns.
            </p>
            <button
              onClick={openAddModal}
              className="mt-6 px-4 py-2 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-sm font-medium text-zinc-200 transition-colors cursor-pointer"
            >
              Configure First Account
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {accounts.map((account) => (
              <div 
                key={account.id}
                className="rounded-xl border border-zinc-800 bg-zinc-900/20 p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 backdrop-blur-sm hover:border-zinc-700/80 transition-all"
              >
                <div className="flex items-start gap-4">
                  <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-zinc-800 text-zinc-300 font-bold text-xs">
                    {account.provider.toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-white">{account.email_address}</h4>
                      {account.is_default && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-400 border border-violet-500/20 font-medium">
                          Default
                        </span>
                      )}
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium border ${
                        account.status === 'active' 
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                          : 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20'
                      }`}>
                        {account.status.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-400 mt-1">
                      Sender Name: <span className="text-zinc-200">{account.sender_name || 'N/A'}</span>
                    </p>
                    <div className="flex items-center gap-4 mt-2">
                      <div className="flex items-center gap-1.5 text-xs text-zinc-400">
                        <Flame className={`h-3.5 w-3.5 ${account.warmup_enabled ? 'text-orange-400 animate-pulse' : 'text-zinc-600'}`} />
                        Warmup: 
                        <button 
                          onClick={() => handleWarmupToggle(account)}
                          className="hover:underline font-medium text-zinc-200 cursor-pointer"
                        >
                          {account.warmup_enabled ? 'ON' : 'OFF'}
                        </button>
                      </div>
                      <div className="text-xs text-zinc-400">
                        Today sent: <span className="text-zinc-200 font-medium">{account.daily_sent_count}</span> / <span className="text-zinc-300">{account.daily_send_limit}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end md:self-auto">
                  {!account.is_default && (
                    <button
                      onClick={() => handleSetDefault(account)}
                      className="px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-xs font-semibold text-zinc-300 transition-all cursor-pointer"
                    >
                      Make Default
                    </button>
                  )}
                  <button
                    onClick={() => setShowTestModal(account.id)}
                    className="px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-xs font-semibold text-zinc-300 transition-all cursor-pointer flex items-center gap-1"
                  >
                    <Zap className="h-3 w-3 text-amber-400" /> Test Connection
                  </button>
                  <button
                    onClick={() => openEditModal(account)}
                    className="px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-xs font-semibold text-zinc-300 transition-all cursor-pointer"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(account.id)}
                    className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 hover:bg-rose-500/25 transition-all cursor-pointer"
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
            <div className="w-full max-w-xl rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl relative">
              <button
                onClick={() => setIsModalOpen(false)}
                className="absolute top-4 right-4 p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-850 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>

              <h3 className="text-xl font-bold text-white mb-6">
                {editingAccount ? 'Edit Email Account' : 'Add Email Account'}
              </h3>

              <form onSubmit={handleSave} className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-1 bg-zinc-950 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setProvider('smtp')}
                    className={`py-2 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                      provider === 'smtp' 
                        ? 'bg-zinc-800 text-white shadow-sm' 
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    SMTP
                  </button>
                  <button
                    type="button"
                    onClick={() => setProvider('mailgun')}
                    className={`py-2 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                      provider === 'mailgun' 
                        ? 'bg-zinc-800 text-white shadow-sm' 
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    Mailgun
                  </button>
                  <button
                    type="button"
                    disabled
                    className="py-2 text-xs font-semibold rounded-md transition-all cursor-not-allowed text-zinc-600 bg-zinc-900/60 border border-zinc-800"
                  >
                    Resend Coming Soon
                  </button>
                  <button
                    type="button"
                    disabled
                    className="py-2 text-xs font-semibold rounded-md transition-all cursor-not-allowed text-zinc-600 bg-zinc-900/60 border border-zinc-800"
                  >
                    Amazon SES Soon
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-400 uppercase">Email Address</label>
                    <input
                      type="email"
                      required
                      value={emailAddress}
                      onChange={(e) => setEmailAddress(e.target.value)}
                      placeholder="sender@domain.com"
                      className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950 py-2 px-3 text-sm text-zinc-200 focus:border-violet-500 focus:outline-none transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-zinc-400 uppercase">Sender Display Name</label>
                    <input
                      type="text"
                      value={senderName}
                      onChange={(e) => setSenderName(e.target.value)}
                      placeholder="John Doe"
                      className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950 py-2 px-3 text-sm text-zinc-200 focus:border-violet-500 focus:outline-none transition-colors"
                    />
                  </div>
                </div>

                {/* Dynamic Configuration Forms */}
                {provider === 'smtp' ? (
                  <div className="space-y-4 border-t border-zinc-800 pt-4">
                    <div className="grid grid-cols-3 gap-4">
                      <div className="col-span-2">
                        <label className="block text-xs font-semibold text-zinc-400 uppercase">SMTP Host</label>
                        <input
                          type="text"
                          required
                          value={smtpHost}
                          onChange={(e) => setSmtpHost(e.target.value)}
                          placeholder="mail.domain.com"
                          className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950 py-2 px-3 text-sm text-zinc-200 focus:border-violet-500 focus:outline-none transition-colors"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-zinc-400 uppercase">SMTP Port</label>
                        <input
                          type="number"
                          required
                          value={smtpPort}
                          onChange={(e) => setSmtpPort(Number(e.target.value))}
                          placeholder="465"
                          className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950 py-2 px-3 text-sm text-zinc-200 focus:border-violet-500 focus:outline-none transition-colors"
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="smtpSecure"
                        checked={smtpSecure}
                        onChange={(e) => setSmtpSecure(e.target.checked)}
                        className="rounded border-zinc-800 bg-zinc-950 text-violet-600 focus:ring-violet-500"
                      />
                      <label htmlFor="smtpSecure" className="text-xs text-zinc-300 font-medium select-none">
                        Use SSL/TLS (Check if using port 465)
                      </label>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-zinc-400 uppercase">SMTP Username</label>
                        <input
                          type="text"
                          required
                          value={smtpUsername}
                          onChange={(e) => setSmtpUsername(e.target.value)}
                          placeholder="sender@domain.com"
                          className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950 py-2 px-3 text-sm text-zinc-200 focus:border-violet-500 focus:outline-none transition-colors"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-zinc-400 uppercase">SMTP Password</label>
                        <input
                          type="password"
                          required={!editingAccount}
                          value={smtpPassword}
                          onChange={(e) => setSmtpPassword(e.target.value)}
                          placeholder={editingAccount ? "••••••••" : "Password"}
                          className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950 py-2 px-3 text-sm text-zinc-200 focus:border-violet-500 focus:outline-none transition-colors"
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4 border-t border-zinc-800 pt-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-zinc-400 uppercase">Mailgun Domain</label>
                        <input
                          type="text"
                          required
                          value={mgDomain}
                          onChange={(e) => setMgDomain(e.target.value)}
                          placeholder="mg.yourdomain.com"
                          className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950 py-2 px-3 text-sm text-zinc-200 focus:border-violet-500 focus:outline-none transition-colors"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-zinc-400 uppercase">API Key</label>
                        <input
                          type="password"
                          required={!editingAccount}
                          value={mgApiKey}
                          onChange={(e) => setMgApiKey(e.target.value)}
                          placeholder={editingAccount ? "••••••••" : "API Private Key"}
                          className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950 py-2 px-3 text-sm text-zinc-200 focus:border-violet-500 focus:outline-none transition-colors"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-zinc-400 uppercase">Region</label>
                        <select
                          value={mgRegion}
                          onChange={(e) => setMgRegion(e.target.value as 'us' | 'eu')}
                          className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950 py-2 px-3 text-sm text-zinc-200 focus:border-violet-500 focus:outline-none transition-colors"
                        >
                          <option value="us">United States (US)</option>
                          <option value="eu">Europe (EU)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-zinc-400 uppercase">Webhook Signing Key (Optional)</label>
                        <input
                          type="password"
                          value={mgWebhookKey}
                          onChange={(e) => setMgWebhookKey(e.target.value)}
                          placeholder={editingAccount?.config.webhook_signing_key ? "••••••••" : "Signing Key"}
                          className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950 py-2 px-3 text-sm text-zinc-200 focus:border-violet-500 focus:outline-none transition-colors"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Common Limits & Warmup flags */}
                <div className="grid grid-cols-2 gap-4 border-t border-zinc-800 pt-4">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-400 uppercase">Daily Send Limit</label>
                    <input
                      type="number"
                      required
                      value={dailySendLimit}
                      onChange={(e) => setDailySendLimit(Number(e.target.value))}
                      className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950 py-2 px-3 text-sm text-zinc-200 focus:border-violet-500 focus:outline-none transition-colors"
                    />
                  </div>
                  <div className="flex flex-col justify-end gap-2.5">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="isDefault"
                        checked={isDefault}
                        onChange={(e) => setIsDefault(e.target.checked)}
                        className="rounded border-zinc-800 bg-zinc-950 text-violet-600 focus:ring-violet-500"
                      />
                      <label htmlFor="isDefault" className="text-xs text-zinc-300 font-medium select-none cursor-pointer">
                        Set as Default Sender
                      </label>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="warmupEnabled"
                        checked={warmupEnabled}
                        onChange={(e) => setWarmupEnabled(e.target.checked)}
                        className="rounded border-zinc-800 bg-zinc-950 text-violet-600 focus:ring-violet-500"
                      />
                      <label htmlFor="warmupEnabled" className="text-xs text-zinc-300 font-medium select-none cursor-pointer">
                        Enable Warmup Mode
                      </label>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-2 border-t border-zinc-800 pt-4 mt-6">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-sm font-semibold text-zinc-300 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-lg bg-gradient-to-r from-violet-600 to-blue-600 text-sm font-semibold text-white hover:opacity-90 active:scale-[0.98] transition-all cursor-pointer shadow-lg shadow-violet-600/15"
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
            <div className="w-full max-w-sm rounded-xl border border-zinc-800 bg-zinc-900 p-5 shadow-2xl relative">
              <button
                onClick={() => setShowTestModal(null)}
                className="absolute top-3 right-3 p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-850 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>

              <h4 className="text-md font-bold text-white mb-3">Send Verification Email</h4>
              <p className="text-xs text-zinc-400 mb-4">
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
                    className="w-full rounded-lg border border-zinc-800 bg-zinc-950 py-2 px-3 text-sm text-zinc-200 focus:border-violet-500 focus:outline-none transition-colors"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowTestModal(null)}
                    className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-zinc-300 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!!testingId}
                    className="px-4 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-xs font-semibold text-white transition-all cursor-pointer flex items-center gap-1.5"
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
      </main>
    </div>
  );
}
