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
import { eq } from 'drizzle-orm';
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

// ============================================
// TYPES
// ============================================

interface AttemptSubmission {
  itemId: string;
  format: 'written' | 'oral' | 'drafting' | 'mcq';
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
    } else {
      // AI-powered grading for written/oral/drafting
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
        // TODO: Add retrieval of relevant lectures and authorities
        // relevantLectureChunks: await retrieveLectureChunks(submission.skillIds),
        // relevantAuthorities: await retrieveAuthorities(submission.skillIds),
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
      
      // TODO: Fetch current mastery state from DB
      // For now, use defaults
      const currentPMastery = 0.3;
      const currentStability = 1.0;
      
      const update = updateMasteryWithCurrentState(
        skillId,
        currentPMastery,
        currentStability,
        {
          scoreNorm: grading.scoreNorm,
          format: submission.format,
          mode: submission.mode,
          difficulty: submission.difficulty,
          coverageWeight,
        }
      );
      
      masteryUpdates.push(update);
      
      // TODO: Persist to database
      // await db.update(masteryState)
      //   .set({
      //     pMastery: update.newPMastery,
      //     stability: update.newStability,
      //     lastPracticedAt: new Date(),
      //     lastExamLikeAt: submission.mode !== 'practice' ? new Date() : undefined,
      //     repsCount: sql`reps_count + 1`,
      //   })
      //   .where(and(
      //     eq(masteryState.userId, user.id),
      //     eq(masteryState.skillId, skillId)
      //   ));
    }

    // ========================================
    // STEP 3: UPDATE ERROR SIGNATURES
    // ========================================
    
    // TODO: For each error tag in grading.errorTags:
    // - Look up or create error tag ID
    // - Increment count in skill_error_signature table
    // for (const errorCode of grading.errorTags) {
    //   await updateErrorSignature(user.id, submission.skillIds, errorCode);
    // }

    // ========================================
    // STEP 4: CHECK GATE VERIFICATION
    // ========================================
    
    const gateResults: GateCheckResult[] = [];
    
    if (submission.mode !== 'practice') {
      for (const skillId of submission.skillIds) {
        // TODO: Fetch timed attempts history from DB
        const mockTimedAttempts: { attemptId: string; scoreNorm: number; submittedAt: Date; errorTagIds: string[] }[] = [
          {
            attemptId: 'prev-1',
            scoreNorm: 0.75,
            submittedAt: new Date(Date.now() - 48 * 60 * 60 * 1000), // 48 hours ago
            errorTagIds: [] as string[],
          },
        ];
        
        // Add current attempt if it's a pass
        if (grading.scoreNorm >= 0.6) {
          mockTimedAttempts.push({
            attemptId: 'current',
            scoreNorm: grading.scoreNorm,
            submittedAt: new Date(),
            errorTagIds: grading.errorTags,
          });
        }
        
        const masteryUpdate = masteryUpdates.find(u => u.skillId === skillId);
        
        const gateResult = checkGateVerification({
          skillId,
          pMastery: masteryUpdate?.newPMastery ?? 0,
          timedAttempts: mockTimedAttempts,
          topErrorTagIds: [], // TODO: Fetch from history
        });
        
        gateResults.push(gateResult);
        
        // TODO: If verified, create verification record
        // if (gateResult.isVerified) {
        //   await db.insert(skillVerifications).values({
        //     userId: user.id,
        //     skillId,
        //     attemptId: newAttemptId,
        //     pMasteryAtVerification: masteryUpdate.newPMastery,
        //     timedPassCount: gateResult.timedPassCount,
        //     hoursBetweenPasses: gateResult.hoursSinceFirstPass,
        //     verifiedAt: new Date(),
        //   });
        // }
      }
    }

    // ========================================
    // STEP 5: STORE ATTEMPT RECORD
    // ========================================
    
    const attemptId = `attempt-${Date.now()}`; // TODO: Use UUID from DB insert
    
    // TODO: Insert into attempts table
    // const [newAttempt] = await db.insert(attempts).values({
    //   userId: user.id,
    //   itemId: submission.itemId,
    //   mode: submission.mode,
    //   format: submission.format,
    //   startedAt: new Date(submission.startedAt),
    //   submittedAt: new Date(),
    //   timeTakenSec: submission.timeTakenSec,
    //   rawAnswerText: submission.format !== 'mcq' ? submission.response : null,
    //   scoreNorm: grading.scoreNorm,
    //   scoreRaw: grading.scoreRaw,
    //   maxScore: grading.maxScore,
    //   rubricBreakdownJson: grading.rubricBreakdown,
    //   feedbackJson: grading,
    //   errorTagIds: grading.errorTags,
    //   nextDrillSkillIds: grading.nextDrills,
    //   isComplete: true,
    //   isGraded: true,
    //   gradedAt: new Date(),
    // }).returning();

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
        streakMaintained: true, // TODO: Check actual streak
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
    
    // TODO: Query from attempts table with filters
    // const attempts = await db.select()
    //   .from(attempts)
    //   .where(and(
    //     eq(attempts.userId, user.id),
    //     skillId ? sql`${attempts.itemId} IN (SELECT item_id FROM item_skill_map WHERE skill_id = ${skillId})` : undefined,
    //   ))
    //   .orderBy(desc(attempts.createdAt))
    //   .limit(limit);

    // Mock response for now
    return NextResponse.json({
      attempts: [],
      total: 0,
      hasMore: false,
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
