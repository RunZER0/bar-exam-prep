/**
 * M3 Database Proof
 * Verifies all M3 tables and structures exist
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
  console.log('M3 DATABASE PROOF');
  console.log('='.repeat(60));

  // 1. Verify M3 tables exist
  console.log('\n1. M3 Tables:');
  console.log('-'.repeat(40));
  
  const tables = await sql`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name IN ('lectures', 'lecture_chunks', 'lecture_skill_map', 'evidence_spans', 'missing_authority_log')
    ORDER BY table_name
  `;
  
  console.log(`Found ${tables.length}/5 M3 tables:`);
  tables.forEach(t => console.log(`  ✓ ${t.table_name}`));

  // 2. Verify lectures table structure
  console.log('\n2. lectures Table Columns:');
  console.log('-'.repeat(40));
  
  const lectureCols = await sql`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'lectures'
    ORDER BY ordinal_position
  `;
  lectureCols.forEach(c => console.log(`  ${c.column_name}: ${c.data_type} (${c.is_nullable === 'YES' ? 'nullable' : 'required'})`));

  // 3. Verify lecture_chunks table structure  
  console.log('\n3. lecture_chunks Table Columns:');
  console.log('-'.repeat(40));
  
  const chunkCols = await sql`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'lecture_chunks'
    ORDER BY ordinal_position
  `;
  chunkCols.forEach(c => console.log(`  ${c.column_name}: ${c.data_type} (${c.is_nullable === 'YES' ? 'nullable' : 'required'})`));

  // 4. Verify lecture_skill_map with status column
  console.log('\n4. lecture_skill_map Table Columns:');
  console.log('-'.repeat(40));
  
  const mapCols = await sql`
    SELECT column_name, data_type, udt_name
    FROM information_schema.columns
    WHERE table_name = 'lecture_skill_map'
    ORDER BY ordinal_position
  `;
  mapCols.forEach(c => console.log(`  ${c.column_name}: ${c.udt_name || c.data_type}`));

  // 5. Verify evidence_spans table
  console.log('\n5. evidence_spans Table Columns:');
  console.log('-'.repeat(40));
  
  const evidenceCols = await sql`
    SELECT column_name, data_type, udt_name
    FROM information_schema.columns
    WHERE table_name = 'evidence_spans'
    ORDER BY ordinal_position
  `;
  evidenceCols.forEach(c => console.log(`  ${c.column_name}: ${c.udt_name || c.data_type}`));

  // 6. Verify missing_authority_log 
  console.log('\n6. missing_authority_log Table Columns:');
  console.log('-'.repeat(40));
  
  const missingCols = await sql`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_name = 'missing_authority_log'
    ORDER BY ordinal_position
  `;
  missingCols.forEach(c => console.log(`  ${c.column_name}: ${c.data_type}`));

  // 7. Verify enums
  console.log('\n7. M3 Enums:');
  console.log('-'.repeat(40));
  
  const enums = await sql`
    SELECT t.typname as enum_name, e.enumlabel as enum_value
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname IN ('lecture_source', 'skill_mapping_status', 'evidence_source')
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

  // 8. Verify indexes
  console.log('\n8. M3 Indexes:');
  console.log('-'.repeat(40));
  
  const indexes = await sql`
    SELECT indexname 
    FROM pg_indexes 
    WHERE tablename IN ('lectures', 'lecture_chunks', 'lecture_skill_map', 'evidence_spans', 'missing_authority_log')
    AND schemaname = 'public'
    ORDER BY indexname
  `;
  indexes.forEach(i => console.log(`  ✓ ${i.indexname}`));

  // 9. Verify study_assets.grounding_refs_json column
  console.log('\n9. study_assets.grounding_refs_json:');
  console.log('-'.repeat(40));
  
  const groundingCol = await sql`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'study_assets' 
    AND column_name = 'grounding_refs_json'
  `;
  
  if (groundingCol.length > 0) {
    console.log(`  ✓ grounding_refs_json: ${groundingCol[0].data_type}`);
    
    // Sample existing data
    const sample = await sql`
      SELECT grounding_refs_json FROM study_assets 
      WHERE grounding_refs_json IS NOT NULL 
      LIMIT 1
    `;
    if (sample.length > 0) {
      console.log(`  Sample data: ${JSON.stringify(sample[0].grounding_refs_json)}`);
    }
  } else {
    console.log('  ✗ Column not found');
  }

  console.log('\n' + '='.repeat(60));
  console.log('M3 Database Proof Complete');
  console.log('='.repeat(60));
}

main().catch(console.error);
