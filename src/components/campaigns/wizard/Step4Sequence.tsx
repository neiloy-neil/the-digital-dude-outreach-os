'use client';

import { Trash2 } from 'lucide-react';
import type { SequenceStep } from '@/hooks/useSequenceSteps';

type TemplateOption = {
  id: string;
  name: string;
  category?: string | null;
  subject: string;
  body?: string | null;
};

type Step4SequenceProps = {
  sequences: SequenceStep[];
  templateOptions: TemplateOption[];
  onAddStep: () => void;
  onUpdateStepField: (index: number, field: string, value: any) => void;
  onRemoveStep: (index: number) => void;
  onInsertTemplateIntoSequence: (index: number, templateId: string) => void;
  onBack: () => void;
  onNext: () => void;
};

export default function Step4Sequence({
  sequences,
  templateOptions,
  onAddStep,
  onUpdateStepField,
  onRemoveStep,
  onInsertTemplateIntoSequence,
  onBack,
  onNext,
}: Step4SequenceProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-bold text-zinc-950 text-md">Email Follow-up Sequence</h3>
          <p className="text-xs text-zinc-600">Add follow-up templates. Step 1 can be upgraded by Gemini only when the selected AI mode allows it.</p>
        </div>
        <button
          onClick={onAddStep}
          className="px-3 py-1.5 border border-[var(--border)] hover:bg-violet-50 rounded-lg text-xs font-semibold text-zinc-700 cursor-pointer"
        >
          Add Follow-up Step
        </button>
      </div>

      <div className="space-y-4">
        {sequences.map((step, idx) => (
          <div key={idx} className="rounded-xl border border-[var(--border)] bg-white/20 p-6 backdrop-blur-sm space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
              <span className="text-xs font-bold text-violet-400">Step {step.step_number} {idx === 0 ? '(First Contact)' : `(Follow-up)`}</span>
              <div className="flex items-center gap-4">
                {idx > 0 && (
                  <select
                    value={step.condition || 'always'}
                    onChange={(e) => onUpdateStepField(idx, 'condition', e.target.value)}
                    className="rounded border border-[var(--border)] bg-white px-2 py-1 text-xs text-zinc-700 focus:border-violet-500 focus:outline-none"
                    title="Send this step only when the condition on the previous email is met"
                  >
                    <option value="always">Always send</option>
                    <option value="not_opened">Only if NOT opened</option>
                    <option value="opened">Only if opened</option>
                    <option value="clicked">Only if link clicked</option>
                  </select>
                )}
                {idx > 0 && (
                  <div className="flex items-center gap-1.5 text-xs text-zinc-600">
                    <span>Delay:</span>
                    <input
                      type="number"
                      min="1"
                      value={step.delay_days}
                      onChange={(e) => onUpdateStepField(idx, 'delay_days', e.target.value)}
                      className="w-12 border border-[var(--border)] bg-white text-center rounded text-xs font-semibold text-zinc-900"
                    />
                    <span>days</span>
                  </div>
                )}
                {idx > 0 && (
                  <button onClick={() => onRemoveStep(idx)} className="text-zinc-500 hover:text-rose-400"><Trash2 className="h-4 w-4" /></button>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-violet-100 bg-violet-50/70 p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
                <div className="flex-1">
                  <label className="block text-[10px] text-violet-700 font-bold uppercase tracking-wider">Use Saved Template</label>
                  <select
                    value={(step as any).template_id || ''}
                    onChange={(e) => onInsertTemplateIntoSequence(idx, e.target.value)}
                    className="mt-1 w-full rounded-xl border border-violet-100 bg-white py-2.5 px-3 text-xs text-zinc-900 focus:border-violet-500 focus:outline-none"
                  >
                    <option value="">Select a template to fill this step</option>
                    {templateOptions.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.name}{template.category ? ` - ${template.category}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="text-xs leading-relaxed text-violet-700 lg:max-w-sm">
                  Templates copy their saved subject and body into this sequence step. You can still edit the copy after inserting.
                </div>
              </div>
              {templateOptions.length === 0 && (
                <p className="mt-3 text-xs text-violet-700">
                  No saved templates yet. Create one from Templates, or keep writing this sequence manually.
                </p>
              )}
            </div>

            <div>
              <label className="block text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Subject Line</label>
              <input
                type="text"
                value={step.subject}
                onChange={(e) => onUpdateStepField(idx, 'subject', e.target.value)}
                placeholder="Subject Line"
                className="mt-1 w-full rounded border border-[var(--border)] bg-white py-2 px-3 text-xs text-zinc-900 focus:border-violet-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Email Body</label>
              <textarea
                rows={5}
                value={step.body}
                onChange={(e) => onUpdateStepField(idx, 'body', e.target.value)}
                placeholder="Hi {{first_name}}..."
                className="mt-1 w-full rounded border border-[var(--border)] bg-white p-2.5 text-xs text-zinc-900 focus:border-violet-500 focus:outline-none font-sans"
              />
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-between pt-4">
        <button onClick={onBack} className="text-xs text-zinc-600 hover:text-zinc-950">Back</button>
        <button onClick={onNext} className="px-6 py-2 bg-gradient-to-r from-violet-600 to-teal-500 rounded-lg text-xs font-semibold text-white hover:opacity-90">Review Details</button>
      </div>
    </div>
  );
}
