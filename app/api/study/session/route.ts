import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { 
  users, studySessions, studyAssets, sessionEvents,
  microSkills
} from '@/lib/db/schema';
import { eq, and, gte, lte, sql } from 'drizzle-orm';
import { verifyIdToken } from '@/lib/firebase/admin';

/**
 * POST /api/study/session
 * Start a new study session
 * 
 * The user can only start a session if:
 * 1. The session status is ASSETS_READY
 * 2. At least NOTES or PRACTICE_SET asset is READY
 */
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await verifyIdToken(token);
    
    const body = await req.json();
    const { sessionId } = body;

    if (!sessionId) {
      return NextResponse.json(
        { error: 'sessionId is required' },
        { status: 400 }
      );
    }

    // Get user
    const [user] = await db.select().from(users)
      .where(eq(users.firebaseUid, decodedToken.uid))
      .limit(1);

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get the session
    const [session] = await db.select().from(studySessions)
      .where(and(
        eq(studySessions.id, sessionId),
        eq(studySessions.userId, user.id)
      ))
      .limit(1);

    if (!session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    // Check session status
    if (session.status === 'COMPLETED') {
      return NextResponse.json(
        { error: 'Session already completed' },
        { status: 400 }
      );
    }

    if (session.status === 'IN_PROGRESS') {
      // Session already started, return current state
      return NextResponse.json({
        session,
        currentStep: session.currentStep,
        message: 'Session already in progress',
      });
    }

    // Check asset readiness
    const assets = await db.select().from(studyAssets)
      .where(eq(studyAssets.sessionId, sessionId));

    const notesAsset = assets.find(a => a.assetType === 'NOTES');
    const practiceAsset = assets.find(a => a.assetType === 'PRACTICE_SET');

    const notesReady = notesAsset?.status === 'READY';
    const practiceReady = practiceAsset?.status === 'READY';

    if (!notesReady && !practiceReady) {
      return NextResponse.json({
        error: 'Session assets not ready',
        assets: assets.map(a => ({ type: a.assetType, status: a.status })),
        canStart: false,
      }, { status: 400 });
    }

    // Determine starting step based on available assets
    // Session flow: notes → checkpoint → practice → grading → fix → summary
    // currentStep is an integer index into stepsJson
    const startingStepIndex = notesReady ? 0 : 2; // 0=notes, 2=practice

    // Start the session
    const now = new Date();
    const [updatedSession] = await db.update(studySessions)
      .set({
        status: 'IN_PROGRESS',
        currentStep: startingStepIndex,
        startedAt: now,
        updatedAt: now,
      })
      .where(eq(studySessions.id, sessionId))
      .returning();

    // Log session start event
    await db.insert(sessionEvents).values({
      sessionId,
      eventType: 'SESSION_START',
      eventData: {
        startingStepIndex,
        assetsAvailable: assets.map(a => a.assetType),
      },
    });

    // Get skill info for response (use first skill from targetSkillIds)
    const targetSkillId = session.targetSkillIds?.[0];
    const skill = targetSkillId 
      ? (await db.select().from(microSkills).where(eq(microSkills.id, targetSkillId)).limit(1))[0]
      : null;

    return NextResponse.json({
      success: true,
      session: {
        ...updatedSession,
        skillName: skill?.title || 'Unknown Skill',
        skillDescription: skill?.description || '',
      },
      currentStep: startingStepIndex,
      assets: {
        notes: notesAsset ? {
          id: notesAsset.id,
          status: notesAsset.status,
          ready: notesReady,
        } : null,
        practiceSet: practiceAsset ? {
          id: practiceAsset.id,
          status: practiceAsset.status,
          ready: practiceReady,
        } : null,
      },
      flow: {
        steps: getSessionFlow(notesReady, practiceReady),
        currentIndex: 0,
      },
    });
  } catch (error) {
    console.error('Error starting session:', error);
    return NextResponse.json(
      { error: 'Failed to start session' },
      { status: 500 }
    );
  }
}

/**
 * Get the session flow steps based on available assets
 */
function getSessionFlow(hasNotes: boolean, hasPractice: boolean): string[] {
  const steps: string[] = [];
  
  if (hasNotes) {
    steps.push('notes');
    steps.push('checkpoint'); // Quick comprehension check
  }
  
  if (hasPractice) {
    steps.push('practice');
    steps.push('grading');
    steps.push('fix'); // Review mistakes
  }
  
  steps.push('summary');
  
  return steps;
}

/**
 * GET /api/study/session
 * Get all sessions for the current user (optionally filtered by date/status)
 */
export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await verifyIdToken(token);
    
    const { searchParams } = new URL(req.url);
    const date = searchParams.get('date'); // YYYY-MM-DD format
    const status = searchParams.get('status');

    // Get user
    const [user] = await db.select().from(users)
      .where(eq(users.firebaseUid, decodedToken.uid))
      .limit(1);

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Build query conditions
    let conditions: ReturnType<typeof eq>[] = [eq(studySessions.userId, user.id)];
    
    if (date) {
      // Filter by date using createdAt range
      const dayStart = new Date(date);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(date);
      dayEnd.setHours(23, 59, 59, 999);
      conditions.push(gte(studySessions.createdAt, dayStart));
      conditions.push(lte(studySessions.createdAt, dayEnd));
    }
    
    if (status) {
      conditions.push(eq(studySessions.status, status as any));
    }

    // Get sessions ordered by creation time
    const sessions = await db.select()
      .from(studySessions)
      .where(and(...conditions))
      .orderBy(studySessions.createdAt);

    // Get assets and skill info for each session
    const sessionsWithAssets = await Promise.all(
      sessions.map(async (session) => {
        const assets = await db.select().from(studyAssets)
          .where(eq(studyAssets.sessionId, session.id));
        
        const notesReady = assets.find(a => a.assetType === 'NOTES')?.status === 'READY';
        const practiceReady = assets.find(a => a.assetType === 'PRACTICE_SET')?.status === 'READY';

        // Get first skill from targetSkillIds
        const targetSkillId = session.targetSkillIds?.[0];
        const skill = targetSkillId
          ? (await db.select().from(microSkills).where(eq(microSkills.id, targetSkillId)).limit(1))[0]
          : null;
        
        return {
          ...session,
          skillName: skill?.title || 'Unknown',
          skillDescription: skill?.description || '',
          canStart: notesReady || practiceReady,
          assets: assets.map(a => ({
            type: a.assetType,
            status: a.status,
          })),
        };
      })
    );

    return NextResponse.json({ sessions: sessionsWithAssets });
  } catch (error) {
    console.error('Error fetching sessions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch sessions' },
      { status: 500 }
    );
  }
}
