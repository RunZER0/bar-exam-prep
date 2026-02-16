/**
 * Remediation Engine
 * 
 * Automatically prescribes remediation when users fail gates or struggle with skills.
 * Implements "McGraw-Hill SmartBook" style learning paths.
 */

import { db } from '@/lib/db';
import {
  masteryState,
  skillErrorSignature,
  attempts,
  microSkills,
  errorTags,
} from '@/lib/db/mastery-schema';
import { eq, and, desc, gte, sql } from 'drizzle-orm';
import type { StudyActivityType, ActivityMixItem } from './generators/session-blueprint';

// ============================================
// TYPES
// ============================================

export interface RemediationPrescription {
  skillId: string;
  skillName: string;
  severity: 'mild' | 'moderate' | 'severe';
  reasons: string[];
  prescribedActivities: ActivityMixItem[];
  estimatedMinutes: number;
  focusAreas: string[];
  errorPatterns: ErrorPattern[];
}

export interface ErrorPattern {
  errorTagId: string;
  errorName: string;
  count30d: number;
  description?: string;
}

export interface SkillGateStatus {
  skillId: string;
  skillName: string;
  pMastery: number;
  memoryCheckPassing: boolean;
  quizPassing: boolean;
  issueSpotterPassing: boolean;
  drillPassing: boolean;
  overallPassing: boolean;
  failureReasons: string[];
}

// ============================================
// THRESHOLDS
// ============================================

export const GATE_THRESHOLDS = {
  // Minimum scores to pass each gate (scoreNorm 0-1)
  memoryCheck: 0.7,
  quiz: 0.6,
  issueSpotter: 0.5, // Lower because harder
  ruleDrill: 0.6,
  
  // Maximum consecutive failures before severe remediation
  maxConsecutiveFailures: 3,
  
  // pMastery thresholds
  weakSkillThreshold: 0.4,
  stableSkillThreshold: 0.7,
  
  // Error repeat threshold
  maxRepeatedErrors: 2,
};

// ============================================
// REMEDIATION ACTIVITY MIXES
// ============================================

const MILD_REMEDIATION_MIX: ActivityMixItem[] = [
  { activityType: 'READING_NOTES', count: 1, difficulty: 'medium' },
  { activityType: 'FLASHCARDS', count: 4, difficulty: 'easy' },
  { activityType: 'MEMORY_CHECK', count: 4, difficulty: 'easy' },
  { activityType: 'WRITTEN_QUIZ', count: 3, difficulty: 'easy' },
];

const MODERATE_REMEDIATION_MIX: ActivityMixItem[] = [
  { activityType: 'READING_NOTES', count: 1, difficulty: 'easy' },
  { activityType: 'FLASHCARDS', count: 6, difficulty: 'easy' },
  { activityType: 'MEMORY_CHECK', count: 6, difficulty: 'easy' },
  { activityType: 'RULE_ELEMENTS_DRILL', count: 4, difficulty: 'easy' },
  { activityType: 'ERROR_CORRECTION', count: 3, difficulty: 'medium' },
  { activityType: 'WRITTEN_QUIZ', count: 3, difficulty: 'easy' },
];

const SEVERE_REMEDIATION_MIX: ActivityMixItem[] = [
  { activityType: 'READING_NOTES', count: 2, difficulty: 'easy' },
  { activityType: 'FLASHCARDS', count: 8, difficulty: 'easy' },
  { activityType: 'MEMORY_CHECK', count: 8, difficulty: 'easy' },
  { activityType: 'RULE_ELEMENTS_DRILL', count: 6, difficulty: 'easy' },
  { activityType: 'ERROR_CORRECTION', count: 5, difficulty: 'easy' },
  { activityType: 'WRITTEN_QUIZ', count: 4, difficulty: 'easy' },
  // No issue spotter or essay until basics are solid
];

// ============================================
// MAIN FUNCTIONS
// ============================================

/**
 * Diagnose a user's skill and prescribe remediation if needed.
 */
export async function diagnoseAndPrescribe(
  userId: string,
  skillId: string
): Promise<RemediationPrescription | null> {
  // 1. Get current mastery state
  const [mState] = await db
    .select()
    .from(masteryState)
    .where(and(
      eq(masteryState.userId, userId),
      eq(masteryState.skillId, skillId)
    ))
    .limit(1);

  // 2. Get skill info
  const [skill] = await db
    .select()
    .from(microSkills)
    .where(eq(microSkills.id, skillId))
    .limit(1);

  if (!skill) {
    return null;
  }

  // 3. Get recent attempts for this skill's items
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const recentAttempts = await getRecentAttemptsForSkill(userId, skillId, thirtyDaysAgo);

  // 4. Get error patterns
  const errorPatterns = await getErrorPatterns(userId, skillId);

  // 5. Analyze gate status
  const gateStatus = analyzeGateStatus(recentAttempts, skill.name);

  // 6. Determine if remediation is needed
  const reasons: string[] = [];
  let severity: 'mild' | 'moderate' | 'severe' = 'mild';

  // Check pMastery
  const pMastery = mState?.pMastery ?? 0;
  if (pMastery < GATE_THRESHOLDS.weakSkillThreshold) {
    reasons.push(`Low mastery (${(pMastery * 100).toFixed(0)}%)`);
    severity = 'severe';
  } else if (pMastery < GATE_THRESHOLDS.stableSkillThreshold) {
    reasons.push(`Developing mastery (${(pMastery * 100).toFixed(0)}%)`);
    if (severity === 'mild') severity = 'moderate';
  }

  // Check gate failures
  if (!gateStatus.memoryCheckPassing) {
    reasons.push('Memory check below threshold');
    if (severity === 'mild') severity = 'moderate';
  }
  if (!gateStatus.quizPassing) {
    reasons.push('Quiz score below threshold');
    if (severity === 'mild') severity = 'moderate';
  }
  if (!gateStatus.drillPassing) {
    reasons.push('Rule drill score below threshold');
    if (severity === 'mild') severity = 'moderate';
  }

  // Check error patterns
  const repeatedErrors = errorPatterns.filter(e => e.count30d >= GATE_THRESHOLDS.maxRepeatedErrors);
  if (repeatedErrors.length > 0) {
    reasons.push(`${repeatedErrors.length} recurring error pattern(s)`);
    if (repeatedErrors.length >= 3) {
      severity = 'severe';
    } else if (severity === 'mild') {
      severity = 'moderate';
    }
  }

  // Check consecutive failures
  const consecutiveFailures = countConsecutiveFailures(recentAttempts);
  if (consecutiveFailures >= GATE_THRESHOLDS.maxConsecutiveFailures) {
    reasons.push(`${consecutiveFailures} consecutive failed attempts`);
    severity = 'severe';
  }

  // If no issues, no remediation needed
  if (reasons.length === 0) {
    return null;
  }

  // 7. Build prescription
  const prescribedActivities = selectRemediationMix(severity);
  const focusAreas = buildFocusAreas(gateStatus, errorPatterns);
  const estimatedMinutes = prescribedActivities.reduce((sum, a) => {
    const perItemMinutes = a.activityType === 'READING_NOTES' ? 10 :
      a.activityType === 'ESSAY_OUTLINE' ? 15 :
      a.activityType === 'ISSUE_SPOTTER' ? 10 : 3;
    return sum + (a.count * perItemMinutes);
  }, 0);

  return {
    skillId,
    skillName: skill.name,
    severity,
    reasons,
    prescribedActivities,
    estimatedMinutes,
    focusAreas,
    errorPatterns: repeatedErrors,
  };
}

/**
 * Check all skills for a user and return those needing remediation.
 */
export async function getRemediationNeeds(
  userId: string,
  unitId?: string
): Promise<RemediationPrescription[]> {
  // Get all skills for the user (with mastery state)
  let query = db
    .select({
      skillId: masteryState.skillId,
      pMastery: masteryState.pMastery,
    })
    .from(masteryState)
    .where(eq(masteryState.userId, userId));

  if (unitId) {
    query = db
      .select({
        skillId: masteryState.skillId,
        pMastery: masteryState.pMastery,
      })
      .from(masteryState)
      .innerJoin(microSkills, eq(masteryState.skillId, microSkills.id))
      .where(and(
        eq(masteryState.userId, userId),
        eq(microSkills.unitId, unitId)
      )) as any;
  }

  const skills = await query;
  const prescriptions: RemediationPrescription[] = [];

  for (const skill of skills) {
    // Only check weak/moderate skills
    if (skill.pMastery < GATE_THRESHOLDS.stableSkillThreshold) {
      const prescription = await diagnoseAndPrescribe(userId, skill.skillId);
      if (prescription) {
        prescriptions.push(prescription);
      }
    }
  }

  // Sort by severity (severe first)
  return prescriptions.sort((a, b) => {
    const severityOrder = { severe: 0, moderate: 1, mild: 2 };
    return severityOrder[a.severity] - severityOrder[b.severity];
  });
}

/**
 * Adjust a session's activity mix based on remediation needs.
 */
export function applyRemediationToMix(
  originalMix: ActivityMixItem[],
  prescription: RemediationPrescription
): ActivityMixItem[] {
  // If severe, replace with remediation mix entirely
  if (prescription.severity === 'severe') {
    return prescription.prescribedActivities;
  }

  // If moderate, blend original with remediation
  if (prescription.severity === 'moderate') {
    const blended = new Map<StudyActivityType, ActivityMixItem>();
    
    // Start with half the original
    for (const item of originalMix) {
      blended.set(item.activityType, {
        ...item,
        count: Math.ceil(item.count * 0.5),
        difficulty: 'easy', // Lower difficulty for struggling students
      });
    }
    
    // Add remediation activities
    for (const item of prescription.prescribedActivities) {
      if (blended.has(item.activityType)) {
        const existing = blended.get(item.activityType)!;
        blended.set(item.activityType, {
          ...existing,
          count: existing.count + Math.ceil(item.count * 0.5),
        });
      } else {
        blended.set(item.activityType, {
          ...item,
          count: Math.ceil(item.count * 0.5),
        });
      }
    }
    
    return Array.from(blended.values());
  }

  // Mild: just add some extra reinforcement
  const result = [...originalMix];
  
  // Add extra flashcards and memory checks
  const flashcardIndex = result.findIndex(a => a.activityType === 'FLASHCARDS');
  if (flashcardIndex >= 0) {
    result[flashcardIndex] = {
      ...result[flashcardIndex],
      count: result[flashcardIndex].count + 2,
      difficulty: 'easy',
    };
  } else {
    result.push({ activityType: 'FLASHCARDS', count: 4, difficulty: 'easy' });
  }
  
  return result;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

async function getRecentAttemptsForSkill(
  userId: string,
  skillId: string,
  since: Date
): Promise<{
  scoreNorm: number;
  mode: string;
  submittedAt: Date;
  itemType?: string;
}[]> {
  // Get items for this skill
  const items = await db
    .select({ itemId: sql<string>`item_id` })
    .from(sql`item_skill_map`)
    .where(eq(sql`skill_id`, skillId));

  if (items.length === 0) return [];

  const itemIds = items.map(i => i.itemId);

  const recentAttempts = await db
    .select({
      scoreNorm: attempts.scoreNorm,
      mode: attempts.mode,
      submittedAt: attempts.submittedAt,
    })
    .from(attempts)
    .where(and(
      eq(attempts.userId, userId),
      sql`${attempts.itemId} = ANY(${itemIds})`,
      gte(attempts.submittedAt, since)
    ))
    .orderBy(desc(attempts.submittedAt));

  return recentAttempts.map(a => ({
    scoreNorm: a.scoreNorm ?? 0,
    mode: a.mode ?? 'practice',
    submittedAt: a.submittedAt!,
  }));
}

async function getErrorPatterns(
  userId: string,
  skillId: string
): Promise<ErrorPattern[]> {
  const signatures = await db
    .select({
      errorTagId: skillErrorSignature.errorTagId,
      count30d: skillErrorSignature.count30d,
    })
    .from(skillErrorSignature)
    .where(and(
      eq(skillErrorSignature.userId, userId),
      eq(skillErrorSignature.skillId, skillId)
    ))
    .orderBy(desc(skillErrorSignature.count30d));

  // Get error tag names
  const errorTagIds = signatures.map(s => s.errorTagId);
  if (errorTagIds.length === 0) return [];

  const tags = await db
    .select({ id: errorTags.id, name: errorTags.name, description: errorTags.description })
    .from(errorTags)
    .where(sql`${errorTags.id} = ANY(${errorTagIds})`);

  const tagMap = new Map(tags.map(t => [t.id, t]));

  return signatures.map(s => ({
    errorTagId: s.errorTagId,
    errorName: tagMap.get(s.errorTagId)?.name || 'Unknown',
    count30d: s.count30d,
    description: tagMap.get(s.errorTagId)?.description || undefined,
  }));
}

function analyzeGateStatus(
  recentAttempts: { scoreNorm: number; mode: string }[],
  skillName: string
): SkillGateStatus {
  // Group by mode and calculate averages
  const practiceAttempts = recentAttempts.filter(a => a.mode === 'practice');
  const timedAttempts = recentAttempts.filter(a => a.mode === 'timed' || a.mode === 'exam_sim');

  const avgPractice = practiceAttempts.length > 0
    ? practiceAttempts.reduce((s, a) => s + a.scoreNorm, 0) / practiceAttempts.length
    : 0;

  const avgTimed = timedAttempts.length > 0
    ? timedAttempts.reduce((s, a) => s + a.scoreNorm, 0) / timedAttempts.length
    : 0;

  // For now, use combined average for different gate types
  // In production, we'd track by item type
  const avgScore = recentAttempts.length > 0
    ? recentAttempts.reduce((s, a) => s + a.scoreNorm, 0) / recentAttempts.length
    : 0;

  const failureReasons: string[] = [];

  const memoryCheckPassing = avgScore >= GATE_THRESHOLDS.memoryCheck;
  if (!memoryCheckPassing) failureReasons.push('Memory check avg below 70%');

  const quizPassing = avgScore >= GATE_THRESHOLDS.quiz;
  if (!quizPassing) failureReasons.push('Quiz avg below 60%');

  const issueSpotterPassing = avgTimed >= GATE_THRESHOLDS.issueSpotter;
  if (!issueSpotterPassing && timedAttempts.length > 0) {
    failureReasons.push('Issue spotter avg below 50%');
  }

  const drillPassing = avgScore >= GATE_THRESHOLDS.ruleDrill;
  if (!drillPassing) failureReasons.push('Rule drill avg below 60%');

  const overallPassing = memoryCheckPassing && quizPassing && drillPassing;

  return {
    skillId: '',
    skillName,
    pMastery: avgScore,
    memoryCheckPassing,
    quizPassing,
    issueSpotterPassing,
    drillPassing,
    overallPassing,
    failureReasons,
  };
}

function countConsecutiveFailures(
  attempts: { scoreNorm: number }[]
): number {
  let count = 0;
  for (const attempt of attempts) {
    if (attempt.scoreNorm < 0.6) {
      count++;
    } else {
      break;
    }
  }
  return count;
}

function selectRemediationMix(
  severity: 'mild' | 'moderate' | 'severe'
): ActivityMixItem[] {
  switch (severity) {
    case 'severe':
      return SEVERE_REMEDIATION_MIX;
    case 'moderate':
      return MODERATE_REMEDIATION_MIX;
    default:
      return MILD_REMEDIATION_MIX;
  }
}

function buildFocusAreas(
  gateStatus: SkillGateStatus,
  errorPatterns: ErrorPattern[]
): string[] {
  const areas: string[] = [];

  if (!gateStatus.memoryCheckPassing) {
    areas.push('Memorization and recall');
  }
  if (!gateStatus.quizPassing) {
    areas.push('Written comprehension');
  }
  if (!gateStatus.drillPassing) {
    areas.push('Rule element identification');
  }

  // Add top error pattern focus
  if (errorPatterns.length > 0) {
    areas.push(`Common error: ${errorPatterns[0].errorName}`);
  }

  return areas;
}

export default {
  diagnoseAndPrescribe,
  getRemediationNeeds,
  applyRemediationToMix,
  GATE_THRESHOLDS,
};
