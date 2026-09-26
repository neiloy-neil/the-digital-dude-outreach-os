import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createServiceClient } from '@/utils/supabase/service';
import { analyzeSingleLead } from '@/lib/ai/analyze-lead';
import { getAiSettingsForUser } from '@/lib/ai/runtime';
import { runWithConcurrencyLimit } from '@/lib/concurrency';

const CONCURRENCY_LIMIT = 3;

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

    const aiSettings = await getAiSettingsForUser(supabase, user.id);
    const batchLimit = Math.max(1, Number(aiSettings.max_bulk_ai_batch_size || 5));
    const batchLeads = leadIds.slice(0, batchLimit);
    const serviceSupabase = createServiceClient();

    // Mark leads as processing first
    await supabase
      .from('leads')
      .update({ ai_status: 'processing', processing_started_at: new Date().toISOString(), processing_error: null })
      .in('id', batchLeads);

    const resultsRaw = await runWithConcurrencyLimit(batchLeads, CONCURRENCY_LIMIT, (leadId: string) =>
      analyzeSingleLead({
        supabase,
        serviceSupabase,
        user,
        leadId,
        campaignId,
      })
    );
    const results = resultsRaw.map((result, i) => {
      const leadId = batchLeads[i];
      if (result.status === 'fulfilled' && !(result.value as any).error) {
         return { id: leadId, ...result.value };
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
