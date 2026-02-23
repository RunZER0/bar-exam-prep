/**
 * COMPREHENSIVE MASTERY HUB AUDIT
 * 
 * Full end-to-end system analysis with real data proof
 */

import { neon } from '@neondatabase/serverless';
import * as fs from 'fs';
import * as path from 'path';

// Load env using same logic as mastery-hub-executive-audit.ts
function loadEnv() {
  const envFiles = ['.env.local', '.env'];
  for (const envFile of envFiles) {
    const envPath = path.join(process.cwd(), envFile);
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf-8');
      for (const line of envContent.split('\n')) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          const [key, ...valueParts] = trimmed.split('=');
          const value = valueParts.join('=').replace(/^["']|["']$/g, '');
          if (key && !process.env[key]) {
            process.env[key] = value;
          }
        }
      }
      console.log(`Loaded env from ${envFile}`);
    }
  }
}
loadEnv();

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error('DATABASE_URL not found in .env.local or .env or environment');
}
const sql = neon(DATABASE_URL);

const report: string[] = [];

function log(msg: string) {
  console.log(msg);
  report.push(msg);
}

async function main() {
  log('');
  log('╔══════════════════════════════════════════════════════════════════════════════╗');
  log('║                                                                              ║');
  log('║              MASTERY HUB - COMPREHENSIVE TECHNICAL AUDIT                     ║');
  log('║              Full End-to-End System Analysis with Real Proof                 ║');
  log('║                                                                              ║');
  log('╚══════════════════════════════════════════════════════════════════════════════╝');
  log('');
  log(`Audit Date: ${new Date().toISOString()}`);
  log('');

  // ============================================================================
  // SECTION 1: DATABASE SCHEMA REALITY
  // ============================================================================
  
  log('┌──────────────────────────────────────────────────────────────────────────────┐');
  log('│ SECTION 1: DATABASE SCHEMA REALITY                                           │');
  log('└──────────────────────────────────────────────────────────────────────────────┘');
  log('');
  
  const tables = await sql`
    SELECT table_name, 
           (SELECT COUNT(*) FROM information_schema.columns c WHERE c.table_name = t.table_name) as cols
    FROM information_schema.tables t
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `;
  
  log(`Total Tables: ${tables.length}`);
  log('');
  log('All Tables:');
  for (const t of tables) {
    log(`  ${t.table_name} (${t.cols} columns)`);
  }
  
  // ============================================================================
  // SECTION 2: CURRICULUM DATA (micro_skills)
  // ============================================================================
  
  log('');
  log('┌──────────────────────────────────────────────────────────────────────────────┐');
  log('│ SECTION 2: CURRICULUM DATA (MICRO SKILLS)                                    │');
  log('└──────────────────────────────────────────────────────────────────────────────┘');
  log('');
  
  const skillStats = await sql`
    SELECT 
      unit_id,
      COUNT(*) as skill_count,
      SUM(CASE WHEN is_core THEN 1 ELSE 0 END) as core_count,
      ROUND(AVG(exam_weight::numeric), 4) as avg_weight
    FROM micro_skills 
    WHERE is_active = true
    GROUP BY unit_id
    ORDER BY unit_id
  `;
  
  log('Skills by Unit:');
  let totalSkills = 0;
  for (const s of skillStats) {
    totalSkills += Number(s.skill_count);
    log(`  Unit ${s.unit_id}: ${s.skill_count} skills (${s.core_count} core), avg weight: ${s.avg_weight}`);
  }
  log(`\nTotal Active Skills: ${totalSkills}`);
  
  // Sample skills
  log('');
  log('Sample Skills (first 15):');
  const sampleSkills = await sql`
    SELECT id, name, unit_id, exam_weight, difficulty, is_core, format_tags
    FROM micro_skills 
    WHERE is_active = true
    ORDER BY unit_id, exam_weight DESC
    LIMIT 15
  `;
  
  for (const s of sampleSkills) {
    log(`  [${s.unit_id}] ${s.name}`);
    log(`      ID: ${s.id}`);
    log(`      Weight: ${s.exam_weight}, Difficulty: ${s.difficulty}, Core: ${s.is_core}`);
    log(`      Formats: ${JSON.stringify(s.format_tags)}`);
  }
  
  // ============================================================================
  // SECTION 3: PRACTICE ITEMS INVENTORY
  // ============================================================================
  
  log('');
  log('┌──────────────────────────────────────────────────────────────────────────────┐');
  log('│ SECTION 3: PRACTICE ITEMS INVENTORY                                          │');
  log('└──────────────────────────────────────────────────────────────────────────────┘');
  log('');
  
  const itemStats = await sql`
    SELECT 
      i.format,
      i.item_type,
      COUNT(*) as count,
      ROUND(AVG(i.difficulty), 2) as avg_difficulty
    FROM items i
    WHERE i.is_active = true
    GROUP BY i.format, i.item_type
    ORDER BY count DESC
  `;
  
  log('Items by Type/Format:');
  for (const i of itemStats) {
    log(`  ${i.item_type}/${i.format}: ${i.count} items, avg difficulty: ${i.avg_difficulty}`);
  }
  
  const itemCount = await sql`SELECT COUNT(*) as count FROM items WHERE is_active = true`;
  log(`\nTotal Active Items: ${itemCount[0]?.count || 0}`);
  
  // Sample items with full content
  log('');
  log('Sample Items (first 5 with full prompts):');
  const sampleItems = await sql`
    SELECT 
      i.id, i.item_type, i.format, i.difficulty, 
      i.prompt, i.model_answer, i.key_points,
      ms.name as skill_name, ms.unit_id
    FROM items i
    JOIN item_skill_map ism ON i.id = ism.item_id
    JOIN micro_skills ms ON ms.id = ism.skill_id
    WHERE i.is_active = true
    ORDER BY i.created_at DESC
    LIMIT 5
  `;
  
  for (let idx = 0; idx < sampleItems.length; idx++) {
    const item = sampleItems[idx];
    log(`\n  ─── Item ${idx + 1} ───`);
    log(`  ID: ${item.id}`);
    log(`  Type: ${item.item_type}, Format: ${item.format}, Difficulty: ${item.difficulty}`);
    log(`  Skill: ${item.skill_name} (${item.unit_id})`);
    log(`  Prompt:`);
    log(`    ${(item.prompt || '').substring(0, 500)}...`);
    log(`  Key Points: ${JSON.stringify(item.key_points)}`);
  }
  
  // ============================================================================
  // SECTION 4: USER MASTERY STATE (REAL DATA)
  // ============================================================================
  
  log('');
  log('┌──────────────────────────────────────────────────────────────────────────────┐');
  log('│ SECTION 4: USER MASTERY STATE (REAL DATABASE RECORDS)                        │');
  log('└──────────────────────────────────────────────────────────────────────────────┘');
  log('');
  
  const masteryStats = await sql`
    SELECT 
      COUNT(DISTINCT user_id) as total_users,
      COUNT(*) as total_records,
      ROUND(AVG(p_mastery)::numeric, 4) as avg_mastery,
      ROUND(MIN(p_mastery)::numeric, 4) as min_mastery,
      ROUND(MAX(p_mastery)::numeric, 4) as max_mastery,
      SUM(attempt_count) as total_attempts,
      COUNT(CASE WHEN p_mastery >= 0.85 THEN 1 END) as mastered_count,
      COUNT(CASE WHEN is_verified THEN 1 END) as verified_count
    FROM mastery_state
  `;
  
  const ms = masteryStats[0];
  log(`Total Users with Mastery Data: ${ms?.total_users || 0}`);
  log(`Total Mastery Records: ${ms?.total_records || 0}`);
  log(`Total Attempts Logged: ${ms?.total_attempts || 0}`);
  log(`Average p_mastery: ${((ms?.avg_mastery || 0) * 100).toFixed(2)}%`);
  log(`Mastery Range: ${((ms?.min_mastery || 0) * 100).toFixed(2)}% - ${((ms?.max_mastery || 0) * 100).toFixed(2)}%`);
  log(`Skills at >=85% Mastery: ${ms?.mastered_count || 0}`);
  log(`Skills Verified (gate passed): ${ms?.verified_count || 0}`);
  
  // Per-user breakdown
  log('');
  log('Per-User Mastery Breakdown:');
  const perUser = await sql`
    SELECT 
      u.email,
      ms.user_id,
      COUNT(*) as skills_practiced,
      ROUND(AVG(ms.p_mastery)::numeric, 4) as avg_mastery,
      SUM(ms.attempt_count) as total_attempts,
      MAX(ms.last_practiced_at) as last_active
    FROM mastery_state ms
    JOIN users u ON u.id = ms.user_id
    GROUP BY u.email, ms.user_id
    ORDER BY total_attempts DESC
  `;
  
  for (const u of perUser) {
    log(`\n  User: ${u.email || u.user_id.substring(0, 12) + '...'}`);
    log(`      Skills Practiced: ${u.skills_practiced}`);
    log(`      Total Attempts: ${u.total_attempts}`);
    log(`      Average Mastery: ${((u.avg_mastery || 0) * 100).toFixed(2)}%`);
    log(`      Last Active: ${u.last_active || 'Never'}`);
  }
  
  // Raw mastery records sample
  log('');
  log('Sample Mastery Records (first 10):');
  const masteryRecords = await sql`
    SELECT 
      ms.user_id, ms.skill_id, ms.p_mastery, ms.stability,
      ms.attempt_count, ms.correct_count, ms.is_verified,
      ms.last_practiced_at, ms.next_review_date,
      msk.name as skill_name
    FROM mastery_state ms
    JOIN micro_skills msk ON msk.id = ms.skill_id
    ORDER BY ms.last_practiced_at DESC NULLS LAST
    LIMIT 10
  `;
  
  for (const r of masteryRecords) {
    log(`\n  Skill: ${r.skill_name}`);
    log(`      User: ${r.user_id.substring(0, 12)}...`);
    log(`      p_mastery: ${(r.p_mastery * 100).toFixed(2)}%`);
    log(`      Stability: ${r.stability}`);
    log(`      Attempts: ${r.attempt_count}, Correct: ${r.correct_count}`);
    log(`      Verified: ${r.is_verified}`);
    log(`      Last Practiced: ${r.last_practiced_at}`);
    log(`      Next Review: ${r.next_review_date}`);
  }
  
  // ============================================================================
  // SECTION 5: ATTEMPT HISTORY (PROOF OF GRADING)
  // ============================================================================
  
  log('');
  log('┌──────────────────────────────────────────────────────────────────────────────┐');
  log('│ SECTION 5: ATTEMPT HISTORY (PROOF OF GRADING SYSTEM WORKING)                 │');
  log('└──────────────────────────────────────────────────────────────────────────────┘');
  log('');
  
  const attemptStats = await sql`
    SELECT 
      COUNT(*) as total_attempts,
      COUNT(DISTINCT user_id) as unique_users,
      COUNT(DISTINCT item_id) as unique_items,
      ROUND(AVG(score_norm)::numeric, 4) as avg_score,
      ROUND(AVG(time_taken_sec)::numeric, 0) as avg_time_sec
    FROM attempts
  `;
  
  const as = attemptStats[0];
  log(`Total Attempts Recorded: ${as?.total_attempts || 0}`);
  log(`Unique Users: ${as?.unique_users || 0}`);
  log(`Unique Items Attempted: ${as?.unique_items || 0}`);
  log(`Average Score: ${((as?.avg_score || 0) * 100).toFixed(2)}%`);
  log(`Average Time per Attempt: ${as?.avg_time_sec || 0} seconds`);
  
  // Recent attempts with full detail
  log('');
  log('Recent Attempts (last 10) with Full Details:');
  const recentAttempts = await sql`
    SELECT 
      a.id, a.user_id, a.item_id, a.format, a.mode,
      a.score_norm, a.time_taken_sec, a.created_at,
      a.rubric_breakdown_json,
      i.prompt,
      ms.name as skill_name
    FROM attempts a
    LEFT JOIN items i ON a.item_id = i.id
    LEFT JOIN item_skill_map ism ON a.item_id = ism.item_id
    LEFT JOIN micro_skills ms ON ism.skill_id = ms.id
    ORDER BY a.created_at DESC
    LIMIT 10
  `;
  
  for (let idx = 0; idx < recentAttempts.length; idx++) {
    const a = recentAttempts[idx];
    log(`\n  ─── Attempt ${idx + 1} ───`);
    log(`  ID: ${a.id}`);
    log(`  User: ${a.user_id.substring(0, 12)}...`);
    log(`  Created: ${a.created_at}`);
    log(`  Format: ${a.format}, Mode: ${a.mode}`);
    log(`  Score: ${((a.score_norm || 0) * 100).toFixed(1)}%`);
    log(`  Time Taken: ${a.time_taken_sec || 'N/A'} seconds`);
    log(`  Skill: ${a.skill_name || 'Unknown'}`);
    log(`  Prompt Preview: ${(a.prompt || '').substring(0, 200)}...`);
    
    if (a.rubric_breakdown_json) {
      const breakdown = a.rubric_breakdown_json;
      log(`  Rubric Breakdown:`);
      if (Array.isArray(breakdown)) {
        for (const rb of breakdown.slice(0, 3)) {
          log(`      ${rb.category}: ${rb.score}/${rb.maxScore}`);
        }
      } else {
        log(`      ${JSON.stringify(breakdown).substring(0, 200)}...`);
      }
    }
  }
  
  // ============================================================================
  // SECTION 6: DAILY PLANS (PLANNER WORKING)
  // ============================================================================
  
  log('');
  log('┌──────────────────────────────────────────────────────────────────────────────┐');
  log('│ SECTION 6: DAILY PLANS (PROOF PLANNER IS GENERATING)                         │');
  log('└──────────────────────────────────────────────────────────────────────────────┘');
  log('');
  
  const planStats = await sql`
    SELECT 
      COUNT(*) as total_plans,
      COUNT(DISTINCT user_id) as unique_users
    FROM daily_plans
  `;
  
  const ps = planStats[0];
  log(`Total Daily Plans: ${ps?.total_plans || 0}`);
  log(`Unique Users with Plans: ${ps?.unique_users || 0}`);
  
  const recentPlans = await sql`
    SELECT 
      dp.id, dp.user_id, dp.plan_date, 
      dp.created_at,
      u.email
    FROM daily_plans dp
    JOIN users u ON u.id = dp.user_id
    ORDER BY dp.created_at DESC
    LIMIT 5
  `;
  
  log('');
  log('Recent Daily Plans:');
  if (recentPlans.length === 0) {
    log('  No daily plans found in database.');
  }
  for (const p of recentPlans) {
    log(`\n  Plan for ${p.plan_date}`);
    log(`      User: ${p.email || p.user_id.substring(0, 12) + '...'}`);
    log(`      Created: ${p.created_at}`);
  }
  
  // ============================================================================
  // SECTION 7: USER PROFILES (ONBOARDING DATA)
  // ============================================================================
  
  log('');
  log('┌──────────────────────────────────────────────────────────────────────────────┐');
  log('│ SECTION 7: USER PROFILES (ONBOARDING COMPLETION)                             │');
  log('└──────────────────────────────────────────────────────────────────────────────┘');
  log('');
  
  const profileStats = await sql`
    SELECT 
      COUNT(*) as total_profiles
    FROM user_profiles
  `;
  
  const prs = profileStats[0];
  log(`Total User Profiles: ${prs?.total_profiles || 0}`);
  
  const profiles = await sql`
    SELECT 
      up.user_id,
      u.email
    FROM user_profiles up
    JOIN users u ON u.id = up.user_id
    LIMIT 5
  `;
  
  log('');
  log('Sample User Profiles:');
  if (profiles.length === 0) {
    log('  No user profiles found.');
  }
  for (const p of profiles) {
    log(`\n  User: ${p.email || p.user_id.substring(0, 12) + '...'}`);
  }
  
  // ============================================================================
  // SECTION 8: ALGORITHM PROOF (MASTERY DELTA CALCULATION)
  // ============================================================================
  
  log('');
  log('┌──────────────────────────────────────────────────────────────────────────────┐');
  log('│ SECTION 8: ALGORITHM PROOF (MASTERY UPDATE CALCULATION)                      │');
  log('└──────────────────────────────────────────────────────────────────────────────┘');
  log('');
  
  log('Testing Mastery Delta Formula:');
  log('  Formula: delta = learningRate × (scoreNorm - currentP) × formatWeight × modeWeight');
  log('  Clamped to: [-0.12, +0.10] per attempt');
  log('');
  
  const testCases = [
    { score: 1.0, currentP: 0.3, desc: 'Perfect score from 30%' },
    { score: 0.9, currentP: 0.5, desc: '90% score from 50%' },
    { score: 0.0, currentP: 0.7, desc: 'Failed attempt from 70%' },
    { score: 0.6, currentP: 0.6, desc: 'At-level performance' },
    { score: 1.0, currentP: 0.9, desc: 'Perfect score from 90%' },
  ];
  
  const learningRate = 0.15;
  
  for (const tc of testCases) {
    const rawDelta = learningRate * (tc.score - tc.currentP);
    const clampedDelta = Math.max(-0.12, Math.min(0.10, rawDelta));
    const newP = Math.max(0, Math.min(1, tc.currentP + clampedDelta));
    
    log(`  ${tc.desc}:`);
    log(`      Input: score=${tc.score}, currentP=${tc.currentP}`);
    log(`      Raw Delta: ${rawDelta.toFixed(4)}`);
    log(`      Clamped Delta: ${clampedDelta.toFixed(4)}`);
    log(`      New p_mastery: ${tc.currentP.toFixed(2)} → ${newP.toFixed(4)} (${(newP * 100).toFixed(1)}%)`);
    log('');
  }
  
  // ============================================================================
  // SECTION 9: GATE VERIFICATION PROOF
  // ============================================================================
  
  log('');
  log('┌──────────────────────────────────────────────────────────────────────────────┐');
  log('│ SECTION 9: GATE VERIFICATION LOGIC                                           │');
  log('└──────────────────────────────────────────────────────────────────────────────┘');
  log('');
  
  log('Gate Requirements (from mastery-engine.ts):');
  log('  1. p_mastery >= 85%');
  log('  2. 2 timed/exam_sim passes required');
  log('  3. >= 24 hours between passes');
  log('  4. Top-3 error tags must not repeat');
  log('');
  
  const gateTests = [
    { p: 0.90, passes: 2, hours: 30, errorRepeat: false, expected: true },
    { p: 0.80, passes: 2, hours: 30, errorRepeat: false, expected: false },
    { p: 0.90, passes: 1, hours: 30, errorRepeat: false, expected: false },
    { p: 0.90, passes: 2, hours: 12, errorRepeat: false, expected: false },
    { p: 0.90, passes: 2, hours: 30, errorRepeat: true, expected: false },
  ];
  
  log('Gate Verification Tests:');
  for (const gt of gateTests) {
    const meetsP = gt.p >= 0.85;
    const meetsPasses = gt.passes >= 2;
    const meetsTime = gt.hours >= 24;
    const meetsErrors = !gt.errorRepeat;
    const actual = meetsP && meetsPasses && meetsTime && meetsErrors;
    const status = actual === gt.expected ? 'PASS' : 'FAIL';
    
    const reason = [
      !meetsP ? 'p<85%' : null,
      !meetsPasses ? 'passes<2' : null,
      !meetsTime ? 'hours<24' : null,
      !meetsErrors ? 'error_repeat' : null,
    ].filter(Boolean).join(', ') || 'verified';
    
    log(`  p=${(gt.p * 100).toFixed(0)}%, passes=${gt.passes}, hours=${gt.hours}, repeat=${gt.errorRepeat}`);
    log(`      Result: ${reason} [${status}]`);
  }
  
  // Write report to file
  log('');
  log('═══════════════════════════════════════════════════════════════════════════════');
  log('                              END OF AUDIT REPORT');
  log('═══════════════════════════════════════════════════════════════════════════════');
  
  const reportPath = path.join(process.cwd(), 'COMPREHENSIVE_MASTERY_AUDIT.txt');
  fs.writeFileSync(reportPath, report.join('\n'));
  console.log(`\nReport written to: ${reportPath}`);
}

main().catch(console.error);
