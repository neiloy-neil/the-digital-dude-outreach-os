'use client';

export const dynamic = 'force-dynamic';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Copy, Save } from 'lucide-react';
import AppShell from '@/components/reachmira/AppShell';
import PageHeader from '@/components/reachmira/PageHeader';
import { TEMPLATE_CATEGORIES, TEMPLATE_VARIABLES } from '@/lib/templates/template-helpers';

export default function NewTemplatePage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '',
    category: 'First Cold Email',
    subject: '',
    body: '',
    offer_type: '',
    is_default: false,
  });

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const response = await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to save template');
      router.push(`/templates/${data.template.id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save template');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell>
      <PageHeader
        eyebrow="Templates"
        title="Create Template"
        subtitle="Start with a reusable subject and body for manual or campaign emails."
        actions={
          <Link href="/templates" className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-white px-4 py-2.5 text-sm font-semibold text-zinc-700 hover:bg-zinc-50">
            Back to templates
          </Link>
        }
      />

      {error && <div className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}

      <form onSubmit={handleSave} className="space-y-5 rounded-3xl border border-[var(--border)] bg-white p-6 shadow-[0_12px_40px_rgba(15,23,42,0.04)]">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Template Name</label>
            <input value={form.name} onChange={(e) => setForm((current) => ({ ...current, name: e.target.value }))} className="mt-1 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 text-sm outline-none focus:border-violet-300 focus:bg-white" />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Category</label>
            <select value={form.category} onChange={(e) => setForm((current) => ({ ...current, category: e.target.value }))} className="mt-1 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 text-sm outline-none focus:border-violet-300 focus:bg-white">
              {TEMPLATE_CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}
            </select>
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
          <textarea value={form.body} onChange={(e) => setForm((current) => ({ ...current, body: e.target.value }))} rows={12} className="mt-1 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 text-sm leading-6 outline-none focus:border-violet-300 focus:bg-white" placeholder="Write the email body here. You can use simple HTML or plain text." />
        </div>

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] p-4">
          <div className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Variables</div>
          <div className="flex flex-wrap gap-2">
            {TEMPLATE_VARIABLES.map((variable) => (
              <button key={variable} type="button" onClick={() => navigator.clipboard.writeText(variable)} className="inline-flex items-center gap-1 rounded-xl bg-white px-3 py-2 text-xs font-semibold text-zinc-700 ring-1 ring-[var(--border)] hover:text-violet-700">
                <Copy className="h-3.5 w-3.5" /> {variable}
              </button>
            ))}
          </div>
        </div>

        <label className="flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 text-sm text-zinc-700">
          <input type="checkbox" checked={form.is_default} onChange={(e) => setForm((current) => ({ ...current, is_default: e.target.checked }))} className="h-4 w-4 rounded border-zinc-300 text-violet-600 focus:ring-violet-500" />
          Make this template the default
        </label>

        <button type="submit" disabled={saving || !form.name.trim() || !form.subject.trim() || !form.body.trim()} className="inline-flex items-center gap-2 rounded-2xl bg-zinc-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:opacity-50">
          {saving ? (
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
          ) : (
            <>
              <Save className="h-4 w-4" />
              Save template
            </>
          )}
        </button>
      </form>
    </AppShell>
  );
}
