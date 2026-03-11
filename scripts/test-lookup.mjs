import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const sql = neon(process.env.DATABASE_URL);

// Check if parties column has data
const partiesCheck = await sql`SELECT COUNT(*) as total, COUNT(parties) as with_parties FROM cases`;
console.log('=== PARTIES DATA CHECK ===');
console.log(JSON.stringify(partiesCheck, null, 2));

// Test case lookup with typical citation pattern
const testName = 'Raila';
const searchPattern = `%${testName}%`;
const caseResult = await sql`
    SELECT title, citation, url, court_code, year
    FROM cases
    WHERE title ILIKE ${searchPattern}
       OR parties ILIKE ${searchPattern}
       OR citation ILIKE ${searchPattern}
    ORDER BY year DESC NULLS LAST
    LIMIT 3
`;
console.log('\n=== CASE LOOKUP: "Raila" ===');
console.log(JSON.stringify(caseResult, null, 2));

// Test statute lookup  
const statTest = '%Civil Procedure%';
const statResult = await sql`
    SELECT name, chapter, url, length(full_text) as text_len
    FROM statutes
    WHERE name ILIKE ${statTest}
    ORDER BY name
    LIMIT 5
`;
console.log('\n=== STATUTE LOOKUP: "Civil Procedure" ===');
console.log(JSON.stringify(statResult, null, 2));

// Check statutes with full_text
const withText = await sql`SELECT name, chapter, url, length(full_text) as text_len FROM statutes WHERE full_text IS NOT NULL ORDER BY text_len DESC LIMIT 10`;
console.log('\n=== STATUTES WITH FULL_TEXT (top 10 by size) ===');
console.log(JSON.stringify(withText, null, 2));

// Check case with typical study-notes pattern
const studyCase = 'Muigai';
const sp2 = `%${studyCase}%`;
const caseResult2 = await sql`
    SELECT title, citation, url
    FROM cases
    WHERE title ILIKE ${sp2}
       OR parties ILIKE ${sp2}
       OR citation ILIKE ${sp2}
    ORDER BY year DESC NULLS LAST
    LIMIT 3
`;
console.log('\n=== CASE LOOKUP: "Muigai" ===');
console.log(JSON.stringify(caseResult2, null, 2));

// Check what columns the cases table actually has
const caseCols = await sql`
    SELECT column_name, data_type FROM information_schema.columns 
    WHERE table_name = 'cases' ORDER BY ordinal_position
`;
console.log('\n=== CASES TABLE COLUMNS ===');
console.log(JSON.stringify(caseCols, null, 2));
