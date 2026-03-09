/**
 * YNAI Mastery Progress API
 * 
 * POST: Record node phase completion (NOTE → EXHIBIT → DIAGNOSIS → MASTERY)
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { users, syllabusNodes } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { verifyIdToken } from '@/lib/firebase/admin';
import { MasteryOrchestrator } from '@/lib/services/mastery-orchestrator';
import { sendMasteryMilestoneEmail } from '@/lib/services/notification-service';

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

    // Event-driven: Send mastery milestone email when a topic is mastered
    if (phase === 'MASTERY' && (passed === true || passed === undefined)) {
      // Look up the node's topic name and unit for the email
      const [node] = await db.select({ topicName: syllabusNodes.topicName, unitCode: syllabusNodes.unitCode })
        .from(syllabusNodes)
        .where(eq(syllabusNodes.id, nodeId))
        .limit(1);

      if (node) {
        sendMasteryMilestoneEmail(user.id, node.topicName, node.unitCode).catch(console.error);
      }
    }

    return NextResponse.json(result);

  } catch (error) {
    console.error('Error recording mastery progress:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
