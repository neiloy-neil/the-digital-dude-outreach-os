import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createServiceClient } from '@/utils/supabase/service';
import { analyzeSingleLead } from '@/lib/ai/analyze-lead';

export async function POST(request: Request) {
  const supabase = await createClient();

  // 1. Authenticate user
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { leadIds, campaignId } = await request.json();

    if (!leadIds || !Array.isArray(leadIds) || leadIds.length === 0 || !campaignId) {
      return NextResponse.json({ error: 'leadIds array and campaignId are required' }, { status: 400 });
    }

    // Verify campaign ownership
    const { data: campaign, error: campError } = await supabase
      .from('campaigns')
      .select('id')
      .eq('id', campaignId)
      .eq('user_id', user.id)
      .single();

    if (campError || !campaign) {
      return NextResponse.json({ error: 'Campaign not found or access denied' }, { status: 403 });
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

    const resultsRaw = await Promise.allSettled(promises);
    const results = resultsRaw.map((result, i) => {
      const leadId = batchLeads[i];
      if (result.status === 'fulfilled' && !(result.value as any).error) {
         return { id: leadId, success: true, ...result.value };
      } else {
         const errReason = result.status === 'rejected' ? (result.reason as any)?.message : (result.value as any).error;
         supabase
           .from('leads')
           .update({ ai_status: 'failed', processing_error: errReason || 'AI processing failed' })
           .eq('id', leadId).then();
         return { id: leadId, success: false, error: errReason || 'Failed to analyze' };
      }
    });

    return NextResponse.json({ results });
  } catch (err: any) {
    console.error('Bulk analyze crash:', err);
    return NextResponse.json({ error: err.message || 'Server error during bulk analyze' }, { status: 500 });
  }
}
