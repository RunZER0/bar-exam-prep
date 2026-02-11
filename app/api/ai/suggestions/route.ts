import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { generateSmartStudySuggestions, isAIConfigured } from '@/lib/ai/guardrails';

export const POST = withAuth(async (req: NextRequest, user) => {
  try {
    // Check if AI is configured
    if (!isAIConfigured()) {
      // Return default suggestions when AI is not configured
      return NextResponse.json({
        suggestions: [
          {
            topic: 'Review Your Course Materials',
            reason: 'Start with your lecture notes and recommended textbooks',
            prompt: 'What are the key concepts I should focus on?',
          },
          {
            topic: 'Practice Past Papers',
            reason: 'Past exam questions reveal examiner expectations',
            prompt: 'How should I approach answering bar exam questions?',
          },
        ],
      });
    }

    const body = await req.json();
    const { unitId, unitName, recentTopics, weakAreas } = body;

    if (!unitId || !unitName) {
      return NextResponse.json(
        { error: 'Unit ID and name are required' },
        { status: 400 }
      );
    }

    const result = await generateSmartStudySuggestions(
      unitId,
      unitName,
      recentTopics || [],
      weakAreas || []
    );

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error generating suggestions:', error);
    
    // Return fallback suggestions on error
    return NextResponse.json({
      suggestions: [
        {
          topic: 'Getting Started',
          reason: 'Build a strong foundation',
          prompt: 'Give me an overview of what I need to know for the bar exam.',
        },
      ],
    });
  }
});
