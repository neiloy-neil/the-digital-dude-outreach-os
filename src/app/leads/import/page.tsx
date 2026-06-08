'use client';

export const dynamic = 'force-dynamic';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import Papa from 'papaparse';
import { ArrowLeft, Upload, FileSpreadsheet, CheckCircle, AlertCircle, Database } from 'lucide-react';
import { LEAD_DESTINATION_FIELDS, autoMapHeaders } from '@/lib/leads/library';

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
  const [leadLists, setLeadLists] = useState<any[]>([]);
  const [leadListId, setLeadListId] = useState('');
  const [activeTab, setActiveTab] = useState<'csv' | 'sheet'>('csv');
  const [googleSheetUrl, setGoogleSheetUrl] = useState('');
  const [sheetGid, setSheetGid] = useState('');
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<any[][]>([]);
  const [mappings, setMappings] = useState<Record<string, string>>({});
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [result, setResult] = useState<any | null>(null);

  const selectedLeadList = useMemo(
    () => leadLists.find((list) => list.id === leadListId) || null,
    [leadListId, leadLists]
  );

  useEffect(() => {
    const load = async () => {
      const response = await fetch('/api/lead-lists');
      const data = await response.json();
      if (!response.ok) {
        setLeadLists([]);
        setLeadListId('');
        return;
      }
      setLeadLists(data.leadLists || []);
      const requestedListId = searchParams.get('listId');
      const availableLists = data.leadLists || [];
      const matchingList = requestedListId
        ? availableLists.find((list: any) => list.id === requestedListId)
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
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to preview Google Sheet');
      setHeaders(data.headers || []);
      setRows(data.rows || []);
      setMappings(autoMapHeaders(data.headers || []));
    } catch (err: any) {
      setPreviewError(err.message || 'Failed to preview Google Sheet');
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
      const leadObj: Record<string, any> = { raw_data: {} };
      headers.forEach((header, idx) => {
        leadObj.raw_data[header] = row[idx] || '';
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
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to import leads');
      setResult(data);
      setHeaders([]);
      setRows([]);
      setMappings({});
      router.push(`/lead-lists/${leadListId}`);
    } catch (err: any) {
      setError(err.message || 'Failed to import leads');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-zinc-950 text-zinc-100">
      <Sidebar />
      <main className="flex-1 p-8 overflow-y-auto max-w-6xl">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/leads" className="p-2 rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-400">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h2 className="text-2xl font-bold text-white tracking-tight">Import Leads</h2>
            <p className="text-xs text-zinc-400">
              Import into a global lead list using CSV or Google Sheets.
              {selectedLeadList ? (
                <span className="text-violet-400 font-semibold"> Target list: {selectedLeadList.name}</span>
              ) : null}
            </p>
          </div>
        </div>

        <div className="mb-6 rounded-xl border border-zinc-800 bg-zinc-900/20 p-4">
          <label className="block text-xs text-zinc-400 font-semibold uppercase">Lead List</label>
          <select value={leadListId} onChange={(e) => setLeadListId(e.target.value)} className="mt-1 w-full max-w-md rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm">
            {leadLists.map((list) => <option key={list.id} value={list.id}>{list.name}</option>)}
          </select>
          <div className="mt-2 text-xs text-zinc-500">Need a new list? Create one on the <Link href="/lead-lists" className="text-violet-400">Lead Lists</Link> page.</div>
        </div>

        {error && <div className="mb-4 rounded-lg border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-400">{error}</div>}
        {previewError && <div className="mb-4 rounded-lg border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-400">{previewError}</div>}
        {result && (
          <div className="mb-4 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-xs text-emerald-400">
            Imported {result.imported} leads. Skipped duplicates: {result.skippedDuplicates}. Invalid emails: {result.invalidEmails}.
          </div>
        )}

        {!headers.length && (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/20 p-6">
            <div className="flex border-b border-zinc-800 gap-6 mb-4">
              <button onClick={() => setActiveTab('csv')} className={`pb-3 text-sm font-semibold border-b-2 ${activeTab === 'csv' ? 'border-violet-500 text-white' : 'border-transparent text-zinc-400'}`}>
                <Upload className="inline h-4 w-4 mr-1" /> CSV Upload
              </button>
              <button onClick={() => setActiveTab('sheet')} className={`pb-3 text-sm font-semibold border-b-2 ${activeTab === 'sheet' ? 'border-violet-500 text-white' : 'border-transparent text-zinc-400'}`}>
                <FileSpreadsheet className="inline h-4 w-4 mr-1" /> Google Sheets
              </button>
            </div>

            {activeTab === 'csv' ? (
              <label className="flex min-h-40 flex-col items-center justify-center rounded-xl border border-dashed border-zinc-800 bg-zinc-950/30 p-8 text-center cursor-pointer">
                <Upload className="mb-3 h-10 w-10 text-violet-400" />
                <span className="text-sm font-semibold text-white">Choose CSV File</span>
                <input type="file" accept=".csv" onChange={handleCSVUpload} className="hidden" />
              </label>
            ) : (
              <form onSubmit={handleSheetPreview} className="space-y-4">
                <div>
                  <label className="block text-xs text-zinc-400 font-semibold uppercase">Spreadsheet URL</label>
                  <input value={googleSheetUrl} onChange={(e) => setGoogleSheetUrl(e.target.value)} className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm" placeholder="https://docs.google.com/spreadsheets/d/..." />
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 font-semibold uppercase">GID</label>
                  <input value={sheetGid} onChange={(e) => setSheetGid(e.target.value)} className="mt-1 w-full max-w-xs rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm" placeholder="0" />
                </div>
                <button className="rounded-lg bg-gradient-to-r from-violet-600 to-blue-600 px-4 py-2 text-sm font-semibold text-white">Preview Sheet</button>
              </form>
            )}
          </div>
        )}

        {loadingPreview && <div className="py-10 text-center text-zinc-500">Loading preview...</div>}

        {headers.length > 0 && (
          <div className="space-y-6">
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/20 p-4 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="text-zinc-500 uppercase">
                  <tr>{headers.map((h) => <th key={h} className="px-3 py-2">{h}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {rows.slice(0, 5).map((row, idx) => (
                    <tr key={idx}>{headers.map((_, i) => <td key={i} className="px-3 py-2 text-zinc-300">{String(row[i] || '-')}</td>)}</tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-zinc-900/20 p-6 space-y-4">
              <div>
                <h3 className="font-bold text-white">Map Columns</h3>
                <p className="text-xs text-zinc-400">Unmapped columns go into raw_data automatically.</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {LEAD_DESTINATION_FIELDS.map((field) => (
                  <div key={field.key} className="rounded-xl border border-zinc-800 bg-zinc-950/30 p-3">
                    <label className="block text-[10px] uppercase text-zinc-500 font-bold">{field.label}</label>
                    <select value={mappings[field.key] || ''} onChange={(e) => setMappings({ ...mappings, [field.key]: e.target.value })} className="mt-1 w-full rounded border border-zinc-800 bg-zinc-950 px-2 py-1.5 text-xs">
                      <option value="">-- Ignore --</option>
                      {headers.map((h) => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between border-t border-zinc-800 pt-4">
                <div className="text-xs text-zinc-500">First 5 rows previewed above.</div>
                <button disabled={importing} onClick={handleImport} className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-violet-600 to-blue-600 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
                  {importing ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> : <><Database className="h-4 w-4" /> Import to List</>}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
