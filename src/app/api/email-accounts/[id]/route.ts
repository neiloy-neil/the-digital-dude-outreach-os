import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { maskEmailAccountConfig } from '@/types/email-provider';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { id } = await params;

  // 1. Authenticate user
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // 2. Fetch existing account
    const { data: existingAccount, error: fetchError } = await supabase
      .from('email_accounts')
      .select('*')
      .eq('user_id', user.id)
      .eq('id', id)
      .single();

    if (fetchError || !existingAccount) {
      return NextResponse.json({ error: 'Email account not found' }, { status: 444 });
    }

    const body = await request.json();
    const { email_address, sender_name, config, daily_send_limit, is_default, warmup_enabled, status } = body;

    const updateData: Record<string, any> = {};
    if (email_address !== undefined) updateData.email_address = email_address;
    if (sender_name !== undefined) updateData.sender_name = sender_name;
    if (daily_send_limit !== undefined) updateData.daily_send_limit = daily_send_limit;
    if (warmup_enabled !== undefined) updateData.warmup_enabled = warmup_enabled;
    if (status !== undefined) updateData.status = status;

    // Merge config keys, preserving secrets if masked
    if (config !== undefined) {
      const mergedConfig = { ...existingAccount.config };
      for (const [key, value] of Object.entries(config)) {
        if (value === '********') {
          // Retain old secret
          continue;
        }
        mergedConfig[key] = value;
      }
      updateData.config = mergedConfig;
    }

    // Handle is_default toggle
    if (is_default === true) {
      // Unset other defaults
      await supabase
        .from('email_accounts')
        .update({ is_default: false })
        .eq('user_id', user.id);
      updateData.is_default = true;
    } else if (is_default === false) {
      updateData.is_default = false;
    }

    updateData.updated_at = new Date().toISOString();

    const { data: updatedAccount, error: updateError } = await supabase
      .from('email_accounts')
      .update(updateData)
      .eq('user_id', user.id)
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    const safeAccount = {
      ...updatedAccount,
      config: maskEmailAccountConfig(updatedAccount.provider, updatedAccount.config),
    };

    return NextResponse.json(safeAccount);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { id } = await params;

  // 1. Authenticate user
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { error } = await supabase
      .from('email_accounts')
      .delete()
      .eq('user_id', user.id)
      .eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Email account deleted successfully' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
