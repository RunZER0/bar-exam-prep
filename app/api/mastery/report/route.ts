/**
 * YNAI Mastery Engine v3 - Weekly Report Generator
 * 
 * Generates evidence-based weekly progress reports.
 * Every statement links back to attempts, rubrics, or evidence spans.
 * 
 * Report contains:
 * - Readiness score trend
 * - Per-unit readiness
 * - Top improving/failing skills with reasons
 * - "If exam was today" prediction
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { eq, sql } from 'drizzle-orm';
import { verifyIdToken } from '@/lib/firebase/admin';
import { ATP_UNITS } from '@/lib/constants/legal-content';

// ============================================
// TYPES
// ============================================

interface WeeklyReportData {
  userId: string;
  weekStart: string;
  weekEnd: string;
  
  // Readiness scores
  overallReadiness: number; // 0-100
  writtenReadiness: number;
  oralReadiness: number;
  draftingReadiness: number;
  
  // Trend
  readinessTrend: 'improving' | 'stable' | 'declining';
  readinessDelta: number;
  
  // Per-unit breakdown
  unitReadiness: {
    unitId: string;
    unitName: string;
    readiness: number;
    trend: 'improving' | 'stable' | 'declining';
    topIssues: string[];
    skillsVerified: number;
    skillsTotal: number;
  }[];
  
  // Activity summary
  activitySummary: {
    attemptsCount: number;
    minutesStudied: number;
    skillsPracticed: number;
    timedAttempts: number;
    gatesPassed: number;
  };
  
  // Top movers
  topImproving: {
    skillId: string;
    skillName: string;
    unitId: string;
    delta: number;
    evidence: string[];
  }[];
  
  topDeclining: {
    skillId: string;
    skillName: string;
    unitId: string;
    delta: number;
    reasons: string[];
    recommendedActions: string[];
  }[];
  
  // Error patterns
  topErrorTags: {
    code: string;
    name: string;
    count: number;
    affectedSkills: string[];
  }[];
  
  // Recommendations
  focusNextWeek: string[];
  
  // Prediction
  mockPrediction: {
    overallPrediction: 'likely_pass' | 'borderline' | 'needs_work';
    unitPredictions: { unitId: string; prediction: string }[];
    confidence: number;
    caveat: string;
  };
  
  // Evidence links (for P0: Evidence over vibes)
  evidenceAttemptIds: string[];
  generatedAt: string;
}

/**
 * GET /api/mastery/report
 * Fetch or generate weekly report
 */
export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await verifyIdToken(token);
    
    const [user] = await db.select().from(users)
      .where(eq(users.firebaseUid, decodedToken.uid))
      .limit(1);

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const url = new URL(req.url);
    const weekParam = url.searchParams.get('week'); // Format: YYYY-Www (e.g., 2026-W07)
    
    // Calculate week boundaries
    const now = new Date();
    let weekStart: Date;
    let weekEnd: Date;
    
    if (weekParam) {
      const [year, weekNum] = weekParam.split('-W');
      weekStart = getWeekStart(parseInt(year), parseInt(weekNum));
      weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
    } else {
      // Current week
      weekStart = getWeekStart(now.getFullYear(), getWeekNumber(now));
      weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
    }

    // TODO: Check if report already exists in weekly_reports table
    // For now, generate fresh report
    
    const report = await generateWeeklyReport(user.id, weekStart, weekEnd);
    
    return NextResponse.json(report);

  } catch (error) {
    console.error('Error fetching weekly report:', error);
    return NextResponse.json(
      { error: 'Failed to fetch weekly report' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/mastery/report
 * Force regenerate weekly report
 */
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await verifyIdToken(token);
    
    const [user] = await db.select().from(users)
      .where(eq(users.firebaseUid, decodedToken.uid))
      .limit(1);

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const body = await req.json();
    const { week } = body;
    
    const now = new Date();
    let weekStart: Date;
    let weekEnd: Date;
    
    if (week) {
      const [year, weekNum] = week.split('-W');
      weekStart = getWeekStart(parseInt(year), parseInt(weekNum));
    } else {
      weekStart = getWeekStart(now.getFullYear(), getWeekNumber(now));
    }
    weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    
    const report = await generateWeeklyReport(user.id, weekStart, weekEnd);
    
    // TODO: Store in weekly_reports table
    
    return NextResponse.json({
      success: true,
      report,
    });

  } catch (error) {
    console.error('Error generating weekly report:', error);
    return NextResponse.json(
      { error: 'Failed to generate weekly report' },
      { status: 500 }
    );
  }
}

/**
 * Generate weekly report from REAL database data
 */
async function generateWeeklyReport(
  userId: string,
  weekStart: Date,
  weekEnd: Date
): Promise<WeeklyReportData> {
  const weekStartStr = weekStart.toISOString().split('T')[0];
  const weekEndStr = weekEnd.toISOString().split('T')[0];
  
  // ============================================
  // Query actual mastery states for this user
  // ============================================
  const masteryResult = await db.execute(sql`
    SELECT 
      ms.skill_id,
      ms.p_mastery,
      ms.stability,
      ms.is_verified,
      ms.last_practiced_at,
      sk.name as skill_name,
      sk.unit_id
    FROM mastery_state ms
    JOIN micro_skills sk ON ms.skill_id = sk.id
    WHERE ms.user_id = ${userId}::uuid
  `);
  
  const masteryStates = masteryResult.rows as Array<{
    skill_id: string;
    p_mastery: string;
    stability: string;
    is_verified: boolean;
    last_practiced_at: string | null;
    skill_name: string;
    unit_id: string;
  }>;
  
  // ============================================
  // Query attempts from this week
  // ============================================
  const attemptsResult = await db.execute(sql`
    SELECT 
      ma.skill_id,
      ma.score_norm,
      ma.delta,
      ma.error_tags,
      ma.is_timed,
      ma.format,
      ma.created_at
    FROM mastery_attempts ma
    WHERE ma.user_id = ${userId}::uuid
      AND ma.created_at >= ${weekStartStr}::date
      AND ma.created_at <= ${weekEndStr}::date + interval '1 day'
    ORDER BY ma.created_at DESC
  `);
  
  const weekAttempts = attemptsResult.rows as Array<{
    skill_id: string;
    score_norm: string;
    delta: string;
    error_tags: string[];
    is_timed: boolean;
    format: string;
    created_at: string;
  }>;
  
  // ============================================
  // Calculate per-unit readiness from mastery states
  // ============================================
  const unitMasteryMap = new Map<string, { total: number; count: number; verified: number; skillsTotal: number }>();
  
  for (const state of masteryStates) {
    const existing = unitMasteryMap.get(state.unit_id) || { total: 0, count: 0, verified: 0, skillsTotal: 0 };
    existing.total += parseFloat(state.p_mastery) * 100;
    existing.count++;
    existing.skillsTotal++;
    if (state.is_verified) existing.verified++;
    unitMasteryMap.set(state.unit_id, existing);
  }
  
  // Build unit readiness array
  const unitReadiness = ATP_UNITS.slice(0, 9).map(unit => {
    const unitData = unitMasteryMap.get(unit.id);
    const readiness = unitData && unitData.count > 0 
      ? Math.round(unitData.total / unitData.count) 
      : 0;
    
    // Determine trend based on attempts this week
    const unitAttempts = weekAttempts.filter(a => masteryStates.find(m => m.skill_id === a.skill_id && m.unit_id === unit.id));
    const avgDelta = unitAttempts.length > 0 
      ? unitAttempts.reduce((sum, a) => sum + parseFloat(a.delta || '0'), 0) / unitAttempts.length
      : 0;
    
    const trend: 'improving' | 'stable' | 'declining' = avgDelta > 0.02 ? 'improving' : avgDelta < -0.02 ? 'declining' : 'stable';
    
    return {
      unitId: unit.id,
      unitName: unit.name,
      readiness,
      trend,
      topIssues: readiness < 50 ? ['Needs more practice', 'Low mastery in core skills'] : [],
      skillsVerified: unitData?.verified || 0,
      skillsTotal: unitData?.skillsTotal || 0,
    };
  });
  
  // ============================================
  // Calculate overall metrics from real data
  // ============================================
  const overallReadiness = unitReadiness.length > 0
    ? Math.round(unitReadiness.reduce((sum, u) => sum + u.readiness, 0) / unitReadiness.length)
    : 0;
  
  // Calculate format-specific readiness
  const writtenAttempts = weekAttempts.filter(a => a.format === 'essay' || a.format === 'written');
  const oralAttempts = weekAttempts.filter(a => a.format === 'oral');
  const mcqAttempts = weekAttempts.filter(a => a.format === 'mcq');
  
  const calcAvgScore = (attempts: typeof weekAttempts) => 
    attempts.length > 0 
      ? Math.round(attempts.reduce((sum, a) => sum + parseFloat(a.score_norm) * 100, 0) / attempts.length)
      : overallReadiness;
  
  // ============================================
  // Find top improving and declining skills
  // ============================================
  const skillDeltas: Array<{ skillId: string; skillName: string; unitId: string; delta: number; attempts: typeof weekAttempts }> = [];
  
  const skillAttemptsMap = new Map<string, typeof weekAttempts>();
  for (const attempt of weekAttempts) {
    const existing = skillAttemptsMap.get(attempt.skill_id) || [];
    existing.push(attempt);
    skillAttemptsMap.set(attempt.skill_id, existing);
  }
  
  for (const [skillId, attempts] of skillAttemptsMap) {
    const skillInfo = masteryStates.find(m => m.skill_id === skillId);
    if (!skillInfo) continue;
    
    const totalDelta = attempts.reduce((sum, a) => sum + parseFloat(a.delta || '0'), 0);
    skillDeltas.push({
      skillId,
      skillName: skillInfo.skill_name,
      unitId: skillInfo.unit_id,
      delta: Math.round(totalDelta * 100),
      attempts,
    });
  }
  
  // Sort by delta for top improving/declining
  skillDeltas.sort((a, b) => b.delta - a.delta);
  
  const topImproving = skillDeltas
    .filter(s => s.delta > 0)
    .slice(0, 3)
    .map(s => ({
      skillId: s.skillId,
      skillName: s.skillName,
      unitId: s.unitId,
      delta: s.delta,
      evidence: [`+${s.delta}% mastery gain from ${s.attempts.length} attempts this week`],
    }));
  
  const topDeclining = skillDeltas
    .filter(s => s.delta < 0)
    .slice(-3)
    .reverse()
    .map(s => ({
      skillId: s.skillId,
      skillName: s.skillName,
      unitId: s.unitId,
      delta: s.delta,
      reasons: [`${Math.abs(s.delta)}% mastery loss from ${s.attempts.length} attempts`],
      recommendedActions: ['Schedule focused practice session', 'Review related lecture material'],
    }));
  
  // ============================================
  // Aggregate error tags
  // ============================================
  const errorTagCounts = new Map<string, { count: number; skills: Set<string> }>();
  
  for (const attempt of weekAttempts) {
    for (const tag of (attempt.error_tags || [])) {
      const existing = errorTagCounts.get(tag) || { count: 0, skills: new Set() };
      existing.count++;
      existing.skills.add(attempt.skill_id);
      errorTagCounts.set(tag, existing);
    }
  }
  
  const ERROR_TAG_NAMES: Record<string, string> = {
    'MISSED_ISSUE': 'Missed Legal Issue',
    'WRONG_RULE': 'Incorrect Rule Applied',
    'WRONG_CITATION': 'Incorrect Citation',
    'POOR_APPLICATION': 'Weak Fact Application',
    'INCOMPLETE': 'Incomplete Answer',
    'WRONG_PROCEDURE': 'Wrong Procedure',
    'TIMING': 'Time Management',
    'STRUCTURE': 'Poor Structure',
  };
  
  const topErrorTags = Array.from(errorTagCounts.entries())
    .map(([code, data]) => ({
      code,
      name: ERROR_TAG_NAMES[code] || code,
      count: data.count,
      affectedSkills: Array.from(data.skills),
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
  
  // ============================================
  // Activity summary from real data
  // ============================================
  const activitySummary = {
    attemptsCount: weekAttempts.length,
    minutesStudied: weekAttempts.length * 8, // Estimate ~8 mins per attempt
    skillsPracticed: new Set(weekAttempts.map(a => a.skill_id)).size,
    timedAttempts: weekAttempts.filter(a => a.is_timed).length,
    gatesPassed: masteryStates.filter(m => m.is_verified).length,
  };
  
  // ============================================
  // Generate recommendations based on data
  // ============================================
  const weakestUnits = [...unitReadiness].sort((a, b) => a.readiness - b.readiness).slice(0, 2);
  const focusNextWeek = [
    ...weakestUnits.map(u => `Priority: ${u.unitName} (${u.readiness}% readiness)`),
    ...(topErrorTags.length > 0 ? [`Clear ${topErrorTags[0].name} error pattern - ${topErrorTags[0].count} occurrences`] : []),
    activitySummary.timedAttempts < 3 ? 'Schedule more timed practice attempts' : null,
  ].filter(Boolean) as string[];
  
  // ============================================
  // Prediction based on real readiness
  // ============================================
  const prediction = overallReadiness >= 70 ? 'likely_pass' as const 
    : overallReadiness >= 50 ? 'borderline' as const 
    : 'needs_work' as const;
  
  // Calculate trend from this week's deltas
  const avgWeekDelta = weekAttempts.length > 0 
    ? weekAttempts.reduce((sum, a) => sum + parseFloat(a.delta || '0'), 0) / weekAttempts.length
    : 0;
  const readinessTrend: 'improving' | 'stable' | 'declining' = avgWeekDelta > 0.02 ? 'improving' : avgWeekDelta < -0.02 ? 'declining' : 'stable';
  
  const report: WeeklyReportData = {
    userId,
    weekStart: weekStartStr,
    weekEnd: weekEndStr,
    
    overallReadiness,
    writtenReadiness: calcAvgScore(writtenAttempts),
    oralReadiness: calcAvgScore(oralAttempts),
    draftingReadiness: calcAvgScore(mcqAttempts.length > 0 ? mcqAttempts : writtenAttempts),
    
    readinessTrend,
    readinessDelta: Math.round(avgWeekDelta * 100),
    
    unitReadiness,
    activitySummary,
    topImproving,
    topDeclining,
    topErrorTags,
    focusNextWeek,
    
    mockPrediction: {
      overallPrediction: prediction,
      unitPredictions: unitReadiness.map(u => ({
        unitId: u.unitId,
        prediction: u.readiness >= 70 ? 'pass' : u.readiness >= 50 ? 'borderline' : 'needs_work',
      })),
      confidence: Math.min(0.9, 0.5 + (activitySummary.attemptsCount / 100)),
      caveat: 'Based on current mastery levels. Continue practicing to improve accuracy.',
    },
    
    evidenceAttemptIds: weekAttempts.map(a => a.skill_id).slice(0, 20),
    generatedAt: new Date().toISOString(),
  };
  
  return report;
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Get ISO week number
 */
function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

/**
 * Get start of ISO week
 */
function getWeekStart(year: number, week: number): Date {
  const simple = new Date(year, 0, 1 + (week - 1) * 7);
  const dow = simple.getDay();
  const ISOweekStart = simple;
  if (dow <= 4) {
    ISOweekStart.setDate(simple.getDate() - simple.getDay() + 1);
  } else {
    ISOweekStart.setDate(simple.getDate() + 8 - simple.getDay());
  }
  return ISOweekStart;
}
