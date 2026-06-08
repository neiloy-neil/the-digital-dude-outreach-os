import type { LucideIcon } from 'lucide-react';

type Props = {
  label: string;
  value: string | number;
  description?: string;
  icon: LucideIcon;
  tone?: 'violet' | 'teal' | 'sky' | 'rose' | 'amber' | 'slate';
  trend?: string;
};

const toneMap = {
  violet: 'bg-violet-50 text-violet-700 ring-violet-100',
  teal: 'bg-teal-50 text-teal-700 ring-teal-100',
  sky: 'bg-sky-50 text-sky-700 ring-sky-100',
  rose: 'bg-rose-50 text-rose-700 ring-rose-100',
  amber: 'bg-amber-50 text-amber-700 ring-amber-100',
  slate: 'bg-slate-50 text-slate-700 ring-slate-100',
} as const;

export default function MetricCard({ label, value, description, icon: Icon, tone = 'violet', trend }: Props) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-white p-5 shadow-[0_12px_40px_rgba(15,23,42,0.04)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">{label}</div>
          <div className="mt-2 text-3xl font-semibold tracking-tight text-zinc-950">{value}</div>
        </div>
        <div className={`rounded-2xl p-3 ring-1 ${toneMap[tone]}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between gap-3 text-sm">
        <p className="text-zinc-500">{description}</p>
        {trend && <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] font-semibold text-zinc-700">{trend}</span>}
      </div>
    </div>
  );
}
