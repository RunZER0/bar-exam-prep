/**
 * YNAI Mastery Engine v3 - Admin Items API
 * 
 * List and manage practice items with their skill mappings.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { eq, sql } from 'drizzle-orm';
import { verifyIdToken } from '@/lib/firebase/admin';

// ============================================
// GET - List items with skill mappings
// ============================================

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await verifyIdToken(token);
    
    const [user] = await db.select().from(users)
      .where(eq(users.firebaseUid, decodedToken.uid))
      .limit(1);

    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const url = new URL(req.url);
    const unitId = url.searchParams.get('unitId');
    const unmappedOnly = url.searchParams.get('unmappedOnly') === 'true';
    const limit = parseInt(url.searchParams.get('limit') ?? '100');
    const offset = parseInt(url.searchParams.get('offset') ?? '0');

    // Build query
    let whereClause = sql`WHERE i.is_active = true`;
    if (unitId) {
      whereClause = sql`WHERE i.is_active = true AND i.unit_id = ${unitId}`;
    }

    // Get items
    const itemsResult = await db.execute(sql`
      SELECT 
        i.id,
        i.item_type,
        i.format,
        i.prompt,
        i.difficulty,
        i.unit_id,
        i.is_active,
        u.name as unit_name,
        COALESCE(
          json_agg(
            json_build_object(
              'skillId', ms.id,
              'skillName', ms.name,
              'skillCode', ms.code,
              'strength', ism.strength
            )
          ) FILTER (WHERE ms.id IS NOT NULL),
          '[]'::json
        ) as skill_mappings
      FROM items i
      LEFT JOIN curriculum_units u ON u.id = i.unit_id
      LEFT JOIN item_skill_map ism ON ism.item_id = i.id
      LEFT JOIN micro_skills ms ON ms.id = ism.skill_id
      ${whereClause}
      GROUP BY i.id, i.item_type, i.format, i.prompt, i.difficulty, i.unit_id, i.is_active, u.name
      ${unmappedOnly ? sql`HAVING COUNT(ms.id) = 0` : sql``}
      ORDER BY i.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `);

    // Transform skill_mappings from JSON array
    const items = itemsResult.rows.map((row: Record<string, unknown>) => ({
      id: row.id,
      itemType: row.item_type,
      format: row.format,
      prompt: row.prompt,
      difficulty: row.difficulty,
      unitId: row.unit_id,
      unitName: row.unit_name,
      isActive: row.is_active,
      skillMappings: Array.isArray(row.skill_mappings) 
        ? row.skill_mappings.map((m: Record<string, unknown>) => ({
            skillId: m.skillId,
            skillName: m.skillName,
            strength: m.strength,
          }))
        : [],
    }));

    // Get total count
    const countResult = await db.execute(sql`
      SELECT COUNT(DISTINCT i.id) as total
      FROM items i
      LEFT JOIN item_skill_map ism ON ism.item_id = i.id
      ${whereClause}
      ${unmappedOnly ? sql`AND NOT EXISTS (SELECT 1 FROM item_skill_map WHERE item_id = i.id)` : sql``}
    `);

    return NextResponse.json({ 
      items,
      total: countResult.rows[0]?.total ?? 0,
      limit,
      offset,
    });

  } catch (error) {
    console.error('Error fetching items:', error);
    return NextResponse.json(
      { error: 'Failed to fetch items' },
      { status: 500 }
    );
  }
}
