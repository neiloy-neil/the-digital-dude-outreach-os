import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { calculateLeadDataQuality } from '@/utils/data-quality';
import { createAuditLog } from '@/lib/audit/create-audit-log';
import { buildLeadEmailVerificationFields, verifyEmailLocally } from '@/lib/email-verification/local-verify';
import { insertLeadsWithVerificationFallback } from '@/lib/email-verification/persist';

function toNullableNumber(value: unknown): number | null {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

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
    const { leads, importInvalidRows = false } = await request.json();

    if (!leads || !Array.isArray(leads)) {
      return NextResponse.json({ error: 'leads array is required' }, { status: 400 });
    }

    // Verify campaign ownership
    const { data: campaign, error: campError } = await supabase
      .from('campaigns')
      .select('id, ai_depth, ai_mode')
      .eq('id', campaignId)
      .eq('user_id', user.id)
      .single();

    if (campError || !campaign) {
      return NextResponse.json({ error: 'Campaign not found or access denied' }, { status: 403 });
    }

    // Fetch existing emails in this campaign to skip duplicates
    const { data: existingLeads } = await supabase
      .from('leads')
      .select('email')
      .eq('campaign_id', campaignId);

    const existingEmails = new Set((existingLeads || []).map(l => l.email.toLowerCase().trim()));

    // Counters
    const totalRows = leads.length;
    let imported = 0;
    let skippedDuplicates = 0;
    let invalidEmails = 0;
    let roleBasedEmails = 0;
    let disposableEmails = 0;
    let suppressedEmails = 0;
    let missingCompanyNames = 0;
    let verificationWarning: string | null = null;
    const leadsToInsert = [];
    const processedEmailsInBatch = new Set<string>();

    for (const lead of leads) {
      const email = String(lead.email || '').trim().toLowerCase();

      // Check Duplicates in database or inside this upload batch
      if (existingEmails.has(email) || processedEmailsInBatch.has(email)) {
        skippedDuplicates++;
        continue;
      }

      processedEmailsInBatch.add(email);

      // Track missing company names
      const companyName = lead.company_name || lead.company || '';
      if (!companyName) {
        missingCompanyNames++;
      }

      const verification = await verifyEmailLocally({
        email,
        userId: user.id,
        checkMx: false,
      });

      if (verification.status === 'invalid') invalidEmails++;
      if (verification.status === 'role_based') roleBasedEmails++;
      if (verification.status === 'disposable') disposableEmails++;
      if (verification.status === 'suppressed') suppressedEmails++;

      if (verification.status === 'invalid' && !importInvalidRows) {
        continue;
      }

      // Calculate quality metrics
      const { score, label } = calculateLeadDataQuality(lead);

      leadsToInsert.push({
        user_id: user.id,
        campaign_id: campaignId,
        lead_list_id: null,
        is_global: true,
        owner_type: 'campaign',
        email: email,
        first_name: lead.first_name || null,
        last_name: lead.last_name || null,
        company: companyName || null,
        company_name: companyName || null,
        website: lead.website || null,
        industry: lead.industry || null,
        sub_industry: lead.sub_industry || null,
        country: lead.country || null,
        city: lead.city || null,
        company_size: lead.company_size || null,
        estimated_revenue: lead.estimated_revenue || null,
        decision_maker_name: lead.decision_maker_name || null,
        decision_maker_title: lead.decision_maker_title || null,
        linkedin_url: lead.linkedin_url || null,
        tech_stack: lead.tech_stack || null,
        pain_points: lead.pain_points || null,
        solution: lead.solution || null,
        solution_score: toNullableNumber(lead.solution_score),
        solution_fit_score: toNullableNumber(lead.solution_fit_score),
        lead_source: lead.lead_source || null,
        qc_by: lead.qc_by || null,
        outreach_channel: lead.outreach_channel || null,
        outreach_status: lead.outreach_status || null,
        priority: lead.priority || null,
        assigned_to: lead.assigned_to || null,
        tags: lead.tags || null,
        notes: lead.notes || null,
        raw_data: lead.raw_data || {},
        data_quality_score: score,
        data_quality_label: label,
        ai_depth: campaign.ai_depth || 'basic',
        status: 'imported',
        ai_status: 'pending',
        manual_personalization_status: 'not_started',
        approval_status: 'pending_review',
        ...buildLeadEmailVerificationFields(verification),
      });
    }

    if (leadsToInsert.length > 0) {
      const { data: insertedLeads, error: insertError, strippedColumns } = await insertLeadsWithVerificationFallback({
        supabase,
        rows: leadsToInsert,
        select: 'id, email, company_name, company',
      });

      if (insertError) throw insertError;
      imported = insertedLeads?.length || leadsToInsert.length;
      if (strippedColumns.length > 0) {
        verificationWarning = `Lead verification columns are missing in this database: ${strippedColumns.join(', ')}. Run the latest migration to persist full verification data.`;
      }

      await Promise.all(
        ((insertedLeads || []) as Array<{ id: string; email: string; company_name?: string | null; company?: string | null }>).map((lead) =>
          createAuditLog({
            userId: user.id,
            campaignId,
            leadId: lead.id,
            action: 'lead_imported',
            message: `Lead imported for ${lead.email}`,
            metadata: {
              email: lead.email,
              company: lead.company_name || lead.company || null,
            },
          })
        )
      );
    }

    return NextResponse.json({
      success: true,
      totalRows,
      imported,
      skippedDuplicates,
      invalidEmails,
      roleBasedEmails,
      disposableEmails,
      suppressedEmails,
      missingCompanyNames,
      warning: verificationWarning,
    });
  } catch (err: unknown) {
    console.error('Batch import leads crash:', err);
    const message = err instanceof Error ? err.message : 'Server error executing batch lead import';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
