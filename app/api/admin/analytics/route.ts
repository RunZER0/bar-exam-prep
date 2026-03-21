import { NextRequest, NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/auth/middleware';
import { db } from '@/lib/db';
import { users, userProgress, practiceSessions, chatHistory, studyStreaks } from '@/lib/db/schema';
import { sql, desc, count, gte } from 'drizzle-orm';

export const GET = withAdminAuth(async (req: NextRequest, user) => {
  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Total users
    const [{ totalUsers }] = await db
      .select({ totalUsers: count() })
      .from(users);

    // Active users (logged in within last 7 days)
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

    // Recent activity (explicit join — no relational query dependency)
    const recentSessions = await db
      .select({
        id: practiceSessions.id,
        competencyType: practiceSessions.competencyType,
        totalQuestions: practiceSessions.totalQuestions,
        completedQuestions: practiceSessions.completedQuestions,
        score: practiceSessions.score,
        isCompleted: practiceSessions.isCompleted,
        createdAt: practiceSessions.createdAt,
        userEmail: users.email,
        userDisplayName: users.displayName,
      })
      .from(practiceSessions)
      .leftJoin(users, sql`${practiceSessions.userId} = ${users.id}`)
      .orderBy(desc(practiceSessions.createdAt))
      .limit(10);

    // Competency distribution
    const competencyDistribution = await db
      .select({
        competencyType: practiceSessions.competencyType,
        count: count(),
      })
      .from(practiceSessions)
      .groupBy(practiceSessions.competencyType);

    // ── Feature usage analytics (anonymous, aggregated) ──

    // Total study time (last 30 days)
    const [{ totalStudyMinutes }] = await db
      .select({ totalStudyMinutes: sql<number>`coalesce(sum(${studyStreaks.minutesStudied}), 0)` })
      .from(studyStreaks)
      .where(gte(studyStreaks.date, thirtyDaysAgo.toISOString().split('T')[0]));

    // Average daily study time (last 7 days, per active user)
    const [{ avgDailyMinutes }] = await db
      .select({
        avgDailyMinutes: sql<number>`coalesce(round(avg(${studyStreaks.minutesStudied})), 0)`,
      })
      .from(studyStreaks)
      .where(gte(studyStreaks.date, sevenDaysAgo.toISOString().split('T')[0]));

    // Feature usage from page_visits (anonymous — grouped by section, no user IDs)
    let featureUsage: { section: string; totalMinutes: number; visitCount: number }[] = [];
    try {
      const tableCheck = await db.execute(
        sql`SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'page_visits'`
      );
      if (((tableCheck as any).rows?.length ?? 0) > 0) {
        const featureRows = await db.execute(sql`
          SELECT 
            section,
            sum(minutes)::int as total_minutes,
            count(*)::int as visit_count
          FROM page_visits
          WHERE visited_at > ${thirtyDaysAgo}
          GROUP BY section
          ORDER BY total_minutes DESC
          LIMIT 20
        `);
        featureUsage = ((featureRows as any).rows || []).map((r: any) => ({
          section: r.section,
          totalMinutes: Number(r.total_minutes),
          visitCount: Number(r.visit_count),
        }));
      }
    } catch {
      // page_visits table may not exist yet
    }

    // Daily active users trend (last 14 days)
    let dailyActiveUsers: { date: string; count: number }[] = [];
    try {
      const fourteenDaysAgo = new Date();
      fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

      const dauRows = await db.execute(sql`
        SELECT date, count(distinct user_id)::int as user_count
        FROM study_streaks
        WHERE date >= ${fourteenDaysAgo.toISOString().split('T')[0]}
          AND minutes_studied > 0
        GROUP BY date
        ORDER BY date
      `);
      dailyActiveUsers = ((dauRows as any).rows || []).map((r: any) => ({
        date: r.date,
        count: Number(r.user_count),
      }));
    } catch {
      // Silently skip if query fails
    }

    // Session type breakdown (last 30 days)
    let sessionTypeBreakdown: { type: string; count: number }[] = [];
    try {
      const typeRows = await db
        .select({
          type: practiceSessions.competencyType,
          count: count(),
        })
        .from(practiceSessions)
        .where(gte(practiceSessions.createdAt, thirtyDaysAgo))
        .groupBy(practiceSessions.competencyType);
      sessionTypeBreakdown = typeRows.map(r => ({
        type: r.type || 'unknown',
        count: r.count,
      }));
    } catch {
      // Silently skip
    }

    return NextResponse.json({
      overview: {
        totalUsers,
        activeUsers,
        totalAttempts: totalAttempts || 0,
        completedSessions,
        aiInteractions,
      },
      engagement: {
        totalStudyMinutes: totalStudyMinutes || 0,
        avgDailyMinutes: avgDailyMinutes || 0,
        featureUsage,
        dailyActiveUsers,
        sessionTypeBreakdown,
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
