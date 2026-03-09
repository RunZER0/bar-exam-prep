import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { microSkills, skillOutlineMap, outlineTopics, vettedAuthorities, authorityRecords } from '@/lib/db/schema';
import { eq, inArray, sql, desc, or, ilike } from 'drizzle-orm';
import { verifyIdToken } from '@/lib/firebase/admin';
import OpenAI from 'openai';
import { MENTOR_MODEL, getOpenAIKey } from '@/lib/ai/model-config';
import { searchKnowledgeBaseSemantic } from '@/lib/ai/embedding-service';
import { neon } from '@neondatabase/serverless';

const rawSql = neon(process.env.DATABASE_URL!);
const GROUNDED_MODEL = MENTOR_MODEL;
const AI_NOTES_TIMEOUT_MS = Number(process.env.NOTES_AI_TIMEOUT_MS || 15000);
const CACHE_TTL_DAYS = 7; // Cache notes for 7 days
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
  }

  // Fallback: Query Neon cases & statutes tables (migrated from Supabase)
  try {
    console.log(`[LocalAuthority] Querying Neon cases/statutes for: "${trimmed}"`);

    const searchWords = trimmed.split(/\s+/).filter(w => w.length > 3).slice(0, 4);
    const pattern = `%${searchWords.join('%')}%`;

    const results: NotesResponse['authorities'] = [];

    const [casesResult, statutesResult] = await Promise.all([
      rawSql`
        SELECT id, title, citation, court_code, url, year
        FROM cases
        WHERE title ILIKE ${pattern} OR parties ILIKE ${pattern}
        ORDER BY year DESC NULLS LAST
        LIMIT 5
      `,
      rawSql`
        SELECT id, name, chapter, url, full_text
        FROM statutes
        WHERE name ILIKE ${pattern} OR chapter ILIKE ${pattern}
        LIMIT 3
      `,
    ]);

    for (const s of statutesResult) {
      results.push({
        id: String(s.id),
        type: 'STATUTE',
        title: s.name || s.chapter || 'Statute',
        citation: s.chapter || undefined,
        url: s.url,
        snippet: s.full_text ? s.full_text.slice(0, 500) + '...' : undefined,
      });
    }

    for (const c of casesResult) {
      results.push({
        id: String(c.id),
        type: 'CASE',
        title: c.title || c.citation || 'Case',
        citation: c.citation || undefined,
        url: c.url,
      });
    }

    if (results.length > 0) {
      console.log(`[LocalAuthority] Neon returned ${results.length} authorities for "${trimmed}"`);
      return results;
    }
  } catch (e) {
    console.warn('[LocalAuthority] Neon cases/statutes fallback failed:', e);
  }

  return [];
}

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await verifyIdToken(token);
    const userId = decodedToken.uid;

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

    const skillName: string = (skill as any).name || (skill as any).title || 'This skill';

    // === SHARED CACHE CHECK ===
    // Auto-create cache table if not exists
    await rawSql`
      CREATE TABLE IF NOT EXISTS cached_skill_notes (
        skill_id TEXT PRIMARY KEY,
        skill_name TEXT NOT NULL,
        unit_id TEXT NOT NULL,
        sections JSONB NOT NULL DEFAULT '[]',
        authorities JSONB NOT NULL DEFAULT '[]',
        generated_at TIMESTAMP DEFAULT NOW() NOT NULL
      )
    `;
    await rawSql`
      CREATE TABLE IF NOT EXISTS user_note_stamps (
        user_id TEXT NOT NULL,
        skill_id TEXT NOT NULL,
        learned_at TIMESTAMP DEFAULT NOW() NOT NULL,
        PRIMARY KEY (user_id, skill_id)
      )
    `;

    // Check for cached notes (within 7 days)
    const [cached] = await rawSql`
      SELECT * FROM cached_skill_notes 
      WHERE skill_id = ${skillId} 
        AND generated_at > NOW() - INTERVAL '7 days'
    `;

    if (cached) {
      // Check if user has "learned" stamp
      const [stamp] = await rawSql`
        SELECT learned_at FROM user_note_stamps WHERE user_id = ${userId} AND skill_id = ${skillId}
      `;

      console.log(`[Notes] Cache hit for skill: ${skillId}`);
      return NextResponse.json({
        skillId: cached.skill_id,
        skillName: cached.skill_name,
        unitId: cached.unit_id,
        sections: cached.sections,
        authorities: cached.authorities,
        cached: true,
        learned: stamp ? true : false,
        learnedAt: stamp?.learned_at || null,
      });
    }

    // === END CACHE CHECK — Generate fresh notes ===

    // ═══════════════════════════════════════════════════════════
    // PRE-BUILT NOTES: Try to find matching pre-built notes first
    // Maps micro-skill → syllabus node by fuzzy name matching
    // ═══════════════════════════════════════════════════════════
    try {
      // Search for a matching syllabus node by skill name
      const searchTerm = `%${skillName.split(/\s+/).slice(0, 4).join('%')}%`;
      // Multi-tier matching: exact name → ILIKE contains → fuzzy word match
      const exactName = skillName.trim();
      let matchingNodes = await rawSql`
        SELECT id, topic_name, subtopic_name, unit_code,
          CASE 
            WHEN topic_name = ${exactName} OR subtopic_name = ${exactName} THEN 1
            WHEN topic_name ILIKE ${exactName} OR subtopic_name ILIKE ${exactName} THEN 2
            WHEN topic_name ILIKE ${'%' + exactName + '%'} OR subtopic_name ILIKE ${'%' + exactName + '%'} THEN 3
            ELSE 4
          END as match_rank
        FROM syllabus_nodes
        WHERE (topic_name ILIKE ${'%' + exactName + '%'} OR subtopic_name ILIKE ${'%' + exactName + '%'})
          AND unit_code = ${skill.unitId}
        ORDER BY match_rank ASC
        LIMIT 1
      `;

      // Fallback: fuzzy word matching
      if (matchingNodes.length === 0) {
        matchingNodes = await rawSql`
          SELECT id, topic_name, subtopic_name, unit_code
          FROM syllabus_nodes
          WHERE (topic_name ILIKE ${searchTerm} OR subtopic_name ILIKE ${searchTerm})
            AND unit_code = ${skill.unitId}
          LIMIT 1
        `;
      }

      if (matchingNodes.length > 0) {
        const nodeId = matchingNodes[0].id;

        // Get DB user ID for version tracking
        let dbUserId: string | null = null;
        try {
          const [u] = await rawSql`SELECT id FROM users WHERE firebase_uid = ${userId} LIMIT 1`;
          dbUserId = u?.id || null;
        } catch { /* non-critical */ }

        // Determine assigned version (1-3 for mastery)
        let assignedVersion: number | null = null;
        if (dbUserId) {
          const [existing] = await rawSql`
            SELECT mastery_version FROM user_note_versions
            WHERE user_id = ${dbUserId}::uuid AND node_id = ${nodeId}::uuid
          `;
          if (existing?.mastery_version) assignedVersion = existing.mastery_version;
        }

        if (!assignedVersion) {
          assignedVersion = Math.floor(Math.random() * 3) + 1;
          if (dbUserId) {
            try {
              await rawSql`
                INSERT INTO user_note_versions (user_id, node_id, mastery_version, mastery_read_at)
                VALUES (${dbUserId}::uuid, ${nodeId}::uuid, ${assignedVersion}, NOW())
                ON CONFLICT (user_id, node_id) DO UPDATE SET
                  mastery_version = COALESCE(user_note_versions.mastery_version, ${assignedVersion}),
                  mastery_read_at = NOW(),
                  updated_at = NOW()
              `;
            } catch { /* non-critical */ }
          }
        }

        // Fetch pre-built notes
        const [prebuilt] = await rawSql`
          SELECT narrative_markdown, sections_json, authorities_json, personality
          FROM prebuilt_notes
          WHERE node_id = ${nodeId}::uuid 
            AND version_number = ${assignedVersion}
            AND is_active = true
          LIMIT 1
        `;

        if (prebuilt?.narrative_markdown) {
          // Convert pre-built markdown into sections format expected by UI
          const mdSections = prebuilt.narrative_markdown
            .split(/(?=^### )/m)
            .filter((s: string) => s.trim().length > 0);

          const sections: NotesSection[] = mdSections.map((s: string, i: number) => {
            const titleMatch = s.match(/^###\s+(.+)/m);
            // Extract exam tip if present (catch **Exam Tip:** and *Exam pitfall:* variants)
            const examTipMatch = s.match(/\*{1,2}Exam\s+(?:Tip|pitfall):\*{1,2}\s*(.+)/i);
            const examTips = examTipMatch ? examTipMatch[1].trim() : undefined;
            const content = examTips
              ? s.replace(/\*{1,2}Exam\s+(?:Tip|pitfall):\*{1,2}\s*.+/i, '').trim()
              : s.trim();
            return {
              id: `prebuilt-${i}`,
              title: titleMatch ? titleMatch[1].trim() : `Section ${i + 1}`,
              content,
              source: `Pre-built v${assignedVersion} (${prebuilt.personality || 'authoritative'})`,
              ...(examTips && { examTips }),
            };
          });

          // Parse authorities from pre-built JSON
          let authorities: NotesResponse['authorities'] = [];
          if (prebuilt.authorities_json) {
            try {
              const authData = typeof prebuilt.authorities_json === 'string' 
                ? JSON.parse(prebuilt.authorities_json) 
                : prebuilt.authorities_json;
              authorities = (authData || []).map((a: any) => ({
                id: a.id || a.title,
                type: a.type || 'CASE',
                title: a.title,
                citation: a.citation,
                url: a.url,
                snippet: a.snippet,
              }));
            } catch { /* use empty */ }
          }

          // Check if user has "learned" stamp
          const [stamp] = await rawSql`
            SELECT learned_at FROM user_note_stamps WHERE user_id = ${userId} AND skill_id = ${skillId}
          `;

          console.log(`[Notes] Pre-built v${assignedVersion} served for skill: ${skillId} (node: ${nodeId})`);
          return NextResponse.json({
            skillId: skill.id,
            skillName,
            unitId: skill.unitId,
            sections,
            authorities,
            cached: true,
            prebuilt: true,
            learned: stamp ? true : false,
            learnedAt: stamp?.learned_at || null,
          });
        }
      }
    } catch (e) {
      console.warn('[Notes] Pre-built lookup failed, falling back to AI:', e);
    }

    // ═══════════════════════════════════════════════════════════
    // FALLBACK: Original AI generation (only if no pre-built notes exist)
    // ═══════════════════════════════════════════════════════════

    const sections: NotesSection[] = [];
    const authorities: NotesResponse['authorities'] = [];
    const authorityKeys = new Set<string>();

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

    // 4. Generate AI-powered notes using outlines + authorities + knowledge base as context
    const unitName = UNIT_NAMES[skill.unitId] || 'Legal Practice';
    
    // 4a. Retrieve semantic knowledge base context
    let kbContext = '';
    try {
      const kbResults = await searchKnowledgeBaseSemantic(
        `${skillName} ${outlineTopicsForSkill.map(t => t.title).join(' ')}`,
        { topK: 5, unitId: skill.unitId }
      );
      if (kbResults.length > 0) {
        kbContext = kbResults.map(kb => 
          `[KB: ${kb.source}${kb.citation ? ` — ${kb.citation}` : ''}] ${kb.title}:\n${kb.content}`
        ).join('\n---\n');
        console.log(`[Notes] Retrieved ${kbResults.length} knowledge base entries for "${skillName}"`);
      }
    } catch {
      // Semantic search not available — continue without
    }

    try {
      const outlineContext = outlineTopicsForSkill.map(t => `- ${t.title}: ${t.description || ''}`).join('\n');
      const authorityContext = authorities
        .map(a => `Source: ${a.type}: ${a.title}${a.citation ? ` (${a.citation})` : ''}${a.url ? ` [${a.url}]` : ''}\nSnippet/Text:\n"""${a.snippet || '(no text available)'}"""\n`)
        .join('\n---\n');

      const aiCall = openai.responses.create({
        model: GROUNDED_MODEL,
        instructions: `You are a Kenyan bar exam tutor. Build a comprehensive study session for the given skill. The student needs to learn this topic deeply before practicing.

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

Do not include any extra keys or prose outside JSON.`,
        input: `Unit: ${unitName}\nSkill: ${skillName}\nOutline topics (must cover all):\n${outlineContext || '- (no outline topics provided, use core syllabus expectations)'}\n\n${kbContext ? `Knowledge Base (verified provisions & case law — use these first):\n${kbContext}\n\n` : ''}Available authoritative sources (use these for grounding):\n${authorityContext || '- none provided, use standard Kenya leading authorities where known.'}`,
        tools: [{ type: 'web_search_preview' as const }],
        text: { format: { type: 'json_object' } },
      });

      const aiResponse = await Promise.race([
        aiCall,
        new Promise((_, reject) => setTimeout(() => reject(new Error('AI notes timeout')), AI_NOTES_TIMEOUT_MS)),
      ]);

      // @ts-expect-error fine: Promise.race union
      const content = aiResponse.output_text || '{}';
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

    // === CACHE THE GENERATED NOTES (shared across all users) ===
    const notesPayload: NotesResponse = {
      skillId: skill.id,
      skillName,
      unitId: skill.unitId,
      sections,
      authorities,
    };

    try {
      await rawSql`
        INSERT INTO cached_skill_notes (skill_id, skill_name, unit_id, sections, authorities, generated_at)
        VALUES (${skill.id}, ${skillName}, ${skill.unitId}, ${JSON.stringify(sections)}::jsonb, ${JSON.stringify(authorities)}::jsonb, NOW())
        ON CONFLICT (skill_id) DO UPDATE SET
          sections = EXCLUDED.sections,
          authorities = EXCLUDED.authorities,
          generated_at = NOW()
      `;
      console.log(`[Notes] Cached notes for skill: ${skill.id}`);
    } catch (cacheErr) {
      console.warn('[Notes] Cache write failed (non-critical):', cacheErr);
    }

    return NextResponse.json({
      ...notesPayload,
      cached: false,
      learned: false,
      learnedAt: null,
    });

  } catch (error) {
    console.error('Error fetching skill notes:', error);
    return NextResponse.json(
      { error: 'Failed to fetch notes' },
      { status: 500 }
    );
  }
}

// POST - Mark a skill's notes as "learned" (stamp)
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await verifyIdToken(token);
    const userId = decodedToken.uid;

    const { skillId, action } = await req.json();
    if (!skillId) {
      return NextResponse.json({ error: 'skillId required' }, { status: 400 });
    }

    // Auto-create table if needed
    await rawSql`
      CREATE TABLE IF NOT EXISTS user_note_stamps (
        user_id TEXT NOT NULL,
        skill_id TEXT NOT NULL,
        learned_at TIMESTAMP DEFAULT NOW() NOT NULL,
        PRIMARY KEY (user_id, skill_id)
      )
    `;

    if (action === 'unlearn') {
      await rawSql`DELETE FROM user_note_stamps WHERE user_id = ${userId} AND skill_id = ${skillId}`;
      return NextResponse.json({ learned: false });
    }

    // Default: mark as learned
    await rawSql`
      INSERT INTO user_note_stamps (user_id, skill_id, learned_at)
      VALUES (${userId}, ${skillId}, NOW())
      ON CONFLICT (user_id, skill_id) DO UPDATE SET learned_at = NOW()
    `;

    return NextResponse.json({ learned: true, learnedAt: new Date().toISOString() });
  } catch (error) {
    console.error('Error stamping notes:', error);
    return NextResponse.json({ error: 'Failed to stamp notes' }, { status: 500 });
  }
}
