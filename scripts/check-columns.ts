import { neon } from '@neondatabase/serverless';
import * as fs from 'fs';
import * as path from 'path';

const envPath = path.join(process.cwd(), '.env');
const envContent = fs.readFileSync(envPath, 'utf-8');
const dbMatch = envContent.match(/^DATABASE_URL=(.+)$/m);
const DATABASE_URL = dbMatch?.[1] || '';
const sql = neon(DATABASE_URL);

async function main() {
  const cols = await sql`SELECT column_name FROM information_schema.columns WHERE table_name = 'micro_skills' ORDER BY ordinal_position`;
  console.log('micro_skills columns:', cols.map(c => c.column_name).join(', '));
  
  const sample = await sql`SELECT * FROM micro_skills LIMIT 1`;
  console.log('\nSample row:', JSON.stringify(sample[0], null, 2));
}

main().catch(console.error);
