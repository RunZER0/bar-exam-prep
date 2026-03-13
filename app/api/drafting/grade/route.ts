/**
 * Drafting Grade API — Claude Sonnet 4.6 Redlining via CritiqueEngine
 * 
 * POST /api/drafting/grade
 * Uses CritiqueEngine (Claude Sonnet 4.6 with extended thinking) to produce
 * Senior-Partner-grade redline annotations on student legal drafts.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth, type AuthUser } from '@/lib/auth/middleware';
import { CritiqueEngine } from '@/lib/services/critique-engine';

async function handlePost(req: NextRequest, user: AuthUser): Promise<Response> {
  try {
    const { draft, documentType, scenario } = await req.json();

    if (!draft?.trim()) {
      return NextResponse.json({ error: 'Draft text is required' }, { status: 400 });
    }
    if (!documentType?.trim()) {
      return NextResponse.json({ error: 'Document type is required' }, { status: 400 });
    }

    const topic = scenario
      ? `${documentType} — Scenario: ${scenario}`
      : documentType;

    const result = await CritiqueEngine.critiqueDraft(draft, topic);

    // Map CritiqueEngine output to frontend GradeResult format
    const annotations = result.redlines.map(r => ({
      category: r.severity === 'critical' ? 'substance' : 'structure',
      severity: r.severity === 'critical' ? 'error' as const : 'needs-improvement' as const,
      text: r.originalText.startsWith('[MISSING:') ? '' : r.originalText,
      comment: r.comment,
    })).filter(a => a.text.length > 0); // Only keep annotations with matchable text

    // Extract missing items as improvement suggestions
    const missingItems = result.redlines
      .filter(r => r.originalText.startsWith('[MISSING:'))
      .map(r => r.comment);

    // Convert 0-1 score to 0-100 and letter grade
    const scorePercent = Math.round(result.score * 100);
    const grade = scorePercent >= 90 ? 'A' : scorePercent >= 80 ? 'B+' : scorePercent >= 70 ? 'B'
      : scorePercent >= 60 ? 'C+' : scorePercent >= 50 ? 'C' : scorePercent >= 40 ? 'D' : 'F';

    // Derive category scores from annotation distribution
    const criticalCount = result.redlines.filter(r => r.severity === 'critical').length;
    const minorCount = result.redlines.filter(r => r.severity === 'minor').length;
    const totalIssues = criticalCount + minorCount;
    const baseLine = scorePercent;

    const gradeResult = {
      overallScore: scorePercent,
      grade,
      summary: result.feedback,
      categories: {
        structure: Math.max(0, Math.min(100, baseLine + (minorCount > 3 ? -10 : 5))),
        substance: Math.max(0, Math.min(100, baseLine + (criticalCount > 2 ? -15 : 0))),
        legalAccuracy: Math.max(0, Math.min(100, baseLine + (criticalCount > 1 ? -10 : 5))),
        language: Math.max(0, Math.min(100, baseLine + 5)),
        formatting: Math.max(0, Math.min(100, baseLine + (minorCount > 2 ? -5 : 10))),
      },
      annotations,
      strengths: totalIssues < 3
        ? ['Well-structured draft with few critical issues']
        : ['Draft submitted and reviewed'],
      improvements: [
        ...missingItems.slice(0, 5),
        ...(criticalCount > 0 ? [`${criticalCount} critical issue(s) identified — review redlined sections`] : []),
      ],
    };

    return NextResponse.json(gradeResult);
  } catch (error: any) {
    console.error('[Drafting Grade] Error:', error?.message || error);
    return NextResponse.json(
      { error: error?.message || 'Grading failed. Please try again.' },
      { status: 500 },
    );
  }
}

export const POST = withAuth(handlePost);
