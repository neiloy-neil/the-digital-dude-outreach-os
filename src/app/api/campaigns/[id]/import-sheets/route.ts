import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result.map(cell => cell.replace(/^["']|["']$/g, '').trim());
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const resolvedParams = await params;
  const campaignId = resolvedParams.id;
  const supabase = await createClient();

  // 1. Authenticate user
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { url, gid } = await request.json();
    if (!url) {
      return NextResponse.json({ error: 'Google Sheet URL is required' }, { status: 400 });
    }

    // Verify campaign ownership
    const { data: campaign, error: campError } = await supabase
      .from('campaigns')
      .select('id')
      .eq('id', campaignId)
      .eq('user_id', user.id)
      .single();

    if (campError || !campaign) {
      return NextResponse.json({ error: 'Campaign not found or access denied' }, { status: 403 });
    }

    // Extract spreadsheet ID from url
    const sheetIdMatch = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (!sheetIdMatch || !sheetIdMatch[1]) {
      return NextResponse.json({ error: 'Invalid Google Sheet URL format' }, { status: 400 });
    }

    const spreadsheetId = sheetIdMatch[1];
    
    // Extract gid from URL if not specified
    let targetGid = gid || '0';
    if (!gid) {
      const gidMatch = url.match(/[#&?]gid=([0-9]+)/);
      if (gidMatch && gidMatch[1]) {
        targetGid = gidMatch[1];
      }
    }

    // Fetch CSV export
    const exportUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=${targetGid}`;
    
    let fetchResponse;
    try {
      fetchResponse = await fetch(exportUrl, {
        method: 'GET',
        headers: {
          'Accept': 'text/csv',
        },
      });
    } catch (fetchErr: any) {
      return NextResponse.json({ 
        error: 'Network error fetching spreadsheet. Please check the URL.' 
      }, { status: 400 });
    }

    // If Google returns a redirect to a Login page, or a 401/403/404, it means it's private
    const isRedirectToLogin = fetchResponse.url.includes('ServiceLogin') || fetchResponse.url.includes('interactive/login');
    if (!fetchResponse.ok || isRedirectToLogin) {
      return NextResponse.json({ 
        error: 'This Google Sheet is private. Please change sharing to "Anyone with the link can view", or upload a CSV instead.' 
      }, { status: 400 });
    }

    const csvText = await fetchResponse.text();
    const lines = csvText.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    if (lines.length === 0) {
      return NextResponse.json({ error: 'Google Sheet is empty' }, { status: 400 });
    }

    // Parse all headers and rows
    const headers = parseCSVLine(lines[0]);
    const rows: string[][] = [];

    for (let i = 1; i < lines.length; i++) {
      const parsedLine = parseCSVLine(lines[i]);
      if (parsedLine.length > 0) {
        rows.push(parsedLine);
      }
    }

    return NextResponse.json({ 
      success: true, 
      headers, 
      rows, 
      totalRows: rows.length 
    });
  } catch (err: any) {
    console.error('Google Sheets fetch crash:', err);
    return NextResponse.json({ error: err.message || 'Server error previewing Google Sheet' }, { status: 500 });
  }
}
