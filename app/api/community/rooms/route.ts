import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { studyRooms, roomMembers, roomMessages, users } from '@/lib/db/schema';
import { eq, desc, and, count, sql, or } from 'drizzle-orm';
import { withAuth } from '@/lib/auth/middleware';

// GET - Fetch all study rooms (official + custom)
export const GET = withAuth(async (req: NextRequest, user) => {
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type'); // 'official' | 'custom' | null for all

    let rooms = await db.select().from(studyRooms).where(eq(studyRooms.status, 'active'));

    // Filter by type if specified
    if (type) {
      rooms = rooms.filter(r => r.roomType === type);
    }

    // Filter: show public rooms + rooms user is member of
    const userMemberships = await db
      .select({ roomId: roomMembers.roomId })
      .from(roomMembers)
      .where(eq(roomMembers.userId, user.id));
    const memberRoomIds = new Set(userMemberships.map(m => m.roomId));

    rooms = rooms.filter(r => r.isPublic || memberRoomIds.has(r.id));

    // Get member counts for each room
    const roomsWithStats = await Promise.all(
      rooms.map(async (room) => {
        const [memberCountResult] = await db
          .select({ count: count() })
          .from(roomMembers)
          .where(eq(roomMembers.roomId, room.id));

        const [messageCountResult] = await db
          .select({ count: count() })
          .from(roomMessages)
          .where(eq(roomMessages.roomId, room.id));

        // Get last message time
        const lastMessage = await db
          .select({ createdAt: roomMessages.createdAt })
          .from(roomMessages)
          .where(eq(roomMessages.roomId, room.id))
          .orderBy(desc(roomMessages.createdAt))
          .limit(1);

        return {
          ...room,
          memberCount: memberCountResult?.count || 0,
          messageCount: messageCountResult?.count || 0,
          isJoined: memberRoomIds.has(room.id),
          lastActivity: lastMessage[0]?.createdAt
            ? getTimeAgo(new Date(lastMessage[0].createdAt))
            : 'No activity yet',
        };
      })
    );

    // Sort: official rooms first, then by last activity
    roomsWithStats.sort((a, b) => {
      if (a.roomType === 'official' && b.roomType !== 'official') return -1;
      if (a.roomType !== 'official' && b.roomType === 'official') return 1;
      return 0;
    });

    return NextResponse.json({ rooms: roomsWithStats });
  } catch (error) {
    console.error('Error fetching rooms:', error);
    return NextResponse.json({ error: 'Failed to fetch rooms' }, { status: 500 });
  }
});

// POST - Join or leave a room
export const POST = withAuth(async (req: NextRequest, user) => {
  try {
    const body = await req.json();
    const { action, roomId } = body;

    if (action === 'join') {
      if (!roomId) {
        return NextResponse.json({ error: 'Room ID required' }, { status: 400 });
      }

      // Check if room exists
      const [room] = await db.select().from(studyRooms).where(eq(studyRooms.id, roomId)).limit(1);
      if (!room) {
        return NextResponse.json({ error: 'Room not found' }, { status: 404 });
      }

      // Check if already a member
      const existingMembership = await db
        .select()
        .from(roomMembers)
        .where(and(eq(roomMembers.roomId, roomId), eq(roomMembers.userId, user.id)))
        .limit(1);

      if (existingMembership.length > 0) {
        return NextResponse.json({ message: 'Already a member' });
      }

      // Add as member
      await db.insert(roomMembers).values({
        roomId,
        userId: user.id,
        role: 'member',
      });

      // Increment member count
      await db.update(studyRooms)
        .set({ memberCount: sql`${studyRooms.memberCount} + 1` })
        .where(eq(studyRooms.id, roomId));

      return NextResponse.json({ message: 'Joined room successfully' });
    }

    if (action === 'leave') {
      if (!roomId) {
        return NextResponse.json({ error: 'Room ID required' }, { status: 400 });
      }

      await db.delete(roomMembers).where(and(
        eq(roomMembers.roomId, roomId),
        eq(roomMembers.userId, user.id)
      ));

      // Decrement member count
      await db.update(studyRooms)
        .set({ memberCount: sql`GREATEST(0, ${studyRooms.memberCount} - 1)` })
        .where(eq(studyRooms.id, roomId));

      return NextResponse.json({ message: 'Left room successfully' });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Error in rooms POST:', error);
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 });
  }
});

function getTimeAgo(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}
