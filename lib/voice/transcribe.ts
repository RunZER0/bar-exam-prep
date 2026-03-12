/**
 * Speech-to-Text Service
 * 
 * Wraps OpenAI transcription with:
 * - Feature-flag switch between gpt-4o-mini-transcribe and legacy whisper-1
 * - Language hint support (default: English)
 * - Automatic fallback to whisper-1 on error
 * - Request-level telemetry logging
 * 
 * gpt-4o-mini-transcribe advantages over whisper-1:
 * - Better accuracy for accented English (Kenyan English)
 * - Token-based pricing (cheaper for short clips)
 * - Supports streaming (not used here yet)
 * 
 * Pricing (as of March 2026):
 * - gpt-4o-mini-transcribe: $0.003/min (vs whisper-1: $0.006/min)
 */

import OpenAI from 'openai';
import {
  STT_MODEL,
  STT_MODEL_LEGACY,
  NEW_STT_ENABLED,
} from '@/lib/ai/model-config';

export interface TranscribeOptions {
  /** Audio file (from FormData) */
  file: File;
  /** ISO-639-1 language code (default: 'en') */
  language?: string;
  /** Optional prompt to guide the model's style or context */
  prompt?: string;
}

export interface TranscribeResult {
  /** Transcribed text */
  text: string;
  /** Which model was actually used */
  model: string;
  /** Request latency in ms */
  latency_ms: number;
}

/**
 * Transcribe an audio file to text.
 * 
 * Uses gpt-4o-mini-transcribe when NEW_STT_ENABLED is true (default),
 * falls back to whisper-1 otherwise. If gpt-4o-mini-transcribe errors,
 * automatically retries with whisper-1.
 */
export async function transcribeAudio(
  openai: OpenAI,
  options: TranscribeOptions,
): Promise<TranscribeResult> {
  const {
    file,
    language = 'en',
    prompt,
  } = options;

  const model = NEW_STT_ENABLED ? STT_MODEL : STT_MODEL_LEGACY;
  const start = Date.now();

  try {
    const requestBody: any = {
      file,
      model,
      language,
    };

    // gpt-4o-mini-transcribe only supports 'json' response_format
    if (model === STT_MODEL) {
      requestBody.response_format = 'json';
    }

    // Prompt is supported by both models (but not by gpt-4o-transcribe-diarize)
    if (prompt) {
      requestBody.prompt = prompt;
    }

    const transcription = await openai.audio.transcriptions.create(requestBody);

    return {
      text: transcription.text,
      model,
      latency_ms: Date.now() - start,
    };
  } catch (error: any) {
    // If new model fails, try legacy as fallback
    if (NEW_STT_ENABLED && model !== STT_MODEL_LEGACY) {
      console.warn(`[STT] ${model} failed (${error.message}), falling back to ${STT_MODEL_LEGACY}`);
      const fallbackStart = Date.now();
      const transcription = await openai.audio.transcriptions.create({
        file,
        model: STT_MODEL_LEGACY,
        language,
      });
      return {
        text: transcription.text,
        model: STT_MODEL_LEGACY,
        latency_ms: Date.now() - fallbackStart,
      };
    }
    throw error;
  }
}
