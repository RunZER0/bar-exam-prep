/**
 * Pre-built Notes Migration
 * Creates tables for the cost-saving pre-built notes system:
 * - prebuilt_notes: 5 pre-generated versions per syllabus node
 * - user_note_versions: tracks which version each user sees (mastery + study affinity)
 * - prebuilt_notes_generation_log: tracks generation progress
 * 
 * Run: npx tsx scripts/apply-prebuilt-notes-migration.ts
 */

import { neon } from '@neondatabase/serverless';
import * as fs from 'fs';
import * as path from 'path';

const envPath = path.join(process.cwd(), '.env');
const envContent = fs.readFileSync(envPath, 'utf-8');
const dbMatch = envContent.match(/^DATABASE_URL=(.+)$/m);
const DATABASE_URL = dbMatch?.[1] || '';
const sql = neon(DATABASE_URL);

async function main() {
  console.log('='.repeat(60));
  console.log('PRE-BUILT NOTES MIGRATION');
  console.log('='.repeat(60));

  // 1. Create prebuilt_notes table
  console.log('\n1. Creating prebuilt_notes table...');
  await sql`
    CREATE TABLE IF NOT EXISTS prebuilt_notes (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      node_id UUID NOT NULL REFERENCES syllabus_nodes(id) ON DELETE CASCADE,
      version_number INTEGER NOT NULL CHECK (version_number BETWEEN 1 AND 5),
      title TEXT NOT NULL,
      narrative_markdown TEXT NOT NULL,
      sections_json JSONB NOT NULL DEFAULT '[]'::jsonb,
      authorities_json JSONB NOT NULL DEFAULT '[]'::jsonb,
      personality TEXT NOT NULL DEFAULT 'authoritative',
      word_count INTEGER,
      model_used TEXT NOT NULL DEFAULT 'o3',
      generation_prompt_hash TEXT,
      verified_at TIMESTAMPTZ,
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(node_id, version_number)
    )
  `;
  console.log('  ✓ prebuilt_notes table');

  // 2. Create user_note_versions (version affinity tracking)
  console.log('\n2. Creating user_note_versions table...');
  await sql`
    CREATE TABLE IF NOT EXISTS user_note_versions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      node_id UUID NOT NULL REFERENCES syllabus_nodes(id) ON DELETE CASCADE,
      mastery_version INTEGER CHECK (mastery_version BETWEEN 1 AND 5),
      study_version INTEGER CHECK (study_version BETWEEN 1 AND 5),
      mastery_read_at TIMESTAMPTZ,
      study_read_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(user_id, node_id)
    )
  `;
  console.log('  ✓ user_note_versions table');

  // 3. Create generation log
  console.log('\n3. Creating prebuilt_notes_generation_log table...');
  await sql`
    CREATE TABLE IF NOT EXISTS prebuilt_notes_generation_log (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      node_id UUID NOT NULL REFERENCES syllabus_nodes(id) ON DELETE CASCADE,
      version_number INTEGER NOT NULL,
      status TEXT DEFAULT 'pending',
      model_used TEXT,
      input_tokens INTEGER,
      output_tokens INTEGER,
      cost_usd NUMERIC(8,4),
      error_message TEXT,
      started_at TIMESTAMPTZ,
      completed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  console.log('  ✓ prebuilt_notes_generation_log table');

  // 4. Create indexes
  console.log('\n4. Creating indexes...');
  
  await sql`CREATE INDEX IF NOT EXISTS idx_prebuilt_notes_node ON prebuilt_notes(node_id)`;
  console.log('  ✓ idx_prebuilt_notes_node');
  
  await sql`CREATE INDEX IF NOT EXISTS idx_prebuilt_notes_active ON prebuilt_notes(node_id, is_active) WHERE is_active = true`;
  console.log('  ✓ idx_prebuilt_notes_active');
  
  await sql`CREATE INDEX IF NOT EXISTS idx_user_note_versions_user ON user_note_versions(user_id)`;
  console.log('  ✓ idx_user_note_versions_user');
  
  await sql`CREATE INDEX IF NOT EXISTS idx_user_note_versions_node ON user_note_versions(node_id)`;
  console.log('  ✓ idx_user_note_versions_node');
  
  await sql`CREATE INDEX IF NOT EXISTS idx_gen_log_status ON prebuilt_notes_generation_log(status)`;
  console.log('  ✓ idx_gen_log_status');

  // 5. Quick verification
  console.log('\n5. Verification...');
  const [nodeCount] = await sql`SELECT COUNT(*) as count FROM syllabus_nodes`;
  const [prebuiltCount] = await sql`SELECT COUNT(*) as count FROM prebuilt_notes`;
  
  console.log(`  Syllabus nodes: ${nodeCount.count}`);
  console.log(`  Pre-built notes: ${prebuiltCount.count}`);
  console.log(`  Target: ${Number(nodeCount.count) * 5} notes (${nodeCount.count} nodes × 5 versions)`);

  console.log('\n' + '='.repeat(60));
  console.log('MIGRATION COMPLETE ✓');
  console.log('='.repeat(60));
  console.log('\nNext step: Run the pre-generation script:');
  console.log('  npx tsx scripts/generate-prebuilt-notes.ts --dry-run');
  console.log('  npx tsx scripts/generate-prebuilt-notes.ts --unit atp-100');
}

main().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
