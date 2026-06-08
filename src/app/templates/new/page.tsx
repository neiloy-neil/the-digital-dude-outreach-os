'use client';

export const dynamic = 'force-dynamic';

import AppShell from '@/components/reachmira/AppShell';
import PageHeader from '@/components/reachmira/PageHeader';
import { Sparkles } from 'lucide-react';

export default function NewTemplatePage() {
  return (
    <AppShell>
      <PageHeader
        eyebrow="Templates"
        title="Create Template"
        subtitle="Start with a reusable subject and body for manual or campaign emails."
      />

      <div className="rounded-3xl border border-[var(--border)] bg-white p-6 shadow-[0_12px_40px_rgba(15,23,42,0.04)]">
        <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-violet-700">
          <Sparkles className="h-4 w-4" />
          Template editor coming next
        </div>
        <p className="text-sm leading-6 text-zinc-500">
          This route now exists so sidebar navigation is complete. We can wire the full editor and variables panel next.
        </p>
      </div>
    </AppShell>
  );
}
