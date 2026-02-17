/**
 * Authority Retrieval Service
 * 
 * Implements websearch-powered authority retrieval with:
 * 1. LLM proposes candidate URLs based on query
 * 2. System filters by allowlist + tier rules
 * 3. System fetches and extracts content
 * 4. LLM selects relevant spans, system verifies
 * 5. Stores authority_records + authority_passages + evidence_spans
 */

import OpenAI from 'openai';
import { db } from '@/lib/db';
import { authorityRecords, authorityPassages, missingAuthorityLog } from '@/lib/db/schema';
import { eq, and, or, ilike, desc } from 'drizzle-orm';
import { createHash } from 'crypto';
import {
  isAllowedDomain,
  getDomainInfo,
  getSourceTier,
  canQuoteVerbatim,
  GROUNDING_RULES,
  type SourceTier,
  type LicenseTag,
} from '@/lib/constants/source-governance';

// ============================================
// TYPES
// ============================================

export interface AuthoritySearchQuery {
  skillId: string;
  skillName: string;
  concept: string;
  jurisdiction?: string;
  sourceTypes?: ('CASE' | 'STATUTE' | 'REGULATION')[];
}

export interface CandidateAuthority {
  url: string;
  title: string;
  snippetPreview?: string;
  sourceType: 'CASE' | 'STATUTE' | 'REGULATION' | 'ARTICLE' | 'TEXTBOOK' | 'OTHER';
  suggestedCitation?: string;
}

export interface ExtractedPassage {
  text: string;
  locator: {
    paragraphStart?: number;
    paragraphEnd?: number;
    section?: string;
    subsection?: string;
    page?: number;
  };
  relevanceScore: number;
}

export interface AuthorityResult {
  authorityId: string;
  passageIds: string[];
  citation: string;
  url: string;
  tier: SourceTier;
  verbatimAllowed: boolean;
}

export interface RetrievalResult {
  success: boolean;
  authorities: AuthorityResult[];
  fallbackUsed: boolean;
  missingLogId?: string;
}

// ============================================
// CONFIG
// ============================================

const MODEL_CONFIG = {
  searchModel: process.env.RETRIEVAL_MODEL || 'gpt-4o-mini',
  extractionModel: process.env.EXTRACTION_MODEL || 'gpt-4o-mini',
};

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ============================================
// MAIN RETRIEVAL PIPELINE
// ============================================

/**
 * Main entry point: retrieve authorities for a skill/concept
 */
export async function retrieveAuthorities(
  query: AuthoritySearchQuery
): Promise<RetrievalResult> {
  console.log(`[authority-retrieval] Searching for: ${query.concept} (skill: ${query.skillName})`);

  // Step 1: Check existing authorities in DB
  const existing = await findExistingAuthorities(query);
  if (existing.length > 0) {
    console.log(`[authority-retrieval] Found ${existing.length} existing authorities`);
    return {
      success: true,
      authorities: existing,
      fallbackUsed: false,
    };
  }

  // Step 2: LLM proposes candidate URLs
  const candidates = await proposeCandidateUrls(query);
  if (candidates.length === 0) {
    console.log('[authority-retrieval] No candidates proposed');
    return await handleMissingAuthority(query, 'NO_CANDIDATES');
  }

  // Step 3: Filter by allowlist
  const allowed = candidates.filter(c => isAllowedDomain(c.url));
  if (allowed.length === 0) {
    console.log('[authority-retrieval] All candidates rejected by allowlist');
    return await handleMissingAuthority(query, 'ALL_REJECTED_ALLOWLIST');
  }

  // Step 4: Fetch and extract from allowed sources
  const results: AuthorityResult[] = [];
  
  for (const candidate of allowed.slice(0, 3)) { // Limit to 3 sources
    try {
      const result = await fetchAndStore(candidate, query);
      if (result) {
        results.push(result);
      }
    } catch (err) {
      console.error(`[authority-retrieval] Failed to fetch ${candidate.url}:`, err);
    }
  }

  if (results.length === 0) {
    console.log('[authority-retrieval] No valid authorities extracted');
    return await handleMissingAuthority(query, 'EXTRACTION_FAILED');
  }

  return {
    success: true,
    authorities: results,
    fallbackUsed: false,
  };
}

// ============================================
// STEP 1: FIND EXISTING
// ============================================

async function findExistingAuthorities(
  query: AuthoritySearchQuery
): Promise<AuthorityResult[]> {
  // Search by citation keywords, title, or content
  const keywords = extractKeywords(query.concept);
  
  if (keywords.length === 0) return [];

  // Build search conditions
  const searchConditions = keywords.slice(0, 3).map(k => 
    or(
      ilike(authorityRecords.title, `%${k}%`),
      ilike(authorityRecords.citation, `%${k}%`),
      ilike(authorityRecords.rawText, `%${k}%`)
    )
  );

  const existing = await db
    .select()
    .from(authorityRecords)
    .where(and(
      ...searchConditions as any[],
      eq(authorityRecords.isVerified, true)
    ))
    .limit(5);

  return existing.map(auth => ({
    authorityId: auth.id,
    passageIds: [], // Would need to fetch passages separately
    citation: auth.citation || auth.title,
    url: auth.canonicalUrl,
    tier: auth.sourceTier as SourceTier,
    verbatimAllowed: canQuoteVerbatim(auth.canonicalUrl, auth.licenseTag as LicenseTag),
  }));
}

// ============================================
// STEP 2: LLM PROPOSES CANDIDATES
// ============================================

async function proposeCandidateUrls(
  query: AuthoritySearchQuery
): Promise<CandidateAuthority[]> {
  const prompt = buildSearchPrompt(query);

  try {
    const response = await openai.chat.completions.create({
      model: MODEL_CONFIG.searchModel,
      messages: [
        {
          role: 'system',
          content: `You are a legal research assistant specializing in ${query.jurisdiction || 'Kenyan'} law.
Suggest 3-5 specific URLs where the legal authority for this concept can be found.
Focus on:
1. Kenya Law (kenyalaw.org) for Kenyan cases and statutes
2. BAILII for UK/Commonwealth precedents
3. Government legislation sites

Return JSON array with format:
[{
  "url": "full URL",
  "title": "case/statute name",
  "sourceType": "CASE|STATUTE|REGULATION",
  "suggestedCitation": "[YYYY] Court XXX or Act s.XX"
}]

Only suggest real, specific URLs - never fabricate.`
        },
        { role: 'user', content: prompt }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return [];

    const parsed = JSON.parse(content);
    const candidates = parsed.candidates || parsed.results || parsed;
    
    if (!Array.isArray(candidates)) return [];

    return candidates.map((c: any) => ({
      url: c.url || '',
      title: c.title || 'Unknown',
      sourceType: c.sourceType || 'OTHER',
      suggestedCitation: c.suggestedCitation,
      snippetPreview: c.snippet,
    })).filter((c: CandidateAuthority) => c.url && c.url.startsWith('http'));
  } catch (err) {
    console.error('[authority-retrieval] LLM proposal failed:', err);
    return [];
  }
}

function buildSearchPrompt(query: AuthoritySearchQuery): string {
  const parts = [
    `Find authoritative legal sources for the concept: "${query.concept}"`,
    `Skill area: ${query.skillName}`,
  ];
  
  if (query.jurisdiction) {
    parts.push(`Jurisdiction: ${query.jurisdiction}`);
  }
  
  if (query.sourceTypes && query.sourceTypes.length > 0) {
    parts.push(`Preferred source types: ${query.sourceTypes.join(', ')}`);
  }

  parts.push('Return specific URLs from Kenya Law, BAILII, or official legislation sites.');

  return parts.join('\n');
}

// ============================================
// STEP 3: FETCH AND STORE
// ============================================

async function fetchAndStore(
  candidate: CandidateAuthority,
  query: AuthoritySearchQuery
): Promise<AuthorityResult | null> {
  // Get domain info
  const domainInfo = getDomainInfo(candidate.url);
  if (!domainInfo) return null;

  // Check if authority already exists by URL
  const existing = await db
    .select()
    .from(authorityRecords)
    .where(eq(authorityRecords.canonicalUrl, candidate.url))
    .limit(1);

  if (existing.length > 0) {
    return {
      authorityId: existing[0].id,
      passageIds: [],
      citation: existing[0].citation || existing[0].title,
      url: existing[0].canonicalUrl,
      tier: existing[0].sourceTier as SourceTier,
      verbatimAllowed: domainInfo.allowVerbatim,
    };
  }

  // Fetch content from URL
  const fetchedContent = await fetchUrlContent(candidate.url);
  if (!fetchedContent) return null;

  // Extract passages using LLM
  const passages = await extractRelevantPassages(
    fetchedContent.text,
    query.concept,
    candidate.sourceType
  );

  if (passages.length === 0) return null;

  // Verify passages exist in source text
  const verifiedPassages = passages.filter(p => 
    verifyPassageInSource(p.text, fetchedContent.text)
  );

  if (verifiedPassages.length === 0) return null;

  // Create content hash
  const contentHash = createHash('sha256')
    .update(fetchedContent.text)
    .digest('hex');

  // Store authority record
  const [authority] = await db
    .insert(authorityRecords)
    .values({
      sourceTier: domainInfo.tier,
      sourceType: candidate.sourceType,
      domain: domainInfo.domain,
      canonicalUrl: candidate.url,
      title: candidate.title || fetchedContent.title || 'Unknown',
      jurisdiction: domainInfo.jurisdiction?.[0] || 'Kenya',
      court: fetchedContent.court,
      citation: candidate.suggestedCitation || fetchedContent.citation,
      decisionDate: fetchedContent.decisionDate,
      actName: fetchedContent.actName,
      sectionPath: fetchedContent.sectionPath,
      licenseTag: domainInfo.license,
      contentHash,
      rawText: fetchedContent.text.substring(0, 50000), // Limit storage
      isVerified: true, // Auto-verified from allowed source
    })
    .returning();

  // Store passages
  const passageIds: string[] = [];
  
  for (const passage of verifiedPassages) {
    const snippetHash = createHash('sha256')
      .update(passage.text)
      .digest('hex');

    const [storedPassage] = await db
      .insert(authorityPassages)
      .values({
        authorityId: authority.id,
        passageText: passage.text,
        locatorJson: passage.locator,
        snippetHash,
      })
      .returning();

    passageIds.push(storedPassage.id);
  }

  return {
    authorityId: authority.id,
    passageIds,
    citation: authority.citation || authority.title,
    url: authority.canonicalUrl,
    tier: domainInfo.tier,
    verbatimAllowed: domainInfo.allowVerbatim,
  };
}

// ============================================
// CONTENT FETCHING
// ============================================

interface FetchedContent {
  text: string;
  title?: string;
  court?: string;
  citation?: string;
  decisionDate?: string; // ISO date string YYYY-MM-DD
  actName?: string;
  sectionPath?: string;
}

async function fetchUrlContent(url: string): Promise<FetchedContent | null> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'BarExamPrep/1.0 (Legal Research Bot)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      signal: AbortSignal.timeout(15000), // 15s timeout
    });

    if (!response.ok) {
      console.error(`[authority-retrieval] Fetch failed: ${response.status} for ${url}`);
      return null;
    }

    const html = await response.text();
    
    // Basic HTML parsing - extract text content
    const text = extractTextFromHtml(html);
    const title = extractTitleFromHtml(html);
    const metadata = extractLegalMetadata(html, url);

    return {
      text,
      title,
      ...metadata,
    };
  } catch (err) {
    console.error(`[authority-retrieval] Fetch error for ${url}:`, err);
    return null;
  }
}

function extractTextFromHtml(html: string): string {
  // Remove scripts, styles, and HTML tags
  let text = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  
  // Decode HTML entities
  text = text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"');

  return text;
}

function extractTitleFromHtml(html: string): string | undefined {
  const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return match?.[1]?.trim();
}

function extractLegalMetadata(html: string, url: string): Partial<FetchedContent> {
  const metadata: Partial<FetchedContent> = {};

  // Kenya Law specific patterns
  if (url.includes('kenyalaw.org')) {
    // Try to extract citation
    const citationMatch = html.match(/\[(\d{4})\]\s*([A-Z]+)\s*(\d+)/);
    if (citationMatch) {
      metadata.citation = citationMatch[0];
    }

    // Extract court
    const courtMatch = html.match(/(Supreme Court|Court of Appeal|High Court|Employment Court)/i);
    if (courtMatch) {
      metadata.court = courtMatch[0];
    }
  }

  // Legislation patterns
  if (url.includes('legislation') || url.includes('act') || url.includes('statute')) {
    const actMatch = html.match(/([\w\s]+(?:Act|Regulations?)[\s,]*(?:\d{4})?)/i);
    if (actMatch) {
      metadata.actName = actMatch[1].trim();
    }

    const sectionMatch = html.match(/Section\s+(\d+(?:\([a-z0-9]+\))*)/i);
    if (sectionMatch) {
      metadata.sectionPath = sectionMatch[0];
    }
  }

  return metadata;
}

// ============================================
// PASSAGE EXTRACTION
// ============================================

async function extractRelevantPassages(
  sourceText: string,
  concept: string,
  sourceType: string
): Promise<ExtractedPassage[]> {
  // Truncate for LLM context
  const truncatedText = sourceText.substring(0, 30000);

  try {
    const response = await openai.chat.completions.create({
      model: MODEL_CONFIG.extractionModel,
      messages: [
        {
          role: 'system',
          content: `You are extracting relevant legal passages from a ${sourceType.toLowerCase()}.
Find the most relevant passages that support or define the concept.

Return JSON:
{
  "passages": [{
    "text": "exact verbatim quote from the source",
    "locator": {
      "paragraphStart": 1,
      "paragraphEnd": 3,
      "section": "Section 5(1)" // if applicable
    },
    "relevanceScore": 0.95
  }]
}

IMPORTANT: Only include passages that are EXACT quotes from the provided text.
Maximum 3 passages, each 50-500 characters.`
        },
        {
          role: 'user',
          content: `Concept: "${concept}"\n\nSource text:\n${truncatedText}`
        }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.2,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return [];

    const parsed = JSON.parse(content);
    return (parsed.passages || []) as ExtractedPassage[];
  } catch (err) {
    console.error('[authority-retrieval] Passage extraction failed:', err);
    return [];
  }
}

// ============================================
// VERIFICATION
// ============================================

function verifyPassageInSource(passage: string, source: string): boolean {
  // Normalize for comparison
  const normalizedPassage = passage.toLowerCase().replace(/\s+/g, ' ').trim();
  const normalizedSource = source.toLowerCase().replace(/\s+/g, ' ');
  
  // Check if passage exists in source
  return normalizedSource.includes(normalizedPassage);
}

// ============================================
// MISSING AUTHORITY HANDLING
// ============================================

async function handleMissingAuthority(
  query: AuthoritySearchQuery,
  errorTag: string
): Promise<RetrievalResult> {
  // Log the missing authority
  const [log] = await db
    .insert(missingAuthorityLog)
    .values({
      claimText: query.concept,
      requestedSkillIds: [query.skillId],
      searchQuery: `${query.skillName}: ${query.concept}`,
      errorTag,
    })
    .returning();

  return {
    success: false,
    authorities: [],
    fallbackUsed: true,
    missingLogId: log.id,
  };
}

// ============================================
// HELPERS
// ============================================

function extractKeywords(text: string): string[] {
  // Extract meaningful legal keywords
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'be',
    'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will',
    'would', 'could', 'should', 'may', 'might', 'must', 'shall',
  ]);

  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 3 && !stopWords.has(w))
    .slice(0, 10);
}

// ============================================
// GROUNDED CONTENT BUILDER
// ============================================

export interface GroundedContent {
  content: string;
  citations: Array<{
    authorityId: string;
    passageId?: string;
    locator: any;
    url: string;
    verbatimQuote?: string;
  }>;
  evidenceSpanIds: string[];
  isFallback: boolean;
}

/**
 * Build grounded content from retrieved authorities
 */
export async function buildGroundedContent(
  topic: string,
  authorities: AuthorityResult[],
  contentType: 'NOTES' | 'CHECKPOINT' | 'PRACTICE_SET' | 'RUBRIC'
): Promise<GroundedContent> {
  if (authorities.length === 0) {
    return {
      content: GROUNDING_RULES.fallbackMessage,
      citations: [],
      evidenceSpanIds: [],
      isFallback: true,
    };
  }

  // Fetch passages for citations
  const citations: GroundedContent['citations'] = [];
  
  for (const auth of authorities) {
    const passages = await db
      .select()
      .from(authorityPassages)
      .where(eq(authorityPassages.authorityId, auth.authorityId))
      .limit(3);

    for (const passage of passages) {
      citations.push({
        authorityId: auth.authorityId,
        passageId: passage.id,
        locator: passage.locatorJson,
        url: auth.url,
        verbatimQuote: auth.verbatimAllowed ? passage.passageText : undefined,
      });
    }
  }

  return {
    content: '', // Content will be generated by caller
    citations,
    evidenceSpanIds: [], // Will be created when evidence spans are stored
    isFallback: false,
  };
}

export default {
  retrieveAuthorities,
  buildGroundedContent,
};
