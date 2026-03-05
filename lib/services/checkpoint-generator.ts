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
 * Generates lightweight inline checkpoint questions to be interleaved
 * with narrative study notes. These are NOT full assessments — they are
 * quick "attention checks" that force active recall during reading.
 * 
 * Types generated:
 *   - MCQ      : 4-option multiple choice (1 correct)
 *   - SHORT    : Free-text short answer (1-2 sentences expected)
 *   - ORDERING : Arrange items in correct sequence
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

        const prompt = `You are a Kenya School of Law (KSL) bar exam coach. Generate ${count} challenging checkpoint question(s) for the topic: "${topic}".
${context?.unitCode ? `Course: ${context.unitCode}` : ''}

These are knowledge checks placed between study slides to test REAL understanding. They should challenge the student — not just regurgitate definitions but test APPLICATION, ANALYSIS, and TRICKY DISTINCTIONS that bar examiners love to test.

Generate exactly this distribution: ${typeDistribution.join(', ')}

RESPOND WITH VALID JSON ONLY:
{
  "checkpoints": [
    {
      "type": "MCQ",
      "question": "A challenging scenario-based question that requires reasoning, not just recall",
      "options": ["A plausible but wrong answer", "The correct answer with a subtle distinction", "A common student misconception", "An answer that is partially right but misses a key element"],
      "correctIndex": 1,
      "hint": "Optional short hint",
      "explanation": "Brief explanation of WHY the correct answer is right and why the distractors are wrong (2-3 sentences)"
    },
    {
      "type": "SHORT",
      "question": "A question requiring the student to distinguish, compare, or apply a principle to a scenario...",
      "sampleAnswer": "The expected answer showing reasoning",
      "keywords": ["key", "terms", "that", "should", "appear"],
      "hint": "Optional hint",
      "explanation": "Brief explanation"
    },
    {
      "type": "ORDERING",
      "question": "Arrange these steps in the correct procedural order:",
      "items": ["Step A (scrambled)", "Step B", "Step C", "Step D"],
      "correctOrder": [2, 0, 3, 1],
      "hint": "Optional hint",
      "explanation": "Brief explanation of correct order"
    }
  ]
}

QUESTION DESIGN RULES:
- MCQ: Every distractor must be PLAUSIBLE. Include common misconceptions, partial truths, and answers that would be correct in a DIFFERENT context. Use scenario-based questions (e.g. "If a company fails to register a charge within 30 days, the charge becomes:"). Avoid "Which of the following is true" generic formats.
- SHORT: Ask the student to DISTINGUISH between similar concepts, APPLY a rule to a fact pattern, or EXPLAIN WHY a particular outcome follows from the law. Never ask "Define X" or "What is X".
- ORDERING: Use real procedural sequences where the order matters legally (filing steps, court processes, registration procedures).
- All questions must be grounded in Kenyan law
- Questions should test understanding at the level of a bar exam, not a first-year tutorial
- Make wrong MCQ options genuinely tempting — the student should need to think carefully`;

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
