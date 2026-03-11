'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useTimeTracker } from '@/lib/hooks/useTimeTracker';
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
  BarChart3,
  Zap,
  GraduationCap,
  FileText,
  Mic,
  PenLine,
  ChevronRight,
  RefreshCw,
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
  useTimeTracker('progress');
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchReport = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
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
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (user) fetchReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  if (loading) {
    return <EngagingLoader size="lg" message="Putting together your progress report..." />;
  }

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-3">
          <BarChart3 className="h-10 w-10 mx-auto text-muted-foreground/30" />
          <p className="text-muted-foreground">Unable to load your report. Please try again.</p>
          <button onClick={() => fetchReport()} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm">
            Retry
          </button>
        </div>
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

  // Mastery ring percentage
  const masteryPct = data.overallMastery;
  const circumference = 2 * Math.PI * 42;
  const masteryOffset = circumference - (masteryPct / 100) * circumference;

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
    <div className="flex flex-col h-[calc(100vh-3.5rem)] bg-background animate-content-enter">
      {/* Report Header */}
      <div className="border-b border-border/20 bg-card/40 shrink-0">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-primary/15 to-primary/5">
                <BarChart3 className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h1 className="text-lg font-bold flex items-center gap-2">
                  Progress Report
                  {data.studyTime.currentStreak > 0 && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 text-xs font-medium">
                      <Flame className="h-3 w-3" /> {data.studyTime.currentStreak}d
                    </span>
                  )}
                </h1>
                <p className="text-xs text-muted-foreground">{firstName} · {reportDate}</p>
              </div>
            </div>
            <button
              onClick={() => fetchReport(true)}
              disabled={refreshing}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={'h-3.5 w-3.5 ' + (refreshing ? 'animate-spin' : '')} />
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-8">

          {/* Hero metrics row: Mastery ring + key stats */}
          <section className="rounded-2xl bg-card/60 p-5 sm:p-6 animate-fade-in">
            <div className="flex flex-col sm:flex-row items-center gap-6">
              {/* SVG mastery ring */}
              <div className="relative shrink-0">
                <svg width="100" height="100" viewBox="0 0 100 100" className="transform -rotate-90">
                  <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeWidth="6" className="text-muted/30" />
                  <circle
                    cx="50" cy="50" r="42" fill="none" strokeWidth="6"
                    stroke="url(#mastery-gradient)"
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={masteryOffset}
                    className="transition-all duration-1000 ease-out"
                  />
                  <defs>
                    <linearGradient id="mastery-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="hsl(var(--primary))" />
                      <stop offset="100%" stopColor="hsl(var(--primary) / 0.6)" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-2xl font-bold">{masteryPct}%</span>
                  <span className="text-[9px] text-muted-foreground uppercase tracking-wider">Mastery</span>
                </div>
              </div>

              {/* Stats grid */}
              <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-3 w-full">
                <MiniStat icon={<Clock className="h-3.5 w-3.5" />} label="Study Time" value={formatMinutes(data.studyTime.totalMinutes)} accent="text-blue-500" />
                <MiniStat icon={<BookOpen className="h-3.5 w-3.5" />} label="Topics" value={`${data.projection.topicsCovered}/${data.totalSkills}`} accent="text-emerald-500" />
                <MiniStat icon={<Zap className="h-3.5 w-3.5" />} label="Quiz Accuracy" value={`${data.quiz.accuracy}%`} accent="text-amber-500" />
                <MiniStat icon={<Calendar className="h-3.5 w-3.5" />} label="Days to Exam" value={String(data.projection.daysUntilExam)} accent="text-rose-500" />
              </div>
            </div>
          </section>

          {/* Narrative Summary */}
          <section className="animate-fade-in" style={{ animationDelay: '60ms', animationFillMode: 'both' }}>
            <div className="rounded-2xl bg-gradient-to-br from-primary/[0.04] to-transparent p-5 space-y-2">
              <div className="flex items-center gap-2 mb-3">
                <GraduationCap className="h-4 w-4 text-primary" />
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">AI Coach Summary</span>
              </div>
              {getNarrativeSummary().map((para, i) => (
                <p key={i} className="text-sm text-foreground/80 leading-relaxed">{para}</p>
              ))}
            </div>
          </section>

          {/* This Week vs Last Week */}
          <section className="animate-fade-in" style={{ animationDelay: '120ms', animationFillMode: 'both' }}>
            <SectionHeader icon={<TrendingUp className="h-3.5 w-3.5" />} title="Weekly Comparison" />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <ComparisonCard label="Study Time" current={formatMinutes(data.studyTime.thisWeekMinutes)} previous={formatMinutes(data.studyTime.lastWeekMinutes)} change={data.studyTime.weekOverWeekChange} icon={<Clock className="h-4 w-4" />} />
              <ComparisonCard label="Quiz Accuracy" current={`${data.quiz.accuracy}%`} previous="—" change={null} icon={<Target className="h-4 w-4" />} />
              <ComparisonCard label="Avg Session" current={formatMinutes(data.studyTime.avgSessionMinutes)} previous="—" change={null} icon={<Zap className="h-4 w-4" />} />
            </div>
          </section>

          {/* Activity Chart */}
          <section className="animate-fade-in" style={{ animationDelay: '180ms', animationFillMode: 'both' }}>
            <SectionHeader icon={<BarChart3 className="h-3.5 w-3.5" />} title="Study Activity — Last 30 Days" />
            <div className="rounded-2xl bg-card/60 p-5">
              <div className="flex items-end gap-[3px] h-36">
                {data.activityChart.map((day, i) => {
                  const height = getBarHeight(day.minutes, maxMinutes);
                  const isToday = i === data.activityChart.length - 1;
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center justify-end h-full group relative">
                      <div
                        className={'w-full rounded-t transition-all duration-200 ' + (isToday ? 'bg-primary' : 'bg-primary/50 hover:bg-primary/80')}
                        style={{ height: `${height}%` }}
                      />
                      {/* Hover tooltip */}
                      <div className="absolute bottom-full mb-2 hidden group-hover:flex flex-col items-center z-20 pointer-events-none">
                        <div className="bg-popover border border-border/20 text-xs rounded-xl px-3 py-2 shadow-lg whitespace-nowrap">
                          <div className="font-semibold text-foreground">{day.date}</div>
                          <div className="text-muted-foreground">{day.minutes}m studied · {day.questions} questions</div>
                        </div>
                        <div className="w-2 h-2 bg-popover border-b border-r border-border/20 transform rotate-45 -mt-1" />
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-between mt-3 text-[10px] text-muted-foreground px-1">
                {data.activityChart.filter((_, i) => i % 7 === 0).map((day, i) => (
                  <span key={i}>{day.date.slice(5)}</span>
                ))}
                <span>{data.activityChart[data.activityChart.length - 1]?.date.slice(5)}</span>
              </div>
            </div>
          </section>

          {/* Syllabus Projection */}
          <section className="animate-fade-in" style={{ animationDelay: '240ms', animationFillMode: 'both' }}>
            <SectionHeader icon={<Target className="h-3.5 w-3.5" />} title="Syllabus Completion" />
            <div className="rounded-2xl bg-card/60 p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-muted-foreground">{data.projection.topicsCovered} of {data.totalSkills} topics covered</span>
                <span className="text-sm font-semibold text-primary">{data.totalSkills > 0 ? Math.round((data.projection.topicsCovered / data.totalSkills) * 100) : 0}%</span>
              </div>
              <div className="w-full bg-muted/50 rounded-full h-3 mb-5 overflow-hidden">
                <div
                  className="h-3 rounded-full bg-gradient-to-r from-primary to-primary/70 transition-all duration-1000 ease-out relative"
                  style={{ width: `${data.totalSkills > 0 ? (data.projection.topicsCovered / data.totalSkills) * 100 : 0}%` }}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <ProjectionStat label="Remaining" value={String(data.projection.topicsRemaining)} />
                <ProjectionStat label="Avg / day" value={String(data.projection.avgTopicsPerDay)} />
                <ProjectionStat label="Est. days left" value={data.projection.estimatedDaysToFinish != null ? String(data.projection.estimatedDaysToFinish) : '—'} />
                <div className="rounded-xl bg-muted/30 p-3">
                  <div className="text-[11px] text-muted-foreground mb-1">Status</div>
                  <div className={`text-sm font-semibold flex items-center gap-1.5 ${data.projection.onTrack ? 'text-green-600' : 'text-amber-600'}`}>
                    {data.projection.onTrack
                      ? <><CheckCircle2 className="h-3.5 w-3.5" /> On track</>
                      : <><AlertTriangle className="h-3.5 w-3.5" /> Behind</>}
                  </div>
                </div>
              </div>
              {!data.projection.onTrack && data.projection.estimatedDaysToFinish && (
                <div className="mt-4 rounded-xl bg-amber-500/[0.06] border border-amber-500/10 p-3.5">
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    <span className="font-semibold text-amber-600">Recommendation:</span> Study{' '}
                    <strong>{Math.ceil(data.projection.topicsRemaining / Math.max(data.projection.daysUntilExam, 1))} topics per day</strong>
                    {' '}({formatMinutes(Math.ceil((data.projection.topicsRemaining / Math.max(data.projection.daysUntilExam, 1)) * 20))} of focused study) to finish on time.
                  </p>
                </div>
              )}
            </div>
          </section>

          {/* Subject Breakdown */}
          <section className="animate-fade-in" style={{ animationDelay: '300ms', animationFillMode: 'both' }}>
            <SectionHeader icon={<BookOpen className="h-3.5 w-3.5" />} title="Subject-by-Subject Breakdown" />
            <div className="rounded-2xl bg-card/60 overflow-hidden divide-y divide-border/10">
              {data.unitReports.sort((a, b) => b.mastery - a.mastery).map((unit, i) => (
                <UnitReportRow key={unit.unitId} unit={unit} rank={i + 1} />
              ))}
            </div>
          </section>

          {/* Strengths & Weaknesses */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 animate-fade-in" style={{ animationDelay: '360ms', animationFillMode: 'both' }}>
            <section>
              <SectionHeader icon={<Award className="h-3.5 w-3.5 text-green-500" />} title="Top Strengths" />
              <div className="rounded-2xl bg-card/60 overflow-hidden">
                {data.strengths.length > 0 ? (
                  <div className="divide-y divide-border/10">
                    {data.strengths.map((skill, i) => {
                      const unitName = ATP_UNITS.find(u => u.id === skill.unitId)?.name || '';
                      return (
                        <div key={i} className="flex items-center justify-between py-3 px-4 hover:bg-muted/30 transition-colors">
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
                  <div className="py-8 text-center">
                    <Award className="h-8 w-8 mx-auto text-muted-foreground/20 mb-2" />
                    <p className="text-xs text-muted-foreground">Study more to reveal your strengths</p>
                  </div>
                )}
              </div>
            </section>

            <section>
              <SectionHeader icon={<AlertTriangle className="h-3.5 w-3.5 text-amber-500" />} title="Needs Attention" />
              <div className="rounded-2xl bg-card/60 overflow-hidden">
                {data.weaknesses.length > 0 ? (
                  <div className="divide-y divide-border/10">
                    {data.weaknesses.map((skill, i) => {
                      const unitName = ATP_UNITS.find(u => u.id === skill.unitId)?.name || '';
                      return (
                        <div key={i} className="flex items-center justify-between py-3 px-4 hover:bg-muted/30 transition-colors">
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
                  <div className="py-8 text-center">
                    <AlertTriangle className="h-8 w-8 mx-auto text-muted-foreground/20 mb-2" />
                    <p className="text-xs text-muted-foreground">Keep studying to identify weak areas</p>
                  </div>
                )}
              </div>
            </section>
          </div>

          {/* Format Performance */}
          <section className="animate-fade-in" style={{ animationDelay: '420ms', animationFillMode: 'both' }}>
            <SectionHeader icon={<FileText className="h-3.5 w-3.5" />} title="Performance by Exam Format" />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <FormatCard label="Written" icon={<FileText className="h-5 w-5" />} attempts={data.formats.written.attempts} score={data.formats.written.avgScore} color="from-blue-500/10 to-sky-500/5" />
              <FormatCard label="Oral" icon={<Mic className="h-5 w-5" />} attempts={data.formats.oral.attempts} score={data.formats.oral.avgScore} color="from-purple-500/10 to-pink-500/5" />
              <FormatCard label="Drafting" icon={<PenLine className="h-5 w-5" />} attempts={data.formats.drafting.attempts} score={data.formats.drafting.avgScore} color="from-emerald-500/10 to-green-500/5" />
            </div>
          </section>

          {/* Footer */}
          <div className="text-center py-6 border-t border-border/10">
            <p className="text-[11px] text-muted-foreground">
              Report generated on {reportDate}. Data reflects your activity on the Ynai platform.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SUB-COMPONENTS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function SectionHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <span className="text-muted-foreground">{icon}</span>
      <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{title}</h2>
    </div>
  );
}

function MiniStat({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string; accent: string }) {
  return (
    <div className="rounded-xl bg-muted/30 p-3">
      <div className="flex items-center gap-1.5 mb-1.5">
        <span className={accent}>{icon}</span>
        <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</span>
      </div>
      <div className="text-lg font-bold">{value}</div>
    </div>
  );
}

function ProjectionStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-muted/30 p-3">
      <div className="text-[11px] text-muted-foreground mb-1">{label}</div>
      <div className="text-sm font-semibold">{value}</div>
    </div>
  );
}

function ComparisonCard({ label, current, previous, change, icon }: {
  label: string; current: string; previous: string; change: number | null; icon: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl bg-card/60 p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-muted-foreground">{icon}</span>
        <span className="text-xs text-muted-foreground font-medium">{label}</span>
      </div>
      <div className="text-xl font-bold">{current}</div>
      {change !== null ? (
        <div className={`flex items-center gap-1 text-xs mt-1.5 ${
          change > 0 ? 'text-green-600' : change < 0 ? 'text-amber-600' : 'text-muted-foreground'
        }`}>
          {change > 0 ? <TrendingUp className="h-3 w-3" /> : change < 0 ? <TrendingDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
          {change > 0 ? `+${change}%` : change < 0 ? `${change}%` : 'Same'} vs last week
        </div>
      ) : (
        <div className="text-[11px] text-muted-foreground mt-1.5">Previously: {previous}</div>
      )}
    </div>
  );
}

function UnitReportRow({ unit, rank }: { unit: ReportData['unitReports'][0]; rank: number }) {
  const pct = unit.mastery;
  return (
    <div className="flex items-center gap-3 px-4 py-3.5 hover:bg-muted/20 transition-colors">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 ${
        pct >= 70 ? 'bg-green-500/10 text-green-600 dark:text-green-400'
        : pct >= 40 ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
        : 'bg-muted/50 text-muted-foreground'
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
      <div className="text-right shrink-0 mr-2">
        {unit.quizAccuracy !== null
          ? <><div className="text-sm font-semibold">{unit.quizAccuracy}%</div><div className="text-[10px] text-muted-foreground">{unit.quizAttempts} quiz Q&apos;s</div></>
          : <div className="text-[11px] text-muted-foreground">No quizzes</div>}
      </div>
      <div className="w-24 shrink-0">
        <div className="w-full bg-muted/40 rounded-full h-2">
          <div className={`h-2 rounded-full transition-all duration-700 ease-out ${
            pct >= 70 ? 'bg-green-500' : pct >= 40 ? 'bg-amber-500' : 'bg-muted-foreground/20'
          }`} style={{ width: `${pct}%` }} />
        </div>
      </div>
      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/30 shrink-0" />
    </div>
  );
}

function FormatCard({ label, icon, attempts, score, color }: {
  label: string; icon: React.ReactNode; attempts: number; score: number | null; color: string;
}) {
  const hasData = attempts > 0 && score !== null;
  return (
    <div className="rounded-2xl bg-card/60 p-5 transition-all hover:shadow-sm">
      <div className={'rounded-lg p-3 mb-3 bg-gradient-to-r ' + color}>
        <div className="flex items-center gap-2 text-foreground/70">
          {icon}
          <span className="text-sm font-semibold">{label}</span>
        </div>
      </div>
      {hasData ? (
        <div>
          <div className="text-2xl font-bold">{score}%</div>
          <div className="text-[11px] text-muted-foreground mt-0.5">Avg. score · {attempts} attempt{attempts !== 1 ? 's' : ''}</div>
        </div>
      ) : (
        <div>
          <div className="text-2xl font-bold text-muted-foreground/25">—</div>
          <div className="text-[11px] text-muted-foreground mt-0.5">No attempts yet</div>
        </div>
      )}
    </div>
  );
}
