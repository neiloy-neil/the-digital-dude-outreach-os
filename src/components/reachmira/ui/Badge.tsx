import type { ReactNode } from 'react';

type Tone = 'violet' | 'teal' | 'sky' | 'emerald' | 'rose' | 'amber' | 'slate' | 'zinc' | 'indigo';

const toneClasses: Record<Tone, string> = {
  violet: 'border-violet-100 bg-violet-50 text-violet-700',
  teal: 'border-teal-200 bg-teal-50 text-teal-700',
  sky: 'border-sky-200 bg-sky-50 text-sky-700',
  emerald: 'border-emerald-100 bg-emerald-50 text-emerald-700',
  rose: 'border-rose-200 bg-rose-50 text-rose-700',
  amber: 'border-amber-200 bg-amber-50 text-amber-700',
  slate: 'border-slate-200 bg-slate-50 text-slate-700',
  zinc: 'border-zinc-200 bg-zinc-50 text-zinc-600',
  indigo: 'border-indigo-200 bg-indigo-50 text-indigo-700',
};

type BadgeProps = {
  tone?: Tone;
  children: ReactNode;
  className?: string;
};

export default function Badge({ tone = 'zinc', children, className = '' }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${toneClasses[tone]} ${className}`}
    >
      {children}
    </span>
  );
}
