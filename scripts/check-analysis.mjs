import pg from 'pg';
const c = new pg.Client({
  connectionString: 'postgresql://neondb_owner:npg_RhqJkmu07srt@ep-delicate-resonance-ai973vek-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require',
  ssl: { rejectUnauthorized: false }
});
await c.connect();
const r = await c.query("SELECT report FROM past_paper_analysis_cache WHERE cache_key = 'global'");
if (r.rows.length > 0) {
  const report = r.rows[0].report;
  console.log('Keys:', Object.keys(report));
  console.log('Preview:', JSON.stringify(report).slice(0, 500));
} else {
  console.log('No cached report found');
}
await c.end();
