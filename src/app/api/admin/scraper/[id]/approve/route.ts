import { NextResponse } from 'next/server';
import { requireAdmin } from '@/utils/supabase/admin';
import { createAuditLog } from '@/lib/audit/create-audit-log';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const { authorized, error, status, supabase, user } = await requireAdmin();
    if (!authorized || !supabase) {
      return NextResponse.json({ error }, { status: status || 401 });
    }

    const { data: item, error: fetchError } = await supabase
      .from('admin_scraping_queue')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (fetchError) throw fetchError;
    if (!item) {
      return NextResponse.json({ error: 'Queue item not found' }, { status: 404 });
    }

    const { error: insertError } = await supabase
      .from('admin_leads_pool')
      .insert({
        company_name: item.company_name,
        website: item.website,
        description: item.description,
        contact_name: item.contact_name,
        contact_email: item.contact_email,
        pain_points: item.pain_points,
        ai_solution_angle: item.ai_solution_angle,
        recommended_offer: item.recommended_offer,
        ai_company_summary: item.ai_company_summary,
        ai_lead_analysis: item.ai_lead_analysis,
        ai_outreach_strategy: item.ai_outreach_strategy,
        ai_personalized_first_line: item.ai_personalized_first_line,
        tech_stack: item.tech_stack,
        funding_stage: item.funding_stage,
        total_raised: item.total_raised,
        employee_count: item.employee_count,
        year_founded: item.year_founded,
        ceo_name: item.ceo_name,
        email_source: item.email_source,
      });

    if (insertError) throw insertError;

    const { error: updateError } = await supabase
      .from('admin_scraping_queue')
      .update({ status: 'approved' })
      .eq('id', id);

    if (updateError) throw updateError;

    await createAuditLog({
      userId: user!.id,
      action: 'scraped_lead_approved',
      message: `Approved scraped lead "${item.company_name}" to the global pool`,
      metadata: { queue_item_id: id, company_name: item.company_name, website: item.website },
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
