/**
 * GET /api/payments/status
 *
 * Returns the current user's subscription status, plan, trial info, and usage limits.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { getSubscriptionInfo } from '@/lib/services/subscription';

export const GET = withAuth(async (_req: NextRequest, user) => {
  const info = await getSubscriptionInfo(user.id);

  return NextResponse.json({
    plan: info.plan,
    status: info.status,
    isActive: info.isActive,
    isTrial: info.isTrial,
    trialExpired: info.trialExpired,
    trialEndsAt: info.trialEndsAt?.toISOString() || null,
    subscriptionEndsAt: info.subscriptionEndsAt?.toISOString() || null,
    canAccess: {
      mastery: info.canAccess('mastery'),
      study: info.canAccess('study'),
      quizzes: info.canAccess('quizzes'),
      drafting: info.canAccess('drafting'),
      oral_devil: info.canAccess('oral_devil'),
      oral_exam: info.canAccess('oral_exam'),
    },
    usage: info.usage,
  });
});
