import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createAuditLog } from '@/lib/audit/create-audit-log';
import { isMissingTableError } from '@/lib/supabase/schema-errors';

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('suppressions')
    .select('id,email,reason,domain,source,created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    if (isMissingTableError(error, 'suppressions')) {
      return NextResponse.json({ suppressions: [], warning: 'Suppression table is not available yet.' });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ suppressions: data || [] });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const payload = await request.json();
    const reason = String(payload.reason || 'manual').trim();
    const source = String(payload.source || 'manual').trim() || 'manual';
    const email = String(payload.email || '').trim().toLowerCase();
    const domain = String(payload.domain || '').trim().toLowerCase().replace(/^@/, '');

    if (!email && !domain) {
      return NextResponse.json({ error: 'Email or domain is required' }, { status: 400 });
    }

    const normalizedEmail = email || domain;
    const { data, error } = await supabase
      .from('suppressions')
      .upsert({
        user_id: user.id,
        email: normalizedEmail,
        domain: domain || null,
        reason,
        source,
      }, { onConflict: 'user_id,email' })
      .select('id,email,reason,domain,source,created_at')
      .single();

    if (error) {
      if (isMissingTableError(error, 'suppressions')) {
        return NextResponse.json({ error: 'Suppression table is not available yet.' }, { status: 503 });
      }
      throw error;
    }

    await createAuditLog({
      userId: user.id,
      action: 'suppression_created',
      message: `Suppression added: ${normalizedEmail}`,
      metadata: { email: normalizedEmail, domain: domain || null, reason, source },
    });

    return NextResponse.json({ success: true, suppression: data });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Error creating suppression' }, { status: 500 });
  }
}

