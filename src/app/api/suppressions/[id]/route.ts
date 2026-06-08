import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createAuditLog } from '@/lib/audit/create-audit-log';
import { isMissingTableError } from '@/lib/supabase/schema-errors';

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
    .from('suppressions')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) {
    if (isMissingTableError(error, 'suppressions')) {
      return NextResponse.json({ error: 'Suppression table is not available yet.' }, { status: 503 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await createAuditLog({
    userId: user.id,
    action: 'suppression_deleted',
    message: `Suppression removed: ${id}`,
    metadata: { suppression_id: id },
  });

  return NextResponse.json({ success: true });
}

