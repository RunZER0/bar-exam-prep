import { neon } from '@neondatabase/serverless';
import * as fs from 'fs';
import * as path from 'path';

const envContent = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf-8');
const dbMatch = envContent.match(/^DATABASE_URL=(.+)$/m);
const sql = neon(dbMatch![1]);

async function main() {
  console.log('=== Fixing Duplicate Rooms ===\n');

  // Get all official rooms ordered by creation date
  const rooms = await sql`
    SELECT id, name, unit_id, created_at
    FROM study_rooms
    WHERE room_type = 'official'
    ORDER BY unit_id NULLS LAST, created_at ASC
  `;

  // Group by unit_id
  const byUnit: Record<string, any[]> = {};
  rooms.forEach((r: any) => {
    const key = r.unit_id || 'null';
    if (!byUnit[key]) byUnit[key] = [];
    byUnit[key].push(r);
  });

  const toDelete: string[] = [];

  for (const [unitKey, unitRooms] of Object.entries(byUnit)) {
    if (unitRooms.length > 1) {
      // Keep the first (oldest), delete the rest
      const keep = unitRooms[0];
      const dupes = unitRooms.slice(1);
      
      console.log(`Unit ${unitKey}: keeping ${keep.name} (${keep.id}), deleting ${dupes.length} duplicate(s)`);
      
      for (const dupe of dupes) {
        // Move any members from dupe to keep (ignore conflicts)
        await sql`
          INSERT INTO room_members (room_id, user_id, role, joined_at)
          SELECT ${keep.id}, user_id, role, joined_at
          FROM room_members WHERE room_id = ${dupe.id}
          ON CONFLICT DO NOTHING
        `;
        
        // Move any messages from dupe to keep
        await sql`
          UPDATE room_messages SET room_id = ${keep.id} WHERE room_id = ${dupe.id}
        `;
        
        // Delete members from dupe
        await sql`DELETE FROM room_members WHERE room_id = ${dupe.id}`;
        
        // Delete the duplicate room
        await sql`DELETE FROM study_rooms WHERE id = ${dupe.id}`;
        
        toDelete.push(dupe.id);
      }
    }
  }

  console.log(`\nDeleted ${toDelete.length} duplicate rooms.`);
  
  // Verify
  const remaining = await sql`SELECT id, name, unit_id FROM study_rooms WHERE room_type = 'official' ORDER BY unit_id`;
  console.log(`\nRemaining official rooms (${remaining.length}):`);
  remaining.forEach((r: any) => console.log(`  ${r.unit_id || 'general'} | ${r.name}`));
  
  // Also add unique constraint to prevent future duplicates
  try {
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_study_rooms_unit_unique ON study_rooms (unit_id) WHERE room_type = 'official' AND unit_id IS NOT NULL`;
    console.log('\nAdded unique index on unit_id for official rooms.');
  } catch (e: any) {
    console.log('\nUnique index already exists or could not be created:', e.message);
  }

  console.log('\n=== Done ===');
}

main().catch(console.error);
