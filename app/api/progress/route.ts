import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { db } from '@/lib/db';
import { userProgress, practiceSessions, userResponses, topics, studyStreaks, userProfiles, quizHistory } from '@/lib/db/schema';
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

    // Get quiz history for AI-generated quizzes
    const recentQuizHistory = await db.query.quizHistory.findMany({
      where: eq(quizHistory.userId, user.id),
      orderBy: [desc(quizHistory.createdAt)],
      limit: 500, // Get enough for meaningful analysis
    });

    // Calculate quiz stats from quiz history
    const totalQuizQuestions = recentQuizHistory.length;
    const correctQuizQuestions = recentQuizHistory.filter(q => q.isCorrect).length;
    const quizAccuracy = totalQuizQuestions > 0 
      ? Math.round((correctQuizQuestions / totalQuizQuestions) * 100) 
      : 0;

    // Get unique quiz sessions
    const uniqueSessions = new Set(recentQuizHistory.map(q => q.sessionId).filter(Boolean));
    const totalQuizSessions = uniqueSessions.size;

    // Analyze performance by unit/subject
    const unitPerformance = new Map<string, { correct: number; total: number; unitId: string }>();
    for (const q of recentQuizHistory) {
      const unit = q.unitName || 'General';
      const existing = unitPerformance.get(unit) || { correct: 0, total: 0, unitId: q.unitId || 'all' };
      existing.correct += q.isCorrect ? 1 : 0;
      existing.total += 1;
      unitPerformance.set(unit, existing);
    }

    // Analyze by topic category
    const topicPerformance = new Map<string, { correct: number; total: number }>();
    for (const q of recentQuizHistory) {
      const topic = q.topicCategory || q.unitName || 'General';
      const existing = topicPerformance.get(topic) || { correct: 0, total: 0 };
      existing.correct += q.isCorrect ? 1 : 0;
      existing.total += 1;
      topicPerformance.set(topic, existing);
    }

    // Analyze by difficulty
    const difficultyPerformance = new Map<string, { correct: number; total: number }>();
    for (const q of recentQuizHistory) {
      const diff = q.difficulty || 'medium';
      const existing = difficultyPerformance.get(diff) || { correct: 0, total: 0 };
      existing.correct += q.isCorrect ? 1 : 0;
      existing.total += 1;
      difficultyPerformance.set(diff, existing);
    }

    // Analyze by quiz mode
    const modePerformance = new Map<string, { correct: number; total: number }>();
    for (const q of recentQuizHistory) {
      const mode = q.quizMode || 'adaptive';
      const existing = modePerformance.get(mode) || { correct: 0, total: 0 };
      existing.correct += q.isCorrect ? 1 : 0;
      existing.total += 1;
      modePerformance.set(mode, existing);
    }

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

    // Analyze database topic performance for strengths/weaknesses (legacy)
    const dbTopicPerformance = new Map<string, { correct: number; total: number }>();
    
    for (const p of progress) {
      if (p.topic) {
        const topicName = p.topic.title;
        const existing = dbTopicPerformance.get(topicName) || { correct: 0, total: 0 };
        existing.correct += p.questionsCorrect;
        existing.total += p.questionsAttempted;
        dbTopicPerformance.set(topicName, existing);
      }
    }

    // Identify strong and weak areas (with at least 3 attempts)
    const strongAreas: Array<{ name: string; performance: number }> = [];
    const weakAreas: Array<{ name: string; performance: number }> = [];

    dbTopicPerformance.forEach((stats, name) => {
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

    // Get weekly progress from quiz history (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    // Get weekly quiz history stats
    const weeklyQuizHistory = await db
      .select({
        date: sql<string>`DATE(${quizHistory.createdAt})`,
        correct: sql<number>`SUM(CASE WHEN ${quizHistory.isCorrect} THEN 1 ELSE 0 END)`,
        total: sql<number>`COUNT(*)`,
      })
      .from(quizHistory)
      .where(
        and(
          eq(quizHistory.userId, user.id),
          gte(quizHistory.createdAt, sevenDaysAgo)
        )
      )
      .groupBy(sql`DATE(${quizHistory.createdAt})`)
      .orderBy(sql`DATE(${quizHistory.createdAt})`);

    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const weeklyProgress = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      const dayData = weeklyQuizHistory.find(r => r.date === dateStr);
      weeklyProgress.push({
        day: dayNames[date.getDay()],
        date: dateStr,
        correct: Number(dayData?.correct) || 0,
        total: Number(dayData?.total) || 0,
        accuracy: dayData?.total ? Math.round((Number(dayData.correct) / Number(dayData.total)) * 100) : 0,
      });
    }

    // Convert unit performance to array format for subjects report
    const subjectReports = Array.from(unitPerformance.entries())
      .map(([name, stats]) => ({
        name,
        unitId: stats.unitId,
        correct: stats.correct,
        total: stats.total,
        accuracy: stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0,
      }))
      .sort((a, b) => b.total - a.total);

    // Generate strong and weak areas from quiz history
    const quizStrongAreas: Array<{ name: string; performance: number }> = [];
    const quizWeakAreas: Array<{ name: string; performance: number }> = [];

    topicPerformance.forEach((stats, name) => {
      if (stats.total >= 3) {
        const performance = Math.round((stats.correct / stats.total) * 100);
        if (performance >= 70) {
          quizStrongAreas.push({ name, performance });
        } else if (performance < 50) {
          quizWeakAreas.push({ name, performance });
        }
      }
    });

    quizStrongAreas.sort((a, b) => b.performance - a.performance);
    quizWeakAreas.sort((a, b) => a.performance - b.performance);

    // Difficulty breakdown
    const difficultyBreakdown = Array.from(difficultyPerformance.entries())
      .map(([difficulty, stats]) => ({
        difficulty,
        correct: stats.correct,
        total: stats.total,
        accuracy: stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0,
      }));

    // Quiz mode breakdown
    const modeBreakdown = Array.from(modePerformance.entries())
      .map(([mode, stats]) => ({
        mode,
        correct: stats.correct,
        total: stats.total,
        accuracy: stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0,
      }));

    // Recent quiz sessions (last 10)
    const recentSessions = [];
    const sessionMap = new Map<string, typeof recentQuizHistory>();
    for (const q of recentQuizHistory) {
      if (!q.sessionId) continue;
      const existing = sessionMap.get(q.sessionId) || [];
      existing.push(q);
      sessionMap.set(q.sessionId, existing);
    }
    
    let sessionCount = 0;
    for (const [sessionId, questions] of sessionMap.entries()) {
      if (sessionCount >= 10) break;
      const correct = questions.filter(q => q.isCorrect).length;
      const mode = questions[0]?.quizMode || 'adaptive';
      const unit = questions[0]?.unitName || 'General';
      const date = questions[0]?.createdAt;
      recentSessions.push({
        sessionId,
        totalQuestions: questions.length,
        correctAnswers: correct,
        accuracy: Math.round((correct / questions.length) * 100),
        mode,
        unit,
        date: date?.toISOString() || '',
      });
      sessionCount++;
    }

    // Generate recommendations
    const mergedStrongAreas = quizStrongAreas.length > 0 ? quizStrongAreas : strongAreas;
    const mergedWeakAreas = quizWeakAreas.length > 0 ? quizWeakAreas : weakAreas;

    const adaptiveProfile = {
      userId: user.id,
      overallMastery: totalQuizQuestions > 0 ? quizAccuracy : overallAccuracy,
      currentLevel,
      strongAreas: mergedStrongAreas.map(a => a.name),
      weakAreas: mergedWeakAreas.map(a => a.name),
      recommendedFocus: mergedWeakAreas.slice(0, 3).map(a => a.name),
      studyStreak: currentStreak,
      totalQuizzesTaken: totalQuizSessions || quizCount,
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

    // Return comprehensive report data
    return NextResponse.json({
      // Overall Stats
      overallMastery: totalQuizQuestions > 0 ? quizAccuracy : overallAccuracy,
      currentLevel,
      totalQuizzes: totalQuizSessions || quizCount,
      totalCorrect: correctQuizQuestions || totalQuestionsCorrect,
      totalAttempts: totalQuizQuestions || totalQuestionsAttempted,
      studyStreak: currentStreak,
      
      // Historical performance
      strongAreas: mergedStrongAreas.slice(0, 5),
      weakAreas: mergedWeakAreas.slice(0, 5),
      
      // Subject-level reports
      subjectReports,
      
      // Difficulty breakdown
      difficultyBreakdown,
      
      // Quiz mode breakdown
      modeBreakdown,
      
      // Recent quiz sessions
      recentSessions,
      
      // Weekly progress
      weeklyProgress,
      
      // AI Recommendations
      recommendations: recommendations.slice(0, 5),
      
      // Target exam info
      targetExamDate: profile?.targetExamDate || null,
    });
  } catch (error) {
    console.error('Error fetching progress:', error);
    return NextResponse.json(
      { error: 'Failed to fetch progress' },
      { status: 500 }
    );
  }
});
