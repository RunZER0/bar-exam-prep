/**
 * Room Creation Requests API
 * POST - Submit a request to create a custom room (AI-reviewed + admin approval)
 * GET  - Get user's room requests
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth, withAdminAuth } from '@/lib/auth/middleware';
import { db } from '@/lib/db';
import { roomRequests, studyRooms, roomMembers, users } from '@/lib/db/schema';
import { eq, desc, and } from 'drizzle-orm';
import OpenAI from 'openai';
import { MINI_MODEL, AI_IDENTITY } from '@/lib/ai/model-config';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// AI review of room request content
async function reviewRoomRequest(name: string, description: string | null): Promise<{
  approved: boolean;
  feedback: string;
  confidence: number;
}> {
  try {
    const response = await openai.chat.completions.create({
      model: MINI_MODEL,
      messages: [
        {
          role: 'system',
          content: `You are Ynai Assistant — a content moderator for a Kenya School of Law (KSL) bar exam preparation platform community. If asked who you are, say "I am Ynai Assistant." NEVER identify as ChatGPT, GPT, Claude, or any AI brand. 
Your job is to review room creation requests and determine if they are appropriate.

APPROVE rooms that are:
- Related to legal studies, bar exam prep, KSL coursework, or law in general
- General student social/support groups (e.g. "Study Buddies", "Moot Court Group")
- Professional development (e.g. "Pupillage Tips", "Career Advice")
- Appropriate social groups (e.g. "Coffee & Cram", "Weekend Studiers")

REJECT rooms that are:
- Offensive, hateful, discriminatory, or vulgar
- Promoting cheating, exam fraud, or academic dishonesty
- Spam or nonsensical
- Completely unrelated to education or student life
- Impersonating official KSL rooms or faculty

Respond with JSON only: {"approved": boolean, "feedback": "brief explanation", "confidence": 0-100}`
        },
        {
          role: 'user',
          content: `Room Name: "${name}"\nDescription: "${description || 'No description provided'}"`
        }
      ],
      temperature: 0.1,
      max_tokens: 2000,
      response_format: { type: 'json_object' },
    });

    const result = JSON.parse(response.choices[0]?.message?.content || '{}');
    return {
      approved: result.approved ?? true,
      feedback: result.feedback || 'Reviewed by AI',
      confidence: result.confidence ?? 80,
    };
  } catch (error) {
    console.error('AI review error:', error);
    // If AI review fails, default to pending for manual review
    return { approved: true, feedback: 'AI review unavailable — sent for manual review', confidence: 0 };
  }
}

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

    // AI review the room request
    const review = await reviewRoomRequest(name.trim(), description?.trim() || null);

    if (!review.approved && review.confidence >= 70) {
      // High-confidence rejection — reject immediately
      return NextResponse.json({
        error: 'Your room request was not approved.',
        feedback: review.feedback,
      }, { status: 400 });
    }

    // Auto-approve high-confidence or send to admin for marginal cases
    const autoApproved = review.approved && review.confidence >= 80;

    const [request] = await db.insert(roomRequests).values({
      requestedBy: user.id,
      name: name.trim(),
      description: description?.trim() || null,
      visibility: visibility || 'public',
      status: autoApproved ? 'approved' : 'pending',
    }).returning();

    // If auto-approved, also create the room immediately
    if (autoApproved) {
      const [newRoom] = await db.insert(studyRooms).values({
        name: name.trim(),
        description: description?.trim() || null,
        unitId: null,
        roomType: 'custom',
        isPublic: (visibility || 'public') === 'public',
        createdById: user.id,
      }).returning();

      // Add requester as owner/member
      await db.insert(roomMembers).values({
        roomId: newRoom.id,
        userId: user.id,
        role: 'owner',
      });
    }

    return NextResponse.json({
      success: true,
      request,
      autoApproved,
      feedback: review.feedback,
    });
  } catch (error) {
    console.error('Room request error:', error);
    return NextResponse.json({ error: 'Failed to submit request' }, { status: 500 });
  }
});
