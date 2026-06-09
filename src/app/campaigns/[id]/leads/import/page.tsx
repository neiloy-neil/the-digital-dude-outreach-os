'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, use } from 'react';
import { createClient } from '@/utils/supabase/client';
import AppShell from '@/components/reachmira/AppShell';
import PageHeader from '@/components/reachmira/PageHeader';
import { 
  ArrowLeft, 
  Upload, 
  FileSpreadsheet, 
  FileText, 
  AlertCircle, 
  CheckCircle,
  Database,
  Sparkles,
  ChevronRight,
  HelpCircle
} from 'lucide-react';
import Link from 'next/link';
import Papa from 'papaparse';

interface PageProps {
  params: Promise<{ id: string }>;
}

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

export default function LeadImportPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const campaignId = resolvedParams.id;
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [campaignName, setCampaignName] = useState('');
  
  // Importer state
  const [activeTab, setActiveTab] = useState<'csv' | 'sheet'>('csv');
  const [googleSheetUrl, setGoogleSheetUrl] = useState('');
  const [sheetGid, setSheetGid] = useState('');
  
  // File data parsed states
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<any[][]>([]);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  // Column mapping states
  const [mappings, setMappings] = useState<Record<string, string>>({}); // db_field -> csv_header
  
  // Import Execution states
  const [importing, setImporting] = useState(false);
  const [importInvalidRows, setImportInvalidRows] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<any | null>(null);
  const inputClass = 'mt-1 w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-xs text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-violet-500';
  const labelClass = 'block text-[10px] font-bold uppercase tracking-wider text-zinc-500';

  useEffect(() => {
    async function loadCampaign() {
      const { data, error } = await supabase
        .from('campaigns')
        .select('name')
        .eq('id', campaignId)
        .single();
      if (data) setCampaignName(data.name);
      setLoading(false);
    }
    loadCampaign();
  }, [campaignId, supabase]);

  // Handle CSV File Upload
  const handleCSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoadingPreview(true);
    setPreviewError(null);
    setImportResult(null);
    setError(null);

    Papa.parse(file, {
      complete: (results) => {
        if (results.errors.length > 0 && results.data.length === 0) {
          setPreviewError('Failed to parse CSV file.');
          setLoadingPreview(false);
          return;
        }

        const parsedRows = results.data as string[][];
        if (parsedRows.length < 2) {
          setPreviewError('CSV must contain a header row and at least one data row.');
          setLoadingPreview(false);
          return;
        }

        const csvHeaders = parsedRows[0].map(h => String(h || '').trim());
        const csvRows = parsedRows.slice(1).filter(r => r.some(cell => cell !== ''));

        setHeaders(csvHeaders);
        setRows(csvRows);
        autoMapHeaders(csvHeaders);
        setLoadingPreview(false);
      },
      error: (err) => {
        setPreviewError(`CSV Parse Error: ${err.message}`);
        setLoadingPreview(false);
      }
    });
  };

  // Handle Google Sheet URL Preview
  const handleSheetPreview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!googleSheetUrl) return;

    setLoadingPreview(true);
    setPreviewError(null);
    setImportResult(null);
    setError(null);
    setHeaders([]);
    setRows([]);

    try {
      const response = await fetch(`/api/campaigns/${campaignId}/import-sheets`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: googleSheetUrl, gid: sheetGid }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to fetch Google Sheet preview.');

      setHeaders(data.headers || []);
      setRows(data.rows || []);
      autoMapHeaders(data.headers || []);
    } catch (err: any) {
      setPreviewError(err.message || 'Error occurred connecting to Google Sheets.');
    } finally {
      setLoadingPreview(false);
    }
  };

  // Perform Auto Mapping
  const autoMapHeaders = (availableHeaders: string[]) => {
    const initialMappings: Record<string, string> = {};
    DESTINATION_FIELDS.forEach(field => {
      // Find case-insensitive matching header or alias
      const matchingHeader = availableHeaders.find(h => {
        const lowerH = h.toLowerCase();
        return field.aliases.some(alias => lowerH === alias || lowerH.replace(/[?_\s-]/g, '') === alias.replace(/[?_\s-]/g, ''));
      });
      if (matchingHeader) {
        initialMappings[field.key] = matchingHeader;
      }
    });
    setMappings(initialMappings);
  };

  const handleMappingChange = (fieldKey: string, headerName: string) => {
    setMappings(prev => ({
      ...prev,
      [fieldKey]: headerName
    }));
  };

  // Run Import
  const handleExecuteImport = async () => {
    if (!mappings['email']) {
      setError('You must map a column to the "Email Address" field.');
      return;
    }

    setImporting(true);
    setError(null);
    setImportResult(null);

    try {
      // Build mapped leads payload
      const mappedLeads = rows.map(row => {
        const leadObj: Record<string, any> = {
          raw_data: {}
        };

        // Populate raw_data JSONB with all original CSV key-values
        headers.forEach((h, idx) => {
          leadObj.raw_data[h] = row[idx] || '';
        });

        // Populate standard mapped fields
        DESTINATION_FIELDS.forEach(field => {
          const mappedHeader = mappings[field.key];
          if (mappedHeader) {
            const headerIndex = headers.indexOf(mappedHeader);
            if (headerIndex !== -1) {
              const value = row[headerIndex];
              if (value !== undefined && value !== null) {
                if (field.key === 'email_verified') {
                  leadObj[field.key] = ['true', 'yes', 'y', '1'].includes(String(value).toLowerCase().trim());
                } else if (field.key === 'solution_score' || field.key === 'solution_fit_score') {
                  const num = Number(value);
                  leadObj[field.key] = Number.isNaN(num) ? null : num;
                } else {
                  leadObj[field.key] = String(value).trim();
                }
              }
            }
          }
        });

        return leadObj;
      });

      const response = await fetch(`/api/campaigns/${campaignId}/import-leads`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ leads: mappedLeads, importInvalidRows }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to execute import.');

      setImportResult(data);
      // Clear states
      setHeaders([]);
      setRows([]);
      setMappings({});
    } catch (err: any) {
      setError(err.message || 'Error executing import.');
    } finally {
      setImporting(false);
    }
  };

  return (
    <AppShell showSearch={false}>
      <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <PageHeader
          eyebrow="Campaign lead import"
          title="Import Leads"
          subtitle={`Add prospects to campaign: ${campaignName || 'Loading...'}`}
          actions={
            <Link href={`/campaigns/${campaignId}`} className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-white px-4 py-2.5 text-sm font-semibold text-zinc-700 transition hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700">
              <ArrowLeft className="h-4 w-4" />
              Back to Campaign
            </Link>
          }
        />

        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-violet-500 border-t-transparent" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Global notification alerts */}
            {error && (
              <div className="flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
                <AlertCircle className="h-4.5 w-4.5" />
                {error}
              </div>
            )}

            {/* Success Import Summary Result Box */}
            {importResult && (
              <div className="space-y-4 rounded-3xl border border-emerald-200 bg-emerald-50 p-6">
                <div className="flex items-center gap-2 font-bold text-emerald-700">
                  <CheckCircle className="h-5 w-5" />
                  <h3>Lead Import Successful!</h3>
                </div>
                <div className="grid grid-cols-2 gap-4 text-center md:grid-cols-4 xl:grid-cols-8">
                  <div className="rounded-2xl border border-[var(--border)] bg-white p-3">
                    <span className="block text-[10px] text-zinc-500 font-bold uppercase">Total Rows Checked</span>
                    <span className="text-xl font-extrabold text-zinc-950">{importResult.totalRows}</span>
                  </div>
                  <div className="rounded-2xl border border-emerald-200 bg-white p-3">
                    <span className="block text-[10px] font-bold uppercase text-emerald-700">Imported Leads</span>
                    <span className="text-xl font-extrabold text-emerald-700">{importResult.imported}</span>
                  </div>
                  <div className="rounded-2xl border border-[var(--border)] bg-white p-3">
                    <span className="block text-[10px] text-zinc-500 font-bold uppercase">Duplicates Skipped</span>
                    <span className="text-xl font-extrabold text-zinc-800">{importResult.skippedDuplicates}</span>
                  </div>
                  <div className="rounded-2xl border border-rose-200 bg-white p-3">
                    <span className="block text-[10px] font-bold uppercase text-rose-700">Invalid Emails</span>
                    <span className="text-xl font-extrabold text-rose-700">{importResult.invalidEmails}</span>
                  </div>
                  <div className="rounded-2xl border border-[var(--border)] bg-white p-3">
                    <span className="block text-[10px] text-zinc-500 font-bold uppercase">Missing Company Name</span>
                    <span className="text-xl font-extrabold text-amber-700">{importResult.missingCompanyNames}</span>
                  </div>
                  <div className="rounded-2xl border border-[var(--border)] bg-white p-3">
                    <span className="block text-[10px] text-zinc-500 font-bold uppercase">Role-based</span>
                    <span className="text-xl font-extrabold text-zinc-800">{importResult.roleBasedEmails || 0}</span>
                  </div>
                  <div className="rounded-2xl border border-[var(--border)] bg-white p-3">
                    <span className="block text-[10px] text-zinc-500 font-bold uppercase">Disposable</span>
                    <span className="text-xl font-extrabold text-zinc-800">{importResult.disposableEmails || 0}</span>
                  </div>
                  <div className="rounded-2xl border border-[var(--border)] bg-white p-3">
                    <span className="block text-[10px] text-zinc-500 font-bold uppercase">Suppressed</span>
                    <span className="text-xl font-extrabold text-zinc-800">{importResult.suppressedEmails || 0}</span>
                  </div>
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <Link href={`/campaigns/${campaignId}`} className="rounded-xl border border-[var(--border)] bg-white px-4 py-2 text-xs font-semibold text-zinc-700 transition hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700">
                    Back to Campaign Detail
                  </Link>
                  <button onClick={() => setImportResult(null)} className="rounded-xl bg-gradient-to-r from-violet-600 to-teal-500 px-4 py-2 text-xs font-semibold text-white transition-opacity hover:opacity-95">
                    Import More
                  </button>
                </div>
              </div>
            )}

            {/* Importer tabs selection */}
            {!headers.length && !importResult && (
              <div className="space-y-6">
                <div className="flex gap-6 border-b border-[var(--border)]">
                  <button 
                    onClick={() => { setActiveTab('csv'); setPreviewError(null); }}
                    className={`pb-3 text-sm font-semibold border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
                      activeTab === 'csv' ? 'border-violet-500 text-violet-700' : 'border-transparent text-zinc-500 hover:text-zinc-900'
                    }`}
                  >
                    <FileText className="h-4 w-4" /> Upload CSV
                  </button>
                  <button 
                    onClick={() => { setActiveTab('sheet'); setPreviewError(null); }}
                    className={`pb-3 text-sm font-semibold border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
                      activeTab === 'sheet' ? 'border-violet-500 text-violet-700' : 'border-transparent text-zinc-500 hover:text-zinc-900'
                    }`}
                  >
                    <FileSpreadsheet className="h-4 w-4" /> Google Sheets URL
                  </button>
                </div>

                {/* CSV Importer Pane */}
                {activeTab === 'csv' && (
                  <div className="flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-violet-200 bg-gradient-to-br from-violet-50 to-teal-50 p-8 py-12">
                    <Upload className="mb-3 h-10 w-10 text-violet-600" />
                    <h3 className="mb-1 font-bold text-zinc-950">Upload CSV Prospect Sheet</h3>
                    <p className="text-xs text-zinc-500 text-center max-w-sm mb-4">
                      Select a standard comma-separated values file (.csv). Double-quoted cells with commas are supported.
                    </p>
                    <label className="flex cursor-pointer items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-teal-500 px-6 py-2.5 text-xs font-semibold text-white shadow-lg shadow-violet-500/10 transition-all hover:opacity-95">
                      Choose CSV File
                      <input 
                        type="file" 
                        accept=".csv"
                        onChange={handleCSVUpload}
                        className="hidden"
                      />
                    </label>
                  </div>
                )}

                {/* Google Sheet Importer Pane */}
                {activeTab === 'sheet' && (
                  <div className="space-y-4 rounded-3xl border border-[var(--border)] bg-white p-6 shadow-[0_12px_40px_rgba(15,23,42,0.04)]">
                    <div>
                      <h3 className="mb-1 font-bold text-zinc-950">Import from Google Sheets</h3>
                      <p className="text-xs text-zinc-500">
                        Paste the public link of your Google Sheets document below. Make sure link sharing settings are set to **"Anyone with the link can view"**.
                      </p>
                    </div>
                    <form onSubmit={handleSheetPreview} className="space-y-4 max-w-2xl">
                      <div>
                        <label className={labelClass}>Spreadsheet URL</label>
                        <input 
                          type="url"
                          required
                          value={googleSheetUrl}
                          onChange={(e) => setGoogleSheetUrl(e.target.value)}
                          placeholder="https://docs.google.com/spreadsheets/d/.../edit#gid=0"
                          className={inputClass}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className={labelClass}>Tab name or GID (Optional)</label>
                          <input 
                            type="text"
                            value={sheetGid}
                            onChange={(e) => setSheetGid(e.target.value)}
                            placeholder="e.g. 0 or List1"
                            className={inputClass}
                          />
                        </div>
                      </div>
                      <button
                        type="submit"
                        disabled={loadingPreview || !googleSheetUrl}
                        className="flex cursor-pointer items-center gap-1.5 rounded-xl bg-gradient-to-r from-violet-600 to-teal-500 px-5 py-2.5 text-xs font-semibold text-white shadow-lg shadow-violet-500/10 hover:opacity-95 disabled:opacity-50"
                      >
                        {loadingPreview ? (
                          <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        ) : (
                          <>Preview Sheet Content</>
                        )}
                      </button>
                    </form>
                  </div>
                )}

                {previewError && (
                  <div className="flex flex-col gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-700">
                    <span className="flex items-center gap-1.5 font-semibold text-sm">
                      <AlertCircle className="h-4.5 w-4.5" /> Import Failed
                    </span>
                    <p>{previewError}</p>
                  </div>
                )}
              </div>
            )}

            {/* LOADING PREVIEW SPINNER */}
            {loadingPreview && (
              <div className="flex h-48 flex-col items-center justify-center gap-2">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-violet-500 border-t-transparent" />
                <span className="text-xs text-zinc-500">Retrieving sheet schema & rows...</span>
              </div>
            )}

            {/* FILE DETAILS, PREVIEW GRID, AND MAPPER PANEL */}
            {headers.length > 0 && (
              <div className="space-y-6">
                <div className="space-y-4 rounded-3xl border border-[var(--border)] bg-white p-6 shadow-[0_12px_40px_rgba(15,23,42,0.04)]">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-md font-bold text-zinc-950">Step 1: Preview Input Data</h3>
                      <p className="text-xs text-zinc-500">Reviewing first 5 rows containing {headers.length} columns.</p>
                    </div>
                    <button 
                      onClick={() => { setHeaders([]); setRows([]); setMappings({}); }}
                      className="text-xs font-semibold text-zinc-500 transition-colors hover:text-violet-700"
                    >
                      Clear / Start Over
                    </button>
                  </div>

                  <div className="max-h-48 overflow-x-auto rounded-2xl border border-[var(--border)]">
                    <table className="w-full text-left text-xs text-zinc-600">
                      <thead className="sticky top-0 border-b border-[var(--border)] bg-[var(--surface-muted)] text-[10px] font-bold uppercase text-zinc-500">
                        <tr>
                          {headers.map((h, i) => (
                            <th key={i} className="py-2.5 px-3 whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--border)]">
                        {rows.slice(0, 5).map((row, rowIdx) => (
                          <tr key={rowIdx} className="hover:bg-violet-50/50">
                            {headers.map((_, colIdx) => (
                              <td key={colIdx} className="max-w-xs truncate px-3 py-2 font-medium text-zinc-700">{row[colIdx] || '-'}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Column Mappings Layout */}
                <div className="space-y-4 rounded-3xl border border-[var(--border)] bg-white p-6 shadow-[0_12px_40px_rgba(15,23,42,0.04)]">
                  <div>
                    <h3 className="text-md font-bold text-zinc-950">Step 2: Map Destination Columns</h3>
                    <p className="text-xs text-zinc-500">Configure how columns in your CSV/Google Sheet map to outreach fields. Unmapped columns go into the raw data store.</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {DESTINATION_FIELDS.map((field) => {
                      const isMapped = !!mappings[field.key];
                      const mappedHeader = mappings[field.key];
                      const headerIdx = headers.indexOf(mappedHeader);
                      
                      // Fetch first 2 sample cells
                      const samples = rows.slice(0, 2).map(r => r[headerIdx]).filter(v => v !== undefined && v !== '');

                      return (
                        <div key={field.key} className={`flex h-32 flex-col justify-between rounded-2xl border p-4 transition-all ${
                          isMapped ? 'border-violet-200 bg-violet-50/70' : 'border-[var(--border)] bg-[var(--surface-muted)]'
                        }`}>
                          <div>
                            <span className="block text-xs font-semibold text-zinc-900">{field.label}</span>
                            <select
                              value={mappings[field.key] || ''}
                              onChange={(e) => handleMappingChange(field.key, e.target.value)}
                              className="mt-1.5 w-full rounded-xl border border-[var(--border)] bg-white px-2 py-1 text-xs font-medium text-zinc-900 outline-none focus:border-violet-500"
                            >
                              <option value="">-- Ignore / Skip --</option>
                              {headers.map((h, i) => (
                                <option key={i} value={h}>{h}</option>
                              ))}
                            </select>
                          </div>

                          <div className="text-[10px] text-zinc-500 mt-2 truncate">
                            {isMapped && samples.length > 0 ? (
                              <span>Samples: <code className="text-violet-700">{samples.join(' | ')}</code></span>
                            ) : (
                              <span>No column mapped</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex items-center justify-between border-t border-[var(--border)] pt-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-1.5 text-xs text-zinc-500">
                        <HelpCircle className="h-4.5 w-4.5 text-zinc-500" />
                        Make sure you map <strong className="text-violet-700">Email Address</strong>.
                      </div>
                      <label className="inline-flex items-center gap-2 text-xs font-medium text-zinc-600">
                        <input
                          type="checkbox"
                          checked={importInvalidRows}
                          onChange={(e) => setImportInvalidRows(e.target.checked)}
                          className="rounded border-zinc-300 text-violet-600 focus:ring-violet-500"
                        />
                        Import invalid emails too
                      </label>
                    </div>

                    <button
                      onClick={handleExecuteImport}
                      disabled={importing || !mappings['email']}
                      className="flex cursor-pointer items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-teal-500 px-6 py-2.5 text-xs font-semibold text-white shadow-lg shadow-violet-500/10 transition-opacity hover:opacity-95 disabled:opacity-50"
                    >
                      {importing ? (
                        <>
                          <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                          Executing Import...
                        </>
                      ) : (
                        <>
                          <Database className="h-4 w-4" /> Map & Import {rows.length} Leads
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </AppShell>
  );
}
