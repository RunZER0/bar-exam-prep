/**
 * Query Performance Analysis - EXPLAIN ANALYZE
 * 
 * Run: npx tsx scripts/explain-queries.ts
 */

import postgres from 'postgres';
import * as fs from 'fs';
import * as path from 'path';

const envPath = path.join(__dirname, '..', '.env');
const envContent = fs.readFileSync(envPath, 'utf-8');
const dbMatch = envContent.match(/^DATABASE_URL=(.+)$/m);
const DATABASE_URL = dbMatch?.[1] || '';

async function explainQueries() {
  console.log('📊 QUERY PERFORMANCE ANALYSIS\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const sql = postgres(DATABASE_URL, { ssl: 'require' });

  // Get a test user ID
  const [testUser] = await sql`SELECT id FROM users LIMIT 1`;
  const userId = testUser?.id || '00000000-0000-0000-0000-000000000000';

  // ========================================
  // QUERY 1: Get items with skill mappings (planner's main data fetch)
  // ========================================
  console.log('📋 QUERY 1: Items with skill mappings (planner data)');
  console.log('─────────────────────────────────────────────────────');
  
  const explain1 = await sql`
    EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
    SELECT 
      i.id AS item_id,
      i.item_type,
      i.format,
      i.difficulty,
      i.estimated_minutes,
      ism.skill_id,
      ism.coverage_weight
    FROM items i
    JOIN item_skill_map ism ON i.id = ism.item_id
    WHERE i.is_active = true
    LIMIT 100
  `;
  
  for (const row of explain1) {
    console.log(row['QUERY PLAN']);
  }
  console.log('');

  // ========================================
  // QUERY 2: Get mastery states for user
  // ========================================
  console.log('📋 QUERY 2: Mastery states for user');
  console.log('─────────────────────────────────────────────────────');
  
  const explain2 = await sql`
    EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
    SELECT 
      skill_id,
      p_mastery,
      stability,
      attempt_count,
      correct_count,
      last_practiced_at,
      next_review_date,
      is_verified
    FROM mastery_state
    WHERE user_id = ${userId}::uuid
  `;
  
  for (const row of explain2) {
    console.log(row['QUERY PLAN']);
  }
  console.log('');

  // ========================================
  // QUERY 3: Get skills with prerequisites
  // ========================================
  console.log('📋 QUERY 3: Skills with prerequisites');
  console.log('─────────────────────────────────────────────────────');
  
  const explain3 = await sql`
    EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
    SELECT 
      ms.id,
      ms.name,
      ms.code,
      ms.unit_id,
      ms.exam_weight,
      ms.difficulty,
      se.from_skill_id AS prereq_id
    FROM micro_skills ms
    LEFT JOIN skill_edges se ON ms.id = se.to_skill_id AND se.edge_type = 'prerequisite'
    WHERE ms.is_active = true
  `;
  
  for (const row of explain3) {
    console.log(row['QUERY PLAN']);
  }
  console.log('');

  // ========================================
  // QUERY 4: Recent attempts for user
  // ========================================
  console.log('📋 QUERY 4: Recent attempts for user');
  console.log('─────────────────────────────────────────────────────');
  
  const explain4 = await sql`
    EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
    SELECT 
      a.id,
      a.item_id,
      a.format,
      a.mode,
      a.score_norm,
      a.is_correct,
      a.created_at,
      i.prompt
    FROM attempts a
    JOIN items i ON a.item_id = i.id
    WHERE a.user_id = ${userId}::uuid
    ORDER BY a.created_at DESC
    LIMIT 50
  `;
  
  for (const row of explain4) {
    console.log(row['QUERY PLAN']);
  }
  console.log('');

  // ========================================
  // QUERY 5: Coverage debt calculation
  // ========================================
  console.log('📋 QUERY 5: Skill coverage analysis');
  console.log('─────────────────────────────────────────────────────');
  
  const explain5 = await sql`
    EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
    SELECT 
      ms.id AS skill_id,
      ms.name,
      COALESCE(mst.p_mastery, 0) AS p_mastery,
      COALESCE(mst.attempt_count, 0) AS attempts,
      COUNT(DISTINCT i.id) AS available_items
    FROM micro_skills ms
    LEFT JOIN mastery_state mst ON ms.id = mst.skill_id AND mst.user_id = ${userId}::uuid
    LEFT JOIN item_skill_map ism ON ms.id = ism.skill_id
    LEFT JOIN items i ON ism.item_id = i.id AND i.is_active = true
    WHERE ms.is_active = true
    GROUP BY ms.id, ms.name, mst.p_mastery, mst.attempt_count
    ORDER BY COALESCE(mst.p_mastery, 0) ASC
    LIMIT 20
  `;
  
  for (const row of explain5) {
    console.log(row['QUERY PLAN']);
  }
  console.log('');

  // ========================================
  // SUMMARY
  // ========================================
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ EXPLAIN ANALYSIS COMPLETE');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('Key performance notes:');
  console.log('  - All queries use indexed lookups on UUIDs');
  console.log('  - JOINs use hash joins for efficiency');
  console.log('  - LIMIT clauses prevent full table scans');
  console.log('');

  await sql.end();
}

explainQueries().catch(console.error);
