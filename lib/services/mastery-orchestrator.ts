import { db } from '@/lib/db';
import { syllabusNodes, userProfiles, nodeProgress } from '@/lib/db/schema';
import { eq, and, asc, sql } from 'drizzle-orm';

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

function getCurrentTermAndWeek(): { term: number; weekInTerm: number; absoluteWeek: number } {
    const today = new Date();
    
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
        const isPathA = isResit;
        
        const { term, weekInTerm, absoluteWeek } = getCurrentTermAndWeek();
        
        console.log(`[MasteryOrchestrator] User: ${userId} | Path: ${isPathA ? 'A (Surgical Strike)' : 'B (Paced Build)'} | Term ${term}, Week ${weekInTerm} (Abs: ${absoluteWeek})`);

        // 2. Fetch real syllabus from DB
        const syllabus = await db.select().from(syllabusNodes).orderBy(asc(syllabusNodes.weekNumber));
        
        if (syllabus.length === 0) {
            console.error('[MasteryOrchestrator] No syllabus nodes in DB — run seed-syllabus-production.ts');
            return {
                date: new Date().toISOString().split('T')[0],
                queue: [],
                meta: { termFocus: 'ERROR: Syllabus not seeded', witnessCount: 0, pacing: 'BLOCKED' }
            };
        }

        // 3. Fetch user's node progress to filter out mastered nodes
        const progress = await db.select().from(nodeProgress).where(eq(nodeProgress.userId, userId));
        const masteredNodeIds = new Set(
            progress.filter(p => p.phase === 'MASTERY' && p.masteryPassed).map(p => p.nodeId)
        );

        let queue: typeof syllabus = [];

        if (isPathA) {
            // PATH A: Surgical Strike — Only failed units, prioritize high-yield + drafting
            const targetedNodes = syllabus.filter(node => 
                failedUnits.some(f => 
                    node.unitCode.toLowerCase() === f.toLowerCase() ||
                    node.unitCode.toLowerCase() === f.replace('-', '').toLowerCase() ||
                    node.unitCode.toLowerCase().replace(' ', '') === f.toLowerCase().replace('-', '')
                ) && !masteredNodeIds.has(node.id)
            );
            
            // Sort: high-yield + drafting first, then by week
            const criticalNodes = targetedNodes.filter(n => n.isHighYield || n.isDraftingNode);
            const standardNodes = targetedNodes.filter(n => !n.isHighYield && !n.isDraftingNode);
            
            queue = [...criticalNodes.slice(0, 3), ...standardNodes.slice(0, 2)];
            
        } else {
            // PATH B: Paced Build — Sync to current KSL week across all 9 courses
            // Get nodes for current week and one week behind (catch-up buffer)
            const weeklyNodes = syllabus.filter(node => 
                (node.weekNumber === absoluteWeek || node.weekNumber === absoluteWeek - 1) &&
                !masteredNodeIds.has(node.id)
            );
            
            queue = weeklyNodes.slice(0, 9); // Up to 9 nodes (one per course for the week)
            
            // If under-filled, pull from backlog (unmastered earlier nodes)
            if (queue.length < 5) {
                const backlog = syllabus.filter(n => 
                    n.weekNumber < absoluteWeek && 
                    !masteredNodeIds.has(n.id) &&
                    !queue.some(q => q.id === n.id)
                );
                // Prioritize high-yield backlog
                const hyBacklog = backlog.filter(n => n.isHighYield || n.isDraftingNode);
                const stdBacklog = backlog.filter(n => !n.isHighYield && !n.isDraftingNode);
                queue.push(...hyBacklog.slice(0, 5 - queue.length));
                if (queue.length < 5) {
                    queue.push(...stdBacklog.slice(0, 5 - queue.length));
                }
            }
        }

        // 4. Build response with node progress phase info
        const progressMap = new Map(progress.map(p => [p.nodeId, p]));

        return {
            date: new Date().toISOString().split('T')[0],
            queue: queue.map(node => {
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
            }),
            meta: {
                termFocus: isPathA 
                    ? `April Resit: Targeting ${failedUnits.join(', ')}` 
                    : `Term ${term}, Week ${weekInTerm}: ${queue.length} nodes queued`,
                totalNodes: syllabus.length,
                masteredNodes: masteredNodeIds.size,
                completionPct: syllabus.length > 0 
                    ? Math.round((masteredNodeIds.size / syllabus.length) * 100) 
                    : 0,
                pacing: isPathA ? 'Accelerated' : 'Standard'
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
     * Pacing Check: Should we slow down?
     */
    static async checkPacing(userId: string, lastAttemptResult: { score: number; isUnderstandingCheck: boolean }) {
        if (lastAttemptResult.isUnderstandingCheck && lastAttemptResult.score < 0.6) {
            console.log(`[MasteryOrchestrator] Understanding check failed. Slowing down.`);
            return { action: 'SLOW_DOWN' as const, inject: 'HAMMERING_TASK' as const };
        }
        return { action: 'CONTINUE' as const };
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
