import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { data: views, error } = await supabase
      .from('saved_views')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ savedViews: views || [] });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error fetching saved views';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { name, filters, is_default } = await request.json();
    if (!name || !filters) {
      return NextResponse.json({ error: 'Name and filters are required' }, { status: 400 });
    }

    if (is_default) {
      // Set all other views to false first
      await supabase
        .from('saved_views')
        .update({ is_default: false })
        .eq('user_id', user.id);
    }

    const { data: view, error } = await supabase
      .from('saved_views')
      .insert({
        user_id: user.id,
        name,
        filters,
        is_default: Boolean(is_default),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select('*')
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, savedView: view });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error creating saved view';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const id = url.searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 });
  }

  try {
    const { error } = await supabase
      .from('saved_views')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error deleting saved view';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id, is_default } = await request.json();
    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    if (is_default) {
      // Set all other views to false first
      await supabase
        .from('saved_views')
        .update({ is_default: false })
        .eq('user_id', user.id);
    }

    const { data: view, error } = await supabase
      .from('saved_views')
      .update({
        is_default: Boolean(is_default),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('user_id', user.id)
      .select('*')
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, savedView: view });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error updating saved view';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
