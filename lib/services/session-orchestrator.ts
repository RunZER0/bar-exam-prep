/**
 * Session Orchestrator
 * 
 * The brain of Tutor OS - determines what the student should study next
 * based on coverage debt, spaced repetition, exam timeline, and performance.
 * 
 * Core algorithm:
 * 1. Calculate coverage debt per topic/skill
 * 2. Factor in SR review urgency
 * 3. Consider exam phase (foundation vs intensive vs revision)
 * 4. Balance new learning vs consolidation
 * 5. Respect daily time budget
 */

import { db } from '@/lib/db';
import { 
  users, userExamProfiles, examCycles, examEvents, microSkills, 
  studySessions, studyAssets, spacedRepetitionCards,
  outlineTopics
} from '@/lib/db/schema';
import { eq, and, sql, desc, asc, lte, inArray } from 'drizzle-orm';
import { ATP_UNITS } from '@/lib/constants/legal-content';

// Session types
export type SessionModality = 'READ' | 'QUIZ' | 'DRAFT' | 'ORAL' | 'REVIEW';
export type ExamPhase = 'foundation' | 'intensive' | 'revision' | 'final';

// Orchestration config per phase
const PHASE_CONFIG: Record<ExamPhase, {
  newLearningRatio: number;  // % of time on new topics
  reviewRatio: number;       // % of time on SR reviews
  practiceRatio: number;     // % of time on practice questions
  dailyMinutesTarget: number;
  sessionsPerDay: number;
}> = {
  foundation: {
    newLearningRatio: 0.60,
    reviewRatio: 0.20,
    practiceRatio: 0.20,
    dailyMinutesTarget: 120,
    sessionsPerDay: 4,
  },
  intensive: {
    newLearningRatio: 0.40,
    reviewRatio: 0.30,
    practiceRatio: 0.30,
    dailyMinutesTarget: 180,
    sessionsPerDay: 6,
  },
  revision: {
    newLearningRatio: 0.20,
    reviewRatio: 0.40,
    practiceRatio: 0.40,
    dailyMinutesTarget: 240,
    sessionsPerDay: 8,
  },
  final: {
    newLearningRatio: 0.10,
    reviewRatio: 0.50,
    practiceRatio: 0.40,
    dailyMinutesTarget: 180,
    sessionsPerDay: 6,
  },
};

/**
 * Determine exam phase based on days until written exam
 */
export function getExamPhase(daysToWritten: number): ExamPhase {
  if (daysToWritten > 180) return 'foundation';
  if (daysToWritten > 60) return 'intensive';
  if (daysToWritten > 14) return 'revision';
  return 'final';
}

/**
 * Calculate coverage debt for each unit/topic
 * Coverage debt = (required skills - practiced skills) / required skills
 * Since we don't have a dedicated mastery table, we calculate based on
 * completed study sessions.
 */
export async function calculateCoverageDebt(userId: string): Promise<Map<string, number>> {
  const debtMap = new Map<string, number>();

  // Get all skills
  const skills = await db.select().from(microSkills);
  
  // Get user's completed sessions
  const completedSessions = await db.select().from(studySessions)
    .where(and(
      eq(studySessions.userId, userId),
      eq(studySessions.status, 'COMPLETED')
    ));

  // Count practiced skills from sessions
  const practicedSkillIds = new Set<string>();
  for (const session of completedSessions) {
    const targetSkills = session.targetSkillIds || [];
    for (const skillId of targetSkills) {
      practicedSkillIds.add(skillId);
    }
  }

  // Group skills by unit
  const skillsByUnit = new Map<string, typeof skills>();
  for (const skill of skills) {
    const key = skill.unitId;
    if (!skillsByUnit.has(key)) {
      skillsByUnit.set(key, []);
    }
    skillsByUnit.get(key)!.push(skill);
  }

  // Calculate debt per unit
  for (const [unitId, unitSkills] of skillsByUnit) {
    const totalSkills = unitSkills.length;
    if (totalSkills === 0) {
      debtMap.set(unitId, 0);
      continue;
    }

    // Count practiced skills in this unit
    const practicedCount = unitSkills.filter(skill => 
      practicedSkillIds.has(skill.id)
    ).length;

    const debt = 1 - (practicedCount / totalSkills);
    debtMap.set(unitId, debt);
  }

  return debtMap;
}

/**
 * Get skills that need SR review today
 */
export async function getUrgentReviews(userId: string): Promise<string[]> {
  const today = new Date().toISOString().split('T')[0];
  
  const dueCards = await db.select().from(spacedRepetitionCards)
    .where(and(
      eq(spacedRepetitionCards.userId, userId),
      eq(spacedRepetitionCards.isActive, true),
      lte(spacedRepetitionCards.nextReviewDate, today)
    ))
    .orderBy(asc(spacedRepetitionCards.nextReviewDate))
    .limit(20);

  // Return unique skill IDs from due cards
  const skillIds = new Set<string>();
  for (const card of dueCards) {
    // Use contentId which may reference a skill
    if (card.contentId) {
      skillIds.add(card.contentId);
    }
  }
  
  return Array.from(skillIds);
}

/**
 * Main orchestration: Generate today's study sessions
 */
export async function orchestrateDailySessions(
  userId: string,
  options: {
    forceRefresh?: boolean;
    customMinutes?: number;
  } = {}
): Promise<{
  sessions: Array<{
    skillId: string;
    skillName: string;
    modality: SessionModality;
    estimatedMinutes: number;
    priority: number;
    rationale: string;
  }>;
  coverageDebt: Record<string, number>;
  phase: ExamPhase;
  dailyTarget: number;
}> {
  // Get user's exam profile
  const [profile] = await db.select({
    profile: userExamProfiles,
    cycle: examCycles,
  })
    .from(userExamProfiles)
    .leftJoin(examCycles, eq(userExamProfiles.cycleId, examCycles.id))
    .where(eq(userExamProfiles.userId, userId))
    .limit(1);

  if (!profile?.cycle) {
    throw new Error('User has no exam profile. Please complete onboarding.');
  }

  // Get written event to calculate days to exam
  const [writtenEvent] = await db.select().from(examEvents)
    .where(and(
      eq(examEvents.cycleId, profile.cycle.id),
      eq(examEvents.eventType, 'WRITTEN')
    ))
    .limit(1);

  // Calculate days to exam
  const daysToWritten = writtenEvent
    ? Math.ceil((new Date(writtenEvent.startsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : 180; // Default to foundation phase if no event
  const phase = getExamPhase(daysToWritten);
  const config = PHASE_CONFIG[phase];

  // Calculate coverage debt
  const coverageDebt = await calculateCoverageDebt(userId);
  
  // Get urgent reviews
  const urgentReviewSkills = await getUrgentReviews(userId);

  // Get all skills sorted by exam weight
  const allSkills = await db.select().from(microSkills)
    .orderBy(desc(microSkills.examWeight));

  // Calculate daily target (use user profile or config default)
  const dailyTarget = options.customMinutes || 
    config.dailyMinutesTarget;

  // Allocate time per activity type
  const reviewMinutes = Math.round(dailyTarget * config.reviewRatio);
  const newLearningMinutes = Math.round(dailyTarget * config.newLearningRatio);
  const practiceMinutes = Math.round(dailyTarget * config.practiceRatio);

  const sessions: Array<{
    skillId: string;
    skillName: string;
    modality: SessionModality;
    estimatedMinutes: number;
    priority: number;
    rationale: string;
  }> = [];

  let priority = 1;

  // 1. Add urgent reviews first
  if (urgentReviewSkills.length > 0 && reviewMinutes > 0) {
    const reviewsToAdd = Math.min(urgentReviewSkills.length, Math.ceil(reviewMinutes / 15));
    
    for (let i = 0; i < reviewsToAdd; i++) {
      const skillId = urgentReviewSkills[i];
      const skill = allSkills.find(s => s.id === skillId);
      
      if (skill) {
        sessions.push({
          skillId: skill.id,
          skillName: skill.title,
          modality: 'REVIEW',
          estimatedMinutes: 15,
          priority: priority++,
          rationale: 'SR review due - prevents forgetting',
        });
      }
    }
  }

  // 2. Add new learning sessions based on coverage debt
  const unitsWithDebt = Array.from(coverageDebt.entries())
    .filter(([_, debt]) => debt > 0.1)
    .sort((a, b) => b[1] - a[1]); // Sort by debt descending

  const newLearningCount = Math.ceil(newLearningMinutes / 25);
  let added = 0;

  for (const [unitId, debt] of unitsWithDebt) {
    if (added >= newLearningCount) break;

    // Find skills in this unit that need learning
    const unitSkills = allSkills.filter(s => s.unitId === unitId);
    
    for (const skill of unitSkills) {
      if (added >= newLearningCount) break;
      
      // Skip if already in sessions
      if (sessions.some(s => s.skillId === skill.id)) continue;

      const unit = ATP_UNITS.find(u => u.id === unitId);
      
      sessions.push({
        skillId: skill.id,
        skillName: skill.title,
        modality: 'READ',
        estimatedMinutes: 25,
        priority: priority++,
        rationale: `${unit?.name || 'Unit'} coverage gap: ${Math.round(debt * 100)}%`,
      });
      added++;
    }
  }

  // 3. Add practice sessions
  const practiceCount = Math.ceil(practiceMinutes / 20);
  
  for (let i = 0; i < practiceCount && sessions.length < config.sessionsPerDay; i++) {
    // Pick skill from recent learning or reviews
    const candidateSkills = sessions
      .filter(s => s.modality === 'READ' || s.modality === 'REVIEW')
      .slice(0, 3);

    if (candidateSkills.length > 0) {
      const sourceSkill = candidateSkills[i % candidateSkills.length];
      
      sessions.push({
        skillId: sourceSkill.skillId,
        skillName: sourceSkill.skillName,
        modality: 'QUIZ',
        estimatedMinutes: 20,
        priority: priority++,
        rationale: 'Practice reinforces learning',
      });
    }
  }

  // Convert coverage debt to object
  const debtObject: Record<string, number> = {};
  for (const [unitId, debt] of coverageDebt) {
    debtObject[unitId] = debt;
  }

  return {
    sessions: sessions.slice(0, config.sessionsPerDay),
    coverageDebt: debtObject,
    phase,
    dailyTarget,
  };
}

/**
 * Create and persist today's sessions in the database
 */
export async function createDailySessions(userId: string): Promise<string[]> {
  const today = new Date();
  const startOfDay = new Date(today.setHours(0, 0, 0, 0));
  const endOfDay = new Date(today.setHours(23, 59, 59, 999));

  // Check if sessions already exist for today
  const existingSessions = await db.select().from(studySessions)
    .where(and(
      eq(studySessions.userId, userId),
      sql`${studySessions.createdAt} >= ${startOfDay}`,
      sql`${studySessions.createdAt} <= ${endOfDay}`
    ));

  if (existingSessions.length > 0) {
    return existingSessions.map(s => s.id);
  }

  // Orchestrate new sessions
  const { sessions } = await orchestrateDailySessions(userId);

  // Insert sessions
  const sessionIds: string[] = [];
  
  for (const session of sessions) {
    // Map modality from orchestrator to schema enum
    const modalityMap: Record<string, 'WRITTEN' | 'ORAL' | 'DRAFTING' | 'REVIEW' | 'MIXED'> = {
      'READ': 'WRITTEN',
      'QUIZ': 'WRITTEN', 
      'DRAFT': 'DRAFTING',
      'ORAL': 'ORAL',
      'REVIEW': 'REVIEW',
    };
    
    const [created] = await db.insert(studySessions).values({
      userId,
      targetSkillIds: [session.skillId],
      modality: modalityMap[session.modality] || 'WRITTEN',
      status: 'QUEUED',
      estimatedMinutes: session.estimatedMinutes,
      stepsJson: ['notes', 'checkpoint', 'practice', 'grading', 'fix', 'summary'],
    }).returning();

    sessionIds.push(created.id);

    // Create placeholder assets using studyAssets table
    await db.insert(studyAssets).values([
      {
        sessionId: created.id,
        assetType: 'NOTES',
        status: 'GENERATING',
        contentJson: {},
        stepOrder: 0,
      },
      {
        sessionId: created.id,
        assetType: 'PRACTICE_SET', 
        status: 'GENERATING',
        contentJson: {},
        stepOrder: 2,
      },
    ]);
  }

  return sessionIds;
}

/**
 * Get session readiness summary
 */
export async function getSessionReadiness(userId: string): Promise<{
  ready: number;
  pending: number;
  generating: number;
  failed: number;
}> {
  const today = new Date();
  const startOfDay = new Date(today.setHours(0, 0, 0, 0));
  const endOfDay = new Date(today.setHours(23, 59, 59, 999));

  const sessions = await db.select().from(studySessions)
    .where(and(
      eq(studySessions.userId, userId),
      sql`${studySessions.createdAt} >= ${startOfDay}`,
      sql`${studySessions.createdAt} <= ${endOfDay}`
    ));

  let ready = 0;
  let pending = 0;
  let generating = 0;
  let failed = 0;

  for (const session of sessions) {
    const assets = await db.select().from(studyAssets)
      .where(eq(studyAssets.sessionId, session.id));

    const hasReady = assets.some(a => a.status === 'READY');
    const hasGenerating = assets.some(a => a.status === 'GENERATING');
    const hasFailed = assets.some(a => a.status === 'FAILED');

    if (hasReady) ready++;
    else if (hasFailed) failed++;
    else if (hasGenerating) generating++;
    else pending++;
  }

  return { ready, pending, generating, failed };
}
