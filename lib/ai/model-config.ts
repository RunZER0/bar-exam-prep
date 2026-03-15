/**
 * Centralized AI Model Configuration
 * 
 * The Triumvirate:
 * - ORCHESTRATOR: GPT-5.2 (High-Reasoning) - Queue management, path selection
 * - MENTOR: GPT-5.2 (Mentorship Tone) - Narrative notes, instructional content
 * - AUDITOR: Claude Sonnet 4.6 - Redline engine, cascading failure analysis
 * 
 * MINIMUM MODEL FLOOR: gpt-5-mini — fast, cheap, reliable.
 */

// === Model Assignments (Hard-Locked) ===
export const ORCHESTRATOR_MODEL = process.env.ORCHESTRATOR_MODEL || 'gpt-5.2';
export const MENTOR_MODEL = process.env.MENTOR_MODEL || 'gpt-5.2';
export const AUDITOR_MODEL = process.env.AUDITOR_MODEL || 'claude-sonnet-4.6-20260312';

// === Assessment & Grading ===
export const ASSESSMENT_MODEL = process.env.ASSESSMENT_MODEL || 'gpt-5.2';
export const GRADING_MODEL = process.env.GRADING_MODEL || 'gpt-5.2';

// === Fast Operations (downgraded from gpt-5.2 to mini for cost savings) ===
export const FAST_MODEL = process.env.OPENAI_FAST_MODEL || 'gpt-5-mini';

// === Minimum Floor Model — fast & cheap for streaming, oral exams ===
export const MINI_MODEL = process.env.MINI_MODEL || 'gpt-5-mini';

// === Quiz Model — non-reasoning model for structured JSON quiz generation ===
export const QUIZ_MODEL = process.env.QUIZ_MODEL || 'gpt-4o-mini';

// === Router Model — lightweight model for smart routing decisions ===
export const ROUTER_MODEL = process.env.ROUTER_MODEL || 'gpt-5-mini';

// === Voice / Speech Models ===
export const TTS_MODEL = process.env.TTS_MODEL || 'gpt-4o-mini-tts';
export const TTS_MODEL_LEGACY = 'tts-1';
export const STT_MODEL = process.env.STT_MODEL || 'gpt-4o-mini-transcribe';
export const STT_MODEL_LEGACY = 'whisper-1';

// === Feature Flags ===
// Smart Chat Router: deterministic pre-checks + AI fallback to route between mini and 5.2
export const SMART_CHAT_ROUTER_ENABLED = process.env.SMART_CHAT_ROUTER_ENABLED !== 'false'; // on by default
// Clarify Router: same router for clarification mode
export const CLARIFY_ROUTER_ENABLED = process.env.CLARIFY_ROUTER_ENABLED !== 'false'; // on by default
// New TTS model (gpt-4o-mini-tts with instructions support)
export const NEW_TTS_ENABLED = process.env.NEW_TTS_ENABLED !== 'false'; // on by default
// New STT model (gpt-4o-mini-transcribe)
export const NEW_STT_ENABLED = process.env.NEW_STT_ENABLED !== 'false'; // on by default

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
