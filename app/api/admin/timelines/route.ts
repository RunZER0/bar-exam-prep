import { NextRequest, NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/auth/middleware';
import { db } from '@/lib/db';
import { kslTimelines } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';

// GET - Retrieve all KSL timelines
export const GET = withAdminAuth(async (req: NextRequest, user) => {
  try {
    const timelines = await db.query.kslTimelines.findMany({
      orderBy: [desc(kslTimelines.examDate)],
    });

    return NextResponse.json({ timelines });
  } catch (error) {
    console.error('Error fetching KSL timelines:', error);
    return NextResponse.json(
      { error: 'Failed to fetch timelines' },
      { status: 500 }
    );
  }
});

// POST - Create a new KSL timeline
export const POST = withAdminAuth(async (req: NextRequest, user) => {
  try {
    const body = await req.json();
    const {
      intakeName,
      registrationOpens,
      registrationCloses,
      examDate,
      examEndDate,
      resultsDate,
      notes,
      isActive,
    } = body;

    // Validation
    if (!intakeName || !examDate) {
      return NextResponse.json(
        { error: 'Intake name and exam date are required' },
        { status: 400 }
      );
    }

    // If setting this as active, deactivate others first
    if (isActive) {
      await db
        .update(kslTimelines)
        .set({ isActive: false });
    }

    const [timeline] = await db
      .insert(kslTimelines)
      .values({
        intakeName,
        registrationOpens: registrationOpens || examDate, // Use examDate as fallback
        registrationCloses: registrationCloses || examDate, // Use examDate as fallback
        examDate,
        examEndDate: examEndDate || null,
        resultsDate: resultsDate || null,
        notes,
        isActive: isActive ?? false,
      })
      .returning();

    return NextResponse.json({ timeline }, { status: 201 });
  } catch (error) {
    console.error('Error creating KSL timeline:', error);
    return NextResponse.json(
      { error: 'Failed to create timeline' },
      { status: 500 }
    );
  }
});

// PATCH - Update a KSL timeline
export const PATCH = withAdminAuth(async (req: NextRequest, user) => {
  try {
    const body = await req.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Timeline ID is required' },
        { status: 400 }
      );
    }

    // Process date fields - keep as strings for date type columns
    const processedUpdates: Record<string, any> = {};
    for (const [key, value] of Object.entries(updates)) {
      if (['registrationOpens', 'registrationCloses', 'examDate', 'examEndDate', 'resultsDate'].includes(key)) {
        processedUpdates[key] = value || null;
      } else {
        processedUpdates[key] = value;
      }
    }

    // If setting this as active, deactivate others first
    if (processedUpdates.isActive) {
      await db
        .update(kslTimelines)
        .set({ isActive: false });
    }

    processedUpdates.updatedAt = new Date();

    const [timeline] = await db
      .update(kslTimelines)
      .set(processedUpdates)
      .where(eq(kslTimelines.id, id))
      .returning();

    if (!timeline) {
      return NextResponse.json(
        { error: 'Timeline not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ timeline });
  } catch (error) {
    console.error('Error updating KSL timeline:', error);
    return NextResponse.json(
      { error: 'Failed to update timeline' },
      { status: 500 }
    );
  }
});

// DELETE - Delete a KSL timeline
export const DELETE = withAdminAuth(async (req: NextRequest, user) => {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Timeline ID is required' },
        { status: 400 }
      );
    }

    const [deleted] = await db
      .delete(kslTimelines)
      .where(eq(kslTimelines.id, id))
      .returning();

    if (!deleted) {
      return NextResponse.json(
        { error: 'Timeline not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting KSL timeline:', error);
    return NextResponse.json(
      { error: 'Failed to delete timeline' },
      { status: 500 }
    );
  }
});
