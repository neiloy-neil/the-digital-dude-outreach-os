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
    const { leadIds, action, campaignId, tag, priority } = await request.json();
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

    if (action === 'add_tag') {
      const nextTag = String(tag || '').trim();
      if (!nextTag) {
        return NextResponse.json({ error: 'Tag is required' }, { status: 400 });
      }

      const { data: leads, error: leadsError } = await supabase
        .from('leads')
        .select('id, tags')
        .in('id', leadIds)
        .eq('user_id', user.id);

      if (leadsError) throw leadsError;

      await Promise.all(
        (leads || []).map((lead) => {
          const tags = String(lead.tags || '')
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean);
          const normalizedTags = Array.from(new Set([...tags, nextTag]));
          return supabase
            .from('leads')
            .update({ tags: normalizedTags.join(', '), updated_at: new Date().toISOString() })
            .eq('id', lead.id)
            .eq('user_id', user.id);
        })
      );

      await createAuditLog({
        userId: user.id,
        action: 'bulk_lead_tag_added',
        message: `Added tag "${nextTag}" to ${leads?.length || 0} lead(s)`,
        metadata: { lead_ids: leadIds, tag: nextTag },
      });

      return NextResponse.json({ success: true, updated: leads?.length || 0, tag: nextTag });
    }

    if (action === 'change_priority') {
      const nextPriority = String(priority || '').trim();
      if (!['low', 'normal', 'medium', 'high'].includes(nextPriority)) {
        return NextResponse.json({ error: 'Valid priority is required' }, { status: 400 });
      }

      const { error } = await supabase
        .from('leads')
        .update({ priority: nextPriority, updated_at: new Date().toISOString() })
        .in('id', leadIds)
        .eq('user_id', user.id);

      if (error) throw error;

      await createAuditLog({
        userId: user.id,
        action: 'bulk_lead_priority_update',
        message: `Updated ${leadIds.length} lead(s) to ${nextPriority} priority`,
        metadata: { lead_ids: leadIds, priority: nextPriority },
      });

      return NextResponse.json({ success: true, updated: leadIds.length, priority: nextPriority });
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
