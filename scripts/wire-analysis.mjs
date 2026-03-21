/**
 * Wire ChatGPT analysis into the database cache.
 * 
 * USAGE:
 *   node scripts/wire-analysis.mjs <path-to-json-file>
 * 
 * The JSON file should be the raw output from ChatGPT — the analysis report object.
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { neon } from '@neondatabase/serverless';

const DB_URL = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_RhqJkmu07srt@ep-delicate-resonance-ai973vek-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require';

const filePath = process.argv[2];
if (!filePath) {
  console.error('Usage: node scripts/wire-analysis.mjs <path-to-analysis.json>');
  process.exit(1);
}

const fullPath = resolve(filePath);
console.log(`Reading analysis from: ${fullPath}`);

let report;
try {
  const raw = readFileSync(fullPath, 'utf-8');
  report = JSON.parse(raw);
} catch (err) {
  console.error(`Failed to read/parse file: ${err.message}`);
  process.exit(1);
}

// Validate required sections
const required = ['summary', 'topicAnalysis', 'yearOverYearTrends', 'predictiveInsights', 'studentGuidance'];
const missing = required.filter(k => !report[k]);
if (missing.length > 0) {
  console.error(`Missing required sections: ${missing.join(', ')}`);
  process.exit(1);
}

const sql = neon(DB_URL);

// Get paper/question counts
const [{ cnt: paperCount }] = await sql`SELECT count(*)::int as cnt FROM past_papers`;
const [{ cnt: questionCount }] = await sql`SELECT count(*)::int as cnt FROM past_paper_questions`;

// Delete existing and insert
await sql`DELETE FROM past_paper_analysis_cache WHERE cache_key = 'global'`;
await sql`INSERT INTO past_paper_analysis_cache (id, cache_key, report, paper_count, question_count, generated_at, model_used)
   VALUES (gen_random_uuid(), 'global', ${JSON.stringify(report)}::jsonb, ${paperCount}, ${questionCount}, NOW(), 'chatgpt-manual')`;

console.log(`\nDone! Analysis cached.`);
console.log(`  Papers: ${paperCount}`);
console.log(`  Questions: ${questionCount}`);
console.log(`  Sections: ${Object.keys(report).join(', ')}`);
