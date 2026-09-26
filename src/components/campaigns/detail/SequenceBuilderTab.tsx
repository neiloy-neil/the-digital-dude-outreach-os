'use client';

import { FileText, Plus, Save, Trash2 } from 'lucide-react';
import Spinner from '@/components/reachmira/Spinner';
import type { SequenceStep } from '@/hooks/useSequenceSteps';

type SequenceBuilderTabProps = {
  sequences: SequenceStep[];
  savingSequence: boolean;
  onAddStep: () => void;
  onUpdateStepField: (index: number, field: string, value: any) => void;
  onRemoveStep: (index: number) => void;
  onSaveSequence: () => void;
};

export default function SequenceBuilderTab({
  sequences,
  savingSequence,
  onAddStep,
  onUpdateStepField,
  onRemoveStep,
  onSaveSequence,
}: SequenceBuilderTabProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-bold text-zinc-950 text-md">Email Follow-up Steps</h3>
          <p className="text-xs text-zinc-600">Configure email subjects, delay timers, and markdown templates for follow-ups.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={onAddStep}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-[var(--border)] hover:bg-violet-50 hover:text-violet-700 rounded-lg text-xs font-semibold text-zinc-700 transition-colors cursor-pointer"
          >
            <Plus className="h-4 w-4 text-violet-400" /> Add Step
          </button>
          <button
            onClick={onSaveSequence}
            disabled={savingSequence}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-gradient-to-r from-violet-600 to-teal-500 rounded-lg text-xs font-semibold text-white hover:opacity-90 shadow-md shadow-violet-500/10 transition-colors disabled:opacity-50 cursor-pointer"
          >
            {savingSequence ? (
              <Spinner size={16} className="text-white" />
            ) : (
              <>
                <Save className="h-4 w-4" /> Save Sequence
              </>
            )}
          </button>
        </div>
      </div>

      {sequences.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 border border-dashed border-[var(--border)] rounded-lg p-6">
          <FileText className="h-10 w-10 text-zinc-700 mb-3" />
          <p className="text-sm text-zinc-500 font-medium">No sequence steps added.</p>
          <button onClick={onAddStep} className="mt-3 text-xs text-violet-400 hover:text-violet-300 font-semibold">
            Create step 1 now &rarr;
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {sequences.map((step, index) => (
            <div key={index} className="rounded-xl border border-[var(--border)] bg-white/20 p-6 backdrop-blur-sm space-y-4">
              <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-violet-600/10 text-xs font-bold text-violet-400 border border-violet-500/20">
                    {step.step_number}
                  </span>
                  <h4 className="font-bold text-zinc-950">Step {step.step_number} Email</h4>
                </div>

                <div className="flex items-center gap-4">
                  {/* Send condition (vs previous email engagement) */}
                  {index > 0 && (
                    <select
                      value={step.condition || 'always'}
                      onChange={(e) => onUpdateStepField(index, 'condition', e.target.value)}
                      className="rounded border border-[var(--border)] bg-white px-2 py-1 text-xs text-zinc-700 focus:border-violet-500 focus:outline-none"
                      title="Send this step only when the condition on the previous email is met"
                    >
                      <option value="always">Always send</option>
                      <option value="not_opened">Only if NOT opened</option>
                      <option value="opened">Only if opened</option>
                      <option value="clicked">Only if link clicked</option>
                    </select>
                  )}

                  {/* Delay Days */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-zinc-600">Delay:</span>
                    <input
                      type="number"
                      min="0"
                      value={step.delay_days}
                      onChange={(e) => onUpdateStepField(index, 'delay_days', e.target.value)}
                      className="w-16 rounded border border-[var(--border)] bg-white px-2 py-0.5 text-center text-xs font-semibold text-zinc-900 focus:outline-none focus:border-violet-500"
                    />
                    <span className="text-xs text-zinc-600">days</span>
                  </div>

                  {/* Remove Step */}
                  <button
                    onClick={() => onRemoveStep(index)}
                    className="p-1 rounded text-zinc-500 hover:text-rose-400 hover:bg-rose-500/5 transition-colors cursor-pointer"
                    title="Delete Step"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Subject */}
              <div>
                <label className="block text-[10px] text-zinc-500 font-semibold uppercase tracking-wider">Subject Line</label>
                <input
                  type="text"
                  value={step.subject}
                  onChange={(e) => onUpdateStepField(index, 'subject', e.target.value)}
                  placeholder="E.g. Quick question"
                  className="mt-1 w-full rounded-lg border border-[var(--border)] bg-white py-2 px-3 text-sm text-zinc-900 focus:border-violet-500 focus:outline-none transition-colors"
                />
              </div>

              {/* Body */}
              <div>
                <label className="block text-[10px] text-zinc-500 font-semibold uppercase tracking-wider">Email Body (Plain/Markdown)</label>
                <textarea
                  rows={8}
                  value={step.body}
                  onChange={(e) => onUpdateStepField(index, 'body', e.target.value)}
                  placeholder="Write your email outreach template here..."
                  className="mt-1 w-full rounded-lg border border-[var(--border)] bg-white py-2.5 px-3 text-sm text-zinc-900 focus:border-violet-500 focus:outline-none transition-colors font-sans"
                />
              </div>

              {/* Formatting Variables Info */}
              <div className="flex flex-wrap gap-2 text-[10px] text-zinc-600 font-medium">
                <span>Placeholders:</span>
                <code className="text-violet-400 font-mono">{"{{first_name}}"}</code>
                <code className="text-violet-400 font-mono">{"{{last_name}}"}</code>
                <code className="text-violet-400 font-mono">{"{{company}}"}</code>
                <code className="text-violet-400 font-mono">{"{{ai_personalization}}"}</code>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
