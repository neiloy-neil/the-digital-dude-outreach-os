import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    // Validate basics
    const email = body.email?.trim()?.toLowerCase();
    const fullName = body.full_name?.trim();

    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
    }
    if (!fullName) {
      return NextResponse.json({ error: 'Full name is required' }, { status: 400 });
    }

    const supabase = await createClient();

    // Check existing
    const { data: existing } = await supabase
      .from('waitlist_signups')
      .select('id')
      .eq('email', email)
      .single();

    if (existing) {
      return NextResponse.json({ message: 'You\'re already on the waitlist.' });
    }

    // Insert new entry
    const { error } = await supabase
      .from('waitlist_signups')
      .insert([{ 
        email,
        full_name: fullName,
        company_name: body.company_name?.trim() || null,
        role: body.role?.trim() || null,
        current_outreach_method: body.current_outreach_method?.trim() || null,
        use_case: body.use_case?.trim() || null,
        monthly_outreach_volume: body.monthly_outreach_volume?.trim() || null,
        website_url: body.website_url?.trim() || null,
        agreed_to_updates: !!body.agreed_to_updates
      }]);

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ message: 'You\'re already on the waitlist.' });
      }
      throw error;
    }

    return NextResponse.json({ message: 'Success! You have been added to the waitlist.' });
  } catch (error: any) {
    console.error('Waitlist error:', error);
    return NextResponse.json({ error: 'Failed to join waitlist. Please try again.' }, { status: 500 });
  }
}
