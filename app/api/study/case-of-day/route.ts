import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { withAuth, type AuthUser } from '@/lib/auth/middleware';

const sql = neon(process.env.DATABASE_URL!);

// GET - Get today's case or a specific date's case
async function handleGet(req: NextRequest, user: AuthUser) {
  const { searchParams } = new URL(req.url);
  const date = searchParams.get('date') || new Date().toISOString().split('T')[0];

  const [caseOfDay] = await sql`
    SELECT * FROM case_of_the_day WHERE date = ${date}
  `;

  if (!caseOfDay) {
    // Fallback: get the most recent case
    const [latest] = await sql`
      SELECT * FROM case_of_the_day ORDER BY date DESC LIMIT 1
    `;
    return NextResponse.json({ case: latest || null, isFallback: true });
  }

  return NextResponse.json({ case: caseOfDay, isFallback: false });
}

export const GET = withAuth(handleGet);
