import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single();

    if (!profile?.is_admin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const resolvedParams = await params;
    const body = await request.json();
    const id = resolvedParams.id;

    const updates: any = {};
    if (body.status !== undefined) updates.status = body.status;
    if (body.admin_notes !== undefined) updates.admin_notes = body.admin_notes;

    if (body.status === 'invited') {
      updates.invited_at = new Date().toISOString();
    }
    if (['reviewed', 'invited', 'accepted', 'rejected'].includes(body.status)) {
      updates.reviewed_at = new Date().toISOString();
    }

    const { error } = await supabase
      .from('waitlist_signups')
      .update(updates)
      .eq('id', id);

    if (error) {
      throw error;
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Waitlist PATCH error:', error);
    return NextResponse.json({ error: 'Failed to update waitlist' }, { status: 500 });
  }
}
