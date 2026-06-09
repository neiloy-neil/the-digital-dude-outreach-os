'use client';

export const dynamic = 'force-dynamic';

import { Suspense, useEffect, useMemo, useState } from 'react';
import AppShell from '@/components/reachmira/AppShell';
import PageHeader from '@/components/reachmira/PageHeader';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import Papa from 'papaparse';
import { ArrowLeft, Upload, FileSpreadsheet, Database } from 'lucide-react';
import { LEAD_DESTINATION_FIELDS, autoMapHeaders } from '@/lib/leads/library';

type LeadListOption = {
  id: string;
  name: string;
};

type LeadListsResponse = {
  leadLists?: LeadListOption[];
  error?: string;
};

type SheetPreviewResponse = {
  headers?: string[];
  rows?: string[][];
  error?: string;
};

type ImportResult = {
  imported: number;
  skippedDuplicates: number;
  invalidEmails: number;
  error?: string;
};

export default function LeadImportPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-white text-zinc-900 p-8">Loading import wizard...</div>}>
      <LeadImportPageInner />
    </Suspense>
  );
}

function LeadImportPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [leadLists, setLeadLists] = useState<LeadListOption[]>([]);
  const [leadListId, setLeadListId] = useState('');
  const [activeTab, setActiveTab] = useState<'csv' | 'sheet'>('csv');
  const [googleSheetUrl, setGoogleSheetUrl] = useState('');
  const [sheetGid, setSheetGid] = useState('');
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [mappings, setMappings] = useState<Record<string, string>>({});
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const inputClass = 'mt-1 w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-violet-500';
  const labelClass = 'block text-xs font-semibold uppercase text-zinc-500';

  const selectedLeadList = useMemo(
    () => leadLists.find((list) => list.id === leadListId) || null,
    [leadListId, leadLists]
  );

  useEffect(() => {
    const load = async () => {
      const response = await fetch('/api/lead-lists');
      const data = (await response.json()) as LeadListsResponse;
      if (!response.ok) {
        setLeadLists([]);
        setLeadListId('');
        return;
      }
      setLeadLists(data.leadLists || []);
      const requestedListId = searchParams.get('listId');
      const availableLists = data.leadLists || [];
      const matchingList = requestedListId
        ? availableLists.find((list) => list.id === requestedListId)
        : null;
      setLeadListId(matchingList?.id || availableLists?.[0]?.id || '');
    };
    load();
  }, [searchParams]);

  const handleCSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoadingPreview(true);
    setPreviewError(null);
    setResult(null);
    Papa.parse(file, {
      complete: (results) => {
        const parsedRows = results.data as string[][];
        if (parsedRows.length < 2) {
          setPreviewError('CSV must contain a header row and at least one row.');
          setLoadingPreview(false);
          return;
        }
        const csvHeaders = parsedRows[0].map((h) => String(h || '').trim());
        const csvRows = parsedRows.slice(1).filter((r) => r.some((cell) => cell !== ''));
        setHeaders(csvHeaders);
        setRows(csvRows);
        setMappings(autoMapHeaders(csvHeaders));
        setLoadingPreview(false);
      },
      error: (err) => {
        setPreviewError(err.message);
        setLoadingPreview(false);
      },
    });
  };

  const handleSheetPreview = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoadingPreview(true);
    setPreviewError(null);
    setResult(null);
    try {
      const response = await fetch('/api/lead-lists/import-sheets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: googleSheetUrl, gid: sheetGid }),
      });
      const data = (await response.json()) as SheetPreviewResponse;
      if (!response.ok) throw new Error(data.error || 'Failed to preview Google Sheet');
      setHeaders(data.headers || []);
      setRows(data.rows || []);
      setMappings(autoMapHeaders(data.headers || []));
    } catch (err: unknown) {
      setPreviewError(err instanceof Error ? err.message : 'Failed to preview Google Sheet');
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleImport = async () => {
    if (!leadListId) {
      setError('Select a lead list first.');
      return;
    }

    setImporting(true);
    setError(null);
    setResult(null);

    const leads = rows.map((row) => {
      const leadObj: Record<string, string | number | null | Record<string, string>> = { raw_data: {} };
      headers.forEach((header, idx) => {
        (leadObj.raw_data as Record<string, string>)[header] = row[idx] || '';
      });

      LEAD_DESTINATION_FIELDS.forEach((field) => {
        const mappedHeader = mappings[field.key];
        if (!mappedHeader) return;
        const headerIndex = headers.indexOf(mappedHeader);
        if (headerIndex === -1) return;
        const value = row[headerIndex];
        if (value === undefined || value === null || value === '') return;
        if (field.key === 'solution_score' || field.key === 'solution_fit_score') {
          const parsed = Number(value);
          leadObj[field.key] = Number.isNaN(parsed) ? null : parsed;
        } else {
          leadObj[field.key] = String(value).trim();
        }
      });

      return leadObj;
    });

    try {
      const response = await fetch(`/api/lead-lists/${leadListId}/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leads }),
      });
      const data = (await response.json()) as ImportResult;
      if (!response.ok) throw new Error(data.error || 'Failed to import leads');
      setResult(data);
      setHeaders([]);
      setRows([]);
      setMappings({});
      router.push(`/lead-lists/${leadListId}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to import leads');
    } finally {
      setImporting(false);
    }
  };

  return (
    <AppShell showSearch={false}>
      <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <PageHeader
          eyebrow="Lead import"
          title="Import Leads"
          subtitle={`Import into a global lead list using CSV or Google Sheets.${selectedLeadList ? ` Target list: ${selectedLeadList.name}` : ''}`}
          actions={
            <Link href="/leads" className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-white px-4 py-2.5 text-sm font-semibold text-zinc-700 transition hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700">
              <ArrowLeft className="h-4 w-4" />
              Back to Leads
            </Link>
          }
        />

        <div className="mb-6 rounded-3xl border border-[var(--border)] bg-white p-4 shadow-[0_12px_40px_rgba(15,23,42,0.04)]">
          <label className={labelClass}>Lead List</label>
          <select value={leadListId} onChange={(e) => setLeadListId(e.target.value)} className={`${inputClass} max-w-md`}>
            {leadLists.map((list) => <option key={list.id} value={list.id}>{list.name}</option>)}
          </select>
          <div className="mt-2 text-xs text-zinc-500">Need a new list? Create one on the <Link href="/lead-lists" className="font-semibold text-violet-700">Lead Lists</Link> page.</div>
        </div>

        {error && <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}
        {previewError && <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{previewError}</div>}
        {result && (
          <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
            Imported {result.imported} leads. Skipped duplicates: {result.skippedDuplicates}. Invalid emails: {result.invalidEmails}.
          </div>
        )}

        {!headers.length && (
          <div className="rounded-3xl border border-[var(--border)] bg-white p-6 shadow-[0_12px_40px_rgba(15,23,42,0.04)]">
            <div className="mb-4 flex gap-6 border-b border-[var(--border)]">
              <button onClick={() => setActiveTab('csv')} className={`border-b-2 pb-3 text-sm font-semibold ${activeTab === 'csv' ? 'border-violet-500 text-violet-700' : 'border-transparent text-zinc-500 hover:text-zinc-900'}`}>
                <Upload className="inline h-4 w-4 mr-1" /> CSV Upload
              </button>
              <button onClick={() => setActiveTab('sheet')} className={`border-b-2 pb-3 text-sm font-semibold ${activeTab === 'sheet' ? 'border-violet-500 text-violet-700' : 'border-transparent text-zinc-500 hover:text-zinc-900'}`}>
                <FileSpreadsheet className="inline h-4 w-4 mr-1" /> Google Sheets
              </button>
            </div>

            {activeTab === 'csv' ? (
              <label className="flex min-h-40 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-violet-200 bg-gradient-to-br from-violet-50 to-teal-50 p-8 text-center transition hover:border-violet-300">
                <Upload className="mb-3 h-10 w-10 text-violet-600" />
                <span className="text-sm font-semibold text-zinc-950">Choose CSV File</span>
                <span className="mt-1 text-xs text-zinc-500">Headers will auto-map where possible.</span>
                <input type="file" accept=".csv" onChange={handleCSVUpload} className="hidden" />
              </label>
            ) : (
              <form onSubmit={handleSheetPreview} className="space-y-4">
                <div>
                  <label className={labelClass}>Spreadsheet URL</label>
                  <input value={googleSheetUrl} onChange={(e) => setGoogleSheetUrl(e.target.value)} className={inputClass} placeholder="https://docs.google.com/spreadsheets/d/..." />
                </div>
                <div>
                  <label className={labelClass}>GID</label>
                  <input value={sheetGid} onChange={(e) => setSheetGid(e.target.value)} className={`${inputClass} max-w-xs`} placeholder="0" />
                </div>
                <button className="rounded-xl bg-gradient-to-r from-violet-600 to-teal-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-600/20 transition hover:opacity-95">Preview Sheet</button>
              </form>
            )}
          </div>
        )}

        {loadingPreview && <div className="py-10 text-center text-zinc-500">Loading preview...</div>}

        {headers.length > 0 && (
          <div className="space-y-6">
            <div className="overflow-x-auto rounded-3xl border border-[var(--border)] bg-white p-4 shadow-[0_12px_40px_rgba(15,23,42,0.04)]">
              <table className="w-full text-left text-xs">
                <thead className="uppercase text-zinc-500">
                  <tr>{headers.map((h) => <th key={h} className="px-3 py-2">{h}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {rows.slice(0, 5).map((row, idx) => (
                    <tr key={idx}>{headers.map((_, i) => <td key={i} className="px-3 py-2 text-zinc-700">{String(row[i] || '-')}</td>)}</tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="space-y-4 rounded-3xl border border-[var(--border)] bg-white p-6 shadow-[0_12px_40px_rgba(15,23,42,0.04)]">
              <div>
                <h3 className="font-bold text-zinc-950">Map Columns</h3>
                <p className="text-xs text-zinc-400">Unmapped columns go into raw_data automatically.</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {LEAD_DESTINATION_FIELDS.map((field) => (
                  <div key={field.key} className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] p-3">
                    <label className="block text-[10px] font-bold uppercase text-zinc-500">{field.label}</label>
                    <select value={mappings[field.key] || ''} onChange={(e) => setMappings({ ...mappings, [field.key]: e.target.value })} className="mt-1 w-full rounded-xl border border-[var(--border)] bg-white px-2 py-1.5 text-xs text-zinc-900 outline-none focus:border-violet-500">
                      <option value="">-- Ignore --</option>
                      {headers.map((h) => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between border-t border-[var(--border)] pt-4">
                <div className="text-xs text-zinc-500">First 5 rows previewed above.</div>
                <button disabled={importing} onClick={handleImport} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-teal-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-600/20 transition hover:opacity-95 disabled:opacity-50">
                  {importing ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> : <><Database className="h-4 w-4" /> Import to List</>}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </AppShell>
  );
}
