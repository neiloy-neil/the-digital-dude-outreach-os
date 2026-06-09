import { NextResponse } from 'next/server';

import { createAuditLog } from '@/lib/audit/create-audit-log';
import { buildLeadEmailVerificationFields, verifyEmailLocally, type EmailVerificationStatus } from '@/lib/email-verification/local-verify';
import { updateLeadWithVerificationFallback } from '@/lib/email-verification/persist';
import { isMissingTableError } from '@/lib/supabase/schema-errors';
import { createServiceClient } from '@/utils/supabase/service';
import { createClient } from '@/utils/supabase/server';

const MAX_BULK_VERIFY = 25;

type VerificationSummary = Record<EmailVerificationStatus | 'total', number>;

function createSummary(): VerificationSummary {
  return {
    total: 0,
    valid: 0,
    risky: 0,
    invalid: 0,
    role_based: 0,
    disposable: 0,
    suppressed: 0,
    unknown: 0,
    failed: 0,
    not_checked: 0,
  };
}

async function assertLeadOwnership(
  userId: string,
  leads: Array<{ id: string; user_id?: string | null; campaign_id?: string | null; lead_list_id?: string | null }>
) {
  const serviceSupabase = createServiceClient();

  const campaignIds = Array.from(new Set(leads.map((lead) => lead.campaign_id).filter(Boolean))) as string[];
  const leadListIds = Array.from(new Set(leads.map((lead) => lead.lead_list_id).filter(Boolean))) as string[];

  const [campaignResponse, leadListResponse] = await Promise.all([
    campaignIds.length > 0
      ? serviceSupabase.from('campaigns').select('id, user_id').in('id', campaignIds)
      : Promise.resolve({ data: [] as Array<{ id: string; user_id: string }>, error: null }),
    leadListIds.length > 0
      ? serviceSupabase.from('lead_lists').select('id, user_id').in('id', leadListIds)
      : Promise.resolve({ data: [] as Array<{ id: string; user_id: string }>, error: null }),
  ]);

  if (campaignResponse.error) {
    throw new Error(campaignResponse.error.message);
  }

  if (leadListResponse.error) {
    if (isMissingTableError(leadListResponse.error, 'lead_lists')) {
      throw new Error('Lead lists are not available in this database yet. Apply the migration first.');
    }
    throw new Error(leadListResponse.error.message);
  }

  const campaignOwnerMap = new Map((campaignResponse.data || []).map((campaign) => [campaign.id, campaign.user_id]));
  const leadListOwnerMap = new Map((leadListResponse.data || []).map((list) => [list.id, list.user_id]));

  for (const lead of leads) {
    if (lead.user_id === userId) continue;
    if (lead.campaign_id && campaignOwnerMap.get(lead.campaign_id) === userId) continue;
    if (lead.lead_list_id && leadListOwnerMap.get(lead.lead_list_id) === userId) continue;
    return false;
  }

  return true;
}

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

  try {
    const { lead_ids: leadIds, checkMx = false } = await request.json();

    if (!Array.isArray(leadIds) || leadIds.length === 0) {
      return NextResponse.json({ error: 'lead_ids is required' }, { status: 400 });
    }

    if (leadIds.length > MAX_BULK_VERIFY) {
      return NextResponse.json({ error: `You can verify at most ${MAX_BULK_VERIFY} leads per request.` }, { status: 400 });
    }

    const uniqueLeadIds = Array.from(new Set(leadIds.map((id) => String(id).trim()).filter(Boolean)));
    if (uniqueLeadIds.length === 0) {
      return NextResponse.json({ error: 'lead_ids is required' }, { status: 400 });
    }

    if (uniqueLeadIds.length > MAX_BULK_VERIFY) {
      return NextResponse.json({ error: `You can verify at most ${MAX_BULK_VERIFY} leads per request.` }, { status: 400 });
    }

    const { data: leads, error: leadsError } = await serviceSupabase
      .from('leads')
      .select('id, email, user_id, campaign_id, lead_list_id')
      .in('id', uniqueLeadIds);

    if (leadsError) {
      throw new Error(leadsError.message);
    }

    if (!leads || leads.length !== uniqueLeadIds.length) {
      return NextResponse.json({ error: 'One or more leads could not be found.' }, { status: 404 });
    }

    const hasOwnership = await assertLeadOwnership(user.id, leads);
    if (!hasOwnership) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const summary = createSummary();
    summary.total = leads.length;
    const strippedVerificationColumns = new Set<string>();

    for (const lead of leads) {
      const verification = await verifyEmailLocally({
        email: lead.email,
        userId: user.id,
        checkMx: Boolean(checkMx),
      });

      const verificationFields = buildLeadEmailVerificationFields(verification);

      const { error: updateError, strippedColumns } = await updateLeadWithVerificationFallback({
        supabase: serviceSupabase,
        leadId: lead.id,
        payload: {
          ...verificationFields,
          updated_at: new Date().toISOString(),
        },
      });

      if (updateError) {
        throw new Error(updateError.message);
      }
      strippedColumns.forEach((column) => strippedVerificationColumns.add(column));

      summary[verification.status] += 1;

      const action = verification.status === 'failed' ? 'email_verification_failed' : 'email_verified';
      await createAuditLog({
        userId: user.id,
        campaignId: lead.campaign_id || null,
        leadId: lead.id,
        action,
        message: `Email verification ${verification.status} for ${lead.email}`,
        metadata: {
          email: lead.email,
          check_mx: Boolean(checkMx),
          verification_status: verification.status,
          verification_score: verification.score,
          verification_reason: verification.reason,
        },
      });
    }

    return NextResponse.json({
      success: true,
      checkMx: Boolean(checkMx),
      summary: {
        total: summary.total,
        valid: summary.valid,
        risky: summary.risky,
        invalid: summary.invalid,
        role_based: summary.role_based,
        disposable: summary.disposable,
        suppressed: summary.suppressed,
        unknown: summary.unknown,
        failed: summary.failed,
      },
      warning:
        strippedVerificationColumns.size > 0
          ? `Lead verification columns are missing in this database: ${Array.from(strippedVerificationColumns).join(', ')}. Run the latest migration to persist full verification data.`
          : null,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Bulk email verification failed' },
      { status: 500 }
    );
  }
}
