import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { microSkills, skillOutlineMap, outlineTopics, vettedAuthorities } from '@/lib/db/schema';
import { eq, inArray, sql } from 'drizzle-orm';
import { verifyIdToken } from '@/lib/firebase/admin';
import { CIVIL_PROCEDURE_ACT, CIVIL_PROCEDURE_RULES, CIVIL_LITIGATION_CASES } from '@/lib/knowledge/kenyan-law-base';
import OpenAI from 'openai';

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

    const skillName = (skill as any).name || (skill as any).title || 'This skill';

    // 2. Try to get outline topics linked to this skill
    const outlineLinks = await db
      .select({
        topicId: skillOutlineMap.topicId,
      })
      .from(skillOutlineMap)
      .where(eq(skillOutlineMap.skillId, skillId));

    if (outlineLinks.length > 0) {
      const topicIds = outlineLinks.map(l => l.topicId);
      const topics = await db
        .select()
        .from(outlineTopics)
        .where(inArray(outlineTopics.id, topicIds));

      for (const topic of topics) {
        sections.push({
          id: topic.id,
          title: topic.title,
          content: topic.description || `Study the key concepts of ${topic.title}`,
        });
      }
    }

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

    // 4. Fall back to kenyan-law-base content if no outline topics
    if (sections.length === 0) {
      // Get relevant provisions for this unit
      const unitProvisions = [...CIVIL_PROCEDURE_ACT, ...CIVIL_PROCEDURE_RULES]
        .filter(p => p.unitId === skill.unitId);

      // Find provisions whose keywords match the skill
      const skillKeywords = skillName.toLowerCase().split(' ');
      const matchingProvisions = unitProvisions.filter(p => 
        p.keywords.some(k => skillKeywords.some(sk => 
          k.toLowerCase().includes(sk) || sk.includes(k.toLowerCase())
        ))
      );

      // Use matching provisions or all unit provisions
      const relevantProvisions = matchingProvisions.length > 0 
        ? matchingProvisions.slice(0, 5) 
        : unitProvisions.slice(0, 5);

      for (const provision of relevantProvisions) {
        sections.push({
          id: provision.id,
          title: `${provision.source} - ${provision.section}: ${provision.title}`,
          content: provision.content,
          source: `${provision.source}, ${provision.section}`,
          examTips: provision.examTips,
        });
      }

      // Add relevant case law
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

    // 5. If still empty, generate AI-powered study notes
    if (sections.length === 0) {
      const unitName = UNIT_NAMES[skill.unitId] || 'Legal Practice';
      
      try {
        const response = await openai.responses.create({
          model: 'gpt-4o-mini',
          instructions: `You are a Kenyan bar exam tutor. Generate concise, exam-focused study notes for a specific legal skill.

The student is preparing for the Kenya Council of Legal Education (CLE) bar examination.
Unit: ${unitName}
Skill: ${skill.title}

Generate 2-3 key study sections that cover:
1. Core legal principles and relevant statutory provisions (cite specific Kenya laws)
2. Practical application and how this skill appears in bar exams
3. Key cases or authorities (cite actual Kenyan cases if you know them, otherwise use "leading authority principles")

Keep each section focused and exam-relevant. Include specific citations where possible.

IMPORTANT: Return valid JSON only, no markdown, with this structure:
{
  "sections": [
    {
      "id": "section-1",
      "title": "Section Title",
      "content": "Content with **markdown** formatting",
      "source": "Optional source reference",
      "examTips": "Optional exam tip"
    }
  ]
}`,
          input: `Generate study notes for the skill: "${skillName}" in the ${unitName} unit.`,
        });

        const parsed = JSON.parse(response.output_text);
        if (parsed.sections && Array.isArray(parsed.sections)) {
          sections.push(...parsed.sections.map((s: any, i: number) => ({
            id: `ai-${i}`,
            title: s.title,
            content: s.content,
            source: s.source,
            examTips: s.examTips,
          })));
        }
      } catch (aiError) {
        console.error('AI notes generation error:', aiError);
      }
    }
    
    // 6. Final fallback if AI fails too
    if (sections.length === 0) {
      const unitName = UNIT_NAMES[skill.unitId] || 'Legal Practice';
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
