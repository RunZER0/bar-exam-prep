import Anthropic from '@anthropic-ai/sdk';
import { AUDITOR_MODEL, getAnthropicKey, AI_IDENTITY } from '@/lib/ai/model-config';

const getAnthropicClient = () => {
    const apiKey = getAnthropicKey();
    if (!apiKey) {
        console.error('[CritiqueEngine] ANTHROPIC_API_KEY not set');
        return null;
    }
    return new Anthropic({ apiKey });
};

/**
 * CritiqueEngine — "The Auditor" (Claude Sonnet 4)
 * 
 * Produces Senior-Partner-grade redline annotations on student legal drafts.
 * Output: structured JSON with redlines, severity, CLE rubric score, and feedback.
 */
export class CritiqueEngine {

    static async critiqueDraft(studentDraft: string, topic: string): Promise<CritiqueResult> {
        const systemPrompt = `You are Ynai Assistant — a ruthless but constructive Senior Partner at a top Kenyan law firm. If asked who you are, say "I am Ynai Assistant." NEVER identify as ChatGPT, GPT, Claude, or any AI brand. 
You review junior associates' legal drafts against CLE marking rubrics. 
You are deeply familiar with the Civil Procedure Act, Criminal Procedure Code, Advocates Act, 
and all Kenya School of Law practical paper requirements.
You MUST respond with valid JSON only — no markdown, no explanation outside the JSON.`;

        const userPrompt = `Review this junior associate's draft for "${topic}".

STUDENT DRAFT:
"""
${studentDraft}
"""

TASK:
1. Identify every missing clause, procedural error, or drafting deficiency.
2. For each issue, quote the exact problematic text (or note what's missing).
3. Provide a Senior Partner comment citing the relevant rule/statute.
4. Score the draft against a standard CLE rubric (0.0 to 1.0).
5. Give overall feedback — be specific about what would cause the document to be struck out.

RESPOND WITH THIS EXACT JSON STRUCTURE:
{
  "redlines": [
    {
      "originalText": "exact quoted text or [MISSING: description]",
      "comment": "Senior Partner comment with statute/rule citation",
      "severity": "critical" or "minor"
    }
  ],
  "score": 0.0,
  "feedback": "Overall assessment including fatal errors and strengths"
}`;

        try {
            const anthropic = getAnthropicClient();
            if (!anthropic) {
                throw new Error('Anthropic client unavailable — ANTHROPIC_API_KEY not set');
            }

            const response = await anthropic.messages.create({
                model: AUDITOR_MODEL,
                max_tokens: 4096,
                thinking: {
                    type: 'enabled',
                    budget_tokens: 6000,
                },
                messages: [
                    { role: 'user', content: userPrompt }
                ],
                system: systemPrompt,
            });

            const textBlock = response.content.find(b => b.type === 'text');
            if (!textBlock || textBlock.type !== 'text') {
                throw new Error('No text content in Auditor response');
            }

            // Parse JSON — strip any markdown fencing if present
            let raw = textBlock.text.trim();
            if (raw.startsWith('```')) {
                raw = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
            }

            const parsed = JSON.parse(raw) as CritiqueResult;
            
            // Validate structure
            if (!parsed.redlines || !Array.isArray(parsed.redlines) || typeof parsed.score !== 'number') {
                throw new Error('Invalid Auditor response structure');
            }

            return parsed;
        } catch (error) {
            console.error('[CritiqueEngine] Auditor call failed:', error);
            throw error; // Let caller handle — no silent mock fallbacks
        }
    }
}

// === Types ===
export interface RedlineAnnotation {
    originalText: string;
    comment: string;
    severity: 'critical' | 'minor';
}

export interface CritiqueResult {
    redlines: RedlineAnnotation[];
    score: number;
    feedback: string;
}
