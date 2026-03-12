/**
 * AI Telemetry — Structured Logging for Router & Voice Decisions
 * 
 * Logs all routing decisions and voice operations to console with
 * structured JSON payloads. Easy to pipe into any log aggregator
 * (Datadog, Logtail, etc.) when ready.
 * 
 * In production, these logs enable:
 * - Monitoring router accuracy (are frontier calls actually complex?)
 * - Tracking voice model fallback rates
 * - Cost attribution per feature/user
 * - Latency percentiles for each model
 */

import type { RouterDecision } from './router';

export interface RouterLogEntry {
  event: 'router_decision';
  timestamp: string;
  userId?: string;
  competencyType: string;
  messagePreview: string;
  decision: RouterDecision;
}

export interface VoiceLogEntry {
  event: 'tts_request' | 'stt_request';
  timestamp: string;
  userId?: string;
  model: string;
  fallback: boolean;
  latency_ms: number;
  inputLength?: number;   // chars for TTS, undefined for STT
  persona?: string;       // panelist ID for TTS
  instructionsApplied?: boolean;
}

/**
 * Log a router decision. Structured JSON to stdout.
 */
export function logRouterDecision(
  decision: RouterDecision,
  context: {
    userId?: string;
    competencyType: string;
    message: string;
  },
): void {
  const entry: RouterLogEntry = {
    event: 'router_decision',
    timestamp: new Date().toISOString(),
    userId: context.userId,
    competencyType: context.competencyType,
    messagePreview: context.message.slice(0, 80),
    decision,
  };

  console.log(`[AI-Telemetry] ${JSON.stringify(entry)}`);
}

/**
 * Log a TTS request.
 */
export function logTTSRequest(
  data: {
    userId?: string;
    model: string;
    fallback: boolean;
    latency_ms: number;
    inputLength: number;
    persona?: string;
    instructionsApplied: boolean;
  },
): void {
  const entry: VoiceLogEntry = {
    event: 'tts_request',
    timestamp: new Date().toISOString(),
    userId: data.userId,
    model: data.model,
    fallback: data.fallback,
    latency_ms: data.latency_ms,
    inputLength: data.inputLength,
    persona: data.persona,
    instructionsApplied: data.instructionsApplied,
  };

  console.log(`[AI-Telemetry] ${JSON.stringify(entry)}`);
}

/**
 * Log an STT request.
 */
export function logSTTRequest(
  data: {
    userId?: string;
    model: string;
    fallback: boolean;
    latency_ms: number;
  },
): void {
  const entry: VoiceLogEntry = {
    event: 'stt_request',
    timestamp: new Date().toISOString(),
    userId: data.userId,
    model: data.model,
    fallback: data.fallback,
    latency_ms: data.latency_ms,
  };

  console.log(`[AI-Telemetry] ${JSON.stringify(entry)}`);
}
