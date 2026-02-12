/**
 * Spaced Repetition Service
 * 
 * Implementation of the SuperMemo SM-2 algorithm for optimal memory retention.
 * This algorithm schedules reviews at optimal intervals based on user performance.
 * 
 * Quality ratings (0-5):
 * - 5: Perfect response, no hesitation
 * - 4: Correct response after hesitation
 * - 3: Correct response with difficulty
 * - 2: Incorrect, but close / partial understanding
 * - 1: Completely wrong, but remembered something
 * - 0: Complete blackout
 */

export interface SpacedRepetitionCard {
  id: string;
  userId: string;
  contentType: 'case' | 'concept' | 'provision' | 'question';
  contentId: string;
  title: string;
  content: string;
  unitId?: string;
  
  // SM-2 algorithm fields
  easinessFactor: number; // EF (default 2.5, stored as integer * 100)
  interval: number; // Days until next review
  repetitions: number; // Number of consecutive correct reviews
  nextReviewDate: string; // ISO date string
  lastReviewDate?: string;
  lastQuality?: number;
  totalReviews: number;
  correctReviews: number;
}

export interface ReviewResult {
  quality: number; // 0-5
  timeSpent?: number; // seconds
  userNotes?: string;
}

export interface SM2Result {
  newEasinessFactor: number;
  newInterval: number;
  newRepetitions: number;
  nextReviewDate: string;
}

/**
 * Calculate the next review parameters using SM-2 algorithm
 * 
 * @param card - The current card state
 * @param quality - User's quality rating (0-5)
 * @returns Updated SM-2 parameters
 */
export function calculateNextReview(
  card: SpacedRepetitionCard,
  quality: number
): SM2Result {
  // Ensure quality is within bounds
  quality = Math.max(0, Math.min(5, Math.round(quality)));
  
  // Convert stored EF back to decimal (stored as integer * 100)
  let ef = card.easinessFactor / 100;
  let interval = card.interval;
  let repetitions = card.repetitions;
  
  // Calculate new easiness factor
  // EF' = EF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
  const efDelta = 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02);
  ef = Math.max(1.3, ef + efDelta); // EF should not go below 1.3
  
  if (quality < 3) {
    // Failed review - reset repetitions but keep EF
    repetitions = 0;
    interval = 1; // Review again tomorrow
  } else {
    // Successful review - increase interval
    repetitions += 1;
    
    if (repetitions === 1) {
      interval = 1; // First successful review: 1 day
    } else if (repetitions === 2) {
      interval = 6; // Second successful review: 6 days
    } else {
      // Subsequent reviews: multiply by EF
      interval = Math.round(interval * ef);
    }
  }
  
  // Cap interval at 365 days
  interval = Math.min(interval, 365);
  
  // Calculate next review date
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const nextDate = new Date(today);
  nextDate.setDate(nextDate.getDate() + interval);
  
  return {
    newEasinessFactor: Math.round(ef * 100),
    newInterval: interval,
    newRepetitions: repetitions,
    nextReviewDate: nextDate.toISOString().split('T')[0],
  };
}

/**
 * Get cards due for review today
 */
export function getDueCards(
  cards: SpacedRepetitionCard[],
  limit?: number
): SpacedRepetitionCard[] {
  const today = new Date().toISOString().split('T')[0];
  
  const dueCards = cards
    .filter(card => card.nextReviewDate <= today)
    .sort((a, b) => {
      // Sort by:
      // 1. Overdue cards first (oldest)
      // 2. Lower easiness factor (harder cards)
      // 3. More repetitions (established cards need review)
      const dateCompare = a.nextReviewDate.localeCompare(b.nextReviewDate);
      if (dateCompare !== 0) return dateCompare;
      
      const efCompare = a.easinessFactor - b.easinessFactor;
      if (efCompare !== 0) return efCompare;
      
      return b.repetitions - a.repetitions;
    });
  
  return limit ? dueCards.slice(0, limit) : dueCards;
}

/**
 * Calculate card maturity level for display
 */
export function getCardMaturity(card: SpacedRepetitionCard): 'new' | 'learning' | 'young' | 'mature' {
  if (card.repetitions === 0) return 'new';
  if (card.repetitions < 3) return 'learning';
  if (card.interval < 21) return 'young';
  return 'mature';
}

/**
 * Get card retention strength (0-100%)
 */
export function getRetentionStrength(card: SpacedRepetitionCard): number {
  if (card.totalReviews === 0) return 0;
  
  const accuracy = card.correctReviews / card.totalReviews;
  const maturityBonus = Math.min(card.interval / 30, 1) * 0.2;
  const efBonus = Math.min((card.easinessFactor / 100 - 1.3) / 2.2, 1) * 0.1;
  
  return Math.round((accuracy * 0.7 + maturityBonus + efBonus) * 100);
}

/**
 * Suggest initial easiness factor based on user's profile
 */
export function suggestInitialEF(
  userAccuracyRate?: number,
  topicDifficulty?: 'easy' | 'medium' | 'hard'
): number {
  let baseEF = 250; // 2.5 default
  
  // Adjust based on user's overall accuracy
  if (userAccuracyRate !== undefined) {
    if (userAccuracyRate > 0.8) baseEF += 20;
    else if (userAccuracyRate < 0.5) baseEF -= 30;
  }
  
  // Adjust based on topic difficulty
  if (topicDifficulty === 'easy') baseEF += 20;
  else if (topicDifficulty === 'hard') baseEF -= 30;
  
  return Math.max(130, Math.min(300, baseEF));
}

/**
 * Create a new spaced repetition card for content
 */
export function createSpacedRepetitionCard(params: {
  userId: string;
  contentType: SpacedRepetitionCard['contentType'];
  contentId: string;
  title: string;
  content: string;
  unitId?: string;
  initialEF?: number;
}): Omit<SpacedRepetitionCard, 'id'> {
  const today = new Date().toISOString().split('T')[0];
  
  return {
    userId: params.userId,
    contentType: params.contentType,
    contentId: params.contentId,
    title: params.title,
    content: params.content,
    unitId: params.unitId,
    easinessFactor: params.initialEF || 250,
    interval: 1,
    repetitions: 0,
    nextReviewDate: today, // Due immediately for first review
    totalReviews: 0,
    correctReviews: 0,
  };
}

/**
 * Calculate study statistics for a user's cards
 */
export function calculateStudyStats(cards: SpacedRepetitionCard[]): {
  totalCards: number;
  dueToday: number;
  overdue: number;
  newCards: number;
  learningCards: number;
  matureCards: number;
  averageRetention: number;
  streakDays: number;
} {
  const today = new Date().toISOString().split('T')[0];
  
  let dueToday = 0;
  let overdue = 0;
  let newCards = 0;
  let learningCards = 0;
  let matureCards = 0;
  let totalRetention = 0;
  
  for (const card of cards) {
    if (card.nextReviewDate < today) overdue++;
    else if (card.nextReviewDate === today) dueToday++;
    
    const maturity = getCardMaturity(card);
    if (maturity === 'new') newCards++;
    else if (maturity === 'learning' || maturity === 'young') learningCards++;
    else matureCards++;
    
    totalRetention += getRetentionStrength(card);
  }
  
  // Calculate streak days from last review dates
  const reviewDates = cards
    .filter(c => c.lastReviewDate)
    .map(c => c.lastReviewDate!)
    .sort()
    .reverse();
  
  let streakDays = 0;
  if (reviewDates.length > 0) {
    const checkDate = new Date();
    for (let i = 0; i < 365; i++) {
      const dateStr = checkDate.toISOString().split('T')[0];
      if (reviewDates.includes(dateStr)) {
        streakDays++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else if (i > 0) {
        break;
      } else {
        // Check yesterday if not reviewed today
        checkDate.setDate(checkDate.getDate() - 1);
      }
    }
  }
  
  return {
    totalCards: cards.length,
    dueToday,
    overdue,
    newCards,
    learningCards,
    matureCards,
    averageRetention: cards.length > 0 ? Math.round(totalRetention / cards.length) : 0,
    streakDays,
  };
}

/**
 * Optimize review schedule for Kenyan bar exam preparation
 * Prioritizes content based on:
 * 1. Time until exam
 * 2. Topic importance in ATP curriculum
 * 3. User's weak areas
 */
export function optimizeForExam(params: {
  cards: SpacedRepetitionCard[];
  daysUntilExam: number;
  weakUnits: string[];
  dailyReviewTarget: number;
}): {
  todayReviews: SpacedRepetitionCard[];
  priorityCards: SpacedRepetitionCard[];
  recommendedNewCards: number;
} {
  const { cards, daysUntilExam, weakUnits, dailyReviewTarget } = params;
  const today = new Date().toISOString().split('T')[0];
  
  // Score cards by priority
  const scoredCards = cards.map(card => {
    let score = 0;
    
    // Overdue penalties
    if (card.nextReviewDate < today) {
      const daysOverdue = Math.floor(
        (new Date(today).getTime() - new Date(card.nextReviewDate).getTime()) / (1000 * 60 * 60 * 24)
      );
      score += 100 + daysOverdue * 10;
    } else if (card.nextReviewDate === today) {
      score += 80;
    }
    
    // Weak area boost
    if (card.unitId && weakUnits.includes(card.unitId)) {
      score += 50;
    }
    
    // Low retention boost
    const retention = getRetentionStrength(card);
    if (retention < 50) score += (50 - retention);
    
    // Exam proximity urgency
    if (daysUntilExam < 30) {
      // Focus on mature cards (ensure they don't decay)
      if (getCardMaturity(card) === 'mature') score += 30;
    } else if (daysUntilExam < 60) {
      // Balance between new and review
      score += 20;
    }
    
    return { card, score };
  });
  
  // Sort by score descending
  scoredCards.sort((a, b) => b.score - a.score);
  
  // Get today's reviews
  const todayReviews = scoredCards
    .filter(sc => sc.card.nextReviewDate <= today)
    .slice(0, dailyReviewTarget)
    .map(sc => sc.card);
  
  // Get priority cards for pre-study
  const priorityCards = scoredCards
    .slice(0, 10)
    .map(sc => sc.card);
  
  // Recommend new cards based on exam proximity
  let recommendedNewCards: number;
  if (daysUntilExam < 14) {
    recommendedNewCards = 0; // Focus only on review
  } else if (daysUntilExam < 30) {
    recommendedNewCards = 3;
  } else if (daysUntilExam < 60) {
    recommendedNewCards = 5;
  } else {
    recommendedNewCards = 10;
  }
  
  return {
    todayReviews,
    priorityCards,
    recommendedNewCards,
  };
}

/**
 * Generate review session summary
 */
export function generateSessionSummary(
  reviewedCards: { card: SpacedRepetitionCard; quality: number }[]
): {
  cardsReviewed: number;
  correctCount: number;
  accuracy: number;
  averageQuality: number;
  needsRewatch: SpacedRepetitionCard[];
  recommendations: string[];
} {
  const correctCount = reviewedCards.filter(rc => rc.quality >= 3).length;
  const totalQuality = reviewedCards.reduce((sum, rc) => sum + rc.quality, 0);
  const needsRewatch = reviewedCards
    .filter(rc => rc.quality < 3)
    .map(rc => rc.card);
  
  const recommendations: string[] = [];
  const accuracy = reviewedCards.length > 0 ? correctCount / reviewedCards.length : 0;
  
  if (accuracy < 0.6) {
    recommendations.push('Consider reviewing the source material before your next session.');
  }
  if (needsRewatch.length > 3) {
    recommendations.push('You have several cards that need attention. Break them into smaller concepts.');
  }
  if (accuracy > 0.8 && reviewedCards.length > 10) {
    recommendations.push('Excellent session! Consider adding new material to continue growing.');
  }
  
  return {
    cardsReviewed: reviewedCards.length,
    correctCount,
    accuracy: Math.round(accuracy * 100),
    averageQuality: reviewedCards.length > 0 ? totalQuality / reviewedCards.length : 0,
    needsRewatch,
    recommendations,
  };
}
