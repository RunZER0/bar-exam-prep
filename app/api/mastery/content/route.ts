import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { microSkills, witnesses, syllabusNodes } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { NarrativeNoteRenderer } from '@/lib/services/narrative-renderer';
import { AssessmentGenerator } from '@/lib/services/assessment-generator';
import { CheckpointGenerator } from '@/lib/services/checkpoint-generator';

/**
 * GET /api/mastery/content
 * Returns the "Deep Dive" content (Narrative) and Assessment Stack for a skill/node.
 * Supports: SYLLABUS (Syllabus Node), SKILL (MicroSkill), WITNESS (Remediation)
 */
export async function GET(req: NextRequest) {
    try {
        const contentId = req.nextUrl.searchParams.get('skillId');
        const type = req.nextUrl.searchParams.get('type') || 'SYLLABUS'; 

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

        // 2. Generate Narrative (Mentor pulls authority context from DB automatically)
        let narrative = "";
        try {
            const generated = await NarrativeNoteRenderer.generateNarrative(topicName);
            narrative = generated || "";
        } catch (e) {
            console.error("[mastery/content] Narrative generation failed:", e);
            narrative = `### Generation Error\n\nThe Mentor could not generate a narrative for **${topicName}** at this time.\n\n> Please try again or contact support.`;
        }
        
        // 3. Generate Assessment Stack (now async with real AI)
        let stack = null;
        try {
            stack = await AssessmentGenerator.generateStack(topicName, { unitCode, isDrafting });
        } catch (e) {
            console.error("[mastery/content] Assessment generation failed:", e);
            stack = { topic: topicName, stack: [] };
        }

        // 4. Split Narrative for Carousel & interleave checkpoint questions
        let sections = narrative.split('###').filter(s => s.trim().length > 0).map(s => '### ' + s);
        if (sections.length === 0) sections = [narrative];

        // 5. Generate inline checkpoint questions and build interleaved slides
        let checkpoints: any[] = [];
        try {
            checkpoints = await CheckpointGenerator.generate(topicName, sections.length, { unitCode });
        } catch (e) {
            console.error('[mastery/content] Checkpoint generation failed:', e);
        }

        // Assign visual styles to narrative slides (cycle through 5 styles)
        const NOTE_STYLES = ['classic', 'magazine', 'slide', 'highlight', 'minimal'] as const;
        type SlideItem = 
            | { type: 'narrative'; content: string; style: string }
            | { type: 'checkpoint'; checkpoint: any };

        const interleaved: SlideItem[] = [];
        let cpIdx = 0;

        for (let i = 0; i < sections.length; i++) {
            interleaved.push({
                type: 'narrative',
                content: sections[i],
                style: NOTE_STYLES[i % NOTE_STYLES.length],
            });
            // Insert a checkpoint after every 2nd narrative slide (but not after the last)
            if ((i + 1) % 2 === 0 && i < sections.length - 1 && cpIdx < checkpoints.length) {
                interleaved.push({ type: 'checkpoint', checkpoint: checkpoints[cpIdx] });
                cpIdx++;
            }
        }

        return NextResponse.json({
            narrativeSections: sections,      // backwards compat
            slides: interleaved,              // new interleaved format
            isDrafting,
            unitCode,
            stack,
        });

    } catch (error) {
        console.error('Error fetching content:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
