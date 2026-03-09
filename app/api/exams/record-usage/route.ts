import { NextRequest, NextResponse } from 'next/server';
import { withAuth, type AuthUser } from '@/lib/auth/middleware';
import { incrementFeatureUsage } from '@/lib/services/subscription';

/**
 * POST /api/exams/record-usage
 * Increments CLE exam usage for the current user.
 */
async function handlePost(_req: NextRequest, user: AuthUser) {
  try {
    const result = await incrementFeatureUsage(user.id, 'cle_exam');
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error recording exam usage:', error);
    return NextResponse.json({ error: 'Failed to record usage' }, { status: 500 });
  }
}

export const POST = withAuth(handlePost);
