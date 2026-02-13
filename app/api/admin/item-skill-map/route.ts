/**
 * YNAI Mastery Engine v3 - Item-Skill Mapping API
 * 
 * Per spec: "Without item → skill mapping, the system is fake."
 * 
 * This is the critical API for linking practice items to micro-skills.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { verifyIdToken } from '@/lib/firebase/admin';

// ============================================
// POST - Create item-skill mapping
// ============================================

export async function POST(req: NextRequest) {
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

    const body = await req.json();
    const { itemId, skillId, strength = 1.0 } = body;

    if (!itemId || !skillId) {
      return NextResponse.json({ error: 'itemId and skillId are required' }, { status: 400 });
    }

    // Check if mapping already exists
    const existing = await db.execute(sql`
      SELECT 1 FROM item_skill_map 
      WHERE item_id = ${itemId} AND skill_id = ${skillId}
    `);

    if (existing.rows.length > 0) {
      // Update existing mapping
      await db.execute(sql`
        UPDATE item_skill_map 
        SET strength = ${strength}, updated_at = NOW()
        WHERE item_id = ${itemId} AND skill_id = ${skillId}
      `);
      return NextResponse.json({ success: true, action: 'updated' });
    }

    // Create new mapping
    await db.execute(sql`
      INSERT INTO item_skill_map (item_id, skill_id, strength, coverage_weight)
      VALUES (${itemId}, ${skillId}, ${strength}, 1.0)
    `);

    return NextResponse.json({ success: true, action: 'created' });

  } catch (error) {
    console.error('Error creating item-skill mapping:', error);
    return NextResponse.json(
      { error: 'Failed to create mapping' },
      { status: 500 }
    );
  }
}

// ============================================
// DELETE - Remove item-skill mapping
// ============================================

export async function DELETE(req: NextRequest) {
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

    const body = await req.json();
    const { itemId, skillId } = body;

    if (!itemId || !skillId) {
      return NextResponse.json({ error: 'itemId and skillId are required' }, { status: 400 });
    }

    await db.execute(sql`
      DELETE FROM item_skill_map 
      WHERE item_id = ${itemId} AND skill_id = ${skillId}
    `);

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Error deleting item-skill mapping:', error);
    return NextResponse.json(
      { error: 'Failed to delete mapping' },
      { status: 500 }
    );
  }
}

// ============================================
// GET - List all mappings for an item or skill
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
    const itemId = url.searchParams.get('itemId');
    const skillId = url.searchParams.get('skillId');

    if (itemId) {
      // Get all skills for an item
      const mappings = await db.execute(sql`
        SELECT 
          ism.skill_id,
          ism.strength,
          ms.name as skill_name,
          ms.code as skill_code
        FROM item_skill_map ism
        JOIN micro_skills ms ON ms.id = ism.skill_id
        WHERE ism.item_id = ${itemId}
      `);
      return NextResponse.json({ mappings: mappings.rows });
    }

    if (skillId) {
      // Get all items for a skill
      const mappings = await db.execute(sql`
        SELECT 
          ism.item_id,
          ism.strength,
          i.prompt,
          i.item_type
        FROM item_skill_map ism
        JOIN items i ON i.id = ism.item_id
        WHERE ism.skill_id = ${skillId}
      `);
      return NextResponse.json({ mappings: mappings.rows });
    }

    // Get all mappings with counts
    const stats = await db.execute(sql`
      SELECT 
        (SELECT COUNT(DISTINCT item_id) FROM item_skill_map) as mapped_items,
        (SELECT COUNT(*) FROM items WHERE is_active = true) as total_items,
        (SELECT COUNT(*) FROM micro_skills WHERE is_active = true) as total_skills,
        (SELECT COUNT(*) FROM item_skill_map) as total_mappings
    `);

    return NextResponse.json({ stats: stats.rows[0] });

  } catch (error) {
    console.error('Error getting item-skill mappings:', error);
    return NextResponse.json(
      { error: 'Failed to get mappings' },
      { status: 500 }
    );
  }
}
