/**
 * Quick schema check
 */
import { neon } from '@neondatabase/serverless';
import * as fs from 'fs';
import * as path from 'path';

const envPath = path.join(__dirname, '..', '.env');
const envContent = fs.readFileSync(envPath, 'utf-8');
const dbMatch = envContent.match(/^DATABASE_URL=(.+)$/m);
const DATABASE_URL = dbMatch?.[1] || '';

async function checkSchema() {
  const sql = neon(DATABASE_URL);
  
  console.log('Checking micro_skills table columns...\n');
  
  const columns = await sql`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'micro_skills'
    ORDER BY ordinal_position
  `;
  
  console.log('Columns in micro_skills:');
  columns.forEach((col: any) => {
    console.log(`  - ${col.column_name} (${col.data_type})`);
  });
  
  // Check if table exists
  const tables = await sql`
    SELECT table_name FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name LIKE 'micro%'
  `;
  console.log('\nTables matching micro%:', tables);
}

checkSchema().catch(console.error);
