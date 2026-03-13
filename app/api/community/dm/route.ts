/**
 * Direct Messages API
 * GET  - Fetch conversations / messages
 * POST - Send a message (friends: unlimited, non-friends: single invite only)
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { directMessages, userFriends, users } from '@/lib/db/schema';
import { eq, and, or, desc, sql } from 'drizzle-orm';
import { verifyIdToken } from '@/lib/firebase/admin';

function parseMessageEnvelope(content: string, messageType: string) {
  if (messageType !== 'media') {
    return { content, attachments: [] as Array<{ type: string; url: string; name?: string }> };
  }
  try {
    const parsed = JSON.parse(content);
    return {
      content: typeof parsed.text === 'string' ? parsed.text : '',
      attachments: Array.isArray(parsed.attachments) ? parsed.attachments : [],
    };
  } catch {
    return { content, attachments: [] as Array<{ type: string; url: string; name?: string }> };
  }
}

// GET - Fetch conversations or messages with a specific user
export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const decodedToken = await verifyIdToken(token);
    const [currentUser] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.firebaseUid, decodedToken.uid))
      .limit(1);
    if (!currentUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    const userId = currentUser.id;

    const { searchParams } = new URL(req.url);
    const partnerId = searchParams.get('partnerId');

    if (partnerId) {
      // Fetch messages with a specific user
      const messages = await db
        .select({
          id: directMessages.id,
          senderId: directMessages.senderId,
          recipientId: directMessages.recipientId,
          content: directMessages.content,
          messageType: directMessages.messageType,
          read: directMessages.read,
          createdAt: directMessages.createdAt,
        })
        .from(directMessages)
        .where(or(
          and(eq(directMessages.senderId, userId), eq(directMessages.recipientId, partnerId)),
          and(eq(directMessages.senderId, partnerId), eq(directMessages.recipientId, userId))
        ))
        .orderBy(directMessages.createdAt)
        .limit(100);

      // Mark unread messages as read
      await db
        .update(directMessages)
        .set({ read: true })
        .where(and(
          eq(directMessages.senderId, partnerId),
          eq(directMessages.recipientId, userId),
          eq(directMessages.read, false)
        ));

      return NextResponse.json({
        messages: messages.map((m) => {
          const parsed = parseMessageEnvelope(m.content, m.messageType);
          return { ...m, content: parsed.content, attachments: parsed.attachments };
        }),
      });
    }

    // Fetch conversation list (latest message per conversation partner)
    const allMessages = await db
      .select({
        id: directMessages.id,
        senderId: directMessages.senderId,
        recipientId: directMessages.recipientId,
        content: directMessages.content,
        messageType: directMessages.messageType,
        read: directMessages.read,
        createdAt: directMessages.createdAt,
      })
      .from(directMessages)
      .where(or(
        eq(directMessages.senderId, userId),
        eq(directMessages.recipientId, userId)
      ))
      .orderBy(desc(directMessages.createdAt));

    // Group by conversation partner and get latest message
    const conversationMap = new Map<string, typeof allMessages[0]>();
    const unreadCounts = new Map<string, number>();
    
    for (const msg of allMessages) {
      const partnerId = msg.senderId === userId ? msg.recipientId : msg.senderId;
      if (!conversationMap.has(partnerId)) {
        conversationMap.set(partnerId, msg);
      }
      if (msg.recipientId === userId && !msg.read) {
        unreadCounts.set(partnerId, (unreadCounts.get(partnerId) || 0) + 1);
      }
    }

    // Enrich with user details
    const conversations = await Promise.all(
      Array.from(conversationMap.entries()).map(async ([partnerId, lastMsg]) => {
        const [partner] = await db
          .select({
            displayName: users.displayName,
            photoURL: users.photoURL,
          })
          .from(users)
          .where(eq(users.id, partnerId))
          .limit(1);

        return {
          partnerId,
          displayName: partner?.displayName || 'Unknown',
          photoURL: partner?.photoURL || null,
          lastMessage: lastMsg.messageType === 'media' ? '📎 Media message' : lastMsg.content,
          lastMessageAt: lastMsg.createdAt,
          isLastFromMe: lastMsg.senderId === userId,
          unreadCount: unreadCounts.get(partnerId) || 0,
        };
      })
    );

    return NextResponse.json({ conversations });
  } catch (error) {
    console.error('Error fetching DMs:', error);
    return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 });
  }
}

// POST - Send a direct message
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const decodedToken = await verifyIdToken(token);
    const [currentUser] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.firebaseUid, decodedToken.uid))
      .limit(1);
    if (!currentUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    const userId = currentUser.id;

    const { recipientId, content, attachments } = await req.json();
    const safeContent = (content || '').trim();
    const safeAttachments = Array.isArray(attachments)
      ? attachments.filter((a: any) => a && typeof a.url === 'string' && typeof a.type === 'string').slice(0, 5)
      : [];

    if (!recipientId || (!safeContent && safeAttachments.length === 0)) {
      return NextResponse.json({ error: 'Recipient and message content or attachment are required' }, { status: 400 });
    }

    if (recipientId === userId) {
      return NextResponse.json({ error: 'Cannot message yourself' }, { status: 400 });
    }

    // Check if they are mutual friends
    const friendship = await db
      .select()
      .from(userFriends)
      .where(and(
        or(
          and(eq(userFriends.userId, userId), eq(userFriends.friendId, recipientId)),
          and(eq(userFriends.userId, recipientId), eq(userFriends.friendId, userId))
        ),
        eq(userFriends.status, 'accepted')
      ))
      .limit(1);

    const areFriends = friendship.length > 0;

    if (!areFriends) {
      // Non-friends can only send ONE invite message
      const existingInvite = await db
        .select()
        .from(directMessages)
        .where(and(
          eq(directMessages.senderId, userId),
          eq(directMessages.recipientId, recipientId),
          eq(directMessages.messageType, 'invite')
        ))
        .limit(1);

      if (existingInvite.length > 0) {
        return NextResponse.json({
          error: 'You have already sent an invite message. Add them as a friend to continue messaging.',
        }, { status: 403 });
      }

      // Send as invite
      const [message] = await db.insert(directMessages).values({
        senderId: userId,
        recipientId,
        content: safeContent.slice(0, 500), // Limit invite length
        messageType: 'invite',
      }).returning();

      return NextResponse.json({ message, type: 'invite' });
    }

    const messageType = safeAttachments.length > 0 ? 'media' : 'message';
    const payload = messageType === 'media'
      ? JSON.stringify({ text: safeContent, attachments: safeAttachments })
      : safeContent;

    // Friends can send unlimited messages
    const [message] = await db.insert(directMessages).values({
      senderId: userId,
      recipientId,
      content: payload,
      messageType,
    }).returning();

    const parsed = parseMessageEnvelope(message.content, message.messageType);
    return NextResponse.json({ message: { ...message, content: parsed.content, attachments: parsed.attachments }, type: messageType });
  } catch (error) {
    console.error('Error sending DM:', error);
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 });
  }
}
