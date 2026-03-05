/**
 * User Activity History API
 * Aggregates activity from chat_sessions, study_sessions, study_streaks
 *
 * GET /api/history
 * Returns: { activities, streaks, stats }
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function safeQuery(query: any): Promise<any[]> {
  try {
    const result = await db.execute(query);
    return (result as any).rows as any[];
  } catch { return []; }
}

async function tableExists(name: string): Promise<boolean> {
  try {
    const result = await db.execute(
      sql`SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = ${name}`
    );
    return ((result as any).rows?.length ?? 0) > 0;
  } catch { return false; }
}

export const GET = withAuth(async (req: NextRequest, user) => {
  try {
    // Get DB user
    const [dbUser] = await safeQuery(
      sql`SELECT id FROM users WHERE firebase_uid = ${user.firebaseUid} LIMIT 1`
    );
    if (!dbUser) {
      return NextResponse.json({ activities: [], streaks: [], stats: {} });
    }
    const userId = dbUser.id;

    // Fetch chat sessions
    const chatActivities = await safeQuery(
      sql`
        SELECT
          cs.id,
          'chat' as type,
          cs.title,
          cs.competency_type as category,
          cs.context,
          cs.last_message_at as activity_date,
          cs.created_at,
          cs.is_archived,
          (SELECT COUNT(*) FROM chat_messages cm WHERE cm.session_id = cs.id)::int as message_count
        FROM chat_sessions cs
        WHERE cs.user_id = ${userId}
        ORDER BY cs.last_message_at DESC
        LIMIT 100
      `
    );

    // Fetch study sessions
    const hasStudySessions = await tableExists('study_sessions');
    let studyActivities: any[] = [];
    if (hasStudySessions) {
      studyActivities = await safeQuery(
        sql`
          SELECT
            ss.id,
            'study' as type,
            COALESCE(ss.modality, 'WRITTEN') as category,
            ss.status,
            ss.target_skill_ids,
            ss.estimated_minutes,
            ss.continuous_minutes,
            ss.final_score,
            ss.phase_written,
            ss.started_at as activity_date,
            ss.created_at,
            ss.ended_at
          FROM study_sessions ss
          WHERE ss.user_id = ${userId}
          ORDER BY COALESCE(ss.started_at, ss.created_at) DESC
          LIMIT 50
        `
      );
    }

    // Fetch study streaks (recent 30 days)
    const hasStreaks = await tableExists('study_streaks');
    let streaks: any[] = [];
    if (hasStreaks) {
      streaks = await safeQuery(
        sql`
          SELECT
            date,
            minutes_studied,
            questions_answered,
            sessions_completed
          FROM study_streaks
          WHERE user_id = ${userId}
          ORDER BY date DESC
          LIMIT 30
        `
      );
    }

    // Fetch node progress for completed items
    const hasNodeProgress = await tableExists('node_progress');
    let progressActivities: any[] = [];
    if (hasNodeProgress) {
      progressActivities = await safeQuery(
        sql`
          SELECT
            np.id,
            'progress' as type,
            np.phase,
            sn.topic_name as title,
            sn.unit_code as category,
            np.updated_at as activity_date
          FROM node_progress np
          LEFT JOIN syllabus_nodes sn ON sn.id = np.node_id
          WHERE np.user_id = ${userId}
            AND np.phase IN ('DIAGNOSIS', 'MASTERY')
          ORDER BY np.updated_at DESC
          LIMIT 30
        `
      );
    }

    // Build unified activity list
    const activities = [
      ...chatActivities.map((c: any) => ({
        id: c.id,
        type: 'chat' as const,
        title: c.title || 'Untitled Chat',
        category: c.competency_type || c.category || 'research',
        date: c.activity_date || c.created_at,
        meta: {
          messageCount: Number(c.message_count) || 0,
          isArchived: c.is_archived,
        },
      })),
      ...studyActivities.map((s: any) => ({
        id: s.id,
        type: 'study' as const,
        title: `Study Session - ${s.category || 'Written'}`,
        category: (s.category || 'written').toLowerCase(),
        date: s.activity_date || s.created_at,
        meta: {
          status: s.status,
          minutes: Number(s.continuous_minutes) || Number(s.estimated_minutes) || 0,
          score: s.final_score ? Number(s.final_score) : null,
        },
      })),
      ...progressActivities.map((p: any) => ({
        id: p.id,
        type: 'milestone' as const,
        title: p.title || 'Topic Progress',
        category: p.category || 'syllabus',
        date: p.activity_date,
        meta: { phase: p.phase },
      })),
    ]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 100);

    // Compute stats
    const totalChats = chatActivities.length;
    const totalStudy = studyActivities.length;
    const totalMinutes = streaks.reduce((sum: number, s: any) => sum + (Number(s.minutes_studied) || 0), 0);
    const totalQuestions = streaks.reduce((sum: number, s: any) => sum + (Number(s.questions_answered) || 0), 0);
    const currentStreak = computeStreak(streaks);

    return NextResponse.json({
      activities,
      streaks: streaks.map((s: any) => ({
        date: s.date,
        minutes: Number(s.minutes_studied) || 0,
        questions: Number(s.questions_answered) || 0,
        sessions: Number(s.sessions_completed) || 0,
      })),
      stats: {
        totalChats,
        totalStudy,
        totalMinutes,
        totalQuestions,
        currentStreak,
        totalActivities: activities.length,
      },
    });
  } catch (error) {
    console.error('History API error:', error);
    return NextResponse.json({ activities: [], streaks: [], stats: {} }, { status: 500 });
  }
});

function computeStreak(streaks: any[]): number {
  if (!streaks.length) return 0;
  let count = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (const s of streaks) {
    const d = new Date(s.date);
    d.setHours(0, 0, 0, 0);
    const diff = Math.round((today.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
    if (diff === count) {
      count++;
    } else {
      break;
    }
  }
  return count;
}
