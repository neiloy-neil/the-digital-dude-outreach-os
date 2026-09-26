'use client';

import { Copy, Database, Save, Sparkles, X } from 'lucide-react';
import Spinner from '@/components/reachmira/Spinner';
import type { Lead } from '@/types/database.types';

type IntelligenceForm = {
  pain_points: string;
  ai_solution_angle: string;
  recommended_offer: string;
  ai_company_summary: string;
  ai_lead_analysis: string;
  ai_outreach_strategy: string;
  ai_personalized_first_line: string;
  ceo_name: string;
  industry: string;
  employee_count: string;
  year_founded: string;
  funding_stage: string;
  total_raised: string;
  tech_stack: string;
};

type IntelligencePanelProps = {
  form: IntelligenceForm;
  setForm: (updater: (current: any) => any) => void;
  saving: boolean;
  lead: Pick<Lead, 'website' | 'email' | 'data_quality_label' | 'ai_usage_notes' | 'processing_error'>;
  leadSummary: string;
  leadContextPrompt: string;
  onAutoResearch: () => void;
  onEnrichLead: () => void;
  onSaveLead: () => void;
  onGenerateAi: (requestedDepth?: 'none' | 'basic' | 'standard' | 'deep', requestedMode?: string) => void;
  onSkipAi: () => void;
};

const TEXTAREA_FIELDS_PRIMARY: Array<[keyof IntelligenceForm, string]> = [
  ['pain_points', 'Pain Point'],
  ['ai_solution_angle', 'Solution Angle'],
  ['recommended_offer', 'Recommended Offer'],
];

const TEXTAREA_FIELDS_SECONDARY: Array<[keyof IntelligenceForm, string]> = [
  ['ai_company_summary', 'Company Summary'],
  ['ai_lead_analysis', 'Lead Analysis'],
  ['ai_outreach_strategy', 'Outreach Strategy'],
  ['ai_personalized_first_line', 'Personalized First Line'],
];

const FIRMOGRAPHIC_FIELDS: Array<[keyof IntelligenceForm, string]> = [
  ['ceo_name', 'CEO / Founder'],
  ['industry', 'Industry'],
  ['employee_count', 'Employee Count'],
  ['year_founded', 'Year Founded'],
  ['funding_stage', 'Funding Stage'],
  ['total_raised', 'Total Raised'],
  ['tech_stack', 'Tech Stack'],
];

export default function IntelligencePanel({
  form,
  setForm,
  saving,
  lead,
  leadSummary,
  leadContextPrompt,
  onAutoResearch,
  onEnrichLead,
  onSaveLead,
  onGenerateAi,
  onSkipAi,
}: IntelligencePanelProps) {
  return (
    <div className="grid gap-6 xl:grid-cols-[1.35fr_0.95fr]">
      <div className="rounded-3xl border border-[var(--border)] bg-white p-6 shadow-[0_12px_40px_rgba(15,23,42,0.04)]">
        <div className="mb-5 flex flex-col gap-3 border-b border-[var(--border)] pb-4 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-base font-semibold text-zinc-950">Lead Intelligence</h3>
          <div className="flex flex-wrap gap-2">
            <button onClick={onAutoResearch} disabled={saving || !lead?.website} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-95 disabled:opacity-50">
              {saving ? <Spinner size={16} className="text-white" /> : <Sparkles className="h-4 w-4" />}
              {saving ? 'Researching...' : 'Auto-Research Lead'}
            </button>
            <button onClick={onEnrichLead} disabled={saving || !(lead?.website || lead?.email)} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-95 disabled:opacity-50">
              {saving ? <Spinner size={16} className="text-white" /> : <Database className="h-4 w-4" />}
              {saving ? 'Enriching...' : 'Deep Enrich Lead'}
            </button>
            <button onClick={onSaveLead} disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-zinc-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:opacity-50">
              <Save className="h-4 w-4" /> Save
            </button>
            <button onClick={() => navigator.clipboard.writeText(leadSummary)} className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-white px-4 py-2.5 text-sm font-semibold text-zinc-700 transition hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700">
              <Copy className="h-4 w-4" /> Copy Summary
            </button>
            <button onClick={() => navigator.clipboard.writeText(leadContextPrompt)} className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-white px-4 py-2.5 text-sm font-semibold text-zinc-700 transition hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700">
              <Copy className="h-4 w-4" /> Copy AI Prompt
            </button>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {TEXTAREA_FIELDS_PRIMARY.map(([key, label]) => (
            <div key={key} className="md:col-span-2">
              <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">{label}</label>
              <textarea value={form[key]} onChange={(e) => setForm((current: any) => ({ ...current, [key]: e.target.value }))} rows={3} className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 text-sm text-zinc-900 outline-none transition focus:border-violet-300 focus:ring-2 focus:ring-violet-100" />
            </div>
          ))}
          {TEXTAREA_FIELDS_SECONDARY.map(([key, label]) => (
            <div key={key} className={key === 'ai_personalized_first_line' ? 'md:col-span-2' : ''}>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">{label}</label>
              <textarea value={form[key]} onChange={(e) => setForm((current: any) => ({ ...current, [key]: e.target.value }))} rows={4} className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 text-sm text-zinc-900 outline-none transition focus:border-violet-300 focus:ring-2 focus:ring-violet-100" />
            </div>
          ))}
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {FIRMOGRAPHIC_FIELDS.map(([key, label]) => (
            <div key={key} className={key === 'tech_stack' ? 'md:col-span-2' : ''}>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">{label}</label>
              <input value={form[key]} onChange={(e) => setForm((current: any) => ({ ...current, [key]: e.target.value }))} className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 text-sm text-zinc-900 outline-none transition focus:border-violet-300 focus:ring-2 focus:ring-violet-100" />
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-3xl border border-[var(--border)] bg-white p-6 shadow-[0_12px_40px_rgba(15,23,42,0.04)]">
        <h3 className="mb-4 text-base font-semibold text-zinc-950">AI Actions</h3>
        <div className="space-y-2">
          <button onClick={() => onGenerateAi('basic', 'basic_ai')} disabled={saving} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet-600 to-teal-500 px-4 py-3 text-sm font-semibold text-white transition hover:opacity-95 disabled:opacity-50">
            <Sparkles className="h-4 w-4" /> Generate Basic AI
          </button>
          <button onClick={() => onGenerateAi('standard', 'standard_ai')} disabled={saving} className="flex w-full items-center justify-center gap-2 rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-sm font-semibold text-zinc-700 transition hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700">
            <Sparkles className="h-4 w-4 text-teal-500" /> Generate Standard AI
          </button>
          <button onClick={() => onGenerateAi('deep', 'deep_ai')} disabled={saving} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-3 text-sm font-semibold text-white transition hover:opacity-95">
            <Sparkles className="h-4 w-4" /> Generate Deep AI
          </button>
          <button onClick={() => onGenerateAi('none', 'template_only')} disabled={saving} className="flex w-full items-center justify-center gap-2 rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-sm font-semibold text-zinc-700 transition hover:border-teal-200 hover:bg-teal-50 hover:text-teal-700">
            <Database className="h-4 w-4 text-teal-500" /> Use Template Only
          </button>
          <button onClick={onSkipAi} className="flex w-full items-center justify-center gap-2 rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-sm font-semibold text-zinc-700 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700">
            <X className="h-4 w-4 text-rose-500" /> Skip AI
          </button>
        </div>
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
          This will use a Deep AI request. You have only 20/day. Flash Lite is recommended for bulk personalization.
        </div>
        <div className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] p-3 text-xs leading-5 text-zinc-600">
          Data quality: <span className="font-semibold text-zinc-900">{lead.data_quality_label || 'unknown'}</span>
          {lead.ai_usage_notes ? <div>{lead.ai_usage_notes}</div> : null}
          {lead.processing_error ? <div className="text-rose-700">{lead.processing_error}</div> : null}
        </div>
      </div>
    </div>
  );
}
