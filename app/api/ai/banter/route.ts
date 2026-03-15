/**
 * Legal Banter API — personalised, sequential entertainment
 *
 * POST /api/ai/banter
 *   body: { type: 'greeting' | 'content' | 'roast', category?, userName?, preferences?, message?, stream? }
 *   returns: { response: string } OR SSE stream if stream=true
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { isAIConfigured, callAIFast } from '@/lib/ai/guardrails';
import OpenAI from 'openai';
import { MINI_MODEL } from '@/lib/ai/model-config';

const getOpenAI = () => {
  if (!process.env.OPENAI_API_KEY) return null;
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
};

const CATEGORY_PROMPTS: Record<string, string> = {
  jokes:
    'Tell me ONE short, genuinely funny legal joke or lawyer joke. Keep it under 60 words. Just the joke — no preamble, no "here\'s a joke".',
  facts:
    'Share ONE fascinating or bizarre legal fact from history — something most people would never guess. Keep it under 80 words. Just the fact — no preamble.',
  cases:
    'Tell me about ONE weird, unusual, or landmark court case that actually happened. Give it a catchy title, include the year and jurisdiction. Keep under 120 words. Just the case — no preamble.',
  puns:
    'Give me ONE clever legal pun or one-liner that would make a lawyer groan. Just the pun — no preamble.',
  world:
    'Share ONE strange, surprising, or funny law from a specific country. Include the country name. Keep under 60 words. Just the fact — no preamble.',
  popculture:
    'Tell me about ONE interesting or inaccurate way law is portrayed in a specific movie or TV show. Name the movie/show. Keep under 100 words. Just the content — no preamble.',
};

export const POST = withAuth(async (req: NextRequest, user) => {
  try {
    if (!isAIConfigured()) {
      return NextResponse.json({ response: 'AI services are currently unavailable.' }, { status: 503 });
    }

    const body = await req.json();
    const { type, category, userName, preferences, message, previousContent } = body;

    const name = userName || user.displayName?.split(' ')[0] || 'Counsel';

    // ── GREETING ──
    if (type === 'greeting') {
      const prompt = `You are a warm, witty, relaxed legal companion for Kenyan law students. The student's name is ${name}.

They just opened the Legal Banter section to take a break from studying.

Write a SHORT, warm, personal greeting (1-2 sentences max). Be playful and relaxed — like a friend greeting them at a café. Reference that they're probably tired from studying or deserve some fun.

${preferences?.likedCategories?.length ? `They seem to enjoy: ${preferences.likedCategories.join(', ')}.` : ''}

DO NOT use emojis. DO NOT say "Welcome to Legal Banter". Just be natural and warm. Keep it under 30 words.
NEVER use em dashes. Use regular hyphens (-) only.
Do NOT use any markdown formatting whatsoever - no bold (**), no headings (#), no italics (*), no bullet lists, no backticks. Output plain conversational text only.`;

      const response = await callAIFast(prompt, 200);
      return NextResponse.json({ response });
    }

    // ── CONTENT ──
    if (type === 'content') {
      const cat = category || 'jokes';
      const basePrompt = CATEGORY_PROMPTS[cat] || CATEGORY_PROMPTS.jokes;

      // Build preference context
      let prefContext = '';
      if (preferences?.highRated?.length) {
        prefContext = `\n\nThe user has rated these types of content highly before, so match this style:\n${preferences.highRated.slice(0, 3).join('\n')}`;
      }

      // Avoid repetition
      let avoidContext = '';
      if (previousContent) {
        avoidContext = `\n\nIMPORTANT: Do NOT repeat or closely paraphrase this previous content:\n"${previousContent.slice(0, 200)}"`;
      }

      const prompt = `You are a witty, knowledgeable legal entertainer helping Kenyan law students relax.

${basePrompt}${prefContext}${avoidContext}

Be genuinely entertaining and factual. When mentioning real cases, ensure they actually happened.
NEVER use em dashes. Use regular hyphens (-) only.
Do NOT use any markdown formatting whatsoever - no bold (**), no headings (#), no italics (*), no bullet lists, no backticks. Output plain conversational text only.
Be CREATIVE and VARIED - never repeat the same joke, fact, or case twice. Each response should feel fresh and surprising.`;

      // Streaming mode — return SSE stream
      if (body.stream) {
        const openai = getOpenAI();
        if (!openai) {
          return NextResponse.json({ response: 'AI services are currently unavailable.' }, { status: 503 });
        }

        const stream = await openai.chat.completions.create({
          model: MINI_MODEL,
          messages: [{ role: 'user', content: prompt }],
          stream: true,
          temperature: 0.9,
          max_completion_tokens: 4000,
        });

        const encoder = new TextEncoder();
        let fullContent = '';

        const readable = new ReadableStream({
          async start(controller) {
            try {
              for await (const chunk of stream) {
                const delta = chunk.choices[0]?.delta?.content;
                if (delta) {
                  fullContent += delta;
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'chunk', content: delta })}\n\n`));
                }
              }
              // Replace em dashes in final content
              const cleaned = fullContent.replace(/\u2014/g, '-');
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done', content: cleaned })}\n\n`));
              controller.close();
            } catch {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error' })}\n\n`));
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
      }

      // Non-streaming fallback
      const response = await callAIFast(prompt, 600);
      return NextResponse.json({ response });
    }

    // ── ROAST (playful banter chat) ──
    if (type === 'roast') {
      const userMsg = message || '';
      const prompt = `You are a playful, witty legal companion having a fun roast battle with a Kenyan law student named ${name}.

Rules:
- Be clever and funny, reference law/legal concepts in your roasts
- Keep it respectful — roast their legal knowledge, study habits, or lawyer stereotypes, never personal attacks
- Match their energy — if they're playful, be playful back
- Keep responses SHORT (1-3 sentences)
- Use Kenyan legal context when possible (Kenyan courts, Kenyan law school life)
- Be the kind of friend who teases but you know they care

Student said: "${userMsg}"

Respond with a witty comeback.
NEVER use em dashes. Use regular hyphens (-) only.
Do NOT use any markdown formatting - no bold, no headings, no italics, no lists, no backticks. Plain text only.`;

      const response = await callAIFast(prompt, 300);
      return NextResponse.json({ response });
    }

    return NextResponse.json({ error: 'Invalid type. Use: greeting, content, or roast' }, { status: 400 });
  } catch (error) {
    console.error('Banter API error:', error);
    return NextResponse.json({ response: 'Even the best comedians have off days. Try again?' }, { status: 500 });
  }
});
