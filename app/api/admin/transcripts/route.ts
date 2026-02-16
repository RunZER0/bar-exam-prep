/**
 * Admin API: Transcript Management
 * GET - List all lectures
 * POST - Upload new transcript
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { 
  ingestTranscript, 
  listLectures,
  TranscriptUploadInput 
} from '@/lib/services/transcript-ingestion';

// GET /api/admin/transcripts - List all lectures
export async function GET(request: NextRequest) {
  try {
    const lectures = await listLectures();
    
    return NextResponse.json({
      success: true,
      lectures,
      total: lectures.length,
    });
  } catch (error) {
    console.error('Error listing lectures:', error);
    return NextResponse.json(
      { error: 'Failed to list lectures' },
      { status: 500 }
    );
  }
}

// POST /api/admin/transcripts - Upload new transcript
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate required fields
    if (!body.unitId || !body.title || !body.transcriptContent) {
      return NextResponse.json(
        { error: 'Missing required fields: unitId, title, transcriptContent' },
        { status: 400 }
      );
    }
    
    const input: TranscriptUploadInput = {
      unitId: body.unitId,
      title: body.title,
      lecturerName: body.lecturerName,
      lectureDate: body.lectureDate,
      source: body.source || 'ADMIN_UPLOAD',
      transcriptContent: body.transcriptContent,
      format: body.format || 'txt',
      durationMinutes: body.durationMinutes,
    };
    
    const result = await ingestTranscript(input);
    
    return NextResponse.json({
      success: true,
      lectureId: result.lectureId,
      chunksCreated: result.chunksCreated,
      mappingSuggestions: result.mappingSuggestions,
      message: `Transcript uploaded successfully. ${result.chunksCreated} chunks created, ${result.mappingSuggestions} skill mapping suggestions generated.`,
    });
  } catch (error) {
    console.error('Error uploading transcript:', error);
    return NextResponse.json(
      { error: 'Failed to upload transcript' },
      { status: 500 }
    );
  }
}
