import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createAuditLog } from '@/lib/audit/create-audit-log';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { id } = await params;

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const nextStatus = body?.status as string;

    if (!['active', 'paused', 'completed', 'draft'].includes(nextStatus)) {
      return NextResponse.json({ error: 'Invalid status value' }, { status: 400 });
    }

    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select('id, user_id, name, status, email_account_id, email_accounts (id, status, email_address)')
      .eq('id', id)
      .single();

    if (campaignError || !campaign || campaign.user_id !== user.id) {
      return NextResponse.json({ error: 'Campaign not found or access denied' }, { status: 403 });
    }

    const emailAccount = Array.isArray(campaign.email_accounts)
      ? campaign.email_accounts[0]
      : campaign.email_accounts;

    if (nextStatus === 'active') {
      if (!campaign.email_account_id) {
        return NextResponse.json({ error: 'Please add an email account before starting a campaign.' }, { status: 400 });
      }

      if (!emailAccount || emailAccount.status !== 'active') {
        return NextResponse.json({ error: 'Selected email account must be active before starting the campaign.' }, { status: 400 });
      }
    }

    const { error: updateError } = await supabase
      .from('campaigns')
      .update({
        status: nextStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    await createAuditLog({
      userId: user.id,
      campaignId: id,
      action:
        nextStatus === 'active'
          ? 'campaign_started'
          : nextStatus === 'paused'
            ? 'campaign_paused'
            : nextStatus === 'completed'
              ? 'campaign_completed'
              : 'campaign_updated',
      message: `Campaign ${nextStatus}`,
      metadata: {
        campaign_name: campaign.name,
        email_account_id: campaign.email_account_id || null,
        email_address: emailAccount?.email_address || null,
      },
    });

    return NextResponse.json({ success: true, status: nextStatus });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Server error updating campaign status';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
