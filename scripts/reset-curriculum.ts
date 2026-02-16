/**
 * Full database reset script - wipes duplicates more aggressively
 * Run: npx tsx scripts/reset-curriculum.ts
 */

import postgres from 'postgres';
import * as fs from 'fs';
import * as path from 'path';

const envPath = path.join(__dirname, '..', '.env');
const envContent = fs.readFileSync(envPath, 'utf-8');
const dbMatch = envContent.match(/^DATABASE_URL=(.+)$/m);
const DATABASE_URL = dbMatch?.[1] || '';

async function resetCurriculum() {
  console.log('🔄 RESETTING CURRICULUM DATA\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const sql = postgres(DATABASE_URL, { ssl: 'require' });

  try {
    // Clear dependent tables first
    console.log('🗑️ Clearing tables...');
    
    // Clear attempts that reference items in atp-100
    const attDel = await sql`DELETE FROM attempts WHERE item_id IN (SELECT id FROM items WHERE unit_id = 'atp-100')`;
    console.log(`   attempts: cleared`);
    
    // Clear item_skill_map for atp-100 items
    await sql`DELETE FROM item_skill_map WHERE item_id IN (SELECT id FROM items WHERE unit_id = 'atp-100')`;
    console.log(`   item_skill_map: cleared`);
    
    // Clear items for atp-100
    await sql`DELETE FROM items WHERE unit_id = 'atp-100'`;
    console.log(`   items (atp-100): cleared`);
    
    // Clear skill_edges
    await sql`DELETE FROM skill_edges`;
    console.log(`   skill_edges: cleared`);
    
    // Clear mastery_state for skills in atp-100
    await sql`DELETE FROM mastery_state WHERE skill_id IN (SELECT id FROM micro_skills WHERE unit_id = 'atp-100')`;
    console.log(`   mastery_state: cleared`);
    
    // Clear micro_skills for atp-100
    await sql`DELETE FROM micro_skills WHERE unit_id = 'atp-100'`;
    console.log(`   micro_skills: cleared`);
    
    console.log('');

    // Verify cleanup
    const [items] = await sql`SELECT COUNT(*) AS total FROM items`;
    const [skills] = await sql`SELECT COUNT(*) AS total FROM micro_skills`;
    const [edges] = await sql`SELECT COUNT(*) AS total FROM skill_edges`;
    const [mappings] = await sql`SELECT COUNT(*) AS total FROM item_skill_map`;
    
    console.log('📊 After reset:');
    console.log(`   items: ${items.total}`);
    console.log(`   micro_skills: ${skills.total}`);
    console.log(`   skill_edges: ${edges.total}`);
    console.log(`   item_skill_map: ${mappings.total}\n`);

    await sql.end();
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ Reset complete. Run seed-curriculum-v2.ts to re-seed.');
    
  } catch (error) {
    console.error('❌ Error:', error);
    await sql.end();
    process.exit(1);
  }
}

resetCurriculum();
