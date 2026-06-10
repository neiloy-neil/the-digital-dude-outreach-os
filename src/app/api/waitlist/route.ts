import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = body.email?.trim()?.toLowerCase();

    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
    }

    const supabase = await createClient();

    // Check if the email already exists to return a friendly message
    const { data: existing } = await supabase
      .from('waitlist')
      .select('id')
      .eq('email', email)
      .single();

    if (existing) {
      return NextResponse.json({ message: 'You are already on the waitlist!' });
    }

    // Insert new waitlist entry
    const { error } = await supabase
      .from('waitlist')
      .insert([{ email }]);

    if (error) {
      // In case of race condition throwing unique constraint
      if (error.code === '23505') {
        return NextResponse.json({ message: 'You are already on the waitlist!' });
      }
      throw error;
    }

    return NextResponse.json({ message: 'Success! You have been added to the waitlist.' });
  } catch (error: any) {
    console.error('Waitlist error:', error);
    return NextResponse.json({ error: 'Failed to join waitlist. Please try again.' }, { status: 500 });
  }
}
