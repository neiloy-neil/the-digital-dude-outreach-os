import { NextResponse } from 'next/server';
import { releaseStuckLeads } from '@/lib/cron/release-stuck-leads';
import { verifyCronAuth } from '@/lib/cron/auth';

export async function GET(request: Request) {
  const authError = verifyCronAuth(request);
  if (authError) return authError;

  try {
    const result = await releaseStuckLeads();
    return NextResponse.json(result);
  } catch (err: unknown) {
    console.error('Crash in cron release-stuck-leads:', err);
    const message = err instanceof Error ? err.message : 'Server crash';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
