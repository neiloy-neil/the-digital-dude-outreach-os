import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { createClient } from '@supabase/supabase-js';

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    const signature = req.headers.get('stripe-signature');

    if (!signature || !webhookSecret) {
      return NextResponse.json({ error: 'Missing signature or secret' }, { status: 400 });
    }

    let event;
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err: any) {
      console.error(`Webhook signature verification failed: ${err.message}`);
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const handleSubscriptionChange = async (subscription: any) => {
      const customerId = subscription.customer as string;
      const status = subscription.status;
      const priceId = subscription.items.data[0].price.id;
      const currentPeriodEnd = new Date(subscription.current_period_end * 1000).toISOString();
      const trialEndsAt = subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null;

      await supabase
        .from('profiles')
        .update({
          stripe_subscription_id: subscription.id,
          stripe_price_id: priceId,
          subscription_status: status,
          stripe_current_period_end: currentPeriodEnd,
          trial_ends_at: trialEndsAt,
        })
        .eq('stripe_customer_id', customerId);
    };

    switch (event.type) {
      case 'checkout.session.completed':
        const session = event.data.object as any;
        if (session.mode === 'subscription') {
          // The customer.subscription.created event handles the update,
          // but we could also do logic here if needed.
        }
        break;
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        await handleSubscriptionChange(event.data.object);
        break;
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error('Webhook processing failed:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
