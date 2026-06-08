import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createAuditLog } from '@/lib/audit/create-audit-log';

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
    const { leadIds, action, campaignId } = await request.json();
    if (!Array.isArray(leadIds) || leadIds.length === 0 || !action) {
      return NextResponse.json({ error: 'leadIds and action are required' }, { status: 400 });
    }

    if (action === 'add_to_campaign') {
      const response = await fetch(new URL('/api/lead-campaigns', request.url), {
        method: 'POST',
        headers: { cookie: request.headers.get('cookie') || '', 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadIds, campaignId }),
      });
      return NextResponse.json(await response.json(), { status: response.status });
    }

    const statusMap: Record<string, string> = {
      mark_interested: 'interested',
      mark_not_interested: 'not_interested',
      mark_do_not_contact: 'do_not_contact',
      mark_excluded: 'excluded',
    };

    const nextStatus = statusMap[action];
    if (!nextStatus) {
      return NextResponse.json({ error: 'Invalid bulk action' }, { status: 400 });
    }

    const { error } = await supabase
      .from('leads')
      .update({ status: nextStatus, updated_at: new Date().toISOString() })
      .in('id', leadIds)
      .eq('user_id', user.id);

    if (error) throw error;

    await createAuditLog({
      userId: user.id,
      action: 'bulk_lead_status_update',
      message: `Updated ${leadIds.length} lead(s) to ${nextStatus}`,
      metadata: { lead_ids: leadIds, status: nextStatus },
    });

    return NextResponse.json({ success: true, updated: leadIds.length, status: nextStatus });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Bulk update failed' }, { status: 500 });
  }
}
