'use client';

/**
 * YNAI Mastery Engine v3 - Daily Plan Component
 * 
 * Core UI for the daily study plan.
 * Shows today's tasks with scoring breakdown,
 * tracks completion, and shows progress toward daily goals.
 * 
 * UX IMPROVEMENTS:
 * - One-click start for first task (no sheet required)
 * - Direct navigation to study pages
 * - Smooth transitions between states
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sheet, SheetHeader, SheetContent, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import EmbeddedPracticePanel, { PracticeTask } from './EmbeddedPracticePanel';

// ============================================
// TYPES
// ============================================

export interface PlanTask {
  id: string;
  skillId: string;
  skillName: string;
  itemId: string;
  itemType: 'mcq' | 'written' | 'oral' | 'drafting' | 'flashcard';
  mode: 'practice' | 'timed' | 'exam_sim';
  
  unitId: string;
  unitName: string;
  
  estimatedMinutes: number;
  score: number; // Objective function score
  
  scoringFactors: {
    learningGain: number;
    retentionGain: number;
    examRoi: number;
    errorClosure: number;
  };
  
  reason: string; // Human-readable explanation
  
  status: 'not_started' | 'in_progress' | 'completed' | 'skipped' | 'deferred';
  completedAt?: string;
}

export interface DailyPlanResponse {
  plan: {
    id: string;
    date: string;
    examPhase: string;
    totalMinutesPlanned: number;
    totalMinutesCompleted: number;
    daysUntilWritten: number;
    daysUntilOral: number;
    isGenerated: boolean;
    generatedAt: string;
  };
  tasks: Array<{
    id: string;
    taskType: string;
    itemId: string | null;
    skillId: string;
    skillName: string;
    unitId: string;
    format: string;
    mode: string;
    title: string;
    description: string;
    estimatedMinutes: number;
    order: number;
    priorityScore: number;
    scoringFactors: {
      learningGain: number;
      retentionGain: number;
      examRoi: number;
      errorClosure: number;
    };
    rationale: string;
    status: string;
  }>;
  summary: {
    primaryObjective: string;
    focusUnits: string[];
    totalTasks: number;
  };
}

export interface DailyPlanData {
  id: string;
  date: string;
  totalTasks: number;
  completedTasks: number;
  totalMinutes: number;
  completedMinutes: number;
  tasks: PlanTask[];
  generatedAt: string;
  expiresAt: string;
}

// ============================================
// TASK TYPE ICONS AND COLORS
// ============================================

const TASK_TYPE_CONFIG: Record<string, { icon: string; color: string; label: string }> = {
  mcq: { icon: '📝', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200', label: 'MCQ' },
  written: { icon: '✍️', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200', label: 'Written' },
  oral: { icon: '🎤', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200', label: 'Oral' },
  drafting: { icon: '📄', color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200', label: 'Drafting' },
  flashcard: { icon: '🃏', color: 'bg-zinc-100 text-zinc-800 dark:bg-zinc-900 dark:text-zinc-200', label: 'Flashcard' },
};

const MODE_BADGES: Record<string, { label: string; color: string }> = {
  practice: { label: 'Practice', color: 'bg-zinc-200 dark:bg-zinc-700' },
  timed: { label: 'Timed', color: 'bg-amber-200 dark:bg-amber-800' },
  exam_sim: { label: 'Exam Sim', color: 'bg-red-200 dark:bg-red-800' },
};

// ============================================
// MAIN COMPONENT
// ============================================

export default function DailyPlanView() {
  const { getIdToken } = useAuth();
  const [plan, setPlan] = useState<DailyPlanData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTask, setSelectedTask] = useState<PlanTask | null>(null);
  const [activePracticeTask, setActivePracticeTask] = useState<PracticeTask | null>(null);

  const fetchPlan = useCallback(async () => {
    try {
      setLoading(true);
      const token = await getIdToken();
      const response = await fetch('/api/mastery/plan', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch daily plan');
      }

      const data: DailyPlanResponse = await response.json();
      
      // Transform API response to component format
      const transformedPlan: DailyPlanData = {
        id: data.plan.id,
        date: data.plan.date,
        totalTasks: data.tasks.length,
        completedTasks: data.tasks.filter(t => t.status === 'completed').length,
        totalMinutes: data.plan.totalMinutesPlanned || data.tasks.reduce((sum, t) => sum + t.estimatedMinutes, 0),
        completedMinutes: data.plan.totalMinutesCompleted || 0,
        tasks: data.tasks.map(t => ({
          id: t.id,
          skillId: t.skillId,
          skillName: t.skillName || t.title.replace(/^[A-Z_\s]+:\s*/, ''),
          itemId: t.itemId || '',
          itemType: t.format as PlanTask['itemType'],
          mode: t.mode as PlanTask['mode'],
          unitId: t.unitId || 'atp-100',
          unitName: t.description.split(' with ')[0].replace('Practice ', ''),
          estimatedMinutes: t.estimatedMinutes,
          score: t.priorityScore,
          scoringFactors: t.scoringFactors || {
            learningGain: 0.25,
            retentionGain: 0.25,
            examRoi: 0.25,
            errorClosure: 0.25,
          },
          reason: t.rationale,
          status: (t.status === 'pending' ? 'not_started' : t.status) as PlanTask['status'],
        })),
        generatedAt: data.plan.generatedAt,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      };
      
      setPlan(transformedPlan);
    } catch (err) {
      console.error('Error fetching plan:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [getIdToken]);

  useEffect(() => {
    fetchPlan();
  }, [fetchPlan]);

  const updateTaskStatus = async (taskId: string, status: 'not_started' | 'completed' | 'skipped' | 'deferred') => {
    if (!plan) return;

    const token = await getIdToken();
    await fetch('/api/mastery/plan', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ taskId, status }),
    });

    // Optimistic update
    setPlan({
      ...plan,
      tasks: plan.tasks.map(t => 
        t.id === taskId 
          ? { ...t, status, completedAt: status === 'completed' ? new Date().toISOString() : undefined }
          : t
      ),
      completedTasks: plan.completedTasks + (status === 'completed' ? 1 : 0),
    });
  };

  // Start inline practice for a task (no navigation)
  const startPractice = (task: PlanTask) => {
    setActivePracticeTask({
      id: task.id,
      skillId: task.skillId,
      skillName: task.skillName,
      unitId: task.unitId,
      unitName: task.unitName,
      itemType: task.itemType,
      mode: task.mode,
      reason: task.reason,
      itemId: task.itemId,
    });
    // Mark as in progress
    updateTaskStatus(task.id, 'in_progress' as any);
  };

  // Quick start: Start inline practice for first task
  const startNextTask = async () => {
    const nextTask = plan?.tasks.find(t => t.status === 'not_started');
    if (nextTask) {
      startPractice(nextTask);
    }
  };

  // Handle task completion from practice panel
  const handlePracticeComplete = async (taskId: string) => {
    await updateTaskStatus(taskId, 'completed');
    setActivePracticeTask(null);
  };

  // Close practice panel without completing
  const handlePracticeClose = () => {
    setActivePracticeTask(null);
  };

  const regeneratePlan = async () => {
    setLoading(true);
    const token = await getIdToken();
    await fetch('/api/mastery/plan', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ regenerate: true }),
    });
    await fetchPlan();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-red-200 dark:border-red-800">
        <CardContent className="p-6">
          <p className="text-red-600 dark:text-red-400">{error}</p>
          <Button onClick={fetchPlan} className="mt-4">Retry</Button>
        </CardContent>
      </Card>
    );
  }

  if (!plan) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-muted-foreground">No plan available for today.</p>
          <Button onClick={regeneratePlan} className="mt-4">Generate Plan</Button>
        </CardContent>
      </Card>
    );
  }

  const completionPercentage = Math.round((plan.completedTasks / plan.totalTasks) * 100);
  const remainingTasks = plan.tasks.filter(t => t.status === 'not_started');
  const completedTasks = plan.tasks.filter(t => t.status === 'completed');
  const skippedTasks = plan.tasks.filter(t => t.status === 'skipped' || t.status === 'deferred');
  const nextTask = remainingTasks[0];

  return (
    <div className="space-y-6">
      {/* Inline Practice Panel - Shows when a task is being practiced */}
      {activePracticeTask && (
        <EmbeddedPracticePanel
          task={activePracticeTask}
          onComplete={() => handlePracticeComplete(activePracticeTask.id)}
          onClose={handlePracticeClose}
        />
      )}

      {/* HERO: Start Next Task - Immediate Action (No Scrolling Required!) */}
      {!activePracticeTask && nextTask && (
        <Card className="bg-gradient-to-br from-primary/10 via-primary/5 to-background border-primary/20 overflow-hidden">
          <CardContent className="p-6">
            <div className="flex items-center justify-between gap-6">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-primary mb-1 uppercase tracking-wider">
                  Up Next
                </p>
                <h2 className="text-xl font-semibold mb-2 line-clamp-1">
                  {nextTask.skillName}
                </h2>
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${TASK_TYPE_CONFIG[nextTask.itemType]?.color || ''}`}>
                    {TASK_TYPE_CONFIG[nextTask.itemType]?.icon} {TASK_TYPE_CONFIG[nextTask.itemType]?.label}
                  </span>
                  <span>~{nextTask.estimatedMinutes} min</span>
                  <span className="hidden sm:inline">• {nextTask.unitName}</span>
                </div>
              </div>
              <Button 
                size="lg" 
                onClick={startNextTask}
                className="flex-shrink-0 shadow-lg hover:shadow-xl transition-all hover:scale-105 active:scale-95 px-8"
              >
                Start Now →
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Hide all below when practice is active */}
      {!activePracticeTask && (
        <>
          {/* Completion celebration */}
          {remainingTasks.length === 0 && completedTasks.length > 0 && (
            <Card className="bg-gradient-to-br from-green-500/10 to-emerald-500/5 border-green-500/20">
              <CardContent className="p-6 text-center">
                <div className="text-4xl mb-3">🎉</div>
                <h2 className="text-xl font-semibold text-green-600 dark:text-green-400 mb-2">
                  All Done for Today!
                </h2>
                <p className="text-muted-foreground">
                  You completed {completedTasks.length} tasks. Great work!
                </p>
              </CardContent>
            </Card>
          )}

          {/* Progress & Stats */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Today&apos;s Progress</CardTitle>
            <Button variant="ghost" size="sm" onClick={regeneratePlan}>
              ↻ Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Progress Bar */}
          <div className="mb-4">
            <div className="flex justify-between text-sm mb-1">
              <span>{plan.completedTasks} of {plan.totalTasks} tasks completed</span>
              <span>{completionPercentage}%</span>
            </div>
            <div className="w-full bg-muted rounded-full h-3">
              <div 
                className="bg-primary h-3 rounded-full transition-all duration-500 ease-out"
                style={{ width: `${completionPercentage}%` }}
              />
            </div>
          </div>
          
          {/* Time Summary */}
          <div className="flex gap-4 text-sm text-muted-foreground">
            <span>Estimated: {plan.totalMinutes} mins</span>
            <span>•</span>
            <span>Remaining: {plan.totalMinutes - plan.completedMinutes} mins</span>
          </div>
        </CardContent>
      </Card>

      {/* Remaining Tasks (skip first one since it's shown in hero) */}
      {remainingTasks.length > 1 && (
        <div className="space-y-3">
          <h3 className="font-semibold text-lg">Coming Up</h3>
          <div className="space-y-3 stagger-children">
            {remainingTasks.slice(1).map((task, index) => (
              <TaskCard
                key={task.id}
                task={task}
                index={index + 2}
                onClick={() => setSelectedTask(task)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Task Detail Sheet */}
      <Sheet open={!!selectedTask} onClose={() => setSelectedTask(null)} side="bottom">
        {selectedTask && (
          <>
            <SheetHeader onClose={() => setSelectedTask(null)}>
              <SheetTitle>Task Details</SheetTitle>
              <SheetDescription>
                {selectedTask.unitName}
              </SheetDescription>
            </SheetHeader>
            <SheetContent>
              <TaskDetailContent 
                task={selectedTask}
                onStart={() => {
                  // Start inline practice instead of navigating
                  setSelectedTask(null);
                  startPractice(selectedTask);
                }}
                onSkip={() => {
                  updateTaskStatus(selectedTask.id, 'skipped');
                  setSelectedTask(null);
                }}
                onDefer={() => {
                  updateTaskStatus(selectedTask.id, 'deferred');
                  setSelectedTask(null);
                }}
              />
            </SheetContent>
          </>
        )}
      </Sheet>

      {/* Completed Tasks */}
      {completedTasks.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-semibold text-lg text-muted-foreground">Completed</h3>
          <div className="space-y-3 stagger-children">
            {completedTasks.map((task, index) => (
              <CompletedTaskCard key={task.id} task={task} />
            ))}
          </div>
        </div>
      )}

      {/* Skipped Tasks */}
      {skippedTasks.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-semibold text-lg text-muted-foreground">Skipped / Deferred</h3>
          <div className="space-y-3 stagger-children">
            {skippedTasks.map((task) => (
              <SkippedTaskCard 
                key={task.id} 
                task={task}
                onReschedule={() => updateTaskStatus(task.id, 'not_started')}
              />
            ))}
          </div>
        </div>
      )}
        </>
      )}
    </div>
  );
}

// ============================================
// TASK CARD COMPONENT (Clickable)
// ============================================

interface TaskCardProps {
  task: PlanTask;
  index: number;
  onClick: () => void;
}

function TaskCard({ task, index, onClick }: TaskCardProps) {
  const typeConfig = TASK_TYPE_CONFIG[task.itemType] || TASK_TYPE_CONFIG.mcq;
  const modeConfig = MODE_BADGES[task.mode] || MODE_BADGES.practice;

  return (
    <Card 
      className="group cursor-pointer transition-all duration-200 hover:shadow-lg hover:scale-[1.01] active:scale-[0.99] hover:border-primary/30"
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-center gap-4">
          {/* Index */}
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold text-sm shadow-md transition-transform group-hover:scale-110">
            {index}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              {/* Type Badge */}
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${typeConfig.color}`}>
                {typeConfig.icon} {typeConfig.label}
              </span>
              {/* Mode Badge */}
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${modeConfig.color}`}>
                {modeConfig.label}
              </span>
              {/* Time */}
              <span className="text-xs text-muted-foreground">
                ~{task.estimatedMinutes} min
              </span>
            </div>

            {/* Skill Name */}
            <h4 className="font-medium text-sm">{task.skillName}</h4>

            {/* Unit */}
            <p className="text-xs text-muted-foreground">{task.unitName}</p>
          </div>

          {/* Arrow indicating clickable */}
          <div className="flex-shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1">
            →
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================
// TASK DETAIL CONTENT (for Sheet)
// ============================================

interface TaskDetailContentProps {
  task: PlanTask;
  onStart: () => void;
  onSkip: () => void;
  onDefer: () => void;
}

function TaskDetailContent({ task, onStart, onSkip, onDefer }: TaskDetailContentProps) {
  const typeConfig = TASK_TYPE_CONFIG[task.itemType] || TASK_TYPE_CONFIG.mcq;
  const modeConfig = MODE_BADGES[task.mode] || MODE_BADGES.practice;

  return (
    <div className="space-y-6">
      {/* Task Header */}
      <div className="flex items-center gap-4">
        <div className={`w-14 h-14 rounded-xl flex items-center justify-center text-2xl ${typeConfig.color}`}>
          {typeConfig.icon}
        </div>
        <div>
          <h3 className="font-semibold text-lg">{task.skillName}</h3>
          <div className="flex items-center gap-2 mt-1">
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${typeConfig.color}`}>
              {typeConfig.label}
            </span>
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${modeConfig.color}`}>
              {modeConfig.label}
            </span>
            <span className="text-xs text-muted-foreground">
              ~{task.estimatedMinutes} min
            </span>
          </div>
        </div>
      </div>

      {/* Why This Task */}
      <div className="p-4 bg-muted/50 rounded-lg">
        <h4 className="font-medium text-sm mb-2">Why this task?</h4>
        <p className="text-sm text-muted-foreground">{task.reason}</p>
      </div>

      {/* Scoring Breakdown */}
      <div>
        <h4 className="font-medium text-sm mb-3">Learning Impact</h4>
        <div className="grid grid-cols-2 gap-3">
          <ScoreMetric 
            label="Learning Gain" 
            value={task.scoringFactors.learningGain} 
            icon="📈"
          />
          <ScoreMetric 
            label="Retention" 
            value={task.scoringFactors.retentionGain} 
            icon="🧠"
          />
          <ScoreMetric 
            label="Exam ROI" 
            value={task.scoringFactors.examRoi} 
            icon="🎯"
          />
          <ScoreMetric 
            label="Error Closure" 
            value={task.scoringFactors.errorClosure} 
            icon="✅"
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-3 pt-4">
        <Button size="lg" className="w-full" onClick={onStart}>
          Start Practice
        </Button>
        <div className="flex gap-3">
          <Button variant="outline" size="sm" className="flex-1" onClick={onSkip}>
            Skip
          </Button>
          <Button variant="outline" size="sm" className="flex-1" onClick={onDefer}>
            Do Later
          </Button>
        </div>
      </div>
    </div>
  );
}

function ScoreMetric({ label, value, icon }: { label: string; value: number; icon: string }) {
  const percentage = Math.round(value * 100);
  return (
    <div className="p-3 bg-muted rounded-lg">
      <div className="flex items-center gap-2 mb-1">
        <span>{icon}</span>
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex-1 h-2 bg-background rounded-full overflow-hidden">
          <div 
            className="h-2 bg-primary rounded-full transition-all duration-500"
            style={{ width: `${percentage}%` }}
          />
        </div>
        <span className="text-sm font-medium w-10 text-right">{percentage}%</span>
      </div>
    </div>
  );
}

// ============================================
// COMPLETED TASK CARD
// ============================================

function CompletedTaskCard({ task }: { task: PlanTask }) {
  const typeConfig = TASK_TYPE_CONFIG[task.itemType] || TASK_TYPE_CONFIG.mcq;

  return (
    <Card className="opacity-70 transition-all duration-200 hover:opacity-90 hover:shadow-sm">
      <CardContent className="p-4">
        <div className="flex items-center gap-4">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-green-500 text-white flex items-center justify-center shadow-sm">
            ✓
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${typeConfig.color}`}>
                {typeConfig.icon} {typeConfig.label}
              </span>
              <span className="text-xs text-muted-foreground">
                Completed {task.completedAt ? new Date(task.completedAt).toLocaleTimeString() : ''}
              </span>
            </div>
            <h4 className="font-medium text-sm line-through">{task.skillName}</h4>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================
// SKIPPED TASK CARD
// ============================================

function SkippedTaskCard({ task, onReschedule }: { task: PlanTask; onReschedule: () => void }) {
  const typeConfig = TASK_TYPE_CONFIG[task.itemType] || TASK_TYPE_CONFIG.mcq;

  return (
    <Card className="opacity-50 transition-all duration-200 hover:opacity-70 hover:shadow-sm">
      <CardContent className="p-4">
        <div className="flex items-center gap-4">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-muted text-muted-foreground flex items-center justify-center">
            —
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${typeConfig.color}`}>
                {typeConfig.icon} {typeConfig.label}
              </span>
              <span className="text-xs text-muted-foreground">
                {task.status === 'deferred' ? 'Deferred' : 'Skipped'}
              </span>
            </div>
            <h4 className="font-medium text-sm">{task.skillName}</h4>
          </div>
          <Button variant="ghost" size="sm" onClick={onReschedule}>
            Restore
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
