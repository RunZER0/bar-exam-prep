import { NextRequest, NextResponse } from 'next/server';
import { withAuth, type AuthUser } from '@/lib/auth/middleware';
import { db } from '@/lib/db';
import { oralSessions } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

/**
 * GET — Get session details including transcript (for replay / download)
 */
async function handleGet(req: NextRequest, user: AuthUser) {
  const sessionId = req.nextUrl.pathname.split('/').pop();
  if (!sessionId) {
    return NextResponse.json({ error: 'Session ID required' }, { status: 400 });
  }

  try {
    const session = await db.query.oralSessions.findFirst({
      where: and(
        eq(oralSessions.id, sessionId),
        eq(oralSessions.userId, user.id),
      ),
    });

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const now = new Date();
    const audioAvailable = !!(session.audioUrl && session.audioExpiresAt && new Date(session.audioExpiresAt) > now);

    return NextResponse.json({
      ...session,
      audioAvailable,
    });
  } catch (error: any) {
    console.error('Get session error:', error);
    return NextResponse.json({ error: 'Failed to get session' }, { status: 500 });
  }
}

export const GET = withAuth(handleGet);
