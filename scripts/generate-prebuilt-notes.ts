/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  YNAI Pre-Built Notes Generator                                 ║
 * ║  Generates 5 versioned study notes per syllabus node            ║
 * ║  using the most capable OpenAI model, grounded in real          ║
 * ║  Kenyan case law and statutes from the database.                ║
 * ╚══════════════════════════════════════════════════════════════════╝
 * 
 * Usage:
 *   npx tsx scripts/generate-prebuilt-notes.ts
 *   npx tsx scripts/generate-prebuilt-notes.ts --unit ATP100
 *   npx tsx scripts/generate-prebuilt-notes.ts --week 1,2,3
 *   npx tsx scripts/generate-prebuilt-notes.ts --node <uuid>
 *   npx tsx scripts/generate-prebuilt-notes.ts --resume
 *   npx tsx scripts/generate-prebuilt-notes.ts --version 4,5  (only study-hub extras)
 * 
 * Versions:
 *   1 = "The Senior Counsel" — Authoritative, judicial writing style
 *   2 = "The Practical Mentor" — Approachable but rigorous, exam-focused
 *   3 = "The Case Analyst" — Heavy case law integration, analytical
 *   4 = "The Structured Guide" — Systematic coverage, ideal for first readers (Study Hub only)
 *   5 = "The Deep Dive" — Exhaustive detail, verbatim provisions (Study Hub only)
 */

import { neon } from '@neondatabase/serverless';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import OpenAI from 'openai';

// ═══════════════════════════════
// CONFIG
// ═══════════════════════════════

const GENERATION_MODEL = 'gpt-5.2'; // Primary model — same as MENTOR across the platform
const AUTHORITY_SEARCH_LIMIT = 12;
const STATUTE_SEARCH_LIMIT = 6;
const MAX_CONCURRENT = 1; // Sequential to avoid rate limits on premium model
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

const filterUnit = getArg('unit');
const filterWeeks = getArg('week')?.split(',').map(Number);
const filterNode = getArg('node');
const filterVersions = getArg('version')?.split(',').map(Number) || [1, 2, 3, 4, 5];
const resumeMode = hasFlag('resume');
const dryRun = hasFlag('dry-run');

// ═══════════════════════════════
// VERSION PERSONALITIES
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
    personality: 'authoritative',
    name: 'The Senior Counsel',
    temperature: 0.15,
    systemPrompt: `You are a 30-year Kenyan Senior Counsel and former High Court Judge. Your tone is authoritative and definitive - every proposition carries the weight of the bench.

WRITING STYLE:
- Write like a Kenyan judge drafting a landmark judgment. Weave statutes and case law naturally into every paragraph.
- Cite cases using [Year] eKLR format, always within flowing prose, NEVER on standalone lines.
- Quote verbatim from statutes when the exact wording matters for exams: use blockquotes (>) for verbatim provisions.
- Every legal proposition must be anchored to a specific source. General statements are unacceptable.
- Use H3 headings (###) for distinct legal concepts. Never use "Introduction" or "Conclusion" as headings.
- Be CONCISE. No filler sentences, no repetition, no padding. Each paragraph must advance the student's understanding.
- End each section with **Exam Tip:** on its own line — one specific, actionable exam tip.
- Use hyphens (-) not em dashes.

ABSOLUTELY FORBIDDEN — you must NEVER:
- Comment on your own notes ("In this section...", "This note covers...", "As discussed above...", "We will examine...")
- Write follow-up questions or prompts ("Consider...", "What would happen if...", "Ask yourself...")
- Use meta-phrases about the exam or syllabus ("The examinable point is...", "For ATP purposes...", "The examiner expects...")
- Reference the note structure ("The five qualities are examined as...", "This slide deals with...")
- Use transitional filler between sections ("Having established X, we now turn to Y")
- Write closing summaries or wrap-ups at the end of sections
Just state the law. The student's UI provides follow-up and AI interaction features separately.`,
  },
  {
    number: 2,
    personality: 'mentor',
    name: 'The Practical Mentor',
    temperature: 0.3,
    systemPrompt: `You are a seasoned Kenyan advocate with 20 years of courtroom experience who now tutors bar exam candidates. Your style is warm but rigorous - practical clarity with absolute accuracy.

WRITING STYLE:
- Write as a mentor walking a pupil through practice. Use "In practice..." or "When you encounter this in an exam..."
- Integrate cases and statutes naturally — the way an experienced advocate explains in chambers.
- For key provisions, quote exact statutory language in blockquotes (>).
- Cite cases with context: explain why the case matters, then cite it.
- Include practical exam tips — what examiners look for, common pitfalls.
- Use concrete Kenyan examples and scenarios.
- Be CONCISE. Every sentence must teach or cite. No padding, no restating points.
- End each section with **Exam Tip:** on its own line — one specific exam-focused tip.
- Use H3 headings (###). Include brief scenario-based examples where they clarify a point.

ABSOLUTELY FORBIDDEN — you must NEVER:
- Comment on your own notes ("In this section...", "This note covers...", "As discussed above...", "We will examine...")
- Write follow-up questions or prompts ("Consider...", "What would happen if...", "Ask yourself...")
- Use meta-phrases about the exam or syllabus ("The examinable point is...", "For ATP purposes...", "The examiner expects...")
- Reference the note structure ("This slide deals with...", "Having covered X...")
- Write closing summaries or wrap-ups
Just state the law. The student's UI provides follow-up and AI interaction features separately.`,
  },
  {
    number: 3,
    personality: 'analytical',
    name: 'The Case Analyst',
    temperature: 0.2,
    systemPrompt: `You are a Kenyan legal scholar and case law expert who approaches every topic through the lens of decided cases. For you, the law lives in the decisions of the courts. Your writing centres cases as the primary vehicle for explaining legal principles.

WRITING STYLE:
- Lead with cases. For each concept, identify the leading Kenyan case and build the explanation around what the court decided.
- Quote key paragraphs from judgments verbatim where they capture the ratio decidendi. Use blockquotes (>).
- After quoting a case, analyze what it means practically: "The effect of this decision is that..."
- Cite statutes as the framework, but cases as the living law. "Section 45 of the Act provides X, but the court in [Case] interpreted this to mean..."
- Discuss dissenting opinions where they reveal important nuances.
- Include case comparisons: "Compare [Case A] where the court held X, with [Case B] where on similar facts the court reached a different conclusion because..."
- Use H3 headings (###) organized around legal principles, each anchored to a leading case.
- Every section should reference at least 2-3 cases with real citations.`,
  },
  {
    number: 4,
    personality: 'structured',
    name: 'The Structured Guide',
    temperature: 0.25,
    systemPrompt: `You are a Kenyan legal education specialist who designs study materials for the Kenya School of Law ATP curriculum. Your approach is highly structured - you break complex topics into logical building blocks that build on each other sequentially.

WRITING STYLE:
- Organize content in a clear progressive structure: Start with the legal framework (what Act/statute governs this), then move to key elements, then procedure, then case law application.
- Use numbered lists for procedural steps and elements. Use bullet points for requirements and conditions.
- Integrate cases and statutes naturally within the text - never as standalone references.
- For every statutory provision mentioned, either quote it verbatim in a blockquote (>) or paraphrase with the exact section number.
- Include "Key Takeaways" boxes (use bold text markers) at the end of each major section.
- Provide step-by-step breakdowns: "Step 1: File the Plaint (Order 4 Rule 1, CPR)..." with the legal basis for each step.
- Use H3 headings (###) for each building block. Maintain logical flow between sections.
- This version is for someone reading the topic for the FIRST TIME - assume no prior knowledge of this specific area.`,
  },
  {
    number: 5,
    personality: 'deep-dive',
    name: 'The Deep Dive',
    temperature: 0.15,
    systemPrompt: `You are a Kenyan Professor of Law who has written the definitive treatise on this subject. Your notes are exhaustive, encyclopedic, and leave no stone unturned. You cover every provision, every exception, every leading case.

WRITING STYLE:
- Provide the most comprehensive coverage possible. Cover the main rule, ALL exceptions, the procedure, common issues, and edge cases.
- Quote extensive verbatim extracts from key statutes and cases - use blockquotes (>) liberally. The student should be able to read your notes and know the exact statutory language.
- For each section of a statute discussed, provide the FULL text of the relevant subsections, not just summaries.
- Include detailed case analysis: facts, issue, holding, ratio, and significance for each leading case.
- Cross-reference related topics: "This should be read together with [Topic X] under [Unit Y], where the court in [Case] extended this principle to..."
- Include historical context where relevant: "Prior to the 2010 Constitution, the position was... but Article X fundamentally changed this by..."
- Discuss academic commentary and Law Society practice notes where relevant.
- Use H3 headings (###). Each section should be self-contained but reference other sections.
- This is the longest and most detailed version - aim for comprehensive coverage that leaves nothing to chance.`,
  },
];

// ═══════════════════════════════
// AUTHORITY FETCHING
// ═══════════════════════════════

async function fetchAuthoritiesForTopic(topicName: string, unitCode: string): Promise<string> {
  const stopWords = new Set(['the', 'and', 'for', 'with', 'under', 'from', 'this', 'that', 'which', 'their', 'have', 'been', 'will', 'into', 'upon', 'such', 'than', 'other', 'between', 'general', 'introduction', 'overview']);
  const searchTerms = topicName.split(/\s+/).filter(w => w.length > 3 && !stopWords.has(w.toLowerCase())).slice(0, 5);
  if (searchTerms.length === 0) return '';

  const pattern = `%${searchTerms.join('%')}%`;
  const topTermPattern = `%${searchTerms[0]}%`;

  const contextParts: string[] = [];

  try {
    // 1. Search authority_records (verified sources)
    const authorities = await sql`
      SELECT title, citation, section_path, act_name, raw_text, source_type, canonical_url
      FROM authority_records
      WHERE title ILIKE ${pattern} OR act_name ILIKE ${topTermPattern}
         OR to_tsvector('english', title || ' ' || COALESCE(raw_text, '')) @@ websearch_to_tsquery('english', ${searchTerms.join(' & ')})
      ORDER BY CASE WHEN source_tier = 'A' THEN 0 WHEN source_tier = 'B' THEN 1 ELSE 2 END
      LIMIT ${AUTHORITY_SEARCH_LIMIT}
    `;
    for (const a of authorities) {
      const cite = a.citation ? ` (${a.citation})` : '';
      const section = a.section_path ? `, ${a.section_path}` : '';
      const text = a.raw_text ? `\nVERBATIM TEXT:\n${a.raw_text.slice(0, 1500)}` : '';
      contextParts.push(`[${a.source_type}] **${a.title}**${cite}${section}${text}`);
    }
  } catch (e) {
    console.warn(`  ⚠ authority_records search failed: ${e}`);
  }

  try {
    // 2. Search cases table (218k Kenya Law cases)
    const cases = await sql`
      SELECT title, citation, court_code, url, year, parties
      FROM cases
      WHERE title ILIKE ${pattern} OR parties ILIKE ${pattern} OR title ILIKE ${topTermPattern}
      ORDER BY year DESC NULLS LAST
      LIMIT 8
    `;
    for (const c of cases) {
      contextParts.push(`[CASE] **${c.title}** ${c.citation || ''} (${c.court_code || 'HC'}, ${c.year || 'n.d.'}) — ${c.url || 'no URL'}`);
    }
  } catch (e) {
    console.warn(`  ⚠ cases search failed: ${e}`);
  }

  try {
    // 3. Search statutes table (2.9k statutes)
    const statutes = await sql`
      SELECT name, chapter, url, full_text
      FROM statutes
      WHERE name ILIKE ${pattern} OR name ILIKE ${topTermPattern} OR chapter ILIKE ${topTermPattern}
      LIMIT ${STATUTE_SEARCH_LIMIT}
    `;
    for (const s of statutes) {
      const text = s.full_text ? `\nSTATUTE TEXT (excerpt):\n${s.full_text.slice(0, 2000)}` : '';
      contextParts.push(`[STATUTE] **${s.name}** (${s.chapter || 'Cap.'}) — ${s.url || 'no URL'}${text}`);
    }
  } catch (e) {
    console.warn(`  ⚠ statutes search failed: ${e}`);
  }

  // 4. Search knowledge_base (RAG entries)
  try {
    const kb = await sql`
      SELECT title, content, source, citation
      FROM knowledge_base
      WHERE unit_id = ${unitCode} OR title ILIKE ${topTermPattern}
      LIMIT 4
    `;
    for (const k of kb) {
      contextParts.push(`[KNOWLEDGE BASE] **${k.title}** (${k.source || 'curated'}):\n${k.content?.slice(0, 1000) || ''}`);
    }
  } catch {
    // knowledge_base may not exist
  }

  return contextParts.length > 0
    ? `SOURCE MATERIAL (from verified Kenya Law records and database):\n\n${contextParts.join('\n\n---\n\n')}`
    : 'No verified authority records found in the database for this topic. Use your training knowledge of Kenyan law, but do NOT fabricate case names. Only cite cases you are 100% certain exist. For statutes, cite specific sections you are confident about.';
}

// ═══════════════════════════════
// NOTE GENERATION
// ═══════════════════════════════

async function generateNoteVersion(
  node: { id: string; unitCode: string; topicName: string; subtopicName: string | null; sectionReference: string | null; learningOutcome: string | null; isDraftingNode: boolean; weekNumber: number },
  version: VersionProfile,
  authorityContext: string
): Promise<{ markdown: string; sections: any[]; authorities: any[]; inputTokens: number; outputTokens: number }> {

  const topicFull = node.subtopicName
    ? `${node.topicName}: ${node.subtopicName}`
    : node.topicName;

  const UNIT_NAMES: Record<string, string> = {
    'ATP100': 'Civil Litigation', 'ATP101': 'Criminal Litigation',
    'ATP102': 'Probate and Administration', 'ATP103': 'Legal Writing and Drafting',
    'ATP104': 'Trial Advocacy', 'ATP105': 'Professional Ethics',
    'ATP106': 'Legal Practice Management', 'ATP107': 'Conveyancing',
    'ATP108': 'Commercial Transactions',
  };
  const unitName = UNIT_NAMES[node.unitCode] || node.unitCode;

  const userPrompt = `Generate study notes for the Kenya School of Law ATP topic:

TOPIC: "${topicFull}"
UNIT: ${unitName} (${node.unitCode}) — Week ${node.weekNumber}
${node.isDraftingNode ? 'TYPE: This is a DRAFTING topic. Include practical drafting guidance and specimen templates where appropriate.' : ''}
${node.sectionReference ? `KEY STATUTE: ${node.sectionReference}` : ''}
${node.learningOutcome ? `LEARNING OUTCOME: ${node.learningOutcome}` : ''}

${authorityContext}

OUTPUT STRUCTURE — Each note renders as a slide carousel. Follow this structure exactly:

1. Use as many sections as the topic demands — each starting with an H3 heading (###). Each section = one carousel slide.
   - A narrow procedural topic (e.g. "Filing fees") might need only 3–4 slides.
   - A dense substantive topic (e.g. "Constitutional jurisdiction of courts") might need 8–15 slides.
   - Maximum 15 slides. Let the topic's complexity and comprehensive coverage decide, not a fixed number. Avoid unnecessary verbosity — every slide must teach something distinct.
2. Each section should be 150–300 words — readable on one screen. Dense, not padded.
3. End EVERY section with an exam tip on its own line:
   **Exam Tip:** [One practical exam-ready tip specific to that section's content]
4. Do NOT use "Introduction" or "Conclusion" as headings. Dive straight into the law.
5. Total note length should match the topic's weight — a light topic may be 600–900 words, a heavy one up to 2,000. Do not pad or truncate artificially.

CITATION RULES (NON-NEGOTIABLE):
- Weave cases and statutes INTO sentences naturally. NEVER list citations on standalone lines.
  ✅ "Under section 3A of the Civil Procedure Act, the court has inherent power to make orders for the ends of justice, as affirmed in *Amal Engineering Ltd v Nile Holdings* [2019] eKLR."
  ❌ "The court has inherent power. See: Section 3A, Civil Procedure Act."
- Quote verbatim statutory language in blockquotes (>) when exact wording matters for exams.
- ONLY cite cases from the SOURCE MATERIAL or that you are 100% certain exist. Do NOT fabricate case names.
- Format: *Case Name* [Year] eKLR — always within flowing prose.
- Statutes: "section X of the [Act Name]" format.

QUALITY:
- Every sentence teaches or cites authority. Zero filler.
- No "It is important to note that..." padding. No restating points.
- No standalone citation lists. No "See also:" lines.
- A student reads one slide, learns one concept with its legal basis, gets an exam tip, moves to next slide.

STRICTLY BANNED PATTERNS (the UI already provides AI follow-up features):
- Do NOT comment on your own notes: no "In this section...", "This note covers...", "As discussed above...", "We now turn to..."
- Do NOT write follow-up questions or prompts: no "Consider...", "What would happen if...", "Ask yourself..."
- Do NOT use meta-phrases: no "The examinable point is...", "For ATP purposes...", "The examiner expects...", "Drafting implication -"
- Do NOT write closing summaries, transitions between sections, or self-referential wrap-ups.
- Just state the law directly. Every sentence should be a legal proposition, statutory extract, or case application.`;

  const response = await openai.chat.completions.create({
    model: GENERATION_MODEL,
    messages: [
      { role: 'system', content: version.systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: version.temperature,
    max_completion_tokens: 4096,
  });

  const markdown = response.choices[0]?.message?.content || '';
  const inputTokens = response.usage?.prompt_tokens || 0;
  const outputTokens = response.usage?.completion_tokens || 0;

  // Split into sections for carousel, extracting exam tips into structured field
  const MAX_SLIDES = 15;
  let sections = markdown
    .split(/(?=^### )/m)
    .filter(s => s.trim().length > 0)
    .map((s, i) => {
      const titleMatch = s.match(/^### (.+)/m);
      // Extract exam tip if present (catch **Exam Tip:** and *Exam pitfall:* variants)
      const examTipMatch = s.match(/\*{1,2}Exam\s+(?:Tip|pitfall):\*{1,2}\s*(.+)/i);
      const examTips = examTipMatch ? examTipMatch[1].trim() : undefined;
      // Remove exam tip from content (it renders separately in UI)
      const content = examTips
        ? s.replace(/\*{1,2}Exam\s+(?:Tip|pitfall):\*{1,2}\s*.+/i, '').trim()
        : s.trim();
      return {
        id: `section-${i + 1}`,
        title: titleMatch ? titleMatch[1].trim() : `Section ${i + 1}`,
        content,
        ...(examTips && { examTips }),
      };
    });

  // Cap at MAX_SLIDES — merge overflow sections into the last allowed slide
  if (sections.length > MAX_SLIDES) {
    const kept = sections.slice(0, MAX_SLIDES);
    const overflow = sections.slice(MAX_SLIDES);
    const lastKept = kept[kept.length - 1];
    const mergedContent = [lastKept.content, ...overflow.map(s => s.content)].join('\n\n');
    kept[kept.length - 1] = { ...lastKept, content: mergedContent };
    sections = kept;
  }

  // Extract cited authorities from the markdown
  const casePattern = /\*([^*]+)\*\s*\[(\d{4})\]\s*(eKLR|KLR\s+\d+)/g;
  const statutePattern = /(?:section|s\.)\s+(\d+[A-Za-z]*(?:\(\d+\))?(?:\([a-z]\))?)\s+of\s+the\s+([A-Za-z\s,]+(?:Act|Rules|Regulations|Code|Constitution))/gi;
  
  const authorities: { type: string; name: string; citation?: string }[] = [];
  const seen = new Set<string>();
  
  let m;
  while ((m = casePattern.exec(markdown)) !== null) {
    const key = m[1].trim().toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      authorities.push({ type: 'case', name: m[1].trim(), citation: `[${m[2]}] ${m[3]}` });
    }
  }
  while ((m = statutePattern.exec(markdown)) !== null) {
    const key = `${m[1]}-${m[2].trim().toLowerCase()}`;
    if (!seen.has(key)) {
      seen.add(key);
      authorities.push({ type: 'statute', name: m[2].trim(), citation: `Section ${m[1]}` });
    }
  }

  return { markdown, sections, authorities, inputTokens, outputTokens };
}

// ═══════════════════════════════
// MAIN
// ═══════════════════════════════

async function main() {
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║  YNAI Pre-Built Notes Generator                  ║');
  console.log('╚══════════════════════════════════════════════════╝\n');

  // 1. Apply migration
  console.log('📋 Ensuring database tables exist...');
  const migrationSql = fs.readFileSync(
    path.join(__dirname, '..', 'drizzle', '0006_prebuilt_notes.sql'),
    'utf-8'
  );
  // Execute each statement separately
  const statements = migrationSql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));
  
  for (const stmt of statements) {
    try {
      await sql`${sql.unsafe(stmt)}`;
    } catch (e: any) {
      // Ignore "already exists" errors
      if (!e.message?.includes('already exists') && !e.message?.includes('duplicate')) {
        console.warn(`  ⚠ Migration statement warning: ${e.message?.slice(0, 100)}`);
      }
    }
  }
  console.log('  ✅ Tables ready\n');

  // 2. Fetch syllabus nodes
  let query = 'SELECT * FROM syllabus_nodes ORDER BY week_number ASC, unit_code ASC';
  if (filterUnit) {
    query = `SELECT * FROM syllabus_nodes WHERE unit_code = '${filterUnit}' ORDER BY week_number ASC`;
  }
  if (filterNode) {
    query = `SELECT * FROM syllabus_nodes WHERE id = '${filterNode}'`;
  }

  const nodes = await sql`${sql.unsafe(query)}`;
  console.log(`📚 Found ${nodes.length} syllabus nodes to process\n`);

  if (filterWeeks) {
    const filtered = nodes.filter((n: any) => filterWeeks!.includes(n.week_number));
    nodes.length = 0;
    nodes.push(...filtered);
    console.log(`  🔍 Filtered to ${nodes.length} nodes for weeks: ${filterWeeks.join(', ')}\n`);
  }

  // 3. Check what's already generated (resume mode)
  const existingNotes = await sql`SELECT node_id, version_number FROM prebuilt_notes WHERE is_active = true`;
  const existingSet = new Set(existingNotes.map((n: any) => `${n.node_id}:${n.version_number}`));

  let totalGenerated = 0;
  let totalSkipped = 0;
  let totalFailed = 0;
  let totalCost = 0;

  const versionsToGenerate = VERSION_PROFILES.filter(v => filterVersions.includes(v.number));
  const totalPossible = nodes.length * versionsToGenerate.length;

  console.log(`🎯 Generating ${versionsToGenerate.length} versions per node (${versionsToGenerate.map(v => `v${v.number}: ${v.name}`).join(', ')})`);
  console.log(`📊 Total notes to generate: up to ${totalPossible}\n`);
  console.log('─'.repeat(60));

  for (let ni = 0; ni < nodes.length; ni++) {
    const node = nodes[ni] as any;
    const topicFull = node.subtopic_name
      ? `${node.topic_name}: ${node.subtopic_name}`
      : node.topic_name;

    console.log(`\n[${ni + 1}/${nodes.length}] 📖 ${node.unit_code} Week ${node.week_number}: ${topicFull}`);

    // Fetch authorities ONCE per node (shared across all versions)
    let authorityContext = '';
    try {
      authorityContext = await fetchAuthoritiesForTopic(topicFull, node.unit_code);
      const sourceCount = (authorityContext.match(/\[(?:CASE|STATUTE|KNOWLEDGE BASE)\]/g) || []).length;
      console.log(`  📎 Found ${sourceCount} authority sources`);
    } catch (e) {
      console.warn(`  ⚠ Authority fetch failed, continuing with AI knowledge`);
      authorityContext = 'No verified authority records available. Use training knowledge but do NOT fabricate case names.';
    }

    for (const version of versionsToGenerate) {
      const key = `${node.id}:${version.number}`;

      if (resumeMode && existingSet.has(key)) {
        console.log(`  ⏭ v${version.number} (${version.name}) — already exists, skipping`);
        totalSkipped++;
        continue;
      }

      if (dryRun) {
        console.log(`  🔍 v${version.number} (${version.name}) — DRY RUN, would generate`);
        totalSkipped++;
        continue;
      }

      // Log generation start
      const logId = crypto.randomUUID();
      await sql`
        INSERT INTO prebuilt_notes_generation_log (id, node_id, version_number, status, model_used, started_at)
        VALUES (${logId}, ${node.id}, ${version.number}, 'generating', ${GENERATION_MODEL}, NOW())
      `;

      let attempt = 0;
      let success = false;

      while (attempt < RETRY_ATTEMPTS && !success) {
        attempt++;
        try {
          console.log(`  ✍ v${version.number} (${version.name}) attempt ${attempt}...`);

          const result = await generateNoteVersion(
            {
              id: node.id,
              unitCode: node.unit_code,
              topicName: node.topic_name,
              subtopicName: node.subtopic_name,
              sectionReference: node.section_reference,
              learningOutcome: node.learning_outcome,
              isDraftingNode: node.is_drafting_node,
              weekNumber: node.week_number,
            },
            version,
            authorityContext
          );

          if (!result.markdown || result.markdown.length < 200) {
            throw new Error(`Generated content too short (${result.markdown.length} chars)`);
          }

          const wordCount = result.markdown.split(/\s+/).length;

          // Estimate cost (gpt-5.2 pricing: $1.75/1M input, $14.00/1M output)
          const costUsd = (result.inputTokens * 1.75 / 1_000_000) + (result.outputTokens * 14 / 1_000_000);
          totalCost += costUsd;

          // Upsert into prebuilt_notes
          await sql`
            INSERT INTO prebuilt_notes (
              node_id, version_number, title, narrative_markdown, sections_json, 
              authorities_json, personality, word_count, model_used, 
              generation_prompt_hash, is_active
            ) VALUES (
              ${node.id}, ${version.number}, ${topicFull}, ${result.markdown}, 
              ${JSON.stringify(result.sections)}::jsonb, ${JSON.stringify(result.authorities)}::jsonb,
              ${version.personality}, ${wordCount}, ${GENERATION_MODEL}, 
              ${crypto.createHash('md5').update(version.systemPrompt).digest('hex')}, true
            )
            ON CONFLICT (node_id, version_number) DO UPDATE SET
              title = EXCLUDED.title,
              narrative_markdown = EXCLUDED.narrative_markdown,
              sections_json = EXCLUDED.sections_json,
              authorities_json = EXCLUDED.authorities_json,
              personality = EXCLUDED.personality,
              word_count = EXCLUDED.word_count,
              model_used = EXCLUDED.model_used,
              generation_prompt_hash = EXCLUDED.generation_prompt_hash,
              updated_at = NOW()
          `;

          // Update generation log
          await sql`
            UPDATE prebuilt_notes_generation_log 
            SET status = 'completed', input_tokens = ${result.inputTokens}, 
                output_tokens = ${result.outputTokens}, cost_usd = ${costUsd}, completed_at = NOW()
            WHERE id = ${logId}
          `;

          console.log(`    ✅ ${wordCount} words, ${result.sections.length} sections, ${result.authorities.length} authorities cited, $${costUsd.toFixed(4)}`);
          totalGenerated++;
          success = true;
        } catch (e: any) {
          console.error(`    ❌ Attempt ${attempt} failed: ${e.message?.slice(0, 100)}`);
          if (attempt >= RETRY_ATTEMPTS) {
            await sql`
              UPDATE prebuilt_notes_generation_log 
              SET status = 'failed', error_message = ${e.message?.slice(0, 500) || 'Unknown error'}, completed_at = NOW()
              WHERE id = ${logId}
            `;
            totalFailed++;
          } else {
            console.log(`    ⏳ Retrying in ${RETRY_DELAY_MS / 1000}s...`);
            await new Promise(r => setTimeout(r, RETRY_DELAY_MS));
          }
        }
      }
    }
  }

  // 4. Summary
  console.log('\n' + '═'.repeat(60));
  console.log('📊 GENERATION SUMMARY');
  console.log('═'.repeat(60));
  console.log(`  ✅ Generated: ${totalGenerated}`);
  console.log(`  ⏭ Skipped:   ${totalSkipped}`);
  console.log(`  ❌ Failed:    ${totalFailed}`);
  console.log(`  💰 Total cost: $${totalCost.toFixed(2)}`);
  console.log(`  📦 Coverage:   ${totalGenerated}/${totalPossible} (${((totalGenerated / totalPossible) * 100).toFixed(1)}%)`);
  
  // Check overall completion
  const totalInDb = await sql`SELECT COUNT(*) as c FROM prebuilt_notes WHERE is_active = true`;
  const totalNodes = await sql`SELECT COUNT(*) as c FROM syllabus_nodes`;
  const nodesNum = Number(totalNodes[0].c);
  const notesNum = Number(totalInDb[0].c);
  console.log(`\n  📚 Database totals: ${notesNum} notes / ${nodesNum} nodes`);
  console.log(`  📊 5-version coverage: ${notesNum}/${nodesNum * 5} (${((notesNum / (nodesNum * 5)) * 100).toFixed(1)}%)`);
  console.log('═'.repeat(60));
}

main().catch(e => {
  console.error('❌ Fatal error:', e);
  process.exit(1);
});
