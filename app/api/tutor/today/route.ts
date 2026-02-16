import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { 
  users, studyPlans, studyPlanItems, spacedRepetitionCards,
  studyStreaks, topics, userExamProfiles, examCycles, examEvents,
  studySessions, studyAssets, microSkills
} from '@/lib/db/schema';
import { eq, and, lte, gte, desc, sql } from 'drizzle-orm';
import { verifyIdToken } from '@/lib/firebase/admin';
import { getDueCards, calculateStudyStats } from '@/lib/services/spaced-repetition';
import { ATP_UNITS } from '@/lib/constants/legal-content';
import { ensureSessionsPrecomputed, type PrecomputeStatus } from '@/lib/services/autopilot-precompute';

// Helper to calculate days until a date
function daysUntil(date: Date | string | null): number | null {
  if (!date) return null;
  const target = new Date(date);
  const now = new Date();
  const diffTime = target.getTime() - now.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

// Helper to determine exam phase based on days remaining
// Product spec: >= 60 = distant, 8-59 = approaching, 0-7 = critical
function getExamPhase(days: number | null): 'distant' | 'approaching' | 'critical' | null {
  if (days === null) return null;
  if (days <= 7) return 'critical';
  if (days < 60) return 'approaching';
  return 'distant';
}

// Determine dominant mode based on which exam is closer and needs more attention
function getDominantMode(daysToWritten: number | null, daysToOral: number | null): 'WRITTEN' | 'ORAL' | 'MIXED' {
  // If no oral, focus on written
  if (daysToOral === null) return 'WRITTEN';
  // If no written, focus on oral
  if (daysToWritten === null) return 'ORAL';
  
  // If oral is within 30 days and written is done/distant, focus on oral
  if (daysToOral <= 30 && (daysToWritten <= 0 || daysToWritten > 60)) return 'ORAL';
  
  // If written is within 30 days, focus on written
  if (daysToWritten <= 30) return 'WRITTEN';
  
  // If both are distant, use mixed approach
  if (daysToWritten > 90 && daysToOral > 90) return 'MIXED';
  
  // Default: focus on whichever is closer
  return daysToWritten <= daysToOral ? 'WRITTEN' : 'ORAL';
}

/**
 * GET /api/tutor/today
 * Fetch today's study items and stats
 */
export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await verifyIdToken(token);
    
    // Get user
    const [user] = await db.select().from(users)
      .where(eq(users.firebaseUid, decodedToken.uid))
      .limit(1);

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const today = new Date().toISOString().split('T')[0];

    // Get user's exam profile with cycle info (Tutor OS)
    const [examProfile] = await db.select({
      profile: userExamProfiles,
      cycle: examCycles,
    })
      .from(userExamProfiles)
      .leftJoin(examCycles, eq(userExamProfiles.cycleId, examCycles.id))
      .where(eq(userExamProfiles.userId, user.id))
      .limit(1);

    // Calculate exam countdown if profile exists
    let examCountdown = null;
    if (examProfile?.cycle) {
      const events = await db.select().from(examEvents)
        .where(eq(examEvents.cycleId, examProfile.cycle.id));
      
      const writtenEvent = events.find(e => e.eventType === 'WRITTEN');
      const oralEvent = events.find(e => e.eventType === 'ORAL');
      
      const daysToWritten = daysUntil(writtenEvent?.startsAt || null);
      const daysToOral = daysUntil(oralEvent?.startsAt || null);
      
      // Phase calculations for M1 requirements
      const phaseWritten = getExamPhase(daysToWritten);
      const phaseOral = getExamPhase(daysToOral);
      const dominantMode = getDominantMode(daysToWritten, daysToOral);
      
      examCountdown = {
        cycleId: examProfile.cycle.id,
        cycleName: examProfile.cycle.label,
        candidateType: examProfile.cycle.candidateType,
        daysToWritten,
        daysToOral,
        // M1 Required: phase_written, phase_oral, dominant_mode
        phase_written: phaseWritten,
        phase_oral: phaseOral,
        dominant_mode: dominantMode,
        // Legacy
        phase: phaseWritten || 'distant',
        writtenDate: writtenEvent?.startsAt || null,
        oralDate: oralEvent?.startsAt || null,
      };
    }

    // Get today's active/pending study sessions (Tutor OS)
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);
    
    // M2: Get skills for precompute (prioritized by exam weight)
    const prioritizedSkills = await db.select()
      .from(microSkills)
      .orderBy(desc(microSkills.examWeight))
      .limit(5);
    
    const skillIds = prioritizedSkills.map(s => s.id);
    
    // M2: Trigger autopilot precompute to ensure top 2 sessions are READY
    let precomputeResult: { sessions: PrecomputeStatus[]; jobsEnqueued: number } | null = null;
    if (skillIds.length > 0 && examCountdown?.dominant_mode) {
      try {
        precomputeResult = await ensureSessionsPrecomputed(
          user.id,
          skillIds,
          examCountdown.dominant_mode as 'WRITTEN' | 'ORAL' | 'MIXED'
        );
      } catch (precomputeError) {
        console.error('Precompute error:', precomputeError);
        // Don't fail the request, just log
      }
    }
    
    const todaySessions = await db.select().from(studySessions)
      .where(and(
        eq(studySessions.userId, user.id),
        sql`${studySessions.createdAt} >= ${startOfDay}`,
        sql`${studySessions.createdAt} <= ${endOfDay}`,
        sql`${studySessions.status} IN ('QUEUED', 'PREPARING', 'READY', 'IN_PROGRESS')`
      ));

    // Check session readiness (assets must be READY)
    const sessionsWithReadiness = await Promise.all(
      todaySessions.map(async (session) => {
        const assets = await db.select().from(studyAssets)
          .where(eq(studyAssets.sessionId, session.id));
        
        const notesReady = assets.find(a => a.assetType === 'NOTES')?.status === 'READY';
        const practiceReady = assets.find(a => a.assetType === 'PRACTICE_SET')?.status === 'READY';
        
        return {
          ...session,
          canStart: notesReady || practiceReady,
          assets: assets.map(a => ({
            type: a.assetType,
            status: a.status,
          })),
        };
      })
    );

    // Get active study plan (legacy support)
    const [plan] = await db.select().from(studyPlans)
      .where(and(
        eq(studyPlans.userId, user.id),
        eq(studyPlans.status, 'active')
      ))
      .orderBy(desc(studyPlans.createdAt))
      .limit(1);

    // Get today's plan items
    let todayItems: typeof studyPlanItems.$inferSelect[] = [];
    if (plan) {
      todayItems = await db.select().from(studyPlanItems)
        .where(and(
          eq(studyPlanItems.studyPlanId, plan.id),
          eq(studyPlanItems.scheduledDate, today)
        ))
        .orderBy(studyPlanItems.priority);
    }

    // Get spaced repetition cards due today
    const srCards = await db.select().from(spacedRepetitionCards)
      .where(and(
        eq(spacedRepetitionCards.userId, user.id),
        eq(spacedRepetitionCards.isActive, true),
        lte(spacedRepetitionCards.nextReviewDate, today)
      ));

    // Calculate SR stats
    const allCards = await db.select().from(spacedRepetitionCards)
      .where(and(
        eq(spacedRepetitionCards.userId, user.id),
        eq(spacedRepetitionCards.isActive, true)
      ));
    
    const srStats = calculateStudyStats(allCards.map(c => ({
      id: c.id,
      userId: c.userId,
      contentType: c.contentType as 'case' | 'concept' | 'provision' | 'question',
      contentId: c.contentId,
      title: c.title,
      content: c.content,
      unitId: c.unitId || undefined,
      easinessFactor: c.easinessFactor,
      interval: c.interval,
      repetitions: c.repetitions,
      nextReviewDate: c.nextReviewDate,
      lastReviewDate: c.lastReviewDate || undefined,
      lastQuality: c.lastQuality || undefined,
      totalReviews: c.totalReviews,
      correctReviews: c.correctReviews,
    })));

    // Get today's streak
    const [todayStreak] = await db.select().from(studyStreaks)
      .where(and(
        eq(studyStreaks.userId, user.id),
        eq(studyStreaks.date, today)
      ))
      .limit(1);

    // Calculate current streak
    let streakDays = 0;
    const streakRecords = await db.select().from(studyStreaks)
      .where(eq(studyStreaks.userId, user.id))
      .orderBy(desc(studyStreaks.date))
      .limit(30);

    if (streakRecords.length > 0) {
      const checkDate = new Date();
      for (let i = 0; i < 30; i++) {
        const dateStr = checkDate.toISOString().split('T')[0];
        const hasStreak = streakRecords.some(s => s.date === dateStr && s.minutesStudied > 0);
        
        if (hasStreak) {
          streakDays++;
          checkDate.setDate(checkDate.getDate() - 1);
        } else if (i === 0) {
          // Today can be incomplete, check yesterday
          checkDate.setDate(checkDate.getDate() - 1);
        } else {
          break;
        }
      }
    }

    // Map items with unit names
    const formattedItems = todayItems.map(item => {
      const unit = ATP_UNITS.find(u => u.id === item.unitId);
      return {
        ...item,
        unitName: unit?.name || 'General',
        unitCode: unit?.code || '',
      };
    });

    // Calculate today's stats
    const itemsCompleted = todayItems.filter(i => i.status === 'completed').length;
    const itemsTotal = todayItems.length;
    const minutesStudied = todayStreak?.minutesStudied || 0;
    const minutesGoal = plan?.dailyMinutes || 60;

    // Get case recommendations from today's items
    const caseItems = formattedItems.filter(i => i.itemType === 'case_study' && i.caseReference);
    const caseRecommendations = caseItems.map(item => ({
      name: item.title.replace('Case Study: ', ''),
      citation: item.caseReference || '',
      topic: item.description?.split('.')[0] || '',
      unitName: item.unitName,
      rationale: item.aiRationale || '',
    }));

    return NextResponse.json({
      // Tutor OS: Exam countdown and phase
      examCountdown,
      
      // Tutor OS: Today's study sessions with readiness
      sessions: sessionsWithReadiness.map(s => {
        // M2: Get precompute status for this session
        const precomputeSession = precomputeResult?.sessions.find(ps => ps.sessionId === s.id);
        return {
          id: s.id,
          skillIds: s.targetSkillIds,
          modality: s.modality,
          status: s.status,
          estimatedMinutes: s.estimatedMinutes,
          canStart: s.canStart,
          assets: s.assets,
          // M2: Precompute status
          precomputeStatus: precomputeSession?.status || null,
          assetsReady: precomputeSession?.assetsReady || s.assets.filter(a => a.status === 'READY').length,
          assetsTotal: precomputeSession?.assetsTotal || 4,
        };
      }),
      
      // M2: Precompute summary
      precompute: precomputeResult ? {
        jobsEnqueued: precomputeResult.jobsEnqueued,
        sessionsPrecomputing: precomputeResult.sessions.filter(s => s.status === 'PREPARING').length,
        sessionsReady: precomputeResult.sessions.filter(s => s.status === 'READY').length,
      } : null,
      
      // Legacy: Today's plan items
      items: formattedItems,
      stats: {
        itemsCompleted,
        itemsTotal,
        minutesStudied,
        minutesGoal,
        reviewsDue: srStats.dueToday + srStats.overdue,
        streakDays,
        srStats,
      },
      caseRecommendations,
      plan: plan ? {
        id: plan.id,
        name: plan.name,
        currentWeek: plan.currentWeek,
        totalWeeks: plan.totalWeeks,
        targetExamDate: plan.targetExamDate,
      } : null,
      
      // Tutor OS: Onboarding flag
      needsOnboarding: !examProfile,
    });
  } catch (error) {
    console.error('Error fetching today\'s items:', error);
    return NextResponse.json(
      { error: 'Failed to fetch today\'s study items' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/tutor/today
 * Update a study item (mark complete, skip, etc.)
 */
export async function PATCH(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await verifyIdToken(token);
    
    const body = await req.json();
    const { itemId, status, actualMinutes } = body;

    // Get user
    const [user] = await db.select().from(users)
      .where(eq(users.firebaseUid, decodedToken.uid))
      .limit(1);

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Update item
    const updateData: Partial<typeof studyPlanItems.$inferInsert> = {
      status,
      updatedAt: new Date(),
    };

    if (status === 'completed') {
      updateData.completedAt = new Date();
      if (actualMinutes) {
        updateData.actualMinutes = actualMinutes;
      }
    } else if (status === 'skipped') {
      updateData.skippedAt = new Date();
    }

    const [updatedItem] = await db.update(studyPlanItems)
      .set(updateData)
      .where(and(
        eq(studyPlanItems.id, itemId),
        eq(studyPlanItems.userId, user.id)
      ))
      .returning();

    // If completed, update streak and plan progress
    if (status === 'completed') {
      const today = new Date().toISOString().split('T')[0];
      const minutes = actualMinutes || updatedItem?.estimatedMinutes || 0;

      // Update or create today's streak
      const [existingStreak] = await db.select().from(studyStreaks)
        .where(and(
          eq(studyStreaks.userId, user.id),
          eq(studyStreaks.date, today)
        ))
        .limit(1);

      if (existingStreak) {
        await db.update(studyStreaks)
          .set({
            minutesStudied: sql`${studyStreaks.minutesStudied} + ${minutes}`,
            sessionsCompleted: sql`${studyStreaks.sessionsCompleted} + 1`,
          })
          .where(eq(studyStreaks.id, existingStreak.id));
      } else {
        await db.insert(studyStreaks).values({
          userId: user.id,
          date: today,
          minutesStudied: minutes,
          sessionsCompleted: 1,
        });
      }

      // Update plan progress
      if (updatedItem?.studyPlanId) {
        await db.update(studyPlans)
          .set({
            completedItems: sql`${studyPlans.completedItems} + 1`,
            updatedAt: new Date(),
          })
          .where(eq(studyPlans.id, updatedItem.studyPlanId));
      }
    }

    return NextResponse.json({ success: true, item: updatedItem });
  } catch (error) {
    console.error('Error updating study item:', error);
    return NextResponse.json(
      { error: 'Failed to update study item' },
      { status: 500 }
    );
  }
}
