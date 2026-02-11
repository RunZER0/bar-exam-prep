import { NextRequest, NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/auth/middleware';
import { db } from '@/lib/db';
import { topics, contentUpdates } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export const GET = withAdminAuth(async (req: NextRequest, user) => {
  try {
    const allTopics = await db.query.topics.findMany({
      orderBy: (topics, { asc }) => [asc(topics.order)],
    });

    return NextResponse.json({ topics: allTopics });
  } catch (error) {
    console.error('Error fetching topics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch topics' },
      { status: 500 }
    );
  }
});

export const POST = withAdminAuth(async (req: NextRequest, user) => {
  try {
    const body = await req.json();
    const { title, description, competencyType, category, order } = body;

    if (!title || !competencyType || !category) {
      return NextResponse.json(
        { error: 'Title, competency type, and category are required' },
        { status: 400 }
      );
    }

    const [newTopic] = await db.insert(topics).values({
      title,
      description,
      competencyType,
      category,
      order: order || 0,
    }).returning();

    // Log the action
    await db.insert(contentUpdates).values({
      adminId: user.id,
      entityType: 'topic',
      entityId: newTopic.id,
      action: 'create',
      changes: body,
      reason: 'New topic created',
    });

    return NextResponse.json({ topic: newTopic }, { status: 201 });
  } catch (error) {
    console.error('Error creating topic:', error);
    return NextResponse.json(
      { error: 'Failed to create topic' },
      { status: 500 }
    );
  }
});

export const PUT = withAdminAuth(async (req: NextRequest, user) => {
  try {
    const body = await req.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Topic ID is required' },
        { status: 400 }
      );
    }

    const [updatedTopic] = await db.update(topics)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(topics.id, id))
      .returning();

    if (!updatedTopic) {
      return NextResponse.json(
        { error: 'Topic not found' },
        { status: 404 }
      );
    }

    // Log the action
    await db.insert(contentUpdates).values({
      adminId: user.id,
      entityType: 'topic',
      entityId: id,
      action: 'update',
      changes: updates,
      reason: 'Topic updated',
    });

    return NextResponse.json({ topic: updatedTopic });
  } catch (error) {
    console.error('Error updating topic:', error);
    return NextResponse.json(
      { error: 'Failed to update topic' },
      { status: 500 }
    );
  }
});

export const DELETE = withAdminAuth(async (req: NextRequest, user) => {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Topic ID is required' },
        { status: 400 }
      );
    }

    // Soft delete
    const [deletedTopic] = await db.update(topics)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(topics.id, id))
      .returning();

    if (!deletedTopic) {
      return NextResponse.json(
        { error: 'Topic not found' },
        { status: 404 }
      );
    }

    // Log the action
    await db.insert(contentUpdates).values({
      adminId: user.id,
      entityType: 'topic',
      entityId: id,
      action: 'delete',
      reason: 'Topic deactivated',
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting topic:', error);
    return NextResponse.json(
      { error: 'Failed to delete topic' },
      { status: 500 }
    );
  }
});
