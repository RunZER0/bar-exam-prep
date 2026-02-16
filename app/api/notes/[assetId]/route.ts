import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { 
  studyAssets, authorityRecords, authorityPassages, outlineTopics
} from '@/lib/db/schema';
import { eq, inArray } from 'drizzle-orm';
import { verifyIdToken } from '@/lib/firebase/admin';

interface RouteParams {
  params: Promise<{ assetId: string }>;
}

// ============================================
// Types
// ============================================

interface GroundingRefs {
  outline_topic_ids?: string[];
  lecture_chunk_ids?: string[];
  authority_ids?: string[];
}

interface NotesSection {
  id: string;
  title: string;
  content: string;
  citations: Citation[];
  order: number;
}

interface Citation {
  authority_id: string;
  locator_json: {
    section?: string;
    subsection?: string;
    paragraph_start?: number;
    paragraph_end?: number;
    page?: number;
    schedule?: string;
  };
  excerpt?: string;
}

interface AuthorityMetadata {
  id: string;
  title: string;
  source_type: string;
  source_tier: string;
  canonical_url: string;
  citation: string | null;
  jurisdiction: string | null;
  court: string | null;
  act_name: string | null;
  section_path: string | null;
  decision_date: string | null;
  passages: {
    id: string;
    passage_text: string;
    locator_json: Record<string, any>;
  }[];
}

// ============================================
// GET /api/notes/[assetId]
// ============================================

/**
 * Get notes asset with resolved citations and authority metadata
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    await verifyIdToken(token); // Throws if invalid

    const { assetId } = await params;

    // 1. Get the asset
    const [asset] = await db
      .select()
      .from(studyAssets)
      .where(eq(studyAssets.id, assetId))
      .limit(1);

    if (!asset) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
    }

    if (asset.assetType !== 'NOTES') {
      return NextResponse.json(
        { error: 'Asset is not a NOTES type' },
        { status: 400 }
      );
    }

    // 2. Parse content and grounding refs
    const contentJson = asset.contentJson as Record<string, any> | null;
    const groundingRefs = asset.groundingRefsJson as GroundingRefs | null;

    // 3. Extract sections from content
    const sections = extractSections(contentJson);

    // 4. Get authority IDs from grounding refs and content
    const authorityIds = new Set<string>();
    
    // From grounding refs
    if (groundingRefs?.authority_ids) {
      groundingRefs.authority_ids.forEach(id => authorityIds.add(id));
    }

    // From section citations
    sections.forEach(section => {
      section.citations?.forEach(c => {
        if (c.authority_id) authorityIds.add(c.authority_id);
      });
    });

    // 5. Fetch authority records with passages
    const authorities: AuthorityMetadata[] = [];
    
    if (authorityIds.size > 0) {
      const authorityRecordsList = await db
        .select()
        .from(authorityRecords)
        .where(inArray(authorityRecords.id, Array.from(authorityIds)));

      for (const auth of authorityRecordsList) {
        // Get passages for this authority
        const passages = await db
          .select()
          .from(authorityPassages)
          .where(eq(authorityPassages.authorityId, auth.id));

        authorities.push({
          id: auth.id,
          title: auth.title,
          source_type: auth.sourceType,
          source_tier: auth.sourceTier,
          canonical_url: auth.canonicalUrl,
          citation: auth.citation,
          jurisdiction: auth.jurisdiction,
          court: auth.court,
          act_name: auth.actName,
          section_path: auth.sectionPath,
          decision_date: auth.decisionDate,
          passages: passages.map(p => ({
            id: p.id,
            passage_text: p.passageText,
            locator_json: p.locatorJson || {},
          })),
        });
      }
    }

    // 6. Get outline topics if available
    const outlineTopicIds = groundingRefs?.outline_topic_ids || [];
    let outlineTopicsMeta: { id: string; title: string; content: string }[] = [];
    
    if (outlineTopicIds.length > 0) {
      const topics = await db
        .select({
          id: outlineTopics.id,
          title: outlineTopics.title,
          content: outlineTopics.content,
        })
        .from(outlineTopics)
        .where(inArray(outlineTopics.id, outlineTopicIds));
      
      outlineTopicsMeta = topics;
    }

    // 7. Build response
    return NextResponse.json({
      assetId: asset.id,
      sessionId: asset.sessionId,
      status: asset.status,
      assetType: asset.assetType,
      activityTypes: contentJson?.activityTypes || [],
      title: contentJson?.title || 'Study Notes',
      summary: contentJson?.summary,
      sections: sections.map(s => ({
        id: s.id,
        title: s.title,
        content: s.content,
        order: s.order,
        citations: (s.citations || []).map(c => ({
          authority_id: c.authority_id,
          locator_json: c.locator_json,
          excerpt: c.excerpt,
          // Resolved authority metadata
          authority: authorities.find(a => a.id === c.authority_id) || null,
        })),
      })),
      groundingRefs: {
        authority_ids: groundingRefs?.authority_ids || [],
        outline_topic_ids: groundingRefs?.outline_topic_ids || [],
        lecture_chunk_ids: groundingRefs?.lecture_chunk_ids || [],
      },
      authorities,
      outlineTopics: outlineTopicsMeta,
      stats: {
        totalAuthorities: authorities.length,
        totalPassages: authorities.reduce((sum, a) => sum + a.passages.length, 0),
        totalOutlineTopics: outlineTopicsMeta.length,
      },
      createdAt: asset.createdAt,
      updatedAt: asset.updatedAt,
    });
  } catch (error) {
    console.error('[notes-api] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ============================================
// Helper Functions
// ============================================

/**
 * Extract sections from content JSON
 */
function extractSections(contentJson: Record<string, any> | null): NotesSection[] {
  if (!contentJson) return [];

  // Handle different content formats
  
  // Format 1: Direct sections array
  if (Array.isArray(contentJson.sections)) {
    return contentJson.sections.map((s: any, idx: number) => ({
      id: s.id || `section-${idx}`,
      title: s.title || `Section ${idx + 1}`,
      content: s.content || s.text || '',
      citations: s.citations || [],
      order: s.order ?? idx,
    }));
  }

  // Format 2: Items array (activity items)
  if (Array.isArray(contentJson.items)) {
    return contentJson.items
      .filter((item: any) => item.type === 'READING_NOTES' || item.activityType === 'READING_NOTES')
      .map((item: any, idx: number) => ({
        id: item.id || `item-${idx}`,
        title: item.title || item.topic || `Topic ${idx + 1}`,
        content: item.content || item.notes || '',
        citations: item.citations || [],
        order: idx,
      }));
  }

  // Format 3: Markdown content with headers
  if (contentJson.markdown || contentJson.content) {
    const markdown = contentJson.markdown || contentJson.content;
    return parseMarkdownSections(markdown, contentJson.citations || []);
  }

  // Format 4: Notes object with sections
  if (contentJson.notes?.sections) {
    return contentJson.notes.sections.map((s: any, idx: number) => ({
      id: s.id || `notes-section-${idx}`,
      title: s.heading || s.title || `Section ${idx + 1}`,
      content: s.body || s.content || '',
      citations: s.citations || [],
      order: idx,
    }));
  }

  // Fallback: Create single section from raw content
  if (typeof contentJson === 'object') {
    const textContent = contentJson.text || contentJson.body || JSON.stringify(contentJson);
    return [{
      id: 'section-0',
      title: 'Notes',
      content: textContent,
      citations: contentJson.citations || [],
      order: 0,
    }];
  }

  return [];
}

/**
 * Parse markdown into sections based on headers
 */
function parseMarkdownSections(markdown: string, globalCitations: Citation[]): NotesSection[] {
  const sections: NotesSection[] = [];
  const lines = markdown.split('\n');
  
  let currentSection: NotesSection | null = null;
  let contentLines: string[] = [];
  let sectionIndex = 0;

  for (const line of lines) {
    // Check for headers (## or ###)
    const headerMatch = line.match(/^(#{1,3})\s+(.+)$/);
    
    if (headerMatch) {
      // Save previous section
      if (currentSection) {
        currentSection.content = contentLines.join('\n').trim();
        sections.push(currentSection);
        contentLines = [];
      }

      // Start new section
      currentSection = {
        id: `section-${sectionIndex}`,
        title: headerMatch[2],
        content: '',
        citations: [],
        order: sectionIndex,
      };
      sectionIndex++;
    } else {
      contentLines.push(line);
    }
  }

  // Save last section
  if (currentSection) {
    currentSection.content = contentLines.join('\n').trim();
    sections.push(currentSection);
  }

  // If no sections found, create one from all content
  if (sections.length === 0 && markdown.trim()) {
    sections.push({
      id: 'section-0',
      title: 'Notes',
      content: markdown,
      citations: globalCitations,
      order: 0,
    });
  }

  // Distribute global citations to sections (basic heuristic)
  if (globalCitations.length > 0 && sections.length > 0) {
    // For now, add all citations to each section
    // A more sophisticated approach would match citations to content
    sections.forEach(s => {
      s.citations = [...globalCitations];
    });
  }

  return sections;
}
