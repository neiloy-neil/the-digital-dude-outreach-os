import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import { format } from 'date-fns';
import { CheckCircle2, XCircle } from 'lucide-react';
import AppShell from '@/components/reachmira/AppShell';

export const metadata = {
  title: 'Admin Waitlist | ReachMira',
};

export default async function AdminWaitlistPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Check if admin
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single();

  if (!profile?.is_admin) {
    redirect('/dashboard');
  }

  // Fetch waitlist
  const { data: signups, error } = await supabase
    .from('waitlist_signups')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching waitlist signups:', error);
  }

  return (
    <AppShell>
      <div className="p-8 max-w-7xl mx-auto font-sans selection:bg-[#7C3AED]/20">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-[#111827] mb-2">Waitlist Signups</h1>
          <p className="text-[#6B7280]">Review all early beta access requests.</p>
        </div>
        <div className="bg-[#7C3AED]/10 text-[#7C3AED] px-4 py-2 rounded-full font-bold">
          {signups?.length || 0} Total
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-[#111827]">
            <thead className="bg-[#F8FAFC] border-b border-[#E5E7EB] text-[#6B7280] font-medium uppercase tracking-wider text-xs">
              <tr>
                <th className="px-6 py-4">Name / Email</th>
                <th className="px-6 py-4">Company & Role</th>
                <th className="px-6 py-4">Outreach & Volume</th>
                <th className="px-6 py-4 max-w-[250px]">Use Case</th>
                <th className="px-6 py-4">Updates</th>
                <th className="px-6 py-4">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E7EB]">
              {(!signups || signups.length === 0) && (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-[#6B7280]">
                    No waitlist signups yet.
                  </td>
                </tr>
              )}
              {signups?.map((s) => (
                <tr key={s.id} className="hover:bg-[#F8FAFC]/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-semibold text-[#111827]">{s.full_name}</div>
                    <div className="text-[#6B7280]">{s.email}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-medium text-[#111827]">{s.company_name || '-'}</div>
                    <div className="text-[#6B7280]">{s.role || '-'}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-[#111827]">{s.current_outreach_method || '-'}</div>
                    <div className="text-[#6B7280]">{s.monthly_outreach_volume || '-'}</div>
                  </td>
                  <td className="px-6 py-4 max-w-[250px]">
                    <p className="truncate text-[#6B7280]" title={s.use_case || ''}>
                      {s.use_case || '-'}
                    </p>
                  </td>
                  <td className="px-6 py-4">
                    {s.agreed_to_updates ? (
                      <CheckCircle2 className="w-5 h-5 text-green-500" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-400" />
                    )}
                  </td>
                  <td className="px-6 py-4 text-[#6B7280]">
                    {s.created_at ? format(new Date(s.created_at), 'MMM d, yyyy') : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}
