import { NextResponse } from 'next/server';
import { requireAdmin } from '@/utils/supabase/admin';

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
    const { authorized, error, status, supabase } = await requireAdmin();
    if (!authorized || !supabase) return NextResponse.json({ error }, { status: status || 401 });

    const { leads } = await request.json();

    if (!Array.isArray(leads) || leads.length === 0) {
      return NextResponse.json({ error: 'No leads provided' }, { status: 400 });
    }

    const { data, error: dbError } = await supabase
      .from('admin_leads_pool')
      .insert(leads)
      .select();

    if (dbError) throw dbError;

    return NextResponse.json({ success: true, count: data.length });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { authorized, error, status, supabase } = await requireAdmin();
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

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const { authorized, error, status, supabase } = await requireAdmin();
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

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
