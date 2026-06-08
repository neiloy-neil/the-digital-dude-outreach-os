import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createAuditLog } from '@/lib/audit/create-audit-log';
import { isMissingTableError } from '@/lib/supabase/schema-errors';

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('lead_lists')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    if (isMissingTableError(error, 'lead_lists')) {
      return NextResponse.json({ leadLists: [], warning: 'lead_lists table is not available yet.' });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ leadLists: data || [] });
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
    const { name, description, source } = await request.json();
    if (!name?.trim()) {
      return NextResponse.json({ error: 'Lead list name is required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('lead_lists')
      .insert({
        user_id: user.id,
        name: name.trim(),
        description: description || null,
        source: source || null,
      })
      .select('*')
      .single();

    if (error) {
      if (isMissingTableError(error, 'lead_lists')) {
        return NextResponse.json(
          { error: 'Lead lists are not available in this database yet. Apply the global lead library migration first.' },
          { status: 503 }
        );
      }
      throw error;
    }

    await createAuditLog({
      userId: user.id,
      action: 'lead_list_created',
      message: `Lead list created: ${name.trim()}`,
      metadata: { name: name.trim(), source: source || null },
    });

    return NextResponse.json({ success: true, leadList: data });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error creating lead list' },
      { status: 500 }
    );
  }
}
