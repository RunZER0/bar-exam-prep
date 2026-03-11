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
    if (!sub.canAccess('cle_exam')) {
      return NextResponse.json(
        { error: 'FEATURE_LIMIT', message: 'CLE exam limit reached' },
        { status: 403 }
      );
    }

    const result = await incrementFeatureUsage(user.id, 'cle_exam');
    if (!result.success) {
      return NextResponse.json(
        { error: 'FEATURE_LIMIT', message: 'CLE exam limit reached' },
        { status: 403 }
      );
    }
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error recording exam usage:', error);
    return NextResponse.json({ error: 'Failed to record usage' }, { status: 500 });
  }
}

export const POST = withAuth(handlePost);
