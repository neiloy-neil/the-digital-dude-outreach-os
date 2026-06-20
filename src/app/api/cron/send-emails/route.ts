import { NextResponse } from 'next/server';
import { sendDueEmails } from '@/lib/cron/send-due-emails';
import { verifyCronAuth } from '@/lib/cron/auth';

export async function GET(request: Request) {
  const authError = verifyCronAuth(request);
  if (authError) return authError;


  try {
    const result = await sendDueEmails();
    return NextResponse.json(result);
  } catch (err: unknown) {
    console.error('Crash in cron send-emails:', err);
    const message = err instanceof Error ? err.message : 'Server crash';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
