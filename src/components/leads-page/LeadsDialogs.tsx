'use client';

import { ConfirmDialog } from '@/components/reachmira/ui';

type PendingBulkAction = {
  action: string;
  extras: Record<string, unknown>;
  label: string;
} | null;

type LeadsDialogsProps = {
  pendingBulkAction: PendingBulkAction;
  selectedCount: number;
  onConfirmBulkAction: () => void;
  onCancelBulkAction: () => void;
  deleteViewId: string | null;
  onConfirmDeleteView: () => void;
  onCancelDeleteView: () => void;
};

export default function LeadsDialogs({
  pendingBulkAction,
  selectedCount,
  onConfirmBulkAction,
  onCancelBulkAction,
  deleteViewId,
  onConfirmDeleteView,
  onCancelDeleteView,
}: LeadsDialogsProps) {
  return (
    <>
      <ConfirmDialog
        open={Boolean(pendingBulkAction)}
        title="Apply bulk action?"
        description={`Apply "${pendingBulkAction?.label || ''}" to ${selectedCount} selected lead${selectedCount === 1 ? '' : 's'}?`}
        confirmLabel="Apply"
        tone="default"
        onConfirm={onConfirmBulkAction}
        onCancel={onCancelBulkAction}
      />

      <ConfirmDialog
        open={Boolean(deleteViewId)}
        title="Delete saved view?"
        description="This filter preset will be removed. Your leads are not affected."
        confirmLabel="Delete View"
        onConfirm={onConfirmDeleteView}
        onCancel={onCancelDeleteView}
      />
    </>
  );
}
