#!/usr/bin/env node
/**
 * Run pending SQL migrations against the production database.
 * SQL is embedded inline because drizzle/ is gitignored.
 * Each migration uses IF NOT EXISTS / IF EXISTS so they're idempotent.
 * 
 * Usage: node scripts/run-migrations.mjs
 * Requires: DATABASE_URL environment variable
 */

import pg from 'pg';

// Only migrations that need to be applied (0000-0007 are already in production).
// All these use IF NOT EXISTS / ADD COLUMN IF NOT EXISTS, so re-running is safe.
// SQL is embedded directly so we don't depend on the gitignored drizzle/ directory.
const MIGRATIONS = [
  {
    name: '0008_pricing_tiers.sql',
    sql: `
ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_tier TEXT DEFAULT 'free_trial' NOT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS billing_period TEXT DEFAULT 'monthly';

UPDATE users
SET subscription_tier = 'light'
WHERE subscription_plan IN ('weekly', 'monthly', 'annual')
  AND subscription_status IN ('active', 'trialing');

CREATE TABLE IF NOT EXISTS feature_usage (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  feature TEXT NOT NULL,
  week_start TIMESTAMP NOT NULL,
  usage_count INTEGER DEFAULT 0 NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
  UNIQUE(user_id, feature, week_start)
);

CREATE INDEX IF NOT EXISTS idx_feature_usage_user_week
  ON feature_usage(user_id, week_start);
CREATE INDEX IF NOT EXISTS idx_feature_usage_user_feature_week
  ON feature_usage(user_id, feature, week_start);

CREATE TABLE IF NOT EXISTS addon_passes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  feature TEXT NOT NULL,
  quantity INTEGER DEFAULT 1 NOT NULL,
  remaining INTEGER DEFAULT 1 NOT NULL,
  paystack_reference TEXT,
  price INTEGER NOT NULL,
  purchased_at TIMESTAMP DEFAULT NOW() NOT NULL,
  expires_at TIMESTAMP,
  CONSTRAINT addon_remaining_check CHECK (remaining >= 0)
);

CREATE INDEX IF NOT EXISTS idx_addon_passes_user
  ON addon_passes(user_id, feature);
CREATE INDEX IF NOT EXISTS idx_addon_passes_remaining
  ON addon_passes(user_id, feature, remaining) WHERE remaining > 0;
    `
  },
  {
    name: '0009_custom_packages.sql',
    sql: `
ALTER TABLE users ADD COLUMN IF NOT EXISTS custom_features TEXT DEFAULT NULL;
COMMENT ON COLUMN users.custom_features IS 'JSON array of PremiumFeature keys for custom-tier users';
    `
  },
  {
    name: '0010_skill_node_map.sql',
    sql: `
CREATE TABLE IF NOT EXISTS skill_node_map (
  skill_id UUID NOT NULL REFERENCES micro_skills(id) ON DELETE CASCADE,
  node_id UUID NOT NULL REFERENCES syllabus_nodes(id) ON DELETE CASCADE,
  confidence REAL NOT NULL DEFAULT 1.0,
  source TEXT NOT NULL DEFAULT 'ai',
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  PRIMARY KEY (skill_id, node_id)
);

CREATE INDEX IF NOT EXISTS idx_skill_node_map_skill ON skill_node_map(skill_id);
CREATE INDEX IF NOT EXISTS idx_skill_node_map_node ON skill_node_map(node_id);
    `
  },
  {
    name: '0011_missing_user_columns.sql',
    sql: `
DO $$ BEGIN
  CREATE TYPE "public"."subscription_plan" AS ENUM('free_trial', 'weekly', 'monthly', 'annual');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."subscription_status" AS ENUM('trialing', 'active', 'past_due', 'cancelled', 'expired');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE users ADD COLUMN IF NOT EXISTS community_username TEXT UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS community_bio TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS community_joined_at TIMESTAMP;

ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_plan "subscription_plan" DEFAULT 'free_trial' NOT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_status "subscription_status" DEFAULT 'trialing' NOT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_ends_at TIMESTAMP;

ALTER TABLE users ADD COLUMN IF NOT EXISTS paystack_customer_id TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS paystack_subscription_code TEXT;

ALTER TABLE users ADD COLUMN IF NOT EXISTS trial_drafting_used INTEGER DEFAULT 0 NOT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS trial_oral_devil_used INTEGER DEFAULT 0 NOT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS trial_oral_exam_used INTEGER DEFAULT 0 NOT NULL;

UPDATE users
SET trial_ends_at = created_at + INTERVAL '3 days'
WHERE trial_ends_at IS NULL;
    `
  },
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

    for (const migration of MIGRATIONS) {
      const sql = migration.sql.trim();
      if (!sql) {
        console.log(`[migrations] Skipping ${migration.name} (empty)`);
        continue;
      }

      try {
        await client.query(sql);
        console.log(`[migrations] ✅ Applied: ${migration.name}`);
      } catch (err) {
        // Most errors are "already exists" which is fine (idempotent migrations use IF NOT EXISTS)
        const msg = err.message || '';
        if (msg.includes('already exists') || msg.includes('duplicate')) {
          console.log(`[migrations] ⏭️  Skipped: ${migration.name} (already applied)`);
        } else {
          console.error(`[migrations] ⚠️  Error in ${migration.name}: ${msg}`);
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
