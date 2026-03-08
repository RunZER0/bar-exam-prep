import { NextRequest } from 'next/server';
import { verifyAuth } from '@/lib/auth/middleware';
import OpenAI from 'openai';
import { ORCHESTRATOR_MODEL } from '@/lib/ai/model-config';

const getOpenAI = () => {
  if (!process.env.OPENAI_API_KEY) return null;
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
};

/**
 * Streaming quiz question generator.
 * Streams individual questions as SSE events so the UI can show the first question
 * instantly while the rest generate in the background.
 *
 * Uses GPT-5.2 (ORCHESTRATOR_MODEL) for fast, high-quality generation.
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
      model: ORCHESTRATOR_MODEL,
      messages: [
        {
          role: 'system',
          content: `You are a quiz question generator for the Kenya Bar Examination (ATP Programme).
You must output ONLY a JSON array — no markdown, no extra text.
Start outputting immediately — every character counts for speed.`,
        },
        { role: 'user', content: prompt },
      ],
      stream: true,
      temperature: 0.8,
      max_completion_tokens: Math.max(count * 350, 2000),
    });

    const encoder = new TextEncoder();
    let buffer = '';
    let bracketDepth = 0;
    let inString = false;
    let escapeNext = false;
    let questionCount = 0;
    let objectStart = -1;
    let startedArray = false;

    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const delta = chunk.choices[0]?.delta?.content;
            if (!delta) continue;
            buffer += delta;

            // Parse buffer character by character to extract complete JSON objects
            for (let i = 0; i < buffer.length; i++) {
              const ch = buffer[i];

              if (escapeNext) {
                escapeNext = false;
                continue;
              }

              if (ch === '\\' && inString) {
                escapeNext = true;
                continue;
              }

              if (ch === '"') {
                inString = !inString;
                continue;
              }

              if (inString) continue;

              if (ch === '[' && !startedArray) {
                startedArray = true;
                continue;
              }

              if (ch === '{') {
                if (bracketDepth === 0) {
                  objectStart = i;
                }
                bracketDepth++;
              } else if (ch === '}') {
                bracketDepth--;
                if (bracketDepth === 0 && objectStart !== -1) {
                  // We have a complete JSON object
                  const jsonStr = buffer.substring(objectStart, i + 1);
                  try {
                    const question = JSON.parse(jsonStr);
                    // Normalize questionType
                    question.questionType = question.questionType || 'mcq';
                    questionCount++;
                    // Send the question as an SSE event
                    controller.enqueue(
                      encoder.encode(
                        `data: ${JSON.stringify({ type: 'question', index: questionCount - 1, question })}\n\n`
                      )
                    );
                  } catch {
                    // If parsing fails, we might have partial JSON — skip
                  }
                  // Trim buffer up to and including this object
                  buffer = buffer.substring(i + 1);
                  i = -1; // Reset loop index since we modified buffer
                  objectStart = -1;
                }
              }
            }
          }

          // Send completion event
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: 'done', totalQuestions: questionCount })}\n\n`
            )
          );
          controller.close();
        } catch (err) {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: 'error', message: 'Generation failed' })}\n\n`
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
