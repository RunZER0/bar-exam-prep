import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import OpenAI from 'openai';
import { synthesizeSpeech, type TTSVoice } from '@/lib/voice/speak';
import { getPersona } from '@/lib/voice/personas';
import { logTTSRequest } from '@/lib/ai/telemetry';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function pickVariantVoice(
  baseVoice: string,
  variants: string[] | undefined,
  text: string,
): string {
  const pool = [baseVoice, ...(variants || [])].filter(Boolean);
  if (pool.length <= 1) return baseVoice;
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  }
  return pool[hash % pool.length];
}

function pickPersonaSpeed(panelistId: string | undefined, text: string, fallback: number): number {
  const baseByPersona: Record<string, number> = {
    'justice-mwangi': 0.98,
    'advocate-amara': 1.08,
    'prof-otieno': 1.0,
    'devils-advocate': 1.12,
  };
  const base = panelistId ? (baseByPersona[panelistId] ?? fallback) : fallback;
  let hash = 0;
  for (let i = 0; i < text.length; i++) hash = (hash * 33 + text.charCodeAt(i)) >>> 0;
  const jitter = ((hash % 5) - 2) * 0.01; // -0.02 .. +0.02
  return Math.max(0.9, Math.min(1.15, base + jitter));
}

// POST - Convert text to speech using OpenAI TTS
export const POST = withAuth(async (req: NextRequest, user) => {
  try {
    const { text, voice = 'alloy', speed = 1.0, panelistId } = await req.json();

    if (!text?.trim()) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 });
    }

    // Look up persona instructions if a panelist ID is provided
    const persona = panelistId ? getPersona(panelistId, voice) : null;

    const chosenVoice = persona
      ? pickVariantVoice(persona.voice, persona.voiceVariants, text)
      : voice;
    const chosenSpeed = pickPersonaSpeed(panelistId, text, speed);

    const result = await synthesizeSpeech(openai, {
      text,
      voice: chosenVoice as TTSVoice,
      speed: chosenSpeed,
      instructions: persona?.instructions,
    });

    // Log telemetry
    logTTSRequest({
      userId: user.id,
      model: result.model,
      fallback: result.model.startsWith('tts-'),
      latency_ms: result.latency_ms,
      inputLength: text.length,
      persona: panelistId,
      instructionsApplied: result.instructionsApplied,
    });

    return new NextResponse(new Uint8Array(result.audio), {
      headers: {
        'Content-Type': result.contentType,
        'Content-Length': result.audio.length.toString(),
      },
    });
  } catch (error: any) {
    console.error('TTS error:', error);
    return NextResponse.json({ error: 'TTS generation failed' }, { status: 500 });
  }
});
