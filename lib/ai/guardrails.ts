import Anthropic from '@anthropic-ai/sdk';

let _anthropic: Anthropic | null = null;
const getAnthropic = () => {
  if (!_anthropic) {
    _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return _anthropic;
};

// OpenAI is not currently used — remove the eager init that crashes at build time

export interface AIGuardrails {
  isHallucination: boolean;
  isOffTopic: boolean;
  isReliable: boolean;
  confidence: number;
  sources?: string[];
  warnings?: string[];
}

export interface AIResponse {
  content: string;
  guardrails: AIGuardrails;
  filtered: boolean;
}

/**
 * Kenya-specific legal context for the bar exam
 */
const KENYA_LEGAL_CONTEXT = `
You are an AI assistant helping Kenyan law students prepare for their bar examination.
Your responses must be accurate, based on Kenyan law, and aligned with the Council of Legal Education (CLE) requirements.

Core Competencies to Focus On:
1. Legal Drafting - Contracts, pleadings, legal opinions, legal memoranda
2. Legal Research - Case law analysis, statutory interpretation, legal reasoning
3. Oral Advocacy - Court arguments, client counseling, negotiation

Kenyan Legal Framework:
- Constitution of Kenya 2010
- Kenyan statutory law and regulations
- Kenyan case law and precedents
- Professional conduct rules for Kenyan advocates

CRITICAL RULES:
1. NEVER provide information that contradicts established Kenyan law
2. NEVER make up case citations or statutes
3. ALWAYS cite specific legal sources when making legal arguments
4. If uncertain, acknowledge limitations and suggest research directions
5. Focus on practical application relevant to Kenyan legal practice
6. Stay strictly within the scope of bar exam preparation

Topics covered include:
- Constitutional Law, Administrative Law, Criminal Law & Procedure
- Civil Procedure, Law of Contract, Law of Tort
- Land Law, Company Law, Commercial Law
- Family Law, Succession Law, Evidence
- Legal Ethics & Professional Responsibility
`;

/**
 * Validate and filter AI responses with guardrails
 */
async function validateResponse(
  prompt: string,
  response: string,
  context: 'drafting' | 'research' | 'oral'
): Promise<AIGuardrails> {
  try {
    // Use Claude to validate the response for hallucinations and accuracy
    const validationPrompt = `
You are a validator checking AI-generated content for a Kenyan bar exam prep platform.

User Query: ${prompt}
AI Response: ${response}
Context: ${context}

Evaluate this response for:
1. Factual accuracy regarding Kenyan law
2. Whether it contains hallucinated case law or statutes
3. Relevance to the query and Kenyan bar exam
4. Potential misinformation
5. Whether citations are verifiable

Respond in JSON format:
{
  "isHallucination": boolean,
  "isOffTopic": boolean,
  "isReliable": boolean,
  "confidence": number (0-100),
  "warnings": ["warning1", "warning2"],
  "reasoning": "brief explanation"
}
`;

    const validation = await getAnthropic().messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1000,
      messages: [
        {
          role: 'user',
          content: validationPrompt,
        },
      ],
    });

    const validationText = validation.content[0].type === 'text' 
      ? validation.content[0].text 
      : '';
    
    // Extract JSON from the response
    const jsonMatch = validationText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[0]);
      return {
        isHallucination: result.isHallucination || false,
        isOffTopic: result.isOffTopic || false,
        isReliable: result.isReliable || false,
        confidence: result.confidence || 0,
        warnings: result.warnings || [],
      };
    }
  } catch (error) {
    console.error('Validation error:', error);
  }

  // Default to safe values if validation fails
  return {
    isHallucination: false,
    isOffTopic: false,
    isReliable: true,
    confidence: 50,
    warnings: ['Could not validate response completely'],
  };
}

/**
 * Generate AI response with guardrails for legal drafting
 */
export async function generateDraftingResponse(
  prompt: string,
  documentType: string
): Promise<AIResponse> {
  try {
    const fullPrompt = `${KENYA_LEGAL_CONTEXT}

The student is working on: ${documentType}
Student's request: ${prompt}

Provide a detailed, accurate response with:
1. Proper legal structure and formatting
2. Relevant Kenyan law references
3. Practical guidance for bar exam standards
4. Professional drafting conventions

IMPORTANT: Only use real, verifiable Kenyan cases and statutes. If you don't know a specific case, explain the legal principle generally.`;

    const response = await getAnthropic().messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 4000,
      messages: [
        {
          role: 'user',
          content: fullPrompt,
        },
      ],
    });

    const content = response.content[0].type === 'text' 
      ? response.content[0].text 
      : '';

    // Validate the response
    const guardrails = await validateResponse(prompt, content, 'drafting');

    // Filter if high risk of hallucination or unreliable
    const filtered = guardrails.isHallucination || 
                    (!guardrails.isReliable && guardrails.confidence < 60);

    if (filtered) {
      return {
        content: 'I apologize, but I cannot provide a fully verified response to this request. For accurate legal drafting guidance, please consult official Kenyan legal resources or your course materials. I can help with general drafting principles if you\'d like.',
        guardrails,
        filtered: true,
      };
    }

    return {
      content,
      guardrails,
      filtered: false,
    };
  } catch (error) {
    console.error('AI generation error:', error);
    throw new Error('Failed to generate response');
  }
}

/**
 * Generate AI response for legal research questions
 */
export async function generateResearchResponse(
  prompt: string,
  topicArea: string
): Promise<AIResponse> {
  try {
    const fullPrompt = `${KENYA_LEGAL_CONTEXT}

Research Topic: ${topicArea}
Research Question: ${prompt}

Provide a comprehensive research response that:
1. Identifies the key legal issues
2. References relevant Kenyan constitutional provisions, statutes, and regulations
3. Discusses applicable case law (ONLY real, verifiable Kenyan cases)
4. Provides legal analysis and reasoning
5. Suggests research methodology for deeper investigation

If you're uncertain about specific cases, focus on legal principles and direct the student to appropriate research resources.`;

    const response = await getAnthropic().messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 4000,
      messages: [
        {
          role: 'user',
          content: fullPrompt,
        },
      ],
    });

    const content = response.content[0].type === 'text' 
      ? response.content[0].text 
      : '';

    const guardrails = await validateResponse(prompt, content, 'research');

    const filtered = guardrails.isHallucination || guardrails.isOffTopic ||
                    (!guardrails.isReliable && guardrails.confidence < 70);

    if (filtered) {
      return {
        content: 'This query requires careful research of primary legal sources. I recommend consulting: 1) The Constitution of Kenya 2010, 2) Relevant statutes from the Kenya Law Reports, 3) Recent Court of Appeal and Supreme Court decisions. Would you like help with research methodology instead?',
        guardrails,
        filtered: true,
      };
    }

    return {
      content,
      guardrails,
      filtered: false,
    };
  } catch (error) {
    console.error('AI generation error:', error);
    throw new Error('Failed to generate response');
  }
}

/**
 * Generate feedback for oral advocacy practice
 */
export async function generateOralAdvocacyFeedback(
  scenario: string,
  studentResponse: string
): Promise<AIResponse> {
  try {
    const fullPrompt = `${KENYA_LEGAL_CONTEXT}

Oral Advocacy Scenario: ${scenario}
Student's Response: ${studentResponse}

Provide constructive feedback on the student's oral advocacy including:
1. Legal accuracy and use of authorities
2. Structure and organization of argument
3. Persuasiveness and rhetoric
4. Court etiquette and professional conduct
5. Areas for improvement
6. Specific suggestions for bar exam standards

Be encouraging but thorough in your assessment.`;

    const response = await getAnthropic().messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 3000,
      messages: [
        {
          role: 'user',
          content: fullPrompt,
        },
      ],
    });

    const content = response.content[0].type === 'text' 
      ? response.content[0].text 
      : '';

    const guardrails = await validateResponse(scenario, content, 'oral');

    // Be more lenient with feedback filtering
    const filtered = guardrails.isHallucination && guardrails.confidence > 80;

    if (filtered) {
      return {
        content: 'I need more context to provide accurate feedback. Please provide more details about the legal issue and your argument structure.',
        guardrails,
        filtered: true,
      };
    }

    return {
      content,
      guardrails,
      filtered: false,
    };
  } catch (error) {
    console.error('AI generation error:', error);
    throw new Error('Failed to generate feedback');
  }
}

/**
 * Evaluate an essay or written response
 */
export async function evaluateEssayResponse(
  question: string,
  studentAnswer: string,
  rubric: any
): Promise<{ score: number; feedback: string; guardrails: AIGuardrails }> {
  try {
    const fullPrompt = `${KENYA_LEGAL_CONTEXT}

Question: ${question}
Student Answer: ${studentAnswer}
Marking Rubric: ${JSON.stringify(rubric)}

Evaluate this answer according to the rubric and Kenyan bar exam standards.
Provide:
1. A numerical score
2. Detailed feedback on strengths and weaknesses
3. Specific references to where the answer succeeds or fails
4. Suggestions for improvement

Format your response as JSON:
{
  "score": number,
  "feedback": "detailed feedback text",
  "strengths": ["strength1", "strength2"],
  "weaknesses": ["weakness1", "weakness2"],
  "suggestions": ["suggestion1", "suggestion2"]
}`;

    const response = await getAnthropic().messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 2000,
      messages: [
        {
          role: 'user',
          content: fullPrompt,
        },
      ],
    });

    const content = response.content[0].type === 'text' 
      ? response.content[0].text 
      : '';

    const guardrails = await validateResponse(question, content, 'research');

    // Extract JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const evaluation = JSON.parse(jsonMatch[0]);
      
      return {
        score: evaluation.score || 0,
        feedback: evaluation.feedback || content,
        guardrails,
      };
    }

    return {
      score: 0,
      feedback: content,
      guardrails,
    };
  } catch (error) {
    console.error('Evaluation error:', error);
    throw new Error('Failed to evaluate response');
  }
}
