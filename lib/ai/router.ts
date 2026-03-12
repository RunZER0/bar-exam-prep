/**
 * Smart Chat Router
 * 
 * Determines whether a user query should be handled by the lightweight
 * GPT-5.2-mini or the full GPT-5.2 frontier model.
 * 
 * Architecture:
 * 1. Deterministic pre-checks run FIRST (zero-cost, instant)
 *    - Keyword/pattern matching for known-simple and known-complex patterns
 *    - Message length heuristics
 *    - Attachment detection
 * 2. If pre-checks are inconclusive, falls back to a GPT-5.2-mini
 *    structured-output call (~$0.0003/call) to classify the query
 * 
 * Design principles:
 * - Deterministic checks should resolve ~70% of queries without any AI call
 * - AI router call is a safety net, not the primary path
 * - Always fail-open to 'mini' if the router itself errors
 * - Fully observable: every decision is logged with reason + latency
 */

import OpenAI from 'openai';
import { ROUTER_MODEL } from './model-config';
import { RouterOutputSchema, ROUTER_JSON_SCHEMA, type RouterOutput, type Route } from './router-schema';

// ─── Deterministic Pattern Lists ───────────────────────────────────

/** Patterns that ALWAYS route to frontier (complex reasoning required) */
const FRONTIER_PATTERNS: RegExp[] = [
  // Multi-step legal analysis
  /\b(compare|contrast|distinguish|reconcile|analyze|analyse)\b.*\b(with|and|from|between)\b/i,
  // Complex legal reasoning
  /\b(constitutional\s+validity|constitutionality|judicial\s+review)\b/i,
  /\b(human\s+rights?\s+implications?|fundamental\s+rights?)\b/i,
  // Multi-provision cross-referencing
  /\b(read\s+together\s+with|in\s+light\s+of|vis[- ]?[àa][- ]?vis)\b/i,
  // Case analysis requiring synthesis
  /\b(ratio\s+decidendi|obiter\s+dicta|stare\s+decisis|distinguishing|overruled)\b/i,
  // Draft / construct complex documents
  /\b(draft|prepare|draw\s+up)\b.*\b(plaint|petition|affidavit|contract|agreement|deed|charge)\b/i,
  // Hypothetical scenario analysis
  /\b(hypothetical|scenario|advise\s+(the\s+)?client|what\s+would\s+happen\s+if)\b/i,
  // Step-by-step procedure spanning multiple statutes
  /\b(step[- ]?by[- ]?step|procedure\s+for|process\s+of)\b.*\b(filing|registration|incorporation|appeal)\b/i,
  // Exam instruction patterns
  /\b(discuss\s+the\s+law|critically\s+(examine|assess|evaluate|discuss))\b/i,
];

/** Patterns that ALWAYS route to mini (straightforward lookups) */
const MINI_PATTERNS: RegExp[] = [
  // Direct definition requests
  /^what\s+(is|are|does)\s+/i,
  /^define\s+/i,
  /\b(definition\s+of|meaning\s+of)\b/i,
  // Simple section lookups
  /^(what|which)\s+section\b/i,
  /\bsection\s+\d+/i,
  // Yes/no or straightforward factual
  /^(is|are|can|does|do|has|have|will|would|should)\s+/i,
  // Greeting / small talk
  /^(hi|hello|hey|good\s+(morning|afternoon|evening)|thanks?|thank\s+you|okay|ok)\b/i,
  // List requests (simple recall)
  /^(list|enumerate|name|state|mention)\s+(the|all|five|three|two|four|six|seven|eight|nine|ten)\b/i,
  // Simple time/date questions
  /\b(when\s+(is|was|does)|deadline\s+for|time\s+limit)\b/i,
  // Quick clarification follow-ups
  /^(what\s+about|how\s+about|and\s+what|also)\b/i,
];

/** Attachments that force frontier (image analysis, document review) */
const COMPLEX_ATTACHMENT_TYPES = ['image', 'document', 'pdf'];

// ─── Deterministic Router ──────────────────────────────────────────

export interface RouterDecision {
  route: Route;
  complexity_score: number;
  needs_rag: boolean;
  needs_tools: boolean;
  reason: string;
  method: 'deterministic' | 'ai-router';
  latency_ms: number;
}

/**
 * Deterministic pre-checks. Returns a decision if confident, null if inconclusive.
 */
function deterministicRoute(
  message: string,
  attachments?: Array<{ type: string }>,
  competencyType?: string,
): RouterDecision | null {
  const start = Date.now();
  const trimmed = message.trim();
  const wordCount = trimmed.split(/\s+/).length;

  // Rule 1: Research competency always goes to frontier (already gated)
  if (competencyType === 'research') {
    return {
      route: 'frontier',
      complexity_score: 75,
      needs_rag: true,
      needs_tools: true,
      reason: 'Research competency → frontier + tools',
      method: 'deterministic',
      latency_ms: Date.now() - start,
    };
  }

  // Rule 2: Complex attachments → frontier
  if (attachments?.some(a => COMPLEX_ATTACHMENT_TYPES.includes(a.type))) {
    return {
      route: 'frontier',
      complexity_score: 65,
      needs_rag: false,
      needs_tools: false,
      reason: 'Complex attachment (image/document) detected',
      method: 'deterministic',
      latency_ms: Date.now() - start,
    };
  }

  // Rule 3: Very short messages (≤5 words) → mini
  if (wordCount <= 5 && !FRONTIER_PATTERNS.some(p => p.test(trimmed))) {
    return {
      route: 'mini',
      complexity_score: 10,
      needs_rag: false,
      needs_tools: false,
      reason: `Short query (${wordCount} words)`,
      method: 'deterministic',
      latency_ms: Date.now() - start,
    };
  }

  // Rule 4: Check frontier patterns
  for (const pattern of FRONTIER_PATTERNS) {
    if (pattern.test(trimmed)) {
      return {
        route: 'frontier',
        complexity_score: 70,
        needs_rag: wordCount > 15,
        needs_tools: false,
        reason: `Matched frontier pattern: ${pattern.source.slice(0, 60)}`,
        method: 'deterministic',
        latency_ms: Date.now() - start,
      };
    }
  }

  // Rule 5: Check mini patterns
  for (const pattern of MINI_PATTERNS) {
    if (pattern.test(trimmed)) {
      return {
        route: 'mini',
        complexity_score: 20,
        needs_rag: false,
        needs_tools: false,
        reason: `Matched mini pattern: ${pattern.source.slice(0, 60)}`,
        method: 'deterministic',
        latency_ms: Date.now() - start,
      };
    }
  }

  // Rule 6: Very long messages (>80 words) lean toward frontier
  if (wordCount > 80) {
    return {
      route: 'frontier',
      complexity_score: 60,
      needs_rag: true,
      needs_tools: false,
      reason: `Long query (${wordCount} words) — likely complex`,
      method: 'deterministic',
      latency_ms: Date.now() - start,
    };
  }

  // Inconclusive — needs AI router
  return null;
}

// ─── AI Router Fallback ────────────────────────────────────────────

const ROUTER_SYSTEM_PROMPT = `You are a query classifier for a Kenyan bar exam study platform.
Your job: decide if a student's question needs the full frontier model (gpt-5.2) or the lighter mini model (gpt-5.2-mini).

Route to FRONTIER when:
- Multi-step legal reasoning or analysis is required
- Cross-referencing multiple statutes, provisions, or cases
- Hypothetical scenario analysis ("advise the client...")
- Drafting legal documents
- Constitutional validity or human rights analysis
- Comparative law or policy discussion
- The question is inherently open-ended and requires depth

Route to MINI when:
- Simple definitions or explanations
- Direct statutory section lookups
- Yes/no factual questions
- Greetings, follow-ups, or brief clarifications
- List/enumerate questions with known answers
- Procedural questions with straightforward answers

Respond with the structured JSON output.`;

/**
 * Call the AI router to classify a query when deterministic checks are inconclusive.
 */
async function aiRouterCall(
  message: string,
  openai: OpenAI,
): Promise<RouterDecision> {
  const start = Date.now();

  try {
    const completion = await openai.chat.completions.create({
      model: ROUTER_MODEL,
      messages: [
        { role: 'system', content: ROUTER_SYSTEM_PROMPT },
        { role: 'user', content: message.slice(0, 500) }, // cap input to keep router fast
      ],
      response_format: {
        type: 'json_schema',
        json_schema: ROUTER_JSON_SCHEMA,
      },
      temperature: 0,
      max_completion_tokens: 150,
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) {
      throw new Error('Router returned empty response');
    }

    const parsed = RouterOutputSchema.parse(JSON.parse(raw));
    return {
      ...parsed,
      method: 'ai-router',
      latency_ms: Date.now() - start,
    };
  } catch (error) {
    console.error('[Router] AI router call failed, falling back to mini:', error);
    // Fail-open to mini — never block the user
    return {
      route: 'mini',
      complexity_score: 30,
      needs_rag: false,
      needs_tools: false,
      reason: 'AI router error — fail-open to mini',
      method: 'ai-router',
      latency_ms: Date.now() - start,
    };
  }
}

// ─── Public API ────────────────────────────────────────────────────

/**
 * Route a user query to the appropriate model tier.
 * 
 * @param message - The user's message text
 * @param openai - OpenAI client instance (passed in to avoid creating new clients)
 * @param options - Additional context for routing decisions
 * @returns RouterDecision with route, scores, reason, method, and latency
 */
export async function routeQuery(
  message: string,
  openai: OpenAI,
  options: {
    competencyType?: string;
    attachments?: Array<{ type: string }>;
  } = {},
): Promise<RouterDecision> {
  // Step 1: Try deterministic pre-checks (free, instant)
  const deterministicResult = deterministicRoute(
    message,
    options.attachments,
    options.competencyType,
  );

  if (deterministicResult) {
    console.log(`[Router] Deterministic: ${deterministicResult.route} (${deterministicResult.reason}) [${deterministicResult.latency_ms}ms]`);
    return deterministicResult;
  }

  // Step 2: AI router fallback (~$0.0003/call)
  const aiResult = await aiRouterCall(message, openai);
  console.log(`[Router] AI: ${aiResult.route} (score=${aiResult.complexity_score}, reason=${aiResult.reason}) [${aiResult.latency_ms}ms]`);
  return aiResult;
}
