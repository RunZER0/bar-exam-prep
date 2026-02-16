/**
 * Database verification script
 * Run: npx tsx scripts/verify-db.ts
 */

import postgres from 'postgres';
import * as fs from 'fs';
import * as path from 'path';

const envPath = path.join(__dirname, '..', '.env');
const envContent = fs.readFileSync(envPath, 'utf-8');
const dbMatch = envContent.match(/^DATABASE_URL=(.+)$/m);
const DATABASE_URL = dbMatch?.[1] || '';

async function verifyDatabase() {
  console.log('📋 DATABASE VERIFICATION\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const sql = postgres(DATABASE_URL, { ssl: 'require' });

  try {
    // List all tables
    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `;
    console.log('📋 EXISTING TABLES:');
    tables.forEach(t => console.log(`   - ${t.table_name}`));
    console.log(`   Total: ${tables.length}\n`);

    // Count records in key tables
    console.log('📊 TABLE COUNTS:');
    
    const [items] = await sql`SELECT COUNT(*) AS total FROM items`;
    console.log(`   items: ${items.total}`);
    
    const [skills] = await sql`SELECT COUNT(*) AS total FROM micro_skills`;
    console.log(`   micro_skills: ${skills.total}`);
    
    const [edges] = await sql`SELECT COUNT(*) AS total FROM skill_edges`;
    console.log(`   skill_edges: ${edges.total}`);
    
    const [attempts] = await sql`SELECT COUNT(*) AS total FROM attempts`;
    console.log(`   attempts: ${attempts.total}`);
    
    const [masteryState] = await sql`SELECT COUNT(*) AS total FROM mastery_state`;
    console.log(`   mastery_state: ${masteryState.total}`);
    
    const [dailyPlans] = await sql`SELECT COUNT(*) AS total FROM daily_plans`;
    console.log(`   daily_plans: ${dailyPlans.total}`);
    
    const [dailyPlanItems] = await sql`SELECT COUNT(*) AS total FROM daily_plan_items`;
    console.log(`   daily_plan_items: ${dailyPlanItems.total}`);
    
    const [users] = await sql`SELECT COUNT(*) AS total FROM users`;
    console.log(`   users: ${users.total}`);
    console.log('');

    // Check for unmapped items
    const [unmapped] = await sql`
      SELECT COUNT(*) AS total 
      FROM items i 
      LEFT JOIN item_skill_map ism ON i.id = ism.item_id 
      WHERE ism.item_id IS NULL
    `;
    console.log(`🔍 Unmapped items: ${unmapped.total}`);
    if (parseInt(unmapped.total) > 0) {
      console.log('   ⚠️  WARNING: Some items have no skill mapping!');
    } else {
      console.log('   ✅ All items are mapped to skills');
    }
    console.log('');

    await sql.end();
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ Database verification complete');
    
  } catch (error) {
    console.error('❌ Error:', error);
    await sql.end();
    process.exit(1);
  }
}

verifyDatabase();
