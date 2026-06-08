import { getLeadStatusClassName, getLeadStatusLabel } from '@/lib/leads/status';

export default function StatusBadge({ status }: { status?: string | null }) {
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${getLeadStatusClassName(status)}`}>
      {getLeadStatusLabel(status)}
    </span>
  );
}
