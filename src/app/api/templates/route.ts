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
    .from('email_templates_library')
    .select('id,name,category,subject,body,offer_type,is_default,created_at,updated_at')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false });

  if (error) {
    if (isMissingTableError(error, 'email_templates_library')) {
      return NextResponse.json({ templates: [], warning: 'Template library is not available yet.' });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ templates: data || [] });
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
    const payload = await request.json();
    if (!String(payload.name || '').trim() || !String(payload.subject || '').trim() || !String(payload.body || '').trim()) {
      return NextResponse.json({ error: 'Template name, subject, and body are required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('email_templates_library')
      .insert({
        user_id: user.id,
        name: String(payload.name).trim(),
        category: payload.category || null,
        subject: String(payload.subject).trim(),
        body: String(payload.body).trim(),
        offer_type: payload.offer_type || null,
        is_default: Boolean(payload.is_default),
      })
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
      action: 'template_created',
      message: `Template created: ${data.name}`,
      metadata: { template_id: data.id, category: data.category || null },
    });

    return NextResponse.json({ success: true, template: data });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Error creating template' }, { status: 500 });
  }
}

