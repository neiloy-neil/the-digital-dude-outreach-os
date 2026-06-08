'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import { createClient } from '@/utils/supabase/client';
import { Settings as SettingsIcon, Save, Mail, Bot, Key, CheckCircle } from 'lucide-react';

export default function SettingsPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Profile Form States
  const [mailgunApiKey, setMailgunApiKey] = useState('');
  const [mailgunDomain, setMailgunDomain] = useState('');
  const [mailgunFromEmail, setMailgunFromEmail] = useState('');
  const [mailgunFromName, setMailgunFromName] = useState('');
  const [smtpHost, setSmtpHost] = useState('');
  const [smtpPort, setSmtpPort] = useState('');
  const [smtpUser, setSmtpUser] = useState('');
  const [smtpPass, setSmtpPass] = useState('');
  const [imapHost, setImapHost] = useState('');
  const [imapPort, setImapPort] = useState('');
  const [imapUser, setImapUser] = useState('');
  const [imapPass, setImapPass] = useState('');
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [telegramChatId, setTelegramChatId] = useState('');
  const [telegramBotToken, setTelegramBotToken] = useState('');

  // Test Email States
  const [testEmail, setTestEmail] = useState('');
  const [sendingTest, setSendingTest] = useState(false);
  const [testSuccess, setTestSuccess] = useState<string | null>(null);
  const [testError, setTestError] = useState<string | null>(null);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        if (error) throw error;

        if (data) {
          setMailgunApiKey(data.mailgun_api_key || '');
          setMailgunDomain(data.mailgun_domain || '');
          setMailgunFromEmail(data.mailgun_from_email || '');
          setMailgunFromName(data.mailgun_from_name || '');
          setSmtpHost(data.smtp_host || '');
          setSmtpPort(data.smtp_port ? String(data.smtp_port) : '');
          setSmtpUser(data.smtp_user || '');
          setSmtpPass(data.smtp_pass || '');
          setImapHost(data.imap_host || '');
          setImapPort(data.imap_port ? String(data.imap_port) : '');
          setImapUser(data.imap_user || '');
          setImapPass(data.imap_pass || '');
          setGeminiApiKey(data.gemini_api_key || '');
          setTelegramChatId(data.telegram_chat_id || '');
          setTelegramBotToken(data.telegram_bot_token || '');
        }
      } catch (err: any) {
        setError(err.message || 'Error loading settings profile');
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [supabase]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccess(false);
    setError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User session not found');

      const { error } = await supabase
        .from('profiles')
        .update({
          mailgun_api_key: mailgunApiKey || null,
          mailgun_domain: mailgunDomain || null,
          mailgun_from_email: mailgunFromEmail || null,
          mailgun_from_name: mailgunFromName || null,
          smtp_host: smtpHost || null,
          smtp_port: smtpPort ? Number(smtpPort) : null,
          smtp_user: smtpUser || null,
          smtp_pass: smtpPass || null,
          imap_host: imapHost || null,
          imap_port: imapPort ? Number(imapPort) : null,
          imap_user: imapUser || null,
          imap_pass: imapPass || null,
          gemini_api_key: geminiApiKey || null,
          telegram_chat_id: telegramChatId || null,
          telegram_bot_token: telegramBotToken || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (error) throw error;
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message || 'Error saving settings');
    } finally {
      setSaving(false);
    }
  };

  const handleSendTestEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testEmail) return;
    
    setSendingTest(true);
    setTestSuccess(null);
    setTestError(null);

    try {
      const response = await fetch('/api/settings/test-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          targetEmail: testEmail,
          mailgunApiKey,
          mailgunDomain,
          mailgunFromEmail,
          mailgunFromName,
          smtpHost,
          smtpPort: smtpPort ? Number(smtpPort) : null,
          smtpUser,
          smtpPass,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to send test email');

      setTestSuccess(data.message || 'Test email dispatched successfully!');
      setTestEmail('');
    } catch (err: any) {
      setTestError(err.message || 'Error sending test email');
    } finally {
      setSendingTest(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-zinc-950 text-zinc-100">
      <Sidebar />
      <main className="flex-1 p-8 overflow-y-auto max-w-5xl">
        <div className="flex items-center gap-3 mb-8">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-600/10 text-violet-400">
            <SettingsIcon className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white tracking-tight">Configuration Settings</h2>
            <p className="text-sm text-zinc-400">Manage API keys and external service integrations.</p>
          </div>
        </div>

        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-violet-500 border-t-transparent" />
          </div>
        ) : (
          <>
            <form onSubmit={handleSave} className="space-y-6">
            {/* Mailgun Configuration */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6 backdrop-blur-sm">
              <div className="flex items-center gap-2 mb-4 text-white font-semibold">
                <Mail className="h-5 w-5 text-violet-400" />
                <h3>Mailgun Sending Credentials</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-zinc-400 font-semibold uppercase">API Private Key</label>
                  <input
                    type="password"
                    value={mailgunApiKey}
                    onChange={(e) => setMailgunApiKey(e.target.value)}
                    placeholder="key-xxxxxxxxxxxxxxxxxxxxxxxx"
                    className="mt-1 w-full rounded-lg border border-zinc-855 bg-zinc-950 py-2 px-3 text-sm text-zinc-200 focus:border-violet-500 focus:outline-none transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 font-semibold uppercase">Mailgun Domain</label>
                  <input
                    type="text"
                    value={mailgunDomain}
                    onChange={(e) => setMailgunDomain(e.target.value)}
                    placeholder="mg.yourdomain.com"
                    className="mt-1 w-full rounded-lg border border-zinc-855 bg-zinc-950 py-2 px-3 text-sm text-zinc-200 focus:border-violet-500 focus:outline-none transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 font-semibold uppercase">From Email Address</label>
                  <input
                    type="email"
                    value={mailgunFromEmail}
                    onChange={(e) => setMailgunFromEmail(e.target.value)}
                    placeholder="sender@yourdomain.com"
                    className="mt-1 w-full rounded-lg border border-zinc-855 bg-zinc-950 py-2 px-3 text-sm text-zinc-200 focus:border-violet-500 focus:outline-none transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 font-semibold uppercase">From Name</label>
                  <input
                    type="text"
                    value={mailgunFromName}
                    onChange={(e) => setMailgunFromName(e.target.value)}
                    placeholder="The Digital Dude"
                    className="mt-1 w-full rounded-lg border border-zinc-855 bg-zinc-950 py-2 px-3 text-sm text-zinc-200 focus:border-violet-500 focus:outline-none transition-colors"
                  />
                </div>
              </div>
            </div>

            {/* Custom SMTP Configuration */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6 backdrop-blur-sm">
              <div className="flex items-center gap-2 mb-4 text-white font-semibold">
                <Mail className="h-5 w-5 text-violet-400" />
                <h3>Custom SMTP Sending Credentials (Alternative to Mailgun)</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-zinc-400 font-semibold uppercase">SMTP Host</label>
                  <input
                    type="text"
                    value={smtpHost}
                    onChange={(e) => setSmtpHost(e.target.value)}
                    placeholder="mail.yourdomain.com"
                    className="mt-1 w-full rounded-lg border border-zinc-855 bg-zinc-950 py-2 px-3 text-sm text-zinc-200 focus:border-violet-500 focus:outline-none transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 font-semibold uppercase">SMTP Port</label>
                  <input
                    type="number"
                    value={smtpPort}
                    onChange={(e) => setSmtpPort(e.target.value)}
                    placeholder="465"
                    className="mt-1 w-full rounded-lg border border-zinc-855 bg-zinc-950 py-2 px-3 text-sm text-zinc-200 focus:border-violet-500 focus:outline-none transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 font-semibold uppercase">SMTP Username</label>
                  <input
                    type="text"
                    value={smtpUser}
                    onChange={(e) => setSmtpUser(e.target.value)}
                    placeholder="user@yourdomain.com"
                    className="mt-1 w-full rounded-lg border border-zinc-855 bg-zinc-950 py-2 px-3 text-sm text-zinc-200 focus:border-violet-500 focus:outline-none transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 font-semibold uppercase">SMTP Password</label>
                  <input
                    type="password"
                    value={smtpPass}
                    onChange={(e) => setSmtpPass(e.target.value)}
                    placeholder="••••••••"
                    className="mt-1 w-full rounded-lg border border-zinc-855 bg-zinc-950 py-2 px-3 text-sm text-zinc-200 focus:border-violet-500 focus:outline-none transition-colors"
                  />
                </div>
              </div>
              <p className="mt-2 text-xs text-zinc-500">If completed, the system will automatically prefer this SMTP server to send outreach emails rather than Mailgun.</p>
            </div>

            {/* Custom IMAP Configuration */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6 backdrop-blur-sm">
              <div className="flex items-center gap-2 mb-4 text-white font-semibold">
                <Bot className="h-5 w-5 text-violet-400" />
                <h3>Custom IMAP Incoming Credentials (For cPanel Reply Detection)</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-zinc-400 font-semibold uppercase">IMAP Host</label>
                  <input
                    type="text"
                    value={imapHost}
                    onChange={(e) => setImapHost(e.target.value)}
                    placeholder="mail.yourdomain.com"
                    className="mt-1 w-full rounded-lg border border-zinc-855 bg-zinc-950 py-2 px-3 text-sm text-zinc-200 focus:border-violet-500 focus:outline-none transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 font-semibold uppercase">IMAP Port</label>
                  <input
                    type="number"
                    value={imapPort}
                    onChange={(e) => setImapPort(e.target.value)}
                    placeholder="993"
                    className="mt-1 w-full rounded-lg border border-zinc-855 bg-zinc-950 py-2 px-3 text-sm text-zinc-200 focus:border-violet-500 focus:outline-none transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 font-semibold uppercase">IMAP Username</label>
                  <input
                    type="text"
                    value={imapUser}
                    onChange={(e) => setImapUser(e.target.value)}
                    placeholder="user@yourdomain.com"
                    className="mt-1 w-full rounded-lg border border-zinc-855 bg-zinc-950 py-2 px-3 text-sm text-zinc-200 focus:border-violet-500 focus:outline-none transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 font-semibold uppercase">IMAP Password</label>
                  <input
                    type="password"
                    value={imapPass}
                    onChange={(e) => setImapPass(e.target.value)}
                    placeholder="••••••••"
                    className="mt-1 w-full rounded-lg border border-zinc-855 bg-zinc-950 py-2 px-3 text-sm text-zinc-200 focus:border-violet-500 focus:outline-none transition-colors"
                  />
                </div>
              </div>
              <p className="mt-2 text-xs text-zinc-500">Provide incoming IMAP host settings to scan for replies and automatically stop follow-ups.</p>
            </div>

            {/* Gemini Personalization Configuration */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6 backdrop-blur-sm">
              <div className="flex items-center gap-2 mb-4 text-white font-semibold">
                <Key className="h-5 w-5 text-violet-400" />
                <h3>Gemini AI Key</h3>
              </div>
              <div>
                <label className="block text-xs text-zinc-400 font-semibold uppercase">Gemini API Key</label>
                <input
                  type="password"
                  value={geminiApiKey}
                  onChange={(e) => setGeminiApiKey(e.target.value)}
                  placeholder="AIzaSy..."
                  className="mt-1 w-full rounded-lg border border-zinc-855 bg-zinc-950 py-2 px-3 text-sm text-zinc-200 focus:border-violet-500 focus:outline-none transition-colors"
                />
                <p className="mt-1 text-xs text-zinc-500">Required to generate personalized introduction strings for leads before queuing emails.</p>
              </div>
            </div>

            {/* Telegram Configuration */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6 backdrop-blur-sm">
              <div className="flex items-center gap-2 mb-4 text-white font-semibold">
                <Bot className="h-5 w-5 text-violet-400" />
                <h3>Telegram Bot Daily Reporting</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-zinc-400 font-semibold uppercase">Telegram Chat ID</label>
                  <input
                    type="text"
                    value={telegramChatId}
                    onChange={(e) => setTelegramChatId(e.target.value)}
                    placeholder="123456789"
                    className="mt-1 w-full rounded-lg border border-zinc-855 bg-zinc-950 py-2 px-3 text-sm text-zinc-200 focus:border-violet-500 focus:outline-none transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 font-semibold uppercase">Telegram Bot Token</label>
                  <input
                    type="password"
                    value={telegramBotToken}
                    onChange={(e) => setTelegramBotToken(e.target.value)}
                    placeholder="123456789:ABCdefGhIJKlmNoPQRsTuvwxYZ"
                    className="mt-1 w-full rounded-lg border border-zinc-855 bg-zinc-950 py-2 px-3 text-sm text-zinc-200 focus:border-violet-500 focus:outline-none transition-colors"
                  />
                </div>
              </div>
              <p className="mt-2.5 text-xs text-zinc-500">Provide bot token and target chat ID to receive automated morning outreach dashboard statistics directly on your device.</p>
            </div>

            {/* Error and Success Indicators */}
            {error && (
              <div className="rounded-lg bg-rose-500/10 p-3 text-xs text-rose-400 border border-rose-500/20">
                {error}
              </div>
            )}

            {success && (
              <div className="rounded-lg bg-emerald-500/10 p-3 text-xs text-emerald-400 border border-emerald-500/20 flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-emerald-400" />
                Configurations saved successfully!
              </div>
            )}

            {/* Save Button */}
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 rounded-lg bg-gradient-to-r from-violet-600 to-blue-600 font-semibold text-white shadow-lg shadow-violet-600/20 hover:opacity-90 active:scale-[0.98] transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {saving ? (
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <>
                  <Save className="h-4 w-4" /> Save Settings
                </>
              )}
            </button>
          </form>

          {/* Test Email Connection Form */}
          <div className="mt-8 rounded-xl border border-zinc-800 bg-zinc-900/40 p-6 backdrop-blur-sm">
            <div className="flex items-center gap-2 mb-4 text-white font-semibold">
              <Mail className="h-5 w-5 text-violet-400" />
              <h3>Test Mailer Connection</h3>
            </div>
            
            <form onSubmit={handleSendTestEmail} className="space-y-4 max-w-md">
              <div>
                <label className="block text-xs text-zinc-400 font-semibold uppercase">Recipient Email Address</label>
                <input
                  type="email"
                  required
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  placeholder="receiver@example.com"
                  className="mt-1 w-full rounded-lg border border-zinc-855 bg-zinc-950 py-2 px-3 text-sm text-zinc-200 focus:border-violet-500 focus:outline-none transition-colors"
                />
              </div>

              {testError && (
                <div className="rounded-lg bg-rose-500/10 p-3 text-xs text-rose-400 border border-rose-500/20">
                  {testError}
                </div>
              )}

              {testSuccess && (
                <div className="rounded-lg bg-emerald-500/10 p-3 text-xs text-emerald-400 border border-emerald-500/20">
                  {testSuccess}
                </div>
              )}

              <button
                type="submit"
                disabled={sendingTest}
                className="px-6 py-2 rounded-lg bg-zinc-900 border border-zinc-800 font-semibold text-zinc-200 hover:text-white hover:bg-zinc-855 transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer text-sm"
              >
                {sendingTest ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  <>
                    Send Test Email
                  </>
                )}
              </button>
            </form>
          </div>
         </>
        )}
      </main>
    </div>
  );
}
