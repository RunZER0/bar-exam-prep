/**
 * YNAI Mastery Engine v3 - Daily Plan API
 * 
 * GET: Fetch or generate today's plan
 * POST: Generate a new plan for specified date
 * PATCH: Update task status (completed, skipped, deferred)
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { verifyIdToken } from '@/lib/firebase/admin';
import { MasteryOrchestrator } from '@/lib/services/mastery-orchestrator';

/**
 * GET /api/mastery/plan
 * Fetch today's hybrid study queue (75% Syllabus / 25% Witness Reinforcement)
 */
export async function GET(req: NextRequest) {
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

    // Generate the Integrated Queue
    const queueResult = await MasteryOrchestrator.generateDailyQueue(user.id);
    
    return NextResponse.json(queueResult);

  } catch (error) {
    console.error('Error fetching mastery plan:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

/**
 * POST /api/mastery/plan
 * Generate a new plan (force regenerate)
 */
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

    const body = await req.json().catch(() => ({}));
    
    // For now, just return the standard queue like GET does
    const queueResult = await MasteryOrchestrator.generateDailyQueue(user.id);
    return NextResponse.json(queueResult);

  } catch (error) {
    console.error('Error generating plan:', error);
    return NextResponse.json(
      { error: 'Failed to generate plan' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/mastery/plan
 * Update task status
 */
export async function PATCH(req: NextRequest) {
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
    const { taskId, status, actualMinutes, deferredTo } = body;
    
    if (!taskId || !status) {
      return NextResponse.json({ error: 'taskId and status required' }, { status: 400 });
    }
    
    if (!['pending', 'in_progress', 'completed', 'skipped', 'deferred'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }
    
    // TODO: Update in database when schema is migrated
    // await db.update(dailyPlanItems)
    //   .set({ 
    //     status, 
    //     actualMinutes, 
    //     deferredTo,
    //     completedAt: status === 'completed' ? new Date() : null,
    //     skippedAt: status === 'skipped' ? new Date() : null,
    //   })
    //   .where(and(
    //     eq(dailyPlanItems.id, taskId),
    //     eq(dailyPlanItems.userId, user.id)
    //   ));
    
    return NextResponse.json({
      success: true,
      taskId,
      status,
      updatedAt: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Error updating task:', error);
    return NextResponse.json(
      { error: 'Failed to update task' },
      { status: 500 }
    );
  }
}
