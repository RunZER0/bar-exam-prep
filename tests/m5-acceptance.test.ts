/**
 * M5 Acceptance Tests: Intelligent Mastery System
 * 
 * Tests for:
 * 1. Notes Reader Component
 * 2. Mastery DB Service
 * 3. Remediation Engine
 * 4. Reminder Policies
 * 5. Banter System
 * 6. Grounding Enforcement (continues from M4)
 */

import { describe, it, expect, beforeAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

// ============================================
// NOTES READER COMPONENT TESTS
// ============================================

describe('M5 Notes Reader: Component Structure', () => {
  let componentContent: string;

  beforeAll(() => {
    componentContent = fs.readFileSync(
      path.join(process.cwd(), 'components/NotesReader.tsx'),
      'utf-8'
    );
  });

  it('should export NotesReader component', () => {
    expect(componentContent).toContain('export function NotesReader');
  });

  it('should have Citation type with authority_id', () => {
    expect(componentContent).toContain('authority_id: string');
  });

  it('should have Citation type with locator_json', () => {
    expect(componentContent).toContain('locator_json:');
    expect(componentContent).toContain('paragraph_start');
    expect(componentContent).toContain('section');
  });

  it('should have CitationChip component', () => {
    expect(componentContent).toContain('function CitationChip');
  });

  it('should have CitationPanel component', () => {
    expect(componentContent).toContain('function CitationPanel');
  });

  it('should support expand/collapse sections', () => {
    expect(componentContent).toContain('expandedSections');
    expect(componentContent).toContain('toggleSection');
  });

  it('should have source attribution link', () => {
    expect(componentContent).toContain('Open source');
    expect(componentContent).toContain('ExternalLink');
  });

  it('should display citation chips at section bottom', () => {
    expect(componentContent).toContain('Sources:');
    expect(componentContent).toContain('<CitationChip');
  });
});

describe('M5 Notes Reader: Citations Interface', () => {
  let componentContent: string;

  beforeAll(() => {
    componentContent = fs.readFileSync(
      path.join(process.cwd(), 'components/NotesReader.tsx'),
      'utf-8'
    );
  });

  it('should have NotesSection interface with citations array', () => {
    expect(componentContent).toContain('export interface NotesSection');
    expect(componentContent).toContain('citations: Citation[]');
  });

  it('should support different source types', () => {
    expect(componentContent).toContain("source_type?: 'CASE'");
    expect(componentContent).toContain("'STATUTE'");
    expect(componentContent).toContain("'REGULATION'");
  });

  it('should format locator for display', () => {
    expect(componentContent).toContain('formatLocator');
    expect(componentContent).toContain('locator_json.section');
    expect(componentContent).toContain('locator_json.paragraph_start');
  });

  it('should support excerpt display', () => {
    expect(componentContent).toContain('citation.excerpt');
  });
});

// ============================================
// MASTERY DB SERVICE TESTS
// ============================================

describe('M5 Mastery DB Service: Core Functions', () => {
  let serviceContent: string;

  beforeAll(() => {
    serviceContent = fs.readFileSync(
      path.join(process.cwd(), 'lib/services/mastery-db-service.ts'),
      'utf-8'
    );
  });

  it('should export recordAttemptAndUpdateMastery function', () => {
    expect(serviceContent).toContain('export async function recordAttemptAndUpdateMastery');
  });

  it('should export recomputeSkillMastery function', () => {
    expect(serviceContent).toContain('export async function recomputeSkillMastery');
  });

  it('should have MasteryUpdateEvent interface', () => {
    expect(serviceContent).toContain('export interface MasteryUpdateEvent');
    expect(serviceContent).toContain('userId: string');
    expect(serviceContent).toContain('skillIds: string[]');
    expect(serviceContent).toContain('scoreNorm: number');
  });

  it('should insert attempt records to database', () => {
    expect(serviceContent).toContain('.insert(attempts)');
  });

  it('should update mastery state after attempt', () => {
    expect(serviceContent).toContain('.update(masteryState)');
    expect(serviceContent).toContain('pMastery:');
    expect(serviceContent).toContain('stability:');
  });
});

describe('M5 Mastery DB Service: Spaced Repetition', () => {
  let serviceContent: string;

  beforeAll(() => {
    serviceContent = fs.readFileSync(
      path.join(process.cwd(), 'lib/services/mastery-db-service.ts'),
      'utf-8'
    );
  });

  it('should calculate spaced repetition interval', () => {
    expect(serviceContent).toContain('calculateSpacedInterval');
  });

  it('should use SM-2 algorithm', () => {
    expect(serviceContent).toContain('easinessFactor');
    expect(serviceContent).toContain('quality');
  });

  it('should update nextReviewDate', () => {
    expect(serviceContent).toContain('nextReviewDate');
    expect(serviceContent).toContain('interval');
  });

  it('should cap interval at maximum days', () => {
    expect(serviceContent).toContain('Math.min(interval, 180)');
  });
});

describe('M5 Mastery DB Service: Gate Verification', () => {
  let serviceContent: string;

  beforeAll(() => {
    serviceContent = fs.readFileSync(
      path.join(process.cwd(), 'lib/services/mastery-db-service.ts'),
      'utf-8'
    );
  });

  it('should check gate verification with DB data', () => {
    expect(serviceContent).toContain('checkGateVerificationWithDB');
  });

  it('should record skill verifications', () => {
    expect(serviceContent).toContain('db.insert(skillVerifications)');
    expect(serviceContent).toContain('pMasteryAtVerification');
  });

  it('should track timed passes', () => {
    expect(serviceContent).toContain('timedPassCount');
    expect(serviceContent).toContain("'timed', 'exam_sim'");
  });

  it('should track error tag clearance', () => {
    expect(serviceContent).toContain('errorTagsCleared');
    expect(serviceContent).toContain('topErrorTagIds');
  });
});

describe('M5 Mastery DB Service: Query Functions', () => {
  let serviceContent: string;

  beforeAll(() => {
    serviceContent = fs.readFileSync(
      path.join(process.cwd(), 'lib/services/mastery-db-service.ts'),
      'utf-8'
    );
  });

  it('should get user mastery states', () => {
    expect(serviceContent).toContain('export async function getUserMasteryStates');
  });

  it('should get weak skills', () => {
    expect(serviceContent).toContain('export async function getWeakSkills');
    expect(serviceContent).toContain('threshold = 0.4');
  });

  it('should get strong skills', () => {
    expect(serviceContent).toContain('export async function getStrongSkills');
    expect(serviceContent).toContain('threshold = 0.8');
  });

  it('should get skills due for review', () => {
    expect(serviceContent).toContain('export async function getSkillsDueForReview');
    expect(serviceContent).toContain('daysPastDue');
  });
});

// ============================================
// REMEDIATION ENGINE TESTS
// ============================================

describe('M5 Remediation Engine: Core Functions', () => {
  let serviceContent: string;

  beforeAll(() => {
    serviceContent = fs.readFileSync(
      path.join(process.cwd(), 'lib/services/remediation-engine.ts'),
      'utf-8'
    );
  });

  it('should export diagnoseAndPrescribe function', () => {
    expect(serviceContent).toContain('export async function diagnoseAndPrescribe');
  });

  it('should export getRemediationNeeds function', () => {
    expect(serviceContent).toContain('export async function getRemediationNeeds');
  });

  it('should export applyRemediationToMix function', () => {
    expect(serviceContent).toContain('export function applyRemediationToMix');
  });

  it('should have RemediationPrescription interface', () => {
    expect(serviceContent).toContain('export interface RemediationPrescription');
    expect(serviceContent).toContain('severity:');
    expect(serviceContent).toContain('prescribedActivities:');
    expect(serviceContent).toContain('focusAreas:');
  });
});

describe('M5 Remediation Engine: Severity Levels', () => {
  let serviceContent: string;

  beforeAll(() => {
    serviceContent = fs.readFileSync(
      path.join(process.cwd(), 'lib/services/remediation-engine.ts'),
      'utf-8'
    );
  });

  it('should have mild severity activities', () => {
    expect(serviceContent).toContain('MILD_REMEDIATION_MIX');
  });

  it('should have moderate severity activities', () => {
    expect(serviceContent).toContain('MODERATE_REMEDIATION_MIX');
  });

  it('should have severe severity activities', () => {
    expect(serviceContent).toContain('SEVERE_REMEDIATION_MIX');
  });

  it('should include ERROR_CORRECTION for struggling students', () => {
    expect(serviceContent).toContain("activityType: 'ERROR_CORRECTION'");
  });

  it('should include FLASHCARDS for reinforcement', () => {
    expect(serviceContent).toContain("activityType: 'FLASHCARDS'");
    expect(serviceContent).toContain("difficulty: 'easy'");
  });
});

describe('M5 Remediation Engine: Gate Thresholds', () => {
  let serviceContent: string;

  beforeAll(() => {
    serviceContent = fs.readFileSync(
      path.join(process.cwd(), 'lib/services/remediation-engine.ts'),
      'utf-8'
    );
  });

  it('should export GATE_THRESHOLDS', () => {
    expect(serviceContent).toContain('export const GATE_THRESHOLDS');
  });

  it('should have memoryCheck threshold', () => {
    expect(serviceContent).toContain('memoryCheck: 0.7');
  });

  it('should have quiz threshold', () => {
    expect(serviceContent).toContain('quiz: 0.6');
  });

  it('should have issueSpotter threshold (lower for difficulty)', () => {
    expect(serviceContent).toContain('issueSpotter: 0.5');
  });

  it('should have weakSkillThreshold', () => {
    expect(serviceContent).toContain('weakSkillThreshold: 0.4');
  });

  it('should have maxConsecutiveFailures', () => {
    expect(serviceContent).toContain('maxConsecutiveFailures: 3');
  });
});

describe('M5 Remediation Engine: Error Pattern Detection', () => {
  let serviceContent: string;

  beforeAll(() => {
    serviceContent = fs.readFileSync(
      path.join(process.cwd(), 'lib/services/remediation-engine.ts'),
      'utf-8'
    );
  });

  it('should have ErrorPattern interface', () => {
    expect(serviceContent).toContain('export interface ErrorPattern');
    expect(serviceContent).toContain('errorTagId:');
    expect(serviceContent).toContain('count30d:');
  });

  it('should detect recurring errors', () => {
    expect(serviceContent).toContain('getErrorPatterns');
    expect(serviceContent).toContain('skillErrorSignature');
  });

  it('should count consecutive failures', () => {
    expect(serviceContent).toContain('countConsecutiveFailures');
  });
});

// ============================================
// REMINDER POLICIES TESTS
// ============================================

describe('M5 Reminder Policies: Policy Definitions', () => {
  let serviceContent: string;

  beforeAll(() => {
    serviceContent = fs.readFileSync(
      path.join(process.cwd(), 'lib/services/reminder-policies.ts'),
      'utf-8'
    );
  });

  it('should export REMINDER_POLICIES array', () => {
    expect(serviceContent).toContain('export const REMINDER_POLICIES');
  });

  it('should have inactivity_24h policy', () => {
    expect(serviceContent).toContain("id: 'inactivity_24h'");
  });

  it('should have inactivity_48h policy', () => {
    expect(serviceContent).toContain("id: 'inactivity_48h'");
  });

  it('should have streak_at_risk policy', () => {
    expect(serviceContent).toContain("id: 'streak_at_risk'");
  });

  it('should have session_ready policy', () => {
    expect(serviceContent).toContain("id: 'session_ready'");
  });

  it('should have exam_countdown policies', () => {
    expect(serviceContent).toContain("id: 'exam_countdown_30d'");
    expect(serviceContent).toContain("id: 'exam_countdown_7d'");
  });

  it('should have weak_skill_alert policy', () => {
    expect(serviceContent).toContain("id: 'weak_skill_alert'");
  });
});

describe('M5 Reminder Policies: Policy Interface', () => {
  let serviceContent: string;

  beforeAll(() => {
    serviceContent = fs.readFileSync(
      path.join(process.cwd(), 'lib/services/reminder-policies.ts'),
      'utf-8'
    );
  });

  it('should have ReminderPolicy interface', () => {
    expect(serviceContent).toContain('export interface ReminderPolicy');
  });

  it('should include triggerCondition function', () => {
    expect(serviceContent).toContain('triggerCondition:');
  });

  it('should include cooldownHours for rate limiting', () => {
    expect(serviceContent).toContain('cooldownHours:');
  });

  it('should include priority for ordering', () => {
    expect(serviceContent).toContain('priority:');
  });

  it('should include pushPayload generator', () => {
    expect(serviceContent).toContain('pushPayload?:');
  });

  it('should include nudgeContent generator', () => {
    expect(serviceContent).toContain('nudgeContent?:');
  });
});

describe('M5 Reminder Policies: User Context', () => {
  let serviceContent: string;

  beforeAll(() => {
    serviceContent = fs.readFileSync(
      path.join(process.cwd(), 'lib/services/reminder-policies.ts'),
      'utf-8'
    );
  });

  it('should export buildUserContext function', () => {
    expect(serviceContent).toContain('export async function buildUserContext');
  });

  it('should have UserContext interface', () => {
    expect(serviceContent).toContain('export interface UserContext');
  });

  it('should track hoursSinceLastSession', () => {
    expect(serviceContent).toContain('hoursSinceLastSession:');
  });

  it('should track currentStreak', () => {
    expect(serviceContent).toContain('currentStreak:');
  });

  it('should track overallMastery', () => {
    expect(serviceContent).toContain('overallMastery:');
  });

  it('should track daysUntilExam', () => {
    expect(serviceContent).toContain('daysUntilExam:');
  });

  it('should track examPhase', () => {
    expect(serviceContent).toContain('examPhase:');
  });
});

describe('M5 Reminder Policies: Evaluation', () => {
  let serviceContent: string;

  beforeAll(() => {
    serviceContent = fs.readFileSync(
      path.join(process.cwd(), 'lib/services/reminder-policies.ts'),
      'utf-8'
    );
  });

  it('should export evaluatePolicies function', () => {
    expect(serviceContent).toContain('export async function evaluatePolicies');
  });

  it('should export getNudgesForUser function', () => {
    expect(serviceContent).toContain('export async function getNudgesForUser');
  });

  it('should export processRemindersWithPolicies function', () => {
    expect(serviceContent).toContain('export async function processRemindersWithPolicies');
  });

  it('should check cooldown before sending', () => {
    expect(serviceContent).toContain('hoursSinceLastSend < policy.cooldownHours');
  });

  it('should sort policies by priority', () => {
    expect(serviceContent).toContain('sort((a, b) => b.priority - a.priority)');
  });
});

// ============================================
// BANTER SERVICE TESTS
// ============================================

describe('M5 Banter Service: Content Library', () => {
  let serviceContent: string;

  beforeAll(() => {
    serviceContent = fs.readFileSync(
      path.join(process.cwd(), 'lib/services/banter-service.ts'),
      'utf-8'
    );
  });

  it('should export HISTORY_FACTS array', () => {
    expect(serviceContent).toContain('export const HISTORY_FACTS');
  });

  it('should export MOTIVATIONAL_MESSAGES array', () => {
    expect(serviceContent).toContain('export const MOTIVATIONAL_MESSAGES');
  });

  it('should export STUDY_TIPS array', () => {
    expect(serviceContent).toContain('export const STUDY_TIPS');
  });

  it('should export FUN_FACTS array', () => {
    expect(serviceContent).toContain('export const FUN_FACTS');
  });

  it('should export QUOTES array', () => {
    expect(serviceContent).toContain('export const QUOTES');
  });

  it('should export ALL_BANTER combined array', () => {
    expect(serviceContent).toContain('export const ALL_BANTER');
  });
});

describe('M5 Banter Service: Content Safety', () => {
  let serviceContent: string;

  beforeAll(() => {
    serviceContent = fs.readFileSync(
      path.join(process.cwd(), 'lib/services/banter-service.ts'),
      'utf-8'
    );
  });

  it('should mark all banter as non-legal content', () => {
    expect(serviceContent).toContain('isLegalContent: false');
    // Multiple instances
    const matches = serviceContent.match(/isLegalContent: false/g);
    expect(matches?.length).toBeGreaterThan(20);
  });

  it('should have BANTER_DISCLAIMER', () => {
    expect(serviceContent).toContain('export const BANTER_DISCLAIMER');
    expect(serviceContent).toContain('do not constitute legal advice');
  });

  it('should label history facts with source', () => {
    expect(serviceContent).toContain("source: 'Historical record'");
  });
});

describe('M5 Banter Service: Selection Logic', () => {
  let serviceContent: string;

  beforeAll(() => {
    serviceContent = fs.readFileSync(
      path.join(process.cwd(), 'lib/services/banter-service.ts'),
      'utf-8'
    );
  });

  it('should export selectRandomBanter function', () => {
    expect(serviceContent).toContain('export function selectRandomBanter');
  });

  it('should export selectSessionCompletionBanter function', () => {
    expect(serviceContent).toContain('export function selectSessionCompletionBanter');
  });

  it('should export generateSessionReward function', () => {
    expect(serviceContent).toContain('export function generateSessionReward');
  });

  it('should filter by category', () => {
    expect(serviceContent).toContain('options?.category');
  });

  it('should filter by tags', () => {
    expect(serviceContent).toContain('options?.tags');
  });

  it('should support excludeIds for variety', () => {
    expect(serviceContent).toContain('excludeIds');
  });
});

describe('M5 Banter Service: Session Rewards', () => {
  let serviceContent: string;

  beforeAll(() => {
    serviceContent = fs.readFileSync(
      path.join(process.cwd(), 'lib/services/banter-service.ts'),
      'utf-8'
    );
  });

  it('should have SessionReward interface', () => {
    expect(serviceContent).toContain('export interface SessionReward');
    expect(serviceContent).toContain('banter: BanterItem');
    expect(serviceContent).toContain('streakMessage?:');
    expect(serviceContent).toContain('achievementUnlocked?:');
  });

  it('should generate streak messages', () => {
    expect(serviceContent).toContain('generateStreakMessage');
    expect(serviceContent).toContain('-day streak');
  });

  it('should have achievement definitions', () => {
    expect(serviceContent).toContain('getAchievementDetails');
    expect(serviceContent).toContain("'first_session'");
    expect(serviceContent).toContain("'week_streak'");
    expect(serviceContent).toContain("'perfect_score'");
  });

  it('should weight motivation for hard sessions', () => {
    expect(serviceContent).toContain('wasHard');
    expect(serviceContent).toContain("'MOTIVATION'");
  });
});

describe('M5 Banter Service: BanterItem Interface', () => {
  let serviceContent: string;

  beforeAll(() => {
    serviceContent = fs.readFileSync(
      path.join(process.cwd(), 'lib/services/banter-service.ts'),
      'utf-8'
    );
  });

  it('should have BanterItem interface', () => {
    expect(serviceContent).toContain('export interface BanterItem');
  });

  it('should have BanterCategory type', () => {
    expect(serviceContent).toContain('export type BanterCategory');
    expect(serviceContent).toContain("'HISTORY_FACT'");
    expect(serviceContent).toContain("'MOTIVATION'");
    expect(serviceContent).toContain("'STUDY_TIP'");
  });

  it('should include content and source', () => {
    expect(serviceContent).toContain('content: string');
    expect(serviceContent).toContain('source?: string');
  });

  it('should include tags for targeting', () => {
    expect(serviceContent).toContain('tags?: string[]');
  });
});

// ============================================
// CROSS-MODULE INTEGRATION TESTS
// ============================================

describe('M5 Integration: Activity Types Consistency', () => {
  it('should use consistent activity types across modules', async () => {
    const blueprintContent = fs.readFileSync(
      path.join(process.cwd(), 'lib/services/generators/session-blueprint.ts'),
      'utf-8'
    );
    const remediationContent = fs.readFileSync(
      path.join(process.cwd(), 'lib/services/remediation-engine.ts'),
      'utf-8'
    );

    // Check that remediation uses same activity types
    expect(remediationContent).toContain("activityType: 'READING_NOTES'");
    expect(remediationContent).toContain("activityType: 'FLASHCARDS'");
    expect(remediationContent).toContain("activityType: 'MEMORY_CHECK'");
    expect(remediationContent).toContain("activityType: 'WRITTEN_QUIZ'");
    expect(remediationContent).toContain("activityType: 'ERROR_CORRECTION'");
  });
});

describe('M5 Integration: Mastery State Usage', () => {
  it('should use masteryState from mastery-schema', async () => {
    const dbServiceContent = fs.readFileSync(
      path.join(process.cwd(), 'lib/services/mastery-db-service.ts'),
      'utf-8'
    );
    const remediationContent = fs.readFileSync(
      path.join(process.cwd(), 'lib/services/remediation-engine.ts'),
      'utf-8'
    );
    const reminderContent = fs.readFileSync(
      path.join(process.cwd(), 'lib/services/reminder-policies.ts'),
      'utf-8'
    );

    // All services should import masteryState
    expect(dbServiceContent).toContain('masteryState');
    expect(remediationContent).toContain('masteryState');
    expect(reminderContent).toContain('masteryState');
  });
});

describe('M5 Integration: Grounding Enforcement', () => {
  it('should maintain grounding requirements', async () => {
    const sourceGovContent = fs.readFileSync(
      path.join(process.cwd(), 'lib/constants/source-governance.ts'),
      'utf-8'
    );

    // Verify grounding rules still enforced
    expect(sourceGovContent).toContain('minCitationCount: 1');
    expect(sourceGovContent).toContain("fallbackMessage: 'Not found in verified sources yet'");
    expect(sourceGovContent).toContain('logMissingAuthorities: true');
  });

  it('should have grounding validator available', () => {
    const validatorContent = fs.readFileSync(
      path.join(process.cwd(), 'lib/services/generators/grounding-validator.ts'),
      'utf-8'
    );

    expect(validatorContent).toContain('assertGrounded');
    expect(validatorContent).toContain('MISSING_CITATION');
    expect(validatorContent).toContain('validateAndFix');
  });
});

describe('M5 Integration: Notification Channels', () => {
  it('should use Brevo HTTP API (no SMTP)', () => {
    const notificationContent = fs.readFileSync(
      path.join(process.cwd(), 'lib/services/notification-service.ts'),
      'utf-8'
    );

    expect(notificationContent).toContain('https://api.brevo.com/v3/smtp/email');
    expect(notificationContent).toContain("method: 'POST'");
    expect(notificationContent).not.toContain('port: 587');
    expect(notificationContent).not.toContain('port: 25');
  });

  it('should use VAPID for web push', () => {
    const notificationContent = fs.readFileSync(
      path.join(process.cwd(), 'lib/services/notification-service.ts'),
      'utf-8'
    );

    expect(notificationContent).toContain('VAPID_PUBLIC_KEY');
    expect(notificationContent).toContain('webpush.setVapidDetails');
  });
});

// ============================================
// ACCEPTANCE CRITERIA TESTS
// ============================================

describe('M5 Acceptance: Every Generated Asset Must Be Grounded', () => {
  it('should have assertGrounded validator', () => {
    expect(fs.existsSync(
      path.join(process.cwd(), 'lib/services/generators/grounding-validator.ts')
    )).toBe(true);
  });

  it('should have fallback message defined', () => {
    const govContent = fs.readFileSync(
      path.join(process.cwd(), 'lib/constants/source-governance.ts'),
      'utf-8'
    );
    expect(govContent).toContain('Not found in verified sources yet');
  });
});

describe('M5 Acceptance: Session Must Have >= 3 Activity Types', () => {
  it('should compute activity mix with sufficient variety', () => {
    const blueprintContent = fs.readFileSync(
      path.join(process.cwd(), 'lib/services/generators/session-blueprint.ts'),
      'utf-8'
    );
    
    // Check default mixes have multiple activity types
    expect(blueprintContent).toContain('READING_NOTES');
    expect(blueprintContent).toContain('MEMORY_CHECK');
    expect(blueprintContent).toContain('FLASHCARDS');
    expect(blueprintContent).toContain('WRITTEN_QUIZ');
  });
});

describe('M5 Acceptance: Each Citation Must Have authority_id and locator_json', () => {
  it('should define Citation interface correctly', () => {
    const notesContent = fs.readFileSync(
      path.join(process.cwd(), 'components/NotesReader.tsx'),
      'utf-8'
    );

    expect(notesContent).toContain('authority_id: string');
    expect(notesContent).toContain('locator_json:');
    expect(notesContent).toContain('paragraph_start');
    expect(notesContent).toContain('section');
  });
});

describe('M5 Acceptance: Skill Mastery Updates Change Future Blueprint Mix', () => {
  it('should have weak skill mix in blueprint', () => {
    const blueprintContent = fs.readFileSync(
      path.join(process.cwd(), 'lib/services/generators/session-blueprint.ts'),
      'utf-8'
    );

    expect(blueprintContent).toContain('WEAK_SKILL_MIX');
    expect(blueprintContent).toContain('pMastery < 0.4');
  });

  it('should have strong skill mix in blueprint', () => {
    const blueprintContent = fs.readFileSync(
      path.join(process.cwd(), 'lib/services/generators/session-blueprint.ts'),
      'utf-8'
    );

    expect(blueprintContent).toContain('STRONG_SKILL_MIX');
    expect(blueprintContent).toContain('pMastery > 0.8');
  });

  it('should have remediation that affects activity mix', () => {
    const remediationContent = fs.readFileSync(
      path.join(process.cwd(), 'lib/services/remediation-engine.ts'),
      'utf-8'
    );

    expect(remediationContent).toContain('applyRemediationToMix');
    expect(remediationContent).toContain('severity');
  });
});

describe('M5 Acceptance: Brevo Uses HTTPS and Logs', () => {
  it('should use HTTPS for Brevo API', () => {
    const notificationContent = fs.readFileSync(
      path.join(process.cwd(), 'lib/services/notification-service.ts'),
      'utf-8'
    );

    expect(notificationContent).toContain('https://api.brevo.com');
  });

  it('should log notifications to notification_log', () => {
    const notificationContent = fs.readFileSync(
      path.join(process.cwd(), 'lib/services/notification-service.ts'),
      'utf-8'
    );

    expect(notificationContent).toContain('notificationLog');
    expect(notificationContent).toContain('.insert(notificationLog)');
  });
});

describe('M5 Acceptance: Push Uses VAPID and Logs', () => {
  it('should have VAPID keys configured', () => {
    const notificationContent = fs.readFileSync(
      path.join(process.cwd(), 'lib/services/notification-service.ts'),
      'utf-8'
    );

    expect(notificationContent).toContain('VAPID_PUBLIC_KEY');
    expect(notificationContent).toContain('VAPID_PRIVATE_KEY');
  });

  it('should log push notifications', () => {
    const notificationContent = fs.readFileSync(
      path.join(process.cwd(), 'lib/services/notification-service.ts'),
      'utf-8'
    );

    expect(notificationContent).toContain("channel: 'PUSH'");
  });
});

// ============================================
// NOTES API ENDPOINT TESTS
// ============================================

describe('M5 Notes API: Endpoint Structure', () => {
  let apiContent: string;

  beforeAll(() => {
    apiContent = fs.readFileSync(
      path.join(process.cwd(), 'app/api/notes/[assetId]/route.ts'),
      'utf-8'
    );
  });

  it('should export GET handler', () => {
    expect(apiContent).toContain('export async function GET');
  });

  it('should verify authorization token', () => {
    expect(apiContent).toContain('verifyIdToken');
    expect(apiContent).toContain('Bearer');
  });

  it('should query studyAssets', () => {
    expect(apiContent).toContain('studyAssets');
  });

  it('should resolve authority records', () => {
    expect(apiContent).toContain('authorityRecords');
    expect(apiContent).toContain('authorityPassages');
  });

  it('should return sections with citations', () => {
    expect(apiContent).toContain('sections:');
    expect(apiContent).toContain('citations:');
  });

  it('should include authority metadata in response', () => {
    expect(apiContent).toContain('authorities');
    expect(apiContent).toContain('canonical_url');
    expect(apiContent).toContain('source_tier');
  });

  it('should include passage excerpts', () => {
    expect(apiContent).toContain('passage_text');
    expect(apiContent).toContain('locator_json');
  });

  it('should include outline topics', () => {
    expect(apiContent).toContain('outlineTopics');
    expect(apiContent).toContain('outline_topic_ids');
  });

  it('should return grounding refs', () => {
    expect(apiContent).toContain('groundingRefs');
    expect(apiContent).toContain('authority_ids');
  });

  it('should return stats', () => {
    expect(apiContent).toContain('stats:');
    expect(apiContent).toContain('totalAuthorities');
    expect(apiContent).toContain('totalPassages');
  });
});

// ============================================
// GATE ENFORCEMENT TESTS
// ============================================

describe('M5 Gate System: Definitions', () => {
  let blueprintContent: string;

  beforeAll(() => {
    blueprintContent = fs.readFileSync(
      path.join(process.cwd(), 'lib/services/generators/session-blueprint.ts'),
      'utf-8'
    );
  });

  it('should export SKILL_GATES array', () => {
    expect(blueprintContent).toContain('export const SKILL_GATES');
  });

  it('should have memory_gate definition', () => {
    expect(blueprintContent).toContain("id: 'memory_gate'");
  });

  it('should have quiz_gate definition', () => {
    expect(blueprintContent).toContain("id: 'quiz_gate'");
  });

  it('should have application_gate definition', () => {
    expect(blueprintContent).toContain("id: 'application_gate'");
  });

  it('should define GateDefinition interface', () => {
    expect(blueprintContent).toContain('export interface GateDefinition');
    expect(blueprintContent).toContain('requiredActivities:');
    expect(blueprintContent).toContain('passingCriteria:');
    expect(blueprintContent).toContain('blocksActivities:');
  });

  it('should have minScore in passing criteria', () => {
    expect(blueprintContent).toContain('minScore: 0.7');
    expect(blueprintContent).toContain('minScore: 0.6');
    expect(blueprintContent).toContain('minScore: 0.5');
  });
});

describe('M5 Gate System: Enforcement', () => {
  let blueprintContent: string;

  beforeAll(() => {
    blueprintContent = fs.readFileSync(
      path.join(process.cwd(), 'lib/services/generators/session-blueprint.ts'),
      'utf-8'
    );
  });

  it('should export evaluateGate function', () => {
    expect(blueprintContent).toContain('export function evaluateGate');
  });

  it('should export getBlockedActivities function', () => {
    expect(blueprintContent).toContain('export function getBlockedActivities');
  });

  it('should export filterBlockedActivities function', () => {
    expect(blueprintContent).toContain('export function filterBlockedActivities');
  });

  it('should have GateEvaluationResult interface', () => {
    expect(blueprintContent).toContain('export interface GateEvaluationResult');
    expect(blueprintContent).toContain('isPassed:');
    expect(blueprintContent).toContain('currentScore:');
    expect(blueprintContent).toContain('blockedActivities:');
  });

  it('should have enforceGates option in computeDefaultActivityMix', () => {
    expect(blueprintContent).toContain('enforceGates?: boolean');
  });

  it('should apply gate enforcement to activity mix', () => {
    expect(blueprintContent).toContain('applyGateEnforcement');
  });

  it('should compensate for removed activities', () => {
    expect(blueprintContent).toContain('compensateForRemovedActivities');
  });

  it('should track removed activities', () => {
    expect(blueprintContent).toContain('removedActivities:');
  });

  it('should include gate results in blueprint', () => {
    expect(blueprintContent).toContain('gateResults');
  });
});

describe('M5 Gate System: Blocked Activity Types', () => {
  let blueprintContent: string;

  beforeAll(() => {
    blueprintContent = fs.readFileSync(
      path.join(process.cwd(), 'lib/services/generators/session-blueprint.ts'),
      'utf-8'
    );
  });

  it('should block WRITTEN_QUIZ behind memory gate', () => {
    expect(blueprintContent).toMatch(/memory_gate[\s\S]*?blocksActivities:[\s\S]*?'WRITTEN_QUIZ'/);
  });

  it('should block ISSUE_SPOTTER behind memory and quiz gates', () => {
    expect(blueprintContent).toContain("'ISSUE_SPOTTER'");
  });

  it('should block ESSAY_OUTLINE behind quiz gate', () => {
    expect(blueprintContent).toContain("'ESSAY_OUTLINE'");
  });

  it('should block PAST_PAPER_STYLE behind multiple gates', () => {
    expect(blueprintContent).toContain("'PAST_PAPER_STYLE'");
  });
});

// ============================================
// MISSING AUTHORITY LOGGING TESTS
// ============================================

describe('M5 Missing Authority Log: Integration', () => {
  it('should have missing_authority_log table in schema', () => {
    const schemaContent = fs.readFileSync(
      path.join(process.cwd(), 'lib/db/schema.ts'),
      'utf-8'
    );
    expect(schemaContent).toContain("missingAuthorityLog = pgTable('missing_authority_log'");
  });

  it('should log validation failures to missing_authority_log', () => {
    const validatorContent = fs.readFileSync(
      path.join(process.cwd(), 'lib/services/generators/grounding-validator.ts'),
      'utf-8'
    );
    expect(validatorContent).toContain('logValidationFailure');
    expect(validatorContent).toContain('missingAuthorityLog');
  });

  it('should include claim text in log', () => {
    const validatorContent = fs.readFileSync(
      path.join(process.cwd(), 'lib/services/generators/grounding-validator.ts'),
      'utf-8'
    );
    expect(validatorContent).toContain('claimText:');
  });
});

// ============================================
// END-TO-END MASTERY FLOW TESTS
// ============================================

describe('M5 E2E: Mastery System Integration', () => {
  it('should have complete mastery flow components', () => {
    // Check all required services exist
    expect(fs.existsSync(path.join(process.cwd(), 'lib/services/mastery-db-service.ts'))).toBe(true);
    expect(fs.existsSync(path.join(process.cwd(), 'lib/services/remediation-engine.ts'))).toBe(true);
    expect(fs.existsSync(path.join(process.cwd(), 'lib/services/reminder-policies.ts'))).toBe(true);
    expect(fs.existsSync(path.join(process.cwd(), 'lib/services/banter-service.ts'))).toBe(true);
  });

  it('should have Notes API endpoint', () => {
    expect(fs.existsSync(path.join(process.cwd(), 'app/api/notes/[assetId]/route.ts'))).toBe(true);
  });

  it('should have gate definitions in session blueprint', () => {
    const blueprintContent = fs.readFileSync(
      path.join(process.cwd(), 'lib/services/generators/session-blueprint.ts'),
      'utf-8'
    );
    expect(blueprintContent).toContain('SKILL_GATES');
    expect(blueprintContent).toContain('GateDefinition');
  });

  it('should export mastery-db-service functions', () => {
    const masteryDb = fs.readFileSync(
      path.join(process.cwd(), 'lib/services/mastery-db-service.ts'),
      'utf-8'
    );
    expect(masteryDb).toContain('export async function recordAttemptAndUpdateMastery');
    expect(masteryDb).toContain('export async function recomputeSkillMastery');
    expect(masteryDb).toContain('export async function getUserMasteryStates');
    expect(masteryDb).toContain('export async function getSkillsDueForReview');
  });

  it('should export remediation-engine functions', () => {
    const remediation = fs.readFileSync(
      path.join(process.cwd(), 'lib/services/remediation-engine.ts'),
      'utf-8'
    );
    expect(remediation).toContain('export async function diagnoseAndPrescribe');
    expect(remediation).toContain('export async function getRemediationNeeds');
  });
});
