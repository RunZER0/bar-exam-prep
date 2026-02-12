import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { db } from '@/lib/db';
import { userResponses, questions, userProgress, topics, weeklyRankings, quizHistory, studyStreaks } from '@/lib/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { evaluateEssayResponse } from '@/lib/ai/guardrails';
import { triggerPreloadAfterQuiz, updateWeeklyRanking, triggerStudyGuideRegeneration } from '@/lib/services/quiz-completion';
import { randomUUID } from 'crypto';

export const POST = withAuth(async (req: NextRequest, user) => {
  try {
    const body = await req.json();
    
    // Check if this is an AI-generated quiz submission (has questionText instead of questionId)
    if (body.questionText) {
      // Handle AI-generated quiz question submission
      const {
        questionText,
        userAnswer,
        correctAnswer,
        isCorrect,
        difficulty,
        topicArea,
        quizMode,
        sessionId,
        questionNumber,
        timeSpent,
        options,
        explanation,
      } = body;

      // Map topicArea to a unit if possible
      let unitId = 'all';
      let unitName = topicArea || 'General Kenyan Law';
      
      // Try to match to ATP units
      const unitMappings: Record<string, string> = {
        'Civil Litigation': 'atp100',
        'Criminal Litigation': 'atp200',
        'Legal Writing & Drafting': 'atp300',
        'Professional Conduct & Ethics': 'atp400',
        'Trial Advocacy': 'atp500',
        'Probate & Administration': 'atp600',
        'Commercial Transactions': 'atp700',
        'Conveyancing': 'atp800',
        'Family Law': 'atp900', 
        'Alternative Dispute Resolution': 'atp1000',
      };
      
      for (const [name, id] of Object.entries(unitMappings)) {
        if (topicArea?.toLowerCase().includes(name.toLowerCase()) || 
            name.toLowerCase().includes(topicArea?.toLowerCase() || '')) {
          unitId = id;
          unitName = name;
          break;
        }
      }

      // Save to quiz history
      await db.insert(quizHistory).values({
        userId: user.id,
        quizMode: quizMode || 'adaptive',
        unitId,
        unitName,
        questionText,
        options: options || null,
        correctAnswer,
        userAnswer,
        explanation: explanation || null,
        isCorrect,
        difficulty: difficulty || 'medium',
        topicCategory: topicArea || null,
        sessionId: sessionId || randomUUID(),
        questionNumber: questionNumber || 1,
        timeSpent: timeSpent || null,
      });

      // Update study streak for today
      const today = new Date().toISOString().split('T')[0];
      const existingStreak = await db.query.studyStreaks.findFirst({
        where: and(
          eq(studyStreaks.userId, user.id),
          eq(studyStreaks.date, today)
        ),
      });

      if (existingStreak) {
        await db.update(studyStreaks)
          .set({
            questionsAnswered: existingStreak.questionsAnswered + 1,
          })
          .where(eq(studyStreaks.id, existingStreak.id));
      } else {
        await db.insert(studyStreaks).values({
          userId: user.id,
          date: today,
          minutesStudied: 0,
          questionsAnswered: 1,
          sessionsCompleted: 0,
        });
      }

      // Update weekly rankings
      setImmediate(async () => {
        try {
          await updateWeeklyRanking(user.id, isCorrect ? 10 : 1, 1);
        } catch (err) {
          console.error('Weekly ranking update error:', err);
        }
      });

      // Regenerate study guide recommendations every 5th question (async, non-blocking)
      if (questionNumber && questionNumber % 5 === 0) {
        setImmediate(async () => {
          try {
            await triggerStudyGuideRegeneration(user.id);
          } catch (err) {
            console.error('Study guide regeneration error:', err);
          }
        });
      }

      return NextResponse.json({
        success: true,
        isCorrect,
        recorded: true,
      });
    }

    // Original logic for database questions (questionId provided)
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

    // Trigger background tasks (non-blocking)
    // 1. Update weekly rankings
    // 2. Preload next quiz content for instant loading
    setImmediate(async () => {
      try {
        // Update rankings with points (10 for correct, 1 for attempt)
        await updateWeeklyRanking(user.id, isCorrect ? 10 : 1, 1);
        
        // Preload next quiz questions for this topic
        // Get the topic to find the unit/category
        const topic = await db.query.topics.findFirst({
          where: eq(topics.id, question.topicId),
        });
        
        if (topic?.category) {
          await triggerPreloadAfterQuiz(user.id, topic.category, question.topicId);
        }
      } catch (err) {
        console.error('Background task error:', err);
      }
    });

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
