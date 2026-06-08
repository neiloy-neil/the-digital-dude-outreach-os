'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import Sidebar from '@/components/Sidebar';
import { Search, Sparkles, Plus } from 'lucide-react';

type Props = {
  children: ReactNode;
  topbarActions?: ReactNode;
  showSearch?: boolean;
};

export default function AppShell({ children, topbarActions, showSearch = true }: Props) {
  return (
    <div className="flex min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(124,58,237,0.08),_transparent_30%),radial-gradient(circle_at_top_right,_rgba(20,184,166,0.08),_transparent_26%),var(--background)] text-zinc-900">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="sticky top-0 z-20 border-b border-white/70 bg-white/75 backdrop-blur-xl">
          <div className="flex flex-col gap-3 px-6 py-4 lg:flex-row lg:items-center lg:justify-between">
            {showSearch ? (
              <label className="flex w-full max-w-2xl items-center gap-3 rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-sm shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
                <Search className="h-4 w-4 text-zinc-400" />
                <input
                  className="w-full bg-transparent text-sm text-zinc-900 outline-none placeholder:text-zinc-400"
                  placeholder="Search leads, campaigns, templates..."
                />
              </label>
            ) : (
              <div />
            )}

            <div className="flex flex-wrap items-center gap-2">
              {topbarActions}
              <Link href="/leads/import" className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-700">
                <Sparkles className="h-4 w-4" />
                Import Leads
              </Link>
              <Link href="/leads/new" className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-white px-4 py-2.5 text-sm font-semibold text-zinc-700 transition hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700">
                <Plus className="h-4 w-4" />
                Add Lead
              </Link>
            </div>
          </div>
        </div>

        <div className="px-6 py-6">{children}</div>
      </main>
    </div>
  );
}
