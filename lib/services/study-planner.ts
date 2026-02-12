/**
 * AI Study Planner Service
 * 
 * Generates personalized study plans for Kenyan bar exam preparation.
 * Takes into account:
 * - User's weak areas and learning style
 * - KSL exam timeline
 * - Spaced repetition scheduling
 * - Daily study time availability
 * - ATP curriculum requirements
 */

import { ATP_UNITS } from '@/lib/constants/legal-content';

// Types
export interface UserStudyProfile {
  userId: string;
  weakUnits: string[];
  strongUnits: string[];
  dailyMinutes: number;
  weekendMinutes?: number;
  preferredStudyTime: 'morning' | 'afternoon' | 'evening' | 'flexible';
  learningStyle: 'visual' | 'reading' | 'practice' | 'mixed';
  targetExamDate?: string;
  previousAttempts: number;
  confidenceLevel: number; // 1-10
  commitmentLevel: 'casual' | 'moderate' | 'intensive';
}

export interface StudyPlanConfig {
  totalWeeks: number;
  dailyMinutes: number;
  focusAreas: string[];
  includeReview: boolean;
  includePractice: boolean;
  examDate?: string;
}

export interface DailyStudyItem {
  id: string;
  type: 'reading' | 'case_study' | 'practice_questions' | 'quiz' | 'review' | 'drafting' | 'research';
  title: string;
  description: string;
  unitId: string;
  estimatedMinutes: number;
  priority: 1 | 2 | 3; // 1=high, 2=medium, 3=low
  caseReference?: string;
  isSpacedRepetition: boolean;
  rationale: string;
}

export interface DailyPlan {
  date: string;
  dayOfWeek: number;
  isWeekend: boolean;
  totalMinutes: number;
  items: DailyStudyItem[];
  theme?: string; // Optional daily theme
}

export interface WeeklyPlan {
  weekNumber: number;
  startDate: string;
  endDate: string;
  focusUnits: string[];
  totalMinutes: number;
  days: DailyPlan[];
  weeklyGoals: string[];
  reviewTopics: string[];
}

export interface StudyPlan {
  id: string;
  userId: string;
  name: string;
  description: string;
  totalWeeks: number;
  currentWeek: number;
  targetExamDate?: string;
  weeks: WeeklyPlan[];
  metadata: {
    generatedAt: string;
    aiVersion: string;
    userProfileSnapshot: UserStudyProfile;
  };
}

// ATP Unit weights for study planning (based on exam importance)
const UNIT_WEIGHTS: Record<string, number> = {
  'atp-100': 15, // Civil Litigation - very important
  'atp-101': 15, // Criminal Litigation - very important
  'atp-102': 10, // Probate
  'atp-103': 12, // Legal Writing & Drafting
  'atp-104': 12, // Trial Advocacy
  'atp-105': 12, // Professional Ethics - critical
  'atp-106': 8,  // Legal Practice Management
  'atp-107': 10, // Conveyancing
  'atp-108': 6,  // Commercial Transactions
};

// Key cases by unit for case study recommendations
const KEY_CASES: Record<string, { name: string; citation: string; topic: string }[]> = {
  'atp-100': [
    { name: 'Anarita Karimi Njeru v Republic', citation: '[1979] KLR 154', topic: 'Constitutional petitions' },
    { name: 'Shah v Mbogo', citation: '[1967] EA 116', topic: 'Setting aside default judgment' },
    { name: 'Charles Njonjo v Kiplagat', citation: '[1984] KLR 569', topic: 'Preliminary objections' },
    { name: 'Republic v El Mann', citation: '[1969] EA 357', topic: 'Judicial review' },
  ],
  'atp-101': [
    { name: 'Republic v Koigi Wa Wamwere', citation: '[1992] KLR 133', topic: 'Bail principles' },
    { name: 'Abdikadir Sheikh v Republic', citation: '[2019] eKLR', topic: 'Fair trial rights' },
    { name: 'Republic v Dudley and Stephens', citation: '[1884] 14 QBD 273', topic: 'Necessity defence' },
    { name: 'Woolmington v DPP', citation: '[1935] AC 462', topic: 'Burden of proof' },
  ],
  'atp-102': [
    { name: 'In Re Estate of Ruenji', citation: '[2021] eKLR', topic: 'Testamentary capacity' },
    { name: 'In Re Estate of Ogony', citation: '[2018] eKLR', topic: 'Validity of wills' },
    { name: 'Mary Rono v Jane Rono', citation: '[2005] eKLR', topic: 'Law of succession and gender' },
  ],
  'atp-105': [
    { name: 'LSK v AG', citation: '[2013] eKLR', topic: 'Role of advocates' },
    { name: 'Gathii Wainaina v Mutuota', citation: '[1990] KLR 300', topic: 'Advocates fees' },
    { name: 'Bolton v Law Society', citation: '[1994] 1 WLR 512', topic: 'Professional misconduct' },
  ],
  'atp-107': [
    { name: 'Esiroyo v Esiroyo', citation: '[1973] EA 388', topic: 'Land registration' },
    { name: 'Obiero v Opiyo', citation: '[1972] EA 227', topic: 'Trust land' },
    { name: 'Muguthu v Muguthu', citation: '[2020] eKLR', topic: 'Family property' },
  ],
};

/**
 * Calculate days until exam
 */
function getDaysUntilExam(examDate?: string): number | null {
  if (!examDate) return null;
  const today = new Date();
  const exam = new Date(examDate);
  return Math.ceil((exam.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Generate a unique ID
 */
function generateId(): string {
  return `sp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Determine unit allocation based on user profile
 */
function calculateUnitAllocation(profile: UserStudyProfile): Map<string, number> {
  const allocation = new Map<string, number>();
  let totalWeight = 0;
  
  for (const unit of ATP_UNITS) {
    let weight = UNIT_WEIGHTS[unit.id] || 10;
    
    // Increase weight for weak areas
    if (profile.weakUnits.includes(unit.id)) {
      weight *= 1.5;
    }
    
    // Slightly decrease for strong areas (but don't neglect)
    if (profile.strongUnits.includes(unit.id)) {
      weight *= 0.8;
    }
    
    // Adjust based on proximity to exam
    const daysUntil = getDaysUntilExam(profile.targetExamDate);
    if (daysUntil !== null && daysUntil < 30) {
      // Focus more on high-weight (important) subjects near exam
      if (UNIT_WEIGHTS[unit.id] >= 12) {
        weight *= 1.2;
      }
    }
    
    allocation.set(unit.id, weight);
    totalWeight += weight;
  }
  
  // Normalize to percentages
  for (const [unitId, weight] of allocation) {
    allocation.set(unitId, Math.round((weight / totalWeight) * 100));
  }
  
  return allocation;
}

/**
 * Generate daily study items for a specific unit
 */
function generateUnitItems(
  unitId: string,
  minutes: number,
  profile: UserStudyProfile,
  dayIndex: number
): DailyStudyItem[] {
  const items: DailyStudyItem[] = [];
  const unit = ATP_UNITS.find(u => u.id === unitId);
  if (!unit) return items;
  
  let remainingMinutes = minutes;
  const isWeakArea = profile.weakUnits.includes(unitId);
  
  // Mix of activities based on learning style
  const activityDistribution = getActivityDistribution(profile.learningStyle, isWeakArea);
  
  for (const [activityType, percentage] of Object.entries(activityDistribution)) {
    const activityMinutes = Math.round(minutes * percentage);
    if (activityMinutes < 10) continue;
    
    const item = createStudyItem(
      unitId,
      unit,
      activityType as DailyStudyItem['type'],
      activityMinutes,
      isWeakArea,
      dayIndex
    );
    
    if (item) {
      items.push(item);
      remainingMinutes -= activityMinutes;
    }
  }
  
  return items;
}

/**
 * Get activity distribution based on learning style
 */
function getActivityDistribution(
  learningStyle: string,
  isWeakArea: boolean
): Record<string, number> {
  const distributions: Record<string, Record<string, number>> = {
    visual: {
      case_study: 0.35,
      reading: 0.25,
      practice_questions: 0.25,
      review: 0.15,
    },
    reading: {
      reading: 0.40,
      case_study: 0.25,
      practice_questions: 0.20,
      review: 0.15,
    },
    practice: {
      practice_questions: 0.40,
      quiz: 0.20,
      case_study: 0.25,
      review: 0.15,
    },
    mixed: {
      reading: 0.25,
      case_study: 0.25,
      practice_questions: 0.30,
      review: 0.20,
    },
  };
  
  let distribution = distributions[learningStyle] || distributions.mixed;
  
  // For weak areas, increase practice and review
  if (isWeakArea) {
    distribution = { ...distribution };
    distribution.practice_questions = (distribution.practice_questions || 0) + 0.1;
    distribution.review = (distribution.review || 0) + 0.05;
    // Normalize
    const total = Object.values(distribution).reduce((a, b) => a + b, 0);
    for (const key of Object.keys(distribution)) {
      distribution[key] /= total;
    }
  }
  
  return distribution;
}

/**
 * Create a study item
 */
function createStudyItem(
  unitId: string,
  unit: typeof ATP_UNITS[number],
  activityType: DailyStudyItem['type'],
  minutes: number,
  isWeakArea: boolean,
  dayIndex: number
): DailyStudyItem | null {
  const id = generateId();
  const cases = KEY_CASES[unitId] || [];
  
  const itemTemplates: Record<DailyStudyItem['type'], () => DailyStudyItem> = {
    reading: () => ({
      id,
      type: 'reading',
      title: `Read: ${unit.statutes?.[dayIndex % (unit.statutes?.length || 1)] || unit.name}`,
      description: `Study the key provisions and understand the structure of this legislation.`,
      unitId,
      estimatedMinutes: minutes,
      priority: isWeakArea ? 1 : 2,
      isSpacedRepetition: false,
      rationale: isWeakArea 
        ? 'Foundational reading for your weak area - builds understanding'
        : 'Maintaining knowledge of important statutes',
    }),
    case_study: () => {
      const caseItem = cases[dayIndex % cases.length] || { name: `${unit.name} Case Study`, citation: 'Various', topic: 'Key principles' };
      return {
        id,
        type: 'case_study',
        title: `Case Study: ${caseItem.name}`,
        description: `Analyze this landmark case on ${caseItem.topic}. Extract the ratio decidendi and relevant obiter dicta.`,
        unitId,
        estimatedMinutes: minutes,
        priority: 1,
        caseReference: caseItem.citation,
        isSpacedRepetition: false,
        rationale: 'Case law understanding is critical for practical application',
      };
    },
    practice_questions: () => ({
      id,
      type: 'practice_questions',
      title: `Practice: ${unit.name} Questions`,
      description: `Answer practice questions to test your understanding. Focus on applying principles to fact patterns.`,
      unitId,
      estimatedMinutes: minutes,
      priority: isWeakArea ? 1 : 2,
      isSpacedRepetition: false,
      rationale: isWeakArea
        ? 'Active recall strengthens memory in weak areas'
        : 'Regular practice maintains exam readiness',
    }),
    quiz: () => ({
      id,
      type: 'quiz',
      title: `Quiz: ${unit.name}`,
      description: `Timed quiz to assess your knowledge. Simulates exam conditions.`,
      unitId,
      estimatedMinutes: minutes,
      priority: 2,
      isSpacedRepetition: false,
      rationale: 'Regular testing identifies gaps and builds confidence',
    }),
    review: () => ({
      id,
      type: 'review',
      title: `Review: ${unit.name} Key Concepts`,
      description: `Review your notes and spaced repetition cards. Focus on frequently missed concepts.`,
      unitId,
      estimatedMinutes: minutes,
      priority: isWeakArea ? 1 : 3,
      isSpacedRepetition: true,
      rationale: 'Spaced repetition ensures long-term retention',
    }),
    drafting: () => ({
      id,
      type: 'drafting',
      title: `Draft: ${unit.name} Document`,
      description: `Practice drafting a document relevant to ${unit.name}. Focus on format and legal precision.`,
      unitId,
      estimatedMinutes: minutes,
      priority: 2,
      isSpacedRepetition: false,
      rationale: 'Drafting skills are tested in the practical exams',
    }),
    research: () => ({
      id,
      type: 'research',
      title: `Research: ${unit.name} Recent Developments`,
      description: `Research recent case law and statutory amendments in this area.`,
      unitId,
      estimatedMinutes: minutes,
      priority: 3,
      isSpacedRepetition: false,
      rationale: 'Staying current with legal developments shows depth',
    }),
  };
  
  return itemTemplates[activityType]?.() || null;
}

/**
 * Generate a daily plan
 */
function generateDailyPlan(
  date: string,
  profile: UserStudyProfile,
  unitAllocation: Map<string, number>,
  dayIndex: number
): DailyPlan {
  const dateObj = new Date(date);
  const dayOfWeek = dateObj.getDay();
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  
  const totalMinutes = isWeekend 
    ? (profile.weekendMinutes || profile.dailyMinutes * 1.5)
    : profile.dailyMinutes;
  
  // Select 2-3 units to focus on per day
  const sortedUnits = [...unitAllocation.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);
  
  // Rotate through units based on day
  const todayUnits = sortedUnits.slice(dayIndex % 2, (dayIndex % 2) + 2);
  
  const items: DailyStudyItem[] = [];
  let remainingMinutes = totalMinutes;
  
  for (const [unitId, allocation] of todayUnits) {
    const unitMinutes = Math.round((allocation / 100) * totalMinutes);
    const unitItems = generateUnitItems(unitId, Math.min(unitMinutes, remainingMinutes), profile, dayIndex);
    items.push(...unitItems);
    remainingMinutes -= unitItems.reduce((sum, item) => sum + item.estimatedMinutes, 0);
    
    if (remainingMinutes < 15) break;
  }
  
  // Add daily review if time allows
  if (remainingMinutes >= 15) {
    items.push({
      id: generateId(),
      type: 'review',
      title: 'Daily Spaced Repetition Review',
      description: 'Review your due cards from all subjects. Focus on cards marked for review.',
      unitId: 'all',
      estimatedMinutes: Math.min(remainingMinutes, 20),
      priority: 1,
      isSpacedRepetition: true,
      rationale: 'Daily review is essential for long-term retention',
    });
  }
  
  // Sort by priority
  items.sort((a, b) => a.priority - b.priority);
  
  // Build daily theme
  const primaryUnit = ATP_UNITS.find(u => u.id === todayUnits[0]?.[0]);
  const theme = primaryUnit ? `Focus: ${primaryUnit.name}` : undefined;
  
  return {
    date,
    dayOfWeek,
    isWeekend,
    totalMinutes: items.reduce((sum, item) => sum + item.estimatedMinutes, 0),
    items,
    theme,
  };
}

/**
 * Generate a weekly plan
 */
function generateWeeklyPlan(
  weekNumber: number,
  startDate: Date,
  profile: UserStudyProfile,
  unitAllocation: Map<string, number>
): WeeklyPlan {
  const days: DailyPlan[] = [];
  const currentDate = new Date(startDate);
  
  // Generate plan for each day of the week
  for (let i = 0; i < 7; i++) {
    const dateStr = currentDate.toISOString().split('T')[0];
    const dayPlan = generateDailyPlan(dateStr, profile, unitAllocation, weekNumber * 7 + i);
    days.push(dayPlan);
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  // Calculate end date
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + 6);
  
  // Determine focus units for the week
  const weekFocusUnits = [...unitAllocation.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice((weekNumber % 3) * 2, (weekNumber % 3) * 2 + 3)
    .map(([id]) => id);
  
  // Generate weekly goals
  const weeklyGoals = generateWeeklyGoals(weekNumber, weekFocusUnits, profile);
  
  // Determine review topics
  const reviewTopics = weekNumber > 0 
    ? [...unitAllocation.keys()].slice((weekNumber - 1) * 2 % 9, ((weekNumber - 1) * 2 % 9) + 2)
    : [];
  
  return {
    weekNumber,
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0],
    focusUnits: weekFocusUnits,
    totalMinutes: days.reduce((sum, day) => sum + day.totalMinutes, 0),
    days,
    weeklyGoals,
    reviewTopics,
  };
}

/**
 * Generate weekly goals based on focus
 */
function generateWeeklyGoals(
  weekNumber: number,
  focusUnits: string[],
  profile: UserStudyProfile
): string[] {
  const goals: string[] = [];
  
  // Add unit-specific goals
  for (const unitId of focusUnits.slice(0, 2)) {
    const unit = ATP_UNITS.find(u => u.id === unitId);
    if (unit) {
      if (profile.weakUnits.includes(unitId)) {
        goals.push(`Master fundamentals of ${unit.name}`);
      } else {
        goals.push(`Review and practice ${unit.name}`);
      }
    }
  }
  
  // Add general goals based on week number
  if (weekNumber === 0) {
    goals.push('Complete self-assessment in all ATP units');
  } else if (weekNumber % 4 === 0) {
    goals.push('Take a full mock exam to assess progress');
  } else if (weekNumber % 2 === 0) {
    goals.push('Complete at least 3 practice quizzes');
  }
  
  // Add commitment-based goals
  if (profile.commitmentLevel === 'intensive') {
    goals.push('Complete all daily study items');
  } else {
    goals.push('Complete at least 80% of scheduled items');
  }
  
  return goals;
}

/**
 * Main function: Generate a complete study plan
 */
export function generateStudyPlan(profile: UserStudyProfile): StudyPlan {
  const daysUntilExam = getDaysUntilExam(profile.targetExamDate);
  
  // Calculate number of weeks
  let totalWeeks: number;
  if (daysUntilExam !== null) {
    totalWeeks = Math.min(Math.ceil(daysUntilExam / 7), 24);
  } else {
    // Default based on commitment level
    totalWeeks = profile.commitmentLevel === 'intensive' ? 8 
      : profile.commitmentLevel === 'moderate' ? 12 
      : 16;
  }
  
  // Calculate unit allocation
  const unitAllocation = calculateUnitAllocation(profile);
  
  // Generate weekly plans
  const weeks: WeeklyPlan[] = [];
  const startDate = new Date();
  startDate.setHours(0, 0, 0, 0);
  
  for (let i = 0; i < totalWeeks; i++) {
    const weekStart = new Date(startDate);
    weekStart.setDate(weekStart.getDate() + i * 7);
    weeks.push(generateWeeklyPlan(i, weekStart, profile, unitAllocation));
  }
  
  return {
    id: generateId(),
    userId: profile.userId,
    name: `Bar Exam Prep Plan - ${new Date().toLocaleDateString()}`,
    description: generatePlanDescription(profile, totalWeeks, daysUntilExam),
    totalWeeks,
    currentWeek: 1,
    targetExamDate: profile.targetExamDate,
    weeks,
    metadata: {
      generatedAt: new Date().toISOString(),
      aiVersion: '1.0.0',
      userProfileSnapshot: profile,
    },
  };
}

/**
 * Generate plan description
 */
function generatePlanDescription(
  profile: UserStudyProfile,
  totalWeeks: number,
  daysUntilExam: number | null
): string {
  const parts: string[] = [];
  
  parts.push(`${totalWeeks}-week personalized study plan`);
  
  if (daysUntilExam !== null) {
    parts.push(`targeting your ${profile.targetExamDate} exam date`);
  }
  
  if (profile.weakUnits.length > 0) {
    const weakNames = profile.weakUnits
      .map(id => ATP_UNITS.find(u => u.id === id)?.name)
      .filter(Boolean)
      .slice(0, 2);
    parts.push(`with extra focus on ${weakNames.join(' and ')}`);
  }
  
  return parts.join(', ') + '.';
}

/**
 * Get today's study items from an active plan
 */
export function getTodayStudyItems(plan: StudyPlan): DailyPlan | null {
  const today = new Date().toISOString().split('T')[0];
  
  for (const week of plan.weeks) {
    for (const day of week.days) {
      if (day.date === today) {
        return day;
      }
    }
  }
  
  return null;
}

/**
 * Adjust plan based on user performance
 */
export function adjustPlanBasedOnPerformance(
  plan: StudyPlan,
  recentScores: { unitId: string; score: number }[]
): StudyPlan {
  // Calculate new weak/strong areas based on performance
  const newWeakUnits: string[] = [];
  const newStrongUnits: string[] = [];
  
  for (const { unitId, score } of recentScores) {
    if (score < 50) {
      newWeakUnits.push(unitId);
    } else if (score > 80) {
      newStrongUnits.push(unitId);
    }
  }
  
  // If weaknesses changed, regenerate remaining weeks
  if (newWeakUnits.length > 0 || newStrongUnits.length > 0) {
    const updatedProfile: UserStudyProfile = {
      ...plan.metadata.userProfileSnapshot,
      weakUnits: [...new Set([...plan.metadata.userProfileSnapshot.weakUnits, ...newWeakUnits])],
      strongUnits: [...new Set([...plan.metadata.userProfileSnapshot.strongUnits, ...newStrongUnits])],
    };
    
    // Find current week index
    const today = new Date().toISOString().split('T')[0];
    let currentWeekIndex = 0;
    for (let i = 0; i < plan.weeks.length; i++) {
      if (plan.weeks[i].startDate <= today && plan.weeks[i].endDate >= today) {
        currentWeekIndex = i;
        break;
      }
    }
    
    // Regenerate from next week onwards
    const unitAllocation = calculateUnitAllocation(updatedProfile);
    for (let i = currentWeekIndex + 1; i < plan.weeks.length; i++) {
      const weekStart = new Date(plan.weeks[i].startDate);
      plan.weeks[i] = generateWeeklyPlan(i, weekStart, updatedProfile, unitAllocation);
    }
    
    plan.metadata.userProfileSnapshot = updatedProfile;
  }
  
  return plan;
}

/**
 * Calculate plan completion statistics
 */
export function calculatePlanStats(plan: StudyPlan): {
  totalItems: number;
  completedItems: number;
  completionPercentage: number;
  totalMinutes: number;
  minutesCompleted: number;
  currentWeek: number;
  daysRemaining: number | null;
  onTrack: boolean;
} {
  let totalItems = 0;
  let completedItems = 0;
  let totalMinutes = 0;
  let minutesCompleted = 0;
  const today = new Date().toISOString().split('T')[0];
  let currentWeek = 1;
  
  for (let i = 0; i < plan.weeks.length; i++) {
    const week = plan.weeks[i];
    if (week.startDate <= today && week.endDate >= today) {
      currentWeek = i + 1;
    }
    
    for (const day of week.days) {
      for (const item of day.items) {
        totalItems++;
        totalMinutes += item.estimatedMinutes;
        
        // Check if day has passed (items should be "completed" for calculation)
        if (day.date < today) {
          // In a real implementation, check actual completion status
          completedItems++;
          minutesCompleted += item.estimatedMinutes;
        }
      }
    }
  }
  
  const daysRemaining = plan.targetExamDate 
    ? getDaysUntilExam(plan.targetExamDate)
    : null;
  
  const expectedCompletion = (currentWeek / plan.totalWeeks) * 100;
  const actualCompletion = totalItems > 0 ? (completedItems / totalItems) * 100 : 0;
  
  return {
    totalItems,
    completedItems,
    completionPercentage: Math.round(actualCompletion),
    totalMinutes,
    minutesCompleted,
    currentWeek,
    daysRemaining,
    onTrack: actualCompletion >= expectedCompletion - 10,
  };
}

/**
 * Get recommended cases for today based on plan
 */
export function getTodayCaseRecommendations(plan: StudyPlan): {
  case: string;
  citation: string;
  topic: string;
  unitName: string;
  rationale: string;
}[] {
  const today = getTodayStudyItems(plan);
  if (!today) return [];
  
  const recommendations: {
    case: string;
    citation: string;
    topic: string;
    unitName: string;
    rationale: string;
  }[] = [];
  
  for (const item of today.items) {
    if (item.type === 'case_study' && item.caseReference) {
      const unit = ATP_UNITS.find(u => u.id === item.unitId);
      const cases = KEY_CASES[item.unitId] || [];
      const caseInfo = cases.find(c => c.citation === item.caseReference);
      
      if (caseInfo && unit) {
        recommendations.push({
          case: caseInfo.name,
          citation: caseInfo.citation,
          topic: caseInfo.topic,
          unitName: unit.name,
          rationale: item.rationale,
        });
      }
    }
  }
  
  return recommendations;
}
