'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { CheckCircle2, XCircle, Search, Edit2, Save, X } from 'lucide-react';
import { useToast } from '@/lib/toast/toast-context';

export default function WaitlistClient({ initialSignups }: { initialSignups: any[] }) {
  const [signups, setSignups] = useState(initialSignups);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [notesEdit, setNotesEdit] = useState('');
  const toast = useToast();

  const handleUpdate = async (id: string, updates: any) => {
    try {
      const res = await fetch(`/api/admin/waitlist/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error('Failed to update');
      
      setSignups((prev) => 
        prev.map((s) => (s.id === id ? { ...s, ...updates } : s))
      );
      toast.success('Updated successfully');
      setEditingId(null);
    } catch (error) {
      toast.error('Update failed');
    }
  };

  const filtered = signups.filter((s) => {
    if (statusFilter && s.status !== statusFilter) return false;
    if (search) {
      const query = search.toLowerCase();
      return (
        s.full_name?.toLowerCase().includes(query) ||
        s.email?.toLowerCase().includes(query) ||
        s.company_name?.toLowerCase().includes(query)
      );
    }
    return true;
  });

  return (
    <div className="p-8 max-w-7xl mx-auto font-sans selection:bg-[#7C3AED]/20">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[#111827] mb-2">Waitlist Signups</h1>
          <p className="text-[#6B7280]">Review all early beta access requests.</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input 
              type="text"
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#7C3AED]/20 focus:border-[#7C3AED] outline-none"
            />
          </div>
          <select 
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border border-gray-200 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-[#7C3AED]/20 focus:border-[#7C3AED] outline-none bg-white"
          >
            <option value="">All Statuses</option>
            <option value="new">New</option>
            <option value="reviewed">Reviewed</option>
            <option value="invited">Invited</option>
            <option value="accepted">Accepted</option>
            <option value="rejected">Rejected</option>
          </select>
          <div className="bg-[#7C3AED]/10 text-[#7C3AED] px-4 py-2 rounded-full font-bold">
            {filtered.length} Total
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-sm overflow-hidden">
        <div className="overflow-x-auto min-h-[400px]">
          <table className="w-full text-left text-sm text-[#111827]">
            <thead className="bg-[#F8FAFC] border-b border-[#E5E7EB] text-[#6B7280] font-medium uppercase tracking-wider text-xs">
              <tr>
                <th className="px-6 py-4">Name / Email</th>
                <th className="px-6 py-4">Company & Role</th>
                <th className="px-6 py-4">Outreach & Volume</th>
                <th className="px-6 py-4">Status & Notes</th>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E7EB]">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-[#6B7280]">
                    No waitlist signups found.
                  </td>
                </tr>
              )}
              {filtered.map((s) => (
                <tr key={s.id} className="hover:bg-[#F8FAFC]/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-semibold text-[#111827]">{s.full_name}</div>
                    <div className="text-[#6B7280]">{s.email}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-medium text-[#111827]">{s.company_name || '-'}</div>
                    <div className="text-[#6B7280]">{s.role || '-'}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-[#111827] truncate max-w-[150px]" title={s.current_outreach_method}>{s.current_outreach_method || '-'}</div>
                    <div className="text-[#6B7280]">{s.monthly_outreach_volume || '-'}</div>
                  </td>
                  <td className="px-6 py-4 min-w-[200px]">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`px-2 py-1 rounded-full text-xs font-bold uppercase tracking-wider
                        ${s.status === 'new' ? 'bg-blue-100 text-blue-700' : 
                          s.status === 'invited' ? 'bg-purple-100 text-purple-700' : 
                          s.status === 'accepted' ? 'bg-green-100 text-green-700' : 
                          s.status === 'rejected' ? 'bg-red-100 text-red-700' : 
                          'bg-gray-100 text-gray-700'}`}>
                        {s.status || 'new'}
                      </span>
                    </div>
                    {editingId === s.id ? (
                      <div className="flex items-center gap-2">
                        <textarea 
                          value={notesEdit} 
                          onChange={(e) => setNotesEdit(e.target.value)}
                          className="w-full border rounded p-1 text-xs"
                          rows={2}
                        />
                        <button onClick={() => handleUpdate(s.id, { admin_notes: notesEdit })} className="p-1 text-green-600 hover:bg-green-50 rounded"><Save className="w-4 h-4"/></button>
                        <button onClick={() => setEditingId(null)} className="p-1 text-red-600 hover:bg-red-50 rounded"><X className="w-4 h-4"/></button>
                      </div>
                    ) : (
                      <div className="flex items-start justify-between group">
                        <p className="text-xs text-gray-500 italic truncate max-w-[150px]">{s.admin_notes || 'No notes'}</p>
                        <button onClick={() => { setEditingId(s.id); setNotesEdit(s.admin_notes || ''); }} className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-gray-700 transition-opacity">
                          <Edit2 className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 text-[#6B7280] whitespace-nowrap">
                    {s.created_at ? format(new Date(s.created_at), 'MMM d, yyyy') : '-'}
                  </td>
                  <td className="px-6 py-4">
                    <select 
                      value=""
                      onChange={(e) => handleUpdate(s.id, { status: e.target.value })}
                      className="border border-gray-200 rounded px-2 py-1 text-xs outline-none hover:bg-gray-50"
                    >
                      <option value="" disabled>Action...</option>
                      <option value="reviewed">Mark Reviewed</option>
                      <option value="invited">Invite</option>
                      <option value="accepted">Accept</option>
                      <option value="rejected">Reject</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
