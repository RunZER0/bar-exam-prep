/**
 * Community Username API
 * GET  - check if user has a community username set
 * POST - set/update community username
 * PUT  - check availability of a username
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { and, eq, ne } from 'drizzle-orm';

// GET - Get user's community profile
export const GET = withAuth(async (req: NextRequest, user) => {
  try {
    const [dbUser] = await db.select({
      id: users.id,
      firebaseUid: users.firebaseUid,
      email: users.email,
      displayName: users.displayName,
      communityUsername: users.communityUsername,
      communityBio: users.communityBio,
      communityJoinedAt: users.communityJoinedAt,
    }).from(users).where(eq(users.id, user.id)).limit(1);

    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({
      hasUsername: !!dbUser.communityUsername,
      username: dbUser.communityUsername || null,
      bio: dbUser.communityBio || null,
      joinedAt: dbUser.communityJoinedAt || null,
      suggestedUsername: generateSuggested(dbUser.displayName || dbUser.email),
    });
  } catch (error) {
    console.error('Community profile error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
});

// POST - Set community username
export const POST = withAuth(async (req: NextRequest, user) => {
  try {
    const { username, bio } = await req.json();
    
    if (!username || typeof username !== 'string') {
      return NextResponse.json({ error: 'Username is required' }, { status: 400 });
    }

    const clean = username.trim().toLowerCase();

    // Validation
    if (clean.length < 3 || clean.length > 20) {
      return NextResponse.json({ error: 'Username must be 3-20 characters' }, { status: 400 });
    }
    if (!/^[a-z0-9_]+$/.test(clean)) {
      return NextResponse.json({ error: 'Only letters, numbers, and underscores allowed' }, { status: 400 });
    }

    // Check if taken
    const [existing] = await db.select({
      id: users.id,
    }).from(users).where(and(eq(users.communityUsername, clean), ne(users.id, user.id))).limit(1);

    if (existing) {
      return NextResponse.json({ error: 'Username already taken', taken: true }, { status: 409 });
    }

    // Set username
    const updated = await db.update(users)
      .set({
        communityUsername: clean,
        communityBio: bio?.trim() || null,
        communityJoinedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id))
      .returning({ id: users.id, communityUsername: users.communityUsername });

    if (!updated || updated.length === 0) {
      return NextResponse.json({ error: 'Unable to save username' }, { status: 500 });
    }

    return NextResponse.json({ success: true, username: clean });
  } catch (error) {
    console.error('Set username error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
});

// PUT - Check username availability
export const PUT = withAuth(async (req: NextRequest, user) => {
  try {
    const { username } = await req.json();
    const clean = username?.trim()?.toLowerCase();

    if (!clean || clean.length < 3) {
      return NextResponse.json({ available: false, reason: 'Too short' });
    }
    if (!/^[a-z0-9_]+$/.test(clean)) {
      return NextResponse.json({ available: false, reason: 'Invalid characters' });
    }

    const [existing] = await db.select({
      id: users.id,
    }).from(users).where(and(eq(users.communityUsername, clean), ne(users.id, user.id))).limit(1);

    const available = !existing;
    return NextResponse.json({ available, reason: available ? null : 'Already taken' });
  } catch {
    return NextResponse.json({ available: false, reason: 'Check failed' });
  }
});

function generateSuggested(nameOrEmail: string): string {
  const base = nameOrEmail
    .split('@')[0]
    .replace(/[^a-zA-Z0-9]/g, '_')
    .toLowerCase()
    .slice(0, 15);
  return base || 'student';
}
