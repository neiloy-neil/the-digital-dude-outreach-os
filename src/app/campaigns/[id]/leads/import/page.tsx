'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, use } from 'react';
import { createClient } from '@/utils/supabase/client';
import Sidebar from '@/components/Sidebar';
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
  const [error, setError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<any | null>(null);

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
        body: JSON.stringify({ leads: mappedLeads }),
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
    <div className="flex min-h-screen bg-zinc-950 text-zinc-100">
      <Sidebar />
      <main className="flex-1 p-8 overflow-y-auto max-w-6xl">
        {/* Back header */}
        <div className="flex items-center gap-3 mb-6">
          <Link href={`/campaigns/${campaignId}`} className="p-2 bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-400 hover:text-white transition-all">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h2 className="text-2xl font-bold text-white tracking-tight">Import Leads</h2>
            <p className="text-xs text-zinc-400">Add prospects to campaign: <span className="text-violet-400 font-semibold">{campaignName || 'Loading...'}</span></p>
          </div>
        </div>

        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-violet-500 border-t-transparent" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Global notification alerts */}
            {error && (
              <div className="rounded-lg bg-rose-500/10 p-3 text-xs text-rose-400 border border-rose-500/20 flex items-center gap-2">
                <AlertCircle className="h-4.5 w-4.5" />
                {error}
              </div>
            )}

            {/* Success Import Summary Result Box */}
            {importResult && (
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-6 space-y-4">
                <div className="flex items-center gap-2 text-emerald-400 font-bold">
                  <CheckCircle className="h-5 w-5" />
                  <h3>Lead Import Successful!</h3>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
                  <div className="bg-zinc-900/40 p-3 border border-zinc-800/80 rounded-lg">
                    <span className="block text-[10px] text-zinc-500 font-bold uppercase">Total Rows Checked</span>
                    <span className="text-xl font-extrabold text-white">{importResult.totalRows}</span>
                  </div>
                  <div className="bg-emerald-500/10 p-3 border border-emerald-500/20 rounded-lg">
                    <span className="block text-[10px] text-emerald-400 font-bold uppercase">Imported Leads</span>
                    <span className="text-xl font-extrabold text-emerald-400">{importResult.imported}</span>
                  </div>
                  <div className="bg-zinc-900/40 p-3 border border-zinc-800/80 rounded-lg">
                    <span className="block text-[10px] text-zinc-500 font-bold uppercase">Duplicates Skipped</span>
                    <span className="text-xl font-extrabold text-zinc-300">{importResult.skippedDuplicates}</span>
                  </div>
                  <div className="bg-rose-500/10 p-3 border border-rose-500/20 rounded-lg">
                    <span className="block text-[10px] text-rose-400 font-bold uppercase">Invalid Emails</span>
                    <span className="text-xl font-extrabold text-rose-400">{importResult.invalidEmails}</span>
                  </div>
                  <div className="bg-zinc-900/40 p-3 border border-zinc-800/80 rounded-lg">
                    <span className="block text-[10px] text-zinc-500 font-bold uppercase">Missing Company Name</span>
                    <span className="text-xl font-extrabold text-amber-400">{importResult.missingCompanyNames}</span>
                  </div>
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <Link href={`/campaigns/${campaignId}`} className="px-4 py-2 bg-zinc-900 border border-zinc-850 hover:bg-zinc-800 text-xs font-semibold rounded-lg text-zinc-300 transition-colors">
                    Back to Campaign Detail
                  </Link>
                  <button onClick={() => setImportResult(null)} className="px-4 py-2 bg-gradient-to-r from-violet-600 to-blue-600 hover:opacity-90 text-xs font-semibold rounded-lg text-white transition-opacity">
                    Import More
                  </button>
                </div>
              </div>
            )}

            {/* Importer tabs selection */}
            {!headers.length && !importResult && (
              <div className="space-y-6">
                <div className="flex border-b border-zinc-800 gap-6">
                  <button 
                    onClick={() => { setActiveTab('csv'); setPreviewError(null); }}
                    className={`pb-3 text-sm font-semibold border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
                      activeTab === 'csv' ? 'border-violet-500 text-white' : 'border-transparent text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    <FileText className="h-4 w-4" /> Upload CSV
                  </button>
                  <button 
                    onClick={() => { setActiveTab('sheet'); setPreviewError(null); }}
                    className={`pb-3 text-sm font-semibold border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
                      activeTab === 'sheet' ? 'border-violet-500 text-white' : 'border-transparent text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    <FileSpreadsheet className="h-4 w-4" /> Google Sheets URL
                  </button>
                </div>

                {/* CSV Importer Pane */}
                {activeTab === 'csv' && (
                  <div className="rounded-xl border border-zinc-800 bg-zinc-900/20 p-8 backdrop-blur-sm flex flex-col items-center justify-center border-dashed border-2 py-12">
                    <Upload className="h-10 w-10 text-violet-400 mb-3" />
                    <h3 className="font-bold text-white mb-1">Upload CSV Prospect Sheet</h3>
                    <p className="text-xs text-zinc-500 text-center max-w-sm mb-4">
                      Select a standard comma-separated values file (.csv). Double-quoted cells with commas are supported.
                    </p>
                    <label className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-violet-600 to-blue-600 hover:opacity-90 rounded-lg text-xs font-semibold text-white transition-all cursor-pointer shadow-lg shadow-violet-500/10">
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
                  <div className="rounded-xl border border-zinc-800 bg-zinc-900/20 p-6 backdrop-blur-sm space-y-4">
                    <div>
                      <h3 className="font-bold text-white mb-1">Import from Google Sheets</h3>
                      <p className="text-xs text-zinc-400">
                        Paste the public link of your Google Sheets document below. Make sure link sharing settings are set to **"Anyone with the link can view"**.
                      </p>
                    </div>
                    <form onSubmit={handleSheetPreview} className="space-y-4 max-w-2xl">
                      <div>
                        <label className="block text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Spreadsheet URL</label>
                        <input 
                          type="url"
                          required
                          value={googleSheetUrl}
                          onChange={(e) => setGoogleSheetUrl(e.target.value)}
                          placeholder="https://docs.google.com/spreadsheets/d/.../edit#gid=0"
                          className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950 py-2 px-3 text-xs text-zinc-200 focus:border-violet-500 focus:outline-none transition-colors"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Tab name or GID (Optional)</label>
                          <input 
                            type="text"
                            value={sheetGid}
                            onChange={(e) => setSheetGid(e.target.value)}
                            placeholder="e.g. 0 or List1"
                            className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950 py-2 px-3 text-xs text-zinc-200 focus:border-violet-500 focus:outline-none transition-colors"
                          />
                        </div>
                      </div>
                      <button
                        type="submit"
                        disabled={loadingPreview || !googleSheetUrl}
                        className="px-5 py-2.5 bg-gradient-to-r from-violet-600 to-blue-600 rounded-lg text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50 cursor-pointer shadow-lg shadow-violet-500/10 flex items-center gap-1.5"
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
                  <div className="rounded-lg bg-rose-500/10 p-4 text-xs text-rose-400 border border-rose-500/20 flex flex-col gap-2">
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
                <div className="rounded-xl border border-zinc-800 bg-zinc-900/20 p-6 backdrop-blur-sm space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-white text-md">Step 1: Preview Input Data</h3>
                      <p className="text-xs text-zinc-400">Reviewing first 5 rows containing {headers.length} columns.</p>
                    </div>
                    <button 
                      onClick={() => { setHeaders([]); setRows([]); setMappings({}); }}
                      className="text-xs font-semibold text-zinc-400 hover:text-white transition-colors"
                    >
                      Clear / Start Over
                    </button>
                  </div>

                  <div className="overflow-x-auto max-h-48 border border-zinc-800 rounded-lg">
                    <table className="w-full text-left text-xs text-zinc-400">
                      <thead className="text-[10px] font-bold uppercase text-zinc-500 border-b border-zinc-850 bg-zinc-900/40 sticky top-0">
                        <tr>
                          {headers.map((h, i) => (
                            <th key={i} className="py-2.5 px-3 whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-900">
                        {rows.slice(0, 5).map((row, rowIdx) => (
                          <tr key={rowIdx} className="hover:bg-zinc-900/10">
                            {headers.map((_, colIdx) => (
                              <td key={colIdx} className="py-2 px-3 font-medium text-zinc-300 max-w-xs truncate">{row[colIdx] || '-'}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Column Mappings Layout */}
                <div className="rounded-xl border border-zinc-800 bg-zinc-900/20 p-6 backdrop-blur-sm space-y-4">
                  <div>
                    <h3 className="font-bold text-white text-md">Step 2: Map Destination Columns</h3>
                    <p className="text-xs text-zinc-400">Configure how columns in your CSV/Google Sheet map to outreach fields. Unmapped columns go into the raw data store.</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {DESTINATION_FIELDS.map((field) => {
                      const isMapped = !!mappings[field.key];
                      const mappedHeader = mappings[field.key];
                      const headerIdx = headers.indexOf(mappedHeader);
                      
                      // Fetch first 2 sample cells
                      const samples = rows.slice(0, 2).map(r => r[headerIdx]).filter(v => v !== undefined && v !== '');

                      return (
                        <div key={field.key} className={`p-4 rounded-xl border transition-all flex flex-col justify-between h-32 ${
                          isMapped ? 'bg-zinc-950/60 border-violet-500/20' : 'bg-zinc-950/20 border-zinc-900'
                        }`}>
                          <div>
                            <span className="block text-xs font-semibold text-zinc-200">{field.label}</span>
                            <select
                              value={mappings[field.key] || ''}
                              onChange={(e) => handleMappingChange(field.key, e.target.value)}
                              className="mt-1.5 w-full rounded border border-zinc-800 bg-zinc-950 py-1 px-2 text-xs text-zinc-300 focus:outline-none focus:border-violet-500 font-medium"
                            >
                              <option value="">-- Ignore / Skip --</option>
                              {headers.map((h, i) => (
                                <option key={i} value={h}>{h}</option>
                              ))}
                            </select>
                          </div>

                          <div className="text-[10px] text-zinc-500 mt-2 truncate">
                            {isMapped && samples.length > 0 ? (
                              <span>Samples: <code className="text-violet-400">{samples.join(' | ')}</code></span>
                            ) : (
                              <span>No column mapped</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="border-t border-zinc-800 pt-4 flex items-center justify-between">
                    <div className="text-xs text-zinc-400 flex items-center gap-1.5">
                      <HelpCircle className="h-4.5 w-4.5 text-zinc-500" />
                      Make sure you map <strong className="text-violet-400">Email Address</strong>.
                    </div>

                    <button
                      onClick={handleExecuteImport}
                      disabled={importing || !mappings['email']}
                      className="px-6 py-2.5 bg-gradient-to-r from-violet-600 to-blue-600 hover:opacity-90 rounded-lg text-xs font-semibold text-white transition-opacity disabled:opacity-50 flex items-center gap-2 cursor-pointer shadow-lg shadow-violet-500/10"
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
    </div>
  );
}
