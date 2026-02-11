import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth/middleware';
import { db } from '@/lib/db';
import { users, chatSessions, chatMessages } from '@/lib/db/schema';
import { eq, desc, sql } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const user = await verifyAuth(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const dbUser = await db.query.users.findFirst({
      where: eq(users.firebaseUid, user.firebaseUid),
    });

    if (!dbUser) {
      return NextResponse.json({ sessions: [] });
    }

    // Get all chat sessions with message count
    const sessions = await db
      .select({
        id: chatSessions.id,
        title: chatSessions.title,
        competencyType: chatSessions.competencyType,
        context: chatSessions.context,
        isArchived: chatSessions.isArchived,
        lastMessageAt: chatSessions.lastMessageAt,
        createdAt: chatSessions.createdAt,
        messageCount: sql<number>`(
          SELECT COUNT(*) FROM ${chatMessages} 
          WHERE ${chatMessages.sessionId} = ${chatSessions.id}
        )`.as('message_count'),
      })
      .from(chatSessions)
      .where(eq(chatSessions.userId, dbUser.id))
      .orderBy(desc(chatSessions.lastMessageAt));

    return NextResponse.json({ sessions });
  } catch (error) {
    console.error('Error fetching sessions:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await verifyAuth(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { title, competencyType, context } = await request.json();

    // User is already verified/fetched by verifyAuth - use the id directly
    const dbUser = await db.query.users.findFirst({
      where: eq(users.firebaseUid, user.firebaseUid),
    });

    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const [session] = await db.insert(chatSessions).values({
      userId: dbUser.id,
      title: title || 'New Conversation',
      competencyType: competencyType || 'research',
      context: context || null,
    }).returning();

    return NextResponse.json({ session });
  } catch (error) {
    console.error('Error creating session:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
