import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { withAuth, type AuthUser } from '@/lib/auth/middleware';

const sql = neon(process.env.DATABASE_URL!);

/**
 * POST /api/exams/record
 * Records CLE exam results for progress tracking.
 * Inserts into practice_sessions and study_streaks for the progress report.
 */
async function handlePost(req: NextRequest, user: AuthUser) {
  try {
    const { unitId, examType, paperSize, score, totalMarks, questionsAnswered, totalQuestions } = await req.json();

    if (!unitId || score === undefined) {
      return NextResponse.json({ error: 'unitId and score required' }, { status: 400 });
    }

    const scoreNorm = Math.min(1, Math.max(0, score / 100));

    // Record as practice session for quiz stats
    await sql`
      INSERT INTO practice_sessions (user_id, unit_id, topic, total_questions, correct_answers, score, duration, completed_at)
      VALUES (
        ${user.id},
        ${unitId},
        ${`CLE Exam - ${paperSize || 'standard'}`},
        ${totalQuestions || 0},
        ${Math.round((questionsAnswered || 0) * scoreNorm)},
        ${score},
        0,
        NOW()
      )
    `.catch(() => {});

    // Update study streak for today
    const today = new Date().toISOString().split('T')[0];
    await sql`
      INSERT INTO study_streaks (user_id, date, sessions_completed, questions_answered, minutes_studied)
      VALUES (${user.id}, ${today}, 1, ${totalQuestions || 0}, 0)
      ON CONFLICT (user_id, date) DO UPDATE SET
        sessions_completed = study_streaks.sessions_completed + 1,
        questions_answered = study_streaks.questions_answered + ${totalQuestions || 0}
    `.catch(() => {});

    // Try to insert into attempts table if it exists
    // This feeds the "Performance by Exam Format" section
    try {
      // Find a skill related to this unit for the attempts table
      const [skill] = await sql`
        SELECT id FROM micro_skills WHERE unit_id = ${unitId} AND is_active = true LIMIT 1
      `;
      
      // Find an item for this skill (required FK)
      if (skill) {
        const [item] = await sql`
          SELECT id FROM items WHERE skill_id = ${skill.id} LIMIT 1
        `;
        if (item) {
          await sql`
            INSERT INTO attempts (user_id, item_id, format, mode, score_norm, time_taken_sec, is_correct, raw_answer_text)
            VALUES (${user.id}::uuid, ${item.id}::uuid, 'written', 'exam', ${scoreNorm}, 0, ${scoreNorm >= 0.5}, ${`CLE ${paperSize} exam`})
          `;
        }
      }
    } catch (e) {
      // Attempts table may not exist or FK constraints — silent fail
      console.warn('Could not record to attempts table:', e);
    }

    return NextResponse.json({ success: true, scoreRecorded: score });
  } catch (error) {
    console.error('Error recording exam result:', error);
    return NextResponse.json({ error: 'Failed to record exam result' }, { status: 500 });
  }
}

export const POST = withAuth(handlePost);
