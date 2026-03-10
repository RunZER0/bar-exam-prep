import { db } from '@/lib/db';
import { syllabusNodes, userProfiles, nodeProgress } from '@/lib/db/schema';
import { eq, and, asc, sql } from 'drizzle-orm';
import OpenAI from 'openai';
import { ORCHESTRATOR_MODEL } from '@/lib/ai/model-config';

let _openai: OpenAI | null = null;
const getOpenAI = () => {
  if (!_openai && process.env.OPENAI_API_KEY) {
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _openai;
};

/**
 * Orchestrator philosophy: Focus over flood.
 * Show a manageable daily queue (max ~12 items) drawn from the current
 * study window, prioritised by urgency and mastery state.
 * The full backlog count is exposed so the UI can surface it without
 * overwhelming the student with 50+ tasks in a single day.
 */
const DAILY_QUEUE_CAP = 12;

/** Maximum number of distinct units to include per day (avoids topic whiplash) */
const MAX_UNITS_PER_DAY = 3;

/**
 * KSL 2026/2027 Academic Calendar
 * Term 1: Feb 3 – Apr 14 (11 weeks)
 * Term 2: Apr 28 – Jul 7 (11 weeks)
 * Term 3: Aug 18 – Oct 27 (11 weeks)
 */
const KSL_TERMS = [
    { term: 1, start: new Date('2026-02-03'), end: new Date('2026-04-14') },
    { term: 2, start: new Date('2026-04-28'), end: new Date('2026-07-07') },
    { term: 3, start: new Date('2026-08-18'), end: new Date('2026-10-27') },
];

/** Get current date in East Africa Time (UTC+3) */
function getEATDate(): Date {
    const now = new Date();
    // Create date in EAT (UTC+3)
    const eatOffset = 3 * 60; // minutes
    const utcMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
    const eatMinutes = utcMinutes + eatOffset;
    const eatDate = new Date(now);
    eatDate.setUTCHours(Math.floor(eatMinutes / 60) % 24, eatMinutes % 60, now.getUTCSeconds());
    // Handle day rollover
    if (eatMinutes >= 24 * 60) {
        eatDate.setUTCDate(eatDate.getUTCDate() + 1);
    }
    return eatDate;
}

/** Get today's date string in EAT for cache keys and daily rotation */
function getEATDateString(): string {
    const d = getEATDate();
    return d.toISOString().split('T')[0]; // YYYY-MM-DD
}

function getCurrentTermAndWeek(): { term: number; weekInTerm: number; absoluteWeek: number } {
    const today = getEATDate();
    
    for (const t of KSL_TERMS) {
        if (today >= t.start && today <= t.end) {
            const msElapsed = today.getTime() - t.start.getTime();
            const weekInTerm = Math.min(11, Math.floor(msElapsed / (7 * 24 * 60 * 60 * 1000)) + 1);
            const absoluteWeek = (t.term - 1) * 11 + weekInTerm;
            return { term: t.term, weekInTerm, absoluteWeek };
        }
    }
    
    // If outside term dates, compute closest term
    const beforeT1 = today < KSL_TERMS[0].start;
    if (beforeT1) return { term: 1, weekInTerm: 1, absoluteWeek: 1 };
    
    // Between terms or after T3: return the position relative to last completed term
    for (let i = 0; i < KSL_TERMS.length - 1; i++) {
        if (today > KSL_TERMS[i].end && today < KSL_TERMS[i + 1].start) {
            // In break between terms — treat as start of next term
            return { term: KSL_TERMS[i + 1].term, weekInTerm: 1, absoluteWeek: KSL_TERMS[i].term * 11 + 1 };
        }
    }
    
    // After T3 — revision period, show all remaining
    return { term: 3, weekInTerm: 11, absoluteWeek: 33 };
}

export class MasteryOrchestrator {
    
    /**
     * Generate the Daily Queue based on Two-Track Logic:
     *   Path A (April Resit): Surgical Strike — only failed units, high-yield first
     *   Path B (First-Timer): Paced Build — synced to KSL weekly outline
     */
    static async generateDailyQueue(userId: string) {
        // 1. Fetch User Profile
        const [profile] = await db.select().from(userProfiles).where(eq(userProfiles.userId, userId));
        
        const isResit = profile?.examPath === 'APRIL_2026';
        const failedUnits = (profile?.weakAreas || []) as string[];
        const strongAreas = (profile?.strongAreas || []) as string[];
        const studyPace = (profile?.studyPace || 'moderate') as string;
        const professionalExposure = (profile?.professionalExposure || 'STUDENT') as string;
        const learningStyle = (profile?.learningStyle || 'mixed') as string;
        const isPathA = isResit;

        // Extract extended snapshot from goals jsonb
        const snapshot = (profile?.goals || {}) as Record<string, unknown>;
        const coverageTarget = (snapshot.coverageTarget || 'full_calendar') as string;
        const weekendStudyHours = Number(snapshot.weekendStudyHours || 0);
        const confidenceLevel = Number(snapshot.confidenceLevel || 5);
        
        const { term, weekInTerm, absoluteWeek } = getCurrentTermAndWeek();
        
        console.log(`[MasteryOrchestrator] User: ${userId} | Path: ${isPathA ? 'A (Surgical Strike)' : 'B (Paced Build)'} | Term ${term}, Week ${weekInTerm} (Abs: ${absoluteWeek})`);
        console.log(`[MasteryOrchestrator] Profile signals — weakAreas: [${failedUnits.join(', ')}] | strongAreas: [${strongAreas.join(', ')}] | pace: ${studyPace} | exposure: ${professionalExposure} | coverage: ${coverageTarget} | learning: ${learningStyle} | weekendHrs: ${weekendStudyHours}`);

        // 2. Fetch real syllabus from DB
        const syllabus = await db.select().from(syllabusNodes).orderBy(asc(syllabusNodes.weekNumber));
        
        if (syllabus.length === 0) {
            console.error('[MasteryOrchestrator] No syllabus nodes in DB — run seed-syllabus-production.ts');
            return {
                date: new Date().toISOString().split('T')[0],
                queue: [],
                meta: { termFocus: 'Getting Started', witnessCount: 0, pacing: 'Setup Required', totalSkills: 0, masteredSkills: 0 }
            };
        }

        // 3. Fetch user's node progress to filter out mastered nodes
        const progress = await db.select().from(nodeProgress).where(eq(nodeProgress.userId, userId));
        const masteredNodeIds = new Set(
            progress.filter(p => p.phase === 'MASTERY' && p.masteryPassed).map(p => p.nodeId)
        );

        let queue: typeof syllabus = [];

        if (isPathA) {
            // PATH A: Surgical Strike — Only failed units, ALL unmastered nodes
            // Fallback: if no weak areas specified, include ALL unmastered nodes (don't return empty queue)
            const hasWeakAreas = failedUnits.length > 0;
            const targetedNodes = hasWeakAreas
                ? syllabus.filter(node => 
                    failedUnits.some(f => 
                        node.unitCode.toLowerCase() === f.toLowerCase() ||
                        node.unitCode.toLowerCase() === f.replace('-', '').toLowerCase() ||
                        node.unitCode.toLowerCase().replace(' ', '') === f.toLowerCase().replace('-', '')
                    ) && !masteredNodeIds.has(node.id)
                  )
                : syllabus.filter(node => !masteredNodeIds.has(node.id)); // No weak areas → all unmastered
            
            if (!hasWeakAreas) {
                console.log(`[MasteryOrchestrator] Path A but no weak areas specified — falling back to all ${targetedNodes.length} unmastered nodes`);
            }
            
            // Sort: high-yield + drafting first, then by week
            const criticalNodes = targetedNodes.filter(n => n.isHighYield || n.isDraftingNode);
            const standardNodes = targetedNodes.filter(n => !n.isHighYield && !n.isDraftingNode);
            
            queue = [...criticalNodes, ...standardNodes];
            
        } else {
            // PATH B: Paced Build — Sync to current KSL week across all 9 courses
            // Get nodes for current week, previous week, and one week ahead (full window)
            const weeklyNodes = syllabus.filter(node => 
                (node.weekNumber >= absoluteWeek - 1 && node.weekNumber <= absoluteWeek + 1) &&
                !masteredNodeIds.has(node.id)
            );
            
            queue = weeklyNodes;
            
            // Backfill with any unmastered earlier nodes
            const backlog = syllabus.filter(n => 
                n.weekNumber < absoluteWeek - 1 && 
                !masteredNodeIds.has(n.id) &&
                !queue.some(q => q.id === n.id)
            );
            // Prioritize high-yield backlog, then standard
            const hyBacklog = backlog.filter(n => n.isHighYield || n.isDraftingNode);
            const stdBacklog = backlog.filter(n => !n.isHighYield && !n.isDraftingNode);
            queue.push(...hyBacklog, ...stdBacklog);

            // PERSONALIZATION: Sort entire Path B queue using profile signals
            // Weak areas get highest priority, strong areas get deprioritized
            const unitPriority = (unitCode: string): number => {
                const code = unitCode.toLowerCase();
                const isWeak = failedUnits.some(f => code === f.toLowerCase() || code === f.replace('-', '').toLowerCase());
                const isStrong = strongAreas.some(s => code === s.toLowerCase() || code === s.replace('-', '').toLowerCase());
                if (isWeak) return 0;  // Highest priority — user struggles here
                if (isStrong) return 2; // Lowest priority — user is comfortable
                return 1; // Normal priority
            };

            queue.sort((a, b) => {
                const pa = unitPriority(a.unitCode);
                const pb = unitPriority(b.unitCode);
                if (pa !== pb) return pa - pb;
                // Within same priority band: high-yield first, then by week
                if (a.isHighYield !== b.isHighYield) return a.isHighYield ? -1 : 1;
                return a.weekNumber - b.weekNumber;
            });
            console.log(`[MasteryOrchestrator] Path B queue sorted — weak-first prioritization applied (${failedUnits.length} weak, ${strongAreas.length} strong areas)`);
        }

        // 4a. Fetch micro-skill practice items for queued units
        const queuedUnitCodes = [...new Set(queue.map(n => n.unitCode))];
        let microSkillItems: Array<{
          type: 'PRACTICE';
          priority: 'HIGH' | 'NORMAL';
          data: {
            skillId: string;
            skillName: string;
            skillCode: string;
            itemId: string;
            prompt: string;
            format: string;
            difficulty: number;
            unitId: string;
            isCaseLaw: boolean;
          };
        }> = [];

        if (queuedUnitCodes.length > 0) {
          try {
            const practiceRows = await db.execute(sql`
              SELECT
                ms.id as skill_id,
                ms.name as skill_name,
                ms.code as skill_code,
                ms.is_core,
                ms.difficulty,
                ms.unit_id,
                i.id as item_id,
                i.prompt,
                i.format,
                i.difficulty as item_difficulty
              FROM micro_skills ms
              JOIN item_skill_map ism ON ism.skill_id = ms.id
              JOIN items i ON i.id = ism.item_id
              LEFT JOIN mastery_state mst ON mst.skill_id = ms.id AND mst.user_id = ${userId}
              WHERE ms.unit_id = ANY(${queuedUnitCodes}::text[])
                AND ms.is_active = true
                AND i.is_active = true
                AND (mst.p_mastery IS NULL OR mst.p_mastery < 0.85)
              ORDER BY
                CASE WHEN ms.is_core THEN 0 ELSE 1 END,
                COALESCE(mst.p_mastery, 0) ASC,
                ms.exam_weight DESC
            `);

            microSkillItems = (practiceRows.rows as Array<Record<string, unknown>>).map(row => ({
              type: 'PRACTICE' as const,
              priority: (row.is_core ? 'HIGH' : 'NORMAL') as 'HIGH' | 'NORMAL',
              data: {
                skillId: String(row.skill_id),
                skillName: String(row.skill_name),
                skillCode: String(row.skill_code),
                itemId: String(row.item_id),
                prompt: String(row.prompt),
                format: String(row.format),
                difficulty: Number(row.item_difficulty),
                unitId: String(row.unit_id),
                isCaseLaw: String(row.skill_code).includes('-case-'),
              },
            }));
          } catch {
            // micro_skills tables may not exist yet — gracefully skip
            console.log('[MasteryOrchestrator] micro_skills query skipped (tables may not exist)');
          }
        }

        // 4b. Limit to MAX_UNITS_PER_DAY distinct units to avoid topic whiplash
        // Use date-based rotation so different units surface each day
        const todayStr = getEATDateString();
        const allUnitCodes = [...new Set(queue.map(n => n.unitCode))];
        
        if (allUnitCodes.length > MAX_UNITS_PER_DAY) {
            // Deterministic daily seed from date + userId (user-specific rotation)
            const dateSeed = todayStr.split('-').reduce((s, p) => s + parseInt(p), 0);
            const userSeed = userId.split('').reduce((s, c) => s + c.charCodeAt(0), 0);
            const combinedSeed = dateSeed * 31 + userSeed; // Mix user identity so different users rotate differently

            // Separate weak, normal, strong unit pools for smarter selection
            const weakUnits = allUnitCodes.filter(u => failedUnits.some(f => u.toLowerCase() === f.toLowerCase() || u.toLowerCase() === f.replace('-', '').toLowerCase()));
            const strongUnits = allUnitCodes.filter(u => strongAreas.some(s => u.toLowerCase() === s.toLowerCase() || u.toLowerCase() === s.replace('-', '').toLowerCase()));
            const normalUnits = allUnitCodes.filter(u => !weakUnits.includes(u) && !strongUnits.includes(u));

            const todaysUnits = new Set<string>();

            // Always include weak units first (up to MAX_UNITS_PER_DAY)
            for (const wu of weakUnits) {
                if (todaysUnits.size >= MAX_UNITS_PER_DAY) break;
                todaysUnits.add(wu);
            }

            // Fill remaining slots from normal units using user-specific rotation
            if (todaysUnits.size < MAX_UNITS_PER_DAY && normalUnits.length > 0) {
                const sortedNormal = normalUnits.sort();
                const startIdx = combinedSeed % sortedNormal.length;
                for (let i = 0; i < sortedNormal.length && todaysUnits.size < MAX_UNITS_PER_DAY; i++) {
                    todaysUnits.add(sortedNormal[(startIdx + i) % sortedNormal.length]);
                }
            }

            // Last resort: fill from strong units if still have room
            if (todaysUnits.size < MAX_UNITS_PER_DAY && strongUnits.length > 0) {
                const sortedStrong = strongUnits.sort();
                const startIdx = combinedSeed % sortedStrong.length;
                for (let i = 0; i < sortedStrong.length && todaysUnits.size < MAX_UNITS_PER_DAY; i++) {
                    todaysUnits.add(sortedStrong[(startIdx + i) % sortedStrong.length]);
                }
            }

            queue = queue.filter(n => todaysUnits.has(n.unitCode));
            console.log(`[MasteryOrchestrator] Daily unit focus (${todayStr}, user-seeded): ${[...todaysUnits].join(', ')} (${allUnitCodes.length} total: ${weakUnits.length} weak, ${normalUnits.length} normal, ${strongUnits.length} strong)`);
        }

        // 4c. Adjust queue cap based on coverage target + study pace + weekend boost
        // Coverage target multiplier: tighter deadline = more tasks
        const coverageMultiplier = coverageTarget === '4_weeks' ? 1.7
            : coverageTarget === '8_weeks' ? 1.3
            : coverageTarget === '16_weeks' ? 1.0
            : 0.7; // full_calendar — relaxed
        const paceMultiplier = studyPace === 'intensive' ? 1.25 : studyPace === 'relaxed' ? 0.67 : 1.0;

        // Weekend boost: if user said they study more on weekends, increase cap on Sat/Sun
        const eatDay = getEATDate().getDay(); // 0=Sun, 6=Sat
        const isWeekend = eatDay === 0 || eatDay === 6;
        const weekendBoost = isWeekend && weekendStudyHours >= 4 ? 1.3 : isWeekend && weekendStudyHours >= 2 ? 1.15 : 1.0;

        const adjustedCap = Math.round(DAILY_QUEUE_CAP * coverageMultiplier * paceMultiplier * weekendBoost);
        const totalBacklogCount = queue.length;
        queue = queue.slice(0, adjustedCap);
        console.log(`[MasteryOrchestrator] Queue capped at ${adjustedCap} items (coverage: ${coverageTarget} ×${coverageMultiplier}, pace: ${studyPace} ×${paceMultiplier}${isWeekend ? `, weekend boost ×${weekendBoost}` : ''}, backlog: ${totalBacklogCount})`);

        // 5. Build response with node progress phase info + micro-skill items
        const progressMap = new Map(progress.map(p => [p.nodeId, p]));

        const syllabusQueue = queue.map(node => {
                const np = progressMap.get(node.id);
                return {
                    type: 'SYLLABUS' as const,
                    priority: node.isHighYield ? 'HIGH' as const : 'NORMAL' as const,
                    data: {
                        id: node.id,
                        title: `${node.unitCode}: ${node.topicName}`,
                        description: node.subtopicName || node.learningOutcome || 'Mastery verification required',
                        unitId: node.unitCode,
                        weekNumber: node.weekNumber,
                        kslTerm: node.kslTerm,
                        isDrafting: node.isDraftingNode,
                        severityWeight: node.isDraftingNode ? 1.5 : 1.0,
                        currentPhase: np?.phase || 'NOTE',
                    }
                };
            });

        // Get which units are in today's queue for display
        const focusUnitCodes = [...new Set(queue.map(n => n.unitCode))];

        return {
            date: todayStr,
            queue: syllabusQueue,
            practiceItems: microSkillItems,
            meta: {
                termFocus: isPathA 
                    ? `Resit Focus - ${failedUnits.join(', ')}` 
                    : `Term ${term}, Week ${weekInTerm}`,
                totalSkills: syllabus.length,
                masteredSkills: masteredNodeIds.size,
                practiceItemCount: microSkillItems.length,
                caseLawItemCount: microSkillItems.filter(i => i.data.isCaseLaw).length,
                completionPct: syllabus.length > 0 
                    ? Math.round((masteredNodeIds.size / syllabus.length) * 100) 
                    : 0,
                pacing: isPathA ? 'Accelerated' : studyPace === 'intensive' ? 'Intensive' : studyPace === 'relaxed' ? 'Relaxed' : 'Standard',
                totalBacklog: totalBacklogCount,
                cappedAt: adjustedCap,
                focusUnits: focusUnitCodes,
                personalization: {
                    weakAreas: failedUnits,
                    strongAreas,
                    studyPace,
                    professionalExposure,
                    examPath: isPathA ? 'APRIL_2026_RESIT' : 'NOVEMBER_2026_FIRST',
                    coverageTarget,
                    learningStyle,
                    weekendStudyHours,
                    confidenceLevel,
                    isWeekend: getEATDate().getDay() === 0 || getEATDate().getDay() === 6,
                },
            }
        };
    }

    /**
     * Advance a node through the 4-phase lifecycle: NOTE → EXHIBIT → DIAGNOSIS → MASTERY
     */
    static async advanceNodePhase(userId: string, nodeId: string, result: {
        phase: 'NOTE' | 'EXHIBIT' | 'DIAGNOSIS' | 'MASTERY';
        score?: number;
        passed?: boolean;
    }) {
        const existing = await db.select().from(nodeProgress)
            .where(and(eq(nodeProgress.userId, userId), eq(nodeProgress.nodeId, nodeId)));

        const now = new Date();

        if (existing.length === 0) {
            // Create initial progress record
            await db.insert(nodeProgress).values({
                userId,
                nodeId,
                phase: result.phase,
                noteCompleted: result.phase === 'NOTE',
                exhibitViewed: result.phase === 'EXHIBIT',
                diagnosisScore: result.phase === 'DIAGNOSIS' ? (result.score ?? null) : null,
                diagnosisPassed: result.phase === 'DIAGNOSIS' && (result.passed ?? false),
                masteryScore: result.phase === 'MASTERY' ? (result.score ?? null) : null,
                masteryPassed: result.phase === 'MASTERY' && (result.passed ?? false),
                attempts: 1,
                lastAttemptAt: now,
                completedAt: result.phase === 'MASTERY' && result.passed ? now : null,
            });
        } else {
            // Update existing record
            const updates: Record<string, unknown> = {
                phase: result.phase,
                attempts: sql`${nodeProgress.attempts} + 1`,
                lastAttemptAt: now,
                updatedAt: now,
            };

            if (result.phase === 'NOTE') updates.noteCompleted = true;
            if (result.phase === 'EXHIBIT') updates.exhibitViewed = true;
            if (result.phase === 'DIAGNOSIS') {
                updates.diagnosisScore = result.score ?? null;
                updates.diagnosisPassed = result.passed ?? false;
            }
            if (result.phase === 'MASTERY') {
                updates.masteryScore = result.score ?? null;
                updates.masteryPassed = result.passed ?? false;
                if (result.passed) updates.completedAt = now;
            }

            await db.update(nodeProgress).set(updates)
                .where(and(eq(nodeProgress.userId, userId), eq(nodeProgress.nodeId, nodeId)));
        }

        return { success: true, phase: result.phase, passed: result.passed };
    }

    /**
     * Pacing Check: AI-driven adaptive pacing
     * Uses ORCHESTRATOR_MODEL to analyze performance patterns and recommend pacing adjustments
     */
    static async checkPacing(userId: string, lastAttemptResult: { score: number; isUnderstandingCheck: boolean }) {
        // Quick heuristic check first
        if (lastAttemptResult.isUnderstandingCheck && lastAttemptResult.score < 0.6) {
            console.log(`[MasteryOrchestrator] Understanding check failed. Slowing down.`);

            // Ask AI orchestrator for specific intervention
            const openai = getOpenAI();
            if (openai) {
                try {
                    // Get recent performance data
                    const recentAttempts = await db.execute(sql`
                        SELECT 
                            ms.name as skill_name, ms.unit_id,
                            a.score_norm, a.format, a.error_tags, a.created_at
                        FROM attempts a
                        JOIN item_skill_map ism ON ism.item_id = a.item_id
                        JOIN micro_skills ms ON ms.id = ism.skill_id
                        WHERE a.user_id = ${userId}
                        ORDER BY a.created_at DESC
                        LIMIT 10
                    `);

                    const response = await openai.responses.create({
                        model: ORCHESTRATOR_MODEL,
                        input: `You are an adaptive learning orchestrator for a Kenyan bar exam prep system.

A student just scored ${(lastAttemptResult.score * 100).toFixed(0)}% on an understanding check.

Recent attempt history:
${JSON.stringify(recentAttempts.rows, null, 2)}

Analyze the pattern and respond with JSON:
{
  "action": "SLOW_DOWN" | "REVIEW_PREREQUISITE" | "CHANGE_FORMAT" | "INJECT_EXAMPLE",
  "inject": "HAMMERING_TASK" | "REVIEW_NOTE" | "WORKED_EXAMPLE" | "SIMPLER_VARIANT",
  "reason": "Brief explanation",
  "targetSkill": "Name of skill to focus on",
  "suggestedDifficulty": 1-5
}`,
                    });

                    try {
                        const jsonMatch = response.output_text.match(/\{[\s\S]*\}/);
                        if (jsonMatch) {
                            const aiDecision = JSON.parse(jsonMatch[0]);
                            console.log(`[MasteryOrchestrator] AI pacing decision:`, aiDecision);
                            return {
                                action: aiDecision.action || 'SLOW_DOWN',
                                inject: aiDecision.inject || 'HAMMERING_TASK',
                                reason: aiDecision.reason,
                                targetSkill: aiDecision.targetSkill,
                                suggestedDifficulty: aiDecision.suggestedDifficulty,
                            };
                        }
                    } catch {
                        // AI parse failed, use default
                    }
                } catch (aiError) {
                    console.warn('[MasteryOrchestrator] AI pacing check failed:', aiError);
                }
            }

            return { action: 'SLOW_DOWN' as const, inject: 'HAMMERING_TASK' as const };
        }
        return { action: 'CONTINUE' as const };
    }

    /**
     * AI-powered queue prioritization
     * Takes the SQL-generated queue and uses ORCHESTRATOR_MODEL to re-rank
     * based on student's error patterns, time constraints, and exam proximity
     */
    static async aiPrioritizeQueue(
        userId: string,
        queue: Array<{ type: string; priority: string; data: Record<string, unknown> }>,
        practiceItems: Array<{ type: string; priority: string; data: Record<string, unknown> }>
    ): Promise<{ rerankedQueue: typeof queue; rerankedPractice: typeof practiceItems; reasoning: string }> {
        const openai = getOpenAI();
        if (!openai || queue.length === 0) {
            return { rerankedQueue: queue, rerankedPractice: practiceItems, reasoning: 'AI not available — using default SQL ordering' };
        }

        try {
            // Get error pattern summary
            const errorPatterns = await db.execute(sql`
                SELECT error_tags, COUNT(*) as cnt
                FROM attempts
                WHERE user_id = ${userId} AND error_tags IS NOT NULL AND error_tags != '[]'
                GROUP BY error_tags
                ORDER BY cnt DESC
                LIMIT 5
            `);

            const response = await openai.responses.create({
                model: ORCHESTRATOR_MODEL,
                input: `You are an adaptive learning orchestrator. Re-prioritize this study queue for maximum exam readiness.

QUEUE (${queue.length} syllabus items):
${queue.slice(0, 15).map((item, i) => `${i + 1}. ${JSON.stringify(item.data)}`).join('\n')}

PRACTICE ITEMS (${practiceItems.length}):
${practiceItems.slice(0, 10).map((item, i) => `${i + 1}. ${JSON.stringify(item.data)}`).join('\n')}

ERROR PATTERNS:
${JSON.stringify(errorPatterns.rows)}

Respond with JSON:
{
  "syllabusOrder": [1, 3, 2, ...],  // re-ordered indices (1-based)
  "practiceOrder": [2, 1, 3, ...],  // re-ordered indices (1-based)
  "reasoning": "Brief explanation of prioritization logic"
}`,
            });

            try {
                const jsonMatch = response.output_text.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    const decision = JSON.parse(jsonMatch[0]);
                    
                    // Reorder queue based on AI indices
                    const rerankedQueue = (decision.syllabusOrder || [])
                        .filter((idx: number) => idx >= 1 && idx <= queue.length)
                        .map((idx: number) => queue[idx - 1]);
                    // Append any items not mentioned by AI
                    const mentionedSet = new Set(decision.syllabusOrder || []);
                    queue.forEach((item, i) => {
                        if (!mentionedSet.has(i + 1)) rerankedQueue.push(item);
                    });

                    const rerankedPractice = (decision.practiceOrder || [])
                        .filter((idx: number) => idx >= 1 && idx <= practiceItems.length)
                        .map((idx: number) => practiceItems[idx - 1]);
                    const mentionedPractice = new Set(decision.practiceOrder || []);
                    practiceItems.forEach((item, i) => {
                        if (!mentionedPractice.has(i + 1)) rerankedPractice.push(item);
                    });

                    return {
                        rerankedQueue,
                        rerankedPractice,
                        reasoning: decision.reasoning || 'AI-prioritized',
                    };
                }
            } catch {
                // Parse failed
            }
        } catch (error) {
            console.warn('[MasteryOrchestrator] AI prioritization failed:', error);
        }

        return { rerankedQueue: queue, rerankedPractice: practiceItems, reasoning: 'Default SQL ordering' };
    }

    /**
     * Get completion dashboard for a user
     */
    static async getCompletionDashboard(userId: string) {
        const totalNodes = await db.select({ count: sql<number>`count(*)` }).from(syllabusNodes);
        const userProgress = await db.select().from(nodeProgress).where(eq(nodeProgress.userId, userId));
        
        const total = Number(totalNodes[0]?.count || 0);
        const mastered = userProgress.filter(p => p.phase === 'MASTERY' && p.masteryPassed).length;
        const inProgress = userProgress.filter(p => p.phase !== 'MASTERY' || !p.masteryPassed).length;
        const notStarted = total - userProgress.length;

        // Per-course breakdown
        const allNodes = await db.select({ id: syllabusNodes.id, unitCode: syllabusNodes.unitCode }).from(syllabusNodes);
        const progressMap = new Map(userProgress.map(p => [p.nodeId, p]));
        
        const courseBreakdown: Record<string, { total: number; mastered: number; pct: number }> = {};
        for (const node of allNodes) {
            if (!courseBreakdown[node.unitCode]) {
                courseBreakdown[node.unitCode] = { total: 0, mastered: 0, pct: 0 };
            }
            courseBreakdown[node.unitCode].total++;
            const np = progressMap.get(node.id);
            if (np?.phase === 'MASTERY' && np.masteryPassed) {
                courseBreakdown[node.unitCode].mastered++;
            }
        }
        for (const code of Object.keys(courseBreakdown)) {
            const c = courseBreakdown[code];
            c.pct = c.total > 0 ? Math.round((c.mastered / c.total) * 100) : 0;
        }

        return {
            total,
            mastered,
            inProgress,
            notStarted,
            overallPct: total > 0 ? Math.round((mastered / total) * 100) : 0,
            courseBreakdown,
        };
    }
}
