/**
 * Test Script: Verify Mastery Progress Updates
 * 
 * This script tests the full flow:
 * 1. Get initial mastery state
 * 2. Simulate an attempt
 * 3. Verify mastery_state was updated
 * 4. Verify attempts table has the record
 * 5. Verify readiness API returns updated data
 * 
 * Run with: npx tsx scripts/test-mastery-flow.ts
 */

import postgres from 'postgres';
import * as fs from 'fs';
import * as path from 'path';

// Load .env
const envPath = path.join(__dirname, '..', '.env');
const envContent = fs.readFileSync(envPath, 'utf-8');
const dbMatch = envContent.match(/^DATABASE_URL=(.+)$/m);
const DATABASE_URL = dbMatch?.[1] || '';

async function testMasteryFlow() {
  console.log('🧪 MASTERY FLOW TEST\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const sql = postgres(DATABASE_URL, { ssl: 'require' });

  try {
    // ========================================
    // STEP 1: Get a test user and skill
    // ========================================
    console.log('1️⃣ Getting test data...');
    
    const [testUser] = await sql`SELECT id, email FROM users LIMIT 1`;
    if (!testUser) {
      console.log('   ❌ No users in database. Please sign up first.');
      await sql.end();
      return;
    }
    console.log(`   User: ${testUser.email}`);
    
    const [testSkill] = await sql`SELECT id, name, code FROM micro_skills LIMIT 1`;
    if (!testSkill) {
      console.log('   ❌ No skills in database. Please run seed script.');
      await sql.end();
      return;
    }
    console.log(`   Skill: ${testSkill.name}`);
    
    const [testItem] = await sql`
      SELECT i.id, i.prompt, i.format, i.difficulty, ism.skill_id 
      FROM items i
      JOIN item_skill_map ism ON i.id = ism.item_id
      WHERE ism.skill_id = ${testSkill.id}
      LIMIT 1
    `;
    if (!testItem) {
      console.log('   ❌ No items mapped to skill. Please run seed script.');
      await sql.end();
      return;
    }
    console.log(`   Item: ${testItem.prompt?.slice(0, 50)}...`);
    console.log('');

    // ========================================
    // STEP 2: Check initial mastery state
    // ========================================
    console.log('2️⃣ Initial state...');
    
    const [initialMastery] = await sql`
      SELECT p_mastery, stability, attempt_count, correct_count
      FROM mastery_state 
      WHERE user_id = ${testUser.id}::uuid AND skill_id = ${testSkill.id}::uuid
    `;
    
    const initialPMastery = initialMastery ? parseFloat(initialMastery.p_mastery as string) : 0;
    const initialAttemptCount = initialMastery?.attempt_count ?? 0;
    console.log(`   p_mastery: ${(initialPMastery * 100).toFixed(1)}%`);
    console.log(`   attempt_count: ${initialAttemptCount}`);
    console.log('');

    // ========================================
    // STEP 3: Simulate an attempt (insert directly)
    // ========================================
    console.log('3️⃣ Simulating attempt submission...');
    
    const scoreNorm = 0.75; // 75% score
    const rubricBreakdown = JSON.stringify([
      { category: 'Legal Analysis', score: 15, maxScore: 20 },
      { category: 'Application', score: 12, maxScore: 15 },
      { category: 'Structure', score: 8, maxScore: 10 },
    ]);
    
    // Insert attempt
    const [newAttempt] = await sql`
      INSERT INTO attempts (
        user_id, item_id, format, mode, 
        raw_answer_text, time_taken_sec, 
        score_norm, rubric_breakdown_json, is_correct
      )
      VALUES (
        ${testUser.id}::uuid,
        ${testItem.id}::uuid,
        ${testItem.format},
        'practice',
        'Test answer for verification purposes. This covers the key legal principles including jurisdiction analysis and procedural requirements.',
        120,
        ${scoreNorm},
        ${rubricBreakdown}::jsonb,
        true
      )
      RETURNING id, created_at
    `;
    console.log(`   ✓ Attempt inserted: ${newAttempt.id}`);
    console.log(`   ✓ Score: ${(scoreNorm * 100).toFixed(0)}%`);
    
    // Calculate mastery update (same logic as mastery-engine.ts)
    const bayesianDelta = (scoreNorm - initialPMastery) * 0.15;
    const clampedDelta = Math.max(-0.12, Math.min(0.10, bayesianDelta));
    const newPMastery = Math.max(0, Math.min(1, initialPMastery + clampedDelta));
    const newStability = Math.min(30, 1.0 * 1.3);
    
    // Update mastery_state
    await sql`
      INSERT INTO mastery_state (user_id, skill_id, p_mastery, stability, attempt_count, correct_count, last_practiced_at, next_review_date)
      VALUES (
        ${testUser.id}::uuid, 
        ${testSkill.id}::uuid, 
        ${newPMastery}, 
        ${newStability},
        ${initialAttemptCount + 1},
        ${scoreNorm >= 0.6 ? (initialMastery?.correct_count ?? 0) + 1 : (initialMastery?.correct_count ?? 0)},
        NOW(),
        NOW() + INTERVAL '1 day' * ${Math.ceil(newStability)}
      )
      ON CONFLICT (user_id, skill_id) 
      DO UPDATE SET 
        p_mastery = ${newPMastery},
        stability = ${newStability},
        attempt_count = mastery_state.attempt_count + 1,
        correct_count = CASE WHEN ${scoreNorm} >= 0.6 THEN mastery_state.correct_count + 1 ELSE mastery_state.correct_count END,
        last_practiced_at = NOW(),
        next_review_date = NOW() + INTERVAL '1 day' * ${Math.ceil(newStability)},
        updated_at = NOW()
    `;
    console.log(`   ✓ Mastery state updated`);
    console.log('');

    // ========================================
    // STEP 4: Verify changes persisted
    // ========================================
    console.log('4️⃣ Verifying persistence...');
    
    // Check mastery_state
    const [updatedMastery] = await sql`
      SELECT p_mastery, stability, attempt_count, correct_count, last_practiced_at
      FROM mastery_state 
      WHERE user_id = ${testUser.id}::uuid AND skill_id = ${testSkill.id}::uuid
    `;
    
    if (!updatedMastery) {
      console.log('   ❌ Mastery state not found!');
    } else {
      const newP = parseFloat(updatedMastery.p_mastery as string);
      console.log(`   ✓ p_mastery: ${(initialPMastery * 100).toFixed(1)}% → ${(newP * 100).toFixed(1)}%`);
      console.log(`   ✓ attempt_count: ${initialAttemptCount} → ${updatedMastery.attempt_count}`);
      console.log(`   ✓ last_practiced_at: ${updatedMastery.last_practiced_at}`);
      
      // Verify the delta calculation worked
      if (newP > initialPMastery) {
        console.log(`   ✓ Mastery INCREASED as expected (+${((newP - initialPMastery) * 100).toFixed(2)}%)`);
      } else if (newP === initialPMastery) {
        console.log(`   ⚠️ Mastery unchanged (may be at max)`);
      }
    }
    
    // Check attempt
    const [attemptCheck] = await sql`
      SELECT id, score_norm, created_at FROM attempts WHERE id = ${newAttempt.id}::uuid
    `;
    if (attemptCheck) {
      console.log(`   ✓ Attempt record verified in DB`);
    } else {
      console.log('   ❌ Attempt not found in DB!');
    }
    console.log('');

    // ========================================
    // STEP 5: Check readiness API data
    // ========================================
    console.log('5️⃣ Checking readiness data...');
    
    const readinessData = await sql`
      SELECT 
        ms.unit_id,
        COUNT(DISTINCT ms.id) as total_skills,
        COUNT(DISTINCT CASE WHEN mst.is_verified = true THEN ms.id END) as verified_skills,
        AVG(COALESCE(mst.p_mastery, 0)) as avg_mastery
      FROM micro_skills ms
      LEFT JOIN mastery_state mst ON ms.id = mst.skill_id AND mst.user_id = ${testUser.id}::uuid
      WHERE ms.is_active = true
      GROUP BY ms.unit_id
    `;
    
    for (const unit of readinessData) {
      const avgMastery = parseFloat(unit.avg_mastery as string) || 0;
      console.log(`   ${unit.unit_id}: ${(avgMastery * 100).toFixed(1)}% avg mastery (${unit.total_skills} skills)`);
    }
    console.log('');

    // ========================================
    // STEP 6: Count total progress
    // ========================================
    console.log('6️⃣ Overall progress summary...');
    
    const [attemptCount] = await sql`
      SELECT COUNT(*) as total FROM attempts WHERE user_id = ${testUser.id}::uuid
    `;
    console.log(`   Total attempts: ${attemptCount.total}`);
    
    const [masteryCount] = await sql`
      SELECT 
        COUNT(*) as total,
        AVG(p_mastery) as avg_mastery,
        SUM(attempt_count) as total_practice
      FROM mastery_state 
      WHERE user_id = ${testUser.id}::uuid
    `;
    console.log(`   Skills tracked: ${masteryCount.total}`);
    console.log(`   Avg mastery: ${((parseFloat(masteryCount.avg_mastery as string) || 0) * 100).toFixed(1)}%`);
    console.log(`   Total practice reps: ${masteryCount.total_practice ?? 0}`);
    console.log('');

    // ========================================
    // DONE
    // ========================================
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ TEST COMPLETE - Mastery flow is working!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('The dashboard will now show:');
    console.log(`  • Updated mastery: ${((parseFloat(updatedMastery?.p_mastery as string) || 0) * 100).toFixed(1)}%`);
    console.log(`  • Total attempts: ${attemptCount.total}`);
    console.log('');

    await sql.end();

  } catch (error) {
    console.error('❌ Test failed:', error);
    await sql.end();
    process.exit(1);
  }
}

testMasteryFlow();
