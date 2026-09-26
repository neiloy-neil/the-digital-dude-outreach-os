'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

const STEPS: [number, string][] = [
  [1, 'Basics'],
  [2, 'Leads'],
  [3, 'AI Strategy'],
  [4, 'Sequence'],
  [5, 'Review'],
];

const STEP_TITLES: Record<number, string> = {
  1: 'Configure Basics',
  2: 'Import Prospect Leads',
  3: 'AI Strategy Setup',
  4: 'Sequence Templates',
  5: 'Final Review & Creation',
};

type WizardHeaderProps = {
  currentStep: number;
  onStepChange: (step: number) => void;
};

export default function WizardHeader({ currentStep, onStepChange }: WizardHeaderProps) {
  return (
    <>
      <div className="flex items-center gap-3 mb-6">
        <Link href="/campaigns" className="p-2 bg-white border border-[var(--border)] rounded-lg text-zinc-600 hover:text-violet-700 transition-all">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h2 className="text-2xl font-bold text-zinc-950 tracking-tight">Campaign Creation Wizard</h2>
          <p className="text-xs text-zinc-600">Step {currentStep} of 5 — {STEP_TITLES[currentStep] || ''}</p>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-5 gap-2">
        {STEPS.map(([step, label]) => {
          const isDone = step < currentStep;
          const isActive = step === currentStep;
          return (
            <button
              key={step}
              type="button"
              onClick={() => isDone && onStepChange(step)}
              disabled={!isDone && !isActive}
              aria-current={isActive ? 'step' : undefined}
              className={`group flex flex-col gap-1.5 rounded-xl px-1 py-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40 ${isDone ? 'cursor-pointer' : ''}`}
              title={isDone ? `Back to ${label}` : label}
            >
              <span
                className={`h-2 w-full rounded-full transition-all ${
                  isActive ? 'bg-violet-500 shadow-md shadow-violet-500/25' : isDone ? 'bg-violet-800 group-hover:bg-violet-600' : 'bg-[var(--surface-muted)]'
                }`}
              />
              <span className={`hidden text-[11px] font-semibold sm:block ${isActive ? 'text-violet-700' : isDone ? 'text-zinc-600' : 'text-zinc-400'}`}>
                {step}. {label}
              </span>
            </button>
          );
        })}
      </div>
    </>
  );
}
