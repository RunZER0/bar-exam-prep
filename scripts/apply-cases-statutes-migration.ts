/**
 * Apply the cases + statutes migration to Neon.
 * Creates the tables and indexes needed for the Supabase → Neon migration.
 */
import * as dotenv from 'dotenv';
dotenv.config();

import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

async function main() {
  console.log('Applying cases/statutes migration...\n');

  // Enable pg_trgm extension for trigram indexes
  await sql`CREATE EXTENSION IF NOT EXISTS pg_trgm`;
  console.log('✓ pg_trgm extension enabled');

  // Create cases table
  await sql`
    CREATE TABLE IF NOT EXISTS cases (
      id SERIAL PRIMARY KEY,
      title TEXT,
      parties TEXT,
      case_number TEXT,
      citation TEXT,
      court_code TEXT,
      year INTEGER,
      judgment_date TEXT,
      doc_type TEXT,
      topics TEXT,
      url TEXT,
      scraped_at TIMESTAMP DEFAULT NOW()
    )
  `;
  console.log('✓ cases table created');

  // Create statutes table
  await sql`
    CREATE TABLE IF NOT EXISTS statutes (
      id SERIAL PRIMARY KEY,
      name TEXT,
      chapter TEXT,
      url TEXT,
      full_text TEXT,
      scraped_at TIMESTAMP DEFAULT NOW()
    )
  `;
  console.log('✓ statutes table created');

  // Create indexes for cases
  await sql`CREATE INDEX IF NOT EXISTS idx_cases_title_trgm ON cases USING gin (title gin_trgm_ops)`;
  console.log('✓ idx_cases_title_trgm');
  await sql`CREATE INDEX IF NOT EXISTS idx_cases_parties_trgm ON cases USING gin (parties gin_trgm_ops)`;
  console.log('✓ idx_cases_parties_trgm');
  await sql`CREATE INDEX IF NOT EXISTS idx_cases_citation_trgm ON cases USING gin (citation gin_trgm_ops)`;
  console.log('✓ idx_cases_citation_trgm');
  await sql`CREATE INDEX IF NOT EXISTS idx_cases_court_code ON cases (court_code)`;
  console.log('✓ idx_cases_court_code');
  await sql`CREATE INDEX IF NOT EXISTS idx_cases_year ON cases (year DESC NULLS LAST)`;
  console.log('✓ idx_cases_year');
  await sql`CREATE INDEX IF NOT EXISTS idx_cases_court_year ON cases (court_code, year DESC NULLS LAST)`;
  console.log('✓ idx_cases_court_year');

  // Create indexes for statutes
  await sql`CREATE INDEX IF NOT EXISTS idx_statutes_name_trgm ON statutes USING gin (name gin_trgm_ops)`;
  console.log('✓ idx_statutes_name_trgm');

  // Full-text search on cases
  await sql`CREATE INDEX IF NOT EXISTS idx_cases_fts ON cases USING gin (to_tsvector('english', COALESCE(title, '') || ' ' || COALESCE(parties, '')))`;
  console.log('✓ idx_cases_fts');

  // Verify
  const tables = await sql`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name IN ('cases', 'statutes')
    ORDER BY table_name
  `;
  console.log(`\n✓ Done! Tables: ${tables.map((t: any) => t.table_name).join(', ')}`);
}

main().catch(console.error);
