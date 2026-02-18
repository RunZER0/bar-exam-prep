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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sheet, SheetHeader, SheetContent, SheetTitle, SheetDescription } from '@/components/ui/sheet';

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
    written: { score: number; trend: 'improving' | 'stable' | 'declining' };
    oral: { score: number; trend: 'improving' | 'stable' | 'declining' };
    drafting: { score: number; trend: 'improving' | 'stable' | 'declining' };
  };
  
  units: UnitReadiness[];
  
  examDate?: string;
  daysUntilExam?: number;
  // Product spec: >= 60 = distant, 8-59 = approaching, 0-7 = critical
  examPhase?: 'distant' | 'approaching' | 'critical' | 'post_exam';
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
            lastAttempt: null,
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
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
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
    <div className="space-y-6">
      {/* Overall Readiness Score */}
      <Card>
        <CardHeader>
          <CardTitle>Exam Readiness</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-8">
            {/* Main Score */}
            <div className="text-center">
              <div className="relative w-32 h-32">
                <svg className="w-32 h-32 transform -rotate-90">
                  <circle
                    cx="64"
                    cy="64"
                    r="56"
                    stroke="currentColor"
                    strokeWidth="12"
                    fill="none"
                    className="text-muted"
                  />
                  <circle
                    cx="64"
                    cy="64"
                    r="56"
                    stroke="currentColor"
                    strokeWidth="12"
                    fill="none"
                    strokeDasharray={`${readiness.overall.score * 3.52} 352`}
                    className={getScoreColor(readiness.overall.score)}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-3xl font-bold">{readiness.overall.score}%</span>
                  <span className="text-sm text-muted-foreground">
                    {getTrendIcon(readiness.overall.trend)} {readiness.overall.trendDelta > 0 ? '+' : ''}{readiness.overall.trendDelta}
                  </span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                95% CI: {readiness.overall.confidenceInterval[0]}-{readiness.overall.confidenceInterval[1]}%
              </p>
            </div>

            {/* Format Breakdown */}
            <div className="flex-1 space-y-3">
              <FormatBar 
                label="Written" 
                score={readiness.formats.written.score} 
                trend={readiness.formats.written.trend}
              />
              <FormatBar 
                label="Oral" 
                score={readiness.formats.oral.score} 
                trend={readiness.formats.oral.trend}
              />
              <FormatBar 
                label="Drafting" 
                score={readiness.formats.drafting.score} 
                trend={readiness.formats.drafting.trend}
              />
            </div>

            {/* Exam Countdown */}
            {readiness.examDate && (
              <div className="text-center px-4 border-l">
                <div className="text-4xl font-bold text-primary">{readiness.daysUntilExam}</div>
                <div className="text-sm text-muted-foreground">days until exam</div>
                <div className={`mt-2 px-2 py-1 rounded text-xs font-medium ${getPhaseColor(readiness.examPhase)}`}>
                  {getPhaseLabel(readiness.examPhase)}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Unit Breakdown */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Unit Readiness</CardTitle>
            <p className="text-xs text-muted-foreground">Click a subject to see details</p>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 stagger-children">
            {readiness.units
              .sort((a, b) => a.score - b.score) // Lowest first (needs attention)
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

      {/* At-Risk Skills Alert */}
      {readiness.units.some(u => u.skillsAtRisk > 0) && (
        <Card className="border-amber-200 dark:border-amber-800">
          <CardHeader>
            <CardTitle className="text-amber-600 dark:text-amber-400">
              Skills Needing Attention
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {readiness.units
                .filter(u => u.topIssue)
                .map(unit => (
                  <div key={unit.unitId} className="flex items-center gap-3 text-sm">
                    <span className="font-medium">{unit.unitName}:</span>
                    <span className="text-muted-foreground">{unit.topIssue}</span>
                    <Button 
                      variant="link" 
                      size="sm" 
                      className="ml-auto text-primary"
                      onClick={() => router.push(`/study/${unit.unitId}?focus=${encodeURIComponent(unit.topIssue || '')}`)}
                    >
                      Practice Now →
                    </Button>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ============================================
// SUB-COMPONENTS
// ============================================

function FormatBar({ 
  label, 
  score, 
  trend 
}: { 
  label: string; 
  score: number; 
  trend: 'improving' | 'stable' | 'declining';
}) {
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span>{label}</span>
        <span className="flex items-center gap-1">
          {getTrendIcon(trend)} {score}%
        </span>
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
      className={`group p-3 rounded-lg cursor-pointer transition-all duration-200 hover:bg-muted hover:scale-[1.01] hover:shadow-sm active:scale-[0.99] ${
        isSelected ? 'bg-primary/10' : ''
      }`}
      onClick={onClick}
    >
      <div className="flex items-center gap-4">
        {/* Score Circle */}
        <div className={`w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold ${getScoreBg(unit.score)}`}>
          {unit.score}%
        </div>

        {/* Unit Info */}
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-medium">{unit.unitName}</span>
            <span className="text-xs text-muted-foreground">
              {getTrendIcon(unit.trend)}
            </span>
            {unit.examWeight && (
              <span className="text-xs bg-muted px-1.5 py-0.5 rounded">
                {(unit.examWeight * 100).toFixed(0)}% of exam
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
            <span>{unit.skillsVerified}/{unit.skillsTotal} verified</span>
            {unit.skillsAtRisk > 0 && (
              <span className="text-amber-600">⚠ {unit.skillsAtRisk} at risk</span>
            )}
          </div>
        </div>

        {/* Gate Progress */}
        <div className="w-24">
          <div className="text-xs text-center mb-1">Gate Progress</div>
          <div className="w-full bg-muted rounded-full h-2">
            <div 
              className="h-2 rounded-full bg-green-500"
              style={{ width: `${unit.gateProgress}%` }}
            />
          </div>
        </div>

        {/* View Details Icon */}
        <span className="text-muted-foreground transition-transform group-hover:translate-x-1">
          →
        </span>
      </div>

      {/* Top Issue */}
      {unit.topIssue && (
        <div className="mt-2 text-xs text-amber-600 dark:text-amber-400 pl-16">
          Focus: {unit.topIssue}
        </div>
      )}
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
