import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import AppShell from '@/components/reachmira/AppShell';
import DiscoverClient from './DiscoverClient';

export const metadata = {
  title: 'Discover Leads | ReachMira',
};

export default async function DiscoverLeadsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Check if user is subscribed here if needed, else let them view
  return (
    <AppShell showSearch={false}>
      <DiscoverClient />
    </AppShell>
  );
}
