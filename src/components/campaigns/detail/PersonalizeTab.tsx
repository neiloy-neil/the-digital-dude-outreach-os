'use client';

import Link from 'next/link';
import { Sparkles } from 'lucide-react';
import CampaignPagination from '@/components/campaigns/detail/CampaignPagination';

type PersonalizeTabProps = {
  campaignId: string;
  promptInstructions: string;
  onPromptInstructionsChange: (value: string) => void;
  onRunAIPersonalization: () => void;
  personalizing: boolean;
  personalizeProgress: string;
  paginatedPersonalizationLeads: any[];
  totalLeadsCount: number;
  personalizationPage: number;
  personalizationTotalPages: number;
  pageSize: number;
  onPersonalizationPageChange: (page: number) => void;
};

export default function PersonalizeTab({
  campaignId,
  promptInstructions,
  onPromptInstructionsChange,
  onRunAIPersonalization,
  personalizing,
  personalizeProgress,
  paginatedPersonalizationLeads,
  totalLeadsCount,
  personalizationPage,
  personalizationTotalPages,
  pageSize,
  onPersonalizationPageChange,
}: PersonalizeTabProps) {
  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-[var(--border)] bg-white/20 p-6 backdrop-blur-sm space-y-4">
        <div>
          <h3 className="font-bold text-zinc-950 text-md">Gemini AI Personalization Prompt</h3>
          <p className="text-xs text-zinc-600">Configure instructions for the AI to personalize an introduction sentence for each prospect before emails are sent.</p>
        </div>

        <div>
          <label className="block text-xs text-zinc-600 font-semibold uppercase">AI Instruction Template</label>
          <textarea
            rows={4}
            value={promptInstructions}
            onChange={(e) => onPromptInstructionsChange(e.target.value)}
            className="mt-1 w-full rounded-lg border border-[var(--border)] bg-white py-2.5 px-3 text-sm text-zinc-900 focus:border-violet-500 focus:outline-none transition-colors font-sans"
          />
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onRunAIPersonalization}
            disabled={personalizing}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-violet-600 to-teal-500 rounded-lg text-xs font-semibold text-white hover:opacity-90 shadow-lg shadow-violet-600/20 disabled:opacity-50 cursor-pointer"
          >
            <Sparkles className="h-4 w-4" /> Run Gemini AI Personalization
          </button>
          <Link
            href={`/campaigns/${campaignId}/personalization`}
            className="px-5 py-2.5 bg-white border border-[var(--border)] hover:bg-violet-50 rounded-lg text-xs font-semibold text-zinc-700 hover:text-violet-700 transition-all shadow-md"
          >
            Go to Personalization Review Dashboard &rarr;
          </Link>
          {personalizeProgress && (
            <span className="text-xs text-violet-400 font-medium animate-pulse">{personalizeProgress}</span>
          )}
        </div>

        <div className="text-[11px] text-zinc-500 border-t border-[var(--border)] pt-4">
          <strong>Note:</strong> This runs only for leads currently in <code className="font-mono">imported</code> status who do not yet have an generated AI introduction. It calls Gemini <code className="font-mono">gemini-2.5-flash</code>. Ensure your Gemini API Key is saved in Settings first.
        </div>
      </div>

      {/* Preview Personalizations */}
      <div className="rounded-xl border border-[var(--border)] bg-white/20 p-6 backdrop-blur-sm">
        <h3 className="font-bold text-zinc-950 mb-4 text-md">AI Personalization Previews</h3>
        <div className="overflow-x-auto max-h-80">
          <table className="w-full text-left text-sm text-zinc-600">
            <thead className="text-xs font-semibold uppercase text-zinc-500 border-b border-[var(--border)] bg-white/30">
              <tr>
                <th className="py-2.5 px-4">Prospect</th>
                <th className="py-2.5 px-4">Company</th>
                <th className="py-2.5 px-4">Generated Personalization</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {paginatedPersonalizationLeads.map((lead) => (
                <tr key={lead.id} className="hover:bg-white/20">
                  <td className="py-3 px-4">
                    <Link
                      href={`/campaigns/${campaignId}/leads/${lead.id}`}
                      className="font-semibold text-violet-700 transition hover:text-violet-800 hover:underline"
                      title="Open lead profile"
                    >
                      {lead.first_name || lead.email}
                    </Link>
                  </td>
                  <td className="py-3 px-4 text-zinc-700">{lead.company || '-'}</td>
                  <td className="py-3 px-4 text-xs italic text-violet-300">
                    {lead.ai_personalization || <span className="text-zinc-600">No personalization generated yet.</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <CampaignPagination
            currentPage={personalizationPage}
            totalPages={personalizationTotalPages}
            totalItems={totalLeadsCount}
            pageSize={pageSize}
            onPageChange={onPersonalizationPageChange}
          />
        </div>
      </div>
    </div>
  );
}
