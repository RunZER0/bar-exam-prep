import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { users, userExamProfiles, examCycles, examEvents } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { verifyIdToken } from '@/lib/firebase/admin';
import { createDailySessions } from '@/lib/services/session-orchestrator';

/**
 * POST /api/onboarding/exam
 * Complete exam track onboarding - select FIRST_TIME or RESIT
 * 
 * This is the critical first step in Tutor OS - determines which exam cycle
 * the student is preparing for.
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
    const { candidateType, dailyMinutesGoal, preferredStudyTime } = body;

    // Validate candidate type
    if (!['FIRST_TIME', 'RESIT'].includes(candidateType)) {
      return NextResponse.json(
        { error: 'candidateType must be FIRST_TIME or RESIT' },
        { status: 400 }
      );
    }

    // Get user — explicit columns to avoid missing-column crashes
    const [user] = await db
      .select({ id: users.id, firebaseUid: users.firebaseUid, onboardingCompleted: users.onboardingCompleted })
      .from(users)
      .where(eq(users.firebaseUid, decodedToken.uid))
      .limit(1);

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check if profile already exists
    const [existingProfile] = await db.select().from(userExamProfiles)
      .where(eq(userExamProfiles.userId, user.id))
      .limit(1);

    if (existingProfile) {
      return NextResponse.json(
        { error: 'Exam profile already exists. Use exam/profile API to update.' },
        { status: 400 }
      );
    }

    // Find the appropriate exam cycle
    // RESIT candidates → April 2026 cycle
    // FIRST_TIME candidates → November 2026 cycle
    const cycleFilter = candidateType === 'RESIT' 
      ? 'April'
      : 'November';

    const [cycle] = await db.select().from(examCycles)
      .where(and(
        eq(examCycles.isActive, true),
        // Match by name pattern (April for resit, November for first-time)
        eq(examCycles.candidateType, candidateType)
      ))
      .limit(1);

    if (!cycle) {
      return NextResponse.json(
        { error: 'No active exam cycle found for your candidate type' },
        { status: 404 }
      );
    }

    // Get exam events for this cycle to find written and oral dates
    const events = await db.select().from(examEvents)
      .where(eq(examEvents.cycleId, cycle.id));
    
    const writtenEvent = events.find(e => e.eventType === 'WRITTEN');
    const oralEvent = events.find(e => e.eventType === 'ORAL');

    // Calculate days to exam
    const writtenDate = writtenEvent?.startsAt;
    const daysToExam = writtenDate 
      ? Math.ceil((new Date(writtenDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      : null;

    // Determine recommended daily minutes based on time left (stored in user preferences)
    const recommendedMinutes = daysToExam
      ? daysToExam > 180 ? 90     // Foundation: 1.5 hours
        : daysToExam > 60 ? 120   // Intensive: 2 hours
        : daysToExam > 14 ? 180   // Revision: 3 hours
        : 120                      // Final: 2 hours (quality > quantity)
      : 120;

    // Create exam profile (candidateType is on the cycle, not the profile)
    const [profile] = await db.insert(userExamProfiles).values({
      userId: user.id,
      cycleId: cycle.id,
      timezone: 'Africa/Nairobi',
      autopilotEnabled: false,
    }).returning();

    // Generate first day's sessions
    let sessionIds: string[] = [];
    try {
      sessionIds = await createDailySessions(user.id);
    } catch (err) {
      // Sessions will be created on first dashboard load
      console.warn('Could not create initial sessions:', err);
    }

    // Calculate phase
    const phase = daysToExam
      ? daysToExam > 180 ? 'foundation'
        : daysToExam > 60 ? 'intensive'
        : daysToExam > 14 ? 'revision'
        : 'final'
      : 'foundation';

    return NextResponse.json({
      success: true,
      profile: {
        id: profile.id,
        cycleId: profile.cycleId,
        candidateType: cycle.candidateType, // from the cycle, not profile
        recommendedMinutes,
      },
      cycle: {
        id: cycle.id,
        label: cycle.label,
        candidateType: cycle.candidateType,
        year: cycle.year,
        writtenStartDate: writtenEvent?.startsAt,
        writtenEndDate: writtenEvent?.endsAt,
        oralStartDate: oralEvent?.startsAt,
      },
      exam: {
        daysToWritten: daysToExam,
        daysToOral: oralEvent?.startsAt 
          ? Math.ceil((new Date(oralEvent.startsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
          : null,
        phase,
      },
      sessionsCreated: sessionIds.length,
      message: candidateType === 'RESIT'
        ? `Welcome back! You're preparing for the April ${cycle.year} resit examination. ${daysToExam} days to go.`
        : `Welcome! You're preparing for the November ${cycle.year} bar examination. ${daysToExam} days to go.`,
    });
  } catch (error) {
    console.error('Error in exam onboarding:', error);
    return NextResponse.json(
      { error: 'Failed to complete exam onboarding' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/onboarding/exam
 * Check exam onboarding status
 */
export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await verifyIdToken(token);
    
    // Get user — use explicit column selection to avoid crashing if newer schema
    // columns haven't been migrated yet (subscription_tier, billing_period, etc.)
    const [user] = await db
      .select({
        id: users.id,
        firebaseUid: users.firebaseUid,
        email: users.email,
        displayName: users.displayName,
        role: users.role,
        onboardingCompleted: users.onboardingCompleted,
      })
      .from(users)
      .where(eq(users.firebaseUid, decodedToken.uid))
      .limit(1);

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Primary check: both onboarding survey AND exam profile are required.
    // Users must complete the full onboarding flow for proper profile snapshots.
    if (!user.onboardingCompleted) {
      return NextResponse.json({
        examOnboardingComplete: false,
        needsOnboarding: true,
        message: 'Please complete your profile setup',
      });
    }

    // Check for exam profile — REQUIRED for full onboarding
    const [result] = await db.select({
      profile: userExamProfiles,
      cycle: examCycles,
    })
      .from(userExamProfiles)
      .leftJoin(examCycles, eq(userExamProfiles.cycleId, examCycles.id))
      .where(eq(userExamProfiles.userId, user.id))
      .limit(1);

    if (!result) {
      // User completed profile survey but hasn't selected exam track yet.
      // Must complete exam track selection for proper candidate profiling.
      return NextResponse.json({
        examOnboardingComplete: false,
        needsOnboarding: true,
        profile: null,
        cycle: null,
        countdown: null,
        message: 'Please select your exam track (First Time or Resit)',
      });
    }

    // Get exam events for this cycle
    let writtenEvent = null;
    let oralEvent = null;
    if (result.cycle) {
      const events = await db.select().from(examEvents)
        .where(eq(examEvents.cycleId, result.cycle.id));
      writtenEvent = events.find(e => e.eventType === 'WRITTEN');
      oralEvent = events.find(e => e.eventType === 'ORAL');
    }

    // Calculate exam countdown
    const daysToWritten = writtenEvent?.startsAt
      ? Math.ceil((new Date(writtenEvent.startsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      : null;

    const daysToOral = oralEvent?.startsAt
      ? Math.ceil((new Date(oralEvent.startsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      : null;

    const phase = daysToWritten
      ? daysToWritten > 180 ? 'foundation'
        : daysToWritten > 60 ? 'intensive'
        : daysToWritten > 14 ? 'revision'
        : 'final'
      : 'foundation';

    return NextResponse.json({
      examOnboardingComplete: true,
      needsOnboarding: false,
      profile: {
        id: result.profile.id,
        cycleId: result.profile.cycleId,
        candidateType: result.cycle?.candidateType, // from cycle, not profile
      },
      cycle: result.cycle ? {
        id: result.cycle.id,
        label: result.cycle.label,
        candidateType: result.cycle.candidateType,
        year: result.cycle.year,
        writtenStartDate: writtenEvent?.startsAt,
        writtenEndDate: writtenEvent?.endsAt,
        oralStartDate: oralEvent?.startsAt,
      } : null,
      countdown: {
        daysToWritten,
        daysToOral,
        phase,
      },
    });
  } catch (error) {
    console.error('Error checking exam onboarding:', error);
    return NextResponse.json(
      { error: 'Failed to check onboarding status' },
      { status: 500 }
    );
  }
}
