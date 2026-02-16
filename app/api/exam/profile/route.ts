/**
 * TUTOR OS - Exam Profile API
 * 
 * POST /api/exam/profile - Set user's exam cycle (FIRST_TIME vs RESIT)
 * GET /api/exam/profile - Get user's current exam profile
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { userExamProfiles, examCycles, examEvents, users } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { verifyAuth } from '@/lib/auth/middleware';

export async function GET(request: NextRequest) {
  try {
    const user = await verifyAuth(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's exam profile with cycle details
    const profile = await db.query.userExamProfiles.findFirst({
      where: eq(userExamProfiles.userId, user.id),
      with: {
        cycle: {
          with: {
            events: true,
          },
        },
      },
    });

    if (!profile) {
      return NextResponse.json({ 
        hasProfile: false,
        message: 'No exam profile set. Please complete onboarding.' 
      });
    }

    // Compute countdowns
    const now = new Date();
    const writtenEvent = profile.cycle.events.find(e => e.eventType === 'WRITTEN');
    const oralEvent = profile.cycle.events.find(e => e.eventType === 'ORAL');

    const daysToWritten = writtenEvent 
      ? Math.ceil((new Date(writtenEvent.startsAt).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      : null;
    
    const daysToOral = oralEvent
      ? Math.ceil((new Date(oralEvent.startsAt).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      : null;

    // Determine phases
    const writtenPhase = daysToWritten !== null 
      ? getExamPhase(daysToWritten) 
      : null;
    
    const oralPhase = daysToOral !== null 
      ? getExamPhase(daysToOral) 
      : null;

    return NextResponse.json({
      hasProfile: true,
      profile: {
        id: profile.id,
        cycleId: profile.cycleId,
        timezone: profile.timezone,
        autopilotEnabled: profile.autopilotEnabled,
        notificationPreferences: profile.notificationPreferences,
      },
      cycle: {
        id: profile.cycle.id,
        label: profile.cycle.label,
        candidateType: profile.cycle.candidateType,
        year: profile.cycle.year,
      },
      countdowns: {
        daysToWritten,
        daysToOral,
        writtenPhase,
        oralPhase,
      },
      events: profile.cycle.events.map(e => ({
        id: e.id,
        eventType: e.eventType,
        startsAt: e.startsAt,
        endsAt: e.endsAt,
        unitId: e.unitId,
        meta: e.metaJson,
      })),
    });
  } catch (error) {
    console.error('Error fetching exam profile:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await verifyAuth(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { candidateType, cycleId, autopilotEnabled, timezone } = body;

    // Validate candidateType
    if (!candidateType && !cycleId) {
      return NextResponse.json({ 
        error: 'Must provide either candidateType (FIRST_TIME/RESIT) or cycleId' 
      }, { status: 400 });
    }

    // Find the cycle
    let cycle;
    if (cycleId) {
      cycle = await db.query.examCycles.findFirst({
        where: eq(examCycles.id, cycleId),
      });
    } else {
      // Find active cycle for the candidate type
      cycle = await db.query.examCycles.findFirst({
        where: and(
          eq(examCycles.candidateType, candidateType),
          eq(examCycles.isActive, true)
        ),
      });
    }

    if (!cycle) {
      return NextResponse.json({ 
        error: 'No active exam cycle found for the specified type' 
      }, { status: 404 });
    }

    // Upsert the profile
    const existingProfile = await db.query.userExamProfiles.findFirst({
      where: eq(userExamProfiles.userId, user.id),
    });

    let profile;
    if (existingProfile) {
      const [updated] = await db.update(userExamProfiles)
        .set({
          cycleId: cycle.id,
          autopilotEnabled: autopilotEnabled ?? existingProfile.autopilotEnabled,
          timezone: timezone ?? existingProfile.timezone,
          updatedAt: new Date(),
        })
        .where(eq(userExamProfiles.userId, user.id))
        .returning();
      profile = updated;
    } else {
      const [created] = await db.insert(userExamProfiles)
        .values({
          userId: user.id,
          cycleId: cycle.id,
          autopilotEnabled: autopilotEnabled ?? false,
          timezone: timezone ?? 'Africa/Nairobi',
        })
        .returning();
      profile = created;
    }

    // Also update user's onboarding status
    await db.update(users)
      .set({ onboardingCompleted: true, updatedAt: new Date() })
      .where(eq(users.id, user.id));

    return NextResponse.json({
      success: true,
      profile: {
        id: profile.id,
        cycleId: profile.cycleId,
        candidateType: cycle.candidateType,
        cycleLabel: cycle.label,
        autopilotEnabled: profile.autopilotEnabled,
        timezone: profile.timezone,
      },
    });
  } catch (error) {
    console.error('Error setting exam profile:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Helper: determine exam phase based on days remaining (3-phase system)
function getExamPhase(daysRemaining: number): 'distant' | 'approaching' | 'critical' {
  if (daysRemaining >= 60) return 'distant';
  if (daysRemaining >= 8) return 'approaching';
  return 'critical'; // 0-7 days
}
