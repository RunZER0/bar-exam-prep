import { NextRequest, NextResponse } from 'next/server';
import { withAuth, type AuthUser } from '@/lib/auth/middleware';
import { getSubscriptionInfo, incrementFeatureUsage } from '@/lib/services/subscription';

/**
 * POST /api/exams/record-usage
 * Checks CLE exam access and increments usage for the current user.
 */
async function handlePost(_req: NextRequest, user: AuthUser) {
  try {
    // Check subscription access first
    const sub = await getSubscriptionInfo(user.id);
    const fu = sub.featureUsage.cle_exam;
    if (!sub.canAccess('cle_exam')) {
      return NextResponse.json({
        error: 'FEATURE_LIMIT',
        message: sub.trialExpired
          ? 'Your free trial has ended. Subscribe to continue taking CLE exams.'
          : `You've used ${fu?.used ?? 0}/${fu?.limit ?? 0} CLE exam sessions this week. Upgrade or buy an add-on pass.`,
        upgradeUrl: '/subscribe',
        feature: 'cle_exam',
        tier: sub.tier,
      }, { status: 403 });
    }

    const result = await incrementFeatureUsage(user.id, 'cle_exam');
    if (!result.success) {
      return NextResponse.json({
        error: 'FEATURE_LIMIT',
        message: `You've used ${fu?.used ?? 0}/${fu?.limit ?? 0} CLE exam sessions this week. Upgrade or buy an add-on pass.`,
        upgradeUrl: '/subscribe',
        feature: 'cle_exam',
        tier: sub.tier,
      }, { status: 403 });
    }
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error recording exam usage:', error);
    return NextResponse.json({ error: 'Failed to record usage' }, { status: 500 });
  }
}

export const POST = withAuth(handlePost);
