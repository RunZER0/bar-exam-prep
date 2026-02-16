/**
 * Retrieval Service (M3)
 * Retrieval-first grounding for study asset generation
 * Pulls from: outline_topics, lecture_chunks, vetted_authorities
 */

import { db } from '@/lib/db';
import { 
  outlineTopics, 
  skillOutlineMap, 
  vettedAuthorities, 
  microSkills,
  missingAuthorityLog,
  studySessions,
  studyAssets
} from '@/lib/db/schema';
import { 
  getApprovedChunksForSkill, 
  getApprovedChunksForSkills 
} from './transcript-ingestion';
import { eq, and, inArray, sql } from 'drizzle-orm';

// ============================================
// TYPES
// ============================================

export interface GroundingSource {
  type: 'OUTLINE_TOPIC' | 'LECTURE_CHUNK' | 'AUTHORITY';
  id: string;
  title: string;
  relevantText: string;
  confidence?: number;
  metadata?: Record<string, any>;
}

export interface GroundingRefs {
  outline_topic_ids: string[];
  lecture_chunk_ids: string[];
  authority_ids: string[];
}

export interface RetrievalResult {
  groundingRefs: GroundingRefs;
  sources: GroundingSource[];
  missingClaims: string[];
}

// ============================================
// OUTLINE TOPIC RETRIEVAL
// ============================================

/**
 * Get outline topics mapped to a skill
 */
export async function getOutlineTopicsForSkill(skillId: string): Promise<GroundingSource[]> {
  const mappings = await db
    .select({
      topicId: skillOutlineMap.topicId,
      coverage: skillOutlineMap.coverageStrength,
      title: outlineTopics.title,
      content: outlineTopics.description,
      learningOutcomes: outlineTopics.learningOutcomes,
    })
    .from(skillOutlineMap)
    .innerJoin(outlineTopics, eq(skillOutlineMap.topicId, outlineTopics.id))
    .where(eq(skillOutlineMap.skillId, skillId));
  
  return mappings.map(m => ({
    type: 'OUTLINE_TOPIC' as const,
    id: m.topicId,
    title: m.title || 'Untitled Topic',
    relevantText: m.content || (m.learningOutcomes as string[])?.join('. ') || '',
    confidence: parseFloat(m.coverage || '1.0'),
    metadata: { learningOutcomes: m.learningOutcomes },
  }));
}

/**
 * Get outline topics for multiple skills
 */
export async function getOutlineTopicsForSkills(skillIds: string[]): Promise<Map<string, GroundingSource[]>> {
  const mappings = await db
    .select({
      skillId: skillOutlineMap.skillId,
      topicId: skillOutlineMap.topicId,
      coverage: skillOutlineMap.coverageStrength,
      title: outlineTopics.title,
      content: outlineTopics.description,
    })
    .from(skillOutlineMap)
    .innerJoin(outlineTopics, eq(skillOutlineMap.topicId, outlineTopics.id))
    .where(inArray(skillOutlineMap.skillId, skillIds));
  
  const map = new Map<string, GroundingSource[]>();
  for (const m of mappings) {
    if (!map.has(m.skillId)) map.set(m.skillId, []);
    map.get(m.skillId)!.push({
      type: 'OUTLINE_TOPIC' as const,
      id: m.topicId,
      title: m.title || 'Untitled Topic',
      relevantText: m.content || '',
      confidence: parseFloat(m.coverage || '1.0'),
    });
  }
  
  return map;
}

// ============================================
// AUTHORITY RETRIEVAL
// ============================================

/**
 * Get vetted authorities related to skills
 */
export async function getAuthoritiesForSkill(skillId: string): Promise<GroundingSource[]> {
  // Authorities might have skillIds as array or in related fields
  const authorities = await db.select().from(vettedAuthorities)
    .where(eq(vettedAuthorities.isVerified, true));
  
  // Filter authorities that reference this skill
  const matching = authorities.filter(a => {
    const skillIds = a.skillIds as string[] | null;
    return skillIds?.includes(skillId);
  });
  
  return matching.map(a => ({
    type: 'AUTHORITY' as const,
    id: a.id,
    title: a.title,
    relevantText: a.summary || a.fullText?.substring(0, 500) || '',
    confidence: 1.0, // Verified authorities have full confidence
    metadata: {
      citation: a.citation,
      authorityType: a.authorityType,
      sourceUrl: a.sourceUrl,
    },
  }));
}

/**
 * Get authorities for a unit
 */
export async function getAuthoritiesForUnit(unitId: string): Promise<GroundingSource[]> {
  const authorities = await db.select().from(vettedAuthorities)
    .where(eq(vettedAuthorities.isVerified, true));
  
  // Filter by unitIds array
  const matching = authorities.filter(a => {
    const unitIds = a.unitIds as string[] | null;
    return unitIds?.includes(unitId);
  });
  
  return matching.map(a => ({
    type: 'AUTHORITY' as const,
    id: a.id,
    title: a.title,
    relevantText: a.summary || a.fullText?.substring(0, 500) || '',
    confidence: 1.0,
    metadata: {
      citation: a.citation,
      authorityType: a.authorityType,
    },
  }));
}

// ============================================
// LECTURE CHUNK RETRIEVAL
// ============================================

/**
 * Get lecture chunks for a skill (wrapper for transcript-ingestion function)
 */
export async function getLectureChunksForSkill(skillId: string): Promise<GroundingSource[]> {
  const chunks = await getApprovedChunksForSkill(skillId);
  
  return chunks.map(c => ({
    type: 'LECTURE_CHUNK' as const,
    id: c.chunkId,
    title: c.lectureTitle,
    relevantText: c.chunkText,
    confidence: c.confidence,
    metadata: {
      startTime: c.startTime,
      endTime: c.endTime,
      evidenceSpan: c.evidenceSpan,
    },
  }));
}

// ============================================
// COMBINED RETRIEVAL
// ============================================

/**
 * Retrieve all grounding sources for a skill
 * Returns outline topics + lecture chunks + authorities
 */
export async function retrieveGroundingForSkill(skillId: string): Promise<RetrievalResult> {
  const [outlineTopics, lectureChunks, authorities] = await Promise.all([
    getOutlineTopicsForSkill(skillId),
    getLectureChunksForSkill(skillId),
    getAuthoritiesForSkill(skillId),
  ]);
  
  const allSources = [...outlineTopics, ...lectureChunks, ...authorities];
  
  return {
    groundingRefs: {
      outline_topic_ids: outlineTopics.map(s => s.id),
      lecture_chunk_ids: lectureChunks.map(s => s.id),
      authority_ids: authorities.map(s => s.id),
    },
    sources: allSources,
    missingClaims: [], // Will be populated during generation
  };
}

/**
 * Retrieve grounding for multiple skills (batch)
 */
export async function retrieveGroundingForSkills(skillIds: string[]): Promise<Map<string, RetrievalResult>> {
  const results = new Map<string, RetrievalResult>();
  
  // Batch retrieve outline topics and lecture chunks
  const [outlineMap, lectureMap] = await Promise.all([
    getOutlineTopicsForSkills(skillIds),
    getApprovedChunksForSkills(skillIds),
  ]);
  
  for (const skillId of skillIds) {
    const outlines = outlineMap.get(skillId) || [];
    const lectures = (lectureMap.get(skillId) || []).map(c => ({
      type: 'LECTURE_CHUNK' as const,
      id: c.chunkId,
      title: c.lectureTitle,
      relevantText: c.chunkText,
      confidence: c.confidence,
    }));
    const authorities = await getAuthoritiesForSkill(skillId);
    
    results.set(skillId, {
      groundingRefs: {
        outline_topic_ids: outlines.map(s => s.id),
        lecture_chunk_ids: lectures.map(s => s.id),
        authority_ids: authorities.map(s => s.id),
      },
      sources: [...outlines, ...lectures, ...authorities],
      missingClaims: [],
    });
  }
  
  return results;
}

// ============================================
// MISSING AUTHORITY LOGGING
// ============================================

/**
 * Log when a claim couldn't be grounded in verified sources
 */
export async function logMissingAuthority(params: {
  claimText: string;
  skillIds: string[];
  searchQuery?: string;
  searchResults?: any;
  errorTag: 'MISSING_AUTHORITY' | 'MISSING_TRANSCRIPT_SUPPORT' | 'LOW_CONFIDENCE_SOURCE';
  sessionId?: string;
  assetId?: string;
}): Promise<void> {
  await db.insert(missingAuthorityLog).values({
    claimText: params.claimText,
    requestedSkillIds: params.skillIds,
    searchQuery: params.searchQuery,
    searchResults: params.searchResults,
    errorTag: params.errorTag,
    sessionId: params.sessionId,
    assetId: params.assetId,
  });
}

// ============================================
// GROUNDED CONTENT GENERATION
// ============================================

/**
 * Generate content with retrieval-first grounding
 * Returns content that cites sources OR indicates missing sources
 */
export function generateGroundedContent(
  skillTitle: string,
  sources: GroundingSource[]
): {
  content: string;
  citedSources: GroundingSource[];
  uncitedClaims: string[];
} {
  // Group sources by type
  const outlines = sources.filter(s => s.type === 'OUTLINE_TOPIC');
  const lectures = sources.filter(s => s.type === 'LECTURE_CHUNK');
  const authorities = sources.filter(s => s.type === 'AUTHORITY');
  
  const citedSources: GroundingSource[] = [];
  const contentParts: string[] = [];
  
  // Key Concepts from outline topics
  if (outlines.length > 0) {
    contentParts.push('## Key Concepts\n');
    for (const outline of outlines) {
      contentParts.push(`${outline.relevantText}\n`);
      citedSources.push(outline);
    }
  } else {
    contentParts.push('## Key Concepts\n*Not found in verified sources yet.*\n');
  }
  
  // Lecture Insights from transcripts
  if (lectures.length > 0) {
    contentParts.push('\n## Lecture Insights\n');
    for (const lecture of lectures.slice(0, 3)) { // Top 3 most relevant
      contentParts.push(`> "${lecture.relevantText.substring(0, 300)}${lecture.relevantText.length > 300 ? '...' : ''}"\n`);
      contentParts.push(`— _${lecture.title}_\n\n`);
      citedSources.push(lecture);
    }
  }
  
  // Authorities
  if (authorities.length > 0) {
    contentParts.push('\n## Legal Authorities\n');
    for (const auth of authorities) {
      contentParts.push(`**${auth.title}**\n`);
      if (auth.metadata?.citation) {
        contentParts.push(`_Citation: ${auth.metadata.citation}_\n`);
      }
      contentParts.push(`${auth.relevantText}\n\n`);
      citedSources.push(auth);
    }
  } else {
    contentParts.push('\n## Legal Authorities\n*Not found in verified sources yet.*\n');
  }
  
  // Track uncited claims (would need expansion for real AI generation)
  const uncitedClaims: string[] = [];
  if (outlines.length === 0) uncitedClaims.push('Key concepts');
  if (authorities.length === 0) uncitedClaims.push('Legal authorities');
  
  return {
    content: contentParts.join(''),
    citedSources,
    uncitedClaims,
  };
}

/**
 * Build grounding refs JSON for storage
 */
export function buildGroundingRefsJson(sources: GroundingSource[]): GroundingRefs {
  return {
    outline_topic_ids: sources.filter(s => s.type === 'OUTLINE_TOPIC').map(s => s.id),
    lecture_chunk_ids: sources.filter(s => s.type === 'LECTURE_CHUNK').map(s => s.id),
    authority_ids: sources.filter(s => s.type === 'AUTHORITY').map(s => s.id),
  };
}

/**
 * Check if grounding has sufficient sources
 */
export function hasAdequateGrounding(sources: GroundingSource[]): boolean {
  // At minimum, should have at least outline topics
  const hasOutlines = sources.some(s => s.type === 'OUTLINE_TOPIC');
  return hasOutlines;
}

/**
 * Get grounding summary for display
 */
export function getGroundingSummary(refs: GroundingRefs): string {
  const parts: string[] = [];
  if (refs.outline_topic_ids.length > 0) {
    parts.push(`${refs.outline_topic_ids.length} outline topic(s)`);
  }
  if (refs.lecture_chunk_ids.length > 0) {
    parts.push(`${refs.lecture_chunk_ids.length} lecture chunk(s)`);
  }
  if (refs.authority_ids.length > 0) {
    parts.push(`${refs.authority_ids.length} legal authorit${refs.authority_ids.length === 1 ? 'y' : 'ies'}`);
  }
  
  if (parts.length === 0) return 'No verified sources';
  return `Grounded in: ${parts.join(', ')}`;
}
