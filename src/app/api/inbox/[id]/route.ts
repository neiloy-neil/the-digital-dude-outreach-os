import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Fetch the specific inbox message to get the lead_id
    const { data: inboxMessage, error: inboxError } = await supabase
      .from('inbox_messages')
      .select('*, leads(first_name, last_name, company)')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (inboxError || !inboxMessage) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 });
    }

    if (!inboxMessage.lead_id) {
      return NextResponse.json({ thread: [inboxMessage], lead: null });
    }

    // Fetch all related sent_emails and inbox_messages for this lead to construct the thread
    const [sentResponse, inboxResponse] = await Promise.all([
      supabase
        .from('sent_emails')
        .select('id, subject, body_html, body_text, sent_at, sender_email, recipient_email')
        .eq('lead_id', inboxMessage.lead_id)
        .order('sent_at', { ascending: true }),
      supabase
        .from('inbox_messages')
        .select('id, subject, body_html, body_text, received_at, sender_email, recipient_email')
        .eq('lead_id', inboxMessage.lead_id)
        .order('received_at', { ascending: true })
    ]);

    const sentEmails = (sentResponse.data || []).map(m => ({ ...m, type: 'sent', timestamp: m.sent_at }));
    const inboxMessages = (inboxResponse.data || []).map(m => ({ ...m, type: 'received', timestamp: m.received_at }));

    // Interleave chronologically
    const thread = [...sentEmails, ...inboxMessages].sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    return NextResponse.json({ thread, lead: inboxMessage.leads, lead_id: inboxMessage.lead_id, subject: inboxMessage.subject });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { status } = body;

    if (!status || !['unread', 'read', 'archived', 'replied'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    const { error } = await supabase
      .from('inbox_messages')
      .update({ status })
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
