import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth/middleware';
import { db } from '@/lib/db';
import { users, studyStreaks, practiceSessions, userResponses } from '@/lib/db/schema';
import { eq, desc, gte, and, sql } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const user = await verifyAuth(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const dbUser = await db.query.users.findFirst({
      where: eq(users.firebaseUid, user.firebaseUid),
    });

    if (!dbUser) {
      return NextResponse.json({
        currentStreak: 0,
        longestStreak: 0,
        todayMinutes: 0,
        weeklyData: [],
      });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // Get last 7 days of streaks
    const recentStreaks = await db
      .select()
      .from(studyStreaks)
      .where(
        and(
          eq(studyStreaks.userId, dbUser.id),
          gte(studyStreaks.date, sevenDaysAgo.toISOString().split('T')[0])
        )
      )
      .orderBy(desc(studyStreaks.date));

    // Calculate current streak
    let currentStreak = 0;
    const sortedDates = recentStreaks
      .map(s => new Date(s.date))
      .sort((a, b) => b.getTime() - a.getTime());

    const todayStr = today.toISOString().split('T')[0];
    const yesterdayStr = new Date(today.getTime() - 86400000).toISOString().split('T')[0];
    
    // Check if user studied today or yesterday to start counting
    const hasStreakToday = recentStreaks.some(s => s.date === todayStr && s.minutesStudied > 0);
    const hasStreakYesterday = recentStreaks.some(s => s.date === yesterdayStr && s.minutesStudied > 0);
    
    if (hasStreakToday || hasStreakYesterday) {
      let checkDate = hasStreakToday ? today : new Date(today.getTime() - 86400000);
      
      for (let i = 0; i < 365; i++) {
        const dateStr = checkDate.toISOString().split('T')[0];
        const hasStudy = recentStreaks.some(s => s.date === dateStr && s.minutesStudied > 0);
        
        if (hasStudy) {
          currentStreak++;
          checkDate.setDate(checkDate.getDate() - 1);
        } else {
          break;
        }
      }
    }

    // Get today's minutes
    const todayStreak = recentStreaks.find(s => s.date === todayStr);
    const todayMinutes = todayStreak?.minutesStudied || 0;

    // Build weekly data for chart
    const weeklyData = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      const streak = recentStreaks.find(s => s.date === dateStr);
      
      weeklyData.push({
        date: dateStr,
        dayName: date.toLocaleDateString('en-KE', { weekday: 'short' }),
        minutes: streak?.minutesStudied || 0,
        questions: streak?.questionsAnswered || 0,
        sessions: streak?.sessionsCompleted || 0,
      });
    }

    // Get longest streak (simplified - in production, calculate from all data)
    const longestStreak = Math.max(currentStreak, 0);

    return NextResponse.json({
      currentStreak,
      longestStreak,
      todayMinutes,
      weeklyData,
    });
  } catch (error) {
    console.error('Error fetching streaks:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await verifyAuth(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { minutes = 0, questions = 0, sessions = 0 } = await request.json();

    const dbUser = await db.query.users.findFirst({
      where: eq(users.firebaseUid, user.firebaseUid),
    });

    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const today = new Date().toISOString().split('T')[0];

    // Upsert today's streak
    const existingStreak = await db.query.studyStreaks.findFirst({
      where: and(
        eq(studyStreaks.userId, dbUser.id),
        eq(studyStreaks.date, today)
      ),
    });

    if (existingStreak) {
      await db.update(studyStreaks)
        .set({
          minutesStudied: existingStreak.minutesStudied + minutes,
          questionsAnswered: existingStreak.questionsAnswered + questions,
          sessionsCompleted: existingStreak.sessionsCompleted + sessions,
        })
        .where(eq(studyStreaks.id, existingStreak.id));
    } else {
      await db.insert(studyStreaks).values({
        userId: dbUser.id,
        date: today,
        minutesStudied: minutes,
        questionsAnswered: questions,
        sessionsCompleted: sessions,
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating streak:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
