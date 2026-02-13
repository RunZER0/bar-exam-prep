import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth/middleware';
import OpenAI from 'openai';

/**
 * Voice Transcription API
 * Converts audio to text using OpenAI Whisper
 */

export async function POST(request: NextRequest) {
  try {
    const user = await verifyAuth(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ 
        error: 'Voice transcription is not configured. Please contact support.' 
      }, { status: 503 });
    }

    const formData = await request.formData();
    const audioFile = formData.get('audio') as File | null;

    if (!audioFile) {
      return NextResponse.json({ error: 'No audio file provided' }, { status: 400 });
    }

    // Validate file size (max 25MB for Whisper)
    if (audioFile.size > 25 * 1024 * 1024) {
      return NextResponse.json({ 
        error: 'Audio file too large. Maximum size is 25MB.' 
      }, { status: 400 });
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // Transcribe the audio
    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-1',
      language: 'en', // Can be made dynamic based on user preference
      response_format: 'json',
    });

    return NextResponse.json({
      success: true,
      text: transcription.text,
      duration: audioFile.size / 16000, // Rough estimate
    });
  } catch (error: any) {
    console.error('Transcription error:', error);
    
    if (error.code === 'audio_too_short') {
      return NextResponse.json({ 
        error: 'Audio recording is too short. Please record at least 1 second.' 
      }, { status: 400 });
    }
    
    return NextResponse.json({ 
      error: 'Failed to transcribe audio. Please try again.' 
    }, { status: 500 });
  }
}
