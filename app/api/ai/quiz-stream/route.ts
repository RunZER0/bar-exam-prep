import { NextRequest } from 'next/server';
import { verifyAuth } from '@/lib/auth/middleware';
import OpenAI from 'openai';
import { MINI_MODEL } from '@/lib/ai/model-config';

const getOpenAI = () => {
  if (!process.env.OPENAI_API_KEY) return null;
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
};

/**
 * Streaming quiz question generator.
 * Streams individual questions as SSE events so the UI can show the first question
 * instantly while the rest generate in the background.
 *
 * Uses gpt-5-mini (MINI_MODEL) for fast, cost-effective generation.
 */
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

    // We ask the model to output questions as a JSON array, streamed
    // We parse out individual objects as they arrive
    const stream = await openai.chat.completions.create({
      model: MINI_MODEL,
      messages: [
        {
          role: 'system',
          content: `You are an expert quiz question generator for the Kenya Bar Examination (ATP Programme — Kenya School of Law).
You must output ONLY a JSON array — no markdown, no extra text.
Start outputting immediately — every character counts for speed.

CRITICAL: You MUST generate EXACTLY the number of questions requested. Not fewer. Count carefully.
SPEED REQUIREMENTS:
- Keep each question stem concise (max ~32 words).
- Keep each option concise (max ~14 words).
- Keep each explanation concise (max ~20 words) while still citing authority.
- Output compact JSON with no extra whitespace and no commentary.

CRITICAL DIFFICULTY REQUIREMENTS:
- These questions are for POSTGRADUATE law students preparing for the Kenya Bar Exam, NOT undergraduates or beginners.
- Questions MUST test application, analysis, and synthesis — NOT mere recall of definitions.
- Use realistic fact patterns, client scenarios, and procedural dilemmas that a pupil advocate would face.
- Reference SPECIFIC sections, articles, rules, and case law — never ask vague conceptual questions.
- Distractors must be plausible legal answers that require careful reasoning to eliminate.
- Include questions on procedure, evidence, ethics, and drafting — not just substantive law.
- Think CLE exam standard: if a question could appear in a secondary school test, it is TOO EASY.`,
        },
        { role: 'user', content: prompt },
      ],
      // gpt-5-mini is a reasoning model — internal chain-of-thought tokens
      // consume max_completion_tokens budget. Need ~3-4x headroom.
      stream: true,
      max_completion_tokens: Math.min(40000, Math.max(count * 1200, 10000)),
    });

    const encoder = new TextEncoder();

    const readable = new ReadableStream({
      async start(controller) {
        let rawContent = '';
        try {
          // Phase 1: Accumulate ALL content from the model stream.
          // gpt-5-mini is a reasoning model — it buffers internally during
          // chain-of-thought, then outputs the response. A character-by-character
          // streaming parser has state-corruption bugs across chunk boundaries,
          // so we accumulate and parse once at the end.
          for await (const chunk of stream) {
            const delta = chunk.choices[0]?.delta?.content;
            if (!delta) continue;
            rawContent += delta;
          }

          // Phase 2: Extract and parse the JSON array from the response.
          // Handle potential markdown code blocks or preamble text.
          let jsonText = rawContent.trim();
          const codeBlockMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)```/);
          if (codeBlockMatch) jsonText = codeBlockMatch[1].trim();

          const arrayStart = jsonText.indexOf('[');
          const arrayEnd = jsonText.lastIndexOf(']');
          if (arrayStart === -1 || arrayEnd <= arrayStart) {
            throw new Error('No JSON array found in model output');
          }
          jsonText = jsonText.substring(arrayStart, arrayEnd + 1);

          const questions = JSON.parse(jsonText);
          if (!Array.isArray(questions) || questions.length === 0) {
            throw new Error('Parsed result is not a non-empty array');
          }

          // Phase 3: Send each question as an SSE event.
          for (let i = 0; i < questions.length; i++) {
            const q = questions[i];
            q.questionType = q.questionType || 'mcq';
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ type: 'question', index: i, question: q })}\n\n`
              )
            );
          }

          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: 'done', totalQuestions: questions.length })}\n\n`
            )
          );
          controller.close();
        } catch (err: any) {
          console.error('[QUIZ-STREAM] Error:', err?.message || err, 'Raw length:', rawContent.length, 'Preview:', rawContent.slice(0, 500));
          const errMsg = err?.message || 'Unknown error';
          const isModelErr = err?.code === 'model_not_found' || errMsg.includes('does not exist');
          const isRateLimit = err?.status === 429;
          const isParseErr = errMsg.includes('JSON') || errMsg.includes('array') || errMsg.includes('Unexpected');
          const friendlyMsg = isModelErr
            ? `Model "${MINI_MODEL}" not found — check MINI_MODEL config.`
            : isRateLimit
            ? 'AI is busy — please wait a moment and try again.'
            : isParseErr
            ? `AI returned unparseable quiz data. Raw length: ${rawContent.length}. Preview: ${rawContent.slice(0, 200)}`
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
