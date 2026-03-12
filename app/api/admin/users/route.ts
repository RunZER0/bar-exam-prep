import { NextRequest, NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/auth/middleware';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { sql, desc, count, ilike, or } from 'drizzle-orm';

export const GET = withAdminAuth(async (req: NextRequest, _user) => {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || '';
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const role = searchParams.get('role');

    let query = db.select({
      id: users.id,
      email: users.email,
      displayName: users.displayName,
      photoURL: users.photoURL,
      role: users.role,
      isActive: users.isActive,
      onboardingCompleted: users.onboardingCompleted,
      subscriptionPlan: users.subscriptionPlan,
      subscriptionTier: users.subscriptionTier,
      subscriptionStatus: users.subscriptionStatus,
      trialEndsAt: users.trialEndsAt,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
    }).from(users);

    const conditions = [];

    if (search) {
      conditions.push(
        or(
          ilike(users.email, `%${search}%`),
          ilike(users.displayName, `%${search}%`)
        )!
      );
    }

    if (role) {
      conditions.push(sql`${users.role} = ${role}`);
    }

    if (conditions.length > 0) {
      for (const cond of conditions) {
        query = query.where(cond) as any;
      }
    }

    const allUsers = await (query as any)
      .orderBy(desc(users.createdAt))
      .limit(limit)
      .offset(offset);

    // Total count for pagination
    let countQuery = db.select({ total: count() }).from(users);
    if (conditions.length > 0) {
      for (const cond of conditions) {
        countQuery = countQuery.where(cond) as any;
      }
    }
    const [{ total }] = await countQuery;

    return NextResponse.json({
      users: allUsers,
      pagination: { total, limit, offset, hasMore: offset + limit < total },
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    );
  }
});
