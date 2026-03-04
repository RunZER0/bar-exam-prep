import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';
dotenv.config();

const sql = neon(process.env.DATABASE_URL!);

async function main() {
  const counts = await Promise.all([
    sql`SELECT COUNT(*)::int as c FROM syllabus_nodes`,
    sql`SELECT COUNT(*)::int as c FROM micro_skills`,
    sql`SELECT COUNT(*)::int as c FROM items`,
    sql`SELECT COUNT(*)::int as c FROM knowledge_base`,
    sql`SELECT COUNT(*)::int as c FROM knowledge_base WHERE embedding IS NOT NULL`,
    sql`SELECT COUNT(*)::int as c FROM micro_skills WHERE embedding IS NOT NULL`,
    sql`SELECT COUNT(*)::int as c FROM users`,
  ]);
  
  console.log('=== PRODUCTION DB STATUS ===');
  console.log('syllabus_nodes:', counts[0][0].c);
  console.log('micro_skills:', counts[1][0].c);
  console.log('items:', counts[2][0].c);
  console.log('knowledge_base:', counts[3][0].c);
  console.log('KB with embeddings:', counts[4][0].c);
  console.log('skills with embeddings:', counts[5][0].c);
  console.log('users:', counts[6][0].c);
  
  if (counts[0][0].c > 0) {
    const units = await sql`SELECT DISTINCT unit_code FROM syllabus_nodes ORDER BY unit_code`;
    console.log('syllabus units:', units.map((r: any) => r.unit_code).join(', '));
  } else {
    console.log('*** SYLLABUS NOT SEEDED ***');
  }
  
  if (counts[4][0].c === 0 && counts[3][0].c > 0) {
    console.log('*** EMBEDDINGS NOT GENERATED (knowledge_base has rows but no vectors) ***');
  }
  if (counts[5][0].c === 0 && counts[1][0].c > 0) {
    console.log('*** SKILL EMBEDDINGS NOT GENERATED ***');
  }
}

main().catch(e => console.error('Error:', e.message));
