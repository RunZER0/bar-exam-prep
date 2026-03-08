/**
 * Discover how many cases and statutes exist in Supabase
 * before running the full migration to Neon.
 */
import * as dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_ANON_KEY');
  process.exit(1);
}

const headers = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json',
  Prefer: 'count=exact',
};

async function main() {
  console.log('=== Supabase Discovery ===\n');

  // Count cases
  const casesRes = await fetch(
    `${SUPABASE_URL}/rest/v1/cases?select=id&limit=0`,
    { headers: { ...headers, Range: '0-0' } }
  );
  const casesCount = casesRes.headers.get('content-range');
  console.log(`Cases table: ${casesCount}`);

  // Count statutes  
  const statutesRes = await fetch(
    `${SUPABASE_URL}/rest/v1/statutes?select=id&limit=0`,
    { headers: { ...headers, Range: '0-0' } }
  );
  const statutesCount = statutesRes.headers.get('content-range');
  console.log(`Statutes table: ${statutesCount}`);

  // Sample 3 cases
  const sampleCasesRes = await fetch(
    `${SUPABASE_URL}/rest/v1/cases?select=*&limit=3&order=year.desc`,
    { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
  );
  const sampleCases = await sampleCasesRes.json();
  console.log('\n--- Sample Cases ---');
  console.log('Columns:', Object.keys(sampleCases[0] || {}));
  for (const c of sampleCases) {
    console.log(`  [${c.year}] ${c.title?.slice(0, 80)} | court=${c.court_code} | url=${c.url?.slice(0, 60)}`);
  }

  // Sample 3 statutes
  const sampleStatutesRes = await fetch(
    `${SUPABASE_URL}/rest/v1/statutes?select=id,name,chapter,url&limit=3`,
    { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
  );
  const sampleStatutes = await sampleStatutesRes.json();
  console.log('\n--- Sample Statutes ---');
  if (Array.isArray(sampleStatutes)) {
    console.log('Columns:', Object.keys(sampleStatutes[0] || {}));
    for (const s of sampleStatutes) {
      console.log(`  ${s.name} | ch=${s.chapter} | url=${s.url?.slice(0, 60)}`);
    }
  } else {
    console.log('Statutes response:', JSON.stringify(sampleStatutes).slice(0, 500));
  }

  // Check what columns the statutes table has
  const statuteFullRes = await fetch(
    `${SUPABASE_URL}/rest/v1/statutes?select=*&limit=1`,
    { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
  );
  const statuteFull = await statuteFullRes.json();
  if (Array.isArray(statuteFull) && statuteFull.length > 0) {
    console.log('\nStatute columns:', Object.keys(statuteFull[0]));
    const s = statuteFull[0];
    console.log(`full_text length: ${s.full_text?.length || 0}`);
  }

  // Get all statute names to understand the range
  const allStatutesRes = await fetch(
    `${SUPABASE_URL}/rest/v1/statutes?select=name,chapter&limit=500`,
    { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
  );
  const allStatutes = await allStatutesRes.json();
  console.log(`\n--- All ${allStatutes.length} Statute Names ---`);
  for (const s of allStatutes) {
    console.log(`  ${s.name} (${s.chapter})`);
  }

  // Get court code distribution for cases
  const courtDistRes = await fetch(
    `${SUPABASE_URL}/rest/v1/cases?select=court_code&limit=5000`,
    { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
  );
  const allCaseCourts = await courtDistRes.json();
  const courtDist: Record<string, number> = {};
  for (const c of allCaseCourts) {
    courtDist[c.court_code] = (courtDist[c.court_code] || 0) + 1;
  }
  console.log('\n--- Cases by Court Code ---');
  for (const [court, count] of Object.entries(courtDist).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${court}: ${count}`);
  }
}

main().catch(console.error);
