/**
 * M2 API Proof
 * Simulates API responses from database
 */

import { neon } from '@neondatabase/serverless';
import * as fs from 'fs';
import * as path from 'path';

const envPath = path.join(process.cwd(), '.env');
const envContent = fs.readFileSync(envPath, 'utf-8');
const dbMatch = envContent.match(/^DATABASE_URL=(.+)$/m);
const DATABASE_URL = dbMatch?.[1] || '';
const sql = neon(DATABASE_URL);

// Product spec: >= 60 = distant, 8-59 = approaching, 0-7 = critical
function getExamPhase(days: number | null): 'distant' | 'approaching' | 'critical' | null {
  if (days === null) return null;
  if (days <= 7) return 'critical';
  if (days < 60) return 'approaching';
  return 'distant';
}

async function main() {
  console.log('='.repeat(80));
  console.log('2) API PROOF: /api/tutor/today and session endpoints');
  console.log('='.repeat(80));

  // Get test user
  const users = await sql`SELECT id, email FROM users LIMIT 1`;
  const userId = users[0]?.id;
  console.log(`\nTest user: ${userId}`);

  // ============================================================
  // GET /api/tutor/today response simulation
  // ============================================================
  console.log('\n' + '-'.repeat(60));
  console.log('GET /api/tutor/today');
  console.log('-'.repeat(60));

  // Get exam profile
  const profiles = await sql`
    SELECT p.*, c.label as cycle_label, c.candidate_type
    FROM user_exam_profiles p
    LEFT JOIN exam_cycles c ON c.id = p.cycle_id
    WHERE p.user_id = ${userId}
    LIMIT 1`;
  
  const profile = profiles[0];

  // Get exam events
  const examEvents = await sql`
    SELECT event_type, starts_at, ends_at
    FROM exam_events
    WHERE cycle_id = ${profile?.cycle_id}`;
  
  const writtenEvent = examEvents.find(e => e.event_type === 'WRITTEN');
  const oralEvent = examEvents.find(e => e.event_type === 'ORAL');

  // Get today's sessions with assets
  const sessions = await sql`
    SELECT s.id, s.status, s.modality, s.target_skill_ids, s.estimated_minutes
    FROM study_sessions s
    WHERE s.user_id = ${userId}
    AND s.created_at >= CURRENT_DATE
    ORDER BY s.created_at`;

  // Get assets for each session
  const sessionsWithAssets = [];
  for (const session of sessions) {
    const assets = await sql`
      SELECT asset_type, status, grounding_refs_json
      FROM study_assets
      WHERE session_id = ${session.id}`;
    
    const assetsReady = assets.filter(a => a.status === 'READY').length;
    
    sessionsWithAssets.push({
      id: session.id,
      status: session.status,
      modality: session.modality,
      skillIds: session.target_skill_ids,
      estimatedMinutes: session.estimated_minutes,
      precomputeStatus: assetsReady === 4 ? 'READY' : 'PREPARING',
      assetsReady,
      assetsTotal: 4,
      assets: assets.map(a => ({
        type: a.asset_type,
        status: a.status,
      })),
    });
  }

  // Construct response - calculate phases dynamically
  const daysToWritten = writtenEvent ? Math.ceil((new Date(writtenEvent.starts_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null;
  const daysToOral = oralEvent ? Math.ceil((new Date(oralEvent.starts_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null;
  
  const todayResponse = {
    examCountdown: profile ? {
      cycleId: profile.cycle_id,
      cycleName: profile.cycle_label,
      candidateType: profile.candidate_type,
      daysToWritten,
      daysToOral,
      phase_written: getExamPhase(daysToWritten),
      phase_oral: getExamPhase(daysToOral),
      dominant_mode: 'WRITTEN',
    } : null,
    sessions: sessionsWithAssets,
    precompute: {
      jobsEnqueued: 0,
      sessionsPrecomputing: sessionsWithAssets.filter(s => s.precomputeStatus === 'PREPARING').length,
      sessionsReady: sessionsWithAssets.filter(s => s.precomputeStatus === 'READY').length,
    },
    needsOnboarding: !profile,
  };

  console.log('\nResponse JSON:');
  console.log(JSON.stringify(todayResponse, null, 2));

  // ============================================================
  // GET /api/study/session/:id response simulation
  // ============================================================
  if (sessions.length > 0) {
    const sessionId = sessions[0].id;
    
    console.log('\n' + '-'.repeat(60));
    console.log(`GET /api/study/session/${sessionId}`);
    console.log('-'.repeat(60));

    const sessionDetails = await sql`
      SELECT * FROM study_sessions WHERE id = ${sessionId}`;
    
    const sessionAssets = await sql`
      SELECT id, asset_type, status, content_json, grounding_refs_json
      FROM study_assets
      WHERE session_id = ${sessionId}
      ORDER BY step_order`;

    const sessionResponse = {
      session: {
        id: sessionDetails[0].id,
        status: sessionDetails[0].status,
        modality: sessionDetails[0].modality,
        targetSkillIds: sessionDetails[0].target_skill_ids,
        estimatedMinutes: sessionDetails[0].estimated_minutes,
        currentStep: sessionDetails[0].current_step,
      },
      assets: sessionAssets.map(a => ({
        id: a.id,
        type: a.asset_type,
        status: a.status,
        content: a.content_json,
        grounding_refs_json: a.grounding_refs_json,
      })),
      flow: {
        steps: ['notes', 'checkpoint', 'practice', 'grading', 'fix', 'summary'],
        currentStepIndex: sessionDetails[0].current_step,
        isComplete: sessionDetails[0].status === 'COMPLETED',
      },
    };

    console.log('\nResponse JSON:');
    console.log(JSON.stringify(sessionResponse, null, 2));

    // Verify 4 assets with grounding_refs
    console.log('\n--- Asset verification ---');
    console.log(`Total assets: ${sessionAssets.length}`);
    console.log('Asset types present:');
    for (const asset of sessionAssets) {
      const hasGroundingRefs = asset.grounding_refs_json?.outline_topic_ids?.length > 0;
      console.log(`  - ${asset.asset_type}: ${asset.status}, grounding_refs: ${hasGroundingRefs ? 'YES' : 'NO'}`);
      if (hasGroundingRefs) {
        console.log(`    outline_topic_ids: ${JSON.stringify(asset.grounding_refs_json.outline_topic_ids)}`);
      }
    }
  }

  // ============================================================
  // POST /api/study/session/start simulation
  // ============================================================
  console.log('\n' + '-'.repeat(60));
  console.log('POST /api/study/session/start (simulated)');
  console.log('-'.repeat(60));

  // Check if any session is READY
  const readySession = sessionsWithAssets.find(s => s.precomputeStatus === 'READY');
  
  if (readySession) {
    console.log('\nSession is READY - can start immediately:');
    console.log(JSON.stringify({
      success: true,
      session: {
        id: readySession.id,
        status: 'IN_PROGRESS',
        canStart: true,
        message: 'Session started successfully',
      },
    }, null, 2));
  } else {
    console.log('\nSession is PREPARING - job would be queued:');
    console.log(JSON.stringify({
      success: true,
      session: {
        id: sessions[0]?.id,
        status: 'PREPARING',
        canStart: false,
        message: 'Assets are being generated. Please wait.',
        jobQueued: true,
      },
    }, null, 2));
  }
}

main().catch(console.error);
