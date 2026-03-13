import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { roomMembers, users, studyRooms } from '@/lib/db/schema';
import { and, eq } from 'drizzle-orm';
import { verifyAuth } from '@/lib/auth/middleware';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const user = await verifyAuth(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { roomId } = await params;

    const [room] = await db
      .select({ id: studyRooms.id, roomType: studyRooms.roomType, isPublic: studyRooms.isPublic })
      .from(studyRooms)
      .where(eq(studyRooms.id, roomId))
      .limit(1);

    if (!room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }

    const [membership] = await db
      .select({ id: roomMembers.id })
      .from(roomMembers)
      .where(and(eq(roomMembers.roomId, roomId), eq(roomMembers.userId, user.id)))
      .limit(1);

    if (!membership && !room.isPublic) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const members = await db
      .select({
        userId: roomMembers.userId,
        role: roomMembers.role,
        joinedAt: roomMembers.joinedAt,
      })
      .from(roomMembers)
      .where(eq(roomMembers.roomId, roomId));

    const enriched = await Promise.all(
      members.map(async (m) => {
        const [u] = await db
          .select({
            displayName: users.displayName,
            communityUsername: users.communityUsername,
            photoURL: users.photoURL,
          })
          .from(users)
          .where(eq(users.id, m.userId))
          .limit(1);

        return {
          userId: m.userId,
          name: u?.communityUsername || u?.displayName || 'Anonymous',
          photoURL: u?.photoURL || null,
          role: m.role,
          joinedAt: m.joinedAt,
        };
      })
    );

    enriched.sort((a, b) => {
      if (a.role === 'owner' && b.role !== 'owner') return -1;
      if (a.role !== 'owner' && b.role === 'owner') return 1;
      return a.name.localeCompare(b.name);
    });

    return NextResponse.json({ members: enriched });
  } catch (error) {
    console.error('Error loading room members:', error);
    return NextResponse.json({ error: 'Failed to load room members' }, { status: 500 });
  }
}
