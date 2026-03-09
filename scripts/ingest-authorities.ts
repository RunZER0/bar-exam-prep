/**
 * YNAI Case Law & Statute Ingestion Pipeline
 * 
 * Ingests your database of case law URLs and statute texts into:
 *   1. authority_records — canonical source record with URL, citation, raw text
 *   2. knowledge_base — embeddings-ready entries for semantic search
 *   3. authority_passages — extracted key passages with pinpoint locators
 * 
 * Input Formats Supported:
 *   A. Case Law JSON: [{ url, title, citation, court, year, summary, full_text? }]
 *   B. Statute JSON: [{ act_name, section, text, unit_id? }]
 *   C. Combined JSON: [{ type: "case"|"statute", ...fields }]
 * 
 * Usage:
 *   npx tsx scripts/ingest-authorities.ts --file data/case-laws.json --type cases
 *   npx tsx scripts/ingest-authorities.ts --file data/statutes.json --type statutes
 *   npx tsx scripts/ingest-authorities.ts --file data/combined.json --type combined
 *   npx tsx scripts/ingest-authorities.ts --file data/case-urls.txt --type urls
 *
 * For URL-only ingestion (will use OpenAI web_search to enrich):
 *   npx tsx scripts/ingest-authorities.ts --file data/urls.txt --type urls --enrich
 */

import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import OpenAI from 'openai';
import { createHash } from 'crypto';

dotenv.config();

const sql = neon(process.env.DATABASE_URL!);
const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

// ============================================
// TYPES
// ============================================

interface CaseLawEntry {
  url: string;
  title: string;
  citation?: string;
  court?: string;
  year?: number;
  summary?: string;
  full_text?: string;
  ratio?: string;
  jurisdiction?: string;
  unit_ids?: string[]; // Which ATP units this is relevant to
}

interface StatuteEntry {
  act_name: string;
  section: string;
  text: string;
  unit_id?: string;
  unit_ids?: string[];
  keywords?: string[];
  practical_application?: string;
  exam_tips?: string;
}

interface CombinedEntry {
  type: 'case' | 'statute' | 'regulation' | 'principle';
  // Case fields
  url?: string;
  title: string;
  citation?: string;
  court?: string;
  year?: number;
  summary?: string;
  full_text?: string;
  ratio?: string;
  // Statute fields
  act_name?: string;
  section?: string;
  text?: string;
  // Common
  unit_id?: string;
  unit_ids?: string[];
  keywords?: string[];
  jurisdiction?: string;
  importance?: number;
}

// ATP Unit code mapping
const UNIT_MAP: Record<string, string> = {
  'civil': 'ATP100', 'civil litigation': 'ATP100', 'atp100': 'ATP100', 'atp-100': 'ATP100',
  'criminal': 'ATP101', 'criminal litigation': 'ATP101', 'atp101': 'ATP101', 'atp-101': 'ATP101',
  'probate': 'ATP102', 'probate and administration': 'ATP102', 'atp102': 'ATP102', 'atp-102': 'ATP102',
  'legal writing': 'ATP103', 'drafting': 'ATP103', 'atp103': 'ATP103', 'atp-103': 'ATP103',
  'trial advocacy': 'ATP104', 'advocacy': 'ATP104', 'atp104': 'ATP104', 'atp-104': 'ATP104',
  'professional ethics': 'ATP105', 'ethics': 'ATP105', 'atp105': 'ATP105', 'atp-105': 'ATP105',
  'legal practice': 'ATP106', 'lpm': 'ATP106', 'atp106': 'ATP106', 'atp-106': 'ATP106',
  'conveyancing': 'ATP107', 'land': 'ATP107', 'atp107': 'ATP107', 'atp-107': 'ATP107',
  'commercial': 'ATP108', 'commercial transactions': 'ATP108', 'atp108': 'ATP108', 'atp-108': 'ATP108',
};

function normalizeUnitId(raw?: string): string {
  if (!raw) return 'ATP100'; // Default
  const key = raw.toLowerCase().trim();
  return UNIT_MAP[key] || raw.toUpperCase();
}

function contentHash(text: string): string {
  return createHash('sha256').update(text).digest('hex').slice(0, 16);
}

function inferSourceTier(url: string): 'A' | 'B' | 'C' {
  if (url.includes('kenyalaw.org')) return 'A';
  if (url.includes('legislation.gov') || url.includes('bailii.org')) return 'A';
  if (url.includes('law.co.ke') || url.includes('klrc.go.ke')) return 'B';
  return 'C';
}

function inferDomain(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return 'unknown';
  }
}

// ============================================
// CASE LAW INGESTION
// ============================================

async function ingestCaseLaw(cases: CaseLawEntry[]): Promise<{ inserted: number; skipped: number; errors: number }> {
  let inserted = 0, skipped = 0, errors = 0;

  for (const c of cases) {
    try {
      const hash = contentHash(c.url + (c.full_text || c.summary || c.title));

      // Check for duplicate
      const existing = await sql`
        SELECT id FROM authority_records WHERE canonical_url = ${c.url} OR content_hash = ${hash} LIMIT 1
      `;
      if (existing.length > 0) {
        skipped++;
        continue;
      }

      // Insert into authority_records
      const result = await sql`
        INSERT INTO authority_records (
          source_tier, source_type, domain, canonical_url, title,
          jurisdiction, court, citation, decision_date,
          license_tag, content_hash, raw_text, is_verified
        ) VALUES (
          ${inferSourceTier(c.url)},
          'CASE',
          ${inferDomain(c.url)},
          ${c.url},
          ${c.title},
          ${c.jurisdiction || 'Kenya'},
          ${c.court || null},
          ${c.citation || null},
          ${c.year ? `${c.year}-01-01` : null},
          'OPEN_ACCESS',
          ${hash},
          ${c.full_text || c.summary || null},
          false
        )
        RETURNING id
      `;

      // Also insert into knowledge_base for semantic search
      const unitIds = c.unit_ids || ['ATP100'];
      for (const unitId of unitIds) {
        const normUnit = normalizeUnitId(unitId);
        const kbContent = [
          c.ratio || c.summary || '',
          c.full_text ? c.full_text.slice(0, 2000) : '',
        ].filter(Boolean).join('\n\n');

        if (kbContent.length > 10) {
          await sql`
            INSERT INTO knowledge_base (unit_id, entry_type, source, citation, title, content, court, year, importance, is_verified)
            VALUES (
              ${normUnit},
              'case_law',
              ${c.court || 'Kenya Law Reports'},
              ${c.citation || null},
              ${c.title},
              ${kbContent},
              ${c.court || null},
              ${c.year || null},
              2,
              false
            )
            ON CONFLICT DO NOTHING
          `;
        }
      }

      // If there are key passages/ratio, insert into authority_passages
      if (c.ratio) {
        await sql`
          INSERT INTO authority_passages (authority_id, passage_text, locator_json, snippet_hash)
          VALUES (
            ${result[0].id}::uuid,
            ${c.ratio},
            ${JSON.stringify({ section: 'ratio decidendi' })}::jsonb,
            ${contentHash(c.ratio)}
          )
          ON CONFLICT DO NOTHING
        `;
      }

      inserted++;
      if (inserted % 25 === 0) console.log(`  ... ${inserted} cases ingested`);

    } catch (err: any) {
      console.error(`  Error ingesting case "${c.title}":`, err.message);
      errors++;
    }
  }

  return { inserted, skipped, errors };
}

// ============================================
// STATUTE INGESTION
// ============================================

async function ingestStatutes(statutes: StatuteEntry[]): Promise<{ inserted: number; skipped: number; errors: number }> {
  let inserted = 0, skipped = 0, errors = 0;

  for (const s of statutes) {
    try {
      const hash = contentHash(s.act_name + s.section + s.text);

      // Check duplicate in knowledge_base
      const existing = await sql`
        SELECT id FROM knowledge_base WHERE source = ${s.act_name} AND section = ${s.section} LIMIT 1
      `;
      if (existing.length > 0) {
        skipped++;
        continue;
      }

      const unitIds = s.unit_ids || (s.unit_id ? [s.unit_id] : ['ATP100']);

      for (const unitId of unitIds) {
        const normUnit = normalizeUnitId(unitId);

        // Insert into knowledge_base (primary for semantic search)
        await sql`
          INSERT INTO knowledge_base (
            unit_id, entry_type, source, section, title, content,
            keywords, practical_application, exam_tips, importance, is_verified
          ) VALUES (
            ${normUnit},
            'provision',
            ${s.act_name},
            ${s.section},
            ${`${s.act_name} — ${s.section}`},
            ${s.text},
            ${s.keywords || []}::text[],
            ${s.practical_application || null},
            ${s.exam_tips || null},
            2,
            false
          )
          ON CONFLICT DO NOTHING
        `;
      }

      // Also insert a matching authority_record (statutes are Tier A)
      const statuteUrl = `https://kenyalaw.org/kl/legislation/${encodeURIComponent(s.act_name.replace(/\s+/g, '-').toLowerCase())}`;
      
      await sql`
        INSERT INTO authority_records (
          source_tier, source_type, domain, canonical_url, title,
          jurisdiction, act_name, section_path,
          license_tag, content_hash, raw_text, is_verified
        ) VALUES (
          'A',
          'STATUTE',
          'kenyalaw.org',
          ${statuteUrl},
          ${`${s.act_name} — ${s.section}`},
          'Kenya',
          ${s.act_name},
          ${s.section},
          'CROWN_COPYRIGHT',
          ${hash},
          ${s.text},
          false
        )
        ON CONFLICT DO NOTHING
      `;

      inserted++;
      if (inserted % 25 === 0) console.log(`  ... ${inserted} provisions ingested`);

    } catch (err: any) {
      console.error(`  Error ingesting statute "${s.act_name} ${s.section}":`, err.message);
      errors++;
    }
  }

  return { inserted, skipped, errors };
}

// ============================================
// URL-ONLY INGESTION (with optional AI enrichment)
// ============================================

async function ingestUrls(urls: string[], enrich: boolean): Promise<{ inserted: number; skipped: number; errors: number }> {
  let inserted = 0, skipped = 0, errors = 0;

  for (const url of urls) {
    const trimmedUrl = url.trim();
    if (!trimmedUrl || !trimmedUrl.startsWith('http')) continue;

    try {
      // Check duplicate
      const existing = await sql`
        SELECT id FROM authority_records WHERE canonical_url = ${trimmedUrl} LIMIT 1
      `;
      if (existing.length > 0) {
        skipped++;
        continue;
      }

      let title = trimmedUrl.split('/').pop()?.replace(/-/g, ' ') || 'Unknown';
      let citation: string | null = null;
      let court: string | null = null;
      let sourceType = 'CASE';
      let rawText: string | null = null;
      let year: number | null = null;

      // Use OpenAI web_search to enrich if requested and available
      if (enrich && openai) {
        try {
          const response = await openai.responses.create({
            model: 'gpt-5.2-mini',
            instructions: `Retrieve information about this legal authority URL. Return JSON with: title, citation, court, year, sourceType (CASE or STATUTE), summary (200 words max). URL: ${trimmedUrl}`,
            input: `Get metadata for: ${trimmedUrl}`,
            tools: [{ type: 'web_search_preview' }],
            text: { format: { type: 'json_object' } },
          });

          const enriched = JSON.parse(response.output_text || '{}');
          if (enriched.title) title = enriched.title;
          if (enriched.citation) citation = enriched.citation;
          if (enriched.court) court = enriched.court;
          if (enriched.sourceType) sourceType = enriched.sourceType;
          if (enriched.summary) rawText = enriched.summary;
          if (enriched.year) year = enriched.year;

          console.log(`  [enriched] ${title} (${citation || 'no citation'})`);
        } catch (enrichErr) {
          console.warn(`  [enrich failed] ${trimmedUrl}: ${(enrichErr as Error).message}`);
        }
      }

      // Insert
      await sql`
        INSERT INTO authority_records (
          source_tier, source_type, domain, canonical_url, title,
          jurisdiction, court, citation, decision_date,
          license_tag, content_hash, raw_text, is_verified
        ) VALUES (
          ${inferSourceTier(trimmedUrl)},
          ${sourceType},
          ${inferDomain(trimmedUrl)},
          ${trimmedUrl},
          ${title},
          'Kenya',
          ${court},
          ${citation},
          ${year ? `${year}-01-01` : null},
          'OPEN_ACCESS',
          ${contentHash(trimmedUrl)},
          ${rawText},
          false
        )
        ON CONFLICT DO NOTHING
      `;

      inserted++;
      if (inserted % 10 === 0) console.log(`  ... ${inserted} URLs ingested`);

      // Rate limit if enriching
      if (enrich && openai) {
        await new Promise(r => setTimeout(r, 500));
      }

    } catch (err: any) {
      console.error(`  Error ingesting URL "${trimmedUrl}":`, err.message);
      errors++;
    }
  }

  return { inserted, skipped, errors };
}

// ============================================
// COMBINED INGESTION
// ============================================

async function ingestCombined(entries: CombinedEntry[]): Promise<{ inserted: number; skipped: number; errors: number }> {
  const cases: CaseLawEntry[] = [];
  const statutes: StatuteEntry[] = [];

  for (const e of entries) {
    if (e.type === 'case') {
      cases.push({
        url: e.url || `https://kenyalaw.org/case/${encodeURIComponent(e.title)}`,
        title: e.title,
        citation: e.citation,
        court: e.court,
        year: e.year,
        summary: e.summary || e.text,
        full_text: e.full_text,
        ratio: e.ratio,
        jurisdiction: e.jurisdiction,
        unit_ids: e.unit_ids || (e.unit_id ? [e.unit_id] : undefined),
      });
    } else {
      statutes.push({
        act_name: e.act_name || e.title,
        section: e.section || e.citation || '',
        text: e.text || e.full_text || e.summary || '',
        unit_id: e.unit_id,
        unit_ids: e.unit_ids,
        keywords: e.keywords,
      });
    }
  }

  console.log(`\n  Splitting ${entries.length} entries: ${cases.length} cases + ${statutes.length} statutes\n`);

  const caseResult = cases.length > 0 ? await ingestCaseLaw(cases) : { inserted: 0, skipped: 0, errors: 0 };
  const statResult = statutes.length > 0 ? await ingestStatutes(statutes) : { inserted: 0, skipped: 0, errors: 0 };

  return {
    inserted: caseResult.inserted + statResult.inserted,
    skipped: caseResult.skipped + statResult.skipped,
    errors: caseResult.errors + statResult.errors,
  };
}

// ============================================
// MAIN
// ============================================

async function main() {
  const args = process.argv.slice(2);
  const fileIdx = args.indexOf('--file');
  const typeIdx = args.indexOf('--type');
  const enrich = args.includes('--enrich');

  if (fileIdx === -1 || !args[fileIdx + 1]) {
    console.log(`
YNAI Authority Ingestion Pipeline
==================================

Usage:
  npx tsx scripts/ingest-authorities.ts --file <path> --type <cases|statutes|combined|urls> [--enrich]

File Formats:

  CASES (JSON):
  [
    {
      "url": "https://kenyalaw.org/caselaw/cases/view/12345",
      "title": "Mwangi v Republic",
      "citation": "[2019] eKLR",
      "court": "Court of Appeal",
      "year": 2019,
      "summary": "The court held that...",
      "full_text": "Optional full judgment text",
      "ratio": "Key legal principle established",
      "unit_ids": ["ATP100", "ATP101"]
    }
  ]

  STATUTES (JSON):
  [
    {
      "act_name": "Civil Procedure Act, Cap 21",
      "section": "Section 3A",
      "text": "The overriding objective of this Act...",
      "unit_id": "ATP100",
      "keywords": ["overriding objective", "just resolution"],
      "exam_tips": "This section is frequently tested..."
    }
  ]

  COMBINED (JSON):
  [
    { "type": "case", "url": "...", "title": "...", ... },
    { "type": "statute", "act_name": "...", "section": "...", "text": "...", ... }
  ]

  URLS (plain text, one URL per line):
  https://kenyalaw.org/caselaw/cases/view/12345
  https://kenyalaw.org/kl/fileadmin/pdfdownloads/Acts/...

  --enrich flag: Uses OpenAI web_search to auto-fill title, citation, court, and summary from the URL.

After ingestion, run the embedding generator:
  npx tsx scripts/seed-knowledge-and-embeddings.ts
`);
    process.exit(0);
  }

  const filePath = path.resolve(args[fileIdx + 1]);
  const dataType = args[typeIdx + 1] || 'combined';

  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    process.exit(1);
  }

  console.log('═'.repeat(55));
  console.log('  YNAI AUTHORITY INGESTION');
  console.log(`  File: ${filePath}`);
  console.log(`  Type: ${dataType}`);
  console.log(`  Enrich: ${enrich ? 'Yes (OpenAI web_search)' : 'No'}`);
  console.log('═'.repeat(55));

  const raw = fs.readFileSync(filePath, 'utf-8');
  let result: { inserted: number; skipped: number; errors: number };

  switch (dataType) {
    case 'cases': {
      const data: CaseLawEntry[] = JSON.parse(raw);
      console.log(`\n  Loaded ${data.length} case law entries\n`);
      result = await ingestCaseLaw(data);
      break;
    }
    case 'statutes': {
      const data: StatuteEntry[] = JSON.parse(raw);
      console.log(`\n  Loaded ${data.length} statute entries\n`);
      result = await ingestStatutes(data);
      break;
    }
    case 'urls': {
      const urls = raw.split('\n').map(l => l.trim()).filter(l => l.startsWith('http'));
      console.log(`\n  Loaded ${urls.length} URLs\n`);
      result = await ingestUrls(urls, enrich);
      break;
    }
    case 'combined':
    default: {
      const data: CombinedEntry[] = JSON.parse(raw);
      console.log(`\n  Loaded ${data.length} combined entries\n`);
      result = await ingestCombined(data);
      break;
    }
  }

  console.log('\n' + '═'.repeat(55));
  console.log('  INGESTION COMPLETE');
  console.log('═'.repeat(55));
  console.log(`  Inserted: ${result.inserted}`);
  console.log(`  Skipped (duplicates): ${result.skipped}`);
  console.log(`  Errors: ${result.errors}`);
  console.log('═'.repeat(55));

  if (result.inserted > 0) {
    console.log('\n  NEXT STEP: Generate embeddings for semantic search:');
    console.log('  npx tsx scripts/seed-knowledge-and-embeddings.ts\n');
  }
}

main().catch(e => {
  console.error('Fatal:', e.message);
  process.exit(1);
});
