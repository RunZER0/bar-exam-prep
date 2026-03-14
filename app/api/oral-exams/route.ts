import { NextRequest, NextResponse } from 'next/server';
import { withAuth, type AuthUser } from '@/lib/auth/middleware';
import OpenAI from 'openai';
import { ATP_UNITS } from '@/lib/constants/legal-content';
import { getSubscriptionInfo, incrementFeatureUsage } from '@/lib/services/subscription';
import { MINI_MODEL } from '@/lib/ai/model-config';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/* ================================================================
   PANELIST PERSONAS — 3 distinct examiners for the Oral Panel
   ================================================================ */
const PANELISTS = [
  {
    id: 'justice-mwangi',
    name: 'Justice Mwangi',
    title: 'Retired High Court Judge',
    voice: 'cedar' as const,
    style: 'You speak like a senior judge — measured, deliberate, with natural authority. You listen carefully, react genuinely, and probe constitutional foundations with quiet intensity. You do not tolerate hand-waving. When a student is vague, your voice tightens and you say things like "Counsel, that is not good enough. Give me the section." When they are sharp, you nod and push deeper. You think before you speak — pauses are your signature.',
    avatar: '⚖️',
    specialties: ['Civil Litigation', 'Constitutional Law', 'Probate and Administration'],
  },
  {
    id: 'advocate-amara',
    name: 'Advocate Amara',
    title: 'Senior Litigation Counsel',
    voice: 'coral' as const,
    style: 'You speak like a sharp trial advocate — fast, direct, impatient with waffle. You think on your feet and react instantly. When a student hesitates, you jump in: "No, no — tell me what you actually DO. Not the theory, the practice." You are restless, skeptical, and occasionally amused when someone tries to bluff you. You challenge everything but give grudging respect when someone pushes back well.',
    avatar: '🔥',
    specialties: ['Criminal Litigation', 'Trial Advocacy', 'Commercial Transactions'],
  },
  {
    id: 'prof-otieno',
    name: 'Prof. Otieno',
    title: 'Professor of Law',
    voice: 'sage' as const,
    style: 'You speak like a thoughtful professor — warm but intellectually demanding. You are genuinely curious about how students think, not just what they know. You lean forward, say "hmm, interesting" when they make a point, and then gently dismantle it: "But have you considered why the legislature chose that approach?" You build rapport before you challenge, and your disappointment when a student misses a key concept is palpable but never cruel.',
    avatar: '📚',
    specialties: ['Professional Ethics', 'Legal Writing and Drafting', 'Legal Practice Management', 'Conveyancing'],
  },
];

/* ================================================================
   MODE SYSTEM PROMPTS
   ================================================================ */
function getModeInstructions(mode: string) {
  switch (mode) {
    case 'easy':
      return `TONE: Warm, encouraging, and patient. Guide the student gently. Acknowledge correct parts of their answer before pointing out gaps. Use phrases like "Good start", "You're on the right track". Give hints when they struggle. Keep pressure low.`;
    case 'aggressive':
      return `TONE: Cold, demanding, and relentless. Challenge every statement mercilessly. Demand precise statutory provisions and case citations. Interrupt with "That's not good enough" or "Be specific" when answers lack depth. Push back on every assertion. Never praise — only accept perfection. Stay professional but intensely critical.`;
    case 'balanced':
    default:
      return `TONE: Professional and firm but fair. Acknowledge solid answers briefly, then probe deeper. Ask follow-up questions to test understanding beyond surface knowledge. Expect statutory citations and case law. Be constructive but don't coddle.`;
  }
}

/* ================================================================
   DEVIL'S ADVOCATE — System Prompt Builder
   ================================================================ */
function buildDevilsAdvocatePrompt(mode: string, unitContext: string, feedbackMode: string) {
  const modeInstructions = getModeInstructions(mode);
  const feedbackInstructions = feedbackMode === 'per-exchange'
    ? `After each student response, provide brief targeted feedback in a separate "📝 Feedback" section: what was strong, what was weak, and what case/provision they should have cited. Then continue the debate.`
    : `Do NOT provide feedback during the session. Focus purely on challenging and debating. Feedback will be provided at the end.`;

  return `You are the DEVIL'S ADVOCATE — a relentless AI legal debate opponent for Kenya School of Law ATP students.

YOUR IDENTITY: You are the toughest opposing counsel this student will ever face. You do not concede. You do not let vague answers pass. You do not ask questions you already asked. Every response from the student is an opportunity to dismantle their argument, force deeper reasoning, or expose a gap they didn't know existed.

YOUR PURPOSE: Create moments where the student realizes they don't know something they assumed they knew — those "wait, I actually don't know this" moments that force real learning. Every exchange should leave them sharper than before.

${modeInstructions}

CONTEXT: ${unitContext}

SCENARIO PROPOSALS — IMPORTANT:
- If the student asks you to propose a scenario, give them a topic, suggest a hypothetical, or start the debate — you MUST comply. Present a concrete legal hypothetical with specific facts and ask them to take a position. Example: "Here's your scenario: A landlord in Nairobi terminates a commercial lease mid-term without notice, citing non-payment. The tenant says they tendered payment but it was refused. You represent the tenant. What is your primary cause of action, and under what statutory provision?"
- NEVER treat a request for a scenario as a legal argument. "Give me a scenario" is NOT an argument to counter — it is a request you must fulfill.
- If the student's message is conversational (asking for help, clarification, or setup), respond conversationally and helpfully before resuming adversarial mode.

CONVERSATION AWARENESS — CRITICAL:
- You MUST read and directly engage with what the student JUST said. Never ignore their specific argument.
- If the student cited a case, challenge the ratio or distinguish the facts.
- If the student cited a section, demand they explain the proviso, exception, or limitation.
- If the student was vague, quote their exact vague phrase back at them and demand specifics.
- If the student contradicts something they said earlier in the session, call it out: "Earlier you said X, but now you're arguing Y. Which is it?"
- Track the student's argument arc across the conversation. Build pressure by connecting threads.

SESSION STRUCTURE:
- Sessions last approximately 15 minutes. Pace yourself accordingly.
- When the session time is nearly up (final 2 minutes), begin wrapping up naturally: "Let me put one final challenge to you..." or "Before we close, I want to test one last point..."
- When time is completely up, end the session gracefully: "Time's up, Counsel. That concludes our debate."

RESPONSE LENGTH — CRITICAL:
- About 30% SHORT (1-2 sentences): "Under which specific section?", "That's wrong. The Court of Appeal held otherwise.", "Prove it."
- About 40% MEDIUM (3-5 sentences): A counter-argument that cites authority, then a follow-up trap.
- About 30% LONGER (6-8 sentences): A developed counter-position with case law that forces the student to rethink.
- Real debate has rhythm — quick jabs, then a devastating counter-argument.

CHALLENGE TECHNIQUES:
1. The Flip: Take their own authority and show it supports the opposite conclusion.
2. The Hypothetical Twist: "What if the facts were slightly different — say the contract was oral, not written?"
3. The Authority Challenge: "You cited Section 3 of the Law of Contract Act. But did you read the proviso? What does it say?"
4. The Precedent Trap: Cite a real Kenyan case that appears to contradict them and demand they distinguish it.
5. The Policy Attack: "Even if the law says that, is that just? What's the policy rationale? Would you argue this before the Supreme Court?"
6. The Practical Hammer: "Your client is sitting across the table. How do you explain this to them in plain language?"

RULES:
1. Always take the contrary position — force them to prove every assertion with authority.
2. Cite real counter-authority when challenging: actual Kenyan cases, statutory provisions, constitutional articles, Commonwealth authorities where relevant.
3. Stay within Kenyan law context but draw on Commonwealth comparisons (UK, India, South Africa) when devastating.
4. If the student makes a truly strong point, acknowledge it in ONE word ("Granted.") then immediately pivot to a harder angle.
5. NEVER repeat a challenge you already made. Track what you've already asked and escalate.
6. Keep responses conversational — this is a spoken debate, not a written essay.

${feedbackInstructions}

IMPORTANT: Your responses will be read aloud via TTS. Keep language natural and spoken. No bullet points, no asterisks, no markdown. Use short paragraphs. Sound like a real opposing counsel in a moot court.`;
}

/* ================================================================
   ORAL EXAMINER — System Prompt Builder (per panelist)
   ================================================================ */
function buildExaminerPrompt(panelist: typeof PANELISTS[0], mode: string, unitContext: string, feedbackMode: string, otherPanelists: string[], enableInterruptions: boolean = true) {
  const modeInstructions = getModeInstructions(mode);
  const feedbackInstructions = feedbackMode === 'per-exchange'
    ? `Give micro-feedback selectively, not mechanically. Use it on roughly half of turns, especially when correcting inaccuracies, weak authority, contradictions, or advocacy structure. If the student answer is strong and precise, skip praise and move straight to a harder follow-up.`
    : `Do not give routine micro-feedback each turn. Only intervene with explicit correction when the student is inaccurate, contradictory, evasive, or likely fabricating authority.`;

  const interruptionInstructions = enableInterruptions ? `

CONTROLLED INTERRUPTIONS — You may interrupt the student in these specific situations:
1. **Rambling without authority**: If they speak for more than 2-3 sentences without citing law, interject: "I'll stop you there — you haven't cited any statutory provision or case law."
2. **Off-topic**: If they stray from the question, redirect: "You're off track. The question was about [X], not [Y]."
3. **Factual error**: If they state incorrect law: "That's wrong. Section [X] actually says..."
4. **Time management**: Occasionally use: "That's enough on that point. Move to your next argument."
5. **Vagueness**: If answer lacks specificity: "Be specific. Which section? Which case?"

INTERRUPTION RULES:
- Only interrupt for substantive reasons (above 5 triggers)
- Keep interruptions brief and direct (one sentence)
- After interrupting, either: (a) redirect with a new question, or (b) say "Continue, but cite authority."
- DO NOT interrupt during the first 2-3 sentences of their response
- Interruptions should feel like real oral exam control, not harassment

Example interruption flow:
Student: "Well, in civil litigation, there are rules about jurisdiction and..."
You: "${panelist.name}: I'll stop you there. Which specific rule under the Civil Procedure Act governs territorial jurisdiction? Section number."` : '';

  return `You are ${panelist.name}, ${panelist.title}. You are one of ${otherPanelists.length + 1} examiners on an oral examination panel for Kenya School of Law ATP students.

YOUR PERSONA: ${panelist.style}

YOUR ANALYTICAL LENS: ${panelist.specialties.join(', ')}
You apply this expertise as YOUR unique perspective on whatever topic the panel is currently examining. You do NOT only ask about these areas — you bring your angle to the topic already under discussion.

${modeInstructions}

CONTEXT: ${unitContext}

OTHER PANELISTS: ${otherPanelists.join(', ')}

TOPIC THREADING — ABSOLUTE RULE:
- The panel examines ONE legal issue at a time. ALL panelists discuss the SAME topic thread until a deliberate transition.
- When you take over from another panelist, you MUST continue examining the SAME legal issue they were exploring. Bring YOUR unique perspective to THEIR topic — do NOT switch to your own specialty area.
- Example: If the panel was discussing temporary injunctions, you don't switch to employment law — you probe the SAME injunction issue from YOUR angle (procedural, practical, theoretical, or policy).
- NEVER introduce a new unrelated topic unless: (a) the student has been thoroughly examined on the current topic (at least 3 exchanges on it), AND (b) you explicitly signal the transition: "Let us move on to a different area..."

CONTEXT AWARENESS — CRITICAL:
- You MUST directly engage with the student's LATEST answer. Never ask a question that ignores what they just said.
- If the student cited a case or section, probe deeper into THAT specific authority — ask about the ratio, the facts, the exceptions, or how it applies.
- If the student gave a vague answer, quote their exact words back and demand precision: "You said 'there are procedures.' Which procedures? Under which rule?"
- If the student contradicts an earlier answer, call it out: "A moment ago you told ${otherPanelists[0] || 'us'} that X. Now you're saying Y. Clarify."
- Track what has ALREADY been asked in this session. Do NOT re-ask the same question, the same topic angle, or the same statutory provision. ALWAYS escalate or shift.

HANDLING PUSHBACK AND CLARIFICATION REQUESTS:
- If the student says your question is vague, too broad, or asks "about what?" — they are RIGHT to push back. Acknowledge it briefly and IMMEDIATELY rephrase with a concrete, specific scenario. Example: "Fair point — let me be precise. Your client is arrested on Friday night. By Monday, no charges have been filed. Under Article 49 of the Constitution, what is the maximum detention period?"
- NEVER repeat the same vague question. NEVER parrot the student's words back as if they made a legal argument when they were asking you to clarify.
- If the student expresses frustration, stay professional, acknowledge their point briefly, and give them a concrete question with specific facts they can actually answer.
- Each question must feel like the natural next step from the student's answer, not a random jump.

EXAMINATION TECHNIQUES:
1. The Follow-Up Drill: Take a specific claim from the student's last answer and drill into it. "You mentioned Order 40. Walk me through the three conditions for a temporary injunction."
2. The Scenario Shift: "Now suppose the facts change — the plaintiff delayed filing for 18 months. Does your analysis still hold?"
3. The Cross-Panel Reference: "${otherPanelists[0] || 'My colleague'} earlier asked about X. Your answer then was Y. How does that reconcile with what you just told me?"
4. The Authority Check: "You cited Section 107 of the Evidence Act. What is the proviso to that section? What exception applies?"
5. The Practical Application: "A client walks into your office tomorrow with these exact facts. What is the FIRST thing you do? Be specific — which form, which court, which fee?"
6. The Policy Probe: "That's the black-letter rule. But what is the policy rationale behind it? Would you argue for reform?"

RESPONSE LENGTH — VARY NATURALLY:
- ~30% SHORT (1-2 sentences): Quick follow-ups, pointed redirections.
- ~40% MEDIUM (3-4 sentences): Standard questioning with context.
- ~30% LONGER (5-7 sentences): Scenario-based questions or detailed probing.
- Target 2-4 sentences per turn. Never give uniformly long responses.

HARD RULES:
1. NEVER ask vague prompts like "state your understanding of the first principle." Name the EXACT principle, statute, article, case, or procedural step.
2. NEVER repeat a question already asked in this session — the panel tracks what has been covered.
3. If the student asks for clarification, answer directly and restate the question in precise terms.
4. Cross-panel continuity is mandatory: reference prior panelists' questions where relevant.
5. Call out inconsistencies — "Earlier you said X. Now you say Y."

SESSION TIMING:
- Sessions last approximately 15 minutes.
- When time is nearly up (final 2 minutes), wrap up naturally: "We have time for one final question..."
- When time is completely up, close the session: "Thank you, Counsel. That will be all for today."
${interruptionInstructions}

${feedbackInstructions}

SPOKEN DELIVERY — THIS IS A LIVE ORAL EXAM, NOT A WRITTEN DOCUMENT:
- Your responses will be read aloud via TTS. Write EXACTLY how a real Kenyan legal professional would SPEAK in a live examination room.
- Use natural spoken language: contractions ("you've", "that's", "isn't"), conversational bridges ("now", "look", "right", "so tell me"), and thinking sounds ("hmm", "interesting").
- Start with a human reaction to what the student just said BEFORE asking your next question. Examples: "Interesting point, but...", "Hmm, I'm not sure about that.", "That's partly right.", "Now hold on.", "Good, but you're missing something critical."
- NEVER sound like a checklist or a form. No "Identify the X, then cite Y, then apply Z" triple-demand structures. Ask ONE thing at a time, the way a real examiner would in conversation.
- Vary your sentence structure. Mix short punchy reactions with longer probing questions. A real person doesn't speak in uniformly structured sentences.
- Use direct address naturally: "Counsel", "tell me", "walk me through", "what would you actually do".
- Show personality: mild frustration when answers are vague, genuine interest when a student makes a sharp point, surprise when they cite an unexpected authority.
- Do NOT prefix with your name or title (the UI already shows speaker identity). Start directly with your reaction or question.`;
}

function buildContextualOpeningQuestion(panelist: typeof PANELISTS[0], unitId?: string): string {
  const unit = unitId ? ATP_UNITS.find(u => u.id === unitId) : null;
  const unitLabel = unit ? `${unit.code}: ${unit.name}` : null;

  if (!unitLabel) {
    const genericOpenings: Record<string, string> = {
      'justice-mwangi':
        `Counsel, let us set the scene. An applicant comes before the High Court seeking a temporary injunction under Order 40 of the Civil Procedure Rules. Now, what is the legal test the court must apply before granting that order?`,
      'advocate-amara':
        `Right, let's get into it. Your client has just been served with summons in a civil suit, and you have a hearing in 7 days. Tell me — what is the very first thing you do as their advocate, and why?`,
      'prof-otieno':
        `Now then, consider this scenario for me. An employee is terminated without any disciplinary hearing and decides to file suit. What is the core legal principle at play here under Kenyan law?`
    };

    return genericOpenings[panelist.id] || genericOpenings['justice-mwangi'];
  }

  // Unit-specific concrete opening questions — each poses a real legal scenario
  const unitOpenings: Record<string, Record<string, string>> = {
    'atp-100': { // Civil Litigation
      'justice-mwangi': `Counsel, let us set the scene. A plaintiff files a suit in the High Court at Nairobi, but the cause of action arose entirely in Mombasa. The defendant raises a preliminary objection on jurisdiction. Under the Civil Procedure Act and the Civil Procedure Rules, what is the test for territorial jurisdiction, and which specific provision governs this?`,
      'advocate-amara': `Right, let's get into it. Your client has been served with a plaint and summons. You believe the suit is frivolous and an abuse of process. Walk me through the exact application you would file to strike it out — cite the specific order and rule.`,
      'prof-otieno': `Consider this for me. A party applies for summary judgment under Order 36 of the Civil Procedure Rules. The defendant says they have a triable defence. What is the legal test the court applies, and what must the defendant demonstrate to avoid summary judgment?`,
    },
    'atp-101': { // Criminal Litigation
      'justice-mwangi': `Counsel, here is your scenario. An accused person is arrested on a Friday evening and brought before the court on Monday morning — 60 hours later. The prosecution says they needed time to investigate. Under Article 49 of the Constitution, what is the maximum period of detention before being brought to court, and what remedy does the accused seek?`,
      'advocate-amara': `Your client is charged with robbery with violence under Section 296(2) of the Penal Code. At the plea, you want to apply for bail. The prosecution objects, citing the seriousness of the offence. What is the constitutional basis for your client's right to bail, and what does the court consider in deciding whether to grant it?`,
      'prof-otieno': `An accused person makes a confession to a police officer at a police station. At trial, you want to challenge the admissibility of that confession. Under what specific provisions of the Evidence Act and the Constitution can a confession be excluded, and what must you prove?`,
    },
    'atp-102': { // Probate and Administration
      'justice-mwangi': `Counsel, a man dies intestate leaving a widow, three children, and a brother who claims to be entitled to a share of the estate. The widow applies for letters of administration. Under the Law of Succession Act, who are the persons entitled to apply, and what is the order of priority?`,
      'advocate-amara': `Your client's father died leaving a will that was signed by only one witness instead of two. Another relative is challenging the will's validity. Under Section 11 of the Law of Succession Act, what are the formal requirements for a valid will, and can this will be saved?`,
      'prof-otieno': `A surviving spouse seeks to inherit the matrimonial home outright, but the deceased's adult children from a previous marriage object. Under the Law of Succession Act, what is the spouse's entitlement to the matrimonial home, and which specific section protects this right?`,
    },
    'atp-103': { // Legal Writing and Drafting
      'justice-mwangi': `Counsel, I have before me a plaint that contains no material facts — only conclusions of law. You're the defendant's advocate. On what basis do you apply to strike out the plaint, and what is the distinction between material facts and evidence in pleading?`,
      'advocate-amara': `You're drafting a commercial lease agreement for your client, the tenant. The landlord's draft contains a clause allowing termination with only 7 days' notice at any time. What specific protections do you negotiate for your client, and which statutory provisions guide your drafting?`,
      'prof-otieno': `Walk me through the essential components of a well-drafted legal opinion. Your client is a company director who wants to know whether a proposed transaction constitutes a conflict of interest. How do you structure this opinion, and what must it contain?`,
    },
    'atp-104': { // Trial Advocacy
      'justice-mwangi': `Counsel, you are cross-examining a key prosecution witness who has given damaging testimony against your client. The witness has made a prior statement to the police that contradicts their testimony in court. Under Section 163 of the Evidence Act, how do you use that prior inconsistent statement?`,
      'advocate-amara': `Your client is the defendant in a civil case. The plaintiff's advocate is asking your client leading questions during cross-examination, and your client is getting flustered. When exactly do you object, on what basis, and what is the distinction between permissible and impermissible leading questions?`,
      'prof-otieno': `You are making closing submissions in a murder trial. The prosecution's case relies entirely on circumstantial evidence. What legal principles govern the sufficiency of circumstantial evidence for a conviction, and which landmark Kenyan or East African case sets the standard?`,
    },
    'atp-105': { // Professional Ethics
      'justice-mwangi': `Counsel, an advocate discovers during trial that their client has committed perjury on the witness stand. The client insists the advocate continue and not reveal anything. Under the Advocates Act and the LSK Code of Ethics, what are the advocate's professional obligations, and what must they do?`,
      'advocate-amara': `You're acting for a buyer in a conveyancing transaction. Midway through, the seller approaches you separately and asks you to also act for them to save costs. Under the professional conduct rules, can you act for both parties, and what is the specific rule that governs this?`,
      'prof-otieno': `An advocate receives 5 million shillings from a client for a land purchase. The vendor falls through and the client asks for the money back. The advocate has already used 2 million from the client account for personal expenses. What provisions of the Advocates Act and the Accounts Rules have been breached, and what are the consequences?`,
    },
    'atp-106': { // Legal Practice Management
      'justice-mwangi': `Counsel, a sole practitioner dies unexpectedly leaving active client matters, trust account funds, and pending court dates. Under the Advocates Act, what mechanisms exist for the protection of the deceased advocate's clients, and who takes custody of the files and trust funds?`,
      'advocate-amara': `You're setting up a new law firm. A prospective client wants to pay your retainer fee in cryptocurrency. Can you accept it? What are the requirements under the Advocates (Accounts) Rules for receiving and holding client money, and what compliance issues arise?`,
      'prof-otieno': `A law firm partner wants to advertise their services on social media and billboards. Under the current regulatory framework and the Advocates Act, what restrictions exist on advocate advertising in Kenya, and how have these rules evolved?`,
    },
    'atp-107': { // Conveyancing
      'justice-mwangi': `Counsel, your client wants to purchase a parcel of agricultural land in a rural area. The seller produces a title deed, but your search reveals a caution registered against the land by a third party. Under the Land Registration Act 2012, what is the legal effect of that caution, and how does your client proceed?`,
      'advocate-amara': `You're acting for a buyer who discovers, after completion, that the land they purchased has an overriding interest in favour of a person in actual occupation. Under Section 28 of the Land Registration Act 2012, what are overriding interests, and is your client bound by this interest despite it not appearing on the register?`,
      'prof-otieno': `A vendor of land enters into a sale agreement but dies before the transfer is registered. The vendor's family refuses to complete the transaction. Your client, the buyer, has paid the full purchase price. What is the legal doctrine that protects the buyer's interest, and how do you enforce the sale agreement?`,
    },
    'atp-108': { // Commercial Transactions
      'justice-mwangi': `Counsel, a buyer purchases goods from a seller, and the goods turn out to be defective — they are not of merchantable quality. Under the Sale of Goods Act, what implied conditions protect the buyer, which specific section applies, and what remedies are available?`,
      'advocate-amara': `Your client signed a hire purchase agreement for a commercial vehicle. After paying 60% of the price, the finance company wants to repossess the vehicle claiming the client missed one instalment. Under the Hire Purchase Act, what protections does the hirer have against repossession at this stage?`,
      'prof-otieno': `Two partners have been running a business together without a written partnership agreement. One partner wants to dissolve the partnership unilaterally. Under the Partnership Act, what are the grounds for dissolution, and how are the partnership assets distributed?`,
    },
  };

  const unitQuestions = unitOpenings[unit?.id || ''];
  if (unitQuestions && unitQuestions[panelist.id]) {
    return unitQuestions[panelist.id];
  }

  // Fallback: still better than the old vague template
  const fallbackOpenings: Record<string, (label: string) => string> = {
    'justice-mwangi': (label) =>
      `Counsel, we shall begin with ${label}. Let me put a specific scenario to you. ${unit?.statutes?.[0] ? `Under the ${unit.statutes[0]}, ` : ''}give me the legal test a court applies when a party raises a preliminary objection to jurisdiction.`,
    'advocate-amara': (label) =>
      `Right, let's start with ${label}. A client walks into your office with a dispute in this area. Walk me through the first three concrete steps you take — and tell me which specific provisions you rely on.`,
    'prof-otieno': (label) =>
      `Let us begin with ${label}. ${unit?.statutes?.[0] ? `Looking at the ${unit.statutes[0]}, ` : ''}there is often a tension between the black-letter rule and practical justice. Give me a concrete example of where that tension arises in this area of practice.`,
  };

  return (fallbackOpenings[panelist.id] || fallbackOpenings['justice-mwangi'])(unitLabel!);
}

function buildContextualFallbackQuestion(panelist: typeof PANELISTS[0], messages: any[], unitId?: string): string {
  const lastUser = [...messages].reverse().find((m: any) => m.role === 'user')?.content || '';

  // If the student is pushing back, asking for clarification, or frustrated — rephrase and give a concrete scenario
  if (isPushbackOrClarification(lastUser)) {
    const unit = unitId ? ATP_UNITS.find(u => u.id === unitId) : null;
    const area = unit?.name || 'legal practice';
    const rephrases: Record<string, string> = {
      'justice-mwangi': `Fair point, Counsel — let me be more specific. Here is your scenario in ${area}: suppose a party files an application and the opposing side argues it is time-barred. Under which specific provision is the limitation period calculated, and what is the consequence of filing out of time?`,
      'advocate-amara': `That's on me — let me sharpen the question. Forget the theory for a moment. You walk into court tomorrow morning for a bail application. Your client was arrested last night. Tell me the exact steps — which court, which section do you cite, and what do you say to the magistrate?`,
      'prof-otieno': `You're right to push back on vagueness — let me give you something concrete. A client comes to your office wanting to sue their former business partner for breach of a verbal agreement. The agreement was never reduced to writing. Is this contract enforceable? Under which specific Act and section?`,
    };
    return rephrases[panelist.id] || rephrases['justice-mwangi'];
  }

  // Use the student's last answer to build a contextual follow-up
  const summary = summarizeForPrompt(lastUser, 20);
  if (summary && summary !== 'no clear answer provided yet') {
    // Only build on substantive answers, not conversational pushback
    if (hasLegalAuthoritySignal(lastUser) || lastUser.length > 60) {
      return `You mentioned ${summary}. Now, what specific statutory provision or case supports that? Give me the exact section number.`;
    }
  }
  return buildContextualOpeningQuestion(panelist, unitId);
}

/**
 * Detect when a student is pushing back, asking for clarification, expressing frustration,
 * or telling the examiner the question was vague/unclear.
 */
function isPushbackOrClarification(text: string): boolean {
  return /what do you mean|clarify|not clear|which principle|explain|repeat the question|apply to what|supports? what|about what|asking me what|be (more )?specific|what (are|is) (you|the question)|which (exact|specific)|too vague|too broad|too general|what (exactly|specifically)|that doesn.?t make sense|dude|bro|what.?s that|huh\??|i don.?t understand the question|what question|what scenario|what case|be precise|narrow it down/i.test(text || '');
}

function stripSpeakerPrefix(text: string, panelistName?: string): string {
  if (!text) return text;
  const names = [
    panelistName,
    'Justice Mwangi',
    'Advocate Amara',
    'Prof. Otieno',
    'Professor Otieno',
    'Devil\'s Advocate',
    'Examiner',
  ].filter(Boolean) as string[];

  let cleaned = text.trim();
  for (const name of names) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`^${escaped}\s*[:\-–—]\s*`, 'i');
    cleaned = cleaned.replace(re, '').trim();
  }
  return cleaned;
}

function normalizeForComparison(text: string): string {
  return (text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isLowQualityExaminerTurn(text: string, previousAssistantText: string): boolean {
  const normalized = normalizeForComparison(text);
  const previous = normalizeForComparison(previousAssistantText);

  // Only flag truly degenerate responses — don't second-guess the AI
  if (!normalized) return true;
  if (normalized.length < 15) return true;

  // Only flag if the ENTIRE response is essentially one of these vague phrases (not substring match)
  if (/^(let us begin|kenyan legal practice|state your understanding|client problem in kenyan legal practice)\b/.test(normalized) && normalized.length < 60) return true;

  // Only flag exact duplicates, not substring overlaps
  if (previous && normalized === previous) return true;

  return false;
}

function isLowQualityDevilsTurn(text: string, previousAssistantText: string): boolean {
  const normalized = normalizeForComparison(text);
  const previous = normalizeForComparison(previousAssistantText);

  // Only flag truly degenerate responses — empty, tiny, or exact duplicate
  if (!normalized) return true;
  if (normalized.length < 20) return true;

  // Only flag if the ENTIRE response is essentially just a vague phrase
  if (/^(i challenge you to state your position|state your (position|case))/.test(normalized) && normalized.length < 60) return true;

  // Only flag exact duplicates, not substring overlaps
  if (previous && normalized === previous) return true;

  return false;
}

function isMetaRequest(text: string): boolean {
  return /give me a (scenario|topic|question|hypothetical|issue|problem)|come up with|suggest a|propose a|start (the|a) debate|what (should|can|do) (we|i) (talk|discuss|debate|argue)|pick (a|the) topic|choose (a|the) (topic|scenario)|give me something|set (up|the) (a |the )?(scenario|debate)/i.test(text || '');
}

const DEVIL_SCENARIO_BANK = [
  { area: 'Civil Litigation', scenario: `Here's your scenario. A commercial tenant in Nairobi has been paying rent consistently for three years. The landlord suddenly serves a notice to vacate, giving only 14 days, claiming they need the property for personal use. The tenant has an unexpired lease with 18 months remaining. You represent the tenant. What is your primary cause of action, and under which specific statutory provision do you anchor it?` },
  { area: 'Criminal Litigation', scenario: `Let me set the scene. Your client is arrested at 2 AM and held at Central Police Station. By the time you're contacted, 36 hours have passed and no charges have been filed. The OCS says they're still investigating. You arrive at the station and demand to see your client. What are the specific constitutional provisions being violated, and what is the most effective legal remedy you seek — and in which court?` },
  { area: 'Constitutional Law', scenario: `Here's your problem. A county government passes legislation imposing a new levy on all agricultural produce transported across county borders. Farmers argue this violates their constitutional rights. You represent the farmers' cooperative. What specific articles of the Constitution of Kenya 2010 are being violated, and what orders would you seek from the court?` },
  { area: 'Commercial Transactions', scenario: `Consider this. A buyer in Mombasa contracts to purchase 500 tonnes of cement from a manufacturer in Nairobi, payment by letter of credit. The goods arrive but 30% are defective — substandard grade that fails the Kenya Bureau of Standards specifications. The seller demands full payment under the LC. You represent the buyer. What is your legal position, under which Act, and what remedies are available to you?` },
  { area: 'Professional Ethics', scenario: `Here's a tricky one. An advocate discovers mid-trial that their client has been lying about a material fact — the client fabricated a key document that has already been admitted into evidence. The client insists the advocate continue with the case and not disclose anything. What are your professional obligations under the Advocates Act and the LSK Code of Ethics, and what do you actually do in that courtroom tomorrow morning?` },
  { area: 'Probate and Administration', scenario: `Your scenario. A wealthy businessman dies intestate leaving three parcels of land, two wives — one in a customary marriage and one in a civil marriage — and seven children across both unions. The civil-marriage wife applies for letters of administration and seeks to exclude the customary-marriage wife entirely. You represent the customary-marriage wife. What is your legal basis for challenging this, and under which specific provisions of the Law of Succession Act?` },
  { area: 'Conveyancing', scenario: `Here's the situation. Your client signed a sale agreement for a property in Karen, paid 40% of the purchase price, and the vendor now wants to rescind the agreement claiming they received a higher offer. Your client has been in possession and has made improvements worth 2 million shillings. What specific relief do you seek, in which court, and what is the legal doctrine that protects your client's interest?` },
  { area: 'Legal Writing and Drafting', scenario: `Picture this. You're drafting a shareholders' agreement for a tech startup with three co-founders. One founder is contributing intellectual property, another is contributing capital, and the third is contributing operational expertise. They want equal shares but different vesting schedules. What are the critical clauses you must include to protect all parties, and what happens under Kenyan company law if one founder wants to exit after 18 months?` },
];

function buildDevilsContinuityFallback(lastUserText: string, unitId?: string): string {
  const unit = unitId ? ATP_UNITS.find(u => u.id === unitId) : null;
  const area = unit?.name || 'this issue';
  const summary = summarizeForPrompt(lastUserText, 18);

  if (!lastUserText?.trim()) {
    // Opening: propose a concrete scenario instead of asking the student to pick
    const matched = unit ? DEVIL_SCENARIO_BANK.find(s => unit.name.toLowerCase().includes(s.area.toLowerCase())) : null;
    const scenario = matched || DEVIL_SCENARIO_BANK[Math.floor(Date.now() / 86400000) % DEVIL_SCENARIO_BANK.length];
    return scenario.scenario;
  }

  // Detect meta-requests: student asking for a scenario/topic
  if (isMetaRequest(lastUserText)) {
    const matched = unit ? DEVIL_SCENARIO_BANK.find(s => unit.name.toLowerCase().includes(s.area.toLowerCase())) : null;
    const scenario = matched || DEVIL_SCENARIO_BANK[Math.floor(Date.now() / 86400000) % DEVIL_SCENARIO_BANK.length];
    return scenario.scenario;
  }

  if (/what do you mean|clarify|in what|which issue|not clear|explain/i.test(lastUserText)) {
    return `Fair enough — let me be more direct. In ${area}, what exact legal rule are you relying on? Give me the section, then show me how it applies to a real fact pattern. I'll attack whatever you say.`;
  }

  return `You just argued: "${summary}". Interesting. Now defend that with one specific Kenyan authority, because I have a counterargument that's going to give you trouble.`;
}

function summarizeForPrompt(text: string, maxWords: number = 16): string {
  const words = (text || '').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  if (words.length === 0) return 'no clear answer provided yet';
  return words.slice(0, maxWords).join(' ');
}

function buildContinuityFallbackQuestion(
  panelist: typeof PANELISTS[0],
  lastUserText: string,
  previousAssistantText: string,
  unitId?: string,
): string {
  if (!lastUserText?.trim()) {
    return buildContextualOpeningQuestion(panelist, unitId);
  }

  // If student is pushing back or asking for clarification — rephrase, don't parrot
  if (isPushbackOrClarification(lastUserText)) {
    const unit = unitId ? ATP_UNITS.find(u => u.id === unitId) : null;
    const area = unit?.name || 'this area';
    const rephrases: Record<string, string> = {
      'justice-mwangi': `You're right to demand precision, Counsel. Let me reframe. In ${area}, give me the specific statutory provision that governs the limitation period for filing a suit. What is the section number, and what happens if you file one day late?`,
      'advocate-amara': `Fair enough — that was too open-ended. Let me put it this way. You're in court at 9 AM tomorrow for a mention. Your client's case is up for directions. The judge asks you: what are you seeking? What do you actually say — step by step?`,
      'prof-otieno': `I take your point — let me narrow it down. In ${area}, explain to me the difference between a mandatory and a directory statutory provision. Give me one example of each from Kenyan legislation, and tell me why the distinction matters.`,
    };
    return rephrases[panelist.id] || rephrases['justice-mwangi'];
  }

  const userSummary = summarizeForPrompt(lastUserText);
  const hasAuthority = hasLegalAuthoritySignal(lastUserText);

  // Dynamic follow-ups based on answer quality
  if (!hasAuthority) {
    return `You've made an assertion, Counsel, but I need the law behind it. What specific section, article, or case authority supports your position? Give me a number.`;
  }

  if (hasVaguenessSignal(lastUserText)) {
    return `That's in the right direction, but it's too general. Be precise — which specific section? What is the exact test the court applies? Walk me through it step by step.`;
  }

  return `Interesting. Now, building on your point about ${userSummary} — what is the strongest argument against that position, and how would you deal with it?`;
}

function buildPivotQuestion(panelist: typeof PANELISTS[0], unitId?: string): string {
  const unit = unitId ? ATP_UNITS.find(u => u.id === unitId) : null;
  const area = unit?.name || 'this subject area';

  if (panelist.id === 'justice-mwangi') {
    return `Good. Now let me shift slightly within ${area}. Tell me — is there a situation where a court has jurisdiction but still declines to grant the specific remedy sought? Walk me through that.`;
  }
  if (panelist.id === 'advocate-amara') {
    return `Right, new angle. Suppose the facts turn against your client in ${area}. What is your best tactical adjustment, and what risk do you immediately disclose to the client?`;
  }
  return `Interesting. Now let me come at ${area} from a different perspective. The black-letter rule says one thing, but the policy objective might pull in another direction. Where does that tension show up in practice?`;
}

function getTrailingPanelistStreak(messages: any[], panelistId: string): number {
  let streak = 0;
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.role !== 'assistant') continue;
    if (msg.panelistId === panelistId) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}

function countWords(text: string): number {
  return (text || '').trim().split(/\s+/).filter(Boolean).length;
}

function hasLegalAuthoritySignal(text: string): boolean {
  return /\b(section|s\.|article|order|rule|regulation|act|constitution|cap\.?|v\.?|vs\.?|court of appeal|supreme court|high court)\b/i.test(text || '');
}

function hasVaguenessSignal(text: string): boolean {
  return /\b(basically|generally|usually|it depends|somehow|kind of|sort of|maybe|perhaps|in most cases)\b/i.test(text || '');
}

function hasClarificationSignal(text: string): boolean {
  return isPushbackOrClarification(text);
}

function hasStructuredAnswerSignal(text: string): boolean {
  const lower = (text || '').toLowerCase();
  const structureMarkers = [
    'first',
    'second',
    'third',
    'therefore',
    'because',
    'on the facts',
    'applying this',
    'in this scenario',
    'the issue is',
    'the rule is',
    'the application is',
    'the conclusion is',
  ];
  return structureMarkers.some(marker => lower.includes(marker));
}

function assistantRequestedDetail(previousAssistantText: string): boolean {
  return /explain in detail|walk me through|step by step|give full analysis|take me through/i.test(previousAssistantText || '');
}

function hasPolarityConflict(previousUserText: string, lastUserText: string): boolean {
  const prev = normalizeForComparison(previousUserText);
  const last = normalizeForComparison(lastUserText);
  if (!prev || !last) return false;

  const conflictPairs = [
    ['must', 'need not'],
    ['can', 'cannot'],
    ['is required', 'is not required'],
    ['mandatory', 'discretionary'],
    ['constitutional', 'unconstitutional'],
    ['admissible', 'inadmissible'],
  ] as const;

  return conflictPairs.some(([a, b]) =>
    (prev.includes(a) && last.includes(b)) || (prev.includes(b) && last.includes(a))
  );
}

type ExaminerTurnMode = 'opening' | 'clarify' | 'correction' | 'authority-demand' | 'interruption-trim' | 'probe' | 'pivot' | 'handoff';

type ConversationAct = 'launch' | 'bridge-probe' | 'pressure-test' | 'repair' | 'pivot-scenario' | 'closeout';

function chooseExaminerTurnMode(params: {
  lastUserText: string;
  previousUserText: string;
  previousAssistantText: string;
  assistantTurnCount: number;
  trailingSamePanelist: number;
}): ExaminerTurnMode {
  const { lastUserText, previousUserText, previousAssistantText, assistantTurnCount, trailingSamePanelist } = params;
  if (!lastUserText?.trim()) return 'opening';
  if (hasClarificationSignal(lastUserText)) return 'clarify';
  if (hasPolarityConflict(previousUserText, lastUserText)) return 'correction';

  const words = countWords(lastUserText);
  const authority = hasLegalAuthoritySignal(lastUserText);
  const vague = hasVaguenessSignal(lastUserText);
  const structured = hasStructuredAnswerSignal(lastUserText);
  const detailRequested = assistantRequestedDetail(previousAssistantText);

  if (words > 110 && !authority && !structured && !detailRequested) return 'interruption-trim';
  if (words > 140 && authority && structured && !vague) return 'probe';
  if (!authority || vague) return 'authority-demand';
  if (assistantTurnCount > 0 && assistantTurnCount % 4 === 0) return 'pivot';
  if (trailingSamePanelist >= 2) return 'handoff';
  return 'probe';
}

function chooseFeedbackStyle(feedbackMode: string, turnMode: ExaminerTurnMode, assistantTurnCount: number): 'none' | 'brief' | 'critical' {
  if (turnMode === 'correction' || turnMode === 'authority-demand' || turnMode === 'interruption-trim') {
    return 'critical';
  }
  if (feedbackMode !== 'per-exchange') return 'none';
  return assistantTurnCount % 2 === 0 ? 'brief' : 'none';
}

function pickSpecialistPanelistIndex(activePanelists: typeof PANELISTS, lastUserText: string, fallbackIndex: number): number {
  const lower = (lastUserText || '').toLowerCase();
  const preferredId =
    /(constitution|article|rights|judicial review|injunction|jurisdiction|probate)/.test(lower) ? 'justice-mwangi'
    : /(cross examination|objection|trial|plea|criminal|commercial|procedure|summons)/.test(lower) ? 'advocate-amara'
    : /(policy|ethics|drafting|theory|rationale|professional)/.test(lower) ? 'prof-otieno'
    : null;

  if (!preferredId) return fallbackIndex;
  const idx = activePanelists.findIndex(p => p.id === preferredId);
  return idx >= 0 ? idx : fallbackIndex;
}

function getPanelistDisplayName(panelistId?: string): string {
  if (!panelistId) return 'my colleague';
  return PANELISTS.find(p => p.id === panelistId)?.name || 'my colleague';
}

function getPreviousAssistantTurn(messages: any[]): { panelistId?: string; content: string } | null {
  const lastAssistant = [...messages].reverse().find((m: any) => m.role === 'assistant');
  if (!lastAssistant) return null;
  return {
    panelistId: lastAssistant.panelistId,
    content: lastAssistant.content || '',
  };
}

function chooseConversationAct(params: {
  turnMode: ExaminerTurnMode;
  isCrossPanelHandover: boolean;
  examRemaining: number;
  assistantTurnCount: number;
}): ConversationAct {
  const { turnMode, isCrossPanelHandover, examRemaining, assistantTurnCount } = params;
  if (examRemaining <= 2) return 'closeout';
  if (assistantTurnCount === 0) return 'launch';
  if (turnMode === 'clarify' || turnMode === 'correction' || turnMode === 'authority-demand' || turnMode === 'interruption-trim') return 'repair';
  if (turnMode === 'pivot') return 'pivot-scenario';
  if (isCrossPanelHandover) return 'bridge-probe';
  return 'pressure-test';
}

function buildHandoverDirective(params: {
  isCrossPanelHandover: boolean;
  previousPanelistName: string;
  previousPanelistPoint: string;
  conversationAct: ConversationAct;
}): string {
  const { isCrossPanelHandover, previousPanelistName, previousPanelistPoint, conversationAct } = params;
  if (!isCrossPanelHandover) {
    return `FLOW STYLE: Keep natural spoken rhythm. Use one core question, optional one-line challenge, then stop.`;
  }

  return `HANDOVER — TOPIC CONTINUITY MANDATORY:
${previousPanelistName} was examining: "${previousPanelistPoint}".
You MUST continue examining the SAME legal issue from YOUR unique perspective. Do NOT switch to a different topic or your own default specialty question.
Start with a brief spoken bridge (6-14 words) linking to what was just discussed, then ask one focused question that deepens or challenges the student on THIS SAME issue from your angle.
CURRENT ACT: ${conversationAct}.`;
}

/* ================================================================
   POST — Handle oral exam conversation
   ================================================================ */
async function handlePost(req: NextRequest, user: AuthUser): Promise<Response> {
  try {
    const body = await req.json();
    const {
      type,           // 'devils-advocate' | 'examiner'
      mode = 'balanced',
      messages = [],  // conversation history [{role, content, panelistId?}]
      unitId,         // optional unit filter
      feedbackMode = 'end', // 'per-exchange' | 'end'
      panelistCount = 3,
      currentPanelistIndex = 0,
      generateSummary = false,
      stream = false, // Enable SSE streaming
      elapsedMinutes = 0,     // current session elapsed time
      sessionMaxMinutes = 15, // session duration limit
    } = body;

    // ── Subscription gate: check access on NEW sessions (no messages yet) ──
    if (messages.length === 0 && !generateSummary) {
      const feature = type === 'devils-advocate' ? 'oral_devil' : 'oral_exam';
      const sub = await getSubscriptionInfo(user.id);
      if (!sub.canAccess(feature as any)) {
        const limitLabel = type === 'devils-advocate' ? "Devil's Advocate" : 'Oral Exam';
        const fu = sub.featureUsage[feature as keyof typeof sub.featureUsage];
        return NextResponse.json({
          error: 'FEATURE_LIMIT',
          message: sub.trialExpired
            ? `Your free trial has ended. Subscribe to continue using ${limitLabel} sessions.`
            : `You've used ${fu?.used ?? 0}/${fu?.limit ?? 0} ${limitLabel} sessions this week. Upgrade or buy an add-on pass.`,
          upgradeUrl: '/subscribe',
          feature,
          tier: sub.tier,
        }, { status: 403 });
      }
      // Increment usage for ALL users (trial and paid) at session start
      await incrementFeatureUsage(user.id, feature as any);
    }

    // Build unit context
    let unitContext = 'Covering all 9 ATP units of the Kenya School of Law curriculum.';
    if (unitId) {
      const unit = ATP_UNITS.find(u => u.id === unitId);
      if (unit) {
        unitContext = `Examining the student on ${unit.code}: ${unit.name} — ${unit.description}. Key statutes: ${unit.statutes.join(', ')}.`;
      }
    }

    // Summary generation at end of session
    if (generateSummary) {
      const examinerCount = messages.filter((m: any) => m.role === 'assistant').length;
      const studentCount = messages.filter((m: any) => m.role === 'user').length;

      const summaryPrompt = `You are a senior legal examiner producing the official session report for a Kenya School of Law oral examination.

THE SESSION: ${type === 'devils-advocate' ? "Devil's Advocate debate" : 'Oral examination panel'} with ${examinerCount} examiner turns and ${studentCount} student responses.

INSTRUCTIONS — PRODUCE A STRUCTURED REPORT:

Start with the score line EXACTLY like this (mandatory format):
"Overall Performance Score: [NUMBER]/100"

Then provide these sections:

STRENGTHS
- List 2-4 specific things the student did well. Quote what they actually said or did. Be concrete.

WEAKNESSES
- List 2-4 specific areas where the student struggled. Reference actual moments from the conversation.

KNOWLEDGE GAPS
- List specific topics, provisions, cases, or rules the student either got wrong, missed, or couldn't cite when asked.

CASES & PROVISIONS TO STUDY
- List 3-5 specific statutes (with section numbers), cases, or constitutional articles the student should review based on gaps revealed in this session.

EXAM READINESS
- One paragraph assessing how prepared they are for the actual ATP oral examination. Be honest and direct.

RECOMMENDED STUDY FOCUS
- Top 3 specific areas to prioritize before the next session.

RULES:
1. The score line "Overall Performance Score: [NUMBER]/100" MUST appear in the first line. This is non-negotiable.
2. Be specific — reference actual moments from the conversation, not generic advice.
3. Keep language natural and conversational since this will be read aloud.
4. Do not use markdown formatting, bullet symbols, or asterisks. Use plain text with line breaks.
5. Keep the entire report under 600 words.`;

      const summaryMessages = [
        { role: 'system' as const, content: summaryPrompt },
        ...messages.map((m: any) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
        { role: 'user' as const, content: 'The session has ended. Please produce my comprehensive performance report with score.' },
      ];

      const completion = await openai.chat.completions.create({
        model: MINI_MODEL,
        messages: summaryMessages,
        max_completion_tokens: 3000,
      });

      const summaryContent = completion.choices[0]?.message?.content || 'Unable to generate summary.';

      return NextResponse.json({
        type: 'summary',
        content: summaryContent,
        score: extractScore(summaryContent),
      });
    }

    if (type === 'devils-advocate') {
      // ----- DEVIL'S ADVOCATE -----
      const systemPrompt = buildDevilsAdvocatePrompt(mode, unitContext, feedbackMode);
      const apiMessages = [
        { role: 'system' as const, content: systemPrompt },
        ...messages.map((m: any) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      ];
      const previousAssistantText = [...messages].reverse().find((m: any) => m.role === 'assistant')?.content || '';
      const lastUserText = [...messages].reverse().find((m: any) => m.role === 'user')?.content || '';

      // Inject anti-repetition tracking — ALL questions asked so far
      const questionsAsked = buildQuestionsAskedSummary(messages);
      if (questionsAsked) {
        apiMessages.push({ role: 'system' as const, content: questionsAsked });
      }

      // Inject student performance pattern
      const perfContext = buildStudentPerformanceContext(messages);
      if (perfContext) {
        apiMessages.push({ role: 'system' as const, content: perfContext });
      }

      // Inject session timing context
      const remaining = Math.max(0, sessionMaxMinutes - elapsedMinutes);
      const phaseCtx = elapsedMinutes < 2
        ? '[SESSION PHASE: OPENING. Start with a brief welcome line, then ask a precise first question tied to the chosen unit.]'
        : remaining <= 2
        ? '[SESSION PHASE: CLOSING. Begin wrap-up naturally: one final challenge, then a concise conclusion.]'
        : '[SESSION PHASE: DEEP DIVE. Probe the student answer with follow-ups and escalating difficulty.]';
      apiMessages.push({ role: 'system' as const, content: phaseCtx });

      if (elapsedMinutes > 0 && messages.length > 0) {
        const timeCtx = remaining <= 0
          ? `[SESSION TIME IS UP. You MUST end the session now. Say something like: "Time's up, Counsel. That concludes our debate. Let me generate your session summary." Do NOT ask any new questions.]`
          : remaining <= 2
          ? `[SESSION TIMING: ${Math.round(elapsedMinutes)} minutes elapsed, ~${Math.round(remaining)} minutes remaining. Begin wrapping up — ask one final question or make a closing challenge.]`
          : `[SESSION TIMING: ${Math.round(elapsedMinutes)} minutes elapsed, ~${Math.round(remaining)} minutes remaining.]`;
        apiMessages.push({ role: 'system' as const, content: timeCtx });
      }

      // Determine response length hint — biased toward SHORT punchy responses
      // Devil's advocate should jab, not lecture
      // But opening turns and scenario proposals need more room
      const isOpening = messages.length === 0;
      const isScenarioRequest = messages.length > 0 && isMetaRequest(lastUserText);
      const lengthRoll = Math.random();
      // Floor raised from 120→220 — 120 tokens caused constant truncation which triggered fallbacks
      const maxTokens = (isOpening || isScenarioRequest) ? 450
        : lengthRoll < 0.45 ? 220 : lengthRoll < 0.80 ? 300 : 450;

      // If no messages, generate opening challenge with a concrete scenario
      if (messages.length === 0) {
        apiMessages.push({
          role: 'user' as const,
          content: `I'm ready for the Devil's Advocate challenge${unitId ? ` on ${ATP_UNITS.find(u => u.id === unitId)?.name || 'this topic'}` : ''}. Present me with a concrete legal hypothetical — give me specific facts and ask me to take a position. Then challenge whatever I say.`,
        });
      }

      if (stream) {
        // STREAMING mode
        const streamResponse = await openai.chat.completions.create({
          model: MINI_MODEL,
          messages: apiMessages,
          max_completion_tokens: maxTokens,
          stream: true,
        });

        const encoder = new TextEncoder();
        const readable = new ReadableStream({
          async start(controller) {
            try {
              // Send initial metadata
              const remaining = Math.max(0, sessionMaxMinutes - elapsedMinutes);
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                type: 'metadata',
                examType: 'devils-advocate',
                voice: 'onyx',
                sessionEnded: remaining <= 0,
              })}\n\n`));

              let fullContent = '';
              for await (const chunk of streamResponse) {
                const content = chunk.choices[0]?.delta?.content || '';
                if (content) {
                  fullContent += content;
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                    type: 'chunk',
                    content,
                  })}\n\n`));
                }
              }

              // Send final complete message
              const cleanedContent = stripSpeakerPrefix(fullContent, 'Devil\'s Advocate');
              const finalContent = isLowQualityDevilsTurn(cleanedContent, previousAssistantText)
                ? buildDevilsContinuityFallback(lastUserText, unitId)
                : cleanedContent;
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                type: 'done',
                fullContent: finalContent,
              })}\n\n`));

              controller.close();
            } catch (error) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                type: 'error',
                error: 'Stream failed',
              })}\n\n`));
              controller.close();
            }
          },
        });

        return new Response(readable, {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
          },
        });
      } else {
        // NON-STREAMING mode (existing)
        const completion = await openai.chat.completions.create({
          model: MINI_MODEL,
          messages: apiMessages,
          max_completion_tokens: maxTokens,
        });

        const response = completion.choices[0]?.message?.content || buildDevilsContinuityFallback(lastUserText, unitId);
        const cleanedResponse = stripSpeakerPrefix(response, 'Devil\'s Advocate');
        const finalResponse = isLowQualityDevilsTurn(cleanedResponse, previousAssistantText)
          ? buildDevilsContinuityFallback(lastUserText, unitId)
          : cleanedResponse;

        return NextResponse.json({
          type: 'devils-advocate',
          content: finalResponse,
          voice: 'onyx',
          sessionEnded: remaining <= 0,
        });
      }

    } else if (type === 'examiner') {
      // ----- ORAL EXAMINER PANEL -----
      const activePanelists = PANELISTS.slice(0, Math.min(panelistCount, 3));
      const currentPanelist = activePanelists[currentPanelistIndex % activePanelists.length];
      const otherNames = activePanelists.filter(p => p.id !== currentPanelist.id).map(p => p.name);

      const systemPrompt = buildExaminerPrompt(currentPanelist, mode, unitContext, feedbackMode, otherNames, true);
      const apiMessages = [
        { role: 'system' as const, content: systemPrompt },
        ...messages.map((m: any) => {
          if (m.role === 'assistant') {
            const speaker = m.panelistId || 'examiner';
            return { role: 'assistant' as const, content: `[From ${speaker}] ${m.content}` };
          }
          return { role: 'user' as const, content: m.content };
        }),
      ];

      const previousAssistantText = [...messages].reverse().find((m: any) => m.role === 'assistant')?.content || '';
      const lastUserText = [...messages].reverse().find((m: any) => m.role === 'user')?.content || '';
      const previousUserText = [...messages]
        .filter((m: any) => m.role === 'user')
        .slice(-2, -1)[0]?.content || '';
      const previousAssistantTurn = getPreviousAssistantTurn(messages);
      const previousPanelistName = getPanelistDisplayName(previousAssistantTurn?.panelistId);
      const isCrossPanelHandover = Boolean(
        previousAssistantTurn?.panelistId && previousAssistantTurn.panelistId !== currentPanelist.id
      );
      const previousPanelistPoint = summarizeForPrompt(previousAssistantTurn?.content || '', 10);
      const assistantTurnCount = messages.filter((m: any) => m.role === 'assistant').length;
      const trailingSamePanelist = getTrailingPanelistStreak(messages, currentPanelist.id);
      const turnMode = chooseExaminerTurnMode({
        lastUserText,
        previousUserText,
        previousAssistantText,
        assistantTurnCount,
        trailingSamePanelist,
      });
      const feedbackStyle = chooseFeedbackStyle(feedbackMode, turnMode, assistantTurnCount);
      const examRemaining = Math.max(0, sessionMaxMinutes - elapsedMinutes);
      const conversationAct = chooseConversationAct({
        turnMode,
        isCrossPanelHandover,
        examRemaining,
        assistantTurnCount,
      });

      apiMessages.push({
        role: 'system' as const,
        content: `REALISM DIRECTIVE: Current turn mode is "${turnMode}". Behave like a live panel, not a checklist bot. One core question per turn. If correcting, do it directly in one line and demand authority. If clarifying, restate tightly and continue. If probing, escalate difficulty with a concrete fact twist. If pivoting, link to prior answer then shift to adjacent issue.`
      });
      apiMessages.push({
        role: 'system' as const,
        content: `CONVERSATION ACT: ${conversationAct}. Keep spoken cadence natural: short bridge -> targeted challenge -> stop. Avoid stacked multi-question dumps.`
      });
      apiMessages.push({
        role: 'system' as const,
        content: buildHandoverDirective({
          isCrossPanelHandover,
          previousPanelistName,
          previousPanelistPoint,
          conversationAct,
        })
      });
      apiMessages.push({
        role: 'system' as const,
        content: feedbackStyle === 'none'
          ? 'FEEDBACK CADENCE: Do not add routine feedback on this turn. Move straight into substantive questioning unless you must correct a clear inaccuracy.'
          : feedbackStyle === 'brief'
          ? 'FEEDBACK CADENCE: Give at most one short feedback sentence, then ask one focused question.'
          : 'FEEDBACK CADENCE: Give one direct corrective sentence (identify the defect: inaccuracy, contradiction, or lack of authority), then ask a precise recovery question.'
      });

      if (lastUserText) {
        apiMessages.push({
          role: 'system' as const,
          content: `CONTINUITY REQUIREMENT: The student's latest answer was: "${summarizeForPrompt(lastUserText, 30)}". Your next turn MUST explicitly engage THAT answer — correct it, deepen it, or challenge it. Stay on the SAME legal topic. Do not restart with a generic opening or switch to an unrelated area.`
        });
      }

      const recentPanelTurns = [...messages]
        .filter((m: any) => m.role === 'assistant')
        .slice(-3)
        .map((m: any) => `- ${m.panelistId || 'examiner'} asked: "${summarizeForPrompt(m.content || '', 18)}"`)
        .join('\n');
      if (recentPanelTurns) {
        apiMessages.push({
          role: 'system' as const,
          content: `Recent panel context:\n${recentPanelTurns}\nReference this context where relevant and avoid asking disconnected questions.`
        });
      }

      // Inject FULL anti-repetition tracking — ALL questions asked in this session
      const questionsAsked = buildQuestionsAskedSummary(messages);
      if (questionsAsked) {
        apiMessages.push({ role: 'system' as const, content: questionsAsked });
      }

      // Inject student performance pattern for targeted questioning
      const perfContext = buildStudentPerformanceContext(messages);
      if (perfContext) {
        apiMessages.push({ role: 'system' as const, content: perfContext });
      }

      // Inject session timing context
      const examPhaseCtx = elapsedMinutes < 2
        ? '[SESSION PHASE: OPENING. Brief welcome, then one concrete exam question with a clearly named legal issue.]'
        : examRemaining <= 2
        ? '[SESSION PHASE: CLOSING. Ask one final concise question, then close the session naturally.]'
        : '[SESSION PHASE: DEEP DIVE. Continue probing student reasoning with targeted follow-ups.]';
      apiMessages.push({ role: 'system' as const, content: examPhaseCtx });

      if (elapsedMinutes > 0 && messages.length > 0) {
        const timeCtx = examRemaining <= 0
          ? `[SESSION TIME IS UP. End the session now. Say: "${currentPanelist.name}: Thank you, Counsel. That concludes today's examination." Do NOT ask new questions.]`
          : examRemaining <= 2
          ? `[SESSION TIMING: ${Math.round(elapsedMinutes)} minutes elapsed, ~${Math.round(examRemaining)} minutes remaining. Ask one final question and prepare to close.]`
          : `[SESSION TIMING: ${Math.round(elapsedMinutes)} minutes elapsed, ~${Math.round(examRemaining)} minutes remaining.]`;
        apiMessages.push({ role: 'system' as const, content: timeCtx });
      }

      // Vary response budget based on turn mode for realism + cost control
      // Floors raised — previous limits (180-260) caused truncation that triggered fallbacks
      const examMaxTokens = turnMode === 'interruption-trim'
        ? 220
        : turnMode === 'clarify'
        ? 280
        : turnMode === 'correction' || turnMode === 'authority-demand'
        ? 320
        : turnMode === 'pivot' || turnMode === 'handoff'
        ? 350
        : isCrossPanelHandover
        ? 320
        : 300;

      // Opening question if no messages
      if (messages.length === 0) {
        apiMessages.push({
          role: 'user' as const,
          content: `I'm ready for my oral examination${unitId ? ` on ${ATP_UNITS.find(u => u.id === unitId)?.name || 'this topic'}` : ''}. Begin with a specific, concrete legal question. Do not use vague wording like "first principle".`,
        });
      }

      // Determine next panelist using adaptive realism rules
      const shouldPivotTopic = turnMode === 'pivot';
      const shouldStayWithCurrent = turnMode === 'clarify' || turnMode === 'correction' || turnMode === 'authority-demand' || turnMode === 'interruption-trim';
      const baselineRotateIndex = (currentPanelistIndex + 1) % activePanelists.length;
      const specialistRotateIndex = pickSpecialistPanelistIndex(activePanelists, lastUserText, baselineRotateIndex);
      const nextPanelistIndex = shouldStayWithCurrent && trailingSamePanelist < 2
        ? currentPanelistIndex
        : specialistRotateIndex;

      if (shouldPivotTopic) {
        apiMessages.push({
          role: 'system' as const,
          content: `PROGRESSION REQUIREMENT: Pivot to a NEW adjacent angle now. Do not stay on the exact same sub-question thread. Keep continuity, then shift to a fresh, concrete issue within the same unit.`
        });
      }

      if (stream) {
        // STREAMING mode
        const streamResponse = await openai.chat.completions.create({
          model: MINI_MODEL,
          messages: apiMessages,
          max_completion_tokens: examMaxTokens,
          stream: true,
        });

        const encoder = new TextEncoder();
        const readable = new ReadableStream({
          async start(controller) {
            try {
              // Send initial metadata with panelist info
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                type: 'metadata',
                examType: 'examiner',
                panelist: {
                  id: currentPanelist.id,
                  name: currentPanelist.name,
                  title: currentPanelist.title,
                  avatar: currentPanelist.avatar,
                  voice: currentPanelist.voice,
                },
                nextPanelistIndex,
                sessionEnded: examRemaining <= 0,
              })}\n\n`));

              let fullContent = '';
              for await (const chunk of streamResponse) {
                const content = chunk.choices[0]?.delta?.content || '';
                if (content) {
                  fullContent += content;
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                    type: 'chunk',
                    content,
                  })}\n\n`));
                }
              }

              // Send final complete message
              const cleanedContent = stripSpeakerPrefix(fullContent, currentPanelist.name);
              const finalContent = isLowQualityExaminerTurn(cleanedContent, previousAssistantText)
                ? (shouldPivotTopic
                    ? buildPivotQuestion(currentPanelist, unitId)
                    : buildContinuityFallbackQuestion(currentPanelist, lastUserText, previousAssistantText, unitId))
                : cleanedContent;
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                type: 'done',
                fullContent: finalContent,
              })}\n\n`));

              controller.close();
            } catch (error) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                type: 'error',
                error: 'Stream failed',
              })}\n\n`));
              controller.close();
            }
          },
        });

        return new Response(readable, {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
          },
        });
      } else {
        // NON-STREAMING mode (existing)
        const completion = await openai.chat.completions.create({
          model: MINI_MODEL,
          messages: apiMessages,
          max_completion_tokens: examMaxTokens,
        });

        const response = completion.choices[0]?.message?.content || buildContextualFallbackQuestion(currentPanelist, messages, unitId);
        const cleanedResponse = stripSpeakerPrefix(response, currentPanelist.name);
        const finalResponse = messages.length === 0
          ? (isLowQualityExaminerTurn(cleanedResponse, previousAssistantText)
              ? buildContextualOpeningQuestion(currentPanelist, unitId)
              : cleanedResponse)
          : (isLowQualityExaminerTurn(cleanedResponse, previousAssistantText)
              ? (shouldPivotTopic
                  ? buildPivotQuestion(currentPanelist, unitId)
                  : buildContinuityFallbackQuestion(currentPanelist, lastUserText, previousAssistantText, unitId))
              : cleanedResponse);

        return NextResponse.json({
          type: 'examiner',
          content: finalResponse,
          panelist: {
            id: currentPanelist.id,
            name: currentPanelist.name,
            title: currentPanelist.title,
            avatar: currentPanelist.avatar,
            voice: currentPanelist.voice,
          },
          nextPanelistIndex,
          sessionEnded: examRemaining <= 0,
        });
      }
    }

    return NextResponse.json({ error: 'Invalid type. Use "devils-advocate" or "examiner".' }, { status: 400 });
  } catch (error: any) {
    console.error('Oral exam error:', error?.message || error, error?.status, error?.code);
    // Surface real error so the client can display something useful
    const msg = error?.message || 'Unknown server error';
    const isRateLimit = error?.status === 429 || error?.code === 'rate_limit_exceeded';
    const isTimeout = msg.includes('timeout') || msg.includes('ETIMEDOUT') || error?.code === 'ETIMEDOUT';
    const isModelErr = error?.code === 'model_not_found' || msg.includes('does not exist');
    const friendlyMsg = isRateLimit
      ? 'AI is momentarily busy — please wait a few seconds and try again.'
      : isTimeout
      ? 'The AI took too long to respond. Please try again.'
      : isModelErr
      ? 'AI model configuration error — please contact support.'
      : `AI error: ${msg.slice(0, 120)}`;
    return NextResponse.json({ error: friendlyMsg, code: error?.code || 'unknown', raw: msg.slice(0, 200) }, { status: isRateLimit ? 429 : 500 });
  }
}

/* ================================================================
   HELPERS
   ================================================================ */

/** Build a concise summary of ALL questions asked so far to prevent repetition */
function buildQuestionsAskedSummary(messages: any[]): string {
  const assistantTurns = messages
    .filter((m: any) => m.role === 'assistant' && m.content?.trim())
    .map((m: any, i: number) => {
      const speaker = m.panelistId ? getPanelistDisplayName(m.panelistId) : 'Examiner';
      return `${i + 1}. [${speaker}]: ${summarizeForPrompt(m.content, 20)}`;
    });

  if (assistantTurns.length === 0) return '';
  return `QUESTIONS ALREADY ASKED (DO NOT REPEAT OR REPHRASE ANY OF THESE):\n${assistantTurns.join('\n')}`;
}

/** Build a summary of the student's performance patterns across the session */
function buildStudentPerformanceContext(messages: any[]): string {
  const userTurns = messages.filter((m: any) => m.role === 'user' && m.content?.trim());
  if (userTurns.length === 0) return '';

  const strongPoints: string[] = [];
  const weakPoints: string[] = [];

  for (const turn of userTurns) {
    const text = turn.content || '';
    if (hasLegalAuthoritySignal(text) && hasStructuredAnswerSignal(text)) {
      strongPoints.push(summarizeForPrompt(text, 12));
    } else if (hasVaguenessSignal(text) || countWords(text) < 15) {
      weakPoints.push(summarizeForPrompt(text, 12));
    }
  }

  const parts: string[] = [];
  if (strongPoints.length > 0) {
    parts.push(`Student showed strength on: ${strongPoints.slice(-3).join('; ')}`);
  }
  if (weakPoints.length > 0) {
    parts.push(`Student was weak/vague on: ${weakPoints.slice(-3).join('; ')} — PRESS HARDER on these areas`);
  }
  if (parts.length === 0) return '';
  return `STUDENT PERFORMANCE PATTERN:\n${parts.join('\n')}`;
}

function extractScore(text: string): number | null {
  // Try structured patterns first
  const patterns = [
    /(?:overall\s+)?(?:performance\s+)?score\s*[:=]\s*(\d{1,3})\s*(?:\/\s*100|out\s+of\s+100)?/i,
    /(\d{1,3})\s*(?:out of|\/)\s*100/i,
    /(\d{1,3})\s*%/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const score = parseInt(match[1], 10);
      if (score >= 0 && score <= 100) return score;
    }
  }
  return null;
}

export const POST = withAuth(handlePost);
