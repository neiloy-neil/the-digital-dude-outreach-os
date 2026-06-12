'use client';

import { useState, useEffect } from 'react';
import PageHeader from '@/components/reachmira/PageHeader';
import Spinner from '@/components/reachmira/Spinner';
import { Shield, ShieldOff, Trash2, Search, AlertCircle } from 'lucide-react';

export default function AdminUsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  async function fetchUsers() {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/users');
      if (!response.ok) throw new Error('Failed to fetch users');
      const data = await response.json();
      setUsers(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const toggleAdminStatus = async (id: string, currentStatus: boolean) => {
    try {
      const response = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, is_admin: !currentStatus }),
      });
      if (!response.ok) throw new Error('Failed to update user role');
      
      setUsers(users.map(u => u.id === id ? { ...u, is_admin: !currentStatus } : u));
    } catch (err: any) {
      alert(err.message);
    }
  };

  const deleteUser = async (id: string) => {
    if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) return;

    try {
      const response = await fetch(`/api/admin/users?id=${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete user');
      
      setUsers(users.filter(u => u.id !== id));
    } catch (err: any) {
      alert(err.message);
    }
  };

  const filteredUsers = users.filter(u => 
    u.email?.toLowerCase().includes(searchQuery.toLowerCase()) || 
    u.display_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.workspace_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="mx-auto w-full max-w-7xl">
      <PageHeader
        eyebrow="Admin"
        title="User Management"
        subtitle="Manage platform users, roles, and access."
      />

      {error && (
        <div className="mb-6 p-4 rounded-xl bg-red-50 text-red-700 flex items-center gap-2 border border-red-200">
          <AlertCircle className="w-5 h-5" />
          {error}
        </div>
      )}

      <div className="mb-6">
        <div className="relative w-full max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Search users by email, name, or workspace..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:border-violet-500 transition"
          />
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-500 dark:text-gray-400">
            <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700/50 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
              <tr>
                <th className="px-6 py-4 font-semibold">User</th>
                <th className="px-6 py-4 font-semibold">Workspace</th>
                <th className="px-6 py-4 font-semibold">Plan</th>
                <th className="px-6 py-4 font-semibold text-center">Admin Status</th>
                <th className="px-6 py-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {loading ? (
                <tr><td colSpan={5} className="px-6 py-8 text-center"><Spinner className="mx-auto" /></td></tr>
              ) : filteredUsers.length === 0 ? (
                <tr><td colSpan={5} className="px-6 py-8 text-center text-zinc-500">No users found.</td></tr>
              ) : (
                filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {user.avatar_url ? (
                          <img src={user.avatar_url} alt="Avatar" className="w-8 h-8 rounded-full bg-gray-200" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-violet-100 text-violet-600 flex items-center justify-center font-bold">
                            {user.email?.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div>
                          <div className="font-medium text-gray-900 dark:text-white">{user.display_name || 'Unnamed User'}</div>
                          <div className="text-xs">{user.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">{user.workspace_name || '-'}</td>
                    <td className="px-6 py-4">
                      {user.plan_id ? (
                        <span className="px-2 py-1 bg-green-100 text-green-700 rounded-md text-xs font-semibold">Subscribed</span>
                      ) : (
                        <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded-md text-xs font-semibold">Free</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      {user.is_admin ? (
                        <span className="inline-flex items-center gap-1 text-violet-600 bg-violet-50 px-2 py-1 rounded-md text-xs font-semibold border border-violet-100">
                          <Shield className="w-3 h-3" /> Admin
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => toggleAdminStatus(user.id, !!user.is_admin)}
                          title={user.is_admin ? "Revoke Admin" : "Make Admin"}
                          className="p-2 text-gray-400 hover:text-violet-600 transition"
                        >
                          {user.is_admin ? <ShieldOff className="w-4 h-4" /> : <Shield className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={() => deleteUser(user.id)}
                          title="Delete User"
                          className="p-2 text-gray-400 hover:text-red-600 transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
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
