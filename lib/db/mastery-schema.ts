/**
 * YNAI Mastery Engine v3 - Database Schema
 * 
 * This schema implements the complete Curriculum Knowledge Graph (CKG),
 * Evidence Ledger, Mastery State Machine, Gate System, and Planner tables.
 * 
 * Key principles:
 * - P0: Evidence over vibes (every feedback ties to rubric/transcript/authority)
 * - P1: Mastery is measured, not self-declared
 * - P2: System outputs daily plans, not "top 5 ideas"
 * - P3: No mastery without timed proof
 * - P4: Orals and written are different engines
 */

import { pgTable, text, timestamp, uuid, boolean, integer, real, jsonb, pgEnum, date, uniqueIndex } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users } from './schema';

// ============================================
// ENUMS
// ============================================

export const formatTagEnum = pgEnum('format_tag', ['written', 'oral', 'drafting']);
export const skillEdgeTypeEnum = pgEnum('skill_edge_type', ['prerequisite_of', 'related_to', 'builds_on']);
export const authorityTypeEnum = pgEnum('authority_type', ['statute', 'case', 'regulation', 'practice_note', 'constitution']);
export const itemTypeEnum = pgEnum('item_type', ['mcq', 'issue_spot', 'drafting_task', 'oral_prompt', 'mock_paper', 'flashcard']);
export const itemSourceEnum = pgEnum('item_source', ['generated', 'past_paper', 'curated', 'ksl_mock']);
export const rubricTypeEnum = pgEnum('rubric_type', ['written', 'oral', 'drafting', 'mcq']);
export const attemptModeEnum = pgEnum('attempt_mode', ['practice', 'timed', 'exam_sim']);
export const attemptFormatEnum = pgEnum('attempt_format', ['written', 'oral', 'drafting', 'mcq']);
export const errorSeverityEnum = pgEnum('error_severity', ['minor', 'moderate', 'critical']);
export const evidenceSourceTypeEnum = pgEnum('evidence_source_type', ['lecture', 'authority', 'rubric']);
export const planItemStatusEnum = pgEnum('plan_item_status', ['pending', 'in_progress', 'completed', 'skipped', 'deferred']);
export const examPhaseEnum = pgEnum('exam_phase', ['distant', 'approaching', 'critical']);

// ============================================
// 1. CURRICULUM KNOWLEDGE GRAPH (CKG)
// ============================================

/**
 * Domains - Major subject areas within each ATP unit
 * e.g., "Evidence Admissibility" within Criminal Litigation
 */
export const domains = pgTable('domains', {
  id: uuid('id').defaultRandom().primaryKey(),
  unitId: text('unit_id').notNull(), // References ATP unit code (atp-100, etc.)
  name: text('name').notNull(),
  description: text('description'),
  order: integer('order').default(0).notNull(),
  examWeight: real('exam_weight').default(0.1).notNull(), // 0-1
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

/**
 * Micro-skills - The atomic units of competency
 * e.g., "Identify hearsay exceptions under Evidence Act s.34"
 */
export const microSkills = pgTable('micro_skills', {
  id: uuid('id').defaultRandom().primaryKey(),
  unitId: text('unit_id').notNull(),
  domainId: uuid('domain_id').references(() => domains.id),
  name: text('name').notNull(),
  description: text('description'),
  formatTags: jsonb('format_tags').$type<('written' | 'oral' | 'drafting')[]>().default(['written']).notNull(),
  examWeight: real('exam_weight').default(0.05).notNull(), // 0-1, contribution to unit score
  difficulty: integer('difficulty').default(3).notNull(), // 1-5
  estimatedMinutes: integer('estimated_minutes').default(15).notNull(),
  isCore: boolean('is_core').default(false).notNull(), // Must-pass for unit mastery
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

/**
 * Skill edges - Prerequisites and relationships between skills
 */
export const skillEdges = pgTable('skill_edges', {
  id: uuid('id').defaultRandom().primaryKey(),
  fromSkillId: uuid('from_skill_id').references(() => microSkills.id).notNull(),
  toSkillId: uuid('to_skill_id').references(() => microSkills.id).notNull(),
  edgeType: skillEdgeTypeEnum('edge_type').default('prerequisite_of').notNull(),
  strength: real('strength').default(1.0).notNull(), // 0-1, how strongly the prerequisite applies
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

/**
 * Lectures - KSL recordings and transcripts
 */
export const lectures = pgTable('lectures', {
  id: uuid('id').defaultRandom().primaryKey(),
  unitId: text('unit_id').notNull(),
  title: text('title').notNull(),
  lecturerName: text('lecturer_name'),
  lectureDate: date('lecture_date'),
  durationMinutes: integer('duration_minutes'),
  transcriptFileId: text('transcript_file_id'), // Storage reference
  transcriptText: text('transcript_text'), // Full transcript (for search)
  audioFileId: text('audio_file_id'),
  isProcessed: boolean('is_processed').default(false).notNull(),
  processingError: text('processing_error'),
  chunkCount: integer('chunk_count').default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

/**
 * Lecture chunks - Embedded sections for retrieval
 */
export const lectureChunks = pgTable('lecture_chunks', {
  id: uuid('id').defaultRandom().primaryKey(),
  lectureId: uuid('lecture_id').references(() => lectures.id).notNull(),
  chunkIndex: integer('chunk_index').notNull(),
  content: text('content').notNull(),
  startOffset: integer('start_offset').notNull(), // Character offset in transcript
  endOffset: integer('end_offset').notNull(),
  startTime: integer('start_time'), // Seconds into lecture (if available)
  endTime: integer('end_time'),
  embedding: jsonb('embedding').$type<number[]>(), // Vector embedding
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

/**
 * Lecture-skill mapping - Which skills are taught in which lecture segments
 */
export const lectureSkillMap = pgTable('lecture_skill_map', {
  id: uuid('id').defaultRandom().primaryKey(),
  lectureId: uuid('lecture_id').references(() => lectures.id).notNull(),
  skillId: uuid('skill_id').references(() => microSkills.id).notNull(),
  chunkId: uuid('chunk_id').references(() => lectureChunks.id),
  confidence: real('confidence').default(0.8).notNull(), // 0-1, how confident the mapping
  evidenceStartOffset: integer('evidence_start_offset'), // Where in transcript
  evidenceEndOffset: integer('evidence_end_offset'),
  isVerified: boolean('is_verified').default(false).notNull(),
  verifiedById: uuid('verified_by_id').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

/**
 * Authorities - Vetted legal sources (statutes, cases, regulations)
 */
export const authorities = pgTable('authorities', {
  id: uuid('id').defaultRandom().primaryKey(),
  authorityType: authorityTypeEnum('authority_type').notNull(),
  title: text('title').notNull(),
  citation: text('citation').notNull(),
  fullText: text('full_text'), // Full text of statute section or case holding
  summary: text('summary'), // AI-generated or human summary
  url: text('url'),
  year: integer('year'),
  court: text('court'), // For cases
  isVerified: boolean('is_verified').default(false).notNull(),
  verifiedById: uuid('verified_by_id').references(() => users.id),
  importance: integer('importance').default(2).notNull(), // 1-3
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

/**
 * Skill-authority mapping - Which authorities support which skills
 */
export const skillAuthorityMap = pgTable('skill_authority_map', {
  id: uuid('id').defaultRandom().primaryKey(),
  skillId: uuid('skill_id').references(() => microSkills.id).notNull(),
  authorityId: uuid('authority_id').references(() => authorities.id).notNull(),
  relevance: real('relevance').default(0.8).notNull(), // 0-1
  isPrimary: boolean('is_primary').default(false).notNull(),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

/**
 * Rubrics - Grading schemas for different item types
 */
export const rubrics = pgTable('rubrics', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  rubricType: rubricTypeEnum('rubric_type').notNull(),
  unitId: text('unit_id'), // Unit-specific rubric, or null for general
  schemaJson: jsonb('schema_json').$type<{
    categories: {
      name: string;
      weight: number;
      criteria: {
        description: string;
        maxScore: number;
        mustHavePoints?: string[];
      }[];
    }[];
    totalMarks: number;
  }>().notNull(),
  version: integer('version').default(1).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

/**
 * Items - Unified item bank (questions, prompts, tasks)
 * CRITICAL: All items MUST be skill-tagged via item_skill_map
 */
export const items = pgTable('items', {
  id: uuid('id').defaultRandom().primaryKey(),
  itemType: itemTypeEnum('item_type').notNull(),
  format: attemptFormatEnum('format'), // Item format (written, oral, drafting, mcq)
  unitId: text('unit_id').notNull(),
  domainId: uuid('domain_id').references(() => domains.id),
  prompt: text('prompt').notNull(),
  context: text('context'), // Additional context for the question
  difficulty: integer('difficulty').default(3).notNull(), // 1-5
  estimatedMinutes: integer('estimated_minutes').default(15).notNull(),
  rubricId: uuid('rubric_id').references(() => rubrics.id),
  source: itemSourceEnum('source').default('generated').notNull(),
  // For MCQ items
  options: jsonb('options').$type<{ label: string; text: string; isCorrect: boolean }[]>(),
  // For issue spotting / written
  modelAnswer: text('model_answer'),
  keyPoints: jsonb('key_points').$type<string[]>(),
  // Metadata
  pastPaperYear: integer('past_paper_year'),
  pastPaperQuestion: text('past_paper_question'), // e.g., "Q3a"
  timesUsed: integer('times_used').default(0).notNull(),
  avgScore: real('avg_score'), // Rolling average score
  isActive: boolean('is_active').default(true).notNull(),
  isVerified: boolean('is_verified').default(false).notNull(),
  verifiedById: uuid('verified_by_id').references(() => users.id),
  // Stable identity hash for idempotent seeding
  itemHash: text('item_hash').unique(), // sha256(prompt|item_type|unit_id|difficulty)
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

/**
 * Item-skill mapping - CRITICAL: Links items to micro-skills
 * Without this, the entire mastery system cannot function
 */
export const itemSkillMap = pgTable('item_skill_map', {
  id: uuid('id').defaultRandom().primaryKey(),
  itemId: uuid('item_id').references(() => items.id).notNull(),
  skillId: uuid('skill_id').references(() => microSkills.id).notNull(),
  coverageWeight: real('coverage_weight').default(1.0).notNull(), // 0-1, how much this item tests the skill
  isPrimary: boolean('is_primary').default(false).notNull(), // Main skill being tested
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  itemSkillUnique: uniqueIndex('item_skill_unique').on(table.itemId, table.skillId),
}));

// ============================================
// 2. EVIDENCE LEDGER (AUDIT TRAIL)
// ============================================

/**
 * Error tags - Categorized error types for tracking patterns
 */
export const errorTags = pgTable('error_tags', {
  id: uuid('id').defaultRandom().primaryKey(),
  code: text('code').notNull().unique(), // e.g., "WRONG_RELIEF", "MISSED_ISSUE", "STATUTE_ERROR"
  name: text('name').notNull(),
  description: text('description'),
  category: text('category').notNull(), // e.g., "substantive", "procedural", "drafting"
  severity: errorSeverityEnum('severity').default('moderate').notNull(),
  unitId: text('unit_id'), // null = applies to all units
  suggestedDrillSkills: jsonb('suggested_drill_skills').$type<string[]>(), // Skill IDs
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

/**
 * Attempts - The core evidence table for all user submissions
 */
export const attempts = pgTable('attempts', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  itemId: uuid('item_id').references(() => items.id).notNull(),
  mode: attemptModeEnum('mode').notNull(),
  format: attemptFormatEnum('format').notNull(),
  // Timing
  startedAt: timestamp('started_at').notNull(),
  submittedAt: timestamp('submitted_at'),
  timeTakenSec: integer('time_taken_sec'),
  timeAllowedSec: integer('time_allowed_sec'), // For timed attempts
  // Content
  rawAnswerText: text('raw_answer_text'), // Written/drafting response
  transcriptText: text('transcript_text'), // Oral response transcription
  audioFileId: text('audio_file_id'), // For oral attempts
  // Scoring
  scoreNorm: real('score_norm'), // 0-1 normalized score
  scoreRaw: integer('score_raw'), // Raw marks
  maxScore: integer('max_score'),
  rubricBreakdownJson: jsonb('rubric_breakdown_json').$type<{
    category: string;
    score: number;
    maxScore: number;
    feedback: string;
    evidenceSpans?: { start: number; end: number }[];
  }[]>(),
  // Feedback
  feedbackJson: jsonb('feedback_json').$type<{
    summary: string;
    strengths: string[];
    weaknesses: string[];
    nextSteps: string[];
    modelOutline?: string;
    evidenceRequests?: string[];
  }>(),
  // Error tracking
  errorTagIds: jsonb('error_tag_ids').$type<string[]>(), // UUIDs of error tags
  nextDrillSkillIds: jsonb('next_drill_skill_ids').$type<string[]>(), // Suggested skills to practice
  // Metadata
  isComplete: boolean('is_complete').default(false).notNull(),
  isGraded: boolean('is_graded').default(false).notNull(),
  gradedAt: timestamp('graded_at'),
  gradingModel: text('grading_model'), // Which AI model graded
  sessionId: uuid('session_id'), // Group attempts from same session
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

/**
 * Attempt-error tag junction - Tracks which errors occurred in which attempts
 */
export const attemptErrorTags = pgTable('attempt_error_tags', {
  id: uuid('id').defaultRandom().primaryKey(),
  attemptId: uuid('attempt_id').references(() => attempts.id).notNull(),
  errorTagId: uuid('error_tag_id').references(() => errorTags.id).notNull(),
  weight: real('weight').default(1.0).notNull(), // How severely the error manifested
  location: text('location'), // Where in the response the error occurred
  excerpt: text('excerpt'), // Relevant excerpt showing the error
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

/**
 * Evidence spans - Attach receipts to feedback (links to source material)
 */
export const evidenceSpans = pgTable('evidence_spans', {
  id: uuid('id').defaultRandom().primaryKey(),
  attemptId: uuid('attempt_id').references(() => attempts.id).notNull(),
  sourceType: evidenceSourceTypeEnum('source_type').notNull(),
  sourceId: uuid('source_id').notNull(), // References lecture_id, authority_id, or rubric_id
  startOffset: integer('start_offset'),
  endOffset: integer('end_offset'),
  note: text('note'), // Explanation of why this evidence is relevant
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ============================================
// 3. MASTERY STATE MACHINE
// ============================================

/**
 * Mastery state - Core state for each user × skill combination
 * This is the heart of the adaptive learning system
 */
export const masteryState = pgTable('mastery_state', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  skillId: uuid('skill_id').references(() => microSkills.id).notNull(),
  // Core mastery metrics
  pMastery: real('p_mastery').default(0.0).notNull(), // 0-1, probability of mastery
  stability: real('stability').default(1.0).notNull(), // How stable the mastery is
  speedSec: real('speed_sec'), // Rolling median time to complete
  // Activity tracking
  lastPracticedAt: timestamp('last_practiced_at'),
  lastExamLikeAt: timestamp('last_exam_like_at'), // Last timed attempt
  repsCount: integer('reps_count').default(0).notNull(), // Total repetitions
  verifiedCount: integer('verified_count').default(0).notNull(), // Verified completions
  // Spaced repetition fields
  interval: integer('interval').default(1).notNull(), // Days until next review
  easinessFactor: integer('easiness_factor').default(250).notNull(), // EF × 100
  nextReviewDate: date('next_review_date'),
  // Computed fields
  isVerified: boolean('is_verified').default(false).notNull(),
  verifiedAt: timestamp('verified_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  userSkillUnique: uniqueIndex('user_skill_unique').on(table.userId, table.skillId),
}));

/**
 * Skill error signature - Tracks recurring errors per user per skill
 */
export const skillErrorSignature = pgTable('skill_error_signature', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  skillId: uuid('skill_id').references(() => microSkills.id).notNull(),
  errorTagId: uuid('error_tag_id').references(() => errorTags.id).notNull(),
  count30d: integer('count_30d').default(0).notNull(),
  count90d: integer('count_90d').default(0).notNull(),
  countTotal: integer('count_total').default(0).notNull(),
  lastSeenAt: timestamp('last_seen_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  userSkillErrorUnique: uniqueIndex('user_skill_error_unique').on(table.userId, table.skillId, table.errorTagId),
}));

// ============================================
// 4. GATE SYSTEM (VERIFICATION)
// ============================================

/**
 * Skill verifications - Records of when a skill was "verified" (gate passed)
 * Requirements:
 * - p_mastery >= 0.85
 * - 2 timed attempts passed
 * - 2 passes ≥ 24 hours apart
 * - No repeat of top-3 error tags in second pass
 */
export const skillVerifications = pgTable('skill_verifications', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  skillId: uuid('skill_id').references(() => microSkills.id).notNull(),
  attemptId: uuid('attempt_id').references(() => attempts.id).notNull(), // The passing attempt
  // Gate criteria met
  pMasteryAtVerification: real('p_mastery_at_verification').notNull(),
  timedPassCount: integer('timed_pass_count').notNull(),
  hoursBetweenPasses: integer('hours_between_passes').notNull(),
  errorTagsCleared: jsonb('error_tags_cleared').$type<string[]>(), // Error tags that were resolved
  // Metadata
  verifiedAt: timestamp('verified_at').defaultNow().notNull(),
  expiresAt: timestamp('expires_at'), // Verifications may expire if not maintained
  isActive: boolean('is_active').default(true).notNull(),
  revokedAt: timestamp('revoked_at'),
  revokedReason: text('revoked_reason'),
});

// ============================================
// 5. PLANNER SYSTEM
// ============================================

/**
 * Exam timelines - Enhanced CLE exam schedule
 */
export const examTimelines = pgTable('exam_timelines', {
  id: uuid('id').defaultRandom().primaryKey(),
  intakeName: text('intake_name').notNull(), // e.g., "January 2025 Intake"
  intakeCode: text('intake_code').notNull().unique(), // e.g., "2025-01"
  // Key dates
  registrationOpens: date('registration_opens'),
  registrationCloses: date('registration_closes'),
  writtenStart: date('written_start').notNull(),
  writtenEnd: date('written_end'),
  oralStart: date('oral_start').notNull(),
  oralEnd: date('oral_end'),
  resultsDate: date('results_date'),
  // Unit-specific dates (if exams are staggered)
  unitSchedule: jsonb('unit_schedule').$type<{
    unitId: string;
    writtenDate: string;
    oralDate: string;
  }[]>(),
  // Status
  isActive: boolean('is_active').default(true).notNull(),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

/**
 * Coverage requirements - How many reps needed per exam phase
 */
export const coverageRequirements = pgTable('coverage_requirements', {
  id: uuid('id').defaultRandom().primaryKey(),
  skillId: uuid('skill_id').references(() => microSkills.id).notNull(),
  examPhase: examPhaseEnum('exam_phase').notNull(),
  // Requirements
  practiceReps: integer('practice_reps').default(2).notNull(),
  timedReps: integer('timed_reps').default(0).notNull(),
  mixedMocks: integer('mixed_mocks').default(0).notNull(),
  // Phase thresholds (days until exam)
  phaseStartDays: integer('phase_start_days').notNull(), // e.g., 60 for distant
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

/**
 * Daily plans - Generated study plans for each day
 */
export const dailyPlans = pgTable('daily_plans', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  planDate: date('plan_date').notNull(),
  // Time constraints
  totalMinutesBudget: integer('total_minutes_budget').default(60).notNull(),
  totalMinutesPlanned: integer('total_minutes_planned').default(0).notNull(),
  totalMinutesCompleted: integer('total_minutes_completed').default(0),
  // Plan metadata
  examPhase: examPhaseEnum('exam_phase').notNull(),
  daysUntilWritten: integer('days_until_written'),
  daysUntilOral: integer('days_until_oral'),
  // Objectives
  primaryObjective: text('primary_objective'), // e.g., "Close coverage debt in Civil Litigation"
  focusSkillIds: jsonb('focus_skill_ids').$type<string[]>(),
  focusUnitIds: jsonb('focus_unit_ids').$type<string[]>(),
  // Scoring inputs (for debugging/transparency)
  scoringInputsJson: jsonb('scoring_inputs_json').$type<{
    coverageDebtHighest: string[];
    retentionUrgent: string[];
    errorClosure: string[];
    examRoiHighest: string[];
  }>(),
  // Status
  isGenerated: boolean('is_generated').default(false).notNull(),
  generatedAt: timestamp('generated_at'),
  algorithmVersion: text('algorithm_version').default('v3').notNull(),
  isCompleted: boolean('is_completed').default(false).notNull(),
  completedAt: timestamp('completed_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  userDateUnique: uniqueIndex('user_date_unique').on(table.userId, table.planDate),
}));

/**
 * Daily plan items - Individual tasks in a daily plan
 */
export const dailyPlanItems = pgTable('daily_plan_items', {
  id: uuid('id').defaultRandom().primaryKey(),
  dailyPlanId: uuid('daily_plan_id').references(() => dailyPlans.id).notNull(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  // Task details
  itemId: uuid('item_id').references(() => items.id), // For practice items
  skillId: uuid('skill_id').references(() => microSkills.id), // Primary skill
  taskType: text('task_type').notNull(), // 'sm2_review', 'weakness_drill', 'timed_proof', 'interleave_quiz', 'rewrite'
  format: attemptFormatEnum('format'),
  mode: attemptModeEnum('mode').default('practice').notNull(),
  // Display
  title: text('title').notNull(),
  description: text('description'),
  // Time
  estimatedMinutes: integer('estimated_minutes').default(15).notNull(),
  actualMinutes: integer('actual_minutes'),
  order: integer('order').notNull(), // Sequence in the day
  // Scoring (why this task was chosen)
  priorityScore: real('priority_score').default(0).notNull(),
  scoringFactorsJson: jsonb('scoring_factors_json').$type<{
    learningGain: number;
    retentionGain: number;
    examRoi: number;
    errorClosure: number;
    engagementProb: number;
    burnoutPenalty: number;
    totalScore: number;
  }>(),
  // Status
  status: planItemStatusEnum('status').default('pending').notNull(),
  attemptId: uuid('attempt_id').references(() => attempts.id),
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
  skippedAt: timestamp('skipped_at'),
  deferredTo: date('deferred_to'),
  // AI rationale
  rationale: text('rationale'), // Why this task was recommended
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

/**
 * Coverage debt tracking - How much practice is needed per skill
 */
export const coverageDebt = pgTable('coverage_debt', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  skillId: uuid('skill_id').references(() => microSkills.id).notNull(),
  examPhase: examPhaseEnum('exam_phase').notNull(),
  // Tracking
  requiredPractice: integer('required_practice').default(0).notNull(),
  completedPractice: integer('completed_practice').default(0).notNull(),
  requiredTimed: integer('required_timed').default(0).notNull(),
  completedTimed: integer('completed_timed').default(0).notNull(),
  requiredMocks: integer('required_mocks').default(0).notNull(),
  completedMocks: integer('completed_mocks').default(0).notNull(),
  // Computed
  debtScore: real('debt_score').default(0).notNull(), // Higher = more urgent
  lastUpdatedAt: timestamp('last_updated_at').defaultNow().notNull(),
}, (table) => ({
  userSkillPhaseUnique: uniqueIndex('user_skill_phase_unique').on(table.userId, table.skillId, table.examPhase),
}));

// ============================================
// 6. WEEKLY REPORTS
// ============================================

/**
 * Weekly reports - Auto-generated progress reports
 */
export const weeklyReports = pgTable('weekly_reports', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  weekStart: date('week_start').notNull(),
  weekEnd: date('week_end').notNull(),
  // Readiness scores
  overallReadiness: real('overall_readiness').default(0).notNull(), // 0-100
  writtenReadiness: real('written_readiness').default(0).notNull(),
  oralReadiness: real('oral_readiness').default(0).notNull(),
  draftingReadiness: real('drafting_readiness').default(0).notNull(),
  // Per-unit readiness
  unitReadinessJson: jsonb('unit_readiness_json').$type<{
    unitId: string;
    unitName: string;
    readiness: number;
    trend: 'improving' | 'stable' | 'declining';
    topIssues: string[];
  }[]>(),
  // Performance summary
  attemptsCount: integer('attempts_count').default(0).notNull(),
  minutesStudied: integer('minutes_studied').default(0).notNull(),
  skillsImproved: jsonb('skills_improved').$type<{ skillId: string; delta: number }[]>(),
  skillsDeclining: jsonb('skills_declining').$type<{ skillId: string; delta: number; reasons: string[] }[]>(),
  topErrorTags: jsonb('top_error_tags').$type<{ tagId: string; count: number }[]>(),
  // Recommendations
  focusNextWeek: jsonb('focus_next_week').$type<string[]>(),
  mockPrediction: text('mock_prediction'), // "If exam was today" prediction
  // Evidence links
  evidenceAttemptIds: jsonb('evidence_attempt_ids').$type<string[]>(),
  // Metadata
  generatedAt: timestamp('generated_at').defaultNow().notNull(),
  isViewed: boolean('is_viewed').default(false).notNull(),
  viewedAt: timestamp('viewed_at'),
});

// ============================================
// 7. MASTERY ENGINE CONFIG
// ============================================

/**
 * Mastery engine configuration - Tunable parameters
 */
export const masteryEngineConfig = pgTable('mastery_engine_config', {
  id: uuid('id').defaultRandom().primaryKey(),
  key: text('key').notNull().unique(),
  value: jsonb('value').notNull(),
  description: text('description'),
  category: text('category').notNull(), // 'weights', 'thresholds', 'gates', 'planner'
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  updatedById: uuid('updated_by_id').references(() => users.id),
});

// ============================================
// RELATIONS
// ============================================

export const domainsRelations = relations(domains, ({ many }) => ({
  skills: many(microSkills),
  items: many(items),
}));

export const microSkillsRelations = relations(microSkills, ({ one, many }) => ({
  domain: one(domains, {
    fields: [microSkills.domainId],
    references: [domains.id],
  }),
  itemMappings: many(itemSkillMap),
  lectureMappings: many(lectureSkillMap),
  authorityMappings: many(skillAuthorityMap),
  masteryStates: many(masteryState),
  fromEdges: many(skillEdges, { relationName: 'skillFromEdges' }),
  toEdges: many(skillEdges, { relationName: 'skillToEdges' }),
}));

export const skillEdgesRelations = relations(skillEdges, ({ one }) => ({
  fromSkill: one(microSkills, {
    fields: [skillEdges.fromSkillId],
    references: [microSkills.id],
    relationName: 'skillFromEdges',
  }),
  toSkill: one(microSkills, {
    fields: [skillEdges.toSkillId],
    references: [microSkills.id],
    relationName: 'skillToEdges',
  }),
}));

export const lecturesRelations = relations(lectures, ({ many }) => ({
  chunks: many(lectureChunks),
  skillMappings: many(lectureSkillMap),
}));

export const lectureChunksRelations = relations(lectureChunks, ({ one, many }) => ({
  lecture: one(lectures, {
    fields: [lectureChunks.lectureId],
    references: [lectures.id],
  }),
  skillMappings: many(lectureSkillMap),
}));

export const lectureSkillMapRelations = relations(lectureSkillMap, ({ one }) => ({
  lecture: one(lectures, {
    fields: [lectureSkillMap.lectureId],
    references: [lectures.id],
  }),
  skill: one(microSkills, {
    fields: [lectureSkillMap.skillId],
    references: [microSkills.id],
  }),
  chunk: one(lectureChunks, {
    fields: [lectureSkillMap.chunkId],
    references: [lectureChunks.id],
  }),
}));

export const authoritiesRelations = relations(authorities, ({ many }) => ({
  skillMappings: many(skillAuthorityMap),
}));

export const skillAuthorityMapRelations = relations(skillAuthorityMap, ({ one }) => ({
  skill: one(microSkills, {
    fields: [skillAuthorityMap.skillId],
    references: [microSkills.id],
  }),
  authority: one(authorities, {
    fields: [skillAuthorityMap.authorityId],
    references: [authorities.id],
  }),
}));

export const rubricsRelations = relations(rubrics, ({ many }) => ({
  items: many(items),
}));

export const itemsRelations = relations(items, ({ one, many }) => ({
  domain: one(domains, {
    fields: [items.domainId],
    references: [domains.id],
  }),
  rubric: one(rubrics, {
    fields: [items.rubricId],
    references: [rubrics.id],
  }),
  skillMappings: many(itemSkillMap),
  attempts: many(attempts),
}));

export const itemSkillMapRelations = relations(itemSkillMap, ({ one }) => ({
  item: one(items, {
    fields: [itemSkillMap.itemId],
    references: [items.id],
  }),
  skill: one(microSkills, {
    fields: [itemSkillMap.skillId],
    references: [microSkills.id],
  }),
}));

export const errorTagsRelations = relations(errorTags, ({ many }) => ({
  attemptTags: many(attemptErrorTags),
  signatures: many(skillErrorSignature),
}));

export const attemptsRelations = relations(attempts, ({ one, many }) => ({
  user: one(users, {
    fields: [attempts.userId],
    references: [users.id],
  }),
  item: one(items, {
    fields: [attempts.itemId],
    references: [items.id],
  }),
  errorTags: many(attemptErrorTags),
  evidenceSpans: many(evidenceSpans),
  planItems: many(dailyPlanItems),
  verifications: many(skillVerifications),
}));

export const attemptErrorTagsRelations = relations(attemptErrorTags, ({ one }) => ({
  attempt: one(attempts, {
    fields: [attemptErrorTags.attemptId],
    references: [attempts.id],
  }),
  errorTag: one(errorTags, {
    fields: [attemptErrorTags.errorTagId],
    references: [errorTags.id],
  }),
}));

export const evidenceSpansRelations = relations(evidenceSpans, ({ one }) => ({
  attempt: one(attempts, {
    fields: [evidenceSpans.attemptId],
    references: [attempts.id],
  }),
}));

export const masteryStateRelations = relations(masteryState, ({ one, many }) => ({
  user: one(users, {
    fields: [masteryState.userId],
    references: [users.id],
  }),
  skill: one(microSkills, {
    fields: [masteryState.skillId],
    references: [microSkills.id],
  }),
  errorSignatures: many(skillErrorSignature),
}));

export const skillErrorSignatureRelations = relations(skillErrorSignature, ({ one }) => ({
  user: one(users, {
    fields: [skillErrorSignature.userId],
    references: [users.id],
  }),
  skill: one(microSkills, {
    fields: [skillErrorSignature.skillId],
    references: [microSkills.id],
  }),
  errorTag: one(errorTags, {
    fields: [skillErrorSignature.errorTagId],
    references: [errorTags.id],
  }),
  masteryState: one(masteryState, {
    fields: [skillErrorSignature.userId, skillErrorSignature.skillId],
    references: [masteryState.userId, masteryState.skillId],
  }),
}));

export const skillVerificationsRelations = relations(skillVerifications, ({ one }) => ({
  user: one(users, {
    fields: [skillVerifications.userId],
    references: [users.id],
  }),
  skill: one(microSkills, {
    fields: [skillVerifications.skillId],
    references: [microSkills.id],
  }),
  attempt: one(attempts, {
    fields: [skillVerifications.attemptId],
    references: [attempts.id],
  }),
}));

export const dailyPlansRelations = relations(dailyPlans, ({ one, many }) => ({
  user: one(users, {
    fields: [dailyPlans.userId],
    references: [users.id],
  }),
  items: many(dailyPlanItems),
}));

export const dailyPlanItemsRelations = relations(dailyPlanItems, ({ one }) => ({
  dailyPlan: one(dailyPlans, {
    fields: [dailyPlanItems.dailyPlanId],
    references: [dailyPlans.id],
  }),
  user: one(users, {
    fields: [dailyPlanItems.userId],
    references: [users.id],
  }),
  item: one(items, {
    fields: [dailyPlanItems.itemId],
    references: [items.id],
  }),
  skill: one(microSkills, {
    fields: [dailyPlanItems.skillId],
    references: [microSkills.id],
  }),
  attempt: one(attempts, {
    fields: [dailyPlanItems.attemptId],
    references: [attempts.id],
  }),
}));

export const coverageDebtRelations = relations(coverageDebt, ({ one }) => ({
  user: one(users, {
    fields: [coverageDebt.userId],
    references: [users.id],
  }),
  skill: one(microSkills, {
    fields: [coverageDebt.skillId],
    references: [microSkills.id],
  }),
}));

export const weeklyReportsRelations = relations(weeklyReports, ({ one }) => ({
  user: one(users, {
    fields: [weeklyReports.userId],
    references: [users.id],
  }),
}));
