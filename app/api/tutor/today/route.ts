import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { 
  users, studyPlans, studyPlanItems, spacedRepetitionCards,
  studyStreaks, topics
} from '@/lib/db/schema';
import { eq, and, lte, gte, desc, sql } from 'drizzle-orm';
import { verifyIdToken } from '@/lib/firebase/admin';
import { getDueCards, calculateStudyStats } from '@/lib/services/spaced-repetition';
import { ATP_UNITS } from '@/lib/constants/legal-content';

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

    // Get active study plan
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
