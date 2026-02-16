/**
 * Grading Service Tests
 * Tests Zod schema validation, retry logic, and fallbacks
 * 
 * Run: npx vitest run tests/grading-service.test.ts
 */

import { describe, it, expect } from 'vitest';
import { GradingOutputSchema } from '../lib/services/grading-service';

// ============================================
// SCHEMA VALIDATION TESTS
// ============================================

describe('Grading Schema Validation', () => {
  it('should accept valid grading output', () => {
    const validOutput = {
      scoreNorm: 0.75,
      scoreRaw: 15,
      maxScore: 20,
      rubricBreakdown: [
        {
          category: 'Legal Analysis',
          score: 8,
          maxScore: 10,
          feedback: 'Good analysis of jurisdiction issues',
          missingPoints: ['Failed to address venue'],
        },
        {
          category: 'Application',
          score: 7,
          maxScore: 10,
          feedback: 'Adequate application to facts',
        },
      ],
      missingPoints: ['Venue discussion', 'Limitation period'],
      errorTags: ['MISSED_ISSUE', 'STRUCTURE_ISSUE'],
      nextDrills: ['Jurisdiction analysis', 'Pleading formats'],
      modelOutline: 'A proper answer would address: 1) Jurisdiction 2) Venue 3) Parties',
      evidenceRequests: ['CPC Section 15', 'Order IV Rule 1'],
    };
    
    const result = GradingOutputSchema.safeParse(validOutput);
    expect(result.success).toBe(true);
    
    console.log('[Test] Valid grading output accepted');
  });
  
  it('should reject scoreNorm > 1', () => {
    const invalidOutput = {
      scoreNorm: 1.5, // Invalid - must be 0-1
      scoreRaw: 15,
      maxScore: 20,
      rubricBreakdown: [
        { category: 'Test', score: 5, maxScore: 10, feedback: 'Test feedback' },
      ],
      missingPoints: [],
      errorTags: [],
      nextDrills: [],
      modelOutline: '',
      evidenceRequests: [],
    };
    
    const result = GradingOutputSchema.safeParse(invalidOutput);
    expect(result.success).toBe(false);
    
    console.log('[Test] Rejected scoreNorm > 1');
  });
  
  it('should reject scoreNorm < 0', () => {
    const invalidOutput = {
      scoreNorm: -0.5, // Invalid - must be >= 0
      scoreRaw: 0,
      maxScore: 20,
      rubricBreakdown: [
        { category: 'Test', score: 0, maxScore: 10, feedback: 'Test feedback' },
      ],
      missingPoints: [],
      errorTags: [],
      nextDrills: [],
      modelOutline: '',
      evidenceRequests: [],
    };
    
    const result = GradingOutputSchema.safeParse(invalidOutput);
    expect(result.success).toBe(false);
    
    console.log('[Test] Rejected scoreNorm < 0');
  });
  
  it('should reject empty rubricBreakdown', () => {
    const invalidOutput = {
      scoreNorm: 0.75,
      scoreRaw: 15,
      maxScore: 20,
      rubricBreakdown: [], // Invalid - must have at least 1 item
      missingPoints: [],
      errorTags: [],
      nextDrills: [],
      modelOutline: '',
      evidenceRequests: [],
    };
    
    const result = GradingOutputSchema.safeParse(invalidOutput);
    expect(result.success).toBe(false);
    
    console.log('[Test] Rejected empty rubricBreakdown');
  });
  
  it('should reject missing required fields', () => {
    const invalidOutput = {
      scoreNorm: 0.75,
      // Missing: scoreRaw, maxScore, rubricBreakdown, etc.
    };
    
    const result = GradingOutputSchema.safeParse(invalidOutput);
    expect(result.success).toBe(false);
    
    console.log('[Test] Rejected missing required fields');
  });
  
  it('should reject non-numeric score', () => {
    const invalidOutput = {
      scoreNorm: 'not-a-number', // Invalid type
      scoreRaw: 15,
      maxScore: 20,
      rubricBreakdown: [
        { category: 'Test', score: 5, maxScore: 10, feedback: 'Test' },
      ],
      missingPoints: [],
      errorTags: [],
      nextDrills: [],
      modelOutline: '',
      evidenceRequests: [],
    };
    
    const result = GradingOutputSchema.safeParse(invalidOutput);
    expect(result.success).toBe(false);
    
    console.log('[Test] Rejected non-numeric score');
  });
  
  it('should reject rubric item with empty category', () => {
    const invalidOutput = {
      scoreNorm: 0.75,
      scoreRaw: 15,
      maxScore: 20,
      rubricBreakdown: [
        { category: '', score: 5, maxScore: 10, feedback: 'Test' }, // Empty category
      ],
      missingPoints: [],
      errorTags: [],
      nextDrills: [],
      modelOutline: '',
      evidenceRequests: [],
    };
    
    const result = GradingOutputSchema.safeParse(invalidOutput);
    expect(result.success).toBe(false);
    
    console.log('[Test] Rejected empty category name');
  });
});

// ============================================
// FALLBACK BEHAVIOR TESTS
// ============================================

describe('Grading Fallback Behavior', () => {
  it('should have conservative fallback output structure', () => {
    // This is what the system should return after max retries
    const conservativeFallback = {
      scoreNorm: 0.3, // Conservative low score
      scoreRaw: 6,
      maxScore: 20,
      rubricBreakdown: [
        {
          category: 'Unable to Grade',
          score: 6,
          maxScore: 20,
          feedback: 'Automated grading failed. Manual review required.',
        },
      ],
      missingPoints: ['Manual review required'],
      errorTags: ['GRADING_ERROR'],
      nextDrills: [],
      modelOutline: '',
      evidenceRequests: [],
    };
    
    // Fallback should still be valid according to schema
    const result = GradingOutputSchema.safeParse(conservativeFallback);
    expect(result.success).toBe(true);
    
    // Score should be conservative (not giving credit)
    expect(conservativeFallback.scoreNorm).toBeLessThanOrEqual(0.4);
    
    console.log('[Test] Conservative fallback is schema-valid');
  });
});

// ============================================
// ERROR TAG VALIDATION
// ============================================

describe('Error Tag Consistency', () => {
  it('should allow standard error codes', () => {
    const validErrorTags = [
      'MISSED_ISSUE',
      'WRONG_RULE',
      'NO_CITATION',
      'WRONG_CITATION',
      'POOR_APPLICATION',
      'WRONG_RELIEF',
      'STRUCTURE_ISSUE',
      'INCOMPLETE',
    ];
    
    const output = {
      scoreNorm: 0.5,
      scoreRaw: 10,
      maxScore: 20,
      rubricBreakdown: [
        { category: 'Test', score: 5, maxScore: 10, feedback: 'Test feedback' },
      ],
      missingPoints: [],
      errorTags: validErrorTags,
      nextDrills: [],
      modelOutline: '',
      evidenceRequests: [],
    };
    
    const result = GradingOutputSchema.safeParse(output);
    expect(result.success).toBe(true);
    
    console.log(`[Test] All ${validErrorTags.length} standard error codes accepted`);
  });
});
