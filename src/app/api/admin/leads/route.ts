import { NextResponse } from 'next/server';
import { requireAdmin } from '@/utils/supabase/admin';
import { createAuditLog } from '@/lib/audit/create-audit-log';
import { normalizeWebsiteForDedup } from '@/lib/dedup';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function GET(request: Request) {
  try {
    const { authorized, error, status, supabase } = await requireAdmin();
    if (!authorized || !supabase) return NextResponse.json({ error }, { status: status || 401 });

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const industry = searchParams.get('industry') || '';

    let query = supabase.from('admin_leads_pool').select('*').order('created_at', { ascending: false });

    if (search) {
      query = query.or(`company_name.ilike.%${search}%,contact_name.ilike.%${search}%,contact_email.ilike.%${search}%`);
    }
    
    if (industry) {
      query = query.ilike('industry', `%${industry}%`);
    }

    const { data, error: dbError } = await query.limit(100);

    if (dbError) throw dbError;

    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { authorized, error, status, supabase, user } = await requireAdmin();
    if (!authorized || !supabase) return NextResponse.json({ error }, { status: status || 401 });

    const { leads } = await request.json();

    if (!Array.isArray(leads) || leads.length === 0) {
      return NextResponse.json({ error: 'No leads provided' }, { status: 400 });
    }

    // Basic per-row validation: every row needs a company name and at least
    // one of a contact email (well-formed) or a website.
    const invalidRows: number[] = [];
    for (let i = 0; i < leads.length; i++) {
      const row = leads[i];
      const hasCompanyName = typeof row?.company_name === 'string' && row.company_name.trim().length > 0;
      const hasWebsite = typeof row?.website === 'string' && row.website.trim().length > 0;
      const hasValidEmail = typeof row?.contact_email === 'string' && EMAIL_PATTERN.test(row.contact_email.trim());
      const hasEmailField = typeof row?.contact_email === 'string' && row.contact_email.trim().length > 0;

      if (!hasCompanyName || (!hasWebsite && !hasEmailField) || (hasEmailField && !hasValidEmail)) {
        invalidRows.push(i);
      }
    }

    if (invalidRows.length > 0) {
      return NextResponse.json(
        {
          error: `${invalidRows.length} row(s) failed validation (missing company_name, missing both website and contact_email, or malformed email)`,
          invalidRows,
        },
        { status: 400 }
      );
    }

    // Dedup against existing rows (by lowercased website) — same normalization
    // used by the admin scraper's dedup check.
    const candidateWebsiteKeys = new Set(
      leads.map((row: any) => normalizeWebsiteForDedup(row.website)).filter(Boolean)
    );
    let existingWebsiteKeys = new Set<string>();
    if (candidateWebsiteKeys.size > 0) {
      const { data: existingRows } = await supabase
        .from('admin_leads_pool')
        .select('website')
        .not('website', 'is', null)
        .limit(5000);
      existingWebsiteKeys = new Set(
        (existingRows || []).map((row: any) => normalizeWebsiteForDedup(row.website)).filter(Boolean)
      );
    }

    const seenInBatch = new Set<string>();
    const rowsToInsert = leads.filter((row: any) => {
      const key = normalizeWebsiteForDedup(row.website);
      if (!key) return true; // no website to dedup on — let it through
      if (existingWebsiteKeys.has(key) || seenInBatch.has(key)) return false;
      seenInBatch.add(key);
      return true;
    });

    const skippedDuplicates = leads.length - rowsToInsert.length;

    if (rowsToInsert.length === 0) {
      return NextResponse.json({ success: true, count: 0, skippedDuplicates, message: 'All rows were duplicates of existing leads' });
    }

    const { data, error: dbError } = await supabase
      .from('admin_leads_pool')
      .insert(rowsToInsert)
      .select();

    if (dbError) throw dbError;

    await createAuditLog({
      userId: user!.id,
      action: 'admin_leads_bulk_imported',
      message: `Imported ${data.length} lead(s) to the admin pool${skippedDuplicates ? ` (${skippedDuplicates} duplicate(s) skipped)` : ''}`,
      metadata: { imported_count: data.length, skipped_duplicates: skippedDuplicates },
    });

    return NextResponse.json({ success: true, count: data.length, skippedDuplicates });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { authorized, error, status, supabase, user } = await requireAdmin();
    if (!authorized || !supabase) return NextResponse.json({ error }, { status: status || 401 });

    const { ids } = await request.json();

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'No IDs provided' }, { status: 400 });
    }

    const { error: dbError } = await supabase
      .from('admin_leads_pool')
      .delete()
      .in('id', ids);

    if (dbError) throw dbError;

    await createAuditLog({
      userId: user!.id,
      action: 'admin_leads_bulk_deleted',
      message: `Deleted ${ids.length} lead(s) from the admin pool`,
      metadata: { deleted_ids: ids },
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const { authorized, error, status, supabase, user } = await requireAdmin();
    if (!authorized || !supabase) return NextResponse.json({ error }, { status: status || 401 });

    const { ids, tags } = await request.json();

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'No IDs provided' }, { status: 400 });
    }

    // Assuming tags is an array of strings
    const { error: dbError } = await supabase
      .from('admin_leads_pool')
      .update({ tags })
      .in('id', ids);

    if (dbError) throw dbError;

    await createAuditLog({
      userId: user!.id,
      action: 'admin_leads_bulk_tagged',
      message: `Updated tags for ${ids.length} lead(s) in the admin pool`,
      metadata: { lead_ids: ids, tags },
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
