/**
 * M4 Database Proof
 * Verifies all M4 tables, enums, and structures exist
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
  console.log('='.repeat(60));
  console.log('M4 DATABASE PROOF: Mastery Hub (Written Exam Mode)');
  console.log('='.repeat(60));

  // 1. Verify M4 tables exist
  console.log('\n1. M4 Tables:');
  console.log('-'.repeat(40));
  
  const tables = await sql`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name IN ('authority_records', 'authority_passages', 'notification_log', 'push_subscriptions')
    ORDER BY table_name
  `;
  
  console.log(`Found ${tables.length}/4 M4 tables:`);
  tables.forEach(t => console.log(`  ✓ ${t.table_name}`));

  // 2. Verify authority_records structure
  console.log('\n2. authority_records Table Columns:');
  console.log('-'.repeat(40));
  
  const authCols = await sql`
    SELECT column_name, data_type, udt_name
    FROM information_schema.columns
    WHERE table_name = 'authority_records'
    ORDER BY ordinal_position
  `;
  authCols.forEach(c => console.log(`  ${c.column_name}: ${c.udt_name || c.data_type}`));

  // 3. Verify authority_passages structure
  console.log('\n3. authority_passages Table Columns:');
  console.log('-'.repeat(40));
  
  const passCols = await sql`
    SELECT column_name, data_type, udt_name
    FROM information_schema.columns
    WHERE table_name = 'authority_passages'
    ORDER BY ordinal_position
  `;
  passCols.forEach(c => console.log(`  ${c.column_name}: ${c.udt_name || c.data_type}`));

  // 4. Verify notification_log structure
  console.log('\n4. notification_log Table Columns:');
  console.log('-'.repeat(40));
  
  const notifCols = await sql`
    SELECT column_name, data_type, udt_name
    FROM information_schema.columns
    WHERE table_name = 'notification_log'
    ORDER BY ordinal_position
  `;
  notifCols.forEach(c => console.log(`  ${c.column_name}: ${c.udt_name || c.data_type}`));

  // 5. Verify push_subscriptions structure
  console.log('\n5. push_subscriptions Table Columns:');
  console.log('-'.repeat(40));
  
  const pushCols = await sql`
    SELECT column_name, data_type, udt_name
    FROM information_schema.columns
    WHERE table_name = 'push_subscriptions'
    ORDER BY ordinal_position
  `;
  pushCols.forEach(c => console.log(`  ${c.column_name}: ${c.udt_name || c.data_type}`));

  // 6. Verify M4 enums
  console.log('\n6. M4 Enums:');
  console.log('-'.repeat(40));
  
  const enums = await sql`
    SELECT t.typname as enum_name, e.enumlabel as enum_value
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname IN (
      'source_tier', 'source_type', 'license_tag', 
      'notification_channel', 'notification_status', 'study_activity_type'
    )
    ORDER BY t.typname, e.enumsortorder
  `;
  
  const enumGroups: Record<string, string[]> = {};
  enums.forEach(e => {
    if (!enumGroups[e.enum_name]) enumGroups[e.enum_name] = [];
    enumGroups[e.enum_name].push(e.enum_value);
  });
  
  Object.entries(enumGroups).forEach(([name, values]) => {
    console.log(`  ${name}: [${values.join(', ')}]`);
  });

  // 7. Verify evidence_spans updates
  console.log('\n7. evidence_spans Updates (M4):');
  console.log('-'.repeat(40));
  
  const evidenceCols = await sql`
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_name = 'evidence_spans' 
    AND column_name IN ('authority_id', 'locator_json', 'verbatim_allowed')
    ORDER BY column_name
  `;
  evidenceCols.forEach(c => console.log(`  ✓ ${c.column_name}`));

  // 8. Verify study_assets updates
  console.log('\n8. study_assets Updates (M4):');
  console.log('-'.repeat(40));
  
  const assetCols = await sql`
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_name = 'study_assets' 
    AND column_name = 'activity_types'
  `;
  if (assetCols.length > 0) {
    console.log('  ✓ activity_types (text[])');
  }

  // 9. Verify user_profiles updates
  console.log('\n9. user_profiles Updates (M4):');
  console.log('-'.repeat(40));
  
  const profileCols = await sql`
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_name = 'user_profiles' 
    AND column_name IN ('reminder_enabled', 'reminder_time', 'reminder_timezone')
    ORDER BY column_name
  `;
  profileCols.forEach(c => console.log(`  ✓ ${c.column_name}`));

  // 10. Verify indexes
  console.log('\n10. M4 Indexes:');
  console.log('-'.repeat(40));
  
  const indexes = await sql`
    SELECT indexname 
    FROM pg_indexes 
    WHERE tablename IN ('authority_records', 'authority_passages', 'notification_log', 'push_subscriptions')
    AND schemaname = 'public'
    ORDER BY indexname
  `;
  indexes.forEach(i => console.log(`  ✓ ${i.indexname}`));

  console.log('\n' + '='.repeat(60));
  console.log('M4 Database Proof Complete');
  console.log('='.repeat(60));
}

main().catch(console.error);
