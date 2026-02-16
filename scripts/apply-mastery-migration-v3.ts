/**
 * Apply mastery engine migration using Postgres.js
 * Run with: npx tsx scripts/apply-mastery-migration-v3.ts
 */

import postgres from 'postgres';
import * as fs from 'fs';
import * as path from 'path';

// Load .env manually
const envPath = path.join(__dirname, '..', '.env');
const envContent = fs.readFileSync(envPath, 'utf-8');
const dbMatch = envContent.match(/^DATABASE_URL=(.+)$/m);
const DATABASE_URL = dbMatch?.[1] || '';

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL not found');
  process.exit(1);
}

async function applyMigration() {
  console.log('🚀 Applying Mastery Engine v3 Migration...\n');

  const sql = postgres(DATABASE_URL, { ssl: 'require' });

  try {
    // ENUMS - use DO blocks to handle "already exists"
    console.log('Creating ENUMs...');
    await sql.unsafe(`
      DO $$ BEGIN CREATE TYPE format_tag AS ENUM ('mcq', 'written', 'oral', 'drafting', 'flashcard'); EXCEPTION WHEN duplicate_object THEN null; END $$;
      DO $$ BEGIN CREATE TYPE item_type AS ENUM ('mcq', 'issue_spot', 'essay', 'oral_prompt', 'drafting_task', 'flashcard'); EXCEPTION WHEN duplicate_object THEN null; END $$;
      DO $$ BEGIN CREATE TYPE attempt_mode AS ENUM ('practice', 'timed', 'exam_sim'); EXCEPTION WHEN duplicate_object THEN null; END $$;
      DO $$ BEGIN CREATE TYPE exam_phase AS ENUM ('distant', 'approaching', 'critical', 'exam_week', 'post_exam'); EXCEPTION WHEN duplicate_object THEN null; END $$;
      DO $$ BEGIN CREATE TYPE difficulty_level AS ENUM ('foundation', 'core', 'advanced'); EXCEPTION WHEN duplicate_object THEN null; END $$;
      DO $$ BEGIN CREATE TYPE error_severity AS ENUM ('minor', 'moderate', 'major'); EXCEPTION WHEN duplicate_object THEN null; END $$;
      DO $$ BEGIN CREATE TYPE mapping_strength AS ENUM ('primary', 'secondary'); EXCEPTION WHEN duplicate_object THEN null; END $$;
    `);
    console.log('✓ ENUMs created');

    // TABLES
    console.log('Creating tables...');
    
    await sql.unsafe(`
      CREATE TABLE IF NOT EXISTS domains (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        code TEXT UNIQUE NOT NULL,
        description TEXT,
        sort_order INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log('✓ domains');

    await sql.unsafe(`
      CREATE TABLE IF NOT EXISTS micro_skills (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        code TEXT UNIQUE NOT NULL,
        domain_id UUID REFERENCES domains(id) ON DELETE SET NULL,
        unit_id TEXT NOT NULL,
        format_tags format_tag[] NOT NULL DEFAULT '{}',
        exam_weight DECIMAL(4,3) NOT NULL DEFAULT 0.05,
        difficulty difficulty_level NOT NULL DEFAULT 'core',
        description TEXT,
        is_core BOOLEAN DEFAULT false,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log('✓ micro_skills');

    await sql.unsafe(`
      CREATE TABLE IF NOT EXISTS skill_edges (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        from_skill_id UUID NOT NULL REFERENCES micro_skills(id) ON DELETE CASCADE,
        to_skill_id UUID NOT NULL REFERENCES micro_skills(id) ON DELETE CASCADE,
        edge_type TEXT NOT NULL DEFAULT 'prerequisite',
        strength DECIMAL(3,2) DEFAULT 1.0,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(from_skill_id, to_skill_id)
      );
    `);
    console.log('✓ skill_edges');

    await sql.unsafe(`
      CREATE TABLE IF NOT EXISTS rubrics (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        format format_tag NOT NULL,
        version INTEGER DEFAULT 1,
        schema JSONB NOT NULL,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log('✓ rubrics');

    await sql.unsafe(`
      CREATE TABLE IF NOT EXISTS items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        external_id TEXT,
        item_type item_type NOT NULL,
        format format_tag NOT NULL,
        unit_id TEXT NOT NULL,
        prompt TEXT NOT NULL,
        context TEXT,
        model_answer TEXT,
        key_points TEXT[] DEFAULT '{}',
        difficulty INTEGER DEFAULT 3 CHECK (difficulty >= 1 AND difficulty <= 5),
        estimated_minutes INTEGER DEFAULT 10,
        rubric_id UUID REFERENCES rubrics(id) ON DELETE SET NULL,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log('✓ items');

    await sql.unsafe(`
      CREATE TABLE IF NOT EXISTS item_skill_map (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
        skill_id UUID NOT NULL REFERENCES micro_skills(id) ON DELETE CASCADE,
        strength mapping_strength NOT NULL DEFAULT 'primary',
        rubric_dimensions TEXT[] DEFAULT '{}',
        coverage_weight DECIMAL(3,2) DEFAULT 1.0,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(item_id, skill_id)
      );
    `);
    console.log('✓ item_skill_map');

    await sql.unsafe(`
      CREATE TABLE IF NOT EXISTS error_tags (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        code TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        severity error_severity NOT NULL DEFAULT 'moderate',
        remediation_hint TEXT,
        related_skill_ids UUID[] DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log('✓ error_tags');

    await sql.unsafe(`
      CREATE TABLE IF NOT EXISTS attempts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
        format format_tag NOT NULL,
        mode attempt_mode NOT NULL DEFAULT 'practice',
        raw_answer_text TEXT,
        audio_url TEXT,
        time_taken_sec INTEGER,
        score_norm DECIMAL(4,3) NOT NULL,
        rubric_breakdown_json JSONB NOT NULL,
        feedback_json JSONB,
        model_outline_json JSONB,
        error_tag_ids UUID[] DEFAULT '{}',
        selected_option TEXT,
        is_correct BOOLEAN,
        grading_model TEXT,
        grading_request_id TEXT,
        raw_model_output TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log('✓ attempts');

    await sql.unsafe(`
      CREATE TABLE IF NOT EXISTS mastery_state (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        skill_id UUID NOT NULL REFERENCES micro_skills(id) ON DELETE CASCADE,
        p_mastery DECIMAL(4,3) NOT NULL DEFAULT 0.0,
        stability DECIMAL(6,2) DEFAULT 1.0,
        speed_sec DECIMAL(8,2),
        attempt_count INTEGER DEFAULT 0,
        correct_count INTEGER DEFAULT 0,
        last_practiced_at TIMESTAMPTZ,
        next_review_date TIMESTAMPTZ,
        is_verified BOOLEAN DEFAULT false,
        verified_at TIMESTAMPTZ,
        verification_attempt_id UUID REFERENCES attempts(id),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(user_id, skill_id)
      );
    `);
    console.log('✓ mastery_state');

    await sql.unsafe(`
      CREATE TABLE IF NOT EXISTS skill_error_signature (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        skill_id UUID NOT NULL REFERENCES micro_skills(id) ON DELETE CASCADE,
        error_tag_id UUID NOT NULL REFERENCES error_tags(id) ON DELETE CASCADE,
        occurrence_count INTEGER DEFAULT 1,
        last_seen_at TIMESTAMPTZ DEFAULT NOW(),
        cleared_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(user_id, skill_id, error_tag_id)
      );
    `);
    console.log('✓ skill_error_signature');

    await sql.unsafe(`
      CREATE TABLE IF NOT EXISTS daily_plans (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        plan_date DATE NOT NULL,
        total_tasks INTEGER DEFAULT 0,
        completed_tasks INTEGER DEFAULT 0,
        total_minutes INTEGER DEFAULT 0,
        completed_minutes INTEGER DEFAULT 0,
        phase exam_phase,
        days_to_exam INTEGER,
        generation_params_json JSONB,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(user_id, plan_date)
      );
    `);
    console.log('✓ daily_plans');

    await sql.unsafe(`
      CREATE TABLE IF NOT EXISTS daily_plan_items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        plan_id UUID NOT NULL REFERENCES daily_plans(id) ON DELETE CASCADE,
        skill_id UUID NOT NULL REFERENCES micro_skills(id) ON DELETE CASCADE,
        item_id UUID REFERENCES items(id) ON DELETE SET NULL,
        order_index INTEGER NOT NULL,
        format format_tag NOT NULL,
        mode attempt_mode NOT NULL DEFAULT 'practice',
        estimated_minutes INTEGER DEFAULT 15,
        status TEXT DEFAULT 'pending',
        started_at TIMESTAMPTZ,
        completed_at TIMESTAMPTZ,
        attempt_id UUID REFERENCES attempts(id),
        why_selected TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log('✓ daily_plan_items');

    await sql.unsafe(`
      CREATE TABLE IF NOT EXISTS coverage_debt (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        skill_id UUID NOT NULL REFERENCES micro_skills(id) ON DELETE CASCADE,
        debt_score DECIMAL(5,3) DEFAULT 0.0,
        priority_score DECIMAL(5,3) DEFAULT 0.0,
        days_since_practice INTEGER,
        reps_needed INTEGER DEFAULT 0,
        last_computed_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(user_id, skill_id)
      );
    `);
    console.log('✓ coverage_debt');

    // INDEXES
    console.log('\nCreating indexes...');
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_micro_skills_unit ON micro_skills(unit_id)',
      'CREATE INDEX IF NOT EXISTS idx_items_unit ON items(unit_id)',
      'CREATE INDEX IF NOT EXISTS idx_items_type ON items(item_type)',
      'CREATE INDEX IF NOT EXISTS idx_item_skill_map_skill ON item_skill_map(skill_id)',
      'CREATE INDEX IF NOT EXISTS idx_item_skill_map_item ON item_skill_map(item_id)',
      'CREATE INDEX IF NOT EXISTS idx_attempts_user ON attempts(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_attempts_item ON attempts(item_id)',
      'CREATE INDEX IF NOT EXISTS idx_mastery_state_user ON mastery_state(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_mastery_state_skill ON mastery_state(skill_id)',
      'CREATE INDEX IF NOT EXISTS idx_daily_plans_user ON daily_plans(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_daily_plan_items_plan ON daily_plan_items(plan_id)',
      'CREATE INDEX IF NOT EXISTS idx_coverage_debt_user ON coverage_debt(user_id)',
    ];
    
    for (const idx of indexes) {
      await sql.unsafe(idx);
    }
    console.log('✓ Indexes created');

    // Verify
    console.log('\n🔍 Verifying tables...');
    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('micro_skills', 'items', 'mastery_state', 'attempts', 'domains', 'daily_plans', 'item_skill_map', 'coverage_debt')
      ORDER BY table_name
    `;
    
    console.log('✅ Found tables:', tables.map(r => r.table_name).join(', '));

    await sql.end();
    console.log('\n✨ Migration complete!');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    await sql.end();
    process.exit(1);
  }
}

applyMigration();
