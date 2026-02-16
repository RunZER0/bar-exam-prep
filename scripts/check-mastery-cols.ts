/**
 * Check mastery_state table columns
 */

import postgres from 'postgres';
import * as fs from 'fs';
import * as path from 'path';

const envPath = path.join(__dirname, '..', '.env');
const envContent = fs.readFileSync(envPath, 'utf-8');
const dbMatch = envContent.match(/^DATABASE_URL=(.+)$/m);
const DATABASE_URL = dbMatch?.[1] || '';

async function run() {
  const sql = postgres(DATABASE_URL, { ssl: 'require' });
  await sql`SET search_path TO public`;
  
  const cols = await sql`
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_name = 'mastery_state' 
    ORDER BY ordinal_position
  `;
  console.log('mastery_state columns:');
  cols.forEach(c => console.log(`  - ${c.column_name}`));
  
  await sql.end();
}

run();
