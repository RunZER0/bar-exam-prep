import { OpenAI } from 'openai';
import { ASSESSMENT_MODEL, getOpenAIKey } from '@/lib/ai/model-config';

const getOpenAI = () => {
    const apiKey = getOpenAIKey();
    if (!apiKey) return null;
    return new OpenAI({ apiKey });
};

/**
 * CheckpointGenerator
 * 
 * Generates TOUGH inline checkpoint questions interleaved with study notes.
 * These are NOT simple "attention checks" — they are bar-exam-grade questions
 * that force students to THINK, APPLY, and DISTINGUISH. A student who merely
 * skimmed the notes should get them wrong.
 * 
 * Types generated:
 *   - MCQ      : 4-option scenario-based (1 correct, 3 plausible traps)
 *   - SHORT    : Application/analysis requiring 2-4 sentence reasoning
 *   - ORDERING : Procedural sequence with legal consequences for wrong order
 */

export type CheckpointType = 'MCQ' | 'SHORT' | 'ORDERING';

export interface CheckpointQuestion {
    id: string;
    type: CheckpointType;
    question: string;
    // MCQ fields
    options?: string[];
    correctIndex?: number;
    // ORDERING fields
    items?: string[];
    correctOrder?: number[];
    // SHORT answer fields
    sampleAnswer?: string;
    keywords?: string[];
    // Shared
    hint?: string;
    explanation: string;
    /** Points value for scoring (used by end-of-lesson assessment) */
    points?: number;
}

export class CheckpointGenerator {

    /**
     * Generate a set of checkpoint questions for a topic.
     * @param topic      - The study topic
     * @param slideCount - Number of narrative slides (determines how many checkpoints)
     * @param context    - Optional unit code for legal specificity
     * @returns Array of checkpoint questions (typically 2-4)
     */
    static async generate(
        topic: string,
        slideCount: number,
        context?: { unitCode?: string }
    ): Promise<CheckpointQuestion[]> {
        const count = Math.min(Math.max(Math.floor(slideCount / 2), 2), 4);

        const typeDistribution = this.distributeTypes(count);

        const prompt = `You are a RUTHLESS Kenya School of Law (KSL) bar exam coach. Generate ${count} TOUGH checkpoint question(s) for: "${topic}".
${context?.unitCode ? `Course: ${context.unitCode}` : ''}

DIFFICULTY MANDATE: These questions are placed between study slides to VERIFY genuine understanding. A student who only skimmed the notes MUST get these wrong. Target the difficulty of actual bar exam questions — tricky, scenario-based, requiring LEGAL REASONING not mere recall.

Generate exactly this distribution: ${typeDistribution.join(', ')}

RESPOND WITH VALID JSON ONLY:
{
  "checkpoints": [
    {
      "type": "MCQ",
      "question": "Present a REALISTIC client scenario or courtroom situation (3-4 sentences) then ask a question that requires applying the law to the specific facts. Example: 'Wanjiku, a tenant under a 5-year lease registered under the Registration of Documents Act, discovers her landlord sold the property. The new owner serves a notice to vacate. Under Kenyan law, Wanjiku's STRONGEST legal position is:'",
      "options": ["A plausible but legally wrong answer - would be correct if one fact changed", "The correct answer with precise legal reasoning", "A common student error - confuses a similar but inapplicable rule", "An answer that cites the right statute but reaches the wrong conclusion"],
      "correctIndex": 1,
      "hint": "Focus on the distinction between registered and unregistered interests",
      "explanation": "Thorough explanation: WHY correct answer is right (cite the statutory provision), and WHY each distractor fails (2-4 sentences)"
    },
    {
      "type": "SHORT",
      "question": "Present a fact pattern: 'Company X did [action]. Company Y responded by [action]. The court must determine [issue].' Then ask: 'Advise the court on the applicable legal test, citing the relevant statutory provision and ONE supporting Kenyan case.' Do NOT ask 'Define X' or 'What is X'.",
      "sampleAnswer": "A model answer demonstrating the reasoning chain: identify the rule → apply to facts → reach conclusion (3-4 sentences)",
      "keywords": ["specific_legal_term", "statute_section", "case_name", "legal_test"],
      "hint": "Consider the distinction between...",
      "explanation": "Full explanation of the correct analysis"
    },
    {
      "type": "ORDERING",
      "question": "Arrange these steps in the correct procedural order. Getting ANY step wrong has real legal consequences (explain what goes wrong):",
      "items": ["Step with specific legal detail (scrambled)", "Step B with statute reference", "Step C naming the specific court/office", "Step D with timeline requirement"],
      "correctOrder": [2, 0, 3, 1],
      "hint": "Start with the preliminary step that must happen before the court has jurisdiction",
      "explanation": "Correct order with legal consequence of each misstep (e.g., 'Filing before X makes the application incompetent under Order XX Rule X')"
    }
  ]
}

QUESTION DESIGN COMMANDMENTS:
1. EVERY MCQ must start with a FACT PATTERN (real-world scenario, 2-4 sentences minimum). NEVER use "Which of the following..." without a scenario.
2. MCQ distractors must exploit ACTUAL student misconceptions — partial truths, confused statutes, right rule wrong context. A student should genuinely debate between 2-3 options.
3. SHORT questions must require APPLYING law to facts, not reciting rules. "Advise [client] on..." or "Draft the legal argument for..." formats only.
4. ORDERING must use REAL procedural sequences where wrong order = legal consequences (case struck out, appeal time-barred, etc.)
5. ALL questions grounded in Kenyan law with specific statute/rule references where applicable.
6. Difficulty level: A well-prepared bar candidate should get 60-70% right on first attempt. These should make students THINK hard.`;

        try {
            const openai = getOpenAI();
            if (!openai) throw new Error('OpenAI unavailable');

            const response = await openai.responses.create({
                model: ASSESSMENT_MODEL,
                input: prompt,
                text: { format: { type: 'json_object' } },
                temperature: 0.7,
            });

            const content = response.output_text;
            if (!content) throw new Error('Empty checkpoint response');

            const parsed = JSON.parse(content);
            const checkpoints = (parsed.checkpoints || []).map((cp: any, i: number) => ({
                ...cp,
                id: `cp_${Date.now()}_${i}`,
            }));

            return checkpoints;
        } catch (error) {
            console.error('[CheckpointGenerator] Failed:', error);
            return [];
        }
    }

    /** Distribute question types to ensure variety */
    private static distributeTypes(count: number): CheckpointType[] {
        const types: CheckpointType[] = ['MCQ', 'SHORT', 'ORDERING'];
        if (count === 1) return ['MCQ'];
        if (count === 2) return ['MCQ', 'SHORT'];
        if (count === 3) return ['MCQ', 'SHORT', 'ORDERING'];
        // 4+: repeat with variety
        const result: CheckpointType[] = [];
        for (let i = 0; i < count; i++) {
            result.push(types[i % types.length]);
        }
        return result;
    }
}
