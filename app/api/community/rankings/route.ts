import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { weeklyRankings, users, userProgress } from '@/lib/db/schema';
import { eq, desc, and, gte, lte, sql, count } from 'drizzle-orm';
import { verifyIdToken } from '@/lib/firebase/admin';

// Weekly bonus prizes
const WEEKLY_BONUSES = [
  { rank: 1, amount: 500 },
  { rank: 2, amount: 400 },
  { rank: 3, amount: 300 },
];

// GET - Fetch weekly rankings
export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization');
    let currentUserId: string | null = null;

    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      try {
        const decodedToken = await verifyIdToken(token);
        currentUserId = decodedToken.uid;
      } catch {
        // User not authenticated
      }
    }

    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '10');
    const weekOffset = parseInt(searchParams.get('weekOffset') || '0');

    // Calculate week boundaries
    const now = new Date();
    const currentWeekStart = getWeekStart(now);
    currentWeekStart.setDate(currentWeekStart.getDate() - (weekOffset * 7));
    const currentWeekEnd = new Date(currentWeekStart);
    currentWeekEnd.setDate(currentWeekEnd.getDate() + 6);
    currentWeekEnd.setHours(23, 59, 59, 999);

    // Fetch rankings for the week
    let rankings = await db
      .select()
      .from(weeklyRankings)
      .where(and(
        gte(weeklyRankings.weekStartDate, currentWeekStart),
        lte(weeklyRankings.weekStartDate, currentWeekEnd)
      ))
      .orderBy(desc(weeklyRankings.totalPoints))
      .limit(limit);

    // If no rankings exist for current week, generate from user progress
    if (rankings.length === 0 && weekOffset === 0) {
      // Get user progress data
      const progressData = await db
        .select({
          userId: userProgress.userId,
          totalQuizzes: sql<number>`COUNT(*)`,
          totalPoints: sql<number>`SUM(CASE WHEN ${userProgress.isCorrect} THEN 10 ELSE 1 END)`,
        })
        .from(userProgress)
        .where(gte(userProgress.answeredAt, currentWeekStart))
        .groupBy(userProgress.userId)
        .orderBy(sql`SUM(CASE WHEN ${userProgress.isCorrect} THEN 10 ELSE 1 END) DESC`)
        .limit(limit);

      // Create rankings from progress
      const rankingsToInsert = progressData.map((data, index) => ({
        userId: data.userId,
        weekStartDate: currentWeekStart,
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
            gte(weeklyRankings.weekStartDate, currentWeekStart),
            lte(weeklyRankings.weekStartDate, currentWeekEnd)
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
            gte(weeklyRankings.weekStartDate, currentWeekStart),
            lte(weeklyRankings.weekStartDate, currentWeekEnd)
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

    // Calculate time remaining in the week
    const weekEndTime = currentWeekEnd.getTime();
    const timeRemaining = Math.max(0, weekEndTime - now.getTime());
    const daysRemaining = Math.floor(timeRemaining / (24 * 60 * 60 * 1000));
    const hoursRemaining = Math.floor((timeRemaining % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));

    return NextResponse.json({
      rankings: rankingsWithUsers,
      currentUserRank,
      weekInfo: {
        startDate: currentWeekStart.toISOString(),
        endDate: currentWeekEnd.toISOString(),
        daysRemaining,
        hoursRemaining,
        weekOffset,
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
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const decodedToken = await verifyIdToken(token);
    const userId = decodedToken.uid;

    const body = await req.json();
    const { points, quizzesCompleted } = body;

    const weekStart = getWeekStart(new Date());

    // Update or create ranking entry
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
          totalPoints: sql`${weeklyRankings.totalPoints} + ${points || 0}`,
          quizzesCompleted: sql`${weeklyRankings.quizzesCompleted} + ${quizzesCompleted || 0}`,
          updatedAt: new Date(),
        })
        .where(and(
          eq(weeklyRankings.userId, userId),
          eq(weeklyRankings.weekStartDate, weekStart)
        ));
    } else {
      // Create new ranking entry
      await db.insert(weeklyRankings).values({
        userId,
        weekStartDate: weekStart,
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

    // Get updated user rank
    const [updatedRanking] = await db
      .select()
      .from(weeklyRankings)
      .where(and(
        eq(weeklyRankings.userId, userId),
        eq(weeklyRankings.weekStartDate, weekStart)
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

// Helper function to get the start of the week (Monday)
function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Sunday
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}
