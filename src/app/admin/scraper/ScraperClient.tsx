'use client';

import { useState, useEffect, useCallback } from 'react';
import { Database, Search, Sparkles, Check, X, Trash2, ArrowRight } from 'lucide-react';
import PageHeader from '@/components/reachmira/PageHeader';
import Spinner from '@/components/reachmira/Spinner';
import { Badge } from '@/components/reachmira/ui';
import EmptyState from '@/components/reachmira/EmptyState';
import { createClient } from '@/utils/supabase/client';
import { useToast } from '@/lib/toast/toast-context';

type QueueItem = {
  id: string;
  search_query: string;
  company_name: string;
  website: string;
  description: string;
  contact_name: string;
  contact_email: string;
  status: string;
  pain_points?: string;
  ai_solution_angle?: string;
  recommended_offer?: string;
  ai_company_summary?: string;
  ai_lead_analysis?: string;
  ai_outreach_strategy?: string;
  ai_personalized_first_line?: string;
  tech_stack?: any;
  funding_stage?: string;
  total_raised?: string;
  employee_count?: string;
  year_founded?: string;
  ceo_name?: string;
  created_at: string;
};

export default function ScraperClient() {
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(10);
  const [scraping, setScraping] = useState(false);
  const [loading, setLoading] = useState(true);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [actioningId, setActioningId] = useState<string | null>(null);

  const supabase = createClient();
  const toast = useToast();

  const loadQueue = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('admin_scraping_queue')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setQueue(data || []);
    } catch (err: any) {
      toast.error('Failed to load staging queue');
    } finally {
      setLoading(false);
    }
  }, [supabase, toast]);

  useEffect(() => {
    loadQueue();
  }, [loadQueue]);

  const handleScrape = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setScraping(true);
    try {
      const response = await fetch('/api/admin/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, limit })
      });
      const data = await response.json();
      
      if (!response.ok) throw new Error(data.error || 'Scraping failed');
      
      toast.success(`Successfully found and queued ${data.count} leads!`);
      setQuery('');
      loadQueue();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setScraping(false);
    }
  };

  const handleDeepEnrich = async (item: QueueItem) => {
    setActioningId(item.id);
    try {
      const response = await fetch('/api/enrich', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          target: item.website || item.company_name, 
          leadId: item.id, 
          isAdminPool: true,
          isStagingQueue: true // we need a flag to update the correct table
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Enrichment failed');
      
      // Update local state to show enriched data
      setQueue(q => q.map(i => i.id === item.id ? { ...i, ...data.data } : i));
      toast.success('Deep enrichment complete!');
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setActioningId(null);
    }
  };

  const handleApprove = async (item: QueueItem) => {
    setActioningId(item.id);
    try {
      // Move to admin_leads_pool
      const { error: insertError } = await supabase
        .from('admin_leads_pool')
        .insert({
          company_name: item.company_name,
          website: item.website,
          description: item.description,
          contact_name: item.contact_name,
          contact_email: item.contact_email,
          // Note: we'd map other columns here, but currently admin_leads_pool 
          // doesn't have AI columns, so we just map the basic ones.
        });

      if (insertError) throw insertError;

      // Mark as approved
      await supabase
        .from('admin_scraping_queue')
        .update({ status: 'approved' })
        .eq('id', item.id);

      setQueue(q => q.filter(i => i.id !== item.id));
      toast.success('Lead approved and moved to global pool');
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setActioningId(null);
    }
  };

  const handleReject = async (id: string) => {
    setActioningId(id);
    try {
      await supabase
        .from('admin_scraping_queue')
        .update({ status: 'rejected' })
        .eq('id', id);

      setQueue(q => q.filter(i => i.id !== id));
      toast.success('Lead rejected');
    } catch (error: any) {
      toast.error('Failed to reject lead');
    } finally {
      setActioningId(null);
    }
  };

  const [viewingLead, setViewingLead] = useState<QueueItem | null>(null);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 relative">
      <PageHeader 
        title="Lead Scraper" 
        subtitle="Search for new leads and stage them for review before approving to the global pool."
        eyebrow="Admin"
      />

      {/* Search Bar */}
      <div className="mb-8 rounded-3xl border border-[var(--border)] bg-white p-6 shadow-sm">
        <form onSubmit={handleScrape} className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className="mb-2 block text-sm font-medium text-zinc-700">Search Query</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="e.g. 'marketing agencies in london'"
                className="w-full rounded-xl border border-[var(--border)] bg-zinc-50 py-3 pl-10 pr-4 text-sm outline-none transition focus:border-violet-300 focus:ring-2 focus:ring-violet-100"
              />
            </div>
          </div>
          <div className="w-full sm:w-32">
            <label className="mb-2 block text-sm font-medium text-zinc-700">Max Results</label>
            <input
              type="number"
              min="1"
              max="50"
              value={limit}
              onChange={(e) => setLimit(parseInt(e.target.value) || 10)}
              className="w-full rounded-xl border border-[var(--border)] bg-zinc-50 py-3 px-4 text-sm outline-none transition focus:border-violet-300 focus:ring-2 focus:ring-violet-100"
            />
          </div>
          <button
            type="submit"
            disabled={scraping || !query.trim()}
            className="flex h-[46px] items-center justify-center gap-2 rounded-xl bg-zinc-950 px-6 font-semibold text-white transition hover:bg-zinc-800 disabled:opacity-50 sm:w-auto"
          >
            {scraping ? <Spinner size={16} className="text-white" /> : <Search className="h-4 w-4" />}
            {scraping ? 'Scraping...' : 'Find Leads'}
          </button>
        </form>
      </div>

      {/* Queue */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-zinc-900">Staging Queue ({queue.length})</h2>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      ) : queue.length === 0 ? (
        <EmptyState
          icon={Database}
          title="Queue is empty"
          description="Enter a search query above to find new leads."
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-white shadow-sm">
          <table className="min-w-full divide-y divide-[var(--border)] text-left text-sm">
            <thead className="bg-zinc-50/50">
              <tr>
                <th className="px-6 py-4 font-semibold text-zinc-600">Company</th>
                <th className="px-6 py-4 font-semibold text-zinc-600">Contact</th>
                <th className="px-6 py-4 font-semibold text-zinc-600">Enrichment</th>
                <th className="px-6 py-4 font-semibold text-zinc-600 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)] bg-white">
              {queue.map((item) => (
                <tr key={item.id} className="transition-colors hover:bg-zinc-50/50">
                  <td className="px-6 py-4">
                    <div className="font-medium text-zinc-900">{item.company_name}</div>
                    <div className="text-xs text-zinc-500">
                      {item.website ? (
                        <a href={item.website} target="_blank" rel="noreferrer" className="hover:text-violet-600">
                          {item.website}
                        </a>
                      ) : (
                        'No website'
                      )}
                    </div>
                    <div className="mt-1 line-clamp-2 text-xs text-zinc-600 max-w-xs">{item.description}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-medium text-zinc-900">{item.contact_name || <span className="text-zinc-400 italic">No name</span>}</div>
                    <div className="text-xs text-zinc-500">{item.contact_email || <span className="text-zinc-400 italic">No email</span>}</div>
                  </td>
                  <td className="px-6 py-4">
                    {item.ai_company_summary ? (
                      <Badge variant="success">Deep Enriched</Badge>
                    ) : (
                      <Badge variant="neutral">Basic Data</Badge>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => setViewingLead(item)}
                        title="View Details"
                        className="rounded-lg border border-[var(--border)] bg-white p-2 text-zinc-600 transition hover:bg-zinc-50 disabled:opacity-50"
                      >
                        <Search className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDeepEnrich(item)}
                        disabled={actioningId !== null}
                        title="Run Deep Enrichment"
                        className="rounded-lg border border-[var(--border)] bg-white p-2 text-zinc-600 transition hover:bg-violet-50 hover:text-violet-600 disabled:opacity-50"
                      >
                        {actioningId === item.id ? <Spinner size={16} /> : <Sparkles className="h-4 w-4" />}
                      </button>
                      <button
                        onClick={() => handleApprove(item)}
                        disabled={actioningId !== null}
                        title="Approve to Pool"
                        className="rounded-lg border border-teal-200 bg-teal-50 p-2 text-teal-700 transition hover:bg-teal-100 hover:text-teal-800 disabled:opacity-50"
                      >
                        <Check className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleReject(item.id)}
                        disabled={actioningId !== null}
                        title="Reject/Discard"
                        className="rounded-lg border border-[var(--border)] bg-white p-2 text-zinc-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* View Details Modal */}
      {viewingLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-3xl bg-white p-8 shadow-2xl">
            <button
              onClick={() => setViewingLead(null)}
              className="absolute right-6 top-6 rounded-full p-2 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
            >
              <X className="h-5 w-5" />
            </button>

            <h3 className="text-xl font-bold text-zinc-900 mb-6 border-b pb-4">Lead Details</h3>

            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-500">Company</label>
                  <p className="font-medium text-zinc-900 mt-1">{viewingLead.company_name}</p>
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-500">Website</label>
                  <p className="font-medium text-blue-600 mt-1">
                    {viewingLead.website ? <a href={viewingLead.website} target="_blank" rel="noreferrer">{viewingLead.website}</a> : 'N/A'}
                  </p>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-500">Contact Person</label>
                <div className="mt-1 flex items-center gap-4">
                  <p className="font-medium text-zinc-900">{viewingLead.contact_name || 'N/A'}</p>
                  {viewingLead.contact_email && (
                    <Badge variant="success">{viewingLead.contact_email}</Badge>
                  )}
                </div>
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-500">Description</label>
                <p className="text-sm text-zinc-700 mt-1 bg-zinc-50 p-3 rounded-xl border border-[var(--border)]">
                  {viewingLead.description || 'No description available.'}
                </p>
              </div>

              {viewingLead.ai_company_summary && (
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 text-violet-600 flex items-center gap-1">
                    <Sparkles className="h-3 w-3" /> AI Summary
                  </label>
                  <p className="text-sm text-zinc-700 mt-1 bg-violet-50/50 p-3 rounded-xl border border-violet-100">
                    {viewingLead.ai_company_summary}
                  </p>
                </div>
              )}
            </div>

            <div className="mt-8 flex justify-end">
              <button
                onClick={() => setViewingLead(null)}
                className="rounded-xl bg-zinc-100 px-6 py-2.5 font-medium text-zinc-900 hover:bg-zinc-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
