import { NextResponse } from 'next/server';
import { requireAdmin } from '@/utils/supabase/admin';

export async function GET() {
  try {
    const { authorized, error, status, supabase } = await requireAdmin();
    if (!authorized || !supabase) {
      return NextResponse.json({ error }, { status: status || 401 });
    }

    // Parallel fetch
    const [
      { count: usersCount },
      { count: leadsCount },
      { count: subscriptionsCount },
      { count: waitlistCount }
    ] = await Promise.all([
      supabase.from('profiles').select('*', { count: 'exact', head: true }),
      supabase.from('admin_leads_pool').select('*', { count: 'exact', head: true }),
      supabase.from('profiles').select('*', { count: 'exact', head: true }).not('plan_id', 'is', null),
      supabase.from('waitlist').select('*', { count: 'exact', head: true })
    ]);

    return NextResponse.json({
      totalUsers: usersCount || 0,
      totalGlobalLeads: leadsCount || 0,
      activeSubscriptions: subscriptionsCount || 0,
      waitlistCount: waitlistCount || 0
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
