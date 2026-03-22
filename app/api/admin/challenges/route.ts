/**
 * Admin Challenges Management API
 * GET  - List all community events/challenges with stats
 * DELETE - Clear peer challenges and/or expire AI challenges
 * POST - Force-regenerate today's AI challenges
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/auth/middleware';
import { db } from '@/lib/db';
import { communityEvents, eventParticipants } from '@/lib/db/schema';
import { eq, desc, count, and, not } from 'drizzle-orm';

// GET - List all challenges
export const GET = withAdminAuth(async (req: NextRequest) => {
  try {
    const allEvents = await db
      .select({
        id: communityEvents.id,
        title: communityEvents.title,
        type: communityEvents.type,
        status: communityEvents.status,
        unitId: communityEvents.unitId,
        isAgentCreated: communityEvents.isAgentCreated,
        reviewStatus: communityEvents.reviewStatus,
        submitterName: communityEvents.submitterName,
        startsAt: communityEvents.startsAt,
        endsAt: communityEvents.endsAt,
        createdAt: communityEvents.createdAt,
      })
      .from(communityEvents)
      .orderBy(desc(communityEvents.createdAt));

    const enriched = await Promise.all(
      allEvents.map(async (ev) => {
        const [{ cnt }] = await db
          .select({ cnt: count() })
          .from(eventParticipants)
          .where(eq(eventParticipants.eventId, ev.id));
        return { ...ev, participantCount: cnt };
      })
    );

    const aiChallenges = enriched.filter(e => e.isAgentCreated);
    const peerChallenges = enriched.filter(e => !e.isAgentCreated);

    return NextResponse.json({ aiChallenges, peerChallenges, total: enriched.length });
  } catch (error) {
    console.error('Admin challenges GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch challenges' }, { status: 500 });
  }
});

// DELETE - Clear peer and/or AI challenges
export const DELETE = withAdminAuth(async (req: NextRequest) => {
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type') || 'peer'; // 'peer' | 'ai' | 'all'

    let deletedPeer = 0;
    let expiredAi = 0;

    if (type === 'peer' || type === 'all') {
      // Hard-delete peer-created challenges (isAgentCreated=false)
      // First remove participants to avoid FK constraint
      const peerEvents = await db
        .select({ id: communityEvents.id })
        .from(communityEvents)
        .where(eq(communityEvents.isAgentCreated, false));

      for (const ev of peerEvents) {
        await db.delete(eventParticipants).where(eq(eventParticipants.eventId, ev.id));
      }
      const deleted = await db
        .delete(communityEvents)
        .where(eq(communityEvents.isAgentCreated, false))
        .returning({ id: communityEvents.id });
      deletedPeer = deleted.length;
    }

    if (type === 'ai' || type === 'all') {
      // Expire all active AI challenges so fresh ones are generated on next request
      const expired = await db
        .update(communityEvents)
        .set({ status: 'completed' })
        .where(and(
          eq(communityEvents.isAgentCreated, true),
          not(eq(communityEvents.status, 'completed'))
        ))
        .returning({ id: communityEvents.id });
      expiredAi = expired.length;
    }

    return NextResponse.json({
      success: true,
      deletedPeerChallenges: deletedPeer,
      expiredAiChallenges: expiredAi,
      message: `Cleared ${deletedPeer} peer challenge(s). Expired ${expiredAi} AI challenge(s) — fresh ones will be generated on the next page load.`,
    });
  } catch (error) {
    console.error('Admin challenges DELETE error:', error);
    return NextResponse.json({ error: 'Failed to clear challenges' }, { status: 500 });
  }
});

// POST - Force-regenerate (expire AI challenges so they re-generate)
export const POST = withAdminAuth(async (req: NextRequest) => {
  try {
    const { action } = await req.json();
    if (action !== 'force-regenerate') {
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }

    const expired = await db
      .update(communityEvents)
      .set({ status: 'completed' })
      .where(and(
        eq(communityEvents.isAgentCreated, true),
        not(eq(communityEvents.status, 'completed'))
      ))
      .returning({ id: communityEvents.id });

    return NextResponse.json({
      success: true,
      expiredCount: expired.length,
      message: `Expired ${expired.length} AI challenge(s). Visit the community Events tab to trigger fresh AI generation.`,
    });
  } catch (error) {
    console.error('Admin challenges POST error:', error);
    return NextResponse.json({ error: 'Failed to force regenerate' }, { status: 500 });
  }
});
