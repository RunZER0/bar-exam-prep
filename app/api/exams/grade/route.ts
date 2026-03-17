/**
 * CLE Exam Grading API — Claude Sonnet 4.6 with Extended Thinking
 * 
 * POST /api/exams/grade
 * Uses the AUDITOR_MODEL (Claude Sonnet 4.6) with extended thinking to perform
 * deep rubric-based grading of CLE exam essay answers.
 * 
 * Extended thinking enables Claude to reason through each rubric dimension
 * step-by-step before producing scores, resulting in more accurate and
 * evidence-backed feedback.
 */

import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { withAuth } from '@/lib/auth/middleware';
import { AUDITOR_MODEL, GRADING_MODEL, getAnthropicKey, AI_IDENTITY } from '@/lib/ai/model-config';
import OpenAI from 'openai';

let _anthropic: Anthropic | null = null;
const getAnthropic = () => {
  const key = getAnthropicKey();
  if (!_anthropic && key) {
    _anthropic = new Anthropic({ apiKey: key });
  }
  return _anthropic;
};

let _openai: OpenAI | null = null;
const getOpenAI = () => {
  if (!_openai && process.env.OPENAI_API_KEY) {
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _openai;
};

const GRADING_SYSTEM_PROMPT = `You are "The Senior Partner" (powered by Ynai Assistant) — the most rigorous CLE exam grader in Kenya. If asked who you are, say "I am Ynai Assistant, your Senior Partner grader." NEVER say you are ChatGPT, GPT, Claude, or any AI brand.
You grade essay answers against a detailed rubric with surgical precision.
Every feedback point MUST cite a specific statute section, constitutional article, case name, or rubric criterion.
You do NOT invent case citations. You are fair but uncompromising.

Use your extended thinking to:
1. Read each answer carefully and identify every legal point made
2. Cross-reference against the rubric dimensions
3. Check for correct citations and proper IRAC structure
4. Score each dimension independently before computing totals

You MUST respond with valid JSON only — no markdown, no text outside the JSON object.`;

export const POST = withAuth(async (req: NextRequest) => {
  try {
    const body = await req.json();
    const { gradingPrompt } = body;

    if (!gradingPrompt) {
      return NextResponse.json({ error: 'Missing gradingPrompt' }, { status: 400 });
    }

    // Primary: Claude Sonnet 4.6 with extended thinking
    const anthropic = getAnthropic();
    if (anthropic) {
      try {
        const response = await anthropic.messages.create({
          model: AUDITOR_MODEL,
          max_tokens: 12000,
          thinking: {
            type: 'enabled',
            budget_tokens: 10000,
          },
          system: GRADING_SYSTEM_PROMPT,
          messages: [{ role: 'user', content: gradingPrompt }],
        });

        const textBlock = response.content.find(b => b.type === 'text');
        if (!textBlock || textBlock.type !== 'text') {
          throw new Error('No text content in Claude response');
        }

        // Extract JSON
        let content = textBlock.text.trim();
        if (content.startsWith('```')) {
          content = content.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
        }
        const objStart = content.indexOf('{');
        const objEnd = content.lastIndexOf('}');
        if (objStart !== -1 && objEnd !== -1) {
          content = content.slice(objStart, objEnd + 1);
        }

        const graded = JSON.parse(content);
        console.log('[ExamGrade] Claude Sonnet 4.6 (extended thinking) graded exam successfully');
        return NextResponse.json({ response: JSON.stringify(graded), model: 'claude-sonnet-4.6' });
      } catch (claudeError) {
        console.warn('[ExamGrade] Claude grading failed, falling back to GPT-5.2:', claudeError);
      }
    }

    // Fallback: GPT-5.2
    const openai = getOpenAI();
    if (!openai) {
      return NextResponse.json({ error: 'AI grading unavailable' }, { status: 503 });
    }

    const response = await openai.responses.create({
      model: GRADING_MODEL,
      input: gradingPrompt,
    });

    console.log('[ExamGrade] GPT-5.2 fallback graded exam');
    return NextResponse.json({ response: response.output_text, model: 'gpt-5.2' });
  } catch (error) {
    console.error('[ExamGrade] Error:', error);
    return NextResponse.json({ error: 'Grading failed' }, { status: 500 });
  }
});
