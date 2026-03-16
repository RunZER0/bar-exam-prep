import { NextRequest } from 'next/server';
import { verifyAuth } from '@/lib/auth/middleware';
import OpenAI from 'openai';
import { QUIZ_MODEL } from '@/lib/ai/model-config';

const getOpenAI = () => {
  if (!process.env.OPENAI_API_KEY) return null;
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
};

/* ================================================================
   VALIDATION — strict per-question schema enforcement
   ================================================================ */
interface ValidQuestion {
  question: string;
  questionType: 'mcq' | 'ordering' | 'text-entry';
  options: string[];
  correct: number;
  explanation: string;
  difficulty: 'easy' | 'medium' | 'hard';
  correctOrder?: number[];
  acceptableAnswers?: string[];
}

function validateQuestion(q: any): ValidQuestion | null {
  if (!q || typeof q !== 'object') return null;
  if (typeof q.question !== 'string' || q.question.trim().length < 10) return null;

  const questionType = (q.questionType || 'mcq') as string;
  if (!['mcq', 'ordering', 'text-entry'].includes(questionType)) return null;

  const options = Array.isArray(q.options) ? q.options.filter((o: any) => typeof o === 'string' && o.trim()) : [];

  // MCQ: exactly 4 options, valid correct index
  if (questionType === 'mcq') {
    if (options.length < 4) return null;
    const correct = typeof q.correct === 'number' ? q.correct : parseInt(q.correct, 10);
    if (!Number.isInteger(correct) || correct < 0 || correct >= options.length) return null;
    if (typeof q.explanation !== 'string' || q.explanation.trim().length < 5) return null;
    return {
      question: q.question.trim(),
      questionType: 'mcq',
      options: options.slice(0, 4),
      correct,
      explanation: q.explanation.trim(),
      difficulty: ['easy', 'medium', 'hard'].includes(q.difficulty) ? q.difficulty : 'hard',
    };
  }

  // Ordering: 3+ options, valid correctOrder array
  if (questionType === 'ordering') {
    if (options.length < 3) return null;
    const correctOrder = Array.isArray(q.correctOrder) ? q.correctOrder : null;
    if (!correctOrder || correctOrder.length !== options.length) return null;
    const allValidIndices = correctOrder.every((i: any) => Number.isInteger(i) && i >= 0 && i < options.length);
    if (!allValidIndices) return null;
    if (typeof q.explanation !== 'string' || q.explanation.trim().length < 5) return null;
    return {
      question: q.question.trim(),
      questionType: 'ordering',
      options,
      correct: 0,
      correctOrder,
      explanation: q.explanation.trim(),
      difficulty: ['easy', 'medium', 'hard'].includes(q.difficulty) ? q.difficulty : 'hard',
    };
  }

  // Text-entry: non-empty acceptableAnswers
  if (questionType === 'text-entry') {
    const acceptable = Array.isArray(q.acceptableAnswers)
      ? q.acceptableAnswers.map((a: any) => String(a).trim()).filter(Boolean)
      : null;
    if (!acceptable || acceptable.length === 0) return null;
    if (typeof q.explanation !== 'string' || q.explanation.trim().length < 5) return null;
    return {
      question: q.question.trim(),
      questionType: 'text-entry',
      options: [],
      correct: 0,
      acceptableAnswers: acceptable,
      explanation: q.explanation.trim(),
      difficulty: ['easy', 'medium', 'hard'].includes(q.difficulty) ? q.difficulty : 'hard',
    };
  }

  return null;
}

/* ================================================================
   GENERATION — call gpt-4o-mini with JSON mode, parse & validate
   ================================================================ */
async function generateQuizBatch(
  openai: OpenAI,
  prompt: string,
  count: number
): Promise<{ valid: ValidQuestion[]; rawLength: number; rawPreview: string }> {
  const completion = await openai.chat.completions.create({
    model: QUIZ_MODEL,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: `You are an expert quiz question generator for the Kenya Bar Examination (ATP Programme — Kenya School of Law).

OUTPUT FORMAT — MANDATORY:
You MUST output a JSON object with a single key "questions" containing an array.
Example: {"questions": [{...}, {...}]}

CRITICAL: Generate EXACTLY ${count} questions. Count carefully.

QUESTION SCHEMA — every question object MUST have:
- "question": string (the question stem, max 40 words)
- "questionType": "mcq" | "ordering" | "text-entry"
- "options": string[] (4 options for mcq, 3-5 for ordering, empty [] for text-entry)
- "correct": number (0-based index of correct option for mcq; 0 for ordering/text-entry)
- "explanation": string (cite SPECIFIC section/article/case — max 25 words)
- "difficulty": "easy" | "medium" | "hard"
- For ordering: "correctOrder": number[] (indices in correct sequence)
- For text-entry: "acceptableAnswers": string[] (all acceptable answer variations)

DIFFICULTY — ABSOLUTE FLOOR:
- POSTGRADUATE law students with LLB degrees preparing for the Kenya Bar Exam.
- Test APPLICATION, ANALYSIS, SYNTHESIS — NEVER mere recall of definitions.
- Use realistic fact patterns, client scenarios, procedural dilemmas.
- Reference SPECIFIC sections, articles, rules, case law.
- Distractors must be plausible legal answers requiring careful reasoning.
- If a secondary school student could answer it, it is TOO EASY.

CONCISENESS:
- Question stems: max 40 words.
- Options: max 14 words each.
- Explanations: max 25 words, but MUST cite specific legal authority.`,
      },
      { role: 'user', content: prompt },
    ],
    max_tokens: Math.min(16000, Math.max(count * 400, 4000)),
    temperature: 0.7,
  });

  const raw = completion.choices[0]?.message?.content || '';

  // Parse the JSON object
  let questions: any[] = [];
  try {
    const parsed = JSON.parse(raw);
    questions = Array.isArray(parsed.questions) ? parsed.questions
      : Array.isArray(parsed) ? parsed
      : [];
  } catch {
    // Try extracting array from malformed response
    const arrayStart = raw.indexOf('[');
    const arrayEnd = raw.lastIndexOf(']');
    if (arrayStart !== -1 && arrayEnd > arrayStart) {
      try { questions = JSON.parse(raw.substring(arrayStart, arrayEnd + 1)); } catch { /* noop */ }
    }
  }

  // Validate each question strictly
  const valid = questions.map(validateQuestion).filter((q): q is ValidQuestion => q !== null);

  return { valid, rawLength: raw.length, rawPreview: raw.slice(0, 300) };
}

/* ================================================================
   POST — Quiz generation pipeline with validation + retry
   ================================================================ */
export async function POST(req: NextRequest) {
  try {
    const user = await verifyAuth(req);
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    const openai = getOpenAI();
    if (!openai) {
      return new Response(JSON.stringify({ error: 'AI not configured' }), { status: 500 });
    }

    const body = await req.json();
    const { prompt, count = 10 } = body;

    if (!prompt) {
      return new Response(JSON.stringify({ error: 'Prompt required' }), { status: 400 });
    }

    const encoder = new TextEncoder();

    const readable = new ReadableStream({
      async start(controller) {
        try {
          // Batch generation — split large counts into chunks of 15
          // to stay within Render's 30s request timeout per OpenAI call
          const BATCH_SIZE = 15;
          let allValid: ValidQuestion[] = [];
          let streamIndex = 0;
          const batchCount = Math.ceil(count / BATCH_SIZE);

          for (let b = 0; b < batchCount; b++) {
            const remaining = count - allValid.length;
            if (remaining <= 0) break;
            const batchTarget = Math.min(BATCH_SIZE, remaining);

            const batch = await generateQuizBatch(openai, prompt, batchTarget);
            let batchValid = batch.valid;

            // Retry once per batch if shortfall
            if (batchValid.length < batchTarget) {
              const shortfall = batchTarget - batchValid.length;
              console.log(`[QUIZ] Batch ${b + 1}/${batchCount}: ${batchValid.length}/${batchTarget} valid. Retrying for ${shortfall}.`);
              try {
                const retryPrompt = `${prompt}\n\nIMPORTANT: Generate exactly ${shortfall} questions. Output {"questions": [...]} with ${shortfall} items.`;
                const batch2 = await generateQuizBatch(openai, retryPrompt, shortfall);
                batchValid = [...batchValid, ...batch2.valid];
              } catch (retryErr) {
                console.error('[QUIZ] Retry failed:', retryErr);
              }
            }

            // Stream this batch's questions immediately
            for (const q of batchValid) {
              allValid.push(q);
              if (allValid.length <= count) {
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({ type: 'question', index: streamIndex, question: q })}\n\n`
                  )
                );
                streamIndex++;
              }
            }
          }

          if (allValid.length === 0) {
            console.error('[QUIZ] Pipeline produced 0 valid questions.', { model: QUIZ_MODEL });
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ type: 'error', message: `Quiz generation produced 0 valid questions. Model: ${QUIZ_MODEL}.` })}\n\n`
              )
            );
            controller.close();
            return;
          }

          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: 'done', totalQuestions: streamIndex })}\n\n`
            )
          );
          controller.close();
        } catch (err: any) {
          console.error('[QUIZ] Pipeline error:', err?.message || err);
          const errMsg = err?.message || 'Unknown error';
          const isModelErr = err?.code === 'model_not_found' || errMsg.includes('does not exist');
          const isRateLimit = err?.status === 429;
          const friendlyMsg = isModelErr
            ? `Model "${QUIZ_MODEL}" not available — check QUIZ_MODEL config.`
            : isRateLimit
            ? 'AI is busy — please wait a moment and try again.'
            : `Quiz generation failed: ${errMsg.slice(0, 150)}`;
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: 'error', message: friendlyMsg })}\n\n`
            )
          );
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Quiz stream error:', error);
    return new Response(JSON.stringify({ error: 'Failed' }), { status: 500 });
  }
}
