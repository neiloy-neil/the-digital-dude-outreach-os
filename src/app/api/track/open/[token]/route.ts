import { NextResponse } from 'next/server';
import { createServiceClient } from '@/utils/supabase/service';

// 1x1 transparent GIF
const PIXEL = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');

function pixelResponse() {
  return new NextResponse(PIXEL, {
    status: 200,
    headers: {
      'Content-Type': 'image/gif',
      'Content-Length': String(PIXEL.length),
      'Cache-Control': 'no-store, no-cache, must-revalidate, private',
      Pragma: 'no-cache',
    },
  });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  if (token && /^[a-f0-9]{16,64}$/i.test(token)) {
    try {
      const supabase = createServiceClient();
      // Only the first open is recorded; repeat opens keep the original timestamp.
      await supabase
        .from('sent_emails')
        .update({ opened_at: new Date().toISOString() })
        .eq('tracking_token', token)
        .is('opened_at', null);
    } catch (err) {
      console.error('Open tracking failed:', err);
    }
  }

  // Always return the pixel — tracking failures must never break email rendering.
  return pixelResponse();
}
