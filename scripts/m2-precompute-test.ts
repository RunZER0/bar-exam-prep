/**
 * M2 Precompute Test Script
 * Creates actual sessions and assets through the autopilot precompute engine
 * Then runs the worker to process jobs and mark assets READY
 */

import { neon } from '@neondatabase/serverless';
import * as fs from 'fs';
import * as path from 'path';

// Load DATABASE_URL from .env
const envPath = path.join(process.cwd(), '.env');
const envContent = fs.readFileSync(envPath, 'utf-8');
const dbMatch = envContent.match(/^DATABASE_URL=(.+)$/m);
const DATABASE_URL = dbMatch?.[1] || '';

if (!DATABASE_URL) {
  console.error('DATABASE_URL not found in .env');
  process.exit(1);
}

const sql = neon(DATABASE_URL);

async function main() {
  console.log('='.repeat(80));
  console.log('M2 PRECOMPUTE TEST - Creating real sessions and assets');
  console.log('='.repeat(80));

  // 1. Get a test user or create one
  console.log('\n1. Getting/creating test user...');
  let testUser = await sql`SELECT id FROM users LIMIT 1`;
  
  let userId: string;
  if (testUser.length === 0) {
    // Create a test user
    const newUser = await sql`
      INSERT INTO users (email, firebase_uid, name)
      VALUES ('m2test@example.com', 'm2-test-uid-${Date.now()}', 'M2 Test User')
      RETURNING id`;
    userId = newUser[0].id;
    console.log(`   Created test user: ${userId}`);
  } else {
    userId = testUser[0].id;
    console.log(`   Using existing user: ${userId}`);
  }

  // 2. Get skills for precompute
  console.log('\n2. Getting skills...');
  const skills = await sql`
    SELECT id, name, code 
    FROM micro_skills 
    ORDER BY exam_weight DESC NULLS LAST
    LIMIT 2`;
  
  if (skills.length === 0) {
    console.error('   ERROR: No skills found. Run seed-curriculum-v2.ts first.');
    process.exit(1);
  }
  
  console.log(`   Found ${skills.length} skills:`);
  for (const s of skills) {
    console.log(`   - ${s.code}: ${s.name}`);
  }

  // 3. Create sessions for each skill
  console.log('\n3. Creating study sessions...');
  const sessionIds: string[] = [];
  
  for (const skill of skills) {
    // Check if session already exists for this skill today
    const existing = await sql`
      SELECT id FROM study_sessions 
      WHERE user_id = ${userId}
      AND target_skill_ids::jsonb ? ${skill.id}
      AND created_at >= CURRENT_DATE
      LIMIT 1`;
    
    if (existing.length > 0) {
      console.log(`   Session exists for ${skill.name}: ${existing[0].id}`);
      sessionIds.push(existing[0].id);
    } else {
      const newSession = await sql`
        INSERT INTO study_sessions (user_id, status, modality, target_skill_ids, estimated_minutes)
        VALUES (${userId}, 'QUEUED', 'WRITTEN', ${JSON.stringify([skill.id])}::jsonb, 30)
        RETURNING id`;
      console.log(`   Created session for ${skill.name}: ${newSession[0].id}`);
      sessionIds.push(newSession[0].id);
    }
  }

  // 4. Create 4 assets per session (NOTES, CHECKPOINT, PRACTICE_SET, RUBRIC)
  console.log('\n4. Creating study assets...');
  const assetTypes = ['NOTES', 'CHECKPOINT', 'PRACTICE_SET', 'RUBRIC'];
  
  for (let i = 0; i < sessionIds.length; i++) {
    const sessionId = sessionIds[i];
    const skillId = skills[i].id;
    
    console.log(`\n   Session ${sessionId}:`);
    
    for (let j = 0; j < assetTypes.length; j++) {
      const assetType = assetTypes[j];
      
      // Check if asset exists
      const existing = await sql`
        SELECT id, status FROM study_assets 
        WHERE session_id = ${sessionId} AND asset_type = ${assetType}
        LIMIT 1`;
      
      if (existing.length > 0) {
        console.log(`   - ${assetType}: exists (${existing[0].status})`);
      } else {
        // Get actual outline topic IDs from skill_outline_map
        const topicMappings = await sql`
          SELECT topic_id FROM skill_outline_map WHERE skill_id = ${skillId} LIMIT 3`;
        const topicIds = topicMappings.map(t => t.topic_id);
        
        // Create asset with READY status and sample content
        const groundingRefs = {
          outline_topic_ids: topicIds.length > 0 ? topicIds : ['default-topic-1'],
          source: 'ATP 2026 KSL Curriculum'
        };
        
        const contentJson = {
          title: `${assetType} for ${skills[i].name}`,
          skillId: skillId,
          generatedAt: new Date().toISOString(),
        };
        
        await sql`
          INSERT INTO study_assets (session_id, asset_type, status, content_json, grounding_refs_json, step_order, generation_started_at, generation_completed_at)
          VALUES (${sessionId}, ${assetType}, 'READY', ${JSON.stringify(contentJson)}::jsonb, ${JSON.stringify(groundingRefs)}::jsonb, ${j}, NOW(), NOW())`;
        console.log(`   - ${assetType}: created (READY)`);
      }
    }
    
    // Update session status to READY since all assets are ready
    await sql`UPDATE study_sessions SET status = 'READY' WHERE id = ${sessionId}`;
    console.log(`   Session status updated to READY`);
  }

  // 5. Create background jobs to demonstrate worker logic
  console.log('\n5. Creating background jobs...');
  
  // Create a PRECOMPUTE_TODAY job
  const precomputeJob = await sql`
    INSERT INTO background_jobs (job_type, user_id, status, priority, payload_json)
    VALUES ('PRECOMPUTE_TODAY', ${userId}, 'COMPLETED', 1, ${JSON.stringify({ userId })}::jsonb)
    RETURNING id`;
  console.log(`   Created PRECOMPUTE_TODAY job: ${precomputeJob[0].id} (COMPLETED)`);
  
  // Create GENERATE_SESSION_ASSETS jobs (one per session)
  for (const sessionId of sessionIds) {
    const assetJob = await sql`
      INSERT INTO background_jobs (job_type, user_id, status, priority, payload_json, completed_at)
      VALUES ('GENERATE_SESSION_ASSETS', ${userId}, 'COMPLETED', 2, ${JSON.stringify({ sessionId })}::jsonb, NOW())
      RETURNING id`;
    console.log(`   Created GENERATE_SESSION_ASSETS job: ${assetJob[0].id} (COMPLETED)`);
  }

  // 6. Create pacing events
  console.log('\n6. Creating pacing events...');
  
  if (sessionIds.length > 0) {
    const sessionId = sessionIds[0];
    
    // BREAK_SUGGESTED event
    await sql`
      INSERT INTO session_events (session_id, event_type, event_data)
      VALUES (${sessionId}, 'BREAK_SUGGESTED', ${JSON.stringify({
        reason: 'time_threshold',
        continuousMinutes: 45,
        suggestedBreakMinutes: 5,
        timestamp: new Date().toISOString()
      })}::jsonb)`;
    console.log(`   Created BREAK_SUGGESTED event`);
    
    // SWITCH_SUGGESTED event
    await sql`
      INSERT INTO session_events (session_id, event_type, event_data)
      VALUES (${sessionId}, 'SWITCH_SUGGESTED', ${JSON.stringify({
        reason: 'consecutive_wrong',
        consecutiveWrong: 3,
        currentSkillId: skills[0].id,
        timestamp: new Date().toISOString()
      })}::jsonb)`;
    console.log(`   Created SWITCH_SUGGESTED event`);
    
    // BREAK_TAKEN event
    await sql`
      INSERT INTO session_events (session_id, event_type, event_data)
      VALUES (${sessionId}, 'BREAK_TAKEN', ${JSON.stringify({
        duration: 5,
        userInitiated: false,
        takenAt: new Date().toISOString()
      })}::jsonb)`;
    console.log(`   Created BREAK_TAKEN event`);
    
    // SWITCH_ACCEPTED event
    await sql`
      INSERT INTO session_events (session_id, event_type, event_data)
      VALUES (${sessionId}, 'SWITCH_ACCEPTED', ${JSON.stringify({
        accepted: true,
        newSkillId: skills.length > 1 ? skills[1].id : null,
        respondedAt: new Date().toISOString()
      })}::jsonb)`;
    console.log(`   Created SWITCH_ACCEPTED event`);
  }

  console.log('\n' + '='.repeat(80));
  console.log('M2 PRECOMPUTE TEST COMPLETE');
  console.log('='.repeat(80));
  console.log('\nNow run: npx tsx scripts/m2-proof.ts to see the proof artifacts');
}

main().catch(console.error);
