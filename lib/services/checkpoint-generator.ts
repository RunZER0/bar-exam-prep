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
        const count = Math.min(Math.max(Math.floor(slideCount / 2), 1), 4);

        const typeDistribution = this.distributeTypes(count);

        const prompt = `You are a Kenya School of Law (KSL) study coach. Generate ${count} quick checkpoint question(s) for the topic: "${topic}".
${context?.unitCode ? `Course: ${context.unitCode}` : ''}

These are NOT full exam questions — they are lightweight "attention checks" placed between study note slides to keep the student engaged and force active recall.

Generate exactly this distribution: ${typeDistribution.join(', ')}

RESPOND WITH VALID JSON ONLY:
{
  "checkpoints": [
    {
      "type": "MCQ",
      "question": "Quick question testing a key concept just covered",
      "options": ["A", "B", "C", "D"],
      "correctIndex": 0,
      "hint": "Optional short hint",
      "explanation": "Brief explanation (1-2 sentences)"
    },
    {
      "type": "SHORT",
      "question": "In one sentence, explain...",
      "sampleAnswer": "The expected answer",
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

RULES:
- Questions must be concise (1-2 sentences max)
- MCQ should have exactly 4 options
- SHORT answer should expect 1-2 sentence responses
- ORDERING should have 3-5 items
- All grounded in Kenyan law
- Keep it light — these are checkpoints, not full exams`;

        try {
            const openai = getOpenAI();
            if (!openai) throw new Error('OpenAI unavailable');

            const response = await openai.responses.create({
                model: ASSESSMENT_MODEL,
                input: prompt,
                text: { format: { type: 'json_object' } },
                temperature: 0.6,
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
