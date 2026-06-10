import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { createClient } from '@/utils/supabase/server';
import { AI_DEFAULT_MODEL } from '@/lib/ai/efficiency';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { data: profile } = await supabase.from('profiles').select('gemini_api_key').eq('id', user.id).single();

    if (!profile?.gemini_api_key) {
      return NextResponse.json({ error: 'Gemini API key is not configured.' }, { status: 400 });
    }

    const { data: inboxMessage } = await supabase
      .from('inbox_messages')
      .select('*, leads(*)')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (!inboxMessage || !inboxMessage.leads) {
      return NextResponse.json({ error: 'Message or lead not found' }, { status: 404 });
    }

    const lead = inboxMessage.leads;

    const prompt = `You are a professional sales representative. Write a concise, polite reply to the following email from a prospect.
Context:
Prospect Name: ${lead.first_name || lead.decision_maker_name || 'Prospect'}
Prospect Company: ${lead.company || lead.company_name || 'Unknown'}

Prospect's Email Message:
"${inboxMessage.body_text || inboxMessage.snippet}"

Instructions:
1. Keep the reply short and professional.
2. If they ask a question, answer it vaguely but suggest a quick call to discuss details.
3. If they object, acknowledge it politely.
4. Output ONLY the email body text. Do not include subject lines or placeholder greetings.`;

    const ai = new GoogleGenAI({ apiKey: profile.gemini_api_key });
    const response = await ai.models.generateContent({
      model: AI_DEFAULT_MODEL,
      contents: prompt,
    });

    let draft = response.text || '';
    draft = draft.trim();

    return NextResponse.json({ success: true, draft });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
