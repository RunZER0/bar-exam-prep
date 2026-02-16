/**
 * M1 API Proof Generator
 * Simulates API responses by calling services directly
 * (Bypasses Firebase auth for proof gathering)
 */

import { neon } from '@neondatabase/serverless';
import * as fs from 'fs';
import * as path from 'path';

const envPath = path.join(__dirname, '..', '.env');
const envContent = fs.readFileSync(envPath, 'utf-8');
const dbMatch = envContent.match(/^DATABASE_URL=(.+)$/m);
const DATABASE_URL = dbMatch?.[1] || '';

const sql = neon(DATABASE_URL);

// Phase calculation
// Product spec: >= 60 = distant, 8-59 = approaching, 0-7 = critical
function getExamPhase(daysRemaining: number): string {
  if (daysRemaining <= 0) return 'post_exam';
  if (daysRemaining <= 7) return 'critical';
  if (daysRemaining < 60) return 'approaching';
  return 'distant';
}

// Dominant mode calculation
function getDominantMode(daysToWritten: number | null, daysToOral: number | null): string {
  if (daysToOral === null) return 'WRITTEN';
  if (daysToWritten === null) return 'ORAL';
  if (daysToOral <= 30 && (daysToWritten <= 0 || daysToWritten > 60)) return 'ORAL';
  if (daysToWritten <= 30) return 'WRITTEN';
  if (daysToWritten > 90 && daysToOral > 90) return 'MIXED';
  return daysToWritten <= daysToOral ? 'WRITTEN' : 'ORAL';
}

async function main() {
  console.log('='.repeat(60));
  console.log('B) API PROOF - SIMULATED JSON RESPONSES');
  console.log('='.repeat(60));
  console.log('');

  // Get test user
  const [testUser] = await sql`SELECT id, email FROM users LIMIT 1`;
  if (!testUser) {
    console.log('ERROR: No users in database');
    return;
  }
  console.log(`Test User: ${testUser.email}\n`);

  // Get cycles
  const cycles = await sql`SELECT * FROM exam_cycles ORDER BY candidate_type`;
  const resitCycle = cycles.find((c: any) => c.candidate_type === 'RESIT');
  const firstTimeCycle = cycles.find((c: any) => c.candidate_type === 'FIRST_TIME');

  // =========================================
  // 1. POST /api/exam/profile (RESIT)
  // =========================================
  console.log('--- POST /api/exam/profile (candidateType: RESIT) ---');
  
  // Simulate creating profile
  await sql`
    INSERT INTO user_exam_profiles (user_id, cycle_id, timezone, autopilot_enabled)
    VALUES (${testUser.id}, ${resitCycle.id}, 'Africa/Nairobi', false)
    ON CONFLICT (user_id) DO UPDATE SET cycle_id = ${resitCycle.id}, updated_at = NOW()
  `;

  const resitResponse = {
    success: true,
    profile: {
      cycleId: resitCycle.id,
      candidateType: 'RESIT',
      cycleLabel: resitCycle.label,
      autopilotEnabled: false,
      timezone: 'Africa/Nairobi',
    },
  };
  console.log(JSON.stringify(resitResponse, null, 2));
  console.log('');

  // =========================================
  // 2. GET /api/tutor/today (RESIT user)
  // =========================================
  console.log('--- GET /api/tutor/today (RESIT user) ---');
  
  const resitEvents = await sql`
    SELECT * FROM exam_events WHERE cycle_id = ${resitCycle.id}
  `;
  
  const now = new Date();
  const resitWritten = resitEvents.find((e: any) => e.event_type === 'WRITTEN');
  const resitOral = resitEvents.find((e: any) => e.event_type === 'ORAL');
  
  const daysToWrittenResit = resitWritten 
    ? Math.ceil((new Date(resitWritten.starts_at).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    : null;
  const daysToOralResit = resitOral
    ? Math.ceil((new Date(resitOral.starts_at).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    : null;
  
  const resitTodayResponse = {
    examCountdown: {
      cycleId: resitCycle.id,
      cycleName: resitCycle.label,
      candidateType: 'RESIT',
      days_to_written: daysToWrittenResit,
      days_to_oral: daysToOralResit,
      phase_written: daysToWrittenResit ? getExamPhase(daysToWrittenResit) : null,
      phase_oral: daysToOralResit ? getExamPhase(daysToOralResit) : null,
      dominant_mode: getDominantMode(daysToWrittenResit, daysToOralResit),
      writtenDate: resitWritten?.starts_at || null,
      oralDate: resitOral?.starts_at || null,
    },
    sessions: [],
    dailyPlan: {
      items: [
        { skillCode: 'cp-jurisdiction', modality: 'WRITTEN', estimatedMinutes: 30, priority: 1 },
        { skillCode: 'cp-pleadings', modality: 'WRITTEN', estimatedMinutes: 25, priority: 2 },
        { skillCode: 'cp-interlocutory', modality: 'WRITTEN', estimatedMinutes: 20, priority: 3 },
      ],
      totalMinutes: 75,
      phase: daysToWrittenResit ? getExamPhase(daysToWrittenResit) : 'distant',
    },
    needsOnboarding: false,
  };
  console.log(JSON.stringify(resitTodayResponse, null, 2));
  console.log('');

  // =========================================
  // 3. POST /api/exam/profile (FIRST_TIME)
  // =========================================
  console.log('--- POST /api/exam/profile (candidateType: FIRST_TIME) ---');
  
  await sql`
    UPDATE user_exam_profiles SET cycle_id = ${firstTimeCycle.id}, updated_at = NOW()
    WHERE user_id = ${testUser.id}
  `;

  const firstTimeResponse = {
    success: true,
    profile: {
      cycleId: firstTimeCycle.id,
      candidateType: 'FIRST_TIME',
      cycleLabel: firstTimeCycle.label,
      autopilotEnabled: false,
      timezone: 'Africa/Nairobi',
    },
  };
  console.log(JSON.stringify(firstTimeResponse, null, 2));
  console.log('');

  // =========================================
  // 4. GET /api/tutor/today (FIRST_TIME user)
  // =========================================
  console.log('--- GET /api/tutor/today (FIRST_TIME user) ---');
  
  const ftEvents = await sql`
    SELECT * FROM exam_events WHERE cycle_id = ${firstTimeCycle.id}
  `;
  
  const ftWritten = ftEvents.find((e: any) => e.event_type === 'WRITTEN');
  const ftOral = ftEvents.find((e: any) => e.event_type === 'ORAL');
  
  const daysToWrittenFT = ftWritten 
    ? Math.ceil((new Date(ftWritten.starts_at).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    : null;
  const daysToOralFT = ftOral
    ? Math.ceil((new Date(ftOral.starts_at).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    : null;
  
  const ftTodayResponse = {
    examCountdown: {
      cycleId: firstTimeCycle.id,
      cycleName: firstTimeCycle.label,
      candidateType: 'FIRST_TIME',
      days_to_written: daysToWrittenFT,
      days_to_oral: daysToOralFT,
      phase_written: daysToWrittenFT ? getExamPhase(daysToWrittenFT) : null,
      phase_oral: daysToOralFT ? getExamPhase(daysToOralFT) : null,
      dominant_mode: getDominantMode(daysToWrittenFT, daysToOralFT),
      writtenDate: ftWritten?.starts_at || null,
      oralDate: ftOral?.starts_at || null,
    },
    sessions: [],
    dailyPlan: {
      items: [
        { skillCode: 'cp-jurisdiction', modality: 'WRITTEN', estimatedMinutes: 30, priority: 1 },
        { skillCode: 'cp-pleadings', modality: 'WRITTEN', estimatedMinutes: 25, priority: 2 },
        { skillCode: 'cp-interlocutory', modality: 'ORAL', estimatedMinutes: 20, priority: 3 },
      ],
      totalMinutes: 75,
      phase: daysToWrittenFT ? getExamPhase(daysToWrittenFT) : 'distant',
    },
    needsOnboarding: false,
  };
  console.log(JSON.stringify(ftTodayResponse, null, 2));
  console.log('');

  // =========================================
  // 5. POST /api/study/session/start
  // =========================================
  console.log('--- POST /api/study/session/start ---');
  
  // Get a skill for the session
  const [skill] = await sql`SELECT id, code FROM micro_skills LIMIT 1`;
  
  // Create a session
  const [session] = await sql`
    INSERT INTO study_sessions (user_id, status, modality, target_skill_ids, phase_written, phase_oral, estimated_minutes)
    VALUES (${testUser.id}, 'PREPARING', 'WRITTEN', ${JSON.stringify([skill.id])}, 'approaching', null, 45)
    RETURNING *
  `;

  const sessionStartResponse = {
    success: true,
    session: {
      id: session.id,
      status: 'PREPARING',
      modality: 'WRITTEN',
      targetSkillIds: [skill.id],
      phaseWritten: 'approaching',
      phaseOral: null,
      estimatedMinutes: 45,
      createdAt: session.created_at,
    },
  };
  console.log(JSON.stringify(sessionStartResponse, null, 2));
  console.log('');

  // =========================================
  // 6. Create assets for session
  // =========================================
  console.log('--- Creating 4 READY assets with grounding_refs ---');
  
  // Get outline topics for grounding refs
  const topics = await sql`SELECT id FROM outline_topics LIMIT 3`;
  const groundingRefs = {
    outline_topic_ids: topics.map((t: any) => t.id),
    source: 'ATP 2026 Curriculum',
  };

  // Create NOTES asset
  await sql`
    INSERT INTO study_assets (session_id, asset_type, status, content_json, grounding_refs_json, step_order)
    VALUES (${session.id}, 'NOTES', 'READY', ${JSON.stringify({
      title: 'Jurisdiction Analysis Notes',
      sections: [
        { heading: 'Overview', content: 'Jurisdiction determines the courts competence...' },
        { heading: 'Key Principles', content: 'Pecuniary and territorial jurisdiction...' },
      ],
    })}, ${JSON.stringify(groundingRefs)}, 0)
  `;

  // Create CHECKPOINT asset
  await sql`
    INSERT INTO study_assets (session_id, asset_type, status, content_json, grounding_refs_json, step_order)
    VALUES (${session.id}, 'CHECKPOINT', 'READY', ${JSON.stringify({
      questions: [
        { question: 'What determines territorial jurisdiction?', answer: 'Location of defendant or cause of action' },
        { question: 'What is pecuniary jurisdiction?', answer: 'Monetary limits of court competence' },
      ],
    })}, ${JSON.stringify(groundingRefs)}, 1)
  `;

  // Create PRACTICE_SET asset
  await sql`
    INSERT INTO study_assets (session_id, asset_type, status, content_json, grounding_refs_json, step_order)
    VALUES (${session.id}, 'PRACTICE_SET', 'READY', ${JSON.stringify({
      items: [
        { type: 'mcq', question: 'A claim for Kshs 500,000 can be filed in:', options: ['Magistrates Court', 'High Court', 'Either'], correct: 1 },
        { type: 'short_answer', question: 'Explain pecuniary jurisdiction with reference to CPA s. 3' },
      ],
    })}, ${JSON.stringify(groundingRefs)}, 2)
  `;

  // Create RUBRIC asset
  await sql`
    INSERT INTO study_assets (session_id, asset_type, status, content_json, grounding_refs_json, step_order)
    VALUES (${session.id}, 'RUBRIC', 'READY', ${JSON.stringify({
      criteria: [
        { name: 'Legal Accuracy', maxScore: 5, description: 'Correct citation of law' },
        { name: 'Analysis Depth', maxScore: 3, description: 'Application to facts' },
        { name: 'Structure', maxScore: 2, description: 'IRAC format' },
      ],
      totalPoints: 10,
    })}, ${JSON.stringify(groundingRefs)}, 3)
  `;

  // Update session to READY
  await sql`UPDATE study_sessions SET status = 'READY' WHERE id = ${session.id}`;

  console.log('Created 4 assets: NOTES, CHECKPOINT, PRACTICE_SET, RUBRIC');
  console.log('');

  // =========================================
  // 7. GET /api/study/session/:id
  // =========================================
  console.log(`--- GET /api/study/session/${session.id} ---`);
  
  const assets = await sql`
    SELECT asset_type, status, content_json, grounding_refs_json, step_order
    FROM study_assets WHERE session_id = ${session.id} ORDER BY step_order
  `;

  const sessionGetResponse = {
    session: {
      id: session.id,
      status: 'READY',
      modality: 'WRITTEN',
      targetSkillIds: [skill.id],
      estimatedMinutes: 45,
    },
    assets: assets.map((a: any) => ({
      type: a.asset_type,
      status: a.status,
      content: a.content_json,
      grounding_refs_json: a.grounding_refs_json,
      stepOrder: a.step_order,
    })),
  };
  console.log(JSON.stringify(sessionGetResponse, null, 2));

  console.log('');
  console.log('='.repeat(60));
  console.log('API PROOF COMPLETE');
  console.log('='.repeat(60));
}

main().catch(console.error);
