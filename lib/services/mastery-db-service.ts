/**
 * Mastery DB Service
 * 
 * Wires the mastery-engine algorithms to the database.
 * Handles:
 * - Recording attempt results
 * - Updating mastery state
 * - Recomputing skill mastery
 * - Gate verification with DB persistence
 */

import { db } from '@/lib/db';
import {
  attempts,
  masteryState,
  skillVerifications,
  skillErrorSignature,
  attemptErrorTags,
  errorTags,
  microSkills,
} from '@/lib/db/mastery-schema';
import { users } from '@/lib/db/schema';
import { eq, and, desc, gte, sql } from 'drizzle-orm';
import {
  calculateMasteryDelta,
  updateMasteryWithCurrentState,
  checkGateVerification,
  determineExamPhase,
  MASTERY_CONFIG,
  type MasteryUpdateInput,
  type MasteryStateUpdate,
  type GateCheckResult,
} from './mastery-engine';

// ============================================
// TYPES
// ============================================

export interface MasteryUpdateEvent {
  userId: string;
  sessionId?: string;
  itemId: string;
  skillIds: string[];
  coverageWeights: Record<string, number>;
  scoreNorm: number;
  format: 'written' | 'oral' | 'drafting' | 'mcq';
  mode: 'practice' | 'timed' | 'exam_sim';
  difficulty: number;
  timeTakenSec: number;
  errorTagIds: string[];
  responseText?: string;
  feedback?: string;
  rubricBreakdownJson?: Record<string, any>;
  evidenceSpanIds?: string[];
}

export interface MasteryRecomputeResult {
  skillId: string;
  oldPMastery: number;
  newPMastery: number;
  delta: number;
  stability: number;
  nextReviewDate: Date;
  isVerified: boolean;
  gateResult?: GateCheckResult;
}

// ============================================
// RECORD ATTEMPT & UPDATE MASTERY
// ============================================

/**
 * Record an attempt and update mastery state for all affected skills.
 * This is the main entry point for processing user activity results.
 */
export async function recordAttemptAndUpdateMastery(
  event: MasteryUpdateEvent
): Promise<{
  attemptId: string;
  masteryUpdates: MasteryRecomputeResult[];
}> {
  // 1. Create the attempt record
  const [attemptRecord] = await db
    .insert(attempts)
    .values({
      userId: event.userId,
      itemId: event.itemId,
      format: event.format,
      mode: event.mode,
      scoreNorm: event.scoreNorm,
      timeTakenSec: event.timeTakenSec,
      rawAnswerText: event.responseText,
      feedbackJson: event.feedback ? { summary: event.feedback, strengths: [], weaknesses: [], nextSteps: [] } : undefined,
      rubricBreakdownJson: event.rubricBreakdownJson as { category: string; score: number; maxScore: number; feedback: string; evidenceSpans?: { start: number; end: number }[] }[] | undefined,
      sessionId: event.sessionId,
      startedAt: new Date(),
      submittedAt: new Date(),
      isComplete: true,
    })
    .returning();

  const attemptId = attemptRecord.id;

  // 2. Link error tags to attempt
  if (event.errorTagIds.length > 0) {
    await db.insert(attemptErrorTags).values(
      event.errorTagIds.map(errorTagId => ({
        attemptId,
        errorTagId,
        weight: 1.0, // Default weight
      }))
    );
  }

  // 3. Evidence spans are linked directly via attemptId on evidenceSpans table
  // (no junction table needed - evidenceSpans.attemptId references attempts.id)

  // 4. Update mastery for each skill
  const masteryUpdates: MasteryRecomputeResult[] = [];

  for (const skillId of event.skillIds) {
    const coverageWeight = event.coverageWeights[skillId] ?? 1.0;
    const result = await recomputeSkillMastery(
      event.userId,
      skillId,
      {
        scoreNorm: event.scoreNorm,
        format: event.format,
        mode: event.mode,
        difficulty: event.difficulty,
        coverageWeight,
        errorTagIds: event.errorTagIds,
        attemptId,
      }
    );
    masteryUpdates.push(result);
  }

  // 5. Update error signatures
  await updateErrorSignatures(event.userId, event.skillIds, event.errorTagIds);

  return { attemptId, masteryUpdates };
}

// ============================================
// RECOMPUTE SKILL MASTERY
// ============================================

/**
 * Recompute mastery for a specific skill based on new attempt data.
 * This:
 * 1. Gets current mastery state
 * 2. Calculates delta from attempt
 * 3. Updates mastery state in DB
 * 4. Checks gate verification
 * 5. Updates spaced repetition schedule
 */
export async function recomputeSkillMastery(
  userId: string,
  skillId: string,
  attemptData: {
    scoreNorm: number;
    format: 'written' | 'oral' | 'drafting' | 'mcq';
    mode: 'practice' | 'timed' | 'exam_sim';
    difficulty: number;
    coverageWeight: number;
    errorTagIds: string[];
    attemptId: string;
  }
): Promise<MasteryRecomputeResult> {
  // 1. Get or create current mastery state
  let [currentState] = await db
    .select()
    .from(masteryState)
    .where(and(
      eq(masteryState.userId, userId),
      eq(masteryState.skillId, skillId)
    ))
    .limit(1);

  if (!currentState) {
    // Create initial state
    const [newState] = await db
      .insert(masteryState)
      .values({
        userId,
        skillId,
        pMastery: 0,
        stability: 1.0,
        repsCount: 0,
        verifiedCount: 0,
        interval: 1,
        easinessFactor: 250,
      })
      .returning();
    currentState = newState;
  }

  // 2. Calculate mastery update
  const update = updateMasteryWithCurrentState(
    skillId,
    currentState.pMastery,
    currentState.stability,
    {
      scoreNorm: attemptData.scoreNorm,
      format: attemptData.format,
      mode: attemptData.mode,
      difficulty: attemptData.difficulty,
      coverageWeight: attemptData.coverageWeight,
    }
  );

  // 3. Calculate new spaced repetition interval
  const { interval, nextReviewDate, easinessFactor } = calculateSpacedInterval(
    currentState.interval,
    currentState.easinessFactor,
    attemptData.scoreNorm
  );

  // 4. Update mastery state in DB
  await db
    .update(masteryState)
    .set({
      pMastery: update.newPMastery,
      stability: update.newStability,
      lastPracticedAt: new Date(),
      lastExamLikeAt: attemptData.mode === 'timed' || attemptData.mode === 'exam_sim' 
        ? new Date() 
        : currentState.lastExamLikeAt,
      repsCount: (currentState.repsCount || 0) + 1,
      interval,
      easinessFactor,
      nextReviewDate: nextReviewDate.toISOString().split('T')[0], // date format
      updatedAt: new Date(),
    })
    .where(eq(masteryState.id, currentState.id));

  // 5. Check gate verification if in timed/exam mode
  let gateResult: GateCheckResult | undefined;
  let isVerified = currentState.isVerified;

  if (attemptData.mode === 'timed' || attemptData.mode === 'exam_sim') {
    gateResult = await checkGateVerificationWithDB(userId, skillId, update.newPMastery);
    
    if (gateResult.isVerified && !currentState.isVerified) {
      // Record new verification
      await db.insert(skillVerifications).values({
        userId,
        skillId,
        attemptId: attemptData.attemptId,
        pMasteryAtVerification: update.newPMastery,
        timedPassCount: gateResult.timedPassCount,
        hoursBetweenPasses: gateResult.hoursSinceFirstPass,
        errorTagsCleared: gateResult.errorTagsCleared ? [] : undefined, // Boolean flag, no specific tags tracked
        verifiedAt: new Date(),
      });

      // Update mastery state
      await db
        .update(masteryState)
        .set({
          isVerified: true,
          verifiedAt: new Date(),
          verifiedCount: (currentState.verifiedCount || 0) + 1,
        })
        .where(eq(masteryState.id, currentState.id));

      isVerified = true;
    }
  }

  return {
    skillId,
    oldPMastery: update.oldPMastery,
    newPMastery: update.newPMastery,
    delta: update.delta,
    stability: update.newStability,
    nextReviewDate,
    isVerified,
    gateResult,
  };
}

// ============================================
// GATE VERIFICATION WITH DB
// ============================================

/**
 * Check gate verification using DB data for attempts
 */
async function checkGateVerificationWithDB(
  userId: string,
  skillId: string,
  currentPMastery: number
): Promise<GateCheckResult> {
  // Get timed attempts for this skill in last 90 days
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  // Get items for this skill first
  const skillItems = await db
    .select({ itemId: sql<string>`item_id` })
    .from(sql`item_skill_map`)
    .where(eq(sql`skill_id`, skillId));

  const itemIds = skillItems.map(i => i.itemId);

  if (itemIds.length === 0) {
    return {
      skillId,
      isVerified: false,
      pMastery: currentPMastery,
      timedPassCount: 0,
      hoursSinceFirstPass: 0,
      errorTagsCleared: false,
      failureReasons: ['No items found for skill'],
    };
  }

  // Get timed attempts for these items
  const timedAttempts = await db
    .select({
      id: attempts.id,
      scoreNorm: attempts.scoreNorm,
      submittedAt: attempts.submittedAt,
    })
    .from(attempts)
    .where(and(
      eq(attempts.userId, userId),
      sql`${attempts.itemId} = ANY(${itemIds})`,
      sql`${attempts.mode} IN ('timed', 'exam_sim')`,
      gte(attempts.submittedAt, ninetyDaysAgo)
    ))
    .orderBy(attempts.submittedAt);

  // Get error tags for each attempt
  const attemptIds = timedAttempts.map(a => a.id);
  const errorTagsByAttempt = new Map<string, string[]>();

  if (attemptIds.length > 0) {
    const errorLinks = await db
      .select({
        attemptId: attemptErrorTags.attemptId,
        errorTagId: attemptErrorTags.errorTagId,
      })
      .from(attemptErrorTags)
      .where(sql`${attemptErrorTags.attemptId} = ANY(${attemptIds})`);

    for (const link of errorLinks) {
      if (!errorTagsByAttempt.has(link.attemptId)) {
        errorTagsByAttempt.set(link.attemptId, []);
      }
      errorTagsByAttempt.get(link.attemptId)!.push(link.errorTagId);
    }
  }

  // Get top 3 error tags for this skill
  const topErrors = await db
    .select({ errorTagId: skillErrorSignature.errorTagId })
    .from(skillErrorSignature)
    .where(and(
      eq(skillErrorSignature.userId, userId),
      eq(skillErrorSignature.skillId, skillId)
    ))
    .orderBy(desc(skillErrorSignature.countTotal))
    .limit(3);

  const topErrorTagIds = topErrors.map(e => e.errorTagId);

  // Convert to gate input format
  const gateInput = {
    skillId,
    pMastery: currentPMastery,
    timedAttempts: timedAttempts.map(a => ({
      attemptId: a.id,
      scoreNorm: a.scoreNorm!,
      submittedAt: a.submittedAt!,
      errorTagIds: errorTagsByAttempt.get(a.id) || [],
    })),
    topErrorTagIds,
  };

  return checkGateVerification(gateInput);
}

// ============================================
// ERROR SIGNATURE UPDATE
// ============================================

/**
 * Update error signatures based on attempt errors
 */
async function updateErrorSignatures(
  userId: string,
  skillIds: string[],
  errorTagIds: string[]
): Promise<void> {
  if (errorTagIds.length === 0) return;

  for (const skillId of skillIds) {
    for (const errorTagId of errorTagIds) {
      // Try to find existing signature
      const [existing] = await db
        .select()
        .from(skillErrorSignature)
        .where(and(
          eq(skillErrorSignature.userId, userId),
          eq(skillErrorSignature.skillId, skillId),
          eq(skillErrorSignature.errorTagId, errorTagId)
        ))
        .limit(1);

      if (existing) {
        // Update counts
        await db
          .update(skillErrorSignature)
          .set({
            count30d: existing.count30d + 1,
            count90d: existing.count90d + 1,
            countTotal: existing.countTotal + 1,
            lastSeenAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(skillErrorSignature.id, existing.id));
      } else {
        // Create new signature
        await db.insert(skillErrorSignature).values({
          userId,
          skillId,
          errorTagId,
          count30d: 1,
          count90d: 1,
          countTotal: 1,
          lastSeenAt: new Date(),
        });
      }
    }
  }
}

// ============================================
// SPACED REPETITION INTERVAL
// ============================================

/**
 * Calculate next review interval using SM-2 variant
 */
function calculateSpacedInterval(
  currentInterval: number,
  currentEasinessFactor: number, // Stored as integer × 100
  scoreNorm: number
): {
  interval: number;
  nextReviewDate: Date;
  easinessFactor: number;
} {
  // Convert quality to 0-5 scale (SM-2 uses 0-5)
  const quality = Math.round(scoreNorm * 5);
  
  // Convert EF from stored format
  let ef = currentEasinessFactor / 100;
  
  // Update EF based on quality
  ef = ef + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  ef = Math.max(1.3, ef); // Minimum EF
  
  let interval = currentInterval;
  
  if (quality < 3) {
    // Failed - reset interval
    interval = 1;
  } else {
    // Passed - increase interval
    if (currentInterval === 1) {
      interval = 6;
    } else {
      interval = Math.round(currentInterval * ef);
    }
  }
  
  // Cap interval at 180 days
  interval = Math.min(interval, 180);
  
  const nextReviewDate = new Date();
  nextReviewDate.setDate(nextReviewDate.getDate() + interval);
  
  return {
    interval,
    nextReviewDate,
    easinessFactor: Math.round(ef * 100),
  };
}

// ============================================
// GET USER MASTERY STATE
// ============================================

/**
 * Get mastery state for a user across all skills
 */
export async function getUserMasteryStates(
  userId: string,
  unitId?: string
): Promise<{
  skillId: string;
  skillName: string;
  unitId: string;
  pMastery: number;
  stability: number;
  isVerified: boolean;
  nextReviewDate: string | null;
  lastPracticedAt: Date | null;
  repsCount: number;
}[]> {
  const conditions = [eq(masteryState.userId, userId)];
  
  if (unitId) {
    conditions.push(eq(microSkills.unitId, unitId));
  }

  return db
    .select({
      skillId: masteryState.skillId,
      skillName: microSkills.name,
      unitId: microSkills.unitId,
      pMastery: masteryState.pMastery,
      stability: masteryState.stability,
      isVerified: masteryState.isVerified,
      nextReviewDate: masteryState.nextReviewDate,
      lastPracticedAt: masteryState.lastPracticedAt,
      repsCount: masteryState.repsCount,
    })
    .from(masteryState)
    .innerJoin(microSkills, eq(masteryState.skillId, microSkills.id))
    .where(and(...conditions));
}

/**
 * Get weak skills for a user (pMastery < 0.4 or consecutive wrong >= 3)
 */
export async function getWeakSkills(
  userId: string,
  threshold = 0.4
): Promise<string[]> {
  const weakSkills = await db
    .select({ skillId: masteryState.skillId })
    .from(masteryState)
    .where(and(
      eq(masteryState.userId, userId),
      sql`${masteryState.pMastery} < ${threshold}`
    ));

  return weakSkills.map(s => s.skillId);
}

/**
 * Get strong skills for a user (pMastery > 0.8)
 */
export async function getStrongSkills(
  userId: string,
  threshold = 0.8
): Promise<string[]> {
  const strongSkills = await db
    .select({ skillId: masteryState.skillId })
    .from(masteryState)
    .where(and(
      eq(masteryState.userId, userId),
      sql`${masteryState.pMastery} > ${threshold}`
    ));

  return strongSkills.map(s => s.skillId);
}

/**
 * Get skills due for review
 */
export async function getSkillsDueForReview(
  userId: string,
  limit = 10
): Promise<{
  skillId: string;
  skillName: string;
  pMastery: number;
  daysPastDue: number;
}[]> {
  const today = new Date().toISOString().split('T')[0];

  const dueSkills = await db
    .select({
      skillId: masteryState.skillId,
      skillName: microSkills.name,
      pMastery: masteryState.pMastery,
      nextReviewDate: masteryState.nextReviewDate,
    })
    .from(masteryState)
    .innerJoin(microSkills, eq(masteryState.skillId, microSkills.id))
    .where(and(
      eq(masteryState.userId, userId),
      sql`${masteryState.nextReviewDate} <= ${today}`
    ))
    .orderBy(masteryState.nextReviewDate)
    .limit(limit);

  return dueSkills.map(s => ({
    skillId: s.skillId,
    skillName: s.skillName,
    pMastery: s.pMastery,
    daysPastDue: s.nextReviewDate 
      ? Math.floor((new Date().getTime() - new Date(s.nextReviewDate).getTime()) / (1000 * 60 * 60 * 24))
      : 0,
  }));
}

export default {
  recordAttemptAndUpdateMastery,
  recomputeSkillMastery,
  getUserMasteryStates,
  getWeakSkills,
  getStrongSkills,
  getSkillsDueForReview,
};
