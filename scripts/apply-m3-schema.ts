/**
 * Manual Milestone 3 schema migration using Neon HTTP driver.
 * Adds: ksl_term, is_high_yield, core_texts to syllabus_nodes
 * Creates: node_progress table
 */
import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';
dotenv.config();

async function main() {
  const sql = neon(process.env.DATABASE_URL!);

  console.log('[M3 Migration] Starting schema update...');

  // 1. Add new columns to syllabus_nodes (IF NOT EXISTS)
  try {
    await sql`ALTER TABLE syllabus_nodes ADD COLUMN IF NOT EXISTS ksl_term INTEGER NOT NULL DEFAULT 1`;
    console.log('  ✓ ksl_term column added');
  } catch (e: any) {
    console.log('  - ksl_term:', e.message);
  }

  try {
    await sql`ALTER TABLE syllabus_nodes ADD COLUMN IF NOT EXISTS is_high_yield BOOLEAN NOT NULL DEFAULT false`;
    console.log('  ✓ is_high_yield column added');
  } catch (e: any) {
    console.log('  - is_high_yield:', e.message);
  }

  try {
    await sql`ALTER TABLE syllabus_nodes ADD COLUMN IF NOT EXISTS core_texts JSONB`;
    console.log('  ✓ core_texts column added');
  } catch (e: any) {
    console.log('  - core_texts:', e.message);
  }

  // 2. Create node_progress table
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS node_progress (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        user_id UUID NOT NULL REFERENCES users(id),
        node_id UUID NOT NULL REFERENCES syllabus_nodes(id),
        phase TEXT NOT NULL DEFAULT 'NOTE',
        note_completed BOOLEAN NOT NULL DEFAULT false,
        exhibit_viewed BOOLEAN NOT NULL DEFAULT false,
        diagnosis_score REAL,
        diagnosis_passed BOOLEAN NOT NULL DEFAULT false,
        mastery_score REAL,
        mastery_passed BOOLEAN NOT NULL DEFAULT false,
        attempts INTEGER NOT NULL DEFAULT 0,
        last_attempt_at TIMESTAMP,
        completed_at TIMESTAMP,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `;
    console.log('  ✓ node_progress table created');
  } catch (e: any) {
    console.log('  - node_progress:', e.message);
  }

  // 3. Add indexes for performance
  try {
    await sql`CREATE INDEX IF NOT EXISTS idx_node_progress_user ON node_progress(user_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_node_progress_node ON node_progress(node_id)`;
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_node_progress_user_node ON node_progress(user_id, node_id)`;
    console.log('  ✓ Indexes created');
  } catch (e: any) {
    console.log('  - Indexes:', e.message);
  }

  // 4. Verify
  const cols = await sql`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'syllabus_nodes' 
    ORDER BY ordinal_position
  `;
  console.log('\n[syllabus_nodes columns]:');
  for (const c of cols) {
    console.log(`  ${c.column_name} (${c.data_type})`);
  }

  const tables = await sql`
    SELECT table_name FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'node_progress'
  `;
  console.log(`\n[node_progress table exists]: ${tables.length > 0 ? 'YES' : 'NO'}`);

  console.log('\n[M3 Migration] Complete.');
}

main().catch(console.error);
