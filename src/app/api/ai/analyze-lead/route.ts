import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createServiceClient } from '@/utils/supabase/service';
import { analyzeSingleLead } from '@/lib/ai/analyze-lead';

export async function POST(request: Request) {
  const supabase = await createClient();
  const serviceSupabase = createServiceClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let requestBody: any = {};
  try {
    requestBody = await request.json();
    const { leadId, campaignId, requestedDepth, requestedMode } = requestBody;

    if (!leadId || !campaignId) {
      return NextResponse.json({ error: 'leadId and campaignId are required' }, { status: 400 });
    }

    const response = await analyzeSingleLead({
      supabase,
      serviceSupabase,
      user,
      leadId,
      campaignId,
      requestedDepth,
      requestedMode,
    });

    return NextResponse.json(response);
  } catch (error: unknown) {
    console.error('Lead analysis route crash:', error);
    const errorMessage = error instanceof Error ? error.message : 'AI analysis failed';

    try {
      const { leadId } = requestBody;
      if (leadId) {
        await supabase
          .from('leads')
          .update({
            ai_status: 'failed',
            processing_error: errorMessage,
            updated_at: new Date().toISOString(),
          })
          .eq('id', leadId);
      }
    } catch {}

    return NextResponse.json({ error: errorMessage || 'Server error during lead analysis' }, { status: 500 });
  }
}
