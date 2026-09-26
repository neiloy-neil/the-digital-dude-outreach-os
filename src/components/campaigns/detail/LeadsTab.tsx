'use client';

import Link from 'next/link';
import { UserPlus } from 'lucide-react';
import CampaignPagination from '@/components/campaigns/detail/CampaignPagination';

type LeadsTabProps = {
  campaignId: string;
  leads: any[];
  paginatedLeads: any[];
  leadsPage: number;
  leadTotalPages: number;
  pageSize: number;
  onLeadsPageChange: (page: number) => void;
  onRequestClearLeads: () => void;
};

export default function LeadsTab({
  campaignId,
  leads,
  paginatedLeads,
  leadsPage,
  leadTotalPages,
  pageSize,
  onLeadsPageChange,
  onRequestClearLeads,
}: LeadsTabProps) {
  return (
    <div className="space-y-4">
      {/* Upload & Google Sheets / CSV Help Panel Banner */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-6 rounded-xl border border-[var(--border)] bg-white/20 p-6 backdrop-blur-sm">
        <div>
          <h3 className="font-bold text-zinc-950 text-md">Campaign Prospects & Leads</h3>
          <p className="text-xs text-zinc-600">Import your leads from a local CSV spreadsheet or a public Google Sheet URL using our advanced column mapper.</p>
        </div>
        <div className="flex items-center gap-3">
          {leads.length > 0 && (
            <button
              onClick={onRequestClearLeads}
              className="px-4 py-2 bg-rose-500/5 border border-rose-500/10 hover:bg-rose-500/10 text-rose-400 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
            >
              Clear Leads
            </button>
          )}
          <Link
            href={`/campaigns/${campaignId}/leads/import`}
            className="px-5 py-2 bg-gradient-to-r from-violet-600 to-teal-500 hover:opacity-90 rounded-lg text-xs font-semibold text-white shadow-lg shadow-violet-500/10 transition-opacity whitespace-nowrap"
          >
            Import Leads Wizard &rarr;
          </Link>
        </div>
      </div>

      {/* Leads Table */}
      <div className="rounded-xl border border-[var(--border)] bg-white/20 p-6 backdrop-blur-sm">
        <h3 className="font-bold text-zinc-950 mb-4 text-md">Leads ({leads.length})</h3>
        {leads.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-zinc-500">
            <UserPlus className="h-10 w-10 text-zinc-700 mb-2" />
            <p className="text-sm font-medium">No leads added to this campaign yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto max-h-96">
            <table className="w-full text-left text-sm text-zinc-600">
              <thead className="text-xs font-semibold uppercase text-zinc-500 border-b border-[var(--border)] bg-white/30 sticky top-0">
                <tr>
                  <th className="py-2.5 px-4">Name</th>
                  <th className="py-2.5 px-4">Email</th>
                  <th className="py-2.5 px-4">Company</th>
                  <th className="py-2.5 px-4">AI Intro</th>
                  <th className="py-2.5 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {paginatedLeads.map((lead) => (
                  <tr key={lead.id} className="hover:bg-white/20">
                    <td className="py-3 px-4 text-zinc-900 font-medium">
                      <Link href={`/campaigns/${campaignId}/leads/${lead.id}`} className="text-violet-400 hover:underline">
                        {lead.decision_maker_name || lead.first_name || lead.last_name
                          ? `${lead.first_name || ''} ${lead.last_name || ''}`.trim() || lead.decision_maker_name
                          : lead.email.split('@')[0]}
                      </Link>
                    </td>
                    <td className="py-3 px-4 font-mono text-xs text-zinc-700">{lead.email}</td>
                    <td className="py-3 px-4 text-zinc-700">{lead.company_name || lead.company || '-'}</td>
                    <td className="py-3 px-4 text-xs italic max-w-xs truncate text-violet-300" title={lead.ai_personalized_first_line || lead.ai_personalization}>
                      {lead.ai_personalized_first_line || lead.ai_personalization || 'Not generated'}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase border ${
                        lead.status === 'replied'
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                          : lead.status === 'sending' || lead.status === 'sent'
                          ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                          : lead.status === 'unsubscribed' || lead.status === 'bounced' || lead.status === 'complained'
                          ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                          : 'bg-[var(--surface-muted)] text-zinc-600 border-zinc-700'
                      }`}>
                        {lead.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <CampaignPagination
              currentPage={leadsPage}
              totalPages={leadTotalPages}
              totalItems={leads.length}
              pageSize={pageSize}
              onPageChange={onLeadsPageChange}
            />
          </div>
        )}
      </div>
    </div>
  );
}
