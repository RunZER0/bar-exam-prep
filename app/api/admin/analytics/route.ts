import { NextRequest, NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/auth/middleware';
import { db } from '@/lib/db';
import { users, userProgress, practiceSessions, chatHistory } from '@/lib/db/schema';
import { sql, desc, count } from 'drizzle-orm';

export const GET = withAdminAuth(async (req: NextRequest, user) => {
  try {
    // Total users
    const [{ totalUsers }] = await db
      .select({ totalUsers: count() })
      .from(users);

    // Active users (logged in within last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const [{ activeUsers }] = await db
      .select({ activeUsers: count() })
      .from(users)
      .where(sql`${users.updatedAt} > ${sevenDaysAgo}`);

    // Total questions attempted
    const [{ totalAttempts }] = await db
      .select({ totalAttempts: sql<number>`sum(${userProgress.questionsAttempted})` })
      .from(userProgress);

    // Completed practice sessions
    const [{ completedSessions }] = await db
      .select({ completedSessions: count() })
      .from(practiceSessions)
      .where(sql`${practiceSessions.isCompleted} = true`);

    // AI interactions
    const [{ aiInteractions }] = await db
      .select({ aiInteractions: count() })
      .from(chatHistory);

    // Recent activity
    const recentSessions = await db.query.practiceSessions.findMany({
      orderBy: [desc(practiceSessions.createdAt)],
      limit: 10,
      with: {
        user: true,
      },
    });

    // Competency distribution
    const competencyDistribution = await db
      .select({
        competencyType: practiceSessions.competencyType,
        count: count(),
      })
      .from(practiceSessions)
      .groupBy(practiceSessions.competencyType);

    return NextResponse.json({
      overview: {
        totalUsers,
        activeUsers,
        totalAttempts: totalAttempts || 0,
        completedSessions,
        aiInteractions,
      },
      recentActivity: recentSessions,
      competencyDistribution,
    });
  } catch (error) {
    console.error('Error fetching analytics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch analytics' },
      { status: 500 }
    );
  }
});
