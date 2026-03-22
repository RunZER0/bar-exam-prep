/**
 * Scheduled cron endpoint — refreshes daily AI challenges automatically.
 * Called by Render's cron service every day at 00:10 EAT (21:10 UTC) so
 * challenges are ready before students wake up.
 *
 * Also purges expired-but-not-completed events and trims history.
 *
 * Authentication: Bearer token in Authorization header must match CRON_SECRET.
 */

import { NextRequest, NextResponse } from 'next/server';
import { ensureActiveChallenges } from '@/app/api/community/events/route';
import { db } from '@/lib/db';
import { communityEvents, eventParticipants } from '@/lib/db/schema';
import { eq, and, lte, gte, not, lt, sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  // Verify cron secret
  const auth = req.headers.get('authorization') || '';
  const secret = process.env.CRON_SECRET || '';
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date();
  const log: string[] = [];

  try {
    // 1. Expire any AI challenges whose endsAt has passed (belt-and-braces cleanup)
    const expired = await db
      .update(communityEvents)
      .set({ status: 'completed' })
      .where(and(
        eq(communityEvents.status, 'active'),
        lte(communityEvents.endsAt, now)
      ))
      .returning({ id: communityEvents.id });
    log.push(`Expired ${expired.length} stale active challenge(s)`);

    // 2. Delete peer challenges older than 30 days (keep DB clean)
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const oldPeer = await db
      .select({ id: communityEvents.id })
      .from(communityEvents)
      .where(and(
        eq(communityEvents.isAgentCreated, false),
        lt(communityEvents.createdAt, thirtyDaysAgo)
      ));
    if (oldPeer.length > 0) {
      const ids = oldPeer.map(e => e.id);
      for (const id of ids) {
        await db.delete(eventParticipants).where(eq(eventParticipants.eventId, id));
      }
      await db.delete(communityEvents).where(
        sql`id = ANY(ARRAY[${sql.raw(ids.map(id => `'${id}'`).join(','))}]::uuid[])`
      );
      log.push(`Purged ${ids.length} old peer challenge(s) (>30 days)`);
    }

    // 3. Trigger AI challenge generation for today
    await ensureActiveChallenges();
    log.push('ensureActiveChallenges() completed — today\'s AI challenges are ready');

    return NextResponse.json({ success: true, timestamp: now.toISOString(), log });
  } catch (err: any) {
    console.error('[CronChallenges] Error:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Unknown error', log },
      { status: 500 }
    );
  }
}
