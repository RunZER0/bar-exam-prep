import { NextRequest, NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/auth/middleware';
import { db } from '@/lib/db';
import { ragKnowledgeEntries } from '@/lib/db/schema';
import { eq, desc, ilike, or, sql } from 'drizzle-orm';

// GET - Retrieve RAG knowledge entries with optional search
export const GET = withAdminAuth(async (req: NextRequest, user) => {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search');
    const contentType = searchParams.get('contentType');
    const unitId = searchParams.get('unitId');
    const importance = searchParams.get('importance');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    let query = db.query.ragKnowledgeEntries.findMany({
      orderBy: [desc(ragKnowledgeEntries.createdAt)],
      limit,
      offset,
    });

    // Note: For a full implementation, we'd use where clauses with filters
    // This is a simplified version that returns all entries
    const entries = await query;

    // Get total count for pagination
    const [{ total }] = await db
      .select({ total: sql<number>`count(*)` })
      .from(ragKnowledgeEntries);

    return NextResponse.json({
      entries,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    });
  } catch (error) {
    console.error('Error fetching RAG entries:', error);
    return NextResponse.json(
      { error: 'Failed to fetch knowledge entries' },
      { status: 500 }
    );
  }
});

// POST - Create a new RAG knowledge entry
export const POST = withAdminAuth(async (req: NextRequest, user) => {
  try {
    const body = await req.json();
    const {
      title,
      content,
      contentType,
      unitId,
      citation,
      sourceUrl,
      importance,
      tags,
    } = body;

    // Validation
    if (!title || !content || !contentType) {
      return NextResponse.json(
        { error: 'Title, content, and content type are required' },
        { status: 400 }
      );
    }

    const validContentTypes = ['case_law', 'statute', 'concept', 'procedure', 'commentary'];
    if (!validContentTypes.includes(contentType)) {
      return NextResponse.json(
        { error: 'Invalid content type' },
        { status: 400 }
      );
    }

    const validImportance = ['high', 'medium', 'low'];
    if (importance && !validImportance.includes(importance)) {
      return NextResponse.json(
        { error: 'Invalid importance level' },
        { status: 400 }
      );
    }

    const [entry] = await db
      .insert(ragKnowledgeEntries)
      .values({
        title,
        content,
        contentType,
        unitId: unitId || null,
        citation: citation || null,
        sourceUrl: sourceUrl || null,
        importance: importance || 'medium',
        tags: tags || [],
        isVerified: false, // Requires manual verification
        usageCount: 0,
        addedById: user.id,
      })
      .returning();

    return NextResponse.json({ entry }, { status: 201 });
  } catch (error) {
    console.error('Error creating RAG entry:', error);
    return NextResponse.json(
      { error: 'Failed to create knowledge entry' },
      { status: 500 }
    );
  }
});

// PATCH - Update a RAG knowledge entry
export const PATCH = withAdminAuth(async (req: NextRequest, user) => {
  try {
    const body = await req.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Entry ID is required' },
        { status: 400 }
      );
    }

    // Validate content type if provided
    if (updates.contentType) {
      const validContentTypes = ['case_law', 'statute', 'concept', 'procedure', 'commentary'];
      if (!validContentTypes.includes(updates.contentType)) {
        return NextResponse.json(
          { error: 'Invalid content type' },
          { status: 400 }
        );
      }
    }

    // Validate importance if provided
    if (updates.importance) {
      const validImportance = ['high', 'medium', 'low'];
      if (!validImportance.includes(updates.importance)) {
        return NextResponse.json(
          { error: 'Invalid importance level' },
          { status: 400 }
        );
      }
    }

    updates.updatedAt = new Date();

    const [entry] = await db
      .update(ragKnowledgeEntries)
      .set(updates)
      .where(eq(ragKnowledgeEntries.id, id))
      .returning();

    if (!entry) {
      return NextResponse.json(
        { error: 'Entry not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ entry });
  } catch (error) {
    console.error('Error updating RAG entry:', error);
    return NextResponse.json(
      { error: 'Failed to update knowledge entry' },
      { status: 500 }
    );
  }
});

// DELETE - Delete a RAG knowledge entry
export const DELETE = withAdminAuth(async (req: NextRequest, user) => {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Entry ID is required' },
        { status: 400 }
      );
    }

    const [deleted] = await db
      .delete(ragKnowledgeEntries)
      .where(eq(ragKnowledgeEntries.id, id))
      .returning();

    if (!deleted) {
      return NextResponse.json(
        { error: 'Entry not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting RAG entry:', error);
    return NextResponse.json(
      { error: 'Failed to delete knowledge entry' },
      { status: 500 }
    );
  }
});
