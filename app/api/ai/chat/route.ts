import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { getSubscriptionInfo, incrementFeatureUsage } from '@/lib/services/subscription';
import { 
  generateDraftingResponse, 
  generateResearchResponse,
  generateOralAdvocacyFeedback,
  generateBanterResponse,
  generateClarificationResponse,
  generateStudyResponseWithRAG,
  generateSmartStudySuggestions,
  generateContextAwareResponse,
  isAIConfigured,
} from '@/lib/ai/guardrails';
import { db } from '@/lib/db';
import { chatHistory, chatMessages, chatSessions, users } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';

// Helper to get conversation history for context
async function getConversationHistory(sessionId: string, limit: number = 10) {
  try {
    const messages = await db
      .select({
        role: chatMessages.role,
        content: chatMessages.content,
      })
      .from(chatMessages)
      .where(eq(chatMessages.sessionId, sessionId))
      .orderBy(desc(chatMessages.createdAt))
      .limit(limit);
    
    // Reverse to get chronological order
    return messages.reverse();
  } catch (error) {
    console.error('Error fetching conversation history:', error);
    return [];
  }
}

export const POST = withAuth(async (req: NextRequest, user) => {
  try {
    // Check if AI is configured before processing
    if (!isAIConfigured()) {
      return NextResponse.json({
        response: "AI services are currently unavailable. Please contact support to ensure OPENAI_API_KEY is configured in the environment.",
        filtered: false,
        guardrails: {
          isHallucination: false,
          isOffTopic: false,
          isReliable: false,
          confidence: 0,
          warnings: ['AI not configured'],
        },
        error: 'AI_NOT_CONFIGURED',
      });
    }

    const body = await req.json();
    const { 
      message, 
      competencyType, 
      context, 
      sessionId,
      attachments, // Array of { type, dataUrl?, transcription?, fileName }
      useWebSearch, // Whether to enable web search for this request
    } = body;
    
    // Load conversation history if sessionId is provided (context awareness)
    let conversationHistory: { role: string; content: string }[] = [];
    if (sessionId) {
      conversationHistory = await getConversationHistory(sessionId);
    }

    if (!message || !competencyType) {
      return NextResponse.json(
        { error: 'Message and competency type are required' },
        { status: 400 }
      );
    }

    let aiResponse;
    let sources;

    // ── Subscription gate for premium features ──
    // Exam generation (context.examGeneration) is gated separately as 'cle_exam' on the exam page
    // Internal drafting operations (checkpoint-generate, checkpoint-eval) are part of an active session
    // and should NOT consume a usage credit — only session starts count.
    const DRAFTING_INTERNAL_MODES = new Set(['checkpoint-generate', 'checkpoint-eval']);
    const isDraftingInternal = competencyType === 'drafting' && DRAFTING_INTERNAL_MODES.has(context?.mode);
    const gatedTypes: Record<string, string> = { drafting: 'drafting', research: 'research', clarification: 'clarify' };
    const premiumFeature = (context?.examGeneration || isDraftingInternal) ? null : gatedTypes[competencyType];
    if (premiumFeature) {
      const sub = await getSubscriptionInfo(user.id);
      if (!sub.canAccess(premiumFeature as any)) {
        const labels: Record<string, string> = { drafting: 'Legal Drafting', research: 'Research', clarify: 'Clarification' };
        const label = labels[premiumFeature] || premiumFeature;
        const fu = sub.featureUsage[premiumFeature as keyof typeof sub.featureUsage];
        return NextResponse.json({
          error: 'FEATURE_LIMIT',
          response: sub.trialExpired
            ? `Your free trial has ended. Subscribe to continue using ${label}.`
            : `You've used ${fu?.used ?? 0}/${fu?.limit ?? 0} ${label} sessions this week. Upgrade or buy an add-on pass.`,
          upgradeUrl: '/subscribe',
          feature: premiumFeature,
          tier: sub.tier,
        }, { status: 403 });
      }
      await incrementFeatureUsage(user.id, premiumFeature as any);
    }

    switch (competencyType) {
      case 'drafting':
        aiResponse = await generateDraftingResponse(
          message,
          context?.documentType || 'General Legal Document'
        );
        break;
      
      case 'research':
        aiResponse = await generateResearchResponse(
          message,
          context?.topicArea || 'General Legal Research'
        );
        break;
      
      case 'study':
        // RAG-enhanced study response
        const studyResponse = await generateStudyResponseWithRAG(
          message,
          context?.unitId || 'atp-100',
          context?.topicArea || 'General Study',
          context?.statutes || []
        );
        aiResponse = studyResponse;
        sources = studyResponse.sources;
        break;
      
      case 'oral':
        aiResponse = await generateOralAdvocacyFeedback(
          context?.scenario || message,
          message
        );
        break;

      case 'banter':
        aiResponse = await generateBanterResponse(message);
        break;

      case 'clarification':
        // Build enhanced message with attachments and history
        let enhancedMessage = message;
        
        // Add attachment context
        if (attachments && attachments.length > 0) {
          const attachmentDescriptions = attachments.map((att: any) => {
            if (att.type === 'audio' && att.transcription) {
              return `[Voice note transcription: "${att.transcription}"]`;
            } else if (att.type === 'image') {
              return `[User attached an image: ${att.fileName || 'image'}]`;
            } else if (att.content) {
              // Document with extracted text content
              return `[Document: ${att.fileName || 'file'}]\n--- Document Content ---\n${att.content}\n--- End Document ---`;
            } else if (att.transcription) {
              return `[Document: ${att.fileName || 'file'}]\n--- Document Content ---\n${att.transcription}\n--- End Document ---`;
            } else {
              return `[User attached a ${att.type}: ${att.fileName || 'file'}]`;
            }
          }).join('\n');
          enhancedMessage = `${attachmentDescriptions}\n\nUser's question: ${message}`;
        }
        
        // Use context-aware response if we have conversation history
        if (conversationHistory.length > 0) {
          aiResponse = await generateContextAwareResponse(
            enhancedMessage,
            conversationHistory,
            'clarification',
            context,
            attachments
          );
        } else {
          const hasAttachments = (attachments && attachments.length > 0) || message.includes('[User attached');
          aiResponse = await generateClarificationResponse(enhancedMessage, hasAttachments);
        }
        break;
      
      default:
        return NextResponse.json(
          { error: 'Invalid competency type' },
          { status: 400 }
        );
    }

    // Save chat history
    const effectiveSessionId = sessionId || crypto.randomUUID();
    await db.insert(chatHistory).values({
      userId: user.id,
      sessionId: effectiveSessionId,
      competencyType: competencyType as any,
      message,
      response: aiResponse.content,
      wasFiltered: aiResponse.filtered,
      metadata: {
        guardrails: aiResponse.guardrails,
        context,
        sources,
      },
    });

    // Also persist into chatSessions + chatMessages for history UI
    try {
      const [existingSession] = await db
        .select({ id: chatSessions.id })
        .from(chatSessions)
        .where(eq(chatSessions.id, effectiveSessionId))
        .limit(1);

      if (!existingSession) {
        const title = message.replace(/\[.*?\]\s*/g, '').trim().substring(0, 60) || 'Conversation';
        try {
          await db.insert(chatSessions).values({
            id: effectiveSessionId,
            userId: user.id,
            title,
            competencyType: competencyType as any,
            context: context?.source || null,
          });
        } catch { /* race condition safe */ }
      } else {
        await db.update(chatSessions)
          .set({ lastMessageAt: new Date() })
          .where(eq(chatSessions.id, effectiveSessionId));
      }

      await db.insert(chatMessages).values([
        { sessionId: effectiveSessionId, role: 'user', content: message },
        { sessionId: effectiveSessionId, role: 'assistant', content: aiResponse.content },
      ]);
    } catch { /* silent fail for session/message save */ }

    return NextResponse.json({
      response: aiResponse.content,
      filtered: aiResponse.filtered,
      guardrails: aiResponse.guardrails,
      sources,
    });
  } catch (error: any) {
    console.error('Error generating AI response:', error);
    
    if (error.message === 'AI_NOT_CONFIGURED') {
      return NextResponse.json({
        response: "AI services are currently unavailable. Please contact support to resolve this issue.",
        filtered: false,
        guardrails: {
          isHallucination: false,
          isOffTopic: false,
          isReliable: false,
          confidence: 0,
        },
        error: 'AI_NOT_CONFIGURED',
      });
    }
    
    return NextResponse.json(
      { error: 'Failed to generate response. Please try again.' },
      { status: 500 }
    );
  }
});
