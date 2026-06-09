import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createAuditLog } from '@/lib/audit/create-audit-log';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const resolvedParams = await params;
  const campaignId = resolvedParams.id;
  const supabase = await createClient();

  // 1. Authenticate user
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { leadId, action, subject, body } = await request.json();

    if (!leadId) {
      return NextResponse.json({ error: 'leadId is required' }, { status: 400 });
    }

    if (!['approve', 'skip'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action: must be approve or skip' }, { status: 400 });
    }

    // Verify campaign ownership
    const { data: campaign } = await supabase
      .from('campaigns')
      .select('user_id')
      .eq('id', campaignId)
      .single();

    if (!campaign || campaign.user_id !== user.id) {
      return NextResponse.json({ error: 'Campaign not found or access denied' }, { status: 403 });
    }

    if (action === 'approve') {
      // 1. Fetch Step 1 of the sequence
      const { data: sequences } = await supabase
        .from('sequences')
        .select('id, delay_days')
        .eq('campaign_id', campaignId)
        .eq('step_number', 1)
        .maybeSingle();

      if (!sequences) {
        return NextResponse.json({ error: 'Please save your outreach sequence steps before approving leads' }, { status: 400 });
      }

      const scheduledAt = new Date();
      scheduledAt.setDate(scheduledAt.getDate() + sequences.delay_days);

      // 2. Update lead columns
      const { error: leadError } = await supabase
        .from('leads')
        .update({
          approval_status: 'approved',
          ai_status: 'approved',
          ai_approved_at: new Date().toISOString(),
          personalized_subject: subject || null,
          personalized_body: body || null,
          status: 'ready',
          current_step: 0,
          next_email_at: scheduledAt.toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', leadId);

      if (leadError) throw leadError;

      // 3. Queue Step 1 in the outbox
      // Delete any existing pending outbox for this lead first to prevent duplicates
      await supabase
        .from('outbox')
        .delete()
        .eq('lead_id', leadId)
        .eq('status', 'pending');

      const { error: outboxError } = await supabase
        .from('outbox')
        .insert({
          lead_id: leadId,
          sequence_id: sequences.id,
          scheduled_at: scheduledAt.toISOString(),
          status: 'pending',
        });

      if (outboxError) throw outboxError;

      await createAuditLog({
        userId: user.id,
        campaignId,
        leadId,
        action: 'email_approved',
        message: `Lead approved for sending`,
        metadata: {
          subject: subject || null,
        },
      });

      return NextResponse.json({ success: true, status: 'approved' });
    } else {
      // Action is skip
      const { error: leadError } = await supabase
        .from('leads')
        .update({
          approval_status: 'skipped',
          ai_status: 'edited',
          updated_at: new Date().toISOString(),
        })
        .eq('id', leadId);

      if (leadError) throw leadError;

      // Cancel any pending outbox items
      await supabase
        .from('outbox')
        .update({ status: 'cancelled', error_message: 'Lead skipped by user' })
        .eq('lead_id', leadId)
        .eq('status', 'pending');

      await createAuditLog({
        userId: user.id,
        campaignId,
        leadId,
        action: 'lead_excluded',
        message: 'Lead skipped by user',
      });

      return NextResponse.json({ success: true, status: 'skipped' });
    }
  } catch (err: any) {
    console.error('Approve/skip lead crash:', err);
    return NextResponse.json({ error: err.message || 'Server error processing approval' }, { status: 500 });
  }
}
