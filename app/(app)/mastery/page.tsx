'use client';

/**
 * YNAI Mastery Hub - Complete Redesign
 * 
 * DESIGN PRINCIPLES:
 * 1. Action-first: User sees their next task immediately
 * 2. No placeholders: Every metric comes from real APIs
 * 3. Clean UI: Focus on what matters - learning
 * 4. Study-first flow: Notes before questions
 */

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import EmbeddedPracticePanel from '@/components/EmbeddedPracticePanel';
import { 
  Loader2, BookOpen, Target, Clock, TrendingUp, 
  ArrowRight, CheckCircle2, Flame, GraduationCap,
  Sparkles, BarChart3, ChevronRight, Play, RefreshCw
} from 'lucide-react';

// ============================================
// TYPES
// ============================================

interface PlanTask {
  id: string;
  skillId: string;
  skillName: string;
  itemId?: string;
  unitId: string;
  unitName: string;
  itemType: 'written';
  mode: 'practice' | 'timed' | 'exam_sim';
  estimatedMinutes: number;
  status: string;
  rationale: string;
}

interface ReadinessData {
  overall: { score: number; trend: string };
  units: Array<{
    unitId: string;
    unitName: string;
    score: number;
    skillsTotal: number;
    skillsVerified: number;
  }>;
  daysUntilExam?: number;
}

interface WeeklyStats {
  attemptsCount: number;
  minutesStudied: number;
  gatesPassed: number;
  studyStreak: number;
}

// ============================================
// MAIN COMPONENT
// ============================================

export default function MasteryPage() {
  const router = useRouter();
  const { getIdToken } = useAuth();
  
  // Loading states
  const [loading, setLoading] = useState(true);
  const [onboardingComplete, setOnboardingComplete] = useState(false);
  
  // Data
  const [tasks, setTasks] = useState<PlanTask[]>([]);
  const [readiness, setReadiness] = useState<ReadinessData | null>(null);
  const [stats, setStats] = useState<WeeklyStats>({ attemptsCount: 0, minutesStudied: 0, gatesPassed: 0, studyStreak: 0 });
  
  // Active practice
  const [activePractice, setActivePractice] = useState<PlanTask | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Fetch all data
  const loadData = useCallback(async () => {
    try {
      const token = await getIdToken();
      if (!token) {
        setLoading(false);
        return;
      }
      
      // Parallel fetch all data
      const [onboardingRes, planRes, readinessRes, progressRes] = await Promise.all([
        fetch('/api/onboarding', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/mastery/plan', { headers: { Authorization: `Bearer ${token}` } }).catch(() => null),
        fetch('/api/mastery/readiness', { headers: { Authorization: `Bearer ${token}` } }).catch(() => null),
        fetch('/api/progress', { headers: { Authorization: `Bearer ${token}` } }).catch(() => null),
      ]);

      // Check onboarding
      if (onboardingRes.ok) {
        const data = await onboardingRes.json();
        setOnboardingComplete(data.onboardingCompleted === true);
      }

      // Process plan
      if (planRes?.ok) {
        const planData = await planRes.json();
        const transformedTasks = (planData.tasks || []).map((t: any) => ({
          id: t.id,
          skillId: t.skillId,
          skillName: t.skillName || t.title || 'Practice Task',
          itemId: t.itemId || undefined,
          unitId: t.unitId || 'atp-100',
          unitName: getUnitName(t.unitId || 'atp-100'),
          itemType: 'written' as const,
          mode: (t.mode || 'practice') as 'practice' | 'timed' | 'exam_sim',
          estimatedMinutes: t.estimatedMinutes || 10,
          status: t.status === 'pending' ? 'not_started' : t.status,
          rationale: t.rationale || t.description || '',
        }));
        setTasks(transformedTasks);
      }

      // Process readiness
      if (readinessRes?.ok) {
        const data = await readinessRes.json();
        setReadiness(data);
      }

      // Process progress/stats
      if (progressRes?.ok) {
        const data = await progressRes.json();
        setStats({
          attemptsCount: data.totalAttempts || 0,
          minutesStudied: data.totalMinutesStudied || 0,
          gatesPassed: data.gatesPassed || 0,
          studyStreak: data.studyStreak || 0,
        });
      }

    } catch (error) {
      console.error('Error loading mastery data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [getIdToken]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Refresh data
  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  // Start practice session
  const startPractice = useCallback((task: PlanTask) => {
    setActivePractice(task);
  }, []);

  // Complete task
  const completeTask = useCallback(async (taskId: string) => {
    const token = await getIdToken();
    await fetch('/api/mastery/plan', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ taskId, status: 'completed' }),
    }).catch(() => {});
    
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: 'completed' } : t));
    setActivePractice(null);
  }, [getIdToken]);

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center">
        <div className="text-center">
          <div className="relative w-16 h-16 mx-auto mb-4">
            <div className="absolute inset-0 rounded-full border-4 border-primary/20" />
            <div className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin" />
          </div>
          <p className="text-muted-foreground">Loading your study session...</p>
        </div>
      </div>
    );
  }

  // Onboarding gate
  if (!onboardingComplete) {
    return <OnboardingGate onComplete={() => router.push('/onboarding')} />;
  }

  // Active practice view - uses the actual EmbeddedPracticePanel
  if (activePractice) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <EmbeddedPracticePanel
            task={{
              id: activePractice.id,
              skillId: activePractice.skillId,
              skillName: activePractice.skillName,
              unitId: activePractice.unitId,
              unitName: activePractice.unitName,
              itemType: 'written',
              mode: activePractice.mode,
              reason: activePractice.rationale,
              itemId: activePractice.itemId,
            }}
            onComplete={() => completeTask(activePractice.id)}
            onClose={() => setActivePractice(null)}
          />
        </div>
      </div>
    );
  }

  const nextTask = tasks.find(t => t.status === 'not_started' || t.status === 'pending');
  const completedToday = tasks.filter(t => t.status === 'completed').length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <div className="max-w-6xl mx-auto px-4 py-6 sm:py-8">
        
        {/* Header */}
        <header className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Mastery Hub</h1>
              <p className="text-muted-foreground mt-1">Your path to bar exam success</p>
            </div>
            <div className="flex items-center gap-3">
              {stats.studyStreak > 0 && (
                <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400">
                  <Flame className="h-4 w-4" />
                  <span className="font-semibold text-sm">{stats.studyStreak} day streak</span>
                </div>
              )}
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleRefresh}
                disabled={refreshing}
              >
                <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
        </header>

        {/* Hero: Next Task */}
        {nextTask ? (
          <Card className="mb-8 border-primary/20 bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 overflow-hidden">
            <CardContent className="p-0">
              <div className="flex flex-col sm:flex-row">
                {/* Task Info */}
                <div className="flex-1 p-6">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="px-2 py-0.5 rounded text-xs font-medium bg-primary/10 text-primary">
                      UP NEXT
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {nextTask.unitName}
                    </span>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-semibold mb-2">
                    {nextTask.skillName}
                  </h2>
                  <p className="text-sm text-muted-foreground mb-4">
                    {nextTask.rationale || `Practice this skill to improve your ${nextTask.unitName} mastery`}
                  </p>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      ~{nextTask.estimatedMinutes} min
                    </span>
                    <span className="flex items-center gap-1">
                      <Target className="h-4 w-4" />
                      {nextTask.mode === 'practice' ? 'Practice Mode' : nextTask.mode === 'timed' ? 'Timed Challenge' : 'Exam Simulation'}
                    </span>
                  </div>
                </div>
                
                {/* Start Button */}
                <div className="flex items-center justify-center p-6 sm:border-l border-t sm:border-t-0 border-primary/10 bg-primary/5">
                  <Button 
                    size="lg" 
                    onClick={() => startPractice(nextTask)}
                    className="gap-2 px-8 py-6 text-lg shadow-lg hover:shadow-xl transition-all hover:scale-105"
                  >
                    <Play className="h-5 w-5" />
                    Start Now
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="mb-8 border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/30">
            <CardContent className="p-6 text-center">
              <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-3" />
              <h2 className="text-xl font-semibold text-green-800 dark:text-green-200">
                {tasks.length === 0 ? 'Ready to Begin' : 'All Tasks Complete!'}
              </h2>
              <p className="text-green-600 dark:text-green-400 mt-1">
                {tasks.length === 0 
                  ? 'Start practicing to build your personalized study plan' 
                  : 'Great work today. Come back tomorrow for new tasks.'}
              </p>
              <Button 
                variant="outline" 
                className="mt-4"
                onClick={() => router.push('/study')}
              >
                Browse Study Materials
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Stats Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          <StatCard 
            icon={<BarChart3 className="h-5 w-5" />}
            label="Today"
            value={tasks.length > 0 ? `${completedToday}/${tasks.length}` : '—'}
            subtext="tasks done"
          />
          <StatCard 
            icon={<CheckCircle2 className="h-5 w-5" />}
            label="All Time"
            value={stats.attemptsCount.toString()}
            subtext="attempts"
          />
          <StatCard 
            icon={<TrendingUp className="h-5 w-5" />}
            label="Mastered"
            value={stats.gatesPassed.toString()}
            subtext="skills"
          />
          <StatCard 
            icon={<Clock className="h-5 w-5" />}
            label="This Week"
            value={formatMinutes(stats.minutesStudied)}
            subtext="studied"
          />
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Task Queue */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Today's Tasks</h3>
              {tasks.length > 0 && (
                <span className="text-sm text-muted-foreground">
                  {completedToday} of {tasks.length} complete
                </span>
              )}
            </div>

            {tasks.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <BookOpen className="h-12 w-12 text-muted-foreground/50 mx-auto mb-3" />
                  <h4 className="font-medium mb-2">No Tasks Yet</h4>
                  <p className="text-sm text-muted-foreground mb-4">
                    Start practicing to generate your personalized daily plan with AI-recommended tasks.
                  </p>
                  <Button onClick={() => router.push('/study')}>
                    Start Studying
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {tasks.map((task, index) => (
                  <TaskCard 
                    key={task.id}
                    task={task}
                    index={index}
                    onStart={() => startPractice(task)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Readiness Sidebar */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Your Progress</h3>
            
            {/* Overall Score */}
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <div className="relative w-16 h-16">
                    <svg className="w-16 h-16 transform -rotate-90">
                      <circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="6" 
                        className="text-muted/30" fill="none" />
                      <circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="6"
                        className="text-primary" fill="none"
                        strokeDasharray={`${(readiness?.overall?.score || 0) * 1.76} 176`}
                        strokeLinecap="round" />
                    </svg>
                    <span className="absolute inset-0 flex items-center justify-center text-lg font-bold">
                      {readiness?.overall?.score || 0}%
                    </span>
                  </div>
                  <div>
                    <p className="font-medium">Overall Readiness</p>
                    <p className="text-sm text-muted-foreground">
                      {readiness?.daysUntilExam 
                        ? `${readiness.daysUntilExam} days to exam`
                        : 'Set your exam date'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Unit Progress */}
            {readiness?.units && readiness.units.length > 0 && (
              <Card>
                <CardContent className="p-4">
                  <p className="font-medium mb-3">By Subject</p>
                  <div className="space-y-3">
                    {readiness.units.slice(0, 5).map((unit) => (
                      <div key={unit.unitId} className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="truncate">{unit.unitName}</span>
                          <span className="font-medium">{Math.round(unit.score)}%</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                          <div 
                            className={`h-full rounded-full transition-all ${
                              unit.score >= 80 ? 'bg-green-500' : 
                              unit.score >= 50 ? 'bg-amber-500' : 'bg-red-500'
                            }`}
                            style={{ width: `${unit.score}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                  <Button 
                    variant="ghost" 
                    className="w-full mt-3 text-sm"
                    onClick={() => router.push('/progress')}
                  >
                    View Full Progress <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Quick Links */}
            <Card>
              <CardContent className="p-4 space-y-2">
                <p className="font-medium mb-3">Quick Actions</p>
                <QuickLink href="/tutor" icon={<Sparkles className="h-4 w-4" />} label="Ask AI Tutor" />
                <QuickLink href="/exams" icon={<GraduationCap className="h-4 w-4" />} label="Mock Exam" />
                <QuickLink href="/study" icon={<BookOpen className="h-4 w-4" />} label="Browse Materials" />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================
// SUB-COMPONENTS
// ============================================

function OnboardingGate({ onComplete }: { onComplete: () => void }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center p-4">
      <Card className="max-w-md w-full border-primary/20">
        <CardContent className="p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <GraduationCap className="h-8 w-8 text-primary" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Welcome to Mastery Hub</h2>
          <p className="text-muted-foreground mb-6">
            To create your personalized study plan, we need to know a bit about your goals and background. This takes about 2 minutes.
          </p>
          <Button size="lg" onClick={onComplete} className="gap-2">
            <Sparkles className="h-4 w-4" />
            Get Started
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ icon, label, value, subtext }: { icon: React.ReactNode; label: string; value: string; subtext: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="p-2 rounded-lg bg-primary/10 text-primary">
            {icon}
          </div>
        </div>
        <p className="text-2xl font-bold mt-2">{value}</p>
        <p className="text-xs text-muted-foreground">{subtext}</p>
      </CardContent>
    </Card>
  );
}

function TaskCard({ task, index, onStart }: { task: PlanTask; index: number; onStart: () => void }) {
  const isCompleted = task.status === 'completed';
  
  return (
    <Card className={`transition-all ${isCompleted ? 'opacity-60' : 'hover:shadow-md hover:border-primary/20'}`}>
      <CardContent className="p-4">
        <div className="flex items-center gap-4">
          {/* Status indicator */}
          <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
            isCompleted 
              ? 'bg-green-100 dark:bg-green-900/30 text-green-600' 
              : 'bg-primary/10 text-primary'
          }`}>
            {isCompleted ? (
              <CheckCircle2 className="h-5 w-5" />
            ) : (
              <span className="font-semibold">{index + 1}</span>
            )}
          </div>

          {/* Task info */}
          <div className="flex-1 min-w-0">
            <p className={`font-medium ${isCompleted ? 'line-through text-muted-foreground' : ''}`}>
              {task.skillName}
            </p>
            <p className="text-sm text-muted-foreground truncate">
              {task.unitName} • ~{task.estimatedMinutes} min
            </p>
          </div>

          {/* Action */}
          {!isCompleted && (
            <Button size="sm" onClick={onStart} className="gap-1 flex-shrink-0">
              Start <ArrowRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function QuickLink({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  const router = useRouter();
  return (
    <button
      onClick={() => router.push(href)}
      className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-muted transition-colors text-left"
    >
      <div className="p-1.5 rounded bg-muted text-muted-foreground">
        {icon}
      </div>
      <span className="text-sm">{label}</span>
      <ChevronRight className="h-4 w-4 text-muted-foreground ml-auto" />
    </button>
  );
}

// ============================================
// HELPERS
// ============================================

function formatMinutes(minutes: number): string {
  if (minutes === 0) return '0m';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

function getUnitName(unitId: string): string {
  const names: Record<string, string> = {
    'atp-100': 'Civil Litigation',
    'atp-101': 'Criminal Litigation', 
    'atp-102': 'Conveyancing',
    'atp-103': 'Family Law',
    'atp-104': 'Probate & Administration',
    'atp-105': 'Commercial Transactions',
    'atp-106': 'Legal Ethics',
    'atp-107': 'Legal Writing',
    'atp-108': 'Oral Advocacy',
  };
  return names[unitId] || 'General Practice';
}
