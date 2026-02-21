import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { microSkills, skillOutlineMap, outlineTopics, vettedAuthorities } from '@/lib/db/schema';
import { eq, inArray, sql } from 'drizzle-orm';
import { verifyIdToken } from '@/lib/firebase/admin';
import { CIVIL_PROCEDURE_ACT, CIVIL_PROCEDURE_RULES, CIVIL_LITIGATION_CASES } from '@/lib/knowledge/kenyan-law-base';

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
      const skillKeywords = skill.title.toLowerCase().split(' ');
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

    // 5. If still empty, generate a helpful fallback
    if (sections.length === 0) {
      sections.push({
        id: 'fallback-1',
        title: `Study Notes: ${skill.title}`,
        content: `This skill covers: ${skill.description || skill.title}\n\nFocus on understanding the legal principles, relevant statutory provisions, and how they apply in practice scenarios.`,
      });
    }

    return NextResponse.json({
      skillId: skill.id,
      skillName: skill.title,
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
