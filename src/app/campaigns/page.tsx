'use client';

export const dynamic = 'force-dynamic';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Plus, Send, Play, Pause, Trash2, Edit3, Sparkles } from 'lucide-react';
import Link from 'next/link';
import AppShell from '@/components/reachmira/AppShell';
import PageHeader from '@/components/reachmira/PageHeader';
import EmptyState from '@/components/reachmira/EmptyState';

type CampaignRow = {
  id: string;
  name: string;
  status: string;
  created_at: string;
  leads?: Array<{ count?: number | null }>;
  sequences?: Array<{ count?: number | null }>;
};

export default function CampaignsPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [newCampaignName, setNewCampaignName] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadCampaigns = useCallback(async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('campaigns')
        .select(`
          id,
          name,
          status,
          created_at,
          leads (count),
          sequences (count)
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCampaigns((data || []) as CampaignRow[]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error loading campaigns');
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadCampaigns();
  }, [loadCampaigns]);

  const handleCreateCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCampaignName.trim()) return;

    setCreating(true);
    setError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { error } = await supabase
        .from('campaigns')
        .insert({
          name: newCampaignName,
          user_id: user.id,
          status: 'draft',
        });

      if (error) throw error;
      
      setNewCampaignName('');
      await loadCampaigns();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error creating campaign');
    } finally {
      setCreating(false);
    }
  };

  const handleToggleStatus = async (id: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'active' ? 'paused' : 'active';
    try {
      const { error } = await supabase
        .from('campaigns')
        .update({ status: nextStatus, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
      await loadCampaigns();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error toggling campaign status');
    }
  };

  const handleDeleteCampaign = async (id: string) => {
    if (!confirm('Are you sure you want to delete this campaign? All leads, sequences, and outbox logs will be deleted.')) return;

    try {
      const { error } = await supabase
        .from('campaigns')
        .delete()
        .eq('id', id);

      if (error) throw error;
      await loadCampaigns();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error deleting campaign');
    }
  };

  return (
    <AppShell>
      <PageHeader
        eyebrow="Campaigns"
        title="Campaigns"
        subtitle="Build outreach sequences and track performance."
        actions={
          <Link href="/campaigns/new" className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-700">
            <Sparkles className="h-4 w-4" />
            New campaign
          </Link>
        }
      />

      {error && <div className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <section className="rounded-3xl border border-[var(--border)] bg-white p-6 shadow-[0_12px_40px_rgba(15,23,42,0.04)]">
          <h3 className="text-lg font-semibold text-zinc-950">Create New Campaign</h3>
          <p className="mt-1 text-sm text-zinc-500">Start with a clear offer and a simple sequence.</p>
          <form onSubmit={handleCreateCampaign} className="mt-5 space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500">Campaign Name</label>
              <input
                type="text"
                required
                value={newCampaignName}
                onChange={(e) => setNewCampaignName(e.target.value)}
                placeholder="SaaS Founders Q2 Outreach"
                className="mt-1 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 text-sm text-zinc-900 outline-none focus:border-violet-300 focus:bg-white"
              />
            </div>
            <button
              type="submit"
              disabled={creating}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-zinc-950 px-4 py-3 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50"
            >
              {creating ? <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" /> : <Plus className="h-4 w-4" />}
              Create Campaign
            </button>
          </form>
        </section>

        <section className="space-y-4">
          {loading ? (
            <div className="flex h-48 items-center justify-center rounded-3xl border border-[var(--border)] bg-white">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-violet-500 border-t-transparent" />
            </div>
          ) : campaigns.length === 0 ? (
            <EmptyState
              icon={Send}
              title="No campaigns yet"
              description="Create a campaign when you are ready to send a sequence."
              actionLabel="Create Campaign"
              actionHref="/campaigns/new"
              actionIcon={Sparkles}
            />
          ) : (
            campaigns.map((camp) => {
              const leadCount = camp.leads?.[0]?.count || 0;
              const stepCount = camp.sequences?.[0]?.count || 0;
              return (
                <div key={camp.id} className="rounded-3xl border border-[var(--border)] bg-white p-6 shadow-[0_12px_40px_rgba(15,23,42,0.04)]">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="text-lg font-semibold text-zinc-950">{camp.name}</h4>
                        <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${
                          camp.status === 'active'
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                            : camp.status === 'paused'
                              ? 'border-amber-200 bg-amber-50 text-amber-700'
                              : 'border-zinc-200 bg-zinc-100 text-zinc-700'
                        }`}>
                          {camp.status}
                        </span>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-zinc-500">
                        <span>{leadCount} leads</span>
                        <span>{stepCount} steps</span>
                        <span>Created {new Date(camp.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {camp.status !== 'draft' && (
                        <button
                          onClick={() => handleToggleStatus(camp.id, camp.status)}
                          className="inline-flex items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-sm font-semibold text-zinc-700 hover:bg-white"
                          title={camp.status === 'active' ? 'Pause Campaign' : 'Resume Campaign'}
                        >
                          {camp.status === 'active' ? <Pause className="h-4 w-4 text-amber-600" /> : <Play className="h-4 w-4 text-emerald-600" />}
                        </button>
                      )}
                      <Link href={`/campaigns/${camp.id}`} className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-700">
                        <Edit3 className="h-4 w-4" />
                        Edit Sequence
                      </Link>
                      <button
                        onClick={() => handleDeleteCampaign(camp.id)}
                        className="inline-flex items-center justify-center rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-zinc-500 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700"
                        title="Delete Campaign"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </section>
      </div>
    </AppShell>
  );
}
