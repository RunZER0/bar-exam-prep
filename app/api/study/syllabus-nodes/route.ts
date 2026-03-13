/**
 * GET /api/study/syllabus-nodes
 * 
 * Returns all syllabus nodes grouped by unit_code for the study browse UI.
 * Only returns nodes that have pre-built notes available (active).
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth, type AuthUser } from '@/lib/auth/middleware';
import { neon } from '@neondatabase/serverless';

let _sql: ReturnType<typeof neon> | null = null;
function getSql() {
  if (!_sql) _sql = neon(process.env.DATABASE_URL!);
  return _sql;
}

async function handleGet(req: NextRequest, user: AuthUser) {
  try {
    const sql = getSql();

    const nodes = await sql`
      SELECT 
        sn.id,
        sn.unit_code,
        sn.topic_name,
        sn.subtopic_name,
        sn.week_number,
        sn.is_high_yield,
        sn.is_drafting_node,
        sn.section_reference,
        CASE WHEN EXISTS (
          SELECT 1 FROM prebuilt_notes pn 
          WHERE pn.node_id = sn.id AND pn.is_active = true
        ) THEN true ELSE false END as has_notes
      FROM syllabus_nodes sn
      ORDER BY sn.unit_code, sn.week_number, sn.topic_name, sn.subtopic_name
    ` as any[];

    // Group by unit_code
    const grouped: Record<string, any[]> = {};
    for (const node of nodes) {
      const unitCode = node.unit_code;
      if (!grouped[unitCode]) grouped[unitCode] = [];
      grouped[unitCode].push({
        id: node.id,
        topicName: node.topic_name,
        subtopicName: node.subtopic_name,
        weekNumber: node.week_number,
        isHighYield: node.is_high_yield,
        isDraftingNode: node.is_drafting_node,
        sectionReference: node.section_reference,
        hasNotes: node.has_notes,
      });
    }

    return NextResponse.json({ nodes: grouped, total: nodes.length });
  } catch (error: any) {
    console.error('[syllabus-nodes] Error:', error?.message || error);
    return NextResponse.json({ error: 'Failed to fetch syllabus nodes' }, { status: 500 });
  }
}

export const GET = withAuth(handleGet);
