/**
 * Banter & Fun Facts System
 * 
 * Provides engaging, non-legal content as session rewards:
 * - Historical legal facts
 * - Motivational messages
 * - Study tips
 * - Achievements/celebrations
 * 
 * IMPORTANT: No substantive legal claims unless properly grounded.
 * These are clearly labeled as "fun facts" not legal advice.
 */

// ============================================
// TYPES
// ============================================

export type BanterCategory = 
  | 'HISTORY_FACT'
  | 'MOTIVATION'
  | 'STUDY_TIP'
  | 'ACHIEVEMENT'
  | 'FUN_FACT'
  | 'QUOTE';

export interface BanterItem {
  id: string;
  category: BanterCategory;
  content: string;
  source?: string; // Attribution if needed
  emoji?: string;
  isLegalContent: false; // Always false - this is NOT legal advice
  tags?: string[]; // For targeting (e.g., ['exam_prep', 'evidence'])
}

export interface SessionReward {
  banter: BanterItem;
  streakMessage?: string;
  achievementUnlocked?: {
    title: string;
    description: string;
    icon: string;
  };
}

// ============================================
// BANTER CONTENT LIBRARY
// ============================================

export const HISTORY_FACTS: BanterItem[] = [
  {
    id: 'hist-001',
    category: 'HISTORY_FACT',
    content: 'Kenya\'s first African Chief Justice was Willy Mutunga, appointed in 2011 under the new constitution.',
    source: 'Historical record',
    emoji: '🏛️',
    isLegalContent: false,
    tags: ['kenya', 'judiciary'],
  },
  {
    id: 'hist-002',
    category: 'HISTORY_FACT',
    content: 'The Judicature Act of 1967 established the formal hierarchy of courts in Kenya, replacing colonial-era structures.',
    source: 'Historical record',
    emoji: '📜',
    isLegalContent: false,
    tags: ['kenya', 'courts'],
  },
  {
    id: 'hist-003',
    category: 'HISTORY_FACT',
    content: 'The Kenya School of Law was established in 1961, originally as the Kenya Law Society School of Law.',
    source: 'Historical record',
    emoji: '🏫',
    isLegalContent: false,
    tags: ['kenya', 'education'],
  },
  {
    id: 'hist-004',
    category: 'HISTORY_FACT',
    content: 'The 2010 Kenyan Constitution is considered one of the most progressive in Africa, introducing a Bill of Rights and devolved government.',
    source: 'Historical record',
    emoji: '📋',
    isLegalContent: false,
    tags: ['kenya', 'constitution'],
  },
  {
    id: 'hist-005',
    category: 'HISTORY_FACT',
    content: 'English common law was introduced to Kenya through the British colonial East Africa Protectorate in 1895.',
    source: 'Historical record',
    emoji: '🇬🇧',
    isLegalContent: false,
    tags: ['kenya', 'common_law'],
  },
  {
    id: 'hist-006',
    category: 'HISTORY_FACT',
    content: 'The first woman to be admitted to practice law in Kenya was Philly Leakey in 1962.',
    source: 'Historical record',
    emoji: '👩‍⚖️',
    isLegalContent: false,
    tags: ['kenya', 'pioneers'],
  },
  {
    id: 'hist-007',
    category: 'HISTORY_FACT',
    content: 'The Kenya National Commission on Human Rights was established in 2002 to promote and protect human rights.',
    source: 'Historical record',
    emoji: '⚖️',
    isLegalContent: false,
    tags: ['kenya', 'human_rights'],
  },
  {
    id: 'hist-008',
    category: 'HISTORY_FACT',
    content: 'Lord Denning, whose judgments are frequently cited in Kenyan courts, served as Master of the Rolls for 20 years (1962-1982).',
    source: 'Historical record',
    emoji: '🎓',
    isLegalContent: false,
    tags: ['common_law', 'judges'],
  },
];

export const MOTIVATIONAL_MESSAGES: BanterItem[] = [
  {
    id: 'mot-001',
    category: 'MOTIVATION',
    content: 'Every expert was once a beginner. Your consistent effort is building a foundation for success!',
    emoji: '💪',
    isLegalContent: false,
  },
  {
    id: 'mot-002',
    category: 'MOTIVATION',
    content: 'The bar exam tests knowledge AND resilience. By studying today, you\'re building both.',
    emoji: '🏆',
    isLegalContent: false,
  },
  {
    id: 'mot-003',
    category: 'MOTIVATION',
    content: 'Small daily progress compounds into remarkable results. Keep going!',
    emoji: '📈',
    isLegalContent: false,
  },
  {
    id: 'mot-004',
    category: 'MOTIVATION',
    content: 'You\'re not just studying law – you\'re preparing to serve justice. That matters.',
    emoji: '⚖️',
    isLegalContent: false,
  },
  {
    id: 'mot-005',
    category: 'MOTIVATION',
    content: 'When you feel like quitting, remember why you started.',
    emoji: '🎯',
    isLegalContent: false,
  },
  {
    id: 'mot-006',
    category: 'MOTIVATION',
    content: 'This session was hard, but so are courtrooms. You\'re training for both!',
    emoji: '🔥',
    isLegalContent: false,
  },
  {
    id: 'mot-007',
    category: 'MOTIVATION',
    content: 'The path to advocacy is paved with study sessions like this one. Well done!',
    emoji: '🛤️',
    isLegalContent: false,
  },
  {
    id: 'mot-008',
    category: 'MOTIVATION',
    content: 'Future you will thank present you for this effort. Keep pushing!',
    emoji: '🙌',
    isLegalContent: false,
  },
];

export const STUDY_TIPS: BanterItem[] = [
  {
    id: 'tip-001',
    category: 'STUDY_TIP',
    content: 'Teaching a concept to someone else (or pretending to) helps cement your understanding.',
    emoji: '💡',
    isLegalContent: false,
  },
  {
    id: 'tip-002',
    category: 'STUDY_TIP',
    content: 'Spaced repetition is more effective than cramming. Your brain consolidates memory during rest.',
    emoji: '🧠',
    isLegalContent: false,
  },
  {
    id: 'tip-003',
    category: 'STUDY_TIP',
    content: 'Take short breaks every 25-45 minutes. Your brain needs rest to process information.',
    emoji: '☕',
    isLegalContent: false,
  },
  {
    id: 'tip-004',
    category: 'STUDY_TIP',
    content: 'Practice under exam conditions at least once a week. Familiarity reduces anxiety.',
    emoji: '⏱️',
    isLegalContent: false,
  },
  {
    id: 'tip-005',
    category: 'STUDY_TIP',
    content: 'Connect new concepts to ones you already know. The brain loves patterns.',
    emoji: '🔗',
    isLegalContent: false,
  },
  {
    id: 'tip-006',
    category: 'STUDY_TIP',
    content: 'Get enough sleep! Memory consolidation happens during deep sleep.',
    emoji: '😴',
    isLegalContent: false,
  },
  {
    id: 'tip-007',
    category: 'STUDY_TIP',
    content: 'Review your mistakes carefully. Errors are valuable feedback for improvement.',
    emoji: '🔍',
    isLegalContent: false,
  },
  {
    id: 'tip-008',
    category: 'STUDY_TIP',
    content: 'Use active recall: test yourself rather than just re-reading notes.',
    emoji: '✍️',
    isLegalContent: false,
  },
];

export const FUN_FACTS: BanterItem[] = [
  {
    id: 'fun-001',
    category: 'FUN_FACT',
    content: 'The word "attorney" comes from the French "aturné" meaning "appointed" or "assigned."',
    emoji: '📚',
    isLegalContent: false,
  },
  {
    id: 'fun-002',
    category: 'FUN_FACT',
    content: 'Lawyers in the UK are still called "barristers" because they originally stood behind a bar in court.',
    emoji: '🎭',
    isLegalContent: false,
  },
  {
    id: 'fun-003',
    category: 'FUN_FACT',
    content: 'The scales of justice symbol dates back to ancient Egypt and the goddess Ma\'at.',
    emoji: '⚖️',
    isLegalContent: false,
  },
  {
    id: 'fun-004',
    category: 'FUN_FACT',
    content: 'The Latin phrase "amicus curiae" literally means "friend of the court."',
    emoji: '🤝',
    isLegalContent: false,
  },
  {
    id: 'fun-005',
    category: 'FUN_FACT',
    content: 'The first law school in the world was founded in Bologna, Italy, around 1088 AD.',
    emoji: '🏛️',
    isLegalContent: false,
  },
  {
    id: 'fun-006',
    category: 'FUN_FACT',
    content: 'The gavel used by judges was originally a tool used by auctioneers.',
    emoji: '🔨',
    isLegalContent: false,
  },
];

export const QUOTES: BanterItem[] = [
  {
    id: 'quote-001',
    category: 'QUOTE',
    content: '"The first duty of society is justice." — Alexander Hamilton',
    emoji: '💬',
    isLegalContent: false,
  },
  {
    id: 'quote-002',
    category: 'QUOTE',
    content: '"Injustice anywhere is a threat to justice everywhere." — Martin Luther King Jr.',
    emoji: '💬',
    isLegalContent: false,
  },
  {
    id: 'quote-003',
    category: 'QUOTE',
    content: '"The law is reason, free from passion." — Aristotle',
    emoji: '💬',
    isLegalContent: false,
  },
  {
    id: 'quote-004',
    category: 'QUOTE',
    content: '"Equal justice under law is not merely a caption on the facade of the Supreme Court building." — Lewis Powell',
    emoji: '💬',
    isLegalContent: false,
  },
  {
    id: 'quote-005',
    category: 'QUOTE',
    content: '"The ends of law are not to abolish or restrain, but to preserve and enlarge freedom." — John Locke',
    emoji: '💬',
    isLegalContent: false,
  },
  {
    id: 'quote-006',
    category: 'QUOTE',
    content: '"In the halls of justice, the only justice is in the halls." — Lenny Bruce',
    emoji: '😄',
    isLegalContent: false,
  },
];

// Combined library
export const ALL_BANTER: BanterItem[] = [
  ...HISTORY_FACTS,
  ...MOTIVATIONAL_MESSAGES,
  ...STUDY_TIPS,
  ...FUN_FACTS,
  ...QUOTES,
];

// ============================================
// BANTER SELECTION LOGIC
// ============================================

/**
 * Select a random banter item, optionally filtering by category or tags
 */
export function selectRandomBanter(options?: {
  category?: BanterCategory;
  tags?: string[];
  excludeIds?: string[];
}): BanterItem {
  let candidates = [...ALL_BANTER];

  // Filter by category
  if (options?.category) {
    candidates = candidates.filter(b => b.category === options.category);
  }

  // Filter by tags
  if (options?.tags && options.tags.length > 0) {
    candidates = candidates.filter(b => 
      b.tags?.some(tag => options.tags!.includes(tag))
    );
  }

  // Exclude specific IDs (for variety)
  if (options?.excludeIds && options.excludeIds.length > 0) {
    candidates = candidates.filter(b => !options.excludeIds!.includes(b.id));
  }

  // Fallback to all banter if filters too restrictive
  if (candidates.length === 0) {
    candidates = ALL_BANTER;
  }

  // Random selection
  const index = Math.floor(Math.random() * candidates.length);
  return candidates[index];
}

/**
 * Select banter appropriate for session completion
 */
export function selectSessionCompletionBanter(context: {
  sessionMinutes?: number;
  wasHard?: boolean;
  currentStreak?: number;
  topicTags?: string[];
}): BanterItem {
  // Prioritize based on context
  const categories: BanterCategory[] = [];
  
  // Long or hard sessions deserve motivation
  if ((context.sessionMinutes ?? 0) >= 45 || context.wasHard) {
    categories.push('MOTIVATION', 'MOTIVATION', 'QUOTE'); // Weight toward motivation
  }
  
  // Streaks get celebration
  if ((context.currentStreak ?? 0) >= 5) {
    categories.push('MOTIVATION');
  }
  
  // Add variety
  categories.push('STUDY_TIP', 'HISTORY_FACT', 'FUN_FACT', 'QUOTE');
  
  // Pick random category from weighted list
  const categoryIndex = Math.floor(Math.random() * categories.length);
  const category = categories[categoryIndex];
  
  return selectRandomBanter({
    category,
    tags: context.topicTags,
  });
}

// ============================================
// SESSION REWARD GENERATION
// ============================================

/**
 * Generate a complete session reward package
 */
export function generateSessionReward(context: {
  userId: string;
  sessionMinutes: number;
  scorePercent?: number;
  currentStreak?: number;
  topicTags?: string[];
  isFirstSession?: boolean;
  achievementEarned?: string;
}): SessionReward {
  const banter = selectSessionCompletionBanter({
    sessionMinutes: context.sessionMinutes,
    wasHard: (context.scorePercent ?? 100) < 50,
    currentStreak: context.currentStreak,
    topicTags: context.topicTags,
  });

  const reward: SessionReward = { banter };

  // Add streak message
  if ((context.currentStreak ?? 0) > 0) {
    reward.streakMessage = generateStreakMessage(context.currentStreak!);
  }

  // Add achievement if earned
  if (context.achievementEarned) {
    reward.achievementUnlocked = getAchievementDetails(context.achievementEarned);
  }

  // First session special
  if (context.isFirstSession) {
    reward.achievementUnlocked = {
      title: 'First Steps',
      description: 'Completed your first study session!',
      icon: '🎉',
    };
  }

  return reward;
}

function generateStreakMessage(streak: number): string {
  if (streak >= 30) return `🔥 Incredible! ${streak}-day streak! You're unstoppable!`;
  if (streak >= 14) return `🔥 Amazing! ${streak} days strong! Keep the momentum!`;
  if (streak >= 7) return `🔥 One week streak! You're building great habits!`;
  if (streak >= 3) return `🔥 ${streak}-day streak! Consistency is key!`;
  return `🔥 ${streak}-day streak! Great start!`;
}

function getAchievementDetails(achievementId: string): SessionReward['achievementUnlocked'] {
  const achievements: Record<string, { title: string; description: string; icon: string }> = {
    'first_session': {
      title: 'First Steps',
      description: 'Completed your first study session!',
      icon: '🎉',
    },
    'week_streak': {
      title: 'Week Warrior',
      description: 'Studied for 7 consecutive days!',
      icon: '🏆',
    },
    'month_streak': {
      title: 'Monthly Master',
      description: 'Studied for 30 consecutive days!',
      icon: '👑',
    },
    'perfect_score': {
      title: 'Perfect Score',
      description: 'Achieved 100% on a quiz!',
      icon: '⭐',
    },
    'skill_mastered': {
      title: 'Skill Mastered',
      description: 'Reached full mastery on a skill!',
      icon: '💎',
    },
    'unit_complete': {
      title: 'Unit Complete',
      description: 'Finished all skills in a unit!',
      icon: '📚',
    },
    'night_owl': {
      title: 'Night Owl',
      description: 'Completed a session after 10 PM!',
      icon: '🦉',
    },
    'early_bird': {
      title: 'Early Bird',
      description: 'Completed a session before 7 AM!',
      icon: '🐦',
    },
    'century_club': {
      title: 'Century Club',
      description: 'Completed 100 study sessions!',
      icon: '💯',
    },
  };

  return achievements[achievementId] || {
    title: 'Achievement',
    description: 'You earned an achievement!',
    icon: '🎖️',
  };
}

// ============================================
// DISCLAIMER
// ============================================

export const BANTER_DISCLAIMER = `
Note: Fun facts and historical information are for entertainment and general interest only.
They do not constitute legal advice. Always consult official legal sources for legal matters.
`;

export default {
  ALL_BANTER,
  HISTORY_FACTS,
  MOTIVATIONAL_MESSAGES,
  STUDY_TIPS,
  FUN_FACTS,
  QUOTES,
  selectRandomBanter,
  selectSessionCompletionBanter,
  generateSessionReward,
  BANTER_DISCLAIMER,
};
