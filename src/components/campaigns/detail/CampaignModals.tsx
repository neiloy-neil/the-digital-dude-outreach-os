'use client';

import { Play } from 'lucide-react';
import { Badge, Banner, Button, ConfirmDialog, Modal } from '@/components/reachmira/ui';

type LaunchChecklistItem = { label: string; detail: string; ok: boolean; required: boolean };

type CampaignModalsProps = {
  bulkApproveModalOpen: boolean;
  onCloseBulkApproveModal: () => void;
  pendingBulkApprovalCount: number;
  onConfirmBulkApprove: () => void;
  bulkApproving: boolean;

  launchModalOpen: boolean;
  onCloseLaunchModal: () => void;
  campaignName?: string;
  launchChecklist: LaunchChecklistItem[];
  launchBlockingIssuesCount: number;
  onConfirmLaunch: () => void;

  clearLeadsConfirmOpen: boolean;
  onCloseClearLeadsConfirm: () => void;
  onConfirmClearLeads: () => void;
};

export default function CampaignModals({
  bulkApproveModalOpen,
  onCloseBulkApproveModal,
  pendingBulkApprovalCount,
  onConfirmBulkApprove,
  bulkApproving,
  launchModalOpen,
  onCloseLaunchModal,
  campaignName,
  launchChecklist,
  launchBlockingIssuesCount,
  onConfirmLaunch,
  clearLeadsConfirmOpen,
  onCloseClearLeadsConfirm,
  onConfirmClearLeads,
}: CampaignModalsProps) {
  return (
    <>
      <Modal open={bulkApproveModalOpen} onClose={onCloseBulkApproveModal} maxWidth="lg">
        <div className="border-b border-[var(--border)] pb-4 pr-10">
          <Badge tone="amber" className="mb-2 uppercase tracking-wide">Bulk send safety check</Badge>
          <h3 className="text-lg font-semibold text-zinc-950">Approve and queue {pendingBulkApprovalCount} leads?</h3>
          <p className="mt-2 text-sm leading-6 text-zinc-500">
            This will approve every pending personalized email and add them to the campaign outbox. If the campaign is active, ReachMira can send them during the next automation run while respecting campaign and email-account limits.
          </p>
        </div>

        <div className="mt-4 grid gap-3 rounded-2xl border border-amber-100 bg-amber-50 p-4 text-sm text-amber-900">
          <div className="font-semibold">Before continuing, confirm:</div>
          <div>Each selected lead has been reviewed enough for automated sending.</div>
          <div>Your sequence, sender account, suppression checks, and daily limits are ready.</div>
        </div>

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button onClick={onCloseBulkApproveModal}>
            Cancel
          </Button>
          <Button variant="primary" onClick={onConfirmBulkApprove} loading={bulkApproving}>
            Confirm Bulk Queue
          </Button>
        </div>
      </Modal>

      <Modal open={launchModalOpen} onClose={onCloseLaunchModal} maxWidth="2xl">
        <div className="border-b border-[var(--border)] pb-4 pr-10">
          <Badge tone="emerald" className="mb-2 uppercase tracking-wide">Campaign launch</Badge>
          <h3 className="text-lg font-semibold text-zinc-950">Launch {campaignName}?</h3>
          <p className="mt-2 text-sm leading-6 text-zinc-500">
            Once active, ReachMira will send approved campaign emails during automation runs while respecting suppression checks, campaign limits, and email-account limits.
          </p>
        </div>

        <div className="mt-5 grid gap-3">
          {launchChecklist.map((item) => (
            <div key={item.label} className="flex items-start justify-between gap-4 rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] p-4">
              <div>
                <div className="text-sm font-semibold text-zinc-950">{item.label}</div>
                <div className="mt-1 text-xs leading-5 text-zinc-500">{item.detail}</div>
              </div>
              <Badge tone={item.ok ? 'emerald' : 'amber'} className="shrink-0 uppercase tracking-wide">
                {item.ok ? 'Ready' : 'Fix'}
              </Badge>
            </div>
          ))}
        </div>

        {launchBlockingIssuesCount > 0 && (
          <Banner tone="warning" className="mt-4">
            Fix the required launch items before starting this campaign. We’ll keep the launch button disabled until the checklist is clean.
          </Banner>
        )}

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button onClick={onCloseLaunchModal}>
            Cancel
          </Button>
          <Button
            variant="primary"
            className="!from-emerald-600 !to-teal-500 !shadow-emerald-600/15"
            onClick={onConfirmLaunch}
            disabled={launchBlockingIssuesCount > 0}
          >
            <Play className="h-4 w-4" /> Confirm Launch
          </Button>
        </div>
      </Modal>

      <ConfirmDialog
        open={clearLeadsConfirmOpen}
        title="Delete all campaign leads?"
        description="Every lead in this campaign will be deleted and any pending emails will be cancelled. This cannot be undone."
        confirmLabel="Delete All Leads"
        onConfirm={onConfirmClearLeads}
        onCancel={onCloseClearLeadsConfirm}
      />
    </>
  );
}
