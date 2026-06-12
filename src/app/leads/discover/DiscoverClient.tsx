'use client';

import { useState, useEffect, useCallback } from 'react';
import { Database, Search, ArrowDownToLine, Users, Building2 } from 'lucide-react';
import PageHeader from '@/components/reachmira/PageHeader';
import Spinner from '@/components/reachmira/Spinner';
import EmptyState from '@/components/reachmira/EmptyState';
import { createClient } from '@/utils/supabase/client';
import { useToast } from '@/lib/toast/toast-context';
import { useRouter } from 'next/navigation';

type PoolLead = {
  id: string;
  company_name: string;
  website: string;
  industry: string;
  location: string;
  contact_name: string;
  contact_title: string;
  contact_email: string;
  description: string;
  employee_count: string;
  revenue: string;
  created_at: string;
  ai_company_summary?: string;
  pain_points?: string;
  ai_solution_angle?: string;
  recommended_offer?: string;
};

export default function DiscoverClient() {
  const [leads, setLeads] = useState<PoolLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [viewingLead, setViewingLead] = useState<PoolLead | null>(null);
  
  const supabase = createClient();
  const toast = useToast();
  const router = useRouter();

  const loadLeads = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('admin_leads_pool')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setLeads(data || []);
    } catch (err: any) {
      toast.error('Failed to load global leads pool');
    } finally {
      setLoading(false);
    }
  }, [supabase, toast]);

  useEffect(() => {
    loadLeads();
  }, [loadLeads]);

  const handlePullLead = async (leadId: string) => {
    setActioningId(leadId);
    try {
      const response = await fetch('/api/leads/pull', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pool_id: leadId })
      });
      const data = await response.json();
      
      if (!response.ok) throw new Error(data.error || 'Failed to pull lead');
      
      toast.success('Lead successfully added to your library!');
      if (viewingLead && viewingLead.id === leadId) {
        setViewingLead(null);
      }
      setLeads(current => current.filter(l => l.id !== leadId));
    } catch (error: any) {
      toast.error(error.message);
      setActioningId(null);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 relative">
      <PageHeader 
        title="Discover Leads" 
        subtitle="Browse fresh leads from our global database and instantly pull them into your personal library."
        eyebrow="Global Pool"
      />

      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-zinc-900">Available Leads ({leads.length})</h2>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      ) : leads.length === 0 ? (
        <EmptyState
          icon={Database}
          title="No leads available"
          description="We are currently sourcing new leads. Check back later!"
        />
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {leads.map((lead) => (
            <div key={lead.id} className="flex flex-col rounded-2xl border border-[var(--border)] bg-white p-6 shadow-sm transition hover:shadow-md">
              <div className="mb-4 flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-zinc-900 line-clamp-1" title={lead.company_name}>
                    {lead.company_name}
                  </h3>
                  {lead.website && (
                    <a href={lead.website} target="_blank" rel="noreferrer" className="text-sm text-violet-600 hover:underline">
                      {lead.website.replace(/^https?:\/\//, '')}
                    </a>
                  )}
                </div>
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
                  <Building2 className="h-5 w-5" />
                </div>
              </div>
              
              <p className="mb-6 line-clamp-3 text-sm text-zinc-600 flex-1">
                {lead.description || 'No description available.'}
              </p>

              <div className="mb-6 space-y-2 text-sm text-zinc-600">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 shrink-0 text-zinc-400" />
                  <span className="line-clamp-1">{lead.contact_name || 'No contact specified'}</span>
                </div>
                {lead.industry && (
                  <div className="flex items-center gap-2">
                    <Database className="h-4 w-4 shrink-0 text-zinc-400" />
                    <span className="line-clamp-1">{lead.industry}</span>
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setViewingLead(lead)}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-zinc-100 px-4 py-2.5 text-sm font-semibold text-zinc-900 transition hover:bg-zinc-200"
                >
                  <Search className="h-4 w-4" />
                  View Details
                </button>
                <button
                  onClick={() => handlePullLead(lead.id)}
                  disabled={actioningId !== null}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-700 disabled:opacity-50"
                >
                  {actioningId === lead.id ? (
                    <Spinner size={16} className="text-white" />
                  ) : (
                    <ArrowDownToLine className="h-4 w-4" />
                  )}
                  Pull Lead
                </button>
              </div>
            </div>
          ))}
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
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
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
                    <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
                      {viewingLead.contact_email}
                    </span>
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
                  <label className="text-xs font-bold uppercase tracking-wider text-violet-600 flex items-center gap-1">
                    AI Summary
                  </label>
                  <p className="text-sm text-zinc-700 mt-1 bg-violet-50/50 p-3 rounded-xl border border-violet-100">
                    {viewingLead.ai_company_summary}
                  </p>
                </div>
              )}

              {viewingLead.pain_points && (
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-red-600 flex items-center gap-1">
                    Pain Points
                  </label>
                  <p className="text-sm text-zinc-700 mt-1 bg-red-50/50 p-3 rounded-xl border border-red-100">
                    {viewingLead.pain_points}
                  </p>
                </div>
              )}
            </div>

            <div className="mt-8 flex justify-end gap-3">
              <button
                onClick={() => setViewingLead(null)}
                className="rounded-xl bg-zinc-100 px-6 py-2.5 font-medium text-zinc-900 hover:bg-zinc-200"
              >
                Close
              </button>
              <button
                onClick={() => handlePullLead(viewingLead.id)}
                disabled={actioningId !== null}
                className="flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-6 py-2.5 font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
              >
                {actioningId === viewingLead.id ? <Spinner size={16} className="text-white" /> : <ArrowDownToLine className="h-4 w-4" />}
                Add to My Library
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
