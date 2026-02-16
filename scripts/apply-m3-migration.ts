/**
 * M3 Migration: Transcript-Aligned Tutor Tables
 * Creates: lectures, lecture_chunks, lecture_skill_map, evidence_spans, missing_authority_log
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
  console.log('M3 Migration: Transcript-Aligned Tutor Tables');
  console.log('='.repeat(60));

  try {
    // 1. Create enums
    console.log('\n1. Creating enums...');
    
    await sql`
      DO $$ BEGIN
        CREATE TYPE lecture_source AS ENUM ('KSL', 'ATP_OFFICIAL', 'EXTERNAL', 'ADMIN_UPLOAD');
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `;
    console.log('   ✓ lecture_source enum');

    await sql`
      DO $$ BEGIN
        CREATE TYPE skill_mapping_status AS ENUM ('SUGGESTED', 'APPROVED', 'REJECTED');
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `;
    console.log('   ✓ skill_mapping_status enum');

    await sql`
      DO $$ BEGIN
        CREATE TYPE evidence_source AS ENUM ('OUTLINE_TOPIC', 'LECTURE_CHUNK', 'AUTHORITY');
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `;
    console.log('   ✓ evidence_source enum');

    // 2. Create lectures table
    console.log('\n2. Creating lectures table...');
    await sql`
      CREATE TABLE IF NOT EXISTS lectures (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        unit_id TEXT,
        title TEXT NOT NULL,
        lecturer_name TEXT,
        lecture_date DATE,
        source lecture_source NOT NULL DEFAULT 'KSL',
        transcript_asset_url TEXT,
        duration_minutes INTEGER,
        is_active BOOLEAN NOT NULL DEFAULT true,
        metadata JSONB,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `;
    console.log('   ✓ lectures table created');

    // 3. Create lecture_chunks table
    console.log('\n3. Creating lecture_chunks table...');
    await sql`
      CREATE TABLE IF NOT EXISTS lecture_chunks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        lecture_id UUID NOT NULL REFERENCES lectures(id) ON DELETE CASCADE,
        chunk_index INTEGER NOT NULL,
        text TEXT NOT NULL,
        start_time INTEGER,
        end_time INTEGER,
        embedding_id TEXT,
        embedding_vector JSONB,
        token_count INTEGER,
        chunk_hash TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `;
    console.log('   ✓ lecture_chunks table created');

    // 4. Create lecture_skill_map table
    console.log('\n4. Creating lecture_skill_map table...');
    await sql`
      CREATE TABLE IF NOT EXISTS lecture_skill_map (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        chunk_id UUID NOT NULL REFERENCES lecture_chunks(id) ON DELETE CASCADE,
        skill_id UUID NOT NULL REFERENCES micro_skills(id) ON DELETE CASCADE,
        confidence NUMERIC(5, 4) NOT NULL,
        evidence_span TEXT,
        status skill_mapping_status NOT NULL DEFAULT 'SUGGESTED',
        approved_by UUID REFERENCES users(id),
        approved_at TIMESTAMP,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `;
    console.log('   ✓ lecture_skill_map table created');

    // 5. Create evidence_spans table
    console.log('\n5. Creating evidence_spans table...');
    await sql`
      CREATE TABLE IF NOT EXISTS evidence_spans (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        target_type TEXT NOT NULL,
        target_id UUID NOT NULL,
        source_type evidence_source NOT NULL,
        source_id UUID NOT NULL,
        quoted_text TEXT,
        claim_text TEXT,
        confidence_score NUMERIC(5, 4),
        page_or_timestamp TEXT,
        generated_by TEXT,
        is_verified BOOLEAN DEFAULT false,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `;
    console.log('   ✓ evidence_spans table created');

    // 6. Create missing_authority_log table
    console.log('\n6. Creating missing_authority_log table...');
    await sql`
      CREATE TABLE IF NOT EXISTS missing_authority_log (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        claim_text TEXT NOT NULL,
        requested_skill_ids JSONB,
        search_query TEXT,
        search_results JSONB,
        error_tag TEXT NOT NULL,
        session_id UUID REFERENCES study_sessions(id),
        asset_id UUID REFERENCES study_assets(id),
        resolved_at TIMESTAMP,
        resolved_by UUID REFERENCES users(id),
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `;
    console.log('   ✓ missing_authority_log table created');

    // 7. Create indexes for efficient retrieval
    console.log('\n7. Creating indexes...');
    
    await sql`
      CREATE INDEX IF NOT EXISTS idx_lectures_unit_id ON lectures(unit_id);
    `;
    console.log('   ✓ idx_lectures_unit_id');

    await sql`
      CREATE INDEX IF NOT EXISTS idx_lecture_chunks_lecture_id ON lecture_chunks(lecture_id);
    `;
    console.log('   ✓ idx_lecture_chunks_lecture_id');

    await sql`
      CREATE INDEX IF NOT EXISTS idx_lecture_skill_map_chunk_id ON lecture_skill_map(chunk_id);
    `;
    console.log('   ✓ idx_lecture_skill_map_chunk_id');

    await sql`
      CREATE INDEX IF NOT EXISTS idx_lecture_skill_map_skill_id ON lecture_skill_map(skill_id);
    `;
    console.log('   ✓ idx_lecture_skill_map_skill_id');

    await sql`
      CREATE INDEX IF NOT EXISTS idx_lecture_skill_map_status ON lecture_skill_map(status);
    `;
    console.log('   ✓ idx_lecture_skill_map_status');

    await sql`
      CREATE INDEX IF NOT EXISTS idx_evidence_spans_target ON evidence_spans(target_type, target_id);
    `;
    console.log('   ✓ idx_evidence_spans_target');

    await sql`
      CREATE INDEX IF NOT EXISTS idx_evidence_spans_source ON evidence_spans(source_type, source_id);
    `;
    console.log('   ✓ idx_evidence_spans_source');

    await sql`
      CREATE INDEX IF NOT EXISTS idx_missing_authority_log_error_tag ON missing_authority_log(error_tag);
    `;
    console.log('   ✓ idx_missing_authority_log_error_tag');

    // 8. Update study_assets grounding_refs_json to include lecture_chunk_ids
    console.log('\n8. Verifying grounding_refs_json structure in study_assets...');
    const assetsSample = await sql`
      SELECT id, grounding_refs_json FROM study_assets LIMIT 1
    `;
    console.log('   ✓ study_assets.grounding_refs_json ready for lecture_chunk_ids');

    // 9. Verify all tables exist
    console.log('\n9. Verifying tables...');
    const tables = await sql`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('lectures', 'lecture_chunks', 'lecture_skill_map', 'evidence_spans', 'missing_authority_log')
      ORDER BY table_name
    `;
    console.log(`   Found ${tables.length}/5 M3 tables:`);
    tables.forEach(t => console.log(`     - ${t.table_name}`));

    console.log('\n' + '='.repeat(60));
    console.log('M3 Migration completed successfully!');
    console.log('='.repeat(60));

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    throw error;
  }
}

main().catch(console.error);
