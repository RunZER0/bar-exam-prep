import { NextRequest, NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/auth/middleware';
import { db } from '@/lib/db';
import { questions, contentUpdates } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export const POST = withAdminAuth(async (req: NextRequest, user) => {
  try {
    const body = await req.json();
    const { 
      topicId, 
      questionType, 
      difficulty, 
      question, 
      context,
      options,
      correctAnswer,
      explanation,
      rubric
    } = body;

    if (!topicId || !questionType || !difficulty || !question) {
      return NextResponse.json(
        { error: 'Required fields missing' },
        { status: 400 }
      );
    }

    const [newQuestion] = await db.insert(questions).values({
      topicId,
      questionType,
      difficulty,
      question,
      context,
      options,
      correctAnswer,
      explanation,
      rubric,
    }).returning();

    // Log the action
    await db.insert(contentUpdates).values({
      adminId: user.id,
      entityType: 'question',
      entityId: newQuestion.id,
      action: 'create',
      changes: body,
      reason: 'New question created',
    });

    return NextResponse.json({ question: newQuestion }, { status: 201 });
  } catch (error) {
    console.error('Error creating question:', error);
    return NextResponse.json(
      { error: 'Failed to create question' },
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
        { error: 'Question ID is required' },
        { status: 400 }
      );
    }

    const [updatedQuestion] = await db.update(questions)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(questions.id, id))
      .returning();

    if (!updatedQuestion) {
      return NextResponse.json(
        { error: 'Question not found' },
        { status: 404 }
      );
    }

    // Log the action
    await db.insert(contentUpdates).values({
      adminId: user.id,
      entityType: 'question',
      entityId: id,
      action: 'update',
      changes: updates,
      reason: 'Question updated',
    });

    return NextResponse.json({ question: updatedQuestion });
  } catch (error) {
    console.error('Error updating question:', error);
    return NextResponse.json(
      { error: 'Failed to update question' },
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
        { error: 'Question ID is required' },
        { status: 400 }
      );
    }

    // Soft delete
    const [deletedQuestion] = await db.update(questions)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(questions.id, id))
      .returning();

    if (!deletedQuestion) {
      return NextResponse.json(
        { error: 'Question not found' },
        { status: 404 }
      );
    }

    // Log the action
    await db.insert(contentUpdates).values({
      adminId: user.id,
      entityType: 'question',
      entityId: id,
      action: 'delete',
      reason: 'Question deactivated',
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting question:', error);
    return NextResponse.json(
      { error: 'Failed to delete question' },
      { status: 500 }
    );
  }
});
