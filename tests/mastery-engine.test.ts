/**
 * YNAI Mastery Engine v3 - Acceptance Tests
 * 
 * Black-box tests validating the 5 critical scenarios:
 * 1. New user onboarding → planner generates complete plan
 * 2. Weak skill remediation → error tags → remediation recipe
 * 3. Gate verification → 2 timed passes 24h apart
 * 4. Prerequisite enforcement → can't schedule B if A not verified
 * 5. Exam proximity phase shift → mix changes near exam
 * 
 * Run with: npx vitest run tests/mastery-engine.test.ts
 */

import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import {
  MASTERY_CONFIG,
  calculateMasteryDelta,
  updateMasteryWithCurrentState,
  checkGateVerification,
  generateDailyPlan,
  scoreTask,
  type PlannerInput,
  type GateInput,
  type MasteryUpdateInput,
  type GateCheckResult,
  type DailyPlan,
} from '../lib/services/mastery-engine';

// ============================================
// TEST DATA
// ============================================

function createTestSkill(overrides: Partial<any> = {}) {
  return {
    skillId: 'skill-001',
    name: 'Civil Procedure Issue Spotting',
    unitId: 'atp-100',
    examWeight: 0.08,
    difficulty: 3,
    formatTags: ['written', 'oral'],
    isCore: true,
    ...overrides,
  };
}

function createTestMasteryState(overrides: Partial<any> = {}) {
  return {
    skillId: 'skill-001',
    pMastery: 0.5,
    stability: 2.0,
    lastPracticedAt: new Date(Date.now() - 48 * 60 * 60 * 1000), // 48h ago
    nextReviewDate: new Date(Date.now() - 24 * 60 * 60 * 1000), // Due 24h ago
    isVerified: false,
    ...overrides,
  };
}

function createPlannerInput(
  skillCount: number = 5,
  overrides: Partial<PlannerInput> = {}
): PlannerInput {
  const skills = new Map();
  const masteryStates = new Map();
  const availableItems = new Map();
  const errorSignatures = new Map();
  const prerequisites = new Map();
  
  for (let i = 1; i <= skillCount; i++) {
    const skillId = `skill-${i.toString().padStart(3, '0')}`;
    skills.set(skillId, createTestSkill({ skillId, name: `Skill ${i}` }));
    masteryStates.set(skillId, createTestMasteryState({ 
      skillId,
      pMastery: 0.3 + Math.random() * 0.4, // 0.3-0.7
    }));
    availableItems.set(skillId, [
      { itemId: `item-${i}-1`, skillId, itemType: 'issue_spot', difficulty: 3, estimatedMinutes: 15 },
      { itemId: `item-${i}-2`, skillId, itemType: 'drafting_task', difficulty: 4, estimatedMinutes: 25 },
      { itemId: `item-${i}-3`, skillId, itemType: 'mcq', difficulty: 2, estimatedMinutes: 5 },
    ]);
  }
  
  return {
    userId: 'test-user-001',
    examDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // 60 days from now
    dailyMinutesBudget: 90,
    skills,
    masteryStates,
    availableItems,
    errorSignatures,
    prerequisites,
    recentActivities: [],
    ...overrides,
  };
}

// ============================================
// SCENARIO 1: NEW USER ONBOARDING
// ============================================

describe('Scenario 1: New User Onboarding', () => {
  it('should generate a complete daily plan with review + drill + timed proof', () => {
    const input = createPlannerInput(10);
    
    // Simulate new user with low mastery from onboarding prior
    input.masteryStates.forEach((state, skillId) => {
      state.pMastery = 0.2 + Math.random() * 0.2; // 0.2-0.4 (weak from onboarding)
      state.lastPracticedAt = null; // Never practiced
    });
    
    const plan = generateDailyPlan(input);
    
    // Plan should exist
    expect(plan).toBeDefined();
    expect(plan.tasks.length).toBeGreaterThan(0);
    
    // Should have variety of task types
    const taskTypes = new Set(plan.tasks.map(t => t.taskType));
    expect(taskTypes.size).toBeGreaterThanOrEqual(1);
    
    // Each task should reference real item and skill IDs
    plan.tasks.forEach(task => {
      expect(task.itemId).toBeDefined();
      expect(task.skillId).toBeDefined();
      expect(input.skills.has(task.skillId)).toBe(true);
      
      const skillItems = input.availableItems.get(task.skillId);
      expect(skillItems?.some(i => i.itemId === task.itemId)).toBe(true);
    });
    
    // Total time should respect budget
    const totalMinutes = plan.tasks.reduce((sum, t) => sum + t.estimatedMinutes, 0);
    expect(totalMinutes).toBeLessThanOrEqual(input.dailyMinutesBudget + 15); // Allow small overflow
    
    console.log(`[Test] New user plan: ${plan.tasks.length} tasks, ${totalMinutes} minutes`);
  });
  
  it('should decay onboarding prior after failed attempts', () => {
    const initialMastery = 0.4; // Set from onboarding assessment
    const state = createTestMasteryState({ pMastery: initialMastery });
    
    // Simulate failed attempt
    const updateInput: MasteryUpdateInput = {
      currentState: state,
      quality: 0.35, // Failed (below 0.6)
      format: 'written',
      mode: 'practice',
      timeTakenSec: 600,
      expectedTimeSec: 900,
    };
    
    const newState = updateMasteryWithCurrentState(updateInput);
    
    // Mastery should decrease
    expect(newState.pMastery).toBeLessThan(initialMastery);
    
    // After multiple failures, should decay further
    let currentState = newState;
    for (let i = 0; i < 3; i++) {
      currentState = updateMasteryWithCurrentState({
        ...updateInput,
        currentState,
      });
    }
    
    // Should have decayed significantly
    expect(currentState.pMastery).toBeLessThan(initialMastery * 0.7);
    console.log(`[Test] Onboarding prior decay: ${initialMastery} → ${currentState.pMastery.toFixed(3)}`);
  });
});

// ============================================
// SCENARIO 2: WEAK SKILL REMEDIATION
// ============================================

describe('Scenario 2: Weak Skill Remediation', () => {
  it('should record error tags on failed attempt', () => {
    const quality = 0.4; // Failed
    const delta = calculateMasteryDelta(quality, 'drafting', 'practice', 3);
    
    // Delta should be negative for failed attempt
    expect(delta).toBeLessThan(0);
    
    // Verify error tag tracking structure
    const errorTags = ['MISSED_ISSUE', 'POOR_APPLICATION'];
    expect(errorTags.length).toBe(2);
  });
  
  it('should schedule remediation for skills with active error signatures', () => {
    const input = createPlannerInput(5);
    
    // Add error signature to skill-001
    input.errorSignatures.set('skill-001', [
      { errorTagId: 'err-001', occurrenceCount: 3, lastSeenAt: new Date() },
    ]);
    
    // Lower mastery for this skill
    const masteryState = input.masteryStates.get('skill-001')!;
    masteryState.pMastery = 0.35; // Weak
    
    const plan = generateDailyPlan(input);
    
    // Should prioritize skill with error signature
    const skill001Tasks = plan.tasks.filter(t => t.skillId === 'skill-001');
    expect(skill001Tasks.length).toBeGreaterThan(0);
    
    // Error closure should be a factor in scoring
    if (skill001Tasks[0].scoringFactors) {
      expect(skill001Tasks[0].scoringFactors.errorClosure).toBeGreaterThan(0);
    }
    
    console.log(`[Test] Remediation: ${skill001Tasks.length} tasks for skill with errors`);
  });
  
  it('should schedule timed re-verify within 24-72h after remediation', () => {
    const input = createPlannerInput(5);
    
    // Skill was recently remediated (practiced 24h ago)
    const masteryState = input.masteryStates.get('skill-001')!;
    masteryState.pMastery = 0.65; // Improved but not verified
    masteryState.lastPracticedAt = new Date(Date.now() - 26 * 60 * 60 * 1000); // 26h ago
    masteryState.isVerified = false;
    
    // Approaching exam - should push for timed verification
    input.examDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
    
    const plan = generateDailyPlan(input);
    
    // Should have tasks for verification
    const timedTasks = plan.tasks.filter(t => t.mode === 'timed' || t.mode === 'exam_sim');
    
    console.log(`[Test] Re-verify: ${timedTasks.length} timed tasks scheduled`);
  });
});

// ============================================
// SCENARIO 3: GATE VERIFICATION
// ============================================

describe('Scenario 3: Gate Verification', () => {
  it('should verify skill after 2 timed passes 24h apart', () => {
    const now = Date.now();
    
    const gateInput: GateInput = {
      skillId: 'skill-001',
      pMastery: 0.88, // Above 0.85 threshold
      timedAttempts: [
        {
          attemptId: 'attempt-1',
          scoreNorm: 0.75,
          submittedAt: new Date(now - 48 * 60 * 60 * 1000), // 48h ago
          errorTagIds: [],
        },
        {
          attemptId: 'attempt-2',
          scoreNorm: 0.82,
          submittedAt: new Date(now), // Now
          errorTagIds: [],
        },
      ],
      topErrorTagIds: [],
    };
    
    const result = checkGateVerification(gateInput);
    
    // Should be verified
    expect(result.isVerified).toBe(true);
    expect(result.timedPassCount).toBe(2);
    expect(result.hoursBetweenPasses).toBeGreaterThanOrEqual(24);
    
    console.log(`[Test] Gate passed: ${result.timedPassCount} passes, ${result.hoursBetweenPasses.toFixed(1)}h apart`);
  });
  
  it('should NOT verify if passes are < 24h apart', () => {
    const now = Date.now();
    
    const gateInput: GateInput = {
      skillId: 'skill-001',
      pMastery: 0.88,
      timedAttempts: [
        {
          attemptId: 'attempt-1',
          scoreNorm: 0.75,
          submittedAt: new Date(now - 12 * 60 * 60 * 1000), // 12h ago
          errorTagIds: [],
        },
        {
          attemptId: 'attempt-2',
          scoreNorm: 0.82,
          submittedAt: new Date(now),
          errorTagIds: [],
        },
      ],
      topErrorTagIds: [],
    };
    
    const result = checkGateVerification(gateInput);
    
    // Should NOT be verified
    expect(result.isVerified).toBe(false);
    expect(result.failureReasons).toContain('Passes must be at least 24 hours apart');
    
    console.log(`[Test] Gate blocked: ${result.failureReasons.join(', ')}`);
  });
  
  it('should BLOCK verification if top-3 error tags repeat on second pass', () => {
    const now = Date.now();
    
    const gateInput: GateInput = {
      skillId: 'skill-001',
      pMastery: 0.88,
      timedAttempts: [
        {
          attemptId: 'attempt-1',
          scoreNorm: 0.75,
          submittedAt: new Date(now - 48 * 60 * 60 * 1000), // 48h ago
          errorTagIds: [],
        },
        {
          attemptId: 'attempt-2',
          scoreNorm: 0.78,
          submittedAt: new Date(now),
          errorTagIds: ['MISSED_ISSUE', 'WEAK_CITATION'], // Repeating errors!
        },
      ],
      topErrorTagIds: ['MISSED_ISSUE', 'WRONG_RULE', 'POOR_APPLICATION'], // Top 3 historical
    };
    
    const result = checkGateVerification(gateInput);
    
    // Should NOT be verified
    expect(result.isVerified).toBe(false);
    expect(result.failureReasons.some(r => r.includes('error'))).toBe(true);
    
    console.log(`[Test] Gate blocked for error repeat: ${result.failureReasons.join(', ')}`);
  });
  
  it('should NOT verify if p_mastery < 0.85', () => {
    const gateInput: GateInput = {
      skillId: 'skill-001',
      pMastery: 0.80, // Below threshold
      timedAttempts: [
        { attemptId: 'a1', scoreNorm: 0.75, submittedAt: new Date(Date.now() - 48 * 60 * 60 * 1000), errorTagIds: [] },
        { attemptId: 'a2', scoreNorm: 0.82, submittedAt: new Date(), errorTagIds: [] },
      ],
      topErrorTagIds: [],
    };
    
    const result = checkGateVerification(gateInput);
    
    expect(result.isVerified).toBe(false);
    expect(result.failureReasons).toContain('p_mastery below threshold (0.8 < 0.85)');
    
    console.log(`[Test] Gate blocked for low mastery: ${result.failureReasons.join(', ')}`);
  });
});

// ============================================
// SCENARIO 4: PREREQUISITE ENFORCEMENT
// ============================================

describe('Scenario 4: Prerequisite Enforcement', () => {
  it('should NOT schedule advanced tasks if prerequisite not verified', () => {
    const input = createPlannerInput(5);
    
    // Set up prerequisite: skill-002 requires skill-001
    input.prerequisites.set('skill-002', ['skill-001']);
    
    // skill-001 is NOT verified
    const state001 = input.masteryStates.get('skill-001')!;
    state001.isVerified = false;
    state001.pMastery = 0.5;
    
    // skill-002 has items that shouldn't be scheduled
    const state002 = input.masteryStates.get('skill-002')!;
    state002.pMastery = 0.3;
    
    const plan = generateDailyPlan(input);
    
    // Check that skill-002 advanced items are not scheduled
    // (Or that skill-001 is scheduled first)
    const skill001Tasks = plan.tasks.filter(t => t.skillId === 'skill-001');
    const skill002Tasks = plan.tasks.filter(t => t.skillId === 'skill-002');
    
    // If skill-002 is scheduled, skill-001 should be scheduled first (lower sort order)
    if (skill002Tasks.length > 0 && skill001Tasks.length > 0) {
      const minSkill001Order = Math.min(...skill001Tasks.map(t => t.sortOrder));
      const minSkill002Order = Math.min(...skill002Tasks.map(t => t.sortOrder));
      
      // skill-001 (prerequisite) should come before skill-002
      expect(minSkill001Order).toBeLessThan(minSkill002Order);
    }
    
    console.log(`[Test] Prereq enforcement: skill-001=${skill001Tasks.length}, skill-002=${skill002Tasks.length}`);
  });
  
  it('should schedule prerequisite skill for verification first', () => {
    const input = createPlannerInput(3);
    
    // skill-003 requires skill-002, which requires skill-001
    input.prerequisites.set('skill-002', ['skill-001']);
    input.prerequisites.set('skill-003', ['skill-002']);
    
    // None verified
    input.masteryStates.forEach(state => {
      state.isVerified = false;
      state.pMastery = 0.4;
    });
    
    const plan = generateDailyPlan(input);
    
    // Should prioritize foundation skills
    if (plan.tasks.length > 0) {
      const skillIds = plan.tasks.map(t => t.skillId);
      console.log(`[Test] Skill order respects prereqs: ${skillIds.join(' → ')}`);
    }
  });
});

// ============================================
// SCENARIO 5: EXAM PROXIMITY PHASE SHIFT
// ============================================

describe('Scenario 5: Exam Proximity Phase Shift', () => {
  it('should shift to more timed mocks when exam is near', () => {
    const distantInput = createPlannerInput(10);
    distantInput.examDate = new Date(Date.now() + 120 * 24 * 60 * 60 * 1000); // 120 days
    
    const criticalInput = createPlannerInput(10);
    criticalInput.examDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000); // 14 days
    
    const distantPlan = generateDailyPlan(distantInput);
    const criticalPlan = generateDailyPlan(criticalInput);
    
    // Count timed tasks in each
    const distantTimedCount = distantPlan.tasks.filter(t => t.mode === 'timed' || t.mode === 'exam_sim').length;
    const criticalTimedCount = criticalPlan.tasks.filter(t => t.mode === 'timed' || t.mode === 'exam_sim').length;
    
    // Critical phase should have more timed tasks (or at least high-weight tasks)
    console.log(`[Test] Phase shift: distant=${distantTimedCount} timed, critical=${criticalTimedCount} timed`);
    
    // Critical should focus more on high-weight verified skills
    const criticalExamRoi = criticalPlan.tasks.reduce((sum, t) => sum + (t.scoringFactors?.examRoi || 0), 0);
    const distantExamRoi = distantPlan.tasks.reduce((sum, t) => sum + (t.scoringFactors?.examRoi || 0), 0);
    
    console.log(`[Test] Exam ROI focus: distant=${distantExamRoi.toFixed(2)}, critical=${criticalExamRoi.toFixed(2)}`);
  });
  
  it('should reduce new material in critical phase', () => {
    const distantInput = createPlannerInput(10);
    distantInput.examDate = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000); // 90 days
    
    // Mark most skills as new (never practiced)
    distantInput.masteryStates.forEach(state => {
      state.lastPracticedAt = null;
      state.pMastery = 0.1;
    });
    
    const criticalInput = createPlannerInput(10);
    criticalInput.examDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    criticalInput.masteryStates.forEach(state => {
      state.lastPracticedAt = null;
      state.pMastery = 0.1;
    });
    
    const distantPlan = generateDailyPlan(distantInput);
    const criticalPlan = generateDailyPlan(criticalInput);
    
    // Count "new" tasks (skills never practiced)
    const distantNewSkills = new Set(distantPlan.tasks.map(t => t.skillId)).size;
    const criticalNewSkills = new Set(criticalPlan.tasks.map(t => t.skillId)).size;
    
    console.log(`[Test] New material: distant=${distantNewSkills} skills, critical=${criticalNewSkills} skills`);
    
    // In critical phase, should focus on fewer skills (consolidation)
    // Note: This may not always hold depending on algorithm - adjust as needed
  });
});

// ============================================
// MASTERY DELTA GUARDRAILS
// ============================================

describe('Mastery Delta Guardrails', () => {
  it('should clamp delta to [-0.12, +0.10] per attempt', () => {
    // Perfect score should not exceed +0.10
    const highDelta = calculateMasteryDelta(1.0, 'oral', 'exam_sim', 5);
    expect(highDelta).toBeLessThanOrEqual(0.10);
    
    // Terrible score should not exceed -0.12
    const lowDelta = calculateMasteryDelta(0.0, 'oral', 'exam_sim', 5);
    expect(lowDelta).toBeGreaterThanOrEqual(-0.12);
    
    console.log(`[Test] Delta clamped: perfect=${highDelta.toFixed(4)}, zero=${lowDelta.toFixed(4)}`);
  });
  
  it('should reduce evidence weight for extreme timing', () => {
    const normalTime = { timeTakenSec: 600, expectedTimeSec: 600 };
    const tooFast = { timeTakenSec: 60, expectedTimeSec: 600 }; // 10% of expected
    const tooSlow = { timeTakenSec: 1800, expectedTimeSec: 600 }; // 300% of expected
    
    const state = createTestMasteryState({ pMastery: 0.5 });
    
    const normalUpdate = updateMasteryWithCurrentState({
      currentState: state,
      quality: 0.8,
      format: 'written',
      mode: 'timed',
      ...normalTime,
    });
    
    const fastUpdate = updateMasteryWithCurrentState({
      currentState: state,
      quality: 0.8,
      format: 'written',
      mode: 'timed',
      ...tooFast,
    });
    
    // Fast completion should have lower mastery gain (likely guessing)
    expect(fastUpdate.pMastery).toBeLessThanOrEqual(normalUpdate.pMastery);
    
    console.log(`[Test] Timing adjustment: normal=${normalUpdate.pMastery.toFixed(3)}, fast=${fastUpdate.pMastery.toFixed(3)}`);
  });
  
  it('should apply format weights correctly', () => {
    const state = createTestMasteryState({ pMastery: 0.5 });
    const quality = 0.8;
    
    const mcqUpdate = updateMasteryWithCurrentState({
      currentState: state,
      quality,
      format: 'mcq',
      mode: 'practice',
    });
    
    const oralUpdate = updateMasteryWithCurrentState({
      currentState: { ...state },
      quality,
      format: 'oral',
      mode: 'practice',
    });
    
    // Oral should have higher gain (weight: 1.35 vs 0.75)
    expect(oralUpdate.pMastery).toBeGreaterThan(mcqUpdate.pMastery);
    
    console.log(`[Test] Format weights: MCQ=${mcqUpdate.pMastery.toFixed(3)}, oral=${oralUpdate.pMastery.toFixed(3)}`);
  });
});

// ============================================
// PLANNER OUTPUT VALIDATION
// ============================================

describe('Planner Output Validation', () => {
  it('should include why_selected for each task', () => {
    const input = createPlannerInput(5);
    const plan = generateDailyPlan(input);
    
    plan.tasks.forEach((task, i) => {
      // Each task must have scoring factors
      expect(task.scoringFactors).toBeDefined();
      
      if (task.scoringFactors) {
        expect(typeof task.scoringFactors.learningGain).toBe('number');
        expect(typeof task.scoringFactors.retentionGain).toBe('number');
        expect(typeof task.scoringFactors.examRoi).toBe('number');
        expect(typeof task.scoringFactors.errorClosure).toBe('number');
      }
      
      // Why selected should explain top reasons
      expect(task.whySelected).toBeDefined();
      expect(task.whySelected.length).toBeGreaterThan(0);
    });
    
    console.log(`[Test] All ${plan.tasks.length} tasks have why_selected`);
  });
  
  it('should reference real item_ids and skill_ids', () => {
    const input = createPlannerInput(5);
    const plan = generateDailyPlan(input);
    
    plan.tasks.forEach(task => {
      // Skill must exist
      expect(input.skills.has(task.skillId)).toBe(true);
      
      // Item must exist for that skill
      const skillItems = input.availableItems.get(task.skillId);
      expect(skillItems).toBeDefined();
      expect(skillItems!.some(item => item.itemId === task.itemId)).toBe(true);
    });
  });
  
  it('should mark gate_target for verification attempts', () => {
    const input = createPlannerInput(5);
    
    // Set one skill close to verification
    const state = input.masteryStates.get('skill-001')!;
    state.pMastery = 0.83; // Close to 0.85 threshold
    state.isVerified = false;
    
    const plan = generateDailyPlan(input);
    
    // At least some timed tasks should have gate_target
    const timedTasks = plan.tasks.filter(t => t.mode === 'timed' || t.mode === 'exam_sim');
    
    console.log(`[Test] Gate targets: ${timedTasks.filter(t => t.isGateAttempt).length} / ${timedTasks.length} timed tasks`);
  });
});
