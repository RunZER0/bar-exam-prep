/**
 * YNAI Mastery Engine v3 - Attempt Submission API
 * 
 * POST: Submit a new attempt for grading
 * GET: Fetch attempt history with filters
 * 
 * This is the critical path:
 * 1. Grade response (via AI or simple comparison)
 * 2. Update mastery state for all involved skills
 * 3. Update error signatures
 * 4. Check gate verification
 * 5. Return structured feedback
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { eq, sql } from 'drizzle-orm';
import { verifyIdToken } from '@/lib/firebase/admin';
import {
  updateMasteryWithCurrentState,
  checkGateVerification,
  MASTERY_CONFIG,
  type MasteryStateUpdate,
  type GateCheckResult,
} from '@/lib/services/mastery-engine';
import {
  gradeResponse,
  gradeMcqResponse,
  type GradingRequest,
  type GradingOutput,
} from '@/lib/services/grading-service';
import {
  searchKnowledgeBaseSemantic,
  searchLectureChunksSemantic,
} from '@/lib/ai/embedding-service';

// ============================================
// TYPES
// ============================================

interface AttemptSubmission {
  itemId: string;
  format: 'written' | 'oral' | 'drafting' | 'mcq' | 'short_answer';
  mode: 'practice' | 'timed' | 'exam_sim';
  // Response data
  response: string; // Written text, transcript, or selected option
  selectedOption?: string; // For MCQ
  // Timing
  startedAt: string; // ISO timestamp
  timeTakenSec: number;
  // Item context (passed from client)
  prompt: string;
  context?: string;
  keyPoints?: string[];
  modelAnswer?: string;
  options?: { label: string; text: string; isCorrect: boolean }[];
  // Skill mapping
  skillIds: string[];
  coverageWeights: Record<string, number>;
  unitId: string;
  difficulty: number;
}

interface AttemptResult {
  attemptId: string;
  // Grading
  grading: GradingOutput;
  // Mastery updates
  masteryUpdates: MasteryStateUpdate[];
  // Gate checks
  gateResults: GateCheckResult[];
  // Summary
  summary: {
    passed: boolean;
    scorePercent: number;
    improvementAreas: string[];
    nextRecommendedSkills: string[];
    streakMaintained: boolean;
  };
}

/**
 * POST /api/mastery/attempt
 * Submit an attempt for grading and mastery update
 */
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await verifyIdToken(token);
    
    const [user] = await db.select().from(users)
      .where(eq(users.firebaseUid, decodedToken.uid))
      .limit(1);

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const submission: AttemptSubmission = await req.json();
    
    // Validate required fields
    if (!submission.itemId || !submission.format || !submission.mode) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    
    if (!submission.response && submission.format !== 'mcq') {
      return NextResponse.json({ error: 'Response text required' }, { status: 400 });
    }
    
    if (submission.format === 'mcq' && !submission.selectedOption) {
      return NextResponse.json({ error: 'Selected option required for MCQ' }, { status: 400 });
    }

    // ========================================
    // STEP 1: GRADE THE RESPONSE
    // ========================================
    
    let grading: GradingOutput;
    
    if (submission.format === 'mcq') {
      // Simple MCQ grading
      const correctOption = submission.options?.find(o => o.isCorrect)?.label ?? '';
      grading = gradeMcqResponse(
        submission.selectedOption!,
        correctOption,
        submission.options ?? []
      );
    } else if (submission.format === 'short_answer') {
      // Use AI grading for short answer but treat it as written
      const gradingRequest: GradingRequest = {
        userId: user.id,
        itemId: submission.itemId,
        format: 'written', // AI model understands 'written' better than 'short_answer' for now
        mode: submission.mode,
        prompt: submission.prompt,
        context: submission.context,
        keyPoints: submission.keyPoints,
        modelAnswer: submission.modelAnswer,
        response: submission.response,
        timeTakenSec: submission.timeTakenSec,
        skillIds: submission.skillIds,
        unitId: submission.unitId,
      };
      
      try {
        grading = await gradeResponse(gradingRequest);
      } catch (gradingError) {
        console.error('Grading failed:', gradingError);
        // Fallback
        grading = {
           scoreNorm: 0.5,
           scoreRaw: 5,
           maxScore: 10,
           rubricBreakdown: [{ category: 'General', score: 5, maxScore: 10, feedback: 'Grading failed.' }],
           missingPoints: [],
           errorTags: [],
           nextDrills: [],
           modelOutline: '',
           evidenceRequests: [],
        };
      }
    } else {
      // AI-powered grading for written/oral/drafting
      // Retrieve relevant context via pgvector semantic search
      let relevantLectureChunks: { content: string; lectureTitle: string; timestamp?: string }[] = [];
      let relevantAuthorities: { citation: string; summary: string }[] = [];

      try {
        const queryText = `${submission.prompt} ${submission.context || ''}`.slice(0, 500);
        const [chunks, knowledge] = await Promise.all([
          searchLectureChunksSemantic(queryText, { topK: 3, unitId: submission.unitId }).catch(() => []),
          searchKnowledgeBaseSemantic(queryText, { topK: 5, unitId: submission.unitId }).catch(() => []),
        ]);

        relevantLectureChunks = chunks.map(c => ({
          content: c.content,
          lectureTitle: c.lectureTitle,
        }));

        relevantAuthorities = knowledge.map(k => ({
          citation: k.citation || k.source,
          summary: `${k.title}: ${k.content.slice(0, 400)}`,
        }));

        if (relevantAuthorities.length > 0 || relevantLectureChunks.length > 0) {
          console.log(`[Attempt] RAG context: ${relevantAuthorities.length} authorities, ${relevantLectureChunks.length} lecture chunks`);
        }
      } catch (ragError) {
        console.warn('[Attempt] RAG retrieval failed, grading without context:', ragError);
      }

      const gradingRequest: GradingRequest = {
        userId: user.id,
        itemId: submission.itemId,
        format: submission.format,
        mode: submission.mode,
        prompt: submission.prompt,
        context: submission.context,
        keyPoints: submission.keyPoints,
        modelAnswer: submission.modelAnswer,
        response: submission.response,
        timeTakenSec: submission.timeTakenSec,
        skillIds: submission.skillIds,
        unitId: submission.unitId,
        relevantLectureChunks,
        relevantAuthorities,
      };
      
      try {
        grading = await gradeResponse(gradingRequest);
      } catch (gradingError) {
        console.error('Grading failed:', gradingError);
        // Fallback grading if AI fails
        grading = generateFallbackGrading(submission);
      }
    }

    // ========================================
    // STEP 2: UPDATE MASTERY STATE
    // ========================================
    
    const masteryUpdates: MasteryStateUpdate[] = [];
    
    for (const skillId of submission.skillIds) {
      const coverageWeight = submission.coverageWeights[skillId] ?? 1.0;
      
      // Fetch current mastery state from DB
      const currentMasteryResult = await db.execute(sql`
        SELECT p_mastery, stability, attempt_count, correct_count, is_verified
        FROM mastery_state 
        WHERE user_id = ${user.id}::uuid AND skill_id = ${skillId}::uuid
      `);
      
      const currentRow = currentMasteryResult.rows[0] as {
        p_mastery: string;
        stability: string;
        attempt_count: number;
        correct_count: number;
        is_verified: boolean;
      } | undefined;
      
      const currentPMastery = currentRow ? parseFloat(currentRow.p_mastery) : 0;
      const currentStability = currentRow ? parseFloat(currentRow.stability) : 1.0;
      const currentAttemptCount = currentRow?.attempt_count ?? 0;
      const currentCorrectCount = currentRow?.correct_count ?? 0;
      
      const update = updateMasteryWithCurrentState(
        skillId,
        currentPMastery,
        currentStability,
        {
          scoreNorm: grading.scoreNorm,
          format: (submission.format === 'short_answer' ? 'written' : submission.format) as any,
          mode: submission.mode,
          difficulty: submission.difficulty,
          coverageWeight,
        }
      );
      
      masteryUpdates.push(update);
      
      // PERSIST TO DATABASE - upsert mastery_state
      const newCorrectCount = grading.scoreNorm >= 0.6 ? currentCorrectCount + 1 : currentCorrectCount;
      
      await db.execute(sql`
        INSERT INTO mastery_state (user_id, skill_id, p_mastery, stability, attempt_count, correct_count, last_practiced_at, next_review_date)
        VALUES (
          ${user.id}::uuid, 
          ${skillId}::uuid, 
          ${update.newPMastery}, 
          ${update.newStability},
          ${currentAttemptCount + 1},
          ${newCorrectCount},
          NOW(),
          NOW() + INTERVAL '1 day' * ${Math.ceil(update.newStability)}
        )
        ON CONFLICT (user_id, skill_id) 
        DO UPDATE SET 
          p_mastery = ${update.newPMastery},
          stability = ${update.newStability},
          attempt_count = mastery_state.attempt_count + 1,
          correct_count = ${newCorrectCount},
          last_practiced_at = NOW(),
          next_review_date = NOW() + INTERVAL '1 day' * ${Math.ceil(update.newStability)},
          updated_at = NOW()
      `);
      
      console.log(`[MASTERY UPDATE] User ${user.id} Skill ${skillId}: ${(currentPMastery * 100).toFixed(1)}% → ${(update.newPMastery * 100).toFixed(1)}%`);
    }

    // ========================================
    // STEP 3: UPDATE ERROR SIGNATURES
    // ========================================
    
    if (grading.errorTags && grading.errorTags.length > 0) {
      for (const errorCode of grading.errorTags) {
        for (const skillId of submission.skillIds) {
          // Look up or create the error tag
          const tagResult = await db.execute(sql`
            INSERT INTO error_tags (code, label)
            VALUES (${errorCode}, ${errorCode})
            ON CONFLICT (code) DO UPDATE SET label = error_tags.label
            RETURNING id
          `);
          const tagId = (tagResult.rows[0] as { id: string })?.id;
          if (!tagId) continue;

          // Upsert into skill_error_signature
          await db.execute(sql`
            INSERT INTO skill_error_signature (user_id, skill_id, error_tag_id, occurrence_count, last_seen_at)
            VALUES (${user.id}::uuid, ${skillId}::uuid, ${tagId}::uuid, 1, NOW())
            ON CONFLICT (user_id, skill_id, error_tag_id)
            DO UPDATE SET
              occurrence_count = skill_error_signature.occurrence_count + 1,
              last_seen_at = NOW()
          `);
        }
      }
      console.log(`[ERROR SIGS] Recorded ${grading.errorTags.length} error tags for ${submission.skillIds.length} skills`);
    }

    // ========================================
    // STEP 4: CHECK GATE VERIFICATION
    // ========================================
    
    const gateResults: GateCheckResult[] = [];
    
    if (submission.mode !== 'practice') {
      for (const skillId of submission.skillIds) {
        // Fetch real timed attempts history from DB for this skill
        const historyResult = await db.execute(sql`
          SELECT a.id as attempt_id, a.score_norm, a.created_at,
                 COALESCE(a.feedback_json->>'errorTags', '[]') as error_tags_raw
          FROM attempts a
          JOIN item_skill_map ism ON ism.item_id = a.item_id
          WHERE a.user_id = ${user.id}::uuid
            AND ism.skill_id = ${skillId}::uuid
            AND a.mode IN ('timed', 'exam_sim')
            AND a.score_norm >= 0.6
          ORDER BY a.created_at DESC
          LIMIT 10
        `);

        const timedAttempts = (historyResult.rows as any[]).map(r => ({
          attemptId: r.attempt_id,
          scoreNorm: parseFloat(r.score_norm),
          submittedAt: new Date(r.created_at),
          errorTagIds: (() => { try { return JSON.parse(r.error_tags_raw); } catch { return []; } })(),
        }));

        // Add current attempt if it's a timed pass
        if (grading.scoreNorm >= 0.6) {
          timedAttempts.unshift({
            attemptId: 'current',
            scoreNorm: grading.scoreNorm,
            submittedAt: new Date(),
            errorTagIds: grading.errorTags,
          });
        }

        // Fetch top recurring error tags for this skill
        const topErrorsResult = await db.execute(sql`
          SELECT et.code
          FROM skill_error_signature ses
          JOIN error_tags et ON et.id = ses.error_tag_id
          WHERE ses.user_id = ${user.id}::uuid AND ses.skill_id = ${skillId}::uuid
          ORDER BY ses.occurrence_count DESC
          LIMIT 5
        `);
        const topErrorTagIds = (topErrorsResult.rows as any[]).map(r => r.code);
        
        const masteryUpdate = masteryUpdates.find(u => u.skillId === skillId);
        
        const gateResult = checkGateVerification({
          skillId,
          pMastery: masteryUpdate?.newPMastery ?? 0,
          timedAttempts,
          topErrorTagIds,
        });
        
        gateResults.push(gateResult);
        
        // If verified, persist the verification record
        if (gateResult.isVerified && masteryUpdate) {
          await db.execute(sql`
            INSERT INTO mastery_state (user_id, skill_id, is_verified, verified_at, p_mastery, stability)
            VALUES (
              ${user.id}::uuid, ${skillId}::uuid, true, NOW(),
              ${masteryUpdate.newPMastery}, ${masteryUpdate.newStability}
            )
            ON CONFLICT (user_id, skill_id)
            DO UPDATE SET
              is_verified = true,
              verified_at = NOW(),
              updated_at = NOW()
          `);
          console.log(`[GATE VERIFIED] User ${user.id} Skill ${skillId} — ${gateResult.timedPassCount} timed passes`);
        }
      }
    }

    // ========================================
    // STEP 5: STORE ATTEMPT RECORD
    // ========================================
    
    // Insert into attempts table
    const attemptResult = await db.execute(sql`
      INSERT INTO attempts (
        user_id, item_id, format, mode, 
        raw_answer_text, time_taken_sec, 
        score_norm, rubric_breakdown_json, feedback_json,
        selected_option, is_correct
      )
      VALUES (
        ${user.id}::uuid,
        ${submission.itemId}::uuid,
        ${submission.format},
        ${submission.mode},
        ${submission.format !== 'mcq' ? submission.response : null},
        ${submission.timeTakenSec},
        ${grading.scoreNorm},
        ${JSON.stringify(grading.rubricBreakdown)}::jsonb,
        ${JSON.stringify(grading)}::jsonb,
        ${submission.selectedOption ?? null},
        ${grading.scoreNorm >= 0.6}
      )
      RETURNING id
    `);
    
    const attemptId = (attemptResult.rows[0] as { id: string })?.id ?? `attempt-${Date.now()}`;
    console.log(`[ATTEMPT SAVED] User ${user.id} Item ${submission.itemId} Score ${(grading.scoreNorm * 100).toFixed(1)}%`);

    // ========================================
    // STEP 6: BUILD RESPONSE
    // ========================================
    
    const passed = grading.scoreNorm >= 0.6;
    const scorePercent = Math.round(grading.scoreNorm * 100);
    
    // Identify improvement areas from rubric breakdown
    const improvementAreas = grading.rubricBreakdown
      .filter((r: { score: number; maxScore: number }) => r.score < r.maxScore * 0.6)
      .map((r: { category: string }) => r.category);
    
    // Identify skills that need more work
    const nextRecommendedSkills = masteryUpdates
      .filter(u => u.newPMastery < 0.7)
      .map(u => u.skillId);

    const result: AttemptResult = {
      attemptId,
      grading,
      masteryUpdates,
      gateResults,
      summary: {
        passed,
        scorePercent,
        improvementAreas,
        nextRecommendedSkills,
        streakMaintained: await (async () => {
          try {
            const todayStr = new Date().toISOString().split('T')[0];
            // Upsert today's streak record (increment minutes by time taken)
            await db.execute(sql`
              INSERT INTO study_streaks (user_id, date, minutes_studied, sessions_count)
              VALUES (${user.id}::uuid, ${todayStr}::date, ${Math.ceil(submission.timeTakenSec / 60)}, 1)
              ON CONFLICT (user_id, date)
              DO UPDATE SET
                minutes_studied = study_streaks.minutes_studied + ${Math.ceil(submission.timeTakenSec / 60)},
                sessions_count = study_streaks.sessions_count + 1
            `);
            // Check if yesterday also had activity
            const yesterdayStr = new Date(Date.now() - 86400000).toISOString().split('T')[0];
            const yesterdayResult = await db.execute(sql`
              SELECT 1 FROM study_streaks
              WHERE user_id = ${user.id}::uuid AND date = ${yesterdayStr}::date AND minutes_studied > 0
            `);
            return yesterdayResult.rows.length > 0;
          } catch { return true; }
        })(),
      },
    };

    return NextResponse.json(result);

  } catch (error) {
    console.error('Error submitting attempt:', error);
    return NextResponse.json(
      { error: 'Failed to process attempt' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/mastery/attempt
 * Fetch attempt history with filters
 */
export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await verifyIdToken(token);
    
    const [user] = await db.select().from(users)
      .where(eq(users.firebaseUid, decodedToken.uid))
      .limit(1);

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const url = new URL(req.url);
    const skillId = url.searchParams.get('skillId');
    const unitId = url.searchParams.get('unitId');
    const format = url.searchParams.get('format');
    const limit = parseInt(url.searchParams.get('limit') ?? '20');
    
    // Query from attempts table with filters
    const attemptsResult = await db.execute(sql`
      SELECT 
        a.id,
        a.item_id,
        a.format,
        a.mode,
        a.score_norm,
        a.is_correct,
        a.time_taken_sec,
        a.created_at,
        i.prompt,
        i.unit_id
      FROM attempts a
      JOIN items i ON a.item_id = i.id
      WHERE a.user_id = ${user.id}::uuid
      ${skillId ? sql`AND a.item_id IN (SELECT item_id FROM item_skill_map WHERE skill_id = ${skillId}::uuid)` : sql``}
      ${unitId ? sql`AND i.unit_id = ${unitId}` : sql``}
      ${format ? sql`AND a.format = ${format}` : sql``}
      ORDER BY a.created_at DESC
      LIMIT ${limit}
    `);

    const attempts = attemptsResult.rows.map((r: any) => ({
      id: r.id,
      itemId: r.item_id,
      format: r.format,
      mode: r.mode,
      scorePercent: Math.round((parseFloat(r.score_norm) || 0) * 100),
      passed: r.is_correct,
      timeTakenSec: r.time_taken_sec,
      createdAt: r.created_at,
      prompt: r.prompt?.slice(0, 100) + '...',
      unitId: r.unit_id,
    }));
    
    return NextResponse.json({
      attempts,
      total: attempts.length,
      hasMore: attempts.length >= limit,
    });

  } catch (error) {
    console.error('Error fetching attempts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch attempts' },
      { status: 500 }
    );
  }
}

/**
 * Generate fallback grading when AI is unavailable
 */
function generateFallbackGrading(submission: AttemptSubmission): GradingOutput {
  // Very basic fallback - check response length and presence of key terms
  const responseLength = submission.response.length;
  const hasKeyPoints = submission.keyPoints?.some(kp => 
    submission.response.toLowerCase().includes(kp.toLowerCase().split(' ')[0])
  ) ?? false;
  
  // Rough scoring based on response quality indicators
  let scoreNorm = 0.3; // Base score
  if (responseLength > 200) scoreNorm += 0.1;
  if (responseLength > 500) scoreNorm += 0.1;
  if (responseLength > 1000) scoreNorm += 0.1;
  if (hasKeyPoints) scoreNorm += 0.2;
  
  scoreNorm = Math.min(0.8, scoreNorm); // Cap at 80% for fallback
  
  return {
    scoreNorm,
    scoreRaw: Math.round(scoreNorm * 100),
    maxScore: 100,
    rubricBreakdown: [
      {
        category: 'overall',
        score: Math.round(scoreNorm * 100),
        maxScore: 100,
        feedback: 'AI grading temporarily unavailable. Basic assessment provided.',
      },
    ],
    missingPoints: [],
    errorTags: [],
    nextDrills: submission.skillIds,
    modelOutline: submission.modelAnswer ?? 'Model answer not available.',
    evidenceRequests: [],
  };
}
