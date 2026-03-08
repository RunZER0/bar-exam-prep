/**
 * Migration: Create oral_sessions table
 *
 * Run: npx tsx scripts/apply-oral-sessions-migration.ts
 */

import 'dotenv/config';
import { Pool } from 'pg';

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  const client = await pool.connect();

  try {
    console.log('Starting oral_sessions migration...\n');

    // 1. Create oral_sessions table
    await client.query(`
      CREATE TABLE IF NOT EXISTS oral_sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id),
        type TEXT NOT NULL DEFAULT 'devils-advocate',
        mode TEXT,
        unit_id TEXT,
        duration_seconds INTEGER NOT NULL DEFAULT 0,
        exchange_count INTEGER NOT NULL DEFAULT 0,
        score INTEGER,
        summary TEXT,
        transcript JSONB,
        audio_url TEXT,
        audio_expires_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    console.log('✓ oral_sessions table created');

    // 2. Create indexes
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_oral_sessions_user ON oral_sessions(user_id)
    `);
    console.log('✓ idx_oral_sessions_user index');

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_oral_sessions_created ON oral_sessions(created_at DESC)
    `);
    console.log('✓ idx_oral_sessions_created index');

    console.log('\n✅ Oral sessions migration complete!');
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
