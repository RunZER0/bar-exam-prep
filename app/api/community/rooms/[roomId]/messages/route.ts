import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { roomMessages, roomMembers, users, studyRooms } from '@/lib/db/schema';
import { eq, desc, and } from 'drizzle-orm';
import { verifyAuth } from '@/lib/auth/middleware';

// GET - Fetch messages for a room
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const user = await verifyAuth(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { roomId } = await params;
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '50');

    const messages = await db
      .select()
      .from(roomMessages)
      .where(eq(roomMessages.roomId, roomId))
      .orderBy(desc(roomMessages.createdAt))
      .limit(limit);

    // Get user details for each message
    const messagesWithUsers = await Promise.all(
      messages.map(async (msg) => {
        let userData: { displayName: string | null; photoURL: string | null; communityUsername: string | null } | undefined;
        if (msg.userId) {
          const [found] = await db
            .select({
              displayName: users.displayName,
              photoURL: users.photoURL,
              communityUsername: users.communityUsername,
            })
            .from(users)
            .where(eq(users.id, msg.userId))
            .limit(1);
          userData = found;
        }

        return {
          id: msg.id,
          userId: msg.userId,
          displayName: userData?.communityUsername || userData?.displayName || 'Anonymous',
          photoURL: userData?.photoURL,
          content: msg.content,
          createdAt: msg.createdAt,
          isPinned: msg.isPinned,
          isAgent: !msg.userId,
          isCurrentUser: msg.userId === user.id,
          reactions: msg.reactions || {},
        };
      })
    );

    return NextResponse.json({
      messages: messagesWithUsers.reverse(),
    });
  } catch (error) {
    console.error('Error fetching messages:', error);
    return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 });
  }
}

// POST - Send a message to a room
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const user = await verifyAuth(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { roomId } = await params;

    // Check if user is a member of the room
    const membership = await db
      .select()
      .from(roomMembers)
      .where(and(eq(roomMembers.roomId, roomId), eq(roomMembers.userId, user.id)))
      .limit(1);

    // Auto-join official rooms
    if (membership.length === 0) {
      const [room] = await db.select().from(studyRooms).where(eq(studyRooms.id, roomId)).limit(1);
      if (room?.roomType === 'official') {
        await db.insert(roomMembers).values({ roomId, userId: user.id, role: 'member' });
      } else {
        return NextResponse.json({ error: 'Must be a member to send messages' }, { status: 403 });
      }
    }

    const body = await req.json();
    const { content, replyToId } = body;

    if (!content?.trim()) {
      return NextResponse.json({ error: 'Message content required' }, { status: 400 });
    }

    // Insert the message
    const [newMessage] = await db.insert(roomMessages).values({
      roomId,
      userId: user.id,
      content: content.trim(),
      parentId: replyToId || null,
      isPinned: false,
    }).returning();

    return NextResponse.json({
      message: {
        id: newMessage.id,
        userId: newMessage.userId,
        displayName: user.displayName || 'Anonymous',
        content: newMessage.content,
        createdAt: newMessage.createdAt,
        isPinned: false,
        isAgent: false,
        isCurrentUser: true,
        reactions: {},
      },
    });
  } catch (error) {
    console.error('Error sending message:', error);
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 });
  }
}

// PATCH - Like/unlike a message
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const user = await verifyAuth(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { roomId } = await params;
    const body = await req.json();
    const { messageId, action } = body;

    if (!messageId) return NextResponse.json({ error: 'Message ID required' }, { status: 400 });

    if (action === 'like' || action === 'unlike') {
      const [message] = await db.select().from(roomMessages).where(eq(roomMessages.id, messageId)).limit(1);
      if (message) {
        const reactions: Record<string, string[]> = (message.reactions as any) || {};
        const likes = reactions['likes'] || [];
        if (action === 'like' && !likes.includes(user.id)) {
          likes.push(user.id);
        } else if (action === 'unlike') {
          const idx = likes.indexOf(user.id);
          if (idx > -1) likes.splice(idx, 1);
        }
        reactions['likes'] = likes;
        await db.update(roomMessages).set({ reactions }).where(eq(roomMessages.id, messageId));
      }
      return NextResponse.json({ ok: true });
    }

    if (action === 'pin' || action === 'unpin') {
      const membership = await db
        .select()
        .from(roomMembers)
        .where(and(eq(roomMembers.roomId, roomId), eq(roomMembers.userId, user.id)))
        .limit(1);
      if (!membership[0] || !['owner', 'admin', 'moderator'].includes(membership[0].role)) {
        return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
      }
      await db.update(roomMessages).set({ isPinned: action === 'pin' }).where(eq(roomMessages.id, messageId));
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Error updating message:', error);
    return NextResponse.json({ error: 'Failed to update message' }, { status: 500 });
  }
}
