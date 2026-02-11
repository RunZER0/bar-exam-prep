import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { db } from '@/lib/db';
import { questions } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

export const GET = withAuth(async (req: NextRequest, user) => {
  try {
    const { searchParams } = new URL(req.url);
    const topicId = searchParams.get('topicId');
    const difficulty = searchParams.get('difficulty');
    const limit = parseInt(searchParams.get('limit') || '10');

    if (!topicId) {
      return NextResponse.json(
        { error: 'Topic ID is required' },
        { status: 400 }
      );
    }

    let query = db.query.questions.findMany({
      where: and(
        eq(questions.topicId, topicId),
        eq(questions.isActive, true),
        difficulty ? eq(questions.difficulty, difficulty as any) : undefined
      ),
      limit,
    });

    const questionsList = await query;

    // Remove correct answers and explanations initially
    // (they'll be revealed after submission)
    const sanitizedQuestions = questionsList.map(q => ({
      id: q.id,
      topicId: q.topicId,
      questionType: q.questionType,
      difficulty: q.difficulty,
      question: q.question,
      context: q.context,
      options: q.options,
      // Don't send correctAnswer and explanation yet
    }));

    return NextResponse.json({
      questions: sanitizedQuestions,
    });
  } catch (error) {
    console.error('Error fetching questions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch questions' },
      { status: 500 }
    );
  }
});
