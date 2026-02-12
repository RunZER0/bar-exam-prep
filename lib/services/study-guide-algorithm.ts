/**
 * Intelligent Study Guide Algorithm v1
 * 
 * A sophisticated decision engine that determines what the user should do next.
 * Uses weighted scoring across multiple factors to generate personalized recommendations.
 * 
 * Key principles:
 * 1. Weakness Priority - Focus more on weak areas but don't neglect strong ones
 * 2. Activity Balance - Vary between study, quiz, drafting, research to prevent burnout
 * 3. Spaced Repetition - Integrate review cycles for long-term retention
 * 4. Exam Proximity - Intensify and change focus as exam approaches
 * 5. Time Optimization - Consider user's current time of day and patterns
 * 6. Streak Protection - Encourage continuation of study streaks
 * 7. Adaptive Difficulty - Match challenge level to current mastery
 */

import { ATP_UNITS } from '@/lib/constants/legal-content';

// ============================================
// TYPES
// ============================================

export type ActivityType = 'quiz' | 'study' | 'drafting' | 'research' | 'review' | 'case_study' | 'exam';

export interface UserStudyState {
  userId: string;
  // Performance metrics
  overallAccuracy: number; // 0-100
  totalQuizzes: number;
  totalQuestionsAnswered: number;
  // Unit-specific performance
  unitPerformance: Map<string, {
    accuracy: number;
    questionsAnswered: number;
    lastStudied: Date | null;
    lastQuizDate: Date | null;
    recentTrend: 'improving' | 'stable' | 'declining';
  }>;
  // Activity history
  recentActivities: Array<{
    type: ActivityType;
    unitId: string | null;
    timestamp: Date;
    durationMinutes: number;
  }>;
  // User preferences and context
  preferredStudyTime: 'morning' | 'afternoon' | 'evening' | 'flexible';
  dailyStudyGoal: number; // minutes
  studyStreak: number;
  minutesStudiedToday: number;
  // Exam info
  targetExamDate: Date | null;
  daysUntilExam: number | null;
  // Learning profile
  weakUnits: string[];
  strongUnits: string[];
  currentLevel: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  // Spaced repetition
  cardsReviewDueCount: number;
  lastReviewDate: Date | null;
}

export interface StudyRecommendation {
  activityType: ActivityType;
  unitId: string | null;
  unitName: string | null;
  title: string;
  description: string;
  rationale: string;
  priority: number;
  urgencyScore: number;
  estimatedMinutes: number;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  targetHref: string;
  decisionFactors: DecisionFactors;
}

export interface DecisionFactors {
  performanceWeight: number;
  recencyWeight: number;
  spacedRepWeight: number;
  weaknessWeight: number;
  examProximityWeight: number;
  streakWeight: number;
  activityBalanceWeight: number;
  timeOfDayWeight: number;
}

interface ScoredActivity {
  type: ActivityType;
  unitId: string | null;
  score: number;
  factors: DecisionFactors;
  metadata: Record<string, any>;
}

// ============================================
// CONSTANTS & WEIGHTS
// ============================================

const ALGORITHM_VERSION = 'v1';

// Base weights for each factor (0-1, sum should conceptually represent overall importance)
const BASE_WEIGHTS = {
  performance: 0.20,      // How well user is doing in the area
  recency: 0.15,          // How recently they studied
  spacedRep: 0.15,        // Spaced repetition needs
  weakness: 0.20,         // Priority to weak areas
  examProximity: 0.10,    // How close to exam
  streak: 0.05,           // Streak maintenance
  activityBalance: 0.10,  // Variety in activities
  timeOfDay: 0.05,        // Time-based optimization
};

// Activity type base weights (preference when other factors equal)
const ACTIVITY_BASE_WEIGHTS: Record<ActivityType, number> = {
  quiz: 0.25,       // Testing is critical
  study: 0.20,      // Content learning
  review: 0.15,     // Spaced repetition
  case_study: 0.15, // Deep understanding
  drafting: 0.10,   // Practical skills
  research: 0.10,   // Applied learning
  exam: 0.05,       // Full simulations (less frequent)
};

// Exam proximity modifiers (days until exam -> weight adjustments)
const EXAM_PROXIMITY_MODIFIERS = {
  critical: { days: 7, quizMod: 1.8, examMod: 2.5, studyMod: 0.6, reviewMod: 1.5 },
  urgent: { days: 14, quizMod: 1.5, examMod: 2.0, studyMod: 0.8, reviewMod: 1.3 },
  approaching: { days: 30, quizMod: 1.3, examMod: 1.5, studyMod: 0.9, reviewMod: 1.2 },
  comfortable: { days: 60, quizMod: 1.0, examMod: 1.0, studyMod: 1.0, reviewMod: 1.0 },
  distant: { days: Infinity, quizMod: 0.9, examMod: 0.5, studyMod: 1.2, reviewMod: 0.9 },
};

// Time of day optimal activities
const TIME_OF_DAY_PREFERENCES: Record<string, Record<ActivityType, number>> = {
  morning: { study: 1.3, case_study: 1.2, quiz: 1.1, review: 1.0, drafting: 0.9, research: 0.8, exam: 1.4 },
  afternoon: { quiz: 1.2, study: 1.0, drafting: 1.2, research: 1.1, case_study: 1.0, review: 0.9, exam: 1.0 },
  evening: { review: 1.3, quiz: 1.1, study: 0.9, research: 1.0, drafting: 1.0, case_study: 0.8, exam: 0.7 },
  night: { review: 1.4, quiz: 0.9, study: 0.7, research: 0.8, drafting: 0.7, case_study: 0.6, exam: 0.5 },
};

// Unit importance weights (high-exam-weight subjects get priority)
const UNIT_IMPORTANCE: Record<string, number> = {
  'atp-100': 1.5,  // Civil Litigation - very important
  'atp-101': 1.5,  // Criminal Litigation - very important
  'atp-102': 1.0,  // Probate
  'atp-103': 1.3,  // Legal Writing & Drafting
  'atp-104': 1.3,  // Trial Advocacy
  'atp-105': 1.4,  // Professional Ethics - critical
  'atp-106': 0.8,  // Legal Practice Management
  'atp-107': 1.1,  // Conveyancing
  'atp-108': 0.9,  // Commercial Transactions
};

// ============================================
// SCORING FUNCTIONS
// ============================================

/**
 * Calculate performance-based score for a unit
 * Low performance = higher score (needs more attention)
 */
function calculatePerformanceScore(
  accuracy: number | null,
  questionsAnswered: number,
  isWeakUnit: boolean
): number {
  if (questionsAnswered === 0) {
    // Never studied - high priority
    return 0.9;
  }
  
  const acc = accuracy ?? 0;
  
  // Invert accuracy - lower accuracy = higher need
  let score = 1 - (acc / 100);
  
  // Boost score for officially marked weak units
  if (isWeakUnit) {
    score = Math.min(1, score * 1.3);
  }
  
  // Minimum attention threshold even for high performers
  if (questionsAnswered < 20) {
    score = Math.max(0.3, score);
  }
  
  return score;
}

/**
 * Calculate recency score - how urgently unit needs attention
 * Longer since last study = higher score
 */
function calculateRecencyScore(lastStudied: Date | null): number {
  if (!lastStudied) {
    return 1.0; // Never studied - maximum urgency
  }
  
  const daysSinceStudy = Math.floor(
    (Date.now() - lastStudied.getTime()) / (1000 * 60 * 60 * 24)
  );
  
  // Sigmoid-like curve: urgency increases with time but caps
  if (daysSinceStudy <= 1) return 0.1;
  if (daysSinceStudy <= 3) return 0.3;
  if (daysSinceStudy <= 7) return 0.5;
  if (daysSinceStudy <= 14) return 0.7;
  if (daysSinceStudy <= 30) return 0.85;
  return 1.0;
}

/**
 * Calculate spaced repetition urgency
 */
function calculateSpacedRepScore(
  cardsReviewDueCount: number,
  lastReviewDate: Date | null
): number {
  if (cardsReviewDueCount === 0) {
    return 0.1; // No urgent reviews
  }
  
  // More cards due = higher urgency
  const cardUrgency = Math.min(1, cardsReviewDueCount / 20);
  
  // Time since last review also matters
  let timeUrgency = 0.5;
  if (lastReviewDate) {
    const daysSinceReview = Math.floor(
      (Date.now() - lastReviewDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    timeUrgency = Math.min(1, daysSinceReview / 3);
  }
  
  return (cardUrgency * 0.7) + (timeUrgency * 0.3);
}

/**
 * Calculate exam proximity modifier
 */
function getExamProximityModifiers(daysUntilExam: number | null): typeof EXAM_PROXIMITY_MODIFIERS.distant {
  if (daysUntilExam === null) {
    return EXAM_PROXIMITY_MODIFIERS.distant;
  }
  
  if (daysUntilExam <= EXAM_PROXIMITY_MODIFIERS.critical.days) {
    return EXAM_PROXIMITY_MODIFIERS.critical;
  }
  if (daysUntilExam <= EXAM_PROXIMITY_MODIFIERS.urgent.days) {
    return EXAM_PROXIMITY_MODIFIERS.urgent;
  }
  if (daysUntilExam <= EXAM_PROXIMITY_MODIFIERS.approaching.days) {
    return EXAM_PROXIMITY_MODIFIERS.approaching;
  }
  if (daysUntilExam <= EXAM_PROXIMITY_MODIFIERS.comfortable.days) {
    return EXAM_PROXIMITY_MODIFIERS.comfortable;
  }
  return EXAM_PROXIMITY_MODIFIERS.distant;
}

/**
 * Calculate activity balance score
 * Encourages variety - higher score for less-recent activity types
 */
function calculateActivityBalanceScore(
  activityType: ActivityType,
  recentActivities: UserStudyState['recentActivities']
): number {
  if (recentActivities.length === 0) {
    return 0.5; // Neutral
  }
  
  // Count recent occurrences of this activity type
  const last7Days = recentActivities.filter(a => {
    const daysSince = Math.floor(
      (Date.now() - a.timestamp.getTime()) / (1000 * 60 * 60 * 24)
    );
    return daysSince <= 7;
  });
  
  const occurrences = last7Days.filter(a => a.type === activityType).length;
  const totalActivities = last7Days.length;
  
  if (totalActivities === 0) return 0.5;
  
  // Calculate expected proportion based on base weights
  const expectedProportion = ACTIVITY_BASE_WEIGHTS[activityType];
  const actualProportion = occurrences / totalActivities;
  
  // If under-represented, boost score
  if (actualProportion < expectedProportion * 0.5) {
    return 0.9;
  }
  if (actualProportion < expectedProportion) {
    return 0.7;
  }
  // If over-represented, reduce score
  if (actualProportion > expectedProportion * 1.5) {
    return 0.2;
  }
  
  return 0.5;
}

/**
 * Calculate time of day preference score
 */
function calculateTimeOfDayScore(activityType: ActivityType): number {
  const hour = new Date().getHours();
  let timeOfDay: string;
  
  if (hour >= 5 && hour < 12) timeOfDay = 'morning';
  else if (hour >= 12 && hour < 17) timeOfDay = 'afternoon';
  else if (hour >= 17 && hour < 21) timeOfDay = 'evening';
  else timeOfDay = 'night';
  
  return TIME_OF_DAY_PREFERENCES[timeOfDay][activityType] ?? 1.0;
}

/**
 * Calculate streak protection score
 * If user has a streak and hasn't studied today, boost urgency
 */
function calculateStreakScore(
  studyStreak: number,
  minutesStudiedToday: number,
  dailyStudyGoal: number
): number {
  // No streak to protect
  if (studyStreak <= 1) {
    return 0.3;
  }
  
  // Already met goal today
  if (minutesStudiedToday >= dailyStudyGoal) {
    return 0.1;
  }
  
  // Streak at risk - higher streak = more urgent
  const streakWeight = Math.min(1, studyStreak / 7);
  const progressWeight = 1 - (minutesStudiedToday / dailyStudyGoal);
  
  return (streakWeight * 0.6) + (progressWeight * 0.4);
}

// ============================================
// MAIN ALGORITHM
// ============================================

/**
 * Score all possible activities and generate ranked recommendations
 */
function scoreAllActivities(state: UserStudyState): ScoredActivity[] {
  const scoredActivities: ScoredActivity[] = [];
  const examMods = getExamProximityModifiers(state.daysUntilExam);
  
  // Get all available units
  const units = ATP_UNITS.map(u => ({
    id: u.id,
    name: u.name,
    importance: UNIT_IMPORTANCE[u.id] || 1.0,
    performance: state.unitPerformance.get(u.id) || {
      accuracy: null,
      questionsAnswered: 0,
      lastStudied: null,
      lastQuizDate: null,
      recentTrend: 'stable' as const,
    },
    isWeak: state.weakUnits.includes(u.id),
    isStrong: state.strongUnits.includes(u.id),
  }));

  // Score each activity type for each unit
  const activityTypes: ActivityType[] = ['quiz', 'study', 'review', 'case_study', 'drafting', 'research'];
  
  for (const unit of units) {
    for (const activityType of activityTypes) {
      const factors = calculateFactors(unit, activityType, state, examMods);
      const score = calculateTotalScore(factors, activityType, unit.importance, examMods);
      
      scoredActivities.push({
        type: activityType,
        unitId: unit.id,
        score,
        factors,
        metadata: {
          unitName: unit.name,
          isWeak: unit.isWeak,
          isStrong: unit.isStrong,
          accuracy: unit.performance.accuracy,
          trend: unit.performance.recentTrend,
        },
      });
    }
  }
  
  // Add unit-independent activities
  // Exam simulation (not unit-specific)
  if (state.totalQuizzes >= 10) {
    const examFactors: DecisionFactors = {
      performanceWeight: state.overallAccuracy < 60 ? 0.3 : 0.6,
      recencyWeight: 0.5,
      spacedRepWeight: 0,
      weaknessWeight: 0,
      examProximityWeight: state.daysUntilExam !== null && state.daysUntilExam <= 30 ? 0.9 : 0.3,
      streakWeight: calculateStreakScore(state.studyStreak, state.minutesStudiedToday, state.dailyStudyGoal),
      activityBalanceWeight: calculateActivityBalanceScore('exam', state.recentActivities),
      timeOfDayWeight: calculateTimeOfDayScore('exam'),
    };
    
    const examScore = 
      (examFactors.examProximityWeight * 0.4) +
      (examFactors.activityBalanceWeight * 0.3) +
      (examFactors.timeOfDayWeight * 0.2) +
      (examFactors.performanceWeight * 0.1);
    
    scoredActivities.push({
      type: 'exam',
      unitId: null,
      score: examScore * examMods.examMod,
      factors: examFactors,
      metadata: { overallAccuracy: state.overallAccuracy },
    });
  }
  
  // Spaced repetition review (not unit-specific)
  if (state.cardsReviewDueCount > 0) {
    const reviewFactors: DecisionFactors = {
      performanceWeight: 0,
      recencyWeight: 0,
      spacedRepWeight: calculateSpacedRepScore(state.cardsReviewDueCount, state.lastReviewDate),
      weaknessWeight: 0,
      examProximityWeight: state.daysUntilExam !== null ? 0.6 : 0.3,
      streakWeight: 0,
      activityBalanceWeight: calculateActivityBalanceScore('review', state.recentActivities),
      timeOfDayWeight: calculateTimeOfDayScore('review'),
    };
    
    const reviewScore = 
      (reviewFactors.spacedRepWeight * 0.5) +
      (reviewFactors.activityBalanceWeight * 0.2) +
      (reviewFactors.timeOfDayWeight * 0.2) +
      (reviewFactors.examProximityWeight * 0.1);
    
    scoredActivities.push({
      type: 'review',
      unitId: null,
      score: reviewScore * examMods.reviewMod,
      factors: reviewFactors,
      metadata: { cardsDue: state.cardsReviewDueCount },
    });
  }
  
  // Sort by score descending
  scoredActivities.sort((a, b) => b.score - a.score);
  
  return scoredActivities;
}

function calculateFactors(
  unit: {
    id: string;
    name: string;
    importance: number;
    performance: {
      accuracy: number | null;
      questionsAnswered: number;
      lastStudied: Date | null;
      lastQuizDate: Date | null;
      recentTrend: 'improving' | 'stable' | 'declining';
    };
    isWeak: boolean;
    isStrong: boolean;
  },
  activityType: ActivityType,
  state: UserStudyState,
  examMods: typeof EXAM_PROXIMITY_MODIFIERS.distant
): DecisionFactors {
  return {
    performanceWeight: calculatePerformanceScore(
      unit.performance.accuracy,
      unit.performance.questionsAnswered,
      unit.isWeak
    ),
    recencyWeight: calculateRecencyScore(
      activityType === 'quiz' ? unit.performance.lastQuizDate : unit.performance.lastStudied
    ),
    spacedRepWeight: 0, // Handled separately for review cards
    weaknessWeight: unit.isWeak ? 0.9 : (unit.isStrong ? 0.2 : 0.5),
    examProximityWeight: state.daysUntilExam !== null 
      ? Math.min(1, (90 - state.daysUntilExam) / 90) 
      : 0.3,
    streakWeight: calculateStreakScore(state.studyStreak, state.minutesStudiedToday, state.dailyStudyGoal),
    activityBalanceWeight: calculateActivityBalanceScore(activityType, state.recentActivities),
    timeOfDayWeight: calculateTimeOfDayScore(activityType),
  };
}

function calculateTotalScore(
  factors: DecisionFactors,
  activityType: ActivityType,
  unitImportance: number,
  examMods: typeof EXAM_PROXIMITY_MODIFIERS.distant
): number {
  // Weighted sum of factors
  const baseScore = 
    (factors.performanceWeight * BASE_WEIGHTS.performance) +
    (factors.recencyWeight * BASE_WEIGHTS.recency) +
    (factors.weaknessWeight * BASE_WEIGHTS.weakness) +
    (factors.examProximityWeight * BASE_WEIGHTS.examProximity) +
    (factors.streakWeight * BASE_WEIGHTS.streak) +
    (factors.activityBalanceWeight * BASE_WEIGHTS.activityBalance) +
    (factors.timeOfDayWeight * BASE_WEIGHTS.timeOfDay);
  
  // Apply activity type preference
  let activityModifier = ACTIVITY_BASE_WEIGHTS[activityType];
  
  // Apply exam proximity modifiers
  switch (activityType) {
    case 'quiz':
      activityModifier *= examMods.quizMod;
      break;
    case 'exam':
      activityModifier *= examMods.examMod;
      break;
    case 'study':
    case 'case_study':
      activityModifier *= examMods.studyMod;
      break;
    case 'review':
      activityModifier *= examMods.reviewMod;
      break;
  }
  
  // Apply unit importance
  const finalScore = baseScore * activityModifier * unitImportance;
  
  return Math.min(1, Math.max(0, finalScore)); // Clamp to 0-1
}

// ============================================
// RECOMMENDATION GENERATION
// ============================================

/**
 * Convert scored activities to user-friendly recommendations
 */
export function generateRecommendations(
  state: UserStudyState,
  count: number = 5
): StudyRecommendation[] {
  const scoredActivities = scoreAllActivities(state);
  const recommendations: StudyRecommendation[] = [];
  const seenUnits = new Set<string>();
  const seenTypes = new Set<string>();
  
  for (const activity of scoredActivities) {
    // Ensure variety - don't recommend same unit twice in top results
    if (activity.unitId && seenUnits.has(activity.unitId)) {
      continue;
    }
    
    // Ensure activity type variety in top 3
    if (recommendations.length < 3 && seenTypes.has(activity.type)) {
      continue;
    }
    
    const recommendation = convertToRecommendation(activity, state, recommendations.length + 1);
    recommendations.push(recommendation);
    
    if (activity.unitId) {
      seenUnits.add(activity.unitId);
    }
    seenTypes.add(activity.type);
    
    if (recommendations.length >= count) {
      break;
    }
  }
  
  return recommendations;
}

function convertToRecommendation(
  activity: ScoredActivity,
  state: UserStudyState,
  priority: number
): StudyRecommendation {
  const { title, description, rationale } = generateContent(activity, state);
  const href = generateHref(activity);
  const difficulty = determineDifficulty(activity, state);
  const duration = estimateDuration(activity.type);
  
  return {
    activityType: activity.type,
    unitId: activity.unitId,
    unitName: activity.metadata.unitName || null,
    title,
    description,
    rationale,
    priority,
    urgencyScore: Math.round(activity.score * 100),
    estimatedMinutes: duration,
    difficulty,
    targetHref: href,
    decisionFactors: activity.factors,
  };
}

function generateContent(
  activity: ScoredActivity,
  state: UserStudyState
): { title: string; description: string; rationale: string } {
  const unitName = activity.metadata.unitName || 'General';
  
  switch (activity.type) {
    case 'quiz':
      return {
        title: `Quiz: ${unitName}`,
        description: `Test your knowledge with adaptive questions tailored to your level.`,
        rationale: activity.metadata.isWeak
          ? `This is one of your weaker areas. Regular testing improves retention.`
          : activity.metadata.accuracy !== null && activity.metadata.accuracy < 70
          ? `Your accuracy here is ${Math.round(activity.metadata.accuracy)}%. Let's improve it.`
          : `Keep your ${unitName} skills sharp with a quick quiz.`,
      };
    
    case 'study':
      return {
        title: `Study: ${unitName}`,
        description: `Deep dive into ${unitName} concepts with interactive learning.`,
        rationale: activity.metadata.questionsAnswered === 0
          ? `You haven't started this unit yet. Let's begin!`
          : `Build stronger foundations in ${unitName}.`,
      };
    
    case 'case_study':
      return {
        title: `Case Analysis: ${unitName}`,
        description: `Analyze landmark cases and extract key legal principles.`,
        rationale: `Case law forms the backbone of legal practice. Master these precedents.`,
      };
    
    case 'drafting':
      return {
        title: `Legal Drafting: ${unitName}`,
        description: `Practice drafting legal documents with real-world scenarios.`,
        rationale: `Written advocacy is crucial. Practice your drafting skills.`,
      };
    
    case 'research':
      return {
        title: `Legal Research: ${unitName}`,
        description: `Explore statutes, case law, and legal commentary.`,
        rationale: `Research skills separate good lawyers from great ones.`,
      };
    
    case 'review':
      if (activity.unitId) {
        return {
          title: `Review: ${unitName}`,
          description: `Reinforce what you've learned with spaced repetition.`,
          rationale: `Regular review prevents forgetting. ${state.cardsReviewDueCount} items need attention.`,
        };
      }
      return {
        title: `Daily Review`,
        description: `Review ${state.cardsReviewDueCount} items to maintain your knowledge.`,
        rationale: `Your review cards are due. Consistent review ensures long-term retention.`,
      };
    
    case 'exam':
      return {
        title: `Exam Simulation`,
        description: `Full practice exam under timed conditions.`,
        rationale: state.daysUntilExam !== null && state.daysUntilExam <= 30
          ? `With ${state.daysUntilExam} days until your exam, simulation practice is critical.`
          : `Test yourself under exam conditions to build confidence.`,
      };
    
    default:
      return {
        title: `Study Session`,
        description: `Continue your learning journey.`,
        rationale: `Every session brings you closer to your goal.`,
      };
  }
}

function generateHref(activity: ScoredActivity): string {
  const unitId = activity.unitId || '';
  
  switch (activity.type) {
    case 'quiz':
      return unitId ? `/quizzes?unit=${unitId}` : '/quizzes';
    case 'study':
      return unitId ? `/study/${unitId}` : '/study';
    case 'case_study':
      return unitId ? `/study/${unitId}?focus=cases` : '/study';
    case 'drafting':
      return '/drafting';
    case 'research':
      return '/research';
    case 'review':
      return '/tutor';
    case 'exam':
      return '/exams';
    default:
      return '/dashboard';
  }
}

function determineDifficulty(
  activity: ScoredActivity,
  state: UserStudyState
): 'beginner' | 'intermediate' | 'advanced' {
  const accuracy = activity.metadata.accuracy;
  
  if (accuracy === null || activity.metadata.questionsAnswered < 5) {
    return 'beginner';
  }
  
  if (accuracy >= 80) {
    return 'advanced';
  }
  if (accuracy >= 50) {
    return 'intermediate';
  }
  return 'beginner';
}

function estimateDuration(activityType: ActivityType): number {
  switch (activityType) {
    case 'quiz': return 15;
    case 'study': return 30;
    case 'case_study': return 25;
    case 'drafting': return 45;
    case 'research': return 30;
    case 'review': return 10;
    case 'exam': return 90;
    default: return 20;
  }
}

// ============================================
// EXPORTS
// ============================================

export { ALGORITHM_VERSION };
