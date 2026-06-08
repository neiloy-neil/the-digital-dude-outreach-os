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
    .from('email_templates_library')
    .select('id,name,category,subject,body,offer_type,is_default,created_at,updated_at')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) {
    if (isMissingTableError(error, 'email_templates_library')) {
      return NextResponse.json({ error: 'Template library is not available yet.' }, { status: 503 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: 'Template not found' }, { status: 404 });
  }

  return NextResponse.json({ template: data });
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
    const name = String(payload.name || '').trim();
    const subject = String(payload.subject || '').trim();
    const body = String(payload.body || '').trim();

    if (!name || !subject || !body) {
      return NextResponse.json({ error: 'Template name, subject, and body are required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('email_templates_library')
      .update({
        name,
        category: payload.category || null,
        subject,
        body,
        offer_type: payload.offer_type || null,
        is_default: Boolean(payload.is_default),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('user_id', user.id)
      .select('id,name,category,subject,body,offer_type,is_default,created_at,updated_at')
      .single();

    if (error) {
      if (isMissingTableError(error, 'email_templates_library')) {
        return NextResponse.json({ error: 'Template library is not available yet.' }, { status: 503 });
      }
      throw error;
    }

    await createAuditLog({
      userId: user.id,
      action: 'template_updated',
      message: `Template updated: ${data.name}`,
      metadata: { template_id: data.id, category: data.category || null },
    });

    return NextResponse.json({ success: true, template: data });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Error updating template' }, { status: 500 });
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
    .from('email_templates_library')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) {
    if (isMissingTableError(error, 'email_templates_library')) {
      return NextResponse.json({ error: 'Template library is not available yet.' }, { status: 503 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await createAuditLog({
    userId: user.id,
    action: 'template_deleted',
    message: `Template deleted: ${id}`,
    metadata: { template_id: id },
  });

  return NextResponse.json({ success: true });
}
