/**
 * Router Structured Output Schema
 * 
 * Defines the Zod schema for the AI router's structured response.
 * Used when deterministic pre-checks are inconclusive and the
 * GPT-5.2-mini router model must classify the query.
 */

import { z } from 'zod';

/**
 * The route the router assigns to a query.
 * - 'mini': GPT-5.2-mini — fast, cheap, sufficient for straightforward questions
 * - 'frontier': GPT-5.2 — full frontier model for complex reasoning
 */
export const RouteEnum = z.enum(['mini', 'frontier']);
export type Route = z.infer<typeof RouteEnum>;

/**
 * Structured output from the AI router model.
 */
export const RouterOutputSchema = z.object({
  /** Which model tier to route this query to */
  route: RouteEnum,
  /** 0-100 complexity score. Higher = more complex. */
  complexity_score: z.number().int().min(0).max(100),
  /** Whether the query needs RAG (vector search / knowledge base lookup) */
  needs_rag: z.boolean(),
  /** Whether the query needs tool use (web search, function calling) */
  needs_tools: z.boolean(),
  /** Brief reason for the routing decision (for logging/debugging) */
  reason: z.string(),
});

export type RouterOutput = z.infer<typeof RouterOutputSchema>;

/**
 * JSON Schema representation for OpenAI's response_format parameter.
 * This is derived from the Zod schema but provided explicitly for
 * the Chat Completions API's json_schema format.
 */
export const ROUTER_JSON_SCHEMA = {
  name: 'router_decision',
  strict: true,
  schema: {
    type: 'object' as const,
    properties: {
      route: {
        type: 'string' as const,
        enum: ['mini', 'frontier'],
        description: 'Which model tier to use: mini for simple queries, frontier for complex ones',
      },
      complexity_score: {
        type: 'integer' as const,
        minimum: 0,
        maximum: 100,
        description: 'Complexity score from 0 (trivial) to 100 (extremely complex)',
      },
      needs_rag: {
        type: 'boolean' as const,
        description: 'Whether the query requires vector search / knowledge base lookup',
      },
      needs_tools: {
        type: 'boolean' as const,
        description: 'Whether the query requires tool use (web search, function calling)',
      },
      reason: {
        type: 'string' as const,
        description: 'Brief reason for the routing decision',
      },
    },
    required: ['route', 'complexity_score', 'needs_rag', 'needs_tools', 'reason'],
    additionalProperties: false,
  },
} as const;
