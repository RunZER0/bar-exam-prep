/**
 * Seed Exam Cycles + Events for Tutor OS
 * 
 * Creates:
 * - RESIT cycle: April 2026 (Written April 9-21)
 * - FIRST_TIME cycle: November 2026 (Written Nov 12-24, Oral placeholder July 10)
 */

import postgres from 'postgres';
import * as fs from 'fs';
import * as path from 'path';

// Load .env manually
const envPath = path.join(__dirname, '..', '.env');
const envContent = fs.readFileSync(envPath, 'utf-8');
const dbMatch = envContent.match(/^DATABASE_URL=(.+)$/m);
const DATABASE_URL = dbMatch?.[1] || '';

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL not found in .env');
  process.exit(1);
}

const sql = postgres(DATABASE_URL, { ssl: 'require' });

async function seedExamCycles() {
  console.log('🔧 Seeding Exam Cycles + Events...\n');

  // Clean existing data (for idempotent runs)
  await sql`DELETE FROM exam_events`;
  await sql`DELETE FROM exam_cycles`;

  // ============================================
  // 1. RESIT CYCLE - April 2026
  // ============================================
  const [resitCycle] = await sql`
    INSERT INTO exam_cycles (label, candidate_type, year, timezone, notes, is_active)
    VALUES (
      'ATP 2026 April Resit',
      'RESIT',
      2026,
      'Africa/Nairobi',
      'For candidates rewriting the ATP examination',
      true
    )
    RETURNING id, label
  `;
  console.log(`✅ Created cycle: ${resitCycle.label} (${resitCycle.id})`);

  // RESIT Written window: April 9-21, 2026
  await sql`
    INSERT INTO exam_events (cycle_id, event_type, starts_at, ends_at, meta_json)
    VALUES (
      ${resitCycle.id},
      'WRITTEN',
      '2026-04-09T09:00:00+03:00',
      '2026-04-21T17:00:00+03:00',
      '{"venue": "Kenya School of Law, Karen"}'::jsonb
    )
  `;
  console.log('  📝 Added WRITTEN event: 2026-04-09 → 2026-04-21');

  // ============================================
  // 2. FIRST_TIME CYCLE - November 2026
  // ============================================
  const [firstTimeCycle] = await sql`
    INSERT INTO exam_cycles (label, candidate_type, year, timezone, notes, is_active)
    VALUES (
      'ATP 2026 First-time Track',
      'FIRST_TIME',
      2026,
      'Africa/Nairobi',
      'For first-time bar examination candidates',
      true
    )
    RETURNING id, label
  `;
  console.log(`✅ Created cycle: ${firstTimeCycle.label} (${firstTimeCycle.id})`);

  // FIRST_TIME Written window: November 12-24, 2026
  await sql`
    INSERT INTO exam_events (cycle_id, event_type, starts_at, ends_at, meta_json)
    VALUES (
      ${firstTimeCycle.id},
      'WRITTEN',
      '2026-11-12T09:00:00+03:00',
      '2026-11-24T17:00:00+03:00',
      '{"venue": "Kenya School of Law, Karen"}'::jsonb
    )
  `;
  console.log('  📝 Added WRITTEN event: 2026-11-12 → 2026-11-24');

  // FIRST_TIME Oral placeholder: July 10, 2026
  await sql`
    INSERT INTO exam_events (cycle_id, event_type, starts_at, ends_at, meta_json)
    VALUES (
      ${firstTimeCycle.id},
      'ORAL',
      '2026-07-10T09:00:00+03:00',
      '2026-07-10T17:00:00+03:00',
      '{"note": "Placeholder - specific dates TBD per unit"}'::jsonb
    )
  `;
  console.log('  🎤 Added ORAL event placeholder: 2026-07-10');

  // ============================================
  // VERIFICATION
  // ============================================
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('VERIFICATION QUERIES');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const cycles = await sql`
    SELECT id, label, candidate_type, timezone FROM exam_cycles ORDER BY label
  `;
  console.log('SELECT id, label, candidate_type, timezone FROM exam_cycles ORDER BY label;');
  cycles.forEach(c => {
    console.log(`  ${c.label} | ${c.candidate_type} | ${c.timezone}`);
  });

  console.log('');

  const events = await sql`
    SELECT c.label, e.event_type, e.starts_at, e.ends_at
    FROM exam_events e JOIN exam_cycles c ON c.id=e.cycle_id
    ORDER BY c.label, e.event_type, e.starts_at
  `;
  console.log(`SELECT c.label, e.event_type, e.starts_at, e.ends_at FROM exam_events e JOIN exam_cycles c ON c.id=e.cycle_id;`);
  events.forEach(e => {
    console.log(`  ${e.label} | ${e.event_type} | ${e.starts_at} → ${e.ends_at || 'null'}`);
  });

  console.log('\n✅ Exam cycles seeded successfully!');
  await sql.end();
  process.exit(0);
}

seedExamCycles().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
