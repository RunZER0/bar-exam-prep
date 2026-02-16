/**
 * Evidence queries for audit
 * Shows raw SQL output for verification
 */

import postgres from 'postgres';
import * as fs from 'fs';
import * as path from 'path';

const envPath = path.join(__dirname, '..', '.env');
const envContent = fs.readFileSync(envPath, 'utf-8');
const dbMatch = envContent.match(/^DATABASE_URL=(.+)$/m);
const DATABASE_URL = dbMatch?.[1] || '';

async function runEvidence() {
  const sql = postgres(DATABASE_URL, { ssl: 'require' });

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📋 EVIDENCE QUERIES - RAW SQL OUTPUT');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log('');

  // Reset search_path
  await sql`SET search_path TO public`;

  // 1. Count items
  console.log('▶ QUERY 1: SELECT COUNT(*) FROM items');
  const [itemCount] = await sql`SELECT COUNT(*) AS count FROM items`;
  console.log(`   Result: ${itemCount.count}`);
  console.log('');

  // 2. Count mappings
  console.log('▶ QUERY 2: SELECT COUNT(*) FROM item_skill_map');
  const [mapCount] = await sql`SELECT COUNT(*) AS count FROM item_skill_map`;
  console.log(`   Result: ${mapCount.count}`);
  console.log('');

  // 3. Count skills
  console.log('▶ QUERY 3: SELECT COUNT(*) FROM micro_skills');
  const [skillCount] = await sql`SELECT COUNT(*) AS count FROM micro_skills`;
  console.log(`   Result: ${skillCount.count}`);
  console.log('');

  // 4. Duplicate hash check
  console.log('▶ QUERY 4: Duplicate item_hash check');
  console.log('   SQL: SELECT item_hash, COUNT(*) FROM items GROUP BY item_hash HAVING COUNT(*) > 1');
  const duplicates = await sql`
    SELECT item_hash, COUNT(*) AS count 
    FROM items 
    GROUP BY item_hash 
    HAVING COUNT(*) > 1
  `;
  if (duplicates.length === 0) {
    console.log('   Result: 0 duplicates found ✓');
  } else {
    console.log(`   Result: ${duplicates.length} duplicates found ✗`);
    duplicates.forEach(d => console.log(`      - ${d.item_hash}: ${d.count}`));
  }
  console.log('');

  // 5. Unmapped items check
  console.log('▶ QUERY 5: Unmapped items (items without skill mapping)');
  console.log('   SQL: SELECT COUNT(*) FROM items i LEFT JOIN item_skill_map m ON i.id = m.item_id WHERE m.id IS NULL');
  const [unmapped] = await sql`
    SELECT COUNT(*) AS count 
    FROM items i 
    LEFT JOIN item_skill_map m ON i.id = m.item_id 
    WHERE m.id IS NULL
  `;
  console.log(`   Result: ${unmapped.count} unmapped items ${unmapped.count === '0' ? '✓' : '✗'}`);
  console.log('');

  // 6. Sample item_hash values
  console.log('▶ QUERY 6: Sample item_hash values (first 5)');
  console.log('   SQL: SELECT id, item_hash, prompt FROM items LIMIT 5');
  const samples = await sql`SELECT id, item_hash, LEFT(prompt, 50) AS prompt FROM items LIMIT 5`;
  samples.forEach(s => {
    console.log(`   - ${s.item_hash} | "${s.prompt}..."`);
  });
  console.log('');

  // 7. Get a user for EXPLAIN
  const users = await sql`SELECT id FROM users LIMIT 1`;
  const userId = users[0]?.id || '00000000-0000-0000-0000-000000000000';

  // 8. EXPLAIN ANALYZE on planner query
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 EXPLAIN ANALYZE - Planner Query');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  console.log('SQL:');
  console.log(`  SELECT 
    i.id as item_id,
    i.prompt,
    i.item_type,
    i.difficulty,
    ism.skill_id,
    ms.p_mastery,
    ms.stability,
    ms.is_verified
  FROM items i
  JOIN item_skill_map ism ON ism.item_id = i.id
  LEFT JOIN mastery_state ms ON ms.skill_id = ism.skill_id AND ms.user_id = '${userId}'
  WHERE i.is_active = true
  ORDER BY COALESCE(ms.p_mastery, 0) ASC, i.difficulty ASC
  LIMIT 20`);
  console.log('');
  console.log('EXPLAIN OUTPUT:');
  
  const explainResult = await sql`
    EXPLAIN (ANALYZE, BUFFERS, VERBOSE, FORMAT TEXT)
    SELECT 
      i.id as item_id,
      i.prompt,
      i.item_type,
      i.difficulty,
      ism.skill_id,
      ms.p_mastery,
      ms.stability,
      ms.is_verified
    FROM items i
    JOIN item_skill_map ism ON ism.item_id = i.id
    LEFT JOIN mastery_state ms ON ms.skill_id = ism.skill_id AND ms.user_id = ${userId}::uuid
    WHERE i.is_active = true
    ORDER BY COALESCE(ms.p_mastery, 0) ASC, i.difficulty ASC
    LIMIT 20
  `;
  
  for (const row of explainResult) {
    console.log(`  ${row['QUERY PLAN']}`);
  }
  console.log('');

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ EVIDENCE COLLECTION COMPLETE');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  await sql.end();
}

runEvidence();
