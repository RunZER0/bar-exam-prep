import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { db } from '@/lib/db';
import { userProgress, practiceSessions, userResponses, topics } from '@/lib/db/schema';
import { eq, desc, sql } from 'drizzle-orm';

export const GET = withAuth(async (req: NextRequest, user) => {
  try {
    // Get overall progress
    const progress = await db.query.userProgress.findMany({
      where: eq(userProgress.userId, user.id),
      with: {
        topic: true,
      },
    });

    // Get practice sessions
    const sessions = await db.query.practiceSessions.findMany({
      where: eq(practiceSessions.userId, user.id),
      orderBy: [desc(practiceSessions.createdAt)],
      limit: 10,
    });

    // Get recent responses
    const responses = await db.query.userResponses.findMany({
      where: eq(userResponses.userId, user.id),
      orderBy: [desc(userResponses.createdAt)],
      limit: 20,
      with: {
        question: {
          with: {
            topic: true,
          },
        },
      },
    });

    // Calculate statistics
    const totalQuestionsAttempted = progress.reduce(
      (sum, p) => sum + p.questionsAttempted, 
      0
    );
    const totalQuestionsCorrect = progress.reduce(
      (sum, p) => sum + p.questionsCorrect, 
      0
    );
    const overallAccuracy = totalQuestionsAttempted > 0 
      ? Math.round((totalQuestionsCorrect / totalQuestionsAttempted) * 100)
      : 0;

    // Competency breakdown
    const competencyStats = await db
      .select({
        competencyType: topics.competencyType,
        attempted: sql<number>`sum(${userProgress.questionsAttempted})`,
        correct: sql<number>`sum(${userProgress.questionsCorrect})`,
      })
      .from(userProgress)
      .innerJoin(topics, eq(userProgress.topicId, topics.id))
      .where(eq(userProgress.userId, user.id))
      .groupBy(topics.competencyType);

    return NextResponse.json({
      progress,
      sessions,
      recentResponses: responses,
      statistics: {
        totalQuestionsAttempted,
        totalQuestionsCorrect,
        overallAccuracy,
        competencyStats,
      },
    });
  } catch (error) {
    console.error('Error fetching progress:', error);
    return NextResponse.json(
      { error: 'Failed to fetch progress' },
      { status: 500 }
    );
  }
});
