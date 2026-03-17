import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { users, microSkills, witnesses, syllabusNodes } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { verifyIdToken } from '@/lib/firebase/admin';
import { NarrativeNoteRenderer } from '@/lib/services/narrative-renderer';
import { AssessmentGenerator } from '@/lib/services/assessment-generator';
import { CheckpointGenerator } from '@/lib/services/checkpoint-generator';
import { neon } from '@neondatabase/serverless';

const rawSql = neon(process.env.DATABASE_URL!);

/**
 * GET /api/mastery/content
 * Returns study content using PRE-BUILT notes (cost-saving overhaul).
 * 
 * Pre-built notes: 3 versions per syllabus node in the database.
 * Each user is assigned a random version (1-3) on first access, then sees
 * the same version consistently. Checkpoints & assessments are still AI-generated
 * live because they need variety.
 * 
 * Supports progressive loading:
 *   ?phase=narrative  → returns pre-built narrative slides immediately (FAST - no AI call)
 *   ?phase=extras     → returns AI-generated checkpoints + assessment stack
 *   (no phase)        → full response with everything
 */
export async function GET(req: NextRequest) {
    try {
        const contentId = req.nextUrl.searchParams.get('skillId');
        const type = req.nextUrl.searchParams.get('type') || 'SYLLABUS'; 
        const phase = req.nextUrl.searchParams.get('phase'); // 'narrative' | 'extras' | null

        if (!contentId) {
            return NextResponse.json({ error: 'Missing contentId' }, { status: 400 });
        }

        // === AUTH: Get user ID for version tracking ===
        let userId: string | null = null;
        let dbUserId: string | null = null;
        try {
            const authHeader = req.headers.get('authorization');
            if (authHeader?.startsWith('Bearer ')) {
                const token = authHeader.split('Bearer ')[1];
                const decoded = await verifyIdToken(token);
                userId = decoded.uid;
                // Get DB user ID
                const [u] = await db.select({ id: users.id }).from(users).where(eq(users.firebaseUid, decoded.uid)).limit(1);
                dbUserId = u?.id || null;
            }
        } catch {
            // Auth is optional for content — continue without version tracking
        }

        // 1. Fetch Topic Details & Context
        let topicName = "";
        let isDrafting = false;
        let unitCode = "";
        
        if (type === 'SYLLABUS') {
            try {
                const node = await db.query.syllabusNodes.findFirst({
                    where: eq(syllabusNodes.id, contentId)
                });
                if (node) {
                    topicName = node.subtopicName 
                        ? `${node.topicName}: ${node.subtopicName}` 
                        : node.topicName;
                    isDrafting = node.isDraftingNode;
                    unitCode = node.unitCode;
                } else {
                    return NextResponse.json({ error: 'Node not found' }, { status: 404 });
                }
            } catch (e) {
                console.error('[mastery/content] DB query failed:', e);
                return NextResponse.json({ error: 'Database error' }, { status: 500 });
            }
        } else if (type === 'WITNESS') {
            const witness = await db.query.witnesses.findFirst({
                where: eq(witnesses.id, contentId)
            });
            if (!witness) return NextResponse.json({ error: 'Witness not found' }, { status: 404 });
            topicName = witness.title;
        } else {
            const skill = await db.query.microSkills.findFirst({
                where: eq(microSkills.id, contentId)
            });
            if (!skill) return NextResponse.json({ error: 'Skill not found' }, { status: 404 });
            topicName = skill.title;
        }

        // Pick ONE visual style for the entire session (randomly chosen)
        const NOTE_STYLES = ['classic', 'magazine', 'highlight', 'minimal'] as const;
        const sessionStyle = NOTE_STYLES[Math.floor(Math.random() * NOTE_STYLES.length)];

        /* ========== PHASE: EXTRAS ONLY ========== */
        if (phase === 'extras') {
            // Checkpoints + assessment are STILL AI-generated live (variety matters here)
            const sectionCount = parseInt(req.nextUrl.searchParams.get('sectionCount') || '4');
            const [checkpoints, stack] = await Promise.all([
                CheckpointGenerator.generate(topicName, sectionCount, { unitCode }).catch(e => {
                    console.error('[mastery/content] Checkpoint generation failed:', e);
                    return [];
                }),
                AssessmentGenerator.generateStack(topicName, { unitCode, isDrafting }).catch(e => {
                    console.error('[mastery/content] Assessment generation failed:', e);
                    return { topic: topicName, stack: [] };
                }),
            ]);
            return NextResponse.json({ checkpoints, stack });
        }

        // ═══════════════════════════════════════════════════════════
        // 2. FETCH PRE-BUILT NARRATIVE (no AI call — instant!)
        // ═══════════════════════════════════════════════════════════
        let narrative = "";
        let usedPrebuilt = false;

        if (type === 'SYLLABUS') {
            try {
                // Determine which version this user gets (1-3 for Mastery Hub)
                let assignedVersion: number | null = null;

                if (dbUserId) {
                    // Check if user already has an assigned version for this node
                    const [existing] = await rawSql`
                        SELECT mastery_version FROM user_note_versions
                        WHERE user_id = ${dbUserId}::uuid AND node_id = ${contentId}::uuid
                    `;
                    if (existing?.mastery_version) {
                        assignedVersion = existing.mastery_version;
                    }
                }

                if (!assignedVersion) {
                    // Use version 1 — currently the only generated version
                    assignedVersion = 1;

                    // Persist the assignment so user always sees the same version
                    if (dbUserId) {
                        try {
                            await rawSql`
                                INSERT INTO user_note_versions (user_id, node_id, mastery_version, mastery_read_at)
                                VALUES (${dbUserId}::uuid, ${contentId}::uuid, ${assignedVersion}, NOW())
                                ON CONFLICT (user_id, node_id) DO UPDATE SET
                                    mastery_version = COALESCE(user_note_versions.mastery_version, ${assignedVersion}),
                                    mastery_read_at = NOW(),
                                    updated_at = NOW()
                            `;
                        } catch (e) {
                            console.warn('[mastery/content] Version tracking write failed (non-critical):', e);
                        }
                    }
                }

                // Fetch the pre-built notes for this version
                const [prebuilt] = await rawSql`
                    SELECT narrative_markdown, sections_json, authorities_json, personality
                    FROM prebuilt_notes
                    WHERE node_id = ${contentId}::uuid 
                      AND version_number = ${assignedVersion}
                      AND is_active = true
                    LIMIT 1
                `;

                if (prebuilt?.narrative_markdown) {
                    narrative = prebuilt.narrative_markdown;
                    usedPrebuilt = true;
                    console.log(`[mastery/content] Pre-built v${assignedVersion} for node ${contentId} (${topicName})`);
                }
            } catch (e) {
                console.warn('[mastery/content] Pre-built notes fetch failed, falling back to AI:', e);
            }
        }

        // Fallback: Generate with AI if no pre-built notes available
        if (!usedPrebuilt) {
            try {
                const generated = await NarrativeNoteRenderer.generateNarrative(topicName);
                narrative = generated || "";
                console.log(`[mastery/content] AI-generated fallback for: ${topicName}`);
            } catch (e) {
                console.error("[mastery/content] Narrative generation failed:", e);
                narrative = `### Generation Error\n\nThe Mentor could not generate a narrative for **${topicName}** at this time.\n\n> Please try again or contact support.`;
            }
        }
        
        // 3. Split Narrative for Carousel (with examTips extraction for structured rendering)
        const rawSections = narrative.split(/(?=^### )/m).filter(s => s.trim().length > 0);
        if (rawSections.length === 0) rawSections.push(narrative);

        const parsedSections = rawSections.map((s: string, i: number) => {
            const titleMatch = s.match(/^###\s+(.+)/m);
            const examTipMatch = s.match(/\*{1,2}Exam\s+(?:Tip|pitfall):\*{1,2}\s*(.+)/i);
            const examTips = examTipMatch ? examTipMatch[1].trim() : undefined;
            const content = examTips
                ? s.replace(/\*{1,2}Exam\s+(?:Tip|pitfall):\*{1,2}\s*.+/i, '').trim()
                : s.trim();
            return {
                id: `section-${i}`,
                title: titleMatch ? titleMatch[1].trim() : `Section ${i + 1}`,
                content,
                ...(examTips && { examTips }),
            };
        });

        // Keep raw sections for legacy compatibility
        let sections = rawSections;

        /* ========== PHASE: NARRATIVE ONLY (fast path) ========== */
        if (phase === 'narrative') {
            const slides = parsedSections.map(s => ({
                type: 'narrative' as const,
                content: s.content,
                title: s.title,
                examTips: s.examTips,
                style: sessionStyle,
            }));
            return NextResponse.json({
                narrativeSections: sections,
                parsedSections,
                slides,
                isDrafting,
                unitCode,
                sessionStyle,
                sectionCount: sections.length,
                stack: null,       // not yet loaded
                partial: true,     // signal to client: extras coming
                prebuilt: usedPrebuilt,
            });
        }

        /* ========== LEGACY: FULL RESPONSE ========== */
        // 4. Generate Assessment + Checkpoints in parallel (STILL AI-generated for variety)
        let stack = null;
        let checkpoints: any[] = [];
        try {
            const [s, c] = await Promise.all([
                AssessmentGenerator.generateStack(topicName, { unitCode, isDrafting }),
                CheckpointGenerator.generate(topicName, sections.length, { unitCode }),
            ]);
            stack = s;
            checkpoints = c;
        } catch (e) {
            console.error("[mastery/content] Generation failed:", e);
            stack = { topic: topicName, stack: [] };
        }

        type SlideItem = 
            | { type: 'narrative'; content: string; title?: string; examTips?: string; style: string }
            | { type: 'checkpoint'; checkpoint: any };

        const interleaved: SlideItem[] = [];
        let cpIdx = 0;

        for (let i = 0; i < parsedSections.length; i++) {
            interleaved.push({
                type: 'narrative',
                content: parsedSections[i].content,
                title: parsedSections[i].title,
                examTips: parsedSections[i].examTips,
                style: sessionStyle,
            });
            if ((i + 1) % 2 === 0 && i < parsedSections.length - 1 && cpIdx < checkpoints.length) {
                interleaved.push({ type: 'checkpoint', checkpoint: checkpoints[cpIdx] });
                cpIdx++;
            }
        }

        return NextResponse.json({
            narrativeSections: sections,
            parsedSections,
            slides: interleaved,
            isDrafting,
            unitCode,
            stack,
            prebuilt: usedPrebuilt,
        });

    } catch (error) {
        console.error('Error fetching content:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
