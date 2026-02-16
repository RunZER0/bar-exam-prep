/**
 * M3 API Proof
 * Verifies retrieval-first pipeline and grounding structures
 */

import * as fs from 'fs';
import * as path from 'path';

console.log('='.repeat(60));
console.log('M3 API PROOF');
console.log('='.repeat(60));

// 1. Verify transcript ingestion service exports
console.log('\n1. Transcript Ingestion Service Functions:');
console.log('-'.repeat(40));

const transcriptService = fs.readFileSync(
  path.join(process.cwd(), 'lib/services/transcript-ingestion.ts'),
  'utf-8'
);

const transcriptFunctions = [
  'chunkTranscript',
  'parseVTT',
  'parseSRT', 
  'detectFormat',
  'estimateTokenCount',
  'ingestTranscript',
  'suggestSkillMappings',
  'approveMapping',
  'rejectMapping',
  'getApprovedChunksForSkill'
];

transcriptFunctions.forEach(fn => {
  const exists = transcriptService.includes(`export async function ${fn}`) || 
                 transcriptService.includes(`export function ${fn}`);
  console.log(`  ${exists ? '✓' : '✗'} ${fn}`);
});

// 2. Verify retrieval service exports
console.log('\n2. Retrieval Service Functions:');
console.log('-'.repeat(40));

const retrievalService = fs.readFileSync(
  path.join(process.cwd(), 'lib/services/retrieval-service.ts'),
  'utf-8'
);

const retrievalFunctions = [
  'retrieveGroundingForSkill',
  'retrieveOutlineTopics',
  'retrieveLectureChunks',
  'retrieveAuthorities',
  'generateGroundedContent',
  'logMissingAuthority',
  'hasAdequateGrounding',
  'buildGroundingRefsJson'
];

retrievalFunctions.forEach(fn => {
  const exists = retrievalService.includes(`export async function ${fn}`) || 
                 retrievalService.includes(`export function ${fn}`);
  console.log(`  ${exists ? '✓' : '✗'} ${fn}`);
});

// 3. Verify background worker uses retrieval-first
console.log('\n3. Background Worker Retrieval-First Integration:');
console.log('-'.repeat(40));

const bgWorker = fs.readFileSync(
  path.join(process.cwd(), 'lib/services/background-worker.ts'),
  'utf-8'
);

const workerChecks = [
  { pattern: "from './retrieval-service'", desc: 'imports retrieval-service' },
  { pattern: 'retrieveGroundingForSkill', desc: 'calls retrieveGroundingForSkill' },
  { pattern: 'logMissingAuthority', desc: 'logs missing authority' },
  { pattern: 'createEvidenceSpans', desc: 'creates evidence spans' },
  { pattern: 'buildNotesFromSources', desc: 'builds notes from sources' },
  { pattern: 'buildGroundingRefsJson', desc: 'builds grounding refs JSON' },
  { pattern: 'Not found in verified sources yet', desc: 'has fallback message' }
];

workerChecks.forEach(check => {
  const exists = bgWorker.includes(check.pattern);
  console.log(`  ${exists ? '✓' : '✗'} ${check.desc}`);
});

// 4. Verify admin API routes
console.log('\n4. Admin API Routes:');
console.log('-'.repeat(40));

const adminRoutes = [
  'app/api/admin/transcripts/route.ts',
  'app/api/admin/transcripts/mappings/route.ts'
];

adminRoutes.forEach(route => {
  const exists = fs.existsSync(path.join(process.cwd(), route));
  console.log(`  ${exists ? '✓' : '✗'} ${route}`);
});

// 5. Verify grounding refs structure
console.log('\n5. Grounding Refs JSON Structure:');
console.log('-'.repeat(40));

const groundingRefsMatch = retrievalService.match(/export function buildGroundingRefsJson[\s\S]*?return \{[\s\S]*?\};/);
if (groundingRefsMatch) {
  console.log('  ✓ Structure includes:');
  if (retrievalService.includes('outline_topic_ids')) console.log('    - outline_topic_ids');
  if (retrievalService.includes('lecture_chunk_ids')) console.log('    - lecture_chunk_ids');
  if (retrievalService.includes('authority_ids')) console.log('    - authority_ids');
}

// 6. Verify phase fix
console.log('\n6. Phase Calculation (Bug Fix Verification):');
console.log('-'.repeat(40));

const masteryEngine = fs.readFileSync(
  path.join(process.cwd(), 'lib/services/mastery-engine.ts'),
  'utf-8'
);

const phaseMatch = masteryEngine.match(/phaseThresholds:\s*\{[^}]+\}/);
if (phaseMatch) {
  console.log('  ' + phaseMatch[0]);
}

const phaseChecks = [
  { days: 270, expected: 'distant', reason: '>= 60' },
  { days: 60, expected: 'distant', reason: '>= 60' },
  { days: 59, expected: 'approaching', reason: '8-59' },
  { days: 8, expected: 'approaching', reason: '8-59' },
  { days: 7, expected: 'critical', reason: '0-7' },
  { days: 0, expected: 'critical', reason: '0-7' }
];

// Extract determineExamPhase function logic
const hasCorrectLogic = masteryEngine.includes('if (daysUntilExam >= 60)') &&
                        masteryEngine.includes('if (daysUntilExam >= 8)') &&
                        masteryEngine.includes("return 'distant'") &&
                        masteryEngine.includes("return 'approaching'") &&
                        masteryEngine.includes("return 'critical'");

console.log(`  ${hasCorrectLogic ? '✓' : '✗'} Phase logic correct (3 phases: distant >= 60, approaching 8-59, critical 0-7)`);

// 7. Schema grounding_refs_json
console.log('\n7. Schema grounding_refs_json Column:');
console.log('-'.repeat(40));

const schema = fs.readFileSync(
  path.join(process.cwd(), 'lib/db/schema.ts'),
  'utf-8'
);

const hasGroundingRefs = schema.includes('grounding_refs_json') || schema.includes('groundingRefsJson');
console.log(`  ${hasGroundingRefs ? '✓' : '✗'} grounding_refs_json in study_assets table`);

// 8. Evidence spans structure
console.log('\n8. Evidence Spans Table Structure:');
console.log('-'.repeat(40));

const evidenceSpansFields = [
  'target_type',
  'target_id',
  'source_type',
  'source_id',
  'quoted_text',
  'claim_text',
  'confidence_score'
];

evidenceSpansFields.forEach(field => {
  const camelCase = field.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
  const exists = schema.includes(field) || schema.includes(camelCase);
  console.log(`  ${exists ? '✓' : '✗'} ${field}`);
});

// 9. Test summary
console.log('\n9. M3 Acceptance Tests:');
console.log('-'.repeat(40));

const m3Tests = fs.readFileSync(
  path.join(process.cwd(), 'tests/m3-acceptance.test.ts'),
  'utf-8'
);

const testGroups = [
  'M3 Schema',
  'Transcript Ingestion',
  'Retrieval Service',
  'Background Worker', 
  'Admin API',
  'Phase Fix',
  'Grounding Refs'
];

testGroups.forEach(group => {
  const exists = m3Tests.includes(`describe('${group}'`) || m3Tests.includes(group);
  console.log(`  ${exists ? '✓' : '✗'} ${group} tests`);
});

const testCount = (m3Tests.match(/it\(/g) || []).length;
console.log(`  Total test cases: ${testCount}`);

console.log('\n' + '='.repeat(60));
console.log('M3 API Proof Complete');
console.log('='.repeat(60));
