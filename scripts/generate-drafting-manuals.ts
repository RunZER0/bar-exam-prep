/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  YNAI Pre-Built Drafting Training Manuals Generator             ║
 * ║  Progressive session-based "Build a House" training courses     ║
 * ║  55 document types × 3 versions = 165 training courses          ║
 * ║  Each course: 6-8 sessions with exercises + grading rubrics     ║
 * ║  Uses o3 for highest-quality offline generation.                ║
 * ╚══════════════════════════════════════════════════════════════════╝
 * 
 * Structure per document type:
 *   Session 1: Foundation — understanding when/why to use this document
 *   Session 2: Anatomy — structure, format, skeleton
 *   Session 3: Fact Pattern Analysis — extracting material facts
 *   Sessions 4-5: Drafting Core Content (opening, body)
 *   Session 6: Closing & Formalities (filing, service, fees)
 *   Session 7: Full Draft Challenge (complete document from scratch)
 * 
 * Each session has:
 *   - Teaching content (prebuilt, stored)
 *   - Exercise with scenario_prompt (AI generates fresh scenarios at runtime)
 *   - Grading rubric (prebuilt, used by AI to grade student drafts)
 * 
 * Usage:
 *   npx tsx scripts/generate-drafting-manuals.ts
 *   npx tsx scripts/generate-drafting-manuals.ts --category pleadings
 *   npx tsx scripts/generate-drafting-manuals.ts --doc plaint
 *   npx tsx scripts/generate-drafting-manuals.ts --resume
 *   npx tsx scripts/generate-drafting-manuals.ts --version 2
 *   npx tsx scripts/generate-drafting-manuals.ts --dry-run
 * 
 * Versions:
 *   1 = "The Structured Instructor" — Step-by-step, structured approach
 *   2 = "The Practical Mentor" — Warm, practice-focused, exam-oriented
 *   3 = "The Expert Analyst" — Analytical, case-law-heavy, comparative
 */

import { neon } from '@neondatabase/serverless';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import OpenAI from 'openai';

// ═══════════════════════════════
// CONFIG
// ═══════════════════════════════

const GENERATION_MODEL = 'o3';
const RETRY_ATTEMPTS = 3;
const RETRY_DELAY_MS = 5000;

// ═══════════════════════════════
// ENV SETUP
// ═══════════════════════════════

const envPath = path.join(__dirname, '..', '.env');
let DATABASE_URL = '';
let OPENAI_API_KEY = '';

try {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  DATABASE_URL = envContent.match(/^DATABASE_URL=(.+)$/m)?.[1]?.trim() || '';
  OPENAI_API_KEY = envContent.match(/^OPENAI_API_KEY=(.+)$/m)?.[1]?.trim() || '';
} catch {
  DATABASE_URL = process.env.DATABASE_URL || '';
  OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
}

if (!DATABASE_URL) { console.error('❌ DATABASE_URL not found'); process.exit(1); }
if (!OPENAI_API_KEY) { console.error('❌ OPENAI_API_KEY not found'); process.exit(1); }

const sql = neon(DATABASE_URL);
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

// ═══════════════════════════════
// CLI ARGS
// ═══════════════════════════════

const args = process.argv.slice(2);
function getArg(name: string): string | null {
  const idx = args.indexOf(`--${name}`);
  if (idx === -1) return null;
  return args[idx + 1] || null;
}
const hasFlag = (name: string) => args.includes(`--${name}`);

const filterCategory = getArg('category');
const filterDoc = getArg('doc');
const filterVersion = getArg('version') ? Number(getArg('version')) : null;
const resumeMode = hasFlag('resume');
const dryRun = hasFlag('dry-run');

// ═══════════════════════════════
// ALL 53 DOCUMENT TYPES
// ═══════════════════════════════

interface DocumentType {
  id: string;
  name: string;
  description: string;
  category: string;
  categoryKey: string;
}

const LEGAL_DOCUMENT_TYPES: Record<string, { category: string; documents: { id: string; name: string; description: string }[] }> = {
  pleadings: {
    category: 'Pleadings & Court Documents',
    documents: [
      { id: 'plaint', name: 'Plaint', description: 'Originating document in a civil suit filed in the High Court or subordinate courts.' },
      { id: 'defence', name: 'Defence (Statement of Defence)', description: "Response to a plaint setting out the defendant's case." },
      { id: 'counterclaim', name: 'Counterclaim', description: 'A claim by the defendant against the plaintiff within the same suit.' },
      { id: 'reply-to-defence', name: 'Reply to Defence', description: "Plaintiff's response to new matters raised in the defence." },
      { id: 'petition', name: 'Petition', description: 'Originating document used in constitutional petitions, election petitions, and winding-up.' },
      { id: 'originating-summons', name: 'Originating Summons', description: 'Used to commence proceedings where there is unlikely to be a substantial dispute of fact.' },
      { id: 'chamber-summons', name: 'Chamber Summons', description: 'Application to court for interlocutory orders during pending proceedings.' },
      { id: 'notice-of-motion', name: 'Notice of Motion', description: 'Formal application to the court for an order, usually for interlocutory relief.' },
      { id: 'witness-statement', name: 'Witness Statement', description: 'Written evidence of a witness for use in civil proceedings.' },
    ],
  },
  affidavits: {
    category: 'Affidavits',
    documents: [
      { id: 'supporting-affidavit', name: 'Supporting Affidavit', description: 'Sworn statement supporting an application to court.' },
      { id: 'replying-affidavit', name: 'Replying Affidavit', description: "Sworn response to an opposing party's affidavit." },
      { id: 'supplementary-affidavit', name: 'Supplementary Affidavit', description: 'Additional sworn evidence on matters already covered.' },
      { id: 'affidavit-of-service', name: 'Affidavit of Service', description: 'Sworn proof that a document was served on a party.' },
      { id: 'statutory-declaration', name: 'Statutory Declaration', description: 'Declaration made under the Oaths and Statutory Declarations Act.' },
    ],
  },
  submissions: {
    category: 'Submissions & Arguments',
    documents: [
      { id: 'written-submissions', name: 'Written Submissions', description: 'Structured legal arguments filed before the court after hearing.' },
      { id: 'heads-of-argument', name: 'Heads of Argument', description: 'Summary points of argument used in oral advocacy.' },
      { id: 'skeleton-arguments', name: 'Skeleton Arguments', description: 'Brief outline of arguments used in appeals and complex matters.' },
    ],
  },
  contracts: {
    category: 'Contracts & Agreements',
    documents: [
      { id: 'sale-agreement', name: 'Sale Agreement', description: 'Contract for sale of goods or property between parties.' },
      { id: 'lease-agreement', name: 'Lease Agreement', description: 'Landlord-tenant agreement for use and occupation of premises.' },
      { id: 'employment-contract', name: 'Employment Contract', description: 'Agreement between employer and employee setting out terms of engagement.' },
      { id: 'partnership-deed', name: 'Partnership Deed', description: 'Agreement governing rights and obligations of business partners.' },
      { id: 'service-agreement', name: 'Service Agreement', description: 'Contract for provision of professional or commercial services.' },
      { id: 'nda', name: 'Non-Disclosure Agreement (NDA)', description: 'Confidentiality agreement between parties sharing sensitive information.' },
      { id: 'loan-agreement', name: 'Loan Agreement', description: 'Contract for lending and borrowing of money with repayment terms.' },
      { id: 'shareholders-agreement', name: 'Shareholders Agreement', description: 'Agreement among shareholders governing company management and share transfers.' },
    ],
  },
  conveyancing: {
    category: 'Conveyancing Documents',
    documents: [
      { id: 'transfer-instrument', name: 'Transfer Instrument', description: 'Document effecting transfer of registered land under the Land Registration Act.' },
      { id: 'charge-instrument', name: 'Charge Instrument', description: 'Document creating a charge (mortgage) over registered land.' },
      { id: 'discharge-of-charge', name: 'Discharge of Charge', description: 'Document releasing a charge upon satisfaction of the secured debt.' },
      { id: 'consent-to-transfer', name: 'Consent to Transfer', description: 'Application for land control board consent where required.' },
    ],
  },
  corporate: {
    category: 'Company/Corporate Documents',
    documents: [
      { id: 'memorandum-articles', name: 'Memorandum & Articles of Association', description: 'Constitutional documents of a company under the Companies Act 2015.' },
      { id: 'board-resolution', name: 'Board Resolution', description: 'Formal decision of the board of directors.' },
      { id: 'shareholder-resolution', name: 'Shareholder Resolution', description: 'Formal decision of shareholders in a general meeting or by written resolution.' },
      { id: 'minutes', name: 'Minutes of Meeting', description: 'Record of proceedings at board or shareholder meetings.' },
    ],
  },
  opinions: {
    category: 'Legal Opinions & Memoranda',
    documents: [
      { id: 'legal-opinion', name: 'Legal Opinion', description: 'Formal advice on a legal question addressed to a client.' },
      { id: 'legal-memorandum', name: 'Legal Memorandum', description: 'Internal research and analysis document within a law firm.' },
      { id: 'client-advisory', name: 'Client Advisory Letter', description: 'Letter advising a client on a legal matter and recommended course of action.' },
    ],
  },
  criminal: {
    category: 'Criminal Practice Documents',
    documents: [
      { id: 'charge-sheet', name: 'Charge Sheet', description: 'Document setting out criminal charges against an accused person.' },
      { id: 'bail-bond-application', name: 'Bail/Bond Application', description: 'Application to court for release of an accused on bail or bond.' },
      { id: 'plea-bargain', name: 'Plea Bargain Agreement', description: 'Negotiated agreement between prosecution and defence on plea and sentence.' },
      { id: 'mitigation', name: 'Mitigation', description: 'Submissions on sentencing aimed at reducing the sentence.' },
    ],
  },
  notices: {
    category: 'Notices & Correspondence',
    documents: [
      { id: 'demand-letter', name: 'Demand Letter', description: 'Formal letter demanding payment or action before litigation.' },
      { id: 'notice-to-admit', name: 'Notice to Admit Facts', description: 'Pre-trial notice requiring the other party to admit or deny facts.' },
      { id: 'notice-of-appeal', name: 'Notice of Appeal', description: 'Formal notice initiating an appeal against a court decision.' },
      { id: 'statutory-notice', name: 'Statutory Notice', description: 'Notice required by legislation before commencement of proceedings.' },
    ],
  },
  judgments: {
    category: 'Judgments & Court Orders',
    documents: [
      { id: 'judgment', name: 'Judgment', description: 'Final determination of a court on the merits of a case.' },
      { id: 'ruling', name: 'Ruling', description: 'Court decision on an interlocutory or procedural application.' },
      { id: 'decree', name: 'Decree', description: 'Formal expression of an adjudication that conclusively determines the rights of the parties.' },
      { id: 'court-order', name: 'Court Order', description: 'Directive issued by a court requiring a party to do or refrain from doing something.' },
      { id: 'consent-order', name: 'Consent Order', description: 'Order made by court with agreement of all parties.' },
      { id: 'injunction-order', name: 'Injunction Order', description: 'Court order restraining a party from performing a specified act or requiring performance.' },
      { id: 'garnishee-order', name: 'Garnishee Order', description: 'Order directing a third party to pay money owed to a judgment debtor directly to the judgment creditor.' },
    ],
  },
  adr: {
    category: 'ADR & Arbitration Documents',
    documents: [
      { id: 'arbitration-agreement', name: 'Arbitration Agreement', description: 'Agreement between parties to resolve disputes through arbitration.' },
      { id: 'statement-of-claim-arb', name: 'Statement of Claim (Arbitration)', description: "Initiating document in arbitration proceedings setting out the claimant's case." },
      { id: 'arbitral-award', name: 'Arbitral Award', description: 'Final decision of an arbitral tribunal on the matters in dispute.' },
      { id: 'mediation-agreement', name: 'Mediation Agreement', description: 'Agreement to mediate and terms governing the mediation process.' },
    ],
  },
};

function getAllDocuments(): DocumentType[] {
  const docs: DocumentType[] = [];
  for (const [key, cat] of Object.entries(LEGAL_DOCUMENT_TYPES)) {
    for (const d of cat.documents) {
      docs.push({
        id: d.id,
        name: d.name,
        description: d.description,
        category: cat.category,
        categoryKey: key,
      });
    }
  }
  return docs;
}

// ═══════════════════════════════
// VERSION PROFILES (3 for Drafting)
// ═══════════════════════════════

interface VersionProfile {
  number: number;
  personality: string;
  name: string;
  systemPrompt: string;
  temperature: number;
}

const VERSION_PROFILES: VersionProfile[] = [
  {
    number: 1,
    personality: 'structured',
    name: 'The Structured Instructor',
    temperature: 0.15,
    systemPrompt: `You are a senior Kenya School of Law instructor who has taught Legal Writing and Drafting for 20 years. You design PROGRESSIVE TRAINING COURSES that take students from zero knowledge to professional drafting competence through structured, session-based learning.

TEACHING PHILOSOPHY — "BUILD A HOUSE":
- Each training course is structured like building a house: foundation first, then walls, scaffolding, and finally the finished product.
- Every session teaches ONE specific skill with clear learning objectives.
- After every teaching section, the student IMMEDIATELY practices through a hands-on drafting exercise.
- Exercises escalate in complexity: Session 1 is conceptual, Sessions 2-3 are analytical, Sessions 4-6 are drafting-focused, Session 7 is a complete document draft.
- Students learn by DOING — reading specimen text, then drafting their own version, then receiving AI grading.

CONTENT APPROACH:
- Break the drafting process into clear, sequential steps that build on each other.
- For each step, explain: (1) what you're drafting, (2) why it matters legally, (3) how to write it properly, (4) common mistakes to avoid.
- Always start with the legal framework — which Act, Rules, or Practice Directions govern this document.
- Provide the EXACT format requirements (numbering, headings, margins, Court heading style) used in Kenyan practice.
- Quote verbatim from relevant legislation using blockquotes (>), especially the Civil Procedure Rules 2010, Criminal Procedure Code, Companies Act 2015, or whichever statute applies.
- Include specimen text/template language for EVERY part of the document — show the student exactly what good drafting looks like.
- Reference real cases where improper drafting led to rejection or striking out of documents.
- Flag mandatory requirements that MUST be included or the document will be rejected.

EXERCISE DESIGN:
- Every exercise must have a scenario_prompt that instructs an AI to generate a FRESH scenario each time (scenarios are never hardcoded).
- Exercises must be specific and actionable — not vague. "Draft paragraphs 4-8 setting out the cause of action" not "Write something about the case."
- Grading rubrics must be precise enough for consistent AI grading — each criterion with specific guidance on what earns marks.
- Total marks should reflect the exercise's complexity: conceptual (10), analytical (15), drafting sections (20), full draft (50).`,
  },
  {
    number: 2,
    personality: 'mentor',
    name: 'The Practical Mentor',
    temperature: 0.3,
    systemPrompt: `You are a practising Kenyan advocate with 25 years of experience who mentors pupil barristers through progressive drafting training. You teach by sharing real courtroom and chamber experience — what works, what doesn't, and why.

TEACHING PHILOSOPHY — "BUILD A HOUSE":
- You train pupils the way you were trained: start with understanding, then structure, then draft piece by piece, then put it all together.
- Each session is like a mentorship meeting in your chambers — focused, practical, and ending with "now you try it."
- Every session ends with a hands-on exercise that tests EXACTLY what was taught. No gaps between learning and doing.
- Exercises escalate from understanding → analysis → partial drafting → complete drafting.

CONTENT APPROACH:
- Teach as if walking a pupil through drafting in your chambers. Use "In my experience..." and "I've seen courts reject documents that..."
- Share practical tips from real practice: how registrars review documents, what judges expect, common registry rejections.
- Include the legal framework but focus on PRACTICAL application — the gap between what the textbook says and what actually happens in Kenyan courts.
- Provide complete specimen language but explain the thinking behind each choice.
- Discuss variations: how the document differs when filed in High Court vs. Magistrates' Court.
- Include filing requirements: court fees, number of copies, service requirements, timelines.
- Share exam tips: "In the ATP exam, examiners look for..." and "A common exam mistake is..."

EXERCISE DESIGN:
- Exercises should feel like real pupillage tasks: "Draft this for the client meeting tomorrow."
- Scenario prompts should produce realistic Kenyan practice scenarios — use Kenyan names, places, and legal contexts.
- Grading should reflect what a supervising partner would check: is this document court-ready?
- Include practical criteria: would a registrar accept this? Would opposing counsel find grounds to strike it out?`,
  },
  {
    number: 3,
    personality: 'analytical',
    name: 'The Expert Analyst',
    temperature: 0.2,
    systemPrompt: `You are a Kenyan legal drafting expert and published author on Kenyan civil and commercial practice. You design training courses that develop deep analytical understanding of legal drafting through case law analysis and statutory interpretation.

TEACHING PHILOSOPHY — "BUILD A HOUSE":
- Your training builds analytical depth progressively: understand the law → analyze the structure → dissect the requirements → draft with precision → produce the complete document.
- Each session adds a layer of analytical sophistication.
- Exercises don't just test drafting — they test UNDERSTANDING of WHY the document is drafted this way.
- The final session produces a document that could withstand the strictest judicial scrutiny.

CONTENT APPROACH:
- Anchor every drafting requirement to its legal source — cite the specific Rule, Act section, or Practice Direction.
- For each element, explain the case law that established the requirement.
- Include precedent language from leading cases — actual orders and formulations used by Kenyan courts.
- Discuss the relationship between this document and other documents in the process.
- Cover procedural aspects thoroughly: limitation periods, service requirements, fees, applicable court rules.
- Where the law is unsettled, discuss competing positions and identify the better view.

EXERCISE DESIGN:
- Exercises should test analytical depth alongside drafting skill.
- Include criteria that test whether the student understands the legal BASIS for each drafting choice.
- Scenario prompts should generate complex, multi-issue scenarios that require careful analysis.
- Grading rubrics should reward legal reasoning and citation, not just format compliance.`,
  },
];

// ═══════════════════════════════
// AUTHORITY FETCHING
// ═══════════════════════════════

async function fetchAuthoritiesForDocument(doc: DocumentType): Promise<string> {
  const searchTerms = doc.name.split(/[\s()]+/).filter(w => w.length > 2);
  const pattern = `%${searchTerms.slice(0, 3).join('%')}%`;
  const topTerm = `%${searchTerms[0]}%`;
  const contextParts: string[] = [];

  try {
    const authorities = await sql`
      SELECT title, citation, section_path, act_name, raw_text, source_type
      FROM authority_records
      WHERE title ILIKE ${pattern} OR act_name ILIKE ${topTerm}
         OR to_tsvector('english', title || ' ' || COALESCE(raw_text, '')) @@ websearch_to_tsquery('english', ${searchTerms.join(' & ')})
      ORDER BY CASE WHEN source_tier = 'A' THEN 0 WHEN source_tier = 'B' THEN 1 ELSE 2 END
      LIMIT 10
    `;
    for (const a of authorities) {
      const cite = a.citation ? ` (${a.citation})` : '';
      const text = a.raw_text ? `\nVERBATIM:\n${a.raw_text.slice(0, 1500)}` : '';
      contextParts.push(`[${a.source_type}] **${a.title}**${cite}${text}`);
    }
  } catch (e) {
    console.warn(`  ⚠ authority search failed: ${e}`);
  }

  try {
    const cases = await sql`
      SELECT title, citation, court_code, year
      FROM cases
      WHERE title ILIKE ${pattern} OR title ILIKE ${topTerm}
      ORDER BY year DESC NULLS LAST
      LIMIT 6
    `;
    for (const c of cases) {
      contextParts.push(`[CASE] **${c.title}** ${c.citation || ''} (${c.court_code || 'HC'}, ${c.year || 'n.d.'})`);
    }
  } catch (e) {
    console.warn(`  ⚠ cases search failed: ${e}`);
  }

  try {
    // Search for relevant statutes (Civil Procedure, Companies Act, etc.)
    const relevantStatutes = getRelatedStatutes(doc);
    for (const statute of relevantStatutes) {
      const statutes = await sql`
        SELECT name, chapter, full_text
        FROM statutes
        WHERE name ILIKE ${`%${statute}%`}
        LIMIT 2
      `;
      for (const s of statutes) {
        const text = s.full_text ? `\nSTATUTE TEXT (excerpt):\n${s.full_text.slice(0, 3000)}` : '';
        contextParts.push(`[STATUTE] **${s.name}** (${s.chapter || 'Cap.'})${text}`);
      }
    }
  } catch (e) {
    console.warn(`  ⚠ statutes search failed: ${e}`);
  }

  return contextParts.length > 0
    ? `SOURCE MATERIAL (from Kenya Law database):\n\n${contextParts.join('\n\n---\n\n')}`
    : 'No verified sources found in database. Use your training knowledge of Kenyan law. Only cite cases you are 100% certain exist.';
}

function getRelatedStatutes(doc: DocumentType): string[] {
  const categoryStatutes: Record<string, string[]> = {
    'Pleadings & Court Documents': ['Civil Procedure', 'Constitution of Kenya', 'Evidence Act'],
    'Affidavits': ['Civil Procedure', 'Oaths and Statutory', 'Evidence Act'],
    'Submissions & Arguments': ['Civil Procedure', 'Appellate Jurisdiction', 'Supreme Court Act'],
    'Contracts & Agreements': ['Law of Contract', 'Sale of Goods', 'Companies Act', 'Employment Act'],
    'Conveyancing Documents': ['Land Registration', 'Land Act', 'Stamp Duty', 'Land Control'],
    'Company/Corporate Documents': ['Companies Act', 'Business Registration', 'Insolvency Act'],
    'Legal Opinions & Memoranda': ['Advocates Act', 'Law Society', 'Professional Conduct'],
    'Criminal Practice Documents': ['Criminal Procedure', 'Penal Code', 'Bail and Bond'],
    'Notices & Correspondence': ['Civil Procedure', 'Limitation of Actions', 'Law Reform Act'],
    'Judgments & Court Orders': ['Civil Procedure', 'Criminal Procedure', 'Judicature Act'],
    'ADR & Arbitration Documents': ['Arbitration Act', 'Mediation Act', 'Nairobi Centre'],
  };
  return categoryStatutes[doc.category] || ['Civil Procedure'];
}

// ═══════════════════════════════
// MANUAL GENERATION
// ═══════════════════════════════

async function generateManualVersion(
  doc: DocumentType,
  version: VersionProfile,
  authorityContext: string
): Promise<{ sections: any[]; wordCount: number; inputTokens: number; outputTokens: number }> {

  const userPrompt = `Generate a PROGRESSIVE SESSION-BASED training manual for drafting a "${doc.name}" under Kenyan law.

DOCUMENT TYPE: ${doc.name}
CATEGORY: ${doc.category}
DESCRIPTION: ${doc.description}

${authorityContext}

═══════════════════════════════════════════
CRITICAL PEDAGOGICAL APPROACH — "BUILD A HOUSE"
═══════════════════════════════════════════

This manual is NOT a reference document. It is a PROGRESSIVE TRAINING COURSE structured like building a house:
- Session 1 = laying the foundation (understanding what this document IS)
- Sessions 2-5 = building the walls and scaffolding (learning to draft each part)
- Session 6 = the roof and finishing (closing formalities)
- Session 7 = the finished house (drafting the COMPLETE document from scratch)

Each session teaches ONE specific skill and IMMEDIATELY tests it with a hands-on exercise.
Students learn → draft → get graded → move to next skill. By Session 7, they have all the skills to draft the complete document independently.

═══════════════════════════════════════════
OUTPUT FORMAT
═══════════════════════════════════════════

Return ONLY a valid JSON array (no markdown fences, no commentary). Each element represents ONE training session:

{
  "id": "session-1",
  "session_number": 1,
  "title": "Session Title",
  "objective": "What the student will learn in this session",
  "content": "Detailed markdown teaching content for this session...",
  "exercise": {
    "type": "conceptual|structure|fact_analysis|draft_section|draft_prayer|practical|full_draft",
    "title": "Exercise Title",
    "instructions": "Clear, specific instructions for what the student must draft or answer",
    "skill_tested": "The specific drafting skill being assessed",
    "scenario_prompt": "A prompt that an AI can use to generate a FRESH, UNIQUE Kenyan legal scenario for this exercise each time. Be specific about what the scenario should contain — parties, facts, legal issues — so every generated scenario is realistic and tests the right skill. Include guidance like: 'Include [specific details]. The scenario should involve [specific legal situation]. Make the facts such that [specific drafting challenge].'"  ,
    "grading_rubric": [
      { "criterion": "Name of criterion", "max_marks": 5, "guidance": "What to look for when grading this criterion" }
    ],
    "total_marks": 10
  }
}

═══════════════════════════════════════════
REQUIRED SESSIONS (6-8 sessions)
═══════════════════════════════════════════

SESSION 1: FOUNDATION — Understanding ${doc.name}
- Content: What is this document? When is it used? Which Acts/Rules govern it? Its role in the broader legal process. Types/variations.
- Exercise type: "conceptual"
- Exercise: Given a scenario, identify whether this is the correct document to use and explain why (vs. alternatives).
- Marks: 10

SESSION 2: ANATOMY — Structure & Format  
- Content: The EXACT skeleton/structure. Court heading format (if applicable). Required sections/clauses. Numbering conventions. Formatting rules under Kenyan practice.
- Exercise type: "structure"
- Exercise: Given a scenario, set up the complete document skeleton — correct heading, parties, section headings — without drafting the substantive content yet.
- Marks: 15

SESSION 3: FACT PATTERN ANALYSIS
- Content: How to extract legally relevant facts from a client's narrative. What constitutes material facts vs. evidence vs. background. How to organize and sequence facts for this document type. What MUST be included or the document fails.
- Exercise type: "fact_analysis"
- Exercise: Given a client's story, identify and list the material facts in proper format for this document type.
- Marks: 15

SESSION 4: DRAFTING THE CORE (Part 1)
- Content: How to draft the opening/preliminary sections. Specimen language with explanations. Common mistakes. The "why" behind each drafting choice.
- Exercise type: "draft_section"
- Exercise: Given a scenario, draft the opening/preliminary sections of this document with proper legal language.
- Marks: 20

SESSION 5: DRAFTING THE CORE (Part 2)
- Content: How to draft the substantive body — the main claims/provisions/arguments/terms. Linking facts to law. Variations for different situations. Case law on what courts expect.
- Exercise type: "draft_section"
- Exercise: Given a scenario, draft the substantive body/core content of this document.
- Marks: 20

SESSION 6: CLOSING & FORMALITIES
- Content: Closing sections, signature blocks, verification (if applicable), prayers/relief (if applicable), filing requirements, court fees, service requirements, timelines, number of copies.
- Exercise type: "practical"
- Exercise: Draft the closing sections and identify all filing/service requirements for a specific court/registry.
- Marks: 10

SESSION 7: FULL DRAFT CHALLENGE  
- Content: Brief recap checklist of all skills learned. Common exam pitfalls. Quality standards. What examiners/registrars look for.
- Exercise type: "full_draft"
- Exercise: Draft the COMPLETE ${doc.name} from scratch based on a fresh scenario. This is the final test — the student must demonstrate mastery of all previous sessions.
- Marks: 50
- Grading rubric should cover ALL skills from Sessions 1-6.

Note: For simpler document types, you may combine sessions or reduce to 6 sessions. For complex ones, you may add an 8th session for advanced variations/nuances.

═══════════════════════════════════════════
QUALITY REQUIREMENTS
═══════════════════════════════════════════

FOR TEACHING CONTENT:
- Each session's content must be DETAILED and exam-quality — NOT general overviews.
- Include SPECIMEN TEXT for every part of the document. Use blockquotes (>) for verbatim statutory provisions and specimen language.
- Reference specific Rules (e.g., "Order 4 Rule 1(1) of the Civil Procedure Rules 2010"), Acts, and Practice Directions by their correct Kenyan titles.
- Include real case law where courts addressed drafting requirements (use [Year] eKLR citation format). Only cite cases you are 100% certain exist.
- Cover common mistakes and grounds for rejection/striking out.
- Use proper Markdown formatting: ### for headings, > for blockquotes, ** for bold, - for lists.
- Content must be accurate under current Kenyan law (post-2010 Constitution).
- Each session's teaching content should be 500-800 words.

FOR SCENARIO PROMPTS:
- The scenario_prompt is NOT the scenario itself — it is an INSTRUCTION that an AI will use to generate a fresh scenario each time the student does the exercise.
- Make scenario_prompt specific enough that every generated scenario will: (a) be realistic in Kenyan context, (b) test the right skill for this session, (c) include enough detail for the student to work with.
- Include guidance on what the scenario should contain: party types, legal issues, specific facts, amounts, locations, etc.
- For the full_draft exercise (Session 7), the scenario_prompt should generate a complete fact pattern with enough detail to draft the entire document.

FOR GRADING RUBRICS:
- Each rubric criterion must have specific "guidance" explaining what to look for.
- Marks should be specific and add up to the total_marks for that exercise.
- For draft exercises, include criteria like: legal accuracy, proper format, appropriate language, completeness, citation of relevant law.
- The grading_rubric must be detailed enough for an AI to consistently and fairly grade student responses.`;

  const promptHash = crypto.createHash('sha256').update(userPrompt).digest('hex').slice(0, 16);

  for (let attempt = 1; attempt <= RETRY_ATTEMPTS; attempt++) {
    try {
      const startTime = Date.now();
      // o3/o-series models don't support custom temperature
      const isReasoningModel = GENERATION_MODEL.startsWith('o');
      const completion = await openai.chat.completions.create({
        model: GENERATION_MODEL,
        messages: [
          { role: 'system', content: version.systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        ...(isReasoningModel ? {} : { temperature: version.temperature }),
      });

      const elapsed = Date.now() - startTime;
      const raw = completion.choices[0]?.message?.content || '';
      const inputTokens = completion.usage?.prompt_tokens || 0;
      const outputTokens = completion.usage?.completion_tokens || 0;

      // Parse the JSON array
      let sections: any[];
      try {
        const match = raw.match(/\[[\s\S]*\]/);
        sections = match ? JSON.parse(match[0]) : JSON.parse(raw);
      } catch (parseErr) {
        console.warn(`  ⚠ JSON parse failed (attempt ${attempt}/${RETRY_ATTEMPTS}): ${parseErr}`);
        if (attempt < RETRY_ATTEMPTS) {
          await delay(RETRY_DELAY_MS * attempt);
          continue;
        }
        throw new Error(`JSON parse failed after ${RETRY_ATTEMPTS} attempts`);
      }

      // Validate sessions
      if (!Array.isArray(sections) || sections.length < 5) {
        console.warn(`  ⚠ Only ${sections?.length || 0} sessions returned (attempt ${attempt}), need at least 6`);
        if (attempt < RETRY_ATTEMPTS) {
          await delay(RETRY_DELAY_MS * attempt);
          continue;
        }
      }

      // Ensure each session has required fields including exercise
      sections = sections.map((s: any, i: number) => ({
        id: s.id || `session-${i + 1}`,
        session_number: s.session_number || i + 1,
        title: s.title || `Session ${i + 1}`,
        objective: s.objective || '',
        content: s.content || '',
        exercise: s.exercise ? {
          type: s.exercise.type || 'draft_section',
          title: s.exercise.title || `Exercise ${i + 1}`,
          instructions: s.exercise.instructions || '',
          skill_tested: s.exercise.skill_tested || '',
          scenario_prompt: s.exercise.scenario_prompt || '',
          grading_rubric: Array.isArray(s.exercise.grading_rubric) ? s.exercise.grading_rubric : [],
          total_marks: s.exercise.total_marks || 10,
        } : null,
      }));

      // Validate exercises exist
      const sessionsWithExercises = sections.filter((s: any) => s.exercise && s.exercise.instructions);
      if (sessionsWithExercises.length < sections.length - 1) {
        console.warn(`  ⚠ Only ${sessionsWithExercises.length}/${sections.length} sessions have exercises (attempt ${attempt})`);
        if (attempt < RETRY_ATTEMPTS) {
          await delay(RETRY_DELAY_MS * attempt);
          continue;
        }
      }

      const wordCount = sections.reduce((sum: number, s: any) => sum + (s.content?.split(/\s+/).length || 0), 0);
      const exerciseCount = sessionsWithExercises.length;
      const totalMarks = sections.reduce((sum: number, s: any) => sum + (s.exercise?.total_marks || 0), 0);

      console.log(`    ✓ Generated ${sections.length} sessions, ${exerciseCount} exercises, ~${wordCount} words, ${totalMarks} total marks (${elapsed}ms, ${inputTokens}+${outputTokens} tokens)`);

      // Log generation
      try {
        await sql`
          INSERT INTO drafting_manuals_generation_log
            (document_type_id, version_number, model_used, prompt_tokens, completion_tokens, generation_time_ms, status)
          VALUES (${doc.id}, ${version.number}, ${GENERATION_MODEL}, ${inputTokens}, ${outputTokens}, ${elapsed}, 'success')
        `;
      } catch { /* log failure is not critical */ }

      return { sections, wordCount, inputTokens, outputTokens };

    } catch (err: any) {
      console.error(`  ✗ Attempt ${attempt}/${RETRY_ATTEMPTS} failed: ${err.message}`);

      // Log error
      try {
        await sql`
          INSERT INTO drafting_manuals_generation_log
            (document_type_id, version_number, model_used, status, error_message)
          VALUES (${doc.id}, ${version.number}, ${GENERATION_MODEL}, 'error', ${err.message?.slice(0, 500)})
        `;
      } catch { /* non-critical */ }

      if (attempt < RETRY_ATTEMPTS) {
        await delay(RETRY_DELAY_MS * attempt);
      } else {
        throw err;
      }
    }
  }

  throw new Error('Generation failed after all retries');
}

// ═══════════════════════════════
// MAIN PROCESSING
// ═══════════════════════════════

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log('═'.repeat(65));
  console.log('  YNAI PRE-BUILT DRAFTING MANUALS GENERATOR');
  console.log('═'.repeat(65));

  // Ensure tables exist
  console.log('\n📋 Ensuring migration tables exist...');
  try {
    // Check if the main table exists
    const tableCheck = await sql`
      SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'prebuilt_drafting_manuals') as exists
    `;
    if (!tableCheck[0].exists) {
      const migrationSql = fs.readFileSync(
        path.join(__dirname, '..', 'drizzle', '0007_prebuilt_drafting_manuals.sql'),
        'utf-8'
      );
      // Strip comments, split by semicolons, execute each
      const cleaned = migrationSql.replace(/--[^\n]*/g, '');
      const statements = cleaned.split(';').map(s => s.trim()).filter(s => s.length > 0);
      for (const stmt of statements) {
        await sql`${sql.unsafe(stmt)}`;
      }
    }
    console.log('  ✓ Tables ready');
  } catch (err: any) {
    console.error('  ✗ Migration error:', err.message);
    process.exit(1);
  }

  // Get all document types, applying filters
  let documents = getAllDocuments();
  console.log(`\n📜 Total document types: ${documents.length}`);

  if (filterCategory) {
    documents = documents.filter(d => d.categoryKey === filterCategory);
    console.log(`  Filtered by category "${filterCategory}": ${documents.length} documents`);
  }
  if (filterDoc) {
    documents = documents.filter(d => d.id === filterDoc);
    console.log(`  Filtered by doc "${filterDoc}": ${documents.length} documents`);
  }

  const versions = filterVersion
    ? VERSION_PROFILES.filter(v => v.number === filterVersion)
    : VERSION_PROFILES;

  const totalJobs = documents.length * versions.length;
  console.log(`  Versions per document: ${versions.map(v => v.number).join(', ')}`);
  console.log(`  Total generation jobs: ${totalJobs}`);

  if (dryRun) {
    console.log('\n🔍 DRY RUN — listing all jobs:\n');
    for (const doc of documents) {
      for (const ver of versions) {
        console.log(`  ${doc.categoryKey}/${doc.id} v${ver.number} (${ver.name})`);
      }
    }
    console.log(`\nTotal: ${totalJobs} manuals to generate`);
    console.log('(Remove --dry-run to execute)');
    return;
  }

  // Check what already exists (for resume mode)
  let existingSet = new Set<string>();
  if (resumeMode) {
    const existing = await sql`
      SELECT document_type_id, version_number FROM prebuilt_drafting_manuals WHERE is_active = true
    `;
    existingSet = new Set(existing.map((r: any) => `${r.document_type_id}:${r.version_number}`));
    console.log(`  Resume mode: ${existingSet.size} existing manuals found, will skip`);
  }

  // Process
  let completed = 0;
  let skipped = 0;
  let failed = 0;
  const startAll = Date.now();

  for (const doc of documents) {
    console.log(`\n${'─'.repeat(60)}`);
    console.log(`📄 ${doc.category} → ${doc.name} (${doc.id})`);

    // Fetch authorities once per document
    console.log('  🔍 Fetching authority context...');
    const authorityContext = await fetchAuthoritiesForDocument(doc);
    const hasAuthorities = !authorityContext.includes('No verified sources');
    console.log(`  ${hasAuthorities ? '✓ Authorities found' : '⚠ No authorities — using training knowledge'}`);

    for (const version of versions) {
      const key = `${doc.id}:${version.number}`;

      if (resumeMode && existingSet.has(key)) {
        console.log(`  v${version.number} (${version.name}) — SKIP (exists)`);
        skipped++;
        completed++;
        continue;
      }

      console.log(`  v${version.number} (${version.name})...`);

      try {
        const result = await generateManualVersion(doc, version, authorityContext);

        // Upsert into database
        await sql`
          INSERT INTO prebuilt_drafting_manuals
            (document_type_id, category, document_name, version_number, sections_json, section_count,
             personality, word_count, model_used, is_active)
          VALUES (
            ${doc.id}, ${doc.category}, ${doc.name}, ${version.number},
            ${JSON.stringify(result.sections)}::jsonb, ${result.sections.length},
            ${version.personality}, ${result.wordCount}, ${GENERATION_MODEL}, true
          )
          ON CONFLICT (document_type_id, version_number)
          DO UPDATE SET
            sections_json = EXCLUDED.sections_json,
            section_count = EXCLUDED.section_count,
            word_count = EXCLUDED.word_count,
            model_used = EXCLUDED.model_used,
            updated_at = NOW()
        `;

        completed++;
        console.log(`    ✓ Saved to database (${completed}/${totalJobs})`);

      } catch (err: any) {
        failed++;
        completed++;
        console.error(`    ✗ FAILED: ${err.message}`);
      }

      // Brief pause between generations to avoid rate limits
      await delay(1000);
    }
  }

  // Final report
  const totalTime = ((Date.now() - startAll) / 1000).toFixed(1);
  console.log('\n' + '═'.repeat(65));
  console.log('  GENERATION COMPLETE');
  console.log('═'.repeat(65));
  console.log(`  Documents processed: ${documents.length}`);
  console.log(`  Manuals generated:   ${completed - skipped - failed}`);
  console.log(`  Skipped (existing):  ${skipped}`);
  console.log(`  Failed:              ${failed}`);
  console.log(`  Total time:          ${totalTime}s`);

  // Verify final count
  const [count] = await sql`SELECT COUNT(*) as total FROM prebuilt_drafting_manuals WHERE is_active = true`;
  console.log(`  Database total:      ${count.total} active manuals`);
  console.log('═'.repeat(65));
}

main().catch(err => {
  console.error('\n💀 Fatal error:', err);
  process.exit(1);
});
