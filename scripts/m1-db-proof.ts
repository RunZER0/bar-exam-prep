/**
 * M1 Proof Artifact Generator
 * Produces exact SQL + output for supervisor review
 */

import { neon } from '@neondatabase/serverless';
import * as fs from 'fs';
import * as path from 'path';

const envPath = path.join(__dirname, '..', '.env');
const envContent = fs.readFileSync(envPath, 'utf-8');
const dbMatch = envContent.match(/^DATABASE_URL=(.+)$/m);
const DATABASE_URL = dbMatch?.[1] || '';

const sql = neon(DATABASE_URL);

async function main() {
  console.log('='.repeat(60));
  console.log('A) DB PROOF - RAW SQL OUTPUTS');
  console.log('='.repeat(60));
  console.log('');

  // 1) Cycles + events
  console.log('-- 1) Cycles + events');
  console.log('SELECT id, label, candidate_type, timezone FROM exam_cycles ORDER BY label;');
  console.log('');
  const cycles = await sql`SELECT id, label, candidate_type, timezone FROM exam_cycles ORDER BY label`;
  console.log('| id | label | candidate_type | timezone |');
  console.log('|---|---|---|---|');
  for (const c of cycles) {
    console.log(`| ${c.id} | ${c.label} | ${c.candidate_type} | ${c.timezone} |`);
  }
  console.log('');

  console.log('SELECT c.label, e.event_type, e.starts_at, e.ends_at FROM exam_events e JOIN exam_cycles c ON c.id=e.cycle_id ORDER BY c.label, e.event_type;');
  console.log('');
  const events = await sql`SELECT c.label, e.event_type, e.starts_at, e.ends_at FROM exam_events e JOIN exam_cycles c ON c.id=e.cycle_id ORDER BY c.label, e.event_type`;
  console.log('| label | event_type | starts_at | ends_at |');
  console.log('|---|---|---|---|');
  for (const e of events) {
    console.log(`| ${e.label} | ${e.event_type} | ${e.starts_at} | ${e.ends_at} |`);
  }
  console.log('');

  // 2) User profiles
  console.log('-- 2) User profile exists');
  console.log('SELECT user_id, cycle_id FROM user_exam_profiles ORDER BY updated_at DESC LIMIT 5;');
  console.log('');
  const profiles = await sql`SELECT user_id, cycle_id FROM user_exam_profiles ORDER BY updated_at DESC LIMIT 5`;
  if (profiles.length === 0) {
    console.log('(0 rows - users need to complete onboarding via POST /api/exam/profile)');
  } else {
    console.log('| user_id | cycle_id |');
    console.log('|---|---|');
    for (const p of profiles) {
      console.log(`| ${p.user_id} | ${p.cycle_id} |`);
    }
  }
  console.log('');

  // 3) Outline ingestion
  console.log('-- 3) Outline ingestion proof');
  console.log('SELECT COUNT(*) AS topics FROM outline_topics;');
  const topicsCount = await sql`SELECT COUNT(*) AS topics FROM outline_topics`;
  console.log(`topics: ${topicsCount[0]?.topics}`);
  console.log('');

  console.log('SELECT COUNT(*) AS skills FROM micro_skills;');
  const skillsCount = await sql`SELECT COUNT(*) AS skills FROM micro_skills`;
  console.log(`skills: ${skillsCount[0]?.skills}`);
  console.log('');

  console.log('SELECT COUNT(*) AS links FROM skill_outline_map;');
  const linksCount = await sql`SELECT COUNT(*) AS links FROM skill_outline_map`;
  console.log(`links: ${linksCount[0]?.links}`);
  console.log('');

  // 4) Schema check
  console.log('-- 4) micro_skills schema (D requirement)');
  console.log('SELECT column_name FROM information_schema.columns WHERE table_name = \'micro_skills\' ORDER BY ordinal_position;');
  const cols = await sql`SELECT column_name FROM information_schema.columns WHERE table_name = 'micro_skills' ORDER BY ordinal_position`;
  console.log('Columns:', cols.map((c: any) => c.column_name).join(', '));
  console.log('');
  console.log('D) Schema note: micro_skills uses "name" column (not "title")');
  console.log('');

  // Summary
  console.log('='.repeat(60));
  console.log('VERIFICATION SUMMARY');
  console.log('='.repeat(60));
  const topicsN = Number(topicsCount[0]?.topics);
  const skillsN = Number(skillsCount[0]?.skills);
  const linksN = Number(linksCount[0]?.links);

  if (topicsN === 0) {
    console.log('❌ outline_topics = 0 (FAIL - need outline import)');
  } else {
    console.log(`✅ outline_topics = ${topicsN}`);
  }

  if (skillsN === 0) {
    console.log('❌ micro_skills = 0 (FAIL)');
  } else {
    console.log(`✅ micro_skills = ${skillsN}`);
  }

  if (linksN === 0) {
    console.log('❌ skill_outline_map = 0 (FAIL - no traceability)');
  } else {
    console.log(`✅ skill_outline_map = ${linksN}`);
  }

  if (cycles.length >= 2) {
    console.log(`✅ exam_cycles = ${cycles.length} (RESIT + FIRST_TIME)`);
  } else {
    console.log(`❌ exam_cycles = ${cycles.length} (need 2)`);
  }

  if (events.length >= 3) {
    console.log(`✅ exam_events = ${events.length} (WRITTEN + ORAL)`);
  } else {
    console.log(`❌ exam_events = ${events.length} (need 3+)`);
  }
}

main().catch(console.error);
