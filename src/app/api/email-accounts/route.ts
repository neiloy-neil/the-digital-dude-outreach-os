import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { maskEmailAccountConfig } from '@/types/email-provider';
import { createAuditLog } from '@/lib/audit/create-audit-log';

export async function GET() {
  const supabase = await createClient();

  // 1. Authenticate user
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { data: accounts, error } = await supabase
      .from('email_accounts')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Mask config secrets
    const safeAccounts = (accounts || []).map(account => ({
      ...account,
      config: maskEmailAccountConfig(account.provider, account.config),
    }));

    return NextResponse.json(safeAccounts);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const supabase = await createClient();

  // 1. Authenticate user
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { provider, email_address, sender_name, config, daily_send_limit, is_default, warmup_enabled } = body;

    if (!provider || !email_address || !config) {
      return NextResponse.json({ error: 'Missing required fields: provider, email_address, or config' }, { status: 400 });
    }

    // Check if user has any email accounts. If none, set this as default.
    const { count, error: countError } = await supabase
      .from('email_accounts')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id);

    const forceDefault = countError || count === 0;

    // If setting this as default, unset other defaults
    if (is_default || forceDefault) {
      await supabase
        .from('email_accounts')
        .update({ is_default: false })
        .eq('user_id', user.id);
    }

    const { data: newAccount, error: insertError } = await supabase
      .from('email_accounts')
      .insert({
        user_id: user.id,
        provider,
        email_address,
        sender_name,
        config,
        daily_send_limit: daily_send_limit || 30,
        is_default: is_default || forceDefault,
        warmup_enabled: !!warmup_enabled,
        status: 'active'
      })
      .select()
      .single();

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    // Log the audit event
    await createAuditLog({
      userId: user.id,
      action: 'email_account_created',
      message: `Email account ${email_address} (${provider}) created successfully.`,
      metadata: { provider, email_address, account_id: newAccount.id }
    });

    const safeAccount = {
      ...newAccount,
      config: maskEmailAccountConfig(newAccount.provider, newAccount.config)
    };

    return NextResponse.json(safeAccount);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
