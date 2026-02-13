import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth/middleware';
import { db } from '@/lib/db';
import { users, chatSessions, chatMessages, clarificationRequests } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import OpenAI from 'openai';

/**
 * File Upload API
 * Handles image, document, and audio file uploads
 * Returns a URL/reference that can be used in chat context
 */

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB limit
const ALLOWED_TYPES = {
  image: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  audio: ['audio/webm', 'audio/mp3', 'audio/wav', 'audio/m4a', 'audio/mpeg'],
  document: ['application/pdf', 'text/plain', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
};

export async function POST(request: NextRequest) {
  try {
    const user = await verifyAuth(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const sessionId = formData.get('sessionId') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ 
        error: 'File too large. Maximum size is 10MB.' 
      }, { status: 400 });
    }

    // Determine file type
    let fileType: 'image' | 'audio' | 'document' | null = null;
    if (ALLOWED_TYPES.image.includes(file.type)) fileType = 'image';
    else if (ALLOWED_TYPES.audio.includes(file.type)) fileType = 'audio';
    else if (ALLOWED_TYPES.document.includes(file.type)) fileType = 'document';

    if (!fileType) {
      return NextResponse.json({ 
        error: 'Unsupported file type. Please upload an image, audio file, or document.' 
      }, { status: 400 });
    }

    // Convert file to base64 for storage/processing
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const base64 = buffer.toString('base64');
    const dataUrl = `data:${file.type};base64,${base64}`;

    // For audio files, transcribe using OpenAI Whisper
    let transcription: string | null = null;
    if (fileType === 'audio' && process.env.OPENAI_API_KEY) {
      try {
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        
        // Create a proper file for the OpenAI API
        const audioFile = new File([buffer], file.name, { type: file.type });
        
        const transcriptionResponse = await openai.audio.transcriptions.create({
          file: audioFile,
          model: 'whisper-1',
          language: 'en',
        });
        
        transcription = transcriptionResponse.text;
      } catch (error) {
        console.error('Transcription error:', error);
        // Continue without transcription if it fails
      }
    }

    // Get DB user
    const dbUser = await db.query.users.findFirst({
      where: eq(users.firebaseUid, user.firebaseUid),
    });

    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Store the upload reference (for now using base64, can be swapped to S3/CloudStorage later)
    // In production, you'd upload to a storage service and get a URL
    const uploadId = crypto.randomUUID();
    
    // Save to clarification_requests for persistence
    await db.insert(clarificationRequests).values({
      userId: dbUser.id,
      sessionId: sessionId || null,
      attachmentType: fileType,
      attachmentUrl: dataUrl.substring(0, 200) + '...', // Store truncated for reference
      attachmentName: file.name,
      transcription,
    });

    return NextResponse.json({
      success: true,
      uploadId,
      fileType,
      fileName: file.name,
      mimeType: file.type,
      size: file.size,
      transcription, // Include transcription for audio files
      // For images, include the full data URL so it can be sent to vision models
      dataUrl: fileType === 'image' ? dataUrl : undefined,
    });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json({ error: 'Failed to process upload' }, { status: 500 });
  }
}
