import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createServiceClient } from '@/utils/supabase/service';
import { createAuditLog } from '@/lib/audit/create-audit-log';
import { analyzeSingleLead } from '@/lib/ai/analyze-lead';

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
    const { leadIds, action, campaignId, tag, priority, leadListId } = await request.json();
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

    if (action === 'auto_research') {
      if (!campaignId) {
        return NextResponse.json({ error: 'campaignId is required for auto_research' }, { status: 400 });
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('max_bulk_ai_batch_size')
        .eq('id', user.id)
        .single();
      
      const batchLimit = Math.max(1, Number(profile?.max_bulk_ai_batch_size || 5));
      const batchLeads = leadIds.slice(0, batchLimit);
      const serviceSupabase = createServiceClient();

      // Mark leads as processing first
      await supabase
        .from('leads')
        .update({ ai_status: 'processing', processing_started_at: new Date().toISOString(), processing_error: null })
        .in('id', batchLeads);

      const promises = batchLeads.map((leadId: string) => 
        analyzeSingleLead({
          supabase,
          serviceSupabase,
          user,
          leadId,
          campaignId,
        }).catch((err: any) => {
          return { error: err.message };
        })
      );

      const results = await Promise.allSettled(promises);
      const output = results.map((result, i) => {
        const leadId = batchLeads[i];
        if (result.status === 'fulfilled' && !(result.value as any).error) {
           return { id: leadId, success: true, ...result.value };
        } else {
           const errReason = result.status === 'rejected' ? (result.reason as any)?.message : (result.value as any).error;
           // If error, we should also fail the lead here just in case analyzeSingleLead threw before updating DB
           supabase
             .from('leads')
             .update({ ai_status: 'failed', processing_error: errReason || 'AI processing failed' })
             .eq('id', leadId).then(); // fire and forget
           return { id: leadId, success: false, error: errReason || 'Failed to analyze' };
        }
      });

      return NextResponse.json({ success: true, processed: batchLeads.length, results: output });
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

    if (action === 'assign_to_list') {
      if (!leadListId) {
        return NextResponse.json({ error: 'leadListId is required for assign_to_list action' }, { status: 400 });
      }
      const { error } = await supabase
        .from('leads')
        .update({ lead_list_id: leadListId, updated_at: new Date().toISOString() })
        .in('id', leadIds)
        .eq('user_id', user.id);

      if (error) throw error;

      await createAuditLog({
        userId: user.id,
        action: 'bulk_lead_list_assign',
        message: `Assigned ${leadIds.length} lead(s) to lead list: ${leadListId}`,
        metadata: { lead_ids: leadIds, lead_list_id: leadListId },
      });

      return NextResponse.json({ success: true, updated: leadIds.length, leadListId });
    }

    if (action === 'mark_contacted') {
      const now = new Date().toISOString();
      const threeDaysFromNow = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
      const { error } = await supabase
        .from('leads')
        .update({
          status: 'mail_sent',
          emails_sent_count: 1,
          last_email_type: 'first_email',
          last_contacted_at: now,
          next_follow_up_at: threeDaysFromNow,
          updated_at: now,
        })
        .in('id', leadIds)
        .eq('user_id', user.id);

      if (error) throw error;

      await createAuditLog({
        userId: user.id,
        action: 'bulk_lead_contacted_update',
        message: `Marked ${leadIds.length} lead(s) as contacted`,
        metadata: { lead_ids: leadIds },
      });

      return NextResponse.json({ success: true, updated: leadIds.length, status: 'mail_sent' });
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
