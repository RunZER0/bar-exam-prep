/**
 * Grounding Validator: Hard gate for content generation
 * 
 * Ensures all generated content is properly grounded with citations.
 * Implements "fail closed" - no uncited legal rules allowed.
 */

import { db } from '@/lib/db';
import { authorityRecords, missingAuthorityLog } from '@/lib/db/schema';
import { eq, inArray } from 'drizzle-orm';
import { GROUNDING_RULES } from '@/lib/constants/source-governance';

// ============================================
// TYPES
// ============================================

export interface Citation {
  authority_id: string;
  url: string;
  locator_json: {
    paragraph_start?: number;
    paragraph_end?: number;
    section?: string;
    subsection?: string;
    page?: number;
  };
  passage_id?: string;
  verbatim_quote?: string;
}

export interface ContentItem {
  type: string;
  prompt?: string;
  content?: string;
  question?: string;
  answer?: string;
  explanation?: string;
  citations: Citation[];
  evidence_span_ids?: string[];
  is_instruction_only?: boolean;
}

export interface AssetContent {
  assetType: 'NOTES' | 'CHECKPOINT' | 'PRACTICE_SET' | 'RUBRIC';
  items: ContentItem[];
  activity_types: string[];
  grounding_refs: {
    authority_ids: string[];
    outline_topic_ids: string[];
    lecture_chunk_ids: string[];
  };
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  stats: {
    totalItems: number;
    citedItems: number;
    uncitedItems: number;
    uniqueAuthorities: number;
    fallbackItems: number;
  };
}

export interface ValidationError {
  code: 'MISSING_CITATION' | 'INVALID_AUTHORITY' | 'MISSING_LOCATOR' | 'UNCITED_RULE';
  message: string;
  itemIndex: number;
  itemType: string;
}

export interface ValidationWarning {
  code: 'LOW_CITATION_COUNT' | 'MISSING_EVIDENCE_SPAN' | 'TIER_C_SOURCE';
  message: string;
  itemIndex?: number;
}

// ============================================
// MAIN VALIDATION FUNCTION
// ============================================

/**
 * Validate that an asset is properly grounded.
 * 
 * Rules:
 * 1. Every item must have citations.length >= 1 (unless instruction-only)
 * 2. Every citation must reference a valid authority_id
 * 3. Every citation must include locator_json
 * 4. Every authority_id must exist in authority_records
 * 
 * Returns isValid=false if any rule is violated.
 */
export async function assertGrounded(
  content: AssetContent,
  options: {
    sessionId?: string;
    assetId?: string;
    skillId?: string;
    strict?: boolean;
  } = {}
): Promise<ValidationResult> {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];
  
  const stats = {
    totalItems: content.items.length,
    citedItems: 0,
    uncitedItems: 0,
    uniqueAuthorities: new Set<string>(),
    fallbackItems: 0,
  };

  // Collect all authority_ids for batch verification
  const allAuthorityIds = new Set<string>();
  
  for (const item of content.items) {
    for (const citation of item.citations || []) {
      if (citation.authority_id) {
        allAuthorityIds.add(citation.authority_id);
      }
    }
  }

  // Verify all authority_ids exist
  const validAuthorityIds = new Set<string>();
  if (allAuthorityIds.size > 0) {
    const existingAuthorities = await db
      .select({ id: authorityRecords.id })
      .from(authorityRecords)
      .where(inArray(authorityRecords.id, Array.from(allAuthorityIds)));
    
    for (const auth of existingAuthorities) {
      validAuthorityIds.add(auth.id);
    }
  }

  // Validate each item
  for (let i = 0; i < content.items.length; i++) {
    const item = content.items[i];
    
    // Skip instruction-only items (e.g., "Answer the following questions...")
    if (item.is_instruction_only) {
      continue;
    }

    // Check if this is a fallback item
    const isFallback = checkIsFallback(item);
    if (isFallback) {
      stats.fallbackItems++;
      continue; // Fallback items don't need citations
    }

    const citations = item.citations || [];

    // Rule 1: Must have at least one citation
    if (citations.length === 0) {
      errors.push({
        code: 'MISSING_CITATION',
        message: `Item ${i + 1} (${item.type}) has no citations`,
        itemIndex: i,
        itemType: item.type,
      });
      stats.uncitedItems++;
      continue;
    }

    stats.citedItems++;

    // Validate each citation
    for (const citation of citations) {
      // Rule 2: Must have authority_id
      if (!citation.authority_id) {
        errors.push({
          code: 'MISSING_CITATION',
          message: `Item ${i + 1} citation missing authority_id`,
          itemIndex: i,
          itemType: item.type,
        });
        continue;
      }

      // Rule 3: Must have locator_json
      if (!citation.locator_json || Object.keys(citation.locator_json).length === 0) {
        errors.push({
          code: 'MISSING_LOCATOR',
          message: `Item ${i + 1} citation missing locator_json`,
          itemIndex: i,
          itemType: item.type,
        });
      }

      // Rule 4: Authority must exist in DB
      if (!validAuthorityIds.has(citation.authority_id)) {
        errors.push({
          code: 'INVALID_AUTHORITY',
          message: `Item ${i + 1} references non-existent authority: ${citation.authority_id}`,
          itemIndex: i,
          itemType: item.type,
        });
      }

      stats.uniqueAuthorities.add(citation.authority_id);
    }

    // Warning: Missing evidence_span_ids
    if (!item.evidence_span_ids || item.evidence_span_ids.length === 0) {
      warnings.push({
        code: 'MISSING_EVIDENCE_SPAN',
        message: `Item ${i + 1} has no evidence_span_ids`,
        itemIndex: i,
      });
    }
  }

  // Warn if citation count is low
  if (content.items.length > 3 && stats.citedItems < content.items.length * 0.5) {
    warnings.push({
      code: 'LOW_CITATION_COUNT',
      message: `Less than 50% of items have citations (${stats.citedItems}/${stats.totalItems})`,
    });
  }

  const isValid = errors.length === 0;

  // Log to missing_authority_log if validation fails
  if (!isValid && options.sessionId) {
    await logValidationFailure(content, errors, options);
  }

  return {
    isValid,
    errors,
    warnings,
    stats: {
      totalItems: stats.totalItems,
      citedItems: stats.citedItems,
      uncitedItems: stats.uncitedItems,
      uniqueAuthorities: stats.uniqueAuthorities.size,
      fallbackItems: stats.fallbackItems,
    },
  };
}

// ============================================
// HELPER: CHECK IF ITEM IS FALLBACK
// ============================================

function checkIsFallback(item: ContentItem): boolean {
  const fallbackMessage = GROUNDING_RULES.fallbackMessage.toLowerCase();
  
  const textToCheck = [
    item.content,
    item.prompt,
    item.question,
    item.answer,
    item.explanation,
  ].filter(Boolean).join(' ').toLowerCase();

  return textToCheck.includes(fallbackMessage.toLowerCase()) ||
         textToCheck.includes('not found in verified sources');
}

// ============================================
// LOG VALIDATION FAILURE
// ============================================

async function logValidationFailure(
  content: AssetContent,
  errors: ValidationError[],
  options: {
    sessionId?: string;
    assetId?: string;
    skillId?: string;
  }
): Promise<void> {
  try {
    await db.insert(missingAuthorityLog).values({
      claimText: `Grounding validation failed for ${content.assetType}`,
      requestedSkillIds: options.skillId ? [options.skillId] : [],
      searchQuery: `Validation for session ${options.sessionId}`,
      searchResults: {
        errors: errors.slice(0, 10), // Limit stored errors
        assetType: content.assetType,
        itemCount: content.items.length,
      },
      errorTag: 'VALIDATION_FAILED',
      sessionId: options.sessionId,
      assetId: options.assetId,
    });
  } catch (err) {
    console.error('[grounding-validator] Failed to log validation failure:', err);
  }
}

// ============================================
// TRANSFORM TO FALLBACK
// ============================================

/**
 * Transform an ungrounded item to a fallback item
 * Used when retrieval fails but we want to continue generation
 */
export function createFallbackItem(
  originalItem: Partial<ContentItem>,
  context: { skillName?: string; topic?: string }
): ContentItem {
  return {
    type: originalItem.type || 'FALLBACK',
    content: GROUNDING_RULES.fallbackMessage,
    prompt: context.topic 
      ? `${context.topic}: ${GROUNDING_RULES.fallbackMessage}`
      : GROUNDING_RULES.fallbackMessage,
    question: originalItem.question,
    explanation: `This content requires verification from primary sources. ${
      context.skillName ? `Consult your ATP materials on ${context.skillName}.` : ''
    }`,
    citations: [],
    evidence_span_ids: [],
    is_instruction_only: false,
  };
}

// ============================================
// VALIDATE AND FIX (SOFT MODE)
// ============================================

/**
 * Validate and optionally fix items that fail validation.
 * In soft mode, replaces ungrounded items with fallback items.
 * In strict mode, throws an error.
 */
export async function validateAndFix(
  content: AssetContent,
  options: {
    sessionId?: string;
    assetId?: string;
    skillId?: string;
    skillName?: string;
    strict?: boolean;
  } = {}
): Promise<{
  content: AssetContent;
  validation: ValidationResult;
  wasFixed: boolean;
}> {
  const validation = await assertGrounded(content, options);

  if (validation.isValid) {
    return { content, validation, wasFixed: false };
  }

  if (options.strict) {
    throw new Error(
      `Grounding validation failed: ${validation.errors.map(e => e.message).join('; ')}`
    );
  }

  // Soft mode: Replace invalid items with fallback
  const fixedItems = [...content.items];
  const errorIndices = new Set(validation.errors.map(e => e.itemIndex));

  for (const idx of errorIndices) {
    fixedItems[idx] = createFallbackItem(
      content.items[idx],
      { skillName: options.skillName }
    );
  }

  const fixedContent: AssetContent = {
    ...content,
    items: fixedItems,
  };

  // Re-validate (should pass now with fallback items)
  const revalidation = await assertGrounded(fixedContent, {
    ...options,
    // Don't log again
  });

  return {
    content: fixedContent,
    validation: revalidation,
    wasFixed: true,
  };
}

// ============================================
// EXPORTS
// ============================================

export default {
  assertGrounded,
  createFallbackItem,
  validateAndFix,
};
