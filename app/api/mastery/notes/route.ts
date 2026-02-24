import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { microSkills, skillOutlineMap, outlineTopics, vettedAuthorities } from '@/lib/db/schema';
import { eq, inArray, sql } from 'drizzle-orm';
import { verifyIdToken } from '@/lib/firebase/admin';
import { CIVIL_PROCEDURE_ACT, CIVIL_PROCEDURE_RULES, CIVIL_LITIGATION_CASES } from '@/lib/knowledge/kenyan-law-base';
import OpenAI from 'openai';

const FAST_MODEL = process.env.OPENAI_FAST_MODEL || 'gpt-5.1-mini';
const GROUNDED_MODEL = process.env.OPENAI_GROUNDED_MODEL || 'gpt-5.1';
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Unit names for display
const UNIT_NAMES: Record<string, string> = {
  'atp-100': 'Civil Litigation',
  'atp-101': 'Criminal Litigation',
  'atp-102': 'Conveyancing',
  'atp-103': 'Family Law',
  'atp-104': 'Probate and Administration',
  'atp-105': 'Commercial Transactions',
  'atp-106': 'Legal Ethics',
  'atp-107': 'Legal Writing',
  'atp-108': 'Oral Advocacy',
};

// ============================================
// GET /api/mastery/notes?skillId=xxx
// ============================================

interface NotesSection {
  id: string;
  title: string;
  content: string;
  source?: string;
  examTips?: string;
}

interface NotesResponse {
  skillId: string;
  skillName: string;
  unitId: string;
  sections: NotesSection[];
  authorities: {
    id: string;
    type: string;
    title: string;
    citation?: string;
  }[];
}

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    await verifyIdToken(token);

    const skillId = req.nextUrl.searchParams.get('skillId');
    if (!skillId) {
      return NextResponse.json({ error: 'skillId required' }, { status: 400 });
    }

    // 1. Get skill details
    const [skill] = await db
      .select()
      .from(microSkills)
      .where(eq(microSkills.id, skillId))
      .limit(1);

    if (!skill) {
      return NextResponse.json({ error: 'Skill not found' }, { status: 404 });
    }

    const sections: NotesSection[] = [];
    const authorities: NotesResponse['authorities'] = [];

    const skillName: string = (skill as any).name || (skill as any).title || 'This skill';

      // 2. Pull outline topics linked to this skill (used as context for LLM-generated notes)
      const outlineLinks = await db
        .select({ topicId: skillOutlineMap.topicId })
        .from(skillOutlineMap)
        .where(eq(skillOutlineMap.skillId, skillId));

      const outlineTopicsForSkill = outlineLinks.length
        ? await db
            .select()
            .from(outlineTopics)
            .where(inArray(outlineTopics.id, outlineLinks.map(l => l.topicId)))
        : [];

    // 3. Get vetted authorities for this skill's unit
    const unitAuthorities = await db
      .select()
      .from(vettedAuthorities)
      .where(sql`${vettedAuthorities.unitIds} @> ARRAY[${skill.unitId}]::text[]`)
      .limit(10);

    for (const auth of unitAuthorities) {
      authorities.push({
        id: auth.id,
        type: auth.authorityType,
        title: auth.title,
        citation: auth.citation || undefined,
      });
    }

    // 4. Generate AI-powered notes using outlines + authorities as context
    const unitName = UNIT_NAMES[skill.unitId] || 'Legal Practice';
    try {
      const outlineContext = outlineTopicsForSkill.map(t => `- ${t.title}: ${t.description || ''}`).join('\n');
      const authorityContext = authorities
        .map(a => `${a.type}: ${a.title}${a.citation ? ` (${a.citation})` : ''}`)
        .join('\n');

      const response = await openai.responses.create({
        model: GROUNDED_MODEL,
        instructions: `You are a Kenyan bar exam tutor. Build a focused study session for the given skill.

Requirements:
- Use the provided outline topics as the coverage backbone (do not skip any).
- Tie every legal point to specific Kenya statutes/cases where possible.
- Keep it concise and exam-focused; avoid fluff.
- Include micro-drills inside each section: 1-2 short questions with brief answers.

Output JSON ONLY with this shape:
{
  "sections": [
    {
      "id": "section-1",
      "title": "Short title",
      "content": "Markdown content covering the outline topics, with **Key rules**, citations, practical application, and a 'Quick check' subsection with 1-2 Q&A",
      "source": "Optional source reference",
      "examTips": "Optional exam tip"
    }
  ]
}

Do not include any extra keys or prose outside JSON.`,
        input: `Unit: ${unitName}\nSkill: ${skillName}\nOutline topics (must cover all):\n${outlineContext || '- (no outline topics provided, use core syllabus expectations)'}\nKnown authorities to prefer:\n${authorityContext || '- none provided, use standard Kenya leading authorities where known.'}`,
      });

      const parsed = JSON.parse(response.output_text);
      if (parsed.sections && Array.isArray(parsed.sections) && parsed.sections.length > 0) {
        sections.push(
          ...parsed.sections.map((s: any, i: number) => ({
            id: s.id || `ai-${i}`,
            title: s.title,
            content: s.content,
            source: s.source,
            examTips: s.examTips,
          }))
        );
      }
    } catch (aiError) {
      console.error('AI notes generation error:', aiError);
    }

    // 5. Fallbacks if AI returns nothing
    if (sections.length === 0 && outlineTopicsForSkill.length > 0) {
      for (const topic of outlineTopicsForSkill) {
        sections.push({
          id: topic.id,
          title: topic.title,
          content: topic.description || `Study the key concepts of ${topic.title}`,
        });
      }
    }

    // 6. Civil-litigation base + cases fallback if still empty
    if (sections.length === 0) {
      const unitProvisions = [...CIVIL_PROCEDURE_ACT, ...CIVIL_PROCEDURE_RULES].filter(p => p.unitId === skill.unitId);
      const skillKeywords: string[] = skillName.toLowerCase().split(' ');
      const matchingProvisions = unitProvisions.filter(p =>
        p.keywords.some(k => skillKeywords.some(sk => k.toLowerCase().includes(sk) || sk.includes(k.toLowerCase())))
      );

      const relevantProvisions = matchingProvisions.length > 0 ? matchingProvisions.slice(0, 5) : unitProvisions.slice(0, 5);

      for (const provision of relevantProvisions) {
        sections.push({
          id: provision.id,
          title: `${provision.source} - ${provision.section}: ${provision.title}`,
          content: provision.content,
          source: `${provision.source}, ${provision.section}`,
          examTips: provision.examTips,
        });
      }

      const caseLaw = CIVIL_LITIGATION_CASES.filter(c => c.unitId === skill.unitId).slice(0, 3);
      for (const caseItem of caseLaw) {
        sections.push({
          id: caseItem.id,
          title: `${caseItem.name} ${caseItem.citation}`,
          content: `**Facts:** ${caseItem.facts}\n\n**Issue:** ${caseItem.issue}\n\n**Holding:** ${caseItem.holding}\n\n**Ratio Decidendi:** ${caseItem.ratio}\n\n**Significance:** ${caseItem.significance}`,
          source: `${caseItem.court} (${caseItem.year})`,
        });

        authorities.push({
          id: caseItem.id,
          type: 'CASE',
          title: caseItem.name,
          citation: caseItem.citation,
        });
      }
    }

    // 7. Final safety fallback if absolutely nothing
    if (sections.length === 0) {
      sections.push({
        id: 'fallback-1',
        title: `Study Notes: ${skillName}`,
        content: `**${skillName}**\n\nThis skill is part of the ${unitName} unit in the Kenya Bar Examination.\n\n**Key Focus Areas:**\n- Understand the relevant statutory provisions\n- Review applicable case law and precedents\n- Practice applying the principles to factual scenarios\n\n**Study Tips:**\n- Focus on the Constitution of Kenya 2010 where relevant\n- Review any statutory requirements that govern this area\n- Practice writing structured legal answers`,
        examTips: 'Always cite specific provisions and use IRAC method (Issue, Rule, Application, Conclusion).',
      });
    }

    return NextResponse.json({
      skillId: skill.id,
      skillName,
      unitId: skill.unitId,
      sections,
      authorities,
    } satisfies NotesResponse);

  } catch (error) {
    console.error('Error fetching skill notes:', error);
    return NextResponse.json(
      { error: 'Failed to fetch notes' },
      { status: 500 }
    );
  }
}
