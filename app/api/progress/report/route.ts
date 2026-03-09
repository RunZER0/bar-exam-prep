/**
 * YNAI Progress Report API
 * 
 * Comprehensive analytics combining:
 * - Mastery engine data (micro_skills + mastery_state)
 * - Quiz history & accuracy (gracefully handles missing table)
 * - Study streaks & time on platform
 * - Per-unit breakdown with study time
 * - Format performance from attempts
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { db } from '@/lib/db';
import { eq, sql } from 'drizzle-orm';
import { ATP_UNITS } from '@/lib/constants/legal-content';
import { userProfiles } from '@/lib/db/schema';

/* ── Helper: run a query safely, return [] on failure ── */
async function safeQuery(query: ReturnType<typeof sql>) {
  try {
    const result = await db.execute(query);
    return result.rows as Array<any>;
  } catch (e) {
    console.warn('Query failed (non-fatal):', (e as Error).message?.slice(0, 120));
    return [];
  }
}

/* ── Helper: check if a table exists ── */
async function tableExists(tableName: string): Promise<boolean> {
  try {
    const rows = await db.execute(
      sql`SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = ${tableName}`
    );
    return rows.rows.length > 0;
  } catch {
    return false;
  }
}

export const GET = withAuth(async (req: NextRequest, user) => {
  try {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const sevenAgo = sevenDaysAgo.toISOString().split('T')[0];
    const fourteenAgo = fourteenDaysAgo.toISOString().split('T')[0];
    const thirtyAgo = thirtyDaysAgo.toISOString().split('T')[0];

    // Check which optional tables exist
    const hasQuizHistory = await tableExists('quiz_history');

    // ── 1. Overall mastery ──
    const masteryRows = await safeQuery(sql`
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

    // ── 2. Per-unit mastery ──
    const unitRows = await safeQuery(sql`
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

    // ── 3. Study streaks – last 30 days ──
    const streakRows = await safeQuery(sql`
      SELECT date, minutes_studied, questions_answered, sessions_completed
      FROM study_streaks
      WHERE user_id = ${user.id}::uuid
      AND date >= ${thirtyAgo}::date
      ORDER BY date DESC
    `);

    // ── 4. This week vs last week ──
    const thisWeekRows = await safeQuery(sql`
      SELECT
        COALESCE(SUM(minutes_studied), 0) as total_minutes,
        COALESCE(SUM(questions_answered), 0) as total_questions,
        COALESCE(SUM(sessions_completed), 0) as total_sessions
      FROM study_streaks
      WHERE user_id = ${user.id}::uuid AND date >= ${sevenAgo}::date
    `);

    const lastWeekRows = await safeQuery(sql`
      SELECT
        COALESCE(SUM(minutes_studied), 0) as total_minutes,
        COALESCE(SUM(questions_answered), 0) as total_questions,
        COALESCE(SUM(sessions_completed), 0) as total_sessions
      FROM study_streaks
      WHERE user_id = ${user.id}::uuid
      AND date >= ${fourteenAgo}::date AND date < ${sevenAgo}::date
    `);

    // ── 5. Quiz history (only if table exists) ──
    let quizStatsRow = { total_questions: 0, correct: 0, total_sessions: 0 };
    let quizUnitRows: any[] = [];

    if (hasQuizHistory) {
      const qStats = await safeQuery(sql`
        SELECT
          COUNT(*) as total_questions,
          SUM(CASE WHEN is_correct THEN 1 ELSE 0 END) as correct,
          COUNT(DISTINCT session_id) as total_sessions
        FROM quiz_history
        WHERE user_id = ${user.id}::uuid
      `);
      if (qStats.length > 0) quizStatsRow = qStats[0];

      quizUnitRows = await safeQuery(sql`
        SELECT unit_id, unit_name, COUNT(*) as total,
          SUM(CASE WHEN is_correct THEN 1 ELSE 0 END) as correct,
          COUNT(DISTINCT session_id) as sessions
        FROM quiz_history
        WHERE user_id = ${user.id}::uuid
        GROUP BY unit_id, unit_name
      `);
    }

    // ── 6. Attempts – format performance ──
    const attemptRows = await safeQuery(sql`
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

    // ── 7. Strengths ──
    const strongSkillRows = await safeQuery(sql`
      SELECT ms.name as skill_name, ms.unit_id,
        COALESCE(mst.p_mastery, 0) as p_mastery,
        COALESCE(mst.is_verified, false) as is_verified
      FROM micro_skills ms
      LEFT JOIN mastery_state mst ON ms.id = mst.skill_id AND mst.user_id = ${user.id}::uuid
      WHERE ms.is_active = true AND COALESCE(mst.p_mastery, 0) >= 0.7
      ORDER BY COALESCE(mst.p_mastery, 0) DESC LIMIT 8
    `);

    // ── 8. Weaknesses ──
    const weakSkillRows = await safeQuery(sql`
      SELECT ms.name as skill_name, ms.unit_id,
        COALESCE(mst.p_mastery, 0) as p_mastery
      FROM micro_skills ms
      LEFT JOIN mastery_state mst ON ms.id = mst.skill_id AND mst.user_id = ${user.id}::uuid
      WHERE ms.is_active = true AND COALESCE(mst.p_mastery, 0) > 0 AND COALESCE(mst.p_mastery, 0) < 0.5
      ORDER BY COALESCE(mst.p_mastery, 0) ASC LIMIT 8
    `);

    // ═══════════════════════════════════════
    // BUILD RESPONSE — safe defaults everywhere
    // ═══════════════════════════════════════

    const mastery = masteryRows[0] || { total_skills: 0, verified_skills: 0, avg_mastery: 0, strong_skills: 0, weak_skills: 0, untouched_skills: 0 };
    const thisWeek = thisWeekRows[0] || { total_minutes: 0, total_questions: 0, total_sessions: 0 };
    const lastWeek = lastWeekRows[0] || { total_minutes: 0, total_questions: 0, total_sessions: 0 };
    const attempts = attemptRows[0] || { total_attempts: 0, written: 0, oral: 0, drafting: 0, written_avg: null, oral_avg: null, drafting_avg: null };

    const num = (v: any, fallback = 0) => {
      const n = typeof v === 'string' ? parseFloat(v) : Number(v);
      return isNaN(n) ? fallback : n;
    };

    // Current streak
    let currentStreak = 0;
    for (const row of streakRows) {
      if (num(row.minutes_studied) > 0 || num(row.questions_answered) > 0) {
        currentStreak++;
      } else {
        break;
      }
    }

    // Build unit reports
    const unitReports = ATP_UNITS.slice(0, 9).map(unit => {
      const mData = unitRows.find((r: any) => r.unit_id === unit.id);
      const qData = quizUnitRows.find((r: any) => r.unit_id === unit.id);
      return {
        unitId: unit.id,
        unitName: unit.name,
        mastery: mData ? Math.round(num(mData.avg_mastery) * 100) : 0,
        totalSkills: mData ? num(mData.total_skills) : 0,
        verifiedSkills: mData ? num(mData.verified_skills) : 0,
        strongCount: mData ? num(mData.strong_count) : 0,
        weakCount: mData ? num(mData.weak_count) : 0,
        quizAccuracy: qData && num(qData.total) > 0
          ? Math.round((num(qData.correct) / num(qData.total)) * 100)
          : null,
        quizAttempts: qData ? num(qData.total) : 0,
      };
    });

    // Build 30-day activity chart
    const activityChart = [];
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dateStr = d.toISOString().split('T')[0];
      // Match by comparing date strings (study_streaks.date is a date column)
      const row = streakRows.find((r: any) => {
        // date could be Date object or string
        const rd = r.date instanceof Date ? r.date.toISOString().split('T')[0] : String(r.date).slice(0, 10);
        return rd === dateStr;
      });
      activityChart.push({
        date: dateStr,
        day: dayNames[d.getDay()],
        minutes: row ? num(row.minutes_studied) : 0,
        questions: row ? num(row.questions_answered) : 0,
        sessions: row ? num(row.sessions_completed) : 0,
      });
    }

    // Totals
    const totalMinutesStudied = activityChart.reduce((s, d) => s + d.minutes, 0);
    const totalSessions = activityChart.reduce((s, d) => s + d.sessions, 0);
    const avgSessionMinutes = totalSessions > 0 ? Math.round(totalMinutesStudied / totalSessions) : 0;
    const daysActive = activityChart.filter(d => d.minutes > 0 || d.questions > 0).length;

    // Projection — use actual exam date from user's profile
    const [profile] = await db.select({ examPath: userProfiles.examPath })
      .from(userProfiles).where(eq(userProfiles.userId, user.id)).limit(1);
    const examDateStr = profile?.examPath === 'APRIL_2026' ? '2026-04-09' : '2026-11-12';
    const examDate = new Date(examDateStr);
    const daysUntilExam = Math.max(0, Math.ceil((examDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
    const totalSkills = num(mastery.total_skills);
    const touchedSkills = totalSkills - num(mastery.untouched_skills);
    const remainingSkills = totalSkills - touchedSkills;
    const avgSkillsPerDay = daysActive > 0 ? touchedSkills / daysActive : 0;
    const estimatedDaysToFinish = avgSkillsPerDay > 0 ? Math.ceil(remainingSkills / avgSkillsPerDay) : null;

    const thisWeekMinutes = num(thisWeek.total_minutes);
    const lastWeekMinutes = num(lastWeek.total_minutes);
    const weekOverWeekChange = lastWeekMinutes > 0
      ? Math.round(((thisWeekMinutes - lastWeekMinutes) / lastWeekMinutes) * 100)
      : thisWeekMinutes > 0 ? 100 : 0;

    return NextResponse.json({
      overallMastery: Math.round(num(mastery.avg_mastery) * 100),
      totalSkills,
      verifiedSkills: num(mastery.verified_skills),
      strongSkillsCount: num(mastery.strong_skills),
      weakSkillsCount: num(mastery.weak_skills),
      untouchedSkillsCount: num(mastery.untouched_skills),

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

      quiz: {
        totalQuestions: num(quizStatsRow.total_questions),
        correctAnswers: num(quizStatsRow.correct),
        accuracy: num(quizStatsRow.total_questions) > 0
          ? Math.round((num(quizStatsRow.correct) / num(quizStatsRow.total_questions)) * 100)
          : 0,
        totalSessions: num(quizStatsRow.total_sessions),
      },

      formats: {
        written: {
          attempts: num(attempts.written),
          avgScore: attempts.written_avg != null ? Math.round(num(attempts.written_avg) * 100) : null,
        },
        oral: {
          attempts: num(attempts.oral),
          avgScore: attempts.oral_avg != null ? Math.round(num(attempts.oral_avg) * 100) : null,
        },
        drafting: {
          attempts: num(attempts.drafting),
          avgScore: attempts.drafting_avg != null ? Math.round(num(attempts.drafting_avg) * 100) : null,
        },
      },

      unitReports,

      strengths: strongSkillRows.map(r => ({
        name: r.skill_name,
        unitId: r.unit_id,
        mastery: Math.round(num(r.p_mastery) * 100),
        verified: r.is_verified,
      })),
      weaknesses: weakSkillRows.map(r => ({
        name: r.skill_name,
        unitId: r.unit_id,
        mastery: Math.round(num(r.p_mastery) * 100),
      })),

      activityChart,

      projection: {
        daysUntilExam,
        examDate: '2026-04-15',
        topicsCovered: touchedSkills,
        topicsRemaining: remainingSkills,
        avgTopicsPerDay: Math.round(avgSkillsPerDay * 10) / 10,
        estimatedDaysToFinish,
        onTrack: estimatedDaysToFinish !== null && estimatedDaysToFinish <= daysUntilExam,
      },

      generatedAt: now.toISOString(),
      userName: user.displayName || 'Student',
    });
  } catch (error) {
    console.error('Error generating progress report:', error);
    return NextResponse.json({ error: 'Failed to generate report' }, { status: 500 });
  }
});
