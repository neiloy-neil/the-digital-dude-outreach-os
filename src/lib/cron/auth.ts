import { NextResponse } from 'next/server';

/**
 * Verifies the Authorization header for cron route requests.
 *
 * Fails CLOSED: if CRON_SECRET is not set in the environment, the route is
 * treated as unauthorized (returns 500). Never skips the check.
 *
 * Returns null if the request is authorized, or a NextResponse error to
 * return immediately if it is not.
 */
export function verifyCronAuth(request: Request): NextResponse | null {
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    console.error(
      '[verifyCronAuth] CRON_SECRET is not set. Refusing request to prevent unauthenticated cron access.'
    );
    return NextResponse.json(
      { error: 'Cron secret is not configured on this server.' },
      { status: 500 }
    );
  }

  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return null; // authorized
}
