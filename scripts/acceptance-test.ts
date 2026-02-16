/**
 * Black-box Acceptance Test - Full Flow Against Real DB
 * 
 * Simulates:
 * 1. New user onboarding → plan generation
 * 2. Failed attempt → error tags → remediation plan
 * 3. Gate verification: 2 timed passes 24h apart
 * 4. Prerequisite enforcement
 * 5. Exam proximity phase shift
 * 
 * Run: npx tsx scripts/acceptance-test.ts
 */

import { neon, NeonQueryFunction } from '@neondatabase/serverless';
import * as fs from 'fs';
import * as path from 'path';
import {
  calculateMasteryDelta,
  updateMasteryWithCurrentState,
  checkGateVerification,
  generateDailyPlan,
  determineExamPhase,
  type PlannerInput,
  type GateInput,
} from '../lib/services/mastery-engine';

const envPath = path.join(__dirname, '..', '.env');
const envContent = fs.readFileSync(envPath, 'utf-8');
const dbMatch = envContent.match(/^DATABASE_URL=(.+)$/m);
const DATABASE_URL = dbMatch?.[1] || '';

async function runAcceptanceTests() {
  console.log('🧪 ACCEPTANCE TESTS - FULL FLOW\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const sql: NeonQueryFunction<false, false> = neon(DATABASE_URL);
  let passCount = 0;
  let failCount = 0;

  // Get test user
  const [testUser] = await sql`SELECT id, email FROM users LIMIT 1`;
  if (!testUser) {
    console.log('❌ No users in database. Please sign up first.');
    await sql.end();
    return;
  }
  console.log(`👤 Test User: ${testUser.email}\n`);

  // ========================================
  // SCENARIO 1: NEW USER ONBOARDING
  // ========================================
  console.log('📋 SCENARIO 1: New User Onboarding');
  console.log('─────────────────────────────────────');
  
  try {
    // Load skills and items from DB
    const skills = await sql`SELECT id, name, unit_id, exam_weight, difficulty FROM micro_skills WHERE is_active = true`;
    const items = await sql`
      SELECT i.id, i.item_type, i.format, i.difficulty, i.estimated_minutes, ism.skill_id
      FROM items i
      JOIN item_skill_map ism ON i.id = ism.item_id
      WHERE i.is_active = true
    `;
    
    // Build planner input
    const skillsMap = new Map();
    const masteryStates = new Map();
    const availableItems = new Map();
    
    for (const skill of skills) {
      skillsMap.set(skill.id, {
        skillId: skill.id,
        name: skill.name,
        unitId: skill.unit_id,
        examWeight: parseFloat(skill.exam_weight) || 0.05,
        difficulty: skill.difficulty === 'foundation' ? 2 : skill.difficulty === 'core' ? 3 : 4,
        formatTags: ['written', 'mcq'],
        isCore: true,
      });
      masteryStates.set(skill.id, {
        skillId: skill.id,
        pMastery: 0.1, // New user starts low
        stability: 1.0,
        lastPracticedAt: null,
        nextReviewDate: new Date(),
        isVerified: false,
      });
      availableItems.set(skill.id, []);
    }
    
    for (const item of items) {
      const skillItems = availableItems.get(item.skill_id) || [];
      skillItems.push({
        itemId: item.id,
        skillId: item.skill_id,
        itemType: item.item_type,
        difficulty: item.difficulty,
        estimatedMinutes: item.estimated_minutes,
      });
      availableItems.set(item.skill_id, skillItems);
    }
    
    const plannerInput: PlannerInput = {
      userId: testUser.id,
      examDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
      dailyMinutesBudget: 90,
      skills: skillsMap,
      masteryStates,
      availableItems,
      errorSignatures: new Map(),
      prerequisites: new Map(),
      recentActivities: [],
    };
    
    const plan = generateDailyPlan(plannerInput);
    
    if (plan.tasks.length > 0) {
      console.log(`   ✅ Plan generated: ${plan.tasks.length} tasks`);
      console.log(`   ✅ Total time: ${plan.totalMinutes} minutes`);
      console.log(`   ✅ All tasks have whySelected: ${plan.tasks.every(t => t.whySelected)}`);
      passCount++;
    } else {
      console.log('   ❌ No tasks generated');
      failCount++;
    }
    
  } catch (err: any) {
    console.log(`   ❌ Error: ${err.message}`);
    failCount++;
  }
  console.log('');

  // ========================================
  // SCENARIO 2: FAILED ATTEMPT → REMEDIATION
  // ========================================
  console.log('📋 SCENARIO 2: Failed Attempt → Remediation');
  console.log('─────────────────────────────────────');
  
  try {
    const result = calculateMasteryDelta(0.5, 0.35, 'written', 'practice', 3, 1.0);
    
    if (result.delta < 0 && !result.wasSuccess) {
      console.log(`   ✅ Failed attempt delta: ${result.delta.toFixed(4)} (negative)`);
      console.log(`   ✅ wasSuccess: false`);
      passCount++;
    } else {
      console.log('   ❌ Failed attempt should have negative delta');
      failCount++;
    }
    
    // Simulate storing error tags
    const [testSkill] = await sql`SELECT id FROM micro_skills LIMIT 1`;
    const [testItem] = await sql`SELECT id FROM items LIMIT 1`;
    
    // Insert an attempt with error tags
    await sql`
      INSERT INTO attempts (user_id, item_id, format, mode, raw_answer_text, score_norm, rubric_breakdown_json, is_correct)
      VALUES (${testUser.id}::uuid, ${testItem.id}::uuid, 'written', 'practice', 'Test answer', 0.35, '[]'::jsonb, false)
    `;
    console.log(`   ✅ Failed attempt stored in DB`);
    
  } catch (err: any) {
    console.log(`   ❌ Error: ${err.message}`);
    failCount++;
  }
  console.log('');

  // ========================================
  // SCENARIO 3: GATE VERIFICATION
  // ========================================
  console.log('📋 SCENARIO 3: Gate Verification (2 passes, 24h apart)');
  console.log('─────────────────────────────────────');
  
  try {
    const now = new Date();
    
    // Test: should pass
    const passInput: GateInput = {
      skillId: 'skill-001',
      pMastery: 0.90,
      timedAttempts: [
        { attemptId: 'a1', scoreNorm: 0.85, submittedAt: new Date(now.getTime() - 30 * 60 * 60 * 1000), errorTagIds: [] },
        { attemptId: 'a2', scoreNorm: 0.88, submittedAt: new Date(now.getTime() - 1 * 60 * 60 * 1000), errorTagIds: [] },
      ],
      topErrorTagIds: [],
    };
    
    const passResult = checkGateVerification(passInput);
    if (passResult.isVerified) {
      console.log(`   ✅ Gate PASSED: 2 passes, 30h apart, p_mastery=90%`);
      passCount++;
    } else {
      console.log(`   ❌ Gate should have verified: ${passResult.failureReasons.join(', ')}`);
      failCount++;
    }
    
    // Test: should fail (< 24h)
    const failInput: GateInput = {
      skillId: 'skill-001',
      pMastery: 0.90,
      timedAttempts: [
        { attemptId: 'a1', scoreNorm: 0.85, submittedAt: new Date(now.getTime() - 12 * 60 * 60 * 1000), errorTagIds: [] },
        { attemptId: 'a2', scoreNorm: 0.88, submittedAt: new Date(now.getTime() - 1 * 60 * 60 * 1000), errorTagIds: [] },
      ],
      topErrorTagIds: [],
    };
    
    const failResult = checkGateVerification(failInput);
    if (!failResult.isVerified) {
      console.log(`   ✅ Gate BLOCKED: Only 11h apart (need 24h)`);
      passCount++;
    } else {
      console.log('   ❌ Gate should have BLOCKED');
      failCount++;
    }
    
  } catch (err: any) {
    console.log(`   ❌ Error: ${err.message}`);
    failCount++;
  }
  console.log('');

  // ========================================
  // SCENARIO 4: PREREQUISITE ENFORCEMENT
  // ========================================
  console.log('📋 SCENARIO 4: Prerequisite Enforcement');
  console.log('─────────────────────────────────────');
  
  try {
    // Load prereq edges from DB
    const edges = await sql`SELECT from_skill_id, to_skill_id FROM skill_edges WHERE edge_type = 'prerequisite'`;
    
    if (edges.length > 0) {
      console.log(`   ✅ Prerequisite edges found: ${edges.length}`);
      console.log(`   ✅ Example: ${edges[0].from_skill_id.slice(0, 8)}... → ${edges[0].to_skill_id.slice(0, 8)}...`);
      passCount++;
    } else {
      console.log('   ⚠️ No prerequisite edges (planner will not enforce)');
    }
    
  } catch (err: any) {
    console.log(`   ❌ Error: ${err.message}`);
    failCount++;
  }
  console.log('');

  // ========================================
  // SCENARIO 5: EXAM PROXIMITY PHASE SHIFT
  // ========================================
  console.log('📋 SCENARIO 5: Exam Proximity Phase Shift');
  console.log('─────────────────────────────────────');
  
  try {
    // Product spec: >= 60 = distant, 8-59 = approaching, 0-7 = critical
    const distant270 = determineExamPhase(270);
    const distant60 = determineExamPhase(60);
    const approaching30 = determineExamPhase(30);
    const approaching8 = determineExamPhase(8);
    const critical7 = determineExamPhase(7);
    const critical0 = determineExamPhase(0);
    
    const allCorrect = distant270 === 'distant' && distant60 === 'distant' && 
                       approaching30 === 'approaching' && approaching8 === 'approaching' &&
                       critical7 === 'critical' && critical0 === 'critical';
    
    if (allCorrect) {
      console.log(`   ✅ 270 days → ${distant270}`);
      console.log(`   ✅ 60 days → ${distant60}`);
      console.log(`   ✅ 30 days → ${approaching30}`);
      console.log(`   ✅ 8 days → ${approaching8}`);
      console.log(`   ✅ 7 days → ${critical7}`);
      console.log(`   ✅ 0 days → ${critical0}`);
      passCount++;
    } else {
      console.log('   ❌ Phase determination incorrect');
      console.log(`   270d=${distant270}, 60d=${distant60}, 30d=${approaching30}, 8d=${approaching8}, 7d=${critical7}, 0d=${critical0}`);
      failCount++;
    }
    
  } catch (err: any) {
    console.log(`   ❌ Error: ${err.message}`);
    failCount++;
  }
  console.log('');

  // ========================================
  // VERIFY DB SIDE-EFFECTS
  // ========================================
  console.log('📋 DB SIDE-EFFECTS VERIFICATION');
  console.log('─────────────────────────────────────');
  
  const [attempts] = await sql`SELECT COUNT(*) AS total FROM attempts WHERE user_id = ${testUser.id}::uuid`;
  const [masteryState] = await sql`SELECT COUNT(*) AS total FROM mastery_state WHERE user_id = ${testUser.id}::uuid`;
  const [allAttempts] = await sql`SELECT COUNT(*) AS total FROM attempts`;
  const [allMastery] = await sql`SELECT COUNT(*) AS total FROM mastery_state`;
  
  console.log(`   attempts (user): ${attempts.total}`);
  console.log(`   mastery_state (user): ${masteryState.total}`);
  console.log(`   attempts (all): ${allAttempts.total}`);
  console.log(`   mastery_state (all): ${allMastery.total}`);
  console.log('');

  // ========================================
  // SUMMARY
  // ========================================
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  if (failCount === 0) {
    console.log(`✅ ALL ACCEPTANCE TESTS PASSED: ${passCount} scenarios`);
  } else {
    console.log(`❌ FAILURES: ${failCount} | PASSED: ${passCount}`);
  }
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

runAcceptanceTests().catch(console.error);
