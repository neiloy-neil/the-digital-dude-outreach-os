import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import AppShell from '@/components/reachmira/AppShell';
import WaitlistClient from './WaitlistClient';

export const metadata = {
  title: 'Admin Waitlist | ReachMira',
};

export default async function AdminWaitlistPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single();

  if (!profile?.is_admin) {
    redirect('/dashboard');
  }

  // Fetch initial data
  const { data: signups } = await supabase
    .from('waitlist_signups')
    .select('*')
    .order('created_at', { ascending: false });

  return (
    <AppShell>
      <WaitlistClient initialSignups={signups || []} />
    </AppShell>
  );
}
