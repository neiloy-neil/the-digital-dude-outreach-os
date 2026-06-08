'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import { createClient } from '@/utils/supabase/client';
import { Plus, Send, Play, Pause, Trash2, Edit3, ArrowRight } from 'lucide-react';
import Link from 'next/link';

export default function CampaignsPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [newCampaignName, setNewCampaignName] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadCampaigns();
  }, []);

  const loadCampaigns = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
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
      setCampaigns(data || []);
    } catch (err: any) {
      setError(err.message || 'Error loading campaigns');
    } finally {
      setLoading(false);
    }
  };

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
    } catch (err: any) {
      setError(err.message || 'Error creating campaign');
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
    } catch (err: any) {
      setError(err.message || 'Error toggling campaign status');
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
    } catch (err: any) {
      setError(err.message || 'Error deleting campaign');
    }
  };

  return (
    <div className="flex min-h-screen bg-zinc-950 text-zinc-100">
      <Sidebar />
      <main className="flex-1 p-8 overflow-y-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-3xl font-extrabold text-white tracking-tight">Campaigns</h2>
            <p className="text-sm text-zinc-400 mt-1">Manage and launch your outreach sequences.</p>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-6 rounded-lg bg-rose-500/10 p-3 text-xs text-rose-400 border border-rose-500/20">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          {/* Create New Campaign Inline Form */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6 backdrop-blur-sm">
            <h3 className="font-bold text-white mb-4 text-lg">Create New Campaign</h3>
            <form onSubmit={handleCreateCampaign} className="space-y-4">
              <div>
                <label className="block text-xs text-zinc-400 font-semibold uppercase">Campaign Name</label>
                <input
                  type="text"
                  required
                  value={newCampaignName}
                  onChange={(e) => setNewCampaignName(e.target.value)}
                  placeholder="E.g. SaaS Founders Q2 Outreach"
                  className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950 py-2 px-3 text-sm text-zinc-200 focus:border-violet-500 focus:outline-none transition-colors"
                />
              </div>
              <button
                type="submit"
                disabled={creating}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-gradient-to-r from-violet-600 to-blue-600 font-semibold text-white shadow-lg shadow-violet-600/20 hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer text-sm"
              >
                {creating ? (
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  <>
                    <Plus className="h-4 w-4" /> Create Campaign
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Campaigns List */}
          <div className="lg:col-span-2 space-y-4">
            {loading ? (
              <div className="flex h-48 items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-violet-500 border-t-transparent" />
              </div>
            ) : campaigns.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 border border-dashed border-zinc-800 rounded-lg p-6">
                <Send className="h-10 w-10 text-zinc-600 mb-3" />
                <p className="text-sm text-zinc-500 font-medium">No campaigns created yet.</p>
                <p className="text-xs text-zinc-600 mt-1">Use the panel on the left to start your first sequence.</p>
              </div>
            ) : (
              campaigns.map((camp) => {
                const leadCount = camp.leads?.[0]?.count || 0;
                const stepCount = camp.sequences?.[0]?.count || 0;

                return (
                  <div 
                    key={camp.id} 
                    className="p-6 rounded-xl border border-zinc-800 bg-zinc-900/20 hover:bg-zinc-900/30 transition-all backdrop-blur-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-white text-lg">{camp.name}</h4>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium uppercase border ${
                          camp.status === 'active' 
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                            : camp.status === 'paused'
                            ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                            : 'bg-zinc-850 text-zinc-400 border-zinc-700'
                        }`}>
                          {camp.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-zinc-400 mt-2 font-medium">
                        <span>👥 {leadCount} Leads</span>
                        <span>✉️ {stepCount} Steps</span>
                        <span className="font-mono text-zinc-500">Created: {new Date(camp.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {/* Toggle status */}
                      {camp.status !== 'draft' && (
                        <button
                          onClick={() => handleToggleStatus(camp.id, camp.status)}
                          className={`p-2 rounded-lg border border-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer ${
                            camp.status === 'active' ? 'hover:bg-amber-500/10 hover:border-amber-500/30' : 'hover:bg-emerald-500/10 hover:border-emerald-500/30'
                          }`}
                          title={camp.status === 'active' ? 'Pause Campaign' : 'Resume Campaign'}
                        >
                          {camp.status === 'active' ? <Pause className="h-4 w-4 text-amber-400" /> : <Play className="h-4 w-4 text-emerald-400" />}
                        </button>
                      )}

                      {/* Manage Link */}
                      <Link
                        href={`/campaigns/${camp.id}`}
                        className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-sm font-semibold text-zinc-200 hover:text-white hover:bg-zinc-855 transition-all cursor-pointer"
                      >
                        <Edit3 className="h-4 w-4" /> Edit Sequence
                      </Link>

                      {/* Delete */}
                      <button
                        onClick={() => handleDeleteCampaign(camp.id)}
                        className="p-2 rounded-lg border border-zinc-800 text-zinc-500 hover:text-rose-400 hover:bg-rose-500/5 hover:border-rose-500/20 transition-all cursor-pointer"
                        title="Delete Campaign"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
