/**
 * Centralized AI Model Configuration
 * 
 * The Triumvirate:
 * - ORCHESTRATOR: GPT-5.2 (High-Reasoning) - Queue management, path selection
 * - MENTOR: GPT-5.2 (Mentorship Tone) - Narrative notes, instructional content
 * - AUDITOR: Claude Sonnet 4.6 - Redline engine, cascading failure analysis
 * 
 * MINIMUM MODEL FLOOR: gpt-5-mini — fast, cheap, reliable.
 */

// === Model Assignments (Hard-Locked) ===
export const ORCHESTRATOR_MODEL = process.env.ORCHESTRATOR_MODEL || 'gpt-5.2';
export const MENTOR_MODEL = process.env.MENTOR_MODEL || 'gpt-5.2';
export const AUDITOR_MODEL = process.env.AUDITOR_MODEL || 'claude-sonnet-4.6-20260312';

// === Assessment & Grading ===
export const ASSESSMENT_MODEL = process.env.ASSESSMENT_MODEL || 'gpt-5.2';
export const GRADING_MODEL = process.env.GRADING_MODEL || 'gpt-5.2';

// === Fast Operations (downgraded from gpt-5.2 to mini for cost savings) ===
export const FAST_MODEL = process.env.OPENAI_FAST_MODEL || 'gpt-5-mini';

// === Minimum Floor Model — fast & cheap for streaming, oral exams ===
export const MINI_MODEL = process.env.MINI_MODEL || 'gpt-5-mini';

// === Quiz Model — GPT-5.4-mini for structured JSON quiz generation ===
export const QUIZ_MODEL = process.env.QUIZ_MODEL || 'gpt-5.4-mini';

// === Quiz Auditor — validates every question for legal accuracy before delivery ===
export const QUIZ_AUDITOR_MODEL = process.env.QUIZ_AUDITOR_MODEL || 'gpt-5.4-mini';

// === Summary Model — non-reasoning model for session reports (must be fast, <30s on Render free) ===
export const SUMMARY_MODEL = process.env.SUMMARY_MODEL || 'gpt-4o-mini';

// === Router Model — lightweight model for smart routing decisions ===
export const ROUTER_MODEL = process.env.ROUTER_MODEL || 'gpt-5-mini';

// === Voice / Speech Models ===
export const TTS_MODEL = process.env.TTS_MODEL || 'gpt-4o-mini-tts';
export const TTS_MODEL_LEGACY = 'tts-1';
export const STT_MODEL = process.env.STT_MODEL || 'gpt-4o-mini-transcribe';
export const STT_MODEL_LEGACY = 'whisper-1';

// === Feature Flags ===
// Smart Chat Router: deterministic pre-checks + AI fallback to route between mini and 5.2
export const SMART_CHAT_ROUTER_ENABLED = process.env.SMART_CHAT_ROUTER_ENABLED !== 'false'; // on by default
// Clarify Router: same router for clarification mode
export const CLARIFY_ROUTER_ENABLED = process.env.CLARIFY_ROUTER_ENABLED !== 'false'; // on by default
// New TTS model (gpt-4o-mini-tts with instructions support)
export const NEW_TTS_ENABLED = process.env.NEW_TTS_ENABLED !== 'false'; // on by default
// New STT model (gpt-4o-mini-transcribe)
export const NEW_STT_ENABLED = process.env.NEW_STT_ENABLED !== 'false'; // on by default

// === AI Identity — injected into all system prompts ===
export const AI_IDENTITY = `IDENTITY — ABSOLUTE RULE: You are "Ynai Assistant" — the AI tutor powering the Ynai bar exam preparation platform. If ANYONE asks who you are, your name, what model you are, or who made you, you MUST respond: "I am Ynai Assistant, your AI-powered legal study companion built for Kenya School of Law students." NEVER say you are ChatGPT, GPT, Claude, OpenAI, Anthropic, or any other AI brand. You are Ynai Assistant. Period.`;

// === 2025 Oral Examination Themes (sourced from actual past oral exam questions) ===
export const ORAL_2025_THEMES = `
REAL 2025 KSL ORAL EXAMINATION THEMES — Use these to calibrate the depth and relevance of your questions:

PROFESSIONAL PRACTICE & ETHICS:
- Advocate-client privilege: scope, exceptions, when it can be waived
- Setting up a law firm: requirements under the Advocates Act, practising certificate, professional indemnity
- Advertising by advocates: LSK rules, restrictions, what is permissible
- Professional conduct: conflicts of interest, handling client funds, duties to the court
- Pupillage: requirements, obligations, supervisor responsibilities

CIVIL LITIGATION & PROCEDURE:
- Pleas and pleadings: types of pleas (dilatory vs peremptory), striking out pleadings, amendment of pleadings
- Injunctions: temporary/interlocutory injunctions (Giella v Cassman Brown test, American Cyanamide principles), permanent injunctions, constitutional injunctions (Mitubell Welfare Society v Kenya Airports Authority)
- Garnishee proceedings: procedure under Order 22 CPR, attachment of debts, garnishee absolute vs nisi
- Summary judgment and default judgment: grounds, procedure, setting aside
- Discovery and interrogatories, limitation of actions
- Appeals process, stay of execution pending appeal
- Costs and taxation of bills

CONVEYANCING & PROPERTY:
- Conveyancing process: completion, requisitions, land search, consents (Land Control Act, county government)
- Land registration: first registration, absolute vs qualified title
- Charges and mortgages: creation, statutory power of sale, equity of redemption
- Sectional properties: Sectional Properties Act 2020
- Easements and restrictions

CRIMINAL LITIGATION:
- Bail and bond: constitutional right to bail (Article 49), factors for/against, conditions
- Plea bargaining: procedure under the CPC, victim involvement
- Sentencing: principles, Muruatetu v Republic (mandatory death sentence), mitigating/aggravating factors
- Defamation: distinction between criminal and civil defamation, defences
- Burden and standard of proof, treatment of accomplice evidence

CONSTITUTIONAL LAW:
- Constitutional commissions: establishment, independence, functions (Chapter 15)
- BBI Advisory Opinion (2021): basic structure doctrine, constituent vs amending power
- Judicial review: grounds (illegality, irrationality, procedural impropriety), prerogative orders (certiorari, mandamus, prohibition)
- Bill of Rights: limitation of rights (Article 24), enforcement (Article 22/23)
- Devolution: county government disputes, intergovernmental relations

SUCCESSION & PROBATE:
- Grant of probate vs letters of administration: procedure, requirements
- Dependants and distribution: Law of Succession Act, matrimonial property considerations
- Revocation of grants, intermeddling, caveats
- Inheritance and surviving spouse rights

ALTERNATIVE DISPUTE RESOLUTION (ADR):
- Arbitration: Arbitration Act 1995, appointment of arbitrators, setting aside awards
- Mediation: court-annexed mediation, enforceability of mediation agreements
- Negotiation and conciliation, customary dispute resolution (Article 159(2)(c))

TRIAL ADVOCACY:
- Opening statements: structure, dos and don'ts
- Examination-in-chief: leading questions, refreshing memory, hostile witnesses
- Cross-examination: techniques, impeachment, prior inconsistent statements
- Re-examination: scope, when permitted
- Closing submissions: structure, persuasive techniques

KEY CASES TO KNOW (these are examples — do NOT fixate on any single case; rotate across ALL areas):
- Muruatetu v Republic (mandatory death sentence unconstitutional)
- BBI Advisory Opinion [2021] (basic structure doctrine)
- Anarita Karimi Njeru v Republic (locus standi, constitutional petitions)
- Giella v Cassman Brown (interlocutory injunctions test)
- American Cyanamide v Ethicon (balance of convenience)
- Mitubell Welfare Society v Kenya Airports Authority (constitutional injunctions)
- Katiba Institute v Attorney General (public interest litigation)
- Communications Authority v Royal Media Services (freedom of expression)
- Republic v Ahmad Abolfathi Mohammed (terrorism, fair trial rights)
- Macharia & Another v Kenya Commercial Bank (constitutional interpretation)

IMPORTANT: These themes are a reference pool. Each session should explore DIFFERENT themes — do not default to injunctions/Giella every time. Rotate across criminal, succession, conveyancing, ethics, commercial, trial advocacy, etc.
`;

// === API Key Getters ===
export function getOpenAIKey(): string | undefined {
  return process.env.OPENAI_API_KEY;
}

export function getAnthropicKey(): string | undefined {
  return process.env.ANTHROPIC_API_KEY;
}

// === Validation ===
export function validateModelConfig(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!process.env.OPENAI_API_KEY) errors.push('OPENAI_API_KEY not set');
  if (!process.env.ANTHROPIC_API_KEY) errors.push('ANTHROPIC_API_KEY not set');
  return { valid: errors.length === 0, errors };
}

// === Node State Machine ===
export type NodePhase = 'NOTE' | 'EXHIBIT' | 'DIAGNOSIS' | 'MASTERY';
export const NODE_PHASES: NodePhase[] = ['NOTE', 'EXHIBIT', 'DIAGNOSIS', 'MASTERY'];

export function getNextPhase(current: NodePhase): NodePhase | null {
  const idx = NODE_PHASES.indexOf(current);
  return idx < NODE_PHASES.length - 1 ? NODE_PHASES[idx + 1] : null;
}
