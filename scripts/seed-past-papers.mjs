/**
 * Seed Past Papers Script
 * 
 * USAGE:
 *   node scripts/seed-past-papers.mjs <path-to-json-file>
 * 
 * The JSON file should contain an array of papers in this exact format:
 * 
 * [
 *   {
 *     "unitId": "atp-100",
 *     "unitName": "Civil Litigation",
 *     "year": 2024,
 *     "sitting": "main",
 *     "paperCode": "ATP 100",
 *     "instructions": "Answer FIVE questions. Question 1 is compulsory...",
 *     "totalMarks": 60,
 *     "duration": "3 hours",
 *     "questions": [
 *       {
 *         "questionNumber": 1,
 *         "subPart": null,
 *         "questionText": "Full verbatim question text here...",
 *         "marks": 20,
 *         "isCompulsory": true,
 *         "topics": ["Civil Procedure Rules", "Limitation of Actions"],
 *         "difficulty": "hard",
 *         "questionType": "problem",
 *         "modelAnswer": null
 *       },
 *       {
 *         "questionNumber": 2,
 *         "subPart": "a",
 *         "questionText": "Discuss the principles of...",
 *         "marks": 10,
 *         "isCompulsory": false,
 *         "topics": ["Constitutional Law"],
 *         "difficulty": "medium",
 *         "questionType": "essay",
 *         "modelAnswer": null
 *       }
 *     ]
 *   }
 * ]
 * 
 * VALID UNIT IDs:
 *   atp-100  Civil Litigation
 *   atp-101  Criminal Litigation
 *   atp-102  Probate and Administration
 *   atp-103  Legal Writing and Drafting
 *   atp-104  Trial Advocacy
 *   atp-105  Professional Ethics
 *   atp-106  Legal Practice Management
 *   atp-107  Conveyancing
 *   atp-108  Commercial Transactions
 * 
 * FIELD NOTES:
 *   - questionType: "essay" | "problem" | "drafting"
 *   - difficulty: "easy" | "medium" | "hard" (optional)
 *   - subPart: "a", "b", "c", etc. for multi-part questions (null for standalone)
 *   - topics: array of topic strings for frequency analysis
 *   - modelAnswer: optional, set to null if you don't have one
 *   - sitting: "main" or "supplementary"
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';

const DB_URL = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_RhqJkmu07srt@ep-delicate-resonance-ai973vek-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require';

async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error('Usage: node scripts/seed-past-papers.mjs <path-to-json-file>');
    console.error('Example: node scripts/seed-past-papers.mjs ./past-papers-data.json');
    process.exit(1);
  }

  const fullPath = resolve(filePath);
  console.log(`Reading past papers from: ${fullPath}`);

  let papers;
  try {
    const raw = readFileSync(fullPath, 'utf-8');
    papers = JSON.parse(raw);
  } catch (err) {
    console.error(`Failed to read/parse file: ${err.message}`);
    process.exit(1);
  }

  if (!Array.isArray(papers) || papers.length === 0) {
    console.error('JSON file must contain a non-empty array of papers.');
    process.exit(1);
  }

  // Validate unit IDs
  const validUnits = new Set([
    'atp-100', 'atp-101', 'atp-102', 'atp-103', 'atp-104',
    'atp-105', 'atp-106', 'atp-107', 'atp-108',
  ]);

  for (const paper of papers) {
    if (!validUnits.has(paper.unitId)) {
      console.error(`Invalid unitId: "${paper.unitId}". Must be one of: ${[...validUnits].join(', ')}`);
      process.exit(1);
    }
    if (!paper.year || !paper.unitName || !paper.questions?.length) {
      console.error(`Paper missing required fields (unitId, unitName, year, questions): ${JSON.stringify(paper).slice(0, 200)}`);
      process.exit(1);
    }
  }

  console.log(`Found ${papers.length} papers to seed.`);

  // Use pg directly for the seed script
  const { default: pg } = await import('pg');
  const client = new pg.Client({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();

  let totalPapers = 0;
  let totalQuestions = 0;

  for (const paper of papers) {
    // Delete existing paper for same unit+year+sitting (upsert)
    const sitting = paper.sitting || 'main';
    await client.query(
      `DELETE FROM past_papers WHERE unit_id = $1 AND year = $2 AND sitting = $3`,
      [paper.unitId, paper.year, sitting]
    );

    // Parse duration to minutes (handles "3 hours", "180", 180, etc.)
    let durationMinutes = null;
    if (paper.duration != null) {
      if (typeof paper.duration === 'number') {
        durationMinutes = paper.duration;
      } else if (typeof paper.duration === 'string') {
        const hourMatch = paper.duration.match(/(\d+)\s*hour/i);
        const minMatch = paper.duration.match(/(\d+)\s*min/i);
        if (hourMatch) durationMinutes = parseInt(hourMatch[1]) * 60;
        if (minMatch) durationMinutes = (durationMinutes || 0) + parseInt(minMatch[1]);
        if (!hourMatch && !minMatch) durationMinutes = parseInt(paper.duration) || null;
      }
    }

    // Insert paper
    const paperResult = await client.query(
      `INSERT INTO past_papers (unit_id, unit_name, year, sitting, paper_code, instructions, total_marks, duration)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [
        paper.unitId,
        paper.unitName,
        paper.year,
        sitting,
        paper.paperCode || null,
        paper.instructions || null,
        paper.totalMarks || null,
        durationMinutes,
      ]
    );

    const paperId = paperResult.rows[0].id;
    totalPapers++;

    // Insert questions
    for (const q of paper.questions) {
      await client.query(
        `INSERT INTO past_paper_questions (paper_id, question_number, sub_part, question_text, marks, is_compulsory, topics, difficulty, question_type, model_answer)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          paperId,
          q.questionNumber,
          q.subPart || null,
          q.questionText,
          q.marks || null,
          q.isCompulsory || false,
          JSON.stringify(q.topics || []),
          q.difficulty || null,
          q.questionType || 'essay',
          q.modelAnswer || null,
        ]
      );
      totalQuestions++;
    }

    console.log(`  ✓ ${paper.unitName} ${paper.year} (${sitting}) — ${paper.questions.length} questions`);
  }

  await client.end();
  console.log(`\nDone! Seeded ${totalPapers} papers with ${totalQuestions} questions.`);
}

main().catch(err => {
  console.error('Seed error:', err);
  process.exit(1);
});
