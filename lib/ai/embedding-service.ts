/**
 * YNAI Embedding & Semantic Retrieval Service
 * 
 * Uses OpenAI text-embedding-3-small (1536 dimensions) + pgvector
 * for real semantic search across the knowledge graph.
 * 
 * Architecture:
 *   1. generateEmbedding(text) → number[1536]
 *   2. generateBatchEmbeddings(texts[]) → number[][1536]  (batched, max 2048 per call)
 *   3. searchSimilar(query, table, topK) → ranked results with cosine similarity
 *   4. Caching: embeddings stored in DB columns, never recomputed for same content
 */

import OpenAI from 'openai';
import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';

// ============================================
// CONFIG
// ============================================

const EMBEDDING_MODEL = 'text-embedding-3-small'; // 1536 dims, $0.02/1M tokens
const EMBEDDING_DIMENSIONS = 1536;
const MAX_BATCH_SIZE = 2048; // OpenAI limit
const MAX_INPUT_TOKENS = 8191; // text-embedding-3-small limit

let _openai: OpenAI | null = null;
const getOpenAI = (): OpenAI | null => {
  if (!_openai && process.env.OPENAI_API_KEY) {
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _openai;
};

// ============================================
// CORE EMBEDDING FUNCTIONS
// ============================================

/**
 * Generate a single embedding vector for text
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const openai = getOpenAI();
  if (!openai) {
    throw new Error('OPENAI_API_KEY not configured — cannot generate embeddings');
  }

  // Truncate to model token limit (rough: 4 chars ≈ 1 token)
  const truncated = text.slice(0, MAX_INPUT_TOKENS * 4);

  const response = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: truncated,
    dimensions: EMBEDDING_DIMENSIONS,
  });

  return response.data[0].embedding;
}

/**
 * Generate embeddings for multiple texts in batches
 * Returns array of embedding vectors in same order as input
 */
export async function generateBatchEmbeddings(texts: string[]): Promise<number[][]> {
  const openai = getOpenAI();
  if (!openai) {
    throw new Error('OPENAI_API_KEY not configured — cannot generate embeddings');
  }

  const allEmbeddings: number[][] = [];

  // Process in batches
  for (let i = 0; i < texts.length; i += MAX_BATCH_SIZE) {
    const batch = texts.slice(i, i + MAX_BATCH_SIZE).map(t => t.slice(0, MAX_INPUT_TOKENS * 4));
    
    const response = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: batch,
      dimensions: EMBEDDING_DIMENSIONS,
    });

    // Sort by index to maintain order
    const sorted = response.data.sort((a, b) => a.index - b.index);
    allEmbeddings.push(...sorted.map(d => d.embedding));

    // Rate limiting between batches
    if (i + MAX_BATCH_SIZE < texts.length) {
      await new Promise(r => setTimeout(r, 200));
    }
  }

  return allEmbeddings;
}

// ============================================
// SEMANTIC SEARCH (pgvector cosine similarity)
// ============================================

/**
 * Search micro_skills by semantic similarity
 * Returns top-K skills with cosine similarity score
 */
export async function searchSkillsSemantic(
  query: string,
  options: { topK?: number; unitId?: string; minSimilarity?: number } = {}
): Promise<Array<{
  id: string;
  name: string;
  description: string | null;
  unitId: string;
  similarity: number;
}>> {
  const { topK = 5, unitId, minSimilarity = 0.3 } = options;

  const queryEmbedding = await generateEmbedding(query);
  const vectorStr = `[${queryEmbedding.join(',')}]`;

  const unitFilter = unitId ? sql`AND ms.unit_id = ${unitId}` : sql``;

  const results = await db.execute(sql`
    SELECT 
      ms.id,
      ms.name,
      ms.description,
      ms.unit_id,
      1 - (ms.embedding <=> ${vectorStr}::vector) as similarity
    FROM micro_skills ms
    WHERE ms.embedding IS NOT NULL
      AND ms.is_active = true
      ${unitFilter}
    ORDER BY ms.embedding <=> ${vectorStr}::vector
    LIMIT ${topK}
  `);

  return (results.rows as any[])
    .filter(r => r.similarity >= minSimilarity)
    .map(r => ({
      id: r.id,
      name: r.name,
      description: r.description,
      unitId: r.unit_id,
      similarity: Number(r.similarity),
    }));
}

/**
 * Search items by semantic similarity
 * Returns top-K items with their prompts
 */
export async function searchItemsSemantic(
  query: string,
  options: { topK?: number; unitId?: string; format?: string; minSimilarity?: number } = {}
): Promise<Array<{
  id: string;
  prompt: string;
  format: string;
  difficulty: number;
  unitId: string;
  similarity: number;
}>> {
  const { topK = 5, unitId, format, minSimilarity = 0.3 } = options;

  const queryEmbedding = await generateEmbedding(query);
  const vectorStr = `[${queryEmbedding.join(',')}]`;

  const unitFilter = unitId ? sql`AND i.unit_id = ${unitId}` : sql``;
  const formatFilter = format ? sql`AND i.format = ${format}` : sql``;

  const results = await db.execute(sql`
    SELECT 
      i.id,
      i.prompt,
      i.format,
      i.difficulty,
      i.unit_id,
      1 - (i.embedding <=> ${vectorStr}::vector) as similarity
    FROM items i
    WHERE i.embedding IS NOT NULL
      AND i.is_active = true
      ${unitFilter}
      ${formatFilter}
    ORDER BY i.embedding <=> ${vectorStr}::vector
    LIMIT ${topK}
  `);

  return (results.rows as any[])
    .filter(r => r.similarity >= minSimilarity)
    .map(r => ({
      id: r.id,
      prompt: r.prompt,
      format: r.format,
      difficulty: Number(r.difficulty),
      unitId: r.unit_id,
      similarity: Number(r.similarity),
    }));
}

/**
 * Search lecture chunks by semantic similarity (RAG)
 * Returns relevant transcript fragments for grounding AI responses
 */
export async function searchLectureChunksSemantic(
  query: string,
  options: { topK?: number; unitId?: string; minSimilarity?: number } = {}
): Promise<Array<{
  id: string;
  content: string;
  lectureTitle: string;
  lectureId: string;
  chunkIndex: number;
  similarity: number;
}>> {
  const { topK = 5, unitId, minSimilarity = 0.3 } = options;

  const queryEmbedding = await generateEmbedding(query);
  const vectorStr = `[${queryEmbedding.join(',')}]`;

  const unitFilter = unitId ? sql`AND l.unit_id = ${unitId}` : sql``;

  const results = await db.execute(sql`
    SELECT 
      lc.id,
      lc.content,
      l.title as lecture_title,
      lc.lecture_id,
      lc.chunk_index,
      1 - (lc.embedding <=> ${vectorStr}::vector) as similarity
    FROM lecture_chunks lc
    JOIN lectures l ON l.id = lc.lecture_id
    WHERE lc.embedding IS NOT NULL
      ${unitFilter}
    ORDER BY lc.embedding <=> ${vectorStr}::vector
    LIMIT ${topK}
  `);

  return (results.rows as any[])
    .filter(r => r.similarity >= minSimilarity)
    .map(r => ({
      id: r.id,
      content: r.content,
      lectureTitle: r.lecture_title,
      lectureId: r.lecture_id,
      chunkIndex: Number(r.chunk_index),
      similarity: Number(r.similarity),
    }));
}

/**
 * Search knowledge base entries by semantic similarity
 * Searches over the knowledge_base table for legal provisions + case law
 */
export async function searchKnowledgeBaseSemantic(
  query: string,
  options: { topK?: number; unitId?: string; entryType?: string; minSimilarity?: number } = {}
): Promise<Array<{
  id: string;
  entryType: string;
  title: string;
  content: string;
  unitId: string;
  source: string;
  citation: string | null;
  similarity: number;
}>> {
  const { topK = 8, unitId, entryType, minSimilarity = 0.25 } = options;

  const queryEmbedding = await generateEmbedding(query);
  const vectorStr = `[${queryEmbedding.join(',')}]`;

  const unitFilter = unitId ? sql`AND kb.unit_id = ${unitId}` : sql``;
  const typeFilter = entryType ? sql`AND kb.entry_type = ${entryType}` : sql``;

  const results = await db.execute(sql`
    SELECT 
      kb.id,
      kb.entry_type,
      kb.title,
      kb.content,
      kb.unit_id,
      kb.source,
      kb.citation,
      1 - (kb.embedding <=> ${vectorStr}::vector) as similarity
    FROM knowledge_base kb
    WHERE kb.embedding IS NOT NULL
      ${unitFilter}
      ${typeFilter}
    ORDER BY kb.embedding <=> ${vectorStr}::vector
    LIMIT ${topK}
  `);

  return (results.rows as any[])
    .filter(r => r.similarity >= minSimilarity)
    .map(r => ({
      id: r.id,
      entryType: r.entry_type,
      title: r.title,
      content: r.content,
      unitId: r.unit_id,
      source: r.source,
      citation: r.citation,
      similarity: Number(r.similarity),
    }));
}

// ============================================
// ADMIN RAG KNOWLEDGE ENTRIES (rag_knowledge_entries table)
// ============================================

/**
 * Search admin-curated RAG knowledge entries using full-text search.
 * These are entries added by admins via the Knowledge Base admin tab
 * (e.g., recent judgments, statute updates, practice notes).
 */
export async function searchAdminKnowledgeEntries(
  query: string,
  options: { topK?: number; unitId?: string; contentType?: string } = {}
): Promise<Array<{
  title: string;
  content: string;
  source: string;
  citation: string | null;
  similarity: number;
}>> {
  const { topK = 5, unitId, contentType } = options;

  const unitFilter = unitId ? sql`AND unit_id = ${unitId}` : sql``;
  const typeFilter = contentType ? sql`AND content_type = ${contentType}` : sql``;

  try {
    // Use full-text search since rag_knowledge_entries has no pgvector embeddings
    const results = await db.execute(sql`
      SELECT id, title, content, content_type, unit_id, citation, source_url, importance,
             ts_rank(
               to_tsvector('english', coalesce(title, '') || ' ' || coalesce(content, '')),
               websearch_to_tsquery('english', ${query})
             ) as rank
      FROM rag_knowledge_entries
      WHERE to_tsvector('english', coalesce(title, '') || ' ' || coalesce(content, ''))
            @@ websearch_to_tsquery('english', ${query})
        ${unitFilter}
        ${typeFilter}
      ORDER BY 
        CASE WHEN importance = 'high' THEN 0 WHEN importance = 'medium' THEN 1 ELSE 2 END,
        rank DESC
      LIMIT ${topK}
    `);

    return (results.rows as any[]).map(r => ({
      title: r.title,
      content: r.content,
      source: `Admin Knowledge (${r.content_type})`,
      citation: r.citation,
      similarity: Math.min(Number(r.rank) * 0.5 + 0.5, 1), // Normalize FTS rank to 0-1
    }));
  } catch (error) {
    // Fallback: simple ILIKE search if FTS fails (e.g., query too short)
    try {
      const results = await db.execute(sql`
        SELECT id, title, content, content_type, unit_id, citation, source_url, importance
        FROM rag_knowledge_entries
        WHERE (title ILIKE ${'%' + query + '%'} OR content ILIKE ${'%' + query + '%'})
          ${unitFilter}
          ${typeFilter}
        ORDER BY 
          CASE WHEN importance = 'high' THEN 0 WHEN importance = 'medium' THEN 1 ELSE 2 END,
          created_at DESC
        LIMIT ${topK}
      `);

      return (results.rows as any[]).map(r => ({
        title: r.title,
        content: r.content,
        source: `Admin Knowledge (${r.content_type})`,
        citation: r.citation,
        similarity: 0.5,
      }));
    } catch {
      return [];
    }
  }
}

// ============================================
// UNIFIED RAG RETRIEVAL
// ============================================

export interface RAGContext {
  skills: Array<{ name: string; description: string | null; similarity: number }>;
  knowledgeEntries: Array<{ title: string; content: string; source: string; citation: string | null; similarity: number }>;
  lectureChunks: Array<{ content: string; lectureTitle: string; similarity: number }>;
}

/**
 * Retrieve full RAG context for a query
 * Aggregates results from skills, knowledge base, lecture chunks,
 * AND admin-curated RAG knowledge entries
 */
export async function retrieveRAGContext(
  query: string,
  unitId?: string
): Promise<RAGContext> {
  try {
    // Run all searches in parallel — including admin knowledge entries
    const [skills, knowledgeEntries, adminEntries, lectureChunks] = await Promise.all([
      searchSkillsSemantic(query, { topK: 3, unitId }).catch(() => []),
      searchKnowledgeBaseSemantic(query, { topK: 5, unitId }).catch(() => []),
      searchAdminKnowledgeEntries(query, { topK: 3, unitId }).catch(() => []),
      searchLectureChunksSemantic(query, { topK: 3, unitId }).catch(() => []),
    ]);

    // Merge knowledge_base results with admin-curated entries, deduplicating by title
    const seenTitles = new Set(knowledgeEntries.map(e => e.title.toLowerCase()));
    const mergedKnowledge = [...knowledgeEntries];
    for (const entry of adminEntries) {
      if (!seenTitles.has(entry.title.toLowerCase())) {
        mergedKnowledge.push(entry);
        seenTitles.add(entry.title.toLowerCase());
      }
    }

    return { skills, knowledgeEntries: mergedKnowledge, lectureChunks };
  } catch (error) {
    console.error('[EmbeddingService] RAG retrieval failed:', error);
    return { skills: [], knowledgeEntries: [], lectureChunks: [] };
  }
}

/**
 * Format RAG context as text for injection into AI prompts
 */
export function formatRAGContextForPrompt(context: RAGContext): string {
  const sections: string[] = [];

  if (context.knowledgeEntries.length > 0) {
    sections.push('===== RETRIEVED LEGAL KNOWLEDGE =====');
    for (const entry of context.knowledgeEntries) {
      sections.push(
        `[${entry.source}${entry.citation ? ` — ${entry.citation}` : ''}] ${entry.title}:\n${entry.content}`
      );
    }
  }

  if (context.lectureChunks.length > 0) {
    sections.push('\n===== RELEVANT LECTURE EXCERPTS =====');
    for (const chunk of context.lectureChunks) {
      sections.push(`[${chunk.lectureTitle}]:\n${chunk.content}`);
    }
  }

  if (context.skills.length > 0) {
    sections.push('\n===== RELATED MICRO-SKILLS =====');
    for (const skill of context.skills) {
      sections.push(`- ${skill.name}${skill.description ? `: ${skill.description}` : ''}`);
    }
  }

  return sections.join('\n\n') || 'No additional context retrieved.';
}

// ============================================
// EMBEDDING STORAGE OPERATIONS
// ============================================

/**
 * Store embedding for a micro_skill
 */
export async function storeSkillEmbedding(skillId: string, embedding: number[]): Promise<void> {
  const vectorStr = `[${embedding.join(',')}]`;
  await db.execute(sql`
    UPDATE micro_skills SET embedding = ${vectorStr}::vector WHERE id = ${skillId}
  `);
}

/**
 * Store embedding for an item
 */
export async function storeItemEmbedding(itemId: string, embedding: number[]): Promise<void> {
  const vectorStr = `[${embedding.join(',')}]`;
  await db.execute(sql`
    UPDATE items SET embedding = ${vectorStr}::vector WHERE id = ${itemId}
  `);
}

/**
 * Store embedding for a lecture chunk
 */
export async function storeChunkEmbedding(chunkId: string, embedding: number[]): Promise<void> {
  const vectorStr = `[${embedding.join(',')}]`;
  await db.execute(sql`
    UPDATE lecture_chunks SET embedding = ${vectorStr}::vector WHERE id = ${chunkId}
  `);
}

/**
 * Store embedding for a knowledge base entry
 */
export async function storeKnowledgeBaseEmbedding(entryId: string, embedding: number[]): Promise<void> {
  const vectorStr = `[${embedding.join(',')}]`;
  await db.execute(sql`
    UPDATE knowledge_base SET embedding = ${vectorStr}::vector WHERE id = ${entryId}
  `);
}

// ============================================
// UTILITY
// ============================================

/**
 * Check if pgvector extension is available
 */
export async function checkPgvectorAvailable(): Promise<boolean> {
  try {
    const result = await db.execute(sql`SELECT 1 FROM pg_extension WHERE extname = 'vector'`);
    return (result.rows as any[]).length > 0;
  } catch {
    return false;
  }
}

/**
 * Get embedding statistics
 */
export async function getEmbeddingStats(): Promise<{
  skillsWithEmbeddings: number;
  totalSkills: number;
  itemsWithEmbeddings: number;
  totalItems: number;
  chunksWithEmbeddings: number;
  totalChunks: number;
  knowledgeWithEmbeddings: number;
  totalKnowledge: number;
}> {
  const [skills, items, chunks, knowledge] = await Promise.all([
    db.execute(sql`SELECT COUNT(*) as total, COUNT(embedding) as with_emb FROM micro_skills WHERE is_active = true`),
    db.execute(sql`SELECT COUNT(*) as total, COUNT(embedding) as with_emb FROM items WHERE is_active = true`),
    db.execute(sql`SELECT COUNT(*) as total, COUNT(embedding) as with_emb FROM lecture_chunks`),
    db.execute(sql`SELECT COUNT(*) as total, COUNT(embedding) as with_emb FROM knowledge_base`),
  ]);

  return {
    skillsWithEmbeddings: Number((skills.rows as any[])[0]?.with_emb || 0),
    totalSkills: Number((skills.rows as any[])[0]?.total || 0),
    itemsWithEmbeddings: Number((items.rows as any[])[0]?.with_emb || 0),
    totalItems: Number((items.rows as any[])[0]?.total || 0),
    chunksWithEmbeddings: Number((chunks.rows as any[])[0]?.with_emb || 0),
    totalChunks: Number((chunks.rows as any[])[0]?.total || 0),
    knowledgeWithEmbeddings: Number((knowledge.rows as any[])[0]?.with_emb || 0),
    totalKnowledge: Number((knowledge.rows as any[])[0]?.total || 0),
  };
}

export { EMBEDDING_MODEL, EMBEDDING_DIMENSIONS };
