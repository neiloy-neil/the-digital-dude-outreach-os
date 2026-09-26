import { NextResponse } from 'next/server';
import { requireAdmin, requireAdminService } from '@/utils/supabase/admin';
import { createAuditLog } from '@/lib/audit/create-audit-log';

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
    const { authorized, error, status, supabase, user } = await requireAdmin();
    if (!authorized || !supabase) return NextResponse.json({ error }, { status: status || 401 });

    const { id, is_admin } = await request.json();

    if (!id) return NextResponse.json({ error: 'User ID required' }, { status: 400 });

    const { data: targetProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', id)
      .maybeSingle();

    const { error: dbError } = await supabase
      .from('profiles')
      .update({ is_admin })
      .eq('id', id);

    if (dbError) throw dbError;

    await createAuditLog({
      userId: user!.id,
      action: is_admin ? 'admin_role_granted' : 'admin_role_revoked',
      message: `${is_admin ? 'Granted' : 'Revoked'} admin access for user ${id}`,
      metadata: { target_user_id: id, target_existed: Boolean(targetProfile) },
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { authorized, error, status, supabase, user, serviceSupabase } = await requireAdminService();
    if (!authorized || !supabase || !serviceSupabase) return NextResponse.json({ error }, { status: status || 401 });

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) return NextResponse.json({ error: 'User ID required' }, { status: 400 });

    // Capture identifying info before deletion — nothing survives to look
    // it back up afterward, and we intentionally do NOT set this audit
    // log's user_id to the target (profiles.id cascade-deletes on
    // auth.users deletion, which would delete the very record of the
    // deletion along with it).
    const { data: targetProfile } = await supabase
      .from('profiles')
      .select('id, email')
      .eq('id', id)
      .maybeSingle();

    // Deleting the Auth user cascades to the profiles row (profiles.id
    // references auth.users on delete cascade) — this is the real
    // deletion; without it the person's session/login survives even
    // though their profile row is gone.
    const { error: authDeleteError } = await serviceSupabase.auth.admin.deleteUser(id);
    if (authDeleteError) throw authDeleteError;

    await createAuditLog({
      userId: user!.id,
      action: 'user_deleted',
      message: `Deleted user ${targetProfile?.email || id}`,
      metadata: { target_user_id: id, target_email: targetProfile?.email || null },
      supabase: serviceSupabase,
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
