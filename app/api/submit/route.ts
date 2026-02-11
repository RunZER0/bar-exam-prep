import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { db } from '@/lib/db';
import { userResponses, questions, userProgress } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { evaluateEssayResponse } from '@/lib/ai/guardrails';

export const POST = withAuth(async (req: NextRequest, user) => {
  try {
    const body = await req.json();
    const { questionId, userAnswer, timeSpent } = body;

    if (!questionId || !userAnswer) {
      return NextResponse.json(
        { error: 'Question ID and answer are required' },
        { status: 400 }
      );
    }

    // Get the question
    const question = await db.query.questions.findFirst({
      where: eq(questions.id, questionId),
    });

    if (!question) {
      return NextResponse.json(
        { error: 'Question not found' },
        { status: 404 }
      );
    }

    let isCorrect = false;
    let score = 0;
    let aiFeedback = '';

    // Evaluate based on question type
    if (question.questionType === 'multiple_choice') {
      isCorrect = userAnswer.trim().toLowerCase() === 
                  question.correctAnswer?.trim().toLowerCase();
      score = isCorrect ? 100 : 0;
    } else if (question.questionType === 'essay' || 
               question.questionType === 'case_analysis' ||
               question.questionType === 'practical') {
      // Use AI to evaluate
      const evaluation = await evaluateEssayResponse(
        question.question,
        userAnswer,
        question.rubric
      );
      score = evaluation.score;
      aiFeedback = evaluation.feedback;
      isCorrect = score >= 60; // Pass threshold
    }

    // Count previous attempts
    const previousAttempts = await db.query.userResponses.findMany({
      where: and(
        eq(userResponses.userId, user.id),
        eq(userResponses.questionId, questionId)
      ),
    });

    // Save user response
    const [response] = await db.insert(userResponses).values({
      userId: user.id,
      questionId,
      userAnswer,
      isCorrect,
      score,
      aiFeedback,
      timeSpent,
      attemptNumber: previousAttempts.length + 1,
    }).returning();

    // Update user progress
    const progress = await db.query.userProgress.findFirst({
      where: and(
        eq(userProgress.userId, user.id),
        eq(userProgress.topicId, question.topicId)
      ),
    });

    if (progress) {
      const newQuestionsAttempted = progress.questionsAttempted + 1;
      const newQuestionsCorrect = progress.questionsCorrect + (isCorrect ? 1 : 0);
      
      await db.update(userProgress)
        .set({
          questionsAttempted: newQuestionsAttempted,
          questionsCorrect: newQuestionsCorrect,
          lastAccessedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(userProgress.id, progress.id));
    } else {
      await db.insert(userProgress).values({
        userId: user.id,
        topicId: question.topicId,
        questionsAttempted: 1,
        questionsCorrect: isCorrect ? 1 : 0,
        completionPercentage: 0,
      });
    }

    return NextResponse.json({
      success: true,
      isCorrect,
      score,
      feedback: aiFeedback,
      correctAnswer: question.correctAnswer,
      explanation: question.explanation,
    });
  } catch (error) {
    console.error('Error submitting response:', error);
    return NextResponse.json(
      { error: 'Failed to submit response' },
      { status: 500 }
    );
  }
});
