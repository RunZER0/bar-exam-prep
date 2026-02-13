/**
 * YNAI Mastery Engine v3 - Admin Skill Management API
 * 
 * Per spec: "Without item → skill mapping, the system is fake."
 * 
 * This API provides admin tools for:
 * - Managing micro-skills (CRUD)
 * - Tagging items with skills
 * - Managing error tags
 * - Viewing/adjusting exam weights
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { verifyIdToken } from '@/lib/firebase/admin';

// ============================================
// TYPES
// ============================================

interface MicroSkill {
  id: string;
  name: string;
  domainId: string;
  unitId: string;
  formatTags: string[];
  examWeight: number;
  difficulty: 'foundation' | 'core' | 'advanced';
  description?: string;
  prerequisites: string[];
  authorityIds: string[];
}

interface ItemSkillMapping {
  itemId: string;
  skillId: string;
  strength: 'primary' | 'secondary';
  rubricDimensions?: string[];
}

interface ErrorTag {
  code: string;
  name: string;
  description: string;
  severity: 'minor' | 'moderate' | 'major';
  relatedSkills: string[];
}

// ============================================
// GET - List skills and mappings
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
    const action = url.searchParams.get('action');
    const unitId = url.searchParams.get('unitId');
    const skillId = url.searchParams.get('skillId');

    switch (action) {
      case 'skills':
        return NextResponse.json(await getSkills(unitId));
      
      case 'mappings':
        return NextResponse.json(await getItemMappings(skillId));
      
      case 'errorTags':
        return NextResponse.json(await getErrorTags());
      
      case 'unmapped':
        return NextResponse.json(await getUnmappedItems(unitId));
      
      default:
        return NextResponse.json(await getOverview());
    }

  } catch (error) {
    console.error('Error in admin skills API:', error);
    return NextResponse.json(
      { error: 'Failed to fetch data' },
      { status: 500 }
    );
  }
}

// ============================================
// POST - Create skills, mappings, tags
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
    const { action } = body;

    switch (action) {
      case 'createSkill':
        return NextResponse.json(await createSkill(body.skill));
      
      case 'mapItem':
        return NextResponse.json(await mapItemToSkill(body.mapping));
      
      case 'bulkMap':
        return NextResponse.json(await bulkMapItems(body.mappings));
      
      case 'createErrorTag':
        return NextResponse.json(await createErrorTag(body.errorTag));
      
      case 'autoTag':
        return NextResponse.json(await autoTagItems(body.unitId));
      
      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }

  } catch (error) {
    console.error('Error in admin skills API:', error);
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    );
  }
}

// ============================================
// PATCH - Update skills, mappings
// ============================================

export async function PATCH(req: NextRequest) {
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
    const { action } = body;

    switch (action) {
      case 'updateSkill':
        return NextResponse.json(await updateSkill(body.skillId, body.updates));
      
      case 'updateMapping':
        return NextResponse.json(await updateMapping(body.itemId, body.skillId, body.updates));
      
      case 'updateWeights':
        return NextResponse.json(await updateExamWeights(body.weights));
      
      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }

  } catch (error) {
    console.error('Error in admin skills API:', error);
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    );
  }
}

// ============================================
// DELETE - Remove skills, mappings
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

    const url = new URL(req.url);
    const action = url.searchParams.get('action');
    const skillId = url.searchParams.get('skillId');
    const itemId = url.searchParams.get('itemId');

    switch (action) {
      case 'skill':
        return NextResponse.json(await deleteSkill(skillId!));
      
      case 'mapping':
        return NextResponse.json(await deleteMapping(itemId!, skillId!));
      
      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }

  } catch (error) {
    console.error('Error in admin skills API:', error);
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    );
  }
}

// ============================================
// IMPLEMENTATION FUNCTIONS
// ============================================

async function getOverview() {
  // TODO: Query actual data from database
  return {
    totalSkills: 72,
    mappedItems: 450,
    unmappedItems: 23,
    errorTags: 15,
    unitBreakdown: [
      { unitId: 'atp-100', unitName: 'Civil Procedure', skills: 12, mappedItems: 85, unmappedItems: 3 },
      { unitId: 'atp-101', unitName: 'Criminal Litigation', skills: 10, mappedItems: 72, unmappedItems: 5 },
      { unitId: 'atp-201', unitName: 'Trial Advocacy', skills: 8, mappedItems: 45, unmappedItems: 8 },
      { unitId: 'atp-102', unitName: 'Professional Conduct', skills: 6, mappedItems: 38, unmappedItems: 2 },
    ],
    coverageReport: {
      skillsWithItems: 68,
      skillsWithoutItems: 4,
      averageItemsPerSkill: 6.6,
    },
  };
}

async function getSkills(unitId: string | null) {
  // TODO: Query from micro_skills table
  const demoSkills: MicroSkill[] = [
    {
      id: 'skill-001',
      name: 'Civil Procedure Issue Spotting',
      domainId: 'civil-proc',
      unitId: 'atp-100',
      formatTags: ['written', 'oral'],
      examWeight: 0.08,
      difficulty: 'core',
      description: 'Identify all procedural issues in a civil matter scenario',
      prerequisites: [],
      authorityIds: ['cpc-1908', 'civil-procedure-rules'],
    },
    {
      id: 'skill-002',
      name: 'Pleading Drafting',
      domainId: 'civil-proc',
      unitId: 'atp-100',
      formatTags: ['drafting'],
      examWeight: 0.06,
      difficulty: 'core',
      description: 'Draft proper civil pleadings with correct format and content',
      prerequisites: ['skill-001'],
      authorityIds: ['cpc-1908'],
    },
    {
      id: 'skill-003',
      name: 'Criminal Bail Application',
      domainId: 'criminal',
      unitId: 'atp-101',
      formatTags: ['drafting', 'oral'],
      examWeight: 0.05,
      difficulty: 'foundation',
      description: 'Prepare and present bail applications',
      prerequisites: [],
      authorityIds: ['cpc-chapter-29', 'bail-bond-act'],
    },
  ];
  
  if (unitId) {
    return demoSkills.filter(s => s.unitId === unitId);
  }
  return demoSkills;
}

async function getItemMappings(skillId: string | null) {
  // TODO: Query from item_skill_map table
  return {
    skillId,
    mappings: [
      { itemId: 'item-001', itemTitle: 'Civil Procedure MCQ 1', strength: 'primary', rubricDimensions: ['issue_spotting', 'rule_recall'] },
      { itemId: 'item-002', itemTitle: 'Civil Procedure Written 1', strength: 'primary', rubricDimensions: ['issue_spotting', 'application'] },
      { itemId: 'item-003', itemTitle: 'Evidence ACT MCQ 3', strength: 'secondary', rubricDimensions: ['rule_recall'] },
    ],
  };
}

async function getErrorTags() {
  // TODO: Query from error_tags table
  return [
    { code: 'MISSED_ISSUE', name: 'Missed Issue', description: 'Failed to identify a key legal issue', severity: 'major', relatedSkills: ['skill-001'] },
    { code: 'WRONG_RULE', name: 'Wrong Rule', description: 'Applied incorrect legal rule', severity: 'major', relatedSkills: [] },
    { code: 'WEAK_CITATION', name: 'Weak Citation', description: 'Missing or incorrect legal citation', severity: 'moderate', relatedSkills: [] },
    { code: 'POOR_APPLICATION', name: 'Poor Application', description: 'Weak application of law to facts', severity: 'moderate', relatedSkills: [] },
    { code: 'FORMAT_ERROR', name: 'Format Error', description: 'Document format issues', severity: 'minor', relatedSkills: ['skill-002'] },
    { code: 'STRUCTURE', name: 'Structure Issues', description: 'Poor argument or document structure', severity: 'minor', relatedSkills: [] },
  ];
}

async function getUnmappedItems(unitId: string | null) {
  // TODO: Query items without skill mappings
  return {
    unitId,
    items: [
      { itemId: 'item-unm-001', title: 'New Evidence Law MCQ', type: 'mcq', createdAt: '2024-01-15' },
      { itemId: 'item-unm-002', title: 'Contract Formation Drafting', type: 'drafting', createdAt: '2024-01-14' },
      { itemId: 'item-unm-003', title: 'Criminal Procedure Written', type: 'written', createdAt: '2024-01-13' },
    ],
    total: 23,
    byUnit: {
      'atp-100': 3,
      'atp-101': 5,
      'atp-201': 8,
      'atp-102': 2,
      'other': 5,
    },
  };
}

async function createSkill(skill: Partial<MicroSkill>) {
  // TODO: Insert into micro_skills table
  const newSkill: MicroSkill = {
    id: `skill-${Date.now()}`,
    name: skill.name || 'New Skill',
    domainId: skill.domainId || 'general',
    unitId: skill.unitId || 'atp-100',
    formatTags: skill.formatTags || ['written'],
    examWeight: skill.examWeight || 0.05,
    difficulty: skill.difficulty || 'core',
    description: skill.description,
    prerequisites: skill.prerequisites || [],
    authorityIds: skill.authorityIds || [],
  };
  
  console.log('[Admin] Created skill:', newSkill);
  return { success: true, skill: newSkill };
}

async function mapItemToSkill(mapping: ItemSkillMapping) {
  // TODO: Insert into item_skill_map table
  console.log('[Admin] Mapped item to skill:', mapping);
  return { success: true, mapping };
}

async function bulkMapItems(mappings: ItemSkillMapping[]) {
  // TODO: Bulk insert into item_skill_map table
  console.log('[Admin] Bulk mapped', mappings.length, 'items');
  return { success: true, count: mappings.length };
}

async function createErrorTag(errorTag: ErrorTag) {
  // TODO: Insert into error_tags table
  console.log('[Admin] Created error tag:', errorTag);
  return { success: true, errorTag };
}

async function autoTagItems(unitId: string) {
  // TODO: Use AI to suggest skill mappings for unmapped items
  // This would:
  // 1. Fetch unmapped items for the unit
  // 2. Send item content to AI for skill identification
  // 3. Return suggested mappings for admin review
  
  console.log('[Admin] Auto-tagging items for unit:', unitId);
  return {
    success: true,
    suggestions: [
      { itemId: 'item-unm-001', suggestedSkillId: 'skill-001', confidence: 0.85, reasoning: 'Contains civil procedure terminology' },
      { itemId: 'item-unm-002', suggestedSkillId: 'skill-002', confidence: 0.72, reasoning: 'Drafting exercise for pleadings' },
    ],
    needsReview: 2,
  };
}

async function updateSkill(skillId: string, updates: Partial<MicroSkill>) {
  // TODO: Update micro_skills table
  console.log('[Admin] Updated skill:', skillId, updates);
  return { success: true, skillId };
}

async function updateMapping(itemId: string, skillId: string, updates: Partial<ItemSkillMapping>) {
  // TODO: Update item_skill_map table
  console.log('[Admin] Updated mapping:', itemId, skillId, updates);
  return { success: true, itemId, skillId };
}

async function updateExamWeights(weights: { skillId: string; examWeight: number }[]) {
  // TODO: Bulk update exam weights
  // Validate: sum of weights should be reasonable
  const totalWeight = weights.reduce((sum, w) => sum + w.examWeight, 0);
  if (totalWeight > 1.5) {
    return { success: false, error: 'Total exam weight exceeds 150%' };
  }
  
  console.log('[Admin] Updated exam weights for', weights.length, 'skills');
  return { success: true, count: weights.length, totalWeight };
}

async function deleteSkill(skillId: string) {
  // TODO: Soft delete from micro_skills table
  // Also remove related mappings
  console.log('[Admin] Deleted skill:', skillId);
  return { success: true, skillId };
}

async function deleteMapping(itemId: string, skillId: string) {
  // TODO: Delete from item_skill_map table
  console.log('[Admin] Deleted mapping:', itemId, skillId);
  return { success: true, itemId, skillId };
}
