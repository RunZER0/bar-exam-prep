import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { communityEvents, eventParticipants, users, weeklyRankings } from '@/lib/db/schema';
import { eq, desc, and, count, gte, lte, sql } from 'drizzle-orm';
import { verifyIdToken } from '@/lib/firebase/admin';
import OpenAI from 'openai';
import { MINI_MODEL } from '@/lib/ai/model-config';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const REWARDS = [
  { position: 1, reward: '🏆 Champion — 500 pts', value: 500 },
  { position: 2, reward: '🥈 Runner-up — 300 pts', value: 300 },
  { position: 3, reward: '🥉 Bronze — 150 pts', value: 150 },
];

const CHALLENGE_TYPES = ['trivia', 'reading', 'quiz_marathon', 'drafting', 'research'] as const;

/* ================================================================
   NAIROBI TIME HELPERS — Kenya is UTC+3 (no DST)
   ================================================================ */
const EAT_OFFSET_MS = 3 * 60 * 60 * 1000; // UTC+3

/** Returns midnight Nairobi time (EAT) for today, as a UTC Date */
function getNairobiMidnight(): Date {
  const now = new Date();
  const nairobiNow = new Date(now.getTime() + EAT_OFFSET_MS);
  const y = nairobiNow.getUTCFullYear();
  const m = nairobiNow.getUTCMonth();
  const d = nairobiNow.getUTCDate();
  // Midnight EAT = 21:00 UTC previous day
  return new Date(Date.UTC(y, m, d) - EAT_OFFSET_MS);
}

/** Returns the Nairobi-time date string (YYYY-MM-DD) for "today" */
function getNairobiDateStr(): string {
  const now = new Date();
  const nairobiNow = new Date(now.getTime() + EAT_OFFSET_MS);
  return nairobiNow.toISOString().split('T')[0];
}

/** Returns Monday 00:00 EAT (as UTC Date) for the week containing the given date */
function getWeekStartEAT(date: Date): Date {
  const eat = new Date(date.getTime() + EAT_OFFSET_MS);
  const day = eat.getUTCDay(); // 0=Sun, 1=Mon...
  const diff = day === 0 ? -6 : 1 - day;
  eat.setUTCDate(eat.getUTCDate() + diff);
  eat.setUTCHours(0, 0, 0, 0);
  return new Date(eat.getTime() - EAT_OFFSET_MS);
}

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
   AI CHALLENGE AGENT — generates daily COMMUNITY challenges for ALL 7 units.
   Same challenges for everyone. Tough, bar-exam level.
   New set generated at midnight Nairobi time (EAT, UTC+3).
   ================================================================ */

// In-memory flag so only one generation runs per server instance per day
let _generatingDate: string | null = null;

// Rotate challenge types across units each day so variety stays high
const ROTATING_TYPES = ['drafting', 'trivia', 'research'] as const;

async function ensureActiveChallenges(): Promise<void> {
  const now = new Date();
  const todayStr = getNairobiDateStr(); // Nairobi-time date

  // Auto-expire old active events (lightweight DB call)
  await db.update(communityEvents)
    .set({ status: 'completed' })
    .where(and(
      eq(communityEvents.status, 'active'),
      lte(communityEvents.endsAt, now)
    ));

  // Check how many active AI challenges were created today (Nairobi midnight)
  const todayStart = getNairobiMidnight();

  const [todaysAiCount] = await db
    .select({ count: count() })
    .from(communityEvents)
    .where(and(
      eq(communityEvents.isAgentCreated, true),
      eq(communityEvents.status, 'active'),
      gte(communityEvents.createdAt, todayStart)
    ));

  // We generate 7 challenges (one per unit) — if we have at least 7, skip
  if ((todaysAiCount?.count || 0) >= 7) return;

  // Prevent duplicate generation: only one in-flight per day
  if (_generatingDate === todayStr) return;
  _generatingDate = todayStr;

  const unitKeys = Object.keys(UNIT_TOPICS);
  const dayOfYear = Math.floor((now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86400000);

  // Find which units already have challenges today to avoid duplicates
  const existingToday = await db
    .select({ unitId: communityEvents.unitId })
    .from(communityEvents)
    .where(and(
      eq(communityEvents.isAgentCreated, true),
      eq(communityEvents.status, 'active'),
      gte(communityEvents.createdAt, todayStart)
    ));
  const existingUnitIds = new Set(existingToday.map(e => e.unitId));
  const unitsToGenerate = unitKeys.filter(u => !existingUnitIds.has(u));

  if (unitsToGenerate.length === 0) return;

  // Build the prompt for ALL missing units at once
  const challengeSpecs = unitsToGenerate.map((unitId, i) => {
    const unit = UNIT_TOPICS[unitId];
    // Rotate type based on day + unit index so each unit gets different types on different days
    const typeIdx = (dayOfYear + i) % 3;
    const type = ROTATING_TYPES[typeIdx];
    const subject = unit.subjects[(dayOfYear + i) % unit.subjects.length];
    return { unitId, unitName: unit.name, type, subject, subjects: unit.subjects };
  });

  // Calculate end time: next midnight Nairobi time
  const nextMidnightEAT = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

  try {
    const completion = await openai.chat.completions.create({
      model: MINI_MODEL,
      messages: [
        {
          role: 'system',
          content: `You are the Challenge Master for Ynai — a Kenyan Advocates Training Programme (ATP) bar exam prep platform.

CRITICAL RULES — VIOLATING THESE MAKES THE OUTPUT INVALID:
1. ALL legal references MUST be from Kenya's POST-2010 era. The Constitution of Kenya 2010 is the ONLY constitution.
2. NEVER cite any case decided before 2010. No colonial-era law. No "Republic v El Mann [1969]" or similar.
3. Reference ONLY modern Kenyan statutes enacted after 2010:
   - Constitution of Kenya 2010 (specific Articles)
   - Civil Procedure Act (as amended), Land Registration Act 2012
   - Marriage Act 2014, Matrimonial Property Act 2013
   - Companies Act 2015, Insolvency Act 2015
   - Employment Act 2007 (as amended), Labour Relations Act 2007
   - Law of Succession Act (Cap 160, as interpreted post-2010)
   - Advocates Act (Cap 16), LSK Act 2014
   - Sexual Offences Act 2006 (as applied post-2010), Computer Misuse and Cybercrimes Act 2018
   - Data Protection Act 2019, Access to Information Act 2016
   - Environment and Land Court Act 2011, National Land Commission Act 2012
4. For case law, cite ONLY real post-2010 decisions from Kenya's Supreme Court, Court of Appeal, High Court, or ELC. Examples:
   - Mumo Matemu v Trusted Society of Human Rights Alliance [2013] eKLR
   - Communications Authority of Kenya & 8 others v Royal Media Services Ltd [2014] eKLR
   - In re the Matter of the Interim Independent Electoral Commission [2011] eKLR
   - Katiba Institute v Attorney General [2017] eKLR
   If you are not certain a case is real and post-2010, DO NOT cite it. Instead, describe the legal principle without a specific case name.
5. These challenges are for QUALIFIED LAW GRADUATES preparing for the bar exam. Make them GENUINELY DIFFICULT.
   - MCQ distractors must be plausible and test nuanced understanding
   - Short answers must require precise legal analysis, not one-word responses
   - Drafting tasks must require proper legal document structure

Generate exactly ${challengeSpecs.length} challenges — one per unit. Each challenge has:
- A catchy title with emojis
- A demanding description (2-3 sentences)
- 3-5 questions worth a total of 50 points

Question types & scoring:
- "mcq": 4 options (A/B/C/D), one correct. 10 points each. Field "answer" = correct letter.
- "short_answer": Brief but precise legal analysis. 10 points each. Field "modelAnswer" = comprehensive model answer.
- "drafting": Draft a legal document excerpt. 15-20 points. Field "modelAnswer" = model draft with key elements.

Each question object: {"question":"...","type":"mcq|short_answer|drafting","options":["A","B","C","D"],"answer":"B","modelAnswer":"...","points":10}
- MCQ must have "options" and "answer" fields.
- short_answer and drafting must have "modelAnswer" field.
- All must have "points" field.

Respond in JSON only: {"challenges": [...]}`,
        },
        {
          role: 'user',
          content: `Generate these ${challengeSpecs.length} bar-exam-level challenges:\n${challengeSpecs.map((s, i) => 
            `${i + 1}. ${s.type.toUpperCase()} for ${s.unitName} — focus on: ${s.subject} (other topics: ${s.subjects.join(', ')})`
          ).join('\n')}\n\nEach challenge JSON: {"title":"...","description":"...","type":"...","unitId":"...","questions":[...],"totalPoints":50}`,
        },
      ],
      temperature: 0.8,
      max_completion_tokens: 6000,
      response_format: { type: 'json_object' },
    });

    const parsed = JSON.parse(completion.choices[0]?.message?.content || '{}');
    if (parsed.challenges && Array.isArray(parsed.challenges)) {
      for (let i = 0; i < parsed.challenges.length && i < challengeSpecs.length; i++) {
        const ch = parsed.challenges[i];
        const spec = challengeSpecs[i];
        const type = CHALLENGE_TYPES.includes(ch.type) ? ch.type : spec.type;
        await db.insert(communityEvents).values({
          title: ch.title,
          description: ch.description,
          type,
          status: 'active',
          unitId: ch.unitId || spec.unitId,
          startsAt: now,
          endsAt: nextMidnightEAT,
          rewards: REWARDS,
          isAgentCreated: true,
          reviewStatus: 'approved',
          challengeContent: ch.questions || null,
          maxParticipants: 500,
        });
      }
      console.log(`[CommunityAgent] Generated ${parsed.challenges.length} AI challenges for ${challengeSpecs.length} units`);
      return;
    }
  } catch (err) {
    console.error('[CommunityAgent] AI generation failed, using fallback:', err);
  }

  // Fallback: deterministic challenges for all missing units
  for (let i = 0; i < challengeSpecs.length; i++) {
    const spec = challengeSpecs[i];
    const unit = UNIT_TOPICS[spec.unitId];
    const typeEmoji = spec.type === 'drafting' ? '✍️' : spec.type === 'trivia' ? '🧠' : '📝';
    const typeLabel = spec.type === 'drafting' ? 'Draft Challenge' : spec.type === 'trivia' ? 'Quick Quiz' : 'Explain It';

    await db.insert(communityEvents).values({
      title: `${typeEmoji} ${typeLabel}: ${unit.name}`,
      description: `Today's ${spec.type} challenge for ${unit.name} — focusing on ${spec.subject}. Show what you know!`,
      type: spec.type,
      status: 'active',
      unitId: spec.unitId,
      startsAt: now,
      endsAt: nextMidnightEAT,
      rewards: REWARDS,
      isAgentCreated: true,
      reviewStatus: 'approved',
      maxParticipants: 500,
    });
  }
  console.log(`[CommunityAgent] Used fallback challenges for ${challengeSpecs.length} units`);
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
      model: MINI_MODEL,
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
    let aiChallenges = enriched.filter(e => e.isAgentCreated);
    const communityChallenges = enriched.filter(e => !e.isAgentCreated);

    // Community challenges — same for everyone, no per-user personalization.
    // Sort by unit order (atp-100 through atp-106) for consistency.
    aiChallenges.sort((a, b) => (a.unitId || '').localeCompare(b.unitId || ''));

    return NextResponse.json({ events: enriched, aiChallenges, communityChallenges });
  } catch (error) {
    console.error('Error fetching events:', error);
    return NextResponse.json({ error: 'Failed to fetch events' }, { status: 500 });
  }
}

/* ================================================================
   POST — Join/submit/leave events, submit a new community challenge,
   or GRADE challenge answers (scores feed into weekly rankings)
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

    /* ---- GRADE CHALLENGE ANSWERS ---- */
    if (action === 'grade') {
      const { answers } = body; // answers: { [questionIndex]: string }
      if (!eventId || !answers) {
        return NextResponse.json({ error: 'Event ID and answers required' }, { status: 400 });
      }

      const [event] = await db.select().from(communityEvents)
        .where(eq(communityEvents.id, eventId)).limit(1);
      if (!event) return NextResponse.json({ error: 'Challenge not found' }, { status: 404 });

      // Must be a participant
      const [participation] = await db.select().from(eventParticipants)
        .where(and(eq(eventParticipants.eventId, eventId), eq(eventParticipants.userId, userId))).limit(1);
      if (!participation) return NextResponse.json({ error: 'You must join the challenge first' }, { status: 400 });

      // Don't allow re-grading if already scored
      if (participation.score && participation.score > 0) {
        return NextResponse.json({
          error: 'You have already submitted answers for this challenge',
          alreadyGraded: true,
          previousScore: participation.score,
        }, { status: 400 });
      }

      const questions = (event.challengeContent as any[]) || [];
      if (questions.length === 0) {
        return NextResponse.json({ error: 'This challenge has no questions' }, { status: 400 });
      }

      // Grade each question
      let totalScore = 0;
      let totalPossible = 0;
      const results: { questionIndex: number; question: string; userAnswer: string; correct: boolean; pointsEarned: number; pointsPossible: number; feedback: string }[] = [];

      // Grade MCQs instantly, collect non-MCQ for AI grading
      const aiGradingNeeded: { index: number; question: any; userAnswer: string }[] = [];

      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        const userAnswer = (answers[i] || answers[String(i)] || '').trim();
        const pointsPossible = q.points || 10;
        totalPossible += pointsPossible;

        if (q.type === 'mcq') {
          // Exact match grading for MCQ
          const correctAnswer = (q.answer || '').trim().toUpperCase();
          const userChoice = userAnswer.toUpperCase().replace(/[^A-D]/g, '');
          const isCorrect = userChoice === correctAnswer;
          const earned = isCorrect ? pointsPossible : 0;
          totalScore += earned;
          results.push({
            questionIndex: i,
            question: q.question,
            userAnswer,
            correct: isCorrect,
            pointsEarned: earned,
            pointsPossible,
            feedback: isCorrect ? 'Correct!' : `Incorrect. The correct answer is ${correctAnswer}.`,
          });
        } else {
          // Queue for AI grading
          aiGradingNeeded.push({ index: i, question: q, userAnswer });
        }
      }

      // AI-grade short_answer and drafting questions in one batch
      if (aiGradingNeeded.length > 0) {
        try {
          const gradingPrompt = aiGradingNeeded.map((item, idx) => {
            const q = item.question;
            return `Question ${idx + 1} (${q.type}, ${q.points || 10} points):
Q: ${q.question}
Model Answer: ${q.modelAnswer || 'Not provided'}
Student Answer: ${item.userAnswer || '(No answer provided)'}`;
          }).join('\n\n');

          const gradingCompletion = await openai.chat.completions.create({
            model: MINI_MODEL,
            messages: [
              {
                role: 'system',
                content: `You are a STRICT Kenyan bar exam grader. Grade each student answer against the model answer.

GRADING CRITERIA (be tough but fair):
- Award points based on accuracy, completeness, and legal precision
- For short_answer: Award 0-${aiGradingNeeded[0]?.question.points || 10} points. Partial credit for partially correct answers.
- For drafting: Award 0-${aiGradingNeeded[0]?.question.points || 20} points. Check for proper format, legal accuracy, and completeness.
- An empty or irrelevant answer gets 0 points.
- A vague answer with no legal substance gets at most 20% of points.
- A good answer missing key elements gets 50-70%.
- Only a thorough, legally precise answer gets 80-100%.

Provide brief, constructive feedback for each.

Respond in JSON: {"grades": [{"questionNumber": 1, "pointsEarned": 7, "feedback": "..."}]}`,
              },
              { role: 'user', content: gradingPrompt },
            ],
            temperature: 0.2,
            max_completion_tokens: 2000,
            response_format: { type: 'json_object' },
          });

          const gradingResult = JSON.parse(gradingCompletion.choices[0]?.message?.content || '{}');
          const grades = gradingResult.grades || [];

          for (let gi = 0; gi < aiGradingNeeded.length; gi++) {
            const item = aiGradingNeeded[gi];
            const grade = grades[gi] || { pointsEarned: 0, feedback: 'Could not grade this answer.' };
            const pointsPossible = item.question.points || 10;
            const earned = Math.min(Math.max(0, grade.pointsEarned || 0), pointsPossible);
            totalScore += earned;
            results.push({
              questionIndex: item.index,
              question: item.question.question,
              userAnswer: item.userAnswer,
              correct: earned >= pointsPossible * 0.7,
              pointsEarned: earned,
              pointsPossible,
              feedback: grade.feedback || (earned > 0 ? 'Partially correct.' : 'Incorrect.'),
            });
          }
        } catch (err) {
          console.error('[GradingAgent] AI grading failed:', err);
          // Fallback: give 0 for AI-graded questions
          for (const item of aiGradingNeeded) {
            const pointsPossible = item.question.points || 10;
            results.push({
              questionIndex: item.index,
              question: item.question.question,
              userAnswer: item.userAnswer,
              correct: false,
              pointsEarned: 0,
              pointsPossible,
              feedback: 'Grading temporarily unavailable. Your answer has been recorded.',
            });
          }
        }
      }

      // Sort results by question index
      results.sort((a, b) => a.questionIndex - b.questionIndex);

      // Update participant score
      const correctCount = results.filter(r => r.correct).length;
      await db.update(eventParticipants).set({
        score: totalScore,
        questionsAnswered: questions.length,
        correctAnswers: correctCount,
      }).where(and(eq(eventParticipants.eventId, eventId), eq(eventParticipants.userId, userId)));

      // Feed points into weekly rankings
      try {
        const weekStart = getWeekStartEAT(new Date());
        const weekStartStr = weekStart.toISOString().split('T')[0];
        const weekEndDate = new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000);
        const weekEndStr = weekEndDate.toISOString().split('T')[0];

        const [existingRanking] = await db.select().from(weeklyRankings)
          .where(and(eq(weeklyRankings.userId, userId), eq(weeklyRankings.weekStart, weekStartStr))).limit(1);

        if (existingRanking) {
          await db.update(weeklyRankings).set({
            totalPoints: sql`${weeklyRankings.totalPoints} + ${totalScore}`,
            quizzesCompleted: sql`${weeklyRankings.quizzesCompleted} + 1`,
            updatedAt: new Date(),
          }).where(and(eq(weeklyRankings.userId, userId), eq(weeklyRankings.weekStart, weekStartStr)));
        } else {
          await db.insert(weeklyRankings).values({
            userId,
            weekStart: weekStartStr,
            weekEnd: weekEndStr,
            rank: 0,
            totalPoints: totalScore,
            quizzesCompleted: 1,
            bonusEarned: 0,
          });
        }

        // Recalculate ranks for the week
        const allRankings = await db.select().from(weeklyRankings)
          .where(eq(weeklyRankings.weekStart, weekStartStr))
          .orderBy(desc(weeklyRankings.totalPoints));

        for (let ri = 0; ri < allRankings.length; ri++) {
          await db.update(weeklyRankings).set({ rank: ri + 1 })
            .where(eq(weeklyRankings.id, allRankings[ri].id));
        }
      } catch (err) {
        console.error('[Rankings] Failed to update weekly ranking after grading:', err);
      }

      return NextResponse.json({
        success: true,
        totalScore,
        totalPossible,
        percentage: Math.round((totalScore / totalPossible) * 100),
        results,
        message: `You scored ${totalScore}/${totalPossible} (${Math.round((totalScore / totalPossible) * 100)}%)`,
      });
    }

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
