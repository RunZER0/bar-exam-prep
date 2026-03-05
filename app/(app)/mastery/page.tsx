'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Zap, BookOpen, PlayCircle, CheckCircle2, BarChart3, Target, ArrowLeft, GraduationCap, ChevronRight, ChevronDown, Smile, Meh, Frown, ArrowRight, RotateCcw, Sparkles } from 'lucide-react';
import MasteryCarousel from '@/components/MasteryCarousel';
import ReadinessDashboard from '@/components/ReadinessDashboard';
import EmbeddedPracticePanel, { type PracticeTask } from '@/components/EmbeddedPracticePanel';
import EngagingLoader from '@/components/EngagingLoader';
import { getCachedData, setCachedData, invalidateMasteryCache } from '@/lib/services/autonomous-preload';
import Link from 'next/link';

// Types to match MasteryOrchestrator output
interface OrchestratedTask {
    type: 'SYLLABUS' | 'WITNESS';
    priority: string;
    data: {
        id: string; // skillId or witnessId
        title: string;
        description?: string;
        unitId?: string;
        unitName?: string;
        severityWeight?: number;
    };
}

interface DailyQueue {
    date: string;
    queue: OrchestratedTask[];
    practiceItems?: PracticeTask[];
    meta: {
        termFocus: string;
        witnessCount: number;
        pacing: string;
        totalSkills?: number;
        masteredSkills?: number;
        totalBacklog?: number;
        cappedAt?: number;
        focusUnits?: string[];
    };
}

type TabId = 'plan' | 'readiness' | 'practice';

/** Get today's date in EAT (UTC+3) for cache comparison */
function getEATToday(): string {
    const now = new Date();
    const eatMs = now.getTime() + (3 * 60 * 60 * 1000);
    return new Date(eatMs).toISOString().split('T')[0];
}

const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
    { id: 'plan', label: "Today's Plan", icon: Zap },
    { id: 'readiness', label: 'Readiness', icon: BarChart3 },
    { id: 'practice', label: 'Practice', icon: Target },
];

export default function MasteryPage() {
    const { getIdToken } = useAuth();
    const [queueData, setQueueData] = useState<DailyQueue | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<TabId>('plan');
    const [showFullList, setShowFullList] = useState(false);
    
    // Post-session feedback
    const [showFeedback, setShowFeedback] = useState(false);
    const [feedbackMood, setFeedbackMood] = useState<'great' | 'okay' | 'tough' | null>(null);
    const [lastCompletedTask, setLastCompletedTask] = useState<OrchestratedTask | null>(null);
    
    // Active task state — can be MasteryCarousel (SYLLABUS) or EmbeddedPracticePanel (WITNESS / practice)
    const [activeTask, setActiveTask] = useState<OrchestratedTask | null>(null);
    const [activePractice, setActivePractice] = useState<PracticeTask | null>(null);

    // Fetch the queue — uses prefetch cache if available (instant), else fetches live
    // Invalidates cache if the cached date doesn't match today (EAT)
    const fetchQueue = useCallback(async (skipCache = false) => {
        try {
            const today = getEATToday();
            
            // Check prefetch cache first — but invalidate if stale (different day)
            if (!skipCache) {
                const cached = getCachedData<DailyQueue>('mastery:plan');
                if (cached) {
                    if (cached.date === today) {
                        console.log('[MasteryHub] Using prefetched plan data (same day, instant load)');
                        setQueueData(cached);
                        setLoading(false);
                        return;
                    } else {
                        console.log(`[MasteryHub] Cache stale (cached: ${cached.date}, today: ${today}) — fetching fresh`);
                        invalidateMasteryCache();
                    }
                }
            }

            setLoading(true);
            const token = await getIdToken();
            if (!token) return;
            
            const res = await fetch('/api/mastery/plan', {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setQueueData(data);
                // Cache for future navigations
                setCachedData('mastery:plan', data, 10 * 60 * 1000);
            }
        } catch (e) {
            console.error("Failed to load queue", e);
        } finally {
            setLoading(false);
        }
    }, [getIdToken]);

    useEffect(() => {
        fetchQueue();
    }, [fetchQueue]);

    const handleStartTask = (task: OrchestratedTask) => {
        if (task.type === 'WITNESS') {
            // WITNESS tasks use the embedded practice panel
            const practiceTask: PracticeTask = {
                id: task.data.id,
                skillId: task.data.id,
                skillName: task.data.title,
                unitId: task.data.unitId || 'general',
                unitName: task.data.unitName || task.data.unitId || 'General',
                itemType: 'written',
                mode: 'practice',
                reason: task.data.description || `Weakness detected (severity: ${task.data.severityWeight || 'unknown'})`,
            };
            setActivePractice(practiceTask);
        } else {
            // SYLLABUS tasks use the carousel (narrative → exhibit → assessment)
            setActiveTask(task);
        }
    };

    const handleStartPractice = (task: PracticeTask) => {
        setActivePractice(task);
        setActiveTab('plan'); // Switch to plan view to show the practice inline
    };

    const handleCarouselComplete = () => {
        setLastCompletedTask(activeTask);
        setActiveTask(null);
        setFeedbackMood(null);
        setShowFeedback(true);
        // Remove from queue locally
        setQueueData(prev => {
            if (!prev) return null;
            return {
                ...prev,
                queue: prev.queue.filter(t => t.data.id !== activeTask?.data.id)
            };
        });
    };

    const handleFeedbackDone = (continueStudying: boolean) => {
        setShowFeedback(false);
        if (continueStudying && queueData?.queue && queueData.queue.length > 0) {
            // Start the next task automatically
            handleStartTask(queueData.queue[0]);
        }
    };

    const handlePracticeComplete = () => {
        setActivePractice(null);
        // Invalidate cache and fetch fresh data after mastery update
        invalidateMasteryCache();
        fetchQueue(true);
    };

    // ------- ACTIVE CAROUSEL VIEW -------
    if (activeTask) {
        return (
            <div className="min-h-screen bg-background">
                <div className="max-w-4xl mx-auto px-4 py-6">
                    <button 
                        onClick={() => setActiveTask(null)}
                        className="group flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
                    >
                        <ArrowLeft className="h-4 w-4 group-hover:-translate-x-0.5 transition-transform" />
                        Back to Mastery Hub
                    </button>
                    <MasteryCarousel task={activeTask} onComplete={handleCarouselComplete} />
                </div>
            </div>
        );
    }

    // ------- POST-SESSION FEEDBACK -------
    if (showFeedback) {
        const remainingCount = queueData?.queue?.length || 0;
        return (
            <div className="min-h-screen bg-background flex items-center justify-center px-4">
                <div className="max-w-sm w-full text-center animate-in fade-in scale-in duration-300">
                    {/* Completion checkmark */}
                    <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-5">
                        <Sparkles className="h-8 w-8 text-emerald-500" />
                    </div>
                    
                    <h2 className="text-xl font-bold text-foreground mb-1">Session Complete</h2>
                    <p className="text-sm text-muted-foreground mb-6">
                        {lastCompletedTask?.data.title?.split(': ').pop() || 'Great work!'} — done.
                    </p>

                    {/* Mood question */}
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">How did that feel?</p>
                    <div className="flex justify-center gap-3 mb-8">
                        {([
                            { mood: 'great' as const, icon: Smile, label: 'Great', color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/30' },
                            { mood: 'okay' as const, icon: Meh, label: 'Okay', color: 'text-amber-500 bg-amber-500/10 border-amber-500/30' },
                            { mood: 'tough' as const, icon: Frown, label: 'Tough', color: 'text-red-400 bg-red-500/10 border-red-500/30' },
                        ]).map(({ mood, icon: Icon, label, color }) => (
                            <button
                                key={mood}
                                onClick={() => setFeedbackMood(mood)}
                                className={`flex flex-col items-center gap-1.5 px-5 py-3 rounded-xl border-2 transition-all duration-200 ${
                                    feedbackMood === mood
                                        ? color + ' scale-105 shadow-sm'
                                        : 'border-border/50 text-muted-foreground hover:border-border hover:text-foreground'
                                }`}
                            >
                                <Icon className="h-6 w-6" />
                                <span className="text-xs font-medium">{label}</span>
                            </button>
                        ))}
                    </div>

                    {/* Action buttons */}
                    <div className="space-y-2.5">
                        {remainingCount > 0 ? (
                            <>
                                <button
                                    onClick={() => handleFeedbackDone(true)}
                                    className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 transition-colors"
                                >
                                    <ArrowRight className="h-4 w-4" />
                                    Continue — {remainingCount} task{remainingCount > 1 ? 's' : ''} left
                                </button>
                                <button
                                    onClick={() => handleFeedbackDone(false)}
                                    className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-border/50 text-muted-foreground font-medium text-sm hover:text-foreground hover:bg-muted/50 transition-colors"
                                >
                                    Take a break
                                </button>
                            </>
                        ) : (
                            <button
                                onClick={() => handleFeedbackDone(false)}
                                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 transition-colors"
                            >
                                <CheckCircle2 className="h-4 w-4" />
                                Done for today
                            </button>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    // ------- LOADING -------
    if (loading) {
        return <EngagingLoader size="lg" message="Preparing your personalized study plan..." />;
    }

    const masteryPercent = queueData?.meta?.totalSkills
        ? Math.round(((queueData.meta.masteredSkills || 0) / queueData.meta.totalSkills) * 100)
        : 0;
    const circumference = 2 * Math.PI * 40;
    const strokeDashoffset = circumference - (masteryPercent / 100) * circumference;

    return (
        <div className="min-h-screen bg-background">
            {/* Compact Header */}
            <div className="border-b border-border/40 bg-card/50">
                <div className="max-w-4xl mx-auto px-4 py-5">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                                <GraduationCap className="h-4.5 w-4.5 text-primary" />
                            </div>
                            <div>
                                <h1 className="text-lg font-semibold text-foreground">Mastery Hub</h1>
                                <p className="text-xs text-muted-foreground">
                                    {queueData?.meta.termFocus || "Your personalized study plan"}
                                </p>
                            </div>
                        </div>
                        
                        {/* Compact Progress */}
                        {queueData?.meta?.totalSkills && (
                            <div className="flex items-center gap-3">
                                <div className="relative w-12 h-12">
                                    <svg className="w-12 h-12 -rotate-90" viewBox="0 0 100 100">
                                        <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" strokeWidth="8" className="text-border/40" />
                                        <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" strokeWidth="8" strokeLinecap="round"
                                            className="text-primary transition-all duration-1000 ease-out"
                                            strokeDasharray={circumference} strokeDashoffset={strokeDashoffset} />
                                    </svg>
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <span className="text-xs font-bold">{masteryPercent}%</span>
                                    </div>
                                </div>
                                <div className="hidden sm:block text-right">
                                    <div className="text-xs font-medium">{queueData.meta.masteredSkills || 0}/{queueData.meta.totalSkills} topics</div>
                                    <div className="text-[10px] text-muted-foreground">
                                        {queueData.queue.length} task{queueData.queue.length !== 1 ? 's' : ''} today
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Tab Navigation */}
            <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-lg border-b border-border/40">
                <div className="max-w-4xl mx-auto px-4">
                    <div className="flex gap-1">
                        {TABS.map(tab => {
                            const Icon = tab.icon;
                            const isActive = activeTab === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`relative flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
                                        isActive
                                            ? 'text-primary'
                                            : 'text-muted-foreground hover:text-foreground'
                                    }`}
                                >
                                    <Icon className="h-4 w-4" />
                                    {tab.label}
                                    {isActive && (
                                        <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-primary rounded-full" />
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="max-w-4xl mx-auto px-4 py-5">
                {/* ====== TAB: TODAY'S PLAN ====== */}
                {activeTab === 'plan' && (
                    <div className="space-y-5">
                        {/* Active Practice Panel (inline) */}
                        {activePractice && (
                            <EmbeddedPracticePanel
                                task={activePractice}
                                onComplete={handlePracticeComplete}
                                onClose={() => setActivePractice(null)}
                            />
                        )}

                        {!activePractice && (
                            <>
                                {/* Task Queue - Clean list */}
                                {(!queueData?.queue || queueData.queue.length === 0) ? (
                                    <div className="rounded-xl border border-border/50 bg-card p-8 text-center">
                                        <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-3">
                                            <CheckCircle2 className="h-6 w-6 text-emerald-500" />
                                        </div>
                                        <h3 className="font-semibold mb-1 text-sm">All done for today</h3>
                                        <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                                            Great work! Check your{' '}
                                            <button onClick={() => setActiveTab('readiness')} className="text-primary font-medium hover:underline">progress</button>
                                            {' '}or start{' '}
                                            <button onClick={() => setActiveTab('practice')} className="text-primary font-medium hover:underline">free practice</button>.
                                        </p>
                                    </div>
                                ) : (
                                    <div className="space-y-1.5">
                                        <div className="flex items-center justify-between mb-2">
                                            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                                Today&apos;s Focus
                                            </h2>
                                            <div className="flex items-center gap-2">
                                                {queueData.meta.focusUnits && queueData.meta.focusUnits.length > 0 && (
                                                    <span className="text-[10px] text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                                                        {queueData.meta.focusUnits.length} unit{queueData.meta.focusUnits.length > 1 ? 's' : ''}
                                                    </span>
                                                )}
                                                {(queueData.meta.totalBacklog ?? 0) > queueData.queue.length && (
                                                    <span className="text-[10px] text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 px-2 py-0.5 rounded-full">
                                                        +{(queueData.meta.totalBacklog ?? 0) - queueData.queue.length} in backlog
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Focus Unit Chips */}
                                        {queueData.meta.focusUnits && queueData.meta.focusUnits.length > 0 && (
                                            <div className="flex flex-wrap gap-1.5 mb-3">
                                                {queueData.meta.focusUnits.map(u => (
                                                    <span key={u} className="text-[11px] font-medium text-foreground/70 bg-muted px-2.5 py-1 rounded-lg">
                                                        {u}
                                                    </span>
                                                ))}
                                            </div>
                                        )}

                                        {/* Top 3 « Start Here » tasks */}
                                        {queueData.queue.slice(0, 3).map((task, idx) => (
                                            <button
                                                key={idx}
                                                onClick={() => handleStartTask(task)}
                                                className={`w-full text-left group rounded-lg border transition-all duration-150 hover:shadow-sm ${
                                                    idx === 0
                                                        ? 'border-primary/40 bg-primary/5 hover:border-primary/60 ring-1 ring-primary/10'
                                                        : task.type === 'WITNESS'
                                                            ? 'border-amber-200/60 dark:border-amber-900/40 bg-amber-50/20 dark:bg-amber-950/10 hover:border-amber-300'
                                                            : 'border-border/50 bg-card hover:border-primary/30'
                                                }`}
                                            >
                                                <div className="flex items-center gap-3 px-3.5 py-3">
                                                    <div className={`w-7 h-7 rounded-md flex items-center justify-center text-[11px] font-semibold flex-shrink-0 ${
                                                        idx === 0
                                                            ? 'bg-primary text-primary-foreground'
                                                            : task.type === 'WITNESS'
                                                                ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                                                                : 'bg-primary/10 text-primary'
                                                    }`}>
                                                        {idx + 1}
                                                    </div>
                                                    
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-1.5 mb-0.5">
                                                            {idx === 0 && (
                                                                <span className="text-[10px] font-bold text-primary">
                                                                    Start here
                                                                </span>
                                                            )}
                                                            {idx !== 0 && task.type === 'WITNESS' && (
                                                                <span className="text-[10px] font-medium text-amber-600 dark:text-amber-400">
                                                                    Review
                                                                </span>
                                                            )}
                                                            {idx !== 0 && task.type === 'SYLLABUS' && (
                                                                <span className="text-[10px] font-medium text-primary">
                                                                    Learn
                                                                </span>
                                                            )}
                                                            <span className="text-[10px] text-muted-foreground">{task.data.unitName || task.data.unitId}</span>
                                                        </div>
                                                        <h3 className="font-medium text-sm text-foreground truncate">{task.data.title}</h3>
                                                    </div>
                                                    
                                                    <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary flex-shrink-0 transition-colors" />
                                                </div>
                                            </button>
                                        ))}

                                        {/* Show Full List toggle */}
                                        {queueData.queue.length > 3 && (
                                            <>
                                                <button
                                                    onClick={() => setShowFullList(!showFullList)}
                                                    className="w-full flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                                                >
                                                    <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showFullList ? 'rotate-180' : ''}`} />
                                                    {showFullList ? 'Show less' : `See full list (${queueData.queue.length - 3} more)`}
                                                </button>

                                                {showFullList && (
                                                    <div className="space-y-1.5 animate-in fade-in slide-in-from-top-2 duration-200">
                                                        {queueData.queue.slice(3).map((task, idx) => (
                                                            <button
                                                                key={idx + 3}
                                                                onClick={() => handleStartTask(task)}
                                                                className={`w-full text-left group rounded-lg border transition-all duration-150 hover:shadow-sm ${
                                                                    task.type === 'WITNESS'
                                                                        ? 'border-amber-200/60 dark:border-amber-900/40 bg-amber-50/20 dark:bg-amber-950/10 hover:border-amber-300'
                                                                        : 'border-border/50 bg-card hover:border-primary/30'
                                                                }`}
                                                            >
                                                                <div className="flex items-center gap-3 px-3.5 py-3">
                                                                    <div className={`w-7 h-7 rounded-md flex items-center justify-center text-[11px] font-semibold flex-shrink-0 ${
                                                                        task.type === 'WITNESS'
                                                                            ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                                                                            : 'bg-primary/10 text-primary'
                                                                    }`}>
                                                                        {idx + 4}
                                                                    </div>
                                                                    <div className="flex-1 min-w-0">
                                                                        <div className="flex items-center gap-1.5 mb-0.5">
                                                                            {task.type === 'WITNESS' && (
                                                                                <span className="text-[10px] font-medium text-amber-600 dark:text-amber-400">Review</span>
                                                                            )}
                                                                            {task.type === 'SYLLABUS' && (
                                                                                <span className="text-[10px] font-medium text-primary">Learn</span>
                                                                            )}
                                                                            <span className="text-[10px] text-muted-foreground">{task.data.unitName || task.data.unitId}</span>
                                                                        </div>
                                                                        <h3 className="font-medium text-sm text-foreground truncate">{task.data.title}</h3>
                                                                    </div>
                                                                    <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary flex-shrink-0 transition-colors" />
                                                                </div>
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}
                                            </>
                                        )}
                                    </div>
                                )}

                                {/* Compact Quick Links */}
                                <div className="flex gap-2 pt-1">
                                    <Link href="/study" className="flex-1 flex items-center gap-2 px-3 py-2.5 rounded-lg border border-border/40 bg-card hover:border-primary/30 hover:bg-primary/5 transition-all text-sm text-muted-foreground hover:text-foreground">
                                        <BookOpen className="h-4 w-4 text-primary/60" />
                                        <span className="text-xs font-medium">Study Notes</span>
                                    </Link>
                                    <button onClick={() => setActiveTab('practice')} className="flex-1 flex items-center gap-2 px-3 py-2.5 rounded-lg border border-border/40 bg-card hover:border-primary/30 hover:bg-primary/5 transition-all text-sm text-muted-foreground hover:text-foreground">
                                        <Target className="h-4 w-4 text-primary/60" />
                                        <span className="text-xs font-medium">Practice</span>
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                )}

                {/* ====== TAB: READINESS ====== */}
                {activeTab === 'readiness' && (
                    <ReadinessDashboard />
                )}

                {/* ====== TAB: PRACTICE ====== */}
                {activeTab === 'practice' && (
                    <PracticePickerView
                        queueData={queueData}
                        onStartPractice={handleStartPractice}
                    />
                )}
            </div>
        </div>
    );
}

// ------- PRACTICE PICKER SUB-COMPONENT -------
function PracticePickerView({ 
    queueData, 
    onStartPractice 
}: { 
    queueData: DailyQueue | null;
    onStartPractice: (task: PracticeTask) => void;
}) {
    const { getIdToken } = useAuth();
    const [skills, setSkills] = useState<Array<{
        skillId: string;
        skillName: string;
        unitId: string;
        unitName: string;
        pMastery: number;
    }>>([]);
    const [loadingSkills, setLoadingSkills] = useState(true);
    const [selectedFormat, setSelectedFormat] = useState<'written' | 'mcq' | 'short_answer'>('written');

    useEffect(() => {
        const fetchSkills = async () => {
            try {
                const token = await getIdToken();
                const res = await fetch('/api/mastery/readiness?skills=true&allUnits=true', {
                    headers: { Authorization: `Bearer ${token}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    if (data.allSkills) {
                        setSkills(data.allSkills);
                    } else if (data.units) {
                        const flatSkills = data.units.flatMap((u: { unitId: string; unitName: string; skills?: Array<{ skillId: string; skillName: string; pMastery: number }> }) =>
                            (u.skills || []).map((s: { skillId: string; skillName: string; pMastery: number }) => ({
                                ...s,
                                unitId: u.unitId,
                                unitName: u.unitName,
                            }))
                        );
                        setSkills(flatSkills);
                    }
                }
            } catch (e) {
                console.error("Failed to load skills for practice picker", e);
            } finally {
                setLoadingSkills(false);
            }
        };
        fetchSkills();
    }, [getIdToken]);

    const practiceItems = queueData?.practiceItems || [];

    return (
        <div className="space-y-6 stagger-children">
            {/* Header */}
            <div>
                <h2 className="text-lg font-semibold">Free Practice</h2>
                <p className="text-sm text-muted-foreground mt-1">
                    Pick any skill to practice. Items are AI-generated and graded against real rubrics.
                </p>
            </div>

            {/* Format selector */}
            <div className="flex gap-2">
                {([
                    { value: 'written' as const, label: 'Written', icon: '✍️' },
                    { value: 'mcq' as const, label: 'MCQ', icon: '📋' },
                    { value: 'short_answer' as const, label: 'Short Answer', icon: '💬' },
                ]).map(fmt => (
                    <button
                        key={fmt.value}
                        onClick={() => setSelectedFormat(fmt.value)}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                            selectedFormat === fmt.value
                                ? 'bg-primary text-primary-foreground shadow-sm'
                                : 'bg-secondary/50 text-muted-foreground hover:bg-secondary hover:text-foreground'
                        }`}
                    >
                        <span>{fmt.icon}</span>
                        {fmt.label}
                    </button>
                ))}
            </div>

            {/* AI Recommended */}
            {practiceItems.length > 0 && (
                <div className="space-y-2">
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Recommended by AI</h3>
                    {practiceItems.map((item, idx) => (
                        <button 
                            key={idx} 
                            onClick={() => onStartPractice(item)}
                            className="w-full text-left glass-card p-4 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 group"
                        >
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                                    <Zap className="h-4 w-4 text-primary" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="font-medium text-sm">{item.skillName}</div>
                                    <div className="text-xs text-muted-foreground">{item.unitName} &middot; {item.itemType}</div>
                                </div>
                                <PlayCircle className="h-5 w-5 text-primary opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                            </div>
                        </button>
                    ))}
                </div>
            )}

            {/* All skills picker */}
            {loadingSkills ? (
                <EngagingLoader size="sm" message="Loading skills..." />
            ) : skills.length > 0 ? (
                <div className="space-y-3">
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">All Skills ({skills.length})</h3>
                    <div className="grid gap-1.5 max-h-[60vh] overflow-y-auto pr-1 no-scrollbar">
                        {skills
                            .sort((a, b) => a.pMastery - b.pMastery)
                            .map((skill) => (
                                <button
                                    key={skill.skillId}
                                    onClick={() => onStartPractice({
                                        id: skill.skillId,
                                        skillId: skill.skillId,
                                        skillName: skill.skillName,
                                        unitId: skill.unitId,
                                        unitName: skill.unitName,
                                        itemType: selectedFormat,
                                        mode: 'practice',
                                    })}
                                    className="w-full text-left flex items-center gap-3 p-3 rounded-xl border border-border/40 bg-card hover:border-primary/30 hover:shadow-sm transition-all group"
                                >
                                    {/* Mastery indicator */}
                                    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0 ring-2 ${
                                        skill.pMastery >= 0.8
                                            ? 'bg-emerald-50 text-emerald-600 ring-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:ring-emerald-800'
                                            : skill.pMastery >= 0.5
                                            ? 'bg-amber-50 text-amber-600 ring-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:ring-amber-800'
                                            : 'bg-red-50 text-red-600 ring-red-200 dark:bg-red-950/30 dark:text-red-400 dark:ring-red-800'
                                    }`}>
                                        {Math.round(skill.pMastery * 100)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="font-medium text-sm truncate">{skill.skillName}</div>
                                        <div className="text-[11px] text-muted-foreground">{skill.unitName}</div>
                                    </div>
                                    <PlayCircle className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary transition-colors flex-shrink-0" />
                                </button>
                            ))}
                    </div>
                </div>
            ) : (
                <div className="glass-card p-8 text-center">
                    <Target className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
                    <h3 className="font-semibold mb-1">Start from Today&apos;s Plan</h3>
                    <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                        Complete tasks from your daily queue to unlock skill-level practice.
                    </p>
                </div>
            )}
        </div>
    );
}
