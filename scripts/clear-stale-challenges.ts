/**
 * Clear stale / hardcoded community challenges from the DB.
 * Removes ALL peer-created challenges and expires all AI challenges
 * so fresh ones are auto-generated on the next page load.
 *
 * Run: npx tsx scripts/clear-stale-challenges.ts
 */

import { neon } from '@neondatabase/serverless';
import * as fs from 'fs';
import * as path from 'path';

const envPath = path.join(__dirname, '..', '.env');
const envContent = fs.readFileSync(envPath, 'utf-8');
const dbMatch = envContent.match(/^DATABASE_URL=(.+)$/m);
const DATABASE_URL = (dbMatch?.[1] || '').trim();

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL not found in .env');
  process.exit(1);
}

async function run() {
  const sql = neon(DATABASE_URL);

  try {
    console.log('🔍 Current challenge state:');
    const overview = await sql`
      SELECT
        is_agent_created,
        status,
        COUNT(*) AS cnt
      FROM community_events
      GROUP BY is_agent_created, status
      ORDER BY is_agent_created, status
    `;
    for (const r of overview) {
      const kind = r.is_agent_created ? 'AI' : 'Peer';
      console.log(`  ${kind} | ${r.status} | ${r.cnt} record(s)`);
    }

    // Step 1: Delete participants for peer challenges first (FK constraint)
    console.log('\n🗑  Deleting participant records for peer challenges...');
    const peerIds = await sql`
      SELECT id FROM community_events WHERE is_agent_created = false
    `;
    if (peerIds.length > 0) {
      const ids = peerIds.map((r: any) => r.id);
      await sql`DELETE FROM event_participants WHERE event_id = ANY(${ids}::uuid[])`;
      console.log(`   Removed participant rows for ${ids.length} peer event(s)`);
    }

    // Step 2: Delete all peer-created challenges
    const delPeer = await sql`
      DELETE FROM community_events WHERE is_agent_created = false RETURNING id
    `;
    console.log(`   Deleted ${delPeer.length} peer challenge(s)`);

    // Step 3: Expire all active/upcoming AI challenges so they're regenerated
    const expireAi = await sql`
      UPDATE community_events
      SET status = 'completed'
      WHERE is_agent_created = true AND status != 'completed'
      RETURNING id
    `;
    console.log(`   Expired ${expireAi.length} AI challenge(s) (will regenerate on next page load)`);

    // Final state
    console.log('\n✅ Done. Remaining records:');
    const after = await sql`SELECT COUNT(*) AS cnt FROM community_events`;
    console.log(`   Total community_events rows: ${after[0].cnt}`);
    console.log('\n💡 AI challenges will auto-generate when any user visits the Community → Events tab.');

  } catch (err) {
    console.error('❌ Error:', err);
    process.exit(1);
  }
}

run();
