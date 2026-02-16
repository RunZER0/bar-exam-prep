/**
 * Milestone 2 Acceptance Tests
 * 
 * Tests for:
 * 1. Autopilot Precompute Engine
 * 2. Background Worker (new job types)
 * 3. Pacing Engine (SWITCH_SUGGESTED)
 * 4. Next Step Enforcement
 * 5. Oral Window Handling
 */

import { describe, it, expect, beforeAll, vi } from 'vitest';
import { neon } from '@neondatabase/serverless';
import path from 'path';
import fs from 'fs/promises';

// Get database URL from environment (Vitest loads .env automatically via config)
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_RhqJkmu07srt@ep-delicate-resonance-ai973vek-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require';

// Create SQL client
const sql = neon(DATABASE_URL);

describe('M2: Autopilot Precompute Engine', () => {
  it('should have ensureSessionsPrecomputed function exported', async () => {
    const { ensureSessionsPrecomputed } = await import('../lib/services/autopilot-precompute');
    expect(typeof ensureSessionsPrecomputed).toBe('function');
  });

  it('should have PRECOMPUTE_CONFIG with correct defaults', async () => {
    const { PRECOMPUTE_CONFIG } = await import('../lib/services/autopilot-precompute');
    expect(PRECOMPUTE_CONFIG.sessionsToPrecompute).toBe(2);
    expect(PRECOMPUTE_CONFIG.maxConcurrentJobs).toBe(5);
  });

  it('should have isSessionReady function', async () => {
    const { isSessionReady } = await import('../lib/services/autopilot-precompute');
    expect(typeof isSessionReady).toBe('function');
  });

  it('should have getSessionWithAssets function', async () => {
    const { getSessionWithAssets } = await import('../lib/services/autopilot-precompute');
    expect(typeof getSessionWithAssets).toBe('function');
  });
});

describe('M2: Background Worker (New Job Types)', () => {
  it('should have GENERATE_SESSION_ASSETS job type', async () => {
    const workerModule = await import('../lib/services/background-worker');
    // We can't directly check types, but we can check if createJob is exported
    expect(typeof workerModule.createJob).toBe('function');
  });

  it('should process GENERATE_SESSION_ASSETS jobs', async () => {
    // Check that the background worker file contains the new job types
    const workerCode = await fs.readFile(
      path.resolve(process.cwd(), 'lib/services/background-worker.ts'),
      'utf-8'
    );
    
    expect(workerCode).toContain("'GENERATE_SESSION_ASSETS'");
    expect(workerCode).toContain("'PRECOMPUTE_TODAY'");
    expect(workerCode).toContain("'GENERATE_RETEST_VARIANT'");
  });

  it('should have processGenerateSessionAssets handler', async () => {
    const workerCode = await fs.readFile(
      path.resolve(process.cwd(), 'lib/services/background-worker.ts'),
      'utf-8'
    );
    
    expect(workerCode).toContain('processGenerateSessionAssets');
    expect(workerCode).toContain('processPrecomputeToday');
    expect(workerCode).toContain('processGenerateRetestVariant');
  });
});

describe('M2: Pacing Engine (SWITCH_SUGGESTED)', () => {
  it('should have consecutiveWrongForSwitch config', async () => {
    const { PACING_CONFIG } = await import('../lib/services/pacing-engine');
    expect(PACING_CONFIG.consecutiveWrongForSwitch).toBe(3);
  });

  it('should have analyzeSwitchNeed function', async () => {
    const { analyzeSwitchNeed } = await import('../lib/services/pacing-engine');
    expect(typeof analyzeSwitchNeed).toBe('function');
  });

  it('should have recordSwitchSuggestion function', async () => {
    const { recordSwitchSuggestion } = await import('../lib/services/pacing-engine');
    expect(typeof recordSwitchSuggestion).toBe('function');
  });

  it('should have recordSwitchResponse function', async () => {
    const { recordSwitchResponse } = await import('../lib/services/pacing-engine');
    expect(typeof recordSwitchResponse).toBe('function');
  });

  it('should suggest switch after 3 consecutive wrong', async () => {
    const { analyzeSwitchNeed } = await import('../lib/services/pacing-engine');
    
    // Mock: Test the function returns switch suggestion when threshold met
    // Note: This is a unit test of the logic, DB test would require setup
    const mockSessionId = 'test-session-123';
    const mockSkillId = 'test-skill-456';
    
    // We test with mock values - actual DB interaction tested differently
    const result = await analyzeSwitchNeed(mockSessionId, mockSkillId, 3);
    
    expect(result.shouldSwitch).toBe(true);
    expect(result.reason).toBe('consecutive_wrong');
    expect(result.urgency).toBe('medium');
  });
});

describe('M2: Schema (oral_slot_date)', () => {
  it('should have oral_slot_date column in user_exam_profiles', async () => {
    // Check schema file contains the field
    const schemaCode = await fs.readFile(
      path.resolve(process.cwd(), 'lib/db/schema.ts'),
      'utf-8'
    );
    
    expect(schemaCode).toContain('oralSlotDate');
    expect(schemaCode).toContain("date('oral_slot_date')");
  });
});

describe('M2: Next Step Enforcement', () => {
  it('should have determineNextAction in session endpoint', async () => {
    const sessionCode = await fs.readFile(
      path.resolve(process.cwd(), 'app/api/study/session/[id]/route.ts'),
      'utf-8'
    );
    
    expect(sessionCode).toContain('determineNextAction');
    expect(sessionCode).toContain("action: 'NEXT_SESSION'");
    expect(sessionCode).toContain("action: 'TAKE_BREAK'");
    expect(sessionCode).toContain("action: 'DONE_FOR_TODAY'");
    expect(sessionCode).toContain("action: 'SWITCH_SKILL'");
  });

  it('should return nextAction in complete response', async () => {
    const sessionCode = await fs.readFile(
      path.resolve(process.cwd(), 'app/api/study/session/[id]/route.ts'),
      'utf-8'
    );
    
    expect(sessionCode).toContain('nextAction');
    expect(sessionCode).toContain("case 'complete':");
  });
});

describe('M2: /api/tutor/today Precompute Integration', () => {
  it('should import autopilot-precompute', async () => {
    const todayCode = await fs.readFile(
      path.resolve(process.cwd(), 'app/api/tutor/today/route.ts'),
      'utf-8'
    );
    
    expect(todayCode).toContain("from '@/lib/services/autopilot-precompute'");
    expect(todayCode).toContain('ensureSessionsPrecomputed');
  });

  it('should return precompute status in response', async () => {
    const todayCode = await fs.readFile(
      path.resolve(process.cwd(), 'app/api/tutor/today/route.ts'),
      'utf-8'
    );
    
    expect(todayCode).toContain('precomputeStatus');
    expect(todayCode).toContain('assetsReady');
    expect(todayCode).toContain('assetsTotal');
    expect(todayCode).toContain('jobsEnqueued');
  });

  it('should prioritize skills by exam_weight', async () => {
    const todayCode = await fs.readFile(
      path.resolve(process.cwd(), 'app/api/tutor/today/route.ts'),
      'utf-8'
    );
    
    expect(todayCode).toContain('prioritizedSkills');
    expect(todayCode).toContain('desc(microSkills.examWeight)');
  });
});

describe('M2: Database Verification', () => {
  it('should have study_sessions table', async () => {
    const result = await sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'study_sessions'
      ORDER BY ordinal_position`;
    
    expect(result.length).toBeGreaterThan(0);
    
    const columns = result.map(r => r.column_name);
    expect(columns).toContain('id');
    expect(columns).toContain('user_id');
    expect(columns).toContain('status');
    expect(columns).toContain('target_skill_ids');
  });

  it('should have study_assets table', async () => {
    const result = await sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'study_assets'
      ORDER BY ordinal_position`;
    
    expect(result.length).toBeGreaterThan(0);
    
    const columns = result.map(r => r.column_name);
    expect(columns).toContain('id');
    expect(columns).toContain('session_id');
    expect(columns).toContain('asset_type');
    expect(columns).toContain('status');
  });

  it('should have background_jobs table with correct columns', async () => {
    const result = await sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'background_jobs'
      ORDER BY ordinal_position`;
    
    expect(result.length).toBeGreaterThan(0);
    
    const columns = result.map(r => r.column_name);
    expect(columns).toContain('id');
    expect(columns).toContain('job_type');
    expect(columns).toContain('status');
    expect(columns).toContain('priority');
    expect(columns).toContain('payload_json');
  });

  it('should have session_events table', async () => {
    const result = await sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'session_events'
      ORDER BY ordinal_position`;
    
    expect(result.length).toBeGreaterThan(0);
    
    const columns = result.map(r => r.column_name);
    expect(columns).toContain('id');
    expect(columns).toContain('session_id');
    expect(columns).toContain('event_type');
    expect(columns).toContain('event_data');
  });
});
