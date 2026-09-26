'use client';

import { Bot } from 'lucide-react';

type AiMode = 'template_only' | 'basic_ai' | 'standard_ai' | 'deep_ai' | 'manual_only' | 'hybrid_smart';
type AiDepth = 'none' | 'basic' | 'standard' | 'deep';

const AI_MODES: { id: AiMode; title: string; desc: string }[] = [
  { id: 'hybrid_smart', title: 'Hybrid Smart', desc: 'Local scoring first, cache second, Gemini only for eligible leads.' },
  { id: 'basic_ai', title: 'Basic AI', desc: 'Flash Lite copy for low-cost personalization.' },
  { id: 'standard_ai', title: 'Standard AI', desc: 'Flash Lite with more context and website use.' },
  { id: 'deep_ai', title: 'Deep AI', desc: 'Use 2.5 Flash only on high-priority, strong-fit leads.' },
  { id: 'template_only', title: 'Template Only', desc: 'Never call Gemini. Use templates and local fallback copy only.' },
  { id: 'manual_only', title: 'Manual Only', desc: 'No automated AI generation. Drafts stay manual.' },
];

type Step3AiStrategyProps = {
  aiMode: AiMode;
  onAiModeChange: (mode: AiMode) => void;
  aiDepth: AiDepth;
  onAiDepthChange: (depth: AiDepth) => void;
  autoRunAiAfterImport: boolean;
  onAutoRunAiAfterImportChange: (value: boolean) => void;
  fetchWebsiteHomepage: boolean;
  onFetchWebsiteHomepageChange: (value: boolean) => void;
  requireApprovalBeforeSend: boolean;
  onRequireApprovalBeforeSendChange: (value: boolean) => void;
  allowRiskyEmails: boolean;
  onAllowRiskyEmailsChange: (value: boolean) => void;
  allowDeepAi: boolean;
  onAllowDeepAiChange: (value: boolean) => void;
  requireManualApprovalForDeepAi: boolean;
  onRequireManualApprovalForDeepAiChange: (value: boolean) => void;
  useTemplateFallback: boolean;
  onUseTemplateFallbackChange: (value: boolean) => void;
  minDataQualityForAi: string;
  onMinDataQualityForAiChange: (value: string) => void;
  fullAiMinSolutionScore: string;
  onFullAiMinSolutionScoreChange: (value: string) => void;
  onBack: () => void;
  onNext: () => void;
};

export default function Step3AiStrategy({
  aiMode,
  onAiModeChange,
  aiDepth,
  onAiDepthChange,
  autoRunAiAfterImport,
  onAutoRunAiAfterImportChange,
  fetchWebsiteHomepage,
  onFetchWebsiteHomepageChange,
  requireApprovalBeforeSend,
  onRequireApprovalBeforeSendChange,
  allowRiskyEmails,
  onAllowRiskyEmailsChange,
  allowDeepAi,
  onAllowDeepAiChange,
  requireManualApprovalForDeepAi,
  onRequireManualApprovalForDeepAiChange,
  useTemplateFallback,
  onUseTemplateFallbackChange,
  minDataQualityForAi,
  onMinDataQualityForAiChange,
  fullAiMinSolutionScore,
  onFullAiMinSolutionScoreChange,
  onBack,
  onNext,
}: Step3AiStrategyProps) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-white/20 p-6 backdrop-blur-sm space-y-6">
      <h3 className="font-bold text-zinc-950 text-md border-b border-[var(--border)] pb-3 flex items-center gap-2"><Bot className="h-5 w-5 text-violet-400" /> AI Strategy Configuration</h3>

      <div className="space-y-4">
        <div>
          <label className="block text-[10px] text-zinc-500 font-bold uppercase tracking-wider mb-2">AI Mode</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {AI_MODES.map((mode) => (
              <button
                key={mode.id}
                onClick={() => onAiModeChange(mode.id)}
                className={`p-4 rounded-xl border text-left flex flex-col justify-between cursor-pointer transition-all ${
                  aiMode === mode.id
                    ? 'bg-violet-600/10 border-violet-500 shadow-md shadow-violet-500/5'
                    : 'bg-white/20 border-[var(--border)] text-zinc-600 hover:bg-white/40'
                }`}
              >
                <span className="block text-xs font-bold text-zinc-950 mb-1">{mode.title}</span>
                <span className="block text-[10px] text-zinc-500 leading-relaxed">{mode.desc}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          <div className="rounded-xl border border-[var(--border)] bg-white/30 p-4 space-y-2">
            <label className="block text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Lead AI Depth</label>
            <select
              value={aiDepth}
              onChange={(e) => onAiDepthChange(e.target.value as AiDepth)}
              className="w-full rounded border border-[var(--border)] bg-white py-2 px-3 text-xs text-zinc-900 focus:border-violet-500 focus:outline-none"
            >
              <option value="none">None</option>
              <option value="basic">Basic</option>
              <option value="standard">Standard</option>
              <option value="deep">Deep</option>
            </select>
            <p className="text-[10px] text-zinc-500">Controls how much context the AI layer should include for each lead.</p>
          </div>

          <label className="flex items-start gap-3 p-4 bg-white/40 border border-[var(--border)] rounded-lg cursor-pointer">
            <input
              type="checkbox"
              checked={autoRunAiAfterImport}
              onChange={(e) => onAutoRunAiAfterImportChange(e.target.checked)}
              className="rounded border-[var(--border)] bg-white text-violet-500 focus:ring-0 mt-0.5"
            />
            <div>
              <span className="block text-xs font-semibold text-zinc-950">Auto-run AI after import</span>
              <span className="block text-[10px] text-zinc-500">Keep this off unless you explicitly want new imports queued for analysis.</span>
            </div>
          </label>

          <label className="flex items-start gap-3 p-4 bg-white/40 border border-[var(--border)] rounded-lg cursor-pointer">
            <input
              type="checkbox"
              checked={fetchWebsiteHomepage}
              onChange={(e) => onFetchWebsiteHomepageChange(e.target.checked)}
              className="rounded border-[var(--border)] bg-white text-violet-500 focus:ring-0 mt-0.5"
            />
            <div>
              <span className="block text-xs font-semibold text-zinc-950">Fetch Website Homepage</span>
              <span className="block text-[10px] text-zinc-500">Crawl website visible text when the lead qualifies for Gemini.</span>
            </div>
          </label>

          <label className="flex items-start gap-3 p-4 bg-white/40 border border-[var(--border)] rounded-lg cursor-pointer">
            <input
              type="checkbox"
              checked={requireApprovalBeforeSend}
              onChange={(e) => onRequireApprovalBeforeSendChange(e.target.checked)}
              className="rounded border-[var(--border)] bg-white text-violet-500 focus:ring-0 mt-0.5"
            />
            <div>
              <span className="block text-xs font-semibold text-zinc-950">Require Manual Approval</span>
              <span className="block text-[10px] text-zinc-500">Prevent cron from sending emails until drafts are manually approved.</span>
            </div>
          </label>

          <label className="flex items-start gap-3 p-4 bg-white/40 border border-[var(--border)] rounded-lg cursor-pointer">
            <input
              type="checkbox"
              checked={allowRiskyEmails}
              onChange={(e) => onAllowRiskyEmailsChange(e.target.checked)}
              className="rounded border-[var(--border)] bg-white text-violet-500 focus:ring-0 mt-0.5"
            />
            <div>
              <span className="block text-xs font-semibold text-zinc-950">Allow Risky Email Statuses</span>
              <span className="block text-[10px] text-zinc-500">When off, automation skips `not_checked`, `unknown`, `risky`, and failed-verification leads.</span>
            </div>
          </label>

          <label className="flex items-start gap-3 p-4 bg-white/40 border border-[var(--border)] rounded-lg cursor-pointer">
            <input
              type="checkbox"
              checked={allowDeepAi}
              onChange={(e) => onAllowDeepAiChange(e.target.checked)}
              className="rounded border-[var(--border)] bg-white text-violet-500 focus:ring-0 mt-0.5"
            />
            <div>
              <span className="block text-xs font-semibold text-zinc-950">Allow Deep AI</span>
              <span className="block text-[10px] text-zinc-500">Only use 2.5 Flash for deep personalization.</span>
            </div>
          </label>

          <label className="flex items-start gap-3 p-4 bg-white/40 border border-[var(--border)] rounded-lg cursor-pointer">
            <input
              type="checkbox"
              checked={requireManualApprovalForDeepAi}
              onChange={(e) => onRequireManualApprovalForDeepAiChange(e.target.checked)}
              className="rounded border-[var(--border)] bg-white text-violet-500 focus:ring-0 mt-0.5"
            />
            <div>
              <span className="block text-xs font-semibold text-zinc-950">Require Manual Approval for Deep AI</span>
              <span className="block text-[10px] text-zinc-500">Deep AI drafts need a human review before send.</span>
            </div>
          </label>

          <label className="flex items-start gap-3 p-4 bg-white/40 border border-[var(--border)] rounded-lg cursor-pointer">
            <input
              type="checkbox"
              checked={useTemplateFallback}
              onChange={(e) => onUseTemplateFallbackChange(e.target.checked)}
              className="rounded border-[var(--border)] bg-white text-violet-500 focus:ring-0 mt-0.5"
            />
            <div>
              <span className="block text-xs font-semibold text-zinc-950">Use Template Fallback</span>
              <span className="block text-[10px] text-zinc-500">Fallback to local templates instead of spending a credit when the lead is weak.</span>
            </div>
          </label>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          <div>
            <label className="block text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Minimum Data Quality for AI</label>
            <input
              type="number"
              min="0"
              max="100"
              value={minDataQualityForAi}
              onChange={(e) => onMinDataQualityForAiChange(e.target.value)}
              className="mt-1 w-full rounded border border-[var(--border)] bg-white py-2 px-3 text-xs text-zinc-900 focus:border-violet-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Full AI Minimum Solution Score</label>
            <input
              type="number"
              min="0"
              max="100"
              value={fullAiMinSolutionScore}
              onChange={(e) => onFullAiMinSolutionScoreChange(e.target.value)}
              className="mt-1 w-full rounded border border-[var(--border)] bg-white py-2 px-3 text-xs text-zinc-900 focus:border-violet-500 focus:outline-none"
            />
          </div>
        </div>
      </div>

      <div className="flex justify-between pt-4 border-t border-[var(--border)]">
        <button onClick={onBack} className="text-xs text-zinc-600 hover:text-zinc-950">Back</button>
        <button onClick={onNext} className="px-6 py-2 bg-gradient-to-r from-violet-600 to-teal-500 rounded-lg text-xs font-semibold text-white hover:opacity-90">Continue to Sequence</button>
      </div>
    </div>
  );
}
