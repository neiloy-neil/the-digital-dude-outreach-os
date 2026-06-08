import { NextResponse } from 'next/server';
import { parseCSVLine } from '@/lib/leads/library';

export async function POST(request: Request) {
  try {
    const { url, gid } = await request.json();
    if (!url) {
      return NextResponse.json({ error: 'Google Sheet URL is required' }, { status: 400 });
    }

    const sheetIdMatch = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (!sheetIdMatch || !sheetIdMatch[1]) {
      return NextResponse.json({ error: 'Invalid Google Sheet URL format' }, { status: 400 });
    }

    const spreadsheetId = sheetIdMatch[1];
    let targetGid = gid || '0';
    if (!gid) {
      const gidMatch = url.match(/[#&?]gid=([0-9]+)/);
      if (gidMatch && gidMatch[1]) {
        targetGid = gidMatch[1];
      }
    }

    const exportUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=${targetGid}`;
    const fetchResponse = await fetch(exportUrl, { headers: { Accept: 'text/csv' } });

    const isRedirectToLogin = fetchResponse.url.includes('ServiceLogin') || fetchResponse.url.includes('interactive/login');
    if (!fetchResponse.ok || isRedirectToLogin) {
      return NextResponse.json({ error: 'This Google Sheet is private. Please change sharing to "Anyone with the link can view", or upload a CSV instead.' }, { status: 400 });
    }

    const csvText = await fetchResponse.text();
    const lines = csvText.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    if (lines.length === 0) {
      return NextResponse.json({ error: 'Google Sheet is empty' }, { status: 400 });
    }

    const headers = parseCSVLine(lines[0]);
    const rows: string[][] = [];
    for (let i = 1; i < lines.length; i++) {
      const parsedLine = parseCSVLine(lines[i]);
      if (parsedLine.length > 0) rows.push(parsedLine);
    }

    return NextResponse.json({ success: true, headers, rows, totalRows: rows.length });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Server error previewing Google Sheet' }, { status: 500 });
  }
}
