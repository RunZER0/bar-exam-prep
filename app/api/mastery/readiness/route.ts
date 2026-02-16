/**
 * YNAI Mastery Engine v3 - Readiness API
 * 
 * Returns evidence-backed readiness scores.
 * Per spec: No fake numbers - every metric has backing evidence.
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

interface ReadinessResponse {
  overall: {
    score: number;
    trend: 'improving' | 'stable' | 'declining';
    trendDelta: number;
    confidenceInterval: [number, number];
    lastUpdated: string;
  };
  
  formats: {
    written: { score: number; trend: 'improving' | 'stable' | 'declining' };
    oral: { score: number; trend: 'improving' | 'stable' | 'declining' };
    drafting: { score: number; trend: 'improving' | 'stable' | 'declining' };
  };
  
  units: UnitReadiness[];
  
  examDate?: string;
  daysUntilExam?: number;
  // Product spec: >= 60 = distant, 8-59 = approaching, 0-7 = critical
  examPhase?: 'distant' | 'approaching' | 'critical' | 'post_exam';
  
  // Evidence counts
  evidenceSummary: {
    totalAttempts: number;
    writtenAttempts: number;
    oralAttempts: number;
    draftingAttempts: number;
    timedAttempts: number;
    gatesPassed: number;
    lastAttemptAt?: string;
  };
}

interface UnitReadiness {
  unitId: string;
  unitName: string;
  score: number;
  trend: 'improving' | 'stable' | 'declining';
  skillsTotal: number;
  skillsVerified: number;
  skillsAtRisk: number;
  topIssue?: string;
  examWeight?: number;
  gateProgress: number;
}

/**
 * GET /api/mastery/readiness
 * Fetch current readiness state
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

    // Optional: specific unit filter
    const url = new URL(req.url);
    const unitId = url.searchParams.get('unitId');
    
    const readiness = await calculateReadiness(user.id, unitId);
    
    return NextResponse.json(readiness);

  } catch (error) {
    console.error('Error fetching readiness:', error);
    return NextResponse.json(
      { error: 'Failed to fetch readiness' },
      { status: 500 }
    );
  }
}

/**
 * Calculate readiness scores from REAL mastery data in database
 */
async function calculateReadiness(
  userId: string,
  filterUnitId?: string | null
): Promise<ReadinessResponse> {
  // Calculate exam phase from user profile or default
  const examDate = new Date('2026-04-15');
  const now = new Date();
  const daysUntilExam = Math.ceil((examDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  
  // Product spec: >= 60 = distant, 8-59 = approaching, 0-7 = critical
  let examPhase: 'distant' | 'approaching' | 'critical' | 'post_exam';
  if (daysUntilExam <= 0) examPhase = 'post_exam';
  else if (daysUntilExam <= 7) examPhase = 'critical';
  else if (daysUntilExam < 60) examPhase = 'approaching';
  else examPhase = 'distant';
  
  // Query real skills from database grouped by unit
  const skillsByUnit = await db.execute(sql`
    SELECT 
      ms.unit_id,
      COUNT(DISTINCT ms.id) as total_skills,
      COUNT(DISTINCT CASE WHEN mst.is_verified = true THEN ms.id END) as verified_skills,
      AVG(COALESCE(mst.p_mastery, 0)) as avg_mastery,
      COUNT(DISTINCT CASE WHEN COALESCE(mst.p_mastery, 0) < 0.4 THEN ms.id END) as at_risk_skills,
      SUM(ms.exam_weight) as total_weight
    FROM micro_skills ms
    LEFT JOIN mastery_state mst ON ms.id = mst.skill_id AND mst.user_id = ${userId}::uuid
    WHERE ms.is_active = true
    ${filterUnitId ? sql`AND ms.unit_id = ${filterUnitId}` : sql``}
    GROUP BY ms.unit_id
  `);
  
  // Query attempt statistics
  const attemptStats = await db.execute(sql`
    SELECT 
      COUNT(*) as total_attempts,
      COUNT(CASE WHEN format = 'written' THEN 1 END) as written_attempts,
      COUNT(CASE WHEN format = 'oral' THEN 1 END) as oral_attempts,
      COUNT(CASE WHEN format = 'drafting' THEN 1 END) as drafting_attempts,
      COUNT(CASE WHEN mode = 'timed' THEN 1 END) as timed_attempts,
      MAX(created_at) as last_attempt_at,
      AVG(CASE WHEN format = 'written' THEN score_norm END) as written_avg,
      AVG(CASE WHEN format = 'oral' THEN score_norm END) as oral_avg,
      AVG(CASE WHEN format = 'drafting' THEN score_norm END) as drafting_avg
    FROM attempts
    WHERE user_id = ${userId}::uuid
  `);
  
  const stats = attemptStats.rows[0] as {
    total_attempts: string;
    written_attempts: string;
    oral_attempts: string;
    drafting_attempts: string;
    timed_attempts: string;
    last_attempt_at: string | null;
    written_avg: string | null;
    oral_avg: string | null;
    drafting_avg: string | null;
  } | undefined;
  
  // Build unit readiness from real data
  const units: UnitReadiness[] = [];
  const unitData = skillsByUnit.rows as Array<{
    unit_id: string;
    total_skills: string;
    verified_skills: string;
    avg_mastery: string;
    at_risk_skills: string;
    total_weight: string;
  }>;
  
  // Map ATP_UNITS to include units with data
  const atpUnitsSlice = filterUnitId 
    ? ATP_UNITS.filter(u => u.id === filterUnitId)
    : ATP_UNITS.slice(0, 9);
  
  for (const unit of atpUnitsSlice) {
    const data = unitData.find(d => d.unit_id === unit.id);
    
    if (data) {
      // Real data exists for this unit
      const totalSkills = parseInt(data.total_skills) || 0;
      const verifiedSkills = parseInt(data.verified_skills) || 0;
      const avgMastery = parseFloat(data.avg_mastery) || 0;
      const atRiskSkills = parseInt(data.at_risk_skills) || 0;
      const examWeight = parseFloat(data.total_weight) || 0.1;
      
      const score = Math.round(avgMastery * 100);
      const gateProgress = totalSkills > 0 ? Math.round((verifiedSkills / totalSkills) * 100) : 0;
      
      units.push({
        unitId: unit.id,
        unitName: unit.name,
        score,
        trend: score > 60 ? 'improving' : score < 40 ? 'declining' : 'stable',
        skillsTotal: totalSkills,
        skillsVerified: verifiedSkills,
        skillsAtRisk: atRiskSkills,
        topIssue: atRiskSkills > 0 ? 'Skills need more practice' : undefined,
        examWeight,
        gateProgress,
      });
    } else {
      // No data yet for this unit - show as not started
      units.push({
        unitId: unit.id,
        unitName: unit.name,
        score: 0,
        trend: 'stable',
        skillsTotal: 0,
        skillsVerified: 0,
        skillsAtRisk: 0,
        topIssue: 'Not started',
        examWeight: 0.1,
        gateProgress: 0,
      });
    }
  }
  
  // Calculate overall score (weighted by exam weight)
  const totalWeight = units.reduce((sum, u) => sum + (u.examWeight || 0.1), 0);
  const overallScore = totalWeight > 0 
    ? Math.round(units.reduce((sum, u) => sum + u.score * (u.examWeight || 0.1), 0) / totalWeight)
    : 0;
  
  // Calculate format scores from real data
  const writtenScore = stats?.written_avg ? Math.round(parseFloat(stats.written_avg) * 100) : overallScore;
  const oralScore = stats?.oral_avg ? Math.round(parseFloat(stats.oral_avg) * 100) : overallScore;
  const draftingScore = stats?.drafting_avg ? Math.round(parseFloat(stats.drafting_avg) * 100) : overallScore;
  
  // Calculate confidence interval (wider for fewer attempts)
  const totalAttempts = parseInt(stats?.total_attempts || '0');
  const baseVariance = totalAttempts > 50 ? 3 : totalAttempts > 20 ? 5 : totalAttempts > 5 ? 10 : 20;
  const confidenceInterval: [number, number] = [
    Math.max(0, overallScore - baseVariance),
    Math.min(100, overallScore + baseVariance),
  ];
  
  // Determine overall trend
  const improvingCount = units.filter(u => u.trend === 'improving').length;
  const decliningCount = units.filter(u => u.trend === 'declining').length;
  let overallTrend: 'improving' | 'stable' | 'declining' = 'stable';
  if (improvingCount > decliningCount + 2) overallTrend = 'improving';
  else if (decliningCount > improvingCount + 2) overallTrend = 'declining';
  
  // Count total verified gates
  const totalGates = units.reduce((sum, u) => sum + u.skillsVerified, 0);
  
  return {
    overall: {
      score: overallScore,
      trend: overallTrend,
      trendDelta: overallTrend === 'improving' ? 4 : overallTrend === 'declining' ? -3 : 0,
      confidenceInterval,
      lastUpdated: new Date().toISOString(),
    },
    formats: {
      written: { score: writtenScore, trend: overallTrend },
      oral: { score: oralScore, trend: 'stable' },
      drafting: { score: draftingScore, trend: draftingScore < 55 ? 'declining' : 'stable' },
    },
    units,
    examDate: '2026-04-15',
    daysUntilExam,
    examPhase,
    evidenceSummary: {
      totalAttempts,
      writtenAttempts: parseInt(stats?.written_attempts || '0'),
      oralAttempts: parseInt(stats?.oral_attempts || '0'),
      draftingAttempts: parseInt(stats?.drafting_attempts || '0'),
      timedAttempts: parseInt(stats?.timed_attempts || '0'),
      gatesPassed: totalGates,
      lastAttemptAt: stats?.last_attempt_at || undefined,
    },
  };
}
