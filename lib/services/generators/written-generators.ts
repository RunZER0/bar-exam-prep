/**
 * Written Activity Generators
 * 
 * Activity-specific content generators for written exam mode.
 * Each generator produces properly grounded content with citations.
 */

import OpenAI from 'openai';
import { db } from '@/lib/db';
import { authorityRecords, authorityPassages, evidenceSpans } from '@/lib/db/schema';
import { eq, inArray } from 'drizzle-orm';
import { GROUNDING_RULES, canQuoteVerbatim } from '@/lib/constants/source-governance';
import type { Citation, ContentItem } from './grounding-validator';
import type { AuthorityResult } from '../authority-retrieval-service';
import type { StudyActivityType, ActivityMixItem } from './session-blueprint';

// ============================================
// TYPES
// ============================================

export interface GeneratorContext {
  skillId: string;
  skillName: string;
  skillDescription?: string;
  authorities: AuthorityResult[];
  passages: PassageWithAuthority[];
  phase: 'distant' | 'approaching' | 'critical';
  difficulty?: 'easy' | 'medium' | 'hard';
  count: number;
}

export interface PassageWithAuthority {
  passageId: string;
  authorityId: string;
  text: string;
  locator: Record<string, any>;
  url: string;
  citation: string;
  verbatimAllowed: boolean;
  sourceType: string;
  title: string;
}

export interface GeneratedItems {
  items: ContentItem[];
  activityType: StudyActivityType;
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

// ============================================
// MAIN ENTRY POINT
// ============================================

export async function generateActivityItems(
  activityType: StudyActivityType,
  context: GeneratorContext
): Promise<GeneratedItems> {
  switch (activityType) {
    case 'READING_NOTES':
      return generateReadingNotes(context);
    case 'MEMORY_CHECK':
      return generateMemoryCheck(context);
    case 'FLASHCARDS':
      return generateFlashcards(context);
    case 'WRITTEN_QUIZ':
      return generateWrittenQuiz(context);
    case 'ISSUE_SPOTTER':
      return generateIssueSpotter(context);
    case 'RULE_ELEMENTS_DRILL':
      return generateRuleElementsDrill(context);
    case 'ESSAY_OUTLINE':
      return generateEssayOutline(context);
    case 'ERROR_CORRECTION':
      return generateErrorCorrection(context);
    case 'PAST_PAPER_STYLE':
      return generatePastPaperStyle(context);
    case 'MIXED_REVIEW':
      return generateMixedReview(context);
    default:
      // Fallback
      return {
        items: [{
          type: activityType,
          content: GROUNDING_RULES.fallbackMessage,
          citations: [],
          is_instruction_only: false,
        }],
        activityType,
        evidenceSpanIds: [],
      };
  }
}

// ============================================
// READING_NOTES GENERATOR
// ============================================

async function generateReadingNotes(
  context: GeneratorContext
): Promise<GeneratedItems> {
  const { skillName, passages, authorities } = context;

  if (passages.length === 0) {
    return createFallbackResponse('READING_NOTES', skillName);
  }

  // Group passages by source type
  const statutePassages = passages.filter(p => p.sourceType === 'STATUTE');
  const casePassages = passages.filter(p => p.sourceType === 'CASE');
  const otherPassages = passages.filter(p => !['STATUTE', 'CASE'].includes(p.sourceType));

  const items: ContentItem[] = [];
  const evidenceSpanIds: string[] = [];

  // Build sections with proper citations
  const sections = [
    { heading: 'Key Concepts', passages: passages.slice(0, 2) },
    { heading: 'Statutory Framework', passages: statutePassages.slice(0, 2) },
    { heading: 'Case Law', passages: casePassages.slice(0, 3) },
    { heading: 'Practical Application', passages: otherPassages.slice(0, 2) },
  ];

  for (const section of sections) {
    if (section.passages.length === 0 && section.heading !== 'Key Concepts') {
      // Skip empty sections except Key Concepts
      continue;
    }

    const sectionContent = section.passages.length > 0
      ? await buildNotesSection(section.heading, section.passages, skillName)
      : {
          content: GROUNDING_RULES.fallbackMessage,
          citations: [],
        };

    items.push({
      type: 'SECTION',
      content: `## ${section.heading}\n\n${sectionContent.content}`,
      citations: sectionContent.citations,
      evidence_span_ids: section.passages.map(p => p.passageId),
    });

    evidenceSpanIds.push(...section.passages.map(p => p.passageId));
  }

  // Add exam tip if we have good coverage
  if (passages.length >= 3) {
    items.push({
      type: 'EXAM_TIP',
      content: '### Strategy\n\nWhen addressing this topic in the exam, ensure you cite the relevant statutory provisions and leading cases discussed above.',
      citations: [],
      is_instruction_only: true,
    });
  }

  return {
    items,
    activityType: 'READING_NOTES',
    evidenceSpanIds,
  };
}

async function buildNotesSection(
  heading: string,
  passages: PassageWithAuthority[],
  skillName: string
): Promise<{ content: string; citations: Citation[] }> {
  const citations: Citation[] = [];
  const contentParts: string[] = [];

  for (const passage of passages) {
    // Build citation
    const citation: Citation = {
      authority_id: passage.authorityId,
      url: passage.url,
      locator_json: passage.locator,
      passage_id: passage.passageId,
    };
    citations.push(citation);

    // Build content with or without verbatim quote
    if (passage.verbatimAllowed) {
      contentParts.push(
        `> "${passage.text.substring(0, 300)}${passage.text.length > 300 ? '...' : ''}"\n` +
        `> — *${passage.citation}*\n`
      );
    } else {
      contentParts.push(
        `According to *${passage.citation}*, the relevant principle applies as follows.` +
        ` [See ${passage.url}]`
      );
    }
  }

  return {
    content: contentParts.join('\n\n'),
    citations,
  };
}

// ============================================
// MEMORY_CHECK GENERATOR
// ============================================

async function generateMemoryCheck(
  context: GeneratorContext
): Promise<GeneratedItems> {
  const { skillName, passages, count, difficulty } = context;

  if (passages.length === 0) {
    return createFallbackResponse('MEMORY_CHECK', skillName);
  }

  const items: ContentItem[] = [];
  const evidenceSpanIds: string[] = [];
  const usedPassages = passages.slice(0, Math.min(count, passages.length));

  // Generate recall prompts using LLM
  const prompts = await generateMemoryPrompts(skillName, usedPassages, difficulty);

  for (let i = 0; i < prompts.length; i++) {
    const passage = usedPassages[i % usedPassages.length];
    
    items.push({
      type: 'RECALL_PROMPT',
      question: prompts[i].question,
      answer: prompts[i].answer,
      explanation: prompts[i].explanation,
      citations: [{
        authority_id: passage.authorityId,
        url: passage.url,
        locator_json: passage.locator,
        passage_id: passage.passageId,
      }],
      evidence_span_ids: [passage.passageId],
    });

    evidenceSpanIds.push(passage.passageId);
  }

  return {
    items,
    activityType: 'MEMORY_CHECK',
    evidenceSpanIds,
  };
}

async function generateMemoryPrompts(
  skillName: string,
  passages: PassageWithAuthority[],
  difficulty?: 'easy' | 'medium' | 'hard'
): Promise<Array<{ question: string; answer: string; explanation: string }>> {
  try {
    const passageContext = passages.map(p => ({
      text: p.text.substring(0, 500),
      citation: p.citation,
      sourceType: p.sourceType,
    }));

    const response = await openai.chat.completions.create({
      model: MODEL_CONFIG.generatorModel,
      messages: [
        {
          role: 'system',
          content: `Generate recall/memory check questions for law students studying ${skillName}.
Each question should test recall of specific legal rules, elements, or holdings from the provided sources.
Difficulty: ${difficulty || 'medium'}

Return JSON with format:
{
  "prompts": [
    {
      "question": "State the elements of...",
      "answer": "The elements are: ...",
      "explanation": "According to [source], ..."
    }
  ]
}`,
        },
        {
          role: 'user',
          content: `Generate ${passages.length} memory check questions based on these sources:\n\n${JSON.stringify(passageContext)}`,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.4,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return [];

    const parsed = JSON.parse(content);
    return parsed.prompts || [];
  } catch (err) {
    console.error('[generator] Memory prompt generation failed:', err);
    return passages.map(p => ({
      question: `What are the key principles from ${p.citation}?`,
      answer: p.text.substring(0, 200),
      explanation: `Referenced from ${p.citation}`,
    }));
  }
}

// ============================================
// FLASHCARDS GENERATOR
// ============================================

async function generateFlashcards(
  context: GeneratorContext
): Promise<GeneratedItems> {
  const { skillName, passages, count } = context;

  if (passages.length === 0) {
    return createFallbackResponse('FLASHCARDS', skillName);
  }

  const items: ContentItem[] = [];
  const evidenceSpanIds: string[] = [];
  const usedPassages = passages.slice(0, Math.min(count, passages.length));

  // Generate flashcards using LLM
  const cards = await generateFlashcardContent(skillName, usedPassages, count);

  for (let i = 0; i < cards.length; i++) {
    const passage = usedPassages[i % usedPassages.length];

    items.push({
      type: 'FLASHCARD',
      prompt: cards[i].front,
      answer: cards[i].back,
      content: cards[i].cloze || undefined,
      citations: [{
        authority_id: passage.authorityId,
        url: passage.url,
        locator_json: passage.locator,
        passage_id: passage.passageId,
      }],
      evidence_span_ids: [passage.passageId],
    });

    evidenceSpanIds.push(passage.passageId);
  }

  return {
    items,
    activityType: 'FLASHCARDS',
    evidenceSpanIds,
  };
}

async function generateFlashcardContent(
  skillName: string,
  passages: PassageWithAuthority[],
  count: number
): Promise<Array<{ front: string; back: string; cloze?: string }>> {
  try {
    const passageContext = passages.map(p => ({
      text: p.text.substring(0, 400),
      citation: p.citation,
      sourceType: p.sourceType,
    }));

    const response = await openai.chat.completions.create({
      model: MODEL_CONFIG.generatorModel,
      messages: [
        {
          role: 'system',
          content: `Generate flashcards for law students studying ${skillName}.
Include mix of:
- Definition cards (front: term, back: definition)
- Cloze cards (sentence with blank to fill)
- Case holding cards (front: case name, back: key holding)

Return JSON:
{
  "cards": [
    { "front": "...", "back": "...", "cloze": "optional cloze version" }
  ]
}`,
        },
        {
          role: 'user',
          content: `Generate ${count} flashcards based on:\n\n${JSON.stringify(passageContext)}`,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.4,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return [];

    const parsed = JSON.parse(content);
    return parsed.cards || [];
  } catch (err) {
    console.error('[generator] Flashcard generation failed:', err);
    return passages.slice(0, count).map(p => ({
      front: `What is the key principle from ${p.citation}?`,
      back: p.text.substring(0, 150),
    }));
  }
}

// ============================================
// WRITTEN_QUIZ GENERATOR
// ============================================

async function generateWrittenQuiz(
  context: GeneratorContext
): Promise<GeneratedItems> {
  const { skillName, passages, count, difficulty } = context;

  if (passages.length === 0) {
    return createFallbackResponse('WRITTEN_QUIZ', skillName);
  }

  const items: ContentItem[] = [];
  const evidenceSpanIds: string[] = [];

  // Generate quiz questions using LLM
  const questions = await generateQuizQuestions(skillName, passages, count, difficulty);

  for (let i = 0; i < questions.length; i++) {
    const passage = passages[i % passages.length];

    items.push({
      type: questions[i].type === 'MCQ' ? 'MULTIPLE_CHOICE' : 'SHORT_ANSWER',
      question: questions[i].question,
      prompt: questions[i].options?.join('\n'),
      answer: questions[i].correctAnswer,
      explanation: questions[i].explanation,
      citations: [{
        authority_id: passage.authorityId,
        url: passage.url,
        locator_json: passage.locator,
        passage_id: passage.passageId,
      }],
      evidence_span_ids: [passage.passageId],
    });

    evidenceSpanIds.push(passage.passageId);
  }

  return {
    items,
    activityType: 'WRITTEN_QUIZ',
    evidenceSpanIds,
  };
}

async function generateQuizQuestions(
  skillName: string,
  passages: PassageWithAuthority[],
  count: number,
  difficulty?: 'easy' | 'medium' | 'hard'
): Promise<Array<{
  type: 'MCQ' | 'SHORT_ANSWER';
  question: string;
  options?: string[];
  correctAnswer: string;
  explanation: string;
}>> {
  try {
    const passageContext = passages.map(p => ({
      text: p.text.substring(0, 500),
      citation: p.citation,
      sourceType: p.sourceType,
    }));

    const response = await openai.chat.completions.create({
      model: MODEL_CONFIG.generatorModel,
      messages: [
        {
          role: 'system',
          content: `Generate quiz questions for law students studying ${skillName}.
Mix of MCQ (with 4 options) and short answer questions.
Difficulty: ${difficulty || 'medium'}
Each question must be directly answerable from the provided sources.

Return JSON:
{
  "questions": [
    {
      "type": "MCQ",
      "question": "...",
      "options": ["A. ...", "B. ...", "C. ...", "D. ..."],
      "correctAnswer": "B",
      "explanation": "According to [source], ..."
    },
    {
      "type": "SHORT_ANSWER",
      "question": "...",
      "correctAnswer": "...",
      "explanation": "..."
    }
  ]
}`,
        },
        {
          role: 'user',
          content: `Generate ${count} questions (mix MCQ and short answer) based on:\n\n${JSON.stringify(passageContext)}`,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.4,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return [];

    const parsed = JSON.parse(content);
    return parsed.questions || [];
  } catch (err) {
    console.error('[generator] Quiz generation failed:', err);
    return passages.slice(0, count).map(p => ({
      type: 'SHORT_ANSWER' as const,
      question: `Explain the key principle established in ${p.citation}.`,
      correctAnswer: p.text.substring(0, 200),
      explanation: `Referenced from ${p.citation}`,
    }));
  }
}

// ============================================
// ISSUE_SPOTTER GENERATOR
// ============================================

async function generateIssueSpotter(
  context: GeneratorContext
): Promise<GeneratedItems> {
  const { skillName, passages, count } = context;

  if (passages.length === 0) {
    return createFallbackResponse('ISSUE_SPOTTER', skillName);
  }

  const items: ContentItem[] = [];
  const evidenceSpanIds: string[] = [];

  // Generate fact pattern and issues using LLM
  const scenario = await generateIssueSpotterScenario(skillName, passages);

  // Add fact pattern
  items.push({
    type: 'FACT_PATTERN',
    content: scenario.factPattern,
    is_instruction_only: true,
    citations: [],
  });

  // Add issues with citations
  for (let i = 0; i < scenario.issues.length; i++) {
    const passage = passages[i % passages.length];

    items.push({
      type: 'ISSUE',
      content: scenario.issues[i].issue,
      answer: scenario.issues[i].analysis,
      explanation: scenario.issues[i].ruleStatement,
      citations: [{
        authority_id: passage.authorityId,
        url: passage.url,
        locator_json: passage.locator,
        passage_id: passage.passageId,
      }],
      evidence_span_ids: [passage.passageId],
    });

    evidenceSpanIds.push(passage.passageId);
  }

  return {
    items,
    activityType: 'ISSUE_SPOTTER',
    evidenceSpanIds,
  };
}

async function generateIssueSpotterScenario(
  skillName: string,
  passages: PassageWithAuthority[]
): Promise<{
  factPattern: string;
  issues: Array<{ issue: string; ruleStatement: string; analysis: string }>;
}> {
  try {
    const passageContext = passages.map(p => ({
      text: p.text.substring(0, 400),
      citation: p.citation,
      sourceType: p.sourceType,
    }));

    const response = await openai.chat.completions.create({
      model: MODEL_CONFIG.generatorModel,
      messages: [
        {
          role: 'system',
          content: `Generate an issue spotter exercise for law students studying ${skillName}.
Create a short fact pattern (150-250 words) that raises 2-4 legal issues.
For each issue, provide the rule statement (grounded in sources) and brief analysis.

Return JSON:
{
  "factPattern": "John is a farmer in Nakuru...",
  "issues": [
    {
      "issue": "Whether the contract was validly formed",
      "ruleStatement": "According to [source], a valid contract requires...",
      "analysis": "Here, John and Mary..."
    }
  ]
}`,
        },
        {
          role: 'user',
          content: `Generate issue spotter based on:\n\n${JSON.stringify(passageContext)}`,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.5,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return {
        factPattern: `Consider a scenario involving ${skillName}. ${GROUNDING_RULES.fallbackMessage}`,
        issues: [],
      };
    }

    return JSON.parse(content);
  } catch (err) {
    console.error('[generator] Issue spotter generation failed:', err);
    return {
      factPattern: `Consider a scenario involving ${skillName}. Please refer to your ATP materials for practice problems.`,
      issues: [],
    };
  }
}

// ============================================
// RULE_ELEMENTS_DRILL GENERATOR
// ============================================

async function generateRuleElementsDrill(
  context: GeneratorContext
): Promise<GeneratedItems> {
  const { skillName, passages, count } = context;

  if (passages.length === 0) {
    return createFallbackResponse('RULE_ELEMENTS_DRILL', skillName);
  }

  const items: ContentItem[] = [];
  const evidenceSpanIds: string[] = [];

  // Generate element drills using LLM
  const drills = await generateElementDrills(skillName, passages, count);

  for (let i = 0; i < drills.length; i++) {
    const passage = passages[i % passages.length];

    items.push({
      type: 'ELEMENT_DRILL',
      question: drills[i].question,
      answer: drills[i].elements.join('\n'),
      explanation: drills[i].explanation,
      citations: [{
        authority_id: passage.authorityId,
        url: passage.url,
        locator_json: passage.locator,
        passage_id: passage.passageId,
      }],
      evidence_span_ids: [passage.passageId],
    });

    evidenceSpanIds.push(passage.passageId);
  }

  return {
    items,
    activityType: 'RULE_ELEMENTS_DRILL',
    evidenceSpanIds,
  };
}

async function generateElementDrills(
  skillName: string,
  passages: PassageWithAuthority[],
  count: number
): Promise<Array<{
  question: string;
  elements: string[];
  explanation: string;
}>> {
  try {
    const passageContext = passages.map(p => ({
      text: p.text.substring(0, 400),
      citation: p.citation,
      sourceType: p.sourceType,
    }));

    const response = await openai.chat.completions.create({
      model: MODEL_CONFIG.generatorModel,
      messages: [
        {
          role: 'system',
          content: `Generate rule elements drills for law students studying ${skillName}.
Each drill asks students to list/identify the elements of a legal rule, test, or doctrine.

Return JSON:
{
  "drills": [
    {
      "question": "List the elements required for [legal concept]",
      "elements": ["1. Element one", "2. Element two", "..."],
      "explanation": "According to [source], these elements must be satisfied..."
    }
  ]
}`,
        },
        {
          role: 'user',
          content: `Generate ${count} rule element drills based on:\n\n${JSON.stringify(passageContext)}`,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return [];

    const parsed = JSON.parse(content);
    return parsed.drills || [];
  } catch (err) {
    console.error('[generator] Element drill generation failed:', err);
    return passages.slice(0, count).map(p => ({
      question: `What are the key elements or requirements from ${p.citation}?`,
      elements: ['Element 1', 'Element 2', 'Element 3'],
      explanation: `Referenced from ${p.citation}`,
    }));
  }
}

// ============================================
// ESSAY_OUTLINE GENERATOR
// ============================================

async function generateEssayOutline(
  context: GeneratorContext
): Promise<GeneratedItems> {
  const { skillName, passages } = context;

  if (passages.length === 0) {
    return createFallbackResponse('ESSAY_OUTLINE', skillName);
  }

  const items: ContentItem[] = [];
  const evidenceSpanIds: string[] = [];

  // Generate essay outline using LLM
  const outline = await generateEssayOutlineContent(skillName, passages);

  // Add the question/prompt
  items.push({
    type: 'ESSAY_QUESTION',
    content: outline.question,
    is_instruction_only: true,
    citations: [],
  });

  // Add outline sections with citations
  for (let i = 0; i < outline.sections.length; i++) {
    const passage = passages[i % passages.length];

    items.push({
      type: 'OUTLINE_SECTION',
      content: `**${outline.sections[i].heading}**\n${outline.sections[i].points.map(p => `- ${p}`).join('\n')}`,
      explanation: outline.sections[i].keyAuthority,
      citations: [{
        authority_id: passage.authorityId,
        url: passage.url,
        locator_json: passage.locator,
        passage_id: passage.passageId,
      }],
      evidence_span_ids: [passage.passageId],
    });

    evidenceSpanIds.push(passage.passageId);
  }

  return {
    items,
    activityType: 'ESSAY_OUTLINE',
    evidenceSpanIds,
  };
}

async function generateEssayOutlineContent(
  skillName: string,
  passages: PassageWithAuthority[]
): Promise<{
  question: string;
  sections: Array<{
    heading: string;
    points: string[];
    keyAuthority: string;
  }>;
}> {
  try {
    const passageContext = passages.map(p => ({
      text: p.text.substring(0, 400),
      citation: p.citation,
      sourceType: p.sourceType,
    }));

    const response = await openai.chat.completions.create({
      model: MODEL_CONFIG.generatorModel,
      messages: [
        {
          role: 'system',
          content: `Generate an essay outline exercise for law students studying ${skillName}.
Include a sample essay question and a model outline structure.

Return JSON:
{
  "question": "Discuss the legal principles governing...",
  "sections": [
    {
      "heading": "Introduction",
      "points": ["Define key terms", "State thesis"],
      "keyAuthority": "Cite [Case/Statute] for..."
    },
    {
      "heading": "Main Argument 1",
      "points": ["Point A", "Point B"],
      "keyAuthority": "Reference [Source]"
    }
  ]
}`,
        },
        {
          role: 'user',
          content: `Generate essay outline based on:\n\n${JSON.stringify(passageContext)}`,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.4,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return {
        question: `Discuss the key legal principles relating to ${skillName}.`,
        sections: [],
      };
    }

    return JSON.parse(content);
  } catch (err) {
    console.error('[generator] Essay outline generation failed:', err);
    return {
      question: `Discuss the key legal principles relating to ${skillName}.`,
      sections: [],
    };
  }
}

// ============================================
// ERROR_CORRECTION GENERATOR
// ============================================

async function generateErrorCorrection(
  context: GeneratorContext
): Promise<GeneratedItems> {
  const { skillName, passages, count } = context;

  if (passages.length === 0) {
    return createFallbackResponse('ERROR_CORRECTION', skillName);
  }

  const items: ContentItem[] = [];
  const evidenceSpanIds: string[] = [];

  // Generate error correction exercises using LLM
  const exercises = await generateErrorCorrectionExercises(skillName, passages, count);

  for (let i = 0; i < exercises.length; i++) {
    const passage = passages[i % passages.length];

    items.push({
      type: 'ERROR_CORRECTION',
      question: exercises[i].incorrectStatement,
      answer: exercises[i].correctedStatement,
      explanation: exercises[i].explanation,
      citations: [{
        authority_id: passage.authorityId,
        url: passage.url,
        locator_json: passage.locator,
        passage_id: passage.passageId,
      }],
      evidence_span_ids: [passage.passageId],
    });

    evidenceSpanIds.push(passage.passageId);
  }

  return {
    items,
    activityType: 'ERROR_CORRECTION',
    evidenceSpanIds,
  };
}

async function generateErrorCorrectionExercises(
  skillName: string,
  passages: PassageWithAuthority[],
  count: number
): Promise<Array<{
  incorrectStatement: string;
  correctedStatement: string;
  explanation: string;
}>> {
  try {
    const passageContext = passages.map(p => ({
      text: p.text.substring(0, 400),
      citation: p.citation,
    }));

    const response = await openai.chat.completions.create({
      model: MODEL_CONFIG.generatorModel,
      messages: [
        {
          role: 'system',
          content: `Generate error correction exercises for law students studying ${skillName}.
Each exercise presents an incorrect legal statement that students must identify and correct.

Return JSON:
{
  "exercises": [
    {
      "incorrectStatement": "The burden of proof in criminal cases lies with the defendant.",
      "correctedStatement": "The burden of proof in criminal cases lies with the prosecution.",
      "explanation": "According to [source], ..."
    }
  ]
}`,
        },
        {
          role: 'user',
          content: `Generate ${count} error correction exercises based on:\n\n${JSON.stringify(passageContext)}`,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.4,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return [];

    const parsed = JSON.parse(content);
    return parsed.exercises || [];
  } catch (err) {
    console.error('[generator] Error correction generation failed:', err);
    return [];
  }
}

// ============================================
// PAST_PAPER_STYLE GENERATOR
// ============================================

async function generatePastPaperStyle(
  context: GeneratorContext
): Promise<GeneratedItems> {
  const { skillName, passages } = context;

  if (passages.length === 0) {
    return createFallbackResponse('PAST_PAPER_STYLE', skillName);
  }

  const items: ContentItem[] = [];
  const evidenceSpanIds: string[] = [];

  // Generate past paper style question using LLM
  const question = await generatePastPaperQuestion(skillName, passages);

  // Add the question
  items.push({
    type: 'PAST_PAPER_QUESTION',
    content: question.question,
    answer: question.modelAnswer,
    explanation: question.markingGuide,
    citations: passages.slice(0, 3).map(p => ({
      authority_id: p.authorityId,
      url: p.url,
      locator_json: p.locator,
      passage_id: p.passageId,
    })),
    evidence_span_ids: passages.slice(0, 3).map(p => p.passageId),
  });

  evidenceSpanIds.push(...passages.slice(0, 3).map(p => p.passageId));

  return {
    items,
    activityType: 'PAST_PAPER_STYLE',
    evidenceSpanIds,
  };
}

async function generatePastPaperQuestion(
  skillName: string,
  passages: PassageWithAuthority[]
): Promise<{
  question: string;
  modelAnswer: string;
  markingGuide: string;
}> {
  try {
    const passageContext = passages.map(p => ({
      text: p.text.substring(0, 400),
      citation: p.citation,
      sourceType: p.sourceType,
    }));

    const response = await openai.chat.completions.create({
      model: MODEL_CONFIG.generatorModel,
      messages: [
        {
          role: 'system',
          content: `Generate a past paper style question for Kenya Bar ATP exam on ${skillName}.
Format similar to actual ATP exam questions with appropriate marks allocation.

Return JSON:
{
  "question": "Question text (20 marks)...",
  "modelAnswer": "A comprehensive model answer...",
  "markingGuide": "Points for: Introduction (2), Rule statement (5), Application (10), Conclusion (3)"
}`,
        },
        {
          role: 'user',
          content: `Generate past paper question based on:\n\n${JSON.stringify(passageContext)}`,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.5,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return {
        question: `Discuss the legal principles relating to ${skillName}. (20 marks)`,
        modelAnswer: GROUNDING_RULES.fallbackMessage,
        markingGuide: 'Refer to marking scheme',
      };
    }

    return JSON.parse(content);
  } catch (err) {
    console.error('[generator] Past paper generation failed:', err);
    return {
      question: `Discuss the legal principles relating to ${skillName}. (20 marks)`,
      modelAnswer: GROUNDING_RULES.fallbackMessage,
      markingGuide: 'Refer to marking scheme',
    };
  }
}

// ============================================
// MIXED_REVIEW GENERATOR
// ============================================

async function generateMixedReview(
  context: GeneratorContext
): Promise<GeneratedItems> {
  const { skillName, passages, count } = context;

  if (passages.length === 0) {
    return createFallbackResponse('MIXED_REVIEW', skillName);
  }

  // Generate a mix of different activity types
  const results: GeneratedItems[] = [];

  // Add some memory checks
  const memoryResult = await generateMemoryCheck({
    ...context,
    count: Math.max(1, Math.floor(count / 3)),
  });
  results.push(memoryResult);

  // Add some quiz questions
  const quizResult = await generateWrittenQuiz({
    ...context,
    count: Math.max(1, Math.floor(count / 3)),
  });
  results.push(quizResult);

  // Add some flashcards
  const flashcardResult = await generateFlashcards({
    ...context,
    count: Math.max(1, Math.floor(count / 3)),
  });
  results.push(flashcardResult);

  // Combine all items
  const allItems = results.flatMap(r => r.items);
  const allEvidenceSpanIds = results.flatMap(r => r.evidenceSpanIds);

  return {
    items: allItems,
    activityType: 'MIXED_REVIEW',
    evidenceSpanIds: allEvidenceSpanIds,
  };
}

// ============================================
// FALLBACK HELPER
// ============================================

function createFallbackResponse(
  activityType: StudyActivityType,
  skillName: string
): GeneratedItems {
  return {
    items: [{
      type: activityType,
      content: GROUNDING_RULES.fallbackMessage,
      question: `${skillName}: ${GROUNDING_RULES.fallbackMessage}`,
      explanation: 'Please refer to your ATP materials for this topic.',
      citations: [],
      evidence_span_ids: [],
    }],
    activityType,
    evidenceSpanIds: [],
  };
}

// ============================================
// UTILITY: FETCH PASSAGES WITH AUTHORITY
// ============================================

export async function fetchPassagesWithAuthority(
  authorities: AuthorityResult[]
): Promise<PassageWithAuthority[]> {
  if (authorities.length === 0) return [];

  const authorityIds = authorities.map(a => a.authorityId);

  // Fetch authority records
  const authRecords = await db
    .select()
    .from(authorityRecords)
    .where(inArray(authorityRecords.id, authorityIds));

  // Fetch passages
  const passages = await db
    .select()
    .from(authorityPassages)
    .where(inArray(authorityPassages.authorityId, authorityIds));

  // Build combined result
  const result: PassageWithAuthority[] = [];

  for (const passage of passages) {
    const authority = authRecords.find(a => a.id === passage.authorityId);
    const authResult = authorities.find(a => a.authorityId === passage.authorityId);

    if (authority && authResult) {
      result.push({
        passageId: passage.id,
        authorityId: passage.authorityId,
        text: passage.passageText,
        locator: (passage.locatorJson as Record<string, any>) || {},
        url: authResult.url,
        citation: authority.citation || authority.title,
        verbatimAllowed: authResult.verbatimAllowed,
        sourceType: authority.sourceType,
        title: authority.title,
      });
    }
  }

  return result;
}

// ============================================
// EXPORTS
// ============================================

export default {
  generateActivityItems,
  fetchPassagesWithAuthority,
};
