import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
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
    await db.insert(chatHistory).values({
      userId: user.id,
      sessionId: sessionId || crypto.randomUUID(),
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
