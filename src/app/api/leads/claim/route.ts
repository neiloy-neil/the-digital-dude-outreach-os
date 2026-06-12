import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function POST(request: Request) {
  try {
    const { leadIds } = await request.json();

    if (!leadIds || !Array.isArray(leadIds) || leadIds.length === 0) {
      return NextResponse.json({ error: 'No leads specified' }, { status: 400 });
    }

    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!, // Using service role to copy records robustly
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
          set(name: string, value: string, options: any) {
            cookieStore.set({ name, value, ...options });
          },
          remove(name: string, options: any) {
            cookieStore.set({ name, value: '', ...options });
          },
        },
      }
    );

    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;

    // Check subscription status
    const { data: profile } = await supabase
      .from('profiles')
      .select('plan_id')
      .eq('id', userId)
      .single();

    // Ideally, enforce the subscription limit/tier here
    // if (!profile?.plan_id) return NextResponse.json({ error: 'Subscription required' }, { status: 403 });

    // Fetch the leads from the admin pool
    const { data: adminLeads, error: fetchError } = await supabase
      .from('admin_leads_pool')
      .select('*')
      .in('id', leadIds);

    if (fetchError || !adminLeads) {
      return NextResponse.json({ error: 'Failed to fetch admin leads' }, { status: 500 });
    }

    // Map admin leads to the regular leads structure
    const newLeads = adminLeads.map((lead) => ({
      user_id: userId,
      company_name: lead.company_name,
      website: lead.website,
      industry: lead.industry,
      location: lead.location,
      first_name: lead.contact_name?.split(' ')[0] || '',
      last_name: lead.contact_name?.split(' ').slice(1).join(' ') || '',
      email: lead.contact_email,
      linkedin_url: lead.contact_linkedin,
      company_linkedin_url: lead.company_linkedin,
      employee_count: lead.employee_count,
      revenue: lead.revenue,
      tags: lead.tags || [],
      owner_type: 'library',
      is_global: false,
      status: 'Not Contacted'
    }));

    const { error: insertError } = await supabase
      .from('leads')
      .insert(newLeads);

    if (insertError) {
      console.error('Insert Error:', insertError);
      return NextResponse.json({ error: 'Failed to add leads to your library' }, { status: 500 });
    }

    return NextResponse.json({ success: true, count: newLeads.length });
  } catch (error: any) {
    console.error('Claim Leads Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
