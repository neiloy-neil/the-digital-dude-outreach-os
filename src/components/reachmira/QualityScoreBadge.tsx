type Props = {
  score?: number | null;
  label?: string;
};

export default function QualityScoreBadge({ score, label }: Props) {
  const value = typeof score === 'number' ? score : null;
  const tone =
    value === null
      ? 'bg-zinc-100 text-zinc-600 ring-zinc-200'
      : value >= 80
        ? 'bg-emerald-50 text-emerald-700 ring-emerald-100'
        : value >= 60
          ? 'bg-teal-50 text-teal-700 ring-teal-100'
          : value >= 40
            ? 'bg-amber-50 text-amber-700 ring-amber-100'
            : 'bg-rose-50 text-rose-700 ring-rose-100';

  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ring-1 ${tone}`}>
      {label || 'Data quality'} {value !== null ? `${value}%` : '—'}
    </span>
  );
}
