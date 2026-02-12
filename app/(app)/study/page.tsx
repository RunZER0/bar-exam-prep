'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ATP_UNITS } from '@/lib/constants/legal-content';
import {
  Gavel,
  Scale,
  FileText,
  Shield,
  Building,
  Briefcase,
  Users,
  BookOpen,
  Building2,
  Handshake,
  Calculator,
  ArrowRight,
  PenTool,
  Mic,
  TrendingUp,
  Zap,
  Target,
  Clock,
  RefreshCw,
  Check,
  ChevronRight,
  Compass,
} from 'lucide-react';

const ICON_MAP: Record<string, any> = {
  Gavel,
  Scale,
  FileText,
  Shield,
  Building,
  Briefcase,
  Users,
  BookOpen,
  Building2,
  Handshake,
  Calculator,
  PenTool,
  Mic,
  TrendingUp,
};

interface Recommendation {
  id: string | null;
  activityType: string;
  unitId: string | null;
  unitName: string | null;
  title: string;
  description: string;
  rationale: string;
  priority: number;
  urgencyScore: number;
  estimatedMinutes: number;
  difficulty: string;
  targetHref: string;
  generatedAt: string;
}

export default function StudyPage() {
  const router = useRouter();
  const { getIdToken } = useAuth();
  const [mode, setMode] = useState<'guided' | 'manual'>('guided');
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const loadRecommendations = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    
    try {
      const token = await getIdToken();
      const res = await fetch('/api/tutor/guide', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setRecommendations(data.recommendations || []);
        setLastUpdated(new Date(data.generatedAt));
      }
    } catch (err) {
      console.error('Failed to load recommendations:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [getIdToken]);

  // Load recommendations on mount
  useEffect(() => {
    loadRecommendations();
  }, [loadRecommendations]);

  // Preload recommendations on visibility change (user returns to tab)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Check if recommendations are stale (older than 1 hour)
        if (lastUpdated && Date.now() - lastUpdated.getTime() > 60 * 60 * 1000) {
          loadRecommendations(true);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [lastUpdated, loadRecommendations]);

  const handleRecommendationClick = async (rec: Recommendation) => {
    // Mark as acted on (fire and forget)
    if (rec.id) {
      const token = await getIdToken();
      fetch('/api/tutor/guide', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ recommendationId: rec.id, action: 'acted_on' }),
      }).catch(console.error);
    }
    
    router.push(rec.targetHref);
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'quiz': return Target;
      case 'study': return BookOpen;
      case 'case_study': return Scale;
      case 'drafting': return PenTool;
      case 'research': return FileText;
      case 'review': return RefreshCw;
      case 'exam': return FileText;
      default: return BookOpen;
    }
  };

  const getActivityLabel = (type: string) => {
    switch (type) {
      case 'quiz': return 'Quiz';
      case 'study': return 'Study';
      case 'case_study': return 'Case Study';
      case 'drafting': return 'Drafting';
      case 'research': return 'Research';
      case 'review': return 'Review';
      case 'exam': return 'Exam';
      default: return 'Activity';
    }
  };

  const formatTimeAgo = (date: Date) => {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
        <div className="max-w-5xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
                Study
              </h1>
              <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
                Master the Kenyan Bar Exam curriculum
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Mode Toggle */}
      <div className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4">
          <div className="flex gap-8">
            <button
              onClick={() => setMode('guided')}
              className={`flex items-center gap-2 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
                mode === 'guided'
                  ? 'border-green-600 text-green-600 dark:text-green-500'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
              }`}
            >
              <Compass className="h-4 w-4" />
              System Guided
            </button>
            <button
              onClick={() => setMode('manual')}
              className={`flex items-center gap-2 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
                mode === 'manual'
                  ? 'border-green-600 text-green-600 dark:text-green-500'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
              }`}
            >
              <BookOpen className="h-4 w-4" />
              Browse Units
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* System Guided Mode */}
        {mode === 'guided' && (
          <div className="space-y-6">
            {/* Header with refresh */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                  Recommended For You
                </h2>
                {lastUpdated && (
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                    Updated {formatTimeAgo(lastUpdated)}
                  </p>
                )}
              </div>
              <button
                onClick={() => loadRecommendations(true)}
                disabled={refreshing}
                className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>

            {/* Loading State */}
            {loading && (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="animate-pulse">
                    <div className="h-24 bg-gray-100 dark:bg-gray-800 rounded-lg"></div>
                  </div>
                ))}
              </div>
            )}

            {/* Recommendations List */}
            {!loading && recommendations.length > 0 && (
              <div className="space-y-3">
                {recommendations.map((rec, idx) => {
                  const Icon = getActivityIcon(rec.activityType);
                  return (
                    <button
                      key={rec.id || idx}
                      onClick={() => handleRecommendationClick(rec)}
                      className="w-full text-left group"
                    >
                      <div className="flex items-start gap-4 py-4 px-4 -mx-4 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800/50 transition-colors">
                        {/* Priority indicator */}
                        <div className="flex flex-col items-center gap-1 pt-1">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                            idx === 0 
                              ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
                              : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
                          }`}>
                            <Icon className="h-4 w-4" />
                          </div>
                          {idx === 0 && (
                            <span className="text-[10px] text-green-600 dark:text-green-500 font-medium">
                              TOP
                            </span>
                          )}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                              {getActivityLabel(rec.activityType)}
                            </span>
                            {rec.unitName && (
                              <>
                                <span className="text-gray-300 dark:text-gray-600">•</span>
                                <span className="text-xs text-gray-500 dark:text-gray-400">
                                  {rec.unitName}
                                </span>
                              </>
                            )}
                          </div>
                          <h3 className="text-sm font-medium text-gray-900 dark:text-white group-hover:text-green-600 dark:group-hover:text-green-500 transition-colors">
                            {rec.title}
                          </h3>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                            {rec.rationale}
                          </p>
                          <div className="flex items-center gap-3 mt-2 text-xs text-gray-400 dark:text-gray-500">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {rec.estimatedMinutes} min
                            </span>
                            <span className="capitalize">{rec.difficulty}</span>
                            <span className="flex items-center gap-1">
                              <Zap className="h-3 w-3" />
                              {rec.urgencyScore}% match
                            </span>
                          </div>
                        </div>

                        {/* Arrow */}
                        <ChevronRight className="h-5 w-5 text-gray-300 dark:text-gray-600 group-hover:text-green-500 transition-colors flex-shrink-0 mt-2" />
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Empty State */}
            {!loading && recommendations.length === 0 && (
              <div className="text-center py-12">
                <Compass className="h-10 w-10 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
                <p className="text-gray-500 dark:text-gray-400 text-sm mb-4">
                  No recommendations yet. Start taking quizzes to get personalized guidance.
                </p>
                <Link
                  href="/quizzes"
                  className="text-green-600 hover:text-green-700 text-sm font-medium"
                >
                  Take your first quiz →
                </Link>
              </div>
            )}

            {/* How it works */}
            <div className="mt-8 pt-8 border-t border-gray-100 dark:border-gray-800">
              <h3 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-4">
                How System Guided Works
              </h3>
              <div className="grid sm:grid-cols-3 gap-4">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-green-600 dark:text-green-400 text-xs font-bold flex-shrink-0">
                    1
                  </div>
                  <div>
                    <p className="text-sm text-gray-700 dark:text-gray-300 font-medium">Analyzes your performance</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Tracks your strengths and weaknesses across all subjects</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-green-600 dark:text-green-400 text-xs font-bold flex-shrink-0">
                    2
                  </div>
                  <div>
                    <p className="text-sm text-gray-700 dark:text-gray-300 font-medium">Optimizes your time</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Balances quizzes, study, drafting, and review activities</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-green-600 dark:text-green-400 text-xs font-bold flex-shrink-0">
                    3
                  </div>
                  <div>
                    <p className="text-sm text-gray-700 dark:text-gray-300 font-medium">Prepares for your exam</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Adjusts intensity based on how close your exam date is</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Manual Mode - Browse Units */}
        {mode === 'manual' && (
          <div className="space-y-6">
            <h2 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
              ATP Units ({ATP_UNITS.length})
            </h2>

            <div className="space-y-2">
              {ATP_UNITS.map((unit, i) => {
                const Icon = ICON_MAP[unit.icon] || BookOpen;
                return (
                  <Link key={unit.id} href={`/study/${unit.id}`}>
                    <div className="flex items-center gap-4 py-4 px-4 -mx-4 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800/50 transition-colors group">
                      <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-500 dark:text-gray-400 group-hover:bg-green-100 dark:group-hover:bg-green-900/30 group-hover:text-green-600 dark:group-hover:text-green-400 transition-colors">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-medium text-gray-900 dark:text-white group-hover:text-green-600 dark:group-hover:text-green-500 transition-colors">
                            {unit.name}
                          </h3>
                          <span className="text-xs text-gray-400 dark:text-gray-500">
                            {(unit as any).code}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-1">
                          {unit.description}
                        </p>
                      </div>
                      <ChevronRight className="h-5 w-5 text-gray-300 dark:text-gray-600 group-hover:text-green-500 transition-colors flex-shrink-0" />
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
