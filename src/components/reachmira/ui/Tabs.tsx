'use client';

import type { LucideIcon } from 'lucide-react';

export type TabItem<K extends string = string> = {
  key: K;
  label: string;
  icon?: LucideIcon;
  count?: number;
};

type TabsProps<K extends string> = {
  items: TabItem<K>[];
  value: K;
  onChange: (key: K) => void;
  className?: string;
};

export default function Tabs<K extends string>({ items, value, onChange, className = '' }: TabsProps<K>) {
  return (
    <div role="tablist" className={`flex flex-wrap gap-1 rounded-2xl bg-[var(--surface-muted)] p-1 ${className}`}>
      {items.map(({ key, label, icon: Icon, count }) => {
        const active = key === value;
        return (
          <button
            key={key}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(key)}
            className={`inline-flex cursor-pointer items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40 ${
              active ? 'bg-white text-violet-700 shadow-sm ring-1 ring-violet-100' : 'text-zinc-500 hover:text-zinc-800'
            }`}
          >
            {Icon && <Icon className="h-3.5 w-3.5" />}
            {label}
            {typeof count === 'number' && (
              <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${active ? 'bg-violet-50 text-violet-700' : 'bg-zinc-200/70 text-zinc-600'}`}>
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
