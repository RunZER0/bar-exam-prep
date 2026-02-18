import { neon } from '@neondatabase/serverless';
import * as fs from 'fs';
import * as path from 'path';

// Load .env manually
const envFiles = ['.env.local', '.env'];
let DATABASE_URL: string | undefined;

for (const envFile of envFiles) {
  const envPath = path.join(process.cwd(), envFile);
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    const match = envContent.match(/DATABASE_URL=["']?([^\n"']+)/);
    if (match?.[1]) {
      DATABASE_URL = match[1];
      break;
    }
  }
}

if (!DATABASE_URL) {
  console.error('DATABASE_URL not found');
  process.exit(1);
}

const sql = neon(DATABASE_URL);

async function check() {
  console.log('Checking unit_ids in micro_skills table...\n');
  
  const units = await sql`
    SELECT DISTINCT unit_id, COUNT(*)::int as skill_count 
    FROM micro_skills 
    WHERE is_active = true 
    GROUP BY unit_id 
    ORDER BY unit_id
  `;
  
  console.log('Unit IDs in database:');
  for (const u of units) {
    console.log(`  ${u.unit_id}: ${u.skill_count} skills`);
  }
  
  // Check what the plan API is returning
  console.log('\nExpected format: atp-100 through atp-108');
  
  // Check if any skills are in the wrong format
  const badUnits = units.filter(u => !u.unit_id.startsWith('atp-'));
  if (badUnits.length > 0) {
    console.log('\n⚠️ Units with incorrect format:');
    for (const u of badUnits) {
      console.log(`  ${u.unit_id}`);
    }
  } else {
    console.log('\n✓ All unit IDs are in correct format');
  }
}

check().then(() => process.exit(0)).catch(e => {
  console.error(e);
  process.exit(1);
});
