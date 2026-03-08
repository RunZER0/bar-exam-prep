import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';
dotenv.config();

const sql = neon(process.env.DATABASE_URL!);

async function main() {
  // 1. What's in knowledge_base?
  const kb = await sql`
    SELECT id, title, source_type, unit_id, chunk_index, category, 
      LENGTH(content)::int as content_len, 
      CASE WHEN embedding IS NOT NULL THEN 'yes' ELSE 'no' END as has_embedding
    FROM knowledge_base 
    ORDER BY unit_id, title 
    LIMIT 40
  `;
  
  console.log('=== KNOWLEDGE_BASE (33 rows) ===');
  for (const r of kb) {
    console.log(`[${r.unit_id || 'no-unit'}] ${r.source_type || 'unknown'} | "${r.title}" | chunk#${r.chunk_index} | ${r.content_len} chars | emb:${r.has_embedding}`);
  }

  // 2. Check Supabase references in the codebase — what tables/buckets are used
  console.log('\n=== KNOWLEDGE_BASE CATEGORIES ===');
  const cats = await sql`SELECT DISTINCT category, source_type, COUNT(*)::int as cnt FROM knowledge_base GROUP BY category, source_type ORDER BY category`;
  for (const c of cats) {
    console.log(`  ${c.category || 'null'} (${c.source_type || 'null'}): ${c.cnt} rows`);
  }

  // 3. Check if there's a separate case law or statutes table
  console.log('\n=== ALL TABLES IN PUBLIC SCHEMA ===');
  const tables = await sql`
    SELECT table_name, 
      (SELECT reltuples::bigint FROM pg_class WHERE relname = table_name) as est_rows
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    ORDER BY table_name
  `;
  for (const t of tables) {
    console.log(`  ${t.table_name}: ~${t.est_rows} rows`);
  }
}

main().catch(e => console.error('Error:', e.message));
