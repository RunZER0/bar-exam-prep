import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { preloadedContent, userProgress, users } from '@/lib/db/schema';
import { eq, and, desc, gte, lt, sql } from 'drizzle-orm';
import { verifyIdToken } from '@/lib/firebase/admin';
import { ATP_UNITS, TOPICS_BY_UNIT } from '@/lib/constants/legal-content';
import { generateObject } from 'ai';
import { google } from '@ai-sdk/google';
import { z } from 'zod';

const PRELOAD_BATCH_SIZE = 5; // Number of questions to preload
const CACHE_DURATION_HOURS = 24; // How long to keep preloaded content

// Question schema for AI generation
const QuestionSchema = z.object({
  questions: z.array(z.object({
    question: z.string().describe('The quiz question text'),
    options: z.array(z.string()).length(4).describe('Four answer options'),
    correctIndex: z.number().min(0).max(3).describe('Index of correct answer (0-3)'),
    explanation: z.string().describe('Brief explanation of the correct answer'),
    difficulty: z.enum(['easy', 'medium', 'hard']).describe('Question difficulty'),
  })).describe('Array of quiz questions'),
});

// GET - Fetch preloaded content for a topic/unit
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

    if (!unitId && !topicId) {
      return NextResponse.json(
        { error: 'Unit ID or Topic ID required' },
        { status: 400 }
      );
    }

    // Find preloaded content
    const contextKey = topicId || unitId || '';
    const now = new Date();
    const preloaded = await db
      .select()
      .from(preloadedContent)
      .where(and(
        eq(preloadedContent.userId, userId),
        eq(preloadedContent.contentType, contentType),
        eq(preloadedContent.contextKey, contextKey),
        gte(preloadedContent.expiresAt, now)
      ))
      .orderBy(desc(preloadedContent.createdAt))
      .limit(1);

    if (preloaded.length === 0) {
      return NextResponse.json({ 
        found: false,
        message: 'No preloaded content available' 
      });
    }

    // Delete used content to prevent reuse
    await db
      .delete(preloadedContent)
      .where(eq(preloadedContent.id, preloaded[0].id));

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

// POST - Trigger preloading for upcoming content
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
    const { action, unitId, topicId, contentType = 'quiz', priority = 'normal' } = body;

    if (action === 'preload') {
      // Check if preloaded content already exists
      const contextKey = topicId || unitId || '';
      const now = new Date();
      const existing = await db
        .select()
        .from(preloadedContent)
        .where(and(
          eq(preloadedContent.userId, userId),
          eq(preloadedContent.contentType, contentType),
          eq(preloadedContent.contextKey, contextKey),
          gte(preloadedContent.expiresAt, now)
        ))
        .limit(1);

      if (existing.length > 0) {
        return NextResponse.json({ 
          message: 'Content already preloaded',
          preloadedAt: existing[0].createdAt 
        });
      }

      // Generate content based on type
      let content;
      if (contentType === 'quiz') {
        content = await generateQuizQuestions(unitId, topicId, userId);
      } else if (contentType === 'study') {
        content = await generateStudyContent(unitId, topicId);
      } else {
        return NextResponse.json({ error: 'Invalid content type' }, { status: 400 });
      }

      // Store preloaded content
      const expiresAt = new Date(now.getTime() + CACHE_DURATION_HOURS * 60 * 60 * 1000);
      await db.insert(preloadedContent).values({
        userId,
        contentType,
        contextKey,
        content,
        expiresAt,
      });

      return NextResponse.json({ 
        message: 'Content preloaded successfully',
        expiresAt 
      });
    }

    if (action === 'preload_next') {
      // Intelligently preload what the user is likely to need next
      const predictions = await predictNextContent(userId);
      
      const preloadResults = await Promise.all(
        predictions.slice(0, 3).map(async (prediction) => {
          const contextKey = prediction.topicId || prediction.unitId;
          const now = new Date();
          
          // Check if already preloaded
          const existing = await db
            .select()
            .from(preloadedContent)
            .where(and(
              eq(preloadedContent.userId, userId),
              eq(preloadedContent.contentType, 'quiz'),
              eq(preloadedContent.contextKey, contextKey),
              gte(preloadedContent.expiresAt, now)
            ))
            .limit(1);

          if (existing.length > 0) {
            return { ...prediction, status: 'already_preloaded' };
          }

          // Generate content
          const content = await generateQuizQuestions(prediction.unitId, prediction.topicId || null, userId);
          const expiresAt = new Date(now.getTime() + CACHE_DURATION_HOURS * 60 * 60 * 1000);
          
          await db.insert(preloadedContent).values({
            userId,
            contentType: 'quiz',
            contextKey,
            content,
            expiresAt,
          });

          return { ...prediction, status: 'preloaded' };
        })
      );

      return NextResponse.json({ 
        message: 'Predictive preloading complete',
        preloaded: preloadResults 
      });
    }

    if (action === 'cleanup') {
      // Clean up expired preloaded content
      const now = new Date();
      const deleted = await db
        .delete(preloadedContent)
        .where(lt(preloadedContent.expiresAt, now))
        .returning();

      return NextResponse.json({ 
        message: 'Cleanup complete',
        deletedCount: deleted.length 
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

// Generate quiz questions using AI
async function generateQuizQuestions(
  unitId: string | null,
  topicId: string | null,
  userId: string
): Promise<any> {
  try {
    const unit = unitId ? ATP_UNITS.find(u => u.id === unitId) : null;
    const topics = unitId ? TOPICS_BY_UNIT[unitId] || [] : [];
    const topic = topicId ? topics.find(t => String(t.id) === topicId) : null;

    // Get user's weak areas to focus questions
    const userWeakAreas = await getUserWeakAreas(userId, unitId || '');

    const prompt = `Generate ${PRELOAD_BATCH_SIZE} multiple choice questions for the Kenya Bar Exam.

${unit ? `Unit: ${unit.name}` : ''}
${topic ? `Topic: ${topic.name}` : ''}
${userWeakAreas.length > 0 ? `Focus on these weak areas: ${userWeakAreas.join(', ')}` : ''}

Requirements:
1. Questions should test understanding, not just memorization
2. Include a mix of difficulty levels
3. Each question must have exactly 4 options
4. Provide clear explanations for correct answers
5. Reference relevant Kenyan laws, cases, and statutes where applicable

Generate professional, exam-quality questions.`;

    const { object } = await generateObject({
      model: google('gemini-2.0-flash'),
      schema: QuestionSchema,
      prompt,
    });

    return object;
  } catch (error) {
    console.error('Error generating quiz questions:', error);
    // Return fallback questions
    return {
      questions: [
        {
          question: 'What is the supreme law of Kenya?',
          options: ['Constitution of Kenya 2010', 'Evidence Act', 'Penal Code', 'Civil Procedure Act'],
          correctIndex: 0,
          explanation: 'The Constitution of Kenya 2010 is the supreme law as stated in Article 2(1).',
          difficulty: 'easy',
        },
      ],
    };
  }
}

// Generate study content
async function generateStudyContent(unitId: string | null, topicId: string | null): Promise<any> {
  // Simplified study content generation
  const unit = unitId ? ATP_UNITS.find(u => u.id === unitId) : null;
  
  return {
    summary: `Study content for ${unit?.name || 'unknown topic'}`,
    keyPoints: [],
    practiceQuestions: [],
  };
}

// Get user's weak areas for a unit (simplified to work with current schema)
async function getUserWeakAreas(userId: string, unitId: string): Promise<string[]> {
  try {
    // Get user progress grouped by topic, using questionsCorrect/questionsAttempted
    const progress = await db
      .select({
        topicId: userProgress.topicId,
        correct: userProgress.questionsCorrect,
        attempted: userProgress.questionsAttempted,
      })
      .from(userProgress)
      .where(eq(userProgress.userId, userId));

    // Find topics with less than 60% accuracy
    const weakAreas = progress
      .filter(p => p.attempted > 0 && (p.correct / p.attempted) < 0.6)
      .map(p => {
        // Try to match topic to a unit
        for (const [uid, topics] of Object.entries(TOPICS_BY_UNIT)) {
          if (unitId && uid !== unitId) continue;
          const topic = topics.find(t => t.id === p.topicId);
          if (topic) return topic.name;
        }
        return null;
      })
      .filter(Boolean) as string[];

    return weakAreas;
  } catch (error) {
    return [];
  }
}

// Predict what content user will likely need next
async function predictNextContent(userId: string): Promise<Array<{
  unitId: string;
  topicId?: string;
  probability: number;
  reason: string;
}>> {
  try {
    const predictions: Array<{
      unitId: string;
      topicId?: string;
      probability: number;
      reason: string;
    }> = [];

    // Get user's recent activity (using topicId to infer unitId)
    const recentActivity = await db
      .select({
        topicId: userProgress.topicId,
        count: sql<number>`COUNT(*)`,
      })
      .from(userProgress)
      .where(eq(userProgress.userId, userId))
      .groupBy(userProgress.topicId)
      .orderBy(desc(sql`COUNT(*)`))
      .limit(10);

    // Predict next unit/topic based on patterns
    if (recentActivity.length > 0) {
      // Find which unit the most studied topic belongs to
      const mostStudiedTopicId = recentActivity[0].topicId;
      let mostStudiedUnit: string | null = null;
      
      for (const [unitId, topics] of Object.entries(TOPICS_BY_UNIT)) {
        if (topics.some(t => t.id === mostStudiedTopicId)) {
          mostStudiedUnit = unitId;
          break;
        }
      }

      if (mostStudiedUnit) {
        predictions.push({
          unitId: mostStudiedUnit,
          topicId: mostStudiedTopicId,
          probability: 0.8,
          reason: 'Continuing recent study pattern',
        });

        // Next unit in sequence
        const unitIndex = ATP_UNITS.findIndex(u => u.id === mostStudiedUnit);
        if (unitIndex < ATP_UNITS.length - 1) {
          predictions.push({
            unitId: ATP_UNITS[unitIndex + 1].id,
            probability: 0.6,
            reason: 'Next unit in curriculum',
          });
        }

        // Weak areas need attention
        const weakAreas = await getUserWeakAreas(userId, mostStudiedUnit);
        if (weakAreas.length > 0) {
          predictions.push({
            unitId: mostStudiedUnit,
            probability: 0.7,
            reason: 'Needs practice in weak areas',
          });
        }
      }
    } else {
      // New user - predict first units
      predictions.push({
        unitId: ATP_UNITS[0]?.id || 'atp-100',
        probability: 0.9,
        reason: 'Starting with foundational content',
      });
    }

    return predictions.sort((a, b) => b.probability - a.probability);
  } catch (error) {
    console.error('Error predicting next content:', error);
    return [];
  }
}
