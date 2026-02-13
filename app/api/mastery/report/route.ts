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
import { eq } from 'drizzle-orm';
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
 * Generate weekly report from data
 */
async function generateWeeklyReport(
  userId: string,
  weekStart: Date,
  weekEnd: Date
): Promise<WeeklyReportData> {
  // TODO: Query actual data from database
  // This is a demo implementation showing the structure
  
  // Mock data for demonstration
  const unitReadiness = ATP_UNITS.slice(0, 9).map((unit, index) => ({
    unitId: unit.id,
    unitName: unit.name,
    readiness: 40 + Math.floor(Math.random() * 40), // 40-80
    trend: (['improving', 'stable', 'declining'] as const)[Math.floor(Math.random() * 3)],
    topIssues: index < 3 ? ['Needs more timed practice', 'Error patterns in issue spotting'] : [],
    skillsVerified: Math.floor(Math.random() * 5),
    skillsTotal: 8 + Math.floor(Math.random() * 4),
  }));
  
  const overallReadiness = Math.round(
    unitReadiness.reduce((sum, u) => sum + u.readiness, 0) / unitReadiness.length
  );
  
  const report: WeeklyReportData = {
    userId,
    weekStart: weekStart.toISOString().split('T')[0],
    weekEnd: weekEnd.toISOString().split('T')[0],
    
    overallReadiness,
    writtenReadiness: overallReadiness + Math.floor(Math.random() * 10) - 5,
    oralReadiness: overallReadiness + Math.floor(Math.random() * 10) - 5,
    draftingReadiness: overallReadiness + Math.floor(Math.random() * 10) - 5,
    
    readinessTrend: overallReadiness > 60 ? 'improving' : 'stable',
    readinessDelta: Math.floor(Math.random() * 10) - 3,
    
    unitReadiness,
    
    activitySummary: {
      attemptsCount: Math.floor(Math.random() * 30) + 10,
      minutesStudied: Math.floor(Math.random() * 300) + 120,
      skillsPracticed: Math.floor(Math.random() * 15) + 5,
      timedAttempts: Math.floor(Math.random() * 10) + 2,
      gatesPassed: Math.floor(Math.random() * 3),
    },
    
    topImproving: [
      {
        skillId: 'skill-1',
        skillName: 'Issue Spotting in Civil Procedure',
        unitId: 'atp-100',
        delta: 15,
        evidence: ['Passed 3 consecutive timed attempts', 'No MISSED_ISSUE errors in last 5 attempts'],
      },
      {
        skillId: 'skill-2',
        skillName: 'Criminal Bail Applications',
        unitId: 'atp-101',
        delta: 12,
        evidence: ['Improved from 45% to 72% accuracy', 'Cleared WRONG_PROCEDURE error pattern'],
      },
    ],
    
    topDeclining: [
      {
        skillId: 'skill-3',
        skillName: 'Evidence Act s.34 Hearsay',
        unitId: 'atp-101',
        delta: -8,
        reasons: ['Recurring WRONG_RULE error (3 times this week)', 'Low retention from 2 weeks ago'],
        recommendedActions: ['Review lecture on hearsay exceptions', 'Complete 2 focused drills'],
      },
    ],
    
    topErrorTags: [
      { code: 'MISSED_ISSUE', name: 'Missed Legal Issue', count: 5, affectedSkills: ['skill-1', 'skill-4'] },
      { code: 'WRONG_CITATION', name: 'Incorrect Citation', count: 3, affectedSkills: ['skill-2'] },
      { code: 'POOR_APPLICATION', name: 'Weak Fact Application', count: 3, affectedSkills: ['skill-3'] },
    ],
    
    focusNextWeek: [
      'Priority: Criminal Litigation (lowest readiness at 52%)',
      'Clear MISSED_ISSUE error pattern - 2 targeted drills recommended',
      'Schedule 1 timed oral simulation for Trial Advocacy',
      'Review Evidence Act lecture chapters 4-6',
    ],
    
    mockPrediction: {
      overallPrediction: overallReadiness >= 70 ? 'likely_pass' : overallReadiness >= 55 ? 'borderline' : 'needs_work',
      unitPredictions: unitReadiness.map(u => ({
        unitId: u.unitId,
        prediction: u.readiness >= 70 ? 'pass' : u.readiness >= 55 ? 'borderline' : 'fail',
      })),
      confidence: 0.65,
      caveat: 'Prediction based on current mastery levels and historical patterns. Actual exam performance may vary.',
    },
    
    evidenceAttemptIds: [], // Would contain actual attempt IDs
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
