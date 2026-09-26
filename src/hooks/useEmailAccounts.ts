'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';

export type EmailAccountOption = {
  id: string;
  provider: string;
  email_address: string;
  sender_name?: string | null;
  status: string;
  is_default: boolean;
};

/**
 * Active email accounts available as senders, shared between the campaign
 * detail page and the new-campaign wizard.
 */
export function useEmailAccounts() {
  const supabase = createClient();
  const [emailAccounts, setEmailAccounts] = useState<EmailAccountOption[]>([]);
  const [loading, setLoading] = useState(true);

  const loadEmailAccounts = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('email_accounts')
        .select('id, provider, email_address, sender_name, status, is_default')
        .eq('status', 'active')
        .order('is_default', { ascending: false });
      setEmailAccounts(data || []);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadEmailAccounts();
  }, [loadEmailAccounts]);

  return { emailAccounts, loading, loadEmailAccounts };
}
