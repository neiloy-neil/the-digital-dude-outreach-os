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
    const { leadIds, campaignId } = await request.json();

    if (!campaignId || !Array.isArray(leadIds) || leadIds.length === 0) {
      return NextResponse.json({ error: 'campaignId and leadIds are required' }, { status: 400 });
    }

    const { data: campaign } = await supabase
      .from('campaigns')
      .select('id, user_id')
      .eq('id', campaignId)
      .eq('user_id', user.id)
      .single();

    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found or access denied' }, { status: 403 });
    }

    const { data: leads } = await supabase
      .from('leads')
      .select('id, lead_list_id')
      .in('id', leadIds);

    const attachments = (leads || []).map((lead) => ({
      user_id: user.id,
      lead_id: lead.id,
      campaign_id: campaignId,
      status: 'added',
      current_step: 0,
    }));

    if (attachments.length > 0) {
      const { error } = await supabase
        .from('lead_campaigns')
        .upsert(attachments, { onConflict: 'lead_id,campaign_id' });
      if (error) throw error;

      await supabase
        .from('leads')
        .update({ updated_at: new Date().toISOString() })
        .in('id', leadIds);
    }

    await createAuditLog({
      userId: user.id,
      campaignId,
      action: 'lead_added_to_campaign',
      message: `Added ${attachments.length} lead(s) to campaign`,
      metadata: { campaign_id: campaignId, lead_ids: leadIds },
    });

    return NextResponse.json({ success: true, added: attachments.length });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error adding leads to campaign' }, { status: 500 });
  }
}
