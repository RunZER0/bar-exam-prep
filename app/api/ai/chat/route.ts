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
} from '@/lib/ai/guardrails';
import { db } from '@/lib/db';
import { chatHistory } from '@/lib/db/schema';

export const POST = withAuth(async (req: NextRequest, user) => {
  try {
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
  } catch (error) {
    console.error('Error generating AI response:', error);
    return NextResponse.json(
      { error: 'Failed to generate response' },
      { status: 500 }
    );
  }
});
