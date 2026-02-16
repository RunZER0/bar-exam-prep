/**
 * Milestone 1 Verification Script
 * Produces proof artifacts for all M1 requirements
 */

import { neon } from '@neondatabase/serverless';
import * as fs from 'fs';
import * as path from 'path';

// Load .env manually
const envPath = path.join(__dirname, '..', '.env');
const envContent = fs.readFileSync(envPath, 'utf-8');
const dbMatch = envContent.match(/^DATABASE_URL=(.+)$/m);
const DATABASE_URL = dbMatch?.[1] || '';

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL not found in .env');
  process.exit(1);
}

const sql = neon(DATABASE_URL);

async function verify() {
  console.log('═'.repeat(60));
  console.log('MILESTONE 1 VERIFICATION - PROOF ARTIFACTS');
  console.log('═'.repeat(60));
  console.log('');

  // ============================================
  // 1. EXAM CYCLES + EVENTS
  // ============================================
  console.log('━'.repeat(60));
  console.log('1️⃣  EXAM CYCLES + EVENTS');
  console.log('━'.repeat(60));

  try {
    const cycles = await sql`
      SELECT id, label, candidate_type, timezone 
      FROM exam_cycles 
      ORDER BY label
    `;
    console.log('\nSELECT id, label, candidate_type, timezone FROM exam_cycles ORDER BY label;');
    console.log('RESULT:');
    if (cycles.length === 0) {
      console.log('  ⚠️  NO EXAM CYCLES FOUND - Need to seed exam cycles');
    } else {
      cycles.forEach((row: any) => {
        console.log(`  ${row.label} | ${row.candidate_type} | ${row.timezone}`);
      });
    }
  } catch (e: any) {
    console.log(`  ❌ Error: ${e.message}`);
    if (e.message.includes('does not exist')) {
      console.log('  ⚠️  Table exam_cycles does not exist - Need to run migration 0003');
    }
  }

  try {
    const events = await sql`
      SELECT c.label, e.event_type, e.starts_at, e.ends_at
      FROM exam_events e JOIN exam_cycles c ON c.id=e.cycle_id
      ORDER BY c.label, e.event_type, e.starts_at
    `;
    console.log('\nSELECT c.label, e.event_type, e.starts_at, e.ends_at FROM exam_events e JOIN exam_cycles c ON c.id=e.cycle_id;');
    console.log('RESULT:');
    if (events.length === 0) {
      console.log('  ⚠️  NO EXAM EVENTS FOUND - Need to seed exam events');
    } else {
      events.forEach((row: any) => {
        console.log(`  ${row.label} | ${row.event_type} | ${row.starts_at} → ${row.ends_at || 'null'}`);
      });
    }
  } catch (e: any) {
    console.log(`  ❌ Error: ${e.message}`);
  }

  try {
    const profiles = await sql`
      SELECT user_id, cycle_id FROM user_exam_profiles LIMIT 5
    `;
    console.log('\nSELECT user_id, cycle_id FROM user_exam_profiles LIMIT 5;');
    console.log('RESULT:');
    if (profiles.length === 0) {
      console.log('  ⚠️  NO USER EXAM PROFILES - Users have not completed onboarding yet');
    } else {
      profiles.forEach((row: any) => {
        console.log(`  ${row.user_id} | ${row.cycle_id}`);
      });
    }
  } catch (e: any) {
    console.log(`  ❌ Error: ${e.message}`);
  }

  // ============================================
  // 3. OUTLINE IMPORT (TOPICS + SKILLS)
  // ============================================
  console.log('\n');
  console.log('━'.repeat(60));
  console.log('3️⃣  OUTLINE IMPORT (TOPICS + SKILLS + MAPPING)');
  console.log('━'.repeat(60));

  try {
    const topicsCount = await sql`SELECT COUNT(*) AS topics FROM outline_topics`;
    const skillsCount = await sql`SELECT COUNT(*) AS skills FROM micro_skills`;
    const linkedCount = await sql`SELECT COUNT(*) AS linked FROM skill_outline_map`;
    
    console.log('\nCOUNT QUERIES:');
    console.log(`  outline_topics: ${topicsCount[0]?.topics || 0}`);
    console.log(`  micro_skills: ${skillsCount[0]?.skills || 0}`);
    console.log(`  skill_outline_map: ${linkedCount[0]?.linked || 0}`);

    if (Number(topicsCount[0]?.topics) === 0) {
      console.log('\n  ⚠️  NO OUTLINE TOPICS - Need outline import');
    }
  } catch (e: any) {
    console.log(`  ❌ Error: ${e.message}`);
    if (e.message.includes('does not exist')) {
      console.log('  ⚠️  Tables do not exist - Need to run migration 0003');
    }
  }

  // Sample topic and skill
  try {
    const sampleTopic = await sql`
      SELECT id, unit_id, topic_code, title 
      FROM outline_topics 
      LIMIT 1
    `;
    if (sampleTopic.length > 0) {
      console.log('\nSample outline_topic:');
      console.log(`  ${JSON.stringify(sampleTopic[0])}`);
    }

    const sampleSkill = await sql`
      SELECT id, skill_code, title, unit_id 
      FROM micro_skills 
      LIMIT 1
    `;
    if (sampleSkill.length > 0) {
      console.log('\nSample micro_skill:');
      console.log(`  ${JSON.stringify(sampleSkill[0])}`);
    }
  } catch (e: any) {
    // Ignore
  }

  // ============================================
  // 4. STUDY SESSIONS + ASSETS
  // ============================================
  console.log('\n');
  console.log('━'.repeat(60));
  console.log('4️⃣  STUDY SESSIONS + ASSETS');
  console.log('━'.repeat(60));

  try {
    const sessions = await sql`
      SELECT id, status, modality, created_at 
      FROM study_sessions 
      ORDER BY created_at DESC 
      LIMIT 5
    `;
    console.log('\nSELECT id, status, modality, created_at FROM study_sessions ORDER BY created_at DESC LIMIT 5;');
    console.log('RESULT:');
    if (sessions.length === 0) {
      console.log('  ⚠️  NO STUDY SESSIONS - No sessions created yet');
    } else {
      sessions.forEach((row: any) => {
        console.log(`  ${row.id} | ${row.status} | ${row.modality} | ${row.created_at}`);
      });
    }
  } catch (e: any) {
    console.log(`  ❌ Error: ${e.message}`);
  }

  try {
    const assets = await sql`
      SELECT session_id, asset_type, status, jsonb_typeof(content_json) AS content_type
      FROM study_assets
      ORDER BY created_at DESC 
      LIMIT 10
    `;
    console.log('\nSELECT session_id, asset_type, status, jsonb_typeof(content_json) FROM study_assets LIMIT 10;');
    console.log('RESULT:');
    if (assets.length === 0) {
      console.log('  ⚠️  NO STUDY ASSETS - No assets generated yet');
    } else {
      assets.forEach((row: any) => {
        console.log(`  ${row.session_id?.substring(0, 8)}... | ${row.asset_type} | ${row.status} | ${row.content_type}`);
      });
    }
  } catch (e: any) {
    console.log(`  ❌ Error: ${e.message}`);
  }

  try {
    const groundingRefs = await sql`
      SELECT session_id, grounding_refs_json
      FROM study_assets
      WHERE grounding_refs_json IS NOT NULL
      ORDER BY created_at DESC 
      LIMIT 3
    `;
    console.log('\nSELECT session_id, grounding_refs_json FROM study_assets WHERE grounding_refs_json IS NOT NULL LIMIT 3;');
    console.log('RESULT:');
    if (groundingRefs.length === 0) {
      console.log('  ⚠️  NO GROUNDING REFS - Assets not linked to outline topics');
    } else {
      groundingRefs.forEach((row: any) => {
        console.log(`  ${row.session_id?.substring(0, 8)}... | ${JSON.stringify(row.grounding_refs_json)}`);
      });
    }
  } catch (e: any) {
    console.log(`  ❌ Error: ${e.message}`);
  }

  // ============================================
  // 5. BACKGROUND JOBS (PRECOMPUTE)
  // ============================================
  console.log('\n');
  console.log('━'.repeat(60));
  console.log('5️⃣  BACKGROUND JOBS (PRECOMPUTE)');
  console.log('━'.repeat(60));

  try {
    const jobs = await sql`
      SELECT id, job_type, status, created_at 
      FROM background_jobs 
      ORDER BY created_at DESC 
      LIMIT 5
    `;
    console.log('\nSELECT id, job_type, status, created_at FROM background_jobs LIMIT 5;');
    console.log('RESULT:');
    if (jobs.length === 0) {
      console.log('  ⚠️  NO BACKGROUND JOBS - Precompute not triggered yet');
    } else {
      jobs.forEach((row: any) => {
        console.log(`  ${row.id?.substring(0, 8)}... | ${row.job_type} | ${row.status} | ${row.created_at}`);
      });
    }
  } catch (e: any) {
    console.log(`  ❌ Error: ${e.message}`);
  }

  // ============================================
  // SUMMARY
  // ============================================
  console.log('\n');
  console.log('═'.repeat(60));
  console.log('SUMMARY - GAPS TO CLOSE');
  console.log('═'.repeat(60));
  
  const gaps: string[] = [];

  // Check each requirement
  try {
    const cycleCount = await sql`SELECT COUNT(*) as c FROM exam_cycles`;
    if (Number(cycleCount[0]?.c) === 0) {
      gaps.push('❌ exam_cycles not seeded (need RESIT + FIRST_TIME cycles)');
    }
  } catch { gaps.push('❌ exam_cycles table does not exist'); }

  try {
    const eventCount = await sql`SELECT COUNT(*) as c FROM exam_events`;
    if (Number(eventCount[0]?.c) === 0) {
      gaps.push('❌ exam_events not seeded (need WRITTEN + ORAL events)');
    }
  } catch { gaps.push('❌ exam_events table does not exist'); }

  try {
    const topicCount = await sql`SELECT COUNT(*) as c FROM outline_topics`;
    if (Number(topicCount[0]?.c) === 0) {
      gaps.push('❌ outline_topics not populated (need /api/admin/outlines/import)');
    }
  } catch { gaps.push('❌ outline_topics table does not exist'); }

  try {
    const skillCount = await sql`SELECT COUNT(*) as c FROM micro_skills`;
    if (Number(skillCount[0]?.c) === 0) {
      gaps.push('❌ micro_skills not populated');
    }
  } catch { gaps.push('❌ micro_skills table does not exist'); }

  try {
    const mapCount = await sql`SELECT COUNT(*) as c FROM skill_outline_map`;
    if (Number(mapCount[0]?.c) === 0) {
      gaps.push('❌ skill_outline_map not populated (no traceability)');
    }
  } catch { gaps.push('❌ skill_outline_map table does not exist'); }

  if (gaps.length === 0) {
    console.log('✅ All M1 database requirements appear to be met');
  } else {
    gaps.forEach(g => console.log(g));
  }

  console.log('\n');
  console.log('═'.repeat(60));
  console.log('NEXT STEPS');
  console.log('═'.repeat(60));
  console.log(`
1. Run migration 0003_tutor_os_flagship.sql if tables missing
2. Create seed script for exam_cycles + exam_events
3. Test /api/tutor/today endpoint
4. Test /api/study/session endpoints
5. Run acceptance tests
  `);

  process.exit(0);
}

verify().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
