import { OpenAI } from 'openai';
import { ASSESSMENT_MODEL, getOpenAIKey } from '@/lib/ai/model-config';

const getOpenAI = () => {
    const apiKey = getOpenAIKey();
    if (!apiKey) {
        console.error('[AssessmentGenerator] OPENAI_API_KEY not set');
        return null;
    }
    return new OpenAI({ apiKey });
};

/**
 * AssessmentGenerator — "The Brain, Part C"
 * 
 * Generates a 3-level assessment stack for any syllabus node:
 *   Level 1 (MCQ/ABCD): Concept threshold — 4 options, 1 correct
 *   Level 2 (Ordering): Procedural workflow — drag-and-drop sequence
 *   Level 3 (Drafting): Fact-pattern capstone — student drafts a document
 * 
 * Uses GPT-5.2 via the ASSESSMENT_MODEL config.
 */
export class AssessmentGenerator {

    static async generateStack(topic: string, context?: { unitCode?: string; isDrafting?: boolean }): Promise<AssessmentStack> {
        const systemPrompt = `You are a Kenya School of Law (KSL) examination expert. 
You create rigorous, exam-grade assessment questions for the Advocates Training Programme.
All questions must be grounded in Kenyan law — cite specific statutes, rules, and case law.
You MUST respond with valid JSON only — no markdown, no explanation outside the JSON.`;

        const userPrompt = `Generate a 3-level assessment stack for: "${topic}"
${context?.unitCode ? `Course: ${context.unitCode}` : ''}
${context?.isDrafting ? 'This is a DRAFTING node — Level 3 must require actual document drafting.' : ''}

RESPOND WITH THIS EXACT JSON:
{
  "topic": "${topic}",
  "stack": [
    {
      "level": 1,
      "type": "MCQ",
      "title": "Concept Check",
      "question": "A substantive multiple-choice question testing understanding of ${topic}. Must reference actual Kenyan statutes or rules.",
      "options": ["Option text A (detailed)", "Option text B (detailed)", "Option text C (detailed)", "Option text D (detailed)"],
      "correctIndex": 0,
      "explanation": "Why this answer is correct, citing the specific rule/section."
    },
    {
      "level": 2,
      "type": "ORDERING",
      "title": "Procedural Workflow",
      "question": "Arrange these procedural steps in the correct order for ${topic}.",
      "items": ["Actual step 1 with legal detail", "Actual step 2", "Actual step 3", "Actual step 4", "Actual step 5"],
      "correctOrder": [0, 1, 2, 3, 4],
      "explanation": "Why this order is correct, citing procedure rules."
    },
    {
      "level": 3,
      "type": "DRAFTING",
      "title": "Capstone Draft",
      "prompt": "A realistic fact-pattern scenario requiring the student to draft a specific legal document (plaint, affidavit, motion, charge sheet, etc.) related to ${topic}. Include client names, dates, amounts, and specific facts.",
      "rubric": ["Key element 1 that must appear", "Key element 2", "Key element 3", "Key element 4"]
    }
  ]
}

RULES:
- MCQ distractors must be plausible — they should reflect common student errors.
- Ordering items must be in SCRAMBLED order in the "items" array; "correctOrder" gives the correct sequence by original indices.
- Drafting prompt must give enough facts for a complete document.
- All content must be specific to Kenyan legal practice.`;

        try {
            const openai = getOpenAI();
            if (!openai) {
                throw new Error('OpenAI client unavailable — OPENAI_API_KEY not set');
            }

            const response = await openai.chat.completions.create({
                model: ASSESSMENT_MODEL,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
                ],
                response_format: { type: 'json_object' },
                temperature: 0.4,
            });

            const content = response.choices[0].message.content;
            if (!content) throw new Error('Empty response from assessment model');

            const parsed = JSON.parse(content) as AssessmentStack;

            // Validate structure
            if (!parsed.stack || !Array.isArray(parsed.stack) || parsed.stack.length < 3) {
                throw new Error('Invalid assessment stack structure');
            }

            return parsed;
        } catch (error) {
            console.error('[AssessmentGenerator] Generation failed:', error);
            throw error; // No silent mock fallbacks
        }
    }
}

// === Types ===
export interface MCQItem {
    level: 1;
    type: 'MCQ';
    title: string;
    question: string;
    options: string[];
    correctIndex: number;
    explanation?: string;
}

export interface OrderingItem {
    level: 2;
    type: 'ORDERING';
    title: string;
    question?: string;
    items: string[];
    correctOrder: number[];
    explanation?: string;
}

export interface DraftingItem {
    level: 3;
    type: 'DRAFTING';
    title: string;
    prompt: string;
    rubric?: string[];
}

export interface AssessmentStack {
    topic: string;
    stack: [MCQItem, OrderingItem, DraftingItem];
}
