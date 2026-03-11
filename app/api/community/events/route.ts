import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { communityEvents, eventParticipants, users, weeklyRankings } from '@/lib/db/schema';
import { eq, desc, and, count, gte, lte, sql } from 'drizzle-orm';
import { verifyAuth, type AuthUser } from '@/lib/auth/middleware';
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

/* ================================================================
   AI CHALLENGE AGENT — generates daily COMMUNITY challenges for ALL 7 units.
   Same challenges for everyone. Tough, bar-exam level.
   New set generated at midnight Nairobi time (EAT, UTC+3).
   ================================================================ */

// Hardcoded fallback questions per unit so challenges always have content
function generateFallbackQuestions(type: string, unitName: string, subject: string, subjects: string[]): any[] {
  // Pool of fallback questions per unit, rotated by day
  const FALLBACK_POOL: Record<string, any[]> = {
    'Civil Litigation': [
      { question: `Under the Civil Procedure Act, what is the time limit for filing a defence after service of summons?`, type: 'mcq', options: ['A. 7 days', 'B. 14 days', 'C. 21 days', 'D. 30 days'], answer: 'C', modelAnswer: '21 days from the date of service under Order 8 Rule 1 of the Civil Procedure Rules.', points: 10 },
      { question: `Explain the doctrine of res judicata as applied by Kenyan courts post-2010, citing the relevant statutory provision.`, type: 'short_answer', modelAnswer: 'Section 7 of the Civil Procedure Act (Cap 21) bars re-litigation of issues that were directly and substantially in issue in a former suit between the same parties. The court in Independent Electoral and Boundaries Commission v Maina Kiai [2017] eKLR reaffirmed its strict application.', points: 10 },
      { question: `Which court has original jurisdiction over disputes involving violation of fundamental rights under the Constitution of Kenya 2010?`, type: 'mcq', options: ['A. Magistrate Court', 'B. High Court', 'C. Court of Appeal', 'D. Supreme Court'], answer: 'B', modelAnswer: 'Article 23(1) of the Constitution vests the High Court with jurisdiction to hear and determine applications for redress of denial, violation, or infringement of rights.', points: 10 },
      { question: `Draft a Notice of Intention to Sue the Government under Section 13A of the Government Proceedings Act.`, type: 'drafting', modelAnswer: 'A proper notice must include: addressee (Attorney General), claimant details, nature of claim, relief sought, brief facts, proposed defendant (national or county government), and be served at least 30 days before filing suit.', points: 20 },
    ],
    'Criminal Litigation': [
      { question: `Under Article 49 of the Constitution of Kenya 2010, within how many hours must an arrested person be brought before a court?`, type: 'mcq', options: ['A. 12 hours', 'B. 24 hours', 'C. 48 hours', 'D. 72 hours'], answer: 'B', modelAnswer: 'Article 49(1)(f) requires that an arrested person be brought before a court as soon as reasonably possible, but not later than 24 hours.', points: 10 },
      { question: `Distinguish between bail and bond in Kenyan criminal procedure, citing the relevant legal framework.`, type: 'short_answer', modelAnswer: 'Bail is a right under Article 49(1)(h) of the Constitution, exercised before plea. Bond is a written undertaking with or without sureties under the Bail and Bond Policy Guidelines 2015. The Bail and Bond Policy 2015 standardised the process and requires courts to consider the seriousness of the offence, flight risk, and public safety.', points: 10 },
      { question: `Which of the following is NOT a ground for denying bail under the Bail and Bond Policy Guidelines?`, type: 'mcq', options: ['A. Compelling reasons to believe the accused will abscond', 'B. The accused is unable to afford cash bail', 'C. The offence is punishable by death', 'D. Interference with witnesses'], answer: 'B', modelAnswer: 'Inability to afford bail is not a valid ground. Courts must set bail at reasonable amounts per Article 49(1)(h). Poverty should not be used to deny liberty.', points: 10 },
      { question: `Draft a plea bargain agreement outline under Section 137A-O of the Criminal Procedure Code.`, type: 'drafting', modelAnswer: 'Must include: case details, original charges, reduced/alternative charge, agreed facts, sentence recommendation, victim consultation record, prosecutor and accused signatures, and certificate that the accused entered the agreement voluntarily.', points: 20 },
    ],
    'Conveyancing': [
      { question: `Under the Land Registration Act 2012, which of the following instruments must be registered to take effect?`, type: 'mcq', options: ['A. Power of Attorney', 'B. Lease of less than 2 years', 'C. Transfer of registered land', 'D. License to occupy'], answer: 'C', modelAnswer: 'Section 25 of the Land Registration Act 2012 provides that no instrument (except a lease of less than 2 years) shall be effectual to transfer land until registered.', points: 10 },
      { question: `Explain the process and legal requirements for conducting an official search at the Land Registry, including the significance of a green card.`, type: 'short_answer', modelAnswer: 'An official search is conducted by filing Form RL 26 at the relevant Land Registry. It reveals the registered owner, nature of title, encumbrances, caveats, and restrictions. A "green card" is the physical land register maintained under Section 9 of the Land Registration Act 2012. The official search result is valid for the date shown and protects a purchaser who completes the transaction within 21 days.', points: 10 },
      { question: `What is the stamp duty rate on transfer of residential property in Kenya?`, type: 'mcq', options: ['A. 2% in all areas', 'B. 4% in all areas', 'C. 2% in municipalities, 4% elsewhere', 'D. 4% in municipalities, 2% elsewhere'], answer: 'D', modelAnswer: 'Under the Stamp Duty Act, stamp duty on conveyances is 4% in municipalities and 2% in other areas.', points: 10 },
      { question: `Draft the key clauses of a sale agreement for a freehold property in Nairobi, including completion provisions.`, type: 'drafting', modelAnswer: 'Key clauses: parties, property description (LR No., size, location), purchase price and payment schedule, completion period (usually 90 days), conditions precedent (official search, rates clearance, consent of Land Control Board if applicable), vendor obligations (discharge encumbrances, deliver title), warranties, default and remedies, and dispute resolution.', points: 20 },
    ],
    'Family Law': [
      { question: `Under the Marriage Act 2014, what is the minimum age for marriage in Kenya?`, type: 'mcq', options: ['A. 16 years', 'B. 18 years', 'C. 21 years', 'D. No minimum age'], answer: 'B', modelAnswer: 'Section 4 of the Marriage Act 2014 sets 18 years as the minimum marriageable age for both parties.', points: 10 },
      { question: `Discuss the principles governing division of matrimonial property upon divorce under the Matrimonial Property Act 2013.`, type: 'short_answer', modelAnswer: 'Under Section 7 of the Matrimonial Property Act 2013, matrimonial property vests in the spouses according to the contribution of each spouse. Contribution includes monetary, non-monetary (domestic work, childcare, farm work), and contribution to the management of property. Article 45(3) of the Constitution provides that parties to a marriage are entitled to equal rights at the time of the marriage, during the marriage, and at dissolution.', points: 10 },
      { question: `Which of the following is NOT recognized as a valid form of marriage under the Marriage Act 2014?`, type: 'mcq', options: ['A. Christian marriage', 'B. Customary marriage', 'C. Common law marriage', 'D. Hindu marriage'], answer: 'C', modelAnswer: 'Section 6 of the Marriage Act 2014 recognises five types: civil, Christian, Islamic, Hindu, and customary marriages. Common law marriage is not recognised.', points: 10 },
      { question: `Draft an application for custody orders under the Children Act 2001, identifying the best interests of the child factors a court must consider.`, type: 'drafting', modelAnswer: 'The application must identify: child details, current custody arrangement, wishes of the child (if of sufficient age), each parent\'s ability to provide, child\'s physical/emotional/educational needs, effect of change on the child, and any history of harm. Section 83 of the Children Act requires the court to treat the child\'s welfare as paramount.', points: 20 },
    ],
    'Probate': [
      { question: `Under the Law of Succession Act, what fraction of a deceased's estate is a surviving spouse entitled to on intestacy where there are children?`, type: 'mcq', options: ['A. The entire estate', 'B. One-half', 'C. One-third', 'D. Life interest in the whole estate'], answer: 'D', modelAnswer: 'Under Section 35 of the Law of Succession Act, where the deceased leaves a spouse and children, the surviving spouse is entitled to the personal and household effects absolutely and a life interest in the remainder of the net intestate estate.', points: 10 },
      { question: `Explain the difference between a grant of probate and a grant of letters of administration, including when each applies.`, type: 'short_answer', modelAnswer: 'A grant of probate is issued where the deceased left a valid will and is granted to the named executor(s) under Section 47. Letters of administration are granted under Section 55 where the deceased died intestate (no will) or where the will does not name an executor. Letters of administration intestate are governed by Section 66.', points: 10 },
      { question: `Which of the following persons has priority in applying for letters of administration under the Law of Succession Act?`, type: 'mcq', options: ['A. A creditor of the estate', 'B. The Public Trustee', 'C. The surviving spouse', 'D. The county government'], answer: 'C', modelAnswer: 'Section 66 of the Law of Succession Act gives priority to the surviving spouse, then children, then parents, then siblings.', points: 10 },
      { question: `Draft relevant paragraphs for a Petition for Grant of Letters of Administration Intestate.`, type: 'drafting', modelAnswer: 'Must include: petitioner identification, relationship to deceased, date and place of death, deceased died intestate, next of kin details, estate description (movable and immovable property), beneficiaries under intestacy rules, suitability of petitioner, consent of beneficiaries, and prayer for grant.', points: 20 },
    ],
    'Commercial': [
      { question: `Under the Companies Act 2015, what is the minimum number of directors required for a private company?`, type: 'mcq', options: ['A. 1', 'B. 2', 'C. 3', 'D. 5'], answer: 'A', modelAnswer: 'Section 128(1) of the Companies Act 2015 requires a private company to have at least one director.', points: 10 },
      { question: `Explain the doctrine of lifting the corporate veil under Kenyan company law, citing relevant statutory provisions and case law.`, type: 'short_answer', modelAnswer: 'The corporate veil may be lifted under Section 20 of the Companies Act 2015 where the company was formed for fraudulent or unlawful purposes. Courts have lifted the veil in cases of fraud, agency, and where justice requires it. In Atul Shah & Another v Deposit Protection Fund Board [2016] eKLR, the court emphasized that the veil will not be lifted merely because it is just and equitable.', points: 10 },
      { question: `Which body is primarily responsible for the registration and regulation of companies in Kenya?`, type: 'mcq', options: ['A. Kenya Revenue Authority', 'B. Capital Markets Authority', 'C. Business Registration Service', 'D. Office of the Attorney General'], answer: 'C', modelAnswer: 'The Business Registration Service (BRS), established under the Business Registration Service Act 2015, is responsible for company registration.', points: 10 },
      { question: `Draft the key provisions of a partnership agreement for a law firm under the Partnership Act (Cap 29).`, type: 'drafting', modelAnswer: 'Key provisions: firm name and business, partners\' names and contributions, profit/loss sharing ratio, management and decision-making, drawings and remuneration, admission and retirement of partners, non-compete clause, dispute resolution, dissolution provisions, and accounts/audit requirements.', points: 20 },
    ],
    'Legal Ethics': [
      { question: `Under the Advocates Act (Cap 16), what is the primary regulatory body responsible for disciplining advocates?`, type: 'mcq', options: ['A. Law Society of Kenya', 'B. Advocates Complaints Commission', 'C. Disciplinary Tribunal', 'D. Chief Justice'], answer: 'C', modelAnswer: 'The Disciplinary Tribunal established under Section 57 of the Advocates Act investigates and determines complaints of professional misconduct against advocates.', points: 10 },
      { question: `Discuss the ethical obligations of an advocate regarding client confidentiality and the circumstances under which disclosure may be permitted.`, type: 'short_answer', modelAnswer: 'An advocate has a duty of confidentiality under the Advocates Act and LSK Code of Standards of Professional Practice and Ethical Conduct. Disclosure is permitted: with client consent, where required by law or court order, to prevent imminent harm, or in defence of the advocate in professional proceedings. The duty survives the termination of the advocate-client relationship.', points: 10 },
      { question: `Which of the following is NOT professional misconduct under the Advocates Act?`, type: 'mcq', options: ['A. Misappropriating client funds', 'B. Representing both parties in a dispute', 'C. Charging fees above the Advocates Remuneration Order', 'D. Filing a suit without reasonable cause'], answer: 'C', modelAnswer: 'Advocates may negotiate fees with clients, and the Remuneration Order sets minimum (not maximum) fees. Overcharging alone is not misconduct, though unconscionable fees may be taxed down.', points: 10 },
      { question: `Draft a comprehensive conflict of interest disclosure letter to a potential client in a matter where your firm previously represented the opposing party.`, type: 'drafting', modelAnswer: 'Must include: identification of prior representation, nature of potential conflict, scope of prior retainer, information barriers in place, client\'s right to seek independent counsel, informed consent requirements, and confirmation that proceeding or declining is entirely the client\'s choice.', points: 20 },
    ],
  };

  const unitQuestions = FALLBACK_POOL[unitName] || FALLBACK_POOL['Legal Ethics']!;

  // Filter by type if possible, otherwise return a mix
  if (type === 'trivia') {
    return unitQuestions.filter(q => q.type === 'mcq').slice(0, 3);
  } else if (type === 'drafting') {
    const drafting = unitQuestions.filter(q => q.type === 'drafting');
    const mcq = unitQuestions.filter(q => q.type === 'mcq').slice(0, 1);
    return [...mcq, ...drafting].slice(0, 3);
  } else {
    // research — mix of short_answer and mcq
    const short = unitQuestions.filter(q => q.type === 'short_answer');
    const mcq = unitQuestions.filter(q => q.type === 'mcq').slice(0, 1);
    return [...mcq, ...short].slice(0, 3);
  }
}

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

  // Fallback: deterministic challenges for all missing units — WITH question content
  for (let i = 0; i < challengeSpecs.length; i++) {
    const spec = challengeSpecs[i];
    const unit = UNIT_TOPICS[spec.unitId];
    const typeEmoji = spec.type === 'drafting' ? '✍️' : spec.type === 'trivia' ? '🧠' : '📝';
    const typeLabel = spec.type === 'drafting' ? 'Draft Challenge' : spec.type === 'trivia' ? 'Quick Quiz' : 'Explain It';

    // Generate deterministic fallback questions based on unit and subject
    const fallbackQuestions = generateFallbackQuestions(spec.type, unit.name, spec.subject, unit.subjects);

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
      challengeContent: fallbackQuestions,
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
    // Use verifyAuth to get the DB UUID (not Firebase UID)
    const authUser = await verifyAuth(req);
    const userId: string | null = authUser?.id || null;

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const type = searchParams.get('type');

    // Community Agent: kick off challenge generation in the background
    // so it never blocks the response to the user
    ensureActiveChallenges().catch(err => {
      console.error('[CommunityAgent] Background generation failed:', err);
      _generatingDate = null; // Allow retry
    });

    // Fetch all non-rejected events — explicit column selection to avoid
    // crashing if production DB is missing newer columns
    let allEvents = await db
      .select({
        id: communityEvents.id,
        title: communityEvents.title,
        description: communityEvents.description,
        type: communityEvents.type,
        status: communityEvents.status,
        unitId: communityEvents.unitId,
        rewards: communityEvents.rewards,
        startsAt: communityEvents.startsAt,
        endsAt: communityEvents.endsAt,
        createdById: communityEvents.createdById,
        isAgentCreated: communityEvents.isAgentCreated,
        submitterName: communityEvents.submitterName,
        reviewStatus: communityEvents.reviewStatus,
        challengeContent: communityEvents.challengeContent,
        createdAt: communityEvents.createdAt,
      })
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
          .select({ id: eventParticipants.id })
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
    // Use verifyAuth to get the DB UUID (not Firebase UID)
    const authUser = await verifyAuth(req);
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = authUser.id;

    const body = await req.json();
    const { action, eventId, score } = body;

    /* ---- GRADE CHALLENGE ANSWERS ---- */
    if (action === 'grade') {
      const { answers } = body; // answers: { [questionIndex]: string }
      if (!eventId || !answers) {
        return NextResponse.json({ error: 'Event ID and answers required' }, { status: 400 });
      }

      const [event] = await db.select({
        id: communityEvents.id,
        challengeContent: communityEvents.challengeContent,
        status: communityEvents.status,
      }).from(communityEvents)
        .where(eq(communityEvents.id, eventId)).limit(1);
      if (!event) return NextResponse.json({ error: 'Challenge not found' }, { status: 404 });

      // Must be a participant
      const [participation] = await db.select({
        id: eventParticipants.id,
        score: eventParticipants.score,
      }).from(eventParticipants)
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

        const [existingRanking] = await db.select({ id: weeklyRankings.id }).from(weeklyRankings)
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
        const allRankings = await db.select({ id: weeklyRankings.id, totalPoints: weeklyRankings.totalPoints }).from(weeklyRankings)
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
      .select({
        id: communityEvents.id,
        status: communityEvents.status,
      }).from(communityEvents)
      .where(eq(communityEvents.id, eventId)).limit(1);

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    if (action === 'join') {
      if (event.status === 'completed') {
        return NextResponse.json({ error: 'Cannot join completed event' }, { status: 400 });
      }
      const existing = await db.select({ id: eventParticipants.id }).from(eventParticipants)
        .where(and(eq(eventParticipants.eventId, eventId), eq(eventParticipants.userId, userId))).limit(1);
      if (existing.length > 0) return NextResponse.json({ message: 'Already participating' });

      await db.insert(eventParticipants).values({
        eventId, userId, score: 0, questionsAnswered: 0, correctAnswers: 0, timeSpent: 0,
      });
      return NextResponse.json({ message: 'Joined event successfully' });
    }

    if (action === 'submit') {
      const [participation] = await db.select({ id: eventParticipants.id }).from(eventParticipants)
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
