#!/usr/bin/env node
/**
 * Run pending SQL migrations against the production database.
 * Uses raw SQL files from drizzle/ directory.
 * Each migration uses IF NOT EXISTS / IF EXISTS so they're idempotent.
 * 
 * Usage: node scripts/run-migrations.mjs
 * Requires: DATABASE_URL environment variable
 */

import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DRIZZLE_DIR = path.join(__dirname, '..', 'drizzle');

// Only migrations that need to be applied (0000-0007 are already in production).
// All these use IF NOT EXISTS / ADD COLUMN IF NOT EXISTS, so re-running is safe.
const MIGRATIONS = [
  '0008_pricing_tiers.sql',
  '0009_custom_packages.sql',
  '0010_skill_node_map.sql',
];

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('ERROR: DATABASE_URL not set');
    process.exit(1);
  }

  const client = new pg.Client({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } });
  
  try {
    await client.connect();
    console.log('[migrations] Connected to database');

    for (const migrationFile of MIGRATIONS) {
      const filePath = path.join(DRIZZLE_DIR, migrationFile);
      
      if (!fs.existsSync(filePath)) {
        console.log(`[migrations] Skipping ${migrationFile} (file not found)`);
        continue;
      }

      const sql = fs.readFileSync(filePath, 'utf-8').trim();
      if (!sql) {
        console.log(`[migrations] Skipping ${migrationFile} (empty)`);
        continue;
      }

      try {
        await client.query(sql);
        console.log(`[migrations] ✅ Applied: ${migrationFile}`);
      } catch (err) {
        // Most errors are "already exists" which is fine (idempotent migrations use IF NOT EXISTS)
        const msg = err.message || '';
        if (msg.includes('already exists') || msg.includes('duplicate')) {
          console.log(`[migrations] ⏭️  Skipped: ${migrationFile} (already applied)`);
        } else {
          console.error(`[migrations] ⚠️  Error in ${migrationFile}: ${msg}`);
          // Don't exit — try remaining migrations
        }
      }
    }

    console.log('[migrations] Done');
  } catch (err) {
    console.error('[migrations] Connection error:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
