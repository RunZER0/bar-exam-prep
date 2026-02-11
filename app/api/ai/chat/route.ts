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
  isAIConfigured,
} from '@/lib/ai/guardrails';
import { db } from '@/lib/db';
import { chatHistory } from '@/lib/db/schema';

export const POST = withAuth(async (req: NextRequest, user) => {
  try {
    // Check if AI is configured before processing
    if (!isAIConfigured()) {
      return NextResponse.json({
        response: "AI services are currently being configured. Please try again later or contact support if this persists. The platform administrators need to set up the AI API keys (OPENAI_API_KEY or ANTHROPIC_API_KEY) in the environment variables.",
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
    const { message, competencyType, context, sessionId } = body;

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
        const hasAttachments = context?.hasAttachments || message.includes('[User attached');
        aiResponse = await generateClarificationResponse(message, hasAttachments);
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
