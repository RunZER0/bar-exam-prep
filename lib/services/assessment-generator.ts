import { OpenAI } from 'openai';
import { ASSESSMENT_MODEL, GRADING_MODEL, getOpenAIKey } from '@/lib/ai/model-config';

const getOpenAI = () => {
    const apiKey = getOpenAIKey();
    if (!apiKey) {
        console.error('[AssessmentGenerator] OPENAI_API_KEY not set');
        return null;
    }
    return new OpenAI({ apiKey });
};

/**
 * AssessmentGenerator — End-of-Lesson Exam
 * 
 * Generates a SCORED end-of-lesson assessment for any syllabus node.
 * The student must score 70%+ to pass and have the lesson marked complete.
 * 
 * Assessment structure (5 questions, 100 points total):
 *   Q1: MCQ scenario-based (20 pts) — tests recall + application
 *   Q2: MCQ scenario-based (20 pts) — tests a different subtopic 
 *   Q3: SHORT application (20 pts) — apply law to fact pattern
 *   Q4: ORDERING procedural (20 pts) — correct legal procedure
 *   Q5: DRAFTING/ANALYSIS capstone (20 pts) — fact-pattern written response
 * 
 * MCQs and ORDERING are auto-graded. SHORT and DRAFTING are AI-graded
 * via the gradeWrittenAnswer() method.
 * 
 * Fresh questions generated every time — prevents memorization on retakes.
 */
export class AssessmentGenerator {

    static async generateStack(topic: string, context?: { unitCode?: string; isDrafting?: boolean }): Promise<AssessmentStack> {
        const systemPrompt = `You are a RIGOROUS Kenya School of Law (KSL) end-of-lesson examiner.
You create TOUGH, bar-exam-grade assessment questions that test genuine mastery.
Students must score 70% to pass. Questions should challenge even well-prepared students.
All questions MUST be grounded in Kenyan law — cite specific statutes, rules, and case law.
You MUST respond with valid JSON only — no markdown, no explanation outside the JSON.`;

        const userPrompt = `Generate a 5-question end-of-lesson assessment for: "${topic}"
${context?.unitCode ? `Course: ${context.unitCode}` : ''}
${context?.isDrafting ? 'This is a DRAFTING topic — Q5 must require actual document drafting.' : ''}

Each question is worth 20 points (100 total). Pass mark: 70/100.

RESPOND WITH THIS EXACT JSON:
{
  "topic": "${topic}",
  "totalPoints": 100,
  "passScore": 70,
  "questions": [
    {
      "id": "q1",
      "type": "MCQ",
      "points": 20,
      "question": "A 3-4 sentence FACT PATTERN involving a realistic client/courtroom scenario about ${topic}. Then a focused question requiring the student to apply the law to these specific facts.",
      "options": ["Option A: Plausible but wrong — cites a related but inapplicable provision", "Option B: The correct answer with precise legal reasoning", "Option C: Common student misconception — confuses a similar concept", "Option D: Partially correct but misses a critical element"],
      "correctIndex": 1,
      "explanation": "Full explanation: why correct answer is right (citing statute/rule), why each distractor fails (3-4 sentences)"
    },
    {
      "id": "q2",
      "type": "MCQ",
      "points": 20,
      "question": "A DIFFERENT scenario from Q1, testing a different aspect of ${topic}. Must be scenario-based, not 'which of the following is true'.",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctIndex": 0,
      "explanation": "Full explanation"
    },
    {
      "id": "q3",
      "type": "SHORT",
      "points": 20,
      "question": "Present a fact pattern and ask: 'Advise [party] on their legal position, citing the relevant statutory provision and any applicable case law.' Require 3-5 sentence answer with specific legal reasoning.",
      "rubric": ["Identifies the correct legal principle/rule (5 pts)", "Cites the specific statutory provision (5 pts)", "Correctly applies the law to the given facts (5 pts)", "Reaches a well-reasoned conclusion (5 pts)"],
      "sampleAnswer": "A model answer demonstrating the full reasoning chain (3-5 sentences)"
    },
    {
      "id": "q4",
      "type": "ORDERING", 
      "points": 20,
      "question": "Arrange these procedural steps in their correct legal order for a process related to ${topic}. Include 5 steps with specific legal references.",
      "items": ["Step 1 (scrambled) with legal detail", "Step 2 with statute reference", "Step 3 naming specific court/body", "Step 4 with timeline", "Step 5 final step"],
      "correctOrder": [2, 0, 4, 1, 3],
      "explanation": "Correct sequence with legal basis for each step and consequences of wrong order"
    },
    {
      "id": "q5",
      "type": "ANALYSIS",
      "points": 20,
      "question": "A complex fact pattern (5-8 sentences) with multiple legal issues. Ask: 'Identify ALL the legal issues arising, and for each issue, state the applicable law and likely outcome.' ${context?.isDrafting ? 'Alternatively: Draft the relevant portion of [specific document] based on these facts.' : ''}",
      "rubric": ["Identifies all key legal issues (5 pts)", "States the correct applicable law for each issue (5 pts)", "Applies law to facts with reasoning (5 pts)", "Overall quality of analysis and legal writing (5 pts)"],
      "sampleAnswer": "A comprehensive model answer covering all issues (5-8 sentences)"
    }
  ]
}

QUESTION DESIGN MANDATES:
- Q1 and Q2 MUST have different scenarios testing different aspects/subtopics
- All MCQ distractors must exploit ACTUAL common student errors
- SHORT and ANALYSIS questions require APPLYING law to facts — never "Define X"
- ORDERING must use a real procedural sequence with legal consequences for wrong order
- ALL content specific to Kenyan law with statute/rule citations
- Difficulty: A well-prepared candidate should score 70-80% on first attempt
- Questions must be FRESH and UNIQUE — vary scenarios, parties, facts each time`;

        try {
            const openai = getOpenAI();
            if (!openai) {
                throw new Error('OpenAI client unavailable — OPENAI_API_KEY not set');
            }

            const response = await openai.responses.create({
                model: ASSESSMENT_MODEL,
                instructions: systemPrompt,
                input: userPrompt,
                text: { format: { type: 'json_object' } },
                temperature: 0.7,
            });

            const content = response.output_text;
            if (!content) throw new Error('Empty response from assessment model');

            const parsed = JSON.parse(content) as AssessmentStack;

            // Validate structure
            if (!parsed.questions || !Array.isArray(parsed.questions) || parsed.questions.length < 5) {
                throw new Error('Invalid assessment structure — expected 5 questions');
            }

            // Ensure IDs and points are set
            parsed.questions = parsed.questions.map((q, i) => ({
                ...q,
                id: q.id || `q${i + 1}`,
                points: q.points || 20,
            }));
            parsed.totalPoints = parsed.totalPoints || 100;
            parsed.passScore = parsed.passScore || 70;

            return parsed;
        } catch (error) {
            console.error('[AssessmentGenerator] Generation failed:', error);
            throw error;
        }
    }

    /**
     * Grade a written answer (SHORT or ANALYSIS) using AI.
     * Returns a score out of the question's total points + feedback.
     */
    static async gradeWrittenAnswer(
        question: AssessmentQuestion,
        studentAnswer: string,
        topic: string
    ): Promise<{ score: number; maxScore: number; feedback: string }> {
        const maxScore = question.points || 20;

        if (!studentAnswer.trim()) {
            return { score: 0, maxScore, feedback: 'No answer provided.' };
        }

        const prompt = `You are a KSL bar exam grader. Grade this student's answer STRICTLY.

TOPIC: ${topic}
QUESTION: ${question.question}
RUBRIC: ${(question.rubric || []).map((r, i) => `${i + 1}. ${r}`).join('\n')}
MODEL ANSWER: ${question.sampleAnswer || 'Not provided'}
STUDENT ANSWER: ${studentAnswer}

Grade out of ${maxScore} points using the rubric criteria.
Be STRICT — deduct points for:
- Missing statutory citations when required
- Incorrect application of law to facts
- Vague or generic answers that don't address the specific scenario
- Missing key legal issues

RESPOND WITH VALID JSON ONLY:
{
  "score": <number 0-${maxScore}>,
  "breakdown": [
    {"criterion": "criterion text", "score": <number>, "max": <number>, "comment": "specific feedback"}
  ],
  "feedback": "2-3 sentences: what was good, what was missed, what would improve the answer"
}`;

        try {
            const openai = getOpenAI();
            if (!openai) throw new Error('OpenAI unavailable');

            const response = await openai.responses.create({
                model: GRADING_MODEL,
                input: prompt,
                text: { format: { type: 'json_object' } },
                temperature: 0.2,
            });

            const content = response.output_text;
            if (!content) throw new Error('Empty grading response');

            const parsed = JSON.parse(content);
            return {
                score: Math.min(Math.max(0, parsed.score || 0), maxScore),
                maxScore,
                feedback: parsed.feedback || 'Grading complete.',
            };
        } catch (error) {
            console.error('[AssessmentGenerator] Grading failed:', error);
            // Generous fallback — don't penalize for grading errors
            return { score: Math.round(maxScore * 0.5), maxScore, feedback: 'Could not grade — partial credit awarded.' };
        }
    }
}

// === Types ===
export interface AssessmentQuestion {
    id: string;
    type: 'MCQ' | 'SHORT' | 'ORDERING' | 'ANALYSIS';
    points: number;
    question: string;
    // MCQ
    options?: string[];
    correctIndex?: number;
    explanation?: string;
    // ORDERING
    items?: string[];
    correctOrder?: number[];
    // SHORT / ANALYSIS
    rubric?: string[];
    sampleAnswer?: string;
}

export interface AssessmentStack {
    topic: string;
    totalPoints: number;
    passScore: number;
    questions: AssessmentQuestion[];
    // Legacy compat
    stack?: any[];
}
