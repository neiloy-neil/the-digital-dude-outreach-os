import 'server-only';

import { createServiceClient } from '@/utils/supabase/service';

type LeadOwnerRecord = {
  id: string;
  email: string;
  user_id: string | null;
  campaign_id: string | null;
  lead_list_id: string | null;
  campaigns?: { id: string; name?: string | null; user_id?: string | null }[] | { id: string; name?: string | null; user_id?: string | null } | null;
  lead_lists?: { id: string; user_id?: string | null }[] | { id: string; user_id?: string | null } | null;
};

export type ResolvedLeadOwner = {
  userId: string | null;
  campaignId: string | null;
  leadListId: string | null;
  campaignName: string | null;
};

function firstRelation<T>(value: T[] | T | null | undefined): T | null {
  if (Array.isArray(value)) {
    return value[0] || null;
  }

  return value || null;
}

export function resolveLeadOwnerFromLead(lead: LeadOwnerRecord): ResolvedLeadOwner {
  const campaign = firstRelation(lead.campaigns);
  const leadList = firstRelation(lead.lead_lists);

  return {
    userId: lead.user_id || campaign?.user_id || leadList?.user_id || null,
    campaignId: lead.campaign_id || campaign?.id || null,
    leadListId: lead.lead_list_id || leadList?.id || null,
    campaignName: campaign?.name || null,
  };
}

export async function fetchLeadWithOwner(leadId: string) {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('leads')
    .select(`
      id,
      email,
      user_id,
      campaign_id,
      lead_list_id,
      campaigns (
        id,
        name,
        user_id
      ),
      lead_lists (
        id,
        user_id
      )
    `)
    .eq('id', leadId)
    .maybeSingle();

  return { data: data as LeadOwnerRecord | null, error };
}
