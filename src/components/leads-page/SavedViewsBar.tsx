'use client';

import { Button, Field, Input, Modal } from '@/components/reachmira/ui';

type SavedView = { id: string; name: string; filters: Record<string, unknown>; is_default: boolean };

type SavedViewsBarProps = {
  activeViewId: string;
  savedViews: SavedView[];
  onApplyPresetView: (viewName: string) => void;
  onApplyCustomView: (view: SavedView) => void;
  onSetDefaultView: (viewId: string) => void;
  onRequestDeleteView: (viewId: string) => void;
  showSaveViewModal: boolean;
  onOpenSaveViewModal: () => void;
  onCloseSaveViewModal: () => void;
  newViewName: string;
  onNewViewNameChange: (value: string) => void;
  onSaveCurrentView: () => void;
  savingView: boolean;
};

export default function SavedViewsBar({
  activeViewId,
  savedViews,
  onApplyPresetView,
  onApplyCustomView,
  onSetDefaultView,
  onRequestDeleteView,
  showSaveViewModal,
  onOpenSaveViewModal,
  onCloseSaveViewModal,
  newViewName,
  onNewViewNameChange,
  onSaveCurrentView,
  savingView,
}: SavedViewsBarProps) {
  const presetViews = [
    { id: 'all', label: 'All Leads' },
    { id: 'valid_emails', label: 'Valid Emails Only' },
    { id: 'ready_to_send', label: 'Ready to Send' },
    { id: 'followups_due', label: 'Follow-ups Due Today' },
    { id: 'high_priority', label: 'High Priority Leads' },
    { id: 'missing_pain', label: 'Missing Pain Point' },
    { id: 'not_contacted', label: 'Not Contacted Yet' },
  ];

  return (
    <>
      {/* Saved Views Preset Bar */}
      <div className="mb-6 rounded-3xl border border-[var(--border)] bg-white p-4 shadow-[0_12px_40px_rgba(15,23,42,0.02)]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-400 mr-2">Saved Views:</span>
            {presetViews.map((view) => (
              <button
                key={view.id}
                onClick={() => onApplyPresetView(view.id)}
                className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                  activeViewId === view.id ? 'bg-violet-600 text-white' : 'bg-zinc-50 text-zinc-600 hover:bg-zinc-100'
                }`}
              >
                {view.label}
              </button>
            ))}

            {/* Custom Saved Views */}
            {savedViews.map((view) => (
              <div
                key={view.id}
                onClick={() => onApplyCustomView(view)}
                className={`group flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
                  activeViewId === view.id ? 'bg-violet-600 text-white' : 'bg-zinc-50 text-zinc-600 hover:bg-zinc-100'
                }`}
              >
                <span>{view.name}</span>
                {view.is_default ? (
                  <span className="text-[10px] text-amber-500 font-bold" title="Default view">★</span>
                ) : (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onSetDefaultView(view.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 text-[10px] text-zinc-400 hover:text-amber-500 transition-all"
                    title="Set as Default"
                  >
                    ☆
                  </button>
                )}
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    onRequestDeleteView(view.id);
                  }}
                  className="rounded p-0.5 hover:bg-black/10 text-zinc-400 group-hover:text-current transition-colors"
                  title="Delete view"
                >
                  &times;
                </span>
              </div>
            ))}
          </div>

          <button
            onClick={onOpenSaveViewModal}
            className="rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
          >
            + Save Current View
          </button>
        </div>
      </div>

      <Modal open={showSaveViewModal} onClose={onCloseSaveViewModal} title="Save Current Filter Preset" maxWidth="md">
        <p className="-mt-4 mb-4 text-xs text-zinc-500">Name this view to quickly re-apply all your current filters later.</p>
        <Field label="View name" htmlFor="save-view-name">
          <Input
            id="save-view-name"
            type="text"
            required
            value={newViewName}
            onChange={(e) => onNewViewNameChange(e.target.value)}
            placeholder="e.g. Agency Leads with Valid Emails"
          />
        </Field>
        <div className="mt-6 flex justify-end gap-3">
          <Button size="sm" onClick={onCloseSaveViewModal}>
            Cancel
          </Button>
          <Button size="sm" variant="primary" onClick={onSaveCurrentView} loading={savingView}>
            {savingView ? 'Saving...' : 'Save View'}
          </Button>
        </div>
      </Modal>
    </>
  );
}
