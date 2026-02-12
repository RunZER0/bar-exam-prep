'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { 
  TrendingUp, 
  TrendingDown, 
  Target, 
  Award, 
  BookOpen, 
  Clock,
  Flame,
  CheckCircle,
  AlertCircle,
  BarChart3,
  Brain,
  Calendar,
  ArrowRight,
  Sparkles
} from 'lucide-react';
import Link from 'next/link';

interface ProgressData {
  overallMastery: number;
  currentLevel: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  totalQuizzes: number;
  totalCorrect: number;
  totalAttempts: number;
  studyStreak: number;
  strongAreas: Array<{ name: string; performance: number }>;
  weakAreas: Array<{ name: string; performance: number }>;
  recentActivity: Array<{ date: string; type: string; score: number }>;
  recommendations: Array<{
    title: string;
    description: string;
    priority: 'high' | 'medium' | 'low';
    action: string;
    href: string;
  }>;
  weeklyProgress: Array<{ day: string; correct: number; total: number }>;
}

export default function ProgressPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState<ProgressData | null>(null);

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
      case 'expert': return 'text-purple-500 bg-purple-100 dark:bg-purple-900/30';
      case 'advanced': return 'text-blue-500 bg-blue-100 dark:bg-blue-900/30';
      case 'intermediate': return 'text-green-500 bg-green-100 dark:bg-green-900/30';
      default: return 'text-amber-500 bg-amber-100 dark:bg-amber-900/30';
    }
  };

  const getMasteryGradient = (mastery: number) => {
    if (mastery >= 80) return 'from-green-500 to-emerald-500';
    if (mastery >= 60) return 'from-blue-500 to-cyan-500';
    if (mastery >= 40) return 'from-amber-500 to-yellow-500';
    return 'from-red-500 to-orange-500';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Analyzing your progress...</p>
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
    recentActivity: [],
    recommendations: [
      {
        title: 'Start Your Journey',
        description: 'Take your first quiz to begin building your learning profile',
        priority: 'high',
        action: 'quiz',
        href: '/quizzes',
      },
      {
        title: 'Complete Onboarding',
        description: 'Set up your study preferences and goals',
        priority: 'medium',
        action: 'onboard',
        href: '/onboarding',
      },
    ],
    weeklyProgress: [],
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <Brain className="h-8 w-8 text-amber-500" />
            My Learning Profile
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Track your progress and see personalized insights based on your study patterns
          </p>
        </div>

        {/* Key Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {/* Overall Mastery */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-gray-600 dark:text-gray-400">Mastery</span>
              <BarChart3 className="h-5 w-5 text-gray-400" />
            </div>
            <div className="mb-2">
              <span className="text-3xl font-bold text-gray-900 dark:text-white">
                {data.overallMastery}%
              </span>
            </div>
            <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div 
                className={`h-full rounded-full bg-gradient-to-r ${getMasteryGradient(data.overallMastery)}`}
                style={{ width: `${data.overallMastery}%` }}
              />
            </div>
          </div>

          {/* Current Level */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-gray-600 dark:text-gray-400">Level</span>
              <Award className="h-5 w-5 text-gray-400" />
            </div>
            <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium capitalize ${getLevelColor(data.currentLevel)}`}>
              {data.currentLevel}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
              {data.totalQuizzes} quizzes completed
            </p>
          </div>

          {/* Accuracy */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-gray-600 dark:text-gray-400">Accuracy</span>
              <Target className="h-5 w-5 text-gray-400" />
            </div>
            <span className="text-3xl font-bold text-gray-900 dark:text-white">
              {data.totalAttempts > 0 
                ? Math.round((data.totalCorrect / data.totalAttempts) * 100)
                : 0}%
            </span>
            <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
              {data.totalCorrect} / {data.totalAttempts} correct
            </p>
          </div>

          {/* Study Streak */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-gray-600 dark:text-gray-400">Streak</span>
              <Flame className={`h-5 w-5 ${data.studyStreak > 0 ? 'text-orange-500' : 'text-gray-400'}`} />
            </div>
            <span className="text-3xl font-bold text-gray-900 dark:text-white">
              {data.studyStreak}
            </span>
            <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
              day{data.studyStreak !== 1 ? 's' : ''} in a row
            </p>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Left Column - Areas */}
          <div className="lg:col-span-2 space-y-6">
            {/* Strong Areas */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
                <CheckCircle className="h-5 w-5 text-green-500" />
                Strong Areas
              </h2>
              {data.strongAreas.length > 0 ? (
                <div className="space-y-3">
                  {data.strongAreas.map((area, idx) => (
                    <div key={idx} className="flex items-center justify-between">
                      <span className="text-gray-700 dark:text-gray-300">{area.name}</span>
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-green-500 rounded-full"
                            style={{ width: `${area.performance}%` }}
                          />
                        </div>
                        <span className="text-sm text-green-600 dark:text-green-400 font-medium">
                          {area.performance}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 dark:text-gray-400 text-sm">
                  Complete more quizzes to identify your strengths
                </p>
              )}
            </div>

            {/* Weak Areas */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
                <AlertCircle className="h-5 w-5 text-amber-500" />
                Areas to Improve
              </h2>
              {data.weakAreas.length > 0 ? (
                <div className="space-y-3">
                  {data.weakAreas.map((area, idx) => (
                    <div key={idx} className="flex items-center justify-between">
                      <span className="text-gray-700 dark:text-gray-300">{area.name}</span>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                          <div className="w-24 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-amber-500 rounded-full"
                              style={{ width: `${area.performance}%` }}
                            />
                          </div>
                          <span className="text-sm text-amber-600 dark:text-amber-400 font-medium">
                            {area.performance}%
                          </span>
                        </div>
                        <Link
                          href={`/study/${area.name.toLowerCase().replace(/\s+/g, '-')}`}
                          className="text-amber-600 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300"
                        >
                          <BookOpen className="h-4 w-4" />
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 dark:text-gray-400 text-sm">
                  Complete more quizzes to identify areas needing improvement
                </p>
              )}
            </div>

            {/* Weekly Progress */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
                <Calendar className="h-5 w-5 text-blue-500" />
                This Week
              </h2>
              {data.weeklyProgress.length > 0 ? (
                <div className="flex items-end justify-between gap-2 h-32">
                  {data.weeklyProgress.map((day, idx) => {
                    const percentage = day.total > 0 ? (day.correct / day.total) * 100 : 0;
                    return (
                      <div key={idx} className="flex flex-col items-center flex-1">
                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-t-md relative" style={{ height: '80px' }}>
                          <div 
                            className="absolute bottom-0 w-full bg-gradient-to-t from-amber-500 to-amber-400 rounded-t-md transition-all"
                            style={{ height: `${Math.max(percentage, 5)}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                          {day.day}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex items-center justify-center h-32 text-gray-500 dark:text-gray-400 text-sm">
                  Start studying to see your weekly progress
                </div>
              )}
            </div>
          </div>

          {/* Right Column - Recommendations */}
          <div className="space-y-6">
            {/* AI Recommendations */}
            <div className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 rounded-xl p-6 shadow-sm border border-amber-200 dark:border-amber-800">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
                <Sparkles className="h-5 w-5 text-amber-500" />
                Personalized Recommendations
              </h2>
              <div className="space-y-4">
                {data.recommendations.map((rec, idx) => (
                  <div 
                    key={idx}
                    className={`p-4 rounded-lg bg-white dark:bg-gray-800 border ${
                      rec.priority === 'high' 
                        ? 'border-red-200 dark:border-red-800' 
                        : rec.priority === 'medium'
                        ? 'border-amber-200 dark:border-amber-800'
                        : 'border-gray-200 dark:border-gray-700'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-medium text-gray-900 dark:text-white text-sm">
                          {rec.title}
                        </h3>
                        <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                          {rec.description}
                        </p>
                      </div>
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
                    <Link
                      href={rec.href}
                      className="mt-3 flex items-center text-sm text-amber-600 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300"
                    >
                      Get Started <ArrowRight className="h-4 w-4 ml-1" />
                    </Link>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Quick Actions
              </h2>
              <div className="space-y-2">
                <Link
                  href="/quizzes"
                  className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                >
                  <span className="text-gray-700 dark:text-gray-300">Take a Quiz</span>
                  <ArrowRight className="h-4 w-4 text-gray-400" />
                </Link>
                <Link
                  href="/study"
                  className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                >
                  <span className="text-gray-700 dark:text-gray-300">Study Topics</span>
                  <ArrowRight className="h-4 w-4 text-gray-400" />
                </Link>
                <Link
                  href="/exams"
                  className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                >
                  <span className="text-gray-700 dark:text-gray-300">Practice Exam</span>
                  <ArrowRight className="h-4 w-4 text-gray-400" />
                </Link>
                <Link
                  href="/drafting"
                  className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                >
                  <span className="text-gray-700 dark:text-gray-300">Legal Drafting</span>
                  <ArrowRight className="h-4 w-4 text-gray-400" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
