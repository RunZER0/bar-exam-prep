import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { microSkills, witnesses, syllabusNodes } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { NarrativeNoteRenderer } from '@/lib/services/narrative-renderer';
import { AssessmentGenerator } from '@/lib/services/assessment-generator';
import { CheckpointGenerator } from '@/lib/services/checkpoint-generator';

/**
 * GET /api/mastery/content
 * Returns study content.  Supports progressive loading:
 *   ?phase=narrative  → returns narrative slides immediately (fast)
 *   ?phase=extras     → returns checkpoints + assessment stack (slow, called 2nd)
 *   (no phase)        → legacy full response with everything
 */
export async function GET(req: NextRequest) {
    try {
        const contentId = req.nextUrl.searchParams.get('skillId');
        const type = req.nextUrl.searchParams.get('type') || 'SYLLABUS'; 
        const phase = req.nextUrl.searchParams.get('phase'); // 'narrative' | 'extras' | null

        if (!contentId) {
            return NextResponse.json({ error: 'Missing contentId' }, { status: 400 });
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
        const NOTE_STYLES = ['classic', 'magazine', 'slide', 'highlight', 'minimal'] as const;
        const sessionStyle = NOTE_STYLES[Math.floor(Math.random() * NOTE_STYLES.length)];

        /* ========== PHASE: EXTRAS ONLY ========== */
        if (phase === 'extras') {
            // Generate checkpoints + assessment (called after narrative is displayed)
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

        // 2. Generate Narrative (Mentor pulls authority context from DB automatically)
        let narrative = "";
        try {
            const generated = await NarrativeNoteRenderer.generateNarrative(topicName);
            narrative = generated || "";
        } catch (e) {
            console.error("[mastery/content] Narrative generation failed:", e);
            narrative = `### Generation Error\n\nThe Mentor could not generate a narrative for **${topicName}** at this time.\n\n> Please try again or contact support.`;
        }
        
        // 4. Split Narrative for Carousel
        let sections = narrative.split('###').filter(s => s.trim().length > 0).map(s => '### ' + s);
        if (sections.length === 0) sections = [narrative];

        /* ========== PHASE: NARRATIVE ONLY (fast path) ========== */
        if (phase === 'narrative') {
            const slides = sections.map(s => ({
                type: 'narrative' as const,
                content: s,
                style: sessionStyle,
            }));
            return NextResponse.json({
                narrativeSections: sections,
                slides,
                isDrafting,
                unitCode,
                sessionStyle,
                sectionCount: sections.length,
                stack: null,       // not yet loaded
                partial: true,     // signal to client: extras coming
            });
        }

        /* ========== LEGACY: FULL RESPONSE ========== */
        // 3. Generate Assessment + Checkpoints in parallel
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
            | { type: 'narrative'; content: string; style: string }
            | { type: 'checkpoint'; checkpoint: any };

        const interleaved: SlideItem[] = [];
        let cpIdx = 0;

        for (let i = 0; i < sections.length; i++) {
            interleaved.push({
                type: 'narrative',
                content: sections[i],
                style: sessionStyle,
            });
            if ((i + 1) % 2 === 0 && i < sections.length - 1 && cpIdx < checkpoints.length) {
                interleaved.push({ type: 'checkpoint', checkpoint: checkpoints[cpIdx] });
                cpIdx++;
            }
        }

        return NextResponse.json({
            narrativeSections: sections,
            slides: interleaved,
            isDrafting,
            unitCode,
            stack,
        });

    } catch (error) {
        console.error('Error fetching content:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
