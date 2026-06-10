import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');

  try {
    let query = supabase
      .from('inbox_messages')
      .select(`
        id,
        sender_email,
        recipient_email,
        subject,
        snippet,
        status,
        received_at,
        lead_id,
        leads (
          id,
          first_name,
          last_name,
          company,
          email
        )
      `)
      .eq('user_id', user.id)
      .order('received_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    } else {
      query = query.neq('status', 'archived');
    }

    const { data: messages, error } = await query;

    if (error) {
      throw error;
    }

    return NextResponse.json({ messages });
  } catch (error: any) {
    console.error('Error fetching inbox:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
