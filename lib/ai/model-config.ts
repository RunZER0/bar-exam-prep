/**
 * Centralized AI Model Configuration
 * 
 * The Triumvirate:
 * - ORCHESTRATOR: GPT-5.2 (High-Reasoning) - Queue management, path selection
 * - MENTOR: GPT-5.2 (Mentorship Tone) - Narrative notes, instructional content
 * - AUDITOR: Claude 4.5 Sonnet - Redline engine, cascading failure analysis
 */

// === Model Assignments (Hard-Locked) ===
export const ORCHESTRATOR_MODEL = process.env.ORCHESTRATOR_MODEL || 'gpt-5.2';
export const MENTOR_MODEL = process.env.MENTOR_MODEL || 'gpt-5.2';
export const AUDITOR_MODEL = process.env.AUDITOR_MODEL || 'claude-sonnet-4-20250514';

// === Assessment & Grading ===
export const ASSESSMENT_MODEL = process.env.ASSESSMENT_MODEL || 'gpt-5.2';
export const GRADING_MODEL = process.env.GRADING_MODEL || 'gpt-5.2';

// === Fast Operations ===
export const FAST_MODEL = process.env.OPENAI_FAST_MODEL || 'gpt-5.2';

// === API Key Getters ===
export function getOpenAIKey(): string | undefined {
  return process.env.OPENAI_API_KEY;
}

export function getAnthropicKey(): string | undefined {
  return process.env.ANTHROPIC_API_KEY;
}

// === Validation ===
export function validateModelConfig(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!process.env.OPENAI_API_KEY) errors.push('OPENAI_API_KEY not set');
  if (!process.env.ANTHROPIC_API_KEY) errors.push('ANTHROPIC_API_KEY not set');
  return { valid: errors.length === 0, errors };
}

// === Node State Machine ===
export type NodePhase = 'NOTE' | 'EXHIBIT' | 'DIAGNOSIS' | 'MASTERY';
export const NODE_PHASES: NodePhase[] = ['NOTE', 'EXHIBIT', 'DIAGNOSIS', 'MASTERY'];

export function getNextPhase(current: NodePhase): NodePhase | null {
  const idx = NODE_PHASES.indexOf(current);
  return idx < NODE_PHASES.length - 1 ? NODE_PHASES[idx + 1] : null;
}
