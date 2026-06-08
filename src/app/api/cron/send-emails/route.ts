import { NextResponse } from 'next/server';
import { sendDueEmails } from '@/lib/cron/send-due-emails';

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await sendDueEmails();
    return NextResponse.json(result);
  } catch (err: unknown) {
    console.error('Crash in cron send-emails:', err);
    const message = err instanceof Error ? err.message : 'Server crash';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
