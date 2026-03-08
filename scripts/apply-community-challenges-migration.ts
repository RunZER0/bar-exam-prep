/**
 * Migration: Add community challenge submission columns to community_events
 * Adds: submitter_name, review_status, review_feedback, challenge_content
 */
import 'dotenv/config';
import { Pool } from 'pg';

async function main() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  const client = await pool.connect();
  try {
    console.log('Adding community challenge submission columns...');
    
    // Add new columns (all nullable so existing rows aren't affected)
    await client.query(`
      ALTER TABLE community_events 
        ADD COLUMN IF NOT EXISTS submitter_name TEXT,
        ADD COLUMN IF NOT EXISTS review_status TEXT DEFAULT 'approved',
        ADD COLUMN IF NOT EXISTS review_feedback TEXT,
        ADD COLUMN IF NOT EXISTS challenge_content JSONB;
    `);

    // Set review_status for existing events
    await client.query(`
      UPDATE community_events SET review_status = 'approved' WHERE review_status IS NULL;
    `);
    
    console.log('✅ Migration complete — community challenge columns added');
  } catch (err) {
    console.error('Migration failed:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(console.error);
