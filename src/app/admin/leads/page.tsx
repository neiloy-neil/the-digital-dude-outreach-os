'use client';

import { useState, useEffect } from 'react';
import PageHeader from '@/components/reachmira/PageHeader';
import Spinner from '@/components/reachmira/Spinner';
import Papa from 'papaparse';
import { Upload, Trash2, Search, Plus, AlertCircle } from 'lucide-react';

export default function AdminLeadsPage() {
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [industryFilter, setIndustryFilter] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchLeads();
  }, [searchQuery, industryFilter]);

  async function fetchLeads() {
    setLoading(true);
    try {
      const url = new URL('/api/admin/leads', window.location.origin);
      if (searchQuery) url.searchParams.set('search', searchQuery);
      if (industryFilter) url.searchParams.set('industry', industryFilter);

      const response = await fetch(url.toString());
      if (!response.ok) throw new Error('Failed to fetch leads');
      const data = await response.json();
      setLeads(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const parsedLeads = results.data.map((row: any) => ({
            company_name: row.company_name || row.Company || row.company || '',
            website: row.website || row.Website || '',
            industry: row.industry || row.Industry || '',
            location: row.location || row.Location || row.city || '',
            contact_name: row.contact_name || row.Name || row.name || [row.first_name, row.last_name].filter(Boolean).join(' ') || '',
            contact_title: row.contact_title || row.Title || row.title || '',
            contact_email: row.contact_email || row.Email || row.email || '',
            contact_linkedin: row.contact_linkedin || row.Linkedin || row.linkedin_url || ''
          })).filter((l: any) => l.company_name || l.contact_email);

          const response = await fetch('/api/admin/leads', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ leads: parsedLeads }),
          });

          if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.error || 'Failed to upload leads');
          }

          alert(`Successfully uploaded ${parsedLeads.length} leads.`);
          fetchLeads();
        } catch (err: any) {
          setError(err.message);
        } finally {
          setUploading(false);
        }
      },
      error: (err) => {
        setError(err.message);
        setUploading(false);
      }
    });
  };

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) newSelected.delete(id);
    else newSelected.add(id);
    setSelectedIds(newSelected);
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Are you sure you want to delete ${selectedIds.size} leads?`)) return;

    try {
      const response = await fetch('/api/admin/leads', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selectedIds) }),
      });

      if (!response.ok) throw new Error('Failed to delete leads');
      
      setSelectedIds(new Set());
      fetchLeads();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleBulkTag = async () => {
    if (selectedIds.size === 0) return;
    const tag = prompt('Enter a tag for selected leads:');
    if (!tag) return;

    try {
      const response = await fetch('/api/admin/leads', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selectedIds), tags: [tag] }),
      });

      if (!response.ok) throw new Error('Failed to tag leads');
      
      setSelectedIds(new Set());
      fetchLeads();
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="mx-auto w-full max-w-7xl">
      <PageHeader
        eyebrow="Admin"
        title="Global Lead Pool"
        subtitle="Manage the global pool of leads available for subscribed users."
      />

      {error && (
        <div className="mb-6 p-4 rounded-xl bg-red-50 text-red-700 flex items-center gap-2 border border-red-200">
          <AlertCircle className="w-5 h-5" />
          {error}
        </div>
      )}

      <div className="mb-6 flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="flex w-full sm:w-auto gap-4">
          <div className="relative w-full max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search leads..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:border-violet-500 transition"
            />
          </div>
          <div className="relative w-full max-w-xs">
            <input
              type="text"
              placeholder="Filter by industry..."
              value={industryFilter}
              onChange={(e) => setIndustryFilter(e.target.value)}
              className="w-full px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:border-violet-500 transition"
            />
          </div>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          {selectedIds.size > 0 && (
            <>
              <button
                onClick={handleBulkTag}
                className="flex items-center gap-2 px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-xl transition font-medium"
              >
                <Plus className="w-4 h-4" />
                Tag ({selectedIds.size})
              </button>
              <button
                onClick={handleBulkDelete}
                className="flex items-center gap-2 px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl transition font-medium"
              >
                <Trash2 className="w-4 h-4" />
                Delete ({selectedIds.size})
              </button>
            </>
          )}
          
          <label className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white px-4 py-2 rounded-xl cursor-pointer transition font-medium">
            {uploading ? <Spinner size={16} /> : <Upload className="w-4 h-4" />}
            <span>Upload CSV</span>
            <input type="file" accept=".csv" className="hidden" onChange={handleFileUpload} disabled={uploading} />
          </label>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-500 dark:text-gray-400">
            <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700/50 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
              <tr>
                <th className="px-6 py-4 w-12">
                  <input
                    type="checkbox"
                    className="rounded border-gray-300 text-violet-600 focus:ring-violet-500"
                    onChange={(e) => {
                      if (e.target.checked) setSelectedIds(new Set(leads.map(l => l.id)));
                      else setSelectedIds(new Set());
                    }}
                    checked={leads.length > 0 && selectedIds.size === leads.length}
                  />
                </th>
                <th className="px-6 py-4 font-semibold">Company</th>
                <th className="px-6 py-4 font-semibold">Contact</th>
                <th className="px-6 py-4 font-semibold">Industry</th>
                <th className="px-6 py-4 font-semibold">Location</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {loading ? (
                <tr><td colSpan={5} className="px-6 py-8 text-center"><Spinner className="mx-auto" /></td></tr>
              ) : leads.length === 0 ? (
                <tr><td colSpan={5} className="px-6 py-8 text-center text-zinc-500">No leads found.</td></tr>
              ) : (
                leads.map((lead) => (
                  <tr key={lead.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition">
                    <td className="px-6 py-4">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(lead.id)}
                        onChange={() => toggleSelect(lead.id)}
                        className="rounded border-gray-300 text-violet-600 focus:ring-violet-500"
                      />
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-900 dark:text-white">{lead.company_name}</div>
                      {lead.website && <div className="text-xs text-blue-500">{lead.website}</div>}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-gray-900 dark:text-white">{lead.contact_name}</div>
                      <div className="text-xs">{lead.contact_email}</div>
                    </td>
                    <td className="px-6 py-4">{lead.industry || '-'}</td>
                    <td className="px-6 py-4">{lead.location || '-'}</td>
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
