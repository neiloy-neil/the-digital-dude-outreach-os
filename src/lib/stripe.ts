import Stripe from 'stripe';

export const stripe = process.env.STRIPE_SECRET_KEY 
  ? new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2026-05-27.dahlia',
      appInfo: {
        name: 'ReachMira',
        version: '0.1.0',
      },
    })
  : null as unknown as Stripe; // Fallback for Vercel builds without the key
