import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth/middleware';

/**
 * Document Text Extraction API
 * Extracts readable text from PDF and DOCX files server-side
 * Returns the extracted text (truncated to 12000 chars for context window safety)
 */

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_TEXT_LENGTH = 12000; // ~3000 tokens — fits safely in context

export async function POST(request: NextRequest) {
  try {
    const user = await verifyAuth(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'File too large (max 10MB)' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    let extractedText = '';

    // ── PDF extraction ──
    if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
      try {
        const pdfModule = await import('pdf-parse');
        const pdfParse = (pdfModule as any).default || pdfModule;
        const pdfData = await pdfParse(buffer);
        extractedText = pdfData.text || '';
      } catch (err) {
        console.error('PDF parse error:', err);
        return NextResponse.json(
          { error: 'Failed to extract text from PDF. The file may be scanned/image-based.' },
          { status: 422 }
        );
      }
    }

    // ── DOCX extraction ──
    else if (
      file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      file.name.toLowerCase().endsWith('.docx')
    ) {
      try {
        const mammoth = await import('mammoth');
        const result = await mammoth.extractRawText({ buffer });
        extractedText = result.value || '';
      } catch (err) {
        console.error('DOCX parse error:', err);
        return NextResponse.json(
          { error: 'Failed to extract text from DOCX file.' },
          { status: 422 }
        );
      }
    }

    // ── DOC (legacy .doc) — best-effort via mammoth ──
    else if (
      file.type === 'application/msword' ||
      file.name.toLowerCase().endsWith('.doc')
    ) {
      try {
        const mammoth = await import('mammoth');
        const result = await mammoth.extractRawText({ buffer });
        extractedText = result.value || '';
      } catch (err) {
        console.error('DOC parse error:', err);
        return NextResponse.json(
          { error: 'Failed to extract text from DOC file. Try converting to DOCX.' },
          { status: 422 }
        );
      }
    }

    // ── Plain text ──
    else if (file.type === 'text/plain' || file.name.toLowerCase().endsWith('.txt')) {
      extractedText = buffer.toString('utf-8');
    }

    // ── Unsupported ──
    else {
      return NextResponse.json(
        { error: 'Unsupported file type. Upload PDF, DOCX, DOC, or TXT.' },
        { status: 400 }
      );
    }

    // Clean up whitespace
    extractedText = extractedText.replace(/\s+/g, ' ').trim();

    if (!extractedText) {
      return NextResponse.json(
        { error: 'No text could be extracted. The file may be empty or image-based.' },
        { status: 422 }
      );
    }

    // Truncate if needed
    const truncated = extractedText.length > MAX_TEXT_LENGTH;
    const text = truncated
      ? extractedText.substring(0, MAX_TEXT_LENGTH) + '\n\n[Document truncated — showing first ~12,000 characters]'
      : extractedText;

    return NextResponse.json({
      success: true,
      text,
      fileName: file.name,
      originalLength: extractedText.length,
      truncated,
    });
  } catch (error) {
    console.error('Document extraction error:', error);
    return NextResponse.json({ error: 'Failed to process document' }, { status: 500 });
  }
}
