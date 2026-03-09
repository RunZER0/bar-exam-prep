import { NextRequest } from 'next/server';
import { verifyAuth } from '@/lib/auth/middleware';
import OpenAI from 'openai';
import { db } from '@/lib/db';
import { chatHistory } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { ORCHESTRATOR_MODEL, MINI_MODEL } from '@/lib/ai/model-config';
import { getSubscriptionInfo, incrementFeatureUsage } from '@/lib/services/subscription';

const getOpenAI = () => {
  if (!process.env.OPENAI_API_KEY) return null;
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
};

/* ── Warm, non-tech personality system prompts ── */
const PERSONALITIES: Record<string, string> = {
  clarification: `You are a warm, patient mentor helping a Kenyan law student who is stuck on something. Think of yourself as that approachable senior advocate who always has time for questions.

Your style:
- Address the problem directly — no filler, no preamble
- Be concise but thorough. If someone asks a simple question, give a simple answer
- Use plain language first, then introduce the legal terms
- When citing law, weave it naturally: "Under Section 107 of the Evidence Act..." not "As provided for in..."
- If they share an image or document, focus on what's confusing in it specifically
- End with a brief, genuine check-in: "Does that clear it up?" or "Want me to go deeper on any part?"
- Never say "Great question!" or "I'd be happy to help" — just help
- Never use words like "generate", "output", "parameters", "processing" — you're a person, not a machine
- Be honest when something is genuinely tricky: "This trips up a lot of people because..."`,

  research: `You are a thorough legal research assistant for Kenyan law. Think of yourself as a seasoned law librarian who knows exactly where to find everything.

Your style:
- Structure your research findings clearly with proper headings
- ALWAYS cite specific sections, articles, and case law — this is non-negotiable
- Use only verified and credible sources: Constitution of Kenya 2010, Acts of Parliament, Kenya Law Reports, East African Law Reports
- When citing cases, include: case name, year, court, and the key principle
- If you're uncertain about a citation, say so rather than fabricating one
- Present findings in a logical flow: statutory framework → case law → analysis → practical application
- Never invent case names or statute references
- Include the practical implication: "In practice, this means..."
- Cross-reference related provisions where helpful`,

  general: `You are a helpful, warm study companion for a Kenyan law student. You're knowledgeable but approachable.

Your style:
- Be direct and address what they're asking
- Cite specific legal provisions naturally
- Keep explanations clear without being patronising
- Never use tech jargon like "generating", "processing", "output"
- You're a person having a conversation, not a system producing responses`,
};

const KENYA_CONTEXT = `CONTEXT: You are assisting with the Kenya Bar Examination (Council of Legal Education / ATP Programme). 
Key references: Constitution of Kenya 2010, Civil Procedure Act (Cap 21), Evidence Act (Cap 80), 
Criminal Procedure Code (Cap 75), Law of Contract Act (Cap 23), Companies Act 2015, Land Registration Act 2012, 
Employment Act 2007, and all other relevant Kenyan statutes and subsidiary legislation.
Always ground your responses in Kenyan law specifically.`;

async function getConversationHistory(sessionId: string) {
  try {
    const messages = await db
      .select({ role: chatHistory.message, content: chatHistory.response })
      .from(chatHistory)
      .where(eq(chatHistory.sessionId, sessionId))
      .orderBy(desc(chatHistory.createdAt))
      .limit(8);
    return messages.reverse().flatMap(m => [
      { role: 'user' as const, content: m.role || '' },
      { role: 'assistant' as const, content: m.content || '' },
    ]).filter(m => m.content);
  } catch {
    return [];
  }
}

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
    const {
      message,
      competencyType = 'general',
      sessionId,
      attachments,
      context,
      useSmartModel = false,
    } = body;

    if (!message) {
      return new Response(JSON.stringify({ error: 'Message required' }), { status: 400 });
    }

    // ── Subscription gate for premium streaming features ──
    const gatedTypes: Record<string, string> = { clarification: 'clarify', research: 'research' };
    const premiumFeature = gatedTypes[competencyType];
    let clarifyModel: string | null = null;
    if (premiumFeature) {
      const sub = await getSubscriptionInfo(user.id);
      if (!sub.canAccess(premiumFeature as any)) {
        const fu = sub.featureUsage[premiumFeature as keyof typeof sub.featureUsage];
        return new Response(JSON.stringify({
          error: 'FEATURE_LIMIT',
          message: sub.trialExpired
            ? 'Your free trial has ended. Subscribe to continue.'
            : `You've used ${fu?.used ?? 0}/${fu?.limit ?? 0} sessions this week. Upgrade or buy an add-on pass.`,
          upgradeUrl: '/subscribe',
          feature: premiumFeature,
          tier: sub.tier,
        }), { status: 403 });
      }
      await incrementFeatureUsage(user.id, premiumFeature as any);
      if (premiumFeature === 'clarify') {
        clarifyModel = sub.clarifyModel;
      }
    }

    // Build system prompt
    const personality = PERSONALITIES[competencyType] || PERSONALITIES.general;
    const smartModelAddendum = useSmartModel
      ? `\n\nIMPORTANT: You are running as the premium AI assistant. Provide the most thorough, accurate, and up-to-date answers possible. When discussing recent legal developments, case law amendments, or current events in Kenyan law, clearly state the most recent information you have. If a topic may have changed recently, note the date of your knowledge and advise the user to verify with official sources like Kenya Law Reports (kenyalaw.org) or the Kenya Gazette.`
      : '';
    const systemPrompt = `${KENYA_CONTEXT}\n\n${personality}${smartModelAddendum}`;

    // Build messages array
    const messages: OpenAI.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
    ];

    // Add conversation history
    if (sessionId) {
      const history = await getConversationHistory(sessionId);
      for (const h of history) {
        messages.push(h);
      }
    }

    // Build user message with attachment context
    let userContent = message;
    if (attachments?.length) {
      const attDesc = attachments.map((a: any) => {
        if (a.type === 'audio' && a.transcription) return `[Voice note: "${a.transcription}"]`;
        if (a.type === 'image') return `[Image attached: ${a.fileName || 'image'}]`;
        return `[File attached: ${a.fileName || 'document'}]`;
      }).join('\n');
      userContent = `${attDesc}\n\n${message}`;
    }

    // Handle image attachments for vision
    const hasImageData = attachments?.some((a: any) => a.type === 'image' && a.dataUrl);
    if (hasImageData) {
      const contentParts: any[] = [{ type: 'text', text: userContent }];
      for (const att of attachments.filter((a: any) => a.type === 'image' && a.dataUrl)) {
        contentParts.push({
          type: 'image_url',
          image_url: { url: att.dataUrl },
        });
      }
      messages.push({ role: 'user', content: contentParts });
    } else {
      messages.push({ role: 'user', content: userContent });
    }

    // Stream the response — use tier-based model for clarify, smart model for floating chat, mini for others
    const selectedModel = clarifyModel
      ? clarifyModel
      : useSmartModel
        ? ORCHESTRATOR_MODEL
        : MINI_MODEL;

    const stream = await openai.chat.completions.create({
      model: selectedModel,
      messages,
      stream: true,
      temperature: 0.7,
      max_completion_tokens: useSmartModel ? 4000 : (competencyType === 'research' ? 4000 : 2000),
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

          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done', fullContent })}\n\n`));
          controller.close();

          // Save to chat history in background
          try {
            // Map 'general' to 'clarification' since DB enum doesn't include 'general'
            const dbCompetencyType = competencyType === 'general' ? 'clarification' : competencyType;
            await db.insert(chatHistory).values({
              userId: user.id,
              sessionId: sessionId || crypto.randomUUID(),
              competencyType: dbCompetencyType as any,
              message,
              response: fullContent,
              wasFiltered: false,
              metadata: { context, streaming: true },
            });
          } catch {
            // Silent fail for history save
          }
        } catch (err) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', message: 'Stream failed' })}\n\n`));
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Streaming chat error:', error);
    return new Response(JSON.stringify({ error: 'Failed' }), { status: 500 });
  }
}
