import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { pastPapers, pastPaperQuestions, pastPaperAnalysisCache } from '@/lib/db/schema';
import { eq, desc, sql, count } from 'drizzle-orm';
import { withAuth, type AuthUser } from '@/lib/auth/middleware';
import OpenAI from 'openai';
import { ORCHESTRATOR_MODEL, QUIZ_MODEL, AI_IDENTITY } from '@/lib/ai/model-config';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ── GET: Return cached analysis or generate on first request ──
export async function GET(req: NextRequest) {
  try {
    const cacheKey = 'global';

    // Check cache
    const [cached] = await db
      .select()
      .from(pastPaperAnalysisCache)
      .where(eq(pastPaperAnalysisCache.cacheKey, cacheKey))
      .limit(1);

    if (cached) {
      return NextResponse.json({
        report: cached.report,
        paperCount: cached.paperCount,
        questionCount: cached.questionCount,
        generatedAt: cached.generatedAt,
        modelUsed: cached.modelUsed,
        fromCache: true,
      });
    }

    return NextResponse.json({ report: null, fromCache: false });
  } catch (error) {
    console.error('Analysis GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch analysis' }, { status: 500 });
  }
}

// ── POST: Generate or regenerate deep analysis ──
export const POST = withAuth(async (req: NextRequest, _user: AuthUser) => {
  try {
    const body = await req.json();
    const { action } = body;

    // ── GENERATE: One-time deep analysis generation ──
    if (action === 'generate') {
      // Fetch all papers & questions
      const allPapers = await db
        .select()
        .from(pastPapers)
        .orderBy(pastPapers.year, pastPapers.unitId);

      const allQuestions = await db
        .select()
        .from(pastPaperQuestions)
        .orderBy(pastPaperQuestions.paperId, pastPaperQuestions.questionNumber);

      if (allPapers.length === 0) {
        return NextResponse.json({ error: 'No past papers in database' }, { status: 400 });
      }

      // Build a structured summary for the AI
      const paperMap = new Map<string, typeof allQuestions>();
      for (const q of allQuestions) {
        const list = paperMap.get(q.paperId) || [];
        list.push(q);
        paperMap.set(q.paperId, list);
      }

      // Pre-compute raw statistics server-side
      const stats = computeRawStats(allPapers, allQuestions, paperMap);

      const completion = await openai.chat.completions.create({
        model: ORCHESTRATOR_MODEL,
        messages: [
          {
            role: 'system',
            content: `${AI_IDENTITY}

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
}`
          },
          {
            role: 'user',
            content: `Analyze these ${allPapers.length} past papers with ${allQuestions.length} questions spanning ${stats.yearRange}.

PRE-COMPUTED STATISTICS:
${JSON.stringify(stats, null, 2)}

RAW PAPER DATA (each paper with its questions):
${allPapers.map(p => {
  const qs = paperMap.get(p.id) || [];
  return `
--- ${p.unitName} (${p.unitId}) | ${p.year} ${p.sitting} | ${p.paperCode || ''} ---
Instructions: ${p.instructions || 'N/A'}
Total Marks: ${p.totalMarks || 'N/A'}
Questions:
${qs.map(q => `  Q${q.questionNumber}${q.subPart ? `(${q.subPart})` : ''} [${q.marks || '?'}m] ${q.isCompulsory ? '★COMPULSORY' : ''} (${q.questionType || 'essay'}) Topics: [${(q.topics as string[] || []).join(', ')}] — ${(q.questionText || '').slice(0, 200)}...`).join('\n')}`;
}).join('\n')}

Generate the comprehensive analysis JSON. Be thorough — identify every pattern, trend, correlation, and predictive insight possible. This is the definitive analytical resource for bar exam preparation.`
          }
        ],
        max_completion_tokens: 16000,
        response_format: { type: 'json_object' },
      });

      const reportText = completion.choices[0]?.message?.content || '{}';
      let report;
      try {
        report = JSON.parse(reportText);
      } catch {
        return NextResponse.json({ error: 'AI returned invalid JSON' }, { status: 500 });
      }

      // Cache it — upsert
      const cacheKey = 'global';
      await db.delete(pastPaperAnalysisCache).where(eq(pastPaperAnalysisCache.cacheKey, cacheKey));
      await db.insert(pastPaperAnalysisCache).values({
        cacheKey,
        report,
        paperCount: allPapers.length,
        questionCount: allQuestions.length,
        generatedAt: new Date(),
        modelUsed: ORCHESTRATOR_MODEL,
      });

      return NextResponse.json({
        report,
        paperCount: allPapers.length,
        questionCount: allQuestions.length,
        generatedAt: new Date().toISOString(),
        modelUsed: ORCHESTRATOR_MODEL,
        fromCache: false,
      });
    }

    // ── FOLLOW-UP: AI chat about the analysis ──
    if (action === 'followup') {
      const { question, conversationHistory, askCount } = body;

      if (!question?.trim()) {
        return NextResponse.json({ error: 'Question is required' }, { status: 400 });
      }

      // Fetch the cached report
      const [cached] = await db
        .select()
        .from(pastPaperAnalysisCache)
        .where(eq(pastPaperAnalysisCache.cacheKey, 'global'))
        .limit(1);

      if (!cached) {
        return NextResponse.json({ error: 'Analysis report has not been generated yet' }, { status: 400 });
      }

      // Model tiering: first 3 asks use GPT 5.2 low verbosity, then GPT 5.4 Mini with high reasoning
      const currentAskCount = (askCount || 0) + 1;
      const useHighTier = currentAskCount <= 3;
      const model = useHighTier ? ORCHESTRATOR_MODEL : QUIZ_MODEL;

      const systemPrompt = `${AI_IDENTITY}

You are the Ynai Past Papers Analysis Expert. You have access to a comprehensive analysis report generated from ${cached.paperCount} past papers with ${cached.questionCount} questions.

ANALYSIS REPORT DATA:
${JSON.stringify(cached.report)}

${useHighTier
  ? `INSTRUCTION: You are using the high-tier model. Give concise, direct answers. Focus on actionable insights. Keep responses under 300 words unless the question demands more depth.`
  : `INSTRUCTION: You are using the extended reasoning model. Think deeply about patterns, correlations, and implications. Draw connections the student might miss. Be thorough but structured.`
}

RULES:
- Answer ONLY based on the analysis data above — don't fabricate statistics
- When citing frequencies or percentages, use the actual numbers from the report
- If the student asks about predictions, reference the predictiveInsights section
- For topic-specific questions, drill into the relevant unit's data
- Always give actionable study advice based on the patterns
- Use clear formatting with bullet points and bold for key insights
- If the data doesn't cover what they asked, say so honestly`;

      const messages: OpenAI.ChatCompletionMessageParam[] = [
        { role: 'system', content: systemPrompt },
      ];

      // Add conversation history
      if (conversationHistory?.length) {
        for (const msg of conversationHistory.slice(-8)) {
          messages.push({
            role: msg.role === 'user' ? 'user' : 'assistant',
            content: msg.content,
          });
        }
      }

      messages.push({ role: 'user', content: question });

      const completionArgs: any = {
        model,
        messages,
        max_completion_tokens: useHighTier ? 2000 : 4000,
      };

      // GPT 5.4 Mini supports reasoning_effort
      if (!useHighTier) {
        completionArgs.reasoning_effort = 'high';
      }

      const completion = await openai.chat.completions.create(completionArgs);
      const answer = completion.choices[0]?.message?.content || 'Unable to generate a response.';

      return NextResponse.json({
        answer,
        model,
        askCount: currentAskCount,
        tier: useHighTier ? 'high' : 'extended',
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Analysis POST error:', error);
    return NextResponse.json({ error: 'Failed to process analysis request' }, { status: 500 });
  }
});

// ── Pre-compute raw statistics to give the AI structured data ──
function computeRawStats(
  papers: any[],
  questions: any[],
  paperMap: Map<string, any[]>
) {
  const years = [...new Set(papers.map(p => p.year))].sort();
  const units = [...new Set(papers.map(p => p.unitId))];

  // Topic frequency (global)
  const topicFreq: Record<string, number> = {};
  const topicByYear: Record<string, Record<string, number>> = {};
  const topicByUnit: Record<string, Record<string, number>> = {};
  const typeByUnit: Record<string, Record<string, number>> = {};
  const typeByYear: Record<string, Record<string, number>> = {};
  const diffByUnit: Record<string, Record<string, number>> = {};
  const marksDist: Record<number, number> = {};
  let compulsoryCount = 0;
  let compulsoryMarksSum = 0;
  let optionalMarksSum = 0;
  let optionalCount = 0;

  for (const paper of papers) {
    const qs = paperMap.get(paper.id) || [];
    const yr = String(paper.year);
    const uid = paper.unitId;

    if (!topicByYear[yr]) topicByYear[yr] = {};
    if (!topicByUnit[uid]) topicByUnit[uid] = {};
    if (!typeByUnit[uid]) typeByUnit[uid] = {};
    if (!typeByYear[yr]) typeByYear[yr] = {};
    if (!diffByUnit[uid]) diffByUnit[uid] = {};

    for (const q of qs) {
      // Topics
      const topics = (q.topics as string[]) || [];
      for (const t of topics) {
        topicFreq[t] = (topicFreq[t] || 0) + 1;
        topicByYear[yr][t] = (topicByYear[yr][t] || 0) + 1;
        topicByUnit[uid][t] = (topicByUnit[uid][t] || 0) + 1;
      }

      // Question type
      const qtype = q.questionType || 'essay';
      typeByUnit[uid][qtype] = (typeByUnit[uid][qtype] || 0) + 1;
      typeByYear[yr][qtype] = (typeByYear[yr][qtype] || 0) + 1;

      // Difficulty
      const diff = q.difficulty || 'medium';
      diffByUnit[uid][diff] = (diffByUnit[uid][diff] || 0) + 1;

      // Marks
      if (q.marks) {
        marksDist[q.marks] = (marksDist[q.marks] || 0) + 1;
        if (q.isCompulsory) {
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
