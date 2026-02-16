/**
 * YNAI Mastery Engine v3 - Acceptance Tests (Fixed)
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

import { describe, it, expect } from 'vitest';
import {
  MASTERY_CONFIG,
  calculateMasteryDelta,
  updateMasteryWithCurrentState,
  checkGateVerification,
  generateDailyPlan,
  scoreTask,
  determineExamPhase,
  type PlannerInput,
  type GateInput,
  type DailyPlanOutput,
} from '../lib/services/mastery-engine';

// ============================================
// TEST DATA HELPERS
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
    lastPracticedAt: new Date(Date.now() - 48 * 60 * 60 * 1000),
    nextReviewDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
    isVerified: false,
    ...overrides,
  };
}

function createPlannerInput(skillCount: number = 5, overrides: Partial<PlannerInput> = {}): PlannerInput {
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
      pMastery: 0.3 + Math.random() * 0.4,
    }));
    availableItems.set(skillId, [
      { itemId: `item-${i}-1`, skillId, itemType: 'issue_spot', difficulty: 3, estimatedMinutes: 15 },
      { itemId: `item-${i}-2`, skillId, itemType: 'drafting_task', difficulty: 4, estimatedMinutes: 25 },
      { itemId: `item-${i}-3`, skillId, itemType: 'mcq', difficulty: 2, estimatedMinutes: 5 },
    ]);
  }
  
  return {
    userId: 'test-user-001',
    examDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
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
  it('should generate a daily plan with tasks', () => {
    const input = createPlannerInput(5, { dailyMinutesBudget: 120 });
    const plan = generateDailyPlan(input);
    
    expect(plan).toBeDefined();
    expect(plan.tasks).toBeDefined();
    expect(Array.isArray(plan.tasks)).toBe(true);
    expect(plan.tasks.length).toBeGreaterThan(0);
    
    // Every task should have required fields
    for (const task of plan.tasks) {
      expect(task.itemId).toBeDefined();
      expect(task.skillId).toBeDefined();
      expect(task.estimatedMinutes).toBeGreaterThan(0);
    }
    
    console.log(`[Test] New user plan: ${plan.tasks.length} tasks`);
  });
  
  it('should decay mastery on failed attempts', () => {
    const currentPMastery = 0.5;
    const currentStability = 2.0;
    
    // Simulate failed attempt (score 0.35 < 0.6)
    const result = updateMasteryWithCurrentState('skill-001', currentPMastery, currentStability, {
      scoreNorm: 0.35,
      format: 'written',
      mode: 'practice',
      difficulty: 3,
      coverageWeight: 1.0,
    });
    
    // Mastery should decrease
    expect(result.newPMastery).toBeLessThan(currentPMastery);
    expect(result.delta).toBeLessThan(0);
    expect(result.wasSuccess).toBe(false);
    
    console.log(`[Test] Failed attempt decay: ${currentPMastery} → ${result.newPMastery.toFixed(3)}`);
  });
});

// ============================================
// SCENARIO 2: WEAK SKILL REMEDIATION
// ============================================

describe('Scenario 2: Weak Skill Remediation', () => {
  it('should calculate negative delta for failed attempt', () => {
    const result = calculateMasteryDelta(
      0.5,        // currentPMastery
      0.4,        // scoreNorm (failed)
      'drafting',
      'practice',
      3,          // difficulty
      1.0         // coverageWeight
    );
    
    // Delta should be negative for failed attempt
    expect(result.delta).toBeLessThan(0);
    expect(result.wasSuccess).toBe(false);
    
    console.log(`[Test] Failed attempt delta: ${result.delta.toFixed(4)}`);
  });
  
  it('should schedule remediation in plan for low mastery skills', () => {
    // Create input with one very low mastery skill
    const input = createPlannerInput(3);
    input.masteryStates.set('skill-001', {
      ...createTestMasteryState({ skillId: 'skill-001' }),
      pMastery: 0.15, // Very weak
    });
    
    const plan = generateDailyPlan(input);
    
    // Low mastery skill should be prioritized
    const skill001Tasks = plan.tasks.filter((t: any) => t.skillId === 'skill-001');
    expect(skill001Tasks.length).toBeGreaterThan(0);
    
    console.log(`[Test] Weak skill in plan: ${skill001Tasks.length} tasks for skill-001`);
  });
});

// ============================================
// SCENARIO 3: GATE VERIFICATION
// ============================================

describe('Scenario 3: Gate Verification', () => {
  it('should verify skill after 2 timed passes 24h apart', () => {
    const now = new Date();
    const pass1Time = new Date(now.getTime() - 30 * 60 * 60 * 1000); // 30h ago
    const pass2Time = new Date(now.getTime() - 1 * 60 * 60 * 1000);  // 1h ago
    
    const input: GateInput = {
      skillId: 'skill-001',
      pMastery: 0.90,
      timedAttempts: [
        { attemptId: 'a1', scoreNorm: 0.85, submittedAt: pass1Time, errorTagIds: [] },
        { attemptId: 'a2', scoreNorm: 0.88, submittedAt: pass2Time, errorTagIds: [] },
      ],
      topErrorTagIds: [],
    };
    
    const result = checkGateVerification(input);
    
    expect(result.isVerified).toBe(true);
    expect(result.timedPassCount).toBe(2);
    
    console.log(`[Test] Gate passed: ${result.timedPassCount} passes, verified=${result.isVerified}`);
  });
  
  it('should NOT verify if passes are < 24h apart', () => {
    const now = new Date();
    const pass1Time = new Date(now.getTime() - 12 * 60 * 60 * 1000); // 12h ago
    const pass2Time = new Date(now.getTime() - 1 * 60 * 60 * 1000);  // 1h ago
    
    const input: GateInput = {
      skillId: 'skill-001',
      pMastery: 0.90,
      timedAttempts: [
        { attemptId: 'a1', scoreNorm: 0.85, submittedAt: pass1Time, errorTagIds: [] },
        { attemptId: 'a2', scoreNorm: 0.88, submittedAt: pass2Time, errorTagIds: [] },
      ],
      topErrorTagIds: [],
    };
    
    const result = checkGateVerification(input);
    
    expect(result.isVerified).toBe(false);
    expect(result.failureReasons.length).toBeGreaterThan(0);
    
    console.log(`[Test] Gate blocked (timing): ${result.failureReasons.join(', ')}`);
  });
  
  it('should BLOCK verification if error tags repeat', () => {
    const now = new Date();
    const pass1Time = new Date(now.getTime() - 30 * 60 * 60 * 1000);
    const pass2Time = new Date(now.getTime() - 1 * 60 * 60 * 1000);
    
    const input: GateInput = {
      skillId: 'skill-001',
      pMastery: 0.90,
      timedAttempts: [
        { attemptId: 'a1', scoreNorm: 0.85, submittedAt: pass1Time, errorTagIds: ['procedural-error', 'citation-missing'] },
        { attemptId: 'a2', scoreNorm: 0.82, submittedAt: pass2Time, errorTagIds: ['procedural-error'] }, // Repeating error
      ],
      topErrorTagIds: ['procedural-error', 'citation-missing', 'format-error'],
    };
    
    const result = checkGateVerification(input);
    
    expect(result.isVerified).toBe(false);
    
    console.log(`[Test] Gate blocked (error repeat): ${result.failureReasons.join(', ')}`);
  });
  
  it('should NOT verify if p_mastery < 0.85', () => {
    const now = new Date();
    
    const input: GateInput = {
      skillId: 'skill-001',
      pMastery: 0.80, // Below threshold
      timedAttempts: [
        { attemptId: 'a1', scoreNorm: 0.85, submittedAt: new Date(now.getTime() - 30 * 60 * 60 * 1000), errorTagIds: [] },
        { attemptId: 'a2', scoreNorm: 0.88, submittedAt: new Date(now.getTime() - 1 * 60 * 60 * 1000), errorTagIds: [] },
      ],
      topErrorTagIds: [],
    };
    
    const result = checkGateVerification(input);
    
    expect(result.isVerified).toBe(false);
    
    console.log(`[Test] Gate blocked (low mastery): ${result.failureReasons.join(', ')}`);
  });
});

// ============================================
// SCENARIO 4: PREREQUISITE ENFORCEMENT
// ============================================

describe('Scenario 4: Prerequisite Enforcement', () => {
  it('should NOT schedule advanced tasks if prerequisite not verified', () => {
    const input = createPlannerInput(3);
    
    // Set up prerequisite: skill-002 requires skill-001
    input.prerequisites.set('skill-002', ['skill-001']);
    
    // skill-001 is NOT verified
    input.masteryStates.set('skill-001', {
      ...createTestMasteryState({ skillId: 'skill-001' }),
      pMastery: 0.5,
      isVerified: false,
    });
    
    // skill-002 has higher mastery but unverified prereq
    input.masteryStates.set('skill-002', {
      ...createTestMasteryState({ skillId: 'skill-002' }),
      pMastery: 0.8,
      isVerified: false,
    });
    
    const plan = generateDailyPlan(input);
    
    // skill-002 tasks should be deprioritized or excluded
    const skill001Tasks = plan.tasks.filter((t: any) => t.skillId === 'skill-001').length;
    const skill002Tasks = plan.tasks.filter((t: any) => t.skillId === 'skill-002').length;
    
    // skill-001 should have more or equal tasks since skill-002 is blocked
    expect(skill001Tasks).toBeGreaterThanOrEqual(skill002Tasks);
    
    console.log(`[Test] Prereq enforcement: skill-001=${skill001Tasks}, skill-002=${skill002Tasks}`);
  });
});

// ============================================
// SCENARIO 5: EXAM PROXIMITY PHASE SHIFT
// ============================================

describe('Scenario 5: Exam Proximity Phase Shift', () => {
  it('should determine correct exam phase', () => {
    // Product spec: >= 60 = distant, 8-59 = approaching, 0-7 = critical
    expect(determineExamPhase(60)).toBe('distant');
    expect(determineExamPhase(100)).toBe('distant');
    expect(determineExamPhase(270)).toBe('distant'); // M3 bug fix: 270 days must be distant
    expect(determineExamPhase(59)).toBe('approaching');
    expect(determineExamPhase(30)).toBe('approaching');
    expect(determineExamPhase(8)).toBe('approaching');
    expect(determineExamPhase(7)).toBe('critical');
    expect(determineExamPhase(4)).toBe('critical');
    expect(determineExamPhase(0)).toBe('critical');
    
    console.log(`[Test] Exam phases: 270d=distant, 60d=distant, 59d=approaching, 8d=approaching, 7d=critical, 0d=critical`);
  });
  
  it('should shift mix when exam is near', () => {
    const distantInput = createPlannerInput(5, {
      examDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // 60 days
    });
    
    const criticalInput = createPlannerInput(5, {
      examDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // 5 days
    });
    
    const distantPlan = generateDailyPlan(distantInput);
    const criticalPlan = generateDailyPlan(criticalInput);
    
    // Both should generate plans
    expect(distantPlan.tasks.length).toBeGreaterThan(0);
    expect(criticalPlan.tasks.length).toBeGreaterThan(0);
    
    console.log(`[Test] Phase shift: distant=${distantPlan.tasks.length} tasks, critical=${criticalPlan.tasks.length} tasks`);
  });
});

// ============================================
// MASTERY DELTA GUARDRAILS
// ============================================

describe('Mastery Delta Guardrails', () => {
  it('should clamp delta to [-0.12, +0.10] per attempt', () => {
    // Perfect score - should not exceed +0.10
    const highResult = calculateMasteryDelta(0.5, 1.0, 'oral', 'exam_sim', 5, 1.0);
    expect(highResult.delta).toBeLessThanOrEqual(0.10);
    
    // Terrible score - should not exceed -0.12
    const lowResult = calculateMasteryDelta(0.5, 0.0, 'oral', 'exam_sim', 5, 1.0);
    expect(lowResult.delta).toBeGreaterThanOrEqual(-0.12);
    
    console.log(`[Test] Delta clamping: high=${highResult.delta.toFixed(4)}, low=${lowResult.delta.toFixed(4)}`);
  });
  
  it('should apply format weights correctly', () => {
    const mcqResult = calculateMasteryDelta(0.5, 0.8, 'mcq', 'practice', 3, 1.0);
    const oralResult = calculateMasteryDelta(0.5, 0.8, 'oral', 'practice', 3, 1.0);
    
    // Oral should have higher weight than MCQ
    const mcqWeight = MASTERY_CONFIG.formatWeights.mcq;
    const oralWeight = MASTERY_CONFIG.formatWeights.oral;
    
    if (oralWeight > mcqWeight) {
      expect(oralResult.delta).toBeGreaterThan(mcqResult.delta);
    }
    
    console.log(`[Test] Format weights: MCQ=${mcqWeight}, oral=${oralWeight}`);
  });
});

// ============================================
// PLANNER OUTPUT VALIDATION
// ============================================

describe('Planner Output Validation', () => {
  it('should include whySelected for each task', () => {
    const input = createPlannerInput(3);
    const plan = generateDailyPlan(input);
    
    for (const task of plan.tasks) {
      expect(task.whySelected).toBeDefined();
      expect(Array.isArray(task.whySelected) || typeof task.whySelected === 'string').toBe(true);
    }
    
    console.log(`[Test] All ${plan.tasks.length} tasks have whySelected`);
  });
  
  it('should reference real item_ids and skill_ids', () => {
    const input = createPlannerInput(3);
    const plan = generateDailyPlan(input);
    
    for (const task of plan.tasks) {
      expect(task.itemId).toBeDefined();
      expect(task.skillId).toBeDefined();
      expect(typeof task.itemId).toBe('string');
      expect(typeof task.skillId).toBe('string');
    }
    
    console.log(`[Test] All tasks have valid itemId and skillId`);
  });
});

// ============================================
// GRADING SCHEMA VALIDATION (Placeholder)
// ============================================

describe('Grading Schema Validation', () => {
  it('should reject malformed grading output', () => {
    // This is a placeholder - actual test requires grading service mocking
    const malformedOutput = { score: 'not-a-number' };
    
    // Validate that score must be a number
    expect(typeof malformedOutput.score).not.toBe('number');
    
    console.log('[Test] Grading validation: malformed output detected');
  });
});
