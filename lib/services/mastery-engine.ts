/**
 * YNAI Mastery Engine v3 - Core Services
 * 
 * This module implements the mastery update algorithm, gate verification,
 * and planner objective functions exactly as specified.
 */

// ============================================
// CONFIGURATION (All magic numbers here)
// ============================================

export const MASTERY_CONFIG = {
  // Learning rate for mastery updates
  learningRate: 0.15,
  
  // Delta clamping to prevent oscillation and inflation
  maxDeltaPositive: 0.10, // Max gain per attempt
  maxDeltaNegative: -0.12, // Max loss per attempt
  
  // Format weights (P4: orals and written are different engines)
  formatWeights: {
    oral: 1.35,
    drafting: 1.25,
    written: 1.15, // issue spotting
    mcq: 0.75,
    flashcard: 0.65,
  },
  
  // Mode weights (timed proof required for mastery)
  modeWeights: {
    exam_sim: 1.25,
    timed: 1.25,
    practice: 1.0,
  },
  
  // Difficulty factors
  difficultyFactors: {
    1: 0.6,  // Easy
    2: 0.8,
    3: 1.0,  // Medium
    4: 1.2,
    5: 1.4,  // Hard
  },
  
  // Stability decay/growth
  stabilityGrowth: 0.1,
  stabilityDecay: 0.15,
  minStability: 0.3,
  maxStability: 2.0,
  
  // Gate thresholds (P3: no mastery without timed proof)
  gates: {
    minPMastery: 0.85,
    requiredTimedPasses: 2,
    minHoursBetweenPasses: 24,
    errorTagClearance: true, // Top-3 errors must not repeat
  },
  
  // Planner weights (Section 8.3 objective function)
  plannerWeights: {
    learningGain: 0.35,
    retentionGain: 0.20,
    examRoi: 0.25,
    errorClosure: 0.15,
    burnoutPenalty: 0.05,
  },
  
  // Coverage requirements by exam phase (Section 8.2)
  // Note: 'approaching' covers 8-59 days
  coverageByPhase: {
    distant: { practiceReps: 2, timedReps: 0, mixedMocks: 0, daysStart: 60 },
    approaching: { practiceReps: 2, timedReps: 1, mixedMocks: 0, daysStart: 8 },
    critical: { practiceReps: 0, timedReps: 4, mixedMocks: 1, daysStart: 0 },
  },
  
  // Exam phase thresholds (days until exam)
  // Product spec: >= 60 = distant, 8-59 = approaching, 0-7 = critical
  phaseThresholds: {
    critical: 7,
    approaching: 59,  // 8-59 days
    distant: 60,      // >= 60 days
  },
};

// ============================================
// TYPES
// ============================================

export interface MasteryUpdateInput {
  userId: string;
  attemptId: string;
  itemId: string;
  skillIds: string[]; // Skills tested by this item (from item_skill_map)
  coverageWeights: Record<string, number>; // weight per skill
  scoreNorm: number; // 0-1
  format: 'written' | 'oral' | 'drafting' | 'mcq';
  mode: 'practice' | 'timed' | 'exam_sim';
  difficulty: number; // 1-5
  timeTakenSec: number;
  errorTagIds: string[];
}

export interface MasteryStateUpdate {
  skillId: string;
  oldPMastery: number;
  newPMastery: number;
  delta: number;
  oldStability: number;
  newStability: number;
  wasSuccess: boolean;
}

export interface GateCheckResult {
  skillId: string;
  isVerified: boolean;
  pMastery: number;
  timedPassCount: number;
  hoursSinceFirstPass: number;
  errorTagsCleared: boolean;
  failureReasons: string[];
}

export interface PlannerTaskScore {
  itemId: string;
  skillId: string;
  learningGain: number;
  retentionGain: number;
  examRoi: number;
  errorClosure: number;
  engagementProb: number;
  burnoutPenalty: number;
  totalScore: number;
}

export interface DailyPlanOutput {
  userId: string;
  date: string;
  totalMinutes: number;
  examPhase: 'distant' | 'approaching' | 'critical';
  tasks: {
    taskType: string;
    itemId: string | null;
    skillId: string;
    format: string;
    mode: string;
    title: string;
    description: string;
    estimatedMinutes: number;
    order: number;
    priorityScore: number;
    scoringFactors: PlannerTaskScore;
    rationale: string;
    whySelected: {
      contributor: string;
      value: number;
      explanation: string;
    }[];
  }[];
}

// ============================================
// 6. MASTERY UPDATE ALGORITHM
// (Implement exactly as specified in section 6)
// ============================================

/**
 * Calculate mastery delta for a single skill based on attempt
 */
export function calculateMasteryDelta(
  currentPMastery: number,
  scoreNorm: number,
  format: 'written' | 'oral' | 'drafting' | 'mcq',
  mode: 'practice' | 'timed' | 'exam_sim',
  difficulty: number,
  coverageWeight: number
): { delta: number; wasSuccess: boolean } {
  // P0: Evidence over vibes - use actual scores
  const attemptQuality = scoreNorm;
  
  // Format weight (P4: oral and written are different)
  const formatWeight = MASTERY_CONFIG.formatWeights[format] ?? 1.0;
  
  // Mode weight (P3: timed proof required)
  const modeWeight = MASTERY_CONFIG.modeWeights[mode] ?? 1.0;
  
  // Difficulty factor
  const difficultyFactor = MASTERY_CONFIG.difficultyFactors[difficulty as 1|2|3|4|5] ?? 1.0;
  
  // Delta calculation: (quality - 0.6) * weights
  // 0.6 is the "passing" threshold
  const rawDelta = (attemptQuality - 0.6) * formatWeight * modeWeight * difficultyFactor * coverageWeight;
  
  // Apply learning rate
  const unclampedDelta = MASTERY_CONFIG.learningRate * rawDelta;
  
  // Clamp delta to prevent oscillation and inflation (Section 6.2)
  const delta = Math.max(
    MASTERY_CONFIG.maxDeltaNegative,
    Math.min(MASTERY_CONFIG.maxDeltaPositive, unclampedDelta)
  );
  
  // Success if score >= 0.6
  const wasSuccess = scoreNorm >= 0.6;
  
  return { delta, wasSuccess };
}

/**
 * Update mastery state for all skills involved in an attempt
 * Returns array of updates for each skill
 */
export function computeMasteryUpdates(input: MasteryUpdateInput): MasteryStateUpdate[] {
  const updates: MasteryStateUpdate[] = [];
  
  for (const skillId of input.skillIds) {
    const coverageWeight = input.coverageWeights[skillId] ?? 1.0;
    
    // We need current state - this will be provided externally
    // For now, assume it's passed in or we default to 0
    const currentState = {
      pMastery: 0,
      stability: 1.0,
    };
    
    const { delta, wasSuccess } = calculateMasteryDelta(
      currentState.pMastery,
      input.scoreNorm,
      input.format,
      input.mode,
      input.difficulty,
      coverageWeight
    );
    
    // Clamp new mastery to [0, 1]
    const newPMastery = Math.max(0, Math.min(1, currentState.pMastery + delta));
    
    // Update stability
    let newStability = currentState.stability;
    if (wasSuccess) {
      // Increase stability on success
      newStability = Math.min(
        MASTERY_CONFIG.maxStability,
        currentState.stability + MASTERY_CONFIG.stabilityGrowth
      );
    } else {
      // Decrease stability on failure
      newStability = Math.max(
        MASTERY_CONFIG.minStability,
        currentState.stability - MASTERY_CONFIG.stabilityDecay
      );
    }
    
    updates.push({
      skillId,
      oldPMastery: currentState.pMastery,
      newPMastery,
      delta,
      oldStability: currentState.stability,
      newStability,
      wasSuccess,
    });
  }
  
  return updates;
}

/**
 * Update mastery state with actual current values
 */
export function updateMasteryWithCurrentState(
  skillId: string,
  currentPMastery: number,
  currentStability: number,
  input: {
    scoreNorm: number;
    format: 'written' | 'oral' | 'drafting' | 'mcq';
    mode: 'practice' | 'timed' | 'exam_sim';
    difficulty: number;
    coverageWeight: number;
  }
): MasteryStateUpdate {
  const { delta, wasSuccess } = calculateMasteryDelta(
    currentPMastery,
    input.scoreNorm,
    input.format,
    input.mode,
    input.difficulty,
    input.coverageWeight
  );
  
  const newPMastery = Math.max(0, Math.min(1, currentPMastery + delta));
  
  let newStability = currentStability;
  if (wasSuccess) {
    newStability = Math.min(
      MASTERY_CONFIG.maxStability,
      currentStability + MASTERY_CONFIG.stabilityGrowth
    );
  } else {
    newStability = Math.max(
      MASTERY_CONFIG.minStability,
      currentStability - MASTERY_CONFIG.stabilityDecay
    );
  }
  
  return {
    skillId,
    oldPMastery: currentPMastery,
    newPMastery,
    delta,
    oldStability: currentStability,
    newStability,
    wasSuccess,
  };
}

// ============================================
// 7. GATE VERIFICATION
// (Section 7: verification rules user cannot bypass)
// ============================================

export interface GateInput {
  skillId: string;
  pMastery: number;
  timedAttempts: {
    attemptId: string;
    scoreNorm: number;
    submittedAt: Date;
    errorTagIds: string[];
  }[];
  topErrorTagIds: string[]; // Top 3 error tags from history
}

/**
 * Check if a skill meets verification gate criteria
 * Gate criteria (Section 7.1):
 * - p_mastery >= 0.85
 * - 2 timed attempts passed
 * - 2 passes >= 24 hours apart
 * - No repeat of top-3 error tags in second pass
 */
export function checkGateVerification(input: GateInput): GateCheckResult {
  const failureReasons: string[] = [];
  const config = MASTERY_CONFIG.gates;
  
  // Check 1: p_mastery >= 0.85
  const meetsMinMastery = input.pMastery >= config.minPMastery;
  if (!meetsMinMastery) {
    failureReasons.push(`p_mastery ${(input.pMastery * 100).toFixed(1)}% below required ${config.minPMastery * 100}%`);
  }
  
  // Check 2: Find passing timed attempts (score >= 0.6)
  const passingAttempts = input.timedAttempts
    .filter(a => a.scoreNorm >= 0.6)
    .sort((a, b) => a.submittedAt.getTime() - b.submittedAt.getTime());
  
  const timedPassCount = passingAttempts.length;
  const meetsTimedPasses = timedPassCount >= config.requiredTimedPasses;
  if (!meetsTimedPasses) {
    failureReasons.push(`Only ${timedPassCount}/${config.requiredTimedPasses} timed passes`);
  }
  
  // Check 3: 24 hours between first and second pass
  let hoursBetweenPasses = 0;
  let meetsTimeGap = false;
  if (passingAttempts.length >= 2) {
    const first = passingAttempts[0].submittedAt;
    const second = passingAttempts[1].submittedAt;
    hoursBetweenPasses = (second.getTime() - first.getTime()) / (1000 * 60 * 60);
    meetsTimeGap = hoursBetweenPasses >= config.minHoursBetweenPasses;
    if (!meetsTimeGap) {
      failureReasons.push(`Only ${hoursBetweenPasses.toFixed(1)} hours between passes (need ${config.minHoursBetweenPasses})`);
    }
  }
  
  // Check 4: No repeat of top-3 error tags in second pass
  let errorTagsCleared = false;
  if (passingAttempts.length >= 2 && config.errorTagClearance) {
    const secondPassErrors = new Set(passingAttempts[1].errorTagIds);
    const topErrorsRepeated = input.topErrorTagIds.filter(id => secondPassErrors.has(id));
    errorTagsCleared = topErrorsRepeated.length === 0;
    if (!errorTagsCleared) {
      failureReasons.push(`Top error tags repeated in second pass: ${topErrorsRepeated.length}`);
    }
  }
  
  const isVerified = meetsMinMastery && meetsTimedPasses && meetsTimeGap && 
    (config.errorTagClearance ? errorTagsCleared : true);
  
  return {
    skillId: input.skillId,
    isVerified,
    pMastery: input.pMastery,
    timedPassCount,
    hoursSinceFirstPass: hoursBetweenPasses,
    errorTagsCleared,
    failureReasons,
  };
}

// ============================================
// 8. PLANNER OBJECTIVE FUNCTION
// (Section 8.3: scoring for task prioritization)
// ============================================

export interface PlannerInput {
  userId: string;
  timeBudgetMinutes: number;
  examPhase: 'distant' | 'approaching' | 'critical';
  daysUntilWritten: number;
  daysUntilOral: number;
  
  // User state
  masteryStates: Map<string, {
    skillId: string;
    pMastery: number;
    stability: number;
    lastPracticedAt: Date | null;
    nextReviewDate: Date | null;
    isVerified: boolean;
  }>;
  
  // Coverage debt
  coverageDebts: Map<string, {
    skillId: string;
    debtScore: number; // Higher = more urgent
    completedPractice: number;
    requiredPractice: number;
    completedTimed: number;
    requiredTimed: number;
  }>;
  
  // Error signatures (recurring errors)
  errorSignatures: Map<string, {
    skillId: string;
    errorTagId: string;
    count30d: number;
  }>;
  
  // Skill metadata
  skills: Map<string, {
    skillId: string;
    name: string;
    unitId: string;
    examWeight: number;
    difficulty: number;
    formatTags: string[];
    isCore: boolean;
  }>;
  
  // Available items per skill
  availableItems: Map<string, {
    itemId: string;
    skillId: string;
    itemType: string;
    difficulty: number;
    estimatedMinutes: number;
  }[]>;
  
  // Recent activities (for burnout detection)
  recentActivities: {
    skillId: string;
    itemType: string;
    timestamp: Date;
    minutes: number;
  }[];
}

/**
 * Determine exam phase based on days until exam
 */
export function determineExamPhase(daysUntilWritten: number): 'distant' | 'approaching' | 'critical' {
  const thresholds = MASTERY_CONFIG.phaseThresholds;
  // Product spec: >= 60 = distant, 8-59 = approaching, 0-7 = critical
  if (daysUntilWritten <= thresholds.critical) return 'critical';
  if (daysUntilWritten < thresholds.distant) return 'approaching';
  return 'distant';
}

/**
 * Calculate learning gain score for a task
 * Higher for low mastery + high quality format
 */
export function calculateLearningGain(
  pMastery: number,
  format: string,
  difficulty: number,
  examWeight: number
): number {
  // Learning gain is higher when mastery is low
  const masteryGap = 1 - pMastery;
  
  // Format quality boost
  const formatBoost = format === 'oral' ? 1.35 : 
    format === 'drafting' ? 1.25 : 
    format === 'written' ? 1.15 : 1.0;
  
  // Difficulty adjustment
  const difficultyBoost = difficulty >= 4 ? 1.2 : difficulty >= 3 ? 1.0 : 0.8;
  
  return masteryGap * formatBoost * difficultyBoost * examWeight;
}

/**
 * Calculate retention gain (spaced repetition urgency)
 */
export function calculateRetentionGain(
  lastPracticedAt: Date | null,
  nextReviewDate: Date | null,
  stability: number
): number {
  const now = new Date();
  
  // If never practiced, high urgency
  if (!lastPracticedAt) return 1.0;
  
  // If review is overdue, high urgency
  if (nextReviewDate) {
    const daysOverdue = (now.getTime() - new Date(nextReviewDate).getTime()) / (1000 * 60 * 60 * 24);
    if (daysOverdue > 0) {
      return Math.min(1.0, 0.5 + daysOverdue * 0.1);
    }
  }
  
  // Calculate forgetting based on time and stability
  const daysSincePractice = (now.getTime() - lastPracticedAt.getTime()) / (1000 * 60 * 60 * 24);
  const forgetCurve = 1 - Math.exp(-daysSincePractice / (stability * 5));
  
  return forgetCurve;
}

/**
 * Calculate exam ROI (weight × proximity urgency)
 */
export function calculateExamRoi(
  examWeight: number,
  daysUntilExam: number,
  isCore: boolean
): number {
  // Proximity multiplier (closer = higher urgency)
  let proximityMult = 1.0;
  if (daysUntilExam <= 7) proximityMult = 2.0;
  else if (daysUntilExam <= 14) proximityMult = 1.5;
  else if (daysUntilExam <= 30) proximityMult = 1.2;
  
  // Core skills get boost
  const coreBoost = isCore ? 1.3 : 1.0;
  
  return examWeight * proximityMult * coreBoost;
}

/**
 * Calculate error closure score (targets recurring errors)
 */
export function calculateErrorClosure(
  skillId: string,
  errorSignatures: Map<string, { skillId: string; errorTagId: string; count30d: number }>
): number {
  let errorScore = 0;
  
  for (const [, sig] of errorSignatures) {
    if (sig.skillId === skillId && sig.count30d > 0) {
      // More recent errors = higher priority
      errorScore += Math.min(0.5, sig.count30d * 0.1);
    }
  }
  
  return Math.min(1.0, errorScore);
}

/**
 * Calculate burnout penalty
 */
export function calculateBurnoutPenalty(
  skillId: string,
  itemType: string,
  recentActivities: { skillId: string; itemType: string; timestamp: Date; minutes: number }[]
): number {
  const now = new Date();
  const last24h = recentActivities.filter(a => 
    now.getTime() - a.timestamp.getTime() < 24 * 60 * 60 * 1000
  );
  
  // Penalty for doing same skill recently
  const sameSkillMinutes = last24h
    .filter(a => a.skillId === skillId)
    .reduce((sum, a) => sum + a.minutes, 0);
  
  // Penalty for doing same activity type
  const sameTypeCount = last24h.filter(a => a.itemType === itemType).length;
  
  const skillPenalty = Math.min(0.5, sameSkillMinutes / 60 * 0.2);
  const typePenalty = Math.min(0.3, sameTypeCount * 0.1);
  
  return skillPenalty + typePenalty;
}

/**
 * Score a candidate task using the objective function
 * Score = 0.35*learning + 0.20*retention + 0.25*examRoi + 0.15*errorClosure - 0.05*burnout
 */
export function scoreTask(
  skillId: string,
  itemId: string,
  itemType: string,
  format: string,
  difficulty: number,
  estimatedMinutes: number,
  input: PlannerInput
): PlannerTaskScore {
  const weights = MASTERY_CONFIG.plannerWeights;
  
  const mastery = input.masteryStates.get(skillId);
  const skill = input.skills.get(skillId);
  
  if (!skill) {
    return {
      itemId,
      skillId,
      learningGain: 0,
      retentionGain: 0,
      examRoi: 0,
      errorClosure: 0,
      engagementProb: 0.5,
      burnoutPenalty: 0,
      totalScore: 0,
    };
  }
  
  const learningGain = calculateLearningGain(
    mastery?.pMastery ?? 0,
    format,
    difficulty,
    skill.examWeight
  );
  
  const retentionGain = calculateRetentionGain(
    mastery?.lastPracticedAt ?? null,
    mastery?.nextReviewDate ?? null,
    mastery?.stability ?? 1.0
  );
  
  const examRoi = calculateExamRoi(
    skill.examWeight,
    input.daysUntilWritten,
    skill.isCore
  );
  
  const errorClosure = calculateErrorClosure(skillId, input.errorSignatures);
  
  const burnoutPenalty = calculateBurnoutPenalty(
    skillId,
    itemType,
    input.recentActivities
  );
  
  // Engagement probability (can be learned later, static for now)
  const engagementProb = 0.7;
  
  const totalScore = 
    weights.learningGain * learningGain +
    weights.retentionGain * retentionGain +
    weights.examRoi * examRoi +
    weights.errorClosure * errorClosure -
    weights.burnoutPenalty * burnoutPenalty;
  
  return {
    itemId,
    skillId,
    learningGain,
    retentionGain,
    examRoi,
    errorClosure,
    engagementProb,
    burnoutPenalty,
    totalScore,
  };
}

/**
 * Generate daily plan - the heart of the system
 * Outputs a sequence of tasks with item_ids, not vague topics
 */
export function generateDailyPlan(input: PlannerInput): DailyPlanOutput {
  const tasks: DailyPlanOutput['tasks'] = [];
  let remainingMinutes = input.timeBudgetMinutes;
  let order = 1;
  
  // Phase 1: SM-2 review cards due (10-15 min max)
  const reviewMinutes = Math.min(15, remainingMinutes * 0.2);
  // (Would pull from spaced rep cards due today)
  
  // Phase 2: Score all available tasks
  const scoredTasks: Array<{
    itemId: string;
    skillId: string;
    itemType: string;
    format: string;
    estimatedMinutes: number;
    score: PlannerTaskScore;
  }> = [];
  
  for (const [skillId, items] of input.availableItems) {
    for (const item of items) {
      const skill = input.skills.get(skillId);
      const format = skill?.formatTags[0] ?? 'written';
      
      const score = scoreTask(
        skillId,
        item.itemId,
        item.itemType,
        format,
        item.difficulty,
        item.estimatedMinutes,
        input
      );
      
      scoredTasks.push({
        itemId: item.itemId,
        skillId,
        itemType: item.itemType,
        format,
        estimatedMinutes: item.estimatedMinutes,
        score,
      });
    }
  }
  
  // Sort by total score descending
  scoredTasks.sort((a, b) => b.score.totalScore - a.score.totalScore);
  
  // Phase 3: Fill the time budget
  const selectedSkills = new Set<string>();
  
  for (const task of scoredTasks) {
    if (remainingMinutes < task.estimatedMinutes) continue;
    
    // Avoid overloading same skill (max 2 items per skill per day)
    const skillCount = tasks.filter(t => t.skillId === task.skillId).length;
    if (skillCount >= 2) continue;
    
    const skill = input.skills.get(task.skillId);
    const mastery = input.masteryStates.get(task.skillId);
    
    // Determine mode based on exam phase and mastery
    let mode: 'practice' | 'timed' | 'exam_sim' = 'practice';
    if (input.examPhase === 'critical') {
      mode = 'timed';
    } else if (mastery && mastery.pMastery >= 0.7) {
      mode = 'timed'; // Push to verification
    }
    
    // Determine task type
    let taskType = 'weakness_drill';
    if (mastery && mastery.pMastery >= 0.85 && !mastery.isVerified) {
      taskType = 'timed_proof';
      mode = 'timed';
    } else if (task.score.retentionGain > 0.6) {
      taskType = 'sm2_review';
    } else if (task.score.errorClosure > 0.3) {
      taskType = 'error_remediation';
    }
    
    const rationale = buildRationale(task.score, input.examPhase);
    
    // Build whySelected - top 3 contributors to this task's score
    const whySelected = buildWhySelected(
      task.score,
      mastery ? { pMastery: mastery.pMastery, lastPracticedAt: mastery.lastPracticedAt } : undefined,
      skill ? { examWeight: skill.examWeight, name: skill.name } : undefined,
      input.daysUntilWritten
    );
    
    tasks.push({
      taskType,
      itemId: task.itemId,
      skillId: task.skillId,
      format: task.format,
      mode,
      title: `${task.itemType.replace('_', ' ').toUpperCase()}: ${skill?.name ?? 'Unknown'}`,
      description: `Practice ${skill?.name} with a ${task.itemType} exercise`,
      estimatedMinutes: task.estimatedMinutes,
      order,
      priorityScore: task.score.totalScore,
      scoringFactors: task.score,
      rationale,
      whySelected,
    });
    
    remainingMinutes -= task.estimatedMinutes;
    selectedSkills.add(task.skillId);
    order++;
    
    // Stop at 6 tasks max
    if (tasks.length >= 6) break;
  }
  
  return {
    userId: input.userId,
    date: new Date().toISOString().split('T')[0],
    totalMinutes: input.timeBudgetMinutes - remainingMinutes,
    examPhase: input.examPhase,
    tasks,
  };
}

/**
 * Build human-readable rationale for a task
 */
function buildRationale(score: PlannerTaskScore, phase: string): string {
  const reasons: string[] = [];
  
  if (score.learningGain > 0.5) {
    reasons.push('High learning potential (low current mastery)');
  }
  if (score.retentionGain > 0.5) {
    reasons.push('Due for review (retention at risk)');
  }
  if (score.examRoi > 0.5) {
    reasons.push('High exam weight + exam approaching');
  }
  if (score.errorClosure > 0.3) {
    reasons.push('Targets recurring error patterns');
  }
  
  if (reasons.length === 0) {
    reasons.push('Balanced practice to maintain skills');
  }
  
  return reasons.join('. ') + '.';
}

/**
 * Build whySelected - top 3 contributors to task score
 * This is the key explainability feature for planner decisions
 */
function buildWhySelected(
  score: PlannerTaskScore,
  mastery: { pMastery: number; lastPracticedAt: Date | null } | undefined,
  skill: { examWeight: number; name: string } | undefined,
  daysUntilExam: number
): { contributor: string; value: number; explanation: string }[] {
  const weights = MASTERY_CONFIG.plannerWeights;
  
  // Calculate weighted contributions
  const contributions: { contributor: string; value: number; explanation: string }[] = [
    {
      contributor: 'learning_gain',
      value: score.learningGain * weights.learningGain,
      explanation: mastery && mastery.pMastery < 0.5 
        ? `Low mastery (${(mastery.pMastery * 100).toFixed(0)}%) - high learning potential`
        : `Current mastery ${((mastery?.pMastery ?? 0) * 100).toFixed(0)}%`,
    },
    {
      contributor: 'retention_risk',
      value: score.retentionGain * weights.retentionGain,
      explanation: mastery?.lastPracticedAt 
        ? `Last practiced ${Math.round((Date.now() - mastery.lastPracticedAt.getTime()) / (1000 * 60 * 60 * 24))} days ago`
        : 'Never practiced before',
    },
    {
      contributor: 'exam_roi',
      value: score.examRoi * weights.examRoi,
      explanation: `Exam weight ${((skill?.examWeight ?? 0) * 100).toFixed(0)}%, ${daysUntilExam} days until exam`,
    },
    {
      contributor: 'error_patterns',
      value: score.errorClosure * weights.errorClosure,
      explanation: score.errorClosure > 0 
        ? `Targets ${Math.round(score.errorClosure * 10)} recurring error pattern(s)`
        : 'No recurring error patterns',
    },
    {
      contributor: 'burnout_penalty',
      value: -score.burnoutPenalty * weights.burnoutPenalty,
      explanation: score.burnoutPenalty > 0.3 
        ? 'Recent heavy practice on this skill'
        : 'Fresh topic for today',
    },
  ];
  
  // Sort by absolute contribution value and take top 3
  contributions.sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
  
  return contributions.slice(0, 3);
}

// ============================================
// GRADING SCHEMA TYPES
// (Section 5.1: structured grading output)
// ============================================

export interface GradingOutput {
  scoreNorm: number; // 0-1
  scoreRaw: number;
  maxScore: number;
  rubricBreakdown: {
    category: string;
    score: number;
    maxScore: number;
    feedback: string;
    missingPoints?: string[];
    evidenceSpans?: { start: number; end: number }[];
  }[];
  missingPoints: string[];
  errorTags: string[]; // Error tag codes
  nextDrills: string[]; // Skill IDs
  modelOutline: string;
  evidenceRequests: string[]; // Sources used
}

/**
 * Written grading rubric dimensions (Section 5.2)
 */
export const WRITTEN_RUBRIC_DIMENSIONS = [
  { category: 'issue_spotting', weight: 0.25, description: 'Identification of legal issues' },
  { category: 'rule_accuracy', weight: 0.25, description: 'Correct statement of legal rules with citations' },
  { category: 'application', weight: 0.25, description: 'Application of rules to facts (IRAC)' },
  { category: 'remedies', weight: 0.10, description: 'Identification of appropriate remedies/prayers' },
  { category: 'structure', weight: 0.10, description: 'Logical organization and clarity' },
  { category: 'authority_use', weight: 0.05, description: 'Proper citation of authorities' },
];

/**
 * Oral grading rubric dimensions (Section 5.3)
 */
export const ORAL_RUBRIC_DIMENSIONS = [
  { category: 'issue_identification', weight: 0.20, description: 'Identification of legal issues' },
  { category: 'rule_accuracy', weight: 0.20, description: 'Correct statement of law' },
  { category: 'procedure_sequencing', weight: 0.20, description: 'Correct procedural steps' },
  { category: 'clarity_confidence', weight: 0.20, description: 'Clear, confident delivery' },
  { category: 'followup_handling', weight: 0.20, description: 'Response to follow-up questions' },
];

/**
 * Drafting grading rubric dimensions (Section 5.4)
 */
export const DRAFTING_RUBRIC_DIMENSIONS = [
  { category: 'form_compliance', weight: 0.20, description: 'Correct document format' },
  { category: 'clause_completeness', weight: 0.25, description: 'All required clauses present' },
  { category: 'parties_capacity', weight: 0.15, description: 'Correct party descriptions and capacity' },
  { category: 'execution', weight: 0.15, description: 'Proper execution/attestation clauses' },
  { category: 'internal_consistency', weight: 0.15, description: 'No contradictions within document' },
  { category: 'kenyan_conventions', weight: 0.10, description: 'Kenyan-specific requirements' },
];
