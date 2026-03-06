/**
 * Room Creation Requests API
 * POST - Submit a request to create a custom room (needs admin approval)
 * GET  - Get user's room requests
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth, withAdminAuth } from '@/lib/auth/middleware';
import { db } from '@/lib/db';
import { roomRequests, studyRooms, roomMembers, users } from '@/lib/db/schema';
import { eq, desc, and } from 'drizzle-orm';

// GET - Get my room creation requests
export const GET = withAuth(async (req: NextRequest, user) => {
  try {
    const requests = await db
      .select()
      .from(roomRequests)
      .where(eq(roomRequests.requestedBy, user.id))
      .orderBy(desc(roomRequests.createdAt));

    return NextResponse.json({ requests });
  } catch (error) {
    console.error('Error fetching room requests:', error);
    return NextResponse.json({ error: 'Failed to fetch requests' }, { status: 500 });
  }
});

// POST - Submit a room creation request
export const POST = withAuth(async (req: NextRequest, user) => {
  try {
    const { name, description, visibility } = await req.json();

    if (!name?.trim()) {
      return NextResponse.json({ error: 'Room name is required' }, { status: 400 });
    }

    if (name.trim().length < 3 || name.trim().length > 100) {
      return NextResponse.json({ error: 'Name must be 3-100 characters' }, { status: 400 });
    }

    // Check for existing pending request from same user
    const existingPending = await db
      .select()
      .from(roomRequests)
      .where(and(
        eq(roomRequests.requestedBy, user.id),
        eq(roomRequests.status, 'pending')
      ))
      .limit(3);

    if (existingPending.length >= 3) {
      return NextResponse.json({
        error: 'You have 3 pending requests. Wait for approval before submitting more.',
      }, { status: 429 });
    }

    const [request] = await db.insert(roomRequests).values({
      requestedBy: user.id,
      name: name.trim(),
      description: description?.trim() || null,
      visibility: visibility || 'public',
      status: 'pending',
    }).returning();

    return NextResponse.json({ success: true, request });
  } catch (error) {
    console.error('Room request error:', error);
    return NextResponse.json({ error: 'Failed to submit request' }, { status: 500 });
  }
});
