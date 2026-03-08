/**
 * GET /api/payments/verify?reference=xxx
 *
 * Verify a Paystack transaction and activate subscription if successful.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { db } from '@/lib/db';
import { paymentTransactions } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { activateSubscription } from '@/lib/services/subscription';

const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY;
const PAYSTACK_BASE = 'https://api.paystack.co';

export const GET = withAuth(async (req: NextRequest, user) => {
  if (!PAYSTACK_SECRET) {
    return NextResponse.json({ error: 'Payment provider not configured' }, { status: 503 });
  }

  const reference = req.nextUrl.searchParams.get('reference');
  if (!reference) {
    return NextResponse.json({ error: 'Reference is required' }, { status: 400 });
  }

  try {
    // Verify with Paystack
    const response = await fetch(`${PAYSTACK_BASE}/transaction/verify/${encodeURIComponent(reference)}`, {
      headers: { Authorization: `Bearer ${PAYSTACK_SECRET}` },
    });

    const data = await response.json();

    if (!data.status || data.data.status !== 'success') {
      return NextResponse.json({
        verified: false,
        message: data.data?.gateway_response || 'Payment not verified',
      });
    }

    const txn = data.data;

    // Update the transaction record
    await db.update(paymentTransactions).set({
      paystackTransactionId: String(txn.id),
      status: 'success',
      channel: txn.channel,
      paidAt: new Date(txn.paid_at),
      metadata: txn.metadata,
    }).where(eq(paymentTransactions.paystackReference, reference));

    // Activate subscription
    const plan = txn.metadata?.plan || 'monthly';
    await activateSubscription(
      user.id,
      plan,
      String(txn.customer?.customer_code || ''),
    );

    return NextResponse.json({
      verified: true,
      plan,
      amount: txn.amount / 100,
      currency: txn.currency,
      channel: txn.channel,
    });
  } catch (error) {
    console.error('[Paystack] Verify error:', error);
    return NextResponse.json({ error: 'Verification failed' }, { status: 500 });
  }
});
