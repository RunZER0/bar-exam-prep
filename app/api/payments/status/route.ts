/**
 * GET /api/payments/status
 *
 * Returns the current user's subscription status, tier, feature usage, and limits.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { getSubscriptionInfo } from '@/lib/services/subscription';

export const GET = withAuth(async (_req: NextRequest, user) => {
  const info = await getSubscriptionInfo(user.id);

  // Serialize feature usage for JSON
  const featureUsage: Record<string, any> = {};
  for (const [key, val] of Object.entries(info.featureUsage)) {
    featureUsage[key] = {
      used: val.used,
      limit: val.limit,
      addonRemaining: val.addonRemaining,
      canUse: val.canUse,
    };
  }

  return NextResponse.json({
    tier: info.tier,
    billingPeriod: info.billingPeriod,
    plan: info.plan,
    status: info.status,
    isActive: info.isActive,
    isTrial: info.isTrial,
    trialExpired: info.trialExpired,
    trialEndsAt: info.trialEndsAt?.toISOString() || null,
    subscriptionEndsAt: info.subscriptionEndsAt?.toISOString() || null,
    daysRemaining: info.daysRemaining,
    clarifyModel: info.clarifyModel,
    canAccess: {
      mastery: info.canAccess('mastery_hub'),
      study: info.canAccess('study_hub'),
      quizzes: info.canAccess('quizzes'),
      drafting: info.canAccess('drafting'),
      oral_devil: info.canAccess('oral_devil'),
      oral_exam: info.canAccess('oral_exam'),
      cle_exam: info.canAccess('cle_exam'),
      research: info.canAccess('research'),
      clarify: info.canAccess('clarify'),
    },
    featureUsage,
    usage: info.usage,
  });
});
