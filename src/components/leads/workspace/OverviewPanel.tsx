'use client';

import { ExternalLink, Save } from 'lucide-react';
import Spinner from '@/components/reachmira/Spinner';
import { getLeadStatusLabel } from '@/lib/leads/status';
import { useToast } from '@/lib/toast/toast-context';
import { normalizeWebsite, formatDate } from '@/components/leads/workspace/utils';
import type { Lead } from '@/types/database.types';

type Offer = { id: string; name: string; description?: string | null };

type OverviewForm = {
  decision_maker_name: string;
  decision_maker_title: string;
  email: string;
  company_name: string;
  website: string;
  industry: string;
  pain_points: string;
  recommended_offer: string;
  status: string;
  priority: string;
  next_follow_up_at: string;
  notes: string;
};

type OverviewPanelProps = {
  form: OverviewForm;
  setForm: (updater: (current: any) => any) => void;
  offers: Offer[];
  saving: boolean;
  lead: Pick<Lead, 'company_name' | 'company' | 'email' | 'website' | 'last_email_sent_at' | 'last_contacted_at' | 'last_contacted' | 'status' | 'reply_status' | 'next_follow_up_at' | 'next_follow_up_date' | 'tags' | 'notes'>;
  onSaveLead: () => void;
};

const TEXT_FIELDS: Array<{ key: keyof OverviewForm; label: string; multi: boolean }> = [
  { key: 'decision_maker_name', label: 'Decision Maker', multi: false },
  { key: 'decision_maker_title', label: 'Title', multi: false },
  { key: 'email', label: 'Email', multi: false },
  { key: 'company_name', label: 'Company', multi: false },
  { key: 'website', label: 'Website', multi: false },
  { key: 'industry', label: 'Industry', multi: false },
  { key: 'pain_points', label: 'Pain Points', multi: true },
];

export default function OverviewPanel({ form, setForm, offers, saving, lead, onSaveLead }: OverviewPanelProps) {
  const toast = useToast();

  return (
    <div className="grid gap-6 xl:grid-cols-[1.5fr_0.85fr]">
      <div className="rounded-3xl border border-[var(--border)] bg-white p-6 shadow-[0_12px_40px_rgba(15,23,42,0.04)]">
        <div className="mb-5 flex flex-col gap-3 border-b border-[var(--border)] pb-4 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-base font-semibold text-zinc-950">Overview</h3>
          <button onClick={onSaveLead} disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-teal-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-95 disabled:opacity-50">
            {saving ? <Spinner size={16} className="text-white" /> : <Save className="h-4 w-4" />}
            {saving ? 'Saving...' : 'Save Lead'}
          </button>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {TEXT_FIELDS.map(({ key, label, multi }) => (
            <div key={key} className={multi ? 'md:col-span-2' : ''}>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">{label}</label>
              {multi ? (
                <textarea value={form[key]} onChange={(e) => setForm((current: any) => ({ ...current, [key]: e.target.value }))} rows={3} className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 text-sm text-zinc-900 outline-none transition focus:border-violet-300 focus:ring-2 focus:ring-violet-100" />
              ) : (
                <input value={form[key]} onChange={(e) => setForm((current: any) => ({ ...current, [key]: e.target.value }))} className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 text-sm text-zinc-900 outline-none transition focus:border-violet-300 focus:ring-2 focus:ring-violet-100" />
              )}
            </div>
          ))}
          <div className="md:col-span-2">
            <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 font-bold text-violet-600">Recommended Offer / Service</label>
            <select
              value={form.recommended_offer}
              onChange={(e) => setForm((current: any) => ({ ...current, recommended_offer: e.target.value }))}
              className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 text-sm text-zinc-900 outline-none transition focus:border-violet-300 focus:ring-2 focus:ring-violet-100"
            >
              <option value="">-- Select or type below --</option>
              {offers.map((offer) => (
                <option key={offer.id} value={offer.name}>{offer.name} {offer.description ? `(${offer.description})` : ''}</option>
              ))}
            </select>
            <input
              value={form.recommended_offer}
              onChange={(e) => setForm((current: any) => ({ ...current, recommended_offer: e.target.value }))}
              placeholder="Or type custom offer here..."
              className="mt-2 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 text-sm text-zinc-900 outline-none transition focus:border-violet-300 focus:ring-2 focus:ring-violet-100"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">Status</label>
            <input value={form.status} onChange={(e) => setForm((current: any) => ({ ...current, status: e.target.value }))} className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 text-sm text-zinc-900 outline-none transition focus:border-violet-300 focus:ring-2 focus:ring-violet-100" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">Priority</label>
            <select value={form.priority} onChange={(e) => setForm((current: any) => ({ ...current, priority: e.target.value }))} className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 text-sm text-zinc-900 outline-none transition focus:border-violet-300 focus:ring-2 focus:ring-violet-100">
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 font-bold text-violet-600">Next Follow-up Reminder & Snooze</label>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <input
                type="datetime-local"
                value={form.next_follow_up_at}
                onChange={(e) => setForm((current: any) => ({ ...current, next_follow_up_at: e.target.value }))}
                className="flex-1 rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 text-sm text-zinc-900 outline-none transition focus:border-violet-300 focus:ring-2 focus:ring-violet-100"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const d = new Date();
                    d.setDate(d.getDate() + 1);
                    setForm((current: any) => ({ ...current, next_follow_up_at: d.toISOString().substring(0, 16) }));
                    toast.info('Snoozed 1 day. Click "Save Lead" to persist.');
                  }}
                  className="rounded-xl border border-violet-200 bg-violet-50 px-3.5 py-2.5 text-xs font-semibold text-violet-700 transition hover:bg-violet-100"
                >
                  +1 Day
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const d = new Date();
                    d.setDate(d.getDate() + 3);
                    setForm((current: any) => ({ ...current, next_follow_up_at: d.toISOString().substring(0, 16) }));
                    toast.info('Snoozed 3 days. Click "Save Lead" to persist.');
                  }}
                  className="rounded-xl border border-violet-200 bg-violet-50 px-3.5 py-2.5 text-xs font-semibold text-violet-700 transition hover:bg-violet-100"
                >
                  +3 Days
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setForm((current: any) => ({ ...current, next_follow_up_at: '' }));
                    toast.info('Follow-up cleared. Click "Save Lead" to persist.');
                  }}
                  className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-100"
                >
                  Clear
                </button>
              </div>
            </div>
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">Notes</label>
            <textarea value={form.notes} onChange={(e) => setForm((current: any) => ({ ...current, notes: e.target.value }))} rows={4} className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 text-sm text-zinc-900 outline-none transition focus:border-violet-300 focus:ring-2 focus:ring-violet-100" />
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <div className="rounded-3xl border border-[var(--border)] bg-white p-6 shadow-[0_12px_40px_rgba(15,23,42,0.04)]">
          <h3 className="mb-4 text-base font-semibold text-zinc-950">Quick Facts</h3>
          <div className="space-y-3 text-sm">
            <div className="flex items-start justify-between gap-4 rounded-2xl bg-[var(--surface-muted)] px-4 py-3"><span className="text-zinc-500">Company</span><span className="text-right font-medium text-zinc-900">{lead.company_name || lead.company || '-'}</span></div>
            <div className="flex items-start justify-between gap-4 rounded-2xl bg-[var(--surface-muted)] px-4 py-3"><span className="text-zinc-500">Email</span><span className="text-right font-medium text-zinc-900">{lead.email}</span></div>
            <div className="flex items-start justify-between gap-4 rounded-2xl bg-[var(--surface-muted)] px-4 py-3"><span className="text-zinc-500">Website</span><span className="text-right font-medium text-zinc-900">{lead.website ? <a href={normalizeWebsite(lead.website)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-violet-700 hover:text-violet-800">Visit <ExternalLink className="h-3.5 w-3.5" /></a> : <span>-</span>}</span></div>
            <div className="flex items-start justify-between gap-4 rounded-2xl bg-[var(--surface-muted)] px-4 py-3"><span className="text-zinc-500">Last Contacted</span><span className="text-right font-medium text-zinc-900">{formatDate(lead.last_email_sent_at || lead.last_contacted_at || lead.last_contacted)}</span></div>
          </div>
        </div>

        <div className="rounded-3xl border border-[var(--border)] bg-white p-6 shadow-[0_12px_40px_rgba(15,23,42,0.04)]">
          <h3 className="mb-4 text-base font-semibold text-zinc-950">Outreach Status</h3>
          <div className="space-y-3 text-sm">
            <div className="flex items-start justify-between gap-4 rounded-2xl bg-[var(--surface-muted)] px-4 py-3"><span className="text-zinc-500">Status</span><span className="text-right font-medium text-zinc-900">{getLeadStatusLabel(lead.status)}</span></div>
            <div className="flex items-start justify-between gap-4 rounded-2xl bg-[var(--surface-muted)] px-4 py-3"><span className="text-zinc-500">Reply status</span><span className="text-right font-medium text-zinc-900">{lead.reply_status || 'no_reply'}</span></div>
            <div className="flex items-start justify-between gap-4 rounded-2xl bg-[var(--surface-muted)] px-4 py-3"><span className="text-zinc-500">Next follow-up</span><span className="text-right font-medium text-zinc-900">{formatDate(lead.next_follow_up_at || lead.next_follow_up_date)}</span></div>
            <div className="flex items-start justify-between gap-4 rounded-2xl bg-[var(--surface-muted)] px-4 py-3"><span className="text-zinc-500">Tags</span><span className="text-right font-medium text-zinc-900">{lead.tags || '-'}</span></div>
            <div className="flex items-start justify-between gap-4 rounded-2xl bg-[var(--surface-muted)] px-4 py-3"><span className="text-zinc-500">Notes</span><span className="text-right font-medium text-zinc-900">{lead.notes || '-'}</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}
