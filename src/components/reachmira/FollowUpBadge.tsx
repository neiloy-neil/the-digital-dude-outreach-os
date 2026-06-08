type Props = {
  dueDate?: string | null;
  label?: string;
};

export default function FollowUpBadge({ dueDate, label = 'Follow-up' }: Props) {
  if (!dueDate) {
    return (
      <span className="inline-flex items-center rounded-full bg-zinc-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-600">
        No follow-up set
      </span>
    );
  }

  const date = new Date(dueDate);
  const isToday = new Date().toDateString() === date.toDateString();
  const isOverdue = date.getTime() < new Date().setHours(0, 0, 0, 0);

  const tone = isOverdue
    ? 'bg-rose-50 text-rose-700'
    : isToday
      ? 'bg-amber-50 text-amber-700'
      : 'bg-teal-50 text-teal-700';

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${tone}`}>
      {label} {date.toLocaleDateString()}
    </span>
  );
}
