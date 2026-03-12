import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { weeklyRankings, users, userProgress } from '@/lib/db/schema';
import { eq, desc, and, gte, lte, sql, count } from 'drizzle-orm';
import { verifyAuth } from '@/lib/auth/middleware';

// Weekly bonus prizes
const WEEKLY_BONUSES = [
  { rank: 1, amount: 500 },
  { rank: 2, amount: 400 },
  { rank: 3, amount: 300 },
];

/* ================================================================
   NAIROBI TIME HELPERS — Kenya is UTC+3 (no DST)
   Week runs Monday 00:00 EAT → Sunday 23:59:59 EAT
   Winners announced on Sunday.
   ================================================================ */
const EAT_OFFSET_MS = 3 * 60 * 60 * 1000;

/** Returns Monday 00:00 EAT (as UTC Date) for the week containing `date` */
function getWeekStart(date: Date): Date {
  const eat = new Date(date.getTime() + EAT_OFFSET_MS);
  const day = eat.getUTCDay(); // 0=Sun, 1=Mon...
  const diff = day === 0 ? -6 : 1 - day;
  eat.setUTCDate(eat.getUTCDate() + diff);
  eat.setUTCHours(0, 0, 0, 0);
  return new Date(eat.getTime() - EAT_OFFSET_MS);
}

/** Returns Sunday 23:59:59 EAT (as UTC Date) for the week starting at `weekStart` */
function getWeekEnd(weekStart: Date): Date {
  const end = new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000);
  // Sunday 23:59:59 EAT
  end.setTime(end.getTime() + 24 * 60 * 60 * 1000 - 1);
  return end;
}

// GET - Fetch weekly rankings (Nairobi time boundaries)
export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization');
    let currentUserId: string | null = null;

    if (authHeader?.startsWith('Bearer ')) {
      try {
        const authUser = await verifyAuth(req);
        currentUserId = authUser?.id || null; // DB UUID, not Firebase UID
      } catch {
        // User not authenticated
      }
    }

    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '10');
    const weekOffset = parseInt(searchParams.get('weekOffset') || '0');

    // Calculate week boundaries (Nairobi time: Mon–Sun)
    const now = new Date();
    const currentWeekStart = getWeekStart(now);
    currentWeekStart.setTime(currentWeekStart.getTime() - (weekOffset * 7 * 24 * 60 * 60 * 1000));
    const currentWeekEnd = getWeekEnd(currentWeekStart);

    // Fetch rankings for the week
    let rankings = await db
      .select()
      .from(weeklyRankings)
      .where(and(
        gte(weeklyRankings.weekStart, currentWeekStart.toISOString().split('T')[0]),
        lte(weeklyRankings.weekStart, currentWeekEnd.toISOString().split('T')[0])
      ))
      .orderBy(desc(weeklyRankings.totalPoints))
      .limit(limit);

    // If no rankings exist for current week, generate from user progress
    if (rankings.length === 0 && weekOffset === 0) {
      // Get user progress data - use questionsCorrect from userProgress
      const progressData = await db
        .select({
          userId: userProgress.userId,
          totalQuizzes: sql<number>`COUNT(*)`,
          totalPoints: sql<number>`SUM(${userProgress.questionsCorrect} * 10)`,
        })
        .from(userProgress)
        .where(gte(userProgress.updatedAt, currentWeekStart))
        .groupBy(userProgress.userId)
        .orderBy(sql`SUM(${userProgress.questionsCorrect} * 10) DESC`)
        .limit(limit);

      // Create rankings from progress
      const rankingsToInsert = progressData.map((data, index) => ({
        userId: data.userId,
        weekStart: currentWeekStart.toISOString().split('T')[0],
        weekEnd: currentWeekEnd.toISOString().split('T')[0],
        rank: index + 1,
        totalPoints: data.totalPoints || 0,
        quizzesCompleted: data.totalQuizzes || 0,
        bonusEarned: WEEKLY_BONUSES.find(b => b.rank === index + 1)?.amount || 0,
      }));

      if (rankingsToInsert.length > 0) {
        await db.insert(weeklyRankings).values(rankingsToInsert).onConflictDoNothing();
        rankings = await db
          .select()
          .from(weeklyRankings)
          .where(and(
            gte(weeklyRankings.weekStart, currentWeekStart.toISOString().split('T')[0]),
            lte(weeklyRankings.weekStart, currentWeekEnd.toISOString().split('T')[0])
          ))
          .orderBy(desc(weeklyRankings.totalPoints))
          .limit(limit);
      }
    }

    // Enrich rankings with user details
    const rankingsWithUsers = await Promise.all(
      rankings.map(async (ranking, index) => {
        const [user] = await db
          .select({
            displayName: users.displayName,
            photoURL: users.photoURL,
          })
          .from(users)
          .where(eq(users.id, ranking.userId))
          .limit(1);

        const rank = index + 1;
        return {
          rank,
          userId: ranking.userId,
          displayName: user?.displayName || 'Anonymous User',
          photoURL: user?.photoURL,
          totalPoints: ranking.totalPoints,
          quizzesCompleted: ranking.quizzesCompleted,
          bonusEarned: WEEKLY_BONUSES.find(b => b.rank === rank)?.amount || 0,
          isCurrentUser: ranking.userId === currentUserId,
        };
      })
    );

    // Get current user's rank if not in top N
    let currentUserRank = null;
    if (currentUserId) {
      const userInRankings = rankingsWithUsers.find(r => r.isCurrentUser);
      if (!userInRankings) {
        // Get user's rank from full rankings
        const allRankings = await db
          .select()
          .from(weeklyRankings)
          .where(and(
            gte(weeklyRankings.weekStart, currentWeekStart.toISOString().split('T')[0]),
            lte(weeklyRankings.weekStart, currentWeekEnd.toISOString().split('T')[0])
          ))
          .orderBy(desc(weeklyRankings.totalPoints));

        const userRankIndex = allRankings.findIndex(r => r.userId === currentUserId);
        if (userRankIndex !== -1) {
          const userRanking = allRankings[userRankIndex];
          const [user] = await db
            .select({
              displayName: users.displayName,
              photoURL: users.photoURL,
            })
            .from(users)
            .where(eq(users.id, currentUserId))
            .limit(1);

          currentUserRank = {
            rank: userRankIndex + 1,
            userId: currentUserId,
            displayName: user?.displayName || 'You',
            photoURL: user?.photoURL,
            totalPoints: userRanking.totalPoints,
            quizzesCompleted: userRanking.quizzesCompleted,
            bonusEarned: 0,
            isCurrentUser: true,
          };
        }
      }
    }

    // Calculate time remaining until Sunday 23:59:59 EAT
    const weekEndTime = currentWeekEnd.getTime();
    const timeRemaining = Math.max(0, weekEndTime - now.getTime());
    const daysRemaining = Math.floor(timeRemaining / (24 * 60 * 60 * 1000));
    const hoursRemaining = Math.floor((timeRemaining % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));

    // Check if today is Sunday in Nairobi time
    const nairobiNow = new Date(now.getTime() + EAT_OFFSET_MS);
    const isSunday = nairobiNow.getUTCDay() === 0;

    return NextResponse.json({
      rankings: rankingsWithUsers,
      currentUserRank,
      weekInfo: {
        startDate: currentWeekStart.toISOString(),
        endDate: currentWeekEnd.toISOString(),
        daysRemaining,
        hoursRemaining,
        weekOffset,
        isSunday,
        timezone: 'EAT (UTC+3)',
      },
      prizes: WEEKLY_BONUSES.map(b => ({
        rank: b.rank,
        reward: `KES ${b.amount} off subscription`,
        value: b.amount,
      })),
    });
  } catch (error) {
    console.error('Error fetching rankings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch rankings' },
      { status: 500 }
    );
  }
}

// POST - Update rankings (typically called by a cron job or after quiz completion)
export async function POST(req: NextRequest) {
  try {
    const authUser = await verifyAuth(req);
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = authUser.id; // DB UUID

    const body = await req.json();
    const { points, quizzesCompleted } = body;

    const weekStart = getWeekStart(new Date());
    const weekStartStr = weekStart.toISOString().split('T')[0];
    const weekEndDate = new Date(weekStart);
    weekEndDate.setDate(weekEndDate.getDate() + 6);
    const weekEndStr = weekEndDate.toISOString().split('T')[0];

    // Update or create ranking entry
    const [existingRanking] = await db
      .select()
      .from(weeklyRankings)
      .where(and(
        eq(weeklyRankings.userId, userId),
        eq(weeklyRankings.weekStart, weekStartStr)
      ))
      .limit(1);

    if (existingRanking) {
      // Update existing ranking
      await db
        .update(weeklyRankings)
        .set({
          totalPoints: sql`${weeklyRankings.totalPoints} + ${points || 0}`,
          quizzesCompleted: sql`${weeklyRankings.quizzesCompleted} + ${quizzesCompleted || 0}`,
          updatedAt: new Date(),
        })
        .where(and(
          eq(weeklyRankings.userId, userId),
          eq(weeklyRankings.weekStart, weekStartStr)
        ));
    } else {
      // Create new ranking entry
      await db.insert(weeklyRankings).values({
        userId,
        weekStart: weekStartStr,
        weekEnd: weekEndStr,
        rank: 0, // Will be updated when rankings are recalculated
        totalPoints: points || 0,
        quizzesCompleted: quizzesCompleted || 0,
        bonusEarned: 0,
      });
    }

    // Recalculate ranks
    const allRankings = await db
      .select()
      .from(weeklyRankings)
      .where(eq(weeklyRankings.weekStart, weekStartStr))
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

    // Get updated user rank
    const [updatedRanking] = await db
      .select()
      .from(weeklyRankings)
      .where(and(
        eq(weeklyRankings.userId, userId),
        eq(weeklyRankings.weekStart, weekStartStr)
      ))
      .limit(1);

    return NextResponse.json({
      message: 'Ranking updated',
      currentRank: updatedRanking?.rank || 0,
      totalPoints: updatedRanking?.totalPoints || 0,
      bonusEarned: updatedRanking?.bonusEarned || 0,
    });
  } catch (error) {
    console.error('Error updating ranking:', error);
    return NextResponse.json(
      { error: 'Failed to update ranking' },
      { status: 500 }
    );
  }
}


