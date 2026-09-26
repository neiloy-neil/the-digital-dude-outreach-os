'use client';

type PaginationProps = {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  itemLabel?: string;
  variant?: 'default' | 'compact';
};

export default function Pagination({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
  itemLabel = 'leads',
  variant = 'default',
}: PaginationProps) {
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const rangeStart = totalItems === 0 ? 0 : (safeCurrentPage - 1) * pageSize + 1;
  const rangeEnd = Math.min(safeCurrentPage * pageSize, totalItems);

  if (variant === 'compact') {
    return (
      <div className="flex flex-col gap-3 border-t border-[var(--border)] p-4 text-xs text-zinc-500 sm:flex-row sm:items-center sm:justify-between">
        <span>
          Showing {rangeStart}-{rangeEnd} of {totalItems} {itemLabel}
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onPageChange(Math.max(1, safeCurrentPage - 1))}
            disabled={safeCurrentPage <= 1}
            className="rounded border border-[var(--border)] bg-white px-3 py-1.5 font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
          >
            Previous
          </button>
          <span className="font-medium text-zinc-700">
            Page {safeCurrentPage} of {totalPages}
          </span>
          <button
            onClick={() => onPageChange(Math.min(totalPages, safeCurrentPage + 1))}
            disabled={safeCurrentPage >= totalPages}
            className="rounded border border-[var(--border)] bg-white px-3 py-1.5 font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 border-t border-[var(--border)] px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="text-sm text-zinc-500">
        Showing{' '}
        <span className="font-semibold text-zinc-900">{rangeStart}</span>{' '}
        to{' '}
        <span className="font-semibold text-zinc-900">{rangeEnd}</span>{' '}
        of <span className="font-semibold text-zinc-900">{totalItems}</span> {itemLabel}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => onPageChange(Math.max(1, safeCurrentPage - 1))}
          disabled={safeCurrentPage <= 1}
          className="rounded-xl border border-[var(--border)] bg-white px-4 py-2 text-sm font-semibold text-zinc-700 transition hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Previous
        </button>
        <div className="rounded-xl bg-[var(--surface-muted)] px-4 py-2 text-sm font-semibold text-zinc-700">
          Page {safeCurrentPage} of {totalPages}
        </div>
        <button
          onClick={() => onPageChange(Math.min(totalPages, safeCurrentPage + 1))}
          disabled={safeCurrentPage >= totalPages}
          className="rounded-xl border border-[var(--border)] bg-white px-4 py-2 text-sm font-semibold text-zinc-700 transition hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Next
        </button>
      </div>
    </div>
  );
}
