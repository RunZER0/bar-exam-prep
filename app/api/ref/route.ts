import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

/**
 * GET /api/ref?code=xxx
 * 
 * Public endpoint — called when someone visits ynai.co.ke/?ref=xxx
 * Validates the referral code and increments click count atomically.
 */
export async function GET(req: NextRequest) {
  const code = new URL(req.url).searchParams.get('code');

  if (!code?.trim()) {
    return NextResponse.json({ valid: false }, { status: 400 });
  }

  const sanitizedCode = code.trim().toLowerCase().replace(/[^a-z0-9-]/g, '');

  // Validate and atomically increment click count in one query
  const result = await sql`
    UPDATE marketing_links 
    SET click_count = click_count + 1, updated_at = NOW()
    WHERE code = ${sanitizedCode} AND is_active = true
    RETURNING code
  `;

  if (result.length === 0) {
    return NextResponse.json({ valid: false });
  }

  return NextResponse.json({ valid: true, code: result[0].code });
}
