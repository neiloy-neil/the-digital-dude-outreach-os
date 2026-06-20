import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createServiceClient } from '@/utils/supabase/service';
import { createAuditLog } from '@/lib/audit/create-audit-log';
import { calculateLeadQuality, getLeadReadiness } from '@/lib/leads/library';
import { getFollowUpStage, isBlockedLeadStatus, isRepliedStatus } from '@/lib/leads/status';
import { isMissingTableError } from '@/lib/supabase/schema-errors';

export async function GET(request: Request) {
  const supabase = await createClient();
  const serviceSupabase = createServiceClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const search = url.searchParams.get('search')?.trim().toLowerCase() || '';
  const status = url.searchParams.get('status');
  const priority = url.searchParams.get('priority');
  const aiStatus = url.searchParams.get('aiStatus');
  const emailStatus = url.searchParams.get('emailStatus');
  const industry = url.searchParams.get('industry')?.trim();
  const country = url.searchParams.get('country')?.trim();
  const tags = url.searchParams.get('tags')?.trim();
  const filter = url.searchParams.get('filter');
  const missing = url.searchParams.get('missing');
  const contacted = url.searchParams.get('contacted');
  const readiness = url.searchParams.get('readiness');
  const leadListId = url.searchParams.get('leadListId');
  const lastEmailType = url.searchParams.get('lastEmailType');
  const replied = url.searchParams.get('replied');
  const followUpStage = url.searchParams.get('followUpStage');
  const doNotContact = url.searchParams.get('doNotContact');
  const bounced = url.searchParams.get('bounced');
  const unsubscribed = url.searchParams.get('unsubscribed');
  const lastContactedFrom = url.searchParams.get('lastContactedFrom');
  const lastContactedTo = url.searchParams.get('lastContactedTo');
  const pageParam = url.searchParams.get('page');
  const limitParam = url.searchParams.get('limit');
  
  const page = pageParam ? Math.max(1, parseInt(pageParam, 10)) : 1;
  const limit = limitParam ? Math.min(200, Math.max(1, parseInt(limitParam, 10))) : 50;
  const offset = (page - 1) * limit;

  const useListScopedServiceRead = Boolean(leadListId);

  if (useListScopedServiceRead) {
    const { data: list, error: listError } = await serviceSupabase
      .from('lead_lists')
      .select('id, user_id')
      .eq('id', leadListId)
      .maybeSingle();

    if (listError && isMissingTableError(listError, 'lead_lists')) {
      return NextResponse.json(
        { error: 'Lead lists are not available in this database yet. Apply the migration first.' },
        { status: 503 }
      );
    }

    if (!list || list.user_id !== user.id) {
      return NextResponse.json({ error: 'Lead list not found' }, { status: 404 });
    }
  }

  let query = (useListScopedServiceRead ? serviceSupabase : supabase)
    .from('leads')
    .select('*', { count: 'exact' })
    .order('last_email_sent_at', { ascending: true, nullsFirst: true })
    .order('created_at', { ascending: false });

  if (leadListId) {
    query = query.eq('lead_list_id', leadListId);
  }

  if (status && status !== 'all') {
    query = query.eq('status', status);
  }

  if (priority && priority !== 'all') {
    query = query.eq('priority', priority);
  }

  if (aiStatus && aiStatus !== 'all') {
    query = query.eq('ai_status', aiStatus);
  }

  if (emailStatus && emailStatus !== 'all') {
    query = query.eq('email_verification_status', emailStatus);
  }

  if (industry) {
    query = query.ilike('industry', `%${industry}%`);
  }

  if (country) {
    query = query.ilike('country', `%${country}%`);
  }

  if (tags) {
    query = query.ilike('tags', `%${tags}%`);
  }

  if (lastContactedFrom) {
    query = query.gte('last_email_sent_at', lastContactedFrom);
  }

  if (lastContactedTo) {
    query = query.lte('last_email_sent_at', lastContactedTo);
  }

  if (search) {
    const safeSearch = search.replace(/[%_]/g, '\\$&'); // simple escape
    query = query.or(
      `email.ilike.%${safeSearch}%,first_name.ilike.%${safeSearch}%,last_name.ilike.%${safeSearch}%,company_name.ilike.%${safeSearch}%,company.ilike.%${safeSearch}%,website.ilike.%${safeSearch}%,industry.ilike.%${safeSearch}%,city.ilike.%${safeSearch}%,country.ilike.%${safeSearch}%,tags.ilike.%${safeSearch}%`
    );
  }

  // Fetch paginated leads and total count
  const { data, error, count } = await query
    .range(offset, offset + limit - 1);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rawLeads = data || [];
  const filtered = rawLeads;

  const leadListIds = Array.from(new Set(filtered.map((lead) => lead.lead_list_id).filter(Boolean)));
  const leadIds = filtered.map((lead) => lead.id);

  const [leadListsResponse, sentEmailsResponse] = await Promise.all([
    leadListIds.length > 0
      ? (useListScopedServiceRead ? serviceSupabase : supabase).from('lead_lists').select('id, name').in('id', leadListIds)
      : Promise.resolve({ data: [] as Array<{ id: string; name: string }> }),
    leadIds.length > 0
      ? serviceSupabase
          .from('sent_emails')
          .select('id, lead_id, email_type, sent_at, status, replied_at, bounced_at, metadata')
          .in('lead_id', leadIds)
          .order('sent_at', { ascending: false })
      : Promise.resolve({ data: [] as Array<Record<string, unknown>> }),
  ]);

  const leadListMap = new Map((leadListsResponse.data || []).map((list) => [list.id, list]));
  const sentEmailMap = new Map<string, Array<Record<string, unknown>>>();
  for (const email of sentEmailsResponse.data || []) {
    const metadata = (email.metadata && typeof email.metadata === 'object' ? email.metadata : {}) as Record<string, unknown>;
    const normalizedEmail = {
      ...email,
      email_type:
        String(email.email_type || metadata.email_type || metadata.v_email_type || 'custom_email'),
      status: String(email.status || 'sent'),
      replied_at: (email.replied_at as string | null | undefined) ?? null,
      bounced_at: (email.bounced_at as string | null | undefined) ?? null,
    };
    const key = String(email.lead_id);
    const current = sentEmailMap.get(key) || [];
    current.push(normalizedEmail);
    sentEmailMap.set(key, current);
  }

  const enriched = filtered.filter((lead) => {
    const sentEmails = sentEmailMap.get(String(lead.id)) || [];
    const lastSentEmail = sentEmails[0];

    if (lastEmailType && lastEmailType !== 'all' && lastSentEmail?.email_type !== lastEmailType) {
      return false;
    }

    if (replied === 'yes' && !isRepliedStatus(lead.status)) {
      return false;
    }

    if (replied === 'no' && isRepliedStatus(lead.status)) {
      return false;
    }

    if (followUpStage && followUpStage !== 'all' && String(getFollowUpStage(lead.status)) !== followUpStage) {
      return false;
    }

    if (filter === 'followups_due') {
      const nextFollowUp = lead.next_follow_up_at || lead.next_follow_up_date || lead.next_email_at;
      if (!nextFollowUp || new Date(nextFollowUp).getTime() > Date.now()) {
        return false;
      }
    }

    if (missing === 'pain_points' && String(lead.pain_points || '').trim()) {
      return false;
    }

    if (missing === 'solution_angle' && (String(lead.solution || '').trim() || String(lead.recommended_offer || '').trim())) {
      return false;
    }

    if (contacted === 'false' && (lead.last_email_sent_at || lead.last_contacted_at || lead.last_contacted || Number(lead.emails_sent_count || 0) > 0)) {
      return false;
    }

    if (doNotContact === 'yes' && !isBlockedLeadStatus(lead.status)) {
      return false;
    }

    if (bounced === 'yes' && lead.status !== 'bounced') {
      return false;
    }

    if (unsubscribed === 'yes' && lead.status !== 'unsubscribed') {
      return false;
    }

    if (readiness && readiness !== 'all' && getLeadReadiness(lead) !== readiness) {
      return false;
    }

    return true;
  });

  return NextResponse.json({
    leads: enriched.map((lead) => ({
      ...lead,
      lead_lists: lead.lead_list_id ? leadListMap.get(lead.lead_list_id) || null : null,
      sent_emails: sentEmailMap.get(String(lead.id)) || [],
    })),
    total: count || 0,
    page,
    limit,
  });
}

export async function POST(request: Request) {
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
    const listId = payload.lead_list_id || null;

    if (listId) {
      const { data: list, error: listError } = await supabase
        .from('lead_lists')
        .select('id')
        .eq('id', listId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (listError && isMissingTableError(listError, 'lead_lists')) {
        return NextResponse.json(
          { error: 'Lead lists are not available in this database yet. Apply the global lead library migration first.' },
          { status: 503 }
        );
      }

      if (!list) {
        return NextResponse.json({ error: 'Lead list not found' }, { status: 404 });
      }
    }

    const quality = calculateLeadQuality(payload);
    const email = String(payload.email || '').trim().toLowerCase();
    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('leads')
      .insert({
        user_id: user.id,
        lead_list_id: listId,
        is_global: true,
        owner_type: 'library',
        campaign_id: payload.campaign_id || null,
        email,
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
        lead_owner: payload.lead_owner || null,
        deal_size: payload.deal_size ? Number(payload.deal_size) : null,
        pipeline_stage: payload.pipeline_stage || 'New',
        raw_data: payload.raw_data || {},
        data_quality_score: quality.score,
        data_quality_label: quality.label,
        status: payload.status || 'new',
        ai_status: 'pending',
        manual_personalization_status: 'not_started',
      })
      .select('*')
      .single();

    if (error) throw error;

    await createAuditLog({
      userId: user.id,
      leadId: data.id,
      campaignId: payload.campaign_id || null,
      action: 'lead_imported',
      message: `Lead created: ${email}`,
      metadata: { lead_list_id: listId, email },
    });

    return NextResponse.json({ success: true, lead: data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error creating lead';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
