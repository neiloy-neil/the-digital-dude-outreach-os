import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

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

    // Process a max of the configured batch size to prevent gateway/serverless timeouts
    const batchLimit = Math.max(1, Number(profile?.max_bulk_ai_batch_size || 5));
    const batchLeads = leadIds.slice(0, batchLimit);

    const results = [];
    const baseUrl = request.url.split('/api/')[0];

    // Mark leads as processing first
    await supabase
      .from('leads')
      .update({ ai_status: 'processing', processing_started_at: new Date().toISOString(), processing_error: null })
      .in('id', batchLeads);

    // Run analyses
    for (const leadId of batchLeads) {
      try {
        const response = await fetch(`${baseUrl}/api/ai/analyze-lead`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cookie': request.headers.get('cookie') || '', // Forward cookie auth to inner route
          },
          body: JSON.stringify({ leadId, campaignId }),
        });

        const data = await response.json();
        if (!response.ok) {
          results.push({ id: leadId, success: false, error: data.error || 'Failed to analyze' });
        } else {
          results.push({ id: leadId, success: true });
        }
      } catch (err: any) {
        results.push({ id: leadId, success: false, error: err.message || 'Error occurred' });
        await supabase
          .from('leads')
          .update({ ai_status: 'failed', processing_error: err.message || 'AI processing failed' })
          .eq('id', leadId);
      }
    }

    return NextResponse.json({ results });
  } catch (err: any) {
    console.error('Bulk analyze crash:', err);
    return NextResponse.json({ error: err.message || 'Server error during bulk analyze' }, { status: 500 });
  }
}
