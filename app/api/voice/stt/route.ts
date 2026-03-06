import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// POST - Convert speech to text using OpenAI Whisper
export const POST = withAuth(async (req: NextRequest, user) => {
  try {
    const formData = await req.formData();
    const audioFile = formData.get('audio') as File;

    if (!audioFile) {
      return NextResponse.json({ error: 'Audio file required' }, { status: 400 });
    }

    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-1',
      language: 'en',
    });

    return NextResponse.json({
      text: transcription.text,
      success: true,
    });
  } catch (error: any) {
    console.error('STT error:', error);
    return NextResponse.json({ error: 'Transcription failed' }, { status: 500 });
  }
});
