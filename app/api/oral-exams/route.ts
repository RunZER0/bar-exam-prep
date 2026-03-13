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
    voice: 'onyx' as const,
    style: 'Formal, measured, authoritative. Probes constitutional foundations and procedural correctness. Expects precision in statutory citations.',
    avatar: '⚖️',
    specialties: ['Civil Litigation', 'Constitutional Law', 'Probate and Administration'],
  },
  {
    id: 'advocate-amara',
    name: 'Advocate Amara',
    title: 'Senior Litigation Counsel',
    voice: 'nova' as const,
    style: 'Sharp, rapid-fire, practical. Focuses on courtroom strategy, cross-examination technique, and real-world application. Interrupts when answers are vague.',
    avatar: '🔥',
    specialties: ['Criminal Litigation', 'Trial Advocacy', 'Commercial Transactions'],
  },
  {
    id: 'prof-otieno',
    name: 'Prof. Otieno',
    title: 'Professor of Law, University of Nairobi',
    voice: 'echo' as const,
    style: 'Academic, Socratic, theoretical. Pushes for deeper analysis, policy rationale, and comparative perspectives. Asks follow-up questions that build on answers.',
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

  return `You are the DEVIL'S ADVOCATE — an AI legal debate opponent for Kenya School of Law ATP students preparing for bar exams.

YOUR ROLE: Take the opposing position on every legal issue. Challenge the student's reasoning. Force them to defend their positions with authority (statute, case law, constitutional provisions). Identify logical fallacies and weak arguments.

${modeInstructions}

CONTEXT: ${unitContext}

SESSION STRUCTURE:
- Sessions last approximately 15 minutes. Pace yourself accordingly.
- You will be told the elapsed time and remaining time in the session.
- When the session time is nearly up (final 2 minutes), begin wrapping up naturally: "Let me put one final challenge to you..." or "Before we close, I want to test one last point..."
- When time is completely up, end the session gracefully: "Time's up, Counsel. That concludes our debate."

RESPONSE LENGTH — CRITICAL:
- Vary your response lengths significantly to keep the debate dynamic and realistic.
- About 30% of responses should be SHORT (1-2 sentences): quick challenges, pushbacks, or sharp questions. Examples: "Under which specific section?", "That's wrong. The Court of Appeal held otherwise in Mwangi v Republic.", "So you're saying Section 63 doesn't apply here? Defend that."
- About 40% should be MEDIUM (3-5 sentences): standard rebuttals with a counter-argument and a follow-up question.
- About 30% should be LONGER (6-8 sentences): detailed counter-arguments with case citations when making a substantive legal point.
- NEVER give consistently long responses. Real debate has rhythm — quick jabs followed by developed arguments.

RULES:
1. Always take the contrary position, even if the student is correct — force them to prove it.
2. Cite counter-authority when challenging (cases, statutory provisions, constitutional articles).
3. Ask pointed questions: "Under which provision?", "What did the court say in...?", "How do you reconcile that with...?"
4. Stay within Kenyan law context. Reference actual Kenyan cases, statutes, and the 2010 Constitution.
5. If the student makes a strong point, shift to a related but harder angle rather than conceding too easily.
6. Keep responses conversational — this is a spoken debate, not a written essay.

${feedbackInstructions}

IMPORTANT: Your responses will be read aloud via TTS. Keep language natural and spoken. Avoid formatting like bullet points or asterisks. Use short paragraphs.`;
}

/* ================================================================
   ORAL EXAMINER — System Prompt Builder (per panelist)
   ================================================================ */
function buildExaminerPrompt(panelist: typeof PANELISTS[0], mode: string, unitContext: string, feedbackMode: string, otherPanelists: string[], enableInterruptions: boolean = true) {
  const modeInstructions = getModeInstructions(mode);
  const feedbackInstructions = feedbackMode === 'per-exchange'
    ? `After the student answers, briefly assess their response (1-2 sentences) before asking your next question. Note: "Strong cite of Section X" or "You missed the key authority here".`
    : `Do NOT provide assessment during the session. Only ask questions and probe answers.`;

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

YOUR SPECIALIZATIONS: ${panelist.specialties.join(', ')}

${modeInstructions}

CONTEXT: ${unitContext}

OTHER PANELISTS: ${otherPanelists.join(', ')}

EXAMINATION GUIDELINES:
1. Ask focused, exam-style questions that test both knowledge and application.
2. Build on previous answers — if the student mentioned a case, dig deeper into it.
3. Occasionally reference what another panelist asked: "Following up on ${otherPanelists[0] || 'my colleague'}'s question..."
4. You may interject if the student contradicts something they said earlier.
5. Ask practical scenario questions: "A client walks into your office and..."
6. Test statutory recall: "Under which specific section...?"
7. Keep questions conversational — this is a spoken exam.
8. CRITICAL — Vary response length to simulate a real exam panel:
   - ~30% SHORT (1-2 sentences): Quick follow-ups, redirections, or pointed questions.
   - ~40% MEDIUM (3-4 sentences): Standard questioning with brief context.
   - ~30% LONGER (5-7 sentences): Scenario-based questions or detailed probing.
   Never give uniformly long responses.

SESSION TIMING:
- Sessions last approximately 15 minutes.
- When time is nearly up (final 2 minutes), wrap up naturally: "${panelist.name}: We have time for one final question..."
- When time is completely up, close the session: "${panelist.name}: Thank you, Counsel. That will be all for today."
${interruptionInstructions}

${feedbackInstructions}

IMPORTANT: Responses will be read aloud via TTS. Be natural and conversational. No bullet points or markdown. Use short paragraphs. Prefix your response with your name like this: "${panelist.name}: [your question/comment]"`;
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
      const summaryPrompt = `You are an expert legal examiner reviewing an oral examination session. Analyze the entire conversation and provide a comprehensive assessment.

PROVIDE:
1. Overall Performance Score (out of 100)
2. Strengths — What the student did well
3. Weaknesses — Areas needing improvement  
4. Knowledge Gaps — Specific topics/provisions they missed or got wrong
5. Cases & Provisions They Should Study — Specific statutory sections and case law they need to review
6. Exam Readiness Assessment — How prepared are they for the actual oral exam?
7. Recommended Study Focus — Top 3 areas to prioritize

Be specific and reference actual moments from the conversation. Keep it conversational since this will be read aloud.`;

      const summaryMessages = [
        { role: 'system' as const, content: summaryPrompt },
        ...messages.map((m: any) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
        { role: 'user' as const, content: 'Please provide my comprehensive session summary and feedback.' },
      ];

      const completion = await openai.chat.completions.create({
        model: MINI_MODEL,
        messages: summaryMessages,
        max_completion_tokens: 2000,
      });

      return NextResponse.json({
        type: 'summary',
        content: completion.choices[0]?.message?.content || 'Unable to generate summary.',
        score: extractScore(completion.choices[0]?.message?.content || ''),
      });
    }

    if (type === 'devils-advocate') {
      // ----- DEVIL'S ADVOCATE -----
      const systemPrompt = buildDevilsAdvocatePrompt(mode, unitContext, feedbackMode);
      const apiMessages = [
        { role: 'system' as const, content: systemPrompt },
        ...messages.map((m: any) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      ];

      // Inject session timing context
      const remaining = Math.max(0, sessionMaxMinutes - elapsedMinutes);
      if (elapsedMinutes > 0 && messages.length > 0) {
        const timeCtx = remaining <= 0
          ? `[SESSION TIME IS UP. You MUST end the session now. Say something like: "Time's up, Counsel. That concludes our debate. Let me generate your session summary." Do NOT ask any new questions.]`
          : remaining <= 2
          ? `[SESSION TIMING: ${Math.round(elapsedMinutes)} minutes elapsed, ~${Math.round(remaining)} minutes remaining. Begin wrapping up — ask one final question or make a closing challenge.]`
          : `[SESSION TIMING: ${Math.round(elapsedMinutes)} minutes elapsed, ~${Math.round(remaining)} minutes remaining.]`;
        apiMessages.push({ role: 'system' as const, content: timeCtx });
      }

      // Determine response length hint — randomize to encourage variety
      const lengthRoll = Math.random();
      const maxTokens = lengthRoll < 0.3 ? 150 : lengthRoll < 0.7 ? 400 : 700;

      // If no messages, generate opening challenge
      if (messages.length === 0) {
        apiMessages.push({
          role: 'user' as const,
          content: `I'm ready for the Devil's Advocate challenge${unitId ? ` on ${ATP_UNITS.find(u => u.id === unitId)?.name || 'this topic'}` : ''}. Start the debate.`,
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
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                type: 'done',
                fullContent,
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

        const response = completion.choices[0]?.message?.content || 'I challenge you to state your position.';

        return NextResponse.json({
          type: 'devils-advocate',
          content: response,
          voice: 'onyx',
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
        ...messages.map((m: any) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      ];

      // Inject session timing context
      const examRemaining = Math.max(0, sessionMaxMinutes - elapsedMinutes);
      if (elapsedMinutes > 0 && messages.length > 0) {
        const timeCtx = examRemaining <= 0
          ? `[SESSION TIME IS UP. End the session now. Say: "${currentPanelist.name}: Thank you, Counsel. That concludes today's examination." Do NOT ask new questions.]`
          : examRemaining <= 2
          ? `[SESSION TIMING: ${Math.round(elapsedMinutes)} minutes elapsed, ~${Math.round(examRemaining)} minutes remaining. Ask one final question and prepare to close.]`
          : `[SESSION TIMING: ${Math.round(elapsedMinutes)} minutes elapsed, ~${Math.round(examRemaining)} minutes remaining.]`;
        apiMessages.push({ role: 'system' as const, content: timeCtx });
      }

      // Vary response length
      const examLengthRoll = Math.random();
      const examMaxTokens = examLengthRoll < 0.3 ? 120 : examLengthRoll < 0.7 ? 350 : 550;

      // Opening question if no messages
      if (messages.length === 0) {
        apiMessages.push({
          role: 'user' as const,
          content: `I'm ready for my oral examination${unitId ? ` on ${ATP_UNITS.find(u => u.id === unitId)?.name || 'this topic'}` : ''}. Please begin.`,
        });
      }

      // Determine next panelist (round-robin with occasional same-panelist follow-up)
      const shouldFollowUp = Math.random() < 0.3 && messages.length > 0;
      const nextPanelistIndex = shouldFollowUp
        ? currentPanelistIndex
        : (currentPanelistIndex + 1) % activePanelists.length;

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
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                type: 'done',
                fullContent,
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

        const response = completion.choices[0]?.message?.content || `${currentPanelist.name}: Let us begin. State your understanding of the first principle.`;

        return NextResponse.json({
          type: 'examiner',
          content: response,
          panelist: {
            id: currentPanelist.id,
            name: currentPanelist.name,
            title: currentPanelist.title,
            avatar: currentPanelist.avatar,
            voice: currentPanelist.voice,
          },
          nextPanelistIndex,
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
function extractScore(text: string): number | null {
  const match = text.match(/(\d{1,3})\s*(?:out of|\/)\s*100/i);
  return match ? parseInt(match[1], 10) : null;
}

export const POST = withAuth(handlePost);
