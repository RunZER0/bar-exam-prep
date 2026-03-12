'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { useTimeTracker } from '@/lib/hooks/useTimeTracker';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  FileText,
  BookOpen,
  ClipboardCheck,
  Lightbulb,
  Search,
  TrendingUp,
  Target,
  Clock,
  Award,
  ArrowRight,
  BarChart3,
  Flame,
  Calendar,
  Coffee,
  MessageCircleQuestion,
  Zap,
  Sparkles,
  Brain,
  AlertCircle,
  Mic,
  Users,
  BarChart2,
  MessagesSquare,
} from 'lucide-react';

interface Stats {
  totalQuestionsAttempted: number;
  totalQuestionsCorrect: number;
  overallAccuracy: number;
}

interface StreakData {
  currentStreak: number;
  longestStreak: number;
  todayMinutes: number;
  weeklyData: {
    date: string;
    dayName: string;
    minutes: number;
    questions: number;
  }[];
}

interface Recommendation {
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  action: string;
  href: string;
}

interface UserProfile {
  overallMastery: number;
  currentLevel: string;
  weakAreas: Array<{ name: string; performance: number }>;
  strongAreas: Array<{ name: string; performance: number }>;
  recommendations: Recommendation[];
}

const MODULES = [
  {
    href: '/drafting',
    label: 'Legal Drafting',
    description: 'Draft affidavits, pleadings, contracts and all legal documents with intelligent guidance.',
    icon: FileText,
    color: 'bg-emerald-500/10 text-emerald-500',
    borderColor: 'hover:border-emerald-500/30',
  },
  {
    href: '/study',
    label: 'Study',
    description: 'Deep dive into all 9 ATP units - from Civil Litigation to Commercial Transactions.',
    icon: BookOpen,
    color: 'bg-gray-500/10 text-gray-500',
    borderColor: 'hover:border-gray-500/30',
  },
  {
    href: '/exams',
    label: 'Examinations',
    description: 'Take CLE-style exams by unit with timed conditions and intelligent grading.',
    icon: ClipboardCheck,
    color: 'bg-green-500/10 text-green-500',
    borderColor: 'hover:border-green-500/30',
  },
  {
    href: '/quizzes',
    label: 'Quizzes & Trivia',
    description: 'Quick knowledge checks and fun trivia to reinforce your learning.',
    icon: Lightbulb,
    color: 'bg-amber-500/10 text-amber-500',
    borderColor: 'hover:border-amber-500/30',
  },
  {
    href: '/research',
    label: 'Research',
    description: 'Research Kenyan statutes and case law with intelligent search tools.',
    icon: Search,
    color: 'bg-rose-500/10 text-rose-500',
    borderColor: 'hover:border-rose-500/30',
  },
  {
    href: '/clarify',
    label: 'Get Clarification',
    description: 'Upload screenshots or voice notes to get help with confusing concepts.',
    icon: MessageCircleQuestion,
    color: 'bg-gray-500/10 text-gray-500',
    borderColor: 'hover:border-gray-500/30',
  },
  {
    href: '/mastery',
    label: 'Mastery Hub',
    description: 'Track your mastery across every topic with intelligent study cards and assessments.',
    icon: Brain,
    color: 'bg-violet-500/10 text-violet-500',
    borderColor: 'hover:border-violet-500/30',
  },
  {
    href: '/oral-exams',
    label: 'Oral Examinations',
    description: 'Practice viva voce exams with an AI examiner simulating real bar panel questions.',
    icon: Mic,
    color: 'bg-indigo-500/10 text-indigo-500',
    borderColor: 'hover:border-indigo-500/30',
  },
  {
    href: '/community',
    label: 'Community',
    description: 'Connect with fellow students, join study rooms, and compete on leaderboards.',
    icon: Users,
    color: 'bg-blue-500/10 text-blue-500',
    borderColor: 'hover:border-blue-500/30',
  },
  {
    href: '/banter',
    label: 'Banter',
    description: 'Relax with light-hearted legal humour and fun conversations between study sessions.',
    icon: MessagesSquare,
    color: 'bg-pink-500/10 text-pink-500',
    borderColor: 'hover:border-pink-500/30',
  },
  {
    href: '/progress',
    label: 'Progress Tracker',
    description: 'See your study stats, time spent, accuracy trends, and readiness indicators.',
    icon: BarChart2,
    color: 'bg-cyan-500/10 text-cyan-500',
    borderColor: 'hover:border-cyan-500/30',
  },
];

export default function DashboardPage() {
  const { user, getIdToken } = useAuth();
  useTimeTracker('dashboard');
  const [stats, setStats] = useState<Stats | null>(null);
  const [streakData, setStreakData] = useState<StreakData | null>(null);
  const [recentSessions, setRecentSessions] = useState<any[]>([]);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const token = await getIdToken();
        
        // Fetch progress and streaks in parallel
        const [progressRes, streakRes] = await Promise.all([
          fetch('/api/progress', { headers: { Authorization: `Bearer ${token}` } }),
          fetch('/api/streaks', { headers: { Authorization: `Bearer ${token}` } }),
        ]);
        
        if (progressRes.ok) {
          const data = await progressRes.json();
          // Handle both old and new API response formats
          if (data.statistics) {
            setStats(data.statistics);
            setRecentSessions(data.sessions || []);
          } else {
            // New format from updated API
            setStats({
              totalQuestionsAttempted: data.totalAttempts || 0,
              totalQuestionsCorrect: data.totalCorrect || 0,
              overallAccuracy: data.overallMastery || 0,
            });
            setUserProfile({
              overallMastery: data.overallMastery,
              currentLevel: data.currentLevel,
              weakAreas: data.weakAreas || [],
              strongAreas: data.strongAreas || [],
              recommendations: data.recommendations || [],
            });
          }
        }
        
        if (streakRes.ok) {
          const data = await streakRes.json();
          setStreakData(data);
        }
      } catch (err) {
        console.error('Failed to fetch data:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [getIdToken]);

  const getIntelligentGreeting = () => {
    const hour = new Date().getHours();
    const firstName = user?.displayName?.split(' ')[0] || 'Counsel';
    
    let timeGreeting = 'Good morning';
    if (hour >= 12 && hour < 17) timeGreeting = 'Good afternoon';
    else if (hour >= 17 && hour < 21) timeGreeting = 'Good evening';
    else if (hour >= 21 || hour < 5) timeGreeting = 'Burning the midnight oil';
    
    return { timeGreeting, firstName };
  };

  const getMotivationalMessage = () => {
    if (!userProfile) return 'Continue your bar exam preparation journey.';
    
    if (userProfile.weakAreas.length > 0) {
      return `I noticed you could use some practice with ${userProfile.weakAreas[0]?.name}. Let's strengthen that area today!`;
    }
    
    if (streakData && streakData.currentStreak >= 3) {
      return `Amazing ${streakData.currentStreak}-day streak! Your consistency is paying off.`;
    }
    
    if (userProfile.overallMastery >= 75) {
      return `Your performance is excellent! Ready to challenge yourself with harder questions?`;
    }
    
    return 'Continue your bar exam preparation journey.';
  };

  const { timeGreeting, firstName } = getIntelligentGreeting();

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-8">
      {/* Header with intelligent greeting */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">
          Keep going, {firstName} 💪
        </h1>
        <p className="text-muted-foreground mt-1">
          Here&apos;s your weekly study overview.
        </p>
      </div>

      {/* AI Recommendation Card */}
      {userProfile && userProfile.recommendations.length > 0 && (
        <div className="relative overflow-hidden rounded-2xl p-5 md:p-6 border border-primary/15 bg-primary/3">
          <div className="flex items-start gap-4">
            <div className="p-2.5 rounded-xl bg-primary text-primary-foreground shrink-0">
              <Brain className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <h3 className="font-semibold text-sm">Study Recommendation</h3>
                <Sparkles className="h-4 w-4 text-amber-500" />
              </div>
              <p className="text-sm text-muted-foreground mb-3">
                {userProfile.recommendations[0].description}
              </p>
              <Link href={userProfile.recommendations[0].href}>
                <Button size="sm" className="gap-2">
                  {userProfile.recommendations[0].title}
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </Link>
            </div>
            {userProfile.weakAreas.length > 0 && (
              <div className="hidden md:block text-right shrink-0">
                <p className="text-xs text-muted-foreground mb-1">Focus Area</p>
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-amber-500" />
                  <span className="text-sm font-medium">{userProfile.weakAreas[0].name}</span>
                </div>
                <p className="text-xs text-amber-600 mt-0.5">{userProfile.weakAreas[0].performance}% accuracy</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Streak banner */}
      {streakData && streakData.currentStreak > 0 && (
        <div className="relative overflow-hidden rounded-2xl p-4 md:p-6 border border-orange-500/20 bg-gradient-to-r from-orange-500/10 via-amber-500/10 to-yellow-500/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="relative w-14 h-16 flex items-center justify-center">
                {/* Multi-layer realistic fire */}
                <div className="absolute inset-0 flex items-end justify-center">
                  <div className="relative w-12 h-14">
                    {/* Outer glow */}
                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-14 h-4 rounded-full bg-orange-500/20 blur-lg animate-pulse" />
                    {/* Outer flame — red/orange */}
                    <div className="absolute bottom-0 left-1/2 w-9 h-12 rounded-[50%_50%_50%_50%_/_60%_60%_40%_40%] bg-gradient-to-t from-red-600 via-orange-500 to-yellow-400 opacity-80 animate-[fireDance_0.8s_ease-in-out_infinite_alternate] origin-bottom blur-[0.5px]" style={{ transform: 'translateX(-50%)' }} />
                    {/* Mid flame — orange/yellow */}
                    <div className="absolute bottom-0 left-1/2 w-7 h-10 rounded-[50%_50%_50%_50%_/_60%_60%_40%_40%] bg-gradient-to-t from-orange-500 via-amber-400 to-yellow-300 opacity-85 animate-[fireDance_0.6s_ease-in-out_infinite_alternate-reverse] origin-bottom" style={{ transform: 'translateX(-50%)' }} />
                    {/* Inner flame — yellow/white core */}
                    <div className="absolute bottom-0.5 left-1/2 w-4 h-7 rounded-[50%_50%_50%_50%_/_60%_60%_40%_40%] bg-gradient-to-t from-yellow-400 via-yellow-200 to-white opacity-90 animate-[fireDance_0.5s_ease-in-out_infinite_alternate] origin-bottom" style={{ transform: 'translateX(-50%)' }} />
                    {/* Spark particles */}
                    <div className="absolute bottom-6 left-1/2 -translate-x-1 w-1.5 h-1.5 rounded-full bg-yellow-300 opacity-70 animate-[sparkRise_1.2s_ease-out_infinite]" />
                    <div className="absolute bottom-5 left-1/2 translate-x-1 w-1 h-1 rounded-full bg-orange-400 opacity-60 animate-[sparkRise_1.5s_ease-out_0.3s_infinite]" />
                  </div>
                </div>
                <div className="absolute -top-1 -right-0 w-6 h-6 rounded-full bg-gradient-to-br from-orange-500 to-red-500 text-white text-xs font-bold flex items-center justify-center z-10 shadow-lg shadow-orange-500/50 border border-orange-400/30">
                  {streakData.currentStreak}
                </div>
              </div>
              <div>
                <p className="font-bold text-lg bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-500 bg-clip-text text-transparent">
                  {streakData.currentStreak} Day Streak!
                </p>
                <p className="text-sm text-muted-foreground">
                  Keep it up! Study today to maintain your streak.
                </p>
              </div>
            </div>
            <div className="hidden md:flex items-center gap-6">
              <div className="text-center">
                <p className="text-2xl font-bold">{streakData.todayMinutes}</p>
                <p className="text-xs text-muted-foreground">min today</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold">{streakData.longestStreak}</p>
                <p className="text-xs text-muted-foreground">best streak</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="stat-gradient-1">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10">
                <Target className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {loading ? '—' : stats?.totalQuestionsAttempted ?? 0}
                </p>
                <p className="text-xs text-muted-foreground">Questions Done</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="stat-gradient-2">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <TrendingUp className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {loading ? '—' : `${stats?.overallAccuracy ?? 0}%`}
                </p>
                <p className="text-xs text-muted-foreground">Accuracy</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="stat-gradient-3">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10">
                <Flame className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {loading ? '—' : streakData?.currentStreak ?? 0}
                </p>
                <p className="text-xs text-muted-foreground">Day Streak</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="stat-gradient-4">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-gray-500/10 dark:bg-gray-800">
                <Clock className="h-5 w-5 text-gray-600 dark:text-gray-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {loading ? '—' : recentSessions.length}
                </p>
                <p className="text-xs text-muted-foreground">Sessions</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Weekly activity chart */}
      {streakData && streakData.weeklyData.length > 0 && (() => {
        const maxMin = Math.max(...streakData.weeklyData.map(d => d.minutes), 1);
        return (
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Weekly Activity
                </CardTitle>
                <span className="text-xs text-muted-foreground">Last 7 days</span>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-end justify-between gap-2 h-36">
                {streakData.weeklyData.map((day, i) => {
                  const height = maxMin > 0 ? Math.max((day.minutes / maxMin) * 100, day.minutes > 0 ? 8 : 3) : 3;
                  const isToday = i === streakData.weeklyData.length - 1;
                  
                  return (
                    <div key={day.date} className="flex-1 flex flex-col items-center gap-1.5 h-full group relative">
                      <div className="w-full flex justify-center items-end flex-1">
                        <div
                          className={`w-full max-w-10 rounded-t transition-all duration-200 ${
                            isToday
                              ? 'bg-primary shadow-sm shadow-primary/30'
                              : 'bg-primary/50 group-hover:bg-primary/80'
                          }`}
                          style={{ height: `${height}%` }}
                        />
                      </div>
                      {/* Hover tooltip */}
                      {day.minutes > 0 && (
                        <div className="absolute bottom-full mb-2 hidden group-hover:flex flex-col items-center z-20 pointer-events-none">
                          <div className="bg-popover border border-border/20 text-xs rounded-xl px-3 py-2 shadow-lg whitespace-nowrap">
                            <div className="font-semibold text-foreground">{day.date}</div>
                            <div className="text-muted-foreground">{day.minutes}m studied{day.questions ? ` · ${day.questions} questions` : ''}</div>
                          </div>
                          <div className="w-2 h-2 bg-popover border-b border-r border-border/20 transform rotate-45 -mt-1" />
                        </div>
                      )}
                      <span className={`text-xs ${isToday ? 'font-bold text-primary' : 'text-muted-foreground'}`}>
                        {day.dayName}
                      </span>
                      {day.minutes > 0 && (
                        <span className="text-[10px] text-muted-foreground">{day.minutes}m</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        );
      })()}

      {/* Module cards */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Start Studying</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {MODULES.map((mod) => {
            const Icon = mod.icon;
            return (
              <Link key={mod.href} href={mod.href}>
                <Card
                  className={`group cursor-pointer border transition-all duration-200 ${mod.borderColor} hover:shadow-md`}
                >
                  <CardHeader className="pb-3">
                    <div className={`p-2.5 rounded-lg w-fit ${mod.color}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <CardTitle className="text-base mt-3 flex items-center justify-between">
                      {mod.label}
                      <ArrowRight className="h-4 w-4 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all text-muted-foreground" />
                    </CardTitle>
                    <CardDescription className="text-sm">
                      {mod.description}
                    </CardDescription>
                  </CardHeader>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Recent activity */}
      {recentSessions.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-4">Recent Activity</h2>
          <Card>
            <CardContent className="pt-5 divide-y">
              {recentSessions.slice(0, 5).map((session: any, i: number) => (
                <div
                  key={session.id || i}
                  className={`flex items-center justify-between py-3 ${i === 0 ? '' : ''}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="p-1.5 rounded bg-muted">
                      <BarChart3 className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-sm font-medium capitalize">
                        {session.competencyType} session
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Score: {session.score ?? '—'}%
                      </p>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {new Date(session.createdAt).toLocaleDateString()}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
