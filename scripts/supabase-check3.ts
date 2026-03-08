import * as dotenv from 'dotenv';
dotenv.config();

const SU = process.env.SUPABASE_URL!;
const SK = process.env.SUPABASE_ANON_KEY!;
const h: Record<string, string> = { apikey: SK, Authorization: `Bearer ${SK}`, Prefer: 'count=exact' };

async function go() {
  console.log('=== Court Code Distribution ===');
  for (const cc of ['SC', 'CA', 'KESC', 'KECA', 'KEHC', 'KEELRC', 'KEBPRT']) {
    const r = await fetch(`${SU}/rest/v1/cases?court_code=eq.${cc}&select=id&limit=0`, { headers: { ...h, Range: '0-0' } });
    console.log(`  ${cc}: ${r.headers.get('content-range')}`);
  }

  console.log('\n=== Statutes full_text ===');
  const r2 = await fetch(`${SU}/rest/v1/statutes?full_text=not.is.null&select=id&limit=0`, { headers: { ...h, Range: '0-0' } });
  console.log(`  With full_text (not null): ${r2.headers.get('content-range')}`);

  // Get a few statutes with actual full_text content (length > 0)
  const r4 = await fetch(`${SU}/rest/v1/statutes?select=name,url&full_text=not.is.null&limit=10&order=name`, { headers: { apikey: SK, Authorization: `Bearer ${SK}` } });
  const withText = await r4.json();
  console.log(`\n  Sample statutes with full_text:`);
  for (const s of withText) {
    console.log(`    ${s.name} → ${s.url?.slice(0, 60)}`);
  }

  // Check total cases with a valid URL
  const r5 = await fetch(`${SU}/rest/v1/cases?url=not.is.null&select=id&limit=0`, { headers: { ...h, Range: '0-0' } });
  console.log(`\n  Cases with URL: ${r5.headers.get('content-range')}`);
}

go().catch(console.error);
