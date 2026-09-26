'use client';

type CampaignPaginationProps = {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
};

export default function CampaignPagination({ currentPage, totalPages, totalItems, pageSize, onPageChange }: CampaignPaginationProps) {
  return (
    <div className="mt-4 flex flex-col gap-3 border-t border-[var(--border)] pt-4 text-xs text-zinc-500 sm:flex-row sm:items-center sm:justify-between">
      <span>
        Showing {totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1}-{Math.min(currentPage * pageSize, totalItems)} of {totalItems}
      </span>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage <= 1}
          className="rounded-lg border border-[var(--border)] bg-white px-3 py-1.5 font-semibold text-zinc-700 transition hover:bg-violet-50 disabled:opacity-50"
        >
          Previous
        </button>
        <span className="font-semibold text-zinc-700">Page {currentPage} / {totalPages}</span>
        <button
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage >= totalPages}
          className="rounded-lg border border-[var(--border)] bg-white px-3 py-1.5 font-semibold text-zinc-700 transition hover:bg-violet-50 disabled:opacity-50"
        >
          Next
        </button>
      </div>
    </div>
  );
}
