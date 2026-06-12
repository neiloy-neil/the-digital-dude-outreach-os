import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { pool_id } = body;

    if (!pool_id) {
      return NextResponse.json({ error: 'Pool ID is required' }, { status: 400 });
    }

    // 1. Fetch the lead from the pool
    const { data: poolLead, error: poolError } = await supabase
      .from('admin_leads_pool')
      .select('*')
      .eq('id', pool_id)
      .single();

    if (poolError || !poolLead) {
      return NextResponse.json({ error: 'Lead not found in global pool' }, { status: 404 });
    }

    // 2. Map fields to the user's `leads` table
    const leadDataToInsert = {
      user_id: user.id,
      company_name: poolLead.company_name,
      company: poolLead.company_name,
      website: poolLead.website,
      industry: poolLead.industry,
      country: poolLead.location,
      first_name: poolLead.contact_name ? poolLead.contact_name.split(' ')[0] : null,
      last_name: poolLead.contact_name ? poolLead.contact_name.split(' ').slice(1).join(' ') : null,
      decision_maker_name: poolLead.contact_name,
      decision_maker_title: poolLead.contact_title,
      email: poolLead.contact_email || '',
      company_size: poolLead.employee_count,
      estimated_revenue: poolLead.revenue,
      tech_stack: poolLead.tech_stack,
      notes: poolLead.description,
      status: 'new'
    };

    // 3. Insert
    const { data: insertedLead, error: insertError } = await supabase
      .from('leads')
      .insert(leadDataToInsert)
      .select('id')
      .single();

    if (insertError) {
      console.error('Failed to pull lead:', insertError);
      return NextResponse.json({ error: 'Failed to add lead to your library' }, { status: 500 });
    }

    return NextResponse.json({ success: true, lead_id: insertedLead.id });
  } catch (error: any) {
    console.error('Pull API error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
