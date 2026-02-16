import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { 
  users, studySessions, studyAssets, sessionEvents,
  microSkills, userExamProfiles
} from '@/lib/db/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import { verifyIdToken } from '@/lib/firebase/admin';
import { analyzePacing, getSessionPacingState, analyzeSwitchNeed } from '@/lib/services/pacing-engine';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/study/session/[id]
 * Get a specific session with full details
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await verifyIdToken(token);
    const { id: sessionId } = await params;

    // Get user
    const [user] = await db.select().from(users)
      .where(eq(users.firebaseUid, decodedToken.uid))
      .limit(1);

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get the session
    const [session] = await db.select()
      .from(studySessions)
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

    // Get first skill from targetSkillIds
    const targetSkillId = session.targetSkillIds?.[0];
    const skill = targetSkillId
      ? (await db.select().from(microSkills).where(eq(microSkills.id, targetSkillId)).limit(1))[0]
      : null;

    // Get assets
    const assets = await db.select().from(studyAssets)
      .where(eq(studyAssets.sessionId, sessionId));

    // Get session events (for replay/analytics)
    const events = await db.select().from(sessionEvents)
      .where(eq(sessionEvents.sessionId, sessionId))
      .orderBy(desc(sessionEvents.createdAt));

    // Determine session flow
    const notesReady = assets.find(a => a.assetType === 'NOTES')?.status === 'READY';
    const practiceReady = assets.find(a => a.assetType === 'PRACTICE_SET')?.status === 'READY';
    const flow = getSessionFlow(notesReady, practiceReady);
    // currentStep is an integer index into stepsJson
    const currentStepIndex = session.currentStep;

    return NextResponse.json({
      session: {
        ...session,
        skillName: skill?.title || 'Unknown Skill',
        skillDescription: skill?.description || '',
      },
      assets: assets.map(a => ({
        id: a.id,
        type: a.assetType,
        status: a.status,
        content: a.contentJson,
        groundingRefs: a.groundingRefsJson,
      })),
      events: events.slice(0, 50), // Last 50 events
      flow: {
        steps: flow,
        currentStepIndex,
        currentStep: session.stepsJson?.[currentStepIndex] || 'notes',
        isComplete: session.status === 'COMPLETED',
      },
      pacing: {
        estimatedMinutes: session.estimatedMinutes,
        continuousMinutes: session.continuousMinutes,
        startedAt: session.startedAt,
        // Calculate time spent if session is in progress
        minutesSpent: session.startedAt 
          ? Math.round((Date.now() - new Date(session.startedAt).getTime()) / 60000)
          : 0,
      },
    });
  } catch (error) {
    console.error('Error fetching session:', error);
    return NextResponse.json(
      { error: 'Failed to fetch session' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/study/session/[id]
 * Update session state (advance step, complete, etc.)
 */
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await verifyIdToken(token);
    const { id: sessionId } = await params;

    const body = await req.json();
    const { action, data } = body;

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

    const now = new Date();
    let updatedSession = session;

    switch (action) {
      case 'advance_step': {
        // Get assets to determine flow
        const assets = await db.select().from(studyAssets)
          .where(eq(studyAssets.sessionId, sessionId));
        
        const notesReady = assets.find(a => a.assetType === 'NOTES')?.status === 'READY';
        const practiceReady = assets.find(a => a.assetType === 'PRACTICE_SET')?.status === 'READY';
        const flow = getSessionFlow(notesReady, practiceReady);
        
        // currentStep is an integer index
        const currentIndex = session.currentStep;
        const nextIndex = currentIndex + 1;
        
        if (nextIndex >= flow.length) {
          // Session complete
          const minutesSpent = session.startedAt 
            ? Math.round((now.getTime() - new Date(session.startedAt).getTime()) / 60000)
            : session.estimatedMinutes;

          [updatedSession] = await db.update(studySessions)
            .set({
              status: 'COMPLETED',
              currentStep: flow.length - 1, // last step index
              endedAt: now,
              continuousMinutes: minutesSpent,
              updatedAt: now,
            })
            .where(eq(studySessions.id, sessionId))
            .returning();

          // Log completion event
          await db.insert(sessionEvents).values({
            sessionId,
            eventType: 'SESSION_COMPLETE',
            eventData: {
              minutesSpent,
              finalStep: flow[flow.length - 1],
            },
          });
        } else {
          // Advance to next step
          [updatedSession] = await db.update(studySessions)
            .set({
              currentStep: nextIndex,
              updatedAt: now,
            })
            .where(eq(studySessions.id, sessionId))
            .returning();

          // Log step transition
          await db.insert(sessionEvents).values({
            sessionId,
            eventType: 'STEP_TRANSITION',
            eventData: {
              fromStepIndex: currentIndex,
              toStepIndex: nextIndex,
              fromStep: flow[currentIndex],
              toStep: flow[nextIndex],
            },
          });
        }
        break;
      }

      case 'pause': {
        // Use ABANDONED as pause isn't in enum - or we log event and track via events
        // For now, we keep status but log the pause event
        await db.insert(sessionEvents).values({
          sessionId,
          eventType: 'SESSION_PAUSE',
          eventData: { pausedAt: now.toISOString() },
        });
        break;
      }

      case 'resume': {
        [updatedSession] = await db.update(studySessions)
          .set({
            status: 'IN_PROGRESS',
            updatedAt: now,
          })
          .where(eq(studySessions.id, sessionId))
          .returning();

        await db.insert(sessionEvents).values({
          sessionId,
          eventType: 'SESSION_RESUME',
          eventData: { resumedAt: now.toISOString() },
        });
        break;
      }

      case 'complete': {
        const minutesSpent = session.startedAt 
          ? Math.round((now.getTime() - new Date(session.startedAt).getTime()) / 60000)
          : data?.minutesSpent || session.estimatedMinutes;

        [updatedSession] = await db.update(studySessions)
          .set({
            status: 'COMPLETED',
            currentStep: (session.stepsJson?.length || 6) - 1, // last step
            endedAt: now,
            continuousMinutes: minutesSpent,
            updatedAt: now,
          })
          .where(eq(studySessions.id, sessionId))
          .returning();

        await db.insert(sessionEvents).values({
          sessionId,
          eventType: 'SESSION_COMPLETE',
          eventData: {
            minutesSpent,
            completionType: data?.completionType || 'normal',
          },
        });

        // M2: Next Step Enforcement - determine what user should do next
        const nextAction = await determineNextAction(user.id, sessionId, minutesSpent);

        return NextResponse.json({
          success: true,
          session: updatedSession,
          nextAction,
        });
      }

      case 'record_performance': {
        // Record checkpoint or practice performance
        await db.insert(sessionEvents).values({
          sessionId,
          eventType: data?.stepType === 'checkpoint' ? 'CHECKPOINT_ANSWER' : 'PRACTICE_ANSWER',
          eventData: {
            score: data?.score,
            questionId: data?.questionId,
            correct: data?.correct,
            timeTaken: data?.timeTaken,
          },
        });
        break;
      }

      case 'suggest_break': {
        // Log pacing suggestion
        await db.insert(sessionEvents).values({
          sessionId,
          eventType: 'PACING_SUGGESTION',
          eventData: {
            reason: data?.reason || 'time_threshold',
            minutesStudied: data?.minutesStudied,
          },
        });
        break;
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      session: updatedSession,
    });
  } catch (error) {
    console.error('Error updating session:', error);
    return NextResponse.json(
      { error: 'Failed to update session' },
      { status: 500 }
    );
  }
}

/**
 * M2: Determine next action after session completion
 * Returns structured guidance for UI to display
 */
async function determineNextAction(
  userId: string,
  completedSessionId: string,
  minutesSpent: number
): Promise<{
  action: 'NEXT_SESSION' | 'TAKE_BREAK' | 'DONE_FOR_TODAY' | 'SWITCH_SKILL';
  reason: string;
  nextSessionId?: string;
  suggestedBreakMinutes?: number;
}> {
  // Get today's sessions to check progress
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  
  const todaySessions = await db.select()
    .from(studySessions)
    .where(and(
      eq(studySessions.userId, userId),
      sql`${studySessions.createdAt} >= ${startOfDay}`,
      eq(studySessions.status, 'COMPLETED')
    ));

  const totalMinutesToday = todaySessions.reduce((sum, s) => sum + (s.continuousMinutes || 0), 0);

  // Check if user has met daily goal (60 minutes default)
  const [profile] = await db.select().from(userExamProfiles)
    .where(eq(userExamProfiles.userId, userId))
    .limit(1);

  const dailyGoal = 60; // Could be from profile preferences

  // Check for continuous study time
  const recentSessions = todaySessions.filter(s => {
    if (!s.endedAt) return false;
    const endedAt = new Date(s.endedAt);
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
    return endedAt > hourAgo;
  });
  
  const continuousMinutes = recentSessions.reduce((sum, s) => sum + (s.continuousMinutes || 0), 0);

  // Decision logic
  // 1. If continuous study > 90 min, force break
  if (continuousMinutes >= 90) {
    return {
      action: 'TAKE_BREAK',
      reason: `You've been studying for ${continuousMinutes} minutes. Take a 15-minute break to consolidate learning.`,
      suggestedBreakMinutes: 15,
    };
  }

  // 2. If daily goal met, suggest done for today
  if (totalMinutesToday >= dailyGoal) {
    return {
      action: 'DONE_FOR_TODAY',
      reason: `Great work! You've completed ${totalMinutesToday} minutes today, meeting your daily goal.`,
    };
  }

  // 3. If continuous study > 45 min, suggest break
  if (continuousMinutes >= 45) {
    return {
      action: 'TAKE_BREAK',
      reason: `${continuousMinutes} minutes of focused study - excellent! A short break will help you retain more.`,
      suggestedBreakMinutes: 5,
    };
  }

  // 4. Check if user should switch skills (consecutive low performance)
  // Get the completed session's skill to check performance
  const [completedSession] = await db.select()
    .from(studySessions)
    .where(eq(studySessions.id, completedSessionId))
    .limit(1);
  
  if (completedSession?.targetSkillIds?.length) {
    const currentSkillId = completedSession.targetSkillIds[0];
    const switchAnalysis = await analyzeSwitchNeed(completedSessionId, currentSkillId, 0);
    
    if (switchAnalysis.shouldSwitch) {
      return {
        action: 'SWITCH_SKILL',
        reason: switchAnalysis.message || 'Consider switching to a different topic for better retention.',
      };
    }
  }

  // 5. Otherwise, suggest next session
  const nextSession = await db.select()
    .from(studySessions)
    .where(and(
      eq(studySessions.userId, userId),
      sql`${studySessions.createdAt} >= ${startOfDay}`,
      eq(studySessions.status, 'READY')
    ))
    .orderBy(studySessions.createdAt)
    .limit(1);

  if (nextSession.length > 0) {
    return {
      action: 'NEXT_SESSION',
      reason: 'Keep the momentum going! Your next session is ready.',
      nextSessionId: nextSession[0].id,
    };
  }

  // No ready sessions, but haven't met goal
  return {
    action: 'DONE_FOR_TODAY',
    reason: `You've studied ${totalMinutesToday} minutes today. More sessions are being prepared.`,
  };
}

/**
 * Get the session flow steps based on available assets
 */
function getSessionFlow(hasNotes: boolean, hasPractice: boolean): string[] {
  const steps: string[] = [];
  
  if (hasNotes) {
    steps.push('notes');
    steps.push('checkpoint');
  }
  
  if (hasPractice) {
    steps.push('practice');
    steps.push('grading');
    steps.push('fix');
  }
  
  steps.push('summary');
  
  return steps;
}
