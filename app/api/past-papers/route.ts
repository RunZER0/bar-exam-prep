import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { pastPapers, pastPaperQuestions } from '@/lib/db/schema';
import { eq, and, desc, sql, count } from 'drizzle-orm';
import { withAuth, withAdminAuth, type AuthUser } from '@/lib/auth/middleware';
import OpenAI from 'openai';
import { MINI_MODEL, AI_IDENTITY } from '@/lib/ai/model-config';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ── GET: List past papers with optional filters ──
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const unitId = searchParams.get('unitId');
    const year = searchParams.get('year');
    const paperId = searchParams.get('paperId');

    // Single paper with all questions
    if (paperId) {
      const [paper] = await db
        .select()
        .from(pastPapers)
        .where(eq(pastPapers.id, paperId))
        .limit(1);

      if (!paper) {
        return NextResponse.json({ error: 'Paper not found' }, { status: 404 });
      }

      const questions = await db
        .select()
        .from(pastPaperQuestions)
        .where(eq(pastPaperQuestions.paperId, paperId))
        .orderBy(pastPaperQuestions.questionNumber, pastPaperQuestions.subPart);

      return NextResponse.json({ paper, questions });
    }

    // List papers with filters
    const conditions = [];
    if (unitId) conditions.push(eq(pastPapers.unitId, unitId));
    if (year) conditions.push(eq(pastPapers.year, parseInt(year)));

    const papers = await db
      .select({
        id: pastPapers.id,
        unitId: pastPapers.unitId,
        unitName: pastPapers.unitName,
        year: pastPapers.year,
        sitting: pastPapers.sitting,
        paperCode: pastPapers.paperCode,
        totalMarks: pastPapers.totalMarks,
        duration: pastPapers.duration,
        createdAt: pastPapers.createdAt,
      })
      .from(pastPapers)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(pastPapers.year), pastPapers.unitId);

    // Get question counts per paper
    const questionCounts = await db
      .select({
        paperId: pastPaperQuestions.paperId,
        questionCount: count(),
      })
      .from(pastPaperQuestions)
      .groupBy(pastPaperQuestions.paperId);

    const countMap = new Map(questionCounts.map(q => [q.paperId, q.questionCount]));

    const enriched = papers.map(p => ({
      ...p,
      questionCount: countMap.get(p.id) || 0,
    }));

    // Topic frequency analysis across all matching papers
    const topicFrequency: Record<string, number> = {};
    const paperIds = papers.map(p => p.id);

    if (paperIds.length > 0) {
      const allQuestions = await db
        .select({ topics: pastPaperQuestions.topics })
        .from(pastPaperQuestions)
        .where(sql`${pastPaperQuestions.paperId} = ANY(${paperIds})`);

      for (const q of allQuestions) {
        const topics = (q.topics as string[]) || [];
        for (const t of topics) {
          topicFrequency[t] = (topicFrequency[t] || 0) + 1;
        }
      }
    }

    // Available years for filter UI
    const yearsResult = await db
      .select({ year: pastPapers.year })
      .from(pastPapers)
      .groupBy(pastPapers.year)
      .orderBy(desc(pastPapers.year));

    return NextResponse.json({
      papers: enriched,
      topicFrequency,
      availableYears: yearsResult.map(y => y.year),
    });
  } catch (error) {
    console.error('Past papers GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch past papers' }, { status: 500 });
  }
}

// ── POST: AI-powered actions (generate similar question, analyze) ──
export const POST = withAuth(async (req: NextRequest, user: AuthUser) => {
  try {
    const body = await req.json();
    const { action } = body;

    // Generate a similar practice question based on a past paper question
    if (action === 'similar_question') {
      const { questionText, unitName, topics, marks, questionType } = body;

      if (!questionText?.trim()) {
        return NextResponse.json({ error: 'Question text is required' }, { status: 400 });
      }

      const completion = await openai.chat.completions.create({
        model: MINI_MODEL,
        messages: [
          {
            role: 'system',
            content: `${AI_IDENTITY}

You are an expert KSL bar exam question writer. Given a past exam question, generate a NEW practice question that tests the SAME legal concepts and skills but uses DIFFERENT facts, scenarios, and phrasing.

RULES:
1. The new question must be of equivalent difficulty and marks allocation
2. Reference ONLY post-2010 Kenyan law (Constitution of Kenya 2010 is the only constitution)
3. Use different parties, dates, amounts, and scenarios than the original
4. Maintain the same question type (essay, problem, drafting)
5. Include a comprehensive model answer with correct legal analysis
6. If the original references specific statutes, your question should test knowledge of the same or closely related provisions

Respond in JSON: {"question": "...", "marks": N, "questionType": "essay|problem|drafting", "modelAnswer": "...", "topicsCovered": ["topic1", "topic2"]}`,
          },
          {
            role: 'user',
            content: `Generate a similar practice question for ${unitName || 'this unit'}.

Original question (${marks || 'N/A'} marks, type: ${questionType || 'essay'}):
${questionText}

Topics: ${(topics || []).join(', ') || 'General'}

Create a new question testing the same concepts with different facts.`,
          },
        ],
        max_completion_tokens: 4000,
        response_format: { type: 'json_object' },
      });

      const result = JSON.parse(completion.choices[0]?.message?.content || '{}');

      return NextResponse.json({
        success: true,
        generatedQuestion: result,
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Past papers POST error:', error);
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 });
  }
});

// ── Admin: Seed/manage past papers ──
export const PUT = withAdminAuth(async (req: NextRequest, user: AuthUser) => {
  try {
    const body = await req.json();
    const { action } = body;

    if (action === 'seed_paper') {
      const { unitId, unitName, year, sitting, paperCode, instructions, totalMarks, duration, questions } = body;

      if (!unitId || !unitName || !year || !questions?.length) {
        return NextResponse.json({ error: 'unitId, unitName, year, and questions are required' }, { status: 400 });
      }

      // Upsert: delete existing paper for same unit+year+sitting, then insert
      const existing = await db
        .select({ id: pastPapers.id })
        .from(pastPapers)
        .where(and(
          eq(pastPapers.unitId, unitId),
          eq(pastPapers.year, year),
          eq(pastPapers.sitting, sitting || 'main')
        ))
        .limit(1);

      if (existing.length > 0) {
        await db.delete(pastPapers).where(eq(pastPapers.id, existing[0].id));
      }

      const [paper] = await db.insert(pastPapers).values({
        unitId,
        unitName,
        year,
        sitting: sitting || 'main',
        paperCode: paperCode || null,
        instructions: instructions || null,
        totalMarks: totalMarks || null,
        duration: duration || null,
      }).returning();

      // Insert all questions
      if (questions.length > 0) {
        await db.insert(pastPaperQuestions).values(
          questions.map((q: any) => ({
            paperId: paper.id,
            questionNumber: q.questionNumber,
            subPart: q.subPart || null,
            questionText: q.questionText,
            marks: q.marks || null,
            isCompulsory: q.isCompulsory || false,
            topics: q.topics || [],
            difficulty: q.difficulty || null,
            questionType: q.questionType || 'essay',
            modelAnswer: q.modelAnswer || null,
          }))
        );
      }

      return NextResponse.json({
        success: true,
        paperId: paper.id,
        questionsInserted: questions.length,
      });
    }

    if (action === 'delete_paper') {
      const { paperId } = body;
      if (!paperId) return NextResponse.json({ error: 'paperId required' }, { status: 400 });
      await db.delete(pastPapers).where(eq(pastPapers.id, paperId));
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Past papers PUT error:', error);
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 });
  }
});
