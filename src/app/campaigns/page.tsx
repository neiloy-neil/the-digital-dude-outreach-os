'use client';

export const dynamic = 'force-dynamic';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Plus, Send, Play, Pause, Trash2, Edit3, Sparkles } from 'lucide-react';
import Link from 'next/link';
import AppShell from '@/components/reachmira/AppShell';
import PageHeader from '@/components/reachmira/PageHeader';
import EmptyState from '@/components/reachmira/EmptyState';
import Spinner from '@/components/reachmira/Spinner';
import { Badge, Banner, Button, ConfirmDialog, Field, Input } from '@/components/reachmira/ui';

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

  const [deleteTarget, setDeleteTarget] = useState<CampaignRow | null>(null);

  const handleDeleteCampaign = async (id: string) => {
    try {
      const { error } = await supabase
        .from('campaigns')
        .delete()
        .eq('id', id);

      if (error) throw error;
      await loadCampaigns();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error deleting campaign');
    } finally {
      setDeleteTarget(null);
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

      {error && <Banner tone="error" className="mb-6" onDismiss={() => setError(null)}>{error}</Banner>}

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <section className="rounded-3xl border border-[var(--border)] bg-white p-6 shadow-[0_12px_40px_rgba(15,23,42,0.04)]">
          <h3 className="text-lg font-semibold text-zinc-950">Create New Campaign</h3>
          <p className="mt-1 text-sm text-zinc-500">Start with a clear offer and a simple sequence.</p>
          <form onSubmit={handleCreateCampaign} className="mt-5 space-y-4">
            <Field label="Campaign Name" htmlFor="new-campaign-name">
              <Input
                id="new-campaign-name"
                type="text"
                required
                value={newCampaignName}
                onChange={(e) => setNewCampaignName(e.target.value)}
                placeholder="SaaS Founders Q2 Outreach"
              />
            </Field>
            <Button type="submit" variant="primary" className="w-full" loading={creating}>
              {!creating && <Plus className="h-4 w-4" />}
              Create Campaign
            </Button>
          </form>
        </section>

        <section className="space-y-4">
          {loading ? (
            <div className="flex h-48 items-center justify-center rounded-3xl border border-[var(--border)] bg-white text-violet-500">
              <Spinner size={32} />
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
                        <Badge tone={camp.status === 'active' ? 'emerald' : camp.status === 'paused' ? 'amber' : 'zinc'} className="uppercase tracking-wide">
                          {camp.status}
                        </Badge>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-zinc-500">
                        <span>{leadCount} leads</span>
                        <span>{stepCount} steps</span>
                        <span>Created {new Date(camp.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {camp.status !== 'draft' && (
                        <Button
                          onClick={() => handleToggleStatus(camp.id, camp.status)}
                          aria-label={camp.status === 'active' ? 'Pause Campaign' : 'Resume Campaign'}
                          title={camp.status === 'active' ? 'Pause Campaign' : 'Resume Campaign'}
                        >
                          {camp.status === 'active' ? <Pause className="h-4 w-4 text-amber-600" /> : <Play className="h-4 w-4 text-emerald-600" />}
                        </Button>
                      )}
                      <Link href={`/campaigns/${camp.id}`} className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-700">
                        <Edit3 className="h-4 w-4" />
                        Edit Sequence
                      </Link>
                      <Button
                        variant="danger"
                        onClick={() => setDeleteTarget(camp)}
                        aria-label={`Delete campaign ${camp.name}`}
                        title="Delete Campaign"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </section>
      </div>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete campaign?"
        description={`"${deleteTarget?.name || 'This campaign'}" and all of its leads, sequences, and outbox logs will be deleted. This cannot be undone.`}
        confirmLabel="Delete Campaign"
        onConfirm={async () => {
          if (deleteTarget) await handleDeleteCampaign(deleteTarget.id);
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </AppShell>
  );
}
