/**
 * Quiz Completion Service
 * 
 * Handles background tasks after quiz/question completion:
 * - Updating weekly rankings
 * - Triggering predictive preloading
 * - Processing achievements
 */

import { db } from '@/lib/db';
import { weeklyRankings, preloadedContent } from '@/lib/db/schema';
import { eq, and, gte, desc, sql } from 'drizzle-orm';
import { ATP_UNITS, TOPICS_BY_UNIT } from '@/lib/constants/legal-content';
import { generateObject } from 'ai';
import { google } from '@ai-sdk/google';
import { z } from 'zod';

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
    const weekStart = getWeekStart(new Date());

    // Check if user has a ranking entry this week
    const [existingRanking] = await db
      .select()
      .from(weeklyRankings)
      .where(and(
        eq(weeklyRankings.userId, userId),
        eq(weeklyRankings.weekStartDate, weekStart)
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
        weekStartDate: weekStart,
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
      .where(eq(weeklyRankings.weekStartDate, weekStart))
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
    const cacheKey = topicId || unitId;
    const now = new Date();

    // Check if content already preloaded
    const existing = await db
      .select()
      .from(preloadedContent)
      .where(and(
        eq(preloadedContent.userId, userId),
        eq(preloadedContent.contentType, 'quiz'),
        eq(preloadedContent.cacheKey, cacheKey),
        eq(preloadedContent.isUsed, false),
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
      cacheKey,
      content,
      expiresAt,
      isUsed: false,
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
