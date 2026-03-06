import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth/middleware';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { eq, sql, desc } from 'drizzle-orm';

/**
 * POST /api/page-visits — record a page visit (section, label, minutes)
 * GET  /api/page-visits — get user's page visit history (5+ min visits)
 */

export async function POST(request: NextRequest) {
  try {
    const user = await verifyAuth(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const dbUser = await db.query.users.findFirst({
      where: eq(users.firebaseUid, user.firebaseUid),
    });
    if (!dbUser) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const { section, label, minutes } = await request.json();
    if (!section || !minutes || minutes < 5) {
      return NextResponse.json({ error: 'Invalid data' }, { status: 400 });
    }

    // Ensure table exists
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS page_visits (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id),
        section TEXT NOT NULL,
        label TEXT,
        minutes INT NOT NULL DEFAULT 0,
        visited_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await db.execute(sql`
      INSERT INTO page_visits (user_id, section, label, minutes)
      VALUES (${dbUser.id}, ${section}, ${label || section}, ${minutes})
    `);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Page visit tracking error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await verifyAuth(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const dbUser = await db.query.users.findFirst({
      where: eq(users.firebaseUid, user.firebaseUid),
    });
    if (!dbUser) return NextResponse.json({ visits: [] });

    // Check table exists
    const tableCheck = await db.execute(
      sql`SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'page_visits'`
    );
    if (((tableCheck as any).rows?.length ?? 0) === 0) {
      return NextResponse.json({ visits: [] });
    }

    const rows = await db.execute(sql`
      SELECT id, section, label, minutes, visited_at
      FROM page_visits
      WHERE user_id = ${dbUser.id}
      ORDER BY visited_at DESC
      LIMIT 100
    `);

    const visits = ((rows as any).rows || []).map((r: any) => ({
      id: r.id,
      section: r.section,
      label: r.label || r.section,
      minutes: Number(r.minutes),
      visitedAt: r.visited_at,
    }));

    return NextResponse.json({ visits });
  } catch (error) {
    console.error('Page visits fetch error:', error);
    return NextResponse.json({ visits: [] }, { status: 500 });
  }
}
