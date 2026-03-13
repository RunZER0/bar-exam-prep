import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import OpenAI from 'openai';
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

    const start = Date.now();
    const result = await openai.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-1',
      language: 'en',
      response_format: 'json',
    });
    const latencyMs = Date.now() - start;

    // Log telemetry
    logSTTRequest({
      userId: user.id,
      model: 'whisper-1',
      fallback: true,
      latency_ms: latencyMs,
    });

    return NextResponse.json({
      text: result.text,
      success: true,
      model: 'whisper-1',
    });
  } catch (error: any) {
    console.error('STT error:', error);
    return NextResponse.json({ error: 'Transcription failed' }, { status: 500 });
  }
});
