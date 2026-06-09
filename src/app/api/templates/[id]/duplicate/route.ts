import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createAuditLog } from '@/lib/audit/create-audit-log';
import { isMissingTableError } from '@/lib/supabase/schema-errors';

export async function POST(
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

  try {
    const { data: template, error: loadError } = await supabase
      .from('email_templates_library')
      .select('name,category,subject,body,offer_type,is_default')
      .eq('id', id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (loadError) {
      if (isMissingTableError(loadError, 'email_templates_library')) {
        return NextResponse.json({ error: 'Template library is not available yet.' }, { status: 503 });
      }
      throw loadError;
    }

    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    const { data: duplicated, error: insertError } = await supabase
      .from('email_templates_library')
      .insert({
        user_id: user.id,
        name: `${template.name} Copy`,
        category: template.category || null,
        subject: template.subject,
        body: template.body,
        offer_type: template.offer_type || null,
        is_default: false,
      })
      .select('id,name,category,subject,body,offer_type,is_default,created_at,updated_at')
      .single();

    if (insertError) throw insertError;

    await createAuditLog({
      userId: user.id,
      action: 'template_duplicated',
      message: `Template duplicated: ${template.name}`,
      metadata: { source_template_id: id, template_id: duplicated.id },
    });

    return NextResponse.json({ success: true, template: duplicated });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Error duplicating template' }, { status: 500 });
  }
}
