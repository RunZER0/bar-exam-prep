/**
 * POST /api/mastery/grade-assessment
 * 
 * Grades written answers (SHORT / ANALYSIS) in end-of-lesson assessments.
 * Called from MasteryCarousel when the student submits the full assessment.
 * 
 * Request body:
 * {
 *   topic: string,
 *   answers: Array<{
 *     questionId: string,
 *     type: 'MCQ' | 'SHORT' | 'ORDERING' | 'ANALYSIS',
 *     question: AssessmentQuestion,
 *     studentAnswer: string | number | number[]  // text for SHORT/ANALYSIS, index for MCQ, order for ORDERING
 *   }>
 * }
 * 
 * Response:
 * {
 *   totalScore: number,
 *   totalPoints: number,
 *   passed: boolean,
 *   percentage: number,
 *   results: Array<{ questionId, score, maxScore, feedback, correct }>
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, type AuthUser } from '@/lib/auth/middleware';
import { AssessmentGenerator } from '@/lib/services/assessment-generator';

export async function POST(req: NextRequest) {
    try {
        const authUser: AuthUser | null = await verifyAuth(req);
        if (!authUser) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        const { topic, answers } = body;

        if (!topic || !answers || !Array.isArray(answers)) {
            return NextResponse.json({ error: 'topic and answers[] required' }, { status: 400 });
        }

        const results: Array<{
            questionId: string;
            score: number;
            maxScore: number;
            feedback: string;
            correct: boolean;
        }> = [];

        // Grade each answer
        const gradingPromises = answers.map(async (ans: any) => {
            const question = ans.question;
            const maxScore = question.points || 20;

            if (ans.type === 'MCQ') {
                // Auto-grade MCQ
                const correct = ans.studentAnswer === question.correctIndex;
                return {
                    questionId: ans.questionId,
                    score: correct ? maxScore : 0,
                    maxScore,
                    feedback: correct
                        ? `Correct! ${question.explanation || ''}`
                        : `Incorrect. The correct answer was option ${String.fromCharCode(65 + question.correctIndex)}. ${question.explanation || ''}`,
                    correct,
                };
            }

            if (ans.type === 'ORDERING') {
                // Auto-grade ordering — partial credit for correct positions
                const studentOrder = ans.studentAnswer as number[];
                const correctOrder = question.correctOrder as number[];
                if (!studentOrder || !correctOrder) {
                    return { questionId: ans.questionId, score: 0, maxScore, feedback: 'No answer provided.', correct: false };
                }
                let correctPositions = 0;
                const total = correctOrder.length;
                for (let i = 0; i < total; i++) {
                    if (studentOrder[i] === correctOrder[i]) correctPositions++;
                }
                const pct = correctPositions / total;
                const score = Math.round(maxScore * pct);
                const allCorrect = pct === 1;
                return {
                    questionId: ans.questionId,
                    score,
                    maxScore,
                    feedback: allCorrect
                        ? `Perfect order! ${question.explanation || ''}`
                        : `${correctPositions}/${total} steps in correct position. ${question.explanation || ''}`,
                    correct: allCorrect,
                };
            }

            if (ans.type === 'SHORT' || ans.type === 'ANALYSIS') {
                // AI-grade written answers
                const result = await AssessmentGenerator.gradeWrittenAnswer(
                    question,
                    ans.studentAnswer as string || '',
                    topic
                );
                return {
                    questionId: ans.questionId,
                    score: result.score,
                    maxScore: result.maxScore,
                    feedback: result.feedback,
                    correct: result.score >= result.maxScore * 0.7,
                };
            }

            // Unknown type — no credit
            return {
                questionId: ans.questionId,
                score: 0,
                maxScore,
                feedback: 'Unknown question type.',
                correct: false,
            };
        });

        const gradedResults = await Promise.all(gradingPromises);
        results.push(...gradedResults);

        const totalScore = results.reduce((sum, r) => sum + r.score, 0);
        const totalPoints = results.reduce((sum, r) => sum + r.maxScore, 0);
        const percentage = Math.round((totalScore / totalPoints) * 100);
        const passed = percentage >= 70;

        return NextResponse.json({
            totalScore,
            totalPoints,
            passed,
            percentage,
            results,
        });
    } catch (error) {
        console.error('[grade-assessment] Error:', error);
        return NextResponse.json({ error: 'Grading failed' }, { status: 500 });
    }
}
