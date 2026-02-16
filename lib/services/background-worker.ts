/**
 * Background Job Worker
 * 
 * Processes async jobs for Tutor OS:
 * 1. Generate session notes (AI-powered condensed notes)
 * 2. Generate practice sets (AI-powered questions)
 * 3. Generate weekly reports
 * 4. Precompute coverage analysis
 * 
 * M3: Retrieval-first generation with grounding from:
 * - outline_topics
 * - lecture_chunks (transcripts)
 * - vetted_authorities
 * 
 * Jobs are stored in the background_jobs table and processed
 * by this worker. In production, this would be triggered by
 * a cron job or queue system.
 */

import { db } from '@/lib/db';
import { 
  backgroundJobs, studyAssets, studySessions,
  microSkills, weeklyReports, userExamProfiles, evidenceSpans
} from '@/lib/db/schema';
import { eq, and, sql, asc, lte, isNull } from 'drizzle-orm';
import {
  retrieveGroundingForSkill,
  generateGroundedContent,
  buildGroundingRefsJson,
  logMissingAuthority,
  hasAdequateGrounding,
  GroundingSource
} from './retrieval-service';

// Job types
export type JobType = 
  | 'GENERATE_NOTES'
  | 'GENERATE_PRACTICE_SET'
  | 'GENERATE_WEEKLY_REPORT'
  | 'PRECOMPUTE_COVERAGE'
  | 'GENERATE_SESSION_ASSETS'  // M2: Generate all assets for a session
  | 'PRECOMPUTE_TODAY'         // M2: Precompute today's sessions for a user
  | 'GENERATE_RETEST_VARIANT'  // M2: Generate variant question for retest
  | 'RETRIEVE_AUTHORITIES'     // M4: Fetch and store authority records
  | 'SEND_REMINDER_EMAIL'      // M4: Send reminder email via Brevo
  | 'SEND_PUSH_REMINDER';      // M4: Send push notification

// Job status
export type JobStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

// Worker configuration
export const WORKER_CONFIG = {
  maxConcurrent: 3,
  pollIntervalMs: 5000,
  maxRetries: 3,
  jobTimeoutMs: 60000,
};

/**
 * Create a new background job
 */
export async function createJob(
  jobType: JobType,
  payload: Record<string, any>,
  priority: number = 5,
  scheduledFor?: Date
): Promise<string> {
  const [job] = await db.insert(backgroundJobs).values({
    jobType,
    payloadJson: payload,
    priority,
    scheduledFor: scheduledFor || new Date(),
    status: 'PENDING',
  }).returning();

  return job.id;
}

/**
 * Get next pending job to process
 */
export async function getNextJob(): Promise<typeof backgroundJobs.$inferSelect | null> {
  const now = new Date();

  const [job] = await db.select()
    .from(backgroundJobs)
    .where(and(
      eq(backgroundJobs.status, 'PENDING'),
      lte(backgroundJobs.scheduledFor, now)
    ))
    .orderBy(asc(backgroundJobs.priority), asc(backgroundJobs.scheduledFor))
    .limit(1);

  if (!job) return null;

  // Mark as processing
  await db.update(backgroundJobs)
    .set({
      status: 'PROCESSING',
      startedAt: now,
      attempts: sql`${backgroundJobs.attempts} + 1`,
    })
    .where(eq(backgroundJobs.id, job.id));

  return job;
}

/**
 * Process a single job
 */
export async function processJob(job: typeof backgroundJobs.$inferSelect): Promise<void> {
  try {
    const payload = job.payloadJson as Record<string, any>;

    switch (job.jobType) {
      case 'GENERATE_NOTES':
        await processGenerateNotes(payload);
        break;

      case 'GENERATE_PRACTICE_SET':
        await processGeneratePracticeSet(payload);
        break;

      case 'GENERATE_WEEKLY_REPORT':
        await processGenerateWeeklyReport(payload);
        break;

      case 'PRECOMPUTE_COVERAGE':
        await processPrecomputeCoverage(payload);
        break;

      case 'GENERATE_SESSION_ASSETS':
        await processGenerateSessionAssets(payload);
        break;

      case 'PRECOMPUTE_TODAY':
        await processPrecomputeToday(payload);
        break;

      case 'GENERATE_RETEST_VARIANT':
        await processGenerateRetestVariant(payload);
        break;

      case 'RETRIEVE_AUTHORITIES':
        await processRetrieveAuthorities(payload);
        break;

      case 'SEND_REMINDER_EMAIL':
        await processSendReminderEmail(payload);
        break;

      case 'SEND_PUSH_REMINDER':
        await processSendPushReminder(payload);
        break;

      default:
        throw new Error(`Unknown job type: ${job.jobType}`);
    }

    // Mark as completed
    await db.update(backgroundJobs)
      .set({
        status: 'COMPLETED',
        completedAt: new Date(),
        resultJson: { success: true },
      })
      .where(eq(backgroundJobs.id, job.id));

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    // Check if we should retry
    if ((job.attempts || 0) < WORKER_CONFIG.maxRetries) {
      // Requeue with exponential backoff
      const backoffMs = Math.pow(2, job.attempts || 0) * 10000;
      const retryAt = new Date(Date.now() + backoffMs);

      await db.update(backgroundJobs)
        .set({
          status: 'PENDING',
          scheduledFor: retryAt,
          errorMessage: errorMessage,
        })
        .where(eq(backgroundJobs.id, job.id));
    } else {
      // Mark as failed
      await db.update(backgroundJobs)
        .set({
          status: 'FAILED',
          completedAt: new Date(),
          errorMessage: errorMessage,
          resultJson: { success: false, error: errorMessage },
        })
        .where(eq(backgroundJobs.id, job.id));

      // If this was an asset generation job, update asset status
      const payloadObj = job.payloadJson as Record<string, any>;
      if (payloadObj.assetId) {
        await db.update(studyAssets)
          .set({ status: 'FAILED' })
          .where(eq(studyAssets.id, payloadObj.assetId));
      }
    }
  }
}

/**
 * Generate notes for a session
 */
async function processGenerateNotes(payload: Record<string, any>): Promise<void> {
  const { sessionId, assetId, skillId } = payload;

  // Get skill information
  const [skill] = await db.select().from(microSkills)
    .where(eq(microSkills.id, skillId))
    .limit(1);

  if (!skill) {
    throw new Error(`Skill not found: ${skillId}`);
  }

  // Update asset to GENERATING
  await db.update(studyAssets)
    .set({ status: 'GENERATING', generationStartedAt: new Date() })
    .where(eq(studyAssets.id, assetId));

  // TODO: Call AI service to generate notes
  // For now, create placeholder content
  const notesContent = {
    title: skill.title,
    sections: [
      {
        heading: 'Key Concepts',
        content: `Key concepts for ${skill.title} will be generated here.`,
      },
      {
        heading: 'Important Cases',
        content: 'Relevant Kenyan case law will be summarized here.',
      },
      {
        heading: 'Common Exam Questions',
        content: 'Typical exam question patterns will be highlighted.',
      },
    ],
    keyTakeaways: [
      'Takeaway 1',
      'Takeaway 2',
      'Takeaway 3',
    ],
    estimatedReadTime: 10,
  };

  // Update asset with generated content
  await db.update(studyAssets)
    .set({
      status: 'READY',
      contentJson: notesContent,
      generationCompletedAt: new Date(),
    })
    .where(eq(studyAssets.id, assetId));

  // Update session status to READY
  await db.update(studySessions)
    .set({ status: 'READY' })
    .where(eq(studySessions.id, sessionId));
}

/**
 * Generate practice questions for a session
 */
async function processGeneratePracticeSet(payload: Record<string, any>): Promise<void> {
  const { sessionId, assetId, skillId, questionCount = 5 } = payload;

  // Get skill information
  const [skill] = await db.select().from(microSkills)
    .where(eq(microSkills.id, skillId))
    .limit(1);

  if (!skill) {
    throw new Error(`Skill not found: ${skillId}`);
  }

  // Update asset to GENERATING
  await db.update(studyAssets)
    .set({ status: 'GENERATING', generationStartedAt: new Date() })
    .where(eq(studyAssets.id, assetId));

  // TODO: Call AI service to generate questions
  // For now, create placeholder questions
  const practiceSet = {
    skillId,
    skillName: skill.title,
    questions: Array.from({ length: questionCount }, (_, i) => ({
      id: `q${i + 1}`,
      type: i % 2 === 0 ? 'multiple_choice' : 'short_answer',
      question: `Sample question ${i + 1} about ${skill.title}`,
      options: i % 2 === 0 ? ['A', 'B', 'C', 'D'] : null,
      correctAnswer: i % 2 === 0 ? 'A' : 'Sample answer',
      explanation: `This tests your understanding of ${skill.title}`,
      difficulty: Math.ceil((i + 1) / 2),
    })),
    totalQuestions: questionCount,
  };

  // Update asset with generated content
  await db.update(studyAssets)
    .set({
      status: 'READY',
      contentJson: practiceSet,
      generationCompletedAt: new Date(),
    })
    .where(eq(studyAssets.id, assetId));

  // Check if all assets are ready for session
  const allAssets = await db.select().from(studyAssets)
    .where(eq(studyAssets.sessionId, sessionId));

  const allReady = allAssets.every(a => a.status === 'READY');
  
  if (allReady) {
    await db.update(studySessions)
      .set({ status: 'READY' })
      .where(eq(studySessions.id, sessionId));
  }
}

/**
 * Generate weekly progress report
 */
async function processGenerateWeeklyReport(payload: Record<string, any>): Promise<void> {
  const { userId, weekStart, weekEnd } = payload;

  // Get user's exam profile
  const [profile] = await db.select().from(userExamProfiles)
    .where(eq(userExamProfiles.userId, userId))
    .limit(1);

  if (!profile) {
    throw new Error(`Exam profile not found for user: ${userId}`);
  }

  // TODO: Calculate actual metrics from session data
  // For now, use placeholder data
  
  // Insert weekly report
  await db.insert(weeklyReports).values({
    userId,
    weekStart,
    weekEnd,
    totalSessions: 15,
    totalMinutes: 450,
    strongestSkills: ['Civil Procedure basics', 'Contract formation'],
    weakestSkills: ['Land registration', 'Constitutional interpretation'],
    nextWeekRecommendations: [
      'Focus more time on Land Law - it has the highest coverage debt',
      'Your Civil Procedure performance is strong - consider moving to advanced topics',
    ],
    reportGeneratedAt: new Date(),
  });
}

/**
 * Precompute coverage analysis
 */
async function processPrecomputeCoverage(payload: Record<string, any>): Promise<void> {
  const { userId } = payload;

  // TODO: Calculate coverage debt per unit/topic
  // This would analyze mastery items, session completion, etc.
  
  console.log(`Precomputing coverage for user ${userId}`);
  
  // Implementation would update cached coverage analysis
}

/**
 * M4: Generate session assets with activity variety + grounding enforcement
 * Pipeline: Blueprint → Retrieve → Compose → Validate → Persist
 */
async function processGenerateSessionAssets(payload: Record<string, any>): Promise<void> {
  const { sessionId, assetId, assetType, skillId } = payload;

  // Import generator modules
  const { 
    computeDefaultActivityMix, 
    getActivityTypesForAsset,
    getItemCountsForAsset,
  } = await import('./generators/session-blueprint');
  const { 
    generateActivityItems, 
    fetchPassagesWithAuthority,
  } = await import('./generators/written-generators');
  const { generateRubric } = await import('./generators/rubric-generator');
  const { validateAndFix } = await import('./generators/grounding-validator');
  const { retrieveAuthorities } = await import('./authority-retrieval-service');

  // Get skill information
  const [skill] = await db.select().from(microSkills)
    .where(eq(microSkills.id, skillId))
    .limit(1);

  if (!skill) {
    throw new Error(`Skill not found: ${skillId}`);
  }

  // Get session for blueprint context
  const [session] = await db.select().from(studySessions)
    .where(eq(studySessions.id, sessionId))
    .limit(1);

  if (!session) {
    throw new Error(`Session not found: ${sessionId}`);
  }

  // Update asset to GENERATING
  await db.update(studyAssets)
    .set({ status: 'GENERATING', generationStartedAt: new Date() })
    .where(eq(studyAssets.id, assetId));

  const skillTitle = skill.title || 'Unknown Skill';

  try {
    // STEP 1: Build Session Blueprint
    const blueprint = computeDefaultActivityMix({
      sessionId,
      userId: session.userId,
      targetSkillIds: session.targetSkillIds || [skillId],
      minutes: session.estimatedMinutes || 45,
      phase: (session as any).phase || 'approaching',
      skillMastery: [{ 
        skillId, 
        pMastery: 0.5, // Would fetch from mastery_items in production
        consecutiveWrong: 0,
      }],
    });

    // STEP 2: Retrieve authorities for this skill
    const retrieval = await retrieveAuthorities({
      skillId,
      skillName: skillTitle,
      concept: skill.description || skillTitle,
      jurisdiction: 'Kenya',
    });

    // Fetch passages with authority details
    const passages = await fetchPassagesWithAuthority(retrieval.authorities);

    // Get activity types for this asset
    const activityTypes = getActivityTypesForAsset(assetType as any, blueprint.activityMix);
    const itemCounts = getItemCountsForAsset(assetType as any, blueprint.activityMix);

    // STEP 3: Generate content based on asset type
    let contentJson: Record<string, any>;
    const allItems: any[] = [];
    const allEvidenceSpanIds: string[] = [];

    if (assetType === 'RUBRIC') {
      // Rubric needs practice set context - fetch it
      const practiceAssets = await db.select().from(studyAssets)
        .where(and(
          eq(studyAssets.sessionId, sessionId),
          eq(studyAssets.assetType, 'PRACTICE_SET'),
          eq(studyAssets.status, 'READY')
        )).limit(1);

      const practiceContent = practiceAssets[0]?.contentJson as any;
      const practiceItems = practiceContent?.items || [];

      const rubricResult = await generateRubric({
        skillName: skillTitle,
        practiceSetItems: practiceItems,
        passages,
        activityTypes,
      });

      allItems.push(...rubricResult.items);
      allEvidenceSpanIds.push(...rubricResult.evidenceSpanIds);
    } else {
      // Generate items for each activity type
      for (const [activityType, config] of itemCounts) {
        const generated = await generateActivityItems(activityType, {
          skillId,
          skillName: skillTitle,
          skillDescription: skill.description || undefined,
          authorities: retrieval.authorities,
          passages,
          phase: blueprint.phase,
          difficulty: config.difficulty,
          count: config.count,
        });

        allItems.push(...generated.items);
        allEvidenceSpanIds.push(...generated.evidenceSpanIds);
      }
    }

    // Build grounding refs from authorities
    const groundingRefs = {
      authority_ids: retrieval.authorities.map(a => a.authorityId),
      outline_topic_ids: [] as string[], // Would be filled from M3 retrieval
      lecture_chunk_ids: [] as string[], // Would be filled from M3 retrieval
    };

    // STEP 4: Validate grounding (hard gate)
    const assetContent = {
      assetType: assetType as 'NOTES' | 'CHECKPOINT' | 'PRACTICE_SET' | 'RUBRIC',
      items: allItems,
      activity_types: activityTypes,
      grounding_refs: groundingRefs,
    };

    const { content: validatedContent, wasFixed } = await validateAndFix(assetContent, {
      sessionId,
      assetId,
      skillId,
      skillName: skillTitle,
      strict: false, // Soft mode: replace ungrounded with fallback
    });

    // Build final content JSON with standardized format
    contentJson = {
      assetType,
      title: assetType === 'RUBRIC' 
        ? `Grading Rubric: ${skillTitle}`
        : assetType === 'NOTES'
        ? skillTitle
        : `${assetType}: ${skillTitle}`,
      skillId,
      items: validatedContent.items,
      groundingRefs,
      generatedAt: new Date().toISOString(),
      wasFixed,
      activityTypes: validatedContent.activity_types,
      stats: {
        totalItems: validatedContent.items.length,
        citedItems: validatedContent.items.filter(i => (i.citations?.length || 0) > 0).length,
        fallbackItems: validatedContent.items.filter(i => i.is_instruction_only).length,
      },
    };

    // STEP 5: Persist with activity_types
    await db.update(studyAssets)
      .set({
        status: 'READY',
        contentJson,
        groundingRefsJson: groundingRefs,
        activityTypes: validatedContent.activity_types,
        generationCompletedAt: new Date(),
      })
      .where(eq(studyAssets.id, assetId));

    // Create evidence spans for audit trail
    if (allEvidenceSpanIds.length > 0) {
      await createEvidenceSpansFromPassages(assetId, passages, allEvidenceSpanIds);
    }

  } catch (error) {
    // Mark asset as FAILED
    await db.update(studyAssets)
      .set({
        status: 'FAILED',
        generationError: error instanceof Error ? error.message : 'Unknown error',
        generationCompletedAt: new Date(),
      })
      .where(eq(studyAssets.id, assetId));
    throw error;
  }

  // Check if all assets are ready for session
  const allAssets = await db.select().from(studyAssets)
    .where(eq(studyAssets.sessionId, sessionId));

  const requiredTypes = ['NOTES', 'CHECKPOINT', 'PRACTICE_SET', 'RUBRIC'];
  const allReady = requiredTypes.every(type => 
    allAssets.some(a => a.assetType === type && a.status === 'READY')
  );
  
  if (allReady) {
    await db.update(studySessions)
      .set({ status: 'READY' })
      .where(eq(studySessions.id, sessionId));
  }
}

/**
 * Create evidence spans from passages (M4 version)
 */
async function createEvidenceSpansFromPassages(
  assetId: string,
  passages: any[],
  usedPassageIds: string[]
): Promise<void> {
  const usedPassages = passages.filter(p => usedPassageIds.includes(p.passageId));
  
  if (usedPassages.length === 0) return;

  const spans = usedPassages.map(passage => ({
    targetType: 'STUDY_ASSET',
    targetId: assetId,
    sourceType: 'AUTHORITY' as const,
    sourceId: passage.authorityId,
    authorityId: passage.authorityId,
    quotedText: passage.text.substring(0, 500),
    claimText: passage.title,
    locatorJson: passage.locator,
    confidenceScore: '1.0000',
    generatedBy: 'RETRIEVAL',
    isVerified: true,
    verbatimAllowed: passage.verbatimAllowed,
  }));

  try {
    await db.insert(evidenceSpans).values(spans);
  } catch (error) {
    console.error('Failed to create evidence spans:', error);
    // Non-fatal - don't fail asset generation
  }
}

// ============================================
// M3: GROUNDED CONTENT BUILDERS
// ============================================

/**
 * Build notes sections from grounded sources
 */
function buildNotesFromSources(skillTitle: string, sources: GroundingSource[]): Array<{heading: string; content: string}> {
  const outlines = sources.filter(s => s.type === 'OUTLINE_TOPIC');
  const lectures = sources.filter(s => s.type === 'LECTURE_CHUNK');
  const authorities = sources.filter(s => s.type === 'AUTHORITY');

  const sections: Array<{heading: string; content: string}> = [];

  // Key Concepts from outline topics
  if (outlines.length > 0) {
    sections.push({
      heading: 'Key Concepts',
      content: outlines.map(o => o.relevantText).join('\n\n') || `Core concepts for ${skillTitle} in the Kenyan legal context.`,
    });
  } else {
    sections.push({
      heading: 'Key Concepts',
      content: '*Not found in verified sources yet.* Please refer to your ATP materials.',
    });
  }

  // Lecture Insights
  if (lectures.length > 0) {
    sections.push({
      heading: 'Lecture Insights',
      content: lectures.slice(0, 3).map(l => 
        `> "${l.relevantText.substring(0, 300)}${l.relevantText.length > 300 ? '...' : ''}"\n— _${l.title}_`
      ).join('\n\n'),
    });
  }

  // Statutory Framework from authorities
  const statutes = authorities.filter(a => a.metadata?.authorityType === 'STATUTE');
  if (statutes.length > 0) {
    sections.push({
      heading: 'Statutory Framework',
      content: statutes.map(s => `**${s.title}**\n${s.metadata?.citation || ''}\n${s.relevantText}`).join('\n\n'),
    });
  } else {
    sections.push({
      heading: 'Statutory Framework',
      content: '*Not found in verified sources yet.*',
    });
  }

  // Case Law
  const cases = authorities.filter(a => a.metadata?.authorityType === 'CASE');
  if (cases.length > 0) {
    sections.push({
      heading: 'Case Law',
      content: cases.map(c => `**${c.title}**\n${c.relevantText}`).join('\n\n'),
    });
  }

  return sections;
}

/**
 * Build checkpoint questions from sources
 */
function buildCheckpointFromSources(skillTitle: string, sources: GroundingSource[]): Array<any> {
  const outlines = sources.filter(s => s.type === 'OUTLINE_TOPIC');
  
  // Generate comprehension questions based on outline topics
  const questions: Array<any> = outlines.slice(0, 2).map((outline, i) => ({
    id: `cp-${i + 1}`,
    type: 'comprehension',
    question: `Based on the topic "${outline.title}", what are the key elements you should identify?`,
    rubric: `Answer should identify core concepts from: ${outline.relevantText.substring(0, 100)}...`,
    groundedIn: outline.id,
  }));

  // Fallback if no outlines
  if (questions.length === 0) {
    questions.push({
      id: 'cp-1',
      type: 'comprehension',
      question: `What are the key elements of ${skillTitle}?`,
      rubric: 'Answer should identify 3-4 core elements.',
      missingGrounding: true,
    });
  }

  return questions;
}

/**
 * Build practice set from sources
 */
function buildPracticeSetFromSources(skillTitle: string, sources: GroundingSource[]): Array<any> {
  const outlines = sources.filter(s => s.type === 'OUTLINE_TOPIC');
  const authorities = sources.filter(s => s.type === 'AUTHORITY');

  const questions: Array<any> = [];

  // MCQ from outline topics
  outlines.slice(0, 2).forEach((outline, i) => {
    questions.push({
      id: `ps-${questions.length + 1}`,
      type: 'multiple_choice',
      question: `Which of the following best describes ${outline.title}?`,
      options: ['A', 'B', 'C', 'D'],  // Would be filled by AI
      difficulty: 2,
      groundedIn: outline.id,
    });
  });

  // Short answer from authorities
  authorities.slice(0, 2).forEach((auth) => {
    questions.push({
      id: `ps-${questions.length + 1}`,
      type: 'short_answer',
      question: `Explain the significance of ${auth.title} in relation to ${skillTitle}.`,
      difficulty: 3,
      groundedIn: auth.id,
      citation: auth.metadata?.citation,
    });
  });

  // Ensure we have at least 5 questions
  while (questions.length < 5) {
    questions.push({
      id: `ps-${questions.length + 1}`,
      type: questions.length < 3 ? 'multiple_choice' : 'short_answer',
      question: `Practice question ${questions.length + 1} for ${skillTitle}`,
      options: questions.length < 3 ? ['A', 'B', 'C', 'D'] : undefined,
      difficulty: Math.ceil((questions.length + 1) / 2),
      missingGrounding: true,
    });
  }

  return questions;
}

/**
 * Build rubric criteria from sources
 */
function buildRubricCriteria(skillTitle: string, sources: GroundingSource[]): Array<any> {
  const outlines = sources.filter(s => s.type === 'OUTLINE_TOPIC');
  const hasAuthorities = sources.some(s => s.type === 'AUTHORITY');

  const criteria = [
    { 
      name: 'Legal Analysis', 
      weight: 30, 
      description: 'Application of legal principles from outline topics',
      groundedIn: outlines.map(o => o.id),
    },
    { 
      name: 'Case Citation', 
      weight: hasAuthorities ? 25 : 15, 
      description: hasAuthorities 
        ? 'Reference to verified legal authorities' 
        : '*Limited verified authorities available*',
    },
    { 
      name: 'Statutory Framework', 
      weight: 25, 
      description: 'Statutory interpretation and application',
    },
    { 
      name: 'Practical Application', 
      weight: 20, 
      description: 'Real-world applicability to Kenyan legal practice',
    },
  ];

  return criteria;
}

/**
 * Create evidence spans for grounding audit trail
 */
async function createEvidenceSpans(
  targetId: string, 
  targetType: string, 
  sources: GroundingSource[]
): Promise<void> {
  if (sources.length === 0) return;

  const spans = sources.map(source => ({
    targetType,
    targetId,
    sourceType: source.type as 'OUTLINE_TOPIC' | 'LECTURE_CHUNK' | 'AUTHORITY',
    sourceId: source.id,
    quotedText: source.relevantText.substring(0, 500),
    claimText: source.title,
    confidenceScore: source.confidence?.toFixed(4) || '1.0000',
    generatedBy: 'RETRIEVAL',
    isVerified: source.type === 'AUTHORITY', // Authorities are pre-verified
  }));

  try {
    await db.insert(evidenceSpans).values(spans);
  } catch (error) {
    console.error('Failed to create evidence spans:', error);
    // Non-fatal - don't fail asset generation
  }
}

/**
 * M2: Precompute today's sessions for a user
 */
async function processPrecomputeToday(payload: Record<string, any>): Promise<void> {
  const { userId } = payload;

  // Dynamic import to avoid circular dependency
  const { precomputeTodaySessions } = await import('./autopilot-precompute');
  await precomputeTodaySessions(userId);
}

/**
 * M2: Generate variant question for retest (after incorrect answer)
 */
async function processGenerateRetestVariant(payload: Record<string, any>): Promise<void> {
  const { sessionId, assetId, originalQuestionId, skillId } = payload;

  // Get skill information
  const [skill] = await db.select().from(microSkills)
    .where(eq(microSkills.id, skillId))
    .limit(1);

  if (!skill) {
    throw new Error(`Skill not found: ${skillId}`);
  }

  // TODO: Call AI service to generate variant question
  // For now, create placeholder variant
  const variantContent = {
    originalQuestionId,
    variant: {
      id: `variant-${originalQuestionId}`,
      type: 'short_answer',
      question: `Alternative question testing the same concept from ${skill.title}`,
      hint: 'Consider the underlying principles rather than memorized facts',
      skillId,
    },
    generatedAt: new Date().toISOString(),
  };

  // Update asset with variant (append to existing content)
  const [existingAsset] = await db.select().from(studyAssets)
    .where(eq(studyAssets.id, assetId))
    .limit(1);

  const existingContent = (existingAsset?.contentJson as Record<string, any>) || {};
  const variants = existingContent.variants || [];
  variants.push(variantContent);

  await db.update(studyAssets)
    .set({
      contentJson: { ...existingContent, variants },
    })
    .where(eq(studyAssets.id, assetId));
}

/**
 * Queue asset generation jobs for a session
 */
export async function queueAssetGeneration(sessionId: string): Promise<string[]> {
  // Get session and its assets
  const [session] = await db.select().from(studySessions)
    .where(eq(studySessions.id, sessionId))
    .limit(1);

  if (!session) {
    throw new Error(`Session not found: ${sessionId}`);
  }

  // Get GENERATING assets (assets are created with GENERATING status)
  const assets = await db.select().from(studyAssets)
    .where(and(
      eq(studyAssets.sessionId, sessionId),
      eq(studyAssets.status, 'GENERATING')
    ));

  const jobIds: string[] = [];
  
  // Get the first skill ID from targetSkillIds
  const skillId = session.targetSkillIds?.[0];

  for (const asset of assets) {
    const jobType = asset.assetType === 'NOTES' 
      ? 'GENERATE_NOTES' 
      : 'GENERATE_PRACTICE_SET';

    const jobId = await createJob(
      jobType,
      {
        sessionId,
        assetId: asset.id,
        skillId,
      },
      asset.assetType === 'NOTES' ? 1 : 2 // Notes have higher priority
    );

    jobIds.push(jobId);
  }

  return jobIds;
}

/**
 * Queue weekly report generation for all active users
 */
export async function queueWeeklyReports(): Promise<number> {
  const profiles = await db.select().from(userExamProfiles);
  
  const now = new Date();
  // Calculate week start (Monday) and end (Sunday)
  const dayOfWeek = now.getDay();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
  weekStart.setHours(0, 0, 0, 0);
  
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);

  let queued = 0;

  for (const profile of profiles) {
    await createJob(
      'GENERATE_WEEKLY_REPORT',
      {
        userId: profile.userId,
        weekStart: weekStart.toISOString().split('T')[0],
        weekEnd: weekEnd.toISOString().split('T')[0],
      },
      10 // Lower priority than real-time assets
    );
    queued++;
  }

  return queued;
}

/**
 * Get ISO week number
 */
function getISOWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

// ============================================
// M4: AUTHORITY RETRIEVAL JOB
// ============================================

async function processRetrieveAuthorities(payload: Record<string, any>): Promise<void> {
  const { skillId, skillName, concept, jurisdiction } = payload;

  if (!skillId || !concept) {
    throw new Error('Missing skillId or concept');
  }

  // Import dynamically to avoid circular deps
  const { retrieveAuthorities } = await import('./authority-retrieval-service');

  const result = await retrieveAuthorities({
    skillId,
    skillName: skillName || 'Unknown Skill',
    concept,
    jurisdiction: jurisdiction || 'Kenya',
  });

  console.log(`[worker] Authority retrieval: ${result.success ? 'success' : 'fallback'}, found ${result.authorities.length} authorities`);
}

// ============================================
// M4: NOTIFICATION JOBS
// ============================================

async function processSendReminderEmail(payload: Record<string, any>): Promise<void> {
  const { userId, template, variables } = payload;

  if (!userId || !template) {
    throw new Error('Missing userId or template');
  }

  const { sendNotificationEmail } = await import('./notification-service');

  const result = await sendNotificationEmail(userId, template, variables || {});

  if (!result.success) {
    throw new Error('Email send failed');
  }

  console.log(`[worker] Sent reminder email to user ${userId}`);
}

async function processSendPushReminder(payload: Record<string, any>): Promise<void> {
  const { userId, title, body, url } = payload;

  if (!userId) {
    throw new Error('Missing userId');
  }

  const { sendPushNotification } = await import('./notification-service');

  const result = await sendPushNotification(userId, {
    title: title || 'Study Reminder',
    body: body || 'Time to study!',
    url: url || '/dashboard',
    icon: '/icons/icon-192x192.png',
    tag: 'reminder',
  });

  console.log(`[worker] Push notification: ${result.sent} sent, ${result.failed} failed`);
}

/**
 * Run worker loop (for development/testing)
 */
export async function runWorkerLoop(iterations: number = 10): Promise<void> {
  console.log(`Starting worker loop for ${iterations} iterations...`);

  for (let i = 0; i < iterations; i++) {
    const job = await getNextJob();
    
    if (job) {
      console.log(`Processing job ${job.id} (${job.jobType})`);
      await processJob(job);
    } else {
      console.log('No pending jobs, waiting...');
    }

    // Wait before next poll
    await new Promise(resolve => setTimeout(resolve, WORKER_CONFIG.pollIntervalMs));
  }

  console.log('Worker loop complete');
}
