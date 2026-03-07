/**
 * YNAI Mastery Progress API
 * 
 * POST: Record node phase completion (NOTE → EXHIBIT → DIAGNOSIS → MASTERY)
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { verifyIdToken } from '@/lib/firebase/admin';
import { MasteryOrchestrator } from '@/lib/services/mastery-orchestrator';

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await verifyIdToken(token);
    
    const [user] = await db.select().from(users)
      .where(eq(users.firebaseUid, decodedToken.uid))
      .limit(1);

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const body = await req.json();
    const { nodeId, phase, score, passed } = body;

    if (!nodeId || !phase) {
      return NextResponse.json({ error: 'nodeId and phase are required' }, { status: 400 });
    }

    const validPhases = ['NOTE', 'EXHIBIT', 'DIAGNOSIS', 'MASTERY'];
    if (!validPhases.includes(phase)) {
      return NextResponse.json({ error: 'Invalid phase' }, { status: 400 });
    }

    const result = await MasteryOrchestrator.advanceNodePhase(user.id, nodeId, {
      phase,
      score: score ?? undefined,
      passed: passed ?? (phase === 'NOTE' || phase === 'EXHIBIT' ? true : undefined),
    });

    return NextResponse.json(result);

  } catch (error) {
    console.error('Error recording mastery progress:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
