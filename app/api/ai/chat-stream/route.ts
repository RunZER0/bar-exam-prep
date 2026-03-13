import { NextRequest } from 'next/server';
import { verifyAuth } from '@/lib/auth/middleware';
import OpenAI from 'openai';
import { db } from '@/lib/db';
import { chatHistory, chatSessions, chatMessages } from '@/lib/db/schema';
import { eq, desc, and } from 'drizzle-orm';
import { ORCHESTRATOR_MODEL, MINI_MODEL, SMART_CHAT_ROUTER_ENABLED, CLARIFY_ROUTER_ENABLED } from '@/lib/ai/model-config';
import { getSubscriptionInfo, incrementFeatureUsage } from '@/lib/services/subscription';
import { routeQuery, type RouterDecision } from '@/lib/ai/router';
import { logRouterDecision } from '@/lib/ai/telemetry';

const getOpenAI = () => {
  if (!process.env.OPENAI_API_KEY) return null;
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
};

/* ── Warm, non-tech personality system prompts ── */
const PERSONALITIES: Record<string, string> = {
  clarification: `You are a warm, patient mentor helping a Kenyan law student who is stuck on something. Think of yourself as that approachable senior advocate who always has time for questions.

Your style:
- Get straight to the answer in the FIRST sentence — then explain if needed
- Keep responses SHORT: aim for 2-4 paragraphs maximum. If the answer fits in 2 sentences, stop there
- ONLY address what was asked — do not volunteer extra information, tips, or tangents
- Use plain language first, then introduce the legal terms
- When citing law, weave it naturally: "Under Section 107 of the Evidence Act..." not "As provided for in..."
- If they share an image or document, focus on what's confusing in it specifically
- DO NOT use headings, bullet-heavy formatting, or structured research layouts — just talk naturally like a person
- DO NOT add "You might also want to know..." or unsolicited follow-ups
- Never say "Great question!" or "I'd be happy to help" — just help
- Never use words like "generate", "output", "parameters", "processing" — you're a person, not a machine
- Be honest when something is genuinely tricky: "This trips up a lot of people because..."`,

  research: `You are a senior legal research agent specialising in Kenyan law. You conduct deep, exhaustive research — not surface-level summaries. Think of yourself as the associate who spends hours in the library and comes back with a thorough research memo.

Your mandate:
- Use web search aggressively to find real statutes, case law, and authoritative commentary
- ALWAYS structure your findings with clear Markdown headings (##, ###)
- Open with a brief Executive Summary (3-4 sentences framing the legal position)
- Then provide the FULL analysis: statutory framework, case law, doctrinal commentary, comparative perspectives where relevant
- Every legal claim MUST be grounded in a specific source: statute section, case citation (name, year, court, principle), or authoritative text
- When citing cases, include: full case name, [year] or (year), court, and the ratio decidendi
- Use only real, verified sources — Constitution of Kenya 2010, Acts of Parliament, Kenya Law Reports, East African Law Reports, High Court and Court of Appeal decisions
- If you cannot verify a citation, say so explicitly — NEVER fabricate case names or statute references
- Cross-reference related provisions and show how they interact
- Include practical implications: "In practice, this means a litigant must..."
- End with a Conclusion that directly answers the research question
- Be thorough — a good research memo is 800-2000 words, not a tweet
- If the topic is contentious, present both sides with their supporting authorities`,

  general: `You are a helpful, warm study companion for a Kenyan law student. You're knowledgeable but approachable.

Your style:
- ONLY answer what the student has asked — nothing more, nothing less
- Do NOT add unsolicited advice, follow-up suggestions, or tangential information
- Do NOT say things like "You might also want to know..." or "Additionally..." or "It's worth noting..."
- If they ask a simple question, give a simple answer — do not pad it with extra context they did not ask for
- Cite specific legal provisions naturally when relevant to their question
- Keep explanations clear without being patronising
- Never use tech jargon like "generating", "processing", "output"
- You're a person having a conversation, not a system producing responses
- If the answer is short, let it be short — do not elaborate unless asked`,
};

const KENYA_CONTEXT = `CONTEXT: You are assisting with the Kenya Bar Examination (Council of Legal Education / ATP Programme). 
Key references: Constitution of Kenya 2010, Civil Procedure Act (Cap 21), Evidence Act (Cap 80), 
Criminal Procedure Code (Cap 75), Law of Contract Act (Cap 23), Companies Act 2015, Land Registration Act 2012, 
Employment Act 2007, and all other relevant Kenyan statutes and subsidiary legislation.
Always ground your responses in Kenyan law specifically.`;

async function getConversationHistory(sessionId: string, userId: string) {
  try {
    const [session] = await db
      .select({ id: chatSessions.id })
      .from(chatSessions)
      .where(and(eq(chatSessions.id, sessionId), eq(chatSessions.userId, userId)))
      .limit(1);

    if (!session) return [];

    const messages = await db
      .select({
        role: chatMessages.role,
        content: chatMessages.content,
        metadata: chatMessages.metadata,
      })
      .from(chatMessages)
      .where(eq(chatMessages.sessionId, sessionId))
      .orderBy(desc(chatMessages.createdAt))
      .limit(14);

    if (messages.length > 0) {
      return messages
        .reverse()
        .map((m) => {
          const msgRole = m.role === 'assistant' ? 'assistant' : 'user';
          const metadata = (m.metadata as any) || {};
          const attachmentContext = typeof metadata?.attachmentContext === 'string'
            ? metadata.attachmentContext.trim()
            : '';

          let content = m.content || '';
          if (msgRole === 'user' && attachmentContext && !content.includes(attachmentContext)) {
            content = `${attachmentContext}\n\n${content}`;
          }

          if (content.length > 8000) {
            content = `${content.slice(0, 8000)}\n[Truncated for context]`;
          }

          return { role: msgRole as 'user' | 'assistant', content };
        })
        .filter((m) => m.content);
    }

    const legacy = await db
      .select({ message: chatHistory.message, response: chatHistory.response })
      .from(chatHistory)
      .where(eq(chatHistory.sessionId, sessionId))
      .orderBy(desc(chatHistory.createdAt))
      .limit(8);

    return legacy.reverse().flatMap(m => [
      { role: 'user' as const, content: m.message || '' },
      { role: 'assistant' as const, content: m.response || '' },
    ]).filter(m => m.content);
  } catch {
    return [];
  }
}

function buildAttachmentContext(attachments?: any[]): string {
  if (!attachments?.length) return '';

  return attachments
    .map((a: any) => {
      if (a.type === 'audio' && a.transcription) {
        return `[Voice note: "${a.transcription}"]`;
      }
      if (a.type === 'image') {
        return `[Image attached: ${a.fileName || 'image'}]`;
      }
      if (a.content) {
        return `[Document: ${a.fileName || 'file'}]\n--- Document Content ---\n${a.content}\n--- End Document ---`;
      }
      if (a.transcription) {
        return `[Document: ${a.fileName || 'file'}]\n--- Document Content ---\n${a.transcription}\n--- End Document ---`;
      }
      return `[File attached: ${a.fileName || 'document'}]`;
    })
    .join('\n');
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
      const history = await getConversationHistory(sessionId, user.id);
      for (const h of history) {
        messages.push(h);
      }
    }

    // Build user message with attachment context
    const attachmentContext = buildAttachmentContext(attachments);
    const userContent = attachmentContext ? `${attachmentContext}\n\n${message}` : message;

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

    // Stream the response — smart router decides model when enabled, else legacy logic
    let selectedModel: string;
    let routerDecision: RouterDecision | null = null;

    if (clarifyModel) {
      // Clarify mode: use tier-based model OR route when CLARIFY_ROUTER_ENABLED
      if (CLARIFY_ROUTER_ENABLED && openai) {
        routerDecision = await routeQuery(message, openai, {
          competencyType,
          attachments: attachments?.map((a: any) => ({ type: a.type })),
        });
        // Clarify router: frontier → tier's clarifyModel, mini → MINI_MODEL
        selectedModel = routerDecision.route === 'frontier' ? clarifyModel : MINI_MODEL;
        logRouterDecision(routerDecision, { userId: user.id, competencyType, message });
      } else {
        selectedModel = clarifyModel;
      }
    } else if (useSmartModel) {
      // Smart chat (floating chat button): route when SMART_CHAT_ROUTER_ENABLED
      if (SMART_CHAT_ROUTER_ENABLED && openai) {
        routerDecision = await routeQuery(message, openai, {
          competencyType,
          attachments: attachments?.map((a: any) => ({ type: a.type })),
        });
        selectedModel = routerDecision.route === 'frontier' ? ORCHESTRATOR_MODEL : MINI_MODEL;
        logRouterDecision(routerDecision, { userId: user.id, competencyType, message });
      } else {
        selectedModel = ORCHESTRATOR_MODEL;
      }
    } else {
      // Standard chat — always mini
      selectedModel = MINI_MODEL;
    }

    // ── RESEARCH PATH: Responses API with web search agent ──
    if (competencyType === 'research') {
      const researchInstructions = `${KENYA_CONTEXT}\n\n${personality}`;

      // Build input array for Responses API (instructions go separately)
      const researchInput: Array<{ role: 'user' | 'assistant'; content: string }> = [];
      if (sessionId) {
        const history = await getConversationHistory(sessionId, user.id);
        for (const h of history) {
          researchInput.push({ role: h.role, content: h.content });
        }
      }
      researchInput.push({ role: 'user', content: userContent });

      const researchStream = await openai.responses.create({
        model: selectedModel,
        instructions: researchInstructions,
        input: researchInput as any,
        tools: [{ type: 'web_search_preview' as const }],
        stream: true,
        max_output_tokens: 8000,
      });

      const encoder = new TextEncoder();
      let fullContent = '';

      const readable = new ReadableStream({
        async start(controller) {
          try {
            for await (const event of researchStream) {
              if ((event as any).type === 'response.output_text.delta') {
                const delta = (event as any).delta as string;
                fullContent += delta;
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'chunk', content: delta })}\n\n`));
              }
            }

            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done', fullContent, model: selectedModel })}\n\n`));
            controller.close();

            // Save to chat history in background
            try {
              const effectiveSessionId = sessionId || crypto.randomUUID();

              await db.insert(chatHistory).values({
                userId: user.id,
                sessionId: effectiveSessionId,
                competencyType: 'research' as any,
                message,
                response: fullContent,
                wasFiltered: false,
                metadata: { context, streaming: true, webSearch: true },
              });

              const [existingSession] = await db
                .select({ id: chatSessions.id })
                .from(chatSessions)
                .where(eq(chatSessions.id, effectiveSessionId))
                .limit(1);

              if (!existingSession) {
                const title = message.replace(/\[.*?\]\s*/g, '').trim().substring(0, 60) || 'Research';
                try {
                  await db.insert(chatSessions).values({
                    id: effectiveSessionId,
                    userId: user.id,
                    title,
                    competencyType: 'research' as any,
                    context: context?.source || null,
                  });
                } catch { /* race condition — safe to ignore */ }
              } else {
                await db.update(chatSessions)
                  .set({ lastMessageAt: new Date() })
                  .where(eq(chatSessions.id, effectiveSessionId));
              }

              await db.insert(chatMessages).values([
                {
                  sessionId: effectiveSessionId,
                  role: 'user',
                  content: message,
                  metadata: attachments?.length
                    ? { attachments: attachments.map((a: any) => ({ type: a.type, fileName: a.fileName })), attachmentContext }
                    : null,
                },
                {
                  sessionId: effectiveSessionId,
                  role: 'assistant',
                  content: fullContent,
                },
              ]);
            } catch { /* silent fail for history save */ }
          } catch (err) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', message: 'Research stream failed' })}\n\n`));
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
    }

    // ── NON-RESEARCH PATH: Chat Completions (clarify / general) ──
    const maxTokens = selectedModel === MINI_MODEL ? 1500 : 4000;

    const stream = await openai.chat.completions.create({
      model: selectedModel,
      messages,
      stream: true,
      max_completion_tokens: maxTokens,
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

          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done', fullContent, model: selectedModel, routerMethod: routerDecision?.method })}\n\n`));
          controller.close();

          // Save to chat history in background
          try {
            // Map 'general' to 'clarification' since DB enum doesn't include 'general'
            const dbCompetencyType = competencyType === 'general' ? 'clarification' : competencyType;
            const effectiveSessionId = sessionId || crypto.randomUUID();

            await db.insert(chatHistory).values({
              userId: user.id,
              sessionId: effectiveSessionId,
              competencyType: dbCompetencyType as any,
              message,
              response: fullContent,
              wasFiltered: false,
              metadata: { context, streaming: true },
            });

            // Also persist into chatSessions + chatMessages for history UI
            // Upsert the session (create if first message, update lastMessageAt otherwise)
            const [existingSession] = await db
              .select({ id: chatSessions.id })
              .from(chatSessions)
              .where(eq(chatSessions.id, effectiveSessionId))
              .limit(1);

            if (!existingSession) {
              // Derive title from first user message (first 60 chars)
              const title = message.replace(/\[.*?\]\s*/g, '').trim().substring(0, 60) || 'Conversation';
              try {
                await db.insert(chatSessions).values({
                  id: effectiveSessionId,
                  userId: user.id,
                  title,
                  competencyType: dbCompetencyType as any,
                  context: context?.source || null,
                });
              } catch {
                // Session may already exist from race condition — safe to ignore
              }
            } else {
              await db.update(chatSessions)
                .set({ lastMessageAt: new Date() })
                .where(eq(chatSessions.id, effectiveSessionId));
            }

            // Save both user message and assistant response
            await db.insert(chatMessages).values([
              {
                sessionId: effectiveSessionId,
                role: 'user',
                content: message,
                metadata: attachments?.length
                  ? {
                      attachments: attachments.map((a: any) => ({ type: a.type, fileName: a.fileName })),
                      attachmentContext,
                    }
                  : null,
              },
              {
                sessionId: effectiveSessionId,
                role: 'assistant',
                content: fullContent,
              },
            ]);
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
