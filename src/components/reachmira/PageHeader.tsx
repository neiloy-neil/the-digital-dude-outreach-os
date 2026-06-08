import Link from 'next/link';
import type { ReactNode } from 'react';

type Props = {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  breadcrumbs?: Array<{ label: string; href?: string }>;
};

export default function PageHeader({ eyebrow, title, subtitle, actions, breadcrumbs }: Props) {
  return (
    <header className="mb-6">
      {breadcrumbs && breadcrumbs.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
          {breadcrumbs.map((crumb, index) => (
            <span key={`${crumb.label}-${index}`} className="flex items-center gap-2">
              {crumb.href ? (
                <Link href={crumb.href} className="font-medium text-zinc-500 hover:text-violet-700">
                  {crumb.label}
                </Link>
              ) : (
                <span>{crumb.label}</span>
              )}
              {index < breadcrumbs.length - 1 && <span className="text-zinc-300">/</span>}
            </span>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          {eyebrow && <div className="text-xs font-semibold uppercase tracking-[0.22em] text-violet-600">{eyebrow}</div>}
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-zinc-950">{title}</h1>
          {subtitle && <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-500">{subtitle}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}
