import { NextRequest, NextResponse } from 'next/server';
import { withAuth, type AuthUser } from '@/lib/auth/middleware';
import { db } from '@/lib/db';
import { oralSessions } from '@/lib/db/schema';
import { eq, desc, and, gt } from 'drizzle-orm';
import { getSubscriptionInfo } from '@/lib/services/subscription';

/**
 * POST — Save a completed oral session (transcript + optional audio)
 */
async function handlePost(req: NextRequest, user: AuthUser) {
  try {
    const body = await req.json();
    const {
      type,            // 'devils-advocate' | 'examiner'
      mode = 'balanced',
      unitId,
      durationSeconds,
      exchangeCount,
      score,
      summary,
      transcript,      // JSON array of messages
      audioBase64,     // optional: base64-encoded audio recording
    } = body;

    // Determine audio retention based on subscription
    const sub = await getSubscriptionInfo(user.id);
    const retentionDays = (sub.isActive && !sub.isTrial) ? 7 : 2;
    const audioExpiresAt = new Date();
    audioExpiresAt.setDate(audioExpiresAt.getDate() + retentionDays);

    // Store audio as data URL if provided (for now, inline storage)
    // In production, this would go to cloud storage (S3/R2)
    let audioUrl: string | null = null;
    if (audioBase64) {
      // Store as a reference — the actual audio blob is sent in separate download request
      audioUrl = `session-audio`; // marker that audio exists
    }

    const [session] = await db.insert(oralSessions).values({
      userId: user.id,
      type,
      mode,
      unitId: unitId || null,
      durationSeconds: durationSeconds || 0,
      exchangeCount: exchangeCount || 0,
      score: score || null,
      summary: summary || null,
      transcript: transcript || [],
      audioUrl,
      audioExpiresAt,
    }).returning();

    return NextResponse.json({
      id: session.id,
      audioExpiresAt: audioExpiresAt.toISOString(),
      retentionDays,
    });
  } catch (error: any) {
    console.error('Save session error:', error);
    return NextResponse.json({ error: 'Failed to save session' }, { status: 500 });
  }
}

/**
 * GET — List past sessions for the current user
 */
async function handleGet(req: NextRequest, user: AuthUser) {
  try {
    const sessions = await db.query.oralSessions.findMany({
      where: eq(oralSessions.userId, user.id),
      orderBy: [desc(oralSessions.createdAt)],
      columns: {
        id: true,
        type: true,
        mode: true,
        unitId: true,
        durationSeconds: true,
        exchangeCount: true,
        score: true,
        audioUrl: true,
        audioExpiresAt: true,
        createdAt: true,
      },
    });

    // Mark whether audio is still available
    const now = new Date();
    const enriched = sessions.map(s => ({
      ...s,
      audioAvailable: !!(s.audioUrl && s.audioExpiresAt && new Date(s.audioExpiresAt) > now),
    }));

    return NextResponse.json({ sessions: enriched });
  } catch (error: any) {
    console.error('List sessions error:', error);
    return NextResponse.json({ error: 'Failed to list sessions' }, { status: 500 });
  }
}

export const POST = withAuth(handlePost);
export const GET = withAuth(handleGet);
