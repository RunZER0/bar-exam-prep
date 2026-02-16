/**
 * Autopilot Precompute Engine
 * 
 * Ensures study sessions are READY before user clicks Start.
 * Called on GET /api/tutor/today to precompute top N sessions.
 * 
 * Flow:
 * 1. Get user's daily plan
 * 2. Ensure top N=2 sessions exist
 * 3. For each session, ensure 4 assets exist (NOTES, CHECKPOINT, PRACTICE_SET, RUBRIC)
 * 4. If assets missing, enqueue background jobs
 * 5. Return precompute status per session
 */

import { db } from '@/lib/db';
import {
  studySessions, studyAssets, backgroundJobs, microSkills,
  userExamProfiles, examCycles, examEvents, outlineTopics, skillOutlineMap
} from '@/lib/db/schema';
import { eq, and, sql, inArray, desc } from 'drizzle-orm';

// Asset types required for a complete session
const REQUIRED_ASSETS = ['NOTES', 'CHECKPOINT', 'PRACTICE_SET', 'RUBRIC'] as const;

// Precompute config
export const PRECOMPUTE_CONFIG = {
  sessionsToPrecompute: 2,  // Top N sessions to prepare
  maxConcurrentJobs: 5,     // Max parallel asset generation jobs
};

export interface PrecomputeStatus {
  sessionId: string;
  status: 'READY' | 'PREPARING' | 'QUEUED';
  assetsReady: number;
  assetsTotal: number;
  assets: Array<{
    type: string;
    status: 'READY' | 'GENERATING' | 'FAILED' | 'MISSING';
  }>;
}

export interface PrecomputeResult {
  sessions: PrecomputeStatus[];
  jobsEnqueued: number;
}

/**
 * Ensure sessions are precomputed for today
 * Called from GET /api/tutor/today
 */
export async function ensureSessionsPrecomputed(
  userId: string,
  skillIds: string[],
  modality: 'WRITTEN' | 'ORAL' | 'MIXED' = 'WRITTEN'
): Promise<PrecomputeResult> {
  const result: PrecomputeResult = {
    sessions: [],
    jobsEnqueued: 0,
  };

  // Limit to top N skills
  const topSkillIds = skillIds.slice(0, PRECOMPUTE_CONFIG.sessionsToPrecompute);

  for (const skillId of topSkillIds) {
    // Check if session already exists for this skill today
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    
    let [existingSession] = await db.select()
      .from(studySessions)
      .where(and(
        eq(studySessions.userId, userId),
        sql`${studySessions.targetSkillIds}::jsonb ? ${skillId}`,
        sql`${studySessions.createdAt} >= ${startOfDay}`
      ))
      .limit(1);

    // Create session if not exists
    if (!existingSession) {
      const [newSession] = await db.insert(studySessions)
        .values({
          userId,
          status: 'QUEUED',
          modality,
          targetSkillIds: [skillId],
          estimatedMinutes: 30,
        })
        .returning();
      existingSession = newSession;
    }

    // Get existing assets for this session
    const existingAssets = await db.select()
      .from(studyAssets)
      .where(eq(studyAssets.sessionId, existingSession.id));

    const assetMap = new Map(existingAssets.map(a => [a.assetType, a]));

    // Check each required asset
    const assetStatuses: PrecomputeStatus['assets'] = [];
    let assetsReady = 0;

    for (let i = 0; i < REQUIRED_ASSETS.length; i++) {
      const assetType = REQUIRED_ASSETS[i];
      const existingAsset = assetMap.get(assetType);

      if (existingAsset) {
        assetStatuses.push({
          type: assetType,
          status: existingAsset.status as 'READY' | 'GENERATING' | 'FAILED',
        });
        if (existingAsset.status === 'READY') {
          assetsReady++;
        }
      } else {
        // Asset missing - create it and enqueue job
        const [newAsset] = await db.insert(studyAssets)
          .values({
            sessionId: existingSession.id,
            assetType: assetType,
            status: 'GENERATING',
            contentJson: {},
            stepOrder: i,
            generationStartedAt: new Date(),
          })
          .returning();

        // Get grounding refs from outline topics
        const groundingRefs = await getGroundingRefs(skillId);

        // Enqueue generation job
        await db.insert(backgroundJobs).values({
          jobType: 'GENERATE_SESSION_ASSETS',
          userId,
          status: 'PENDING',
          priority: i + 1,  // Lower number = higher priority
          payloadJson: {
            sessionId: existingSession.id,
            assetId: newAsset.id,
            assetType,
            skillId,
            groundingRefs,
          },
        });

        result.jobsEnqueued++;
        assetStatuses.push({ type: assetType, status: 'GENERATING' });
      }
    }

    // Update session status based on assets
    let sessionStatus: 'READY' | 'PREPARING' | 'QUEUED' = 'QUEUED';
    if (assetsReady === REQUIRED_ASSETS.length) {
      sessionStatus = 'READY';
      await db.update(studySessions)
        .set({ status: 'READY' })
        .where(eq(studySessions.id, existingSession.id));
    } else if (assetsReady > 0 || existingAssets.length > 0) {
      sessionStatus = 'PREPARING';
      await db.update(studySessions)
        .set({ status: 'PREPARING' })
        .where(eq(studySessions.id, existingSession.id));
    }

    result.sessions.push({
      sessionId: existingSession.id,
      status: sessionStatus,
      assetsReady,
      assetsTotal: REQUIRED_ASSETS.length,
      assets: assetStatuses,
    });
  }

  return result;
}

/**
 * Get grounding references (outline topic IDs) for a skill
 */
async function getGroundingRefs(skillId: string): Promise<{ outline_topic_ids: string[]; source: string }> {
  const mappings = await db.select({
    topicId: skillOutlineMap.topicId,
  })
    .from(skillOutlineMap)
    .where(eq(skillOutlineMap.skillId, skillId));

  return {
    outline_topic_ids: mappings.map(m => m.topicId),
    source: 'ATP 2026 KSL Curriculum',
  };
}

/**
 * Check if a session is ready to start
 */
export async function isSessionReady(sessionId: string): Promise<boolean> {
  const assets = await db.select()
    .from(studyAssets)
    .where(eq(studyAssets.sessionId, sessionId));

  // Check all required assets are READY
  for (const assetType of REQUIRED_ASSETS) {
    const asset = assets.find(a => a.assetType === assetType);
    if (!asset || asset.status !== 'READY') {
      return false;
    }
  }

  return true;
}

/**
 * Get session with all assets (for instant start)
 */
export async function getSessionWithAssets(sessionId: string) {
  const [session] = await db.select()
    .from(studySessions)
    .where(eq(studySessions.id, sessionId))
    .limit(1);

  if (!session) return null;

  const assets = await db.select()
    .from(studyAssets)
    .where(eq(studyAssets.sessionId, sessionId))
    .orderBy(studyAssets.stepOrder);

  return {
    session,
    assets,
    isReady: assets.every(a => a.status === 'READY') && assets.length >= REQUIRED_ASSETS.length,
  };
}

/**
 * Precompute daily sessions for a user (called by background job)
 */
export async function precomputeTodaySessions(userId: string): Promise<void> {
  // Get user's exam profile
  const [profile] = await db.select({
    profile: userExamProfiles,
    cycle: examCycles,
  })
    .from(userExamProfiles)
    .leftJoin(examCycles, eq(userExamProfiles.cycleId, examCycles.id))
    .where(eq(userExamProfiles.userId, userId))
    .limit(1);

  if (!profile) {
    console.log(`No exam profile for user ${userId}`);
    return;
  }

  // Get all skills, prioritize by exam weight and urgency
  const skills = await db.select()
    .from(microSkills)
    .orderBy(desc(microSkills.examWeight))
    .limit(PRECOMPUTE_CONFIG.sessionsToPrecompute);

  const skillIds = skills.map(s => s.id);

  // Ensure sessions are precomputed
  await ensureSessionsPrecomputed(userId, skillIds, 'WRITTEN');
}
