/**
 * Transcript Ingestion Service (M3)
 * Handles transcript upload, chunking, embedding, and skill mapping
 */

import { db } from '@/lib/db';
import { lectures, lectureChunks, lectureSkillMap, microSkills } from '@/lib/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { createHash } from 'crypto';

// ============================================
// TYPES
// ============================================

export interface TranscriptUploadInput {
  unitId: string;
  title: string;
  lecturerName?: string;
  lectureDate?: string;
  source?: 'KSL' | 'ATP_OFFICIAL' | 'EXTERNAL' | 'ADMIN_UPLOAD';
  transcriptContent: string;
  format: 'vtt' | 'txt' | 'srt' | 'json';
  durationMinutes?: number;
}

export interface TranscriptChunk {
  index: number;
  text: string;
  startTime?: number;
  endTime?: number;
  tokenCount: number;
  hash: string;
}

export interface SkillMappingSuggestion {
  chunkId: string;
  skillId: string;
  skillCode: string;
  skillTitle: string;
  confidence: number;
  evidenceSpan: string;
}

export interface LectureWithChunks {
  id: string;
  title: string;
  unitId: string | null;
  lecturerName: string | null;
  lectureDate: Date | null;
  source: string;
  durationMinutes: number | null;
  chunksCount: number;
  mappingsCount: number;
  approvedMappingsCount: number;
}

// ============================================
// CHUNKING
// ============================================

const CHUNK_TARGET_TOKENS = 400;  // Target chunk size
const CHUNK_MAX_TOKENS = 600;     // Max chunk size
const OVERLAP_TOKENS = 50;        // Overlap between chunks

/**
 * Estimate token count (rough: ~4 chars per token for English)
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Generate SHA256 hash for deduplication
 */
function hashChunk(text: string): string {
  return createHash('sha256').update(text.normalize('NFKC')).digest('hex').substring(0, 32);
}

/**
 * Parse VTT format to extract text and timestamps
 */
function parseVTT(content: string): { text: string; startTime?: number; endTime?: number }[] {
  const blocks: { text: string; startTime?: number; endTime?: number }[] = [];
  const lines = content.split('\n');
  
  let currentText = '';
  let currentStart: number | undefined;
  let currentEnd: number | undefined;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Skip header and empty lines
    if (line === 'WEBVTT' || line === '' || /^\d+$/.test(line)) {
      if (currentText) {
        blocks.push({ text: currentText.trim(), startTime: currentStart, endTime: currentEnd });
        currentText = '';
        currentStart = undefined;
        currentEnd = undefined;
      }
      continue;
    }
    
    // Parse timestamp line: "00:00:00.000 --> 00:00:05.000"
    const timestampMatch = line.match(/(\d{2}:\d{2}:\d{2}[.,]\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}[.,]\d{3})/);
    if (timestampMatch) {
      if (currentText) {
        blocks.push({ text: currentText.trim(), startTime: currentStart, endTime: currentEnd });
        currentText = '';
      }
      currentStart = parseTimestamp(timestampMatch[1]);
      currentEnd = parseTimestamp(timestampMatch[2]);
      continue;
    }
    
    // Otherwise it's text content
    currentText += ' ' + line;
  }
  
  // Don't forget last block
  if (currentText) {
    blocks.push({ text: currentText.trim(), startTime: currentStart, endTime: currentEnd });
  }
  
  return blocks;
}

/**
 * Parse SRT format
 */
function parseSRT(content: string): { text: string; startTime?: number; endTime?: number }[] {
  // SRT format is similar to VTT
  return parseVTT(content);
}

/**
 * Parse timestamp "HH:MM:SS.mmm" to seconds
 */
function parseTimestamp(ts: string): number {
  const parts = ts.replace(',', '.').split(':');
  const hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);
  const seconds = parseFloat(parts[2]);
  return hours * 3600 + minutes * 60 + seconds;
}

/**
 * Parse plain text (no timestamps)
 */
function parseText(content: string): { text: string; startTime?: number; endTime?: number }[] {
  // Split by paragraphs or sentences
  const paragraphs = content.split(/\n\n+/);
  return paragraphs
    .filter(p => p.trim().length > 0)
    .map(text => ({ text: text.trim() }));
}

/**
 * Chunk transcript into RAG-friendly segments
 */
export function chunkTranscript(
  content: string,
  format: 'vtt' | 'txt' | 'srt' | 'json'
): TranscriptChunk[] {
  // Parse based on format
  let rawBlocks: { text: string; startTime?: number; endTime?: number }[];
  
  switch (format) {
    case 'vtt':
      rawBlocks = parseVTT(content);
      break;
    case 'srt':
      rawBlocks = parseSRT(content);
      break;
    case 'json':
      try {
        const parsed = JSON.parse(content);
        rawBlocks = Array.isArray(parsed) ? parsed : [{ text: content }];
      } catch {
        rawBlocks = [{ text: content }];
      }
      break;
    default:
      rawBlocks = parseText(content);
  }
  
  // Merge small blocks and split large ones
  const chunks: TranscriptChunk[] = [];
  let currentChunk = '';
  let currentStart: number | undefined;
  let currentEnd: number | undefined;
  
  for (const block of rawBlocks) {
    const blockTokens = estimateTokens(block.text);
    const currentTokens = estimateTokens(currentChunk);
    
    // If adding this block would exceed max, finalize current chunk
    if (currentTokens + blockTokens > CHUNK_MAX_TOKENS && currentChunk) {
      chunks.push({
        index: chunks.length,
        text: currentChunk.trim(),
        startTime: currentStart,
        endTime: currentEnd,
        tokenCount: estimateTokens(currentChunk),
        hash: hashChunk(currentChunk),
      });
      
      // Start new chunk with overlap
      const words = currentChunk.split(' ');
      const overlapWords = words.slice(-Math.ceil(OVERLAP_TOKENS / 2));
      currentChunk = overlapWords.join(' ') + ' ' + block.text;
      currentStart = block.startTime;
      currentEnd = block.endTime;
    } else {
      // Add to current chunk
      currentChunk += ' ' + block.text;
      if (currentStart === undefined) currentStart = block.startTime;
      currentEnd = block.endTime;
    }
    
    // If current chunk is at target size, consider finalizing
    if (estimateTokens(currentChunk) >= CHUNK_TARGET_TOKENS) {
      // Continue if we're in the middle of a sentence, otherwise finalize
      if (!block.text.match(/[.!?]$/)) continue;
      
      chunks.push({
        index: chunks.length,
        text: currentChunk.trim(),
        startTime: currentStart,
        endTime: currentEnd,
        tokenCount: estimateTokens(currentChunk),
        hash: hashChunk(currentChunk),
      });
      currentChunk = '';
      currentStart = undefined;
      currentEnd = undefined;
    }
  }
  
  // Final chunk
  if (currentChunk.trim()) {
    chunks.push({
      index: chunks.length,
      text: currentChunk.trim(),
      startTime: currentStart,
      endTime: currentEnd,
      tokenCount: estimateTokens(currentChunk),
      hash: hashChunk(currentChunk),
    });
  }
  
  return chunks;
}

// ============================================
// SKILL MAPPING (AI-SUGGESTED)
// ============================================

/**
 * Generate skill mapping suggestions based on chunk content
 * Uses keyword matching + semantic similarity (when available)
 */
export async function suggestSkillMappings(
  chunks: Array<{ id: string; text: string }>,
  unitId: string
): Promise<SkillMappingSuggestion[]> {
  // Get skills for this unit
  const skills = await db.select().from(microSkills)
    .where(eq(microSkills.unitId, unitId));
  
  if (skills.length === 0) {
    console.log(`No skills found for unit ${unitId}`);
    return [];
  }
  
  const suggestions: SkillMappingSuggestion[] = [];
  
  for (const chunk of chunks) {
    const chunkText = chunk.text.toLowerCase();
    
    for (const skill of skills) {
      // Simple keyword matching (can be enhanced with embeddings)
      const skillTitle = (skill.title || skill.name || '').toLowerCase();
      const skillCode = (skill.skillCode || skill.code || '').toLowerCase();
      const skillDesc = (skill.description || '').toLowerCase();
      
      // Extract keywords from skill title/description
      const keywords = [
        ...skillTitle.split(/\W+/).filter(w => w.length > 3),
        ...skillDesc.split(/\W+/).filter(w => w.length > 4),
      ];
      
      // Count keyword matches
      let matches = 0;
      let evidenceWords: string[] = [];
      for (const kw of keywords) {
        if (chunkText.includes(kw)) {
          matches++;
          evidenceWords.push(kw);
        }
      }
      
      // Calculate confidence (simple heuristic)
      const uniqueMatches = Math.min(5, matches);
      const confidence = uniqueMatches / 5; // 0.0 - 1.0
      
      if (confidence >= 0.3) {
        // Extract evidence span (first sentence containing a keyword)
        const sentences = chunk.text.split(/[.!?]+/);
        const evidenceSentence = sentences.find(s => 
          evidenceWords.some(w => s.toLowerCase().includes(w))
        );
        
        suggestions.push({
          chunkId: chunk.id,
          skillId: skill.id,
          skillCode: skill.skillCode || skill.code || '',
          skillTitle: skill.title || skill.name || '',
          confidence,
          evidenceSpan: evidenceSentence?.trim() || chunk.text.substring(0, 200),
        });
      }
    }
  }
  
  // Sort by confidence descending
  return suggestions.sort((a, b) => b.confidence - a.confidence);
}

// ============================================
// INGESTION PIPELINE
// ============================================

/**
 * Full transcript ingestion pipeline
 * 1. Create lecture record
 * 2. Chunk transcript
 * 3. Store chunks
 * 4. Generate skill mapping suggestions
 */
export async function ingestTranscript(input: TranscriptUploadInput): Promise<{
  lectureId: string;
  chunksCreated: number;
  mappingSuggestions: number;
}> {
  // 1. Create lecture
  const [lecture] = await db.insert(lectures).values({
    unitId: input.unitId,
    title: input.title,
    lecturerName: input.lecturerName,
    lectureDate: input.lectureDate,
    source: input.source || 'ADMIN_UPLOAD',
    durationMinutes: input.durationMinutes,
    metadata: {
      originalFormat: input.format,
      hasTimestamps: input.format === 'vtt' || input.format === 'srt',
    },
  }).returning();
  
  // 2. Chunk transcript
  const chunks = chunkTranscript(input.transcriptContent, input.format);
  
  // 3. Store chunks
  const chunkRecords = await db.insert(lectureChunks).values(
    chunks.map(chunk => ({
      lectureId: lecture.id,
      chunkIndex: chunk.index,
      text: chunk.text,
      startTime: chunk.startTime ? Math.round(chunk.startTime) : null,
      endTime: chunk.endTime ? Math.round(chunk.endTime) : null,
      tokenCount: chunk.tokenCount,
      chunkHash: chunk.hash,
    }))
  ).returning();
  
  // 4. Generate skill mapping suggestions
  const chunkInputs = chunkRecords.map(c => ({ id: c.id, text: c.text }));
  const suggestions = await suggestSkillMappings(chunkInputs, input.unitId);
  
  // 5. Store suggestions as SUGGESTED mappings
  if (suggestions.length > 0) {
    await db.insert(lectureSkillMap).values(
      suggestions.map(s => ({
        chunkId: s.chunkId,
        skillId: s.skillId,
        confidence: s.confidence.toFixed(4),
        evidenceSpan: s.evidenceSpan,
        status: 'SUGGESTED' as const,
      }))
    );
  }
  
  return {
    lectureId: lecture.id,
    chunksCreated: chunkRecords.length,
    mappingSuggestions: suggestions.length,
  };
}

// ============================================
// ADMIN APPROVAL
// ============================================

/**
 * Approve a skill mapping
 */
export async function approveMapping(
  mappingId: string,
  adminUserId: string
): Promise<void> {
  await db.update(lectureSkillMap)
    .set({
      status: 'APPROVED',
      approvedBy: adminUserId,
      approvedAt: new Date(),
    })
    .where(eq(lectureSkillMap.id, mappingId));
}

/**
 * Reject a skill mapping
 */
export async function rejectMapping(mappingId: string): Promise<void> {
  await db.update(lectureSkillMap)
    .set({ status: 'REJECTED' })
    .where(eq(lectureSkillMap.id, mappingId));
}

/**
 * Batch approve mappings
 */
export async function batchApproveMappings(
  mappingIds: string[],
  adminUserId: string
): Promise<number> {
  const result = await db.update(lectureSkillMap)
    .set({
      status: 'APPROVED',
      approvedBy: adminUserId,
      approvedAt: new Date(),
    })
    .where(inArray(lectureSkillMap.id, mappingIds));
  
  return mappingIds.length;
}

// ============================================
// RETRIEVAL FUNCTIONS
// ============================================

/**
 * Get approved lecture chunks for a skill
 * Used by retrieval-first generation
 */
export async function getApprovedChunksForSkill(skillId: string): Promise<Array<{
  chunkId: string;
  chunkText: string;
  lectureTitle: string;
  startTime: number | null;
  endTime: number | null;
  confidence: number;
  evidenceSpan: string;
}>> {
  const results = await db
    .select({
      chunkId: lectureChunks.id,
      chunkText: lectureChunks.text,
      lectureTitle: lectures.title,
      startTime: lectureChunks.startTime,
      endTime: lectureChunks.endTime,
      confidence: lectureSkillMap.confidence,
      evidenceSpan: lectureSkillMap.evidenceSpan,
    })
    .from(lectureSkillMap)
    .innerJoin(lectureChunks, eq(lectureSkillMap.chunkId, lectureChunks.id))
    .innerJoin(lectures, eq(lectureChunks.lectureId, lectures.id))
    .where(and(
      eq(lectureSkillMap.skillId, skillId),
      eq(lectureSkillMap.status, 'APPROVED')
    ));
  
  return results.map(r => ({
    chunkId: r.chunkId,
    chunkText: r.chunkText,
    lectureTitle: r.lectureTitle,
    startTime: r.startTime,
    endTime: r.endTime,
    confidence: parseFloat(r.confidence || '0'),
    evidenceSpan: r.evidenceSpan || '',
  }));
}

/**
 * Get approved chunks for multiple skills
 */
export async function getApprovedChunksForSkills(skillIds: string[]): Promise<Map<string, Array<{
  chunkId: string;
  chunkText: string;
  lectureTitle: string;
  confidence: number;
}>>> {
  const results = await db
    .select({
      skillId: lectureSkillMap.skillId,
      chunkId: lectureChunks.id,
      chunkText: lectureChunks.text,
      lectureTitle: lectures.title,
      confidence: lectureSkillMap.confidence,
    })
    .from(lectureSkillMap)
    .innerJoin(lectureChunks, eq(lectureSkillMap.chunkId, lectureChunks.id))
    .innerJoin(lectures, eq(lectureChunks.lectureId, lectures.id))
    .where(and(
      inArray(lectureSkillMap.skillId, skillIds),
      eq(lectureSkillMap.status, 'APPROVED')
    ));
  
  const map = new Map<string, Array<any>>();
  for (const r of results) {
    if (!map.has(r.skillId)) map.set(r.skillId, []);
    map.get(r.skillId)!.push({
      chunkId: r.chunkId,
      chunkText: r.chunkText,
      lectureTitle: r.lectureTitle,
      confidence: parseFloat(r.confidence || '0'),
    });
  }
  
  return map;
}

/**
 * List all lectures for admin management
 */
export async function listLectures(): Promise<LectureWithChunks[]> {
  const lectureList = await db.select().from(lectures)
    .orderBy(lectures.createdAt);
  
  const result: LectureWithChunks[] = [];
  
  for (const lec of lectureList) {
    const chunks = await db.select().from(lectureChunks)
      .where(eq(lectureChunks.lectureId, lec.id));
    
    const mappings = await db.select().from(lectureSkillMap)
      .where(inArray(lectureSkillMap.chunkId, chunks.map(c => c.id)));
    
    const approvedCount = mappings.filter(m => m.status === 'APPROVED').length;
    
    result.push({
      id: lec.id,
      title: lec.title,
      unitId: lec.unitId,
      lecturerName: lec.lecturerName,
      lectureDate: lec.lectureDate,
      source: lec.source,
      durationMinutes: lec.durationMinutes,
      chunksCount: chunks.length,
      mappingsCount: mappings.length,
      approvedMappingsCount: approvedCount,
    });
  }
  
  return result;
}

/**
 * Get pending skill mappings for admin approval
 */
export async function getPendingMappings(limit = 50): Promise<Array<{
  id: string;
  chunkText: string;
  skillCode: string;
  skillTitle: string;
  confidence: number;
  evidenceSpan: string;
  lectureTitle: string;
}>> {
  const results = await db
    .select({
      id: lectureSkillMap.id,
      chunkText: lectureChunks.text,
      skillCode: microSkills.skillCode,
      skillTitle: microSkills.title,
      confidence: lectureSkillMap.confidence,
      evidenceSpan: lectureSkillMap.evidenceSpan,
      lectureTitle: lectures.title,
    })
    .from(lectureSkillMap)
    .innerJoin(lectureChunks, eq(lectureSkillMap.chunkId, lectureChunks.id))
    .innerJoin(lectures, eq(lectureChunks.lectureId, lectures.id))
    .innerJoin(microSkills, eq(lectureSkillMap.skillId, microSkills.id))
    .where(eq(lectureSkillMap.status, 'SUGGESTED'))
    .limit(limit);
  
  return results.map(r => ({
    id: r.id,
    chunkText: r.chunkText.substring(0, 300) + (r.chunkText.length > 300 ? '...' : ''),
    skillCode: r.skillCode || '',
    skillTitle: r.skillTitle || '',
    confidence: parseFloat(r.confidence || '0'),
    evidenceSpan: r.evidenceSpan || '',
    lectureTitle: r.lectureTitle,
  }));
}
