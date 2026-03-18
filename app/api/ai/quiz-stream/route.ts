import { NextRequest } from 'next/server';
import { verifyAuth } from '@/lib/auth/middleware';
import OpenAI from 'openai';
import { QUIZ_MODEL, QUIZ_AUDITOR_MODEL, AI_IDENTITY } from '@/lib/ai/model-config';

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
   GENERATION — call gpt-5.4-mini with JSON mode, parse & validate
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
        content: `You are Ynai Assistant — an expert quiz question generator for the Kenya Bar Examination (ATP Programme — Kenya School of Law). If anyone asks who you are, say "I am Ynai Assistant." NEVER identify as ChatGPT, GPT, Claude, or any AI brand.

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
- NEVER ask "What is [term]?" or "Define [concept]" — those are undergraduate-level.
- Every question MUST present a FACT PATTERN, SCENARIO, or PROCEDURAL DILEMMA.
- Example BAD question: "What is res judicata?" — this is too basic.
- Example GOOD question: "Your client's suit was dismissed. The defendant now files an identical claim on the same cause of action. Under which specific provision do you object, and what must you prove?"
- Reference SPECIFIC sections, articles, rules, case law in question stems.
- Distractors must be plausible legal answers requiring careful reasoning — not obviously wrong.
- At least 30% of questions should require knowledge of SPECIFIC case law (real Kenyan or Commonwealth cases).
- If a secondary school student or an LLB freshman could answer it, it is TOO EASY. Reject and regenerate.

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
   AUDITOR — gpt-5.4-mini validates each Q for legal accuracy
   Ultra-fast: max_tokens=3, output is "pass" or "flag" only.
   Flagged questions are nuked from the queue.
   ================================================================ */
async function auditQuestion(
  openai: OpenAI,
  q: ValidQuestion
): Promise<boolean> {
  try {
    const questionPayload: Record<string, unknown> = {
      question: q.question,
      type: q.questionType,
      explanation: q.explanation,
    };
    if (q.questionType === 'mcq') {
      questionPayload.options = q.options;
      questionPayload.correctAnswer = q.options[q.correct];
    } else if (q.questionType === 'ordering') {
      questionPayload.options = q.options;
      questionPayload.correctOrder = q.correctOrder;
    } else if (q.questionType === 'text-entry') {
      questionPayload.acceptableAnswers = q.acceptableAnswers;
    }

    const completion = await openai.chat.completions.create({
      model: QUIZ_AUDITOR_MODEL,
      reasoning_effort: 'high',
      messages: [
        {
          role: 'developer',
          content: `You are a legal accuracy auditor for Kenya Bar Exam (CLE ATP) quiz questions. Respond with ONLY the single word "pass" or "flag". No punctuation, no explanation.

FLAG if ANY of these apply:
- The designated correct answer is wrong or debatable
- A legal citation (section, article, case name) is fabricated or inaccurate
- The law referenced has been repealed, amended, or superseded and the question does not reflect current law
- Multiple options could reasonably be correct
- The question is factually incorrect, misleading, or internally contradictory
- The explanation cites non-existent or incorrect legal authority
- Case law cited does not exist or is misattributed

PASS only if the question, all options, the correct answer, and the explanation are all legally accurate and current under Kenyan law.`,
        },
        { role: 'user', content: JSON.stringify(questionPayload) },
      ],
      max_completion_tokens: 2048,
      temperature: 0,
    });

    const result = (completion.choices[0]?.message?.content || '').trim().toLowerCase();
    const passed = result.startsWith('pass');
    if (!passed) {
      console.log(`[AUDIT] FLAGGED: "${q.question.slice(0, 80)}..." — auditor said: "${result}"`);
    }
    return passed;
  } catch (err: any) {
    // If auditor fails (rate limit, etc.), let the question through rather than blocking
    console.error('[AUDIT] Auditor call failed, allowing question:', err?.message || err);
    return true;
  }
}

async function auditBatch(
  openai: OpenAI,
  questions: ValidQuestion[]
): Promise<ValidQuestion[]> {
  const results = await Promise.allSettled(
    questions.map(q => auditQuestion(openai, q))
  );
  const passed = questions.filter((_, i) => {
    const r = results[i];
    return r.status === 'fulfilled' && r.value === true;
  });
  const flagged = questions.length - passed.length;
  if (flagged > 0) {
    console.log(`[AUDIT] Batch: ${passed.length}/${questions.length} passed, ${flagged} flagged and nuked.`);
  }
  return passed;
}

/* ================================================================
   DEDUPLICATION — prevent similar questions within a session
   ================================================================ */
function normalizeForDedup(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
}

function isDuplicate(newQ: ValidQuestion, existing: ValidQuestion[]): boolean {
  const normalized = normalizeForDedup(newQ.question);
  if (normalized.length < 15) return false; // too short to compare
  for (const eq of existing) {
    const existNorm = normalizeForDedup(eq.question);
    // Exact match after normalization
    if (normalized === existNorm) return true;
    // One fully contains the other (rephrased subset)
    if (normalized.includes(existNorm) || existNorm.includes(normalized)) return true;
    // High word overlap — if 70%+ words are shared, consider duplicate
    const newWords = new Set(normalized.split(' '));
    const existWords = new Set(existNorm.split(' '));
    const overlap = [...newWords].filter(w => w.length > 3 && existWords.has(w)).length;
    const minLen = Math.min(newWords.size, existWords.size);
    if (minLen > 4 && overlap / minLen > 0.7) return true;
  }
  return false;
}

function buildDedupSuffix(existing: ValidQuestion[]): string {
  if (existing.length === 0) return '';
  const stems = existing.map((q, i) => `${i + 1}. ${q.question}`).join('\n');
  return `\n\nCRITICAL — DO NOT REPEAT OR REPHRASE these already-generated questions. Generate ENTIRELY DIFFERENT questions on DIFFERENT sub-topics:\n${stems}`;
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
          /*
           * AUDITED QUIZ PIPELINE
           * ---------------------
           * Phase 1: Generate a small initial batch (6 Qs), audit all in parallel,
           *          stream the passes immediately → user starts with ~3 questions.
           * Phase 2: Generate remaining in larger batches, audit each, stream passes.
           *          By the time user finishes the first 3, more audited Qs are ready.
           * Over-generate by ~40% to compensate for auditor flags.
           */
          const INITIAL_BATCH = 6;   // small first batch for fast start
          const MAIN_BATCH = 15;     // larger follow-up batches
          const OVERSHOOT = 1.4;     // generate 40% extra to absorb flags
          let allPassed: ValidQuestion[] = [];
          let streamIndex = 0;

          // --- Phase 1: Fast start batch ---
          const phase1Target = Math.min(INITIAL_BATCH, Math.ceil(count * OVERSHOOT));
          const phase1 = await generateQuizBatch(openai, prompt, phase1Target);
          let phase1Valid = phase1.valid;

          // Audit phase 1 in parallel (all questions audited simultaneously)
          const phase1Audited = await auditBatch(openai, phase1Valid);

          // Stream phase 1 passes immediately — user can start playing
          for (const q of phase1Audited) {
            if (allPassed.length >= count) break;
            if (isDuplicate(q, allPassed)) {
              console.log(`[DEDUP] Skipped duplicate: "${q.question.slice(0, 60)}..."`);
              continue;
            }
            allPassed.push(q);
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ type: 'question', index: streamIndex, question: q })}\n\n`
              )
            );
            streamIndex++;
          }

          // --- Phase 2: Fill remaining with larger batches ---
          let retries = 0;
          const MAX_RETRIES = 3;

          while (allPassed.length < count && retries < MAX_RETRIES) {
            const remaining = count - allPassed.length;
            const batchTarget = Math.min(MAIN_BATCH, Math.ceil(remaining * OVERSHOOT));

            // Append dedup suffix so the model avoids repeating earlier questions
            const dedupPrompt = prompt + buildDedupSuffix(allPassed);
            const batch = await generateQuizBatch(openai, dedupPrompt, batchTarget);
            let batchValid = batch.valid;

            if (batchValid.length === 0) {
              retries++;
              console.log(`[QUIZ] Batch produced 0 valid questions. Retry ${retries}/${MAX_RETRIES}.`);
              continue;
            }

            // Audit this batch in parallel
            const batchAudited = await auditBatch(openai, batchValid);

            if (batchAudited.length === 0) {
              retries++;
              console.log(`[QUIZ] Entire batch flagged by auditor. Retry ${retries}/${MAX_RETRIES}.`);
              continue;
            }

            // Stream audited passes (with dedup filter)
            for (const q of batchAudited) {
              if (allPassed.length >= count) break;
              if (isDuplicate(q, allPassed)) {
                console.log(`[DEDUP] Skipped duplicate: "${q.question.slice(0, 60)}..."`);
                continue;
              }
              allPassed.push(q);
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ type: 'question', index: streamIndex, question: q })}\n\n`
                )
              );
              streamIndex++;
            }

            retries = 0; // reset on success
          }

          if (allPassed.length === 0) {
            console.error('[QUIZ] Pipeline produced 0 audited questions.', { model: QUIZ_MODEL, auditor: QUIZ_AUDITOR_MODEL });
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ type: 'error', message: `Quiz generation produced 0 questions that passed accuracy audit. Please try again.` })}\n\n`
              )
            );
            controller.close();
            return;
          }

          console.log(`[QUIZ] Pipeline complete: ${streamIndex} audited questions delivered (requested ${count}).`);

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
            ? `Model "${QUIZ_MODEL}" or auditor "${QUIZ_AUDITOR_MODEL}" not available — check model config.`
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
