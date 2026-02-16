/**
 * M2 Pacing Events Proof
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
  console.log('='.repeat(80));
  console.log('4) PACING PROOF: Session events with data');
  console.log('='.repeat(80));
  
  const events = await sql`
    SELECT created_at, event_type, event_data
    FROM session_events
    ORDER BY created_at DESC
    LIMIT 20`;
  
  console.log('\ncreated_at                  | event_type           | event_data');
  console.log('----------------------------+----------------------+----------------------------------');
  
  for (const row of events) {
    const created = new Date(row.created_at).toISOString();
    const eventType = String(row.event_type).padEnd(20);
    const eventData = JSON.stringify(row.event_data);
    console.log(`${created} | ${eventType} | ${eventData.substring(0, 60)}...`);
  }
  
  console.log('\n--- Full event data ---');
  for (const row of events) {
    console.log(`\nevent_type: ${row.event_type}`);
    console.log(`created_at: ${row.created_at}`);
    console.log(`event_data: ${JSON.stringify(row.event_data, null, 2)}`);
  }
}

main().catch(console.error);
