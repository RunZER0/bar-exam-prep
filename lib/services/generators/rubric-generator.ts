/**
 * Rubric Generator
 * 
 * Generates grading rubrics aligned with practice set content.
 */

import OpenAI from 'openai';
import { GROUNDING_RULES } from '@/lib/constants/source-governance';
import type { Citation, ContentItem } from './grounding-validator';
import type { PassageWithAuthority } from './written-generators';

// ============================================
// TYPES
// ============================================

export interface RubricContext {
  skillName: string;
  practiceSetItems: ContentItem[];
  passages: PassageWithAuthority[];
  activityTypes: string[];
}

export interface RubricCriterion {
  name: string;
  weight: number;
  description: string;
  maxPoints: number;
  fullMarksDescription: string;
  citations: Citation[];
}

export interface GeneratedRubric {
  items: ContentItem[];
  criteria: RubricCriterion[];
  evidenceSpanIds: string[];
}

// ============================================
// CONFIG
// ============================================

const MODEL_CONFIG = {
  generatorModel: process.env.GENERATOR_MODEL || 'gpt-4o-mini',
};

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Helper function using OpenAI Responses API
async function callOpenAI(systemPrompt: string, userPrompt: string): Promise<string> {
  const response = await openai.responses.create({
    model: MODEL_CONFIG.generatorModel,
    instructions: systemPrompt,
    input: userPrompt,
  });
  return response.output_text || '';
}

// ============================================
// MAIN GENERATOR
// ============================================

export async function generateRubric(
  context: RubricContext
): Promise<GeneratedRubric> {
  const { skillName, practiceSetItems, passages, activityTypes } = context;

  if (passages.length === 0) {
    return createFallbackRubric(skillName);
  }

  // Determine rubric structure based on activity types
  const hasEssay = activityTypes.some(t => 
    ['ESSAY_OUTLINE', 'FULL_ESSAY', 'PAST_PAPER_STYLE'].includes(t)
  );
  const hasQuiz = activityTypes.includes('WRITTEN_QUIZ');
  const hasIssueSpotter = activityTypes.includes('ISSUE_SPOTTER');

  let criteria: RubricCriterion[] = [];

  if (hasEssay || hasIssueSpotter) {
    criteria = await generateEssayRubric(skillName, passages);
  } else if (hasQuiz) {
    criteria = await generateQuizRubric(skillName, passages, practiceSetItems);
  } else {
    criteria = await generateGeneralRubric(skillName, passages);
  }

  const items: ContentItem[] = [];
  const evidenceSpanIds: string[] = [];

  // Convert criteria to items with citations
  for (let i = 0; i < criteria.length; i++) {
    const passage = passages[i % passages.length];

    items.push({
      type: 'RUBRIC_CRITERION',
      content: `**${criteria[i].name}** (${criteria[i].maxPoints} points)\n\n${criteria[i].description}`,
      answer: criteria[i].fullMarksDescription,
      citations: criteria[i].citations.length > 0 ? criteria[i].citations : [{
        authority_id: passage.authorityId,
        url: passage.url,
        locator_json: passage.locator,
        passage_id: passage.passageId,
      }],
      evidence_span_ids: [passage.passageId],
    });

    evidenceSpanIds.push(passage.passageId);
  }

  // Add summary item
  const totalPoints = criteria.reduce((sum, c) => sum + c.maxPoints, 0);
  items.push({
    type: 'RUBRIC_SUMMARY',
    content: `**Total: ${totalPoints} points**\n\nPassing: ${Math.round(totalPoints * 0.5)} points (50%)`,
    is_instruction_only: true,
    citations: [],
  });

  return {
    items,
    criteria,
    evidenceSpanIds,
  };
}

// ============================================
// ESSAY RUBRIC
// ============================================

async function generateEssayRubric(
  skillName: string,
  passages: PassageWithAuthority[]
): Promise<RubricCriterion[]> {
  try {
    const passageContext = passages.slice(0, 5).map(p => ({
      text: p.text.substring(0, 300),
      citation: p.citation,
      sourceType: p.sourceType,
    }));

    const systemPrompt = `Generate a grading rubric for essay/problem questions on ${skillName}.
Include 4-6 criteria covering:
- Issue identification
- Rule statement (correctly citing authorities)
- Application of law to facts
- Analysis quality
- Conclusion
- Writing/structure

Return JSON:
{
  "criteria": [
    {
      "name": "Issue Identification",
      "weight": 15,
      "description": "Correctly identifies all relevant legal issues",
      "maxPoints": 15,
      "fullMarksDescription": "All issues identified with clear framing"
    }
  ]
}`;

    const content = await callOpenAI(
      systemPrompt,
      `Generate rubric for ${skillName} essay. Relevant authorities:\n\n${JSON.stringify(passageContext)}`
    );
    if (!content) return getDefaultEssayCriteria();

    const parsed = JSON.parse(content);
    return (parsed.criteria || []).map((c: any, i: number) => ({
      name: c.name || `Criterion ${i + 1}`,
      weight: c.weight || 20,
      description: c.description || '',
      maxPoints: c.maxPoints || c.weight || 20,
      fullMarksDescription: c.fullMarksDescription || '',
      citations: [],
    }));
  } catch (err) {
    console.error('[rubric-generator] Essay rubric generation failed:', err);
    return getDefaultEssayCriteria();
  }
}

function getDefaultEssayCriteria(): RubricCriterion[] {
  return [
    {
      name: 'Issue Identification',
      weight: 15,
      description: 'Correctly identifies all relevant legal issues',
      maxPoints: 15,
      fullMarksDescription: 'All issues identified with clear framing. No significant issues missed.',
      citations: [],
    },
    {
      name: 'Rule Statement',
      weight: 30,
      description: 'Accurately states applicable legal rules with proper citations',
      maxPoints: 30,
      fullMarksDescription: 'Rules stated accurately with correct citations to statutes and cases.',
      citations: [],
    },
    {
      name: 'Application',
      weight: 30,
      description: 'Applies legal rules to the facts methodically',
      maxPoints: 30,
      fullMarksDescription: 'Each rule element applied to specific facts. Counter-arguments addressed.',
      citations: [],
    },
    {
      name: 'Analysis Quality',
      weight: 15,
      description: 'Demonstrates depth of legal reasoning',
      maxPoints: 15,
      fullMarksDescription: 'Nuanced analysis showing understanding of legal principles.',
      citations: [],
    },
    {
      name: 'Structure & Writing',
      weight: 10,
      description: 'Clear organization and professional writing',
      maxPoints: 10,
      fullMarksDescription: 'Logical structure, clear paragraphs, minimal errors.',
      citations: [],
    },
  ];
}

// ============================================
// QUIZ RUBRIC
// ============================================

async function generateQuizRubric(
  skillName: string,
  passages: PassageWithAuthority[],
  quizItems: ContentItem[]
): Promise<RubricCriterion[]> {
  const totalQuestions = quizItems.filter(i => 
    ['MULTIPLE_CHOICE', 'SHORT_ANSWER'].includes(i.type)
  ).length;

  if (totalQuestions === 0) {
    return generateGeneralRubric(skillName, passages);
  }

  const pointsPerQuestion = Math.round(100 / totalQuestions);

  const criteria: RubricCriterion[] = [];

  for (let i = 0; i < Math.min(totalQuestions, 10); i++) {
    const item = quizItems[i];
    const passage = passages[i % passages.length];

    criteria.push({
      name: `Question ${i + 1}`,
      weight: pointsPerQuestion,
      description: item.question?.substring(0, 100) || `Quiz question ${i + 1}`,
      maxPoints: pointsPerQuestion,
      fullMarksDescription: item.answer || 'Correct answer provided',
      citations: item.citations || [],
    });
  }

  return criteria;
}

// ============================================
// GENERAL RUBRIC
// ============================================

async function generateGeneralRubric(
  skillName: string,
  passages: PassageWithAuthority[]
): Promise<RubricCriterion[]> {
  try {
    const passageContext = passages.slice(0, 3).map(p => ({
      text: p.text.substring(0, 300),
      citation: p.citation,
    }));

    const systemPrompt = `Generate a grading rubric for ${skillName} assessment.
Include 4-5 criteria appropriate for mixed question types.

Return JSON:
{
  "criteria": [
    {
      "name": "Knowledge",
      "weight": 25,
      "description": "Demonstrates understanding of key concepts",
      "maxPoints": 25,
      "fullMarksDescription": "All key concepts correctly identified"
    }
  ]
}`;

    const content = await callOpenAI(
      systemPrompt,
      `Generate rubric for ${skillName}. Sources:\n\n${JSON.stringify(passageContext)}`
    );
    if (!content) return getDefaultGeneralCriteria();

    const parsed = JSON.parse(content);
    return (parsed.criteria || []).map((c: any, i: number) => ({
      name: c.name || `Criterion ${i + 1}`,
      weight: c.weight || 25,
      description: c.description || '',
      maxPoints: c.maxPoints || c.weight || 25,
      fullMarksDescription: c.fullMarksDescription || '',
      citations: [],
    }));
  } catch (err) {
    console.error('[rubric-generator] General rubric generation failed:', err);
    return getDefaultGeneralCriteria();
  }
}

function getDefaultGeneralCriteria(): RubricCriterion[] {
  return [
    {
      name: 'Knowledge & Recall',
      weight: 25,
      description: 'Demonstrates understanding of key legal concepts',
      maxPoints: 25,
      fullMarksDescription: 'All key concepts correctly identified and explained',
      citations: [],
    },
    {
      name: 'Legal Authority',
      weight: 30,
      description: 'Cites relevant statutes and case law',
      maxPoints: 30,
      fullMarksDescription: 'Accurate citations with correct details',
      citations: [],
    },
    {
      name: 'Analysis',
      weight: 25,
      description: 'Applies legal principles to questions',
      maxPoints: 25,
      fullMarksDescription: 'Systematic application of rules',
      citations: [],
    },
    {
      name: 'Accuracy',
      weight: 20,
      description: 'Correct answers and reasoning',
      maxPoints: 20,
      fullMarksDescription: 'All answers correct with sound reasoning',
      citations: [],
    },
  ];
}

// ============================================
// FALLBACK
// ============================================

function createFallbackRubric(skillName: string): GeneratedRubric {
  return {
    items: [{
      type: 'RUBRIC_FALLBACK',
      content: `# Rubric for ${skillName}\n\n${GROUNDING_RULES.fallbackMessage}`,
      explanation: 'Please refer to your ATP materials for grading criteria.',
      citations: [],
    }],
    criteria: [],
    evidenceSpanIds: [],
  };
}

// ============================================
// EXPORTS
// ============================================

export default {
  generateRubric,
};
