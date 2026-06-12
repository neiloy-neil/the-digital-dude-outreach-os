import { createClient } from '@/utils/supabase/server';

export async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return { authorized: false, error: 'Unauthorized', status: 401 };
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single();

  if (profileError || !profile?.is_admin) {
    return { authorized: false, error: 'Forbidden: Admin access required', status: 403 };
  }

  return { authorized: true, user, supabase };
}
