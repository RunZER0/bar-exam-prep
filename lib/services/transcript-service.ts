/**
 * YNAI Mastery Engine v3 - Lecture Transcript Service
 * 
 * Per spec section 4.3: Each lecture → chunks (timestamped) → skills.
 * Powers "Show me the lecture where [concept] was taught."
 * 
 * Responsibilities:
 * 1. Ingest lecture transcripts (VTT/SRT or plain text)
 * 2. Chunk into meaningful segments (~2-5 minute chunks)
 * 3. Extract skill mentions and legal authorities
 * 4. Link chunks to micro-skills
 * 5. Enable RAG retrieval for the tutor
 */

// ============================================
// TYPES
// ============================================

export interface LectureMetadata {
  id: string;
  name: string;
  unitId: string;
  lectureSourceId: string; // External ID (YouTube, etc.)
  duration_sec: number;
  lecturer: string;
  recordedAt?: Date;
}

export interface TranscriptChunk {
  id: string;
  lectureId: string;
  chunkIndex: number;
  startSec: number;
  endSec: number;
  text: string;
  wordCount: number;
  
  // Extracted metadata
  skillIds: string[];
  authorityIds: string[];
  keyTerms: string[];
  
  // Embedding for RAG
  embedding?: number[];
}

export interface ParsedTranscript {
  metadata: Partial<LectureMetadata>;
  chunks: TranscriptChunk[];
  rawText: string;
}

export interface VTTCue {
  startSec: number;
  endSec: number;
  text: string;
}

export interface TranscriptSearchResult {
  chunk: TranscriptChunk;
  lecture: LectureMetadata;
  relevanceScore: number;
  excerpt: string;
  timestamp: string; // Formatted "12:34"
}

// ============================================
// CONSTANTS
// ============================================

const TRANSCRIPT_CONFIG = {
  // Chunk sizing
  minChunkDurationSec: 60,  // 1 minute minimum
  maxChunkDurationSec: 300, // 5 minutes maximum
  targetChunkDurationSec: 180, // 3 minutes target
  
  // Paragraph-based chunking
  minWordsPerChunk: 150,
  maxWordsPerChunk: 600,
  targetWordsPerChunk: 400,
  
  // Overlap for context
  chunkOverlapSec: 10, // 10 second overlap between chunks
  
  // Embedding
  embeddingModel: 'text-embedding-3-small',
  embeddingDimensions: 1536,
};

// ============================================
// PARSING: VTT/SRT
// ============================================

/**
 * Parse VTT (WebVTT) transcript format
 */
export function parseVTT(vttContent: string): VTTCue[] {
  const cues: VTTCue[] = [];
  
  // Remove WEBVTT header and metadata
  const lines = vttContent.split('\n');
  let i = 0;
  
  // Skip header
  while (i < lines.length && !lines[i].includes('-->')) {
    i++;
  }
  
  while (i < lines.length) {
    const line = lines[i].trim();
    
    // Timestamp line
    if (line.includes('-->')) {
      const [startStr, endStr] = line.split('-->').map(s => s.trim());
      const startSec = parseTimestamp(startStr);
      const endSec = parseTimestamp(endStr);
      
      // Collect text lines until empty line or next timestamp
      i++;
      const textLines: string[] = [];
      while (i < lines.length && lines[i].trim() && !lines[i].includes('-->')) {
        textLines.push(lines[i].trim());
        i++;
      }
      
      if (textLines.length > 0) {
        cues.push({
          startSec,
          endSec,
          text: textLines.join(' ').replace(/<[^>]+>/g, ''), // Strip HTML tags
        });
      }
    } else {
      i++;
    }
  }
  
  return cues;
}

/**
 * Parse SRT transcript format
 */
export function parseSRT(srtContent: string): VTTCue[] {
  const cues: VTTCue[] = [];
  
  // Split by subtitle blocks (separated by blank lines)
  const blocks = srtContent.trim().split(/\n\s*\n/);
  
  for (const block of blocks) {
    const lines = block.trim().split('\n');
    if (lines.length < 3) continue;
    
    // Line 0: Subtitle number (ignore)
    // Line 1: Timestamps
    // Line 2+: Text
    
    const timestampLine = lines[1];
    if (!timestampLine.includes('-->')) continue;
    
    const [startStr, endStr] = timestampLine.split('-->').map(s => s.trim());
    const startSec = parseTimestamp(startStr);
    const endSec = parseTimestamp(endStr);
    
    const text = lines.slice(2).join(' ').replace(/<[^>]+>/g, '');
    
    cues.push({ startSec, endSec, text });
  }
  
  return cues;
}

/**
 * Parse timestamp to seconds
 * Supports: HH:MM:SS.mmm, HH:MM:SS,mmm, MM:SS.mmm
 */
function parseTimestamp(ts: string): number {
  // Normalize comma to period
  ts = ts.replace(',', '.');
  
  const parts = ts.split(':');
  
  if (parts.length === 3) {
    // HH:MM:SS.mmm
    const hours = parseInt(parts[0], 10);
    const minutes = parseInt(parts[1], 10);
    const seconds = parseFloat(parts[2]);
    return hours * 3600 + minutes * 60 + seconds;
  } else if (parts.length === 2) {
    // MM:SS.mmm
    const minutes = parseInt(parts[0], 10);
    const seconds = parseFloat(parts[1]);
    return minutes * 60 + seconds;
  }
  
  return 0;
}

/**
 * Format seconds to timestamp string
 */
export function formatTimestamp(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// ============================================
// CHUNKING
// ============================================

/**
 * Chunk transcript cues into meaningful segments
 */
export function chunkTranscript(
  cues: VTTCue[],
  options: Partial<typeof TRANSCRIPT_CONFIG> = {}
): Omit<TranscriptChunk, 'id' | 'lectureId' | 'skillIds' | 'authorityIds' | 'keyTerms'>[] {
  const config = { ...TRANSCRIPT_CONFIG, ...options };
  const chunks: Omit<TranscriptChunk, 'id' | 'lectureId' | 'skillIds' | 'authorityIds' | 'keyTerms'>[] = [];
  
  if (cues.length === 0) return chunks;
  
  let currentChunk = {
    chunkIndex: 0,
    startSec: cues[0].startSec,
    endSec: cues[0].endSec,
    text: cues[0].text,
    wordCount: countWords(cues[0].text),
  };
  
  for (let i = 1; i < cues.length; i++) {
    const cue = cues[i];
    const chunkDuration = cue.endSec - currentChunk.startSec;
    const newWordCount = currentChunk.wordCount + countWords(cue.text);
    
    // Decide whether to extend or finalize chunk
    const shouldFinalize = 
      chunkDuration >= config.targetChunkDurationSec ||
      newWordCount >= config.targetWordsPerChunk ||
      (chunkDuration >= config.minChunkDurationSec && hasNaturalBreak(cue.text));
    
    if (shouldFinalize && currentChunk.wordCount >= config.minWordsPerChunk) {
      // Finalize current chunk
      chunks.push({ ...currentChunk });
      
      // Start new chunk with overlap
      const overlapStartTime = Math.max(currentChunk.endSec - config.chunkOverlapSec, currentChunk.startSec);
      currentChunk = {
        chunkIndex: chunks.length,
        startSec: overlapStartTime,
        endSec: cue.endSec,
        text: cue.text,
        wordCount: countWords(cue.text),
      };
    } else {
      // Extend current chunk
      currentChunk.endSec = cue.endSec;
      currentChunk.text += ' ' + cue.text;
      currentChunk.wordCount = newWordCount;
    }
  }
  
  // Add final chunk
  if (currentChunk.wordCount > 0) {
    chunks.push(currentChunk);
  }
  
  return chunks;
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(w => w.length > 0).length;
}

function hasNaturalBreak(text: string): boolean {
  // Look for ending with period, question mark, or common transition phrases
  const trimmed = text.trim();
  if (/[.?!]$/.test(trimmed)) return true;
  if (/now let's|moving on|next we|so to summarize/i.test(trimmed)) return true;
  return false;
}

// ============================================
// SKILL & AUTHORITY EXTRACTION
// ============================================

/**
 * Extract skill mentions from chunk text
 * Uses pattern matching and keyword detection
 */
export function extractSkillMentions(
  text: string,
  skillPatterns: Map<string, RegExp>
): string[] {
  const matches: string[] = [];
  
  for (const [skillId, pattern] of skillPatterns) {
    if (pattern.test(text)) {
      matches.push(skillId);
    }
  }
  
  return matches;
}

/**
 * Extract legal authority citations
 * Looks for: Act names, section references, case citations
 */
export function extractAuthorities(text: string): string[] {
  const authorities: string[] = [];
  
  // Act patterns
  const actPattern = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s+Act)(?:\s*,?\s*(?:Cap\.?\s*)?(\d+))?/g;
  let match;
  while ((match = actPattern.exec(text)) !== null) {
    authorities.push(match[1]);
  }
  
  // Section patterns
  const sectionPattern = /[Ss]ection\s*(\d+[A-Za-z]?(?:\s*\(\d+\))*)/g;
  while ((match = sectionPattern.exec(text)) !== null) {
    authorities.push(`Section ${match[1]}`);
  }
  
  // Case citation patterns (basic)
  const casePattern = /\b([A-Z][a-z]+)\s+v\.?\s+([A-Z][a-z]+)/g;
  while ((match = casePattern.exec(text)) !== null) {
    authorities.push(`${match[1]} v ${match[2]}`);
  }
  
  return [...new Set(authorities)];
}

/**
 * Extract key legal terms from text
 */
export function extractKeyTerms(text: string): string[] {
  const legalTerms = [
    'jurisdiction', 'res judicata', 'estoppel', 'prima facie', 'burden of proof',
    'mens rea', 'actus reus', 'bail', 'remand', 'plea', 'conviction', 'acquittal',
    'hearsay', 'admissibility', 'witness', 'cross-examination', 'affidavit',
    'injunction', 'decree', 'judgment', 'appeal', 'revision', 'review',
    'limitation', 'prescription', 'charge', 'indictment', 'arraignment',
    'mitigation', 'probation', 'parole', 'restitution', 'compensation',
    'tort', 'negligence', 'duty of care', 'breach', 'causation', 'damages',
    'contract', 'consideration', 'offer', 'acceptance', 'capacity',
    'trust', 'beneficiary', 'trustee', 'settlor', 'estate',
    'tenancy', 'lease', 'mortgage', 'easement', 'encumbrance',
  ];
  
  const found: string[] = [];
  const lowerText = text.toLowerCase();
  
  for (const term of legalTerms) {
    if (lowerText.includes(term.toLowerCase())) {
      found.push(term);
    }
  }
  
  return found;
}

// ============================================
// MAIN INGESTION PIPELINE
// ============================================

export interface IngestOptions {
  lectureId: string;
  lectureName: string;
  unitId: string;
  lecturer?: string;
  skillPatterns?: Map<string, RegExp>;
  generateEmbeddings?: boolean;
}

/**
 * Main ingestion function
 * Takes raw transcript, parses, chunks, extracts metadata
 */
export async function ingestTranscript(
  transcriptContent: string,
  format: 'vtt' | 'srt' | 'plain',
  options: IngestOptions
): Promise<ParsedTranscript> {
  let cues: VTTCue[];
  
  // Parse based on format
  switch (format) {
    case 'vtt':
      cues = parseVTT(transcriptContent);
      break;
    case 'srt':
      cues = parseSRT(transcriptContent);
      break;
    case 'plain':
      // Plain text: create single cue
      cues = [{
        startSec: 0,
        endSec: 0, // Unknown duration
        text: transcriptContent,
      }];
      break;
    default:
      throw new Error(`Unknown transcript format: ${format}`);
  }
  
  // Chunk the transcript
  const rawChunks = chunkTranscript(cues);
  
  // Enrich chunks with metadata
  const chunks: TranscriptChunk[] = rawChunks.map((chunk, index) => {
    const skillIds = options.skillPatterns 
      ? extractSkillMentions(chunk.text, options.skillPatterns)
      : [];
    const authorityIds = extractAuthorities(chunk.text);
    const keyTerms = extractKeyTerms(chunk.text);
    
    return {
      ...chunk,
      id: `${options.lectureId}-chunk-${index}`,
      lectureId: options.lectureId,
      skillIds,
      authorityIds,
      keyTerms,
    };
  });
  
  // Calculate total duration
  const duration_sec = cues.length > 0 
    ? Math.max(...cues.map(c => c.endSec))
    : 0;
  
  // Build raw text
  const rawText = cues.map(c => c.text).join(' ');
  
  return {
    metadata: {
      id: options.lectureId,
      name: options.lectureName,
      unitId: options.unitId,
      duration_sec,
      lecturer: options.lecturer,
    },
    chunks,
    rawText,
  };
}

// ============================================
// SEARCH & RETRIEVAL
// ============================================

/**
 * Search transcripts by text query (keyword-based)
 */
export function searchTranscriptsKeyword(
  query: string,
  chunks: TranscriptChunk[],
  lectures: Map<string, LectureMetadata>
): TranscriptSearchResult[] {
  const queryTerms = query.toLowerCase().split(/\s+/);
  const results: TranscriptSearchResult[] = [];
  
  for (const chunk of chunks) {
    const chunkLower = chunk.text.toLowerCase();
    let matchCount = 0;
    
    for (const term of queryTerms) {
      if (chunkLower.includes(term)) {
        matchCount++;
      }
    }
    
    if (matchCount > 0) {
      const lecture = lectures.get(chunk.lectureId);
      if (!lecture) continue;
      
      // Extract relevant excerpt
      const excerpt = extractExcerpt(chunk.text, queryTerms[0], 200);
      
      results.push({
        chunk,
        lecture,
        relevanceScore: matchCount / queryTerms.length,
        excerpt,
        timestamp: formatTimestamp(chunk.startSec),
      });
    }
  }
  
  // Sort by relevance
  results.sort((a, b) => b.relevanceScore - a.relevanceScore);
  
  return results.slice(0, 10); // Top 10
}

/**
 * Get transcript chunks for a specific skill
 */
export function getChunksForSkill(
  skillId: string,
  chunks: TranscriptChunk[],
  lectures: Map<string, LectureMetadata>
): TranscriptSearchResult[] {
  const results: TranscriptSearchResult[] = [];
  
  for (const chunk of chunks) {
    if (chunk.skillIds.includes(skillId)) {
      const lecture = lectures.get(chunk.lectureId);
      if (!lecture) continue;
      
      results.push({
        chunk,
        lecture,
        relevanceScore: 1,
        excerpt: chunk.text.slice(0, 200) + '...',
        timestamp: formatTimestamp(chunk.startSec),
      });
    }
  }
  
  return results;
}

/**
 * Extract excerpt around a query term
 */
function extractExcerpt(text: string, term: string, maxLength: number): string {
  const lowerText = text.toLowerCase();
  const termIndex = lowerText.indexOf(term.toLowerCase());
  
  if (termIndex === -1) {
    return text.slice(0, maxLength) + '...';
  }
  
  // Center excerpt around the term
  const start = Math.max(0, termIndex - maxLength / 2);
  const end = Math.min(text.length, termIndex + term.length + maxLength / 2);
  
  let excerpt = text.slice(start, end);
  
  if (start > 0) excerpt = '...' + excerpt;
  if (end < text.length) excerpt = excerpt + '...';
  
  return excerpt;
}

// ============================================
// EMBEDDING GENERATION (for RAG)
// ============================================

/**
 * Generate embeddings for chunks using OpenAI
 * Returns chunks with embeddings populated
 */
export async function generateChunkEmbeddings(
  chunks: TranscriptChunk[]
): Promise<TranscriptChunk[]> {
  // TODO: Integrate with OpenAI embeddings API
  // For now, return chunks without embeddings
  
  console.log('[Transcript Service] Embedding generation not implemented');
  
  return chunks;
}

/**
 * Semantic search using embeddings
 */
export async function searchTranscriptsSemantic(
  query: string,
  chunks: TranscriptChunk[],
  lectures: Map<string, LectureMetadata>
): Promise<TranscriptSearchResult[]> {
  // TODO: Implement semantic search with embeddings
  // For now, fall back to keyword search
  
  return searchTranscriptsKeyword(query, chunks, lectures);
}
