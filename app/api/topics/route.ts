import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { db } from '@/lib/db';
import { topics, userProgress } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

export const GET = withAuth(async (req: NextRequest, user) => {
  try {
    const { searchParams } = new URL(req.url);
    const competencyType = searchParams.get('competency');

    let query = db.query.topics.findMany({
      where: eq(topics.isActive, true),
      orderBy: (topics, { asc }) => [asc(topics.order)],
    });

    const allTopics = await query;

    // Filter by competency if specified
    const filteredTopics = competencyType
      ? allTopics.filter(t => t.competencyType === competencyType)
      : allTopics;

    // Get user progress for each topic
    const topicsWithProgress = await Promise.all(
      filteredTopics.map(async (topic) => {
        const progress = await db.query.userProgress.findFirst({
          where: and(
            eq(userProgress.userId, user.id),
            eq(userProgress.topicId, topic.id)
          ),
        });

        return {
          ...topic,
          progress: progress ? {
            completionPercentage: progress.completionPercentage,
            questionsAttempted: progress.questionsAttempted,
            questionsCorrect: progress.questionsCorrect,
          } : null,
        };
      })
    );

    return NextResponse.json({
      topics: topicsWithProgress,
    });
  } catch (error) {
    console.error('Error fetching topics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch topics' },
      { status: 500 }
    );
  }
});
