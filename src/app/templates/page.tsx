'use client';

export const dynamic = 'force-dynamic';

import Link from 'next/link';
import AppShell from '@/components/reachmira/AppShell';
import PageHeader from '@/components/reachmira/PageHeader';
import EmptyState from '@/components/reachmira/EmptyState';
import { Sparkles, ArrowRight, Wand2 } from 'lucide-react';

const categories = [
  'First Cold Email',
  'Follow-up 1',
  'Follow-up 2',
  'Breakup Email',
  'Proposal Follow-up',
  'Demo Follow-up',
  'CRM Offer',
  'ERP Offer',
  'Website Redesign',
  'SaaS Development',
  'AI Automation',
];

export default function TemplatesPage() {
  return (
    <AppShell>
      <PageHeader
        eyebrow="Templates"
        title="Templates"
        subtitle="Reusable email frameworks for manual outreach and campaigns."
        actions={
          <Link href="/templates/new" className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-700">
            <Sparkles className="h-4 w-4" />
            New template
          </Link>
        }
      />

      <div className="mb-6 rounded-2xl border border-[var(--border)] bg-white p-4 text-sm text-zinc-600 shadow-[0_12px_40px_rgba(15,23,42,0.04)]">
        Templates are the bridge between lead context and faster, safer outreach.
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {categories.map((category) => (
          <div key={category} className="rounded-3xl border border-[var(--border)] bg-white p-5 shadow-[0_12px_40px_rgba(15,23,42,0.04)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-lg font-semibold text-zinc-950">{category}</div>
                <p className="mt-2 text-sm text-zinc-500">Keep the structure consistent and the voice human.</p>
              </div>
              <div className="rounded-2xl bg-violet-50 p-3 text-violet-700 ring-1 ring-violet-100">
                <Wand2 className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-5 flex items-center justify-between">
              <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] font-semibold text-zinc-600">Ready to use</span>
              <Link href="/templates/new" className="inline-flex items-center gap-1 text-sm font-semibold text-violet-700">
                Create <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        ))}
      </div>

      {categories.length === 0 && (
        <div className="mt-6">
          <EmptyState
            icon={Sparkles}
            title="No templates yet"
            description="Create your first template to reuse across leads and campaigns."
            actionLabel="New template"
            actionHref="/templates/new"
            actionIcon={Sparkles}
          />
        </div>
      )}
    </AppShell>
  );
}
