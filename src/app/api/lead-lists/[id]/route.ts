import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createAuditLog } from '@/lib/audit/create-audit-log';
import { isMissingTableError } from '@/lib/supabase/schema-errors';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
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
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (error || !data) {
    if (isMissingTableError(error, 'lead_lists')) {
      return NextResponse.json({ error: 'Lead lists are not available in this database yet.' }, { status: 503 });
    }
    return NextResponse.json({ error: 'Lead list not found' }, { status: 404 });
  }

  return NextResponse.json({ leadList: data });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const payload = await request.json();
    const { error } = await supabase
      .from('lead_lists')
      .update({
        name: payload.name,
        description: payload.description || null,
        source: payload.source || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      if (isMissingTableError(error, 'lead_lists')) {
        return NextResponse.json(
          { error: 'Lead lists are not available in this database yet. Apply the migration first.' },
          { status: 503 }
        );
      }
      throw error;
    }

    await createAuditLog({
      userId: user.id,
      action: 'lead_updated',
      message: `Lead list updated: ${id}`,
      metadata: { lead_list_id: id },
    });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error updating lead list' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { error } = await supabase
    .from('lead_lists')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) {
    if (isMissingTableError(error, 'lead_lists')) {
      return NextResponse.json({ error: 'Lead lists are not available in this database yet.' }, { status: 503 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await createAuditLog({
    userId: user.id,
    action: 'lead_updated',
    message: `Lead list deleted: ${id}`,
    metadata: { lead_list_id: id },
  });

  return NextResponse.json({ success: true });
}
