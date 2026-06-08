'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, Sparkles, Wand2, Trash2 } from 'lucide-react';
import AppShell from '@/components/reachmira/AppShell';
import PageHeader from '@/components/reachmira/PageHeader';
import EmptyState from '@/components/reachmira/EmptyState';

type TemplateRow = {
  id: string;
  name: string;
  category?: string | null;
  subject: string;
  body?: string | null;
  offer_type?: string | null;
  is_default?: boolean;
  updated_at?: string;
};

export default function TemplatesPage() {
  const [loading, setLoading] = useState(true);
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/templates');
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to load templates');
      setTemplates((data.templates || []) as TemplateRow[]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load templates');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void (async () => {
      await loadData();
    })();
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this template?')) return;
    const response = await fetch(`/api/templates/${id}`, { method: 'DELETE' });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error || 'Failed to delete template');
      return;
    }
    await loadData();
  };

  return (
    <AppShell>
      <PageHeader
        eyebrow="Templates"
        title="Templates"
        subtitle="Reusable email frameworks for manual outreach and campaigns."
        actions={
          <Link href="/templates/new" className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-700">
            <Plus className="h-4 w-4" />
            New template
          </Link>
        }
      />

      {error && <div className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}

      {loading ? (
        <div className="flex h-64 items-center justify-center rounded-3xl border border-[var(--border)] bg-white">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-violet-500 border-t-transparent" />
        </div>
      ) : templates.length === 0 ? (
        <EmptyState
          icon={Sparkles}
          title="No templates yet"
          description="Create your first template to reuse across leads and campaigns."
          actionLabel="New template"
          actionHref="/templates/new"
          actionIcon={Plus}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {templates.map((template) => (
            <div key={template.id} className="rounded-3xl border border-[var(--border)] bg-white p-5 shadow-[0_12px_40px_rgba(15,23,42,0.04)]">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-lg font-semibold text-zinc-950">{template.name}</div>
                  <p className="mt-2 text-sm text-zinc-500">{template.category || 'General'} · {template.offer_type || 'Custom offer'}</p>
                </div>
                <div className="rounded-2xl bg-violet-50 p-3 text-violet-700 ring-1 ring-violet-100">
                  <Wand2 className="h-5 w-5" />
                </div>
              </div>
              <p className="mt-4 line-clamp-4 text-sm leading-6 text-zinc-600">{template.subject}</p>
              <div className="mt-5 flex items-center justify-between gap-3">
                <Link href={`/templates/${template.id}`} className="inline-flex items-center gap-1 text-sm font-semibold text-violet-700">
                  Edit
                </Link>
                <button onClick={() => handleDelete(template.id)} className="inline-flex items-center gap-1 rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm font-semibold text-zinc-700 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700">
                  <Trash2 className="h-4 w-4" />
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </AppShell>
  );
}
