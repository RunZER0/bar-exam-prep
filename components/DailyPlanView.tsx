'use client';

/**
 * YNAI Mastery Engine v3 - Daily Plan Component
 * 
 * Core UI for the daily study plan.
 * Shows today's tasks with scoring breakdown,
 * tracks completion, and shows progress toward daily goals.
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

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
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);

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
          skillName: t.title.replace(/^[A-Z_\s]+:\s*/, ''), // Extract skill name from title
          itemId: t.itemId || '',
          itemType: t.format as PlanTask['itemType'],
          mode: t.mode as PlanTask['mode'],
          unitId: t.skillId.split('-')[0] || 'atp-100',
          unitName: t.description.split(' with ')[0].replace('Practice ', ''),
          estimatedMinutes: t.estimatedMinutes,
          score: t.priorityScore,
          scoringFactors: t.scoringFactors,
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

  return (
    <div className="space-y-6">
      {/* Header with Progress */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl">Today&apos;s Study Plan</CardTitle>
            <Button variant="outline" size="sm" onClick={regeneratePlan}>
              Regenerate
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
                className="bg-primary h-3 rounded-full transition-all duration-300"
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

      {/* Remaining Tasks */}
      {remainingTasks.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-semibold text-lg">Up Next</h3>
          {remainingTasks.map((task, index) => (
            <TaskCard
              key={task.id}
              task={task}
              index={index + 1}
              isExpanded={expandedTaskId === task.id}
              onToggleExpand={() => setExpandedTaskId(
                expandedTaskId === task.id ? null : task.id
              )}
              onComplete={() => updateTaskStatus(task.id, 'completed')}
              onSkip={() => updateTaskStatus(task.id, 'skipped')}
              onDefer={() => updateTaskStatus(task.id, 'deferred')}
            />
          ))}
        </div>
      )}

      {/* Completed Tasks */}
      {completedTasks.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-semibold text-lg text-muted-foreground">Completed</h3>
          {completedTasks.map((task, index) => (
            <CompletedTaskCard key={task.id} task={task} />
          ))}
        </div>
      )}

      {/* Skipped Tasks */}
      {skippedTasks.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-semibold text-lg text-muted-foreground">Skipped / Deferred</h3>
          {skippedTasks.map((task) => (
            <SkippedTaskCard 
              key={task.id} 
              task={task}
              onReschedule={() => updateTaskStatus(task.id, 'not_started')}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================
// TASK CARD COMPONENT
// ============================================

interface TaskCardProps {
  task: PlanTask;
  index: number;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onComplete: () => void;
  onSkip: () => void;
  onDefer: () => void;
}

function TaskCard({ task, index, isExpanded, onToggleExpand, onComplete, onSkip, onDefer }: TaskCardProps) {
  const typeConfig = TASK_TYPE_CONFIG[task.itemType] || TASK_TYPE_CONFIG.mcq;
  const modeConfig = MODE_BADGES[task.mode] || MODE_BADGES.practice;

  return (
    <Card className="transition-all hover:shadow-md">
      <CardContent className="p-4">
        {/* Main Row */}
        <div className="flex items-start gap-4">
          {/* Index */}
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold text-sm">
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
            <h4 className="font-medium text-sm mb-1">{task.skillName}</h4>

            {/* Unit */}
            <p className="text-xs text-muted-foreground">{task.unitName}</p>

            {/* Reason (why this task) */}
            <p className="text-xs text-muted-foreground mt-1 italic">{task.reason}</p>
          </div>

          {/* Actions */}
          <div className="flex-shrink-0 flex items-center gap-2">
            <Button size="sm" onClick={onComplete}>
              Start
            </Button>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={onToggleExpand}
            >
              {isExpanded ? '▲' : '▼'}
            </Button>
          </div>
        </div>

        {/* Expanded Details */}
        {isExpanded && (
          <div className="mt-4 pt-4 border-t">
            <h5 className="text-sm font-medium mb-2">Why this task?</h5>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2 bg-muted rounded">
                <div className="text-muted-foreground">Learning Gain</div>
                <div className="font-medium">{(task.scoringFactors.learningGain * 100).toFixed(0)}%</div>
              </div>
              <div className="p-2 bg-muted rounded">
                <div className="text-muted-foreground">Retention</div>
                <div className="font-medium">{(task.scoringFactors.retentionGain * 100).toFixed(0)}%</div>
              </div>
              <div className="p-2 bg-muted rounded">
                <div className="text-muted-foreground">Exam ROI</div>
                <div className="font-medium">{(task.scoringFactors.examRoi * 100).toFixed(0)}%</div>
              </div>
              <div className="p-2 bg-muted rounded">
                <div className="text-muted-foreground">Error Closure</div>
                <div className="font-medium">{(task.scoringFactors.errorClosure * 100).toFixed(0)}%</div>
              </div>
            </div>
            
            {/* Task Actions */}
            <div className="flex gap-2 mt-4">
              <Button size="sm" variant="outline" onClick={onSkip}>
                Skip
              </Button>
              <Button size="sm" variant="outline" onClick={onDefer}>
                Do Later
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================
// COMPLETED TASK CARD
// ============================================

function CompletedTaskCard({ task }: { task: PlanTask }) {
  const typeConfig = TASK_TYPE_CONFIG[task.itemType] || TASK_TYPE_CONFIG.mcq;

  return (
    <Card className="opacity-70">
      <CardContent className="p-4">
        <div className="flex items-center gap-4">
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-green-500 text-white flex items-center justify-center">
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
    <Card className="opacity-50">
      <CardContent className="p-4">
        <div className="flex items-center gap-4">
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-muted text-muted-foreground flex items-center justify-center">
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
