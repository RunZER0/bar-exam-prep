'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { 
  BookOpen, 
  Clock,
  Flame,
  CheckCircle,
  AlertCircle,
  ArrowRight,
  ChevronDown,
  ChevronUp
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
  const [expandedSubject, setExpandedSubject] = useState<string | null>(null);

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

  const getGradeFromAccuracy = (accuracy: number): { grade: string; color: string } => {
    if (accuracy >= 90) return { grade: 'A', color: 'text-green-500' };
    if (accuracy >= 80) return { grade: 'B+', color: 'text-green-500' };
    if (accuracy >= 70) return { grade: 'B', color: 'text-green-500' };
    if (accuracy >= 60) return { grade: 'C+', color: 'text-gray-400' };
    if (accuracy >= 50) return { grade: 'C', color: 'text-gray-400' };
    if (accuracy >= 40) return { grade: 'D', color: 'text-gray-500' };
    return { grade: 'E', color: 'text-gray-500' };
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
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-green-600 border-t-transparent mx-auto mb-4"></div>
          <p className="text-gray-500 dark:text-gray-400 text-sm">Loading your report...</p>
        </div>
      </div>
    );
  }

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
      {/* Header */}
      <div className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
        <div className="max-w-5xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
                Progress Report
              </h1>
              <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
                {user?.displayName || 'Student'} • Generated {new Date().toLocaleDateString('en-KE', { month: 'long', day: 'numeric', year: 'numeric' })}
              </p>
            </div>
            {daysUntilExam && (
              <div className="text-right">
                <div className="text-2xl font-bold text-gray-900 dark:text-white">{daysUntilExam}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">days to exam</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4">
          <div className="flex gap-8">
            {[
              { id: 'overview', label: 'Overview' },
              { id: 'subjects', label: 'Subjects' },
              { id: 'history', label: 'History' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
                  activeTab === tab.id
                    ? 'border-green-600 text-green-600 dark:text-green-500'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Overview */}
        {activeTab === 'overview' && (
          <div className="space-y-10">
            {/* Summary Stats */}
            <section>
              <h2 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-4">
                Summary
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
                <div>
                  <div className={`text-4xl font-bold ${overallGrade.color}`}>
                    {overallGrade.grade}
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">Overall Grade</div>
                </div>
                <div>
                  <div className="text-4xl font-bold text-gray-900 dark:text-white">
                    {data.overallMastery}%
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">Accuracy</div>
                </div>
                <div>
                  <div className="text-4xl font-bold text-gray-900 dark:text-white">
                    {data.totalQuizzes}
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">Quizzes</div>
                </div>
                <div>
                  <div className="text-4xl font-bold text-gray-900 dark:text-white">
                    {data.totalAttempts}
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">Questions</div>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <Flame className={`h-6 w-6 ${data.studyStreak > 0 ? 'text-green-500' : 'text-gray-300 dark:text-gray-600'}`} />
                    <span className="text-4xl font-bold text-gray-900 dark:text-white">{data.studyStreak}</span>
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">Day Streak</div>
                </div>
              </div>
            </section>

            {/* Weekly Activity */}
            <section>
              <h2 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-4">
                This Week
              </h2>
              {data.weeklyProgress.length > 0 ? (
                <div className="space-y-2">
                  {data.weeklyProgress.map((day, idx) => (
                    <div key={idx} className="flex items-center gap-4 py-2">
                      <div className="w-8 text-sm text-gray-500 dark:text-gray-400">{day.day}</div>
                      <div className="flex-1 h-6 bg-gray-100 dark:bg-gray-800 rounded overflow-hidden">
                        {day.total > 0 && (
                          <div 
                            className="h-full bg-green-600 dark:bg-green-500 rounded flex items-center"
                            style={{ width: `${Math.max((day.total / Math.max(...data.weeklyProgress.map(d => d.total || 1))) * 100, 5)}%` }}
                          >
                            <span className="text-xs text-white font-medium px-2">
                              {day.correct}/{day.total}
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="w-12 text-right text-sm text-gray-500 dark:text-gray-400">
                        {day.total > 0 ? `${day.accuracy}%` : '—'}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 dark:text-gray-400 text-sm py-4">
                  No activity this week. <Link href="/quizzes" className="text-green-600 hover:underline">Take a quiz</Link> to get started.
                </p>
              )}
            </section>

            {/* Performance by Difficulty */}
            {data.difficultyBreakdown.length > 0 && (
              <section>
                <h2 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-4">
                  By Difficulty
                </h2>
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-xs text-gray-400 dark:text-gray-500 uppercase">
                      <th className="pb-2 font-medium">Level</th>
                      <th className="pb-2 font-medium text-right">Correct</th>
                      <th className="pb-2 font-medium text-right">Total</th>
                      <th className="pb-2 font-medium text-right">Accuracy</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm">
                    {data.difficultyBreakdown.map((diff) => (
                      <tr key={diff.difficulty} className="border-t border-gray-100 dark:border-gray-800">
                        <td className="py-3 capitalize text-gray-900 dark:text-white">{diff.difficulty}</td>
                        <td className="py-3 text-right text-gray-600 dark:text-gray-300">{diff.correct}</td>
                        <td className="py-3 text-right text-gray-600 dark:text-gray-300">{diff.total}</td>
                        <td className={`py-3 text-right font-medium ${diff.accuracy >= 70 ? 'text-green-600' : 'text-gray-500'}`}>
                          {diff.accuracy}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            )}

            {/* Strengths & Weaknesses */}
            <div className="grid md:grid-cols-2 gap-8">
              <section>
                <h2 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                  Strong Areas
                </h2>
                {data.strongAreas.length > 0 ? (
                  <ul className="space-y-2">
                    {data.strongAreas.slice(0, 5).map((area, idx) => (
                      <li key={idx} className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-800">
                        <span className="text-sm text-gray-700 dark:text-gray-300">{area.name}</span>
                        <span className="text-sm font-medium text-green-600">{area.performance}%</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-gray-500 dark:text-gray-400 text-sm">Complete more quizzes to identify strengths</p>
                )}
              </section>

              <section>
                <h2 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <AlertCircle className="h-3.5 w-3.5 text-gray-400" />
                  Needs Attention
                </h2>
                {data.weakAreas.length > 0 ? (
                  <ul className="space-y-2">
                    {data.weakAreas.slice(0, 5).map((area, idx) => (
                      <li key={idx} className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-800">
                        <span className="text-sm text-gray-700 dark:text-gray-300">{area.name}</span>
                        <span className="text-sm font-medium text-gray-500">{area.performance}%</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-gray-500 dark:text-gray-400 text-sm">Complete more quizzes to identify areas for improvement</p>
                )}
              </section>
            </div>

            {/* Recommendations */}
            {data.recommendations.length > 0 && (
              <section>
                <h2 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-4">
                  Recommended Actions
                </h2>
                <div className="space-y-2">
                  {data.recommendations.map((rec, idx) => (
                    <Link
                      key={idx}
                      href={rec.href}
                      className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 -mx-2 px-2 rounded transition-colors"
                    >
                      <div>
                        <div className="text-sm font-medium text-gray-900 dark:text-white">{rec.title}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">{rec.description}</div>
                      </div>
                      <ArrowRight className="h-4 w-4 text-gray-400" />
                    </Link>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}

        {/* Subjects */}
        {activeTab === 'subjects' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                Subject Performance
              </h2>
              <span className="text-xs text-gray-400 dark:text-gray-500">
                {data.subjectReports.length} subjects
              </span>
            </div>

            {data.subjectReports.length > 0 ? (
              <table className="w-full">
                <thead>
                  <tr className="text-left text-xs text-gray-400 dark:text-gray-500 uppercase">
                    <th className="pb-3 font-medium">Subject</th>
                    <th className="pb-3 font-medium text-center">Grade</th>
                    <th className="pb-3 font-medium text-right">Correct</th>
                    <th className="pb-3 font-medium text-right">Total</th>
                    <th className="pb-3 font-medium text-right">Accuracy</th>
                    <th className="pb-3 font-medium text-right"></th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  {data.subjectReports.map((subject, idx) => {
                    const grade = getGradeFromAccuracy(subject.accuracy);
                    const isExpanded = expandedSubject === subject.unitId;
                    return (
                      <>
                        <tr 
                          key={idx} 
                          className="border-t border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer transition-colors"
                          onClick={() => setExpandedSubject(isExpanded ? null : subject.unitId)}
                        >
                          <td className="py-4 text-gray-900 dark:text-white font-medium">
                            {subject.name}
                          </td>
                          <td className={`py-4 text-center font-bold ${grade.color}`}>
                            {grade.grade}
                          </td>
                          <td className="py-4 text-right text-gray-600 dark:text-gray-300">
                            {subject.correct}
                          </td>
                          <td className="py-4 text-right text-gray-600 dark:text-gray-300">
                            {subject.total}
                          </td>
                          <td className={`py-4 text-right font-medium ${subject.accuracy >= 70 ? 'text-green-600' : 'text-gray-500'}`}>
                            {subject.accuracy}%
                          </td>
                          <td className="py-4 text-right pl-4">
                            {isExpanded ? (
                              <ChevronUp className="h-4 w-4 text-gray-400" />
                            ) : (
                              <ChevronDown className="h-4 w-4 text-gray-400" />
                            )}
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr className="border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30">
                            <td colSpan={6} className="px-4 py-4">
                              <div className="flex items-center justify-between">
                                <div className="space-y-1">
                                  <div className="text-xs text-gray-500 dark:text-gray-400">
                                    {subject.accuracy < 60 && (
                                      <span className="flex items-center gap-1">
                                        <AlertCircle className="h-3.5 w-3.5" />
                                        This subject needs more focus
                                      </span>
                                    )}
                                    {subject.accuracy >= 80 && (
                                      <span className="flex items-center gap-1 text-green-600">
                                        <CheckCircle className="h-3.5 w-3.5" />
                                        Excellent performance
                                      </span>
                                    )}
                                    {subject.accuracy >= 60 && subject.accuracy < 80 && (
                                      <span>Good progress, keep practicing</span>
                                    )}
                                  </div>
                                </div>
                                <Link
                                  href={`/quizzes?unit=${subject.unitId}`}
                                  className="text-xs text-green-600 hover:text-green-700 font-medium flex items-center gap-1"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  Practice this subject
                                  <ArrowRight className="h-3 w-3" />
                                </Link>
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <div className="text-center py-12">
                <BookOpen className="h-10 w-10 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
                <p className="text-gray-500 dark:text-gray-400 text-sm mb-4">
                  No subject data yet
                </p>
                <Link
                  href="/quizzes"
                  className="text-green-600 hover:text-green-700 text-sm font-medium"
                >
                  Take a quiz to begin →
                </Link>
              </div>
            )}
          </div>
        )}

        {/* History */}
        {activeTab === 'history' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                Recent Sessions
              </h2>
              <span className="text-xs text-gray-400 dark:text-gray-500">
                Last {data.recentSessions.length} sessions
              </span>
            </div>

            {data.recentSessions.length > 0 ? (
              <table className="w-full">
                <thead>
                  <tr className="text-left text-xs text-gray-400 dark:text-gray-500 uppercase">
                    <th className="pb-3 font-medium">Date</th>
                    <th className="pb-3 font-medium">Subject</th>
                    <th className="pb-3 font-medium text-center">Mode</th>
                    <th className="pb-3 font-medium text-center">Grade</th>
                    <th className="pb-3 font-medium text-right">Score</th>
                    <th className="pb-3 font-medium text-right">Accuracy</th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  {data.recentSessions.map((session, idx) => {
                    const grade = getGradeFromAccuracy(session.accuracy);
                    return (
                      <tr key={idx} className="border-t border-gray-100 dark:border-gray-800">
                        <td className="py-4 text-gray-500 dark:text-gray-400">
                          {formatDate(session.date)}
                        </td>
                        <td className="py-4 text-gray-900 dark:text-white font-medium">
                          {session.unit}
                        </td>
                        <td className="py-4 text-center">
                          <span className="text-xs text-gray-500 dark:text-gray-400 capitalize">
                            {session.mode}
                          </span>
                        </td>
                        <td className={`py-4 text-center font-bold ${grade.color}`}>
                          {grade.grade}
                        </td>
                        <td className="py-4 text-right text-gray-600 dark:text-gray-300">
                          {session.correctAnswers}/{session.totalQuestions}
                        </td>
                        <td className={`py-4 text-right font-medium ${session.accuracy >= 70 ? 'text-green-600' : 'text-gray-500'}`}>
                          {session.accuracy}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <div className="text-center py-12">
                <Clock className="h-10 w-10 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
                <p className="text-gray-500 dark:text-gray-400 text-sm mb-4">
                  No quiz history yet
                </p>
                <Link
                  href="/quizzes"
                  className="text-green-600 hover:text-green-700 text-sm font-medium"
                >
                  Start your first quiz →
                </Link>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
