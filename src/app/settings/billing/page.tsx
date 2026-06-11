'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import AppShell from '@/components/reachmira/AppShell';
import PageHeader from '@/components/reachmira/PageHeader';
import { CreditCard, Check, Zap } from 'lucide-react';
import { useToast } from '@/lib/toast/toast-context';
import Spinner from '@/components/reachmira/Spinner';

export default function BillingPage() {
  const supabase = createClient();
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [upgrading, setUpgrading] = useState(false);

  useEffect(() => {
    async function loadProfile() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      setProfile(data);
      setLoading(false);
    }
    loadProfile();
  }, [supabase]);

  const handleUpgrade = async (priceId: string) => {
    setUpgrading(true);
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceId }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error(data.error || 'Failed to create checkout session');
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setUpgrading(false);
    }
  };

  const handleManageBilling = async () => {
    try {
      const res = await fetch('/api/stripe/portal', { method: 'POST' });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error(data.error || 'Failed to open billing portal');
      }
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  if (loading) {
    return (
      <AppShell>
        <div className="flex h-64 items-center justify-center">
          <Spinner size={32} className="text-violet-500" />
        </div>
      </AppShell>
    );
  }

  const isSubscribed = profile?.subscription_status === 'active';

  return (
    <AppShell>
      <PageHeader
        eyebrow="Settings"
        title="Billing & Subscriptions"
        subtitle="Manage your current plan, view invoices, and upgrade to unlock higher limits."
      />

      <div className="mx-auto max-w-5xl space-y-8 mt-6">
        {/* Current Plan Card */}
        <div className="rounded-3xl border border-[var(--border)] bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-50 text-violet-600 ring-1 ring-violet-100">
                <CreditCard className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-zinc-950">Current Plan: {isSubscribed ? 'Pro / Agency' : 'Free Trial'}</h3>
                <p className="text-sm text-zinc-500">Status: <span className="font-medium capitalize text-zinc-900">{profile?.subscription_status || 'Trialing'}</span></p>
              </div>
            </div>
            {isSubscribed && (
              <button
                onClick={handleManageBilling}
                className="rounded-xl border border-[var(--border)] bg-white px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
              >
                Manage Billing
              </button>
            )}
          </div>
        </div>

        {/* Pricing Tiers */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Free Tier */}
          <div className="rounded-3xl border border-[var(--border)] bg-white p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-zinc-950">Free Trial</h3>
            <p className="mt-2 text-sm text-zinc-500">For testing out the platform.</p>
            <div className="mt-4 text-3xl font-bold">$0<span className="text-sm font-normal text-zinc-500">/mo</span></div>
            <ul className="mt-6 space-y-3">
              {['Send up to 50 emails/day', 'Basic AI Personalization', 'Community Support'].map((feature, i) => (
                <li key={i} className="flex items-center gap-3 text-sm text-zinc-600">
                  <Check className="h-4 w-4 text-emerald-500" /> {feature}
                </li>
              ))}
            </ul>
            <button disabled className="mt-8 w-full rounded-xl bg-zinc-100 py-3 text-sm font-semibold text-zinc-400">
              Current Plan
            </button>
          </div>

          {/* Pro Tier */}
          <div className="relative rounded-3xl border-2 border-violet-500 bg-white p-6 shadow-md">
            <div className="absolute -top-3 right-6 rounded-full bg-violet-500 px-3 py-1 text-xs font-semibold uppercase text-white">Recommended</div>
            <h3 className="text-lg font-semibold text-zinc-950">Growth Plan</h3>
            <p className="mt-2 text-sm text-zinc-500">For scaling your outreach.</p>
            <div className="mt-4 text-3xl font-bold">$49<span className="text-sm font-normal text-zinc-500">/mo</span></div>
            <ul className="mt-6 space-y-3">
              {['Unlimited email sending', 'Deep AI Research & Personalization', 'Priority Support', 'Custom Sending Domains'].map((feature, i) => (
                <li key={i} className="flex items-center gap-3 text-sm text-zinc-600">
                  <Check className="h-4 w-4 text-violet-500" /> {feature}
                </li>
              ))}
            </ul>
            <button
              onClick={() => handleUpgrade('price_example_id_replace_me')}
              disabled={upgrading || isSubscribed}
              className="mt-8 flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 py-3 text-sm font-semibold text-white transition hover:bg-violet-700 disabled:opacity-50"
            >
              <Zap className="h-4 w-4" />
              {isSubscribed ? 'Subscribed' : upgrading ? 'Loading...' : 'Upgrade to Growth'}
            </button>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
