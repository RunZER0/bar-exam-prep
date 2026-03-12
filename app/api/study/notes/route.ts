import { NextRequest, NextResponse } from 'next/server';
import { withAuth, type AuthUser } from '@/lib/auth/middleware';
import OpenAI from 'openai';
import { neon } from '@neondatabase/serverless';
import { MINI_MODEL } from '@/lib/ai/model-config';

// Lazy init to avoid cold-start race conditions with env vars
let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return _openai;
}
let _rawSql: ReturnType<typeof neon> | null = null;
function getRawSql() {
  if (!_rawSql) _rawSql = neon(process.env.DATABASE_URL!);
  return _rawSql;
}
// Helper: neon tagged templates return FullQueryResults which may not have .length in strict mode
const sql = async (...args: Parameters<ReturnType<typeof neon>>) => {
  const result = await getRawSql()(...args);
  return result as any[];
};

/**
 * POST /api/study/notes
 * 
 * COST-SAVING OVERHAUL: Serves pre-built notes from the database instead of
 * generating live with AI. 5 versions per syllabus node:
 *   - Versions 1-3: Shared with Mastery Hub (authoritative, mentor, analyst)
 *   - Versions 4-5: Study Hub only (structured guide, deep dive)
 * 
 * Version affinity: If user already read a topic in Mastery Hub,
 * they see the SAME version here. If they haven't, they get version 4 or 5.
 * 
 * Fallback: If no pre-built notes exist, falls back to gpt-5.2-mini live generation.
 * Custom prompts always use live AI (bypass pre-built).
 */
async function handlePost(req: NextRequest, user: AuthUser) {
  const body = await req.json();
  const { topicName, unitName, unitId, depth = 'standard', withAssessment = false, customPrompt, nodeId } = body;

  if (!topicName && !customPrompt) {
    return NextResponse.json({ error: 'Topic name or custom prompt required' }, { status: 400 });
  }

  // Custom prompts bypass pre-built notes entirely
  if (customPrompt) {
    return generateLiveNotes({ topicContext: customPrompt, unitName, depth, withAssessment, topicName });
  }

  // ═══════════════════════════════════════════════════════════
  // PRE-BUILT NOTES: Find matching syllabus node and serve pre-built
  // ═══════════════════════════════════════════════════════════
  try {
    // Get DB user ID
    let dbUserId: string | null = null;
    try {
      dbUserId = user.id || null;
    } catch { /* non-critical */ }

    // Find matching syllabus node (by nodeId if provided, or fuzzy match on topicName)
    let matchedNodeId: string | null = nodeId || null;
    
    if (!matchedNodeId && topicName) {
      // Multi-tier matching strategy for maximum reliability:
      //   Tier 1: Exact match on topic_name or subtopic_name
      //   Tier 2: ILIKE with the full topic name
      //   Tier 3: Reverse match (node name contained in search term)
      //   Tier 4: Fuzzy word matching with OR (any word matches)
      //   Tier 5: Individual keyword search (last resort)
      
      const exactName = topicName.trim();
      const unitFilter = unitId
        ? `UPPER(REPLACE(unit_code, '-', '')) = UPPER(REPLACE('${unitId.replace(/'/g, "''")}', '-', ''))`
        : 'TRUE';
      
      // Tier 1+2: Exact and substring match
      const exactMatches = unitId
        ? await sql`
            SELECT id, 
              CASE 
                WHEN topic_name = ${exactName} OR subtopic_name = ${exactName} THEN 1
                WHEN topic_name || ': ' || COALESCE(subtopic_name, '') = ${exactName} THEN 1
                WHEN topic_name ILIKE ${exactName} OR subtopic_name ILIKE ${exactName} THEN 2
                WHEN topic_name ILIKE ${'%' + exactName + '%'} OR subtopic_name ILIKE ${'%' + exactName + '%'} THEN 3
                ELSE 4
              END as match_rank
            FROM syllabus_nodes
            WHERE UPPER(REPLACE(unit_code, '-', '')) = UPPER(REPLACE(${unitId}, '-', ''))
              AND (
                topic_name ILIKE ${'%' + exactName + '%'} 
                OR subtopic_name ILIKE ${'%' + exactName + '%'}
                OR topic_name || ': ' || COALESCE(subtopic_name, '') ILIKE ${'%' + exactName + '%'}
              )
            ORDER BY match_rank ASC
            LIMIT 1
          `
        : await sql`
            SELECT id, 
              CASE 
                WHEN topic_name = ${exactName} OR subtopic_name = ${exactName} THEN 1
                WHEN topic_name || ': ' || COALESCE(subtopic_name, '') = ${exactName} THEN 1
                WHEN topic_name ILIKE ${exactName} OR subtopic_name ILIKE ${exactName} THEN 2
                WHEN topic_name ILIKE ${'%' + exactName + '%'} OR subtopic_name ILIKE ${'%' + exactName + '%'} THEN 3
                ELSE 4
              END as match_rank
            FROM syllabus_nodes
            WHERE topic_name ILIKE ${'%' + exactName + '%'} 
               OR subtopic_name ILIKE ${'%' + exactName + '%'}
               OR topic_name || ': ' || COALESCE(subtopic_name, '') ILIKE ${'%' + exactName + '%'}
            ORDER BY match_rank ASC
            LIMIT 1
          `;
      
      if (exactMatches.length > 0) {
        matchedNodeId = exactMatches[0].id;
      } else {
        // Tier 3: Reverse match — node topic_name contained in the search term
        const cleanName = exactName.replace(/^Case:\s*/i, '').trim();
        const reverseMatches = unitId
          ? await sql`
              SELECT id FROM syllabus_nodes
              WHERE UPPER(REPLACE(unit_code, '-', '')) = UPPER(REPLACE(${unitId}, '-', ''))
                AND LENGTH(topic_name) >= 4
                AND (${exactName} ILIKE '%' || topic_name || '%'
                  OR ${cleanName} ILIKE '%' || topic_name || '%')
              ORDER BY LENGTH(topic_name) DESC
              LIMIT 1
            `
          : await sql`
              SELECT id FROM syllabus_nodes
              WHERE LENGTH(topic_name) >= 4
                AND (${exactName} ILIKE '%' || topic_name || '%'
                  OR ${cleanName} ILIKE '%' || topic_name || '%')
              ORDER BY LENGTH(topic_name) DESC
              LIMIT 1
            `;
        if (reverseMatches.length > 0) {
          matchedNodeId = reverseMatches[0].id;
        } else {
          // Tier 4: Fuzzy — any significant keyword matches (OR-based, not AND)
          const searchWords = topicName.split(/[\s:,&]+/).filter((w: string) => w.length > 3).slice(0, 5);
          if (searchWords.length > 0) {
            // Try combined pattern first (all words in order)
            const combinedPattern = `%${searchWords.join('%')}%`;
            const fuzzyMatches = unitId
              ? await sql`
                  SELECT id FROM syllabus_nodes
                  WHERE (topic_name ILIKE ${combinedPattern} OR subtopic_name ILIKE ${combinedPattern})
                    AND UPPER(REPLACE(unit_code, '-', '')) = UPPER(REPLACE(${unitId}, '-', ''))
                  LIMIT 1
                `
              : await sql`
                  SELECT id FROM syllabus_nodes
                  WHERE topic_name ILIKE ${combinedPattern} OR subtopic_name ILIKE ${combinedPattern}
                  LIMIT 1
                `;
            if (fuzzyMatches.length > 0) {
              matchedNodeId = fuzzyMatches[0].id;
            } else {
              // Tier 5: Individual keyword search — match on the FIRST significant word
              // e.g., "Jurisdiction & Venue" → search for "%Jurisdiction%" in the unit
              const primaryWord = searchWords[0];
              const keywordMatches = unitId
                ? await sql`
                    SELECT id FROM syllabus_nodes
                    WHERE UPPER(REPLACE(unit_code, '-', '')) = UPPER(REPLACE(${unitId}, '-', ''))
                      AND (topic_name ILIKE ${'%' + primaryWord + '%'}
                        OR subtopic_name ILIKE ${'%' + primaryWord + '%'})
                    ORDER BY id ASC
                    LIMIT 1
                  `
                : await sql`
                    SELECT id FROM syllabus_nodes
                    WHERE topic_name ILIKE ${'%' + primaryWord + '%'}
                      OR subtopic_name ILIKE ${'%' + primaryWord + '%'}
                    ORDER BY id ASC
                    LIMIT 1
                  `;
              if (keywordMatches.length > 0) {
                matchedNodeId = keywordMatches[0].id;
                console.log(`[study/notes] Tier 5 keyword match: "${primaryWord}" → node ${matchedNodeId}`);
              }
            }
          }
        }
      }
    }

    if (!matchedNodeId) {
      console.log(`[study/notes] No syllabus node match for "${topicName}" (unit: ${unitId}). Using live generation.`);
    }

    if (matchedNodeId) {
      // Check user's version assignment
      let assignedVersion: number | null = null;
      let hasMasteryVersion = false;

      if (dbUserId) {
        try {
          const [existing] = await sql`
            SELECT mastery_version, study_version FROM user_note_versions
            WHERE user_id = ${dbUserId}::uuid AND node_id = ${matchedNodeId}::uuid
          `;
          
          if (existing) {
            if (existing.study_version) {
              assignedVersion = existing.study_version;
            } else if (existing.mastery_version) {
              assignedVersion = existing.mastery_version;
              hasMasteryVersion = true;
            }
          }
        } catch (e) {
          console.warn('[study/notes] Version lookup failed:', e);
        }
      }

      if (!assignedVersion) {
        assignedVersion = 1;
      }

      // Persist the study version assignment
      if (dbUserId) {
        try {
          await sql`
            INSERT INTO user_note_versions (user_id, node_id, study_version, study_read_at)
            VALUES (${dbUserId}::uuid, ${matchedNodeId}::uuid, ${assignedVersion}, NOW())
            ON CONFLICT (user_id, node_id) DO UPDATE SET
              study_version = COALESCE(user_note_versions.study_version, ${assignedVersion}),
              study_read_at = NOW(),
              updated_at = NOW()
          `;
        } catch { /* non-critical */ }
      }

      // Fetch pre-built notes for the assigned version
      const [prebuilt] = await sql`
        SELECT narrative_markdown, sections_json, authorities_json, personality, title
        FROM prebuilt_notes
        WHERE node_id = ${matchedNodeId}::uuid 
          AND version_number = ${assignedVersion}
          AND is_active = true
        LIMIT 1
      `;

      if (prebuilt?.narrative_markdown) {
        let notes = prebuilt.narrative_markdown;

        // If withAssessment is requested, generate assessment questions LIVE
        // using the pre-built notes as context (cheaper: small prompt + gpt-5.2-mini)
        let assessmentBlock = '';
        if (withAssessment) {
          try {
            const assessCompletion = await getOpenAI().chat.completions.create({
              model: MINI_MODEL,
              messages: [
                { role: 'system', content: `You are a Kenya bar exam assessor. Based on the study notes provided, generate assessment questions. Include:
- 5 multiple-choice questions (with lettered options A-D and answers)
- 2 scenario-based questions requiring application of the concepts
- 1 essay question typical of KSL exams
Include model answers for all questions. Use proper Markdown formatting.` },
                { role: 'user', content: `Generate assessment questions based on these study notes:\n\n${notes.slice(0, 3000)}` },
              ],
              temperature: 0.7,
              max_completion_tokens: 2048,
            });
            assessmentBlock = '\n\n---\n\n## 📝 Assessment\n\n' + (assessCompletion.choices[0]?.message?.content || '');
          } catch (e) {
            console.warn('[study/notes] Assessment generation failed:', e);
          }
        }

        console.log(`[study/notes] Pre-built v${assignedVersion} served for node ${matchedNodeId} (affinity: ${hasMasteryVersion ? 'mastery' : 'new'})`);
        
        return NextResponse.json({
          notes: notes + assessmentBlock,
          topicName: topicName || prebuilt.title || 'Study Notes',
          unitName: unitName || '',
          depth,
          withAssessment,
          prebuilt: true,
          version: assignedVersion,
          personality: prebuilt.personality,
          generatedAt: new Date().toISOString(),
        });
      }
    }
  } catch (e) {
    console.error('[study/notes] Pre-built lookup failed, falling back to AI:', e);
  }

  // ═══════════════════════════════════════════════════════════
  // FALLBACK: Live AI generation (only if no pre-built notes available)
  // ═══════════════════════════════════════════════════════════
  console.log(`[study/notes] Falling back to live generation for: "${topicName}" (unit: ${unitId})`);
  const topicContext = `${topicName} under ${unitName} (${unitId})`;
  return generateLiveNotes({ topicContext, unitName, depth, withAssessment, topicName });
}

/**
 * Fallback: Generate notes live with gpt-5.2-mini.
 * Used when pre-built notes don't exist for the requested topic.
 */
async function generateLiveNotes(opts: {
  topicContext: string;
  unitName?: string;
  depth: string;
  withAssessment: boolean;
  topicName?: string;
}) {
  const { topicContext, unitName, depth, withAssessment, topicName } = opts;

  const depthInstructions: Record<string, string> = {
    refresher: 'Keep it concise — bullet points, key takeaways, and critical provisions only. This is a quick refresher, not a deep dive. ~800 words max.',
    standard: 'Provide comprehensive coverage with clear explanations, relevant statutory provisions, case law references, and practical examples. ~1500-2000 words.',
    indepth: 'Provide exhaustive, exam-level coverage. Include detailed statutory analysis, all major case law with ratios, practical applications, common exam scenarios, cross-references between topics, and examiner tips. ~3000+ words.',
  };

  const assessmentBlock = withAssessment ? `

IMPORTANT: Integrate assessment throughout the notes:
- After every 2-3 major concepts, insert a "🧠 Quick Check" box with 1-2 MCQ or short-answer questions (provide answers immediately after in a collapsible section marked with <details><summary>Answer</summary>...</details>)
- At the end, include a full "📝 Assessment" section with:
  - 5 multiple-choice questions (with lettered options and answers)
  - 2 scenario-based questions requiring application
  - 1 essay question typical of KSL exams
Include model answers for all questions.` : '';

  const systemPrompt = `You are an expert Kenyan law tutor specializing in the Kenya School of Law Advocates Training Programme (ATP) 2026/2027 curriculum. 

Generate comprehensive study notes on the requested topic. 

Study depth: ${depthInstructions[depth] || depthInstructions.standard}
${assessmentBlock}

FORMAT REQUIREMENTS:
- Use proper Markdown with clear headings (##, ###)
- Bold key terms and statutory provisions  
- Use blockquotes for important case ratios
- Include statutory section references (e.g., "Section 3A, Civil Procedure Act")
- Cite relevant case law with proper citations (e.g., *Anarita Karimi Njeru v Republic* [1979] KLR 154)
- Use numbered lists for procedural steps
- Use bullet points for elements/requirements
- Include practical tips and exam strategies where relevant
- Add cross-references to related topics

KENYAN LAW CONTEXT:
- All references must be to Kenyan law and procedure
- Use the correct Kenyan court hierarchy (Supreme Court → Court of Appeal → High Court → Magistrates' Courts)
- Reference current legislation (post-2010 Constitution)
- Include both written and oral exam tips where applicable`;

  const openai = getOpenAI();
  const maxAttempts = 2;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      console.log(`[study/notes] Live generation attempt ${attempt} for: ${topicContext}`);
      const completion = await openai.chat.completions.create({
        model: MINI_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Generate study notes on: ${topicContext}` },
        ],
        temperature: 0.7,
        max_completion_tokens: 4096,
      });

      const notes = completion.choices[0]?.message?.content;
      if (!notes || notes.length < 50) {
        console.warn(`[study/notes] OpenAI returned empty/short content (${notes?.length ?? 0} chars). Attempt ${attempt}/${maxAttempts}`);
        if (attempt < maxAttempts) { await new Promise(r => setTimeout(r, 1000)); continue; }
        return NextResponse.json(
          { error: 'AI returned empty notes. Please try again in a moment.' },
          { status: 502 }
        );
      }

      console.log(`[study/notes] Live generation succeeded (${notes.length} chars)`);
      return NextResponse.json({
        notes,
        topicName: topicName || 'Custom Study',
        unitName: unitName || '',
        depth,
        withAssessment,
        prebuilt: false,
        generatedAt: new Date().toISOString(),
      });
    } catch (error: any) {
      const errMsg = error?.message || error?.toString() || 'Unknown error';
      console.error(`[study/notes] Live generation error (attempt ${attempt}/${maxAttempts}):`, errMsg);
      if (attempt < maxAttempts) { await new Promise(r => setTimeout(r, 1500)); continue; }
      return NextResponse.json(
        { error: `Notes generation failed: ${errMsg.slice(0, 100)}` },
        { status: 500 }
      );
    }
  }

  // Should never reach here, but just in case
  return NextResponse.json(
    { error: 'Failed to generate notes after retries.' },
    { status: 500 }
  );
}

export const POST = withAuth(handlePost);
