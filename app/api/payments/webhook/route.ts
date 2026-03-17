/**
 * POST /api/payments/webhook
 *
 * Paystack Webhook handler.
 * Validates signature, processes charge.success and subscription events.
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { db } from '@/lib/db';
import { paymentTransactions, users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { activateSubscription, cancelSubscription } from '@/lib/services/subscription';
import type { SubscriptionTier, BillingPeriod } from '@/lib/constants/pricing';

const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY;

function verifySignature(body: string, signature: string): boolean {
  if (!PAYSTACK_SECRET) return false;
  const hash = crypto
    .createHmac('sha512', PAYSTACK_SECRET)
    .update(body)
    .digest('hex');
  return hash === signature;
}

export async function POST(req: NextRequest) {
  if (!PAYSTACK_SECRET) {
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 503 });
  }

  const signature = req.headers.get('x-paystack-signature') || '';
  const rawBody = await req.text();

  if (!verifySignature(rawBody, signature)) {
    console.warn('[Webhook] Invalid Paystack signature');
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  const event = JSON.parse(rawBody);
  console.log(`[Webhook] Received event: ${event.event}`);

  try {
    switch (event.event) {
      case 'charge.success': {
        const txn = event.data;
        const reference = txn.reference;
        const plan = txn.metadata?.plan;
        const tier = (txn.metadata?.tier || 'light') as SubscriptionTier;
        const period = (txn.metadata?.period || 'monthly') as BillingPeriod;
        const userId = txn.metadata?.userId;

        if (!userId) {
          console.warn('[Webhook] charge.success missing userId in metadata');
          break;
        }

        // Update transaction record
        await db.update(paymentTransactions).set({
          paystackTransactionId: String(txn.id),
          status: 'success',
          channel: txn.channel,
          paidAt: new Date(txn.paid_at || txn.transaction_date),
          metadata: txn.metadata,
        }).where(eq(paymentTransactions.paystackReference, reference));

        // Activate subscription
        if (tier === 'custom') {
          const customFeatures = txn.metadata?.customFeatures || [];
          const customSelections = txn.metadata?.customSelections || [];
          const durationWeeks = txn.metadata?.durationWeeks || undefined;
          let customLimits: Record<string, number> | undefined;
          if (Array.isArray(customSelections) && customSelections.length > 0) {
            customLimits = {};
            for (const s of customSelections) {
              if (s.feature && typeof s.sessionsPerWeek === 'number') {
                customLimits[s.feature] = s.sessionsPerWeek;
              }
            }
          }
          await activateSubscription(userId, tier, period, String(txn.customer?.customer_code || ''), undefined, customFeatures, customLimits, durationWeeks);
        } else {
          await activateSubscription(
            userId,
            tier,
            period,
            String(txn.customer?.customer_code || ''),
          );
        }

        console.log(`[Webhook] Activated ${tier}/${period} for user ${userId}`);
        break;
      }

      case 'subscription.create': {
        const sub = event.data;
        const customerCode = sub.customer?.customer_code;
        if (customerCode) {
          // Link the Paystack subscription code to the user
          await db.update(users).set({
            paystackSubscriptionCode: sub.subscription_code,
          }).where(eq(users.paystackCustomerId, customerCode));
        }
        break;
      }

      case 'subscription.disable':
      case 'subscription.not_renew': {
        const sub = event.data;
        const customerCode = sub.customer?.customer_code;
        if (customerCode) {
          const user = await db.query.users.findFirst({
            where: eq(users.paystackCustomerId, customerCode),
          });
          if (user) {
            await cancelSubscription(user.id);
            console.log(`[Webhook] Cancelled subscription for user ${user.id}`);
          }
        }
        break;
      }

      case 'invoice.payment_failed': {
        const inv = event.data;
        const customerCode = inv.customer?.customer_code;
        if (customerCode) {
          await db.update(users).set({
            subscriptionStatus: 'past_due',
            updatedAt: new Date(),
          }).where(eq(users.paystackCustomerId, customerCode));
        }
        break;
      }

      default:
        console.log(`[Webhook] Unhandled event: ${event.event}`);
    }
  } catch (error) {
    console.error('[Webhook] Processing error:', error);
    // Still return 200 so Paystack doesn't retry
  }

  return NextResponse.json({ received: true });
}
