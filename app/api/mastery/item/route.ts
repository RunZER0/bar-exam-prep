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
import OpenAI from 'openai';

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
    
    // Support multiple formats: written (essay), mcq, short_answer
    const requestedFormat = url.searchParams.get('format');
    const validFormats = ['written', 'mcq', 'short_answer'];
    
    // Default to random format if not specified, weighted towards written for bar prep
    const format = requestedFormat && validFormats.includes(requestedFormat) 
      ? requestedFormat 
      : Math.random() > 0.4 ? 'written' : (Math.random() > 0.5 ? 'mcq' : 'short_answer');

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
 * Generate a written exam item using AI when none exists in DB
 * Mastery Hub is WRITTEN EXAMS ONLY
 */
async function generateItemForSkill(
  skill: { id: string; name: string; unit_id: string; format_tags: string[] },
  format: string
): Promise<ItemData> {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
  
  let systemPrompt = '';
  let userPrompt = '';

  if (format === 'mcq') {
    systemPrompt = `You are a Kenya bar exam tutor. Create a challenging Multiple Choice Question (MCQ) for the given skill.
      
Format your response as JSON only:
{
  "prompt": "A short scenario or legal question text",
  "options": [
    { "label": "A", "text": "Option text", "isCorrect": false },
    { "label": "B", "text": "Option text", "isCorrect": true },
    { "label": "C", "text": "Option text", "isCorrect": false },
    { "label": "D", "text": "Option text", "isCorrect": false }
  ],
  "modelAnswer": "Explanation of why B is correct and others are wrong, citing specific sections/cases.",
  "keyPoints": ["Relevant Section/Article", "Key Case Law"]
}`;
    userPrompt = `Generate a hard MCQ for "${skill.name}" (Kenyan Law). Requires deep understanding, not just recall.`;

  } else if (format === 'short_answer') {
    systemPrompt = `You are a Kenya bar exam tutor. Create a "Short Answer" exercise (type one word or phrase).
      
Format your response as JSON only:
{
  "prompt": "Direct question asking for a specific term, doctrine, date, or procedure name.",
  "modelAnswer": "The exact term or phrase expected.",
  "keyPoints": ["Efficiency", "Accuracy"]
}`;
    userPrompt = `Generate a short-answer question for "${skill.name}". Example: "What is the limitation period for torts?" -> "3 years".`;

  } else {
    // WRITTEN / ESSAY
    systemPrompt = `You are a Kenya bar exam tutor. Create a practical reinforcement exercise (scenario-based) to test legal analysis skills.

Format your response as JSON only:
{
  "prompt": "A detailed scenario (2-3 paragraphs) followed by a specific task/instruction for the student (e.g., 'Draft a memo...', 'Advise the client...')",
  "context": "Additional factual background or instructions if needed",
  "modelAnswer": "A comprehensive model answer using IRAC structure with specific Kenyan statutory provisions and case law",
  "keyPoints": ["Key legal issue 1", "Relevant statute/section", "Key case law with citation", "Correct application principle"]
}`;
    userPrompt = `Generate a written exercise to reinforce the skill "${skill.name}" for the Kenya bar exam.

Create a realistic scenario that requires:
1. Issue identification
2. Application of Kenyan law (statutes and case law)
3. Structured legal analysis (IRAC)
4. A clear conclusion

This is a learning exercise, so ensure it tests understanding of the core principles.`;
  }

  try {
    const response = await openai.responses.create({
      model: 'gpt-5.2',
      instructions: systemPrompt,
      input: userPrompt,
    });

    const content = response.output_text || '';
    
    // Parse JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      
      return {
        id: `generated-${Date.now()}`,
        itemType: format,
        format: format,
        prompt: parsed.prompt,
        context: parsed.context || null,
        modelAnswer: parsed.modelAnswer || null,
        keyPoints: parsed.keyPoints || [],
        options: parsed.options, // For MCQs
        difficulty: 3,
        estimatedMinutes: format === 'written' ? 15 : (format === 'mcq' ? 2 : 5),
        skillId: skill.id,
        skillName: skill.name,
        unitId: skill.unit_id,
        coverageWeight: 1.0,
      };
    }
  } catch (e) {
    console.error('AI generation failed:', e);
  }

  // Fallback static items
  if (format === 'mcq') {
    return {
      id: `fallback-mcq-${Date.now()}`,
      itemType: 'mcq',
      format: 'mcq',
      prompt: `Which of the following best describes the principle of *Stare Decisis* in Kenya for ${skill.name}?`,
      options: [
        { label: "A", text: "High Court decisions bind the Court of Appeal", isCorrect: false },
        { label: "B", text: "Supreme Court decisions bind all lower courts", isCorrect: true },
        { label: "C", text: "Magistrate courts vary by county", isCorrect: false },
        { label: "D", text: "Tribunal decisions are final", isCorrect: false }
      ],
      modelAnswer: "B is correct. Under Article 163(7), Supreme Court decisions bind all other courts.",
      keyPoints: ["Article 163(7) Constitution"],
      difficulty: 2,
      estimatedMinutes: 2,
      skillId: skill.id,
      skillName: skill.name,
      unitId: skill.unit_id,
      coverageWeight: 1.0,
      context: null
    };
  } else if (format === 'short_answer') {
    return {
      id: `fallback-sa-${Date.now()}`,
      itemType: 'short_answer',
      format: 'short_answer',
      prompt: `What is the standard limitation period for a claim based on contract in Kenya?`,
      modelAnswer: `6 years`,
      keyPoints: ["Limitation of Actions Act"],
      difficulty: 1,
      estimatedMinutes: 2,
      skillId: skill.id,
      skillName: skill.name,
      unitId: skill.unit_id,
      coverageWeight: 1.0,
      context: null
    };
  }

  return {
    id: `fallback-${Date.now()}`,
    itemType: 'written',
    format: 'written',
    prompt: `Practice exercise for ${skill.name}:\n\nExplain the key legal principles governing this area under Kenyan law. Your answer should:\n\n1. Identify the relevant statutory framework\n2. Discuss leading case law and their rationale\n3. Analyze how these principles apply in practice\n4. Consider any recent developments or reforms`,
    context: null,
    modelAnswer: `Model Answer Structure:\n\n1. **Issue**: Identify the core legal issues in ${skill.name}\n\n2. **Rule**: State the relevant statutory provisions and case law principles\n\n3. **Application**: Apply these rules to practical scenarios\n\n4. **Conclusion**: Summarize the legal position and any recommendations`,
    keyPoints: [
      'Identify relevant statutory provisions',
      'Cite leading Kenyan case law',
      'Apply principles to facts',
      'Provide clear conclusions'
    ],
    difficulty: 3,
    estimatedMinutes: 15,
    skillId: skill.id,
    skillName: skill.name,
    unitId: skill.unit_id,
    coverageWeight: 1.0,
  };
}
