import { NextResponse } from 'next/server';
import { createServiceClient } from '@/utils/supabase/service';

export async function GET() {
  const supabase = createServiceClient();
  const email = 'admin@outreach.com';
  const password = 'Password123!';

  try {
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Automatically confirms the email
    });

    if (error) {
      // If user already exists, let's return a friendly message
      if (error.message.includes('already exists') || error.status === 422) {
        return NextResponse.json({
          message: 'Seed account already exists.',
          email,
          password
        });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      message: 'Verified seed account created successfully!',
      email,
      password
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Server error during seeding' }, { status: 500 });
  }
}
