import { NextResponse } from 'next/server';
import Imap from 'imap';
import { createClient } from '@/utils/supabase/server';

type TestImapPayload = {
  imapHost?: string;
  imapPort?: number | string | null;
  imapUser?: string;
  imapPass?: string;
};

function testImapConnection(config: { host: string; port: number; user: string; password: string }) {
  return new Promise<{ mailboxName: string; totalMessages: number }>((resolve, reject) => {
    const imap = new Imap({
      user: config.user,
      password: config.password,
      host: config.host,
      port: config.port,
      tls: true,
      tlsOptions: { rejectUnauthorized: false },
      connTimeout: 10000,
      authTimeout: 10000,
    });

    const timeout = setTimeout(() => {
      imap.end();
      reject(new Error('IMAP connection timed out after 10 seconds.'));
    }, 12000);

    imap.once('ready', () => {
      imap.openBox('INBOX', true, (error, box) => {
        clearTimeout(timeout);
        imap.end();

        if (error) {
          reject(error);
          return;
        }

        resolve({
          mailboxName: box.name || 'INBOX',
          totalMessages: box.messages?.total || 0,
        });
      });
    });

    imap.once('error', (error: Error) => {
      clearTimeout(timeout);
      reject(error);
    });

    imap.connect();
  });
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
    const body = (await request.json()) as TestImapPayload;
    const host = String(body.imapHost || '').trim();
    const userName = String(body.imapUser || '').trim();
    const password = String(body.imapPass || '');
    const port = body.imapPort ? Number(body.imapPort) : 993;

    if (!host || !userName || !password) {
      return NextResponse.json({ error: 'IMAP host, username, and password are required.' }, { status: 400 });
    }

    if (!Number.isFinite(port) || port <= 0) {
      return NextResponse.json({ error: 'IMAP port must be a valid positive number.' }, { status: 400 });
    }

    const result = await testImapConnection({
      host,
      port,
      user: userName,
      password,
    });

    return NextResponse.json({
      message: `Connected to ${result.mailboxName}. Found ${result.totalMessages} messages.`,
      ...result,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to connect to IMAP inbox.' },
      { status: 500 }
    );
  }
}
