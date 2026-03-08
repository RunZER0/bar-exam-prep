/**
 * Migrate all cases and statutes from Supabase → Neon.
 * 
 * Supabase REST API returns max 1000 rows per request, so we paginate.
 * Neon inserts are done in batches of 500 via raw SQL.
 *
 * Usage: npx tsx scripts/migrate-supabase-to-neon.ts
 */
import * as dotenv from 'dotenv';
dotenv.config();

import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY!;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_ANON_KEY');
  process.exit(1);
}

const SB_HEADERS = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json',
};

const BATCH_SIZE = 500;   // rows per Neon INSERT
const PAGE_SIZE = 1000;   // rows per Supabase fetch (API max)

/* ----------------------------------------------------------------
   Fetch paginated data from Supabase
   ---------------------------------------------------------------- */
async function fetchAllPages(table: string, select: string): Promise<any[]> {
  const all: any[] = [];
  let offset = 0;

  while (true) {
    const url = `${SUPABASE_URL}/rest/v1/${table}?select=${select}&limit=${PAGE_SIZE}&offset=${offset}&order=id`;
    const res = await fetch(url, { headers: SB_HEADERS, signal: AbortSignal.timeout(30000) });
    if (!res.ok) {
      console.error(`Fetch error at offset ${offset}: ${res.status} ${res.statusText}`);
      break;
    }
    const page = await res.json();
    if (!Array.isArray(page) || page.length === 0) break;
    all.push(...page);
    process.stdout.write(`\r  Fetched ${all.length} ${table} rows...`);
    offset += PAGE_SIZE;
    if (page.length < PAGE_SIZE) break; // last page
  }
  console.log(`\r  Fetched ${all.length} ${table} rows total.        `);
  return all;
}

/* ----------------------------------------------------------------
   Insert cases into Neon in batches
   ---------------------------------------------------------------- */
async function insertCases(cases: any[]) {
  let inserted = 0;
  for (let i = 0; i < cases.length; i += BATCH_SIZE) {
    const batch = cases.slice(i, i + BATCH_SIZE);

    // Build VALUES clause
    const values = batch.map(c => {
      const esc = (v: any) => v == null ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`;
      return `(${esc(c.title)}, ${esc(c.parties)}, ${esc(c.case_number)}, ${esc(c.citation)}, ${esc(c.court_code)}, ${c.year ?? 'NULL'}, ${esc(c.judgment_date)}, ${esc(c.doc_type)}, ${esc(c.topics)}, ${esc(c.url)})`;
    }).join(',\n');

    await sql.query(
      `INSERT INTO cases (title, parties, case_number, citation, court_code, year, judgment_date, doc_type, topics, url)
       VALUES ${values}
       ON CONFLICT DO NOTHING`,
      []
    );

    inserted += batch.length;
    process.stdout.write(`\r  Inserted ${inserted}/${cases.length} cases...`);
  }
  console.log(`\r  Inserted ${inserted} cases total.              `);
}

/* ----------------------------------------------------------------
   Insert statutes into Neon in batches
   ---------------------------------------------------------------- */
async function insertStatutes(statutes: any[]) {
  let inserted = 0;
  for (let i = 0; i < statutes.length; i += BATCH_SIZE) {
    const batch = statutes.slice(i, i + BATCH_SIZE);

    const values = batch.map(s => {
      const esc = (v: any) => v == null ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`;
      return `(${esc(s.name)}, ${esc(s.chapter)}, ${esc(s.url)}, ${esc(s.full_text)})`;
    }).join(',\n');

    await sql.query(
      `INSERT INTO statutes (name, chapter, url, full_text)
       VALUES ${values}
       ON CONFLICT DO NOTHING`,
      []
    );

    inserted += batch.length;
    process.stdout.write(`\r  Inserted ${inserted}/${statutes.length} statutes...`);
  }
  console.log(`\r  Inserted ${inserted} statutes total.           `);
}

/* ----------------------------------------------------------------
   Main
   ---------------------------------------------------------------- */
async function main() {
  const startTime = Date.now();
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║  Supabase → Neon Migration                  ║');
  console.log('╚══════════════════════════════════════════════╝\n');

  // Step 1: Check current Neon state
  const [caseCount] = await sql`SELECT count(*) as n FROM cases`;
  const [statCount] = await sql`SELECT count(*) as n FROM statutes`;
  console.log(`Current Neon state: ${caseCount.n} cases, ${statCount.n} statutes`);

  if (Number(caseCount.n) > 0 || Number(statCount.n) > 0) {
    console.log('⚠ Tables already have data. Truncating first...');
    await sql`TRUNCATE cases RESTART IDENTITY`;
    await sql`TRUNCATE statutes RESTART IDENTITY`;
    console.log('✓ Tables truncated');
  }

  // Step 2: Fetch all cases from Supabase
  console.log('\n📦 Fetching cases from Supabase...');
  const cases = await fetchAllPages('cases', 'title,parties,case_number,citation,court_code,year,judgment_date,doc_type,topics,url');

  // Step 3: Insert cases into Neon
  console.log('💾 Inserting cases into Neon...');
  await insertCases(cases);

  // Step 4: Fetch all statutes from Supabase
  console.log('\n📦 Fetching statutes from Supabase...');
  const statutes = await fetchAllPages('statutes', 'name,chapter,url,full_text');

  // Step 5: Insert statutes into Neon
  console.log('💾 Inserting statutes into Neon...');
  await insertStatutes(statutes);

  // Step 6: Verify
  const [finalCases] = await sql`SELECT count(*) as n FROM cases`;
  const [finalStats] = await sql`SELECT count(*) as n FROM statutes`;

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n╔══════════════════════════════════════════════╗`);
  console.log(`║  Migration Complete! (${elapsed}s)               `);
  console.log(`║  Cases:    ${finalCases.n} rows                  `);
  console.log(`║  Statutes: ${finalStats.n} rows                  `);
  console.log(`╚══════════════════════════════════════════════╝`);

  // Court distribution
  const courtDist = await sql`SELECT court_code, count(*) as n FROM cases GROUP BY court_code ORDER BY n DESC LIMIT 10`;
  console.log('\nCourt distribution in Neon:');
  for (const row of courtDist) {
    console.log(`  ${row.court_code}: ${row.n}`);
  }
}

main().catch(e => {
  console.error('Migration failed:', e);
  process.exit(1);
});
