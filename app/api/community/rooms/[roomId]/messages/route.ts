import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { roomMessages, roomMembers, users } from '@/lib/db/schema';
import { eq, desc, and, sql, asc } from 'drizzle-orm';
import { verifyIdToken } from '@/lib/firebase/admin';

// GET - Fetch messages for a room
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const { roomId } = await params;
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const before = searchParams.get('before'); // For pagination

    // Fetch messages
    let messagesQuery = db
      .select()
      .from(roomMessages)
      .where(eq(roomMessages.roomId, roomId))
      .orderBy(desc(roomMessages.createdAt))
      .limit(limit);

    const messages = await messagesQuery;

    // Get user details for each message
    const messagesWithUsers = await Promise.all(
      messages.map(async (msg) => {
        const [user] = await db
          .select({
            displayName: users.displayName,
            photoURL: users.photoURL,
          })
          .from(users)
          .where(eq(users.id, msg.userId))
          .limit(1);

        return {
          id: msg.id,
          userId: msg.userId,
          userName: user?.displayName || 'Anonymous',
          userPhotoURL: user?.photoURL,
          content: msg.content,
          createdAt: msg.createdAt,
          isPinned: msg.isPinned,
          likes: msg.likes || 0,
          replies: 0, // Could implement reply counting
          isLiked: false, // Would need to check against current user
        };
      })
    );

    // Return in chronological order for display
    return NextResponse.json({ 
      messages: messagesWithUsers.reverse() 
    });
  } catch (error) {
    console.error('Error fetching messages:', error);
    return NextResponse.json(
      { error: 'Failed to fetch messages' },
      { status: 500 }
    );
  }
}

// POST - Send a message to a room
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const { roomId } = await params;
    
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const decodedToken = await verifyIdToken(token);
    const userId = decodedToken.uid;

    // Check if user is a member of the room
    const membership = await db
      .select()
      .from(roomMembers)
      .where(and(
        eq(roomMembers.roomId, roomId),
        eq(roomMembers.userId, userId)
      ))
      .limit(1);

    // For official rooms, auto-join user if not a member
    if (membership.length === 0) {
      // Check if it's an official room
      if (roomId.startsWith('official-')) {
        await db.insert(roomMembers).values({
          roomId,
          userId,
          role: 'member',
        });
      } else {
        return NextResponse.json(
          { error: 'Must be a member to send messages' },
          { status: 403 }
        );
      }
    }

    const body = await req.json();
    const { content, replyToId } = body;

    if (!content?.trim()) {
      return NextResponse.json(
        { error: 'Message content required' },
        { status: 400 }
      );
    }

    // Insert the message
    const [newMessage] = await db.insert(roomMessages).values({
      roomId,
      userId,
      content: content.trim(),
      replyToId: replyToId || null,
      isPinned: false,
      likes: 0,
    }).returning();

    // Get user details
    const [user] = await db
      .select({
        displayName: users.displayName,
        photoURL: users.photoURL,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    return NextResponse.json({
      message: {
        id: newMessage.id,
        userId: newMessage.userId,
        userName: user?.displayName || decodedToken.name || 'Anonymous',
        userPhotoURL: user?.photoURL,
        content: newMessage.content,
        createdAt: newMessage.createdAt,
        isPinned: false,
        likes: 0,
        replies: 0,
        isLiked: false,
      },
    });
  } catch (error) {
    console.error('Error sending message:', error);
    return NextResponse.json(
      { error: 'Failed to send message' },
      { status: 500 }
    );
  }
}

// PATCH - Like/unlike or pin/unpin a message
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const { roomId } = await params;
    
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const decodedToken = await verifyIdToken(token);
    const userId = decodedToken.uid;

    const body = await req.json();
    const { messageId, action } = body;

    if (!messageId) {
      return NextResponse.json(
        { error: 'Message ID required' },
        { status: 400 }
      );
    }

    if (action === 'like') {
      // Increment likes
      await db
        .update(roomMessages)
        .set({ likes: sql`${roomMessages.likes} + 1` })
        .where(eq(roomMessages.id, messageId));

      return NextResponse.json({ message: 'Liked' });
    }

    if (action === 'unlike') {
      // Decrement likes
      await db
        .update(roomMessages)
        .set({ likes: sql`GREATEST(${roomMessages.likes} - 1, 0)` })
        .where(eq(roomMessages.id, messageId));

      return NextResponse.json({ message: 'Unliked' });
    }

    if (action === 'pin') {
      // Check if user is admin/moderator
      const membership = await db
        .select()
        .from(roomMembers)
        .where(and(
          eq(roomMembers.roomId, roomId),
          eq(roomMembers.userId, userId)
        ))
        .limit(1);

      if (!membership[0] || !['owner', 'admin', 'moderator'].includes(membership[0].role)) {
        return NextResponse.json(
          { error: 'Not authorized to pin messages' },
          { status: 403 }
        );
      }

      await db
        .update(roomMessages)
        .set({ isPinned: true })
        .where(eq(roomMessages.id, messageId));

      return NextResponse.json({ message: 'Pinned' });
    }

    if (action === 'unpin') {
      const membership = await db
        .select()
        .from(roomMembers)
        .where(and(
          eq(roomMembers.roomId, roomId),
          eq(roomMembers.userId, userId)
        ))
        .limit(1);

      if (!membership[0] || !['owner', 'admin', 'moderator'].includes(membership[0].role)) {
        return NextResponse.json(
          { error: 'Not authorized to unpin messages' },
          { status: 403 }
        );
      }

      await db
        .update(roomMessages)
        .set({ isPinned: false })
        .where(eq(roomMessages.id, messageId));

      return NextResponse.json({ message: 'Unpinned' });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Error updating message:', error);
    return NextResponse.json(
      { error: 'Failed to update message' },
      { status: 500 }
    );
  }
}
