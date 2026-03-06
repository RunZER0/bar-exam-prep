import { neon } from '@neondatabase/serverless';
import * as fs from 'fs';
import * as path from 'path';

const envPath = path.join(__dirname, '..', '.env');
const envContent = fs.readFileSync(envPath, 'utf-8');
const dbMatch = envContent.match(/^DATABASE_URL=(.+)$/m);
const DATABASE_URL = dbMatch?.[1] || '';
const sql = neon(DATABASE_URL);

async function main() {
  const tables = await sql`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name`;
  console.log('Existing tables:');
  tables.forEach(t => console.log(`  - ${t.table_name}`));
  
  // Check if community tables exist
  const communityTables = ['study_rooms', 'room_members', 'room_messages', 'room_requests', 'community_events', 'event_participants', 'user_friends', 'user_achievements', 'weekly_rankings', 'friend_suggestions'];
  console.log('\nCommunity tables status:');
  for (const t of communityTables) {
    const exists = tables.some(row => row.table_name === t);
    console.log(`  ${exists ? '✓' : '✗'} ${t}`);
  }
}

main().catch(console.error);
