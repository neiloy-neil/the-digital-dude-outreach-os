'use client';

import { formatDate, eventTimestamp } from '@/components/leads/workspace/utils';

type TimelineItem = {
  id: string;
  title: string;
  message: string;
  created_at?: string;
  sent_at?: string;
  metadata?: Record<string, unknown>;
};

type TimelinePanelProps = {
  timeline: TimelineItem[];
};

export default function TimelinePanel({ timeline }: TimelinePanelProps) {
  return (
    <div className="rounded-3xl border border-[var(--border)] bg-white p-6 shadow-[0_12px_40px_rgba(15,23,42,0.04)]">
      <div className="mb-5 flex items-center justify-between border-b border-[var(--border)] pb-4">
        <h3 className="text-base font-semibold text-zinc-950">Timeline</h3>
        <span className="text-xs text-zinc-500">{timeline.length} events</span>
      </div>
      <div className="grid gap-3">
        {timeline.map((item) => (
          <div key={item.id} className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="font-semibold text-zinc-950">{item.title}</div>
                <div className="mt-1 text-sm leading-6 text-zinc-600">{item.message}</div>
              </div>
              <div className="text-xs text-zinc-500">{formatDate(eventTimestamp(item))}</div>
            </div>
            {item.metadata && Object.keys(item.metadata).length > 0 && (
              <pre className="mt-3 overflow-x-auto rounded-2xl bg-white p-3 text-[11px] text-zinc-600">{JSON.stringify(item.metadata, null, 2)}</pre>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
