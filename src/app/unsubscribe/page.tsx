export const dynamic = 'force-dynamic';

import { createServiceClient } from '@/utils/supabase/service';
import { Mail, CheckCircle, AlertCircle } from 'lucide-react';

interface UnsubscribePageProps {
  searchParams: Promise<{ token?: string }>;
}

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
        campaigns (
          user_id
        )
      `)
      .eq('unsubscribe_token', token)
      .maybeSingle();

    if (fetchError) {
      status = 'error';
    } else if (lead) {
      const userCampaign = lead.campaigns as any;
      const userId = userCampaign?.user_id;
      emailAddress = lead.email;

      // 2. Mark lead status as unsubscribed
      await supabase
        .from('leads')
        .update({ status: 'unsubscribed', updated_at: new Date().toISOString() })
        .eq('id', lead.id);

      // 3. Cancel pending outbox entries
      await supabase
        .from('outbox')
        .update({ status: 'cancelled', error_message: 'Lead unsubscribed' })
        .eq('lead_id', lead.id)
        .eq('status', 'pending');

      // 4. Log unsubscribe event
      await supabase.from('activity_logs').insert({
        campaign_id: userCampaign?.id || '',
        lead_id: lead.id,
        event_type: 'unsubscribed',
        payload: { source: 'unsubscribe_page' }
      });

      // 5. Add to suppressions
      if (userId) {
        await supabase.from('suppressions').upsert({
          user_id: userId,
          email: lead.email.toLowerCase(),
          reason: 'unsubscribe',
        }, { onConflict: 'user_id,email' });
      }

      status = 'success';
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 px-4 text-zinc-100">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1f1f2e_1px,transparent_1px),linear-gradient(to_bottom,#1f1f2e_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-30" />
      
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900/60 p-8 shadow-2xl backdrop-blur-xl">
        <div className="flex flex-col items-center text-center">
          {status === 'success' ? (
            <>
              <div className="mb-6 rounded-full bg-emerald-500/10 p-4 text-emerald-400">
                <CheckCircle className="h-12 w-12" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-white">Unsubscribed successfully</h1>
              <p className="mt-3 text-sm text-zinc-400">
                The email address <span className="font-semibold text-zinc-200">{emailAddress}</span> has been removed from our list. You will not receive any further outreach emails from this campaign.
              </p>
            </>
          ) : status === 'error' ? (
            <>
              <div className="mb-6 rounded-full bg-rose-500/10 p-4 text-rose-400">
                <AlertCircle className="h-12 w-12" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-white">Something went wrong</h1>
              <p className="mt-3 text-sm text-zinc-400">
                There was an issue processing your unsubscribe request. Please try again later or reply directly to the email to opt-out.
              </p>
            </>
          ) : (
            <>
              <div className="mb-6 rounded-full bg-amber-500/10 p-4 text-amber-400">
                <Mail className="h-12 w-12" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-white">Invalid Token</h1>
              <p className="mt-3 text-sm text-zinc-400">
                This unsubscribe link is invalid or expired. If you wish to opt-out, please reply directly to the email requesting to unsubscribe.
              </p>
            </>
          )}

          <div className="mt-8 border-t border-zinc-800 pt-6 text-xs text-zinc-500">
            Powered by The Digital Dude Outreach OS
          </div>
        </div>
      </div>
    </div>
  );
}
