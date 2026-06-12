'use client';

import { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { Search, Plus, CheckCircle2 } from 'lucide-react';

export default function DiscoverLeadsPage() {
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set());
  const [claiming, setClaiming] = useState(false);
  const [hasSubscription, setHasSubscription] = useState(false);
  
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    checkSubscription();
    fetchLeads();
  }, []);

  async function checkSubscription() {
    // Basic check for subscription status. Replace with actual logic.
    const { data: profile } = await supabase.from('profiles').select('stripe_customer_id, plan_id').single();
    if (profile?.plan_id) {
      setHasSubscription(true);
    } else {
      // For demo purposes, we can assume true if no strict enforcement is in place yet
      setHasSubscription(true);
    }
  }

  async function fetchLeads() {
    setLoading(true);
    const { data, error } = await supabase
      .from('admin_leads_pool')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (data) setLeads(data);
    setLoading(false);
  }

  const toggleLeadSelection = (id: string) => {
    const newSelected = new Set(selectedLeads);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedLeads(newSelected);
  };

  const claimSelectedLeads = async () => {
    if (selectedLeads.size === 0) return;
    if (!hasSubscription) {
      alert("You need an active subscription to add leads from the library.");
      return;
    }

    setClaiming(true);
    
    // Call the API route to claim leads
    try {
      const response = await fetch('/api/leads/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadIds: Array.from(selectedLeads) }),
      });
      
      if (response.ok) {
        alert('Leads added to your library successfully!');
        setSelectedLeads(new Set());
      } else {
        const error = await response.json();
        alert(`Failed to add leads: ${error.error}`);
      }
    } catch (error) {
      console.error(error);
      alert('An error occurred while claiming leads.');
    } finally {
      setClaiming(false);
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Discover Leads</h1>
          <p className="text-gray-500 mt-1">Browse our curated database and add high-quality leads to your library.</p>
        </div>
        <div className="flex items-center space-x-4">
          <div className="text-sm text-gray-500">
            {selectedLeads.size} selected
          </div>
          <button
            onClick={claimSelectedLeads}
            disabled={selectedLeads.size === 0 || claiming}
            className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg transition"
          >
            {claiming ? <Search className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            <span>Add to Library</span>
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-500 dark:text-gray-400">
            <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
              <tr>
                <th className="px-6 py-4 w-12"></th>
                <th className="px-6 py-4">Company</th>
                <th className="px-6 py-4">Contact Title</th>
                <th className="px-6 py-4">Industry</th>
                <th className="px-6 py-4">Location</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="px-6 py-4 text-center">Loading...</td></tr>
              ) : leads.length === 0 ? (
                <tr><td colSpan={5} className="px-6 py-4 text-center">No leads available in the pool right now.</td></tr>
              ) : (
                leads.map((lead) => (
                  <tr key={lead.id} className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="px-6 py-4">
                      <input
                        type="checkbox"
                        checked={selectedLeads.has(lead.id)}
                        onChange={() => toggleLeadSelection(lead.id)}
                        className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                      />
                    </td>
                    <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">{lead.company_name}</td>
                    <td className="px-6 py-4">{lead.contact_title}</td>
                    <td className="px-6 py-4">{lead.industry}</td>
                    <td className="px-6 py-4">{lead.location}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
