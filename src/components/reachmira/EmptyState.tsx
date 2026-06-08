import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';

type Props = {
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
  actionIcon?: LucideIcon;
  icon: LucideIcon;
};

export default function EmptyState({ title, description, actionLabel, actionHref, actionIcon: ActionIcon, icon: Icon }: Props) {
  return (
    <div className="rounded-3xl border border-dashed border-[var(--border)] bg-white/80 p-8 text-center shadow-[0_12px_40px_rgba(15,23,42,0.03)]">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-50 text-violet-600 ring-1 ring-violet-100">
        <Icon className="h-6 w-6" />
      </div>
      <h3 className="mt-4 text-lg font-semibold text-zinc-950">{title}</h3>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-zinc-500">{description}</p>
      {actionLabel && actionHref && (
        <div className="mt-5">
          <Link href={actionHref} className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-700">
            {ActionIcon && <ActionIcon className="h-4 w-4" />}
            {actionLabel}
          </Link>
        </div>
      )}
    </div>
  );
}
