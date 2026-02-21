/**
 * YNAI Mastery Engine v3 - Grading Service
 * 
 * Implements structured grading for written, oral, and drafting responses.
 * All grading outputs are JSON schema validated - NO MARKDOWN.
 * 
 * P0: Evidence over vibes - every feedback point ties to rubric, transcript, or authority
 */

import OpenAI from 'openai';
import { z } from 'zod';
import { 
  WRITTEN_RUBRIC_DIMENSIONS, 
  ORAL_RUBRIC_DIMENSIONS, 
  DRAFTING_RUBRIC_DIMENSIONS,
  type GradingOutput,
} from './mastery-engine';

// Re-export GradingOutput for use by other modules
export type { GradingOutput } from './mastery-engine';

// ============================================
// ZOD SCHEMA FOR GRADING OUTPUT
// Strict validation - NO MARKDOWN ALLOWED
// ============================================

const RubricBreakdownItemSchema = z.object({
  category: z.string().min(1),
  score: z.number().min(0),
  maxScore: z.number().min(1),
  feedback: z.string().min(1),
  missingPoints: z.array(z.string()).optional(),
  evidenceSpans: z.array(z.object({
    start: z.number(),
    end: z.number(),
  })).optional(),
});

export const GradingOutputSchema = z.object({
  scoreNorm: z.number().min(0).max(1),
  scoreRaw: z.number().min(0),
  maxScore: z.number().min(1),
  rubricBreakdown: z.array(RubricBreakdownItemSchema).min(1),
  missingPoints: z.array(z.string()),
  errorTags: z.array(z.string()),
  nextDrills: z.array(z.string()),
  modelOutline: z.string(),
  evidenceRequests: z.array(z.string()),
});

// Retry configuration
const GRADING_CONFIG = {
  maxRetries: 3,
  retryDelayMs: 1000,
  fallbackEnabled: true,
};

// ============================================
// TYPES
// ============================================

export interface GradingRequest {
  userId: string;
  itemId: string;
  format: 'written' | 'oral' | 'drafting' | 'mcq';
  mode: 'practice' | 'timed' | 'exam_sim';
  // Item context
  prompt: string;
  context?: string;
  keyPoints?: string[];
  modelAnswer?: string;
  rubricId?: string;
  rubricSchema?: RubricSchema;
  // User response
  response: string; // rawAnswerText or transcriptText
  timeTakenSec?: number;
  // For retrieval alignment
  skillIds: string[];
  unitId: string;
  // Retrieved context for grading
  relevantLectureChunks?: { content: string; lectureTitle: string; timestamp?: string }[];
  relevantAuthorities?: { citation: string; summary: string }[];
}

export interface RubricSchema {
  categories: {
    name: string;
    weight: number;
    criteria: {
      description: string;
      maxScore: number;
      mustHavePoints?: string[];
    }[];
  }[];
  totalMarks: number;
}

// ============================================
// GRADING PROMPTS
// ============================================

const WRITTEN_GRADING_PROMPT = `You are an expert Kenyan bar exam grader. Grade the following written response STRICTLY according to the rubric provided.

GRADING PRINCIPLES:
1. Every point of feedback MUST reference a specific rubric criterion, lecture excerpt, or vetted authority
2. Do NOT invent case citations - only cite authorities provided in context
3. Be precise about what is missing and what is incorrect
4. Identify specific error patterns (issue spotting gaps, rule errors, application failures)

RUBRIC DIMENSIONS:
{{RUBRIC}}

QUESTION:
{{PROMPT}}

{{#if CONTEXT}}
ADDITIONAL CONTEXT:
{{CONTEXT}}
{{/if}}

{{#if MODEL_ANSWER}}
MODEL ANSWER (for reference):
{{MODEL_ANSWER}}
{{/if}}

{{#if KEY_POINTS}}
KEY POINTS EXPECTED:
{{KEY_POINTS}}
{{/if}}

{{#if AUTHORITIES}}
RELEVANT AUTHORITIES (only cite these):
{{AUTHORITIES}}
{{/if}}

{{#if LECTURE_EXCERPTS}}
RELEVANT LECTURE EXCERPTS:
{{LECTURE_EXCERPTS}}
{{/if}}

STUDENT RESPONSE:
{{RESPONSE}}

Respond with ONLY valid JSON matching this exact schema:
{
  "scoreNorm": <0-1 float>,
  "scoreRaw": <integer>,
  "maxScore": <integer>,
  "rubricBreakdown": [
    {
      "category": "<category name>",
      "score": <integer>,
      "maxScore": <integer>,
      "feedback": "<specific feedback with evidence>",
      "missingPoints": ["<missing point 1>", "..."]
    }
  ],
  "missingPoints": ["<key points not addressed>"],
  "errorTags": ["<error code>"],
  "nextDrills": ["<skill area needing practice>"],
  "modelOutline": "<brief model answer outline>",
  "evidenceRequests": ["<sources used in grading>"]
}

ERROR TAG CODES TO USE:
- MISSED_ISSUE: Failed to identify a legal issue
- WRONG_RULE: Incorrect statement of law
- NO_CITATION: Failed to cite relevant authority
- WRONG_CITATION: Incorrect citation
- POOR_APPLICATION: Weak application of rule to facts
- WRONG_RELIEF: Incorrect remedy identified
- STRUCTURE_ISSUE: Poor organization
- INCOMPLETE: Answered only partially`;

const ORAL_GRADING_PROMPT = `You are an expert Kenyan bar exam oral assessor. Grade the following oral response transcript STRICTLY according to the rubric.

GRADING PRINCIPLES:
1. Assess clarity, confidence calibration, and procedural accuracy
2. Note any contradictions or hesitations that indicate uncertainty
3. Evaluate handling of follow-up questions if present
4. Mark specific time stamps or passages where issues occur

RUBRIC DIMENSIONS:
{{RUBRIC}}

QUESTION/SCENARIO:
{{PROMPT}}

{{#if CONTEXT}}
ADDITIONAL CONTEXT:
{{CONTEXT}}
{{/if}}

{{#if AUTHORITIES}}
RELEVANT AUTHORITIES (only cite these):
{{AUTHORITIES}}
{{/if}}

STUDENT TRANSCRIPT:
{{RESPONSE}}

{{#if TIME_TAKEN}}
TIME TAKEN: {{TIME_TAKEN}} seconds
{{/if}}

Respond with ONLY valid JSON matching the grading output schema.

ERROR TAG CODES FOR ORAL:
- WRONG_PROCEDURE: Incorrect procedural step
- CONFIDENCE_MISMATCH: Stated wrongly with confidence
- HESITATION: Excessive hesitation indicating uncertainty
- CONTRADICTION: Self-contradicting statements
- NO_GREETING: Failed to address court properly
- TIME_OVERRUN: Exceeded reasonable time
- FOLLOWUP_FAIL: Could not handle follow-up question`;

const DRAFTING_GRADING_PROMPT = `You are an expert Kenyan legal drafting assessor. Grade the following draft document STRICTLY according to the rubric and Kenyan drafting conventions.

GRADING PRINCIPLES:
1. Check form compliance (correct document type, structure)
2. Verify all required clauses are present and correctly formulated
3. Check parties are properly described with capacity
4. Verify execution/attestation clauses where applicable
5. Check internal consistency (no contradicting clauses)
6. Verify Kenyan-specific requirements are met

RUBRIC DIMENSIONS:
{{RUBRIC}}

DRAFTING TASK:
{{PROMPT}}

{{#if CONTEXT}}
CONTEXT/FACTS:
{{CONTEXT}}
{{/if}}

{{#if AUTHORITIES}}
RELEVANT AUTHORITIES:
{{AUTHORITIES}}
{{/if}}

STUDENT DRAFT:
{{RESPONSE}}

Respond with ONLY valid JSON matching the grading output schema.

ERROR TAG CODES FOR DRAFTING:
- WRONG_FORMAT: Incorrect document format
- MISSING_CLAUSE: Required clause missing
- WRONG_PARTY: Party incorrectly described
- EXECUTION_ERROR: Execution clause incorrect
- INCONSISTENT: Internal contradiction
- NON_KENYAN: Does not follow Kenyan conventions
- STAMP_DUTY_MISS: Stamp duty not addressed
- ATTESTATION_MISS: Attestation clause missing or wrong`;

// ============================================
// GRADING SERVICE
// ============================================

let _openai: OpenAI | null = null;
const getOpenAI = () => {
  if (!_openai && process.env.OPENAI_API_KEY) {
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _openai;
};

const GRADING_MODEL = process.env.GRADING_MODEL || 'gpt-4o';

/**
 * Grade a written response
 */
export async function gradeWrittenResponse(request: GradingRequest): Promise<GradingOutput> {
  const openai = getOpenAI();
  if (!openai) {
    throw new Error('AI grading not available - OPENAI_API_KEY not configured');
  }
  
  // Build rubric string
  const rubric = request.rubricSchema?.categories.map(c => 
    `${c.name} (${(c.weight * 100).toFixed(0)}%): ${c.criteria.map(cr => cr.description).join(', ')}`
  ).join('\n') || WRITTEN_RUBRIC_DIMENSIONS.map(d => 
    `${d.category} (${(d.weight * 100).toFixed(0)}%): ${d.description}`
  ).join('\n');
  
  // Build prompt
  let prompt = WRITTEN_GRADING_PROMPT
    .replace('{{RUBRIC}}', rubric)
    .replace('{{PROMPT}}', request.prompt)
    .replace('{{RESPONSE}}', request.response);
  
  // Add optional sections
  if (request.context) {
    prompt = prompt.replace('{{#if CONTEXT}}\nADDITIONAL CONTEXT:\n{{CONTEXT}}\n{{/if}}', 
      `ADDITIONAL CONTEXT:\n${request.context}`);
  } else {
    prompt = prompt.replace('{{#if CONTEXT}}\nADDITIONAL CONTEXT:\n{{CONTEXT}}\n{{/if}}', '');
  }
  
  if (request.modelAnswer) {
    prompt = prompt.replace('{{#if MODEL_ANSWER}}\nMODEL ANSWER (for reference):\n{{MODEL_ANSWER}}\n{{/if}}',
      `MODEL ANSWER (for reference):\n${request.modelAnswer}`);
  } else {
    prompt = prompt.replace('{{#if MODEL_ANSWER}}\nMODEL ANSWER (for reference):\n{{MODEL_ANSWER}}\n{{/if}}', '');
  }
  
  if (request.keyPoints?.length) {
    prompt = prompt.replace('{{#if KEY_POINTS}}\nKEY POINTS EXPECTED:\n{{KEY_POINTS}}\n{{/if}}',
      `KEY POINTS EXPECTED:\n${request.keyPoints.map((p, i) => `${i + 1}. ${p}`).join('\n')}`);
  } else {
    prompt = prompt.replace('{{#if KEY_POINTS}}\nKEY POINTS EXPECTED:\n{{KEY_POINTS}}\n{{/if}}', '');
  }
  
  if (request.relevantAuthorities?.length) {
    const authText = request.relevantAuthorities.map(a => `- ${a.citation}: ${a.summary}`).join('\n');
    prompt = prompt.replace('{{#if AUTHORITIES}}\nRELEVANT AUTHORITIES (only cite these):\n{{AUTHORITIES}}\n{{/if}}',
      `RELEVANT AUTHORITIES (only cite these):\n${authText}`);
  } else {
    prompt = prompt.replace('{{#if AUTHORITIES}}\nRELEVANT AUTHORITIES (only cite these):\n{{AUTHORITIES}}\n{{/if}}', '');
  }
  
  if (request.relevantLectureChunks?.length) {
    const lectureText = request.relevantLectureChunks.map(l => 
      `[${l.lectureTitle}${l.timestamp ? `, ${l.timestamp}` : ''}]: ${l.content}`
    ).join('\n\n');
    prompt = prompt.replace('{{#if LECTURE_EXCERPTS}}\nRELEVANT LECTURE EXCERPTS:\n{{LECTURE_EXCERPTS}}\n{{/if}}',
      `RELEVANT LECTURE EXCERPTS:\n${lectureText}`);
  } else {
    prompt = prompt.replace('{{#if LECTURE_EXCERPTS}}\nRELEVANT LECTURE EXCERPTS:\n{{LECTURE_EXCERPTS}}\n{{/if}}', '');
  }
  
  // Call AI with retry and validation
  return callGradingAIWithRetry(openai, prompt, 'written');
}

/**
 * Grade an oral response
 */
export async function gradeOralResponse(request: GradingRequest): Promise<GradingOutput> {
  const openai = getOpenAI();
  if (!openai) {
    throw new Error('AI grading not available');
  }
  
  const rubric = ORAL_RUBRIC_DIMENSIONS.map(d => 
    `${d.category} (${(d.weight * 100).toFixed(0)}%): ${d.description}`
  ).join('\n');
  
  let prompt = ORAL_GRADING_PROMPT
    .replace('{{RUBRIC}}', rubric)
    .replace('{{PROMPT}}', request.prompt)
    .replace('{{RESPONSE}}', request.response);
  
  // Handle optional context
  if (request.context) {
    prompt = prompt.replace('{{#if CONTEXT}}\nADDITIONAL CONTEXT:\n{{CONTEXT}}\n{{/if}}',
      `ADDITIONAL CONTEXT:\n${request.context}`);
  } else {
    prompt = prompt.replace('{{#if CONTEXT}}\nADDITIONAL CONTEXT:\n{{CONTEXT}}\n{{/if}}', '');
  }
  
  if (request.relevantAuthorities?.length) {
    const authText = request.relevantAuthorities.map(a => `- ${a.citation}: ${a.summary}`).join('\n');
    prompt = prompt.replace('{{#if AUTHORITIES}}\nRELEVANT AUTHORITIES (only cite these):\n{{AUTHORITIES}}\n{{/if}}',
      `RELEVANT AUTHORITIES (only cite these):\n${authText}`);
  } else {
    prompt = prompt.replace('{{#if AUTHORITIES}}\nRELEVANT AUTHORITIES (only cite these):\n{{AUTHORITIES}}\n{{/if}}', '');
  }
  
  if (request.timeTakenSec) {
    prompt = prompt.replace('{{#if TIME_TAKEN}}\nTIME TAKEN: {{TIME_TAKEN}} seconds\n{{/if}}',
      `TIME TAKEN: ${request.timeTakenSec} seconds`);
  } else {
    prompt = prompt.replace('{{#if TIME_TAKEN}}\nTIME TAKEN: {{TIME_TAKEN}} seconds\n{{/if}}', '');
  }
  
  // Call AI with retry and validation
  return callGradingAIWithRetry(openai, prompt, 'oral');
}

/**
 * Grade a drafting response
 */
export async function gradeDraftingResponse(request: GradingRequest): Promise<GradingOutput> {
  const openai = getOpenAI();
  if (!openai) {
    throw new Error('AI grading not available');
  }
  
  const rubric = DRAFTING_RUBRIC_DIMENSIONS.map(d => 
    `${d.category} (${(d.weight * 100).toFixed(0)}%): ${d.description}`
  ).join('\n');
  
  let prompt = DRAFTING_GRADING_PROMPT
    .replace('{{RUBRIC}}', rubric)
    .replace('{{PROMPT}}', request.prompt)
    .replace('{{RESPONSE}}', request.response);
  
  if (request.context) {
    prompt = prompt.replace('{{#if CONTEXT}}\nCONTEXT/FACTS:\n{{CONTEXT}}\n{{/if}}',
      `CONTEXT/FACTS:\n${request.context}`);
  } else {
    prompt = prompt.replace('{{#if CONTEXT}}\nCONTEXT/FACTS:\n{{CONTEXT}}\n{{/if}}', '');
  }
  
  if (request.relevantAuthorities?.length) {
    const authText = request.relevantAuthorities.map(a => `- ${a.citation}`).join('\n');
    prompt = prompt.replace('{{#if AUTHORITIES}}\nRELEVANT AUTHORITIES:\n{{AUTHORITIES}}\n{{/if}}',
      `RELEVANT AUTHORITIES:\n${authText}`);
  } else {
    prompt = prompt.replace('{{#if AUTHORITIES}}\nRELEVANT AUTHORITIES:\n{{AUTHORITIES}}\n{{/if}}', '');
  }
  
  // Call AI with retry and validation
  return callGradingAIWithRetry(openai, prompt, 'drafting');
}

/**
 * Grade MCQ response (simple, no AI needed)
 */
export function gradeMcqResponse(
  selectedOption: string,
  correctOption: string,
  options: { label: string; text: string; isCorrect: boolean }[]
): GradingOutput {
  const isCorrect = selectedOption === correctOption;
  
  return {
    scoreNorm: isCorrect ? 1.0 : 0.0,
    scoreRaw: isCorrect ? 1 : 0,
    maxScore: 1,
    rubricBreakdown: [{
      category: 'mcq_accuracy',
      score: isCorrect ? 1 : 0,
      maxScore: 1,
      feedback: isCorrect 
        ? 'Correct answer selected.' 
        : `Incorrect. You selected "${selectedOption}" but the correct answer was "${correctOption}".`,
    }],
    missingPoints: isCorrect ? [] : [options.find(o => o.isCorrect)?.text ?? correctOption],
    errorTags: isCorrect ? [] : ['WRONG_ANSWER'],
    nextDrills: [],
    modelOutline: options.find(o => o.isCorrect)?.text ?? '',
    evidenceRequests: [],
  };
}

/**
 * Main grading function - routes to appropriate grader
 */
export async function gradeResponse(request: GradingRequest): Promise<GradingOutput> {
  switch (request.format) {
    case 'written':
      return gradeWrittenResponse(request);
    case 'oral':
      return gradeOralResponse(request);
    case 'drafting':
      return gradeDraftingResponse(request);
    case 'mcq':
      // MCQ handled separately with simple comparison
      throw new Error('Use gradeMcqResponse for MCQ grading');
    default:
      throw new Error(`Unknown format: ${request.format}`);
  }
}

/**
 * Validate grading output schema using Zod
 * Throws detailed errors for invalid output
 */
function validateGradingOutput(output: unknown): GradingOutput {
  const result = GradingOutputSchema.safeParse(output);
  
  if (!result.success) {
    const errors = result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`);
    throw new Error(`Grading output validation failed:\n${errors.join('\n')}`);
  }
  
  return result.data as GradingOutput;
}

/**
 * Extract JSON from AI response, handling potential markdown wrapping
 */
function extractJsonFromResponse(text: string): string {
  // Try to extract JSON from markdown code blocks
  const jsonBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonBlockMatch) {
    return jsonBlockMatch[1].trim();
  }
  
  // Try to find raw JSON object
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    return jsonMatch[0];
  }
  
  return text.trim();
}

/**
 * Call AI with retry logic and validation
 */
async function callGradingAIWithRetry(
  openai: OpenAI,
  prompt: string,
  format: string,
  attempt: number = 1
): Promise<GradingOutput> {
  try {
    const response = await openai.responses.create({
      model: GRADING_MODEL,
      input: prompt,
    });
    
    const content = response.output_text;
    if (!content) {
      throw new Error('Empty response from AI');
    }
    
    // Extract and parse JSON
    const jsonText = extractJsonFromResponse(content);
    let parsed: unknown;
    
    try {
      parsed = JSON.parse(jsonText);
    } catch (parseError) {
      throw new Error(`JSON parse failed: ${parseError}`);
    }
    
    // Validate with Zod
    return validateGradingOutput(parsed);
    
  } catch (error) {
    console.error(`Grading attempt ${attempt} failed:`, error);
    
    if (attempt < GRADING_CONFIG.maxRetries) {
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, GRADING_CONFIG.retryDelayMs * attempt));
      
      // Retry with stronger JSON instruction
      const retryPrompt = prompt + `\n\nIMPORTANT: Your previous response was not valid JSON. Respond with ONLY a valid JSON object, no markdown, no explanations, no code blocks. Start with { and end with }.`;
      
      return callGradingAIWithRetry(openai, retryPrompt, format, attempt + 1);
    }
    
    // All retries exhausted - use fallback if enabled
    if (GRADING_CONFIG.fallbackEnabled) {
      console.warn(`Grading fallback activated for ${format} after ${attempt} attempts`);
      return createFallbackGradingOutput(format);
    }
    
    throw new Error(`Grading failed after ${attempt} attempts: ${error}`);
  }
}

/**
 * Create a fallback grading output when AI fails
 * Returns a conservative "needs manual review" response
 */
function createFallbackGradingOutput(format: string): GradingOutput {
  const rubricDimensions = format === 'oral' 
    ? ORAL_RUBRIC_DIMENSIONS 
    : format === 'drafting' 
      ? DRAFTING_RUBRIC_DIMENSIONS 
      : WRITTEN_RUBRIC_DIMENSIONS;
  
  return {
    scoreNorm: 0.5, // Conservative middle score
    scoreRaw: Math.floor(rubricDimensions.length * 2.5),
    maxScore: rubricDimensions.length * 5,
    rubricBreakdown: rubricDimensions.map(d => ({
      category: d.category,
      score: 2.5, // Middle score
      maxScore: 5,
      feedback: 'Automatic grading failed - manual review required',
      missingPoints: [],
    })),
    missingPoints: ['Grading requires manual review'],
    errorTags: ['GRADING_FAILED'],
    nextDrills: [],
    modelOutline: 'Unable to generate model outline - grading service error',
    evidenceRequests: [],
  };
}
