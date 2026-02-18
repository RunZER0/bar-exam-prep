/**
 * GET /api/mastery/item
 * 
 * Fetch an item for practice. If no item exists for the skill,
 * generate one on-the-fly using AI.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { eq, sql } from 'drizzle-orm';
import { verifyIdToken } from '@/lib/firebase/admin';
import Anthropic from '@anthropic-ai/sdk';

interface ItemData {
  id: string;
  itemType: string;
  format: string;
  prompt: string;
  context: string | null;
  modelAnswer: string | null;
  keyPoints: string[];
  options?: { label: string; text: string; isCorrect: boolean }[];
  difficulty: number;
  estimatedMinutes: number;
  skillId: string;
  skillName: string;
  unitId: string;
  coverageWeight: number;
}

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

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const url = new URL(req.url);
    const skillId = url.searchParams.get('skillId');
    const format = url.searchParams.get('format') || 'written';
    const itemId = url.searchParams.get('itemId'); // If we already have an item ID

    if (!skillId) {
      return NextResponse.json({ error: 'skillId required' }, { status: 400 });
    }

    // Fetch skill info
    const skillResult = await db.execute(sql`
      SELECT id, name, unit_id, exam_weight, difficulty, format_tags
      FROM micro_skills
      WHERE id = ${skillId}::uuid
    `);
    
    const skill = skillResult.rows[0] as { 
      id: string; 
      name: string; 
      unit_id: string;
      exam_weight: string;
      difficulty: string;
      format_tags: string[];
    } | undefined;
    
    if (!skill) {
      return NextResponse.json({ error: 'Skill not found' }, { status: 404 });
    }

    // Try to fetch an existing item
    let itemResult;
    if (itemId) {
      itemResult = await db.execute(sql`
        SELECT 
          i.id,
          i.item_type,
          i.format,
          i.prompt,
          i.context,
          i.model_answer,
          i.key_points,
          i.difficulty,
          i.estimated_minutes,
          ism.coverage_weight
        FROM items i
        JOIN item_skill_map ism ON i.id = ism.item_id
        WHERE i.id = ${itemId}::uuid
          AND ism.skill_id = ${skillId}::uuid
          AND i.is_active = true
        LIMIT 1
      `);
    } else {
      // Find an item for this skill and format
      itemResult = await db.execute(sql`
        SELECT 
          i.id,
          i.item_type,
          i.format,
          i.prompt,
          i.context,
          i.model_answer,
          i.key_points,
          i.difficulty,
          i.estimated_minutes,
          ism.coverage_weight
        FROM items i
        JOIN item_skill_map ism ON i.id = ism.item_id
        WHERE ism.skill_id = ${skillId}::uuid
          AND i.is_active = true
          AND (i.format = ${format} OR i.item_type = ${format})
        ORDER BY RANDOM()
        LIMIT 1
      `);
    }

    const existingItem = itemResult.rows[0] as {
      id: string;
      item_type: string;
      format: string;
      prompt: string;
      context: string | null;
      model_answer: string | null;
      key_points: string[];
      difficulty: number;
      estimated_minutes: number;
      coverage_weight: string;
    } | undefined;

    if (existingItem) {
      // Parse MCQ options from prompt if needed
      let options: { label: string; text: string; isCorrect: boolean }[] | undefined;
      
      if (existingItem.item_type === 'mcq' || existingItem.format === 'mcq') {
        options = parseMcqOptions(existingItem.prompt);
      }

      const item: ItemData = {
        id: existingItem.id,
        itemType: existingItem.item_type,
        format: existingItem.format,
        prompt: existingItem.prompt,
        context: existingItem.context,
        modelAnswer: existingItem.model_answer,
        keyPoints: existingItem.key_points || [],
        options,
        difficulty: existingItem.difficulty,
        estimatedMinutes: existingItem.estimated_minutes,
        skillId: skill.id,
        skillName: skill.name,
        unitId: skill.unit_id,
        coverageWeight: parseFloat(existingItem.coverage_weight) || 1.0,
      };

      return NextResponse.json({ item, source: 'database' });
    }

    // No item found - generate one using AI
    const generatedItem = await generateItemForSkill(skill, format);
    
    return NextResponse.json({ item: generatedItem, source: 'generated' });

  } catch (error) {
    console.error('Error fetching item:', error);
    return NextResponse.json(
      { error: 'Failed to fetch item' },
      { status: 500 }
    );
  }
}

/**
 * Parse MCQ options from a prompt string
 */
function parseMcqOptions(prompt: string): { label: string; text: string; isCorrect: boolean }[] {
  const options: { label: string; text: string; isCorrect: boolean }[] = [];
  
  // Look for patterns like A) text, B) text, etc.
  const optionMatches = prompt.matchAll(/([A-D])[).]\s*([^\n]+)/g);
  
  for (const match of optionMatches) {
    options.push({
      label: match[1],
      text: match[2].trim(),
      isCorrect: false, // Will be updated if we find CORRECT marker
    });
  }
  
  // Look for correct answer marker
  const correctMatch = prompt.match(/CORRECT:\s*([A-D])/i);
  if (correctMatch) {
    const correctLabel = correctMatch[1].toUpperCase();
    const option = options.find(o => o.label === correctLabel);
    if (option) option.isCorrect = true;
  } else if (options.length > 0) {
    // Default first option as correct if not specified (shouldn't happen)
    options[0].isCorrect = true;
  }
  
  return options;
}

/**
 * Generate an item using AI when none exists in DB
 */
async function generateItemForSkill(
  skill: { id: string; name: string; unit_id: string; format_tags: string[] },
  format: string
): Promise<ItemData> {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
  
  const formatPrompts: Record<string, string> = {
    mcq: `Generate a challenging multiple choice question to test the skill "${skill.name}" for the Kenya bar exam.

Format your response as JSON:
{
  "prompt": "The full question text",
  "options": [
    {"label": "A", "text": "Option A text", "isCorrect": false},
    {"label": "B", "text": "Option B text", "isCorrect": false},
    {"label": "C", "text": "Option C text", "isCorrect": true},
    {"label": "D", "text": "Option D text", "isCorrect": false}
  ],
  "modelAnswer": "Explanation of why C is correct",
  "keyPoints": ["Key point 1", "Key point 2"]
}`,
    
    written: `Generate a written exam question to test the skill "${skill.name}" for the Kenya bar exam.

Format your response as JSON:
{
  "prompt": "A scenario-based question requiring legal analysis",
  "context": "Additional factual background if needed",
  "modelAnswer": "A comprehensive model answer with IRAC structure",
  "keyPoints": ["Key legal issue 1", "Relevant statute", "Key case law", "Correct application"]
}`,
    
    oral: `Generate an oral examination question to test the skill "${skill.name}" for the Kenya bar exam.

Format your response as JSON:
{
  "prompt": "A question an examiner would ask in oral examination",
  "context": "Optional scenario or facts",
  "modelAnswer": "Key points to cover in oral response",
  "keyPoints": ["Point 1", "Point 2", "Point 3"]
}`,
    
    drafting: `Generate a legal drafting exercise to test the skill "${skill.name}" for the Kenya bar exam.

Format your response as JSON:
{
  "prompt": "Instructions for what legal document to draft",
  "context": "Factual scenario with party details, amounts, dates etc.",
  "modelAnswer": "A model draft of the required document",
  "keyPoints": ["Essential clause 1", "Essential clause 2", "Required formalities"]
}`,
  };

  const systemPrompt = formatPrompts[format] || formatPrompts.written;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      messages: [
        {
          role: 'user',
          content: systemPrompt,
        },
      ],
    });

    const content = response.content[0].type === 'text' 
      ? response.content[0].text 
      : '';
    
    // Parse JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      
      return {
        id: `generated-${Date.now()}`,
        itemType: format,
        format,
        prompt: parsed.prompt,
        context: parsed.context || null,
        modelAnswer: parsed.modelAnswer || null,
        keyPoints: parsed.keyPoints || [],
        options: parsed.options,
        difficulty: 3,
        estimatedMinutes: format === 'mcq' ? 3 : format === 'drafting' ? 20 : 10,
        skillId: skill.id,
        skillName: skill.name,
        unitId: skill.unit_id,
        coverageWeight: 1.0,
      };
    }
  } catch (e) {
    console.error('AI generation failed:', e);
  }

  // Fallback static item
  return {
    id: `fallback-${Date.now()}`,
    itemType: format,
    format,
    prompt: `Practice question for ${skill.name}: Explain the key legal principles and their application under Kenyan law.`,
    context: null,
    modelAnswer: `Key points to address:\n1. Relevant statutory framework\n2. Key case law\n3. Practical application`,
    keyPoints: ['Identify legal principles', 'Cite relevant authorities', 'Apply to facts'],
    difficulty: 3,
    estimatedMinutes: 10,
    skillId: skill.id,
    skillName: skill.name,
    unitId: skill.unit_id,
    coverageWeight: 1.0,
  };
}
