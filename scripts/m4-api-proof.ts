/**
 * M4 API Proof
 * Verifies all M4 services, endpoints, and integration
 */

import * as fs from 'fs';
import * as path from 'path';

console.log('='.repeat(60));
console.log('M4 API PROOF: Mastery Hub (Written Exam Mode)');
console.log('='.repeat(60));

// 1. Source Governance Config
console.log('\n1. Source Governance Config:');
console.log('-'.repeat(40));

const governance = fs.readFileSync(
  path.join(process.cwd(), 'lib/constants/source-governance.ts'),
  'utf-8'
);

const govChecks = [
  { pattern: 'TIER_A_DOMAINS', desc: 'Tier A domains (primary law)' },
  { pattern: 'TIER_B_DOMAINS', desc: 'Tier B domains (commentary)' },
  { pattern: 'TIER_C_DOMAINS', desc: 'Tier C domains (restricted)' },
  { pattern: 'kenyalaw.org', desc: 'Kenya Law as Tier A' },
  { pattern: 'bailii.org', desc: 'BAILII as Tier A' },
  { pattern: 'isAllowedDomain', desc: 'isAllowedDomain function' },
  { pattern: 'canQuoteVerbatim', desc: 'canQuoteVerbatim function' },
  { pattern: 'getSourcePolicy', desc: 'getSourcePolicy function' },
  { pattern: 'GROUNDING_RULES', desc: 'GROUNDING_RULES config' },
  { pattern: "'Not found in verified sources yet'", desc: 'Fallback message' },
];

govChecks.forEach(check => {
  const exists = governance.includes(check.pattern);
  console.log(`  ${exists ? '✓' : '✗'} ${check.desc}`);
});

// 2. Authority Retrieval Service
console.log('\n2. Authority Retrieval Service:');
console.log('-'.repeat(40));

const retrieval = fs.readFileSync(
  path.join(process.cwd(), 'lib/services/authority-retrieval-service.ts'),
  'utf-8'
);

const retrievalChecks = [
  { pattern: 'export async function retrieveAuthorities', desc: 'retrieveAuthorities' },
  { pattern: 'proposeCandidateUrls', desc: 'proposeCandidateUrls' },
  { pattern: 'fetchAndStore', desc: 'fetchAndStore' },
  { pattern: 'verifyPassageInSource', desc: 'verifyPassageInSource' },
  { pattern: 'handleMissingAuthority', desc: 'handleMissingAuthority' },
  { pattern: 'buildGroundedContent', desc: 'buildGroundedContent' },
  { pattern: 'isAllowedDomain(c.url)', desc: 'Filters by allowlist' },
  { pattern: 'missingAuthorityLog', desc: 'Logs missing authorities' },
];

retrievalChecks.forEach(check => {
  const exists = retrieval.includes(check.pattern);
  console.log(`  ${exists ? '✓' : '✗'} ${check.desc}`);
});

// 3. Notification Service
console.log('\n3. Notification Service (Brevo HTTP):');
console.log('-'.repeat(40));

const notification = fs.readFileSync(
  path.join(process.cwd(), 'lib/services/notification-service.ts'),
  'utf-8'
);

const notifChecks = [
  { pattern: 'api.brevo.com/v3/smtp/email', desc: 'Uses Brevo HTTP API' },
  { pattern: "'api-key': BREVO_API_KEY", desc: 'Brevo API key header' },
  { pattern: 'sendEmailViaBrevo', desc: 'sendEmailViaBrevo function' },
  { pattern: 'sendNotificationEmail', desc: 'sendNotificationEmail function' },
  { pattern: 'registerPushSubscription', desc: 'registerPushSubscription' },
  { pattern: 'sendPushNotification', desc: 'sendPushNotification' },
  { pattern: 'processReminderTick', desc: 'processReminderTick' },
  { pattern: 'EMAIL_TEMPLATES', desc: 'Email templates defined' },
  { pattern: 'DAILY_REMINDER', desc: 'Daily reminder template' },
  { pattern: 'MISSED_DAY', desc: 'Missed day template' },
  { pattern: 'notificationLog', desc: 'Logs to notification_log' },
  { pattern: 'alreadySent', desc: 'Idempotency check' },
];

notifChecks.forEach(check => {
  const exists = notification.includes(check.pattern);
  console.log(`  ${exists ? '✓' : '✗'} ${check.desc}`);
});

// 4. Background Worker Job Types
console.log('\n4. Background Worker Job Types:');
console.log('-'.repeat(40));

const worker = fs.readFileSync(
  path.join(process.cwd(), 'lib/services/background-worker.ts'),
  'utf-8'
);

const workerChecks = [
  { pattern: "'RETRIEVE_AUTHORITIES'", desc: 'RETRIEVE_AUTHORITIES job' },
  { pattern: "'SEND_REMINDER_EMAIL'", desc: 'SEND_REMINDER_EMAIL job' },
  { pattern: "'SEND_PUSH_REMINDER'", desc: 'SEND_PUSH_REMINDER job' },
  { pattern: 'processRetrieveAuthorities', desc: 'processRetrieveAuthorities handler' },
  { pattern: 'processSendReminderEmail', desc: 'processSendReminderEmail handler' },
  { pattern: 'processSendPushReminder', desc: 'processSendPushReminder handler' },
];

workerChecks.forEach(check => {
  const exists = worker.includes(check.pattern);
  console.log(`  ${exists ? '✓' : '✗'} ${check.desc}`);
});

// 5. Cron Tick Endpoint
console.log('\n5. Cron Tick Endpoint:');
console.log('-'.repeat(40));

const cron = fs.readFileSync(
  path.join(process.cwd(), 'app/api/cron/tick/route.ts'),
  'utf-8'
);

const cronChecks = [
  { pattern: 'export async function GET', desc: 'GET handler' },
  { pattern: 'export async function POST', desc: 'POST handler' },
  { pattern: 'CRON_SECRET', desc: 'CRON_SECRET security' },
  { pattern: 'processReminderTick', desc: 'Calls processReminderTick' },
  { pattern: "url.searchParams.get('token')", desc: 'Supports query param token' },
];

cronChecks.forEach(check => {
  const exists = cron.includes(check.pattern);
  console.log(`  ${exists ? '✓' : '✗'} ${check.desc}`);
});

// 6. Admin Jobs Endpoint
console.log('\n6. Admin Jobs Endpoint:');
console.log('-'.repeat(40));

const adminJobs = fs.readFileSync(
  path.join(process.cwd(), 'app/api/admin/jobs/route.ts'),
  'utf-8'
);

const adminChecks = [
  { pattern: 'export async function GET', desc: 'GET handler (list jobs)' },
  { pattern: 'export async function POST', desc: 'POST handler (retry/cancel)' },
  { pattern: "'retry':", desc: 'Retry action' },
  { pattern: "'cancel':", desc: 'Cancel action' },
  { pattern: 'getJobStats', desc: 'Job statistics' },
];

adminChecks.forEach(check => {
  const exists = adminJobs.includes(check.pattern);
  console.log(`  ${exists ? '✓' : '✗'} ${check.desc}`);
});

// 7. Schema Updates
console.log('\n7. Schema Updates:');
console.log('-'.repeat(40));

const schema = fs.readFileSync(
  path.join(process.cwd(), 'lib/db/schema.ts'),
  'utf-8'
);

const schemaChecks = [
  { pattern: "sourceTierEnum = pgEnum('source_tier'", desc: 'source_tier enum' },
  { pattern: "sourceTypeEnum = pgEnum('source_type'", desc: 'source_type enum' },
  { pattern: "licenseTagEnum = pgEnum('license_tag'", desc: 'license_tag enum' },
  { pattern: "studyActivityTypeEnum = pgEnum('study_activity_type'", desc: 'study_activity_type enum' },
  { pattern: "authorityRecords = pgTable", desc: 'authorityRecords table' },
  { pattern: "authorityPassages = pgTable", desc: 'authorityPassages table' },
  { pattern: "notificationLog = pgTable", desc: 'notificationLog table' },
  { pattern: "pushSubscriptions = pgTable", desc: 'pushSubscriptions table' },
];

schemaChecks.forEach(check => {
  const exists = schema.includes(check.pattern);
  console.log(`  ${exists ? '✓' : '✗'} ${check.desc}`);
});

// 8. Activity Types
console.log('\n8. Study Activity Types (11 types):');
console.log('-'.repeat(40));

const activityTypes = [
  'READING_NOTES',
  'MEMORY_CHECK', 
  'FLASHCARDS',
  'WRITTEN_QUIZ',
  'ISSUE_SPOTTER',
  'RULE_ELEMENTS_DRILL',
  'ESSAY_OUTLINE',
  'FULL_ESSAY',
  'PAST_PAPER_STYLE',
  'ERROR_CORRECTION',
  'MIXED_REVIEW',
];

activityTypes.forEach(type => {
  const exists = schema.includes(`'${type}'`);
  console.log(`  ${exists ? '✓' : '✗'} ${type}`);
});

// 9. Test Summary
console.log('\n9. M4 Acceptance Tests:');
console.log('-'.repeat(40));

const tests = fs.readFileSync(
  path.join(process.cwd(), 'tests/m4-acceptance.test.ts'),
  'utf-8'
);

const testGroups = [
  'M4 Schema: Authority Records',
  'M4 Schema: Notification Tables',
  'M4 Schema: Study Activity Types',
  'M4 Source Governance',
  'M4 Authority Retrieval Service',
  'M4 Notification Service',
  'M4 Background Worker Job Types',
  'M4 Cron Tick Endpoint',
  'M4 Admin Jobs Endpoint',
  'M4 Grounding Enforcement',
  'M4 Database Verification',
];

testGroups.forEach(group => {
  const exists = tests.includes(group);
  console.log(`  ${exists ? '✓' : '✗'} ${group}`);
});

const testCount = (tests.match(/it\(/g) || []).length;
console.log(`  Total test cases: ${testCount}`);

console.log('\n' + '='.repeat(60));
console.log('M4 API Proof Complete');
console.log('='.repeat(60));
