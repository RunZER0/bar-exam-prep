/**
 * Admin Community Management API
 * GET  - List room creation requests (pending/all)
 * POST - Approve or reject room requests
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/auth/middleware';
import { db } from '@/lib/db';
import { roomRequests, studyRooms, roomMembers, users } from '@/lib/db/schema';
import { eq, desc, and } from 'drizzle-orm';

// GET - List room creation requests
export const GET = withAdminAuth(async (req: NextRequest, admin) => {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') || 'pending';

    let requests;
    if (status === 'all') {
      requests = await db
        .select()
        .from(roomRequests)
        .orderBy(desc(roomRequests.createdAt));
    } else {
      requests = await db
        .select()
        .from(roomRequests)
        .where(eq(roomRequests.status, status))
        .orderBy(desc(roomRequests.createdAt));
    }

    // Enrich with user info
    const enriched = await Promise.all(
      requests.map(async (r) => {
        const [requester] = await db
          .select({
            displayName: users.displayName,
            email: users.email,
            communityUsername: users.communityUsername,
          })
          .from(users)
          .where(eq(users.id, r.requestedBy))
          .limit(1);

        return {
          ...r,
          requesterName: requester?.communityUsername || requester?.displayName || requester?.email || 'Unknown',
          requesterEmail: requester?.email,
        };
      })
    );

    return NextResponse.json({ requests: enriched });
  } catch (error) {
    console.error('Admin community error:', error);
    return NextResponse.json({ error: 'Failed to fetch requests' }, { status: 500 });
  }
});

// POST - Approve or reject
export const POST = withAdminAuth(async (req: NextRequest, admin) => {
  try {
    const { requestId, action } = await req.json();

    if (!requestId || !['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    const [request] = await db
      .select()
      .from(roomRequests)
      .where(eq(roomRequests.id, requestId))
      .limit(1);

    if (!request) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }

    if (request.status !== 'pending') {
      return NextResponse.json({ error: 'Request already processed' }, { status: 400 });
    }

    if (action === 'approve') {
      // Create the room
      const [newRoom] = await db.insert(studyRooms).values({
        name: request.name,
        description: request.description || `Custom room: ${request.name}`,
        roomType: 'custom',
        createdById: request.requestedBy,
        isPublic: request.visibility === 'public',
        maxMembers: 100,
      }).returning();

      // Add requester as owner
      await db.insert(roomMembers).values({
        roomId: newRoom.id,
        userId: request.requestedBy,
        role: 'owner',
      });

      // Update request status
      await db.update(roomRequests)
        .set({
          status: 'approved',
          reviewedBy: admin.id,
          reviewedAt: new Date(),
        })
        .where(eq(roomRequests.id, requestId));

      return NextResponse.json({
        success: true,
        message: 'Room approved and created',
        room: newRoom,
      });
    }

    if (action === 'reject') {
      await db.update(roomRequests)
        .set({
          status: 'rejected',
          reviewedBy: admin.id,
          reviewedAt: new Date(),
        })
        .where(eq(roomRequests.id, requestId));

      return NextResponse.json({ success: true, message: 'Request rejected' });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Admin action error:', error);
    return NextResponse.json({ error: 'Failed to process' }, { status: 500 });
  }
});
