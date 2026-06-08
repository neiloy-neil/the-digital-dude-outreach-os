import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createAuditLog } from '@/lib/audit/create-audit-log';
import { calculateLeadQuality, dedupeLeadRows } from '@/lib/leads/library';
import { isMissingTableError } from '@/lib/supabase/schema-errors';

function normalizeEmail(value: unknown): string {
  return String(value || '').trim().toLowerCase();
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { leads } = await request.json();
    if (!Array.isArray(leads) || leads.length === 0) {
      return NextResponse.json({ error: 'No leads provided' }, { status: 400 });
    }

    const { data: list, error: listError } = await supabase
      .from('lead_lists')
      .select('id')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (listError || !list) {
      if (isMissingTableError(listError, 'lead_lists')) {
        return NextResponse.json(
          { error: 'Lead lists are not available in this database yet. Apply the migration first.' },
          { status: 503 }
        );
      }
      return NextResponse.json({ error: 'Lead list not found' }, { status: 404 });
    }

    const normalizedRows = dedupeLeadRows(
      leads.map((lead: Record<string, unknown>) => ({
        ...lead,
        email: normalizeEmail(lead.email),
      }))
    );

    const { data: existingLeads } = await supabase
      .from('leads')
      .select('email, website, company_name, company, city, linkedin_url')
      .eq('lead_list_id', id);

    const existingEmails = new Set((existingLeads || []).map((lead) => normalizeEmail(lead.email)));
    const existingWebsites = new Set(
      (existingLeads || [])
        .map((lead) => normalizeEmail(lead.website).replace(/^https?:\/\//, ''))
        .filter(Boolean)
    );

    const payload = [];
    let imported = 0;
    let skippedDuplicates = 0;
    let invalidEmails = 0;
    let missingCompanyNames = 0;

    for (const lead of normalizedRows) {
      const email = normalizeEmail(lead.email);
      if (!email || !email.includes('@')) {
        invalidEmails++;
        continue;
      }

      const website = normalizeEmail(lead.website).replace(/^https?:\/\//, '');
      const companyName = String(lead.company_name || lead.company || '').trim();
      if (!companyName) {
        missingCompanyNames++;
      }

      if (existingEmails.has(email) || (website && existingWebsites.has(website))) {
        skippedDuplicates++;
        continue;
      }

      const quality = calculateLeadQuality(lead as Parameters<typeof calculateLeadQuality>[0]);
      payload.push({
        user_id: user.id,
        lead_list_id: id,
        is_global: true,
        owner_type: 'library',
        campaign_id: null,
        email,
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
        email_verified: Boolean(lead.email_verified),
        linkedin_url: lead.linkedin_url || null,
        tech_stack: lead.tech_stack || null,
        pain_points: lead.pain_points || null,
        solution: lead.solution || null,
        solution_score: lead.solution_score !== undefined && lead.solution_score !== null && lead.solution_score !== '' ? Number(lead.solution_score) : null,
        solution_fit_score: lead.solution_fit_score !== undefined && lead.solution_fit_score !== null && lead.solution_fit_score !== '' ? Number(lead.solution_fit_score) : null,
        lead_source: lead.lead_source || null,
        qc_by: lead.qc_by || null,
        outreach_channel: lead.outreach_channel || null,
        outreach_status: lead.outreach_status || null,
        priority: lead.priority || null,
        assigned_to: lead.assigned_to || null,
        tags: lead.tags || null,
        notes: lead.notes || null,
        follow_up_note: lead.follow_up_note || null,
        lead_owner: lead.lead_owner || null,
        deal_size: lead.deal_size ? Number(lead.deal_size) : null,
        pipeline_stage: lead.pipeline_stage || 'New',
        raw_data: lead.raw_data || {},
        data_quality_score: quality.score,
        data_quality_label: quality.label,
        status: 'imported',
        ai_status: 'pending',
        manual_personalization_status: 'not_started',
        is_global: true,
      });
    }

    if (payload.length > 0) {
      const { error: insertError } = await supabase.from('leads').insert(payload);
      if (insertError) throw insertError;
      imported = payload.length;
    }

    await createAuditLog({
      userId: user.id,
      action: 'lead_imported',
      message: `Imported ${imported} leads into lead list`,
      metadata: { lead_list_id: id, imported, skippedDuplicates, invalidEmails, missingCompanyNames },
    });

    return NextResponse.json({
      success: true,
      imported,
      skippedDuplicates,
      invalidEmails,
      missingCompanyNames,
      totalRows: leads.length,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error importing leads';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
