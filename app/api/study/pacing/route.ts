import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { verifyIdToken } from '@/lib/firebase/admin';
import {
  getSessionPacingState,
  analyzePacing,
  recordPacingSuggestion,
  recordBreakTaken,
  getTodayCumulativeStudy,
  generatePacingInsights,
} from '@/lib/services/pacing-engine';

/**
 * GET /api/study/pacing
 * Get pacing state for a session or daily summary
 */
export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await verifyIdToken(token);
    
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get('sessionId');
    const view = searchParams.get('view') || 'session';

    // Get user
    const [user] = await db.select().from(users)
      .where(eq(users.firebaseUid, decodedToken.uid))
      .limit(1);

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (view === 'daily') {
      // Get daily cumulative study stats
      const dailyStats = await getTodayCumulativeStudy(user.id);
      
      return NextResponse.json({
        view: 'daily',
        ...dailyStats,
        suggestions: dailyStats.totalMinutes >= 180
          ? ['Consider wrapping up for today. Quality sleep improves retention!']
          : dailyStats.totalMinutes >= 120
          ? ['Great progress! Take a 15-minute break before your next session.']
          : [],
      });
    }

    if (view === 'insights') {
      // Get weekly pacing insights
      const daysBack = parseInt(searchParams.get('days') || '7');
      const insights = await generatePacingInsights(user.id, daysBack);
      
      return NextResponse.json({
        view: 'insights',
        period: `${daysBack} days`,
        ...insights,
      });
    }

    // Session-level pacing
    if (!sessionId) {
      return NextResponse.json(
        { error: 'sessionId required for session view' },
        { status: 400 }
      );
    }

    const pacingState = await getSessionPacingState(sessionId);
    
    if (!pacingState) {
      return NextResponse.json(
        { error: 'Session not found or not started' },
        { status: 404 }
      );
    }

    const suggestion = analyzePacing(pacingState);

    // Record suggestion if break is recommended
    if (suggestion.shouldBreak) {
      await recordPacingSuggestion(sessionId, suggestion);
    }

    return NextResponse.json({
      view: 'session',
      state: {
        sessionId: pacingState.sessionId,
        minutesStudied: pacingState.minutesStudied,
        breaksTaken: pacingState.breaksTaken,
        recentAccuracy: pacingState.recentPerformance.length > 0
          ? Math.round(
              (pacingState.recentPerformance.reduce((a, b) => a + b, 0) / 
               pacingState.recentPerformance.length) * 100
            )
          : null,
      },
      suggestion,
    });
  } catch (error) {
    console.error('Error fetching pacing:', error);
    return NextResponse.json(
      { error: 'Failed to fetch pacing data' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/study/pacing
 * Record a break taken or update pacing state
 */
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await verifyIdToken(token);
    
    const body = await req.json();
    const { sessionId, action, data } = body;

    // Get user (for validation)
    const [user] = await db.select().from(users)
      .where(eq(users.firebaseUid, decodedToken.uid))
      .limit(1);

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (!sessionId) {
      return NextResponse.json(
        { error: 'sessionId is required' },
        { status: 400 }
      );
    }

    switch (action) {
      case 'record_break': {
        const duration = data?.duration || 5;
        const userInitiated = data?.userInitiated ?? true;
        
        await recordBreakTaken(sessionId, duration, userInitiated);
        
        return NextResponse.json({
          success: true,
          message: `Break recorded: ${duration} minutes`,
        });
      }

      case 'dismiss_suggestion': {
        // Record that user dismissed break suggestion (for analytics)
        await recordPacingSuggestion(sessionId, {
          shouldBreak: false,
          reason: null,
          suggestedDuration: 0,
          message: '',
          urgency: 'low',
        });
        
        return NextResponse.json({
          success: true,
          message: 'Suggestion dismissed',
        });
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Error updating pacing:', error);
    return NextResponse.json(
      { error: 'Failed to update pacing' },
      { status: 500 }
    );
  }
}
