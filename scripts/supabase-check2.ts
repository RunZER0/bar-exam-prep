/**
 * Quick check: how many statutes have non-empty full_text?
 */
import * as dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY!;
const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` };

async function main() {
  // Check a few statutes with full_text
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/statutes?select=name,full_text&full_text=not.is.null&full_text=neq.&limit=5&order=name`,
    { headers }
  );
  const data = await res.json();
  console.log(`Statutes with non-empty full_text: found ${data.length} in sample`);
  for (const s of (data as any[]).slice(0, 3)) {
    console.log(`  ${s.name}: ${s.full_text?.length || 0} chars`);
  }

  // Count court code distribution for cases (fetch more)
  const res2 = await fetch(
    `${SUPABASE_URL}/rest/v1/cases?select=court_code&limit=10000`,
    { headers, signal: AbortSignal.timeout(30000) }
  );
  const cases = await res2.json();
  const dist: Record<string, number> = {};
  for (const c of cases) {
    dist[c.court_code] = (dist[c.court_code] || 0) + 1;
  }
  console.log('\nCourt code distribution (from 10K sample):');
  for (const [k, v] of Object.entries(dist).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k}: ${v}`);
  }
}

main().catch(console.error);
