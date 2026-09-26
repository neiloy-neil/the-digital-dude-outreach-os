'use client';

import Link from 'next/link';
import { ArrowUpRight, Sparkles, Users } from 'lucide-react';
import EmailVerificationBadge from '@/components/leads/EmailVerificationBadge';
import StatusBadge from '@/components/leads/StatusBadge';
import EmptyState from '@/components/reachmira/EmptyState';
import QualityScoreBadge from '@/components/reachmira/QualityScoreBadge';
import Spinner from '@/components/reachmira/Spinner';
import { Pagination } from '@/components/reachmira/ui';
import { getLeadReadiness } from '@/lib/leads/library';

type LeadRow = {
  id: string;
  email: string;
  first_name?: string | null;
  last_name?: string | null;
  decision_maker_name?: string | null;
  company_name?: string | null;
  company?: string | null;
  industry?: string | null;
  country?: string | null;
  pain_points?: string | null;
  tags?: string | null;
  lead_list_id?: string | null;
  lead_lists?: { name?: string | null } | null;
  status?: string | null;
  priority?: string | null;
  data_quality_label?: string | null;
  last_email_sent_at?: string | null;
  last_contacted_at?: string | null;
  last_contacted?: string | null;
  next_follow_up_at?: string | null;
  next_follow_up_date?: string | null;
  next_email_at?: string | null;
  emails_sent_count?: number | null;
  ai_status?: string | null;
  manual_personalization_status?: string | null;
  email_verification_status?: string | null;
  email_verification_reason?: string | null;
};

function ReadinessBadge({ readiness }: { readiness: string }) {
  const styles: Record<string, string> = {
    ready_to_send: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/10',
    needs_email_verification: 'bg-yellow-50 text-yellow-700 ring-1 ring-yellow-600/10',
    missing_pain_point: 'bg-orange-50 text-orange-700 ring-1 ring-orange-600/10',
    missing_solution_angle: 'bg-amber-50 text-amber-700 ring-1 ring-amber-600/10',
    needs_personalization: 'bg-violet-50 text-violet-700 ring-1 ring-violet-600/10',
    follow_up_due: 'bg-rose-50 text-rose-700 ring-1 ring-rose-600/10',
    already_contacted: 'bg-blue-50 text-blue-700 ring-1 ring-blue-600/10',
    do_not_contact: 'bg-zinc-100 text-zinc-700 ring-1 ring-zinc-600/10',
  };
  const labelMap: Record<string, string> = {
    ready_to_send: 'Ready to Send',
    needs_email_verification: 'Needs Verification',
    missing_pain_point: 'Missing Pain',
    missing_solution_angle: 'Missing Offer',
    needs_personalization: 'Needs Personalization',
    follow_up_due: 'Follow-up Due',
    already_contacted: 'Contacted',
    do_not_contact: 'Do Not Contact',
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold ${styles[readiness] || 'bg-zinc-50 text-zinc-600'}`}>
      {labelMap[readiness] || readiness}
    </span>
  );
}

type LeadsTableProps = {
  loading: boolean;
  leads: LeadRow[];
  visibleColumns: Record<string, boolean>;
  selected: string[];
  onToggleSelected: (leadId: string) => void;
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
};

export default function LeadsTable({
  loading,
  leads,
  visibleColumns,
  selected,
  onToggleSelected,
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
}: LeadsTableProps) {
  return (
    <section className="mt-6 rounded-3xl border border-[var(--border)] bg-white shadow-[0_12px_40px_rgba(15,23,42,0.04)]">
      {loading ? (
        <div className="flex h-64 items-center justify-center text-violet-500">
          <Spinner size={32} />
        </div>
      ) : leads.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Your lead library is empty"
          description="Import a CSV or Google Sheet to start personalizing outreach."
          actionLabel="Import Leads"
          actionHref="/leads/import"
          actionIcon={Sparkles}
        />
      ) : (
        <>
          <div className="hidden overflow-x-auto lg:block">
            <table className="w-full text-left text-sm table-auto">
              <thead className="sticky top-0 z-10 border-b border-[var(--border)] bg-white text-xs uppercase tracking-[0.18em] text-zinc-400">
                <tr>
                  <th className="w-10 px-4 py-4" />
                  {visibleColumns.company && <th className="px-4 py-4">Company</th>}
                  {visibleColumns.contact && <th className="px-4 py-4">Contact</th>}
                  {visibleColumns.email && <th className="px-4 py-4">Email</th>}
                  {visibleColumns.emailStatus && <th className="px-4 py-4">Email Status</th>}
                  {visibleColumns.industry && <th className="px-4 py-4">Industry</th>}
                  {visibleColumns.painPoint && <th className="px-4 py-4">Pain Point</th>}
                  {visibleColumns.priority && <th className="px-4 py-4">Priority</th>}
                  {visibleColumns.dataQuality && <th className="px-4 py-4">Data Quality</th>}
                  {visibleColumns.aiStatus && <th className="px-4 py-4">AI Status</th>}
                  {visibleColumns.readiness && <th className="px-4 py-4">Readiness</th>}
                  {visibleColumns.status && <th className="px-4 py-4">Status</th>}
                  {visibleColumns.lastContacted && <th className="px-4 py-4">Last Contacted</th>}
                  {visibleColumns.nextFollowUp && <th className="px-4 py-4">Next Follow-up</th>}
                  <th className="px-4 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {leads.map((lead) => (
                  <tr key={lead.id} className="transition hover:bg-violet-50/50">
                    <td className="px-4 py-4">
                      <input type="checkbox" checked={selected.includes(lead.id)} onChange={() => onToggleSelected(lead.id)} className="h-4 w-4 rounded border-zinc-300 text-violet-600 focus:ring-violet-500" />
                    </td>
                    {visibleColumns.company && (
                      <td className="px-4 py-4">
                        <div className="truncate font-semibold text-zinc-950 max-w-[200px]" title={lead.company_name || lead.company || ''}>
                          {lead.company_name || lead.company || '-'}
                        </div>
                      </td>
                    )}
                    {visibleColumns.contact && (
                      <td className="px-4 py-4">
                        <Link
                          href={`/leads/${lead.id}`}
                          className="block truncate font-semibold text-violet-700 transition hover:text-violet-800 hover:underline max-w-[150px]"
                          title="Open lead profile"
                        >
                          {lead.decision_maker_name || `${lead.first_name || ''} ${lead.last_name || ''}`.trim() || 'Prospect'}
                        </Link>
                      </td>
                    )}
                    {visibleColumns.email && (
                      <td className="px-4 py-4 text-zinc-600">
                        <div className="truncate max-w-[200px]" title={lead.email}>{lead.email}</div>
                      </td>
                    )}
                    {visibleColumns.emailStatus && (
                      <td className="px-4 py-4">
                        <EmailVerificationBadge status={lead.email_verification_status} />
                      </td>
                    )}
                    {visibleColumns.industry && (
                      <td className="px-4 py-4 text-zinc-600">
                        <div className="truncate max-w-[150px]">{lead.industry || lead.lead_lists?.name || '-'}</div>
                      </td>
                    )}
                    {visibleColumns.painPoint && (
                      <td className="max-w-[220px] px-4 py-4 text-zinc-600">
                        <div className="line-clamp-2">{lead.pain_points || '-'}</div>
                      </td>
                    )}
                    {visibleColumns.priority && (
                      <td className="px-4 py-4 text-zinc-600 capitalize">{lead.priority || '-'}</td>
                    )}
                    {visibleColumns.dataQuality && (
                      <td className="px-4 py-4">
                        <QualityScoreBadge score={lead.data_quality_label === 'excellent' ? 95 : lead.data_quality_label === 'good' ? 75 : lead.data_quality_label === 'fair' ? 55 : 35} label={lead.data_quality_label || 'Data quality'} />
                      </td>
                    )}
                    {visibleColumns.aiStatus && (
                      <td className="px-4 py-4 text-zinc-600 capitalize">{lead.ai_status || '-'}</td>
                    )}
                    {visibleColumns.readiness && (
                      <td className="px-4 py-4">
                        <ReadinessBadge readiness={getLeadReadiness(lead as Parameters<typeof getLeadReadiness>[0])} />
                      </td>
                    )}
                    {visibleColumns.status && (
                      <td className="px-4 py-4">
                        <StatusBadge status={lead.status} />
                      </td>
                    )}
                    {visibleColumns.lastContacted && (
                      <td className="px-4 py-4 text-zinc-600">
                        {lead.last_email_sent_at || lead.last_contacted_at || lead.last_contacted ? new Date(lead.last_email_sent_at || lead.last_contacted_at || lead.last_contacted || '').toLocaleDateString() : '-'}
                      </td>
                    )}
                    {visibleColumns.nextFollowUp && (
                      <td className="px-4 py-4 text-zinc-600">
                        {lead.next_follow_up_at || lead.next_follow_up_date || lead.next_email_at ? new Date(lead.next_follow_up_at || lead.next_follow_up_date || lead.next_email_at || '').toLocaleDateString() : '-'}
                      </td>
                    )}
                    <td className="px-4 py-4 text-right">
                      <Link href={`/leads/${lead.id}`} className="inline-flex items-center gap-1 font-semibold text-violet-700 hover:text-violet-800">
                        View <ArrowUpRight className="h-4 w-4" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid gap-4 p-4 sm:grid-cols-2 lg:hidden">
            {leads.map((lead) => (
              <div key={lead.id} className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)]/60 p-4 shadow-[0_8px_24px_rgba(15,23,42,0.03)]">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold text-zinc-950">{lead.company_name || lead.company || '-'}</div>
                    <Link href={`/leads/${lead.id}`} className="text-sm font-semibold text-violet-700 hover:text-violet-800 hover:underline">
                      {lead.decision_maker_name || `${lead.first_name || ''} ${lead.last_name || ''}`.trim() || 'Prospect'}
                    </Link>
                  </div>
                  <input type="checkbox" checked={selected.includes(lead.id)} onChange={() => onToggleSelected(lead.id)} className="mt-1 h-4 w-4 rounded border-zinc-300 text-violet-600" />
                </div>
                <div className="mt-3 grid gap-2 text-sm text-zinc-600">
                  <div><span className="font-medium text-zinc-900">Email:</span> {lead.email}</div>
                  <div className="flex flex-wrap items-center gap-2"><span className="font-medium text-zinc-900">Email Status:</span> <EmailVerificationBadge status={lead.email_verification_status} /></div>
                  <div><span className="font-medium text-zinc-900">Industry:</span> {lead.industry || '-'}</div>
                  <div><span className="font-medium text-zinc-900">Pain:</span> {lead.pain_points || '-'}</div>
                  <div><span className="font-medium text-zinc-900">AI:</span> {lead.ai_status || '-'}</div>
                  <div><span className="font-medium text-zinc-900">Last:</span> {lead.last_email_sent_at || lead.last_contacted_at || lead.last_contacted ? new Date(lead.last_email_sent_at || lead.last_contacted_at || lead.last_contacted || '').toLocaleDateString() : '-'}</div>
                  <div><span className="font-medium text-zinc-900">Next:</span> {lead.next_follow_up_at || lead.next_follow_up_date || lead.next_email_at ? new Date(lead.next_follow_up_at || lead.next_follow_up_date || lead.next_email_at || '').toLocaleDateString() : '-'}</div>
                  <div className="flex flex-wrap items-center gap-2"><span className="font-medium text-zinc-900">Status:</span> <StatusBadge status={lead.status} /></div>
                  <div className="flex flex-wrap items-center gap-2"><span className="font-medium text-zinc-900">Quality:</span> <QualityScoreBadge score={lead.data_quality_label === 'excellent' ? 95 : lead.data_quality_label === 'good' ? 75 : lead.data_quality_label === 'fair' ? 55 : 35} label={lead.data_quality_label || 'Data quality'} /></div>
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <Link href={`/leads/${lead.id}`} className="inline-flex items-center gap-2 rounded-xl bg-zinc-950 px-4 py-2.5 text-sm font-semibold text-white">
                    View lead
                  </Link>
                  <Link href={`/leads/${lead.id}`} className="text-sm font-semibold text-violet-700">
                    Open
                  </Link>
                </div>
              </div>
            ))}
          </div>

          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={totalItems}
            pageSize={pageSize}
            onPageChange={onPageChange}
          />
        </>
      )}
    </section>
  );
}
