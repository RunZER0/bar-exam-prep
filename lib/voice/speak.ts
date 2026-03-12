/**
 * Text-to-Speech Service
 * 
 * Wraps OpenAI TTS with:
 * - Feature-flag switch between gpt-4o-mini-tts and legacy tts-1
 * - Persona-based voice instructions (gpt-4o-mini-tts only)
 * - Automatic text truncation (API max: 4096 chars)
 * - Request-level telemetry logging
 * 
 * gpt-4o-mini-tts advantages over tts-1:
 * - Supports `instructions` field for persona/tone control
 * - Better voice quality and naturalness
 * - Supports SSE streaming format
 * 
 * Pricing (as of March 2026):
 * - gpt-4o-mini-tts: $12/1M chars (vs tts-1: $15/1M chars)
 */

import OpenAI from 'openai';
import {
  TTS_MODEL,
  TTS_MODEL_LEGACY,
  NEW_TTS_ENABLED,
} from '@/lib/ai/model-config';

/** Built-in OpenAI voices */
export type TTSVoice =
  | 'alloy' | 'ash' | 'ballad' | 'coral' | 'echo'
  | 'fable' | 'onyx' | 'nova' | 'sage' | 'shimmer'
  | 'verse' | 'marin' | 'cedar';

export interface TTSOptions {
  /** Text to synthesize (max 4096 chars, auto-truncated) */
  text: string;
  /** Voice ID (default: 'alloy') */
  voice?: TTSVoice;
  /** Playback speed 0.25–4.0 (default: 1.0) */
  speed?: number;
  /** TTS persona instructions — only used with gpt-4o-mini-tts */
  instructions?: string;
  /** Output format (default: 'mp3') */
  format?: 'mp3' | 'opus' | 'aac' | 'flac' | 'wav' | 'pcm';
}

export interface TTSResult {
  /** Audio data as Buffer */
  audio: Buffer;
  /** Content type for the response header */
  contentType: string;
  /** Which model was actually used */
  model: string;
  /** Whether instructions were applied (only true for gpt-4o-mini-tts) */
  instructionsApplied: boolean;
  /** Request latency in ms */
  latency_ms: number;
}

const FORMAT_CONTENT_TYPES: Record<string, string> = {
  mp3: 'audio/mpeg',
  opus: 'audio/opus',
  aac: 'audio/aac',
  flac: 'audio/flac',
  wav: 'audio/wav',
  pcm: 'audio/pcm',
};

/**
 * Generate speech from text.
 * 
 * Uses gpt-4o-mini-tts when NEW_TTS_ENABLED is true (default),
 * falls back to tts-1 otherwise. If gpt-4o-mini-tts errors,
 * automatically retries with tts-1.
 */
export async function synthesizeSpeech(
  openai: OpenAI,
  options: TTSOptions,
): Promise<TTSResult> {
  const {
    text,
    voice = 'alloy',
    speed = 1.0,
    instructions,
    format = 'mp3',
  } = options;

  const trimmed = text.slice(0, 4096);
  const clampedSpeed = Math.max(0.25, Math.min(4.0, speed));
  const model = NEW_TTS_ENABLED ? TTS_MODEL : TTS_MODEL_LEGACY;
  const canUseInstructions = NEW_TTS_ENABLED && !!instructions;

  const start = Date.now();

  try {
    const requestBody: any = {
      model,
      voice,
      input: trimmed,
      speed: clampedSpeed,
      response_format: format,
    };

    // instructions field is only supported by gpt-4o-mini-tts
    if (canUseInstructions) {
      requestBody.instructions = instructions;
    }

    const response = await openai.audio.speech.create(requestBody);
    const buffer = Buffer.from(await response.arrayBuffer());

    return {
      audio: buffer,
      contentType: FORMAT_CONTENT_TYPES[format] || 'audio/mpeg',
      model,
      instructionsApplied: canUseInstructions,
      latency_ms: Date.now() - start,
    };
  } catch (error: any) {
    // If new model fails, try legacy as fallback
    if (NEW_TTS_ENABLED && model !== TTS_MODEL_LEGACY) {
      console.warn(`[TTS] ${model} failed (${error.message}), falling back to ${TTS_MODEL_LEGACY}`);
      const fallbackStart = Date.now();
      const response = await openai.audio.speech.create({
        model: TTS_MODEL_LEGACY,
        voice: voice as any,
        input: trimmed,
        speed: clampedSpeed,
        response_format: format,
      });
      const buffer = Buffer.from(await response.arrayBuffer());
      return {
        audio: buffer,
        contentType: FORMAT_CONTENT_TYPES[format] || 'audio/mpeg',
        model: TTS_MODEL_LEGACY,
        instructionsApplied: false,
        latency_ms: Date.now() - fallbackStart,
      };
    }
    throw error;
  }
}
