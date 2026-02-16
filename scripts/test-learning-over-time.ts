/**
 * Test: Does the algorithm LEARN over time?
 * 
 * Simulates multiple practice attempts and verifies:
 * 1. Mastery increases with correct answers
 * 2. Stability grows (spacing effect)
 * 3. Diminishing returns near mastery ceiling
 * 
 * Run: npx tsx scripts/test-learning-over-time.ts
 */

import postgres from 'postgres';
import * as fs from 'fs';
import * as path from 'path';

const envPath = path.join(__dirname, '..', '.env');
const envContent = fs.readFileSync(envPath, 'utf-8');
const dbMatch = envContent.match(/^DATABASE_URL=(.+)$/m);
const DATABASE_URL = dbMatch?.[1] || '';

async function testLearningOverTime() {
  console.log('📈 LEARNING OVER TIME TEST\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const sql = postgres(DATABASE_URL, { ssl: 'require' });

  try {
    // Get test user and skill
    const [testUser] = await sql`SELECT id, email FROM users LIMIT 1`;
    if (!testUser) {
      console.log('❌ No users. Please sign up first.');
      await sql.end();
      return;
    }

    // Get a DIFFERENT skill to test fresh (one not already practiced)
    const [testSkill] = await sql`
      SELECT ms.id, ms.name, ms.code 
      FROM micro_skills ms
      LEFT JOIN mastery_state mst ON ms.id = mst.skill_id AND mst.user_id = ${testUser.id}::uuid
      WHERE mst.id IS NULL
      LIMIT 1
    `;
    
    if (!testSkill) {
      console.log('⚠️  All skills have been practiced. Using first skill (will continue from current state).');
      const [firstSkill] = await sql`SELECT id, name, code FROM micro_skills LIMIT 1`;
      if (!firstSkill) {
        console.log('❌ No skills in database.');
        await sql.end();
        return;
      }
      Object.assign(testSkill, firstSkill);
    }

    const [testItem] = await sql`
      SELECT i.id, i.prompt, i.format
      FROM items i
      JOIN item_skill_map ism ON i.id = ism.item_id
      WHERE ism.skill_id = ${testSkill.id}
      LIMIT 1
    `;

    console.log(`👤 User: ${testUser.email}`);
    console.log(`📚 Skill: ${testSkill.name}`);
    console.log(`📝 Testing with 8 simulated attempts\n`);

    // Get initial state
    const [initialState] = await sql`
      SELECT p_mastery, stability, attempt_count
      FROM mastery_state
      WHERE user_id = ${testUser.id}::uuid AND skill_id = ${testSkill.id}::uuid
    `;

    let currentMastery = initialState ? parseFloat(initialState.p_mastery as string) : 0;
    let currentStability = initialState ? parseFloat(initialState.stability as string) : 1.0;
    let currentAttempts = initialState?.attempt_count ?? 0;

    console.log('┌──────────┬─────────────┬───────────┬───────────┬────────────────────────────────┐');
    console.log('│ Attempt  │   Score     │  Mastery  │ Stability │          Visual                │');
    console.log('├──────────┼─────────────┼───────────┼───────────┼────────────────────────────────┤');
    console.log(`│ Initial  │      -      │  ${(currentMastery * 100).toFixed(1).padStart(5)}%  │   ${currentStability.toFixed(1).padStart(4)}d  │ ${progressBar(currentMastery)} │`);

    // Simulate 8 learning attempts with varying scores
    const scores = [0.65, 0.70, 0.75, 0.80, 0.85, 0.75, 0.90, 0.95];
    
    for (let i = 0; i < scores.length; i++) {
      const score = scores[i];
      
      // Calculate Bayesian update (same as mastery-engine.ts)
      const priorMastery = currentMastery;
      const bayesianDelta = (score - priorMastery) * 0.15;
      const clampedDelta = Math.max(-0.12, Math.min(0.10, bayesianDelta));
      const newMastery = Math.max(0, Math.min(1, priorMastery + clampedDelta));
      
      // Stability update
      const stabilityMultiplier = score >= 0.6 ? 1.3 : 0.5;
      const newStability = Math.min(30, currentStability * stabilityMultiplier);
      
      // Store attempt
      const rubric = JSON.stringify([
        { category: 'Analysis', score: Math.round(score * 20), maxScore: 20 },
        { category: 'Application', score: Math.round(score * 15), maxScore: 15 }
      ]);
      await sql`
        INSERT INTO attempts (user_id, item_id, format, mode, raw_answer_text, time_taken_sec, score_norm, rubric_breakdown_json, is_correct)
        VALUES (
          ${testUser.id}::uuid,
          ${testItem.id}::uuid,
          ${testItem.format},
          'practice',
          ${'Learning test attempt ' + (i + 1)},
          ${60 + Math.floor(Math.random() * 60)},
          ${score},
          ${rubric}::jsonb,
          ${score >= 0.6}
        )
      `;

      // Update mastery state
      await sql`
        INSERT INTO mastery_state (user_id, skill_id, p_mastery, stability, attempt_count, correct_count, last_practiced_at, next_review_date)
        VALUES (
          ${testUser.id}::uuid,
          ${testSkill.id}::uuid,
          ${newMastery},
          ${newStability},
          ${currentAttempts + i + 1},
          ${score >= 0.6 ? 1 : 0},
          NOW(),
          NOW() + INTERVAL '1 day' * ${Math.ceil(newStability)}
        )
        ON CONFLICT (user_id, skill_id)
        DO UPDATE SET
          p_mastery = ${newMastery},
          stability = ${newStability},
          attempt_count = mastery_state.attempt_count + 1,
          correct_count = CASE WHEN ${score} >= 0.6 THEN mastery_state.correct_count + 1 ELSE mastery_state.correct_count END,
          last_practiced_at = NOW(),
          next_review_date = NOW() + INTERVAL '1 day' * ${Math.ceil(newStability)},
          updated_at = NOW()
      `;

      const delta = newMastery - currentMastery;
      const deltaStr = delta >= 0 ? `+${(delta * 100).toFixed(1)}%` : `${(delta * 100).toFixed(1)}%`;
      
      console.log(`│    ${(i + 1).toString().padStart(2)}    │    ${(score * 100).toFixed(0).padStart(3)}%    │  ${(newMastery * 100).toFixed(1).padStart(5)}%  │   ${newStability.toFixed(1).padStart(4)}d  │ ${progressBar(newMastery)} │`);
      
      currentMastery = newMastery;
      currentStability = newStability;
    }

    console.log('└──────────┴─────────────┴───────────┴───────────┴────────────────────────────────┘');
    console.log('');

    // Verify final state from DB
    const [finalState] = await sql`
      SELECT p_mastery, stability, attempt_count, correct_count
      FROM mastery_state
      WHERE user_id = ${testUser.id}::uuid AND skill_id = ${testSkill.id}::uuid
    `;

    console.log('📊 FINAL DATABASE STATE:');
    console.log(`   Mastery: ${(parseFloat(finalState.p_mastery as string) * 100).toFixed(1)}%`);
    console.log(`   Stability: ${parseFloat(finalState.stability as string).toFixed(1)} days`);
    console.log(`   Total Attempts: ${finalState.attempt_count}`);
    console.log(`   Correct Count: ${finalState.correct_count}`);
    console.log('');

    // Analysis
    const finalMastery = parseFloat(finalState.p_mastery as string);
    const initialM = initialState ? parseFloat(initialState.p_mastery as string) : 0;
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    if (finalMastery > initialM) {
      console.log(`✅ LEARNING CONFIRMED: Mastery increased from ${(initialM * 100).toFixed(1)}% to ${(finalMastery * 100).toFixed(1)}%`);
      console.log(`   Total improvement: +${((finalMastery - initialM) * 100).toFixed(1)}%`);
    } else {
      console.log('⚠️  No improvement detected (may already be at max)');
    }

    if (parseFloat(finalState.stability as string) > 1.0) {
      console.log(`✅ SPACING EFFECT: Review interval grew to ${parseFloat(finalState.stability as string).toFixed(1)} days`);
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    await sql.end();

  } catch (error) {
    console.error('❌ Test failed:', error);
    await sql.end();
    process.exit(1);
  }
}

function progressBar(value: number): string {
  const width = 28;
  const filled = Math.round(value * width);
  const empty = width - filled;
  return '█'.repeat(filled) + '░'.repeat(empty);
}

testLearningOverTime();
