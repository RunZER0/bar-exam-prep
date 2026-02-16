/**
 * M4 Acceptance Tests: Mastery Hub (Written Exam Mode)
 * 
 * Tests for:
 * 1. Authority Records + Source Governance
 * 2. Notification System (Brevo + Push)
 * 3. Study Activity Types
 * 4. Grounding Enforcement
 * 5. Background Job Types
 */

import { describe, it, expect, beforeAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

// ============================================
// M4 SCHEMA TESTS
// ============================================

describe('M4 Schema: Authority Records', () => {
  let schemaContent: string;

  beforeAll(() => {
    schemaContent = fs.readFileSync(
      path.join(process.cwd(), 'lib/db/schema.ts'),
      'utf-8'
    );
  });

  it('should have authority_records table', () => {
    expect(schemaContent).toContain("authorityRecords = pgTable('authority_records'");
  });

  it('should have authority_passages table', () => {
    expect(schemaContent).toContain("authorityPassages = pgTable('authority_passages'");
  });

  it('should have source_tier enum (A/B/C)', () => {
    expect(schemaContent).toContain("sourceTierEnum = pgEnum('source_tier', ['A', 'B', 'C']");
  });

  it('should have source_type enum', () => {
    expect(schemaContent).toContain("sourceTypeEnum = pgEnum('source_type'");
    expect(schemaContent).toContain('CASE');
    expect(schemaContent).toContain('STATUTE');
    expect(schemaContent).toContain('REGULATION');
  });

  it('should have license_tag enum', () => {
    expect(schemaContent).toContain("licenseTagEnum = pgEnum('license_tag'");
    expect(schemaContent).toContain('PUBLIC_LEGAL_TEXT');
    expect(schemaContent).toContain('RESTRICTED');
  });

  it('should have authority_records with required fields', () => {
    expect(schemaContent).toContain('sourceTier:');
    expect(schemaContent).toContain('sourceType:');
    expect(schemaContent).toContain('canonicalUrl:');
    expect(schemaContent).toContain('licenseTag:');
    expect(schemaContent).toContain('contentHash:');
    expect(schemaContent).toContain('isVerified:');
  });

  it('should have authority_passages with locator_json', () => {
    expect(schemaContent).toContain('passageText:');
    expect(schemaContent).toContain('locatorJson:');
    expect(schemaContent).toContain('snippetHash:');
  });
});

describe('M4 Schema: Notification Tables', () => {
  let schemaContent: string;

  beforeAll(() => {
    schemaContent = fs.readFileSync(
      path.join(process.cwd(), 'lib/db/schema.ts'),
      'utf-8'
    );
  });

  it('should have notification_log table', () => {
    expect(schemaContent).toContain("notificationLog = pgTable('notification_log'");
  });

  it('should have push_subscriptions table', () => {
    expect(schemaContent).toContain("pushSubscriptions = pgTable('push_subscriptions'");
  });

  it('should have notification_channel enum', () => {
    expect(schemaContent).toContain("notificationChannelEnum = pgEnum('notification_channel'");
    expect(schemaContent).toContain('EMAIL');
    expect(schemaContent).toContain('PUSH');
    expect(schemaContent).toContain('IN_APP');
  });

  it('should have notification_status enum', () => {
    expect(schemaContent).toContain("notificationStatusEnum = pgEnum('notification_status'");
    expect(schemaContent).toContain('PENDING');
    expect(schemaContent).toContain('SENT');
    expect(schemaContent).toContain('FAILED');
  });

  it('should have providerMessageId in notification_log', () => {
    expect(schemaContent).toContain('providerMessageId:');
  });
});

describe('M4 Schema: Study Activity Types', () => {
  let schemaContent: string;

  beforeAll(() => {
    schemaContent = fs.readFileSync(
      path.join(process.cwd(), 'lib/db/schema.ts'),
      'utf-8'
    );
  });

  it('should have study_activity_type enum', () => {
    expect(schemaContent).toContain("studyActivityTypeEnum = pgEnum('study_activity_type'");
  });

  it('should include READING_NOTES activity', () => {
    expect(schemaContent).toContain('READING_NOTES');
  });

  it('should include MEMORY_CHECK activity', () => {
    expect(schemaContent).toContain('MEMORY_CHECK');
  });

  it('should include FLASHCARDS activity', () => {
    expect(schemaContent).toContain('FLASHCARDS');
  });

  it('should include WRITTEN_QUIZ activity', () => {
    expect(schemaContent).toContain('WRITTEN_QUIZ');
  });

  it('should include ISSUE_SPOTTER activity', () => {
    expect(schemaContent).toContain('ISSUE_SPOTTER');
  });

  it('should include ESSAY_OUTLINE activity', () => {
    expect(schemaContent).toContain('ESSAY_OUTLINE');
  });

  it('should include FULL_ESSAY activity', () => {
    expect(schemaContent).toContain('FULL_ESSAY');
  });

  it('should include ERROR_CORRECTION activity', () => {
    expect(schemaContent).toContain('ERROR_CORRECTION');
  });
});

// ============================================
// SOURCE GOVERNANCE TESTS
// ============================================

describe('M4 Source Governance', () => {
  let governanceContent: string;

  beforeAll(() => {
    governanceContent = fs.readFileSync(
      path.join(process.cwd(), 'lib/constants/source-governance.ts'),
      'utf-8'
    );
  });

  it('should have TIER_A_DOMAINS array', () => {
    expect(governanceContent).toContain('TIER_A_DOMAINS');
  });

  it('should have TIER_B_DOMAINS array', () => {
    expect(governanceContent).toContain('TIER_B_DOMAINS');
  });

  it('should have TIER_C_DOMAINS array', () => {
    expect(governanceContent).toContain('TIER_C_DOMAINS');
  });

  it('should include kenyalaw.org as Tier A', () => {
    expect(governanceContent).toContain("domain: 'kenyalaw.org'");
    expect(governanceContent).toContain("tier: 'A'");
  });

  it('should include bailii.org as Tier A', () => {
    expect(governanceContent).toContain("domain: 'bailii.org'");
  });

  it('should include westlaw.com as Tier C (restricted)', () => {
    expect(governanceContent).toContain("domain: 'westlaw.com'");
    expect(governanceContent).toContain("tier: 'C'");
  });

  it('should have isAllowedDomain function', () => {
    expect(governanceContent).toContain('export function isAllowedDomain');
  });

  it('should have canQuoteVerbatim function', () => {
    expect(governanceContent).toContain('export function canQuoteVerbatim');
  });

  it('should have getSourceTier function', () => {
    expect(governanceContent).toContain('export function getSourceTier');
  });

  it('should have GROUNDING_RULES config', () => {
    expect(governanceContent).toContain('GROUNDING_RULES');
    expect(governanceContent).toContain("fallbackMessage: 'Not found in verified sources yet'");
  });
});

// ============================================
// AUTHORITY RETRIEVAL SERVICE TESTS
// ============================================

describe('M4 Authority Retrieval Service', () => {
  let serviceContent: string;

  beforeAll(() => {
    serviceContent = fs.readFileSync(
      path.join(process.cwd(), 'lib/services/authority-retrieval-service.ts'),
      'utf-8'
    );
  });

  it('should have retrieveAuthorities function', () => {
    expect(serviceContent).toContain('export async function retrieveAuthorities');
  });

  it('should have findExistingAuthorities function', () => {
    expect(serviceContent).toContain('async function findExistingAuthorities');
  });

  it('should have proposeCandidateUrls function', () => {
    expect(serviceContent).toContain('async function proposeCandidateUrls');
  });

  it('should have fetchAndStore function', () => {
    expect(serviceContent).toContain('async function fetchAndStore');
  });

  it('should verify passage exists in source', () => {
    expect(serviceContent).toContain('function verifyPassageInSource');
  });

  it('should handle missing authority by logging', () => {
    expect(serviceContent).toContain('async function handleMissingAuthority');
    expect(serviceContent).toContain('missingAuthorityLog');
  });

  it('should import source governance rules', () => {
    expect(serviceContent).toContain("from '@/lib/constants/source-governance'");
    expect(serviceContent).toContain('isAllowedDomain');
    expect(serviceContent).toContain('getDomainInfo');
  });

  it('should filter candidates by allowlist', () => {
    expect(serviceContent).toContain('isAllowedDomain(c.url)');
  });

  it('should have buildGroundedContent function', () => {
    expect(serviceContent).toContain('export async function buildGroundedContent');
  });
});

// ============================================
// NOTIFICATION SERVICE TESTS
// ============================================

describe('M4 Notification Service', () => {
  let serviceContent: string;

  beforeAll(() => {
    serviceContent = fs.readFileSync(
      path.join(process.cwd(), 'lib/services/notification-service.ts'),
      'utf-8'
    );
  });

  it('should have sendEmailViaBrevo function (HTTP API, not SMTP)', () => {
    expect(serviceContent).toContain('export async function sendEmailViaBrevo');
    expect(serviceContent).toContain('api.brevo.com/v3/smtp/email');
    expect(serviceContent).not.toContain('createTransport'); // No nodemailer SMTP
  });

  it('should use Brevo HTTP API headers', () => {
    expect(serviceContent).toContain("'api-key': BREVO_API_KEY");
    expect(serviceContent).toContain("'content-type': 'application/json'");
  });

  it('should have EMAIL_TEMPLATES', () => {
    expect(serviceContent).toContain('EMAIL_TEMPLATES');
    expect(serviceContent).toContain('DAILY_REMINDER');
    expect(serviceContent).toContain('MISSED_DAY');
    expect(serviceContent).toContain('SESSION_READY');
  });

  it('should have sendNotificationEmail function', () => {
    expect(serviceContent).toContain('export async function sendNotificationEmail');
  });

  it('should have registerPushSubscription function', () => {
    expect(serviceContent).toContain('export async function registerPushSubscription');
  });

  it('should have sendPushNotification function', () => {
    expect(serviceContent).toContain('export async function sendPushNotification');
  });

  it('should have processReminderTick function', () => {
    expect(serviceContent).toContain('export async function processReminderTick');
  });

  it('should store to notification_log', () => {
    expect(serviceContent).toContain('notificationLog');
    expect(serviceContent).toContain("channel: 'EMAIL'");
    expect(serviceContent).toContain("channel: 'PUSH'");
  });

  it('should have idempotency check for daily reminders', () => {
    expect(serviceContent).toContain('alreadySent');
  });
});

// ============================================
// BACKGROUND WORKER JOB TYPES TESTS
// ============================================

describe('M4 Background Worker Job Types', () => {
  let workerContent: string;

  beforeAll(() => {
    workerContent = fs.readFileSync(
      path.join(process.cwd(), 'lib/services/background-worker.ts'),
      'utf-8'
    );
  });

  it('should have RETRIEVE_AUTHORITIES job type', () => {
    expect(workerContent).toContain("'RETRIEVE_AUTHORITIES'");
  });

  it('should have SEND_REMINDER_EMAIL job type', () => {
    expect(workerContent).toContain("'SEND_REMINDER_EMAIL'");
  });

  it('should have SEND_PUSH_REMINDER job type', () => {
    expect(workerContent).toContain("'SEND_PUSH_REMINDER'");
  });

  it('should have processRetrieveAuthorities handler', () => {
    expect(workerContent).toContain('async function processRetrieveAuthorities');
  });

  it('should have processSendReminderEmail handler', () => {
    expect(workerContent).toContain('async function processSendReminderEmail');
  });

  it('should have processSendPushReminder handler', () => {
    expect(workerContent).toContain('async function processSendPushReminder');
  });

  it('should handle new job types in switch', () => {
    expect(workerContent).toContain("case 'RETRIEVE_AUTHORITIES':");
    expect(workerContent).toContain("case 'SEND_REMINDER_EMAIL':");
    expect(workerContent).toContain("case 'SEND_PUSH_REMINDER':");
  });
});

// ============================================
// CRON TICK ENDPOINT TESTS
// ============================================

describe('M4 Cron Tick Endpoint', () => {
  let routeContent: string;

  beforeAll(() => {
    routeContent = fs.readFileSync(
      path.join(process.cwd(), 'app/api/cron/tick/route.ts'),
      'utf-8'
    );
  });

  it('should have GET handler', () => {
    expect(routeContent).toContain('export async function GET');
  });

  it('should have POST handler', () => {
    expect(routeContent).toContain('export async function POST');
  });

  it('should check CRON_SECRET for security', () => {
    expect(routeContent).toContain('CRON_SECRET');
    expect(routeContent).toContain('Unauthorized');
  });

  it('should call processReminderTick', () => {
    expect(routeContent).toContain('processReminderTick');
  });

  it('should support token via query param', () => {
    expect(routeContent).toContain("url.searchParams.get('token')");
  });
});

// ============================================
// ADMIN JOBS ENDPOINT TESTS
// ============================================

describe('M4 Admin Jobs Endpoint', () => {
  let routeContent: string;

  beforeAll(() => {
    routeContent = fs.readFileSync(
      path.join(process.cwd(), 'app/api/admin/jobs/route.ts'),
      'utf-8'
    );
  });

  it('should have GET handler for listing jobs', () => {
    expect(routeContent).toContain('export async function GET');
  });

  it('should have POST handler for retry/cancel', () => {
    expect(routeContent).toContain('export async function POST');
  });

  it('should support filtering by status', () => {
    expect(routeContent).toContain("url.searchParams.get('status')");
  });

  it('should support filtering by job type', () => {
    expect(routeContent).toContain("url.searchParams.get('type')");
  });

  it('should have retry action', () => {
    expect(routeContent).toContain("case 'retry':");
  });

  it('should have cancel action', () => {
    expect(routeContent).toContain("case 'cancel':");
  });

  it('should get job statistics', () => {
    expect(routeContent).toContain('getJobStats');
  });
});

// ============================================
// GROUNDING ENFORCEMENT TESTS
// ============================================

describe('M4 Grounding Enforcement', () => {
  it('should have fallback message in source governance', () => {
    const governanceContent = fs.readFileSync(
      path.join(process.cwd(), 'lib/constants/source-governance.ts'),
      'utf-8'
    );
    expect(governanceContent).toContain("'Not found in verified sources yet'");
  });

  it('should log missing authorities in retrieval service', () => {
    const serviceContent = fs.readFileSync(
      path.join(process.cwd(), 'lib/services/authority-retrieval-service.ts'),
      'utf-8'
    );
    expect(serviceContent).toContain('missingAuthorityLog');
    expect(serviceContent).toContain('handleMissingAuthority');
  });

  it('should reject URLs from non-allowlisted domains', () => {
    const governanceContent = fs.readFileSync(
      path.join(process.cwd(), 'lib/constants/source-governance.ts'),
      'utf-8'
    );
    expect(governanceContent).toContain("reason: 'Domain not in allowlist'");
  });

  it('should mark Tier C as verbatim-forbidden', () => {
    const governanceContent = fs.readFileSync(
      path.join(process.cwd(), 'lib/constants/source-governance.ts'),
      'utf-8'
    );
    expect(governanceContent).toContain('maxVerbatimChars: 0');
  });
});

// ============================================
// DATABASE TESTS (Live Check)
// ============================================

describe('M4 Database Verification', () => {
  it('should have authority_records table', async () => {
    const { neon } = await import('@neondatabase/serverless');
    const envPath = path.join(process.cwd(), '.env');
    const envContent = fs.readFileSync(envPath, 'utf-8');
    const dbMatch = envContent.match(/^DATABASE_URL=(.+)$/m);
    const DATABASE_URL = dbMatch?.[1] || '';
    const sql = neon(DATABASE_URL);

    const result = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'authority_records'
    `;
    
    expect(result.length).toBe(1);
  }, 10000);

  it('should have notification_log table', async () => {
    const { neon } = await import('@neondatabase/serverless');
    const envPath = path.join(process.cwd(), '.env');
    const envContent = fs.readFileSync(envPath, 'utf-8');
    const dbMatch = envContent.match(/^DATABASE_URL=(.+)$/m);
    const DATABASE_URL = dbMatch?.[1] || '';
    const sql = neon(DATABASE_URL);

    const result = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'notification_log'
    `;
    
    expect(result.length).toBe(1);
  }, 10000);

  it('should have push_subscriptions table', async () => {
    const { neon } = await import('@neondatabase/serverless');
    const envPath = path.join(process.cwd(), '.env');
    const envContent = fs.readFileSync(envPath, 'utf-8');
    const dbMatch = envContent.match(/^DATABASE_URL=(.+)$/m);
    const DATABASE_URL = dbMatch?.[1] || '';
    const sql = neon(DATABASE_URL);

    const result = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'push_subscriptions'
    `;
    
    expect(result.length).toBe(1);
  }, 10000);

  it('should have study_activity_type enum in database', async () => {
    const { neon } = await import('@neondatabase/serverless');
    const envPath = path.join(process.cwd(), '.env');
    const envContent = fs.readFileSync(envPath, 'utf-8');
    const dbMatch = envContent.match(/^DATABASE_URL=(.+)$/m);
    const DATABASE_URL = dbMatch?.[1] || '';
    const sql = neon(DATABASE_URL);

    const result = await sql`
      SELECT typname 
      FROM pg_type 
      WHERE typname = 'study_activity_type'
    `;
    
    expect(result.length).toBe(1);
  }, 10000);
});

// ============================================
// M4 GROUNDING ENFORCEMENT TESTS
// ============================================

describe('M4 Grounding Enforcement: assertGrounded', () => {
  let validatorContent: string;

  beforeAll(() => {
    validatorContent = fs.readFileSync(
      path.join(process.cwd(), 'lib/services/generators/grounding-validator.ts'),
      'utf-8'
    );
  });

  it('should export assertGrounded function', () => {
    expect(validatorContent).toContain('export async function assertGrounded');
  });

  it('should check for MISSING_CITATION errors', () => {
    expect(validatorContent).toContain("code: 'MISSING_CITATION'");
  });

  it('should check for INVALID_AUTHORITY errors', () => {
    expect(validatorContent).toContain("code: 'INVALID_AUTHORITY'");
  });

  it('should check for MISSING_LOCATOR errors', () => {
    expect(validatorContent).toContain("code: 'MISSING_LOCATOR'");
  });

  it('should verify authority_ids exist in database', () => {
    expect(validatorContent).toContain('authorityRecords');
    expect(validatorContent).toContain('validAuthorityIds');
  });

  it('should support fallback items with checkIsFallback', () => {
    expect(validatorContent).toContain('checkIsFallback');
    expect(validatorContent).toContain('GROUNDING_RULES.fallbackMessage');
  });

  it('should have validateAndFix for soft mode', () => {
    expect(validatorContent).toContain('export async function validateAndFix');
    expect(validatorContent).toContain('strict?: boolean');
  });

  it('should log validation failures to missing_authority_log', () => {
    expect(validatorContent).toContain('missingAuthorityLog');
    expect(validatorContent).toContain('VALIDATION_FAILED');
  });
});

describe('M4 Grounding Enforcement: Content Format', () => {
  let generatorContent: string;

  beforeAll(() => {
    generatorContent = fs.readFileSync(
      path.join(process.cwd(), 'lib/services/generators/written-generators.ts'),
      'utf-8'
    );
  });

  it('should include citations in generated items', () => {
    expect(generatorContent).toContain('citations: [{');
    expect(generatorContent).toContain('authority_id:');
    expect(generatorContent).toContain('url:');
    expect(generatorContent).toContain('locator_json:');
  });

  it('should include evidence_span_ids in items', () => {
    expect(generatorContent).toContain('evidence_span_ids:');
  });

  it('should create fallback items when no passages', () => {
    expect(generatorContent).toContain('createFallbackResponse');
    expect(generatorContent).toContain('GROUNDING_RULES.fallbackMessage');
  });
});

// ============================================
// M4 ACTIVITY VARIETY TESTS
// ============================================

describe('M4 Activity Variety: Session Blueprint', () => {
  let blueprintContent: string;

  beforeAll(() => {
    blueprintContent = fs.readFileSync(
      path.join(process.cwd(), 'lib/services/generators/session-blueprint.ts'),
      'utf-8'
    );
  });

  it('should define all 11 activity types', () => {
    const activityTypes = [
      'READING_NOTES', 'MEMORY_CHECK', 'FLASHCARDS', 'WRITTEN_QUIZ',
      'ISSUE_SPOTTER', 'RULE_ELEMENTS_DRILL', 'ESSAY_OUTLINE', 'FULL_ESSAY',
      'PAST_PAPER_STYLE', 'ERROR_CORRECTION', 'MIXED_REVIEW'
    ];
    
    activityTypes.forEach(type => {
      expect(blueprintContent).toContain(`'${type}'`);
    });
  });

  it('should export computeDefaultActivityMix function', () => {
    expect(blueprintContent).toContain('export function computeDefaultActivityMix');
  });

  it('should have default mixes for different session lengths', () => {
    expect(blueprintContent).toContain('DEFAULT_MIX_30_MINUTES');
    expect(blueprintContent).toContain('DEFAULT_MIX_45_MINUTES');
    expect(blueprintContent).toContain('DEFAULT_MIX_60_MINUTES');
  });

  it('should have weak skill adjustments', () => {
    expect(blueprintContent).toContain('WEAK_SKILL_MIX');
    expect(blueprintContent).toContain('pMastery < 0.4');
    expect(blueprintContent).toContain('consecutiveWrong >= 3');
  });

  it('should have strong skill adjustments', () => {
    expect(blueprintContent).toContain('STRONG_SKILL_MIX');
    expect(blueprintContent).toContain('pMastery > 0.8');
  });

  it('should apply phase adjustments', () => {
    expect(blueprintContent).toContain('applyPhaseAdjustments');
    expect(blueprintContent).toContain("phase === 'critical'");
    expect(blueprintContent).toContain("phase === 'approaching'");
  });

  it('should export getActivityTypesForAsset function', () => {
    expect(blueprintContent).toContain('export function getActivityTypesForAsset');
  });

  it('should map activity types to asset types correctly', () => {
    // NOTES should get READING_NOTES
    expect(blueprintContent).toContain("case 'NOTES':");
    expect(blueprintContent).toContain("'READING_NOTES'");
    
    // CHECKPOINT should get MEMORY_CHECK and FLASHCARDS
    expect(blueprintContent).toContain("case 'CHECKPOINT':");
    expect(blueprintContent).toContain("'MEMORY_CHECK', 'FLASHCARDS'");
  });
});

describe('M4 Activity Variety: Written Generators', () => {
  let generatorContent: string;

  beforeAll(() => {
    generatorContent = fs.readFileSync(
      path.join(process.cwd(), 'lib/services/generators/written-generators.ts'),
      'utf-8'
    );
  });

  it('should have generateActivityItems entry point', () => {
    expect(generatorContent).toContain('export async function generateActivityItems');
  });

  it('should have READING_NOTES generator', () => {
    expect(generatorContent).toContain('generateReadingNotes');
    expect(generatorContent).toContain("case 'READING_NOTES':");
  });

  it('should have MEMORY_CHECK generator', () => {
    expect(generatorContent).toContain('generateMemoryCheck');
    expect(generatorContent).toContain("case 'MEMORY_CHECK':");
  });

  it('should have FLASHCARDS generator', () => {
    expect(generatorContent).toContain('generateFlashcards');
    expect(generatorContent).toContain("case 'FLASHCARDS':");
  });

  it('should have WRITTEN_QUIZ generator', () => {
    expect(generatorContent).toContain('generateWrittenQuiz');
    expect(generatorContent).toContain("case 'WRITTEN_QUIZ':");
  });

  it('should have ISSUE_SPOTTER generator', () => {
    expect(generatorContent).toContain('generateIssueSpotter');
    expect(generatorContent).toContain("case 'ISSUE_SPOTTER':");
  });

  it('should have RULE_ELEMENTS_DRILL generator', () => {
    expect(generatorContent).toContain('generateRuleElementsDrill');
    expect(generatorContent).toContain("case 'RULE_ELEMENTS_DRILL':");
  });

  it('should have ESSAY_OUTLINE generator', () => {
    expect(generatorContent).toContain('generateEssayOutline');
    expect(generatorContent).toContain("case 'ESSAY_OUTLINE':");
  });

  it('should have ERROR_CORRECTION generator', () => {
    expect(generatorContent).toContain('generateErrorCorrection');
    expect(generatorContent).toContain("case 'ERROR_CORRECTION':");
  });

  it('should have PAST_PAPER_STYLE generator', () => {
    expect(generatorContent).toContain('generatePastPaperStyle');
    expect(generatorContent).toContain("case 'PAST_PAPER_STYLE':");
  });
});

// ============================================
// M4 FAIL-CLOSED TESTS
// ============================================

describe('M4 Fail-Closed: Grounding Rules', () => {
  let governanceContent: string;

  beforeAll(() => {
    governanceContent = fs.readFileSync(
      path.join(process.cwd(), 'lib/constants/source-governance.ts'),
      'utf-8'
    );
  });

  it('should have GROUNDING_RULES configuration', () => {
    expect(governanceContent).toContain('GROUNDING_RULES');
  });

  it('should have fallback message for missing sources', () => {
    expect(governanceContent).toContain('fallbackMessage');
    expect(governanceContent).toContain('Not found in verified sources yet');
  });

  it('should require minimum citation count', () => {
    expect(governanceContent).toContain('minCitationCount');
  });
});

describe('M4 Fail-Closed: Background Worker', () => {
  let workerContent: string;

  beforeAll(() => {
    workerContent = fs.readFileSync(
      path.join(process.cwd(), 'lib/services/background-worker.ts'),
      'utf-8'
    );
  });

  it('should use validateAndFix in processGenerateSessionAssets', () => {
    expect(workerContent).toContain('validateAndFix');
    expect(workerContent).toContain('strict: false');
  });

  it('should track wasFixed for assets that needed fixing', () => {
    expect(workerContent).toContain('wasFixed');
  });

  it('should set status to FAILED on error', () => {
    expect(workerContent).toContain("status: 'FAILED'");
    expect(workerContent).toContain('generationError:');
  });

  it('should create evidence spans from passages', () => {
    expect(workerContent).toContain('createEvidenceSpansFromPassages');
  });

  it('should build grounding refs with authority_ids', () => {
    expect(workerContent).toContain('authority_ids:');
    expect(workerContent).toContain('retrieval.authorities.map');
  });
});

// ============================================
// M4 ASSET CONTENT FORMAT TESTS
// ============================================

describe('M4 Asset Content Format', () => {
  let workerContent: string;

  beforeAll(() => {
    workerContent = fs.readFileSync(
      path.join(process.cwd(), 'lib/services/background-worker.ts'),
      'utf-8'
    );
  });

  it('should have standardized content format with assetType', () => {
    expect(workerContent).toContain("contentJson = {");
    expect(workerContent).toContain("assetType,");
    expect(workerContent).toContain("items:");
  });

  it('should include activityTypes in content', () => {
    expect(workerContent).toContain('activityTypes: validatedContent.activity_types');
  });

  it('should include stats about cited items', () => {
    expect(workerContent).toContain('stats: {');
    expect(workerContent).toContain('totalItems:');
    expect(workerContent).toContain('citedItems:');
    expect(workerContent).toContain('fallbackItems:');
  });

  it('should persist activity_types to database', () => {
    expect(workerContent).toContain('activityTypes: validatedContent.activity_types');
  });
});

// ============================================
// M4 SCHEMA ACTIVITY_TYPES COLUMN TEST
// ============================================

describe('M4 Schema: study_assets.activity_types', () => {
  let schemaContent: string;

  beforeAll(() => {
    schemaContent = fs.readFileSync(
      path.join(process.cwd(), 'lib/db/schema.ts'),
      'utf-8'
    );
  });

  it('should have activity_types column in study_assets', () => {
    expect(schemaContent).toContain("activityTypes: text('activity_types').array()");
  });
});

// ============================================
// M4 RUBRIC GENERATOR TESTS
// ============================================

describe('M4 Rubric Generator', () => {
  let rubricContent: string;

  beforeAll(() => {
    rubricContent = fs.readFileSync(
      path.join(process.cwd(), 'lib/services/generators/rubric-generator.ts'),
      'utf-8'
    );
  });

  it('should export generateRubric function', () => {
    expect(rubricContent).toContain('export async function generateRubric');
  });

  it('should generate essay rubric when essay types present', () => {
    expect(rubricContent).toContain('generateEssayRubric');
    expect(rubricContent).toContain('ESSAY_OUTLINE');
    expect(rubricContent).toContain('FULL_ESSAY');
  });

  it('should generate quiz rubric for quiz types', () => {
    expect(rubricContent).toContain('generateQuizRubric');
    expect(rubricContent).toContain('WRITTEN_QUIZ');
  });

  it('should include citations in rubric criteria', () => {
    expect(rubricContent).toContain('citations:');
    expect(rubricContent).toContain('RubricCriterion');
  });

  it('should have fallback rubric for missing sources', () => {
    expect(rubricContent).toContain('createFallbackRubric');
    expect(rubricContent).toContain('GROUNDING_RULES.fallbackMessage');
  });
});

// ============================================
// M4 GENERATOR INDEX EXPORTS
// ============================================

describe('M4 Generator Index Exports', () => {
  let indexContent: string;

  beforeAll(() => {
    indexContent = fs.readFileSync(
      path.join(process.cwd(), 'lib/services/generators/index.ts'),
      'utf-8'
    );
  });

  it('should export session blueprint functions', () => {
    expect(indexContent).toContain('computeDefaultActivityMix');
    expect(indexContent).toContain('getActivityTypesForAsset');
    expect(indexContent).toContain('SessionBlueprint');
  });

  it('should export grounding validator functions', () => {
    expect(indexContent).toContain('assertGrounded');
    expect(indexContent).toContain('validateAndFix');
    expect(indexContent).toContain('AssetContent');
  });

  it('should export written generators', () => {
    expect(indexContent).toContain('generateActivityItems');
    expect(indexContent).toContain('fetchPassagesWithAuthority');
  });

  it('should export rubric generator', () => {
    expect(indexContent).toContain('generateRubric');
    expect(indexContent).toContain('RubricContext');
  });
});
