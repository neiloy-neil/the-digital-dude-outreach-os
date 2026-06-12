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
};

export default function DiscoverClient() {
  const [leads, setLeads] = useState<PoolLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [actioningId, setActioningId] = useState<string | null>(null);
  
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
      router.push(`/leads/${data.lead_id}`);
    } catch (error: any) {
      toast.error(error.message);
      setActioningId(null);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
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

              <button
                onClick={() => handlePullLead(lead.id)}
                disabled={actioningId !== null}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-700 disabled:opacity-50"
              >
                {actioningId === lead.id ? (
                  <>
                    <Spinner size={16} className="text-white" />
                    Adding...
                  </>
                ) : (
                  <>
                    <ArrowDownToLine className="h-4 w-4" />
                    Add to My Library
                  </>
                )}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
