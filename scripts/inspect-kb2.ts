import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';
dotenv.config();

const sql = neon(process.env.DATABASE_URL!);

async function main() {
  // 1. What's in knowledge_base?
  const kb = await sql`
    SELECT id, title, entry_type, unit_id, source, section, citation, court, year, importance,
      LENGTH(content)::int as content_len, 
      CASE WHEN embedding IS NOT NULL THEN 'yes' ELSE 'no' END as has_embedding
    FROM knowledge_base ORDER BY unit_id, title LIMIT 40
  `;
  
  console.log('=== KNOWLEDGE_BASE (33 rows) ===');
  for (const r of kb) {
    console.log(`[${r.unit_id}] ${r.entry_type} | "${r.title}" | src: ${r.source} | ${r.content_len} chars | year:${r.year||'-'} | emb:${r.has_embedding}`);
  }

  // 2. Group by entry_type and unit_id
  console.log('\n=== BY TYPE ===');
  const types = await sql`SELECT entry_type, COUNT(*)::int as cnt FROM knowledge_base GROUP BY entry_type ORDER BY cnt DESC`;
  for (const t of types) console.log(`  ${t.entry_type}: ${t.cnt}`);

  console.log('\n=== BY UNIT ===');
  const units = await sql`SELECT unit_id, COUNT(*)::int as cnt FROM knowledge_base GROUP BY unit_id ORDER BY unit_id`;
  for (const u of units) console.log(`  ${u.unit_id}: ${u.cnt}`);

  // 3. authorities table (from mastery schema)
  console.log('\n=== AUTHORITIES TABLE ===');
  const authCount = await sql`SELECT COUNT(*)::int as cnt FROM authorities`;
  console.log(`Total authorities: ${authCount[0].cnt}`);
  if (authCount[0].cnt > 0) {
    const samples = await sql`SELECT id, name, authority_type, citation, unit_id FROM authorities LIMIT 10`;
    for (const a of samples) console.log(`  [${a.unit_id}] ${a.authority_type}: ${a.name} | ${a.citation || 'no cite'}`);
  }

  // 4. rag_knowledge_entries table
  console.log('\n=== RAG_KNOWLEDGE_ENTRIES TABLE ===');
  try {
    const ragCount = await sql`SELECT COUNT(*)::int as cnt FROM rag_knowledge_entries`;
    console.log(`Total rag_knowledge_entries: ${ragCount[0].cnt}`);
  } catch { console.log('Table does not exist or is empty'); }

  // 5. All tables
  console.log('\n=== ALL TABLES ===');
  const tables = await sql`SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`;
  console.log(tables.map((t: any) => t.tablename).join(', '));
}

main().catch(e => console.error('Error:', e.message));
