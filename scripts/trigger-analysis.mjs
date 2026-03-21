/**
 * One-time Deep Analysis Generation Script
 * 
 * Triggers the GPT-5.4 frontier model to analyze all past papers and cache the result.
 * Run: node scripts/trigger-analysis.mjs
 */

const DB_URL = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_RhqJkmu07srt@ep-delicate-resonance-ai973vek-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require';
const OPENAI_KEY = process.env.OPENAI_API_KEY;
const MODEL = 'gpt-5.4';

const AI_IDENTITY = `IDENTITY — ABSOLUTE RULE: You are "Ynai Assistant" — the AI tutor powering the Ynai bar exam preparation platform. If ANYONE asks who you are, your name, what model you are, or who made you, you MUST respond: "I am Ynai Assistant, your AI-powered legal study companion built for Kenya School of Law students." NEVER say you are ChatGPT, GPT, Claude, OpenAI, Anthropic, or any other AI brand. You are Ynai Assistant. Period.`;

async function main() {
  if (!OPENAI_KEY) {
    console.error('OPENAI_API_KEY environment variable is required');
    process.exit(1);
  }

  const { default: pg } = await import('pg');
  const { default: OpenAI } = await import('openai');

  const client = new pg.Client({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log('Connected to database');

  // Delete any existing cache entry (re-generate)
  await client.query("DELETE FROM past_paper_analysis_cache WHERE cache_key = 'global'");
  console.log('Cleared existing cache (if any)');

  // Fetch all papers and questions
  const papersResult = await client.query('SELECT * FROM past_papers ORDER BY year, unit_id');
  const questionsResult = await client.query('SELECT * FROM past_paper_questions ORDER BY paper_id, question_number');

  const allPapers = papersResult.rows;
  const allQuestions = questionsResult.rows;

  console.log(`Loaded ${allPapers.length} papers, ${allQuestions.length} questions`);

  if (allPapers.length === 0) {
    console.error('No past papers in database');
    await client.end();
    return;
  }

  // Build paper map
  const paperMap = new Map();
  for (const q of allQuestions) {
    const list = paperMap.get(q.paper_id) || [];
    list.push(q);
    paperMap.set(q.paper_id, list);
  }

  // Pre-compute stats
  const stats = computeRawStats(allPapers, allQuestions, paperMap);
  console.log(`Stats computed: ${stats.yearRange}, ${stats.unitIds.length} units`);

  // Build the raw data string
  const rawData = allPapers.map(p => {
    const qs = paperMap.get(p.id) || [];
    return `
--- ${p.unit_name} (${p.unit_id}) | ${p.year} ${p.sitting} | ${p.paper_code || ''} ---
Instructions: ${p.instructions || 'N/A'}
Total Marks: ${p.total_marks || 'N/A'}
Questions:
${qs.map(q => `  Q${q.question_number}${q.sub_part ? `(${q.sub_part})` : ''} [${q.marks || '?'}m] ${q.is_compulsory ? '★COMPULSORY' : ''} (${q.question_type || 'essay'}) Topics: [${(q.topics || []).join(', ')}] — ${(q.question_text || '').slice(0, 200)}...`).join('\n')}`;
  }).join('\n');

  const systemPrompt = `${AI_IDENTITY}

You are an expert exam pattern analyst for the Kenya School of Law Council of Legal Education (CLE) examinations. You have access to comprehensive data from past papers spanning multiple years.

Your task: Produce a DEEP, STRUCTURED analysis report in JSON format that reveals every identifiable pattern, trend, and insight from the exam data. This report will be cached and displayed to students with rich visualizations.

RESPOND WITH VALID JSON ONLY. No markdown, no explanation outside the JSON.

The JSON must follow this exact structure:
{
  "summary": {
    "totalPapers": number,
    "totalQuestions": number,
    "yearRange": "2018-2025",
    "unitsAnalyzed": number,
    "sittingsAnalyzed": number
  },
  "topicAnalysis": {
    "globalTopTopics": [{"topic": string, "frequency": number, "percentage": number, "trend": "rising"|"stable"|"declining", "peakYear": number}],
    "byUnit": {
      "[unitId]": {
        "unitName": string,
        "topTopics": [{"topic": string, "frequency": number, "trend": "rising"|"stable"|"declining"}],
        "uniqueTopics": string[],
        "topicDiversity": number
      }
    }
  },
  "yearOverYearTrends": {
    "topicShifts": [{"fromTopic": string, "toTopic": string, "shiftYear": number, "unit": string, "description": string}],
    "emergingTopics": [{"topic": string, "firstAppeared": number, "growthRate": string, "units": string[]}],
    "decliningTopics": [{"topic": string, "lastAppeared": number, "previousFrequency": number}],
    "yearlyComplexity": [{"year": number, "avgMarksPerQ": number, "problemRatio": number, "draftingRatio": number, "essayRatio": number}]
  },
  "questionTypePatterns": {
    "overallDistribution": {"essay": number, "problem": number, "drafting": number},
    "byUnit": {"[unitId]": {"essay": number, "problem": number, "drafting": number}},
    "byYear": {"[year]": {"essay": number, "problem": number, "drafting": number}},
    "compulsoryPatterns": {
      "topicsMostCompulsory": [{"topic": string, "count": number}],
      "avgCompulsoryMarks": number,
      "compulsoryTypeBreakdown": {"essay": number, "problem": number, "drafting": number}
    }
  },
  "difficultyAnalysis": {
    "overallDistribution": {"easy": number, "medium": number, "hard": number},
    "byUnit": {"[unitId]": {"easy": number, "medium": number, "hard": number}},
    "trendByYear": [{"year": number, "hardPercentage": number, "mediumPercentage": number}]
  },
  "marksAllocation": {
    "commonMarksValues": [{"marks": number, "frequency": number}],
    "avgMarksCompulsory": number,
    "avgMarksOptional": number,
    "byUnit": {"[unitId]": {"avgTotal": number, "avgCompulsory": number, "avgOptional": number}}
  },
  "crossUnitInsights": {
    "sharedTopics": [{"topic": string, "units": string[], "frequency": number}],
    "unitSpecificTopics": [{"topic": string, "unit": string, "frequency": number}],
    "correlations": [{"description": string, "units": string[], "pattern": string}]
  },
  "predictiveInsights": {
    "highProbabilityTopics": [{"topic": string, "unit": string, "probability": "high"|"medium", "reasoning": string, "lastTested": number}],
    "cyclicalPatterns": [{"pattern": string, "cycle": string, "nextExpected": string, "confidence": string}],
    "examinerBehavior": [{"observation": string, "evidence": string, "implication": string}]
  },
  "examStructureAnalysis": {
    "commonFormats": [{"format": string, "frequency": number, "description": string}],
    "instructionPatterns": [{"pattern": string, "occurrences": number}],
    "timingTrends": {"avgDuration": number, "avgQuestionsPerPaper": number, "avgMarksPerPaper": number}
  },
  "studentGuidance": {
    "mustPrepareTopics": [{"topic": string, "unit": string, "reason": string, "priority": "critical"|"high"|"medium"}],
    "safeToDeprioritize": [{"topic": string, "reason": string}],
    "strategicAdvice": string[]
  }
}`;

  const userPrompt = `Analyze these ${allPapers.length} past papers with ${allQuestions.length} questions spanning ${stats.yearRange}.

PRE-COMPUTED STATISTICS:
${JSON.stringify(stats, null, 2)}

RAW PAPER DATA (each paper with its questions):
${rawData}

Generate the comprehensive analysis JSON. Be thorough — identify every pattern, trend, correlation, and predictive insight possible. This is the definitive analytical resource for bar exam preparation.`;

  console.log(`\nSending to ${MODEL} with reasoning_effort: high...`);
  console.log('This may take 1-3 minutes for a frontier model analysis...\n');

  const openai = new OpenAI({ apiKey: OPENAI_KEY });
  const startTime = Date.now();

  const completion = await openai.chat.completions.create({
    model: MODEL,
    reasoning_effort: 'high',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    max_completion_tokens: 65536,
    response_format: { type: 'json_object' },
  });

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`Model responded in ${elapsed}s`);
  console.log(`Tokens: ${JSON.stringify(completion.usage)}`);

  const reportText = completion.choices[0]?.message?.content || '{}';
  let report;
  try {
    report = JSON.parse(reportText);
  } catch (e) {
    console.error('AI returned invalid JSON:', reportText.slice(0, 500));
    await client.end();
    process.exit(1);
  }

  // Validate basic structure
  const requiredKeys = ['summary', 'topicAnalysis', 'yearOverYearTrends', 'predictiveInsights', 'studentGuidance'];
  const missing = requiredKeys.filter(k => !report[k]);
  if (missing.length > 0) {
    console.warn(`Warning: Report missing sections: ${missing.join(', ')}`);
  }

  // Insert into cache
  const cacheKey = 'global';
  await client.query('DELETE FROM past_paper_analysis_cache WHERE cache_key = $1', [cacheKey]);
  await client.query(
    `INSERT INTO past_paper_analysis_cache (id, cache_key, report, paper_count, question_count, generated_at, model_used)
     VALUES (gen_random_uuid(), $1, $2, $3, $4, NOW(), $5)`,
    [cacheKey, JSON.stringify(report), allPapers.length, allQuestions.length, MODEL]
  );

  console.log(`\n✅ Analysis cached successfully!`);
  console.log(`   Papers: ${allPapers.length}`);
  console.log(`   Questions: ${allQuestions.length}`);
  console.log(`   Model: ${MODEL}`);
  console.log(`   Sections: ${Object.keys(report).join(', ')}`);
  if (report.summary) {
    console.log(`   Year range: ${report.summary.yearRange}`);
    console.log(`   Units analyzed: ${report.summary.unitsAnalyzed}`);
  }

  await client.end();
}

function computeRawStats(papers, questions, paperMap) {
  const years = [...new Set(papers.map(p => p.year))].sort();
  const units = [...new Set(papers.map(p => p.unit_id))];

  const topicFreq = {};
  const topicByYear = {};
  const topicByUnit = {};
  const typeByUnit = {};
  const typeByYear = {};
  const diffByUnit = {};
  const marksDist = {};
  let compulsoryCount = 0;
  let compulsoryMarksSum = 0;
  let optionalMarksSum = 0;
  let optionalCount = 0;

  for (const paper of papers) {
    const qs = paperMap.get(paper.id) || [];
    const yr = String(paper.year);
    const uid = paper.unit_id;

    if (!topicByYear[yr]) topicByYear[yr] = {};
    if (!topicByUnit[uid]) topicByUnit[uid] = {};
    if (!typeByUnit[uid]) typeByUnit[uid] = {};
    if (!typeByYear[yr]) typeByYear[yr] = {};
    if (!diffByUnit[uid]) diffByUnit[uid] = {};

    for (const q of qs) {
      const topics = q.topics || [];
      for (const t of topics) {
        topicFreq[t] = (topicFreq[t] || 0) + 1;
        topicByYear[yr][t] = (topicByYear[yr][t] || 0) + 1;
        topicByUnit[uid][t] = (topicByUnit[uid][t] || 0) + 1;
      }

      const qtype = q.question_type || 'essay';
      typeByUnit[uid][qtype] = (typeByUnit[uid][qtype] || 0) + 1;
      typeByYear[yr][qtype] = (typeByYear[yr][qtype] || 0) + 1;

      const diff = q.difficulty || 'medium';
      diffByUnit[uid][diff] = (diffByUnit[uid][diff] || 0) + 1;

      if (q.marks) {
        marksDist[q.marks] = (marksDist[q.marks] || 0) + 1;
        if (q.is_compulsory) {
          compulsoryCount++;
          compulsoryMarksSum += q.marks;
        } else {
          optionalCount++;
          optionalMarksSum += q.marks;
        }
      }
    }
  }

  return {
    yearRange: `${years[0]}–${years[years.length - 1]}`,
    years,
    unitIds: units,
    paperCount: papers.length,
    questionCount: questions.length,
    topicFrequency: Object.entries(topicFreq).sort(([, a], [, b]) => b - a).slice(0, 60),
    topicsByYear: topicByYear,
    topicsByUnit: topicByUnit,
    questionTypeByUnit: typeByUnit,
    questionTypeByYear: typeByYear,
    difficultyByUnit: diffByUnit,
    marksDistribution: Object.entries(marksDist).sort(([, a], [, b]) => b - a),
    compulsoryAvgMarks: compulsoryCount > 0 ? Math.round(compulsoryMarksSum / compulsoryCount * 10) / 10 : 0,
    optionalAvgMarks: optionalCount > 0 ? Math.round(optionalMarksSum / optionalCount * 10) / 10 : 0,
  };
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
