'use client';

import { Copy } from 'lucide-react';

type RawDataPanelProps = {
  rawData: Record<string, unknown>;
};

export default function RawDataPanel({ rawData }: RawDataPanelProps) {
  return (
    <div className="rounded-3xl border border-[var(--border)] bg-white p-6 shadow-[0_12px_40px_rgba(15,23,42,0.04)]">
      <div className="mb-4 flex items-center justify-between border-b border-[var(--border)] pb-3">
        <h3 className="text-base font-semibold text-zinc-950">Raw Data</h3>
        <button onClick={() => navigator.clipboard.writeText(JSON.stringify(rawData || {}, null, 2))} className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-white px-4 py-2.5 text-sm font-semibold text-zinc-700 transition hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700">
          <Copy className="h-4 w-4" /> Copy Raw Data
        </button>
      </div>
      <div className="max-h-[560px] overflow-auto rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)]">
        <table className="w-full text-left text-xs">
          <tbody className="divide-y divide-[var(--border)]">
            {Object.entries(rawData || {})
              .filter(([, value]) => value !== null && value !== undefined && value !== '')
              .map(([key, value]) => (
                <tr key={key}>
                  <td className="w-56 px-3 py-2 font-semibold text-zinc-500">{key}</td>
                  <td className="px-3 py-2 text-zinc-900">{String(value)}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
