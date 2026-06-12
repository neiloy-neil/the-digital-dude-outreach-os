import { NextResponse } from 'next/server';
import { requireAdmin } from '@/utils/supabase/admin';

export async function GET() {
  try {
    const { authorized, error, status, supabase } = await requireAdmin();
    if (!authorized || !supabase) return NextResponse.json({ error }, { status: status || 401 });

    const { data, error: dbError } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (dbError) throw dbError;

    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const { authorized, error, status, supabase } = await requireAdmin();
    if (!authorized || !supabase) return NextResponse.json({ error }, { status: status || 401 });

    const { id, is_admin } = await request.json();

    if (!id) return NextResponse.json({ error: 'User ID required' }, { status: 400 });

    const { error: dbError } = await supabase
      .from('profiles')
      .update({ is_admin })
      .eq('id', id);

    if (dbError) throw dbError;

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { authorized, error, status, supabase } = await requireAdmin();
    if (!authorized || !supabase) return NextResponse.json({ error }, { status: status || 401 });

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) return NextResponse.json({ error: 'User ID required' }, { status: 400 });

    // Note: We use the service role key to delete auth users normally,
    // but here we are just deleting their profile or relying on Supabase Admin API
    // if configured. For this implementation, deleting from `profiles` might cascade
    // depending on the database setup, or we just mark them as banned.
    // Assuming simple deletion from public.profiles for now.
    const { error: dbError } = await supabase
      .from('profiles')
      .delete()
      .eq('id', id);

    if (dbError) throw dbError;

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
