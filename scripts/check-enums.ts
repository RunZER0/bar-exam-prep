import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';
dotenv.config();

async function main() {
  const sql = neon(process.env.DATABASE_URL!);
  
  // Check difficulty_level enum
  const diffVals = await sql`SELECT unnest(enum_range(NULL::difficulty_level)) as val`;
  console.log('difficulty_level values:', diffVals.map(r => r.val));
  
  // Check format_tag enum
  const fmtVals = await sql`SELECT unnest(enum_range(NULL::format_tag)) as val`;
  console.log('format_tag values:', fmtVals.map(r => r.val));
  
  // Check item_type enum
  const itemVals = await sql`SELECT unnest(enum_range(NULL::item_type)) as val`;
  console.log('item_type values:', itemVals.map(r => r.val));
  
  // Check micro_skills columns
  const cols = await sql`SELECT column_name, data_type, udt_name FROM information_schema.columns WHERE table_name = 'micro_skills' ORDER BY ordinal_position`;
  console.log('\nmicro_skills columns:', cols.map(r => `${r.column_name} (${r.udt_name})`));
  
  // Check existing data
  const skillCount = await sql`SELECT COUNT(*) as c FROM micro_skills`;
  console.log('\nExisting micro_skills count:', skillCount[0].c);
  
  const domainCount = await sql`SELECT COUNT(*) as c FROM domains`;
  console.log('Existing domains count:', domainCount[0].c);
  
  process.exit(0);
}
main().catch(e => { console.error(e.message); process.exit(1); });
