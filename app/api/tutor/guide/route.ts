import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { 
  users, 
  userProfiles, 
  studyStreaks,
  quizHistory,
  studyRecommendations,
  spacedRepetitionCards,
} from '@/lib/db/schema';
import { eq, and, gte, desc, sql, lte } from 'drizzle-orm';
import { verifyIdToken } from '@/lib/firebase/admin';
import { 
  generateRecommendations, 
  UserStudyState, 
  ALGORITHM_VERSION 
} from '@/lib/services/study-guide-algorithm';
import { ATP_UNITS } from '@/lib/constants/legal-content';

/**
 * GET /api/tutor/guide
 * Fetch system-guided study recommendations
 * Returns pre-generated recommendations if available and fresh,
 * otherwise generates new ones
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

    // Check if user has completed onboarding (has profile)
    const [profile] = await db.select().from(userProfiles)
      .where(eq(userProfiles.userId, user.id))
      .limit(1);
    
    const hasCompletedOnboarding = user.onboardingCompleted && profile !== undefined;

    const now = new Date();

    // Check for existing valid recommendations
    let existingRecommendations: typeof studyRecommendations.$inferSelect[] = [];
    try {
      existingRecommendations = await db.select()
        .from(studyRecommendations)
        .where(and(
          eq(studyRecommendations.userId, user.id),
          eq(studyRecommendations.isActive, true),
          gte(studyRecommendations.expiresAt, now)
        ))
        .orderBy(studyRecommendations.priority)
        .limit(10);
    } catch (e) {
      // Table might not exist yet, continue to generate fresh recommendations
      console.warn('Could not fetch existing recommendations:', e);
    }

    if (existingRecommendations.length >= 3) {
      // Return existing recommendations
      return NextResponse.json({
        recommendations: existingRecommendations.map(formatRecommendation),
        source: 'cached',
        generatedAt: existingRecommendations[0].generatedAt,
        hasCompletedOnboarding,
      });
    }

    // Generate fresh recommendations
    let recommendations;
    let state: UserStudyState | null = null;
    
    try {
      state = await buildUserStudyState(user.id);
      recommendations = generateRecommendations(state, 5);
    } catch (algorithmError) {
      console.error('Error in recommendation algorithm, using fallback:', algorithmError);
      // Fallback: Generate basic recommendations based on ATP units
      recommendations = generateFallbackRecommendations();
    }
    
    // If still no recommendations, create starter recommendations
    if (!recommendations || recommendations.length === 0) {
      recommendations = generateFallbackRecommendations();
    }
    
    // Clear old recommendations
    try {
      await db.update(studyRecommendations)
        .set({ isActive: false })
        .where(eq(studyRecommendations.userId, user.id));
    } catch (e) {
      // Table might not exist yet, continue
      console.warn('Could not clear old recommendations:', e);
    }

    // Store new recommendations
    const expiresAt = new Date(now.getTime() + 4 * 60 * 60 * 1000); // 4 hours
    
    try {
      for (const rec of recommendations) {
        await db.insert(studyRecommendations).values({
          userId: user.id,
          activityType: rec.activityType,
          unitId: rec.unitId,
          unitName: rec.unitName,
          title: rec.title,
          description: rec.description,
          rationale: rec.rationale,
          priority: rec.priority,
          urgencyScore: rec.urgencyScore,
          estimatedMinutes: rec.estimatedMinutes,
          difficulty: rec.difficulty,
          targetHref: rec.targetHref,
          decisionFactors: rec.decisionFactors,
          inputSnapshot: state || null,
          algorithmVersion: ALGORITHM_VERSION,
          expiresAt,
        });
      }
    } catch (e) {
      // Database insert failed, but still return recommendations
      console.warn('Could not store recommendations:', e);
    }

    return NextResponse.json({
      recommendations: recommendations.map(formatNewRecommendation),
      source: 'generated',
      generatedAt: now.toISOString(),
      hasCompletedOnboarding,
    });

  } catch (error) {
    console.error('Error fetching study guide:', error);
    // Even on error, try to return fallback recommendations
    // so user always sees something useful
    try {
      const fallbackRecs = generateFallbackRecommendations();
      return NextResponse.json({
        recommendations: fallbackRecs.map(formatNewRecommendation),
        source: 'fallback',
        generatedAt: new Date().toISOString(),
        hasCompletedOnboarding: false,
      });
    } catch {
      return NextResponse.json(
        { error: 'Failed to fetch study recommendations' },
        { status: 500 }
      );
    }
  }
}

/**
 * POST /api/tutor/guide
 * Trigger pre-generation of recommendations (called after activities)
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

    const now = new Date();

    // Generate fresh recommendations with fallback
    let recommendations;
    let state: UserStudyState | null = null;
    
    try {
      state = await buildUserStudyState(user.id);
      recommendations = generateRecommendations(state, 5);
    } catch (algorithmError) {
      console.error('Error in recommendation algorithm, using fallback:', algorithmError);
      recommendations = generateFallbackRecommendations();
    }
    
    if (!recommendations || recommendations.length === 0) {
      recommendations = generateFallbackRecommendations();
    }
    
    // Clear old recommendations
    try {
      await db.update(studyRecommendations)
        .set({ isActive: false })
        .where(eq(studyRecommendations.userId, user.id));
    } catch (e) {
      console.warn('Could not clear old recommendations:', e);
    }

    // Store new recommendations
    const expiresAt = new Date(now.getTime() + 4 * 60 * 60 * 1000);
    
    try {
      for (const rec of recommendations) {
        await db.insert(studyRecommendations).values({
          userId: user.id,
          activityType: rec.activityType,
          unitId: rec.unitId,
          unitName: rec.unitName,
          title: rec.title,
          description: rec.description,
          rationale: rec.rationale,
          priority: rec.priority,
          urgencyScore: rec.urgencyScore,
          estimatedMinutes: rec.estimatedMinutes,
          difficulty: rec.difficulty,
          targetHref: rec.targetHref,
          decisionFactors: rec.decisionFactors,
          inputSnapshot: state || null,
          algorithmVersion: ALGORITHM_VERSION,
          expiresAt,
        });
      }
    } catch (e) {
      // Database insert failed but we continue
      console.warn('Could not store recommendations:', e);
    }

    return NextResponse.json({
      success: true,
      count: recommendations.length,
      generatedAt: now.toISOString(),
    });

  } catch (error) {
    console.error('Error pre-generating recommendations:', error);
    return NextResponse.json(
      { error: 'Failed to pre-generate recommendations' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/tutor/guide
 * Mark a recommendation as acted on or dismissed
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
    const { recommendationId, action } = body;

    const [user] = await db.select().from(users)
      .where(eq(users.firebaseUid, decodedToken.uid))
      .limit(1);

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const now = new Date();

    if (action === 'acted_on') {
      await db.update(studyRecommendations)
        .set({ 
          wasActedOn: true, 
          actedOnAt: now 
        })
        .where(and(
          eq(studyRecommendations.id, recommendationId),
          eq(studyRecommendations.userId, user.id)
        ));
    } else if (action === 'dismissed') {
      await db.update(studyRecommendations)
        .set({ 
          dismissedAt: now,
          isActive: false 
        })
        .where(and(
          eq(studyRecommendations.id, recommendationId),
          eq(studyRecommendations.userId, user.id)
        ));
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Error updating recommendation:', error);
    return NextResponse.json(
      { error: 'Failed to update recommendation' },
      { status: 500 }
    );
  }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

async function buildUserStudyState(userId: string): Promise<UserStudyState> {
  const today = new Date().toISOString().split('T')[0];
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  // Get user profile
  const [profile] = await db.select().from(userProfiles)
    .where(eq(userProfiles.userId, userId))
    .limit(1);

  // Get quiz history for last 30 days
  const quizzes = await db.select().from(quizHistory)
    .where(and(
      eq(quizHistory.userId, userId),
      gte(quizHistory.createdAt, new Date(thirtyDaysAgo))
    ));

  // Calculate unit performance
  const unitPerformance = new Map<string, {
    accuracy: number;
    questionsAnswered: number;
    lastStudied: Date | null;
    lastQuizDate: Date | null;
    recentTrend: 'improving' | 'stable' | 'declining';
  }>();

  // Group quizzes by unit
  const unitQuizzes = new Map<string, typeof quizzes>();
  for (const q of quizzes) {
    const unitId = q.unitId || 'unknown';
    if (!unitQuizzes.has(unitId)) {
      unitQuizzes.set(unitId, []);
    }
    unitQuizzes.get(unitId)!.push(q);
  }

  // Calculate performance per unit
  for (const [unitId, unitQs] of unitQuizzes) {
    const correct = unitQs.filter(q => q.isCorrect).length;
    const total = unitQs.length;
    const accuracy = total > 0 ? (correct / total) * 100 : 0;
    
    const sortedByDate = [...unitQs].sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    const lastQuizDate = sortedByDate.length > 0 ? new Date(sortedByDate[0].createdAt) : null;

    // Calculate trend (compare first half to second half)
    let trend: 'improving' | 'stable' | 'declining' = 'stable';
    if (sortedByDate.length >= 10) {
      const half = Math.floor(sortedByDate.length / 2);
      const recentHalf = sortedByDate.slice(0, half);
      const olderHalf = sortedByDate.slice(half);
      
      const recentAcc = recentHalf.filter(q => q.isCorrect).length / recentHalf.length;
      const olderAcc = olderHalf.filter(q => q.isCorrect).length / olderHalf.length;
      
      if (recentAcc > olderAcc + 0.1) trend = 'improving';
      else if (recentAcc < olderAcc - 0.1) trend = 'declining';
    }

    unitPerformance.set(unitId, {
      accuracy,
      questionsAnswered: total,
      lastStudied: lastQuizDate,
      lastQuizDate,
      recentTrend: trend,
    });
  }

  // Ensure all ATP units are represented
  for (const unit of ATP_UNITS) {
    if (!unitPerformance.has(unit.id)) {
      unitPerformance.set(unit.id, {
        accuracy: 0,
        questionsAnswered: 0,
        lastStudied: null,
        lastQuizDate: null,
        recentTrend: 'stable',
      });
    }
  }

  // Calculate overall stats
  const totalCorrect = quizzes.filter(q => q.isCorrect).length;
  const totalQuestions = quizzes.length;
  const overallAccuracy = totalQuestions > 0 ? (totalCorrect / totalQuestions) * 100 : 0;

  // Get unique quiz sessions
  const sessionIds = new Set(quizzes.filter(q => q.sessionId).map(q => q.sessionId));
  const totalQuizzesCount = sessionIds.size;

  // Get today's streak
  const [todayStreak] = await db.select().from(studyStreaks)
    .where(and(
      eq(studyStreaks.userId, userId),
      eq(studyStreaks.date, today)
    ))
    .limit(1);

  // Calculate current streak
  let streakDays = 0;
  const streakRecords = await db.select().from(studyStreaks)
    .where(eq(studyStreaks.userId, userId))
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
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        break;
      }
    }
  }

  // Get spaced repetition cards due
  const srCards = await db.select().from(spacedRepetitionCards)
    .where(and(
      eq(spacedRepetitionCards.userId, userId),
      eq(spacedRepetitionCards.isActive, true),
      lte(spacedRepetitionCards.nextReviewDate, today)
    ));

  // Build recent activities from quiz history
  const recentActivities: UserStudyState['recentActivities'] = quizzes
    .slice(0, 50)
    .map(q => ({
      type: 'quiz' as const,
      unitId: q.unitId || null,
      timestamp: new Date(q.createdAt),
      durationMinutes: Math.ceil((q.timeSpent || 60) / 60),
    }));

  // Calculate days until exam
  let daysUntilExam: number | null = null;
  if (profile?.targetExamDate) {
    const examDate = new Date(profile.targetExamDate);
    daysUntilExam = Math.ceil((examDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (daysUntilExam < 0) daysUntilExam = null;
  }

  // Determine current level
  let currentLevel: 'beginner' | 'intermediate' | 'advanced' | 'expert' = 'beginner';
  if (totalQuizzesCount >= 50 && overallAccuracy >= 90) currentLevel = 'expert';
  else if (totalQuizzesCount >= 25 && overallAccuracy >= 75) currentLevel = 'advanced';
  else if (totalQuizzesCount >= 10 && overallAccuracy >= 60) currentLevel = 'intermediate';

  return {
    userId,
    overallAccuracy,
    totalQuizzes: totalQuizzesCount,
    totalQuestionsAnswered: totalQuestions,
    unitPerformance,
    recentActivities,
    preferredStudyTime: (profile?.preferredStudyTime as UserStudyState['preferredStudyTime']) || 'flexible',
    dailyStudyGoal: profile?.dailyStudyGoal || 60,
    studyStreak: streakDays,
    minutesStudiedToday: todayStreak?.minutesStudied || 0,
    targetExamDate: profile?.targetExamDate ? new Date(profile.targetExamDate) : null,
    daysUntilExam,
    weakUnits: (profile?.weakAreas as string[]) || [],
    strongUnits: (profile?.strongAreas as string[]) || [],
    currentLevel,
    cardsReviewDueCount: srCards.length,
    lastReviewDate: null, // TODO: Track this properly
  };
}

function formatRecommendation(rec: typeof studyRecommendations.$inferSelect) {
  return {
    id: rec.id,
    activityType: rec.activityType,
    unitId: rec.unitId,
    unitName: rec.unitName,
    title: rec.title,
    description: rec.description,
    rationale: rec.rationale,
    priority: rec.priority,
    urgencyScore: rec.urgencyScore,
    estimatedMinutes: rec.estimatedMinutes,
    difficulty: rec.difficulty,
    targetHref: rec.targetHref,
    generatedAt: rec.generatedAt,
  };
}

function formatNewRecommendation(rec: ReturnType<typeof generateRecommendations>[0]) {
  return {
    id: null,
    activityType: rec.activityType,
    unitId: rec.unitId,
    unitName: rec.unitName,
    title: rec.title,
    description: rec.description,
    rationale: rec.rationale,
    priority: rec.priority,
    urgencyScore: rec.urgencyScore,
    estimatedMinutes: rec.estimatedMinutes,
    difficulty: rec.difficulty,
    targetHref: rec.targetHref,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Generate fallback recommendations when algorithm fails
 * This ensures users always see something useful
 */
function generateFallbackRecommendations(): ReturnType<typeof generateRecommendations> {
  const topUnits = ATP_UNITS.slice(0, 5);
  
  const fallbackFactors = {
    performanceWeight: 0.5,
    recencyWeight: 1.0,
    spacedRepWeight: 0,
    weaknessWeight: 0.5,
    examProximityWeight: 0.3,
    streakWeight: 0.1,
    activityBalanceWeight: 0.5,
    timeOfDayWeight: 1.0,
  };
  
  return topUnits.map((unit, index) => ({
    activityType: (index % 2 === 0 ? 'study' : 'quiz') as 'study' | 'quiz',
    unitId: unit.id,
    unitName: unit.name,
    title: index % 2 === 0 ? `Study: ${unit.name}` : `Quiz: ${unit.name}`,
    description: index % 2 === 0 
      ? `Deep dive into ${unit.name} concepts.`
      : `Test your ${unit.name} knowledge.`,
    rationale: `Start with this high-priority topic for the bar exam.`,
    priority: index + 1,
    urgencyScore: 80 - (index * 10),
    estimatedMinutes: index % 2 === 0 ? 30 : 15,
    difficulty: 'beginner' as const,
    targetHref: index % 2 === 0 ? `/study/${unit.id}` : `/quizzes?unit=${unit.id}`,
    decisionFactors: fallbackFactors,
  }));
}
