import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { marketingLinks, users } from '@/lib/db/schema';
import { eq, desc, sql, and, gte, count } from 'drizzle-orm';
import { withAdminAuth, withAuth, type AuthUser } from '@/lib/auth/middleware';

// GET - List all marketing links with stats (admin only)
async function handleGet(req: NextRequest, user: AuthUser) {
  const links = await db
    .select()
    .from(marketingLinks)
    .orderBy(desc(marketingLinks.createdAt));

  // For each link, get real-time signup count from users table
  const enriched = await Promise.all(
    links.map(async (link) => {
      const [signupResult] = await db
        .select({ count: count() })
        .from(users)
        .where(eq(users.referredByCode, link.code));

      const signupCount = signupResult?.count || 0;

      // Get signups with details
      const signups = await db
        .select({
          id: users.id,
          email: users.email,
          displayName: users.displayName,
          subscriptionPlan: users.subscriptionPlan,
          subscriptionStatus: users.subscriptionStatus,
          createdAt: users.createdAt,
        })
        .from(users)
        .where(eq(users.referredByCode, link.code))
        .orderBy(desc(users.createdAt))
        .limit(50);

      // Update cached signup_count if it drifted
      if (signupCount !== link.signupCount) {
        await db
          .update(marketingLinks)
          .set({ signupCount })
          .where(eq(marketingLinks.id, link.id));
      }

      return {
        ...link,
        signupCount,
        signups,
      };
    })
  );

  // Aggregate stats
  const totalClicks = enriched.reduce((sum, l) => sum + l.clickCount, 0);
  const totalSignups = enriched.reduce((sum, l) => sum + l.signupCount, 0);
  const activeLinks = enriched.filter(l => l.isActive).length;

  // Signups over last 30 days (grouped by day)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const dailySignups = await db
    .select({
      date: sql<string>`DATE(${users.createdAt})`,
      count: count(),
    })
    .from(users)
    .where(and(
      sql`${users.referredByCode} IS NOT NULL`,
      gte(users.createdAt, thirtyDaysAgo)
    ))
    .groupBy(sql`DATE(${users.createdAt})`)
    .orderBy(sql`DATE(${users.createdAt})`);

  return NextResponse.json({
    links: enriched,
    stats: {
      totalLinks: enriched.length,
      activeLinks,
      totalClicks,
      totalSignups,
      conversionRate: totalClicks > 0 ? ((totalSignups / totalClicks) * 100).toFixed(1) : '0.0',
      dailySignups,
    },
  });
}

// POST - Create a new marketing link (admin only)
async function handlePost(req: NextRequest, user: AuthUser) {
  const body = await req.json();
  const { marketerName, marketerEmail, marketerPhone, campaign, code, notes } = body;

  if (!marketerName?.trim()) {
    return NextResponse.json({ error: 'Marketer name is required' }, { status: 400 });
  }

  // Generate or sanitize code
  let linkCode = code?.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  if (!linkCode) {
    // Auto-generate from name
    linkCode = marketerName
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '-')
      .slice(0, 30);
    // Add random suffix to avoid collisions
    linkCode += '-' + Math.random().toString(36).slice(2, 6);
  }

  // Check uniqueness
  const [existing] = await db
    .select({ id: marketingLinks.id })
    .from(marketingLinks)
    .where(eq(marketingLinks.code, linkCode))
    .limit(1);

  if (existing) {
    return NextResponse.json({ error: 'This code is already in use' }, { status: 409 });
  }

  const [newLink] = await db
    .insert(marketingLinks)
    .values({
      code: linkCode,
      marketerName: marketerName.trim(),
      marketerEmail: marketerEmail?.trim() || null,
      marketerPhone: marketerPhone?.trim() || null,
      campaign: campaign?.trim() || 'general',
      notes: notes?.trim() || null,
    })
    .returning();

  return NextResponse.json({ link: newLink }, { status: 201 });
}

// PATCH - Update a marketing link (admin only)
async function handlePatch(req: NextRequest, user: AuthUser) {
  const body = await req.json();
  const { id, marketerName, marketerEmail, marketerPhone, campaign, isActive, notes } = body;

  if (!id) {
    return NextResponse.json({ error: 'Link ID is required' }, { status: 400 });
  }

  const updates: Record<string, any> = { updatedAt: new Date() };
  if (marketerName !== undefined) updates.marketerName = marketerName.trim();
  if (marketerEmail !== undefined) updates.marketerEmail = marketerEmail?.trim() || null;
  if (marketerPhone !== undefined) updates.marketerPhone = marketerPhone?.trim() || null;
  if (campaign !== undefined) updates.campaign = campaign?.trim() || 'general';
  if (isActive !== undefined) updates.isActive = isActive;
  if (notes !== undefined) updates.notes = notes?.trim() || null;

  await db
    .update(marketingLinks)
    .set(updates)
    .where(eq(marketingLinks.id, id));

  return NextResponse.json({ ok: true });
}

// DELETE - Remove a marketing link (admin only)
async function handleDelete(req: NextRequest, user: AuthUser) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'Link ID is required' }, { status: 400 });
  }

  await db
    .delete(marketingLinks)
    .where(eq(marketingLinks.id, id));

  return NextResponse.json({ ok: true });
}

export const GET = withAdminAuth(handleGet);
export const POST = withAdminAuth(handlePost);
export const PATCH = withAdminAuth(handlePatch);
export const DELETE = withAdminAuth(handleDelete);
