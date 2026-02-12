import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { studyRooms, roomMembers, roomMessages, roomRequests } from '@/lib/db/schema';
import { eq, desc, and, count, sql } from 'drizzle-orm';
import { verifyIdToken } from '@/lib/firebase/admin';
import { ATP_UNITS } from '@/lib/constants/legal-content';

// GET - Fetch all study rooms (official + custom)
export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization');
    let userId: string | null = null;

    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      try {
        const decodedToken = await verifyIdToken(token);
        userId = decodedToken.uid;
      } catch {
        // User not authenticated, will still return public rooms
      }
    }

    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type'); // 'official' | 'custom' | null for all

    // Fetch rooms from database
    const roomsQuery = db.select().from(studyRooms);
    
    let rooms = await roomsQuery;

    // If no rooms exist, create official rooms for ATP units
    if (rooms.length === 0) {
      const officialRooms = ATP_UNITS.slice(0, 9).map(unit => ({
        id: `official-${unit.id}`,
        name: unit.name,
        description: `Official study room for ${unit.name}. Ask questions, share insights, and collaborate with fellow learners.`,
        unitId: unit.id,
        roomType: 'official' as const,
        createdBy: 'system',
        maxMembers: 1000,
        isActive: true,
      }));

      // Insert official rooms
      await db.insert(studyRooms).values(officialRooms).onConflictDoNothing();
      rooms = await db.select().from(studyRooms);
    }

    // Filter by type if specified
    if (type) {
      rooms = rooms.filter(r => r.roomType === type);
    }

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

        // Check if user is a member
        let isJoined = false;
        if (userId) {
          const membership = await db
            .select()
            .from(roomMembers)
            .where(and(
              eq(roomMembers.roomId, room.id),
              eq(roomMembers.userId, userId)
            ))
            .limit(1);
          isJoined = membership.length > 0;
        }

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
          isJoined,
          lastActivity: lastMessage[0]?.createdAt 
            ? getTimeAgo(new Date(lastMessage[0].createdAt)) 
            : 'No activity yet',
        };
      })
    );

    return NextResponse.json({ rooms: roomsWithStats });
  } catch (error) {
    console.error('Error fetching rooms:', error);
    return NextResponse.json(
      { error: 'Failed to fetch rooms' },
      { status: 500 }
    );
  }
}

// POST - Create a new custom room or join an existing room
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const decodedToken = await verifyIdToken(token);
    const userId = decodedToken.uid;

    const body = await req.json();
    const { action, roomId, name, description } = body;

    if (action === 'join') {
      // Join existing room
      if (!roomId) {
        return NextResponse.json({ error: 'Room ID required' }, { status: 400 });
      }

      // Check if already a member
      const existingMembership = await db
        .select()
        .from(roomMembers)
        .where(and(
          eq(roomMembers.roomId, roomId),
          eq(roomMembers.userId, userId)
        ))
        .limit(1);

      if (existingMembership.length > 0) {
        return NextResponse.json({ message: 'Already a member' });
      }

      // Add as member
      await db.insert(roomMembers).values({
        roomId,
        userId,
        role: 'member',
      });

      return NextResponse.json({ message: 'Joined room successfully' });
    }

    if (action === 'create') {
      // Create new custom room
      if (!name) {
        return NextResponse.json({ error: 'Room name required' }, { status: 400 });
      }

      const newRoom = await db.insert(studyRooms).values({
        name,
        description: description || `Custom study room: ${name}`,
        roomType: 'custom',
        createdBy: userId,
        maxMembers: 100,
        isActive: true,
      }).returning();

      // Add creator as owner
      await db.insert(roomMembers).values({
        roomId: newRoom[0].id,
        userId,
        role: 'owner',
      });

      return NextResponse.json({ room: newRoom[0] });
    }

    if (action === 'leave') {
      // Leave room
      if (!roomId) {
        return NextResponse.json({ error: 'Room ID required' }, { status: 400 });
      }

      await db.delete(roomMembers).where(and(
        eq(roomMembers.roomId, roomId),
        eq(roomMembers.userId, userId)
      ));

      return NextResponse.json({ message: 'Left room successfully' });
    }

    if (action === 'request') {
      // Request to create official room (needs admin approval)
      if (!name) {
        return NextResponse.json({ error: 'Room name required' }, { status: 400 });
      }

      await db.insert(roomRequests).values({
        requestedBy: userId,
        roomName: name,
        description: description || '',
        status: 'pending',
      });

      return NextResponse.json({ message: 'Room request submitted' });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Error in rooms POST:', error);
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    );
  }
}

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
