/**
 * Milestone 2 Proof Script
 * Generates all required proof artifacts for M2 closure
 */

import { neon } from '@neondatabase/serverless';
import * as fs from 'fs';
import * as path from 'path';

// Load DATABASE_URL from .env
const envPath = path.join(process.cwd(), '.env');
const envContent = fs.readFileSync(envPath, 'utf-8');
const dbMatch = envContent.match(/^DATABASE_URL=(.+)$/m);
const DATABASE_URL = dbMatch?.[1] || '';

if (!DATABASE_URL) {
  console.error('DATABASE_URL not found in .env');
  process.exit(1);
}

const sql = neon(DATABASE_URL);

async function main() {
  console.log('=' .repeat(80));
  console.log('MILESTONE 2 PROOF ARTIFACTS');
  console.log('Generated:', new Date().toISOString());
  console.log('=' .repeat(80));

  // ============================================================
  // 1) DB PROOF: Sessions and Assets
  // ============================================================
  console.log('\n' + '='.repeat(80));
  console.log('1) DB PROOF: Precompute creates READY sessions and assets');
  console.log('='.repeat(80));

  // Query 1a: Sessions by status
  console.log('\n--- Query: Sessions by status ---');
  const sessionsByStatus = await sql`
    SELECT status, COUNT(*) 
    FROM study_sessions 
    GROUP BY status
    ORDER BY status`;
  console.log('status           | count');
  console.log('-----------------+------');
  for (const row of sessionsByStatus) {
    console.log(`${String(row.status).padEnd(16)} | ${row.count}`);
  }

  // Query 1b: Assets by type and status
  console.log('\n--- Query: Assets by type and status ---');
  const assetsByType = await sql`
    SELECT asset_type, status, COUNT(*)
    FROM study_assets
    GROUP BY asset_type, status
    ORDER BY asset_type, status`;
  console.log('asset_type       | status      | count');
  console.log('-----------------+-------------+------');
  for (const row of assetsByType) {
    console.log(`${String(row.asset_type).padEnd(16)} | ${String(row.status).padEnd(11)} | ${row.count}`);
  }

  // Query 1c: Sessions with 4 READY assets
  console.log('\n--- Query: Sessions with READY assets breakdown ---');
  const sessionsWithAssets = await sql`
    SELECT s.id AS session_id,
           s.status,
           COUNT(*) FILTER (WHERE a.status='READY') AS ready_assets,
           COUNT(*) AS total_assets
    FROM study_sessions s
    LEFT JOIN study_assets a ON a.session_id = s.id
    GROUP BY s.id, s.status
    ORDER BY ready_assets DESC, total_assets DESC
    LIMIT 10`;
  console.log('session_id                           | status      | ready_assets | total_assets');
  console.log('-------------------------------------+-------------+--------------+-------------');
  for (const row of sessionsWithAssets) {
    console.log(`${row.session_id} | ${String(row.status).padEnd(11)} | ${String(row.ready_assets).padEnd(12)} | ${row.total_assets}`);
  }

  // Query 1d: Pacing events
  console.log('\n--- Query: Session events by type ---');
  const eventsByType = await sql`
    SELECT event_type, COUNT(*)
    FROM session_events
    GROUP BY event_type
    ORDER BY COUNT(*) DESC`;
  console.log('event_type                | count');
  console.log('--------------------------+------');
  for (const row of eventsByType) {
    console.log(`${String(row.event_type).padEnd(24)} | ${row.count}`);
  }

  // ============================================================
  // 2) SCHEMA PROOF: oral_slot_date exists
  // ============================================================
  console.log('\n' + '='.repeat(80));
  console.log('6) SCHEMA PROOF: oral_slot_date exists');
  console.log('='.repeat(80));

  const schemaProof = await sql`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_name='user_exam_profiles'
    ORDER BY ordinal_position`;
  console.log('\ncolumn_name              | data_type');
  console.log('-------------------------+------------------');
  for (const row of schemaProof) {
    console.log(`${String(row.column_name).padEnd(24)} | ${row.data_type}`);
  }

  // Check oral_slot_date specifically
  const hasOralSlotDate = schemaProof.some(r => r.column_name === 'oral_slot_date');
  console.log(`\n✓ oral_slot_date exists: ${hasOralSlotDate}`);

  // ============================================================
  // 3) WORKER PROOF: Background jobs table
  // ============================================================
  console.log('\n' + '='.repeat(80));
  console.log('3) WORKER PROOF: Background jobs');
  console.log('='.repeat(80));

  const jobsByStatus = await sql`
    SELECT job_type, status, COUNT(*)
    FROM background_jobs
    GROUP BY job_type, status
    ORDER BY job_type, status`;
  console.log('\njob_type                  | status      | count');
  console.log('--------------------------+-------------+------');
  for (const row of jobsByStatus) {
    console.log(`${String(row.job_type).padEnd(24)} | ${String(row.status).padEnd(11)} | ${row.count}`);
  }

  // Show sample jobs
  console.log('\n--- Sample background jobs (recent 5) ---');
  const recentJobs = await sql`
    SELECT id, job_type, status, attempts, created_at, completed_at
    FROM background_jobs
    ORDER BY created_at DESC
    LIMIT 5`;
  for (const row of recentJobs) {
    console.log(`Job: ${row.id}`);
    console.log(`  type: ${row.job_type}, status: ${row.status}, attempts: ${row.attempts}`);
    console.log(`  created: ${row.created_at}, completed: ${row.completed_at || 'null'}`);
  }

  // ============================================================
  // 4) TABLE EXISTENCE PROOF
  // ============================================================
  console.log('\n' + '='.repeat(80));
  console.log('TABLE EXISTENCE PROOF: All M2 tables exist');
  console.log('='.repeat(80));

  const tables = await sql`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name IN ('study_sessions', 'study_assets', 'session_events', 'background_jobs', 'user_exam_profiles')
    ORDER BY table_name`;
  console.log('\nRequired tables:');
  for (const row of tables) {
    console.log(`  ✓ ${row.table_name}`);
  }

  // ============================================================
  // 5) EXAM CYCLES PROOF (for oral window)
  // ============================================================
  console.log('\n' + '='.repeat(80));
  console.log('EXAM CYCLES PROOF: FIRST_TIME oral window');
  console.log('='.repeat(80));

  const examEvents = await sql`
    SELECT c.label, c.candidate_type, e.event_type, e.starts_at, e.ends_at
    FROM exam_cycles c
    JOIN exam_events e ON e.cycle_id = c.id
    WHERE e.event_type = 'ORAL'
    ORDER BY c.candidate_type`;
  console.log('\nlabel                | candidate_type | event_type | starts_at  | ends_at');
  console.log('---------------------+----------------+------------+------------+------------');
  for (const row of examEvents) {
    const starts = row.starts_at ? new Date(row.starts_at).toISOString().split('T')[0] : 'null';
    const ends = row.ends_at ? new Date(row.ends_at).toISOString().split('T')[0] : 'null';
    console.log(`${String(row.label).padEnd(20)} | ${String(row.candidate_type).padEnd(14)} | ${String(row.event_type).padEnd(10)} | ${starts} | ${ends}`);
  }

  console.log('\n' + '='.repeat(80));
  console.log('END OF PROOF ARTIFACTS');
  console.log('='.repeat(80));
}

main().catch(console.error);
