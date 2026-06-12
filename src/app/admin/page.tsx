'use client';

import { useEffect, useState } from 'react';
import PageHeader from '@/components/reachmira/PageHeader';
import MetricCard from '@/components/reachmira/MetricCard';
import AnalyticsCharts from '@/components/reachmira/AnalyticsCharts';
import Spinner from '@/components/reachmira/Spinner';
import { Users, Database, CreditCard, Clock } from 'lucide-react';

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchStats() {
      try {
        const response = await fetch('/api/admin/stats');
        if (!response.ok) {
          throw new Error('Failed to fetch stats');
        }
        const data = await response.json();
        setStats(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Spinner size={32} />
      </div>
    );
  }

  if (error) {
    return <div className="text-red-500">Error: {error}</div>;
  }

  return (
    <div className="mx-auto w-full max-w-7xl">
      <PageHeader
        eyebrow="Admin Dashboard"
        title="System Overview"
        subtitle="High-level metrics and system health."
      />

      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          label="Total Users"
          value={stats?.totalUsers || 0}
          icon={Users}
          tone="violet"
          description="Total registered accounts"
        />
        <MetricCard
          label="Global Leads"
          value={stats?.totalGlobalLeads || 0}
          icon={Database}
          tone="teal"
          description="Leads in admin pool"
        />
        <MetricCard
          label="Subscriptions"
          value={stats?.activeSubscriptions || 0}
          icon={CreditCard}
          tone="sky"
          description="Active paying users"
        />
        <MetricCard
          label="Waitlist"
          value={stats?.waitlistCount || 0}
          icon={Clock}
          tone="amber"
          description="Pending invites"
        />
      </div>

      <div className="mt-8">
        <AnalyticsCharts leads={[]} sentEmails={[]} dateRange="30d" />
      </div>

      <div className="mt-12">
        <h2 className="text-xl font-semibold mb-4 text-zinc-900 dark:text-white">Quick Actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <a href="/admin/users" className="block p-6 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-[var(--border)] hover:border-violet-300 transition">
            <h3 className="font-bold text-lg text-zinc-900 dark:text-white mb-2">Manage Users</h3>
            <p className="text-zinc-500 text-sm">View profiles, change roles, and manage access.</p>
          </a>
          <a href="/admin/leads" className="block p-6 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-[var(--border)] hover:border-violet-300 transition">
            <h3 className="font-bold text-lg text-zinc-900 dark:text-white mb-2">Lead Database</h3>
            <p className="text-zinc-500 text-sm">Upload CSVs and curate the global lead library.</p>
          </a>
          <a href="/admin/waitlist" className="block p-6 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-[var(--border)] hover:border-violet-300 transition">
            <h3 className="font-bold text-lg text-zinc-900 dark:text-white mb-2">Review Waitlist</h3>
            <p className="text-zinc-500 text-sm">Approve new signups and send invitations.</p>
          </a>
        </div>
      </div>
    </div>
  );
}
