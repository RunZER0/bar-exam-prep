'use client';

/**
 * YNAI Mastery Engine v3 - Readiness Dashboard
 * 
 * Core UI showing:
 * - Overall readiness score with confidence interval
 * - Per-unit breakdown with trend indicators
 * - Gate progress visualization
 * - Evidence-backed metrics (no fake vibes)
 * 
 * Per spec: "Every number links back to evidence"
 */

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sheet, SheetHeader, SheetContent, SheetTitle, SheetDescription } from '@/components/ui/sheet';

import EngagingLoader from '@/components/EngagingLoader';
import { getCachedData, setCachedData } from '@/lib/services/autonomous-preload';

// ============================================
// TYPES
// ============================================

interface ReadinessData {
  overall: {
    score: number; // 0-100
    trend: 'improving' | 'stable' | 'declining';
    trendDelta: number;
    confidenceInterval: [number, number];
    lastUpdated: string;
  };
  
  formats: {
    written: { score: number | null; trend: 'improving' | 'stable' | 'declining'; hasData?: boolean };
    oral: { score: number | null; trend: 'improving' | 'stable' | 'declining'; hasData?: boolean };
    drafting: { score: number | null; trend: 'improving' | 'stable' | 'declining'; hasData?: boolean };
  };
  
  units: UnitReadiness[];
  
  examDate?: string;
  daysUntilExam?: number;
  examPhase?: 'distant' | 'approaching' | 'critical' | 'post_exam';
  
  evidenceSummary?: {
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
  gateProgress: number; // 0-100
}

interface SkillDetail {
  skillId: string;
  skillName: string;
  pMastery: number;
  verified: boolean;
  lastAttempt?: string;
  trend: 'improving' | 'stable' | 'declining';
  errorTags: string[];
  formatTags: string[];
}

// ============================================
// MAIN COMPONENT
// ============================================

export default function ReadinessDashboard() {
  const router = useRouter();
  const { getIdToken } = useAuth();
  const [readiness, setReadiness] = useState<ReadinessData | null>(null);
  const [selectedUnit, setSelectedUnit] = useState<string | null>(null);
  const [unitSkills, setUnitSkills] = useState<SkillDetail[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchReadiness = useCallback(async () => {
    try {
      // Try prefetch cache first
      const cached = getCachedData<ReadinessData>('mastery:readiness');
      if (cached) {
        console.log('[ReadinessDashboard] Using prefetched readiness data');
        setReadiness(cached);
        setLoading(false);
        return;
      }

      setLoading(true);
      const token = await getIdToken();
      
      const response = await fetch('/api/mastery/readiness', {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch readiness data');
      }
      
      const data = await response.json();
      setReadiness(data);
      setCachedData('mastery:readiness', data, 10 * 60 * 1000);
    } catch (err) {
      console.error('Error fetching readiness:', err);
    } finally {
      setLoading(false);
    }
  }, [getIdToken]);

  useEffect(() => {
    fetchReadiness();
  }, [fetchReadiness]);

  const fetchUnitSkills = async (unitId: string) => {
    try {
      setUnitSkills([]); // Clear while loading
      const token = await getIdToken();
      
      // Fetch skills for this unit from API
      const response = await fetch(`/api/mastery/readiness?unitId=${unitId}&skills=true`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (!response.ok) {
        console.error('Failed to fetch unit skills');
        return;
      }
      
      const data = await response.json();
      
      // If the API returns skills array, use it; otherwise show default message
      if (data.skills && Array.isArray(data.skills)) {
        setUnitSkills(data.skills);
      } else {
        // Fallback: Show unit-level data as placeholder
        const unitData = readiness?.units.find(u => u.unitId === unitId);
        if (unitData) {
          setUnitSkills([{
            skillId: `${unitId}-summary`,
            skillName: 'Start practicing to see skill breakdown',
            pMastery: unitData.score / 100,
            verified: false,
            lastAttempt: undefined,
            trend: unitData.trend,
            errorTags: [],
            formatTags: ['written'],
          }]);
        }
      }
    } catch (error) {
      console.error('Error fetching unit skills:', error);
    }
  };

  const handleUnitClick = (unitId: string) => {
    setSelectedUnit(unitId);
    fetchUnitSkills(unitId);
  };

  const handleCloseSheet = () => {
    setSelectedUnit(null);
    setUnitSkills([]);
  };

  const selectedUnitData = readiness?.units.find(u => u.unitId === selectedUnit);

  if (loading) {
    return <EngagingLoader size="md" message="Calculating your readiness..." />;
  }

  if (!readiness) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-muted-foreground">No readiness data available.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      {/* Overall Readiness + Exam Countdown */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Overall Score */}
        <Card className="md:col-span-2">
          <CardContent className="pt-5 pb-4">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">Overall Readiness</h3>
            <div className="flex items-center gap-6">
              {/* Score Ring */}
              <div className="text-center flex-shrink-0">
                <div className="relative w-24 h-24">
                  <svg className="w-24 h-24 transform -rotate-90">
                    <circle cx="48" cy="48" r="38" stroke="currentColor" strokeWidth="8" fill="none" className="text-muted" />
                    <circle cx="48" cy="48" r="38" stroke="currentColor" strokeWidth="8" fill="none"
                      strokeDasharray={`${readiness.overall.score * 2.39} 239`}
                      strokeLinecap="round"
                      className={getScoreColor(readiness.overall.score)} />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-2xl font-bold">{readiness.overall.score}%</span>
                  </div>
                </div>
              </div>
              
              {/* Summary Details */}
              <div className="flex-1 space-y-2">
                <p className="text-sm text-muted-foreground">
                  {readiness.overall.score === 0
                    ? 'Start studying to build your readiness score.'
                    : readiness.overall.score < 40
                    ? 'You\'re getting started. Keep practicing to build mastery.'
                    : readiness.overall.score < 70
                    ? 'Good progress. Focus on weaker subjects to improve.'
                    : 'Strong foundation. Maintain consistency and verify your skills.'}
                </p>
                {readiness.evidenceSummary && readiness.evidenceSummary.totalAttempts > 0 && (
                  <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                    <span>{readiness.evidenceSummary.totalAttempts} practice attempts</span>
                    {readiness.evidenceSummary.gatesPassed > 0 && (
                      <span>• {readiness.evidenceSummary.gatesPassed} skills verified</span>
                    )}
                  </div>
                )}
                {readiness.evidenceSummary && readiness.evidenceSummary.totalAttempts === 0 && (
                  <p className="text-xs text-muted-foreground/60 italic">
                    No practice data yet — scores are based on mastery tracking.
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Exam Countdown */}
        {readiness.examDate && readiness.daysUntilExam != null && (
          <Card>
            <CardContent className="pt-5 pb-4 flex flex-col items-center justify-center h-full">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">ATP Exam</h3>
              <div className="text-4xl font-bold text-primary">{readiness.daysUntilExam}</div>
              <div className="text-sm text-muted-foreground mt-1">days remaining</div>
              <div className={`mt-3 px-3 py-1 rounded-full text-xs font-medium ${getPhaseColor(readiness.examPhase)}`}>
                {getPhaseLabel(readiness.examPhase)}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Format Breakdown — only show formats with real data */}
      {(readiness.formats.written.hasData || readiness.formats.oral.hasData || readiness.formats.drafting.hasData) && (
        <Card>
          <CardContent className="pt-5 pb-4">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Performance by Format</h3>
            <div className="space-y-3">
              <FormatBar label="Written" score={readiness.formats.written.score} hasData={readiness.formats.written.hasData} />
              <FormatBar label="Oral" score={readiness.formats.oral.score} hasData={readiness.formats.oral.hasData} />
              <FormatBar label="Drafting" score={readiness.formats.drafting.score} hasData={readiness.formats.drafting.hasData} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Subject Breakdown */}
      <Card>
        <CardContent className="pt-5 pb-3">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Subjects</h3>
            <span className="text-[10px] text-muted-foreground">Tap for details</span>
          </div>
          <div className="space-y-1">
            {readiness.units
              .sort((a, b) => a.score - b.score)
              .map(unit => (
                <UnitRow
                  key={unit.unitId}
                  unit={unit}
                  isSelected={false}
                  onClick={() => handleUnitClick(unit.unitId)}
                />
              ))}
          </div>
        </CardContent>
      </Card>

      {/* Unit Details Sheet Modal */}
      <Sheet open={!!selectedUnit} onClose={handleCloseSheet}>
        <SheetHeader onClose={handleCloseSheet}>
          <SheetTitle>{selectedUnitData?.unitName || 'Unit Details'}</SheetTitle>
          <SheetDescription>
            {selectedUnitData && (
              <span className="flex items-center gap-3 mt-1">
                <span className={`font-semibold ${getScoreColor(selectedUnitData.score)}`}>
                  {selectedUnitData.score}% mastery
                </span>
                <span>•</span>
                <span>{selectedUnitData.skillsVerified}/{selectedUnitData.skillsTotal} verified</span>
                {selectedUnitData.skillsAtRisk > 0 && (
                  <>
                    <span>•</span>
                    <span className="text-amber-600">⚠ {selectedUnitData.skillsAtRisk} at risk</span>
                  </>
                )}
              </span>
            )}
          </SheetDescription>
        </SheetHeader>
        <SheetContent>
          {/* Weak Areas Alert */}
          {selectedUnitData?.topIssue && (
            <div className="mb-6 p-4 bg-amber-50 dark:bg-amber-950 rounded-lg border border-amber-200 dark:border-amber-800">
              <h4 className="font-semibold text-amber-700 dark:text-amber-300 mb-1">🎯 Focus Area</h4>
              <p className="text-sm text-amber-600 dark:text-amber-400">{selectedUnitData.topIssue}</p>
              <Button 
                variant="outline" 
                size="sm" 
                className="mt-3 border-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900"
                onClick={() => {
                  handleCloseSheet();
                  router.push(`/study/${selectedUnitData.unitId}?focus=${encodeURIComponent(selectedUnitData.topIssue || '')}`);
                }}
              >
                Practice This Now →
              </Button>
            </div>
          )}

          {/* Skills List */}
          <div>
            <h4 className="font-semibold mb-3 flex items-center gap-2">
              Skills Breakdown
              <span className="text-xs font-normal text-muted-foreground">({unitSkills.length} skills)</span>
            </h4>
            {unitSkills.length > 0 ? (
              <div className="space-y-3">
                {unitSkills
                  .sort((a, b) => a.pMastery - b.pMastery) // Weakest first
                  .map(skill => (
                    <SkillRow 
                      key={skill.skillId} 
                      skill={skill} 
                      unitId={selectedUnit || ''}
                      onPractice={() => {
                        handleCloseSheet();
                        router.push(`/study/${selectedUnit}?skillId=${skill.skillId}`);
                      }}
                    />
                  ))}
              </div>
            ) : (
              <div className="flex items-center justify-center h-24">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
              </div>
            )}
          </div>

          {/* Gate Progress */}
          {selectedUnitData && (
            <div className="mt-6 p-4 bg-muted rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium text-sm">Gate Progress</h4>
                <span className="text-sm font-semibold">{selectedUnitData.gateProgress}%</span>
              </div>
              <div className="w-full bg-background rounded-full h-3">
                <div 
                  className="h-3 rounded-full bg-gradient-to-r from-green-500 to-emerald-400 transition-all duration-500"
                  style={{ width: `${selectedUnitData.gateProgress}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Pass the gate by achieving 85%+ mastery with timed verification
              </p>
            </div>
          )}
        </SheetContent>
      </Sheet>

    </div>
  );
}

// ============================================
// SUB-COMPONENTS
// ============================================

function FormatBar({ 
  label, 
  score,
  hasData,
}: { 
  label: string; 
  score: number | null;
  hasData?: boolean;
}) {
  if (!hasData || score === null) {
    return (
      <div>
        <div className="flex justify-between text-sm mb-1">
          <span className="text-muted-foreground">{label}</span>
          <span className="text-xs text-muted-foreground/60 italic">No attempts yet</span>
        </div>
        <div className="w-full bg-muted rounded-full h-2">
          <div className="h-2 rounded-full bg-muted-foreground/10" style={{ width: '0%' }} />
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span>{label}</span>
        <span className="font-medium">{score}% <span className="text-[10px] text-muted-foreground font-normal">avg</span></span>
      </div>
      <div className="w-full bg-muted rounded-full h-2">
        <div 
          className={`h-2 rounded-full ${getBarColor(score)}`}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );
}

function UnitRow({ 
  unit, 
  isSelected, 
  onClick 
}: { 
  unit: UnitReadiness; 
  isSelected: boolean; 
  onClick: () => void;
}) {
  return (
    <div 
      className={`group flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-colors hover:bg-muted/60 ${
        isSelected ? 'bg-primary/10' : ''
      }`}
      onClick={onClick}
    >
      {/* Score Badge */}
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 ${getScoreBg(unit.score)}`}>
        {unit.score}%
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="font-medium text-sm truncate">{unit.unitName}</span>
        </div>
        <div className="text-[11px] text-muted-foreground mt-0.5">
          {unit.skillsTotal === 0 ? (
            <span className="italic">Not started</span>
          ) : (
            <>
              {unit.skillsVerified}/{unit.skillsTotal} topics verified
              {unit.skillsAtRisk > 0 && (
                <span className="text-amber-600 ml-2">• {unit.skillsAtRisk} need work</span>
              )}
            </>
          )}
        </div>
      </div>

      {/* Gate Progress Mini */}
      <div className="w-16 flex-shrink-0">
        <div className="w-full bg-muted rounded-full h-1.5">
          <div 
            className="h-1.5 rounded-full bg-green-500 transition-all duration-500"
            style={{ width: `${unit.gateProgress}%` }}
          />
        </div>
        <div className="text-[10px] text-center text-muted-foreground mt-0.5">{unit.gateProgress}%</div>
      </div>

      <span className="text-muted-foreground/40 group-hover:text-muted-foreground transition-colors text-sm">›</span>
    </div>
  );
}

function SkillRow({ skill, unitId, onPractice }: { skill: SkillDetail; unitId: string; onPractice: () => void }) {
  const masteryPercent = Math.round(skill.pMastery * 100);
  
  return (
    <div className="flex items-center gap-4 p-2 rounded hover:bg-muted">
      {/* Mastery Bar */}
      <div className="w-16">
        <div className="w-full bg-muted rounded-full h-2">
          <div 
            className={`h-2 rounded-full ${getBarColor(masteryPercent)}`}
            style={{ width: `${masteryPercent}%` }}
          />
        </div>
        <div className="text-xs text-center mt-0.5">{masteryPercent}%</div>
      </div>

      {/* Skill Info */}
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm">{skill.skillName}</span>
          {skill.verified && (
            <span className="text-green-500 text-xs">✓ Verified</span>
          )}
          <span className="text-xs text-muted-foreground">
            {getTrendIcon(skill.trend)}
          </span>
        </div>
        <div className="flex items-center gap-2 mt-1">
          {skill.formatTags.map(tag => (
            <span key={tag} className="text-xs bg-muted px-1.5 py-0.5 rounded">
              {tag}
            </span>
          ))}
          {skill.errorTags.map(tag => (
            <span key={tag} className="text-xs bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 px-1.5 py-0.5 rounded">
              {tag}
            </span>
          ))}
        </div>
      </div>

      {/* Last Practice */}
      {skill.lastAttempt && (
        <div className="text-xs text-muted-foreground">
          {skill.lastAttempt}
        </div>
      )}

      {/* Quick Action */}
      <Button variant="ghost" size="sm" onClick={onPractice}>
        Practice
      </Button>
    </div>
  );
}

// ============================================
// HELPERS
// ============================================

function getTrendIcon(trend: 'improving' | 'stable' | 'declining'): string {
  switch (trend) {
    case 'improving': return '📈';
    case 'declining': return '📉';
    default: return '➡️';
  }
}

function getScoreColor(score: number): string {
  if (score >= 80) return 'text-green-500';
  if (score >= 60) return 'text-amber-500';
  return 'text-red-500';
}

function getScoreBg(score: number): string {
  if (score >= 80) return 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300';
  if (score >= 60) return 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300';
  return 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300';
}

function getBarColor(score: number): string {
  if (score >= 80) return 'bg-green-500';
  if (score >= 60) return 'bg-amber-500';
  return 'bg-red-500';
}

function getPhaseColor(phase?: string): string {
  switch (phase) {
    case 'critical': return 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300';
    case 'approaching': return 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300';
    default: return 'bg-muted text-muted-foreground';
  }
}

function getPhaseLabel(phase?: string): string {
  switch (phase) {
    case 'distant': return 'Building Foundation';  // >= 60 days
    case 'approaching': return 'Exam Approaching'; // 8-59 days
    case 'critical': return 'Critical Phase';      // 0-7 days
    default: return 'Active Study';
  }
}
