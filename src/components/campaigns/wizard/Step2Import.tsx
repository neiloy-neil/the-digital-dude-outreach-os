'use client';

import { Upload, FileSpreadsheet, Users } from 'lucide-react';
import { Banner } from '@/components/reachmira/ui';

const DESTINATION_FIELDS = [
  { key: 'email', label: 'Email Address (Required)', aliases: ['email', 'email address', 'email_address', 'mail'] },
  { key: 'first_name', label: 'First Name', aliases: ['first_name', 'first name', 'firstname', 'first'] },
  { key: 'last_name', label: 'Last Name', aliases: ['last_name', 'last name', 'lastname', 'last'] },
  { key: 'company_name', label: 'Company Name', aliases: ['company_name', 'company name', 'company', 'org', 'organization', 'firm'] },
  { key: 'website', label: 'Website URL', aliases: ['website', 'web', 'site', 'url'] },
  { key: 'industry', label: 'Industry', aliases: ['industry', 'sector'] },
  { key: 'sub_industry', label: 'Sub-Industry', aliases: ['sub_industry', 'sub industry', 'subsector'] },
  { key: 'country', label: 'Country', aliases: ['country', 'nation'] },
  { key: 'city', label: 'City', aliases: ['city', 'town', 'location'] },
  { key: 'company_size', label: 'Company Size', aliases: ['company_size', 'company size', 'size', 'employees'] },
  { key: 'estimated_revenue', label: 'Estimated Revenue', aliases: ['estimated_revenue', 'estimated revenue', 'revenue', 'rev'] },
  { key: 'decision_maker_name', label: 'Decision Maker Name', aliases: ['decision_maker_name', 'decision maker name', 'contact name', 'contact', 'name', 'full name', 'fullname', 'full_name'] },
  { key: 'decision_maker_title', label: 'Decision Maker Title', aliases: ['decision_maker_title', 'decision maker title', 'title', 'role', 'position'] },
  { key: 'linkedin_url', label: 'LinkedIn URL', aliases: ['linkedin_url', 'linkedin url', 'linkedin'] },
  { key: 'tech_stack', label: 'Tech Stack', aliases: ['tech_stack', 'tech stack', 'technologies', 'tech'] },
  { key: 'pain_points', label: 'Pain Points / Trigger', aliases: ['pain_points', 'pain points', 'pains', 'trigger', 'pain points / trigger', 'trigger event'] },
  { key: 'solution', label: 'Solution / Offer', aliases: ['solution', 'our solution', 'proposed solution', 'recommended solution', 'offer solution'] },
  { key: 'solution_score', label: 'Solution Score (0-100)', aliases: ['solution_score', 'solution score'] },
  { key: 'solution_fit_score', label: 'Solution Fit Score (0-100)', aliases: ['solution_fit_score', 'solution fit score'] },
  { key: 'lead_source', label: 'Lead Source', aliases: ['lead_source', 'lead source', 'source'] },
  { key: 'qc_by', label: 'QC BY', aliases: ['qc_by', 'qc by', 'qc'] },
  { key: 'outreach_channel', label: 'Outreach Channel', aliases: ['outreach_channel', 'outreach channel', 'channel'] },
  { key: 'outreach_status', label: 'Outreach Status', aliases: ['outreach_status', 'outreach status', 'outreach'] },
  { key: 'priority', label: 'Priority', aliases: ['priority', 'lead priority'] },
  { key: 'assigned_to', label: 'Assigned To', aliases: ['assigned_to', 'assigned to', 'assignee'] },
  { key: 'tags', label: 'Tags', aliases: ['tags', 'tag'] },
  { key: 'notes', label: 'Notes', aliases: ['notes', 'note', 'comment'] }
];

export { DESTINATION_FIELDS };

type ImportTab = 'library' | 'csv' | 'sheet';

type Step2ImportProps = {
  importTab: ImportTab;
  onImportTabChange: (tab: ImportTab) => void;

  // Library tab
  selectedLibraryLeadIds: string[];
  librarySearch: string;
  onLibrarySearchChange: (value: string) => void;
  loadingLibraryLeads: boolean;
  paginatedLibraryLeads: any[];
  onToggleLibraryLead: (leadId: string) => void;
  onToggleAllVisibleLibraryLeads: () => void;
  totalLibraryLeads: number;
  libraryPageSize: number;
  safeLibraryPage: number;
  libraryTotalPages: number;
  onLibraryPageChange: (updater: (page: number) => number) => void;

  // CSV tab
  onCSVUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;

  // Sheet tab
  googleSheetUrl: string;
  onGoogleSheetUrlChange: (value: string) => void;
  onSheetPreview: (e: React.FormEvent) => void;

  // Shared preview/mapping state
  loadingPreview: boolean;
  previewError: string | null;
  headers: string[];
  rows: any[][];
  mappings: Record<string, string>;
  onMappingsChange: (mappings: Record<string, string>) => void;
  onResetPreview: () => void;
  onMapAndRegisterLeads: () => void;

  onBack: () => void;
  onNext: () => void;
};

export default function Step2Import({
  importTab,
  onImportTabChange,
  selectedLibraryLeadIds,
  librarySearch,
  onLibrarySearchChange,
  loadingLibraryLeads,
  paginatedLibraryLeads,
  onToggleLibraryLead,
  onToggleAllVisibleLibraryLeads,
  totalLibraryLeads,
  libraryPageSize,
  safeLibraryPage,
  libraryTotalPages,
  onLibraryPageChange,
  onCSVUpload,
  googleSheetUrl,
  onGoogleSheetUrlChange,
  onSheetPreview,
  loadingPreview,
  previewError,
  headers,
  rows,
  mappings,
  onMappingsChange,
  onResetPreview,
  onMapAndRegisterLeads,
  onBack,
  onNext,
}: Step2ImportProps) {
  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-[var(--border)] bg-white/20 p-6 backdrop-blur-sm space-y-4">
        <div className="flex border-b border-[var(--border)] gap-6 mb-4">
          <button
            onClick={() => onImportTabChange('library')}
            className={`pb-3 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
              importTab === 'library' ? 'border-violet-500 text-violet-700' : 'border-transparent text-zinc-600 hover:text-zinc-900'
            }`}
          >
            <Users className="h-4 w-4" /> Lead Library
          </button>
          <button
            onClick={() => onImportTabChange('csv')}
            className={`pb-3 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
              importTab === 'csv' ? 'border-violet-500 text-violet-700' : 'border-transparent text-zinc-600 hover:text-zinc-900'
            }`}
          >
            <Upload className="h-4 w-4" /> Upload CSV
          </button>
          <button
            onClick={() => onImportTabChange('sheet')}
            className={`pb-3 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
              importTab === 'sheet' ? 'border-violet-500 text-violet-700' : 'border-transparent text-zinc-600 hover:text-zinc-900'
            }`}
          >
            <FileSpreadsheet className="h-4 w-4" /> Google Sheets
          </button>
        </div>

        {importTab === 'library' && (
          <div className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h3 className="text-sm font-bold text-zinc-950">Select Existing Lead Library Prospects</h3>
                <p className="text-xs text-zinc-500">Attach saved ReachMira leads to this campaign during setup.</p>
              </div>
              <div className="rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700">
                {selectedLibraryLeadIds.length} selected
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                value={librarySearch}
                onChange={(e) => onLibrarySearchChange(e.target.value)}
                placeholder="Search by email, company, industry..."
                className="w-full rounded-xl border border-[var(--border)] bg-white px-4 py-2.5 text-xs text-zinc-900 outline-none focus:border-violet-400"
              />
              <button
                onClick={onToggleAllVisibleLibraryLeads}
                disabled={paginatedLibraryLeads.length === 0}
                className="rounded-xl border border-[var(--border)] bg-white px-4 py-2.5 text-xs font-semibold text-zinc-700 hover:bg-violet-50 disabled:opacity-50"
              >
                Toggle visible
              </button>
            </div>

            {loadingLibraryLeads ? (
              <div className="rounded-2xl border border-[var(--border)] bg-white/60 p-8 text-center text-xs text-zinc-500">
                Loading lead library...
              </div>
            ) : paginatedLibraryLeads.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[var(--border)] bg-white/60 p-8 text-center">
                <Users className="mx-auto mb-2 h-8 w-8 text-zinc-300" />
                <p className="text-sm font-semibold text-zinc-700">No library leads found</p>
                <p className="mt-1 text-xs text-zinc-500">Import leads into the Lead Library first, or use CSV/Google Sheets for this campaign.</p>
              </div>
            ) : (
              <div className="max-h-96 overflow-y-auto rounded-2xl border border-[var(--border)] bg-white">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-violet-50 text-[10px] font-bold uppercase tracking-[0.18em] text-violet-700">
                    <tr>
                      <th className="px-4 py-3">Select</th>
                      <th className="px-4 py-3">Lead</th>
                      <th className="px-4 py-3">Company</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Quality</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {paginatedLibraryLeads.map((lead) => {
                      const selected = selectedLibraryLeadIds.includes(lead.id);
                      return (
                        <tr key={lead.id} className={selected ? 'bg-violet-50/70' : 'hover:bg-zinc-50'}>
                          <td className="px-4 py-3">
                            <input
                              type="checkbox"
                              checked={selected}
                              onChange={() => onToggleLibraryLead(lead.id)}
                              className="rounded border-zinc-300 text-violet-600 focus:ring-violet-500"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-semibold text-zinc-950">
                              {lead.first_name || lead.last_name
                                ? `${lead.first_name || ''} ${lead.last_name || ''}`.trim()
                                : lead.decision_maker_name || lead.email}
                            </div>
                            <div className="font-mono text-[11px] text-zinc-500">{lead.email}</div>
                          </td>
                          <td className="px-4 py-3 text-zinc-700">
                            <div>{lead.company_name || lead.company || '-'}</div>
                            <div className="text-[11px] text-zinc-500">{lead.industry || 'General'}</div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2 py-1 text-[10px] font-semibold uppercase text-zinc-600">
                              {lead.status || 'new'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-zinc-600">
                            {lead.data_quality_label || 'unknown'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {totalLibraryLeads > libraryPageSize && (
              <div className="flex flex-col gap-3 border-t border-[var(--border)] pt-4 text-xs text-zinc-500 sm:flex-row sm:items-center sm:justify-between">
                <span>
                  Showing {totalLibraryLeads === 0 ? 0 : (safeLibraryPage - 1) * libraryPageSize + 1}-{Math.min(safeLibraryPage * libraryPageSize, totalLibraryLeads)} of {totalLibraryLeads} library leads
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onLibraryPageChange((page) => Math.max(1, page - 1))}
                    disabled={safeLibraryPage <= 1}
                    className="rounded-lg border border-[var(--border)] bg-white px-3 py-1.5 font-semibold text-zinc-700 transition hover:bg-violet-50 disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <span className="font-semibold text-zinc-700">Page {safeLibraryPage} / {libraryTotalPages}</span>
                  <button
                    onClick={() => onLibraryPageChange((page) => Math.min(libraryTotalPages, page + 1))}
                    disabled={safeLibraryPage >= libraryTotalPages}
                    className="rounded-lg border border-[var(--border)] bg-white px-3 py-1.5 font-semibold text-zinc-700 transition hover:bg-violet-50 disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}

            <div className="flex justify-between border-t border-[var(--border)] pt-4">
              <button onClick={onBack} className="text-xs text-zinc-600 hover:text-zinc-950">Back</button>
              <button
                onClick={onNext}
                className="px-5 py-2 bg-gradient-to-r from-violet-600 to-teal-500 rounded text-xs font-semibold text-white"
              >
                Continue with {selectedLibraryLeadIds.length} Library Leads
              </button>
            </div>
          </div>
        )}

        {importTab === 'csv' && !headers.length && (
          <div className="border border-dashed border-[var(--border)] p-8 rounded-lg text-center flex flex-col items-center">
            <Upload className="h-8 w-8 text-violet-400 mb-2" />
            <span className="block text-xs text-zinc-700 font-semibold mb-3">Choose CSV file</span>
            <label className="px-4 py-2 bg-white border border-[var(--border)] hover:bg-violet-50 rounded text-xs text-zinc-700 cursor-pointer font-semibold">
              Select File
              <input type="file" accept=".csv" onChange={onCSVUpload} className="hidden" />
            </label>
          </div>
        )}

        {importTab === 'sheet' && !headers.length && (
          <form onSubmit={onSheetPreview} className="space-y-4 max-w-xl">
            <div>
              <label className="block text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Spreadsheet Sharing URL</label>
              <input
                type="url"
                required
                value={googleSheetUrl}
                onChange={(e) => onGoogleSheetUrlChange(e.target.value)}
                placeholder="https://docs.google.com/spreadsheets/d/.../edit"
                className="mt-1 w-full rounded border border-[var(--border)] bg-white py-2 px-3 text-xs text-zinc-900 focus:border-violet-500 focus:outline-none"
              />
            </div>
            <button type="submit" className="px-4 py-2 bg-white border border-[var(--border)] text-xs text-zinc-700 font-semibold rounded">
              Preview Sheets Content
            </button>
          </form>
        )}

        {loadingPreview && (
          <div className="py-8 text-center text-xs text-zinc-500">Parsing data columns...</div>
        )}

        {previewError && (
          <Banner tone="error">{previewError}</Banner>
        )}
      </div>

      {headers.length > 0 && (
        <div className="space-y-6">
          <div className="rounded-xl border border-[var(--border)] bg-white/20 p-6 backdrop-blur-sm overflow-hidden">
            <span className="block text-xs font-bold text-zinc-950 mb-2">Rows Preview ({rows.length} total)</span>
            <div className="overflow-x-auto max-h-32 border border-[var(--border)] rounded">
              <table className="w-full text-left text-[11px] text-zinc-600">
                <thead className="bg-white text-zinc-500">
                  <tr>
                    {headers.map((h, i) => (
                      <th key={i} className="py-2 px-3">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 3).map((r, ri) => (
                    <tr key={ri} className="border-t border-[var(--border)]">
                      {headers.map((_, ci) => (
                        <td key={ci} className="py-1.5 px-3 max-w-xs truncate">{r[ci]}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-xl border border-[var(--border)] bg-white/20 p-6 backdrop-blur-sm space-y-4">
            <span className="block text-xs font-bold text-zinc-950 mb-2">Map Destination Fields</span>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {DESTINATION_FIELDS.slice(0, 12).map((field) => (
                <div key={field.key} className="p-3 rounded bg-white/40 border border-[var(--border)]">
                  <label className="block text-[10px] font-bold text-zinc-600">{field.label}</label>
                  <select
                    value={mappings[field.key] || ''}
                    onChange={(e) => onMappingsChange({ ...mappings, [field.key]: e.target.value })}
                    className="mt-1 w-full rounded border border-[var(--border)] bg-white py-1 px-2 text-xs text-zinc-700 focus:outline-none"
                  >
                    <option value="">-- Ignore Column --</option>
                    {headers.map((h, i) => (
                      <option key={i} value={h}>{h}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>

            <div className="flex justify-between pt-4 border-t border-[var(--border)]">
              <button onClick={onResetPreview} className="text-xs text-zinc-600 hover:text-zinc-950">Back / Reset</button>
              <button
                onClick={onMapAndRegisterLeads}
                disabled={!mappings['email']}
                className="px-5 py-2 bg-gradient-to-r from-violet-600 to-teal-500 rounded text-xs font-semibold text-white disabled:opacity-50"
              >
                Map &amp; Register {rows.length} Leads
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
