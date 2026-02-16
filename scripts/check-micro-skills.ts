import { neon } from '@neondatabase/serverless';
import * as fs from 'fs';
import * as path from 'path';

const envPath = path.join(__dirname, '..', '.env');
const envContent = fs.readFileSync(envPath, 'utf-8');
const dbMatch = envContent.match(/^DATABASE_URL=(.+)$/m);
const DATABASE_URL = dbMatch?.[1] || '';

const sql = neon(DATABASE_URL);

async function check() {
  const cols = await sql`SELECT column_name FROM information_schema.columns WHERE table_name = 'micro_skills'`;
  console.log('micro_skills columns:', cols.map((c: any) => c.column_name).join(', '));
  
  const count = await sql`SELECT COUNT(*) as c FROM micro_skills`;
  console.log('micro_skills count:', count[0]?.c);
  
  // List all skill codes
  const skills = await sql`SELECT code, name FROM micro_skills ORDER BY code`;
  console.log('\nAll skill codes:');
  for (const s of skills) {
    console.log(`  ${s.code}: ${s.name}`);
  }
}

check().catch(console.error);
