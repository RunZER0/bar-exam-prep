import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { generateSmartStudySuggestions } from '@/lib/ai/guardrails';

export const POST = withAuth(async (req: NextRequest, user) => {
  try {
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
  } catch (error) {
    console.error('Error generating suggestions:', error);
    return NextResponse.json(
      { error: 'Failed to generate suggestions' },
      { status: 500 }
    );
  }
});
