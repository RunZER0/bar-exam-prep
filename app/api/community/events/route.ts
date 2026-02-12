import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { communityEvents, eventParticipants, users } from '@/lib/db/schema';
import { eq, desc, and, count, gte, lte, sql } from 'drizzle-orm';
import { verifyIdToken } from '@/lib/firebase/admin';

// Weekly prize structure
const WEEKLY_PRIZES = [
  { position: 1, reward: 'KES 500 off subscription', value: 500 },
  { position: 2, reward: 'KES 400 off subscription', value: 400 },
  { position: 3, reward: 'KES 300 off subscription', value: 300 },
];

// GET - Fetch community events/challenges
export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization');
    let userId: string | null = null;

    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      try {
        const decodedToken = await verifyIdToken(token);
        userId = decodedToken.uid;
      } catch {
        // User not authenticated
      }
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status'); // 'upcoming' | 'active' | 'completed'
    const type = searchParams.get('type'); // 'trivia' | 'reading' | 'quiz_marathon' | 'drafting' | 'research'

    // Fetch events from database
    let events = await db
      .select()
      .from(communityEvents)
      .where(eq(communityEvents.isActive, true))
      .orderBy(desc(communityEvents.createdAt));

    // If no events exist, create sample events
    if (events.length === 0) {
      const now = new Date();
      const sampleEvents = [
        {
          title: 'Weekly Constitutional Law Challenge',
          description: 'Test your knowledge of the Constitution of Kenya 2010. Top 3 win subscription discounts!',
          type: 'trivia' as const,
          status: 'active' as const,
          startsAt: now,
          endsAt: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000),
          rewards: WEEKLY_PRIZES,
          createdBy: 'system',
          isActive: true,
        },
        {
          title: 'Land Law Reading Marathon',
          description: 'Complete 5 study sessions on Land Law this week and earn bonus points!',
          type: 'reading' as const,
          status: 'active' as const,
          startsAt: now,
          endsAt: new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000),
          rewards: WEEKLY_PRIZES,
          createdBy: 'system',
          isActive: true,
        },
        {
          title: 'Criminal Procedure Quiz Blitz',
          description: 'Answer 50 questions in under 30 minutes. Only for the brave!',
          type: 'quiz_marathon' as const,
          status: 'upcoming' as const,
          startsAt: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000),
          endsAt: new Date(now.getTime() + 4 * 24 * 60 * 60 * 1000),
          rewards: WEEKLY_PRIZES,
          createdBy: 'system',
          isActive: true,
        },
        {
          title: 'Legal Drafting Championship',
          description: 'Draft a perfect affidavit and have it reviewed by peers. Best drafts win!',
          type: 'drafting' as const,
          status: 'upcoming' as const,
          startsAt: new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000),
          endsAt: new Date(now.getTime() + 12 * 24 * 60 * 60 * 1000),
          rewards: WEEKLY_PRIZES,
          createdBy: 'system',
          isActive: true,
        },
        {
          title: 'Evidence Law Deep Dive',
          description: 'Master the Evidence Act with this intensive research challenge.',
          type: 'research' as const,
          status: 'active' as const,
          startsAt: now,
          endsAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
          rewards: WEEKLY_PRIZES,
          createdBy: 'system',
          isActive: true,
        },
      ];

      await db.insert(communityEvents).values(sampleEvents);
      events = await db.select().from(communityEvents).orderBy(desc(communityEvents.createdAt));
    }

    // Filter by status if specified
    if (status) {
      events = events.filter(e => e.status === status);
    }

    // Filter by type if specified
    if (type) {
      events = events.filter(e => e.type === type);
    }

    // Get participant counts and check if user is participating
    const eventsWithStats = await Promise.all(
      events.map(async (event) => {
        const [participantCountResult] = await db
          .select({ count: count() })
          .from(eventParticipants)
          .where(eq(eventParticipants.eventId, event.id));

        // Check if user is a participant
        let isJoined = false;
        if (userId) {
          const participation = await db
            .select()
            .from(eventParticipants)
            .where(and(
              eq(eventParticipants.eventId, event.id),
              eq(eventParticipants.userId, userId)
            ))
            .limit(1);
          isJoined = participation.length > 0;
        }

        return {
          id: event.id,
          title: event.title,
          description: event.description,
          type: event.type,
          status: event.status,
          participantCount: participantCountResult?.count || 0,
          startsAt: event.startsAt,
          endsAt: event.endsAt,
          rewards: event.rewards as typeof WEEKLY_PRIZES,
          isJoined,
        };
      })
    );

    return NextResponse.json({ events: eventsWithStats });
  } catch (error) {
    console.error('Error fetching events:', error);
    return NextResponse.json(
      { error: 'Failed to fetch events' },
      { status: 500 }
    );
  }
}

// POST - Join an event or submit participation
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const decodedToken = await verifyIdToken(token);
    const userId = decodedToken.uid;

    const body = await req.json();
    const { action, eventId, score, submissionData } = body;

    if (!eventId) {
      return NextResponse.json({ error: 'Event ID required' }, { status: 400 });
    }

    // Get the event
    const [event] = await db
      .select()
      .from(communityEvents)
      .where(eq(communityEvents.id, eventId))
      .limit(1);

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    if (action === 'join') {
      // Check if event is active or upcoming
      if (event.status === 'completed') {
        return NextResponse.json(
          { error: 'Cannot join completed event' },
          { status: 400 }
        );
      }

      // Check if already joined
      const existingParticipation = await db
        .select()
        .from(eventParticipants)
        .where(and(
          eq(eventParticipants.eventId, eventId),
          eq(eventParticipants.userId, userId)
        ))
        .limit(1);

      if (existingParticipation.length > 0) {
        return NextResponse.json({ message: 'Already participating' });
      }

      // Join the event
      await db.insert(eventParticipants).values({
        eventId,
        userId,
        score: 0,
        completedTasks: 0,
        status: 'participating',
      });

      return NextResponse.json({ message: 'Joined event successfully' });
    }

    if (action === 'submit') {
      // Submit score/progress
      const [participation] = await db
        .select()
        .from(eventParticipants)
        .where(and(
          eq(eventParticipants.eventId, eventId),
          eq(eventParticipants.userId, userId)
        ))
        .limit(1);

      if (!participation) {
        return NextResponse.json(
          { error: 'Must join event first' },
          { status: 400 }
        );
      }

      // Update score
      await db
        .update(eventParticipants)
        .set({
          score: sql`${eventParticipants.score} + ${score || 0}`,
          completedTasks: sql`${eventParticipants.completedTasks} + 1`,
          submissionData: submissionData || participation.submissionData,
          updatedAt: new Date(),
        })
        .where(and(
          eq(eventParticipants.eventId, eventId),
          eq(eventParticipants.userId, userId)
        ));

      return NextResponse.json({ message: 'Score submitted successfully' });
    }

    if (action === 'leave') {
      await db.delete(eventParticipants).where(and(
        eq(eventParticipants.eventId, eventId),
        eq(eventParticipants.userId, userId)
      ));

      return NextResponse.json({ message: 'Left event successfully' });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Error in events POST:', error);
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    );
  }
}
