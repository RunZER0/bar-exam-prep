'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useSidebar } from '@/contexts/SidebarContext';
import { Zap, BookOpen, PlayCircle, CheckCircle2, BarChart3, ArrowLeft, ChevronRight, ChevronDown, Smile, Meh, Frown, ArrowRight, RotateCcw, Sparkles, Compass, FileText, Lightbulb, ClipboardCheck, PenTool } from 'lucide-react';
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

type TabId = 'plan' | 'readiness' | 'recommendations';

/** Get today's date in EAT (UTC+3) for cache comparison */
function getEATToday(): string {
    const now = new Date();
    const eatMs = now.getTime() + (3 * 60 * 60 * 1000);
    return new Date(eatMs).toISOString().split('T')[0];
}

const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
    { id: 'plan', label: "Today's Plan", icon: Zap },
    { id: 'readiness', label: 'Readiness', icon: BarChart3 },
    { id: 'recommendations', label: 'Explore', icon: Compass },
];

export default function MasteryPage() {
    const { getIdToken, user } = useAuth();
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
    const { setCollapsed } = useSidebar();
    const sidebarWasCollapsed = useRef<boolean | null>(null); // null = not yet initialized
    const prevActiveTask = useRef<OrchestratedTask | null>(null);

    // Auto-collapse sidebar when entering study notes, restore on exit
    useEffect(() => {
        const entering = activeTask && !prevActiveTask.current;
        const leaving = !activeTask && prevActiveTask.current;
        
        if (entering) {
            // Remember sidebar state BEFORE we collapse it
            sidebarWasCollapsed.current = localStorage.getItem('sidebar-collapsed') === 'true';
            setCollapsed(true);
        } else if (leaving && sidebarWasCollapsed.current === false) {
            // Only restore if sidebar was expanded before we collapsed it
            setCollapsed(false);
        }
        
        prevActiveTask.current = activeTask;
    }, [activeTask, setCollapsed]);

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
            <div className="min-h-screen bg-background animate-content-enter">
                <div className="max-w-7xl mx-auto px-2 sm:px-4 py-3">
                    <button 
                        onClick={() => setActiveTask(null)}
                        className="group flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-3 transition-colors"
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
        <div className="min-h-screen bg-background animate-content-enter">
            {/* Header with greeting */}
            <div className="border-b border-border/40 bg-card/50">
                <div className="max-w-6xl mx-auto px-4 py-5">
                    {/* Personalized greeting */}
                    <div className="mb-4">
                        <h1 className="text-xl md:text-2xl font-bold text-foreground">
                            {(() => {
                                const hour = new Date().getHours();
                                let timeGreeting = 'Good morning';
                                if (hour >= 12 && hour < 17) timeGreeting = 'Good afternoon';
                                else if (hour >= 17 && hour < 21) timeGreeting = 'Good evening';
                                else if (hour >= 21 || hour < 5) timeGreeting = 'Burning the midnight oil';
                                return timeGreeting;
                            })()}, {user?.displayName?.split(' ')[0] || 'Counsel'}
                        </h1>
                        <p className="text-sm text-muted-foreground mt-0.5">
                            Continue your bar exam preparation journey.
                        </p>
                    </div>

                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-lg bg-zinc-900 dark:bg-zinc-800 flex items-center justify-center">
                                <span className="text-lg leading-none">🎓</span>
                            </div>
                            <div>
                                <h2 className="text-lg font-semibold text-foreground">Mastery Hub</h2>
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
                <div className="max-w-6xl mx-auto px-4">
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
            <div className="max-w-6xl mx-auto px-4 py-5">
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
                                            {' '}or explore{' '}
                                            <button onClick={() => setActiveTab('recommendations')} className="text-primary font-medium hover:underline">recommendations</button>.
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
                                                        +{(queueData.meta.totalBacklog ?? 0) - queueData.queue.length} uncovered from previous weeks
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
                                                style={{ animationDelay: `${idx * 80}ms` }}
                                                className={`w-full text-left group rounded-lg border transition-all duration-150 hover:shadow-sm animate-slide-up-fade ${
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
                                                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-primary">
                                                                    <span className="animate-bounce-hand inline-block">👉</span>
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
                                    <button onClick={() => setActiveTab('recommendations')} className="flex-1 flex items-center gap-2 px-3 py-2.5 rounded-lg border border-border/40 bg-card hover:border-primary/30 hover:bg-primary/5 transition-all text-sm text-muted-foreground hover:text-foreground">
                                        <Compass className="h-4 w-4 text-primary/60" />
                                        <span className="text-xs font-medium">Explore</span>
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

                {/* ====== TAB: RECOMMENDATIONS ====== */}
                {activeTab === 'recommendations' && (
                    <RecommendationsView queueData={queueData} />
                )}
            </div>
        </div>
    );
}

// ------- RECOMMENDATIONS SUB-COMPONENT -------
function RecommendationsView({ queueData }: { queueData: DailyQueue | null }) {
    const masteryPct = queueData?.meta?.totalSkills
        ? Math.round(((queueData.meta.masteredSkills || 0) / queueData.meta.totalSkills) * 100)
        : 0;

    // Build contextual recommendations based on current mastery state
    const recommendations: {
        title: string;
        description: string;
        href: string;
        icon: React.ElementType;
        accent: string;
        tag?: string;
    }[] = [
        {
            title: 'Practice Legal Drafting',
            description: 'Draft affidavits, pleadings, and legal opinions with AI feedback on structure and citation.',
            href: '/drafting',
            icon: PenTool,
            accent: 'text-violet-600 dark:text-violet-400 bg-violet-500/8 border-violet-200/40 dark:border-violet-800/30',
            tag: masteryPct < 30 ? 'Start early' : 'Sharpen skills',
        },
        {
            title: 'Take Quizzes',
            description: 'Rapid-fire MCQs and trivia across all 9 units. Great for revision and spotting weak areas.',
            href: '/quizzes',
            icon: Lightbulb,
            accent: 'text-amber-600 dark:text-amber-400 bg-amber-500/8 border-amber-200/40 dark:border-amber-800/30',
            tag: 'Quick practice',
        },
        {
            title: 'Exam Simulations',
            description: 'Full timed exam papers under real conditions. Build stamina and time management.',
            href: '/exams',
            icon: ClipboardCheck,
            accent: 'text-rose-600 dark:text-rose-400 bg-rose-500/8 border-rose-200/40 dark:border-rose-800/30',
            tag: masteryPct >= 50 ? 'Ready for this' : 'When you\'re ready',
        },
        {
            title: 'Deep Study Notes',
            description: 'Browse comprehensive notes by topic. Read at your own pace with citation links.',
            href: '/study',
            icon: BookOpen,
            accent: 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/8 border-emerald-200/40 dark:border-emerald-800/30',
            tag: 'Self-paced',
        },
    ];

    return (
        <div className="space-y-5 stagger-children">
            {/* Header */}
            <div>
                <h2 className="text-lg font-semibold">Explore &amp; Practice</h2>
                <p className="text-sm text-muted-foreground mt-1">
                    The Mastery Hub guides your learning — use these sections for targeted practice.
                </p>
            </div>

            {/* Recommendation Cards — subtle, blended with background */}
            <div className="space-y-2.5">
                {recommendations.map((rec) => {
                    const Icon = rec.icon;
                    return (
                        <Link
                            key={rec.href}
                            href={rec.href}
                            className={`group flex items-start gap-3.5 p-4 rounded-xl border transition-all duration-200 hover:shadow-sm ${rec.accent}`}
                        >
                            <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 bg-current/[0.08]">
                                <Icon className="h-[18px] w-[18px]" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-0.5">
                                    <h3 className="font-medium text-sm text-foreground">{rec.title}</h3>
                                    {rec.tag && (
                                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                                            {rec.tag}
                                        </span>
                                    )}
                                </div>
                                <p className="text-xs text-muted-foreground leading-relaxed">{rec.description}</p>
                            </div>
                            <ChevronRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-foreground/50 mt-1 flex-shrink-0 transition-colors" />
                        </Link>
                    );
                })}
            </div>

            {/* Tip card */}
            <div className="rounded-xl border border-border/30 bg-muted/30 p-4">
                <div className="flex items-start gap-3">
                    <Sparkles className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                    <div>
                        <p className="text-xs font-medium text-foreground mb-1">How the Mastery Hub works</p>
                        <p className="text-[11px] text-muted-foreground leading-relaxed">
                            Your daily plan is generated automatically based on the KSL syllabus, your mastery levels, and spaced repetition.
                            Focus on your daily tasks first — then explore these sections for extra practice.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
