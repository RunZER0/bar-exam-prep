/**
 * M4 Migration: Mastery Hub (Written Exam Mode)
 * - authority_records + authority_passages for source governance
 * - notification_log + push_subscriptions for reminders
 * - study_activity_type enum for variety
 * - update evidence_spans with authority_id + locator_json
 */

import { neon } from '@neondatabase/serverless';
import * as fs from 'fs';
import * as path from 'path';

const envPath = path.join(process.cwd(), '.env');
const envContent = fs.readFileSync(envPath, 'utf-8');
const dbMatch = envContent.match(/^DATABASE_URL=(.+)$/m);
const DATABASE_URL = dbMatch?.[1] || '';
const sql = neon(DATABASE_URL);

async function main() {
  console.log('='.repeat(60));
  console.log('M4 MIGRATION: Mastery Hub Tables');
  console.log('='.repeat(60));

  // 1. Create enums
  console.log('\n1. Creating enums...');
  
  await sql`
    DO $$ BEGIN
      CREATE TYPE source_tier AS ENUM ('A', 'B', 'C');
    EXCEPTION WHEN duplicate_object THEN null;
    END $$;
  `;
  console.log('  ✓ source_tier enum');

  await sql`
    DO $$ BEGIN
      CREATE TYPE source_type AS ENUM ('CASE', 'STATUTE', 'REGULATION', 'ARTICLE', 'TEXTBOOK', 'OTHER');
    EXCEPTION WHEN duplicate_object THEN null;
    END $$;
  `;
  console.log('  ✓ source_type enum');

  await sql`
    DO $$ BEGIN
      CREATE TYPE license_tag AS ENUM ('PUBLIC_LEGAL_TEXT', 'CC_BY_SA', 'RESTRICTED', 'UNKNOWN');
    EXCEPTION WHEN duplicate_object THEN null;
    END $$;
  `;
  console.log('  ✓ license_tag enum');

  await sql`
    DO $$ BEGIN
      CREATE TYPE notification_channel AS ENUM ('EMAIL', 'PUSH', 'IN_APP');
    EXCEPTION WHEN duplicate_object THEN null;
    END $$;
  `;
  console.log('  ✓ notification_channel enum');

  await sql`
    DO $$ BEGIN
      CREATE TYPE notification_status AS ENUM ('PENDING', 'SENT', 'FAILED', 'BOUNCED');
    EXCEPTION WHEN duplicate_object THEN null;
    END $$;
  `;
  console.log('  ✓ notification_status enum');

  await sql`
    DO $$ BEGIN
      CREATE TYPE study_activity_type AS ENUM (
        'READING_NOTES',
        'MEMORY_CHECK',
        'FLASHCARDS',
        'WRITTEN_QUIZ',
        'ISSUE_SPOTTER',
        'RULE_ELEMENTS_DRILL',
        'ESSAY_OUTLINE',
        'FULL_ESSAY',
        'PAST_PAPER_STYLE',
        'ERROR_CORRECTION',
        'MIXED_REVIEW'
      );
    EXCEPTION WHEN duplicate_object THEN null;
    END $$;
  `;
  console.log('  ✓ study_activity_type enum');

  // 2. Create authority_records table
  console.log('\n2. Creating authority_records table...');
  await sql`
    CREATE TABLE IF NOT EXISTS authority_records (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      source_tier source_tier NOT NULL,
      source_type source_type NOT NULL,
      domain TEXT NOT NULL,
      canonical_url TEXT NOT NULL,
      title TEXT NOT NULL,
      jurisdiction TEXT,
      court TEXT,
      citation TEXT,
      decision_date DATE,
      act_name TEXT,
      section_path TEXT,
      license_tag license_tag NOT NULL DEFAULT 'UNKNOWN',
      retrieved_at TIMESTAMP NOT NULL DEFAULT NOW(),
      content_hash TEXT,
      raw_text TEXT,
      is_verified BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `;
  console.log('  ✓ authority_records table');

  // 3. Create authority_passages table
  console.log('\n3. Creating authority_passages table...');
  await sql`
    CREATE TABLE IF NOT EXISTS authority_passages (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      authority_id UUID NOT NULL REFERENCES authority_records(id) ON DELETE CASCADE,
      passage_text TEXT NOT NULL,
      locator_json JSONB NOT NULL,
      snippet_hash TEXT,
      start_index INTEGER,
      end_index INTEGER,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `;
  console.log('  ✓ authority_passages table');

  // 4. Create notification_log table
  console.log('\n4. Creating notification_log table...');
  await sql`
    CREATE TABLE IF NOT EXISTS notification_log (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      channel notification_channel NOT NULL,
      template TEXT NOT NULL,
      payload_json JSONB,
      status notification_status NOT NULL DEFAULT 'PENDING',
      provider_message_id TEXT,
      error_message TEXT,
      sent_at TIMESTAMP,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `;
  console.log('  ✓ notification_log table');

  // 5. Create push_subscriptions table
  console.log('\n5. Creating push_subscriptions table...');
  await sql`
    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      endpoint TEXT NOT NULL UNIQUE,
      keys_json JSONB NOT NULL,
      user_agent TEXT,
      is_active BOOLEAN NOT NULL DEFAULT true,
      last_used_at TIMESTAMP,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `;
  console.log('  ✓ push_subscriptions table');

  // 6. Add authority_id and locator_json to evidence_spans
  console.log('\n6. Updating evidence_spans table...');
  
  // Check if columns exist
  const existingCols = await sql`
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_name = 'evidence_spans' 
    AND column_name IN ('authority_id', 'locator_json', 'verbatim_allowed')
  `;
  const existingColNames = existingCols.map(c => c.column_name);

  if (!existingColNames.includes('authority_id')) {
    await sql`
      ALTER TABLE evidence_spans 
      ADD COLUMN authority_id UUID REFERENCES authority_records(id)
    `;
    console.log('  ✓ Added authority_id column');
  } else {
    console.log('  - authority_id already exists');
  }

  if (!existingColNames.includes('locator_json')) {
    await sql`
      ALTER TABLE evidence_spans 
      ADD COLUMN locator_json JSONB
    `;
    console.log('  ✓ Added locator_json column');
  } else {
    console.log('  - locator_json already exists');
  }

  if (!existingColNames.includes('verbatim_allowed')) {
    await sql`
      ALTER TABLE evidence_spans 
      ADD COLUMN verbatim_allowed BOOLEAN DEFAULT false
    `;
    console.log('  ✓ Added verbatim_allowed column');
  } else {
    console.log('  - verbatim_allowed already exists');
  }

  // 7. Add activity_types to study_assets
  console.log('\n7. Updating study_assets table...');
  
  const assetCols = await sql`
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_name = 'study_assets' 
    AND column_name = 'activity_types'
  `;

  if (assetCols.length === 0) {
    await sql`
      ALTER TABLE study_assets 
      ADD COLUMN activity_types TEXT[]
    `;
    console.log('  ✓ Added activity_types column');
  } else {
    console.log('  - activity_types already exists');
  }

  // 8. Add reminder_preferences to user_profiles
  console.log('\n8. Updating user_profiles table...');
  
  const profileCols = await sql`
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_name = 'user_profiles' 
    AND column_name IN ('reminder_time', 'reminder_enabled', 'reminder_timezone')
  `;
  const profileColNames = profileCols.map(c => c.column_name);

  if (!profileColNames.includes('reminder_enabled')) {
    await sql`
      ALTER TABLE user_profiles 
      ADD COLUMN reminder_enabled BOOLEAN DEFAULT true
    `;
    console.log('  ✓ Added reminder_enabled column');
  }

  if (!profileColNames.includes('reminder_time')) {
    await sql`
      ALTER TABLE user_profiles 
      ADD COLUMN reminder_time TEXT DEFAULT '09:00'
    `;
    console.log('  ✓ Added reminder_time column');
  }

  if (!profileColNames.includes('reminder_timezone')) {
    await sql`
      ALTER TABLE user_profiles 
      ADD COLUMN reminder_timezone TEXT DEFAULT 'Africa/Nairobi'
    `;
    console.log('  ✓ Added reminder_timezone column');
  }

  // 9. Create indexes
  console.log('\n9. Creating indexes...');
  
  const indexes = [
    { name: 'idx_authority_records_domain', sql: 'CREATE INDEX IF NOT EXISTS idx_authority_records_domain ON authority_records(domain)' },
    { name: 'idx_authority_records_source_tier', sql: 'CREATE INDEX IF NOT EXISTS idx_authority_records_source_tier ON authority_records(source_tier)' },
    { name: 'idx_authority_records_citation', sql: 'CREATE INDEX IF NOT EXISTS idx_authority_records_citation ON authority_records(citation)' },
    { name: 'idx_authority_records_content_hash', sql: 'CREATE INDEX IF NOT EXISTS idx_authority_records_content_hash ON authority_records(content_hash)' },
    { name: 'idx_authority_passages_authority_id', sql: 'CREATE INDEX IF NOT EXISTS idx_authority_passages_authority_id ON authority_passages(authority_id)' },
    { name: 'idx_authority_passages_snippet_hash', sql: 'CREATE INDEX IF NOT EXISTS idx_authority_passages_snippet_hash ON authority_passages(snippet_hash)' },
    { name: 'idx_notification_log_user_id', sql: 'CREATE INDEX IF NOT EXISTS idx_notification_log_user_id ON notification_log(user_id)' },
    { name: 'idx_notification_log_status', sql: 'CREATE INDEX IF NOT EXISTS idx_notification_log_status ON notification_log(status)' },
    { name: 'idx_notification_log_created_at', sql: 'CREATE INDEX IF NOT EXISTS idx_notification_log_created_at ON notification_log(created_at)' },
    { name: 'idx_push_subscriptions_user_id', sql: 'CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON push_subscriptions(user_id)' },
    { name: 'idx_evidence_spans_authority_id', sql: 'CREATE INDEX IF NOT EXISTS idx_evidence_spans_authority_id ON evidence_spans(authority_id)' },
  ];

  for (const idx of indexes) {
    await sql.unsafe(idx.sql);
    console.log(`  ✓ ${idx.name}`);
  }

  // 10. Verify all tables
  console.log('\n10. Verifying M4 tables...');
  
  const tables = await sql`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name IN ('authority_records', 'authority_passages', 'notification_log', 'push_subscriptions')
    ORDER BY table_name
  `;
  
  console.log(`  Found ${tables.length}/4 M4 tables:`);
  tables.forEach(t => console.log(`    ✓ ${t.table_name}`));

  console.log('\n' + '='.repeat(60));
  console.log('M4 Migration Complete');
  console.log('='.repeat(60));
}

main().catch(console.error);
