import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { adminSettings } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

// Public endpoint — returns only non-sensitive site settings
// No auth required so all users (including unauthenticated) can see announcements
export async function GET(request: NextRequest) {
  try {
    // Only fetch public-facing settings
    const publicKeys = ['siteAnnouncement', 'maintenanceMode'];

    const rows = await db.query.adminSettings.findMany();
    const result: Record<string, any> = {
      siteAnnouncement: '',
      maintenanceMode: false,
    };

    for (const row of rows) {
      if (publicKeys.includes(row.key)) {
        result[row.key] = row.value;
      }
    }

    return NextResponse.json(result, {
      headers: {
        'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
      },
    });
  } catch (error) {
    console.error('Error fetching site settings:', error);
    return NextResponse.json(
      { siteAnnouncement: '', maintenanceMode: false },
      { status: 200 }
    );
  }
}
