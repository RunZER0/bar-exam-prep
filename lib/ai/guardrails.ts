import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { 
  getRelevantContext, 
  formatProvisionForContext, 
  formatCaseForContext,
  type LegalProvision,
  type CaseLaw 
} from '@/lib/knowledge/kenyan-law-base';
import {
  retrieveRAGContext,
  formatRAGContextForPrompt,
} from '@/lib/ai/embedding-service';
import {
  AGENT_TOOLS,
  executeAgentTool,
  getToolsForResponses,
} from '@/lib/ai/agent-tools';
import {
  ORCHESTRATOR_MODEL,
  MENTOR_MODEL,
  AUDITOR_MODEL,
  FAST_MODEL,
  SMART_CHAT_ROUTER_ENABLED,
  getAnthropicKey,
} from '@/lib/ai/model-config';
import { routeQuery } from '@/lib/ai/router';

let _openai: OpenAI | null = null;
const getOpenAI = () => {
  if (!_openai && process.env.OPENAI_API_KEY) {
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _openai;
};

let _anthropic: Anthropic | null = null;
const getAnthropic = () => {
  const key = getAnthropicKey();
  if (!_anthropic && key) {
    _anthropic = new Anthropic({ apiKey: key });
  }
  return _anthropic;
};

// Check if AI is configured
export const isAIConfigured = (): boolean => {
  return Boolean(process.env.OPENAI_API_KEY);
};

// Provider selection - OpenAI only
type AIProvider = 'openai' | 'none';
const getPreferredProvider = (): AIProvider => {
  if (process.env.OPENAI_API_KEY) return 'openai';
  return 'none';
};

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
 * CRITICAL: All responses MUST cite specific legal sources
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

=== MANDATORY CITATION REQUIREMENTS ===

EVERY legal statement you make MUST be grounded in a specific, verifiable source. Law is a precise discipline - vague references are unacceptable.

REQUIRED FORMAT FOR ALL LEGAL CLAIMS:

1. **Constitutional Provisions**: Always cite the specific Article and clause
   ✓ "Article 50(2)(a) of the Constitution of Kenya 2010"
   ✓ "Article 159(2)(c) of the Constitution"
   ✗ "According to the Constitution..." (TOO VAGUE - NEVER DO THIS)

2. **Statutory Provisions**: Always cite Section, Subsection, and Act name
   ✓ "Section 107(1) of the Evidence Act, Cap 80"
   ✓ "Section 23(1)(a) of the Law of Contract Act"
   ✓ "Order 39 Rule 1 of the Civil Procedure Rules"
   ✗ "The Evidence Act provides..." (TOO VAGUE - NEVER DO THIS)

3. **Case Law**: Always cite the case name, year, and court
   ✓ "Republic v Judicial Service Commission ex parte Pareno [2004] eKLR (High Court)"
   ✓ "Mumo Matemu v Trusted Society of Human Rights Alliance & 5 Others [2013] eKLR (Supreme Court)"
   ✗ "In a case, the court held..." (TOO VAGUE - NEVER DO THIS)

4. **Regulations & Rules**: Cite the specific rule/regulation number
   ✓ "Regulation 5(1) of the Advocates (Practice) Rules, 2014"
   ✓ "Rule 27 of the Supreme Court Rules"
   ✗ "The rules state..." (TOO VAGUE - NEVER DO THIS)

IF YOU CANNOT CITE A SPECIFIC SOURCE:
- Say: "I cannot identify the specific provision for this. The student should research [specific statute/topic] to find the applicable section."
- Do NOT make up citations
- Do NOT give vague references

CRITICAL RULES:
1. NEVER provide information that contradicts established Kenyan law
2. NEVER make up case citations or statutes
3. ALWAYS cite specific legal sources when making legal arguments
4. EVERY explanation must include the specific section/article number
5. If uncertain, acknowledge limitations and specify what to research
6. Focus on practical application relevant to Kenyan legal practice
7. Stay strictly within the scope of bar exam preparation
8. NEVER use em dashes (\u2014). Always use regular hyphens (-) instead

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
  // Skip validation if AI not configured
  if (!isAIConfigured()) {
    return {
      isHallucination: false,
      isOffTopic: false,
      isReliable: true,
      confidence: 75,
      warnings: [],
    };
  }
  
  try {
    // Cross-agent validation: use AUDITOR (Claude) to verify MENTOR (GPT) output
    const validationPrompt = `You are the AUDITOR — a Senior Partner reviewing AI-generated legal content for a Kenyan bar exam prep platform. Your role is to catch hallucinations, verify citations, and ensure accuracy.

User Query: ${prompt}
AI Response: ${response}
Context: ${context}

Evaluate this response for:
1. Factual accuracy regarding Kenyan law — are statutes/sections cited correctly?
2. Whether it contains hallucinated case law or statutes that don't exist
3. Relevance to the query and Kenyan bar exam
4. Potential misinformation that could harm a student's preparation
5. Whether citations are verifiable against real Kenyan legislation

Respond in JSON format ONLY:
{"isHallucination": boolean, "isOffTopic": boolean, "isReliable": boolean, "confidence": number, "warnings": ["..."], "reasoning": "..."}`;

    // Prefer AUDITOR (Claude) for cross-agent verification; fall back to self-validation
    let validationText: string;
    const anthropic = getAnthropic();
    if (anthropic) {
      try {
        const auditResponse = await anthropic.messages.create({
          model: AUDITOR_MODEL,
          max_tokens: 500,
          messages: [{ role: 'user', content: validationPrompt }],
          system: 'You are a legal accuracy auditor. Respond with JSON only, no markdown.',
        });
        const textBlock = auditResponse.content.find(b => b.type === 'text');
        validationText = textBlock && textBlock.type === 'text' ? textBlock.text : '';
        console.log('[Guardrails] Cross-agent validation: AUDITOR (Claude) verified MENTOR output');
      } catch (auditError) {
        console.warn('[Guardrails] AUDITOR unavailable, falling back to self-validation:', auditError);
        validationText = await callAI(validationPrompt, 1000);
      }
    } else {
      validationText = await callAI(validationPrompt, 1000);
    }
    
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
 *
 * Uses agentic tool-calling (web search + function tools) so the model can
 * ground its output in live Kenyan legal sources, dramatically reducing
 * hallucination and eliminating false-positive audit flags.
 */
export async function generateDraftingResponse(
  prompt: string,
  documentType: string
): Promise<AIResponse> {
  try {
    const fullPrompt = `${KENYA_LEGAL_CONTEXT}

The student is working on: ${documentType}
Student's request: ${prompt}

You have access to web search. USE IT to look up:
- The exact structure and format of a "${documentType}" under Kenyan law
- Relevant provisions from Kenyan statutes (Civil Procedure Rules, Constitution, etc.)
- Standard drafting conventions taught by the Council of Legal Education (CLE)

Then provide a detailed, accurate response with:
1. Proper legal structure and formatting for a "${documentType}"
2. SPECIFIC Kenyan law references (cite exact Section/Article numbers)
3. Practical guidance aligned with bar exam standards
4. Professional drafting conventions used in Kenyan legal practice

CITATION REQUIREMENTS FOR THIS RESPONSE:
- For every legal principle mentioned, cite the specific Section (e.g., "Section 3(1) of the Law of Contract Act")
- For constitutional rights, cite specific Articles (e.g., "Article 40(1) of the Constitution")
- For procedural requirements, cite specific Rules/Orders (e.g., "Order 1 Rule 3 of the Civil Procedure Rules")
- Do NOT use vague phrases like "the law provides" or "according to the Act"

If the student's request asks for a step-by-step guide or JSON format, follow those instructions precisely—do NOT refuse instructional content.

IMPORTANT: Only use real, verifiable Kenyan cases and statutes. If you don't know a specific provision, clearly state this and suggest where to find it.`;

    // Use agentic call with web search + function tools for grounded results
    const content = await callAIWithTools(fullPrompt);

    // Validate the response
    const guardrails = await validateResponse(prompt, content, 'drafting');

    // For drafting guidance, ONLY filter when the auditor is VERY confident
    // the content is fabricated (confidence > 85 means the auditor is sure).
    // Drafting prompts routinely trigger false-positive hallucination flags
    // because the auditor can't independently verify procedural conventions,
    // template structures, or formatting guidance — none of which is harmful.
    const isEgregiousHallucination =
      guardrails.isHallucination && guardrails.confidence > 85;

    if (isEgregiousHallucination) {
      // Even when filtered, return the content with a disclaimer rather than
      // replacing it entirely. A partial answer is always better than nothing.
      const disclaimer =
        '\n\n---\n> **Note:** Some details in this response could not be fully verified against primary Kenyan legal sources. Cross-check specific citations with the Kenya Law Reports (kenyalaw.org) or your CLE course materials before relying on them.';
      return {
        content: content + disclaimer,
        guardrails,
        filtered: true,
      };
    }

    return {
      content,
      guardrails,
      filtered: false,
    };
  } catch (error: any) {
    console.error('AI generation error:', error);
    if (error.message === 'AI_NOT_CONFIGURED') {
      throw new Error('AI_NOT_CONFIGURED');
    }
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

You have access to web search. USE IT to look up relevant Kenyan case law, statutes, and legal analysis from kenyalaw.org and other authoritative sources.

Provide a comprehensive research response that:
1. Identifies the key legal issues
2. References SPECIFIC Kenyan constitutional provisions (Article X, Clause Y)
3. Cites SPECIFIC statutory sections (Section X(1) of the Y Act)
4. Discusses applicable case law with FULL CITATIONS (Case Name [Year] eKLR, Court)
5. Provides legal analysis grounded in these specific sources
6. Suggests specific provisions to research further

CITATION FORMAT REQUIRED:
- Constitution: "Article 22(1) of the Constitution of Kenya 2010 provides that..."
- Statutes: "Under Section 4(2) of the Limitation of Actions Act, Cap 22..."
- Cases: "In Mwangi v Republic [2019] eKLR, the Court of Appeal held..."

DO NOT use vague phrases like "the law states" or "according to statute" without the specific section number.
If you cannot identify the specific provision, say so explicitly.`;

    // Use agentic call with web search for grounded legal research
    const content = await callAIWithTools(fullPrompt);

    const guardrails = await validateResponse(prompt, content, 'research');

    // Only filter when the auditor is highly confident the content is fabricated.
    // A bare isHallucination flag without high confidence is likely a false positive
    // (the auditor can't independently verify every Kenyan case citation).
    const filtered = (guardrails.isHallucination && guardrails.confidence > 85) ||
                    (guardrails.isOffTopic && guardrails.confidence > 80);

    if (filtered) {
      const disclaimer =
        '\n\n---\n> **Note:** Some citations in this response could not be fully verified. Cross-check with the Kenya Law Reports (kenyalaw.org) before relying on them.';
      return {
        content: content + disclaimer,
        guardrails,
        filtered: true,
      };
    }

    return {
      content,
      guardrails,
      filtered: false,
    };
  } catch (error: any) {
    console.error('AI generation error:', error);
    if (error.message === 'AI_NOT_CONFIGURED') {
      throw new Error('AI_NOT_CONFIGURED');
    }
    throw new Error('Failed to generate response');
  }
}

/**
 * RAG-Enhanced Study Response
 * Uses pgvector semantic search + hardcoded fallback for grounded, cited responses
 */
export async function generateStudyResponseWithRAG(
  prompt: string,
  unitId: string,
  unitName: string,
  statutes: string[]
): Promise<AIResponse & { sources: { provisions: LegalProvision[]; cases: CaseLaw[] } }> {
  try {
    // 1. Retrieve context via pgvector semantic search
    let ragContextText = '';
    try {
      const ragContext = await retrieveRAGContext(prompt, unitId);
      ragContextText = formatRAGContextForPrompt(ragContext);
    } catch (embeddingError) {
      console.warn('[RAG] Semantic search unavailable, falling back to keyword:', embeddingError);
    }

    // 2. Also get keyword-matched context as supplement (always works)
    const keywordContext = getRelevantContext(prompt, unitId);
    
    const provisionsContext = keywordContext.provisions.length > 0
      ? keywordContext.provisions.map(formatProvisionForContext).join('\n\n---\n\n')
      : '';
    
    const casesContext = keywordContext.cases.length > 0
      ? keywordContext.cases.map(formatCaseForContext).join('\n\n---\n\n')
      : '';
    
    const fullPrompt = `${KENYA_LEGAL_CONTEXT}

You are an expert Kenyan law tutor helping a student prepare for the bar examination.

Study Unit: ${unitName}
Relevant Statutes: ${statutes.join(', ')}

${ragContextText ? ragContextText + '\n' : ''}
===== SUPPLEMENTARY LEGAL PROVISIONS =====
${provisionsContext || 'No specific provisions retrieved. Use your knowledge of Kenyan law.'}

===== SUPPLEMENTARY CASE LAW =====
${casesContext || 'No specific cases retrieved. Focus on legal principles.'}

===== STUDENT'S QUESTION =====
${prompt}

===== INSTRUCTIONS =====
Provide a comprehensive, educational response that:

1. **Directly answers the question** with accurate Kenyan legal information  
2. **Cites SPECIFIC sections** - ALWAYS include the Section number (e.g., "Section 4(1) of the Evidence Act")
3. **References cases with FULL citations** - Include case name, year, and court (e.g., "[2019] eKLR (Court of Appeal)")
4. **Explains practical application** - how this applies in legal practice
5. **Highlights exam tips** - what bar examiners look for on this topic
6. **Connects related provisions** - cite the specific sections of related law
7. **PRIORITIZE the retrieved knowledge above** - cite those sources first

CITATION FORMAT (MANDATORY):
- Constitution: "Under Article 50(2)(a) of the Constitution of Kenya 2010..."
- Statute: "Section 107(1) of the Evidence Act, Cap 80 provides that..."
- Case: "In Kariuki v Republic [2015] eKLR, the High Court held..."
- Rules: "Order 39 Rule 1(a) of the Civil Procedure Rules..."

DO NOT provide any legal statement without citing the specific Section, Article, or Case.
If you cannot identify the exact provision, say: "The specific section should be verified in [Act name]."

Format your response clearly with headings and bullet points where appropriate.
Be thorough but focused. Aim for depth over breadth.`;

    const content = await callAI(fullPrompt, 4000);

    const guardrails = await validateResponse(prompt, content, 'research');

    const filtered = guardrails.isHallucination && guardrails.confidence > 85;

    if (filtered) {
      return {
        content: `I want to give you accurate information on this topic within ${unitName}. Let me focus on the verified legal principles:\n\n${keywordContext.provisions.length > 0 
          ? keywordContext.provisions.map(formatProvisionForContext).join('\n\n') 
          : 'For detailed provisions, please consult the ' + statutes.join(', ')}.${keywordContext.cases.length > 0 
          ? '\n\nRelevant cases include:\n' + keywordContext.cases.map(c => `- **${c.name}** ${c.citation}: ${c.ratio}`).join('\n') 
          : ''}\n\nWould you like me to explain any of these provisions in more detail?`,
        guardrails,
        filtered: true,
        sources: keywordContext,
      };
    }

    return {
      content,
      guardrails,
      filtered: false,
      sources: keywordContext,
    };
  } catch (error: any) {
    console.error('RAG study generation error:', error);
    if (error.message === 'AI_NOT_CONFIGURED') {
      throw new Error('AI_NOT_CONFIGURED');
    }
    throw new Error('Failed to generate study response');
  }
}

/**
 * Generate smart study suggestions based on user's weaknesses
 */
export async function generateSmartStudySuggestions(
  unitId: string,
  unitName: string,
  recentTopics: string[] = [],
  weakAreas: string[] = []
): Promise<{ suggestions: Array<{ topic: string; reason: string; prompt: string }> }> {
  try {
    const prompt = `You are helping a Kenyan bar exam student decide what to study in ${unitName}.

${weakAreas.length > 0 ? `The student has shown weakness in these areas: ${weakAreas.join(', ')}` : ''}
${recentTopics.length > 0 ? `They recently studied: ${recentTopics.join(', ')}` : ''}

Suggest 4 specific study topics that would be most beneficial. For each topic, provide:
1. The topic name (be specific, e.g., "Interlocutory Injunctions under Order 39" not just "Injunctions")
2. A brief reason why this is important (connect to bar exam or practice)
3. A starter prompt the student can use to begin studying

Format as JSON:
[
  {
    "topic": "Topic Name",
    "reason": "Why this is important for bar exam/practice",
    "prompt": "A good question to start learning this topic"
  }
]`;

    const content = await callAI(prompt, 2000);
    
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const suggestions = JSON.parse(jsonMatch[0]);
      return { suggestions };
    }

    // Default suggestions if parsing fails
    return {
      suggestions: [
        {
          topic: 'Key Concepts',
          reason: 'Foundation for understanding the entire unit',
          prompt: `What are the fundamental concepts I need to understand in ${unitName}?`,
        },
        {
          topic: 'Exam Hot Topics',
          reason: 'Frequently tested areas in bar examinations',
          prompt: `What topics in ${unitName} are most commonly tested in the Kenya bar exam?`,
        },
      ],
    };
  } catch (error) {
    console.error('Smart suggestions error:', error);
    return {
      suggestions: [
        {
          topic: 'Getting Started',
          reason: 'Build a strong foundation',
          prompt: `Give me an overview of ${unitName} and what I need to know for the bar exam.`,
        },
      ],
    };
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
1. Legal accuracy - did they cite SPECIFIC sections/articles correctly?
2. Structure and organization of argument (IRAC/ILAC method)
3. Persuasiveness and use of authorities (case law with proper citations)
4. Court etiquette under the Advocates Act and Professional Rules
5. Areas for improvement with SPECIFIC legal provisions they should cite
6. Specific suggestions for bar exam standards

In your feedback:
- Point out where specific citations were missing (e.g., "You mentioned constitutional rights but should cite Article 50(2)(a) specifically")
- Suggest exact provisions they should have referenced
- Model correct citation format

Be encouraging but thorough in your assessment.`;

    const content = await callAI(fullPrompt, 3000);

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
  } catch (error: any) {
    console.error('AI generation error:', error);
    if (error.message === 'AI_NOT_CONFIGURED') {
      throw new Error('AI_NOT_CONFIGURED');
    }
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

    const content = await callAI(fullPrompt, 2000);

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
  } catch (error: any) {
    console.error('Evaluation error:', error);
    if (error.message === 'AI_NOT_CONFIGURED') {
      throw new Error('AI_NOT_CONFIGURED');
    }
    throw new Error('Failed to evaluate response');
  }
}

/**
 * Generate context-aware response using conversation history
 * This is the AGENTIC path: AI gets access to tools and can autonomously
 * search the knowledge base, check student mastery, and find practice items.
 */
export async function generateContextAwareResponse(
  message: string,
  conversationHistory: { role: string; content: string }[],
  competencyType: 'clarification' | 'research' | 'drafting' | 'study',
  context?: any,
  attachments?: any[]
): Promise<AIResponse> {
  try {
    // Build conversation context
    const historyText = conversationHistory
      .slice(-10) // Last 10 messages for context window management
      .map(msg => `${msg.role === 'user' ? 'Student' : 'Assistant'}: ${msg.content}`)
      .join('\n\n');

    // Build attachment context for vision-capable models
    const attachmentContext = attachments?.length 
      ? `\n\nThe user has attached ${attachments.length} file(s) with their message. Please consider this context.`
      : '';

    // Pre-fetch RAG context for the current message
    let ragContextText = '';
    try {
      const ragContext = await retrieveRAGContext(message, context?.unitId);
      ragContextText = formatRAGContextForPrompt(ragContext);
    } catch {
      // Semantic search unavailable — tools will still work
    }

    const fullPrompt = `${KENYA_LEGAL_CONTEXT}

You are having a continuing conversation with a Kenyan law student. You have access to TOOLS that let you search the knowledge base, check student mastery, find practice questions, and look up lecture content. USE THESE TOOLS when you need to cite specific legal provisions, verify claims, or personalize recommendations.

=== CONVERSATION HISTORY ===
${historyText || '(This is the start of the conversation)'}

${ragContextText ? `=== PRE-RETRIEVED CONTEXT ===\n${ragContextText}\n` : ''}

=== CURRENT MESSAGE ===
${message}${attachmentContext}

=== INSTRUCTIONS ===
1. Reference previous messages when relevant
2. BUILD ON concepts already discussed — go deeper, not broader
3. Use your tools to search_knowledge_base when you need to cite specific provisions
4. Use search_related_skills to suggest what to study next
5. Use get_student_mastery to check the student's progress (if user ID available)
6. ALWAYS cite specific legal provisions (Articles, Sections, Cases)
7. If the retrieved context above answers the question, use it directly

Provide a helpful, context-aware response:`;

    // Use agentic tool-calling path for ALL conversation types
    // Tools let the AI search knowledge base, check mastery, find practice items etc.
    let content: string;
    try {
      content = await callAIWithTools(fullPrompt, {
        userId: context?.userId,
        unitId: context?.unitId,
      });
    } catch (toolError) {
      console.warn('[Guardrails] Tool-use path failed, falling back to routed AI:', toolError);
      // Fall back to smart-routed call (mini for simple, 5.2 for complex)
      if (SMART_CHAT_ROUTER_ENABLED) {
        const routed = await callAIRouted(fullPrompt, message, {
          competencyType,
          attachments: attachments?.map((a: any) => ({ type: a.type })),
        });
        content = routed.content;
      } else {
        content = await callAI(fullPrompt, 3000);
      }
    }

    const guardrails = await validateResponse(message, content, 'research');

    return {
      content,
      guardrails,
      filtered: guardrails.isHallucination && guardrails.confidence > 80,
    };
  } catch (error: any) {
    console.error('Context-aware generation error:', error);
    if (error.message === 'AI_NOT_CONFIGURED') {
      throw new Error('AI_NOT_CONFIGURED');
    }
    throw new Error('Failed to generate response');
  }
}

/**
 * Helper function to call AI provider (simple, no function tools)
 * Uses web_search_preview for grounding legal responses in real web sources.
 */
async function callAI(prompt: string, maxTokens: number = 2000): Promise<string> {
  const provider = getPreferredProvider();
  
  if (provider === 'none') {
    throw new Error('AI_NOT_CONFIGURED');
  }
  
  const openai = getOpenAI();
  if (!openai) {
    throw new Error('AI_NOT_CONFIGURED');
  }
  
  const response = await openai.responses.create({
    model: MENTOR_MODEL,
    input: prompt,
    tools: [{ type: 'web_search_preview' as const }],
  });
  
  return response.output_text || '';
}

/**
 * Routed AI call — uses the smart router to pick gpt-5-mini or gpt-5.2
 * based on query complexity. Used by the floating chat / Ask AI.
 */
export async function callAIRouted(
  prompt: string,
  message: string,
  options: { competencyType?: string; attachments?: Array<{ type: string }> } = {},
): Promise<{ content: string; route: string }> {
  const openai = getOpenAI();
  if (!openai) throw new Error('AI_NOT_CONFIGURED');

  // Route the query
  const decision = await routeQuery(message, openai, {
    competencyType: options.competencyType,
    attachments: options.attachments,
  });

  const model = decision.route === 'frontier' ? MENTOR_MODEL : FAST_MODEL;
  console.log(`[SmartChat] Route: ${decision.route} → ${model} (${decision.reason})`);

  const response = await openai.responses.create({
    model,
    input: prompt,
    tools: [{ type: 'web_search_preview' as const }],
  });

  return { content: response.output_text || '', route: decision.route };
}

/**
 * Agentic AI call with function-calling tools
 * Runs a multi-step tool-use loop: AI decides which tools to call,
 * we execute them and feed results back, until AI produces a final text response.
 * Max 5 tool rounds to prevent runaway loops.
 */
export async function callAIWithTools(
  prompt: string,
  options: {
    userId?: string;
    unitId?: string;
    maxToolRounds?: number;
  } = {}
): Promise<string> {
  const openai = getOpenAI();
  if (!openai) {
    throw new Error('AI_NOT_CONFIGURED');
  }

  const { maxToolRounds = 5 } = options;
  const functionTools = getToolsForResponses();

  // Combine function-calling tools with OpenAI's built-in web_search_preview
  // for grounding legal research in real web sources (kenyalaw.org, etc.)
  const tools: any[] = [
    { type: 'web_search_preview' as const },
    ...functionTools,
  ];

  // First call with tools
  let response = await openai.responses.create({
    model: ORCHESTRATOR_MODEL,
    input: prompt,
    tools,
  });

  // Multi-step tool-use loop
  let round = 0;
  while (round < maxToolRounds) {
    // Check if any function_call outputs exist
    const toolCalls = response.output.filter(
      (item: any) => item.type === 'function_call'
    ) as Array<{ type: 'function_call'; name: string; arguments: string; call_id: string }>;

    if (toolCalls.length === 0) break; // No more tool calls, we have a text response

    console.log(`[AgentTools] Round ${round + 1}: ${toolCalls.length} tool call(s)`);

    // Execute all tool calls in parallel for speed
    const toolResults: Array<{ type: 'function_call_output'; call_id: string; output: string }> = 
      await Promise.all(toolCalls.map(async (call) => {
        const args = typeof call.arguments === 'string'
          ? JSON.parse(call.arguments)
          : call.arguments;

        // Inject userId if the tool needs it and the user provided it
        if (options.userId && args && !args.user_id) {
          args.user_id = options.userId;
        }

        console.log(`[AgentTools] Calling: ${call.name}(${JSON.stringify(args).slice(0, 200)})`);
        const result = await executeAgentTool(call.name, args);
        
        return {
          type: 'function_call_output' as const,
          call_id: call.call_id,
          output: result,
        };
      }));

    // Feed tool results back to the model
    response = await openai.responses.create({
      model: ORCHESTRATOR_MODEL,
      input: toolResults,
      tools,
      previous_response_id: response.id,
    });

    round++;
  }

  return response.output_text || '';
}

/**
 * Fast AI call using gpt-5-mini for speed-critical generation
 * Used for preloading content in background where speed > quality
 */
export async function callAIFast(prompt: string, maxTokens: number = 2000): Promise<string> {
  const openai = getOpenAI();
  
  if (openai) {
    try {
      // Use FAST_MODEL for fast, cost-effective generation
      const response = await openai.responses.create({
        model: FAST_MODEL,
        input: prompt,
      });
      return response.output_text || '';
    } catch (error) {
      console.error('Fast AI error:', error);
    }
  }
  
  // Fallback to standard call
  return callAI(prompt, maxTokens);
}

/**
 * Generate structured JSON using fast model
 * Optimized for preloading exam questions
 */
export async function generateFastJSON<T>(prompt: string, maxTokens: number = 3000): Promise<T | null> {
  try {
    const response = await callAIFast(prompt, maxTokens);
    const jsonMatch = response.match(/\[\s*\{[\s\S]*\}\s*\]|\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]) as T;
    }
    return null;
  } catch (error) {
    console.error('Fast JSON generation error:', error);
    return null;
  }
}

/**
 * Generate legal banter and fun content
 */
export async function generateBanterResponse(prompt: string): Promise<AIResponse> {
  try {
    const fullPrompt = `You are a witty, knowledgeable legal entertainer helping Kenyan law students take a break from studying.

Your role is to provide:
- Legal jokes and puns (clean, professional)
- Fascinating legal facts from around the world
- Bizarre but real court cases
- Legal trivia and fun stories
- Pop culture references to law
- Historical legal oddities

Be entertaining, light-hearted, and factual. When mentioning real cases, ensure they actually happened.
Keep responses engaging and suitable for stressed law students who need a laugh.

User request: ${prompt}

Respond in a fun, conversational tone with appropriate humor.`;

    const content = await callAI(fullPrompt, 1500);

    // Banter doesn't need strict guardrails
    return {
      content,
      guardrails: {
        isHallucination: false,
        isOffTopic: false,
        isReliable: true,
        confidence: 90,
      },
      filtered: false,
    };
  } catch (error) {
    console.error('Banter generation error:', error);
    throw new Error('Failed to generate banter');
  }
}

/**
 * Generate response for clarification requests
 */
export async function generateClarificationResponse(
  prompt: string,
  hasAttachments: boolean = false
): Promise<AIResponse> {
  try {
    const attachmentContext = hasAttachments 
      ? "The user has attached materials (images, documents, or voice notes) for context."
      : "";

    const fullPrompt = `${KENYA_LEGAL_CONTEXT}

You are helping a Kenyan law student who needs clarification on something they find confusing or difficult to understand.

${attachmentContext}

Student's question/confusion: ${prompt}

Provide a clear, patient, and thorough explanation that:
1. Breaks down complex concepts into simpler terms
2. Uses analogies and examples relevant to Kenyan context
3. Connects to real-world legal practice with SPECIFIC provisions
4. Addresses the specific confusion
5. ALWAYS CITE the specific Section/Article being discussed
6. Suggests related provisions they should read

CITATION REQUIREMENT:
- Even when simplifying, always ground explanations in specific provisions
- Example: "Think of Article 47 (right to fair administrative action) like this... The specific requirements under Section 4 of the Fair Administrative Action Act include..."
- Never explain a legal concept without referencing the specific source

Be supportive and encouraging - remember they're seeking help because they're stuck.`;

    // Use smart router: gpt-5-mini for simple questions, gpt-5.2 for complex ones
    let content: string;
    if (SMART_CHAT_ROUTER_ENABLED) {
      const routed = await callAIRouted(fullPrompt, prompt, { competencyType: 'clarification' });
      content = routed.content;
    } else {
      content = await callAI(fullPrompt, 3000);
    }
    const guardrails = await validateResponse(prompt, content, 'research');

    return {
      content,
      guardrails,
      filtered: guardrails.isHallucination && guardrails.confidence > 80,
    };
  } catch (error) {
    console.error('Clarification generation error:', error);
    throw new Error('Failed to generate clarification');
  }
}

/**
 * Generate quiz questions dynamically
 */
export async function generateQuizQuestions(
  topic: string,
  count: number = 5,
  difficulty: 'beginner' | 'intermediate' | 'advanced' = 'intermediate'
): Promise<{ questions: any[]; guardrails: AIGuardrails }> {
  try {
    const fullPrompt = `${KENYA_LEGAL_CONTEXT}

Generate ${count} multiple-choice quiz questions about ${topic} for Kenyan bar exam preparation.
Difficulty level: ${difficulty}

Each question must:
1. Be factually accurate regarding Kenyan law
2. Have exactly 4 options (A, B, C, D)
3. Have one clearly correct answer
4. Include an explanation that CITES THE SPECIFIC LEGAL SOURCE

CRITICAL - EXPLANATION FORMAT:
The explanation MUST cite the specific Section, Article, or Case that supports the correct answer.
✓ GOOD: "Under Section 107(1) of the Evidence Act, Cap 80, the burden of proof lies on the party who would fail if no evidence were given."
✓ GOOD: "Article 50(2)(j) of the Constitution guarantees the right to have an advocate assigned at State expense."
✗ BAD: "The law provides that the burden of proof lies on the party making a claim." (TOO VAGUE)

Format as JSON array:
[
  {
    "question": "Question text?",
    "options": ["A) Option 1", "B) Option 2", "C) Option 3", "D) Option 4"],
    "correct": "A",
    "explanation": "Under Section X(Y) of the [Act Name]... OR Article X of the Constitution... OR In [Case Name] [Year] eKLR..."
  }
]`;

    const content = await callAI(fullPrompt, 4000);
    
    // Extract JSON array
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const questions = JSON.parse(jsonMatch[0]);
      return {
        questions,
        guardrails: {
          isHallucination: false,
          isOffTopic: false,
          isReliable: true,
          confidence: 85,
        },
      };
    }

    throw new Error('Failed to parse questions');
  } catch (error) {
    console.error('Quiz generation error:', error);
    throw new Error('Failed to generate quiz questions');
  }
}
