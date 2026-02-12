import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { db } from '@/lib/db';
import { userProgress, practiceSessions, userResponses, topics, studyStreaks, userProfiles } from '@/lib/db/schema';
import { eq, desc, sql, and, gte } from 'drizzle-orm';
import { 
  calculateMasteryLevel, 
  generateStudyRecommendations 
} from '@/lib/ai/adaptive-learning';

export const GET = withAuth(async (req: NextRequest, user) => {
  try {
    // Get overall progress by topic
    const progress = await db.query.userProgress.findMany({
      where: eq(userProgress.userId, user.id),
      with: {
        topic: true,
      },
    });

    // Get user profile for target exam date
    const profile = await db.query.userProfiles.findFirst({
      where: eq(userProfiles.userId, user.id),
    });

    // Get streak data
    const today = new Date().toISOString().split('T')[0];
    const streakData = await db.query.studyStreaks.findFirst({
      where: and(
        eq(studyStreaks.userId, user.id),
        eq(studyStreaks.date, today)
      ),
    });

    // Calculate current streak
    let currentStreak = 0;
    const recentStreaks = await db.query.studyStreaks.findMany({
      where: eq(studyStreaks.userId, user.id),
      orderBy: [desc(studyStreaks.date)],
      limit: 30,
    });
    
    // Count consecutive days
    for (const streak of recentStreaks) {
      if (streak.minutesStudied > 0 || streak.questionsAnswered > 0) {
        currentStreak++;
      } else {
        break;
      }
    }

    // Get recent responses for pattern analysis
    const responses = await db.query.userResponses.findMany({
      where: eq(userResponses.userId, user.id),
      orderBy: [desc(userResponses.createdAt)],
      limit: 100,
      with: {
        question: {
          with: {
            topic: true,
          },
        },
      },
    });

    // Calculate overall statistics
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

    // Analyze topic performance for strengths/weaknesses
    const topicPerformance = new Map<string, { correct: number; total: number }>();
    
    for (const p of progress) {
      if (p.topic) {
        const topicName = p.topic.title;
        const existing = topicPerformance.get(topicName) || { correct: 0, total: 0 };
        existing.correct += p.questionsCorrect;
        existing.total += p.questionsAttempted;
        topicPerformance.set(topicName, existing);
      }
    }

    // Identify strong and weak areas (with at least 3 attempts)
    const strongAreas: Array<{ name: string; performance: number }> = [];
    const weakAreas: Array<{ name: string; performance: number }> = [];

    topicPerformance.forEach((stats, name) => {
      if (stats.total >= 3) {
        const performance = Math.round((stats.correct / stats.total) * 100);
        if (performance >= 70) {
          strongAreas.push({ name, performance });
        } else if (performance < 50) {
          weakAreas.push({ name, performance });
        }
      }
    });

    // Sort by performance (strong: highest first, weak: lowest first)
    strongAreas.sort((a, b) => b.performance - a.performance);
    weakAreas.sort((a, b) => a.performance - b.performance);

    // Calculate mastery level
    const totalQuizzes = await db
      .select({ count: sql<number>`count(DISTINCT ${practiceSessions.id})` })
      .from(practiceSessions)
      .where(eq(practiceSessions.userId, user.id));

    const quizCount = Number(totalQuizzes[0]?.count) || 0;
    const currentLevel = calculateMasteryLevel(overallAccuracy, quizCount);

    // Get weekly progress (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const weeklyResponses = await db
      .select({
        date: sql<string>`DATE(${userResponses.createdAt})`,
        correct: sql<number>`SUM(CASE WHEN ${userResponses.isCorrect} THEN 1 ELSE 0 END)`,
        total: sql<number>`COUNT(*)`,
      })
      .from(userResponses)
      .where(
        and(
          eq(userResponses.userId, user.id),
          gte(userResponses.createdAt, sevenDaysAgo)
        )
      )
      .groupBy(sql`DATE(${userResponses.createdAt})`)
      .orderBy(sql`DATE(${userResponses.createdAt})`);

    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const weeklyProgress = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      const dayData = weeklyResponses.find(r => r.date === dateStr);
      weeklyProgress.push({
        day: dayNames[date.getDay()],
        correct: Number(dayData?.correct) || 0,
        total: Number(dayData?.total) || 0,
      });
    }

    // Generate recommendations
    const adaptiveProfile = {
      userId: user.id,
      overallMastery: overallAccuracy,
      currentLevel,
      strongAreas: strongAreas.map(a => a.name),
      weakAreas: weakAreas.map(a => a.name),
      recommendedFocus: weakAreas.slice(0, 3).map(a => a.name),
      studyStreak: currentStreak,
      totalQuizzesTaken: quizCount,
      performanceByTopic: [],
      lastUpdated: new Date(),
    };

    const rawRecommendations = generateStudyRecommendations(
      adaptiveProfile,
      profile?.targetExamDate ? new Date(profile.targetExamDate) : undefined
    );

    const recommendations = rawRecommendations.map(rec => ({
      title: rec.title,
      description: rec.description,
      priority: rec.priority,
      action: rec.action,
      href: rec.action === 'study' && rec.topicId 
        ? `/study/${rec.topicId.toLowerCase().replace(/\s+/g, '-')}`
        : rec.action === 'quiz' ? '/quizzes'
        : rec.action === 'exam' ? '/exams'
        : rec.action === 'essay' || rec.action === 'drafting' ? '/drafting'
        : '/study',
    }));

    // Return formatted data for the progress page
    return NextResponse.json({
      overallMastery: overallAccuracy,
      currentLevel,
      totalQuizzes: quizCount,
      totalCorrect: totalQuestionsCorrect,
      totalAttempts: totalQuestionsAttempted,
      studyStreak: currentStreak,
      strongAreas: strongAreas.slice(0, 5),
      weakAreas: weakAreas.slice(0, 5),
      recentActivity: responses.slice(0, 10).map(r => ({
        date: r.createdAt?.toISOString() || '',
        type: 'quiz',
        score: r.isCorrect ? 100 : 0,
      })),
      recommendations: recommendations.slice(0, 5),
      weeklyProgress,
    });
  } catch (error) {
    console.error('Error fetching progress:', error);
    return NextResponse.json(
      { error: 'Failed to fetch progress' },
      { status: 500 }
    );
  }
});
