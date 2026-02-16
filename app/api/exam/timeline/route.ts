/**
 * TUTOR OS - Exam Timeline API
 * 
 * GET /api/exam/timeline - Get exam events for user's cycle
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { userExamProfiles, examCycles, examEvents } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { verifyAuth } from '@/lib/auth/middleware';

export async function GET(request: NextRequest) {
  try {
    const user = await verifyAuth(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's exam profile
    const profile = await db.query.userExamProfiles.findFirst({
      where: eq(userExamProfiles.userId, user.id),
    });

    if (!profile) {
      return NextResponse.json({ 
        error: 'No exam profile set. Please select your exam track first.',
        needsOnboarding: true,
      }, { status: 400 });
    }

    // Get cycle with events
    const cycle = await db.query.examCycles.findFirst({
      where: eq(examCycles.id, profile.cycleId),
      with: {
        events: true,
      },
    });

    if (!cycle) {
      return NextResponse.json({ error: 'Cycle not found' }, { status: 404 });
    }

    const now = new Date();

    // Process events with computed fields
    const events = cycle.events.map(event => {
      const startDate = new Date(event.startsAt);
      const endDate = event.endsAt ? new Date(event.endsAt) : null;
      
      const daysUntil = Math.ceil((startDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      
      let status: 'upcoming' | 'active' | 'past';
      if (daysUntil > 0) {
        status = 'upcoming';
      } else if (endDate && now <= endDate) {
        status = 'active';
      } else if (!endDate && daysUntil === 0) {
        status = 'active';
      } else {
        status = 'past';
      }

      return {
        id: event.id,
        eventType: event.eventType,
        startsAt: event.startsAt,
        endsAt: event.endsAt,
        unitId: event.unitId,
        meta: event.metaJson,
        daysUntil: Math.max(0, daysUntil),
        status,
        phase: getPhaseForDays(daysUntil),
      };
    });

    // Sort events by start date
    events.sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());

    // Group by event type
    const writtenEvents = events.filter(e => e.eventType === 'WRITTEN');
    const oralEvents = events.filter(e => e.eventType === 'ORAL');
    const registrationEvents = events.filter(e => e.eventType === 'REGISTRATION');
    const resultsEvents = events.filter(e => e.eventType === 'RESULTS');

    // Get next upcoming event of each type
    const nextWritten = writtenEvents.find(e => e.status === 'upcoming' || e.status === 'active');
    const nextOral = oralEvents.find(e => e.status === 'upcoming' || e.status === 'active');

    return NextResponse.json({
      cycle: {
        id: cycle.id,
        label: cycle.label,
        candidateType: cycle.candidateType,
        year: cycle.year,
        timezone: cycle.timezone,
      },
      timeline: {
        all: events,
        written: writtenEvents,
        oral: oralEvents,
        registration: registrationEvents,
        results: resultsEvents,
      },
      nextEvents: {
        written: nextWritten || null,
        oral: nextOral || null,
      },
      currentPhase: {
        written: nextWritten?.phase || 'post_exam',
        oral: nextOral?.phase || 'post_exam',
        primary: determinePrimaryPhase(nextWritten?.phase, nextOral?.phase),
      },
    });
  } catch (error) {
    console.error('Error fetching timeline:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// 3-phase system: >= 60 = distant, 8-59 = approaching, 0-7 = critical
function getPhaseForDays(days: number): 'distant' | 'approaching' | 'critical' {
  if (days >= 60) return 'distant';
  if (days >= 8) return 'approaching';
  return 'critical'; // 0-7 days
}

function determinePrimaryPhase(writtenPhase?: string, oralPhase?: string): string {
  // Use the more urgent phase (lower days = higher priority)
  const phaseUrgency: Record<string, number> = {
    'critical': 3,
    'approaching': 2,
    'distant': 1,
  };

  const writtenUrgency = phaseUrgency[writtenPhase || 'distant'] || 1;
  const oralUrgency = phaseUrgency[oralPhase || 'distant'] || 1;

  if (oralUrgency > writtenUrgency) return oralPhase || 'distant';
  return writtenPhase || 'distant';
}
