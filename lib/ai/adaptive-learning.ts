/**
 * Adaptive Learning Algorithm
 * 
 * This service analyzes user performance and adapts the learning experience:
 * - Tracks performance by topic/unit
 * - Adjusts question difficulty dynamically
 * - Identifies weak areas and strengths
 * - Generates personalized study recommendations
 */

export interface UserPerformance {
  topicId: string;
  topicName: string;
  totalAttempts: number;
  correctAnswers: number;
  avgTimeSpent: number; // seconds
  currentDifficulty: 'beginner' | 'intermediate' | 'advanced';
  trend: 'improving' | 'stable' | 'declining';
  lastAccessed: Date;
}

export interface AdaptiveProfile {
  userId: string;
  overallMastery: number; // 0-100
  currentLevel: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  strongAreas: string[];
  weakAreas: string[];
  recommendedFocus: string[];
  studyStreak: number;
  totalQuizzesTaken: number;
  performanceByTopic: UserPerformance[];
  lastUpdated: Date;
}

export interface AdaptiveQuestion {
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  shouldChallenge: boolean; // Push slightly above comfort zone
  focusOnWeakness: boolean;
  suggestedTopics: string[];
}

/**
 * Calculate the recommended difficulty based on recent performance
 */
export function calculateAdaptiveDifficulty(
  recentCorrectRate: number,
  currentDifficulty: 'beginner' | 'intermediate' | 'advanced',
  consecutiveCorrect: number,
  consecutiveWrong: number
): 'beginner' | 'intermediate' | 'advanced' {
  // If struggling (below 40% or 3+ consecutive wrong), decrease difficulty
  if (recentCorrectRate < 0.4 || consecutiveWrong >= 3) {
    if (currentDifficulty === 'advanced') return 'intermediate';
    if (currentDifficulty === 'intermediate') return 'beginner';
    return 'beginner';
  }
  
  // If excelling (above 80% and 4+ consecutive correct), increase difficulty
  if (recentCorrectRate > 0.8 && consecutiveCorrect >= 4) {
    if (currentDifficulty === 'beginner') return 'intermediate';
    if (currentDifficulty === 'intermediate') return 'advanced';
    return 'advanced';
  }
  
  // Otherwise, maintain current difficulty
  return currentDifficulty;
}

/**
 * Analyze user responses to identify patterns and weak areas
 */
export function analyzeUserPatterns(
  responses: Array<{
    topicId: string;
    isCorrect: boolean;
    timeSpent: number;
    difficulty: string;
    timestamp: Date;
  }>
): {
  weakTopics: string[];
  strongTopics: string[];
  avgPerformance: number;
  recommendedDifficulty: 'beginner' | 'intermediate' | 'advanced';
} {
  const topicStats: Map<string, { correct: number; total: number; times: number[] }> = new Map();
  
  for (const response of responses) {
    const stats = topicStats.get(response.topicId) || { correct: 0, total: 0, times: [] };
    stats.total++;
    if (response.isCorrect) stats.correct++;
    stats.times.push(response.timeSpent);
    topicStats.set(response.topicId, stats);
  }
  
  const weakTopics: string[] = [];
  const strongTopics: string[] = [];
  let totalCorrect = 0;
  let totalAttempts = 0;
  
  topicStats.forEach((stats, topicId) => {
    const rate = stats.correct / stats.total;
    totalCorrect += stats.correct;
    totalAttempts += stats.total;
    
    if (rate < 0.5 && stats.total >= 3) {
      weakTopics.push(topicId);
    } else if (rate >= 0.75 && stats.total >= 3) {
      strongTopics.push(topicId);
    }
  });
  
  const avgPerformance = totalAttempts > 0 ? (totalCorrect / totalAttempts) * 100 : 0;
  
  let recommendedDifficulty: 'beginner' | 'intermediate' | 'advanced' = 'intermediate';
  if (avgPerformance < 40) recommendedDifficulty = 'beginner';
  else if (avgPerformance >= 75) recommendedDifficulty = 'advanced';
  
  return { weakTopics, strongTopics, avgPerformance, recommendedDifficulty };
}

/**
 * Generate personalized study recommendations based on profile.
 * Uses date-based rotation so suggestions vary day-to-day even
 * when the underlying weak/strong areas haven't changed.
 * Mixes backlog (weak areas) with new/untouched topics.
 */
export function generateStudyRecommendations(
  profile: AdaptiveProfile,
  targetExamDate?: Date
): Array<{
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  topicId?: string;
  action: string;
}> {
  const recommendations: Array<{
    title: string;
    description: string;
    priority: 'high' | 'medium' | 'low';
    topicId?: string;
    action: string;
  }> = [];

  // Date-based rotation seed — changes daily
  const today = new Date();
  const daySeed = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();

  // Deterministic shuffle using day seed
  const seededShuffle = <T,>(arr: T[]): T[] => {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = (daySeed * (i + 1) + 7919) % (i + 1);
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  };

  // All known ATP unit topic areas for discovering untouched ones
  const ALL_TOPIC_AREAS = [
    'Civil Litigation', 'Criminal Litigation', 'Legal Writing & Drafting',
    'Professional Ethics', 'Property Law & Conveyancing', 'Commercial Transactions',
    'Family Law', 'Constitutional & Administrative Law', 'Alternative Dispute Resolution',
    'Probate & Administration', 'Employment & Labour Law', 'Tax Law',
  ];

  // Find topics the user hasn't touched yet
  const touchedTopics = new Set([...profile.weakAreas, ...profile.strongAreas]);
  const untouchedTopics = ALL_TOPIC_AREAS.filter(t => !touchedTopics.has(t));

  // Rotate weak areas so a different one leads each day
  const rotatedWeak = seededShuffle(profile.weakAreas);
  const rotatedUntouched = seededShuffle(untouchedTopics);

  // Pick 1-2 from backlog (weak areas) with date rotation
  const backlogPicks = rotatedWeak.slice(0, Math.min(2, rotatedWeak.length));
  for (const topicId of backlogPicks) {
    recommendations.push({
      title: `Strengthen: ${topicId}`,
      description: 'This area needs attention based on your recent performance — let\'s sharpen it.',
      priority: 'high',
      topicId,
      action: 'study',
    });
  }

  // Pick 1 from untouched/new topics to keep things fresh
  if (rotatedUntouched.length > 0) {
    const newTopic = rotatedUntouched[0];
    recommendations.push({
      title: `Explore: ${newTopic}`,
      description: 'You haven\'t covered this area yet — broadening your coverage is key for the bar exam.',
      priority: 'medium',
      topicId: newTopic,
      action: 'study',
    });
  }

  // Rotate strong areas for maintenance quizzes
  if (profile.strongAreas.length > 0) {
    const rotatedStrong = seededShuffle(profile.strongAreas);
    recommendations.push({
      title: `Quick Review: ${rotatedStrong[0]}`,
      description: `Stay sharp on ${rotatedStrong[0]} with a quick quiz to maintain your edge.`,
      priority: 'low',
      topicId: rotatedStrong[0],
      action: 'quiz',
    });
  }
  
  // If exam is approaching, suggest intensive review
  if (targetExamDate) {
    const daysUntilExam = Math.ceil(
      (targetExamDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );
    
    if (daysUntilExam <= 30) {
      recommendations.unshift({
        title: `${daysUntilExam} Days Until Exam!`,
        description: 'Focus on full practice exams and timed sessions',
        priority: 'high',
        action: 'exam',
      });
    } else if (daysUntilExam <= 60) {
      recommendations.push({
        title: 'Exam Preparation Phase',
        description: 'Start incorporating more essay practice',
        priority: 'medium',
        action: 'essay',
      });
    }
  }
  
  // Suggest essay practice if not recently done
  recommendations.push({
    title: 'Practice Legal Writing',
    description: 'Bar exams require strong written analysis skills',
    priority: 'medium',
    action: 'drafting',
  });
  
  return recommendations;
}

/**
 * Generate intelligent greeting/recommendation message for the user
 */
export function generateIntelligentGreeting(
  profile: AdaptiveProfile,
  userName: string,
  currentHour: number
): {
  greeting: string;
  recommendation: string;
  suggestedAction: {
    label: string;
    href: string;
    icon: string;
  };
} {
  // Time-based greeting
  let timeGreeting = 'Good morning';
  if (currentHour >= 12 && currentHour < 17) timeGreeting = 'Good afternoon';
  else if (currentHour >= 17 && currentHour < 21) timeGreeting = 'Good evening';
  else if (currentHour >= 21 || currentHour < 5) timeGreeting = 'Burning the midnight oil';
  
  const firstName = userName.split(' ')[0] || 'there';
  const greeting = `${timeGreeting}, ${firstName}!`;
  
  // Generate recommendation based on profile
  let recommendation: string;
  let suggestedAction: { label: string; href: string; icon: string };
  
  // If they have weak areas, focus there
  if (profile.weakAreas.length > 0) {
    const weakArea = profile.weakAreas[0];
    recommendation = `I noticed you could use some practice with ${weakArea}. Let's work on strengthening that area today.`;
    suggestedAction = {
      label: `Study ${weakArea}`,
      href: `/study/${weakArea.toLowerCase().replace(/\s+/g, '-')}`,
      icon: 'BookOpen',
    };
  }
  // If they're on a streak, celebrate and encourage
  else if (profile.studyStreak >= 3) {
    recommendation = `Amazing! You're on a ${profile.studyStreak}-day study streak! Keep the momentum going with a quick quiz.`;
    suggestedAction = {
      label: 'Take a Quiz',
      href: '/quizzes',
      icon: 'Lightbulb',
    };
  }
  // If mastery is high, challenge them
  else if (profile.overallMastery >= 75) {
    recommendation = `Your performance has been excellent! Ready to challenge yourself with an exam simulation?`;
    suggestedAction = {
      label: 'Exam Simulation',
      href: '/exams',
      icon: 'ClipboardCheck',
    };
  }
  // Default recommendation
  else {
    recommendation = `Ready to continue your bar exam preparation? I've prepared some study materials based on your progress.`;
    suggestedAction = {
      label: 'Continue Studying',
      href: '/study',
      icon: 'BookOpen',
    };
  }
  
  return { greeting, recommendation, suggestedAction };
}

/**
 * Calculate mastery level from performance data
 */
export function calculateMasteryLevel(
  avgPerformance: number,
  totalQuizzes: number
): 'beginner' | 'intermediate' | 'advanced' | 'expert' {
  // Need minimum attempts for higher levels
  if (totalQuizzes < 10) return 'beginner';
  if (totalQuizzes < 25) {
    if (avgPerformance >= 70) return 'intermediate';
    return 'beginner';
  }
  if (totalQuizzes < 50) {
    if (avgPerformance >= 85) return 'advanced';
    if (avgPerformance >= 60) return 'intermediate';
    return 'beginner';
  }
  // 50+ quizzes
  if (avgPerformance >= 90) return 'expert';
  if (avgPerformance >= 75) return 'advanced';
  if (avgPerformance >= 55) return 'intermediate';
  return 'beginner';
}

/**
 * Rubric for grading essay/written responses
 */
export interface EssayRubric {
  category: string;
  maxPoints: number;
  criteria: Array<{
    level: string;
    points: number;
    description: string;
  }>;
}

export const DEFAULT_ESSAY_RUBRIC: EssayRubric[] = [
  {
    category: 'Legal Knowledge & Accuracy',
    maxPoints: 25,
    criteria: [
      { level: 'Excellent', points: 25, description: 'Demonstrates comprehensive understanding of relevant law with accurate citations' },
      { level: 'Good', points: 20, description: 'Shows solid understanding with mostly accurate references' },
      { level: 'Adequate', points: 15, description: 'Basic understanding with some gaps or minor inaccuracies' },
      { level: 'Developing', points: 10, description: 'Limited understanding with significant gaps' },
      { level: 'Poor', points: 5, description: 'Minimal or incorrect legal knowledge demonstrated' },
    ],
  },
  {
    category: 'Analysis & Application',
    maxPoints: 25,
    criteria: [
      { level: 'Excellent', points: 25, description: 'Thorough analysis applying law to facts with clear reasoning' },
      { level: 'Good', points: 20, description: 'Sound analysis with good application of principles' },
      { level: 'Adequate', points: 15, description: 'Basic analysis with some application gaps' },
      { level: 'Developing', points: 10, description: 'Superficial analysis, limited application' },
      { level: 'Poor', points: 5, description: 'No meaningful analysis or application' },
    ],
  },
  {
    category: 'Structure & Organization',
    maxPoints: 25,
    criteria: [
      { level: 'Excellent', points: 25, description: 'Clear IRAC structure, logical flow, well-organized arguments' },
      { level: 'Good', points: 20, description: 'Good structure with minor organizational issues' },
      { level: 'Adequate', points: 15, description: 'Basic structure but some disorganization' },
      { level: 'Developing', points: 10, description: 'Poor structure, hard to follow' },
      { level: 'Poor', points: 5, description: 'No discernible structure' },
    ],
  },
  {
    category: 'Legal Writing & Expression',
    maxPoints: 25,
    criteria: [
      { level: 'Excellent', points: 25, description: 'Professional legal writing, clear and precise language' },
      { level: 'Good', points: 20, description: 'Good writing with appropriate legal terminology' },
      { level: 'Adequate', points: 15, description: 'Acceptable writing with some clarity issues' },
      { level: 'Developing', points: 10, description: 'Poor writing, unclear expression' },
      { level: 'Poor', points: 5, description: 'Very poor writing, difficult to understand' },
    ],
  },
];
