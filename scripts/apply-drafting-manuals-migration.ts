/**
 * Apply Pre-Built Drafting Manuals Migration
 * 
 * Creates tables for the pre-built drafting training manual system:
 * - prebuilt_drafting_manuals: 3 pre-generated versions per document type  
 * - user_drafting_manual_versions: tracks version affinity per user
 * - drafting_manuals_generation_log: tracks generation progress
 * 
 * Run: npx tsx scripts/apply-drafting-manuals-migration.ts
 */

import { neon } from '@neondatabase/serverless';
import * as fs from 'fs';
import * as path from 'path';

const envPath = path.join(process.cwd(), '.env');
let DATABASE_URL = '';
try {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  DATABASE_URL = envContent.match(/^DATABASE_URL=(.+)$/m)?.[1]?.trim() || '';
} catch {
  DATABASE_URL = process.env.DATABASE_URL || '';
}

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL not found');
  process.exit(1);
}

const sql = neon(DATABASE_URL);

async function main() {
  console.log('='.repeat(60));
  console.log('PRE-BUILT DRAFTING MANUALS MIGRATION');
  console.log('='.repeat(60));

  // Read and execute migration SQL
  const migrationPath = path.join(__dirname, '..', 'drizzle', '0007_prebuilt_drafting_manuals.sql');
  const migrationSql = fs.readFileSync(migrationPath, 'utf-8');
  
  const statements = migrationSql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  for (const stmt of statements) {
    try {
      await sql(stmt);
      // Extract table/index name for logging
      const nameMatch = stmt.match(/(?:TABLE|INDEX)\s+(?:IF\s+NOT\s+EXISTS\s+)?(\S+)/i);
      if (nameMatch) {
        console.log(`  ✓ ${nameMatch[1]}`);
      }
    } catch (err: any) {
      console.error(`  ✗ Error: ${err.message}`);
    }
  }

  // Verify tables
  console.log('\n📋 Verifying tables...');
  const tables = await sql`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name IN ('prebuilt_drafting_manuals', 'user_drafting_manual_versions', 'drafting_manuals_generation_log')
    ORDER BY table_name
  `;
  for (const t of tables) {
    console.log(`  ✓ ${t.table_name} exists`);
  }

  if (tables.length === 3) {
    console.log('\n✅ Migration complete — all 3 tables created.');
  } else {
    console.log(`\n⚠ Only ${tables.length}/3 tables found. Check errors above.`);
  }
}

main().catch(err => {
  console.error('💀 Fatal:', err);
  process.exit(1);
});
