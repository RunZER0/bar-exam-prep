import { neon } from '@neondatabase/serverless';
import * as fs from 'fs';
import * as path from 'path';

const envContent = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf-8');
const dbMatch = envContent.match(/^DATABASE_URL=(.+)$/m);
const sql = neon(dbMatch![1]);

async function main() {
  const rooms = await sql`SELECT id, name, unit_id, room_type FROM study_rooms ORDER BY unit_id, name`;
  console.log(`Total rooms: ${rooms.length}`);
  rooms.forEach((r: any) => console.log(`${r.unit_id || 'null'} | ${r.room_type} | ${r.name} | ${r.id}`));
  
  // Check duplicates
  const byUnit: Record<string, any[]> = {};
  rooms.filter((r: any) => r.room_type === 'official').forEach((r: any) => {
    const key = r.unit_id || 'null';
    if (!byUnit[key]) byUnit[key] = [];
    byUnit[key].push(r);
  });
  
  console.log('\n--- Duplicate Check ---');
  for (const [unit, rs] of Object.entries(byUnit)) {
    if (rs.length > 1) {
      console.log(`DUPLICATE: ${unit} has ${rs.length} rooms:`);
      rs.forEach((r: any) => console.log(`  - ${r.name} (${r.id})`));
    }
  }
}

main().catch(console.error);
