/**
 * Quiz Completion Service
 * 
 * Handles background tasks after quiz/question completion:
 * - Updating weekly rankings
 * - Triggering predictive preloading
 * - Processing achievements
 */

import { db } from '@/lib/db';
import { weeklyRankings, preloadedContent, studyRecommendations, quizHistory, studyStreaks, userProfiles } from '@/lib/db/schema';
import { eq, and, gte, desc, sql, lte } from 'drizzle-orm';
import { ATP_UNITS, TOPICS_BY_UNIT } from '@/lib/constants/legal-content';
import { generateObject } from 'ai';
import { google } from '@ai-sdk/google';
import { z } from 'zod';
import { generateRecommendations, UserStudyState, ActivityType } from './study-guide-algorithm';

const PRELOAD_BATCH_SIZE = 5;
const CACHE_DURATION_HOURS = 24;

// Weekly bonus prizes
const WEEKLY_BONUSES = [
  { rank: 1, amount: 500 },
  { rank: 2, amount: 400 },
  { rank: 3, amount: 300 },
];

/**
 * Update user's weekly ranking after quiz completion
 */
export async function updateWeeklyRanking(
  userId: string,
  points: number,
  quizzesCompleted: number = 1
): Promise<void> {
  try {
    const weekStartDate = getWeekStart(new Date());
    const weekStart = weekStartDate.toISOString().split('T')[0];
    const weekEndDate = new Date(weekStartDate);
    weekEndDate.setDate(weekEndDate.getDate() + 6);
    const weekEnd = weekEndDate.toISOString().split('T')[0];

    // Check if user has a ranking entry this week
    const [existingRanking] = await db
      .select()
      .from(weeklyRankings)
      .where(and(
        eq(weeklyRankings.userId, userId),
        eq(weeklyRankings.weekStart, weekStart)
      ))
      .limit(1);

    if (existingRanking) {
      // Update existing ranking
      await db
        .update(weeklyRankings)
        .set({
          totalPoints: sql`${weeklyRankings.totalPoints} + ${points}`,
          quizzesCompleted: sql`${weeklyRankings.quizzesCompleted} + ${quizzesCompleted}`,
          updatedAt: new Date(),
        })
        .where(eq(weeklyRankings.id, existingRanking.id));
    } else {
      // Create new ranking entry
      await db.insert(weeklyRankings).values({
        userId,
        weekStart,
        weekEnd,
        rank: 0,
        totalPoints: points,
        quizzesCompleted,
        bonusEarned: 0,
      });
    }

    // Recalculate all ranks for the week
    const allRankings = await db
      .select()
      .from(weeklyRankings)
      .where(eq(weeklyRankings.weekStart, weekStart))
      .orderBy(desc(weeklyRankings.totalPoints));

    // Update ranks and bonuses
    for (let i = 0; i < allRankings.length; i++) {
      const rank = i + 1;
      const bonus = WEEKLY_BONUSES.find(b => b.rank === rank)?.amount || 0;
      
      await db
        .update(weeklyRankings)
        .set({ rank, bonusEarned: bonus })
        .where(eq(weeklyRankings.id, allRankings[i].id));
    }
  } catch (error) {
    console.error('Error updating weekly ranking:', error);
  }
}

/**
 * Trigger preloading of next quiz content after quiz completion
 */
export async function triggerPreloadAfterQuiz(
  userId: string,
  unitId: string,
  topicId?: string
): Promise<void> {
  try {
    const contextKey = topicId || unitId;
    const now = new Date();

    // Check if content already preloaded
    const existing = await db
      .select()
      .from(preloadedContent)
      .where(and(
        eq(preloadedContent.userId, userId),
        eq(preloadedContent.contentType, 'quiz'),
        eq(preloadedContent.contextKey, contextKey),
        gte(preloadedContent.expiresAt, now)
      ))
      .limit(1);

    if (existing.length > 0) {
      // Content already preloaded
      return;
    }

    // Generate new quiz content
    const content = await generatePreloadContent(unitId, topicId, userId);

    // Store in cache
    const expiresAt = new Date(now.getTime() + CACHE_DURATION_HOURS * 60 * 60 * 1000);
    await db.insert(preloadedContent).values({
      userId,
      contentType: 'quiz',
      contextKey,
      content,
      expiresAt,
    });

    console.log(`Preloaded quiz content for user ${userId}, unit ${unitId}`);
  } catch (error) {
    console.error('Error triggering preload:', error);
  }
}

/**
 * Generate quiz questions for preloading
 */
async function generatePreloadContent(
  unitId: string,
  topicId: string | undefined,
  userId: string
): Promise<any> {
  try {
    const unit = ATP_UNITS.find(u => u.id === unitId);
    const topics = TOPICS_BY_UNIT[unitId] || [];
    const topic = topicId ? topics.find(t => String(t.id) === topicId) : null;

    const QuestionSchema = z.object({
      questions: z.array(z.object({
        question: z.string(),
        options: z.array(z.string()).length(4),
        correctIndex: z.number().min(0).max(3),
        explanation: z.string(),
        difficulty: z.enum(['easy', 'medium', 'hard']),
      })),
    });

    const prompt = `Generate ${PRELOAD_BATCH_SIZE} multiple choice questions for the Kenya Bar Exam.

${unit ? `Unit: ${unit.name}` : ''}
${topic ? `Topic: ${topic.name}` : ''}

Requirements:
1. Questions should test understanding of Kenyan law
2. Include a mix of easy, medium, and hard questions
3. Each question must have exactly 4 options
4. Provide clear explanations referencing relevant laws
5. Questions should be different from typical practice questions

Generate professional, exam-quality questions.`;

    const { object } = await generateObject({
      model: google('gemini-2.0-flash'),
      schema: QuestionSchema,
      prompt,
    });

    return object;
  } catch (error) {
    console.error('Error generating preload content:', error);
    // Return fallback content
    return {
      questions: [{
        question: 'What is the supreme law of Kenya?',
        options: ['Constitution of Kenya 2010', 'Evidence Act', 'Penal Code', 'Civil Procedure Act'],
        correctIndex: 0,
        explanation: 'Article 2(1) of the Constitution establishes it as the supreme law.',
        difficulty: 'easy',
      }],
    };
  }
}

/**
 * Helper: Get the start of the week (Monday)
 */
function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Trigger study guide recommendations regeneration after quiz completion
 * This pre-generates recommendations so they're ready when user visits study page
 */
export async function triggerStudyGuideRegeneration(userId: string): Promise<void> {
  try {
    // Build user study state from database
    const state = await buildUserStudyStateForRegeneration(userId);
    if (!state) {
      console.log('Unable to build study state for user:', userId);
      return;
    }

    // Generate new recommendations
    const recommendations = generateRecommendations(state, 5);

    // Invalidate old recommendations
    await db.update(studyRecommendations)
      .set({ isActive: false })
      .where(and(
        eq(studyRecommendations.userId, userId),
        eq(studyRecommendations.isActive, true)
      ));

    // Insert new recommendations
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 2 * 60 * 60 * 1000); // 2 hours

    for (const rec of recommendations) {
      await db.insert(studyRecommendations).values({
        userId,
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
        inputSnapshot: { state: 'regenerated_after_quiz' },
        algorithmVersion: 'v1',
        isActive: true,
        expiresAt,
      });
    }

    console.log(`Generated ${recommendations.length} recommendations for user ${userId}`);
  } catch (error) {
    console.error('Error regenerating study guide:', error);
  }
}

/**
 * Helper: Build UserStudyState from database for regeneration
 */
async function buildUserStudyStateForRegeneration(userId: string): Promise<UserStudyState | null> {
  try {
    // Get user profile
    const [profile] = await db
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.userId, userId))
      .limit(1);

    // Get quiz history (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const recentQuizzes = await db
      .select()
      .from(quizHistory)
      .where(and(
        eq(quizHistory.userId, userId),
        gte(quizHistory.createdAt, thirtyDaysAgo)
      ))
      .orderBy(desc(quizHistory.createdAt))
      .limit(500);

    // Get today's streak
    const today = new Date().toISOString().split('T')[0];
    const [todayStreak] = await db
      .select()
      .from(studyStreaks)
      .where(and(
        eq(studyStreaks.userId, userId),
        eq(studyStreaks.date, today)
      ))
      .limit(1);

    // Calculate study streak
    let streakDays = 0;
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    for (let i = 0; i < 30; i++) {
      const checkDate = new Date(yesterday);
      checkDate.setDate(checkDate.getDate() - i);
      const dateStr = checkDate.toISOString().split('T')[0];
      
      const [streakEntry] = await db
        .select()
        .from(studyStreaks)
        .where(and(
          eq(studyStreaks.userId, userId),
          eq(studyStreaks.date, dateStr)
        ))
        .limit(1);

      if (streakEntry && streakEntry.questionsAnswered > 0) {
        streakDays++;
      } else {
        break;
      }
    }

    // Calculate unit performance
    const unitPerformance = new Map<string, {
      accuracy: number;
      questionsAnswered: number;
      lastStudied: Date | null;
      lastQuizDate: Date | null;
      recentTrend: 'improving' | 'stable' | 'declining';
    }>();

    // Group quiz history by unit
    const unitStats: Record<string, { correct: number; total: number; dates: Date[] }> = {};
    for (const quiz of recentQuizzes) {
      const unitId = quiz.unitId || 'general';
      if (!unitStats[unitId]) {
        unitStats[unitId] = { correct: 0, total: 0, dates: [] };
      }
      unitStats[unitId].total++;
      if (quiz.isCorrect) unitStats[unitId].correct++;
      unitStats[unitId].dates.push(quiz.createdAt);
    }

    for (const [unitId, stats] of Object.entries(unitStats)) {
      unitPerformance.set(unitId, {
        accuracy: stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0,
        questionsAnswered: stats.total,
        lastStudied: stats.dates[0] || null,
        lastQuizDate: stats.dates[0] || null,
        recentTrend: 'stable',
      });
    }

    // Identify weak and strong units
    const weakUnits: string[] = [];
    const strongUnits: string[] = [];
    for (const [unitId, perf] of unitPerformance.entries()) {
      if (perf.accuracy < 60) weakUnits.push(unitId);
      else if (perf.accuracy >= 80 && perf.questionsAnswered >= 5) strongUnits.push(unitId);
    }

    // Overall metrics
    const totalQuizzes = recentQuizzes.length;
    const totalCorrect = recentQuizzes.filter(q => q.isCorrect).length;
    const overallAccuracy = totalQuizzes > 0 ? Math.round((totalCorrect / totalQuizzes) * 100) : 50;

    // Calculate current level
    let currentLevel: 'beginner' | 'intermediate' | 'advanced' | 'expert' = 'beginner';
    if (totalQuizzes > 50 && overallAccuracy >= 80) currentLevel = 'expert';
    else if (totalQuizzes > 30 && overallAccuracy >= 70) currentLevel = 'advanced';
    else if (totalQuizzes > 10) currentLevel = 'intermediate';

    // Exam date
    const targetExamDate = profile?.targetExamDate ? new Date(profile.targetExamDate) : null;
    const daysUntilExam = targetExamDate 
      ? Math.ceil((targetExamDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      : null;

    // Build recent activities from quiz history
    const recentActivities: Array<{
      type: ActivityType;
      unitId: string | null;
      timestamp: Date;
      durationMinutes: number;
    }> = recentQuizzes.slice(0, 20).map(q => ({
      type: 'quiz' as ActivityType,
      unitId: q.unitId,
      timestamp: q.createdAt,
      durationMinutes: q.timeSpent ? Math.round(q.timeSpent / 60) : 2,
    }));

    // Determine preferred study time (default to flexible)
    const hour = new Date().getHours();
    let preferredStudyTime: 'morning' | 'afternoon' | 'evening' | 'flexible' = 'flexible';
    if (hour >= 5 && hour < 12) preferredStudyTime = 'morning';
    else if (hour >= 12 && hour < 17) preferredStudyTime = 'afternoon';
    else if (hour >= 17 && hour < 22) preferredStudyTime = 'evening';

    return {
      userId,
      overallAccuracy,
      totalQuizzes,
      totalQuestionsAnswered: totalQuizzes,
      unitPerformance,
      recentActivities,
      preferredStudyTime,
      dailyStudyGoal: profile?.dailyStudyGoal || 60,
      studyStreak: streakDays,
      minutesStudiedToday: todayStreak?.minutesStudied || 0,
      targetExamDate,
      daysUntilExam,
      weakUnits,
      strongUnits,
      currentLevel,
      cardsReviewDueCount: 0,
      lastReviewDate: null,
    };
  } catch (error) {
    console.error('Error building user study state:', error);
    return null;
  }
}
