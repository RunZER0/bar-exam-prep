import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import OpenAI from 'openai';
import { transcribeAudio } from '@/lib/voice/transcribe';
import { logSTTRequest } from '@/lib/ai/telemetry';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// POST - Convert speech to text using OpenAI transcription
export const POST = withAuth(async (req: NextRequest, user) => {
  try {
    const formData = await req.formData();
    const audioFile = formData.get('audio') as File;

    if (!audioFile) {
      return NextResponse.json({ error: 'Audio file required' }, { status: 400 });
    }

    const result = await transcribeAudio(openai, {
      file: audioFile,
      language: 'en',
    });

    // Log telemetry
    logSTTRequest({
      userId: user.id,
      model: result.model,
      fallback: result.model === 'whisper-1',
      latency_ms: result.latency_ms,
    });

    return NextResponse.json({
      text: result.text,
      success: true,
      model: result.model,
    });
  } catch (error: any) {
    console.error('STT error:', error);
    return NextResponse.json({ error: 'Transcription failed' }, { status: 500 });
  }
});
