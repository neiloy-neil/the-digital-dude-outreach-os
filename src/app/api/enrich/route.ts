import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { runEnrichmentPipeline } from '@/lib/enrichment/pipeline';
import { requireAdmin } from '@/utils/supabase/admin';

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { target, leadId, isAdminPool, isStagingQueue } = body;

    if (!target) {
      return NextResponse.json({ error: 'Target email or domain is required' }, { status: 400 });
    }

    // Get the Gemini API key from the user's profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('gemini_api_key')
      .eq('id', user.id)
      .single();

    if (!profile?.gemini_api_key) {
      return NextResponse.json({ error: 'Gemini API key is not configured.' }, { status: 400 });
    }

    // Run the enrichment pipeline
    const enrichedData = await runEnrichmentPipeline(target, profile.gemini_api_key);

    // If a lead ID was provided, automatically update the lead
    if (leadId) {
      if (isAdminPool || isStagingQueue) {
        const { authorized } = await requireAdmin();
        if (!authorized) {
          return NextResponse.json({ error: 'Unauthorized to update global pool' }, { status: 403 });
        }
        
        if (isStagingQueue) {
          // Update the scraping queue directly (includes all AI fields)
          await supabase.from('admin_scraping_queue').update(enrichedData).eq('id', leadId);
        } else {
          // Omit AI analysis fields that don't exist in admin_leads_pool schema
          const { 
            pain_points, ai_solution_angle, recommended_offer, ai_company_summary, 
            ai_lead_analysis, ai_outreach_strategy, ai_personalized_first_line, 
            ...adminPoolData 
          } = enrichedData;

          await supabase.from('admin_leads_pool').update(adminPoolData).eq('id', leadId);
        }
      } else {
        // Update user's specific lead
        await supabase.from('leads').update(enrichedData).eq('id', leadId).eq('user_id', user.id);
      }
    }

    return NextResponse.json({ success: true, data: enrichedData });
  } catch (error: any) {
    console.error('Enrichment API error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
