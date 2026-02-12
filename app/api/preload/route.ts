import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { preloadedContent, userProgress, users } from '@/lib/db/schema';
import { eq, and, desc, gte, lt, sql } from 'drizzle-orm';
import { verifyIdToken } from '@/lib/firebase/admin';
import { ATP_UNITS, TOPICS_BY_UNIT, getUnitById } from '@/lib/constants/legal-content';
import { callAIFast, generateFastJSON } from '@/lib/ai/guardrails';
import crypto from 'crypto';

const CACHE_DURATION_HOURS = 12; // Shorter cache for fresher content

// Configuration for exam types
const PAPER_CONFIG = {
  abcd: {
    mini: { marks: 15, questions: 15, time: 20 },
    semi: { marks: 30, questions: 30, time: 40 },
    full: { marks: 60, questions: 60, time: 90 },
  },
  cle: {
    mini: { marks: 15, questions: 2, time: 30 },
    semi: { marks: 30, questions: 4, time: 60 },
    full: { marks: 60, questions: 6, time: 180 },
  },
} as const;

type ExamType = 'abcd' | 'cle';
type PaperSize = 'mini' | 'semi' | 'full';

// ============================================================
// HELPER: Generate progress hash for staleness detection
// ============================================================

async function getUserProgressHash(userId: string): Promise<string> {
  try {
    const progress = await db
      .select({
        topicId: userProgress.topicId,
        correct: userProgress.questionsCorrect,
        attempted: userProgress.questionsAttempted,
      })
      .from(userProgress)
      .where(eq(userProgress.userId, userId))
      .limit(50);

    // Create hash from progress data
    const dataString = JSON.stringify(progress.sort((a, b) => 
      (a.topicId || '').localeCompare(b.topicId || '')
    ));
    return crypto.createHash('md5').update(dataString).digest('hex').substring(0, 8);
  } catch {
    return 'no_progress';
  }
}

// ============================================================
// HELPER: Get user's weak areas
// ============================================================

async function getUserWeakAreas(userId: string, unitId?: string): Promise<string[]> {
  try {
    const progress = await db
      .select({
        topicId: userProgress.topicId,
        correct: userProgress.questionsCorrect,
        attempted: userProgress.questionsAttempted,
      })
      .from(userProgress)
      .where(eq(userProgress.userId, userId));

    const weakAreas = progress
      .filter(p => p.attempted && p.attempted > 0 && ((p.correct || 0) / p.attempted) < 0.6)
      .map(p => {
        for (const [uid, topics] of Object.entries(TOPICS_BY_UNIT)) {
          if (unitId && uid !== unitId) continue;
          const topic = topics.find(t => t.id === p.topicId);
          if (topic) return topic.name;
        }
        return null;
      })
      .filter(Boolean) as string[];

    return weakAreas.slice(0, 5);
  } catch {
    return [];
  }
}

// ============================================================
// HELPER: Generate exam questions using fast AI
// ============================================================

async function generateExamQuestions(
  unitId: string,
  examType: ExamType,
  paperSize: PaperSize,
  userId: string
): Promise<any> {
  const unit = getUnitById(unitId);
  if (!unit) return null;

  const config = PAPER_CONFIG[examType][paperSize];
  const weakAreas = await getUserWeakAreas(userId, unitId);
  const marksPerQuestion = examType === 'abcd' ? 1 : Math.floor(config.marks / config.questions);

  let prompt: string;

  if (examType === 'abcd') {
    prompt = `Generate ${config.questions} multiple choice questions for a ${paperSize} paper exam on ${unit.name} (Kenyan Law).

Format as JSON array:
[
  {
    "id": "q1",
    "question": "Question text?",
    "options": ["A) option1", "B) option2", "C) option3", "D) option4"],
    "correctAnswer": "A) option1",
    "marks": 1,
    "topic": "Sub-topic name"
  }
]

Rules:
- Each question worth 1 mark
- Reference Kenyan statutes: ${unit.statutes.slice(0, 3).join(', ')}
- Mix difficulty levels (easy, medium, hard)
${weakAreas.length > 0 ? `- FOCUS ON THESE WEAK AREAS: ${weakAreas.join(', ')}` : ''}
- Cover different sub-topics of ${unit.name}
- Output ONLY valid JSON array`;
  } else {
    prompt = `Generate ${config.questions} essay/problem questions for a CLE standard ${paperSize} paper exam on ${unit.name} (Kenyan Law).

Format as JSON array:
[
  {
    "id": "q1",
    "question": "Problem/essay question requiring IRAC analysis...",
    "marks": ${marksPerQuestion},
    "topic": "Sub-topic name",
    "gradingRubric": {
      "legalKnowledge": "What legal principles to look for",
      "analysis": "How should the analysis be structured",
      "keyPoints": ["Point 1", "Point 2", "Point 3"]
    }
  }
]

Rules:
- Questions require detailed IRAC analysis
- Include hypothetical scenarios
- Reference statutes: ${unit.statutes.slice(0, 3).join(', ')}
${weakAreas.length > 0 ? `- FOCUS ON THESE WEAK AREAS: ${weakAreas.join(', ')}` : ''}
- Each question worth ${marksPerQuestion} marks
- Output ONLY valid JSON array`;
  }

  const questions = await generateFastJSON<any[]>(prompt, 4000);
  
  if (!questions || questions.length === 0) {
    // Fallback questions
    return genFallbackQuestions(examType, config.questions, unit.name, marksPerQuestion);
  }

  return questions;
}

function genFallbackQuestions(
  examType: ExamType,
  count: number,
  unitName: string,
  marksPerQ: number
): any[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `q${i + 1}`,
    question: examType === 'abcd'
      ? `Question ${i + 1} for ${unitName}. [Loading failed - please regenerate]`
      : `Essay question ${i + 1} for ${unitName}. Analyze the legal issues and provide your answer using IRAC format. [Loading failed - please regenerate]`,
    options: examType === 'abcd'
      ? ['A) Option 1', 'B) Option 2', 'C) Option 3', 'D) Option 4']
      : undefined,
    correctAnswer: examType === 'abcd' ? 'A) Option 1' : undefined,
    marks: marksPerQ,
    topic: unitName,
  }));
}

// ============================================================
// HELPER: Generate quiz questions using fast AI
// ============================================================

async function generateQuizQuestions(
  unitId: string | null,
  topicId: string | null,
  userId: string
): Promise<any> {
  const unit = unitId ? ATP_UNITS.find(u => u.id === unitId) : null;
  const topics = unitId ? TOPICS_BY_UNIT[unitId] || [] : [];
  const topic = topicId ? topics.find(t => String(t.id) === topicId) : null;
  const weakAreas = await getUserWeakAreas(userId, unitId || undefined);

  const prompt = `Generate 5 multiple choice questions for the Kenya Bar Exam.

${unit ? `Unit: ${unit.name}` : ''}
${topic ? `Topic: ${topic.name}` : ''}
${weakAreas.length > 0 ? `Focus on these weak areas: ${weakAreas.join(', ')}` : ''}

Format as JSON:
{
  "questions": [
    {
      "question": "Question text?",
      "options": ["A) opt1", "B) opt2", "C) opt3", "D) opt4"],
      "correctIndex": 0,
      "explanation": "Why this is correct",
      "difficulty": "medium"
    }
  ]
}

Requirements:
- Test understanding, not just memorization
- Mix difficulty levels
- Exactly 4 options per question
- Reference Kenyan law where applicable
- Output ONLY valid JSON`;

  const result = await generateFastJSON<{ questions: any[] }>(prompt, 2000);
  return result || { questions: [] };
}

// ============================================================
// HELPER: Predict likely exams
// ============================================================

async function predictLikelyExams(userId: string): Promise<Array<{
  unitId: string;
  examType: ExamType;
  paperSize: PaperSize;
  probability: number;
}>> {
  const predictions: Array<{
    unitId: string;
    examType: ExamType;
    paperSize: PaperSize;
    probability: number;
  }> = [];

  try {
    // Get user's recent activity
    const recentProgress = await db
      .select({ topicId: userProgress.topicId })
      .from(userProgress)
      .where(eq(userProgress.userId, userId))
      .orderBy(desc(userProgress.updatedAt))
      .limit(10);

    // Find most likely unit
    const unitCounts: Record<string, number> = {};
    for (const p of recentProgress) {
      for (const [unitId, topics] of Object.entries(TOPICS_BY_UNIT)) {
        if (topics.some(t => t.id === p.topicId)) {
          unitCounts[unitId] = (unitCounts[unitId] || 0) + 1;
          break;
        }
      }
    }

    const sortedUnits = Object.entries(unitCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3);

    // Generate predictions
    if (sortedUnits.length > 0) {
      // Most studied unit - ABCD semi (most common)
      predictions.push({
        unitId: sortedUnits[0][0],
        examType: 'abcd',
        paperSize: 'semi',
        probability: 0.8,
      });
      
      // Also predict CLE semi for same unit
      predictions.push({
        unitId: sortedUnits[0][0],
        examType: 'cle',
        paperSize: 'semi',
        probability: 0.5,
      });

      // Second unit ABCD
      if (sortedUnits.length > 1) {
        predictions.push({
          unitId: sortedUnits[1][0],
          examType: 'abcd',
          paperSize: 'semi',
          probability: 0.4,
        });
      }
    } else {
      // New user - predict first unit
      predictions.push({
        unitId: ATP_UNITS[0]?.id || 'atp-100',
        examType: 'abcd',
        paperSize: 'semi',
        probability: 0.7,
      });
    }
  } catch (error) {
    console.error('Error predicting exams:', error);
  }

  return predictions.sort((a, b) => b.probability - a.probability);
}

// ============================================================
// GET - Fetch preloaded content
// ============================================================

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const decodedToken = await verifyIdToken(token);
    const userId = decodedToken.uid;

    const { searchParams } = new URL(req.url);
    const unitId = searchParams.get('unitId');
    const topicId = searchParams.get('topicId');
    const contentType = searchParams.get('type') || 'quiz';
    const examType = searchParams.get('examType') as ExamType | null;
    const paperSize = searchParams.get('paperSize') as PaperSize | null;
    const checkStaleness = searchParams.get('checkStaleness') === 'true';

    // Build context key
    let contextKey: string;
    if (contentType === 'exam' && examType && paperSize) {
      contextKey = `exam_${unitId}_${examType}_${paperSize}`;
    } else {
      contextKey = topicId || unitId || '';
    }

    const now = new Date();
    
    // Build query conditions
    const conditions = [
      eq(preloadedContent.userId, userId),
      eq(preloadedContent.contentType, contentType),
      eq(preloadedContent.contextKey, contextKey),
      gte(preloadedContent.expiresAt, now),
    ];

    const preloaded = await db
      .select()
      .from(preloadedContent)
      .where(and(...conditions))
      .orderBy(desc(preloadedContent.createdAt))
      .limit(1);

    if (preloaded.length === 0) {
      return NextResponse.json({ 
        found: false,
        message: 'No preloaded content available' 
      });
    }

    // Check staleness
    if (checkStaleness && preloaded[0].dataVersionHash) {
      const currentHash = await getUserProgressHash(userId);
      if (currentHash !== preloaded[0].dataVersionHash) {
        // Content is stale - delete it and return not found
        await db.delete(preloadedContent).where(eq(preloadedContent.id, preloaded[0].id));
        return NextResponse.json({
          found: false,
          isStale: true,
          message: 'Content was stale and has been invalidated',
        });
      }
    }

    // Delete used content to prevent reuse
    await db.delete(preloadedContent).where(eq(preloadedContent.id, preloaded[0].id));

    return NextResponse.json({
      found: true,
      content: preloaded[0].content,
      preloadedAt: preloaded[0].createdAt,
    });
  } catch (error) {
    console.error('Error fetching preloaded content:', error);
    return NextResponse.json(
      { error: 'Failed to fetch preloaded content' },
      { status: 500 }
    );
  }
}

// ============================================================
// POST - Trigger preloading
// ============================================================

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const decodedToken = await verifyIdToken(token);
    const userId = decodedToken.uid;

    const body = await req.json();
    const { action, unitId, topicId, contentType = 'quiz', examType, paperSize } = body;

    // --------------------------------------------------------
    // ACTION: preload - Preload specific content
    // --------------------------------------------------------
    if (action === 'preload') {
      let contextKey: string;
      let content: any;

      if (contentType === 'exam' && examType && paperSize && unitId) {
        contextKey = `exam_${unitId}_${examType}_${paperSize}`;
        
        // Check if already exists or is being generated
        const existing = await db
          .select()
          .from(preloadedContent)
          .where(and(
            eq(preloadedContent.userId, userId),
            eq(preloadedContent.contentType, 'exam'),
            eq(preloadedContent.contextKey, contextKey),
            gte(preloadedContent.expiresAt, new Date())
          ))
          .limit(1);

        if (existing.length > 0) {
          return NextResponse.json({ 
            message: 'Content already preloaded',
            preloadedAt: existing[0].createdAt 
          });
        }

        // Generate exam questions
        content = await generateExamQuestions(unitId, examType, paperSize, userId);
      } else {
        contextKey = topicId || unitId || '';
        content = await generateQuizQuestions(unitId, topicId, userId);
      }

      if (!content) {
        return NextResponse.json({ error: 'Failed to generate content' }, { status: 500 });
      }

      // Get progress hash for staleness tracking
      const dataVersionHash = await getUserProgressHash(userId);
      const expiresAt = new Date(Date.now() + CACHE_DURATION_HOURS * 60 * 60 * 1000);

      await db.insert(preloadedContent).values({
        userId,
        contentType,
        contextKey,
        content,
        dataVersionHash,
        examType: examType || null,
        paperSize: paperSize || null,
        expiresAt,
      });

      return NextResponse.json({ 
        message: 'Content preloaded successfully',
        expiresAt,
        dataVersionHash,
      });
    }

    // --------------------------------------------------------
    // ACTION: preload_likely_exams - Preload predicted exams
    // --------------------------------------------------------
    if (action === 'preload_likely_exams') {
      const predictions = await predictLikelyExams(userId);
      const results = [];

      // Preload top 2 predictions
      for (const pred of predictions.slice(0, 2)) {
        const contextKey = `exam_${pred.unitId}_${pred.examType}_${pred.paperSize}`;
        
        // Check if already exists
        const existing = await db
          .select()
          .from(preloadedContent)
          .where(and(
            eq(preloadedContent.userId, userId),
            eq(preloadedContent.contentType, 'exam'),
            eq(preloadedContent.contextKey, contextKey),
            gte(preloadedContent.expiresAt, new Date())
          ))
          .limit(1);

        if (existing.length > 0) {
          results.push({ ...pred, status: 'already_preloaded' });
          continue;
        }

        // Generate and store
        const content = await generateExamQuestions(
          pred.unitId,
          pred.examType,
          pred.paperSize,
          userId
        );

        if (content) {
          const dataVersionHash = await getUserProgressHash(userId);
          await db.insert(preloadedContent).values({
            userId,
            contentType: 'exam',
            contextKey,
            content,
            dataVersionHash,
            examType: pred.examType,
            paperSize: pred.paperSize,
            expiresAt: new Date(Date.now() + CACHE_DURATION_HOURS * 60 * 60 * 1000),
          });
          results.push({ ...pred, status: 'preloaded' });
        } else {
          results.push({ ...pred, status: 'failed' });
        }
      }

      return NextResponse.json({ 
        message: 'Likely exams preloaded',
        results,
      });
    }

    // --------------------------------------------------------
    // ACTION: preload_next_exam - Preload next likely exam
    // --------------------------------------------------------
    if (action === 'preload_next_exam') {
      const { currentContext } = body;
      const predictions = await predictLikelyExams(userId);
      
      // Filter out current exam
      const nextPredictions = predictions.filter(p => 
        !currentContext || 
        p.unitId !== currentContext.unitId ||
        p.examType !== currentContext.examType ||
        p.paperSize !== currentContext.paperSize
      );

      if (nextPredictions.length === 0) {
        return NextResponse.json({ message: 'No next exam to preload' });
      }

      const next = nextPredictions[0];
      const contextKey = `exam_${next.unitId}_${next.examType}_${next.paperSize}`;

      // Check if already exists
      const existing = await db
        .select()
        .from(preloadedContent)
        .where(and(
          eq(preloadedContent.userId, userId),
          eq(preloadedContent.contentType, 'exam'),
          eq(preloadedContent.contextKey, contextKey),
          gte(preloadedContent.expiresAt, new Date())
        ))
        .limit(1);

      if (existing.length > 0) {
        return NextResponse.json({ 
          message: 'Next exam already preloaded',
          exam: next,
        });
      }

      const content = await generateExamQuestions(next.unitId, next.examType, next.paperSize, userId);
      if (content) {
        const dataVersionHash = await getUserProgressHash(userId);
        await db.insert(preloadedContent).values({
          userId,
          contentType: 'exam',
          contextKey,
          content,
          dataVersionHash,
          examType: next.examType,
          paperSize: next.paperSize,
          expiresAt: new Date(Date.now() + CACHE_DURATION_HOURS * 60 * 60 * 1000),
        });
      }

      return NextResponse.json({ 
        message: 'Next exam preloaded',
        exam: next,
      });
    }

    // --------------------------------------------------------
    // ACTION: preload_next - Predictive quiz preloading
    // --------------------------------------------------------
    if (action === 'preload_next') {
      // Original functionality for quizzes
      const predictions = await predictLikelyExams(userId);
      
      const results = await Promise.all(
        predictions.slice(0, 2).map(async (prediction) => {
          const contextKey = prediction.unitId;
          
          const existing = await db
            .select()
            .from(preloadedContent)
            .where(and(
              eq(preloadedContent.userId, userId),
              eq(preloadedContent.contentType, 'quiz'),
              eq(preloadedContent.contextKey, contextKey),
              gte(preloadedContent.expiresAt, new Date())
            ))
            .limit(1);

          if (existing.length > 0) {
            return { unitId: prediction.unitId, status: 'already_preloaded' };
          }

          const content = await generateQuizQuestions(prediction.unitId, null, userId);
          const dataVersionHash = await getUserProgressHash(userId);
          
          await db.insert(preloadedContent).values({
            userId,
            contentType: 'quiz',
            contextKey,
            content,
            dataVersionHash,
            expiresAt: new Date(Date.now() + CACHE_DURATION_HOURS * 60 * 60 * 1000),
          });

          return { unitId: prediction.unitId, status: 'preloaded' };
        })
      );

      return NextResponse.json({ 
        message: 'Predictive preloading complete',
        preloaded: results,
      });
    }

    // --------------------------------------------------------
    // ACTION: invalidate - Invalidate stale content
    // --------------------------------------------------------
    if (action === 'invalidate') {
      let contextKey: string;
      if (contentType === 'exam' && examType && paperSize && unitId) {
        contextKey = `exam_${unitId}_${examType}_${paperSize}`;
      } else {
        contextKey = topicId || unitId || '';
      }

      await db
        .delete(preloadedContent)
        .where(and(
          eq(preloadedContent.userId, userId),
          eq(preloadedContent.contentType, contentType),
          eq(preloadedContent.contextKey, contextKey)
        ));

      return NextResponse.json({ message: 'Content invalidated' });
    }

    // --------------------------------------------------------
    // ACTION: cleanup - Clean up expired content
    // --------------------------------------------------------
    if (action === 'cleanup') {
      const deleted = await db
        .delete(preloadedContent)
        .where(lt(preloadedContent.expiresAt, new Date()))
        .returning();

      return NextResponse.json({ 
        message: 'Cleanup complete',
        deletedCount: deleted.length,
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Error in preload POST:', error);
    return NextResponse.json(
      { error: 'Failed to preload content' },
      { status: 500 }
    );
  }
}
