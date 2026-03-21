import { NextRequest, NextResponse } from 'next/server';
import { withAdminAuth, type AuthUser } from '@/lib/auth/middleware';
import { db } from '@/lib/db';
import { pastPapers, pastPaperQuestions } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import OpenAI from 'openai';
import { MINI_MODEL, AI_IDENTITY } from '@/lib/ai/model-config';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const VALID_UNITS: Record<string, string> = {
  'atp-100': 'Civil Litigation',
  'atp-101': 'Criminal Litigation',
  'atp-102': 'Probate and Administration',
  'atp-103': 'Legal Writing and Drafting',
  'atp-104': 'Trial Advocacy',
  'atp-105': 'Professional Ethics',
  'atp-106': 'Legal Practice Management',
  'atp-107': 'Conveyancing',
  'atp-108': 'Commercial Transactions',
};

// ── POST: Upload and parse a PDF of past papers ──
export const POST = withAdminAuth(async (req: NextRequest, _user: AuthUser) => {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file || !file.name.toLowerCase().endsWith('.pdf')) {
      return NextResponse.json({ error: 'A PDF file is required' }, { status: 400 });
    }

    // Size guard: 20 MB max
    if (file.size > 20 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large (max 20 MB)' }, { status: 400 });
    }

    // Extract text from PDF
    const buffer = Buffer.from(await file.arrayBuffer());
    const pdfParse = (await import('pdf-parse')).default;
    const pdf = await pdfParse(buffer);
    const rawText = pdf.text;

    if (!rawText || rawText.trim().length < 100) {
      return NextResponse.json({ error: 'Could not extract meaningful text from the PDF. Is it a scanned image?' }, { status: 400 });
    }

    // Use AI to split the merged PDF into individual papers and structure them
    // Process in chunks if very large
    const MAX_CHARS = 60_000;
    const textChunks: string[] = [];
    for (let i = 0; i < rawText.length; i += MAX_CHARS) {
      textChunks.push(rawText.slice(i, i + MAX_CHARS));
    }

    const allPapers: any[] = [];

    for (let ci = 0; ci < textChunks.length; ci++) {
      const chunk = textChunks[ci];
      const isMultiChunk = textChunks.length > 1;

      const completion = await openai.chat.completions.create({
        model: MINI_MODEL,
        messages: [
          {
            role: 'system',
            content: `${AI_IDENTITY}

You are an expert KSL past paper parser. You receive raw text extracted from a PDF containing Kenya School of Law bar examination past papers. Your job is to parse them into structured JSON.

The PDF may contain MULTIPLE papers (different units and/or years merged together). Separate them accurately.

VALID UNIT IDs & NAMES:
${Object.entries(VALID_UNITS).map(([id, name]) => `  ${id}: ${name}`).join('\n')}

For each paper you find, output the following structure:
{
  "papers": [
    {
      "unitId": "atp-1XX",
      "unitName": "Unit Name",
      "year": 2024,
      "sitting": "main" or "supplementary",
      "paperCode": "ATP 1XX" or null,
      "instructions": "Answer FIVE questions..." or null,
      "totalMarks": 60 or null,
      "duration": "3 hours" or null,
      "questions": [
        {
          "questionNumber": 1,
          "subPart": null or "a"/"b"/"c",
          "questionText": "VERBATIM question text exactly as written",
          "marks": 20 or null,
          "isCompulsory": true/false,
          "topics": ["Topic 1", "Topic 2"],
          "difficulty": "easy"/"medium"/"hard" or null,
          "questionType": "essay"/"problem"/"drafting"
        }
      ]
    }
  ]
}

CRITICAL RULES:
1. PRESERVE the question text VERBATIM — do not summarise, rephrase, or truncate
2. Identify the unit by matching header text (e.g., "CIVIL LITIGATION", "ATP 100") to the valid unit IDs above
3. Identify the year from headers like "JULY 2024", "NOVEMBER 2023", etc.
4. Mark Question 1 as compulsory if instructions say so
5. Assign topics based on the legal concepts each question covers
6. If a question has sub-parts (a), (b), (c) that are independently answerable, create separate entries with subPart field
7. If sub-parts are part of one question's narrative, keep them together in questionText
8. Set questionType to "problem" for scenario-based questions, "essay" for discuss/explain questions, "drafting" for draft/prepare document questions
${isMultiChunk ? `\n9. This is chunk ${ci + 1} of ${textChunks.length}. A paper may span across chunks — include whatever you find in this chunk.` : ''}

Respond ONLY with valid JSON.`,
          },
          {
            role: 'user',
            content: `Parse this raw text from a KSL past papers PDF into structured JSON:\n\n${chunk}`,
          },
        ],
        max_completion_tokens: 16000,
        response_format: { type: 'json_object' },
      });

      const result = JSON.parse(completion.choices[0]?.message?.content || '{"papers":[]}');
      if (result.papers?.length > 0) {
        allPapers.push(...result.papers);
      }
    }

    if (allPapers.length === 0) {
      return NextResponse.json({
        error: 'Could not identify any past papers in the PDF. Make sure it contains KSL examination papers.',
      }, { status: 400 });
    }

    // Validate and save each parsed paper
    let saved = 0;
    let totalQs = 0;
    const errors: string[] = [];

    for (const paper of allPapers) {
      if (!paper.unitId || !VALID_UNITS[paper.unitId]) {
        errors.push(`Skipped paper with invalid unitId: "${paper.unitId}"`);
        continue;
      }
      if (!paper.year || paper.year < 2005 || paper.year > 2030) {
        errors.push(`Skipped paper with invalid year: ${paper.year}`);
        continue;
      }
      if (!paper.questions?.length) {
        errors.push(`Skipped ${paper.unitId} ${paper.year}: no questions found`);
        continue;
      }

      const sitting = paper.sitting || 'main';

      // Upsert: delete any existing paper for same unit+year+sitting
      const existing = await db
        .select({ id: pastPapers.id })
        .from(pastPapers)
        .where(and(
          eq(pastPapers.unitId, paper.unitId),
          eq(pastPapers.year, paper.year),
          eq(pastPapers.sitting, sitting)
        ))
        .limit(1);

      if (existing.length > 0) {
        await db.delete(pastPapers).where(eq(pastPapers.id, existing[0].id));
      }

      const [inserted] = await db.insert(pastPapers).values({
        unitId: paper.unitId,
        unitName: VALID_UNITS[paper.unitId],
        year: paper.year,
        sitting,
        paperCode: paper.paperCode || null,
        instructions: paper.instructions || null,
        totalMarks: paper.totalMarks || null,
        duration: paper.duration || null,
      }).returning();

      if (paper.questions.length > 0) {
        await db.insert(pastPaperQuestions).values(
          paper.questions.map((q: any) => ({
            paperId: inserted.id,
            questionNumber: q.questionNumber || 1,
            subPart: q.subPart || null,
            questionText: q.questionText || '',
            marks: q.marks || null,
            isCompulsory: q.isCompulsory || false,
            topics: q.topics || [],
            difficulty: q.difficulty || null,
            questionType: q.questionType || 'essay',
            modelAnswer: q.modelAnswer || null,
          }))
        );
        totalQs += paper.questions.length;
      }

      saved++;
    }

    return NextResponse.json({
      success: true,
      papersSaved: saved,
      totalQuestions: totalQs,
      papersFound: allPapers.length,
      errors: errors.length > 0 ? errors : undefined,
      summary: allPapers.map(p => `${VALID_UNITS[p.unitId] || p.unitId} ${p.year} (${p.sitting || 'main'}) — ${p.questions?.length || 0} questions`),
    });
  } catch (error: any) {
    console.error('PDF upload error:', error);
    return NextResponse.json({ error: error.message || 'Failed to process PDF' }, { status: 500 });
  }
});
