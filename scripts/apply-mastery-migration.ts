/**
 * Apply mastery engine migration to database
 * Run with: npx tsx scripts/apply-mastery-migration.ts
 */

import { db } from '../lib/db';
import { sql } from 'drizzle-orm';
import * as fs from 'fs';
import * as path from 'path';

async function applyMigration() {
  console.log('🚀 Applying Mastery Engine v3 Migration...\n');

  try {
    // Read migration file
    const migrationPath = path.join(__dirname, '../drizzle/0001_mastery_engine_v3.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');

    // Split by statements (simple approach for our migration)
    // Execute entire migration - Neon handles transactions
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    console.log(`📜 Found ${statements.length} SQL statements\n`);

    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;

    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i];
      if (!stmt || stmt.startsWith('--')) continue;

      try {
        // Add semicolon back for execution
        await db.execute(sql.raw(stmt));
        successCount++;
        
        // Log progress every 10 statements
        if ((i + 1) % 10 === 0) {
          console.log(`   ✓ Progress: ${i + 1}/${statements.length}`);
        }
      } catch (err: any) {
        // Ignore "already exists" errors
        if (err.message?.includes('already exists') || 
            err.message?.includes('duplicate key') ||
            err.message?.includes('does not exist')) {
          skipCount++;
        } else {
          console.error(`   ✗ Error in statement ${i + 1}:`, err.message?.slice(0, 100));
          errorCount++;
        }
      }
    }

    console.log(`\n✅ Migration complete!`);
    console.log(`   Executed: ${successCount}`);
    console.log(`   Skipped: ${skipCount}`);
    console.log(`   Errors: ${errorCount}`);

    // Verify tables exist
    console.log('\n🔍 Verifying tables...');
    const tables = await db.execute(sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('micro_skills', 'items', 'mastery_state', 'attempts', 'domains', 'daily_plans')
    `);
    
    console.log('   Found mastery tables:', tables.rows.map((r: any) => r.table_name).join(', '));

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

applyMigration().then(() => {
  console.log('\n✨ Done!');
  process.exit(0);
}).catch(err => {
  console.error(err);
  process.exit(1);
});
