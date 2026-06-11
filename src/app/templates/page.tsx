'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Copy, Plus, Sparkles, Wand2, Trash2 } from 'lucide-react';
import AppShell from '@/components/reachmira/AppShell';
import PageHeader from '@/components/reachmira/PageHeader';
import EmptyState from '@/components/reachmira/EmptyState';
import { useConfirm } from '@/components/reachmira/ui';

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
  const { confirm, confirmDialog } = useConfirm();
  const [loading, setLoading] = useState(true);
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 9;

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
    if (!(await confirm({
      title: 'Delete template?',
      description: 'This template will be removed. Sequences that copied it are not affected.',
      confirmLabel: 'Delete Template',
    }))) return;
    const response = await fetch(`/api/templates/${id}`, { method: 'DELETE' });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error || 'Failed to delete template');
      return;
    }
    await loadData();
  };

  const handleDuplicate = async (id: string) => {
    const response = await fetch(`/api/templates/${id}/duplicate`, { method: 'POST' });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error || 'Failed to duplicate template');
      return;
    }
    await loadData();
  };

  const totalPages = Math.max(1, Math.ceil(templates.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedTemplates = templates.slice((safeCurrentPage - 1) * pageSize, safeCurrentPage * pageSize);

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
        <div className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {paginatedTemplates.map((template) => (
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
                  <div className="flex items-center gap-2">
                    <button onClick={() => handleDuplicate(template.id)} className="inline-flex items-center gap-1 rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm font-semibold text-zinc-700 hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700">
                      <Copy className="h-4 w-4" />
                      Duplicate
                    </button>
                    <button onClick={() => handleDelete(template.id)} className="inline-flex items-center gap-1 rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm font-semibold text-zinc-700 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700">
                      <Trash2 className="h-4 w-4" />
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          {templates.length > pageSize && (
            <div className="flex flex-col gap-3 rounded-3xl border border-[var(--border)] bg-white px-5 py-4 text-xs text-zinc-500 shadow-[0_12px_40px_rgba(15,23,42,0.04)] sm:flex-row sm:items-center sm:justify-between">
              <span>
                Showing {(safeCurrentPage - 1) * pageSize + 1}-{Math.min(safeCurrentPage * pageSize, templates.length)} of {templates.length} templates
              </span>
              <div className="flex items-center gap-2">
                <button onClick={() => setCurrentPage((page) => Math.max(1, page - 1))} disabled={safeCurrentPage <= 1} className="rounded-lg border border-[var(--border)] bg-white px-3 py-1.5 font-semibold text-zinc-700 transition hover:bg-violet-50 disabled:opacity-50">
                  Previous
                </button>
                <span className="font-semibold text-zinc-700">Page {safeCurrentPage} / {totalPages}</span>
                <button onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))} disabled={safeCurrentPage >= totalPages} className="rounded-lg border border-[var(--border)] bg-white px-3 py-1.5 font-semibold text-zinc-700 transition hover:bg-violet-50 disabled:opacity-50">
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}
      {confirmDialog}
    </AppShell>
  );
}
