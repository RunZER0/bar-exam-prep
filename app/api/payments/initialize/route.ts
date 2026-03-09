/**
 * POST /api/payments/initialize
 *
 * Initialise a Paystack transaction.
 * Body: { tier, period, callbackUrl?, addon?, upgradeFrom? }
 * Returns: { authorization_url, reference, access_code }
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { db } from '@/lib/db';
import { paymentTransactions } from '@/lib/db/schema';
import { getSubscriptionInfo } from '@/lib/services/subscription';
import {
  TIER_PRICES,
  ADDON_PRICES,
  ADDON_PACKS,
  CUSTOM_FEATURE_PRICES,
  calculateUpgradeCost,
  calculateCustomPrice,
  type SubscriptionTier,
  type BillingPeriod,
  type PremiumFeature,
} from '@/lib/constants/pricing';
import crypto from 'crypto';

const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY;
const PAYSTACK_BASE = 'https://api.paystack.co';

export const POST = withAuth(async (req: NextRequest, user) => {
  if (!PAYSTACK_SECRET) {
    return NextResponse.json({ error: 'Payment provider not configured' }, { status: 503 });
  }

  const body = await req.json();
  const { tier, period, callbackUrl, addon, addonPack, customFeatures } = body;

  let amount: number;
  let description: string;
  let purchaseType: 'subscription' | 'addon' | 'addon_pack' | 'upgrade' | 'custom';
  let metadata: Record<string, any>;

  // ── Add-on pack purchase ──
  if (addonPack) {
    const pack = ADDON_PACKS.find(p => p.id === addonPack);
    if (!pack) {
      return NextResponse.json({ error: 'Invalid add-on pack' }, { status: 400 });
    }
    amount = pack.price * 100;
    description = pack.name;
    purchaseType = 'addon_pack';
    metadata = { purchaseType, addonPack: pack.id, feature: pack.feature, quantity: pack.quantity };
  }
  // ── Single add-on purchase ──
  else if (addon) {
    const feature = addon.feature as PremiumFeature;
    const qty = addon.quantity || 1;
    const unitPrice = ADDON_PRICES[feature];
    if (!unitPrice) {
      return NextResponse.json({ error: 'Invalid add-on feature' }, { status: 400 });
    }
    amount = unitPrice * qty * 100;
    description = `${qty}x ${feature} add-on pass`;
    purchaseType = 'addon';
    metadata = { purchaseType, feature, quantity: qty };
  }
  // ── Subscription / Upgrade / Custom ──
  else {
    if (!period || !['weekly', 'monthly', 'annual'].includes(period)) {
      return NextResponse.json({ error: 'Invalid period. Use: weekly, monthly, or annual' }, { status: 400 });
    }

    const targetPeriod = period as BillingPeriod;

    // ── Custom package ──
    if (tier === 'custom') {
      if (!Array.isArray(customFeatures) || customFeatures.length === 0) {
        return NextResponse.json({ error: 'Custom package requires at least one feature' }, { status: 400 });
      }
      const validFeatures = customFeatures.filter((f: string) =>
        ['drafting', 'oral_exam', 'oral_devil', 'cle_exam', 'research', 'clarify'].includes(f)
      ) as PremiumFeature[];
      if (validFeatures.length === 0) {
        return NextResponse.json({ error: 'No valid features selected' }, { status: 400 });
      }

      const customPrice = calculateCustomPrice(validFeatures, targetPeriod);
      amount = customPrice * 100;
      description = `Custom package (${validFeatures.length} features, ${targetPeriod})`;
      purchaseType = 'custom';
      metadata = { purchaseType, tier: 'custom', period: targetPeriod, customFeatures: validFeatures };
    }
    // ── Standard tier subscription / upgrade ──
    else {
      if (!tier || !TIER_PRICES[tier as Exclude<SubscriptionTier, 'custom'>]) {
        return NextResponse.json({ error: 'Invalid tier. Use: light, standard, premium, or custom' }, { status: 400 });
      }

      const targetTier = tier as SubscriptionTier;
      const fullPrice = TIER_PRICES[targetTier as Exclude<SubscriptionTier, 'custom'>][targetPeriod];

      // Check if this is an upgrade
      const sub = await getSubscriptionInfo(user.id);
      const isUpgrade = sub.isActive && !sub.isTrial && sub.tier !== 'free_trial';

      if (isUpgrade) {
        const upgradeCost = calculateUpgradeCost(
          sub.tier,
          sub.billingPeriod || 'monthly',
          targetTier,
          targetPeriod,
          sub.daysRemaining,
        );
        amount = upgradeCost * 100;
        description = `Upgrade to ${targetTier} (${targetPeriod})`;
        purchaseType = 'upgrade';
        metadata = { purchaseType, tier: targetTier, period: targetPeriod, previousTier: sub.tier, previousPeriod: sub.billingPeriod };
      } else {
        amount = fullPrice * 100;
        description = `${targetTier} plan (${targetPeriod})`;
        purchaseType = 'subscription';
        metadata = { purchaseType, tier: targetTier, period: targetPeriod };
      }
    }
  }

  // Minimum amount check (Paystack requires > 0)
  if (amount <= 0) {
    // Free upgrade (unlikely but possible if remaining credit covers it)
    return NextResponse.json({
      freeUpgrade: true,
      tier: metadata.tier,
      period: metadata.period,
      message: 'Your existing credit covers this upgrade. Activating now.',
    });
  }

  const reference = `ynai_${purchaseType}_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;

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
          ...metadata,
          custom_fields: [
            { display_name: 'Purchase', variable_name: 'description', value: description },
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
    try {
      await db.insert(paymentTransactions).values({
        userId: user.id,
        paystackReference: reference,
        plan: (metadata.period || 'monthly') as any,
        amount,
        currency: 'KES',
        status: 'pending',
        metadata,
      });
    } catch (dbErr) {
      console.error('[Paystack] Failed to record pending txn (non-fatal):', dbErr);
    }

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
