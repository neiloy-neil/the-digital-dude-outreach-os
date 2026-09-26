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
      .select('id, company_name')
      .eq('id', id)
      .maybeSingle();

    if (fetchError) throw fetchError;
    if (!item) {
      return NextResponse.json({ error: 'Queue item not found' }, { status: 404 });
    }

    const { error: updateError } = await supabase
      .from('admin_scraping_queue')
      .update({ status: 'rejected' })
      .eq('id', id);

    if (updateError) throw updateError;

    await createAuditLog({
      userId: user!.id,
      action: 'scraped_lead_rejected',
      message: `Rejected scraped lead "${item.company_name}"`,
      metadata: { queue_item_id: id, company_name: item.company_name },
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
