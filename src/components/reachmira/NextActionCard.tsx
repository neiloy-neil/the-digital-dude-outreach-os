import { ArrowRight } from 'lucide-react';
import Link from 'next/link';

type Props = {
  title: string;
  description: string;
  actionLabel: string;
  actionHref: string;
  count?: number | string;
  tone?: 'violet' | 'teal' | 'amber' | 'rose' | 'sky';
};

const toneMap = {
  violet: 'from-violet-50 to-white ring-violet-100 text-violet-700',
  teal: 'from-teal-50 to-white ring-teal-100 text-teal-700',
  amber: 'from-amber-50 to-white ring-amber-100 text-amber-700',
  rose: 'from-rose-50 to-white ring-rose-100 text-rose-700',
  sky: 'from-sky-50 to-white ring-sky-100 text-sky-700',
} as const;

export default function NextActionCard({ title, description, actionLabel, actionHref, count, tone = 'violet' }: Props) {
  return (
    <div className={`rounded-2xl border border-[var(--border)] bg-gradient-to-br p-5 shadow-[0_12px_40px_rgba(15,23,42,0.04)] ${toneMap[tone]}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-base font-semibold text-zinc-950">{title}</div>
          <p className="mt-2 text-sm leading-6 text-zinc-500">{description}</p>
        </div>
        {count !== undefined && <div className="rounded-2xl bg-white/80 px-3 py-2 text-xl font-semibold text-zinc-950 ring-1 ring-white/60">{count}</div>}
      </div>

      <div className="mt-5">
        <Link href={actionHref} className="inline-flex items-center gap-2 rounded-xl bg-zinc-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-zinc-800">
          {actionLabel}
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
