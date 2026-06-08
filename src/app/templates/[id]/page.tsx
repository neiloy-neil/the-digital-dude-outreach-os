'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Save, Trash2 } from 'lucide-react';
import AppShell from '@/components/reachmira/AppShell';
import PageHeader from '@/components/reachmira/PageHeader';

type TemplateForm = {
  name: string;
  category: string;
  subject: string;
  body: string;
  offer_type: string;
  is_default: boolean;
};

export default function EditTemplatePage() {
  const params = useParams();
  const id = String(params.id || '');
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<TemplateForm>({
    name: '',
    category: '',
    subject: '',
    body: '',
    offer_type: '',
    is_default: false,
  });

  useEffect(() => {
    const load = async () => {
      try {
        const response = await fetch(`/api/templates/${id}`);
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to load template');
        const template = data.template;
        setForm({
          name: template.name || '',
          category: template.category || '',
          subject: template.subject || '',
          body: template.body || '',
          offer_type: template.offer_type || '',
          is_default: Boolean(template.is_default),
        });
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load template');
      } finally {
        setLoading(false);
      }
    };

    if (id) load();
  }, [id]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/templates/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to update template');
      setForm({
        name: data.template.name || '',
        category: data.template.category || '',
        subject: data.template.subject || '',
        body: data.template.body || '',
        offer_type: data.template.offer_type || '',
        is_default: Boolean(data.template.is_default),
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update template');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Delete this template?')) return;
    const response = await fetch(`/api/templates/${id}`, { method: 'DELETE' });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error || 'Failed to delete template');
      return;
    }
    router.push('/templates');
  };

  return (
    <AppShell>
      <PageHeader
        eyebrow="Templates"
        title="Edit Template"
        subtitle="Adjust the reusable subject and body for manual or campaign emails."
        actions={
          <Link href="/templates" className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-white px-4 py-2.5 text-sm font-semibold text-zinc-700 hover:bg-zinc-50">
            Back to templates
          </Link>
        }
      />

      {error && <div className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}

      {loading ? (
        <div className="flex h-64 items-center justify-center rounded-3xl border border-[var(--border)] bg-white">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-violet-500 border-t-transparent" />
        </div>
      ) : (
        <form onSubmit={handleSave} className="space-y-5 rounded-3xl border border-[var(--border)] bg-white p-6 shadow-[0_12px_40px_rgba(15,23,42,0.04)]">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Template Name</label>
              <input value={form.name} onChange={(e) => setForm((current) => ({ ...current, name: e.target.value }))} className="mt-1 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 text-sm outline-none focus:border-violet-300 focus:bg-white" />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Category</label>
              <input value={form.category} onChange={(e) => setForm((current) => ({ ...current, category: e.target.value }))} className="mt-1 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 text-sm outline-none focus:border-violet-300 focus:bg-white" />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Subject</label>
              <input value={form.subject} onChange={(e) => setForm((current) => ({ ...current, subject: e.target.value }))} className="mt-1 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 text-sm outline-none focus:border-violet-300 focus:bg-white" />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Offer Type</label>
              <input value={form.offer_type} onChange={(e) => setForm((current) => ({ ...current, offer_type: e.target.value }))} className="mt-1 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 text-sm outline-none focus:border-violet-300 focus:bg-white" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Body</label>
            <textarea value={form.body} onChange={(e) => setForm((current) => ({ ...current, body: e.target.value }))} rows={12} className="mt-1 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 text-sm leading-6 outline-none focus:border-violet-300 focus:bg-white" />
          </div>

          <label className="flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 text-sm text-zinc-700">
            <input type="checkbox" checked={form.is_default} onChange={(e) => setForm((current) => ({ ...current, is_default: e.target.checked }))} className="h-4 w-4 rounded border-zinc-300 text-violet-600 focus:ring-violet-500" />
            Make this template the default
          </label>

          <div className="flex flex-wrap items-center gap-3">
            <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-2xl bg-zinc-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:opacity-50">
              {saving ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Save changes
                </>
              )}
            </button>
            <button type="button" onClick={handleDelete} className="inline-flex items-center gap-2 rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-sm font-semibold text-zinc-700 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700">
              <Trash2 className="h-4 w-4" />
              Delete template
            </button>
          </div>
        </form>
      )}
    </AppShell>
  );
}
