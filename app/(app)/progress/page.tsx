'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { ATP_UNITS } from '@/lib/constants/legal-content';
import EngagingLoader from '@/components/EngagingLoader';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Clock,
  BookOpen,
  Target,
  Flame,
  CheckCircle2,
  AlertTriangle,
  Calendar,
  Award,
} from 'lucide-react';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TYPES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface ReportData {
  overallMastery: number;
  totalSkills: number;
  verifiedSkills: number;
  strongSkillsCount: number;
  weakSkillsCount: number;
  untouchedSkillsCount: number;
  studyTime: {
    totalMinutes: number;
    thisWeekMinutes: number;
    lastWeekMinutes: number;
    weekOverWeekChange: number;
    avgSessionMinutes: number;
    totalSessions: number;
    daysActive: number;
    currentStreak: number;
  };
  quiz: {
    totalQuestions: number;
    correctAnswers: number;
    accuracy: number;
    totalSessions: number;
  };
  formats: {
    written: { attempts: number; avgScore: number | null };
    oral: { attempts: number; avgScore: number | null };
    drafting: { attempts: number; avgScore: number | null };
  };
  unitReports: Array<{
    unitId: string;
    unitName: string;
    mastery: number;
    totalSkills: number;
    verifiedSkills: number;
    strongCount: number;
    weakCount: number;
    quizAccuracy: number | null;
    quizAttempts: number;
  }>;
  strengths: Array<{ name: string; unitId: string; mastery: number; verified: boolean }>;
  weaknesses: Array<{ name: string; unitId: string; mastery: number }>;
  activityChart: Array<{
    date: string;
    day: string;
    minutes: number;
    questions: number;
    sessions: number;
  }>;
  projection: {
    daysUntilExam: number;
    examDate: string;
    topicsCovered: number;
    topicsRemaining: number;
    avgTopicsPerDay: number;
    estimatedDaysToFinish: number | null;
    onTrack: boolean;
  };
  generatedAt: string;
  userName: string;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// MAIN PAGE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export default function ProgressPage() {
  const { user, getIdToken } = useAuth();
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchReport() {
      try {
        const token = await getIdToken();
        const res = await fetch('/api/progress/report', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          setData(await res.json());
        }
      } catch (e) {
        console.error('Failed to load progress report:', e);
      } finally {
        setLoading(false);
      }
    }
    if (user) fetchReport();
  }, [user, getIdToken]);

  if (loading) {
    return <EngagingLoader size="lg" message="Generating your progress report..." />;
  }

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Unable to load your report. Please try again.</p>
      </div>
    );
  }

  const firstName = user?.displayName?.split(' ')[0] || 'Counsel';
  const reportDate = new Date(data.generatedAt).toLocaleDateString('en-KE', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });

  const formatMinutes = (mins: number) => {
    if (mins < 60) return `${mins}m`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  };

  const getBarHeight = (value: number, max: number) =>
    max > 0 ? Math.max((value / max) * 100, 4) : 4;

  const maxMinutes = Math.max(...data.activityChart.map(d => d.minutes), 1);

  // ─── Narrative Summary ───
  const getNarrativeSummary = () => {
    const parts: string[] = [];

    if (data.studyTime.thisWeekMinutes > 0) {
      const timeStr = formatMinutes(data.studyTime.thisWeekMinutes);
      if (data.studyTime.weekOverWeekChange > 0) {
        parts.push(`You've put in ${timeStr} this week — that's ${data.studyTime.weekOverWeekChange}% more than last week. Great momentum.`);
      } else if (data.studyTime.weekOverWeekChange < 0) {
        parts.push(`You've studied ${timeStr} this week, which is ${Math.abs(data.studyTime.weekOverWeekChange)}% less than last week. Consider increasing your sessions.`);
      } else {
        parts.push(`You've studied ${timeStr} this week, matching your previous pace.`);
      }
    } else {
      parts.push("You haven't logged any study time this week. Even 30 minutes a day makes a difference.");
    }

    if (data.overallMastery > 0) {
      parts.push(`Your overall mastery sits at ${data.overallMastery}%, with ${data.verifiedSkills} of ${data.totalSkills} skills verified.`);
    }

    if (data.strengths.length > 0) {
      const topStrength = data.strengths[0];
      const unitName = ATP_UNITS.find(u => u.id === topStrength.unitId)?.name || topStrength.unitId;
      parts.push(`Your strongest area is "${topStrength.name}" in ${unitName} at ${topStrength.mastery}%.`);
    }

    if (data.weaknesses.length > 0) {
      const topWeak = data.weaknesses[0];
      const unitName = ATP_UNITS.find(u => u.id === topWeak.unitId)?.name || topWeak.unitId;
      parts.push(`You should focus on "${topWeak.name}" in ${unitName} — currently at ${topWeak.mastery}%.`);
    }

    if (data.projection.estimatedDaysToFinish !== null) {
      if (data.projection.onTrack) {
        parts.push(`At your current pace, you'll cover all topics about ${data.projection.estimatedDaysToFinish} days from now — well within the ${data.projection.daysUntilExam} days until your exam.`);
      } else {
        parts.push(`At your current pace, it would take ${data.projection.estimatedDaysToFinish} days to cover remaining topics, but your exam is in ${data.projection.daysUntilExam} days. You'll need to pick up the pace.`);
      }
    }

    return parts;
  };

  return (
    <div className="min-h-screen bg-background animate-content-enter">
      {/* Report Header */}
      <div className="border-b border-border/40 bg-card/50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Progress Report</h1>
              <p className="text-sm text-muted-foreground mt-1">
                {firstName} · {reportDate}
              </p>
            </div>
            {data.studyTime.currentStreak > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/10 text-amber-600 text-sm font-medium">
                <Flame className="h-4 w-4" />
                {data.studyTime.currentStreak} day streak
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-10">
        {/* Narrative Summary */}
        <section>
          <div className="rounded-xl bg-muted/40 p-5 space-y-2">
            {getNarrativeSummary().map((para, i) => (
              <p key={i} className="text-sm text-foreground/80 leading-relaxed">{para}</p>
            ))}
          </div>
        </section>

        {/* Key Metrics */}
        <section>
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">At a Glance</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <MetricCard label="Overall Mastery" value={`${data.overallMastery}%`} icon={<Target className="h-4 w-4" />} color="text-primary" />
            <MetricCard label="Study Time" value={formatMinutes(data.studyTime.totalMinutes)} sub="last 30 days" icon={<Clock className="h-4 w-4" />} />
            <MetricCard label="Topics Covered" value={`${data.projection.topicsCovered}/${data.totalSkills}`} icon={<BookOpen className="h-4 w-4" />} />
            <MetricCard label="Days to Exam" value={String(data.projection.daysUntilExam)} icon={<Calendar className="h-4 w-4" />} color="text-primary" />
          </div>
        </section>

        {/* This Week vs Last Week */}
        <section>
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">This Week vs Last Week</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <ComparisonCard label="Study Time" current={formatMinutes(data.studyTime.thisWeekMinutes)} previous={formatMinutes(data.studyTime.lastWeekMinutes)} change={data.studyTime.weekOverWeekChange} />
            <ComparisonCard label="Quiz Accuracy" current={`${data.quiz.accuracy}%`} previous="—" change={null} />
            <ComparisonCard label="Avg Session" current={formatMinutes(data.studyTime.avgSessionMinutes)} previous="—" change={null} />
          </div>
        </section>

        {/* Activity Chart */}
        <section>
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">Study Activity — Last 30 Days</h2>
          <div className="rounded-xl bg-card p-4">
            <div className="flex items-end gap-[3px] h-32">
              {data.activityChart.map((day, i) => (
                <div key={i} className="flex-1 flex flex-col items-center justify-end h-full group relative">
                  <div
                    className="w-full rounded-t bg-primary/70 hover:bg-primary transition-colors"
                    style={{ height: `${getBarHeight(day.minutes, maxMinutes)}%` }}
                  />
                  <div className="absolute bottom-full mb-2 hidden group-hover:flex flex-col items-center z-10">
                    <div className="bg-popover border border-border/40 text-xs rounded-lg px-2.5 py-1.5 shadow-lg whitespace-nowrap">
                      <div className="font-medium">{day.date}</div>
                      <div>{day.minutes}m · {day.questions} Qs</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-between mt-2 text-[10px] text-muted-foreground">
              {data.activityChart.filter((_, i) => i % 7 === 0).map((day, i) => (
                <span key={i}>{day.date.slice(5)}</span>
              ))}
              <span>{data.activityChart[data.activityChart.length - 1]?.date.slice(5)}</span>
            </div>
          </div>
        </section>

        {/* Syllabus Projection */}
        <section>
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">Syllabus Completion Projection</h2>
          <div className="rounded-xl bg-card p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-muted-foreground">{data.projection.topicsCovered} of {data.totalSkills} topics covered</span>
              <span className="text-sm font-medium">{data.totalSkills > 0 ? Math.round((data.projection.topicsCovered / data.totalSkills) * 100) : 0}%</span>
            </div>
            <div className="w-full bg-muted rounded-full h-3 mb-4">
              <div className="h-3 rounded-full bg-primary transition-all duration-700" style={{ width: `${data.totalSkills > 0 ? (data.projection.topicsCovered / data.totalSkills) * 100 : 0}%` }} />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
              <div>
                <div className="text-muted-foreground text-xs">Topics remaining</div>
                <div className="font-semibold">{data.projection.topicsRemaining}</div>
              </div>
              <div>
                <div className="text-muted-foreground text-xs">Avg per day</div>
                <div className="font-semibold">{data.projection.avgTopicsPerDay}</div>
              </div>
              <div>
                <div className="text-muted-foreground text-xs">Est. days to finish</div>
                <div className="font-semibold">{data.projection.estimatedDaysToFinish ?? '—'}</div>
              </div>
              <div>
                <div className="text-muted-foreground text-xs">Status</div>
                <div className={`font-semibold flex items-center gap-1 ${data.projection.onTrack ? 'text-green-600' : 'text-amber-600'}`}>
                  {data.projection.onTrack
                    ? <><CheckCircle2 className="h-3.5 w-3.5" /> On track</>
                    : <><AlertTriangle className="h-3.5 w-3.5" /> Needs attention</>}
                </div>
              </div>
            </div>
            {!data.projection.onTrack && data.projection.estimatedDaysToFinish && (
              <p className="text-xs text-muted-foreground mt-3 bg-amber-500/5 rounded-lg p-3">
                To finish on time, we recommend studying{' '}
                <strong>{Math.ceil(data.projection.topicsRemaining / Math.max(data.projection.daysUntilExam, 1))} topics per day</strong>
                {' '}— about {formatMinutes(Math.ceil((data.projection.topicsRemaining / Math.max(data.projection.daysUntilExam, 1)) * 20))} of focused study.
              </p>
            )}
          </div>
        </section>

        {/* Subject Breakdown */}
        <section>
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">Subject-by-Subject Breakdown</h2>
          <div className="space-y-1">
            {data.unitReports.sort((a, b) => b.mastery - a.mastery).map(unit => (
              <UnitReportRow key={unit.unitId} unit={unit} />
            ))}
          </div>
        </section>

        {/* Strengths & Weaknesses */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <section>
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
              <Award className="h-3.5 w-3.5 text-green-500" /> Your Strongest Skills
            </h2>
            {data.strengths.length > 0 ? (
              <div className="space-y-1">
                {data.strengths.map((skill, i) => {
                  const unitName = ATP_UNITS.find(u => u.id === skill.unitId)?.name || '';
                  return (
                    <div key={i} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted/50 transition-colors">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium truncate">{skill.name}</div>
                        <div className="text-[11px] text-muted-foreground">{unitName}</div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-sm font-semibold text-green-600">{skill.mastery}%</span>
                        {skill.verified && <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-4">Study more topics to identify your strengths.</p>
            )}
          </section>

          <section>
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-500" /> Areas That Need Work
            </h2>
            {data.weaknesses.length > 0 ? (
              <div className="space-y-1">
                {data.weaknesses.map((skill, i) => {
                  const unitName = ATP_UNITS.find(u => u.id === skill.unitId)?.name || '';
                  return (
                    <div key={i} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted/50 transition-colors">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium truncate">{skill.name}</div>
                        <div className="text-[11px] text-muted-foreground">{unitName}</div>
                      </div>
                      <span className="text-sm font-semibold text-amber-600 shrink-0">{skill.mastery}%</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-4">Keep studying to identify areas for improvement.</p>
            )}
          </section>
        </div>

        {/* Format Performance */}
        {(data.formats.written.attempts > 0 || data.formats.oral.attempts > 0 || data.formats.drafting.attempts > 0) && (
          <section>
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">Performance by Exam Format</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <FormatCard label="Written" attempts={data.formats.written.attempts} score={data.formats.written.avgScore} />
              <FormatCard label="Oral" attempts={data.formats.oral.attempts} score={data.formats.oral.avgScore} />
              <FormatCard label="Drafting" attempts={data.formats.drafting.attempts} score={data.formats.drafting.avgScore} />
            </div>
          </section>
        )}

        {/* Footer */}
        <div className="text-center py-6">
          <p className="text-xs text-muted-foreground">
            Report generated on {reportDate}. Data reflects your activity on the Ynai platform.
          </p>
        </div>
      </div>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SUB-COMPONENTS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function MetricCard({ label, value, sub, icon, color }: {
  label: string; value: string; sub?: string; icon: React.ReactNode; color?: string;
}) {
  return (
    <div className="rounded-xl bg-card p-4">
      <div className="flex items-center gap-2 text-muted-foreground mb-2">
        {icon}
        <span className="text-xs font-medium">{label}</span>
      </div>
      <div className={`text-2xl font-bold ${color || 'text-foreground'}`}>{value}</div>
      {sub && <div className="text-[11px] text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  );
}

function ComparisonCard({ label, current, previous, change }: {
  label: string; current: string; previous: string; change: number | null;
}) {
  return (
    <div className="rounded-xl bg-card p-4">
      <div className="text-xs text-muted-foreground mb-2">{label}</div>
      <div className="text-xl font-bold">{current}</div>
      {change !== null ? (
        <div className={`flex items-center gap-1 text-xs mt-1 ${
          change > 0 ? 'text-green-600' : change < 0 ? 'text-amber-600' : 'text-muted-foreground'
        }`}>
          {change > 0 ? <TrendingUp className="h-3 w-3" /> : change < 0 ? <TrendingDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
          {change > 0 ? `+${change}%` : change < 0 ? `${change}%` : 'Same'} vs last week
        </div>
      ) : (
        <div className="text-[11px] text-muted-foreground mt-1">Previously: {previous}</div>
      )}
    </div>
  );
}

function UnitReportRow({ unit }: { unit: ReportData['unitReports'][0] }) {
  const pct = unit.mastery;
  return (
    <div className="flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-muted/40 transition-colors">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${
        pct >= 70 ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400'
        : pct >= 40 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400'
        : 'bg-muted text-muted-foreground'
      }`}>
        {pct}%
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">{unit.unitName}</div>
        <div className="text-[11px] text-muted-foreground mt-0.5">
          {unit.totalSkills > 0
            ? <>{unit.verifiedSkills}/{unit.totalSkills} verified{unit.weakCount > 0 && <span className="text-amber-600 ml-2">· {unit.weakCount} weak</span>}</>
            : <span className="italic">Not started</span>}
        </div>
      </div>
      <div className="text-right shrink-0">
        {unit.quizAccuracy !== null
          ? <><div className="text-sm font-medium">{unit.quizAccuracy}%</div><div className="text-[10px] text-muted-foreground">{unit.quizAttempts} quiz Q&apos;s</div></>
          : <div className="text-[11px] text-muted-foreground">No quizzes</div>}
      </div>
      <div className="w-20 shrink-0">
        <div className="w-full bg-muted rounded-full h-1.5">
          <div className={`h-1.5 rounded-full transition-all duration-500 ${
            pct >= 70 ? 'bg-green-500' : pct >= 40 ? 'bg-amber-500' : 'bg-muted-foreground/30'
          }`} style={{ width: `${pct}%` }} />
        </div>
      </div>
    </div>
  );
}

function FormatCard({ label, attempts, score }: { label: string; attempts: number; score: number | null }) {
  const hasData = attempts > 0 && score !== null;
  return (
    <div className="rounded-xl bg-card p-4">
      <div className="text-xs text-muted-foreground mb-1">{label}</div>
      {hasData
        ? <><div className="text-xl font-bold">{score}%</div><div className="text-[11px] text-muted-foreground">{attempts} attempts</div></>
        : <><div className="text-xl font-bold text-muted-foreground/40">—</div><div className="text-[11px] text-muted-foreground">No attempts yet</div></>}
    </div>
  );
}
