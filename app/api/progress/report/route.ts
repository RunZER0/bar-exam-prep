/**
 * YNAI Progress Report API
 * 
 * Comprehensive analytics combining:
 * - Mastery engine data (micro_skills + mastery_state)
 * - Quiz history & accuracy
 * - Study streaks & time on platform
 * - Per-unit breakdown with study time
 * - AI-generated narrative insights
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { db } from '@/lib/db';
import { sql, eq, desc, and, gte } from 'drizzle-orm';
import { ATP_UNITS } from '@/lib/constants/legal-content';

export const GET = withAuth(async (req: NextRequest, user) => {
  try {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // 1. Overall mastery from micro_skills engine
    const masteryResult = await db.execute(sql`
      SELECT
        COUNT(DISTINCT ms.id) as total_skills,
        COUNT(DISTINCT CASE WHEN mst.is_verified = true THEN ms.id END) as verified_skills,
        AVG(COALESCE(mst.p_mastery, 0)) as avg_mastery,
        COUNT(DISTINCT CASE WHEN COALESCE(mst.p_mastery, 0) >= 0.7 THEN ms.id END) as strong_skills,
        COUNT(DISTINCT CASE WHEN COALESCE(mst.p_mastery, 0) < 0.4 AND COALESCE(mst.p_mastery, 0) > 0 THEN ms.id END) as weak_skills,
        COUNT(DISTINCT CASE WHEN COALESCE(mst.p_mastery, 0) = 0 THEN ms.id END) as untouched_skills
      FROM micro_skills ms
      LEFT JOIN mastery_state mst ON ms.id = mst.skill_id AND mst.user_id = ${user.id}::uuid
      WHERE ms.is_active = true
    `);

    // 2. Per-unit mastery breakdown
    const unitMastery = await db.execute(sql`
      SELECT
        ms.unit_id,
        COUNT(DISTINCT ms.id) as total_skills,
        COUNT(DISTINCT CASE WHEN mst.is_verified = true THEN ms.id END) as verified_skills,
        AVG(COALESCE(mst.p_mastery, 0)) as avg_mastery,
        COUNT(DISTINCT CASE WHEN COALESCE(mst.p_mastery, 0) >= 0.7 THEN ms.id END) as strong_count,
        COUNT(DISTINCT CASE WHEN COALESCE(mst.p_mastery, 0) < 0.4 AND COALESCE(mst.p_mastery, 0) > 0 THEN ms.id END) as weak_count
      FROM micro_skills ms
      LEFT JOIN mastery_state mst ON ms.id = mst.skill_id AND mst.user_id = ${user.id}::uuid
      WHERE ms.is_active = true
      GROUP BY ms.unit_id
    `);

    // 3. Study streaks — last 30 days
    const streaks = await db.execute(sql`
      SELECT date, minutes_studied, questions_answered, sessions_completed
      FROM study_streaks
      WHERE user_id = ${user.id}::uuid
      AND date >= ${thirtyDaysAgo.toISOString().split('T')[0]}
      ORDER BY date DESC
    `);

    // 4. This week vs last week comparison
    const thisWeekStats = await db.execute(sql`
      SELECT
        COALESCE(SUM(minutes_studied), 0) as total_minutes,
        COALESCE(SUM(questions_answered), 0) as total_questions,
        COALESCE(SUM(sessions_completed), 0) as total_sessions
      FROM study_streaks
      WHERE user_id = ${user.id}::uuid
      AND date >= ${sevenDaysAgo.toISOString().split('T')[0]}
    `);

    const lastWeekStats = await db.execute(sql`
      SELECT
        COALESCE(SUM(minutes_studied), 0) as total_minutes,
        COALESCE(SUM(questions_answered), 0) as total_questions,
        COALESCE(SUM(sessions_completed), 0) as total_sessions
      FROM study_streaks
      WHERE user_id = ${user.id}::uuid
      AND date >= ${fourteenDaysAgo.toISOString().split('T')[0]}
      AND date < ${sevenDaysAgo.toISOString().split('T')[0]}
    `);

    // 5. Quiz history performance
    const quizStats = await db.execute(sql`
      SELECT
        COUNT(*) as total_questions,
        SUM(CASE WHEN is_correct THEN 1 ELSE 0 END) as correct,
        COUNT(DISTINCT session_id) as total_sessions
      FROM quiz_history
      WHERE user_id = ${user.id}::uuid
    `);

    // 6. Quiz performance by unit
    const quizByUnit = await db.execute(sql`
      SELECT
        unit_id,
        unit_name,
        COUNT(*) as total,
        SUM(CASE WHEN is_correct THEN 1 ELSE 0 END) as correct,
        COUNT(DISTINCT session_id) as sessions
      FROM quiz_history
      WHERE user_id = ${user.id}::uuid
      GROUP BY unit_id, unit_name
    `);

    // 7. Weekly activity chart (last 4 weeks, day by day)
    const dailyActivity = await db.execute(sql`
      SELECT
        date,
        minutes_studied,
        questions_answered,
        sessions_completed
      FROM study_streaks
      WHERE user_id = ${user.id}::uuid
      AND date >= ${thirtyDaysAgo.toISOString().split('T')[0]}
      ORDER BY date ASC
    `);

    // 8. Current streak
    const streakRows = streaks.rows as Array<{
      date: string;
      minutes_studied: number;
      questions_answered: number;
    }>;
    let currentStreak = 0;
    const today = now.toISOString().split('T')[0];
    for (const row of streakRows) {
      if (row.minutes_studied > 0 || row.questions_answered > 0) {
        currentStreak++;
      } else {
        break;
      }
    }

    // 9. Attempts data for format breakdown
    const attemptStats = await db.execute(sql`
      SELECT
        COUNT(*) as total_attempts,
        COUNT(CASE WHEN format = 'written' THEN 1 END) as written,
        COUNT(CASE WHEN format = 'oral' THEN 1 END) as oral,
        COUNT(CASE WHEN format = 'drafting' THEN 1 END) as drafting,
        AVG(CASE WHEN format = 'written' THEN score_norm END) as written_avg,
        AVG(CASE WHEN format = 'oral' THEN score_norm END) as oral_avg,
        AVG(CASE WHEN format = 'drafting' THEN score_norm END) as drafting_avg
      FROM attempts
      WHERE user_id = ${user.id}::uuid
    `);

    // 10. Top weaknesses (lowest mastery skills with names)
    const weakSkills = await db.execute(sql`
      SELECT
        ms.name as skill_name,
        ms.unit_id,
        COALESCE(mst.p_mastery, 0) as p_mastery
      FROM micro_skills ms
      LEFT JOIN mastery_state mst ON ms.id = mst.skill_id AND mst.user_id = ${user.id}::uuid
      WHERE ms.is_active = true AND COALESCE(mst.p_mastery, 0) > 0 AND COALESCE(mst.p_mastery, 0) < 0.5
      ORDER BY COALESCE(mst.p_mastery, 0) ASC
      LIMIT 8
    `);

    // 11. Top strengths (highest mastery skills)
    const strongSkills = await db.execute(sql`
      SELECT
        ms.name as skill_name,
        ms.unit_id,
        COALESCE(mst.p_mastery, 0) as p_mastery,
        COALESCE(mst.is_verified, false) as is_verified
      FROM micro_skills ms
      LEFT JOIN mastery_state mst ON ms.id = mst.skill_id AND mst.user_id = ${user.id}::uuid
      WHERE ms.is_active = true AND COALESCE(mst.p_mastery, 0) >= 0.7
      ORDER BY COALESCE(mst.p_mastery, 0) DESC
      LIMIT 8
    `);

    // Build response
    const mastery = masteryResult.rows[0] as any;
    const thisWeek = thisWeekStats.rows[0] as any;
    const lastWeek = lastWeekStats.rows[0] as any;
    const quizData = quizStats.rows[0] as any;
    const attempts = attemptStats.rows[0] as any;

    // Build unit reports
    const unitRows = unitMastery.rows as Array<any>;
    const quizUnitRows = quizByUnit.rows as Array<any>;

    const unitReports = ATP_UNITS.slice(0, 9).map(unit => {
      const mData = unitRows.find((r: any) => r.unit_id === unit.id);
      const qData = quizUnitRows.find((r: any) => r.unit_id === unit.id);

      return {
        unitId: unit.id,
        unitName: unit.name,
        mastery: mData ? Math.round(parseFloat(mData.avg_mastery) * 100) : 0,
        totalSkills: mData ? parseInt(mData.total_skills) : 0,
        verifiedSkills: mData ? parseInt(mData.verified_skills) : 0,
        strongCount: mData ? parseInt(mData.strong_count) : 0,
        weakCount: mData ? parseInt(mData.weak_count) : 0,
        quizAccuracy: qData && parseInt(qData.total) > 0
          ? Math.round((parseInt(qData.correct) / parseInt(qData.total)) * 100)
          : null,
        quizAttempts: qData ? parseInt(qData.total) : 0,
      };
    });

    // Build daily activity for chart
    const activityRows = dailyActivity.rows as Array<any>;
    const activityChart = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dateStr = d.toISOString().split('T')[0];
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const row = activityRows.find((r: any) => r.date === dateStr);
      activityChart.push({
        date: dateStr,
        day: dayNames[d.getDay()],
        minutes: row ? parseInt(row.minutes_studied) : 0,
        questions: row ? parseInt(row.questions_answered) : 0,
        sessions: row ? parseInt(row.sessions_completed) : 0,
      });
    }

    // Calculate totals
    const totalMinutesStudied = activityChart.reduce((s, d) => s + d.minutes, 0);
    const totalSessions = activityChart.reduce((s, d) => s + d.sessions, 0);
    const avgSessionMinutes = totalSessions > 0 ? Math.round(totalMinutesStudied / totalSessions) : 0;
    const daysActive = activityChart.filter(d => d.minutes > 0 || d.questions > 0).length;

    // Exam projection
    const examDate = new Date('2026-04-15');
    const daysUntilExam = Math.ceil((examDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    const totalSkills = parseInt(mastery.total_skills) || 0;
    const touchedSkills = totalSkills - (parseInt(mastery.untouched_skills) || 0);
    const remainingSkills = totalSkills - touchedSkills;
    const avgSkillsPerDay = daysActive > 0 ? touchedSkills / daysActive : 0;
    const estimatedDaysToFinish = avgSkillsPerDay > 0 ? Math.ceil(remainingSkills / avgSkillsPerDay) : null;

    const thisWeekMinutes = parseInt(thisWeek.total_minutes) || 0;
    const lastWeekMinutes = parseInt(lastWeek.total_minutes) || 0;
    const weekOverWeekChange = lastWeekMinutes > 0
      ? Math.round(((thisWeekMinutes - lastWeekMinutes) / lastWeekMinutes) * 100)
      : thisWeekMinutes > 0 ? 100 : 0;

    return NextResponse.json({
      // Summary
      overallMastery: Math.round(parseFloat(mastery.avg_mastery || '0') * 100),
      totalSkills,
      verifiedSkills: parseInt(mastery.verified_skills) || 0,
      strongSkillsCount: parseInt(mastery.strong_skills) || 0,
      weakSkillsCount: parseInt(mastery.weak_skills) || 0,
      untouchedSkillsCount: parseInt(mastery.untouched_skills) || 0,

      // Study time
      studyTime: {
        totalMinutes: totalMinutesStudied,
        thisWeekMinutes,
        lastWeekMinutes,
        weekOverWeekChange,
        avgSessionMinutes,
        totalSessions,
        daysActive,
        currentStreak,
      },

      // Quiz stats
      quiz: {
        totalQuestions: parseInt(quizData.total_questions) || 0,
        correctAnswers: parseInt(quizData.correct) || 0,
        accuracy: parseInt(quizData.total_questions) > 0
          ? Math.round((parseInt(quizData.correct) / parseInt(quizData.total_questions)) * 100)
          : 0,
        totalSessions: parseInt(quizData.total_sessions) || 0,
      },

      // Format performance
      formats: {
        written: {
          attempts: parseInt(attempts.written) || 0,
          avgScore: attempts.written_avg ? Math.round(parseFloat(attempts.written_avg) * 100) : null,
        },
        oral: {
          attempts: parseInt(attempts.oral) || 0,
          avgScore: attempts.oral_avg ? Math.round(parseFloat(attempts.oral_avg) * 100) : null,
        },
        drafting: {
          attempts: parseInt(attempts.drafting) || 0,
          avgScore: attempts.drafting_avg ? Math.round(parseFloat(attempts.drafting_avg) * 100) : null,
        },
      },

      // Unit reports
      unitReports,

      // Strengths & weaknesses
      strengths: (strongSkills.rows as Array<any>).map(r => ({
        name: r.skill_name,
        unitId: r.unit_id,
        mastery: Math.round(parseFloat(r.p_mastery) * 100),
        verified: r.is_verified,
      })),
      weaknesses: (weakSkills.rows as Array<any>).map(r => ({
        name: r.skill_name,
        unitId: r.unit_id,
        mastery: Math.round(parseFloat(r.p_mastery) * 100),
      })),

      // Daily activity chart
      activityChart,

      // Projections
      projection: {
        daysUntilExam,
        examDate: '2026-04-15',
        topicsCovered: touchedSkills,
        topicsRemaining: remainingSkills,
        avgTopicsPerDay: Math.round(avgSkillsPerDay * 10) / 10,
        estimatedDaysToFinish,
        onTrack: estimatedDaysToFinish !== null && estimatedDaysToFinish <= daysUntilExam,
      },

      // Metadata
      generatedAt: now.toISOString(),
      userName: user.name || 'Student',
    });
  } catch (error) {
    console.error('Error generating progress report:', error);
    return NextResponse.json({ error: 'Failed to generate report' }, { status: 500 });
  }
});
