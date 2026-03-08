import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { communityEvents, eventParticipants, users } from '@/lib/db/schema';
import { eq, desc, and, count, gte, lte, sql, ne } from 'drizzle-orm';
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

/* ================================================================
   AI CHALLENGE AGENT — generates 3 daily challenges
   Types: drafting, multiple choice (trivia), short text answer
   ================================================================ */

// In-memory flag so only one generation runs per server instance per day
let _generatingDate: string | null = null;

async function ensureActiveChallenges(): Promise<void> {
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  // Auto-expire old active events (lightweight DB call)
  await db.update(communityEvents)
    .set({ status: 'completed' })
    .where(and(
      eq(communityEvents.status, 'active'),
      lte(communityEvents.endsAt, now)
    ));

  // Check how many active AI challenges were created today
  const todayStart = new Date(now);
  todayStart.setUTCHours(0, 0, 0, 0);

  const [todaysAiCount] = await db
    .select({ count: count() })
    .from(communityEvents)
    .where(and(
      eq(communityEvents.isAgentCreated, true),
      eq(communityEvents.status, 'active'),
      gte(communityEvents.createdAt, todayStart)
    ));

  if ((todaysAiCount?.count || 0) >= 3) return; // Already generated today's 3 AI challenges

  // Prevent duplicate generation: only one in-flight per day
  if (_generatingDate === todayStr) return;
  _generatingDate = todayStr;

  // Pick 3 random units for variety
  const unitKeys = Object.keys(UNIT_TOPICS);
  const shuffled = unitKeys.sort(() => Math.random() - 0.5);
  const selectedUnits = shuffled.slice(0, 3);

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a creative challenge manager for Ynai, a Kenyan bar exam prep platform.
Generate exactly 3 daily challenges. Each must have:
- A catchy, fun title with emojis
- An engaging description (2-3 sentences)
- 3-5 questions/tasks testing real Kenyan legal knowledge (post-2010 Constitution)

The 3 challenges MUST be:
1. A DRAFTING challenge — students draft a legal document
2. A MULTIPLE CHOICE (trivia) challenge — 3-5 MCQ questions with 4 options each
3. A SHORT ANSWER (research) challenge — 3-5 questions requiring brief explanations

Respond in JSON only.`,
        },
        {
          role: 'user',
          content: `Generate 3 daily challenges:
1. DRAFTING for ${UNIT_TOPICS[selectedUnits[0]].name} (topics: ${UNIT_TOPICS[selectedUnits[0]].subjects.join(', ')})
2. MULTIPLE CHOICE for ${UNIT_TOPICS[selectedUnits[1]].name} (topics: ${UNIT_TOPICS[selectedUnits[1]].subjects.join(', ')})
3. SHORT ANSWER for ${UNIT_TOPICS[selectedUnits[2]].name} (topics: ${UNIT_TOPICS[selectedUnits[2]].subjects.join(', ')})

Respond: {
  "challenges": [
    {"title":"✍️ ...","description":"...","type":"drafting","unitId":"${selectedUnits[0]}","questions":[{"question":"Draft a...","type":"drafting"}]},
    {"title":"🧠 ...","description":"...","type":"trivia","unitId":"${selectedUnits[1]}","questions":[{"question":"...","type":"mcq","options":["A","B","C","D"],"answer":"A"}]},
    {"title":"📝 ...","description":"...","type":"research","unitId":"${selectedUnits[2]}","questions":[{"question":"Briefly explain...","type":"short_answer","answer":"..."}]}
  ]
}`,
        },
      ],
      temperature: 0.9,
      max_completion_tokens: 2000,
      response_format: { type: 'json_object' },
    });

    const parsed = JSON.parse(completion.choices[0]?.message?.content || '{}');
    if (parsed.challenges && Array.isArray(parsed.challenges)) {
      for (let i = 0; i < Math.min(parsed.challenges.length, 3); i++) {
        const ch = parsed.challenges[i];
        const type = CHALLENGE_TYPES.includes(ch.type) ? ch.type : (['drafting', 'trivia', 'research'] as const)[i % 3];
        await db.insert(communityEvents).values({
          title: ch.title,
          description: ch.description,
          type,
          status: 'active',
          unitId: ch.unitId || selectedUnits[i],
          startsAt: now,
          endsAt: new Date(now.getTime() + 24 * 60 * 60 * 1000), // 24 hours
          rewards: REWARDS,
          isAgentCreated: true,
          reviewStatus: 'approved',
          challengeContent: ch.questions || null,
          maxParticipants: 200,
        });
      }
      console.log(`[CommunityAgent] Generated ${parsed.challenges.length} daily AI challenges`);
      return;
    }
  } catch (err) {
    console.error('[CommunityAgent] AI generation failed, using fallback:', err);
  }

  // Fallback: deterministic challenges
  const dayOfYear = Math.floor((now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86400000);
  const fallbacks = [
    {
      title: `✍️ Draft Challenge: ${UNIT_TOPICS[selectedUnits[0]].name}`,
      description: `Put your drafting skills to the test! Draft a document related to ${UNIT_TOPICS[selectedUnits[0]].subjects[dayOfYear % UNIT_TOPICS[selectedUnits[0]].subjects.length]}. Show us what you've got!`,
      type: 'drafting' as const,
      unitId: selectedUnits[0],
    },
    {
      title: `🧠 Quick Quiz: ${UNIT_TOPICS[selectedUnits[1]].name}`,
      description: `Test your knowledge with rapid-fire multiple choice questions on ${UNIT_TOPICS[selectedUnits[1]].subjects[dayOfYear % UNIT_TOPICS[selectedUnits[1]].subjects.length]}!`,
      type: 'trivia' as const,
      unitId: selectedUnits[1],
    },
    {
      title: `📝 Explain It: ${UNIT_TOPICS[selectedUnits[2]].name}`,
      description: `Answer short legal questions about ${UNIT_TOPICS[selectedUnits[2]].subjects[dayOfYear % UNIT_TOPICS[selectedUnits[2]].subjects.length]}. Clear, concise reasoning wins!`,
      type: 'research' as const,
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
      endsAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
      rewards: REWARDS,
      isAgentCreated: true,
      reviewStatus: 'approved',
      maxParticipants: 200,
    });
  }
  console.log('[CommunityAgent] Used fallback challenges');
}

/* ================================================================
   AI REVIEW — reviews user-submitted challenges for quality
   ================================================================ */
/* ================================================================
   LOCAL VALIDATION — instant, runs before response
   Rejects only clearly bad submissions. Lenient by design.
   ================================================================ */
function localValidate(title: string, description: string, questions: any[]): { pass: boolean; reason: string } {
  if (title.trim().length < 5) return { pass: false, reason: 'Title is too short — please give your challenge a descriptive name (at least 5 characters).' };
  if (description.trim().length < 15) return { pass: false, reason: 'Description needs more detail — explain what the challenge is about so others know what to expect (at least 15 characters).' };

  // Check questions have actual content
  const validQs = questions.filter(q => q.question?.trim().length >= 8);
  if (questions.length > 0 && validQs.length === 0) {
    return { pass: false, reason: 'Your questions need more substance — each question should be at least 8 characters and test a specific legal concept.' };
  }

  // MCQ questions must have at least 2 non-empty options and an answer
  for (const q of validQs) {
    if (q.type === 'mcq') {
      const filledOptions = (q.options || []).filter((o: string) => o?.trim().length > 0);
      if (filledOptions.length < 2) return { pass: false, reason: `Question "${q.question.slice(0, 40)}..." needs at least 2 answer options.` };
      if (!q.answer?.trim()) return { pass: false, reason: `Question "${q.question.slice(0, 40)}..." is missing the correct answer.` };
    }
    if (q.type === 'short_answer' && !q.answer?.trim()) {
      return { pass: false, reason: `Question "${q.question.slice(0, 40)}..." needs a model answer so participants can learn from it.` };
    }
  }

  return { pass: true, reason: 'Looks good!' };
}

/* ================================================================
   AI REVIEW — runs asynchronously AFTER the challenge is published.
   If the AI flags serious issues, the challenge is taken down.
   This keeps submission instant for users.
   ================================================================ */
async function reviewChallengeAsync(eventId: string, title: string, description: string, questions: any[]): Promise<void> {
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a quality reviewer for Ynai, a Kenyan bar exam prep community.

Review the submitted challenge. Your job is to APPROVE most submissions — community participation matters.

**APPROVE** if the challenge:
- Is related to Kenyan law or legal practice in any way
- Makes a genuine attempt at a question, even if imperfect
- Is not offensive, spam, or completely nonsensical

**REJECT ONLY** if the challenge:
- Contains offensive, discriminatory, or abusive content
- Is clearly spam or completely unrelated to law
- States blatantly wrong legal principles that could mislead students (e.g., citing repealed provisions as current law)

Do NOT reject for:
- Minor grammar/spelling issues (fix them instead)
- Questions that are easy or basic
- Imperfect question phrasing — improve it
- Missing some options — that's fine

Always provide constructive, encouraging feedback.
Respond in JSON only.`,
        },
        {
          role: 'user',
          content: `Review:\nTitle: ${title}\nDescription: ${description}\nQuestions: ${JSON.stringify(questions)}\n\nRespond: {"approved": true/false, "feedback": "...", "improvedTitle": "...", "improvedDescription": "..."}`,
        },
      ],
      temperature: 0.3,
      max_completion_tokens: 500,
      response_format: { type: 'json_object' },
    });

    const result = JSON.parse(completion.choices[0]?.message?.content || '{}');

    if (!result.approved) {
      // Take it down — but save the feedback
      await db.update(communityEvents).set({
        status: 'upcoming',
        reviewStatus: 'rejected',
        reviewFeedback: result.feedback || 'Did not pass quality review.',
      }).where(eq(communityEvents.id, eventId));
      console.log(`[ReviewAgent] Rejected challenge ${eventId}: ${result.feedback}`);
    } else {
      // Optionally apply grammar/title improvements
      const updates: Record<string, any> = {
        reviewStatus: 'approved',
        reviewFeedback: result.feedback || 'Approved!',
      };
      if (result.improvedTitle) updates.title = result.improvedTitle;
      if (result.improvedDescription) updates.description = result.improvedDescription;
      await db.update(communityEvents).set(updates).where(eq(communityEvents.id, eventId));
    }
  } catch (err) {
    console.error('[ReviewAgent] Async review failed (challenge stays live):', err);
    // Challenge stays live — fail-open policy
  }
}

/* ================================================================
   GET — Fetch challenges split into AI and community sections
   ================================================================ */
export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization');
    let userId: string | null = null;

    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      try {
        const decodedToken = await verifyIdToken(token);
        userId = decodedToken.uid;
      } catch {}
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const type = searchParams.get('type');

    // Community Agent: kick off challenge generation in the background
    // so it never blocks the response to the user
    ensureActiveChallenges().catch(err => {
      console.error('[CommunityAgent] Background generation failed:', err);
      _generatingDate = null; // Allow retry
    });

    // Fetch all non-rejected events
    let allEvents = await db
      .select()
      .from(communityEvents)
      .orderBy(desc(communityEvents.createdAt));

    // Filter out rejected
    allEvents = allEvents.filter(e => (e.reviewStatus || 'approved') !== 'rejected');

    if (status) allEvents = allEvents.filter(e => e.status === status);
    if (type) allEvents = allEvents.filter(e => e.type === type);

    const now = new Date();

    const enrichEvent = async (event: typeof allEvents[0]) => {
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
        submitterName: event.submitterName || null,
        challengeContent: event.challengeContent || null,
        hoursLeft: msLeft > 0 ? Math.floor(msLeft / 3600000) : 0,
        daysLeft: msLeft > 0 ? Math.ceil(msLeft / 86400000) : 0,
        unitId: event.unitId,
      };
    };

    const enriched = await Promise.all(allEvents.map(enrichEvent));
    const aiChallenges = enriched.filter(e => e.isAgentCreated);
    const communityChallenges = enriched.filter(e => !e.isAgentCreated);

    return NextResponse.json({ events: enriched, aiChallenges, communityChallenges });
  } catch (error) {
    console.error('Error fetching events:', error);
    return NextResponse.json({ error: 'Failed to fetch events' }, { status: 500 });
  }
}

/* ================================================================
   POST — Join/submit/leave events, or submit a new community challenge
   ================================================================ */
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

    /* ---- SUBMIT A NEW COMMUNITY CHALLENGE ---- */
    if (action === 'submit_challenge') {
      const { title, description, type, unitId, questions } = body;

      if (!title?.trim() || !description?.trim()) {
        return NextResponse.json({ error: 'Title and description are required' }, { status: 400 });
      }

      const safeQuestions = (questions && Array.isArray(questions) && questions.length > 0)
        ? questions
        : [{ question: description.trim(), type: 'short_answer', answer: '' }];

      // Instant local validation — no AI call, no waiting
      const validation = localValidate(title, description, safeQuestions);
      if (!validation.pass) {
        return NextResponse.json({
          success: false, approved: false,
          feedback: validation.reason,
          message: validation.reason,
        });
      }

      // Get submitter's display name
      const [userRecord] = await db
        .select({ displayName: users.displayName })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);
      const submitterName = userRecord?.displayName || 'Anonymous';

      const now = new Date();
      const challengeType = CHALLENGE_TYPES.includes(type) ? type : 'trivia';

      // Publish immediately — AI review happens in the background
      const [inserted] = await db.insert(communityEvents).values({
        title: title.trim(),
        description: description.trim(),
        type: challengeType,
        status: 'active',
        unitId: unitId || null,
        startsAt: now,
        endsAt: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000),
        rewards: [],
        isAgentCreated: false,
        createdById: userId,
        submitterName,
        reviewStatus: 'pending',
        reviewFeedback: null,
        challengeContent: safeQuestions,
        maxParticipants: 100,
      }).returning({ id: communityEvents.id });

      // Fire-and-forget AI review — will take down the challenge if it's truly bad
      reviewChallengeAsync(inserted.id, title, description, safeQuestions).catch(err => {
        console.error('[ReviewAgent] Background review error:', err);
      });

      return NextResponse.json({
        success: true, approved: true, challengeId: inserted.id,
        feedback: 'Your challenge is live! Our AI reviewer will check it shortly.',
        message: 'Your challenge is live! 🎉',
      });
    }

    /* ---- EXISTING: join, submit score, leave ---- */
    if (!eventId) {
      return NextResponse.json({ error: 'Event ID required' }, { status: 400 });
    }

    const [event] = await db
      .select().from(communityEvents)
      .where(eq(communityEvents.id, eventId)).limit(1);

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    if (action === 'join') {
      if (event.status === 'completed') {
        return NextResponse.json({ error: 'Cannot join completed event' }, { status: 400 });
      }
      const existing = await db.select().from(eventParticipants)
        .where(and(eq(eventParticipants.eventId, eventId), eq(eventParticipants.userId, userId))).limit(1);
      if (existing.length > 0) return NextResponse.json({ message: 'Already participating' });

      await db.insert(eventParticipants).values({
        eventId, userId, score: 0, questionsAnswered: 0, correctAnswers: 0, timeSpent: 0,
      });
      return NextResponse.json({ message: 'Joined event successfully' });
    }

    if (action === 'submit') {
      const [participation] = await db.select().from(eventParticipants)
        .where(and(eq(eventParticipants.eventId, eventId), eq(eventParticipants.userId, userId))).limit(1);
      if (!participation) return NextResponse.json({ error: 'Must join event first' }, { status: 400 });

      await db.update(eventParticipants).set({
        score: sql`${eventParticipants.score} + ${score || 0}`,
        questionsAnswered: sql`${eventParticipants.questionsAnswered} + 1`,
      }).where(and(eq(eventParticipants.eventId, eventId), eq(eventParticipants.userId, userId)));
      return NextResponse.json({ message: 'Score submitted successfully' });
    }

    if (action === 'leave') {
      await db.delete(eventParticipants).where(and(
        eq(eventParticipants.eventId, eventId), eq(eventParticipants.userId, userId)
      ));
      return NextResponse.json({ message: 'Left event successfully' });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Error in events POST:', error);
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 });
  }
}
