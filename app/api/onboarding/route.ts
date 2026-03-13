import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { userProfiles, users, microSkills, witnesses, studyStreaks, userExamProfiles, examCycles, examEvents } from '@/lib/db/schema';
import { masteryState } from '@/lib/db/mastery-schema';
import { and, desc, eq, sql } from 'drizzle-orm';
import { verifyIdToken } from '@/lib/firebase/admin';
import OpenAI from 'openai';
import { z } from 'zod';
import { ORCHESTRATOR_MODEL } from '@/lib/ai/model-config';
import { createDailySessions } from '@/lib/services/session-orchestrator';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ── Schema matches the redesigned onboarding form exactly ──
const OnboardingSchema = z.object({
  fullName: z.string().min(1).max(100),
  currentOccupation: z.string(), // law_student | llb_graduate | paralegal | advocate | career_change
  yearsInLaw: z.number().min(0).max(50),
  llbOrigin: z.enum(['LOCAL', 'FOREIGN']).default('LOCAL'),
  isResit: z.boolean(),
  examPath: z.enum(['APRIL_2026', 'NOVEMBER_2026']),
  previousAttempts: z.number().min(0).max(20).default(0),
  preferredStudyTime: z.string(), // morning | afternoon | evening | night | flexible
  dailyStudyHours: z.number().min(1).max(16),
  weekendStudyHours: z.number().min(0).max(16).default(0),
  commitmentLevel: z.string(), // casual | moderate | intensive
  learningStyle: z.string(), // notes_first | practice_first | case_based | mixed
  confidenceLevel: z.number().min(1).max(10).default(5),
  weakUnits: z.array(z.string()).default([]),
  strongUnits: z.array(z.string()).default([]),
  biggestChallenge: z.string().default(''), // time | focus | understanding | retention | application | motivation
  primaryGoal: z.string().default(''), // pass_first | pass_retake | excel | thorough
  coverageTarget: z.string().default('16_weeks'), // 4_weeks | 8_weeks | 16_weeks | full_calendar
});

// Map occupation → professional exposure 
function deriveExposure(occ: string): 'STUDENT' | 'INTERN' | 'LITIGATION' | 'CORPORATE' | 'ADVOCATE' {
  switch (occ) {
    case 'advocate': return 'ADVOCATE';
    case 'paralegal': return 'INTERN';
    default: return 'STUDENT';
  }
}

// Map commitment → studyPace enum value
function derivePace(commitment: string): 'relaxed' | 'moderate' | 'intensive' {
  switch (commitment) {
    case 'casual': return 'relaxed';
    case 'intensive': return 'intensive';
    default: return 'moderate';
  }
}

async function ensureExamProfile(userId: string, candidateType: 'FIRST_TIME' | 'RESIT') {
  const [existingProfile] = await db.select({
    id: userExamProfiles.id,
    cycleId: userExamProfiles.cycleId,
  }).from(userExamProfiles)
    .where(eq(userExamProfiles.userId, userId))
    .limit(1);

  if (existingProfile) return existingProfile;

  let [cycle] = await db.select({ id: examCycles.id }).from(examCycles)
    .where(and(eq(examCycles.candidateType, candidateType), eq(examCycles.isActive, true)))
    .orderBy(desc(examCycles.year), desc(examCycles.createdAt))
    .limit(1);

  if (!cycle) {
    [cycle] = await db.select({ id: examCycles.id }).from(examCycles)
      .where(eq(examCycles.candidateType, candidateType))
      .orderBy(desc(examCycles.isActive), desc(examCycles.year), desc(examCycles.createdAt))
      .limit(1);
  }

  if (!cycle) {
    throw new Error(`No exam cycle configured for candidate type ${candidateType}`);
  }

  const inserted = await db.insert(userExamProfiles).values({
    userId,
    cycleId: cycle.id,
    timezone: 'Africa/Nairobi',
    autopilotEnabled: false,
  }).onConflictDoNothing().returning({
    id: userExamProfiles.id,
    cycleId: userExamProfiles.cycleId,
  });

  if (inserted.length > 0) return inserted[0];

  const [createdByOtherRequest] = await db.select({
    id: userExamProfiles.id,
    cycleId: userExamProfiles.cycleId,
  }).from(userExamProfiles)
    .where(eq(userExamProfiles.userId, userId))
    .limit(1);

  if (!createdByOtherRequest) {
    throw new Error('Failed to create exam profile');
  }

  return createdByOtherRequest;
}

async function resolveExamDateLabel(candidateType: 'FIRST_TIME' | 'RESIT') {
  try {
    const [cycle] = await db.select({ id: examCycles.id }).from(examCycles)
      .where(and(eq(examCycles.candidateType, candidateType), eq(examCycles.isActive, true)))
      .orderBy(desc(examCycles.year), desc(examCycles.createdAt))
      .limit(1);

    if (!cycle) return candidateType === 'RESIT' ? 'April 9, 2026' : 'November 12, 2026';

    const [written] = await db.select({ startsAt: examEvents.startsAt }).from(examEvents)
      .where(and(eq(examEvents.cycleId, cycle.id), eq(examEvents.eventType, 'WRITTEN')))
      .limit(1);

    if (!written?.startsAt) return candidateType === 'RESIT' ? 'April 9, 2026' : 'November 12, 2026';

    return new Date(written.startsAt).toLocaleDateString('en-KE', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'Africa/Nairobi',
    });
  } catch {
    return candidateType === 'RESIT' ? 'April 9, 2026' : 'November 12, 2026';
  }
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await verifyIdToken(token);
    const firebaseUid = decodedToken.uid;

    // Get DB user (explicit columns to survive missing migration columns)
    const [user] = await db
      .select({
        id: users.id,
        firebaseUid: users.firebaseUid,
        email: users.email,
        displayName: users.displayName,
        role: users.role,
        onboardingCompleted: users.onboardingCompleted,
      })
      .from(users)
      .where(eq(users.firebaseUid, firebaseUid))
      .limit(1);

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const body = await req.json();
    const data = OnboardingSchema.parse(body);

    const professionalExposure = deriveExposure(data.currentOccupation);
    const studyPace = derivePace(data.commitmentLevel);
    const candidateType: 'FIRST_TIME' | 'RESIT' = data.isResit ? 'RESIT' : 'FIRST_TIME';
    const examDateLabel = await resolveExamDateLabel(candidateType);

    // Build the extended snapshot — stored in `goals` jsonb for extra signals
    const snapshot = {
      fullName: data.fullName,
      primaryGoal: data.primaryGoal,
      coverageTarget: data.coverageTarget,
      weekendStudyHours: data.weekendStudyHours,
      confidenceLevel: data.confidenceLevel,
      biggestChallenge: data.biggestChallenge,
      previousAttempts: data.previousAttempts,
      onboardedAt: new Date().toISOString(),
    };

    // 1. Upsert full profile — EVERY form field is persisted
    await db.insert(userProfiles).values({
      userId: user.id,
      currentOccupation: data.currentOccupation,
      yearsOfStudy: data.yearsInLaw,
      studyPace,
      weakAreas: data.weakUnits,
      strongAreas: data.strongUnits,
      preferredStudyTime: data.preferredStudyTime,
      dailyStudyGoal: data.dailyStudyHours * 60, // store as minutes
      learningStyle: data.learningStyle,
      goals: snapshot as unknown as string[],
      // @ts-ignore — text column accepts these string values
      examPath: data.examPath,
      // @ts-ignore
      llbOrigin: data.llbOrigin,
      // @ts-ignore
      professionalExposure,
    }).onConflictDoUpdate({
      target: userProfiles.userId,
      set: {
        currentOccupation: data.currentOccupation,
        yearsOfStudy: data.yearsInLaw,
        studyPace,
        weakAreas: data.weakUnits,
        strongAreas: data.strongUnits,
        preferredStudyTime: data.preferredStudyTime,
        dailyStudyGoal: data.dailyStudyHours * 60,
        learningStyle: data.learningStyle,
        goals: snapshot as unknown as string[],
        // @ts-ignore
        examPath: data.examPath,
        // @ts-ignore
        llbOrigin: data.llbOrigin,
        // @ts-ignore
        professionalExposure,
        updatedAt: new Date(),
      }
    });

    // Ensure exam-track profile exists BEFORE marking onboarding complete.
    await ensureExamProfile(user.id, candidateType);

    // Mark onboarding complete on the user record only after exam profile is guaranteed.
    await db.update(users)
      .set({ onboardingCompleted: true, updatedAt: new Date() })
      .where(eq(users.id, user.id));

    console.log(`[Onboarding] Profile saved for ${user.id} — path: ${data.examPath}, pace: ${studyPace}, weak: [${data.weakUnits}], strong: [${data.strongUnits}], coverage: ${data.coverageTarget}, learning: ${data.learningStyle}`);

    // 2. "Senior Partner" Analysis — uses ALL the form data for a real diagnosis
    const systemPrompt = `
You are the "Senior Partner" at a top Kenyan law firm, mentoring a Bar Exam candidate.

FULL CANDIDATE PROFILE:
- Name: ${data.fullName}
- Path: ${data.examPath} (${data.isResit ? 'RESIT Candidate' : 'First-Time Candidate'})
- Exam Date: ${examDateLabel}
- Occupation: ${data.currentOccupation} (${data.yearsInLaw} years in law)
- LLB Origin: ${data.llbOrigin}
- Previous Attempts: ${data.previousAttempts || 0}
- Commitment: ${data.commitmentLevel} (${data.dailyStudyHours}h/day, ${data.weekendStudyHours}h weekends)
- Coverage Target: ${data.coverageTarget}
- Learning Style: ${data.learningStyle}
- Confidence: ${data.confidenceLevel}/10
- Weak Units: ${data.weakUnits.join(', ') || 'None identified'}
- Strong Units: ${data.strongUnits.join(', ') || 'None identified'}
- Biggest Challenge: ${data.biggestChallenge}
- Primary Goal: ${data.primaryGoal}

TASKS:
1. Analyze their risk profile considering ALL factors above.
2. Generate a "Silent Diagnostic" — a legal scenario for their first session that probes their biggest weakness naturally.
3. Recommend initial witness severity (1.0 – 5.0) for each weak unit.
4. Suggest a study approach tailored to their learning style.

Output valid JSON:
{
  "analysis": "Concise strategic assessment of this candidate (2-3 sentences).",
  "silent_diagnostic_prompt": "A practical legal scenario to test their weak area.",
  "initial_witnesses": [
    { "unit_id": "e.g. atp-100", "topic": "specific topic name", "severity": 3.0, "reason": "why this is critical" }
  ],
  "study_approach": "Tailored recommendation based on their learning style and challenge."
}`;

    let analysis: Record<string, unknown> = {};
    try {
      const aiResponse = await openai.responses.create({
        model: ORCHESTRATOR_MODEL,
        instructions: 'You are the Senior Partner. Respond with valid JSON only.',
        input: systemPrompt,
        text: { format: { type: 'json_object' } },
      });
      analysis = JSON.parse(aiResponse.output_text || '{}');
    } catch (aiErr) {
      console.warn('[Onboarding] AI Senior Partner analysis failed — continuing without it:', aiErr);
    }

    // Store AI analysis as failure_analysis field (repurposed for full analysis)
    if (analysis.analysis) {
      await db.update(userProfiles).set({
        failureAnalysis: typeof analysis.analysis === 'string' ? analysis.analysis : JSON.stringify(analysis),
        updatedAt: new Date(),
      }).where(eq(userProfiles.userId, user.id));
    }

    // 3. Seed Witnesses (Latent Weaknesses from AI)
    if (analysis.initial_witnesses && Array.isArray(analysis.initial_witnesses)) {
      for (const w of analysis.initial_witnesses as Array<{ unit_id?: string; topic?: string; severity?: number }>) {
        try {
          await db.insert(witnesses).values({
            userId: user.id,
            unitId: w.unit_id || 'general',
            topicId: 'initial_seed',
            title: w.topic || 'Initial weakness',
            severityWeight: String(w.severity || 3.0),
            status: 'ACTIVE',
          });
        } catch {
          // Ignore duplicate witness errors
        }
      }
    }

    // 4. Initialize Mastery State baseline — confidence + weak areas affect starting position
    try {
      const allSkills = await db.select().from(microSkills);
      if (allSkills.length > 0) {
        const skillInserts = allSkills.map(skill => {
          let initialMastery = 0.10; // Default: Novice

          // Confidence-based adjustment (higher confidence = slightly higher baseline)
          if (data.confidenceLevel >= 7) initialMastery = 0.15;
          if (data.confidenceLevel >= 9) initialMastery = 0.20;

          // Weak units get LOWER baseline (need more work)
          if (data.weakUnits.some(w => skill.unitId.toLowerCase().includes(w.replace('atp-', 'atp-').toLowerCase()))) {
            initialMastery = Math.max(0.05, initialMastery - 0.05);
          }

          // Strong units get HIGHER baseline (less remediation needed)
          if (data.strongUnits.some(s => skill.unitId.toLowerCase().includes(s.replace('atp-', 'atp-').toLowerCase()))) {
            initialMastery = Math.min(0.30, initialMastery + 0.10);
          }

          // Resit candidates with failed units get critical zone
          if (data.isResit && data.weakUnits.includes(skill.unitId)) {
            initialMastery = 0.05;
          }

          // Foreign LLB penalty for procedure-heavy units
          if (data.llbOrigin === 'FOREIGN' && ['atp-100', 'atp-101'].some(u => skill.unitId.startsWith(u))) {
            initialMastery = Math.max(0.05, initialMastery - 0.03);
          }

          return {
            userId: user.id,
            skillId: skill.id,
            pMastery: initialMastery,
            stability: 0.1,
            isVerified: false,
          };
        });

        // Batch insert with conflict handling
        for (let i = 0; i < skillInserts.length; i += 50) {
          const batch = skillInserts.slice(i, i + 50);
          await db.insert(masteryState).values(batch).onConflictDoNothing();
        }
        console.log(`[Onboarding] Seeded ${skillInserts.length} mastery states for ${user.id}`);
      }
    } catch (msErr) {
      console.warn('[Onboarding] Mastery state seeding skipped (tables may not exist):', msErr);
    }

    try {
      await createDailySessions(user.id);
    } catch (sessionErr) {
      console.warn('[Onboarding] Session seeding skipped:', sessionErr);
    }

    return NextResponse.json({
      success: true,
      artifacts: {
        userProfile: {
          examPath: data.examPath,
          llbOrigin: data.llbOrigin,
          studyPace,
          coverageTarget: data.coverageTarget,
          learningStyle: data.learningStyle,
          weakAreas: data.weakUnits,
          strongAreas: data.strongUnits,
        },
        seniorPartnerAnalysis: analysis,
      }
    });

  } catch (error) {
    console.error('Onboarding Error:', error);
    return NextResponse.json({ error: 'Failed to complete onboarding' }, { status: 500 });
  }
}
