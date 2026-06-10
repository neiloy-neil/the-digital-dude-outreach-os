import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createServiceClient } from '@/utils/supabase/service';
import { createAuditLog } from '@/lib/audit/create-audit-log';
import { calculateLeadQuality } from '@/lib/leads/library';
import { htmlToPlainText } from '@/lib/email/html';
import { isMissingTableError } from '@/lib/supabase/schema-errors';

export async function GET(
  _request: Request,
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

  const { data, error } = await supabase.from('leads').select('*').eq('id', id).maybeSingle();

  if (error || !data) {
    return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
  }

  const leadListResponse = data.lead_list_id
    ? await supabase.from('lead_lists').select('id, name, description, user_id').eq('id', data.lead_list_id).maybeSingle()
    : { data: null };
  const campaignResponse = data.campaign_id
    ? await supabase.from('campaigns').select('id, name, offer_type, user_id').eq('id', data.campaign_id).maybeSingle()
    : { data: null };
  const leadList = leadListResponse.data;
  const campaign = campaignResponse.data;
  const { data: profile } = await supabase
    .from('profiles')
    .select('outreach_company_name,outreach_company_website,outreach_company_description,outreach_offers_services,outreach_value_proposition,outreach_target_customers,outreach_proof_points')
    .eq('id', user.id)
    .maybeSingle();

  if (data.user_id !== user.id) {
    if (campaign) {
      const { data: camp } = await supabase
        .from('campaigns')
        .select('user_id')
        .eq('id', campaign.id)
        .single();
      if (!camp || camp.user_id !== user.id) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
    } else if (leadList) {
      const { data: list, error: listError } = await supabase
        .from('lead_lists')
        .select('user_id')
        .eq('id', leadList.id)
        .single();
      if ((listError && isMissingTableError(listError, 'lead_lists')) || !list || list.user_id !== user.id) {
        if (listError && isMissingTableError(listError, 'lead_lists')) {
          return NextResponse.json(
            { error: 'Lead lists are not available in this database yet. Apply the migration first.' },
            { status: 503 }
          );
        }
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
    } else {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }
  }

  const serviceSupabase = createServiceClient();
  const [sentEmailsResponse, auditLogsResponse, activityLogsResponse] = await Promise.all([
    serviceSupabase
      .from('sent_emails')
      .select('*')
      .eq('lead_id', id)
      .order('sent_at', { ascending: false }),
    serviceSupabase
      .from('audit_logs')
      .select('*')
      .eq('lead_id', id)
      .order('created_at', { ascending: false })
      .limit(100),
    serviceSupabase
      .from('activity_logs')
      .select('*')
      .eq('lead_id', id)
      .order('created_at', { ascending: false })
      .limit(100),
  ]);

  return NextResponse.json({
    lead: {
      ...data,
      lead_lists: leadList,
      campaigns: campaign,
      sent_emails: (sentEmailsResponse.data || []).map((email) => {
        const metadata = (email.metadata && typeof email.metadata === 'object' ? email.metadata : {}) as Record<string, unknown>;
        return {
          ...email,
          subject: String(email.subject || metadata.subject || ''),
          sender_email: String(email.sender_email || metadata.sender_email || '') || null,
          recipient_email: String(email.recipient_email || metadata.recipient_email || metadata.to || data.email || '') || null,
          email_type: String(email.email_type || metadata.email_type || 'custom_email'),
          body_text: email.body_text || htmlToPlainText(String(email.body_html || metadata.body_html || '')),
        };
      }),
    },
    auditLogs: auditLogsResponse.data || [],
    activityLogs: activityLogsResponse.data || [],
    companyContext: {
      companyName: profile?.outreach_company_name || null,
      website: profile?.outreach_company_website || null,
      description: profile?.outreach_company_description || null,
      offersServices: profile?.outreach_offers_services || null,
      valueProposition: profile?.outreach_value_proposition || null,
      targetCustomers: profile?.outreach_target_customers || null,
      proofPoints: profile?.outreach_proof_points || null,
    },
  });
}

export async function PATCH(
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
    const payload = await request.json();
    const { data: existingLead, error: leadError } = await supabase
      .from('leads')
      .select('id, email, user_id, campaign_id, lead_list_id, manual_email_approved')
      .eq('id', id)
      .maybeSingle();

    if (leadError || !existingLead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    if (existingLead.user_id !== user.id) {
      if (existingLead.campaign_id) {
        const { data: campaign } = await supabase.from('campaigns').select('user_id').eq('id', existingLead.campaign_id).maybeSingle();
        if (!campaign || campaign.user_id !== user.id) {
          return NextResponse.json({ error: 'Access denied' }, { status: 403 });
        }
      } else if (existingLead.lead_list_id) {
        const { data: leadList, error: leadListError } = await supabase
          .from('lead_lists')
          .select('user_id')
          .eq('id', existingLead.lead_list_id)
          .maybeSingle();
        if ((leadListError && isMissingTableError(leadListError, 'lead_lists')) || !leadList || leadList.user_id !== user.id) {
          if (leadListError && isMissingTableError(leadListError, 'lead_lists')) {
            return NextResponse.json(
              { error: 'Lead lists are not available in this database yet. Apply the migration first.' },
              { status: 503 }
            );
          }
          return NextResponse.json({ error: 'Access denied' }, { status: 403 });
        }
      } else {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
    }

    const serviceSupabase = createServiceClient();
    const quality = calculateLeadQuality(payload);
    const isManualDraft = payload.manual_personalization_status === 'drafted';
    const isManualApproval = Boolean(payload.manual_email_approved) && !existingLead.manual_email_approved;
    const nowIso = new Date().toISOString();
    const { error } = await serviceSupabase
      .from('leads')
      .update({
        user_id: payload.user_id || user.id,
        lead_list_id: payload.lead_list_id ?? null,
        is_global: payload.is_global ?? true,
        owner_type: payload.owner_type || 'library',
        email: payload.email?.trim().toLowerCase(),
        first_name: payload.first_name || null,
        last_name: payload.last_name || null,
        company: payload.company_name || payload.company || null,
        company_name: payload.company_name || payload.company || null,
        website: payload.website || null,
        industry: payload.industry || null,
        sub_industry: payload.sub_industry || null,
        country: payload.country || null,
        city: payload.city || null,
        company_size: payload.company_size || null,
        estimated_revenue: payload.estimated_revenue || null,
        decision_maker_name: payload.decision_maker_name || null,
        decision_maker_title: payload.decision_maker_title || null,
        email_verified: Boolean(payload.email_verified),
        linkedin_url: payload.linkedin_url || null,
        tech_stack: payload.tech_stack || null,
        pain_points: payload.pain_points || null,
        solution: payload.solution || null,
        solution_score: payload.solution_score !== undefined && payload.solution_score !== null && payload.solution_score !== '' ? Number(payload.solution_score) : null,
        solution_fit_score: payload.solution_fit_score !== undefined && payload.solution_fit_score !== null && payload.solution_fit_score !== '' ? Number(payload.solution_fit_score) : null,
        lead_source: payload.lead_source || null,
        qc_by: payload.qc_by || null,
        outreach_channel: payload.outreach_channel || null,
        outreach_status: payload.outreach_status || null,
        priority: payload.priority || null,
        assigned_to: payload.assigned_to || null,
        tags: payload.tags || null,
        notes: payload.notes || null,
        follow_up_note: payload.follow_up_note || null,
        ai_company_summary: payload.ai_company_summary || null,
        ai_lead_analysis: payload.ai_lead_analysis || null,
        ai_outreach_strategy: payload.ai_outreach_strategy || null,
        ai_personalized_first_line: payload.ai_personalized_first_line || null,
        ai_solution_angle: payload.ai_solution_angle || null,
        lead_owner: payload.lead_owner || null,
        deal_size: payload.deal_size ? Number(payload.deal_size) : null,
        pipeline_stage: payload.pipeline_stage || 'New',
        raw_data: payload.raw_data || {},
        data_quality_score: quality.score,
        data_quality_label: quality.label,
        status: payload.status || 'imported',
        manual_personalization_status: payload.manual_personalization_status || 'not_started',
        manual_email_subject: payload.manual_email_subject || null,
        manual_email_body: payload.manual_email_body || null,
        manual_email_type: payload.manual_email_type || null,
        manual_email_saved_at: isManualDraft ? nowIso : payload.manual_email_saved_at || null,
        manual_email_approved: Boolean(payload.manual_email_approved),
        last_manual_email_account_id: payload.last_manual_email_account_id || null,
        last_email_sent_at: payload.last_email_sent_at || null,
        next_follow_up_at: payload.next_follow_up_at || null,
        next_follow_up_date: payload.next_follow_up_date || payload.next_follow_up_at || null,
        next_email_at: payload.next_email_at || null,
        reply_outcome: payload.reply_outcome || null,
        updated_at: nowIso,
      })
      .eq('id', id);

    if (error) throw error;

    await createAuditLog({
      userId: user.id,
      leadId: id,
      action: 'lead_updated',
      message: `Lead updated: ${payload.email || id}`,
      metadata: { lead_id: id },
    });

    if (isManualDraft) {
      await createAuditLog({
        userId: user.id,
        leadId: id,
        campaignId: existingLead.campaign_id || null,
        action: 'email_draft_saved',
        message: `Manual email draft saved: ${payload.email || existingLead.email || id}`,
        metadata: {
          lead_id: id,
          email_type: payload.manual_email_type || null,
        },
      });
    }

    if (isManualApproval) {
      await createAuditLog({
        userId: user.id,
        leadId: id,
        campaignId: existingLead.campaign_id || null,
        action: 'email_approved',
        message: `Manual email approved: ${payload.email || existingLead.email || id}`,
        metadata: {
          lead_id: id,
          email_type: payload.manual_email_type || null,
        },
      });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error updating lead';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
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

  const { error } = await supabase.from('leads').delete().eq('id', id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await createAuditLog({
    userId: user.id,
    leadId: id,
    action: 'lead_deleted',
    message: `Lead deleted: ${id}`,
    metadata: { lead_id: id },
  });

  return NextResponse.json({ success: true });
}
