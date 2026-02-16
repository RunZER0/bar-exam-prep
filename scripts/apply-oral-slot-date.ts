/**
 * Apply oral_slot_date migration
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
  console.log('Adding oral_slot_date column to user_exam_profiles...');
  
  // Check if column exists
  const existing = await sql`
    SELECT column_name FROM information_schema.columns 
    WHERE table_name = 'user_exam_profiles' AND column_name = 'oral_slot_date'`;
  
  if (existing.length > 0) {
    console.log('Column already exists');
    return;
  }
  
  // Add the column
  await sql`ALTER TABLE user_exam_profiles ADD COLUMN oral_slot_date DATE`;
  console.log('✓ oral_slot_date column added');
  
  // Verify
  const verify = await sql`
    SELECT column_name, data_type FROM information_schema.columns 
    WHERE table_name = 'user_exam_profiles' 
    ORDER BY ordinal_position`;
  
  console.log('\nuser_exam_profiles columns:');
  for (const col of verify) {
    console.log(`  - ${col.column_name}: ${col.data_type}`);
  }
}

main().catch(console.error);
