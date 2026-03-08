import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { communityEvents, eventParticipants, users } from '@/lib/db/schema';
import { eq, desc, and, count, gte, lte, sql } from 'drizzle-orm';
import { verifyIdToken } from '@/lib/firebase/admin';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const REWARDS = [
  { position: 1, reward: '🏆 Champion — 500 XP', value: 500 },
  { position: 2, reward: '🥈 Runner-up — 300 XP', value: 300 },
  { position: 3, reward: '🥉 Bronze — 150 XP', value: 150 },
];

const CHALLENGE_TYPES = ['trivia', 'reading', 'quiz_marathon', 'drafting', 'research'] as const;

const UNIT_TOPICS: Record<string, { name: string; subjects: string[] }> = {
  'atp-100': { name: 'Civil Litigation', subjects: ['jurisdiction', 'pleadings', 'interlocutory applications', 'discovery', 'trial procedure', 'enforcement'] },
  'atp-101': { name: 'Criminal Litigation', subjects: ['charges', 'bail and bond', 'plea bargaining', 'sentencing', 'appeals', 'review'] },
  'atp-102': { name: 'Conveyancing', subjects: ['sale agreements', 'land registration', 'leases', 'mortgages', 'stamp duty', 'land control'] },
  'atp-103': { name: 'Family Law', subjects: ['marriage', 'divorce', 'custody', 'matrimonial property', 'succession', 'maintenance'] },
  'atp-104': { name: 'Probate', subjects: ['wills', 'intestate succession', 'grants of probate', 'estate administration', 'distribution', 'caveats'] },
  'atp-105': { name: 'Commercial', subjects: ['company formation', 'partnership law', 'sale of goods', 'insurance', 'employment law'] },
  'atp-106': { name: 'Legal Ethics', subjects: ['professional conduct', 'client confidentiality', 'conflict of interest', 'fees', 'LSK rules'] },
};

/**
 * Community Agent — dynamically generates challenges via AI
 */
async function ensureActiveChallenges(): Promise<void> {
  const now = new Date();

  // Auto-expire old active events
  await db.update(communityEvents)
    .set({ status: 'completed' })
    .where(and(
      eq(communityEvents.status, 'active'),
      lte(communityEvents.endsAt, now)
    ));

  // Check how many active challenges remain
  const [activeCount] = await db
    .select({ count: count() })
    .from(communityEvents)
    .where(eq(communityEvents.status, 'active'));

  if ((activeCount?.count || 0) >= 3) return; // Enough active challenges

  // Pick random units for variety
  const unitKeys = Object.keys(UNIT_TOPICS);
  const shuffled = unitKeys.sort(() => Math.random() - 0.5);
  const selectedUnits = shuffled.slice(0, 3);

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a creative community manager for a Kenyan bar exam prep platform called Ynai. Generate exciting, educational challenges. Use fun language, emojis, and make students WANT to participate. JSON only.',
        },
        {
          role: 'user',
          content: `Generate 3 fresh community challenges for these units:
${selectedUnits.map(u => `- ${u}: ${UNIT_TOPICS[u].name} (topics: ${UNIT_TOPICS[u].subjects.join(', ')})`).join('\n')}

Each challenge needs:
- title: catchy, fun (use emojis and wordplay)
- description: 2-3 motivating sentences
- type: one of ${CHALLENGE_TYPES.join(', ')}
- unitId: the unit code above
- durationDays: 2-7

Respond: {"challenges": [{"title":"...", "description":"...", "type":"...", "unitId":"...", "durationDays":3}]}`,
        },
      ],
      temperature: 0.95,
      max_completion_tokens: 800,
      response_format: { type: 'json_object' },
    });

    const parsed = JSON.parse(completion.choices[0]?.message?.content || '{}');
    if (parsed.challenges && Array.isArray(parsed.challenges)) {
      for (const ch of parsed.challenges.slice(0, 3)) {
        const type = CHALLENGE_TYPES.includes(ch.type) ? ch.type : 'trivia';
        const days = Math.min(Math.max(ch.durationDays || 3, 2), 7);
        await db.insert(communityEvents).values({
          title: ch.title,
          description: ch.description,
          type,
          status: 'active',
          unitId: ch.unitId || null,
          startsAt: now,
          endsAt: new Date(now.getTime() + days * 86400000),
          rewards: REWARDS,
          isAgentCreated: true,
          maxParticipants: 100,
        });
      }
      console.log(`[CommunityAgent] Generated ${parsed.challenges.length} AI challenges`);
      return;
    }
  } catch (err) {
    console.error('[CommunityAgent] AI generation failed, using fallback:', err);
  }

  // Fallback: deterministic challenges
  const dayOfYear = Math.floor((now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86400000);
  const fallbacks = [
    {
      title: `⚡ ${UNIT_TOPICS[selectedUnits[0]].name} Speed Round`,
      description: `How fast can you answer 15 questions on ${UNIT_TOPICS[selectedUnits[0]].subjects[dayOfYear % UNIT_TOPICS[selectedUnits[0]].subjects.length]}? Top scorers climb the board!`,
      type: 'quiz_marathon' as const,
      unitId: selectedUnits[0],
    },
    {
      title: `📚 Master ${UNIT_TOPICS[selectedUnits[1]].name} This Week`,
      description: `Complete 3 deep-dive study sessions on ${UNIT_TOPICS[selectedUnits[1]].name}. Build mastery and earn your spot on the leaderboard!`,
      type: 'reading' as const,
      unitId: selectedUnits[1],
    },
    {
      title: `✍️ Drafting Duel: ${UNIT_TOPICS[selectedUnits[2]].name}`,
      description: `Put your drafting skills to the test! Draft a document related to ${UNIT_TOPICS[selectedUnits[2]].subjects[0]}. Best submissions get peer recognition!`,
      type: 'drafting' as const,
      unitId: selectedUnits[2],
    },
  ];

  for (const ch of fallbacks) {
    await db.insert(communityEvents).values({
      title: ch.title,
      description: ch.description,
      type: ch.type,
      status: 'active',
      unitId: ch.unitId,
      startsAt: now,
      endsAt: new Date(now.getTime() + 5 * 86400000),
      rewards: REWARDS,
      isAgentCreated: true,
      maxParticipants: 100,
    });
  }
  console.log('[CommunityAgent] Used fallback challenges');
}

// GET - Fetch community events/challenges (with AI agent auto-generation)
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
    const status = searchParams.get('status');
    const type = searchParams.get('type');

    // Community Agent: ensure we always have active challenges
    await ensureActiveChallenges();

    // Fetch events
    let events = await db
      .select()
      .from(communityEvents)
      .orderBy(desc(communityEvents.createdAt));

    // Filter by status if specified
    if (status) {
      events = events.filter(e => e.status === status);
    }

    // Filter by type if specified
    if (type) {
      events = events.filter(e => e.type === type);
    }

    const now = new Date();

    // Get participant counts and enrich with time info
    const eventsWithStats = await Promise.all(
      events.map(async (event) => {
        const [participantCountResult] = await db
          .select({ count: count() })
          .from(eventParticipants)
          .where(eq(eventParticipants.eventId, event.id));

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

        const endsAt = event.endsAt ? new Date(event.endsAt) : null;
        const msLeft = endsAt ? endsAt.getTime() - now.getTime() : 0;

        return {
          id: event.id,
          title: event.title,
          description: event.description,
          type: event.type,
          status: event.status,
          participantCount: participantCountResult?.count || 0,
          startsAt: event.startsAt,
          endsAt: event.endsAt,
          rewards: event.rewards as typeof REWARDS,
          isJoined,
          isAgentCreated: event.isAgentCreated ?? false,
          hoursLeft: msLeft > 0 ? Math.floor(msLeft / 3600000) : 0,
          daysLeft: msLeft > 0 ? Math.ceil(msLeft / 86400000) : 0,
          unitId: event.unitId,
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
    const { action, eventId, score } = body;

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
        questionsAnswered: 0,
        correctAnswers: 0,
        timeSpent: 0,
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
          questionsAnswered: sql`${eventParticipants.questionsAnswered} + 1`,
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
