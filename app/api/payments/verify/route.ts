/**
 * GET /api/payments/verify?reference=xxx
 *
 * Verify a Paystack transaction and activate subscription / add-on if successful.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { db } from '@/lib/db';
import { paymentTransactions } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { activateSubscription, upgradeSubscription, addAddonPasses, getSubscriptionInfo } from '@/lib/services/subscription';
import { ADDON_PACKS } from '@/lib/constants/pricing';
import type { SubscriptionTier, BillingPeriod, PremiumFeature } from '@/lib/constants/pricing';
import {
  sendSubscriptionActivatedEmail,
  sendTierUpgradedEmail,
  sendAddonPurchasedEmail,
  sendPaymentReceiptEmail,
} from '@/lib/services/notification-service';

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
    const meta = txn.metadata || {};

    // Update the transaction record
    await db.update(paymentTransactions).set({
      paystackTransactionId: String(txn.id),
      status: 'success',
      channel: txn.channel,
      paidAt: new Date(txn.paid_at),
      metadata: txn.metadata,
    }).where(eq(paymentTransactions.paystackReference, reference));

    const purchaseType = meta.purchaseType || 'subscription';

    // ── Handle based on purchase type ──
    if (purchaseType === 'addon' || purchaseType === 'addon_pack') {
      // Add-on pass purchase
      let feature: PremiumFeature;
      let quantity: number;
      let price: number;

      if (purchaseType === 'addon_pack') {
        const pack = ADDON_PACKS.find(p => p.id === meta.addonPack);
        feature = pack?.feature || meta.feature;
        quantity = pack?.quantity || meta.quantity || 1;
        price = pack?.price || (txn.amount / 100);
      } else {
        feature = meta.feature;
        quantity = meta.quantity || 1;
        price = txn.amount / 100;
      }

      await addAddonPasses(user.id, feature, quantity, price, reference);

      // Event-driven emails: addon purchase confirmation + payment receipt
      const amountKES = txn.amount / 100;
      sendAddonPurchasedEmail(user.id, feature, quantity, amountKES, reference).catch(console.error);
      sendPaymentReceiptEmail(user.id, amountKES, `Add-on: ${quantity}x ${feature} passes`, reference, txn.channel).catch(console.error);

      return NextResponse.json({
        verified: true,
        purchaseType,
        feature,
        quantity,
        amount: txn.amount / 100,
        currency: txn.currency,
        channel: txn.channel,
      });
    }

    // ── Subscription, Upgrade, or Custom ──
    const tier = (meta.tier || 'light') as SubscriptionTier;
    const period = (meta.period || 'monthly') as BillingPeriod;
    const amountKES = txn.amount / 100;

    if (purchaseType === 'upgrade') {
      // Get current tier before upgrading for the email
      const currentSub = await getSubscriptionInfo(user.id);
      const previousTier = currentSub.tier;

      await upgradeSubscription(user.id, tier, period);

      // Event-driven emails: upgrade confirmation + payment receipt
      sendTierUpgradedEmail(user.id, previousTier, tier).catch(console.error);
      sendPaymentReceiptEmail(user.id, amountKES, `Upgrade to ${tier} (${period})`, reference, txn.channel).catch(console.error);
    } else if (purchaseType === 'custom') {
      // Custom package — build per-feature limits map from selections
      const customFeatures = meta.customFeatures || [];
      const customSelections = meta.customSelections || [];
      const durationWeeks = meta.durationWeeks || undefined;

      // Build { feature: sessionsPerWeek } map from selections
      let customLimits: Record<string, number> | undefined;
      if (Array.isArray(customSelections) && customSelections.length > 0) {
        customLimits = {};
        for (const s of customSelections) {
          if (s.feature && typeof s.sessionsPerWeek === 'number') {
            customLimits[s.feature] = s.sessionsPerWeek;
          }
        }
      }

      await activateSubscription(
        user.id,
        'custom' as SubscriptionTier,
        period,
        String(txn.customer?.customer_code || ''),
        undefined,
        customFeatures,
        customLimits,
        durationWeeks,
      );

      sendSubscriptionActivatedEmail(user.id, 'custom' as SubscriptionTier, period, amountKES).catch(console.error);
      sendPaymentReceiptEmail(user.id, amountKES, `Custom package (${period})`, reference, txn.channel).catch(console.error);
    } else {
      await activateSubscription(
        user.id,
        tier,
        period,
        String(txn.customer?.customer_code || ''),
      );

      // Event-driven emails: subscription activated + payment receipt
      sendSubscriptionActivatedEmail(user.id, tier, period, amountKES).catch(console.error);
      sendPaymentReceiptEmail(user.id, amountKES, `${tier} plan (${period})`, reference, txn.channel).catch(console.error);
    }

    return NextResponse.json({
      verified: true,
      purchaseType,
      tier,
      period,
      amount: txn.amount / 100,
      currency: txn.currency,
      channel: txn.channel,
    });
  } catch (error) {
    console.error('[Paystack] Verify error:', error);
    return NextResponse.json({ error: 'Verification failed' }, { status: 500 });
  }
});
