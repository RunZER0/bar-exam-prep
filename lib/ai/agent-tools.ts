/**
 * YNAI Agent Tool Definitions
 * 
 * Defines function-calling tools that AI agents can invoke during conversations.
 * These let the AI autonomously retrieve knowledge, check student progress,
 * search legal authorities, and generate practice questions.
 * 
 * Tools are formatted for OpenAI's responses.create() function_call API.
 */

import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';
import {
  searchSkillsSemantic,
  searchItemsSemantic,
  searchKnowledgeBaseSemantic,
  searchLectureChunksSemantic,
  searchAdminKnowledgeEntries,
  retrieveRAGContext,
  formatRAGContextForPrompt,
} from './embedding-service';

// ============================================
// TOOL DEFINITIONS (OpenAI Responses API format)
// ============================================

export const AGENT_TOOLS = [
  {
    type: 'function' as const,
    name: 'search_knowledge_base',
    description: 'Search the Kenyan law knowledge base for legal provisions, case law, regulations, and principles. Use this when you need to cite specific legal sources, verify legal claims, or ground your response in authoritative content. Always prefer this over relying on training data for Kenyan law.',
    parameters: {
      type: 'object' as const,
      properties: {
        query: {
          type: 'string' as const,
          description: 'The legal concept, provision, or topic to search for. Be specific — e.g., "res judicata Section 7 Civil Procedure Act" rather than just "res judicata".',
        },
        unit_id: {
          type: 'string' as const,
          description: 'Optional ATP unit code to filter results (e.g., "atp-100" for Civil Litigation). Leave empty to search all units.',
        },
        entry_type: {
          type: 'string' as const,
          enum: ['provision', 'case_law', 'regulation', 'principle', 'procedure', 'definition'],
          description: 'Optional filter by entry type.',
        },
      },
      required: ['query'] as const,
      additionalProperties: false as const,
    },
    strict: false as const,
  },
  {
    type: 'function' as const,
    name: 'get_student_mastery',
    description: 'Retrieve the current student\'s mastery state for a specific skill or unit. Shows p_mastery probability, attempt count, streak, and last attempt details. Use this to personalize feedback and recommendations.',
    parameters: {
      type: 'object' as const,
      properties: {
        user_id: {
          type: 'string' as const,
          description: 'The student\'s user ID.',
        },
        unit_id: {
          type: 'string' as const,
          description: 'ATP unit code to check mastery for (e.g., "atp-100"). If provided, returns all skills in that unit.',
        },
        skill_id: {
          type: 'string' as const,
          description: 'Specific skill ID to check. If provided, returns detailed mastery for that skill only.',
        },
      },
      required: ['user_id'] as const,
      additionalProperties: false as const,
    },
    strict: false as const,
  },
  {
    type: 'function' as const,
    name: 'search_related_skills',
    description: 'Find micro-skills related to a legal concept using semantic similarity search. Use this to identify prerequisite skills, suggest next study areas, or find practice questions on related topics.',
    parameters: {
      type: 'object' as const,
      properties: {
        query: {
          type: 'string' as const,
          description: 'The legal concept or skill description to search for.',
        },
        unit_id: {
          type: 'string' as const,
          description: 'Optional ATP unit code filter.',
        },
        top_k: {
          type: 'number' as const,
          description: 'Number of results to return (default: 5).',
        },
      },
      required: ['query'] as const,
      additionalProperties: false as const,
    },
    strict: false as const,
  },
  {
    type: 'function' as const,
    name: 'search_practice_items',
    description: 'Find practice questions/items related to a topic. Returns actual exam-style questions that the student can practice. Use this when suggesting specific practice exercises.',
    parameters: {
      type: 'object' as const,
      properties: {
        query: {
          type: 'string' as const,
          description: 'The topic or concept to find practice items for.',
        },
        unit_id: {
          type: 'string' as const,
          description: 'Optional ATP unit code filter.',
        },
        format: {
          type: 'string' as const,
          enum: ['mcq', 'written', 'oral', 'drafting'],
          description: 'Optional format filter.',
        },
      },
      required: ['query'] as const,
      additionalProperties: false as const,
    },
    strict: false as const,
  },
  {
    type: 'function' as const,
    name: 'get_skill_prerequisites',
    description: 'Get the prerequisite skills for a given skill, based on the curriculum knowledge graph edges. Use this to understand what the student needs to master before attempting a skill.',
    parameters: {
      type: 'object' as const,
      properties: {
        skill_id: {
          type: 'string' as const,
          description: 'The skill ID to get prerequisites for.',
        },
      },
      required: ['skill_id'] as const,
      additionalProperties: false as const,
    },
    strict: false as const,
  },
  {
    type: 'function' as const,
    name: 'search_lecture_content',
    description: 'Search KSL lecture transcripts for relevant content. Use this to reference what was taught in class, provide lecture-based explanations, or verify information against lecture materials.',
    parameters: {
      type: 'object' as const,
      properties: {
        query: {
          type: 'string' as const,
          description: 'The topic to search lecture transcripts for.',
        },
        unit_id: {
          type: 'string' as const,
          description: 'Optional ATP unit code filter.',
        },
      },
      required: ['query'] as const,
      additionalProperties: false as const,
    },
    strict: false as const,
  },
];

// ============================================
// TOOL EXECUTION (called when AI invokes a tool)
// ============================================

export async function executeAgentTool(
  toolName: string,
  args: Record<string, unknown>
): Promise<string> {
  try {
    switch (toolName) {
      case 'search_knowledge_base':
        return await executeSearchKnowledgeBase(args);
      case 'get_student_mastery':
        return await executeGetStudentMastery(args);
      case 'search_related_skills':
        return await executeSearchRelatedSkills(args);
      case 'search_practice_items':
        return await executeSearchPracticeItems(args);
      case 'get_skill_prerequisites':
        return await executeGetSkillPrerequisites(args);
      case 'search_lecture_content':
        return await executeSearchLectureContent(args);
      default:
        return JSON.stringify({ error: `Unknown tool: ${toolName}` });
    }
  } catch (error: any) {
    console.error(`[AgentTools] Tool ${toolName} failed:`, error);
    return JSON.stringify({ error: error.message });
  }
}

// ============================================
// TOOL IMPLEMENTATIONS
// ============================================

async function executeSearchKnowledgeBase(args: Record<string, unknown>): Promise<string> {
  const query = String(args.query || '');
  const unitId = args.unit_id ? String(args.unit_id) : undefined;
  const entryType = args.entry_type ? String(args.entry_type) : undefined;

  // Try semantic search first
  try {
    const results = await searchKnowledgeBaseSemantic(query, {
      topK: 6,
      unitId,
      entryType,
    });

    if (results.length > 0) {
      return JSON.stringify({
        source: 'semantic_search',
        count: results.length,
        entries: results.map(r => ({
          title: r.title,
          source: r.source,
          citation: r.citation,
          content: r.content,
          unitId: r.unitId,
          type: r.entryType,
          relevance: Math.round(r.similarity * 100) + '%',
        })),
      });
    }
  } catch {
    // Fall through to FTS
  }

  // Fallback: full-text search on knowledge_base + admin rag_knowledge_entries
  const [ftsResults, adminResults] = await Promise.all([
    db.execute(sql`
      SELECT id, title, source, citation, content, unit_id, entry_type
      FROM knowledge_base
      WHERE to_tsvector('english', title || ' ' || content) @@ websearch_to_tsquery('english', ${query})
      ${unitId ? sql`AND unit_id = ${unitId}` : sql``}
      ${entryType ? sql`AND entry_type = ${entryType}` : sql``}
      ORDER BY ts_rank(to_tsvector('english', title || ' ' || content), websearch_to_tsquery('english', ${query})) DESC
      LIMIT 6
    `).catch(() => ({ rows: [] })),
    searchAdminKnowledgeEntries(query, { topK: 3, unitId, contentType: entryType }).catch(() => []),
  ]);

  const allEntries = [
    ...(ftsResults.rows as any[]).map(r => ({
      title: r.title,
      source: r.source,
      citation: r.citation,
      content: r.content,
      unitId: r.unit_id,
      type: r.entry_type,
    })),
    ...adminResults.map(r => ({
      title: r.title,
      source: r.source,
      citation: r.citation,
      content: r.content,
      unitId: undefined,
      type: 'admin_curated',
    })),
  ];

  return JSON.stringify({
    source: 'full_text_search',
    count: allEntries.length,
    entries: allEntries,
  });
}

async function executeGetStudentMastery(args: Record<string, unknown>): Promise<string> {
  const userId = String(args.user_id || '');
  const unitId = args.unit_id ? String(args.unit_id) : undefined;
  const skillId = args.skill_id ? String(args.skill_id) : undefined;

  if (skillId) {
    const result = await db.execute(sql`
      SELECT ms.id, ms.name, ms.unit_id, ms.difficulty, ms.is_core,
             mst.p_mastery, mst.streak, mst.total_attempts, mst.last_attempt_at,
             mst.best_score, mst.avg_score
      FROM micro_skills ms
      LEFT JOIN mastery_state mst ON mst.skill_id = ms.id AND mst.user_id = ${userId}
      WHERE ms.id = ${skillId}
    `);
    return JSON.stringify({ skills: result.rows });
  }

  const unitFilter = unitId ? sql`AND ms.unit_id = ${unitId}` : sql``;
  const result = await db.execute(sql`
    SELECT ms.id, ms.name, ms.unit_id, ms.difficulty, ms.is_core,
           mst.p_mastery, mst.streak, mst.total_attempts, mst.last_attempt_at,
           CASE WHEN mst.p_mastery >= 0.85 THEN 'MASTERED'
                WHEN mst.p_mastery >= 0.5 THEN 'PROGRESSING'
                WHEN mst.total_attempts > 0 THEN 'ATTEMPTED'
                ELSE 'NOT_STARTED' END as status
    FROM micro_skills ms
    LEFT JOIN mastery_state mst ON mst.skill_id = ms.id AND mst.user_id = ${userId}
    WHERE ms.is_active = true ${unitFilter}
    ORDER BY COALESCE(mst.p_mastery, 0) ASC
    LIMIT 20
  `);

  const stats = await db.execute(sql`
    SELECT 
      COUNT(*) as total_skills,
      COUNT(CASE WHEN mst.p_mastery >= 0.85 THEN 1 END) as mastered,
      COUNT(CASE WHEN mst.p_mastery < 0.85 AND mst.total_attempts > 0 THEN 1 END) as in_progress,
      COUNT(CASE WHEN mst.total_attempts IS NULL OR mst.total_attempts = 0 THEN 1 END) as not_started,
      ROUND(AVG(COALESCE(mst.p_mastery, 0))::numeric, 3) as avg_mastery
    FROM micro_skills ms
    LEFT JOIN mastery_state mst ON mst.skill_id = ms.id AND mst.user_id = ${userId}
    WHERE ms.is_active = true ${unitFilter}
  `);

  return JSON.stringify({
    summary: stats.rows[0],
    weakest_skills: result.rows,
  });
}

async function executeSearchRelatedSkills(args: Record<string, unknown>): Promise<string> {
  const query = String(args.query || '');
  const unitId = args.unit_id ? String(args.unit_id) : undefined;
  const topK = Number(args.top_k || 5);

  try {
    const results = await searchSkillsSemantic(query, { topK, unitId });
    return JSON.stringify({
      source: 'semantic_search',
      skills: results.map(r => ({
        id: r.id,
        name: r.name,
        description: r.description,
        unitId: r.unitId,
        relevance: Math.round(r.similarity * 100) + '%',
      })),
    });
  } catch {
    // Fallback: keyword search
    const results = await db.execute(sql`
      SELECT id, name, description, unit_id
      FROM micro_skills
      WHERE is_active = true
        AND (name ILIKE ${'%' + query + '%'} OR description ILIKE ${'%' + query + '%'})
        ${unitId ? sql`AND unit_id = ${unitId}` : sql``}
      LIMIT ${topK}
    `);
    return JSON.stringify({ source: 'keyword_search', skills: results.rows });
  }
}

async function executeSearchPracticeItems(args: Record<string, unknown>): Promise<string> {
  const query = String(args.query || '');
  const unitId = args.unit_id ? String(args.unit_id) : undefined;
  const format = args.format ? String(args.format) : undefined;

  try {
    const results = await searchItemsSemantic(query, { topK: 5, unitId, format });
    return JSON.stringify({
      source: 'semantic_search',
      items: results.map(r => ({
        id: r.id,
        prompt: r.prompt.slice(0, 300),
        format: r.format,
        difficulty: r.difficulty,
        unitId: r.unitId,
        relevance: Math.round(r.similarity * 100) + '%',
      })),
    });
  } catch {
    // Fallback
    const results = await db.execute(sql`
      SELECT id, prompt, format, difficulty, unit_id
      FROM items
      WHERE is_active = true
        AND prompt ILIKE ${'%' + query + '%'}
        ${unitId ? sql`AND unit_id = ${unitId}` : sql``}
        ${format ? sql`AND format = ${format}` : sql``}
      LIMIT 5
    `);
    return JSON.stringify({
      source: 'keyword_search',
      items: (results.rows as any[]).map(r => ({
        ...r,
        prompt: r.prompt?.slice(0, 300),
      })),
    });
  }
}

async function executeGetSkillPrerequisites(args: Record<string, unknown>): Promise<string> {
  const skillId = String(args.skill_id || '');

  const result = await db.execute(sql`
    SELECT 
      se.from_skill_id as prereq_id,
      ms.name as prereq_name,
      ms.description as prereq_description,
      ms.unit_id,
      se.edge_type,
      se.strength
    FROM skill_edges se
    JOIN micro_skills ms ON ms.id = se.from_skill_id
    WHERE se.to_skill_id = ${skillId}
    ORDER BY se.strength DESC
  `);

  // Also get what this skill leads to
  const downstream = await db.execute(sql`
    SELECT 
      se.to_skill_id as next_id,
      ms.name as next_name,
      ms.unit_id,
      se.edge_type
    FROM skill_edges se
    JOIN micro_skills ms ON ms.id = se.to_skill_id
    WHERE se.from_skill_id = ${skillId}
  `);

  return JSON.stringify({
    prerequisites: result.rows,
    leads_to: downstream.rows,
  });
}

async function executeSearchLectureContent(args: Record<string, unknown>): Promise<string> {
  const query = String(args.query || '');
  const unitId = args.unit_id ? String(args.unit_id) : undefined;

  try {
    const results = await searchLectureChunksSemantic(query, { topK: 5, unitId });
    return JSON.stringify({
      source: 'semantic_search',
      chunks: results.map(r => ({
        lectureTitle: r.lectureTitle,
        content: r.content.slice(0, 500),
        relevance: Math.round(r.similarity * 100) + '%',
      })),
    });
  } catch {
    return JSON.stringify({ source: 'none', chunks: [], message: 'No lecture content indexed yet.' });
  }
}

// ============================================
// CONVERT TO OPENAI TOOLS FORMAT
// ============================================

/**
 * Get tools formatted for openai.responses.create()
 */
export function getToolsForResponses() {
  return AGENT_TOOLS;
}

/**
 * Get tools formatted for openai.chat.completions.create()
 */
export function getToolsForChatCompletions() {
  return AGENT_TOOLS.map(t => ({
    type: 'function' as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters,
      strict: t.strict,
    },
  }));
}
