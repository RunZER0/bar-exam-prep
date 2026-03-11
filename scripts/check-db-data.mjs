import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const sql = neon(process.env.DATABASE_URL);

const statsSample = await sql`SELECT id, name, chapter, url, length(full_text) as text_len FROM statutes ORDER BY id LIMIT 5`;
console.log('=== STATUTES SAMPLE ===');
console.log(JSON.stringify(statsSample, null, 2));

const statsCount = await sql`SELECT COUNT(*) as total, COUNT(full_text) as with_text, COUNT(url) as with_url FROM statutes`;
console.log('\n=== STATUTES COUNT ===');
console.log(JSON.stringify(statsCount, null, 2));

const casesSample = await sql`SELECT id, title, citation, url, court_code, year FROM cases ORDER BY id LIMIT 5`;
console.log('\n=== CASES SAMPLE ===');
console.log(JSON.stringify(casesSample, null, 2));

const casesCount = await sql`SELECT COUNT(*) as total, COUNT(url) as with_url FROM cases`;
console.log('\n=== CASES COUNT ===');
console.log(JSON.stringify(casesCount, null, 2));

// Check a known statute
const testStatute = await sql`SELECT name, chapter, url, length(full_text) as text_len FROM statutes WHERE name ILIKE '%Companies Act%' LIMIT 3`;
console.log('\n=== COMPANIES ACT LOOKUP ===');
console.log(JSON.stringify(testStatute, null, 2));

// Check a known case
const testCase = await sql`SELECT title, citation, url FROM cases WHERE title ILIKE '%Mwaura%' OR title ILIKE '%Republic%' LIMIT 3`;
console.log('\n=== CASE LOOKUP ===');
console.log(JSON.stringify(testCase, null, 2));

// Check URL format examples
const urlSamples = await sql`SELECT url FROM cases WHERE url IS NOT NULL LIMIT 3`;
console.log('\n=== CASE URL SAMPLES ===');
console.log(JSON.stringify(urlSamples, null, 2));

const statUrlSamples = await sql`SELECT url FROM statutes WHERE url IS NOT NULL LIMIT 3`;
console.log('\n=== STATUTE URL SAMPLES ===');
console.log(JSON.stringify(statUrlSamples, null, 2));
