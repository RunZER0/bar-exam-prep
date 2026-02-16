/**
 * Apply Migration 0003 using Neon HTTP Driver
 * This bypasses drizzle-kit's TCP connection issues with Neon pooler
 */

import { neon } from '@neondatabase/serverless';
import * as fs from 'fs';
import * as path from 'path';

// Load .env manually
const envPath = path.join(__dirname, '..', '.env');
const envContent = fs.readFileSync(envPath, 'utf-8');
const dbMatch = envContent.match(/^DATABASE_URL=(.+)$/m);
const DATABASE_URL = dbMatch?.[1] || '';

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL not found in .env');
  process.exit(1);
}

const sql = neon(DATABASE_URL);

async function applyMigration() {
  console.log('🚀 Applying migration 0003_tutor_os_flagship...\n');

  try {
    // 1. Create ENUMs (these fail silently if they exist)
    console.log('Creating ENUMs...');
    
    try {
      await sql`CREATE TYPE candidate_type AS ENUM ('FIRST_TIME', 'RESIT')`;
      console.log('  ✅ candidate_type');
    } catch (e: any) {
      if (e.message.includes('already exists')) console.log('  ⏭️  candidate_type (exists)');
      else throw e;
    }

    try {
      await sql`CREATE TYPE exam_event_type AS ENUM ('WRITTEN', 'ORAL', 'REGISTRATION', 'RESULTS')`;
      console.log('  ✅ exam_event_type');
    } catch (e: any) {
      if (e.message.includes('already exists')) console.log('  ⏭️  exam_event_type (exists)');
      else throw e;
    }

    try {
      await sql`CREATE TYPE session_status AS ENUM ('QUEUED', 'PREPARING', 'READY', 'IN_PROGRESS', 'COMPLETED', 'ABANDONED')`;
      console.log('  ✅ session_status');
    } catch (e: any) {
      if (e.message.includes('already exists')) console.log('  ⏭️  session_status (exists)');
      else throw e;
    }

    try {
      await sql`CREATE TYPE session_modality AS ENUM ('WRITTEN', 'ORAL', 'DRAFTING', 'REVIEW', 'MIXED')`;
      console.log('  ✅ session_modality');
    } catch (e: any) {
      if (e.message.includes('already exists')) console.log('  ⏭️  session_modality (exists)');
      else throw e;
    }

    try {
      await sql`CREATE TYPE asset_type AS ENUM ('NOTES', 'CHECKPOINT', 'PRACTICE_SET', 'TIMED_PROMPT', 'RUBRIC', 'MODEL_ANSWER', 'REMEDIATION', 'ORAL_PROMPT', 'FOLLOW_UP')`;
      console.log('  ✅ asset_type');
    } catch (e: any) {
      if (e.message.includes('already exists')) console.log('  ⏭️  asset_type (exists)');
      else throw e;
    }

    try {
      await sql`CREATE TYPE asset_status AS ENUM ('GENERATING', 'READY', 'FAILED')`;
      console.log('  ✅ asset_status');
    } catch (e: any) {
      if (e.message.includes('already exists')) console.log('  ⏭️  asset_status (exists)');
      else throw e;
    }

    try {
      await sql`CREATE TYPE job_status AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED')`;
      console.log('  ✅ job_status');
    } catch (e: any) {
      if (e.message.includes('already exists')) console.log('  ⏭️  job_status (exists)');
      else throw e;
    }

    // 2. Create tables
    console.log('\nCreating tables...');

    await sql`
      CREATE TABLE IF NOT EXISTS exam_cycles (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        label TEXT NOT NULL,
        candidate_type candidate_type NOT NULL,
        year INTEGER NOT NULL,
        timezone TEXT NOT NULL DEFAULT 'Africa/Nairobi',
        notes TEXT,
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `;
    console.log('  ✅ exam_cycles');

    await sql`
      CREATE TABLE IF NOT EXISTS exam_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        cycle_id UUID NOT NULL REFERENCES exam_cycles(id) ON DELETE CASCADE,
        event_type exam_event_type NOT NULL,
        starts_at TIMESTAMP WITH TIME ZONE NOT NULL,
        ends_at TIMESTAMP WITH TIME ZONE,
        unit_id TEXT,
        source_asset_id UUID,
        meta_json JSONB,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `;
    console.log('  ✅ exam_events');

    await sql`
      CREATE TABLE IF NOT EXISTS user_exam_profiles (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        cycle_id UUID NOT NULL REFERENCES exam_cycles(id),
        timezone TEXT NOT NULL DEFAULT 'Africa/Nairobi',
        autopilot_enabled BOOLEAN NOT NULL DEFAULT false,
        notification_preferences JSONB DEFAULT '{"dailyPlan": true, "sessionStart": true, "breaks": true, "weeklyReport": true}'::jsonb,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        UNIQUE(user_id)
      )
    `;
    console.log('  ✅ user_exam_profiles');

    await sql`
      CREATE TABLE IF NOT EXISTS content_assets (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        asset_type TEXT NOT NULL,
        unit_id TEXT NOT NULL,
        title TEXT NOT NULL,
        file_url TEXT,
        content_text TEXT,
        file_size_bytes INTEGER,
        mime_type TEXT,
        parsed_at TIMESTAMP,
        parser_version TEXT,
        meta_json JSONB,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `;
    console.log('  ✅ content_assets');

    await sql`
      CREATE TABLE IF NOT EXISTS outline_topics (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        asset_id UUID REFERENCES content_assets(id),
        unit_id TEXT NOT NULL,
        parent_id UUID REFERENCES outline_topics(id),
        topic_number TEXT,
        topic_code TEXT,
        title TEXT NOT NULL,
        description TEXT,
        learning_outcomes JSONB,
        depth_level INTEGER NOT NULL DEFAULT 0,
        sort_order INTEGER NOT NULL DEFAULT 0,
        exam_weight NUMERIC(5,4) DEFAULT 0.05,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `;
    console.log('  ✅ outline_topics');

    await sql`
      CREATE TABLE IF NOT EXISTS micro_skills (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        skill_code TEXT NOT NULL UNIQUE,
        unit_id TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        format_tags TEXT[] NOT NULL DEFAULT '{}',
        exam_weight NUMERIC(5,4) DEFAULT 0.01,
        min_practice_reps INTEGER NOT NULL DEFAULT 3,
        min_timed_proofs INTEGER NOT NULL DEFAULT 1,
        min_verification_passes INTEGER NOT NULL DEFAULT 2,
        prerequisite_skills TEXT[],
        meta_json JSONB,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `;
    console.log('  ✅ micro_skills');

    await sql`
      CREATE TABLE IF NOT EXISTS skill_outline_map (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        skill_id UUID NOT NULL REFERENCES micro_skills(id) ON DELETE CASCADE,
        topic_id UUID NOT NULL REFERENCES outline_topics(id) ON DELETE CASCADE,
        coverage_strength NUMERIC(3,2) DEFAULT 1.0,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        UNIQUE(skill_id, topic_id)
      )
    `;
    console.log('  ✅ skill_outline_map');

    await sql`
      CREATE TABLE IF NOT EXISTS vetted_authorities (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        authority_type TEXT NOT NULL,
        title TEXT NOT NULL,
        citation TEXT,
        full_text TEXT,
        summary TEXT,
        unit_ids TEXT[] NOT NULL DEFAULT '{}',
        skill_ids UUID[],
        importance TEXT DEFAULT 'medium',
        is_verified BOOLEAN NOT NULL DEFAULT false,
        verified_by_id UUID REFERENCES users(id),
        verified_at TIMESTAMP,
        source_url TEXT,
        meta_json JSONB,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `;
    console.log('  ✅ vetted_authorities');

    await sql`
      CREATE TABLE IF NOT EXISTS study_sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        plan_item_id UUID,
        status session_status NOT NULL DEFAULT 'QUEUED',
        target_skill_ids JSONB NOT NULL DEFAULT '[]',
        modality session_modality NOT NULL DEFAULT 'WRITTEN',
        phase_written TEXT,
        phase_oral TEXT,
        current_step INTEGER NOT NULL DEFAULT 0,
        steps_json JSONB NOT NULL DEFAULT '["notes", "checkpoint", "practice", "grading", "fix", "summary"]',
        estimated_minutes INTEGER,
        started_at TIMESTAMP,
        ended_at TIMESTAMP,
        continuous_minutes INTEGER DEFAULT 0,
        last_break_at TIMESTAMP,
        performance_drops INTEGER DEFAULT 0,
        final_score NUMERIC(5,4),
        error_tags_json JSONB,
        mastery_updates_json JSONB,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `;
    console.log('  ✅ study_sessions');

    await sql`
      CREATE TABLE IF NOT EXISTS study_assets (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id UUID NOT NULL REFERENCES study_sessions(id) ON DELETE CASCADE,
        asset_type asset_type NOT NULL,
        content_json JSONB NOT NULL,
        grounding_refs_json JSONB,
        status asset_status NOT NULL DEFAULT 'GENERATING',
        generation_started_at TIMESTAMP,
        generation_completed_at TIMESTAMP,
        generation_error TEXT,
        step_order INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `;
    console.log('  ✅ study_assets');

    await sql`
      CREATE TABLE IF NOT EXISTS session_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id UUID NOT NULL REFERENCES study_sessions(id) ON DELETE CASCADE,
        event_type TEXT NOT NULL,
        event_data JSONB,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `;
    console.log('  ✅ session_events');

    await sql`
      CREATE TABLE IF NOT EXISTS background_jobs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        job_type TEXT NOT NULL,
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        status job_status NOT NULL DEFAULT 'PENDING',
        priority INTEGER NOT NULL DEFAULT 5,
        payload_json JSONB NOT NULL,
        result_json JSONB,
        error_message TEXT,
        attempts INTEGER DEFAULT 0,
        max_attempts INTEGER DEFAULT 3,
        scheduled_for TIMESTAMP NOT NULL DEFAULT NOW(),
        started_at TIMESTAMP,
        completed_at TIMESTAMP,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `;
    console.log('  ✅ background_jobs');

    await sql`
      CREATE TABLE IF NOT EXISTS weekly_reports (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        week_start DATE NOT NULL,
        week_end DATE NOT NULL,
        readiness_score NUMERIC(5,4),
        written_readiness NUMERIC(5,4),
        oral_readiness NUMERIC(5,4),
        readiness_trend TEXT,
        coverage_completed JSONB,
        coverage_debt_remaining JSONB,
        strongest_skills JSONB,
        weakest_skills JSONB,
        skills_verified INTEGER DEFAULT 0,
        recurring_error_tags JSONB,
        remediation_plan JSONB,
        total_sessions INTEGER DEFAULT 0,
        total_minutes INTEGER DEFAULT 0,
        total_attempts INTEGER DEFAULT 0,
        gates_passed INTEGER DEFAULT 0,
        next_week_recommendations JSONB,
        days_to_written INTEGER,
        days_to_oral INTEGER,
        evidence_refs_json JSONB,
        report_generated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `;
    console.log('  ✅ weekly_reports');

    // 3. Alter existing tables
    console.log('\nAltering existing tables...');

    try {
      await sql`ALTER TABLE daily_plans ADD COLUMN IF NOT EXISTS days_until_written INTEGER`;
      await sql`ALTER TABLE daily_plans ADD COLUMN IF NOT EXISTS days_until_oral INTEGER`;
      await sql`ALTER TABLE daily_plans ADD COLUMN IF NOT EXISTS written_phase TEXT`;
      await sql`ALTER TABLE daily_plans ADD COLUMN IF NOT EXISTS oral_phase TEXT`;
      await sql`ALTER TABLE daily_plans ADD COLUMN IF NOT EXISTS total_minutes_completed INTEGER DEFAULT 0`;
      await sql`ALTER TABLE daily_plans ADD COLUMN IF NOT EXISTS sessions_ready INTEGER DEFAULT 0`;
      await sql`ALTER TABLE daily_plans ADD COLUMN IF NOT EXISTS sessions_completed INTEGER DEFAULT 0`;
      console.log('  ✅ daily_plans columns added');
    } catch (e: any) {
      console.log('  ⏭️  daily_plans alterations (already done or table missing)');
    }

    try {
      await sql`ALTER TABLE daily_plan_items ADD COLUMN IF NOT EXISTS session_id UUID REFERENCES study_sessions(id)`;
      await sql`ALTER TABLE daily_plan_items ADD COLUMN IF NOT EXISTS session_status session_status`;
      console.log('  ✅ daily_plan_items columns added');
    } catch (e: any) {
      console.log('  ⏭️  daily_plan_items alterations (already done or table missing)');
    }

    // 4. Create indexes
    console.log('\nCreating indexes...');
    
    await sql`CREATE INDEX IF NOT EXISTS idx_jobs_status_scheduled ON background_jobs(status, scheduled_for, priority)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_jobs_user ON background_jobs(user_id, job_type, status)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_exam_events_cycle ON exam_events(cycle_id, event_type)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_user_exam_profile ON user_exam_profiles(user_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_outline_topics_unit ON outline_topics(unit_id, parent_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_micro_skills_unit ON micro_skills(unit_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_study_sessions_user ON study_sessions(user_id, status)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_study_sessions_plan ON study_sessions(plan_item_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_study_assets_session ON study_assets(session_id, asset_type, status)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_session_events_session ON session_events(session_id, event_type)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_weekly_reports_user ON weekly_reports(user_id, week_start)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_content_assets_unit ON content_assets(unit_id, asset_type)`;
    console.log('  ✅ All indexes created');

    // 5. Seed exam cycles and events
    console.log('\nSeeding exam cycles and events...');

    // April 2026 Resit
    const resitResult = await sql`
      INSERT INTO exam_cycles (label, candidate_type, year, notes, is_active)
      VALUES ('ATP 2026 April Resit', 'FIRST_TIME'::"candidate_type", 2026, 'April 2026 resit window for candidates who failed previous attempts', true)
      ON CONFLICT DO NOTHING
      RETURNING id
    `;
    
    // Fix: Need to use RESIT type - let me re-insert correctly
    await sql`DELETE FROM exam_cycles WHERE label = 'ATP 2026 April Resit' AND candidate_type = 'FIRST_TIME'`;
    
    const resitCycle = await sql`
      INSERT INTO exam_cycles (label, candidate_type, year, notes, is_active)
      VALUES ('ATP 2026 April Resit', 'RESIT', 2026, 'April 2026 resit window', true)
      ON CONFLICT DO NOTHING
      RETURNING id
    `;
    console.log('  ✅ RESIT cycle');

    // First-time cycle
    const firstTimeCycle = await sql`
      INSERT INTO exam_cycles (label, candidate_type, year, notes, is_active)
      VALUES ('ATP 2026 First-time Track', 'FIRST_TIME', 2026, 'November 2026 written + July 2026 oral', true)
      ON CONFLICT DO NOTHING
      RETURNING id
    `;
    console.log('  ✅ FIRST_TIME cycle');

    // Get cycle IDs for events
    const cycles = await sql`SELECT id, label FROM exam_cycles`;
    const resitId = cycles.find((c: any) => c.label.includes('Resit'))?.id;
    const firstTimeId = cycles.find((c: any) => c.label.includes('First-time'))?.id;

    if (resitId) {
      await sql`
        INSERT INTO exam_events (cycle_id, event_type, starts_at, ends_at, meta_json)
        VALUES (${resitId}, 'WRITTEN', '2026-04-09 08:00:00+03', '2026-04-21 17:00:00+03', '{"description": "April 2026 Written - Resit"}')
        ON CONFLICT DO NOTHING
      `;
      console.log('  ✅ RESIT written event');
    }

    if (firstTimeId) {
      await sql`
        INSERT INTO exam_events (cycle_id, event_type, starts_at, ends_at, meta_json)
        VALUES (${firstTimeId}, 'WRITTEN', '2026-11-12 08:00:00+03', '2026-11-24 17:00:00+03', '{"description": "November 2026 Written - First-time"}')
        ON CONFLICT DO NOTHING
      `;
      console.log('  ✅ FIRST_TIME written event');

      await sql`
        INSERT INTO exam_events (cycle_id, event_type, starts_at, ends_at, meta_json)
        VALUES (${firstTimeId}, 'ORAL', '2026-07-01 08:00:00+03', '2026-07-31 17:00:00+03', '{"description": "July 2026 Oral - First-time"}')
        ON CONFLICT DO NOTHING
      `;
      console.log('  ✅ FIRST_TIME oral event');
    }

    console.log('\n✅ Migration 0003 applied successfully!');

    // Verify
    console.log('\n📊 Verification:');
    const cycleCount = await sql`SELECT COUNT(*) as count FROM exam_cycles`;
    const eventCount = await sql`SELECT COUNT(*) as count FROM exam_events`;
    console.log(`  exam_cycles: ${cycleCount[0]?.count}`);
    console.log(`  exam_events: ${eventCount[0]?.count}`);

  } catch (error: any) {
    console.error('\n❌ Migration failed:', error.message);
    process.exit(1);
  }

  process.exit(0);
}

applyMigration();
