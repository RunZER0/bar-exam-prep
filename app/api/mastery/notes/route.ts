import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { microSkills, skillOutlineMap, outlineTopics, vettedAuthorities, authorityRecords } from '@/lib/db/schema';
import { eq, inArray, sql, desc, or, ilike } from 'drizzle-orm';
import { verifyIdToken } from '@/lib/firebase/admin';
import OpenAI from 'openai';
import { MENTOR_MODEL, getOpenAIKey } from '@/lib/ai/model-config';

const GROUNDED_MODEL = MENTOR_MODEL;
const AI_NOTES_TIMEOUT_MS = Number(process.env.NOTES_AI_TIMEOUT_MS || 15000);
const openai = new OpenAI({ apiKey: getOpenAIKey() });

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
    url?: string;
    snippet?: string;
  }[];
}

async function fetchLocalAuthorities(searchTerm: string): Promise<NotesResponse['authorities']> {
  if (!searchTerm) return [];

  const trimmed = searchTerm.trim().slice(0, 100);
  if (!trimmed) return [];

  // Determine if we should prioritize cases or statutes based on keywords
  const isStatuteQuery = /act|bill|constitution|order|rule/i.test(trimmed);
  const isCaseQuery = /v\.|re\s|appeal/i.test(trimmed);

  try {
    // We use full-text search capability if available, or ILIKE as fallback
    // Note: 'english' config is standard, can be adjusted for Kenyan law contexts if needed
    const searchCondition = sql`to_tsvector('english', ${authorityRecords.title} || ' ' || COALESCE(${authorityRecords.rawText}, '')) @@ websearch_to_tsquery('english', ${trimmed})`;
    
    // Improved precise matching using ILIKE for titles/citations as well
    const titleMatch = or(
      ilike(authorityRecords.title, `%${trimmed}%`),
      ilike(authorityRecords.citation, `%${trimmed}%`)
    );

    const authorities = await db
      .select({
        id: authorityRecords.id,
        type: authorityRecords.sourceType,
        title: authorityRecords.title,
        citation: authorityRecords.citation,
        url: authorityRecords.canonicalUrl,
        rawText: authorityRecords.rawText,
        rank: sql<number>`ts_rank(to_tsvector('english', ${authorityRecords.title} || ' ' || COALESCE(${authorityRecords.rawText}, '')), websearch_to_tsquery('english', ${trimmed}))`,
      })
      .from(authorityRecords)
      .where(or(searchCondition, titleMatch))
      .orderBy((t) => desc(t.rank))
      .limit(8);

    if (authorities.length === 0) {
      console.log(`[LocalAuthority] No authorities found for term: "${trimmed}"`);
    } else {
      console.log(`[LocalAuthority] Found ${authorities.length} authorities for term: "${trimmed}"`);
    }

    return authorities.map(record => ({
      id: record.id,
      type: record.type,
      title: record.title,
      citation: record.citation || undefined,
      url: record.url,
      snippet: record.rawText ? record.rawText.slice(0, 300) + '...' : undefined
    }));

  } catch (error) {
    console.error('Local authority lookup failed:', error);
    // Silent fallback to empty array so the page doesn't crash
    return [];
  }
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
    const authorityKeys = new Set<string>();

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

    // Seed response immediately with outline-derived sections to avoid blank UI while AI runs.
    for (const topic of outlineTopicsForSkill) {
      sections.push({
        id: topic.id,
        title: topic.title,
        content: topic.description || `Study the key concepts of ${topic.title}`,
        source: 'Course outline',
      });
    }

    // 3. Get vetted authorities for this skill's unit
    const unitAuthorities = await db
      .select()
      .from(vettedAuthorities)
      .where(sql`${vettedAuthorities.unitIds} @> ARRAY[${skill.unitId}]::text[]`)
      .limit(10);

    for (const auth of unitAuthorities) {
      const key = auth.sourceUrl || auth.id;
      if (key && authorityKeys.has(key)) continue;
      if (key) authorityKeys.add(key);

      authorities.push({
        id: key || auth.id,
        type: auth.authorityType,
        title: auth.title,
        citation: auth.citation || undefined,
        url: auth.sourceUrl || undefined,
      });
    }

    // 3b. Pull kenyalaw.org cases/statutes from Local Authority Records (full text search)
    const localSearchTerm = [skillName, outlineTopicsForSkill[0]?.title || '']
      .filter(Boolean)
      .join(' ') || skillName;

    const localAuthorities = await fetchLocalAuthorities(localSearchTerm);

    for (const auth of localAuthorities) {
      const key = auth.url || auth.id;
      // Prevent duplicates
      // @ts-ignore
      if (!key || authorityKeys.has(key)) continue;
      // @ts-ignore
      authorityKeys.add(key);
      
      // Add snippet to the authority object for AI context
      authorities.push({
        id: auth.id,
        type: auth.type,
        title: auth.title,
        citation: auth.citation,
        url: auth.url,
        snippet: auth.snippet
      });
    }

    // 4. Generate AI-powered notes using outlines + authorities as context (best-effort, time-boxed)
    const unitName = UNIT_NAMES[skill.unitId] || 'Legal Practice';
    try {
      const outlineContext = outlineTopicsForSkill.map(t => `- ${t.title}: ${t.description || ''}`).join('\n');
      const authorityContext = authorities
        .map(a => `Source: ${a.type}: ${a.title}${a.citation ? ` (${a.citation})` : ''}${a.url ? ` [${a.url}]` : ''}\nSnippet/Text:\n"""${a.snippet || '(no text available)'}"""\n`)
        .join('\n---\n');

      const aiCall = openai.chat.completions.create({
        model: GROUNDED_MODEL,
        messages: [
          { role: "system", content: `You are a Kenyan bar exam tutor. Build a comprehensive study session for the given skill. The student needs to learn this topic deeply before practicing.

Requirements:
- Use the provided outline topics as the coverage backbone (do not skip any).
- Tie every legal point to specific Kenya statutes/cases.
- USE THE PROVIDED SOURCE SNIPPETS/TEXT VERBATIM WHERE POSSIBLE for rules and ratios. If a snippet is provided, credit it.
- Provide DETAILED explanations of rules, exceptions, and practical applications. Do not summarize or provide "stubs".
- Include micro-drills inside each section: 1-2 short questions with brief answers to reinforce learning.
- Prefer the provided authority URLs; if you cannot find a match, say so rather than inventing a citation.
- If a needed authority is missing, prioritize real kenyalaw.org URLs and include the direct link when known.

Output JSON ONLY with this shape:
{
  "sections": [
    {
      "id": "section-1",
      "title": "Short title",
      "content": "Comprehensive Markdown content covering the outline topics in depth, with **Key rules**, citations, practical application, and a 'Quick check' subsection with 1-2 Q&A",
      "source": "Optional source reference",
      "examTips": "Optional exam tip"
    }
  ]
}

Do not include any extra keys or prose outside JSON.` },
          { role: "user", content: `Unit: ${unitName}\nSkill: ${skillName}\nOutline topics (must cover all):\n${outlineContext || '- (no outline topics provided, use core syllabus expectations)'}\n\nAvailable authoritative sources (use these for grounding):\n${authorityContext || '- none provided, use standard Kenya leading authorities where known.'}` }
        ],
        response_format: { type: "json_object" }
      });

      const aiResponse = await Promise.race([
        aiCall,
        new Promise((_, reject) => setTimeout(() => reject(new Error('AI notes timeout')), AI_NOTES_TIMEOUT_MS)),
      ]);

      // @ts-expect-error fine: Promise.race union
      const content = aiResponse.choices[0].message.content || '{}';
      const parsed = JSON.parse(content);
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

    // 5. Final minimal fallback (keep UI alive; no civil stubs)
    if (sections.length === 0) {
      sections.push({
        id: 'fallback-1',
        title: `Core Principles: ${skillName}`,
        content: `### Essential Legal Framework for ${skillName}\n\nTo master this skill for the bar exam, you must:\n\n1. **Identify the Statutory Basis**: Locate the specific enabling provisions in the Constitution of Kenya 2010 or relevant Acts.\n2. **Cite Leading Case Law**: Apply the ratio decidendi from key Supreme Court and Court of Appeal decisions.\n3. **Apply the Rules**: Use the IRAC method (Issue, Rule, Application, Conclusion) to structure your analysis.\n\n*Note: Detailed notes are being generated. Please consult the main course text and statutes alongside this exercise.*`,
        examTips: 'Anchor every legal argument to a specific Section or Article. General knowledge is not enough.',
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
