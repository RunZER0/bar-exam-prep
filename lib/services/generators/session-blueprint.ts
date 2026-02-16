/**
 * Session Blueprint: Single source of truth for session generation
 * 
 * Defines what activities a session should produce and how they should be mixed.
 */

// ============================================
// TYPES
// ============================================

export type StudyActivityType =
  | 'READING_NOTES'
  | 'MEMORY_CHECK'
  | 'FLASHCARDS'
  | 'WRITTEN_QUIZ'
  | 'ISSUE_SPOTTER'
  | 'RULE_ELEMENTS_DRILL'
  | 'ESSAY_OUTLINE'
  | 'FULL_ESSAY'
  | 'PAST_PAPER_STYLE'
  | 'ERROR_CORRECTION'
  | 'MIXED_REVIEW';

export type SessionFocus = 'RULES' | 'APPLICATION' | 'MIXED';

export interface ActivityMixItem {
  activityType: StudyActivityType;
  count: number;
  difficulty?: 'easy' | 'medium' | 'hard';
}

export interface SessionBlueprint {
  sessionId: string;
  userId: string;
  targetSkillIds: string[];
  minutes: number;
  activityMix: ActivityMixItem[];
  focus: SessionFocus;
  phase: 'distant' | 'approaching' | 'critical';
  skillMastery: {
    skillId: string;
    pMastery: number;
    consecutiveWrong: number;
  }[];
}

// ============================================
// DEFAULT ACTIVITY MIXES BY SESSION LENGTH
// ============================================

const DEFAULT_MIX_45_MINUTES: ActivityMixItem[] = [
  // NOTES asset: 1 READING_NOTES with 3-6 sections
  { activityType: 'READING_NOTES', count: 1, difficulty: 'medium' },
  
  // CHECKPOINT asset: MEMORY_CHECK + FLASHCARDS
  { activityType: 'MEMORY_CHECK', count: 6, difficulty: 'medium' },
  { activityType: 'FLASHCARDS', count: 6, difficulty: 'easy' },
  
  // PRACTICE_SET asset: WRITTEN_QUIZ + ISSUE_SPOTTER + RULE_ELEMENTS_DRILL
  { activityType: 'WRITTEN_QUIZ', count: 6, difficulty: 'medium' },
  { activityType: 'ISSUE_SPOTTER', count: 1, difficulty: 'hard' },
  { activityType: 'RULE_ELEMENTS_DRILL', count: 4, difficulty: 'medium' },
];

const DEFAULT_MIX_30_MINUTES: ActivityMixItem[] = [
  { activityType: 'READING_NOTES', count: 1, difficulty: 'medium' },
  { activityType: 'MEMORY_CHECK', count: 4, difficulty: 'medium' },
  { activityType: 'FLASHCARDS', count: 4, difficulty: 'easy' },
  { activityType: 'WRITTEN_QUIZ', count: 4, difficulty: 'medium' },
  { activityType: 'RULE_ELEMENTS_DRILL', count: 3, difficulty: 'medium' },
];

const DEFAULT_MIX_60_MINUTES: ActivityMixItem[] = [
  { activityType: 'READING_NOTES', count: 1, difficulty: 'medium' },
  { activityType: 'MEMORY_CHECK', count: 8, difficulty: 'medium' },
  { activityType: 'FLASHCARDS', count: 8, difficulty: 'easy' },
  { activityType: 'WRITTEN_QUIZ', count: 8, difficulty: 'medium' },
  { activityType: 'ISSUE_SPOTTER', count: 2, difficulty: 'hard' },
  { activityType: 'RULE_ELEMENTS_DRILL', count: 5, difficulty: 'medium' },
  { activityType: 'ESSAY_OUTLINE', count: 1, difficulty: 'hard' },
];

// ============================================
// WEAK SKILL ADJUSTMENTS
// ============================================

const WEAK_SKILL_MIX: ActivityMixItem[] = [
  { activityType: 'READING_NOTES', count: 1, difficulty: 'easy' },
  { activityType: 'MEMORY_CHECK', count: 4, difficulty: 'easy' },
  { activityType: 'FLASHCARDS', count: 8, difficulty: 'easy' },
  { activityType: 'RULE_ELEMENTS_DRILL', count: 6, difficulty: 'easy' },
  { activityType: 'ERROR_CORRECTION', count: 3, difficulty: 'medium' },
  { activityType: 'WRITTEN_QUIZ', count: 3, difficulty: 'easy' },
];

// ============================================
// STRONG SKILL ADJUSTMENTS
// ============================================

const STRONG_SKILL_MIX: ActivityMixItem[] = [
  { activityType: 'READING_NOTES', count: 1, difficulty: 'hard' },
  { activityType: 'MEMORY_CHECK', count: 4, difficulty: 'hard' },
  { activityType: 'ISSUE_SPOTTER', count: 2, difficulty: 'hard' },
  { activityType: 'WRITTEN_QUIZ', count: 6, difficulty: 'hard' },
  { activityType: 'ESSAY_OUTLINE', count: 1, difficulty: 'hard' },
  { activityType: 'PAST_PAPER_STYLE', count: 1, difficulty: 'hard' },
];

// ============================================
// GATE DEFINITIONS
// ============================================

export interface GateDefinition {
  id: string;
  name: string;
  description: string;
  requiredActivities: StudyActivityType[];
  passingCriteria: {
    minScore: number; // 0-1 normalized score
    minAttempts?: number;
    maxConsecutiveWrong?: number;
  };
  blocksActivities: StudyActivityType[];
}

export const SKILL_GATES: GateDefinition[] = [
  {
    id: 'memory_gate',
    name: 'Memory Check Gate',
    description: 'Must demonstrate basic recall before progressing',
    requiredActivities: ['MEMORY_CHECK'],
    passingCriteria: {
      minScore: 0.7,
      minAttempts: 3,
      maxConsecutiveWrong: 2,
    },
    blocksActivities: ['WRITTEN_QUIZ', 'ISSUE_SPOTTER', 'ESSAY_OUTLINE', 'PAST_PAPER_STYLE'],
  },
  {
    id: 'quiz_gate',
    name: 'Written Quiz Gate',
    description: 'Must pass basic quiz before advanced application',
    requiredActivities: ['WRITTEN_QUIZ', 'RULE_ELEMENTS_DRILL'],
    passingCriteria: {
      minScore: 0.6,
      minAttempts: 2,
      maxConsecutiveWrong: 3,
    },
    blocksActivities: ['ISSUE_SPOTTER', 'ESSAY_OUTLINE', 'PAST_PAPER_STYLE'],
  },
  {
    id: 'application_gate',
    name: 'Application Gate',
    description: 'Must demonstrate issue spotting before essay writing',
    requiredActivities: ['ISSUE_SPOTTER'],
    passingCriteria: {
      minScore: 0.5,
      minAttempts: 1,
      maxConsecutiveWrong: 2,
    },
    blocksActivities: ['FULL_ESSAY', 'PAST_PAPER_STYLE'],
  },
];

export interface GateEvaluationResult {
  gateId: string;
  isPassed: boolean;
  currentScore: number;
  attemptsCount: number;
  consecutiveWrong: number;
  blockedActivities: StudyActivityType[];
  recommendation?: string;
}

/**
 * Evaluate if a user passes a gate for a skill
 */
export function evaluateGate(
  gate: GateDefinition,
  skillMastery: { pMastery: number; consecutiveWrong: number; repsCount?: number }
): GateEvaluationResult {
  const { passingCriteria } = gate;
  
  const currentScore = skillMastery.pMastery;
  const attemptsCount = skillMastery.repsCount ?? 0;
  const consecutiveWrong = skillMastery.consecutiveWrong;
  
  // Check all criteria
  const meetsScore = currentScore >= passingCriteria.minScore;
  const meetsAttempts = !passingCriteria.minAttempts || attemptsCount >= passingCriteria.minAttempts;
  const withinWrongLimit = !passingCriteria.maxConsecutiveWrong || 
    consecutiveWrong <= passingCriteria.maxConsecutiveWrong;
  
  const isPassed = meetsScore && meetsAttempts && withinWrongLimit;
  
  let recommendation: string | undefined;
  if (!isPassed) {
    if (!meetsScore) {
      recommendation = `Score ${(currentScore * 100).toFixed(0)}% is below ${(passingCriteria.minScore * 100).toFixed(0)}% threshold`;
    } else if (!meetsAttempts) {
      recommendation = `Need ${passingCriteria.minAttempts! - attemptsCount} more attempts`;
    } else if (!withinWrongLimit) {
      recommendation = 'Too many consecutive wrong answers - review the material';
    }
  }
  
  return {
    gateId: gate.id,
    isPassed,
    currentScore,
    attemptsCount,
    consecutiveWrong,
    blockedActivities: isPassed ? [] : gate.blocksActivities,
    recommendation,
  };
}

/**
 * Get all blocked activities for a skill based on gates
 */
export function getBlockedActivities(
  skillMastery: { pMastery: number; consecutiveWrong: number; repsCount?: number }
): {
  blockedActivities: StudyActivityType[];
  gateResults: GateEvaluationResult[];
} {
  const gateResults: GateEvaluationResult[] = [];
  const blockedActivities = new Set<StudyActivityType>();
  
  for (const gate of SKILL_GATES) {
    const result = evaluateGate(gate, skillMastery);
    gateResults.push(result);
    
    if (!result.isPassed) {
      result.blockedActivities.forEach(a => blockedActivities.add(a));
    }
  }
  
  return {
    blockedActivities: Array.from(blockedActivities),
    gateResults,
  };
}

/**
 * Filter activity mix to remove blocked activities
 */
export function filterBlockedActivities(
  activityMix: ActivityMixItem[],
  skillMastery: { pMastery: number; consecutiveWrong: number; repsCount?: number }[]
): {
  filteredMix: ActivityMixItem[];
  removedActivities: StudyActivityType[];
  gateResults: GateEvaluationResult[];
} {
  // Evaluate gates for each skill and collect blocked activities
  const allGateResults: GateEvaluationResult[] = [];
  const allBlocked = new Set<StudyActivityType>();
  
  for (const mastery of skillMastery) {
    const { blockedActivities, gateResults } = getBlockedActivities(mastery);
    gateResults.forEach(r => allGateResults.push(r));
    blockedActivities.forEach(a => allBlocked.add(a));
  }
  
  // Filter the activity mix
  const removedActivities: StudyActivityType[] = [];
  const filteredMix = activityMix.filter(item => {
    if (allBlocked.has(item.activityType)) {
      removedActivities.push(item.activityType);
      return false;
    }
    return true;
  });
  
  return {
    filteredMix,
    removedActivities,
    gateResults: allGateResults,
  };
}

// ============================================
// MAIN FUNCTION: COMPUTE ACTIVITY MIX
// ============================================

export interface ComputeMixOptions {
  sessionId: string;
  userId: string;
  targetSkillIds: string[];
  minutes: number;
  phase: 'distant' | 'approaching' | 'critical';
  skillMastery?: { skillId: string; pMastery: number; consecutiveWrong: number; repsCount?: number }[];
  plannerRecommendations?: ActivityMixItem[];
  enforceGates?: boolean; // Default true
}

/**
 * Compute the activity mix for a session
 * 
 * Priority:
 * 1. If planner recommendations exist, use them
 * 2. If skill is weak (p_mastery < 0.4 or consecutiveWrong >= 3), use weak mix
 * 3. If skill is strong (p_mastery > 0.8), use strong mix
 * 4. Otherwise, use default mix based on minutes
 * 5. Apply gate enforcement to block activities user hasn't unlocked
 */
export function computeDefaultActivityMix(
  options: ComputeMixOptions
): SessionBlueprint & { gateResults?: GateEvaluationResult[]; removedActivities?: StudyActivityType[] } {
  const {
    sessionId,
    userId,
    targetSkillIds,
    minutes,
    phase,
    skillMastery = [],
    plannerRecommendations,
    enforceGates = true,
  } = options;

  // Helper to apply gate enforcement to a blueprint
  const applyGateEnforcement = (
    blueprint: SessionBlueprint
  ): SessionBlueprint & { gateResults?: GateEvaluationResult[]; removedActivities?: StudyActivityType[] } => {
    if (!enforceGates || skillMastery.length === 0) {
      return blueprint;
    }

    const { filteredMix, removedActivities, gateResults } = filterBlockedActivities(
      blueprint.activityMix,
      skillMastery
    );

    // If we removed activities, add more of the allowed ones to compensate
    const compensatedMix = compensateForRemovedActivities(filteredMix, removedActivities, minutes);

    return {
      ...blueprint,
      activityMix: compensatedMix,
      gateResults,
      removedActivities,
    };
  };

  // Priority 1: Planner recommendations
  if (plannerRecommendations && plannerRecommendations.length > 0) {
    return applyGateEnforcement({
      sessionId,
      userId,
      targetSkillIds,
      minutes,
      activityMix: plannerRecommendations,
      focus: determineFocus(plannerRecommendations),
      phase,
      skillMastery,
    });
  }

  // Check if any skill is weak
  const isWeak = skillMastery.some(
    s => s.pMastery < 0.4 || s.consecutiveWrong >= 3
  );

  // Check if all skills are strong
  const isStrong = skillMastery.length > 0 && 
    skillMastery.every(s => s.pMastery > 0.8);

  // Priority 2: Weak skill mix
  if (isWeak) {
    return applyGateEnforcement({
      sessionId,
      userId,
      targetSkillIds,
      minutes,
      activityMix: adjustMixForDuration(WEAK_SKILL_MIX, minutes),
      focus: 'RULES',
      phase,
      skillMastery,
    });
  }

  // Priority 3: Strong skill mix
  if (isStrong) {
    return applyGateEnforcement({
      sessionId,
      userId,
      targetSkillIds,
      minutes,
      activityMix: adjustMixForDuration(STRONG_SKILL_MIX, minutes),
      focus: 'APPLICATION',
      phase,
      skillMastery,
    });
  }

  // Priority 4: Default mix based on duration
  let baseMix: ActivityMixItem[];
  if (minutes <= 35) {
    baseMix = DEFAULT_MIX_30_MINUTES;
  } else if (minutes <= 50) {
    baseMix = DEFAULT_MIX_45_MINUTES;
  } else {
    baseMix = DEFAULT_MIX_60_MINUTES;
  }

  // Apply phase adjustments
  const adjustedMix = applyPhaseAdjustments(baseMix, phase);

  return applyGateEnforcement({
    sessionId,
    userId,
    targetSkillIds,
    minutes,
    activityMix: adjustedMix,
    focus: 'MIXED',
    phase,
    skillMastery,
  });
}

/**
 * Compensate for removed activities by adding more of allowed ones
 */
function compensateForRemovedActivities(
  filteredMix: ActivityMixItem[],
  removedActivities: StudyActivityType[],
  _minutes: number
): ActivityMixItem[] {
  if (removedActivities.length === 0) return filteredMix;

  // Calculate how many items were removed
  const removedCount = removedActivities.length;
  
  // Add extra items to compensate
  return filteredMix.map(item => {
    // Add extra to foundational activities when advanced ones are blocked
    if (['MEMORY_CHECK', 'FLASHCARDS', 'RULE_ELEMENTS_DRILL'].includes(item.activityType)) {
      return {
        ...item,
        count: item.count + Math.ceil(removedCount / 3),
      };
    }
    return item;
  });
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function determineFocus(mix: ActivityMixItem[]): SessionFocus {
  const hasApplication = mix.some(
    m => ['ISSUE_SPOTTER', 'ESSAY_OUTLINE', 'FULL_ESSAY', 'PAST_PAPER_STYLE'].includes(m.activityType)
  );
  const hasRules = mix.some(
    m => ['RULE_ELEMENTS_DRILL', 'MEMORY_CHECK', 'FLASHCARDS'].includes(m.activityType)
  );

  if (hasApplication && hasRules) return 'MIXED';
  if (hasApplication) return 'APPLICATION';
  return 'RULES';
}

function adjustMixForDuration(mix: ActivityMixItem[], minutes: number): ActivityMixItem[] {
  const factor = minutes / 45; // 45 minutes is baseline

  return mix.map(item => ({
    ...item,
    count: Math.max(1, Math.round(item.count * factor)),
  }));
}

function applyPhaseAdjustments(
  mix: ActivityMixItem[],
  phase: 'distant' | 'approaching' | 'critical'
): ActivityMixItem[] {
  if (phase === 'critical') {
    // In critical phase: more practice, less reading
    return mix.map(item => {
      if (item.activityType === 'READING_NOTES') {
        return { ...item, count: 1 }; // Keep notes minimal
      }
      if (['WRITTEN_QUIZ', 'ISSUE_SPOTTER', 'PAST_PAPER_STYLE'].includes(item.activityType)) {
        return { ...item, count: Math.ceil(item.count * 1.5) };
      }
      return item;
    });
  }

  if (phase === 'approaching') {
    // In approaching phase: balanced, add ESSAY_OUTLINE if not present
    const hasEssay = mix.some(m => m.activityType === 'ESSAY_OUTLINE');
    if (!hasEssay) {
      return [
        ...mix,
        { activityType: 'ESSAY_OUTLINE', count: 1, difficulty: 'medium' },
      ];
    }
  }

  return mix;
}

// ============================================
// UTILITY: GET ACTIVITY TYPES FOR ASSET TYPE
// ============================================

export function getActivityTypesForAsset(
  assetType: 'NOTES' | 'CHECKPOINT' | 'PRACTICE_SET' | 'RUBRIC',
  activityMix: ActivityMixItem[]
): StudyActivityType[] {
  switch (assetType) {
    case 'NOTES':
      return activityMix
        .filter(m => m.activityType === 'READING_NOTES')
        .map(m => m.activityType);

    case 'CHECKPOINT':
      return activityMix
        .filter(m => ['MEMORY_CHECK', 'FLASHCARDS'].includes(m.activityType))
        .map(m => m.activityType);

    case 'PRACTICE_SET':
      return activityMix
        .filter(m => ['WRITTEN_QUIZ', 'ISSUE_SPOTTER', 'RULE_ELEMENTS_DRILL', 
                       'ESSAY_OUTLINE', 'FULL_ESSAY', 'PAST_PAPER_STYLE', 
                       'ERROR_CORRECTION', 'MIXED_REVIEW'].includes(m.activityType))
        .map(m => m.activityType);

    case 'RUBRIC':
      // Rubric inherits activity types from PRACTICE_SET
      return activityMix
        .filter(m => ['WRITTEN_QUIZ', 'ISSUE_SPOTTER', 'ESSAY_OUTLINE', 
                       'FULL_ESSAY', 'PAST_PAPER_STYLE'].includes(m.activityType))
        .map(m => m.activityType);

    default:
      return [];
  }
}

// ============================================
// UTILITY: COUNT ITEMS FOR ASSET TYPE
// ============================================

export function getItemCountsForAsset(
  assetType: 'NOTES' | 'CHECKPOINT' | 'PRACTICE_SET' | 'RUBRIC',
  activityMix: ActivityMixItem[]
): Map<StudyActivityType, { count: number; difficulty?: 'easy' | 'medium' | 'hard' }> {
  const result = new Map<StudyActivityType, { count: number; difficulty?: 'easy' | 'medium' | 'hard' }>();
  
  const relevantTypes = getActivityTypesForAsset(assetType, activityMix);
  
  for (const item of activityMix) {
    if (relevantTypes.includes(item.activityType)) {
      result.set(item.activityType, { 
        count: item.count, 
        difficulty: item.difficulty,
      });
    }
  }
  
  return result;
}

export default {
  computeDefaultActivityMix,
  getActivityTypesForAsset,
  getItemCountsForAsset,
  // Gate exports
  SKILL_GATES,
  evaluateGate,
  getBlockedActivities,
  filterBlockedActivities,
};
