/**
 * POST /api/payments/initialize
 *
 * Initialise a Paystack transaction.
 * Body: { plan: 'weekly' | 'monthly' | 'annual', callbackUrl?: string }
 * Returns: { authorization_url, reference, access_code }
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { db } from '@/lib/db';
import { paymentTransactions } from '@/lib/db/schema';
import crypto from 'crypto';

const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY;
const PAYSTACK_BASE = 'https://api.paystack.co';

const PLAN_PRICES: Record<string, number> = {
  weekly: 500,
  monthly: 1500,
  annual: 12000,
};

export const POST = withAuth(async (req: NextRequest, user) => {
  if (!PAYSTACK_SECRET) {
    return NextResponse.json({ error: 'Payment provider not configured' }, { status: 503 });
  }

  const body = await req.json();
  const { plan, callbackUrl } = body;

  if (!plan || !PLAN_PRICES[plan]) {
    return NextResponse.json({ error: 'Invalid plan. Use: weekly, monthly, or annual' }, { status: 400 });
  }

  const amount = PLAN_PRICES[plan] * 100; // Paystack uses kobo (smallest unit)
  const reference = `ynai_${plan}_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;

  try {
    const response = await fetch(`${PAYSTACK_BASE}/transaction/initialize`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: user.email,
        amount,
        currency: 'KES',
        reference,
        callback_url: callbackUrl || `${process.env.NEXT_PUBLIC_APP_URL || 'https://ynai.co.ke'}/subscribe?ref=${reference}`,
        metadata: {
          userId: user.id,
          plan,
          custom_fields: [
            { display_name: 'Plan', variable_name: 'plan', value: plan },
            { display_name: 'User', variable_name: 'user_email', value: user.email },
          ],
        },
        channels: ['card', 'mobile_money'],
      }),
    });

    const data = await response.json();

    if (!data.status) {
      console.error('[Paystack] Init failed:', data);
      return NextResponse.json({ error: 'Failed to initialize payment' }, { status: 500 });
    }

    // Record the pending transaction
    await db.insert(paymentTransactions).values({
      userId: user.id,
      paystackReference: reference,
      plan: plan as any,
      amount,
      currency: 'KES',
      status: 'pending',
    });

    return NextResponse.json({
      authorization_url: data.data.authorization_url,
      reference: data.data.reference,
      access_code: data.data.access_code,
    });
  } catch (error) {
    console.error('[Paystack] Initialize error:', error);
    return NextResponse.json({ error: 'Payment initialization failed' }, { status: 500 });
  }
});
