export const dynamic = 'force-dynamic';

import { createServiceClient } from '@/utils/supabase/service';
import { Mail, CheckCircle, AlertCircle } from 'lucide-react';
import { createAuditLog } from '@/lib/audit/create-audit-log';

interface UnsubscribePageProps {
  searchParams: Promise<{ token?: string }>;
}

type CampaignRelation = { user_id?: string | null } | null;
type LeadListRelation = { user_id?: string | null } | null;

export default async function UnsubscribePage({ searchParams }: UnsubscribePageProps) {
  const resolvedSearchParams = await searchParams;
  const token = resolvedSearchParams.token;

  let status: 'success' | 'invalid' | 'error' = 'invalid';
  let emailAddress = '';

  if (token) {
    const supabase = createServiceClient();
    
    // 1. Find the lead by unsubscribe token
    const { data: lead, error: fetchError } = await supabase
      .from('leads')
      .select(`
        id,
        email,
        user_id,
        campaign_id,
        lead_list_id,
        campaigns (
          id,
          user_id
        ),
        lead_lists (
          id,
          user_id
        )
      `)
      .eq('unsubscribe_token', token)
      .maybeSingle();

    if (fetchError) {
      status = 'error';
    } else if (lead) {
      const userCampaign: CampaignRelation = Array.isArray(lead.campaigns) ? lead.campaigns[0] : lead.campaigns;
      const userLeadList: LeadListRelation = Array.isArray(lead.lead_lists) ? lead.lead_lists[0] : lead.lead_lists;
      const userId = lead.user_id || userCampaign?.user_id || userLeadList?.user_id;
      emailAddress = lead.email;

      // 2. Mark lead status as unsubscribed
      await supabase
        .from('leads')
        .update({ status: 'unsubscribed', updated_at: new Date().toISOString() })
        .eq('id', lead.id);

      if (lead.campaign_id) {
        await supabase
          .from('outbox')
          .update({ status: 'cancelled', error_message: 'Lead unsubscribed' })
          .eq('lead_id', lead.id)
          .eq('status', 'pending');
      }

      // 5. Add to suppressions
      if (userId) {
        await supabase.from('suppressions').upsert({
          user_id: userId,
          email: lead.email.toLowerCase(),
          reason: 'unsubscribe',
          source: 'unsubscribe',
        }, { onConflict: 'user_id,email' });

        await createAuditLog({
          userId,
          campaignId: lead.campaign_id || null,
          leadId: lead.id,
          action: 'lead_unsubscribed',
          message: `Lead unsubscribed: ${lead.email}`,
          metadata: { source: 'unsubscribe_page', lead_list_id: lead.lead_list_id || null },
        });
      }

      status = 'success';
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[radial-gradient(circle_at_top_left,_rgba(124,58,237,0.08),_transparent_26%),radial-gradient(circle_at_bottom_right,_rgba(20,184,166,0.08),_transparent_24%),var(--background)] px-4 text-zinc-900">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(148,163,184,0.12)_1px,transparent_1px),linear-gradient(to_bottom,rgba(148,163,184,0.12)_1px,transparent_1px)] bg-[size:4rem_4rem] opacity-30 [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]" />
      
      <div className="relative z-10 w-full max-w-md rounded-[2rem] border border-[var(--border)] bg-white p-8 shadow-[0_24px_80px_rgba(15,23,42,0.08)]">
        <div className="flex flex-col items-center text-center">
          {status === 'success' ? (
            <>
              <div className="mb-6 rounded-full bg-emerald-50 p-4 text-emerald-600">
                <CheckCircle className="h-12 w-12" />
              </div>
              <h1 className="text-2xl font-semibold tracking-tight text-zinc-950">Unsubscribed successfully</h1>
              <p className="mt-3 text-sm leading-6 text-zinc-600">
                The email address <span className="font-semibold text-zinc-900">{emailAddress}</span> has been removed from our list. You will not receive any further outreach emails from ReachMira.
              </p>
            </>
          ) : status === 'error' ? (
            <>
              <div className="mb-6 rounded-full bg-rose-50 p-4 text-rose-600">
                <AlertCircle className="h-12 w-12" />
              </div>
              <h1 className="text-2xl font-semibold tracking-tight text-zinc-950">Something went wrong</h1>
              <p className="mt-3 text-sm leading-6 text-zinc-600">
                There was an issue processing your unsubscribe request. Please try again later or reply directly to the email to opt-out.
              </p>
            </>
          ) : (
            <>
              <div className="mb-6 rounded-full bg-amber-50 p-4 text-amber-600">
                <Mail className="h-12 w-12" />
              </div>
              <h1 className="text-2xl font-semibold tracking-tight text-zinc-950">Invalid Token</h1>
              <p className="mt-3 text-sm leading-6 text-zinc-600">
                This unsubscribe link is invalid or expired. If you wish to opt-out, please reply directly to the email requesting to unsubscribe.
              </p>
            </>
          )}

          <div className="mt-8 border-t border-[var(--border)] pt-6 text-xs text-zinc-500">
            Powered by ReachMira
          </div>
        </div>
      </div>
    </div>
  );
}
