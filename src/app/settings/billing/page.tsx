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

        {/* Billing Coming Soon */}
        <div className="rounded-3xl border border-dashed border-violet-200 bg-violet-50/50 p-10 text-center shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-100 text-violet-600 mb-5">
            <Zap className="h-7 w-7" />
          </div>
          <h3 className="text-xl font-semibold text-zinc-900">Paid plans coming soon</h3>
          <p className="mt-2 text-sm text-zinc-500 max-w-sm mx-auto">
            We&apos;re finalizing our pricing. In the meantime, you have full access to all features — no limits.
          </p>
        </div>
      </div>
    </AppShell>
  );
}
