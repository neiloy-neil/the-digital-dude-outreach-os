'use client';

export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import AppShell from '@/components/reachmira/AppShell';
import PageHeader from '@/components/reachmira/PageHeader';
import Spinner from '@/components/reachmira/Spinner';
import { useToast } from '@/lib/toast/toast-context';
import { createClient } from '@/utils/supabase/client';
import {
  Settings as SettingsIcon,
  Save,
  Mail,
  Bot,
  Key,
  CheckCircle,
  Sparkles,
  ShieldAlert,
  SlidersHorizontal,
  Building2,
  ArrowRight,
  Inbox,
  RefreshCw,
  Send,
  Bell,
  TestTube2,
  User,
} from 'lucide-react';

type SettingsTab = 'profile' | 'company' | 'sending' | 'replies' | 'ai' | 'notifications' | 'testing';

type SettingsCard = {
  title: string;
  description: string;
  href: string;
  tone: 'violet' | 'teal' | 'rose' | 'zinc';
  badge: 'Core' | 'Beta' | 'Coming soon';
  icon: typeof SettingsIcon;
  disabled?: boolean;
};

const tabs: Array<{ id: SettingsTab; label: string; description: string; icon: typeof SettingsIcon }> = [
  { id: 'profile', label: 'User Profile', description: 'Personal and workspace identity', icon: User },
  { id: 'company', label: 'Company Context', description: 'Offers, services, and proof points', icon: Building2 },
  { id: 'sending', label: 'Sending', description: 'Mailgun and legacy SMTP', icon: Send },
  { id: 'replies', label: 'Reply Detection', description: 'IMAP inbox scanning', icon: Inbox },
  { id: 'ai', label: 'AI', description: 'Gemini key and AI settings', icon: Bot },
  { id: 'notifications', label: 'Notifications', description: 'Telegram reporting', icon: Bell },
  { id: 'testing', label: 'Testing', description: 'Test outbound email', icon: TestTube2 },
];

const settingsCards: SettingsCard[] = [
  {
    title: 'User Profile',
    description: 'Update display name, role/title, and timezone settings.',
    href: '#profile',
    tone: 'violet',
    badge: 'Core',
    icon: User,
  },
  {
    title: 'Company Context',
    description: 'Save your offers, services, and proof points for better copied prompts.',
    href: '#company-context',
    tone: 'teal',
    badge: 'Core',
    icon: Building2,
  },
  {
    title: 'Email Accounts',
    description: 'Connect SMTP or Mailgun sending accounts.',
    href: '/settings/email-accounts',
    tone: 'violet',
    badge: 'Core',
    icon: Mail,
  },
  {
    title: 'AI Usage',
    description: 'Track AI credits, limits, and savings.',
    href: '/settings/ai-usage',
    tone: 'teal',
    badge: 'Core',
    icon: Bot,
  },
  {
    title: 'Suppression List',
    description: 'Manage blocked emails and domains.',
    href: '/suppression-list',
    tone: 'rose',
    badge: 'Beta',
    icon: ShieldAlert,
  },
  {
    title: 'Templates',
    description: 'Create reusable outreach templates.',
    href: '/templates',
    tone: 'violet',
    badge: 'Beta',
    icon: Sparkles,
  },
];

const inputClass =
  'mt-1 w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2.5 text-sm text-zinc-900 outline-none transition focus:border-violet-300 focus:ring-2 focus:ring-violet-100';
const tealInputClass =
  'mt-1 w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2.5 text-sm text-zinc-900 outline-none transition focus:border-teal-300 focus:ring-2 focus:ring-teal-100';

function SectionHeader({
  icon: Icon,
  title,
  description,
  badge,
  tone = 'violet',
}: {
  icon: typeof SettingsIcon;
  title: string;
  description: string;
  badge?: string;
  tone?: 'violet' | 'teal';
}) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex items-start gap-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-2xl ${tone === 'teal' ? 'bg-teal-50 text-teal-600 ring-1 ring-teal-100' : 'bg-violet-50 text-violet-600 ring-1 ring-violet-100'}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <h3 className="font-semibold text-zinc-950">{title}</h3>
          <p className="mt-1 text-sm leading-6 text-zinc-500">{description}</p>
        </div>
      </div>
      {badge && (
        <span className={`w-fit rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-wide ring-1 ${tone === 'teal' ? 'bg-teal-50 text-teal-700 ring-teal-100' : 'bg-violet-50 text-violet-700 ring-violet-100'}`}>
          {badge}
        </span>
      )}
    </div>
  );
}

export default function SettingsPage() {
  const supabase = createClient();
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  const [displayName, setDisplayName] = useState('');
  const [workspaceName, setWorkspaceName] = useState('');
  const [roleTitle, setRoleTitle] = useState('');
  const [phone, setPhone] = useState('');
  const [timezone, setTimezone] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [accountEmail, setAccountEmail] = useState('');

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
  const [outreachCompanyName, setOutreachCompanyName] = useState('');
  const [outreachCompanyWebsite, setOutreachCompanyWebsite] = useState('');
  const [outreachCompanyDescription, setOutreachCompanyDescription] = useState('');
  const [outreachOffersServices, setOutreachOffersServices] = useState('');
  const [outreachValueProposition, setOutreachValueProposition] = useState('');
  const [outreachTargetCustomers, setOutreachTargetCustomers] = useState('');
  const [outreachProofPoints, setOutreachProofPoints] = useState('');

  const [testEmail, setTestEmail] = useState('');
  const [sendingTest, setSendingTest] = useState(false);
  const [testingImap, setTestingImap] = useState(false);

  // Offers state
  const [localOffers, setLocalOffers] = useState<any[]>([]);
  const [offersLoading, setOffersLoading] = useState(true);
  const [editingOfferId, setEditingOfferId] = useState<string | null>(null);
  const [newOfferName, setNewOfferName] = useState('');
  const [newOfferDesc, setNewOfferDesc] = useState('');

  const fetchOffers = async () => {
    const { data } = await supabase
      .from('offers')
      .select('*')
      .order('created_at', { ascending: false });
    setLocalOffers(data || []);
    setOffersLoading(false);
  };

  useEffect(() => {
    fetchOffers();
  }, []);

  const activeTabMeta = useMemo(() => tabs.find((tab) => tab.id === activeTab) || tabs[0], [activeTab]);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;

        setAccountEmail(user.email || '');

        const { data, error: profileError } = await supabase.from('profiles').select('*').eq('id', user.id).single();
        if (profileError) throw profileError;

        if (data) {
          setDisplayName(data.display_name || '');
          setWorkspaceName(data.workspace_name || '');
          setRoleTitle(data.role_title || '');
          setPhone(data.phone || '');
          setTimezone(data.timezone || '');
          setAvatarUrl(data.avatar_url || '');

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
          setOutreachCompanyName(data.outreach_company_name || '');
          setOutreachCompanyWebsite(data.outreach_company_website || '');
          setOutreachCompanyDescription(data.outreach_company_description || '');
          setOutreachOffersServices(data.outreach_offers_services || '');
          setOutreachValueProposition(data.outreach_value_proposition || '');
          setOutreachTargetCustomers(data.outreach_target_customers || '');
          setOutreachProofPoints(data.outreach_proof_points || '');
        }
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : 'Error loading settings profile');
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [supabase]);

  const handleSave = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setSaving(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('User session not found');

      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          display_name: displayName || null,
          workspace_name: workspaceName || null,
          role_title: roleTitle || null,
          phone: phone || null,
          timezone: timezone || null,
          avatar_url: avatarUrl || null,

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
          outreach_company_name: outreachCompanyName || null,
          outreach_company_website: outreachCompanyWebsite || null,
          outreach_company_description: outreachCompanyDescription || null,
          outreach_offers_services: outreachOffersServices || null,
          outreach_value_proposition: outreachValueProposition || null,
          outreach_target_customers: outreachTargetCustomers || null,
          outreach_proof_points: outreachProofPoints || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (updateError) throw updateError;
      toast.success('Settings saved successfully.');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error saving settings');
    } finally {
      setSaving(false);
    }
  };

  const handleSendTestEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testEmail) return;

    setSendingTest(true);
    try {
      const response = await fetch('/api/settings/test-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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

      toast.success(data.message || 'Test email sent successfully!');
      setTestEmail('');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error sending test email');
    } finally {
      setSendingTest(false);
    }
  };

  const handleTestImapConnection = async () => {
    setTestingImap(true);

    try {
      const response = await fetch('/api/settings/test-imap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imapHost,
          imapPort: imapPort ? Number(imapPort) : null,
          imapUser,
          imapPass,
        }),
      });

      const data = (await response.json()) as { message?: string; error?: string };
      if (!response.ok) throw new Error(data.error || 'Failed to test IMAP connection');
      toast.success(data.message || 'IMAP connection verified successfully.');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error testing IMAP connection');
    } finally {
      setTestingImap(false);
    }
  };

  const renderQuickCard = (card: SettingsCard) => {
    const Icon = card.icon;
    const cardContent = (
      <div
        className={`group h-full rounded-2xl border border-[var(--border)] bg-white p-5 shadow-[0_12px_40px_rgba(15,23,42,0.04)] transition hover:-translate-y-0.5 hover:shadow-[0_16px_48px_rgba(15,23,42,0.07)] ${
          card.disabled ? 'cursor-not-allowed opacity-80' : 'hover:border-violet-200'
        }`}
      >
        <div className="flex items-start justify-between gap-4">
          <div
            className={`flex h-11 w-11 items-center justify-center rounded-2xl ${
              card.tone === 'teal'
                ? 'bg-teal-50 text-teal-600 ring-1 ring-teal-100'
                : card.tone === 'rose'
                  ? 'bg-rose-50 text-rose-600 ring-1 ring-rose-100'
                  : 'bg-violet-50 text-violet-600 ring-1 ring-violet-100'
            }`}
          >
            <Icon className="h-5 w-5" />
          </div>
          <span
            className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${
              card.badge === 'Core'
                ? 'bg-emerald-50 text-emerald-700'
                : card.badge === 'Beta'
                  ? 'bg-violet-50 text-violet-700'
                  : 'bg-zinc-100 text-zinc-600'
            }`}
          >
            {card.badge}
          </span>
        </div>
        <div className="mt-4">
          <div className="flex items-center gap-2">
            <h4 className="text-base font-semibold text-zinc-950">{card.title}</h4>
            <ArrowRight className="h-4 w-4 text-zinc-400 transition group-hover:translate-x-0.5 group-hover:text-violet-600" />
          </div>
          <p className="mt-2 text-sm leading-6 text-zinc-500">{card.description}</p>
        </div>
      </div>
    );

    if (card.disabled) {
      return (
        <div key={card.title} aria-disabled="true">
          {cardContent}
        </div>
      );
    }

    if (card.href === '#company-context') {
      return (
        <button key={card.title} type="button" onClick={() => setActiveTab('company')} className="block text-left w-full">
          {cardContent}
        </button>
      );
    }

    if (card.href === '#profile') {
      return (
        <button key={card.title} type="button" onClick={() => setActiveTab('profile')} className="block text-left w-full">
          {cardContent}
        </button>
      );
    }

    return (
      <Link key={card.title} href={card.href} className="block">
        {cardContent}
      </Link>
    );
  };

  return (
    <AppShell showSearch={false}>
      <PageHeader
        eyebrow="Workspace settings"
        title="Settings"
        subtitle="Manage company context, sending credentials, reply detection, AI keys, notifications, and connection tests."
      />

      <section className="mb-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-[0.22em] text-violet-600">Quick settings</h2>
            <p className="mt-1 text-sm text-zinc-500">Jump into the parts of ReachMira that need attention.</p>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{settingsCards.map(renderQuickCard)}</div>
      </section>

      {loading ? (
        <div className="flex h-64 items-center justify-center rounded-3xl border border-[var(--border)] bg-white">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-violet-500 border-t-transparent" />
        </div>
      ) : (
        <form onSubmit={handleSave} className="space-y-6">
          <div className="rounded-3xl border border-[var(--border)] bg-white p-3 shadow-[0_12px_40px_rgba(15,23,42,0.04)]">
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-6">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`rounded-2xl border px-4 py-3 text-left transition ${
                      isActive
                        ? 'border-violet-200 bg-violet-50 text-violet-700 shadow-sm'
                        : 'border-transparent bg-white text-zinc-600 hover:border-[var(--border)] hover:bg-[var(--surface-muted)]'
                    }`}
                  >
                    <span className="flex items-center gap-2 text-sm font-semibold">
                      <Icon className="h-4 w-4" />
                      {tab.label}
                    </span>
                    <span className="mt-1 block text-xs text-zinc-500">{tab.description}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* errors/success are now shown as toasts — inline banners removed */}

          <section className="rounded-3xl border border-[var(--border)] bg-white p-6 shadow-[0_12px_40px_rgba(15,23,42,0.04)]">
            <div className="mb-6 rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] p-4">
              <div className="flex items-center gap-3">
                <activeTabMeta.icon className="h-5 w-5 text-violet-600" />
                <div>
                  <div className="text-sm font-semibold text-zinc-950">{activeTabMeta.label}</div>
                  <div className="text-sm text-zinc-500">{activeTabMeta.description}</div>
                </div>
              </div>
            </div>

            {activeTab === 'profile' && (
              <div id="profile">
                <SectionHeader
                  icon={User}
                  title="User Profile & Workspace"
                  description="Customize your personal details and workspace settings."
                  badge="Workspace Identity"
                  tone="violet"
                />
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label className="block text-xs font-semibold uppercase text-zinc-500">Display Name</label>
                    <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="John Doe" className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase text-zinc-500">Workspace Name</label>
                    <input type="text" value={workspaceName} onChange={(e) => setWorkspaceName(e.target.value)} placeholder="John's Outreach Workspace" className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase text-zinc-500">Role / Title</label>
                    <input type="text" value={roleTitle} onChange={(e) => setRoleTitle(e.target.value)} placeholder="Growth Marketer" className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase text-zinc-500">Phone / WhatsApp</label>
                    <input type="text" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 (555) 019-2834" className={inputClass} />
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label className="block text-xs font-semibold uppercase text-zinc-500">Timezone</label>
                    <input type="text" value={timezone} onChange={(e) => setTimezone(e.target.value)} placeholder="America/New_York" className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase text-zinc-500">Avatar URL</label>
                    <input type="text" value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} placeholder="https://example.com/avatar.jpg" className={inputClass} />
                  </div>
                </div>
                <div className="mt-4">
                  <label className="block text-xs font-semibold uppercase text-zinc-500">Account Email (Read-Only)</label>
                  <input type="email" readOnly disabled value={accountEmail} className="mt-1 w-full rounded-xl border border-[var(--border)] bg-zinc-50 px-3 py-2.5 text-sm text-zinc-400 outline-none cursor-not-allowed" />
                  <p className="mt-1 text-xs text-zinc-400">Account email is managed by your auth provider and cannot be changed here.</p>
                </div>
              </div>
            )}

            {activeTab === 'company' && (() => {
              const handleAddOffer = async (e: React.MouseEvent) => {
                e.preventDefault();
                if (!newOfferName.trim()) return;
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) return;

                if (editingOfferId) {
                  const { error: err } = await supabase
                    .from('offers')
                    .update({ name: newOfferName, description: newOfferDesc })
                    .eq('id', editingOfferId);
                  if (!err) {
                    setEditingOfferId(null);
                    setNewOfferName('');
                    setNewOfferDesc('');
                    fetchOffers();
                  }
                } else {
                  const { error: err } = await supabase
                    .from('offers')
                    .insert({ name: newOfferName, description: newOfferDesc, user_id: user.id });
                  if (!err) {
                    setNewOfferName('');
                    setNewOfferDesc('');
                    fetchOffers();
                  }
                }
              };

              const handleDeleteOffer = async (id: string, e: React.MouseEvent) => {
                e.preventDefault();
                if (!confirm('Are you sure you want to delete this offer?')) return;
                const { error: err } = await supabase
                  .from('offers')
                  .delete()
                  .eq('id', id);
                if (!err) {
                  fetchOffers();
                }
              };

              return (
                <div id="company-context" className="space-y-6">
                  <SectionHeader
                    icon={Building2}
                    title="Company Prompt Context & Offers"
                    description="Used when you copy lead context or follow-up prompts, so AI has your company, offers, and proof points."
                    badge="Prompt memory"
                    tone="teal"
                  />
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                      <label className="block text-xs font-semibold uppercase text-zinc-500">Company Name</label>
                      <input type="text" value={outreachCompanyName} onChange={(e) => setOutreachCompanyName(e.target.value)} placeholder="ReachMira" className={tealInputClass} />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold uppercase text-zinc-500">Website</label>
                      <input type="text" value={outreachCompanyWebsite} onChange={(e) => setOutreachCompanyWebsite(e.target.value)} placeholder="https://yourcompany.com" className={tealInputClass} />
                    </div>
                  </div>
                  <div className="mt-4 grid gap-4">
                    <div>
                      <label className="block text-xs font-semibold uppercase text-zinc-500">What Your Company Does</label>
                      <textarea rows={3} value={outreachCompanyDescription} onChange={(e) => setOutreachCompanyDescription(e.target.value)} placeholder="Short description of your company, positioning, and the kind of work you do." className={tealInputClass} />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold uppercase text-zinc-500">Value Proposition</label>
                      <textarea rows={3} value={outreachValueProposition} onChange={(e) => setOutreachValueProposition(e.target.value)} placeholder="What outcome do you help customers create? What changes after they work with you?" className={tealInputClass} />
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                      <label className="block text-xs font-semibold uppercase text-zinc-500">Best-Fit Customers</label>
                      <textarea rows={3} value={outreachTargetCustomers} onChange={(e) => setOutreachTargetCustomers(e.target.value)} placeholder="Industries, company sizes, roles, or situations where your offer fits best." className={tealInputClass} />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold uppercase text-zinc-500">Proof Points / Differentiators</label>
                      <textarea rows={3} value={outreachProofPoints} onChange={(e) => setOutreachProofPoints(e.target.value)} placeholder="Results, case studies, speed, niche expertise, guarantees, or reasons prospects should trust you." className={tealInputClass} />
                    </div>
                  </div>

                  {/* Offers / Services Library Section */}
                  <div className="border-t border-[var(--border)] pt-6 mt-6">
                    <h4 className="text-sm font-bold text-zinc-950 mb-2">Offer Library</h4>
                    <p className="text-xs text-zinc-500 mb-4">Manage custom service offers (e.g. Website redesign, AI automation, custom CRM) that you recommend to your leads.</p>

                    <div className="bg-[var(--surface-muted)] p-4 rounded-2xl border border-[var(--border)] mb-4 space-y-3">
                      <div className="text-xs font-bold text-zinc-600">{editingOfferId ? 'Edit Offer' : 'Add New Offer'}</div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <input
                          type="text"
                          value={newOfferName}
                          onChange={(e) => setNewOfferName(e.target.value)}
                          placeholder="Offer Name (e.g. AI Automation Consulting)"
                          className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-xs text-zinc-950 outline-none focus:border-teal-300 focus:ring-2 focus:ring-teal-100"
                        />
                        <input
                          type="text"
                          value={newOfferDesc}
                          onChange={(e) => setNewOfferDesc(e.target.value)}
                          placeholder="Brief Description / Pricing / Details"
                          className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-xs text-zinc-950 outline-none focus:border-teal-300 focus:ring-2 focus:ring-teal-100"
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={handleAddOffer}
                          className="rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-700"
                        >
                          {editingOfferId ? 'Update Offer' : 'Save to Library'}
                        </button>
                        {editingOfferId && (
                          <button
                            onClick={() => {
                              setEditingOfferId(null);
                              setNewOfferName('');
                              setNewOfferDesc('');
                            }}
                            className="rounded-lg bg-zinc-200 px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-300"
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    </div>

                    {offersLoading ? (
                      <div className="text-xs text-zinc-500">Loading offer library...</div>
                    ) : localOffers.length === 0 ? (
                      <div className="text-xs text-zinc-500 italic p-3 border border-dashed rounded-xl">No offers stored yet. Add custom ones like "Website redesign" or "AI automation" above.</div>
                    ) : (
                      <div className="grid gap-2 sm:grid-cols-2">
                        {localOffers.map((offer) => (
                          <div key={offer.id} className="bg-white p-3 rounded-xl border border-[var(--border)] flex justify-between items-start">
                            <div>
                              <div className="text-xs font-bold text-zinc-900">{offer.name}</div>
                              <div className="text-[11px] text-zinc-500 mt-1">{offer.description || 'No description'}</div>
                            </div>
                            <div className="flex gap-2 ml-4">
                              <button
                                onClick={(e) => {
                                  e.preventDefault();
                                  setEditingOfferId(offer.id);
                                  setNewOfferName(offer.name || '');
                                  setNewOfferDesc(offer.description || '');
                                }}
                                className="text-[10px] font-semibold text-teal-700 hover:underline"
                              >
                                Edit
                              </button>
                              <button
                                onClick={(e) => handleDeleteOffer(offer.id, e)}
                                className="text-[10px] font-semibold text-rose-700 hover:underline"
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="mt-4 rounded-2xl border border-teal-100 bg-teal-50/70 p-4 text-sm text-teal-900">
                    <div className="font-semibold">How this is used</div>
                    <p className="mt-1 text-teal-800/80">When you copy a lead context or follow-up prompt, ReachMira includes this company context before the lead details so AI can recommend copy based on your real offers and services.</p>
                  </div>
                </div>
              );
            })()}

            {activeTab === 'sending' && (
              <div className="space-y-6">
                <div>
                  <SectionHeader icon={Mail} title="Mailgun Sending Credentials" description="Legacy Mailgun settings used by the test mailer and older sending paths." />
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                      <label className="block text-xs font-semibold uppercase text-zinc-500">API Private Key</label>
                      <input type="password" value={mailgunApiKey} onChange={(e) => setMailgunApiKey(e.target.value)} placeholder="key-xxxxxxxxxxxxxxxxxxxxxxxx" className={inputClass} />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold uppercase text-zinc-500">Mailgun Domain</label>
                      <input type="text" value={mailgunDomain} onChange={(e) => setMailgunDomain(e.target.value)} placeholder="mg.yourdomain.com" className={inputClass} />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold uppercase text-zinc-500">From Email Address</label>
                      <input type="email" value={mailgunFromEmail} onChange={(e) => setMailgunFromEmail(e.target.value)} placeholder="sender@yourdomain.com" className={inputClass} />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold uppercase text-zinc-500">From Name</label>
                      <input type="text" value={mailgunFromName} onChange={(e) => setMailgunFromName(e.target.value)} placeholder="ReachMira" className={inputClass} />
                    </div>
                  </div>
                </div>

                <div className="border-t border-[var(--border)] pt-6">
                  <SectionHeader icon={Mail} title="Custom SMTP Sending Credentials" description="Alternative legacy SMTP server. If completed, older send paths prefer SMTP over Mailgun." />
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                      <label className="block text-xs font-semibold uppercase text-zinc-500">SMTP Host</label>
                      <input type="text" value={smtpHost} onChange={(e) => setSmtpHost(e.target.value)} placeholder="mail.yourdomain.com" className={inputClass} />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold uppercase text-zinc-500">SMTP Port</label>
                      <input type="number" value={smtpPort} onChange={(e) => setSmtpPort(e.target.value)} placeholder="465" className={inputClass} />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold uppercase text-zinc-500">SMTP Username</label>
                      <input type="text" value={smtpUser} onChange={(e) => setSmtpUser(e.target.value)} placeholder="user@yourdomain.com" className={inputClass} />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold uppercase text-zinc-500">SMTP Password</label>
                      <input type="password" value={smtpPass} onChange={(e) => setSmtpPass(e.target.value)} placeholder="••••••••" className={inputClass} />
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-violet-100 bg-violet-50/70 p-4 text-sm text-violet-900">
                  <div className="font-semibold">Tip</div>
                  <p className="mt-1 text-violet-800/80">For active sending accounts, use the dedicated Email Accounts page. These fields remain here for legacy/test compatibility.</p>
                  <Link href="/settings/email-accounts" className="mt-3 inline-flex font-semibold text-violet-700 hover:text-violet-800">
                    Manage Email Accounts →
                  </Link>
                </div>
              </div>
            )}

            {activeTab === 'replies' && (
              <div>
                <SectionHeader icon={Inbox} title="IMAP Incoming Credentials" description="Used to scan your inbox for replies, mark leads as replied, and stop future follow-ups." badge="Reply detection" tone="teal" />
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label className="block text-xs font-semibold uppercase text-zinc-500">IMAP Host</label>
                    <input type="text" value={imapHost} onChange={(e) => setImapHost(e.target.value)} placeholder="mail.yourdomain.com or imap.gmail.com" className={tealInputClass} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase text-zinc-500">IMAP Port</label>
                    <input type="number" value={imapPort} onChange={(e) => setImapPort(e.target.value)} placeholder="993" className={tealInputClass} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase text-zinc-500">IMAP Username</label>
                    <input type="text" value={imapUser} onChange={(e) => setImapUser(e.target.value)} placeholder="usually your full email address" className={tealInputClass} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase text-zinc-500">IMAP Password</label>
                    <input type="password" value={imapPass} onChange={(e) => setImapPass(e.target.value)} placeholder="mailbox or app password" className={tealInputClass} />
                  </div>
                </div>

                <div className="mt-4 rounded-2xl border border-teal-100 bg-teal-50/70 p-4 text-sm text-teal-900">
                  <div className="font-semibold">Common setup</div>
                  <p className="mt-1 text-teal-800/80">Use port 993 with SSL/TLS for most inboxes. Gmail and Microsoft accounts often require an app password, not your normal login password.</p>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <button type="button" onClick={handleTestImapConnection} disabled={testingImap || !imapHost || !imapUser || !imapPass} className="inline-flex items-center gap-2 rounded-xl border border-teal-200 bg-teal-50 px-4 py-2.5 text-sm font-semibold text-teal-700 transition hover:bg-teal-100 disabled:cursor-not-allowed disabled:opacity-50">
                    {testingImap ? <Spinner size={16} className="text-teal-600" /> : <Inbox className="h-4 w-4" />}
                    {testingImap ? 'Testing IMAP...' : 'Test IMAP Connection'}
                  </button>
                  <p className="text-xs text-zinc-500">Save after a successful test so the reply-checking cron can use these credentials.</p>
                </div>
              </div>
            )}

            {activeTab === 'ai' && (
              <div>
                <SectionHeader icon={Key} title="Gemini AI Key" description="Required to generate personalized introduction strings for leads before queuing emails." />
                <div>
                  <label className="block text-xs font-semibold uppercase text-zinc-500">Gemini API Key</label>
                  <input type="password" value={geminiApiKey} onChange={(e) => setGeminiApiKey(e.target.value)} placeholder="AIzaSy..." className={inputClass} />
                </div>
                <div className="mt-4 rounded-2xl border border-violet-100 bg-violet-50/70 p-4 text-sm text-violet-900">
                  <div className="font-semibold">Usage and limits</div>
                  <p className="mt-1 text-violet-800/80">Model selection, budgets, and batch thresholds live in AI Usage settings.</p>
                  <Link href="/settings/ai-usage" className="mt-3 inline-flex font-semibold text-violet-700 hover:text-violet-800">
                    Open AI Usage Settings →
                  </Link>
                </div>
              </div>
            )}

            {activeTab === 'notifications' && (
              <div>
                <SectionHeader icon={Bot} title="Telegram Bot Daily Reporting" description="Receive automated morning outreach dashboard statistics directly on your device." />
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label className="block text-xs font-semibold uppercase text-zinc-500">Telegram Chat ID</label>
                    <input type="text" value={telegramChatId} onChange={(e) => setTelegramChatId(e.target.value)} placeholder="123456789" className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase text-zinc-500">Telegram Bot Token</label>
                    <input type="password" value={telegramBotToken} onChange={(e) => setTelegramBotToken(e.target.value)} placeholder="123456789:ABCdefGhIJKlmNoPQRsTuvwxYZ" className={inputClass} />
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'testing' && (
              <div>
                <SectionHeader icon={TestTube2} title="Test Mailer Connection" description="Send a test message using the current SMTP or Mailgun values on this page." />
                <div className="max-w-md space-y-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase text-zinc-500">Recipient Email Address</label>
                    <input type="email" required value={testEmail} onChange={(e) => setTestEmail(e.target.value)} placeholder="receiver@example.com" className={inputClass} />
                  </div>
                  <button type="button" onClick={(event) => void handleSendTestEmail(event as unknown as React.FormEvent)} disabled={sendingTest || !testEmail} className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-white px-6 py-2.5 text-sm font-semibold text-zinc-700 transition hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700 disabled:cursor-not-allowed disabled:opacity-50">
                    {sendingTest ? <Spinner size={16} className="text-violet-500" /> : <Mail className="h-4 w-4" />}
                    {sendingTest ? 'Sending...' : 'Send Test Email'}
                  </button>
                </div>
              </div>
            )}
          </section>

          <div className="sticky bottom-4 z-10 rounded-3xl border border-white/80 bg-white/90 p-4 shadow-[0_18px_60px_rgba(15,23,42,0.12)] backdrop-blur-xl">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-sm font-semibold text-zinc-950">Save workspace settings</div>
                <p className="text-xs text-zinc-500">Applies changes across all tabs. Test actions can be run before or after saving.</p>
              </div>
              <button type="submit" disabled={saving} className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-teal-500 px-6 py-2.5 font-semibold text-white shadow-lg shadow-violet-600/20 transition hover:opacity-95 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50">
                {saving ? <Spinner size={16} className="text-white" /> : <Save className="h-4 w-4" />}
                {saving ? 'Saving...' : 'Save Settings'}
              </button>
            </div>
          </div>
        </form>
      )}
    </AppShell>
  );
}
