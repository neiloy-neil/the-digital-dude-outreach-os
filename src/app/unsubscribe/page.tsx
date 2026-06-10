export const dynamic = 'force-dynamic';

import { createServiceClient } from '@/utils/supabase/service';
import { Mail } from 'lucide-react';
import UnsubscribeClient from './UnsubscribeClient';

interface UnsubscribePageProps {
  searchParams: Promise<{ token?: string }>;
}

export default async function UnsubscribePage({ searchParams }: UnsubscribePageProps) {
  const resolvedSearchParams = await searchParams;
  const token = resolvedSearchParams.token;

  let isValid = false;
  let emailAddress = '';

  if (token) {
    const supabase = createServiceClient();
    
    // Validate token exists
    const { data: lead } = await supabase
      .from('leads')
      .select('email')
      .eq('unsubscribe_token', token)
      .maybeSingle();

    if (lead) {
      isValid = true;
      emailAddress = lead.email;
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[radial-gradient(circle_at_top_left,_rgba(124,58,237,0.08),_transparent_26%),radial-gradient(circle_at_bottom_right,_rgba(20,184,166,0.08),_transparent_24%),var(--background)] px-4 text-zinc-900">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(148,163,184,0.12)_1px,transparent_1px),linear-gradient(to_bottom,rgba(148,163,184,0.12)_1px,transparent_1px)] bg-[size:4rem_4rem] opacity-30 [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]" />
      
      <div className="relative z-10 w-full max-w-md rounded-[2rem] border border-[var(--border)] bg-white p-8 shadow-[0_24px_80px_rgba(15,23,42,0.08)]">
        
        {isValid ? (
          <UnsubscribeClient token={token!} emailAddress={emailAddress} />
        ) : (
          <div className="flex flex-col items-center text-center">
            <div className="mb-6 rounded-full bg-amber-50 p-4 text-amber-600">
              <Mail className="h-12 w-12" />
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-950">Invalid Token</h1>
            <p className="mt-3 text-sm leading-6 text-zinc-600">
              This unsubscribe link is invalid or expired. If you wish to opt-out, please reply directly to the email requesting to unsubscribe.
            </p>
          </div>
        )}

        <div className="mt-8 border-t border-[var(--border)] pt-6 text-xs text-zinc-500 text-center">
          Powered by ReachMira
        </div>
      </div>
    </div>
  );
}
