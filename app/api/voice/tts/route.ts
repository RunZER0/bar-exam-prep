import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import OpenAI from 'openai';
import { synthesizeSpeech, type TTSVoice } from '@/lib/voice/speak';
import { getPersona } from '@/lib/voice/personas';
import { logTTSRequest } from '@/lib/ai/telemetry';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// POST - Convert text to speech using OpenAI TTS
export const POST = withAuth(async (req: NextRequest, user) => {
  try {
    const { text, voice = 'alloy', speed = 1.0, panelistId } = await req.json();

    if (!text?.trim()) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 });
    }

    // Look up persona instructions if a panelist ID is provided
    const persona = panelistId ? getPersona(panelistId) : null;

    const result = await synthesizeSpeech(openai, {
      text,
      voice: (persona?.voice || voice) as TTSVoice,
      speed,
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
