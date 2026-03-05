/**
 * Apply pgvector + Knowledge Base Migration
 * 
 * Enables:
 *   1. pgvector extension on Neon Postgres
 *   2. Embedding columns (vector(1536)) on micro_skills, items, lecture_chunks
 *   3. knowledge_base table for all 9 ATP units
 *   4. IVFFlat indexes for fast approximate nearest neighbor search
 *   5. Full-text search fallback on knowledge_base
 * 
 * Usage: npx tsx scripts/apply-pgvector-migration.ts
 */

import { neon } from '@neondatabase/serverless';
import { readFileSync } from 'fs';
import { join } from 'path';

async function main() {
  if (!process.env.DATABASE_URL) {
    // Try .env file
    try {
      const dotenv = require('dotenv');
      dotenv.config();
    } catch {}
  }

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('DATABASE_URL not set');
    process.exit(1);
  }

  const sql = neon(dbUrl);

  console.log('=== YNAI pgvector Migration ===\n');

  // 1. Check if pgvector is available (Neon supports it natively)
  try {
    const extCheck = await sql`SELECT 1 FROM pg_available_extensions WHERE name = 'vector'`;
    if (extCheck.length === 0) {
      console.error('ERROR: pgvector extension not available on this database.');
      console.error('Ensure you are using Neon Postgres or a provider that supports pgvector.');
      process.exit(1);
    }
    console.log('✓ pgvector extension available');
  } catch (error) {
    console.error('Could not check pgvector availability:', error);
  }

  // 2. Enable pgvector
  try {
    await sql`CREATE EXTENSION IF NOT EXISTS vector`;
    console.log('✓ pgvector extension enabled');
  } catch (error: any) {
    console.error('Failed to enable pgvector:', error.message);
    process.exit(1);
  }

  // 3. Add embedding column to micro_skills
  try {
    const colCheck = await sql`
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'micro_skills' AND column_name = 'embedding'
    `;
    if (colCheck.length === 0) {
      await sql`ALTER TABLE micro_skills ADD COLUMN embedding vector(1536)`;
      console.log('✓ Added embedding column to micro_skills');
    } else {
      // Check if it's the right type (vector, not jsonb)
      const typeCheck = await sql`
        SELECT data_type FROM information_schema.columns 
        WHERE table_name = 'micro_skills' AND column_name = 'embedding'
      `;
      if (typeCheck[0]?.data_type === 'jsonb') {
        await sql`ALTER TABLE micro_skills DROP COLUMN embedding`;
        await sql`ALTER TABLE micro_skills ADD COLUMN embedding vector(1536)`;
        console.log('✓ Converted micro_skills.embedding from jsonb to vector(1536)');
      } else {
        console.log('✓ micro_skills.embedding already exists (vector type)');
      }
    }
  } catch (error: any) {
    console.error('micro_skills embedding:', error.message);
  }

  // 4. Add embedding column to items
  try {
    const colCheck = await sql`
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'items' AND column_name = 'embedding'
    `;
    if (colCheck.length === 0) {
      await sql`ALTER TABLE items ADD COLUMN embedding vector(1536)`;
      console.log('✓ Added embedding column to items');
    } else {
      const typeCheck = await sql`
        SELECT data_type FROM information_schema.columns 
        WHERE table_name = 'items' AND column_name = 'embedding'
      `;
      if (typeCheck[0]?.data_type === 'jsonb') {
        await sql`ALTER TABLE items DROP COLUMN embedding`;
        await sql`ALTER TABLE items ADD COLUMN embedding vector(1536)`;
        console.log('✓ Converted items.embedding from jsonb to vector(1536)');
      } else {
        console.log('✓ items.embedding already exists (vector type)');
      }
    }
  } catch (error: any) {
    console.error('items embedding:', error.message);
  }

  // 5. Fix lecture_chunks embedding type if needed
  try {
    const colCheck = await sql`
      SELECT data_type FROM information_schema.columns 
      WHERE table_name = 'lecture_chunks' AND column_name = 'embedding'
    `;
    if (colCheck.length === 0) {
      await sql`ALTER TABLE lecture_chunks ADD COLUMN embedding vector(1536)`;
      console.log('✓ Added embedding column to lecture_chunks');
    } else if (colCheck[0]?.data_type === 'jsonb') {
      await sql`ALTER TABLE lecture_chunks DROP COLUMN embedding`;
      await sql`ALTER TABLE lecture_chunks ADD COLUMN embedding vector(1536)`;
      console.log('✓ Converted lecture_chunks.embedding from jsonb to vector(1536)');
    } else {
      console.log('✓ lecture_chunks.embedding already correct (vector type)');
    }
  } catch (error: any) {
    console.error('lecture_chunks embedding:', error.message);
  }

  // 6. Create knowledge_base table
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS knowledge_base (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        unit_id TEXT NOT NULL,
        entry_type TEXT NOT NULL CHECK (entry_type IN ('provision', 'case_law', 'regulation', 'principle', 'procedure', 'definition')),
        source TEXT NOT NULL,
        section TEXT,
        citation TEXT,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        keywords TEXT[] DEFAULT '{}',
        practical_application TEXT,
        exam_tips TEXT,
        court TEXT,
        year INTEGER,
        importance INTEGER DEFAULT 2 CHECK (importance BETWEEN 1 AND 3),
        is_verified BOOLEAN DEFAULT false,
        embedding vector(1536),
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL
      )
    `;
    console.log('✓ knowledge_base table created (or already exists)');
  } catch (error: any) {
    console.error('knowledge_base table:', error.message);
  }

  // 7. Create vector indexes (IVFFlat for approximate NN)
  // NOTE: IVFFlat requires data to exist. For empty tables, use HNSW instead or create after seeding.
  // We'll use HNSW which doesn't require training data.
  const indexes = [
    {
      name: 'idx_micro_skills_embedding',
      sql_text: `CREATE INDEX IF NOT EXISTS idx_micro_skills_embedding ON micro_skills USING hnsw (embedding vector_cosine_ops)`,
    },
    {
      name: 'idx_items_embedding',
      sql_text: `CREATE INDEX IF NOT EXISTS idx_items_embedding ON items USING hnsw (embedding vector_cosine_ops)`,
    },
    {
      name: 'idx_lecture_chunks_embedding',
      sql_text: `CREATE INDEX IF NOT EXISTS idx_lecture_chunks_embedding ON lecture_chunks USING hnsw (embedding vector_cosine_ops)`,
    },
    {
      name: 'idx_knowledge_base_embedding',
      sql_text: `CREATE INDEX IF NOT EXISTS idx_knowledge_base_embedding ON knowledge_base USING hnsw (embedding vector_cosine_ops)`,
    },
  ];

  for (const idx of indexes) {
    try {
      await sql(idx.sql_text as unknown as TemplateStringsArray);
      console.log(`✓ Index ${idx.name} created`);
    } catch (error: any) {
      console.error(`Index ${idx.name}: ${error.message}`);
    }
  }

  // 8. Create support indexes on knowledge_base
  try {
    await sql`CREATE INDEX IF NOT EXISTS idx_knowledge_base_unit ON knowledge_base(unit_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_knowledge_base_type ON knowledge_base(entry_type)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_knowledge_base_unit_type ON knowledge_base(unit_id, entry_type)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_knowledge_base_fts ON knowledge_base USING gin(to_tsvector('english', title || ' ' || content))`;
    console.log('✓ Knowledge base support indexes created');
  } catch (error: any) {
    console.error('Support indexes:', error.message);
  }

  // 9. Verify
  console.log('\n=== Verification ===');

  const extVerify = await sql`SELECT extname, extversion FROM pg_extension WHERE extname = 'vector'`;
  console.log(`pgvector: ${extVerify.length > 0 ? `v${extVerify[0].extversion}` : 'NOT INSTALLED'}`);

  const tables = ['micro_skills', 'items', 'lecture_chunks', 'knowledge_base'];
  for (const table of tables) {
    try {
      const cols = await sql`
        SELECT column_name, udt_name FROM information_schema.columns 
        WHERE table_name = ${table} AND column_name = 'embedding'
      `;
      if (cols.length > 0) {
        console.log(`${table}.embedding: ${cols[0].udt_name}`);
      } else {
        console.log(`${table}.embedding: MISSING`);
      }
    } catch {}
  }

  const idxCount = await sql`
    SELECT COUNT(*) as cnt FROM pg_indexes 
    WHERE indexname LIKE 'idx_%_embedding' OR indexname LIKE 'idx_knowledge_base_%'
  `;
  console.log(`Vector + support indexes: ${idxCount[0]?.cnt || 0}`);

  console.log('\n✅ pgvector migration complete!');
}

main().catch(console.error);
