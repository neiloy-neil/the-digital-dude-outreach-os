import { createClient } from '@/utils/supabase/server';
import { createServiceClient } from '@/utils/supabase/service';

export async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return { authorized: false as const, error: 'Unauthorized', status: 401 };
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single();

  if (profileError || !profile?.is_admin) {
    return { authorized: false as const, error: 'Forbidden: Admin access required', status: 403 };
  }

  return { authorized: true as const, user, supabase };
}

/**
 * Same admin check as requireAdmin(), but also returns a service-role
 * client — needed for operations RLS can't authorize even for an admin,
 * such as deleting a Supabase Auth user via auth.admin.deleteUser().
 */
export async function requireAdminService() {
  const result = await requireAdmin();
  if (!result.authorized) {
    return { ...result, serviceSupabase: undefined };
  }
  return { ...result, serviceSupabase: createServiceClient() };
}
