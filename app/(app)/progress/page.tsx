'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { 
  TrendingUp, 
  Target, 
  Award, 
  BookOpen, 
  Clock,
  Flame,
  CheckCircle,
  AlertCircle,
  BarChart3,
  Brain,
  ArrowRight,
  Sparkles,
  FileText,
  GraduationCap,
  ChevronRight,
  Trophy,
  Zap,
  PieChart,
  Activity
} from 'lucide-react';
import Link from 'next/link';

interface SubjectReport {
  name: string;
  unitId: string;
  correct: number;
  total: number;
  accuracy: number;
}

interface DifficultyBreakdown {
  difficulty: string;
  correct: number;
  total: number;
  accuracy: number;
}

interface ModeBreakdown {
  mode: string;
  correct: number;
  total: number;
  accuracy: number;
}

interface RecentSession {
  sessionId: string;
  totalQuestions: number;
  correctAnswers: number;
  accuracy: number;
  mode: string;
  unit: string;
  date: string;
}

interface WeeklyDay {
  day: string;
  date: string;
  correct: number;
  total: number;
  accuracy: number;
}

interface ProgressData {
  overallMastery: number;
  currentLevel: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  totalQuizzes: number;
  totalCorrect: number;
  totalAttempts: number;
  studyStreak: number;
  strongAreas: Array<{ name: string; performance: number }>;
  weakAreas: Array<{ name: string; performance: number }>;
  subjectReports: SubjectReport[];
  difficultyBreakdown: DifficultyBreakdown[];
  modeBreakdown: ModeBreakdown[];
  recentSessions: RecentSession[];
  weeklyProgress: WeeklyDay[];
  recommendations: Array<{
    title: string;
    description: string;
    priority: 'high' | 'medium' | 'low';
    action: string;
    href: string;
  }>;
  targetExamDate: string | null;
}

export default function ProgressPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState<ProgressData | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'subjects' | 'history'>('overview');

  useEffect(() => {
    const fetchProgress = async () => {
      try {
        const response = await fetch('/api/progress');
        if (response.ok) {
          const data = await response.json();
          setProgress(data);
        }
      } catch (error) {
        console.error('Error fetching progress:', error);
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      fetchProgress();
    }
  }, [user]);

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'expert': return 'text-purple-600 bg-purple-100 dark:bg-purple-900/30 border-purple-300 dark:border-purple-700';
      case 'advanced': return 'text-blue-600 bg-blue-100 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700';
      case 'intermediate': return 'text-green-600 bg-green-100 dark:bg-green-900/30 border-green-300 dark:border-green-700';
      default: return 'text-amber-600 bg-amber-100 dark:bg-amber-900/30 border-amber-300 dark:border-amber-700';
    }
  };

  const getGradeFromAccuracy = (accuracy: number): { grade: string; color: string } => {
    if (accuracy >= 90) return { grade: 'A', color: 'text-green-600 dark:text-green-400' };
    if (accuracy >= 80) return { grade: 'B+', color: 'text-green-500 dark:text-green-500' };
    if (accuracy >= 70) return { grade: 'B', color: 'text-blue-600 dark:text-blue-400' };
    if (accuracy >= 60) return { grade: 'C+', color: 'text-amber-600 dark:text-amber-400' };
    if (accuracy >= 50) return { grade: 'C', color: 'text-amber-500 dark:text-amber-500' };
    if (accuracy >= 40) return { grade: 'D', color: 'text-orange-600 dark:text-orange-400' };
    return { grade: 'E', color: 'text-red-600 dark:text-red-400' };
  };

  const getMasteryGradient = (mastery: number) => {
    if (mastery >= 80) return 'from-green-500 to-emerald-500';
    if (mastery >= 60) return 'from-blue-500 to-cyan-500';
    if (mastery >= 40) return 'from-amber-500 to-yellow-500';
    return 'from-red-500 to-orange-500';
  };

  const getDifficultyColor = (diff: string) => {
    switch (diff) {
      case 'easy': return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
      case 'medium': return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
      case 'hard': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
      default: return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400';
    }
  };

  const getModeIcon = (mode: string) => {
    switch (mode) {
      case 'adaptive': return Brain;
      case 'blitz': return Zap;
      case 'exam': return FileText;
      case 'legendary': return Trophy;
      default: return Target;
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-KE', { 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getDaysUntilExam = () => {
    if (!progress?.targetExamDate) return null;
    const target = new Date(progress.targetExamDate);
    const today = new Date();
    const diff = Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return diff > 0 ? diff : null;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Generating your learning report...</p>
        </div>
      </div>
    );
  }

  // Default data if no progress yet
  const data: ProgressData = progress || {
    overallMastery: 0,
    currentLevel: 'beginner',
    totalQuizzes: 0,
    totalCorrect: 0,
    totalAttempts: 0,
    studyStreak: 0,
    strongAreas: [],
    weakAreas: [],
    subjectReports: [],
    difficultyBreakdown: [],
    modeBreakdown: [],
    recentSessions: [],
    weeklyProgress: [],
    recommendations: [
      {
        title: 'Start Your Journey',
        description: 'Take your first quiz to begin building your learning profile',
        priority: 'high',
        action: 'quiz',
        href: '/quizzes',
      },
    ],
    targetExamDate: null,
  };

  const daysUntilExam = getDaysUntilExam();
  const overallGrade = getGradeFromAccuracy(data.overallMastery);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-amber-600 via-orange-500 to-red-500 py-8 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                <FileText className="h-8 w-8" />
                Learning Progress Report
              </h1>
              <p className="text-amber-100 mt-1">
                Comprehensive analysis of your bar exam preparation journey
              </p>
            </div>
            {daysUntilExam && (
              <div className="bg-white/20 backdrop-blur-sm rounded-xl px-6 py-3 text-center">
                <div className="text-3xl font-bold text-white">{daysUntilExam}</div>
                <div className="text-amber-100 text-sm">days until exam</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex gap-1">
            {[
              { id: 'overview', label: 'Overview', icon: BarChart3 },
              { id: 'subjects', label: 'Subject Reports', icon: BookOpen },
              { id: 'history', label: 'Quiz History', icon: Clock },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`flex items-center gap-2 px-4 py-4 font-medium text-sm border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-amber-500 text-amber-600 dark:text-amber-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                }`}
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-8">
            {/* Report Card Summary */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="bg-gradient-to-r from-slate-800 to-slate-900 px-6 py-4">
                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                  <GraduationCap className="h-5 w-5" />
                  Performance Summary
                </h2>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
                  {/* Overall Grade */}
                  <div className="col-span-2 md:col-span-1 flex flex-col items-center justify-center p-4 bg-gray-50 dark:bg-gray-900 rounded-xl">
                    <div className={`text-5xl font-bold ${overallGrade.color}`}>
                      {overallGrade.grade}
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">Overall Grade</div>
                    <div className={`mt-2 inline-flex items-center px-3 py-1 rounded-full text-xs font-medium capitalize border ${getLevelColor(data.currentLevel)}`}>
                      {data.currentLevel}
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="text-center p-4">
                    <div className="text-3xl font-bold text-gray-900 dark:text-white">{data.overallMastery}%</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">Accuracy Rate</div>
                    <div className="mt-2 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full bg-gradient-to-r ${getMasteryGradient(data.overallMastery)}`}
                        style={{ width: `${data.overallMastery}%` }}
                      />
                    </div>
                  </div>

                  <div className="text-center p-4">
                    <div className="text-3xl font-bold text-gray-900 dark:text-white">{data.totalQuizzes}</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">Quizzes Taken</div>
                    <div className="mt-2 flex items-center justify-center gap-1 text-green-600 dark:text-green-400">
                      <TrendingUp className="h-4 w-4" />
                      <span className="text-xs">Active</span>
                    </div>
                  </div>

                  <div className="text-center p-4">
                    <div className="text-3xl font-bold text-gray-900 dark:text-white">{data.totalAttempts}</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">Questions Answered</div>
                    <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                      {data.totalCorrect} correct
                    </div>
                  </div>

                  <div className="text-center p-4">
                    <div className="flex items-center justify-center gap-2">
                      <Flame className={`h-8 w-8 ${data.studyStreak > 0 ? 'text-orange-500' : 'text-gray-300'}`} />
                      <span className="text-3xl font-bold text-gray-900 dark:text-white">{data.studyStreak}</span>
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">Day Streak</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Two Column Layout */}
            <div className="grid lg:grid-cols-3 gap-8">
              {/* Left Column */}
              <div className="lg:col-span-2 space-y-6">
                {/* Weekly Progress Chart */}
                <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-6">
                    <Activity className="h-5 w-5 text-blue-500" />
                    Weekly Activity
                  </h3>
                  {data.weeklyProgress.length > 0 ? (
                    <div className="space-y-4">
                      {data.weeklyProgress.map((day, idx) => (
                        <div key={idx} className="flex items-center gap-4">
                          <div className="w-10 text-sm text-gray-500 dark:text-gray-400 font-medium">{day.day}</div>
                          <div className="flex-1">
                            <div className="flex items-center gap-3">
                              <div className="flex-1 h-8 bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden relative">
                                {day.total > 0 && (
                                  <div 
                                    className="h-full bg-gradient-to-r from-amber-400 to-orange-500 rounded-lg flex items-center transition-all"
                                    style={{ width: `${Math.max((day.total / Math.max(...data.weeklyProgress.map(d => d.total || 1))) * 100, 10)}%` }}
                                  >
                                    <span className="text-xs text-white font-medium px-2">
                                      {day.correct}/{day.total}
                                    </span>
                                  </div>
                                )}
                                {day.total === 0 && (
                                  <span className="absolute inset-0 flex items-center px-3 text-xs text-gray-400">No activity</span>
                                )}
                              </div>
                              <div className="w-14 text-right">
                                <span className={`text-sm font-medium ${day.accuracy >= 70 ? 'text-green-600 dark:text-green-400' : day.accuracy >= 50 ? 'text-amber-600 dark:text-amber-400' : 'text-gray-400'}`}>
                                  {day.total > 0 ? `${day.accuracy}%` : '-'}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                      <Activity className="h-12 w-12 mx-auto mb-3 opacity-30" />
                      <p>No activity this week</p>
                      <Link href="/quizzes" className="text-amber-600 hover:text-amber-700 text-sm mt-2 inline-block">
                        Take a quiz to get started →
                      </Link>
                    </div>
                  )}
                </div>

                {/* Difficulty Performance */}
                {data.difficultyBreakdown.length > 0 && (
                  <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
                      <Target className="h-5 w-5 text-purple-500" />
                      Performance by Difficulty
                    </h3>
                    <div className="grid grid-cols-3 gap-4">
                      {data.difficultyBreakdown.map((diff) => (
                        <div key={diff.difficulty} className="text-center p-4 rounded-xl bg-gray-50 dark:bg-gray-900">
                          <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium capitalize mb-2 ${getDifficultyColor(diff.difficulty)}`}>
                            {diff.difficulty}
                          </span>
                          <div className="text-2xl font-bold text-gray-900 dark:text-white">{diff.accuracy}%</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">{diff.correct}/{diff.total}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Strengths & Weaknesses */}
                <div className="grid md:grid-cols-2 gap-6">
                  {/* Strong Areas */}
                  <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
                      <CheckCircle className="h-5 w-5 text-green-500" />
                      Top Performing Areas
                    </h3>
                    {data.strongAreas.length > 0 ? (
                      <div className="space-y-3">
                        {data.strongAreas.slice(0, 5).map((area, idx) => (
                          <div key={idx} className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                            <span className="text-sm text-gray-700 dark:text-gray-300 font-medium">{area.name}</span>
                            <span className="text-sm text-green-600 dark:text-green-400 font-bold">{area.performance}%</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-500 dark:text-gray-400 text-sm text-center py-4">
                        Complete more quizzes to identify your strengths
                      </p>
                    )}
                  </div>

                  {/* Weak Areas */}
                  <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
                      <AlertCircle className="h-5 w-5 text-amber-500" />
                      Areas Needing Focus
                    </h3>
                    {data.weakAreas.length > 0 ? (
                      <div className="space-y-3">
                        {data.weakAreas.slice(0, 5).map((area, idx) => (
                          <div key={idx} className="flex items-center justify-between p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                            <span className="text-sm text-gray-700 dark:text-gray-300 font-medium">{area.name}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-amber-600 dark:text-amber-400 font-bold">{area.performance}%</span>
                              <Link href="/quizzes" className="text-amber-600 hover:text-amber-700">
                                <ArrowRight className="h-4 w-4" />
                              </Link>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-500 dark:text-gray-400 text-sm text-center py-4">
                        Complete more quizzes to identify areas for improvement
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Right Column - Recommendations */}
              <div className="space-y-6">
                {/* AI Recommendations */}
                <div className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 rounded-xl p-6 shadow-sm border border-amber-200 dark:border-amber-800">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
                    <Sparkles className="h-5 w-5 text-amber-500" />
                    Personalized Study Plan
                  </h3>
                  <div className="space-y-3">
                    {data.recommendations.map((rec, idx) => (
                      <Link
                        key={idx}
                        href={rec.href}
                        className={`block p-4 rounded-lg bg-white dark:bg-gray-800 border hover:shadow-md transition-shadow ${
                          rec.priority === 'high' 
                            ? 'border-red-200 dark:border-red-800' 
                            : rec.priority === 'medium'
                            ? 'border-amber-200 dark:border-amber-800'
                            : 'border-gray-200 dark:border-gray-700'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <h4 className="font-medium text-gray-900 dark:text-white text-sm">
                                {rec.title}
                              </h4>
                              <span className={`text-xs px-2 py-0.5 rounded-full ${
                                rec.priority === 'high' 
                                  ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                                  : rec.priority === 'medium'
                                  ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400'
                                  : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                              }`}>
                                {rec.priority}
                              </span>
                            </div>
                            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                              {rec.description}
                            </p>
                          </div>
                          <ChevronRight className="h-5 w-5 text-gray-400 flex-shrink-0" />
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>

                {/* Quiz Mode Stats */}
                {data.modeBreakdown.length > 0 && (
                  <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
                      <PieChart className="h-5 w-5 text-indigo-500" />
                      Quiz Mode Performance
                    </h3>
                    <div className="space-y-3">
                      {data.modeBreakdown.map((mode) => {
                        const Icon = getModeIcon(mode.mode);
                        return (
                          <div key={mode.mode} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                            <div className="flex items-center gap-2">
                              <Icon className="h-4 w-4 text-gray-500" />
                              <span className="text-sm text-gray-700 dark:text-gray-300 capitalize">{mode.mode}</span>
                            </div>
                            <div className="text-right">
                              <span className="text-sm font-bold text-gray-900 dark:text-white">{mode.accuracy}%</span>
                              <span className="text-xs text-gray-500 ml-1">({mode.total})</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Quick Actions */}
                <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    Quick Actions
                  </h3>
                  <div className="space-y-2">
                    <Link
                      href="/quizzes"
                      className="flex items-center justify-between p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors border border-amber-200 dark:border-amber-800"
                    >
                      <span className="text-amber-700 dark:text-amber-300 font-medium">Take a Quiz</span>
                      <ArrowRight className="h-4 w-4 text-amber-500" />
                    </Link>
                    <Link
                      href="/exams"
                      className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                    >
                      <span className="text-gray-700 dark:text-gray-300">Practice Exam</span>
                      <ArrowRight className="h-4 w-4 text-gray-400" />
                    </Link>
                    <Link
                      href="/study"
                      className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                    >
                      <span className="text-gray-700 dark:text-gray-300">Study Materials</span>
                      <ArrowRight className="h-4 w-4 text-gray-400" />
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Subjects Tab */}
        {activeTab === 'subjects' && (
          <div className="space-y-6">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="bg-gradient-to-r from-slate-800 to-slate-900 px-6 py-4">
                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                  <BookOpen className="h-5 w-5" />
                  Subject Performance Report
                </h2>
                <p className="text-slate-300 text-sm mt-1">
                  Detailed breakdown of your performance across all ATP units
                </p>
              </div>
              
              {data.subjectReports.length > 0 ? (
                <div className="divide-y divide-gray-200 dark:divide-gray-700">
                  {data.subjectReports.map((subject, idx) => {
                    const grade = getGradeFromAccuracy(subject.accuracy);
                    return (
                      <div key={idx} className="p-6 hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3">
                              <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl font-bold ${grade.color} bg-gray-100 dark:bg-gray-800`}>
                                {grade.grade}
                              </div>
                              <div>
                                <h3 className="font-semibold text-gray-900 dark:text-white">{subject.name}</h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                  {subject.correct} correct out of {subject.total} questions
                                </p>
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-2xl font-bold text-gray-900 dark:text-white">{subject.accuracy}%</div>
                            <div className="text-sm text-gray-500 dark:text-gray-400">accuracy</div>
                          </div>
                        </div>
                        <div className="mt-4">
                          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full bg-gradient-to-r ${getMasteryGradient(subject.accuracy)}`}
                              style={{ width: `${subject.accuracy}%` }}
                            />
                          </div>
                        </div>
                        {subject.accuracy < 60 && (
                          <div className="mt-3 flex items-center gap-2 text-amber-600 dark:text-amber-400 text-sm">
                            <AlertCircle className="h-4 w-4" />
                            <span>Recommended: Focus more study time on this area</span>
                          </div>
                        )}
                        {subject.accuracy >= 80 && (
                          <div className="mt-3 flex items-center gap-2 text-green-600 dark:text-green-400 text-sm">
                            <CheckCircle className="h-4 w-4" />
                            <span>Excellent! You&apos;re performing well in this subject</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-12 text-center">
                  <BookOpen className="h-16 w-16 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No Subject Data Yet</h3>
                  <p className="text-gray-500 dark:text-gray-400 mb-4">
                    Complete some quizzes to see your performance breakdown by subject
                  </p>
                  <Link
                    href="/quizzes"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-medium transition-colors"
                  >
                    Take a Quiz <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}

        {/* History Tab */}
        {activeTab === 'history' && (
          <div className="space-y-6">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="bg-gradient-to-r from-slate-800 to-slate-900 px-6 py-4">
                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Recent Quiz Sessions
                </h2>
                <p className="text-slate-300 text-sm mt-1">
                  Your last 10 quiz attempts with detailed results
                </p>
              </div>
              
              {data.recentSessions.length > 0 ? (
                <div className="divide-y divide-gray-200 dark:divide-gray-700">
                  {data.recentSessions.map((session, idx) => {
                    const Icon = getModeIcon(session.mode);
                    const grade = getGradeFromAccuracy(session.accuracy);
                    return (
                      <div key={idx} className="p-5 hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors">
                        <div className="flex items-center gap-4">
                          <div className={`w-14 h-14 rounded-xl flex items-center justify-center text-xl font-bold ${grade.color} bg-gray-100 dark:bg-gray-800`}>
                            {grade.grade}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-medium text-gray-900 dark:text-white">{session.unit}</h3>
                              <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs text-gray-600 dark:text-gray-400 capitalize flex items-center gap-1">
                                <Icon className="h-3 w-3" />
                                {session.mode}
                              </span>
                            </div>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              {session.correctAnswers}/{session.totalQuestions} correct • {formatDate(session.date)}
                            </p>
                          </div>
                          <div className="text-right">
                            <div className="text-2xl font-bold text-gray-900 dark:text-white">{session.accuracy}%</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">accuracy</div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-12 text-center">
                  <Clock className="h-16 w-16 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No Quiz History Yet</h3>
                  <p className="text-gray-500 dark:text-gray-400 mb-4">
                    Your quiz sessions will appear here once you start practicing
                  </p>
                  <Link
                    href="/quizzes"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-medium transition-colors"
                  >
                    Start Your First Quiz <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
