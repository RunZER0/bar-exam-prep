'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Badge } from '@/components/ui/badge';
import { Loader2, Zap, BookOpen, AlertCircle, PlayCircle, CheckCircle2, BarChart3, Target, ArrowLeft, GraduationCap } from 'lucide-react';
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
    };
}

type TabId = 'plan' | 'readiness' | 'practice';

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
    
    // Active task state — can be MasteryCarousel (SYLLABUS) or EmbeddedPracticePanel (WITNESS / practice)
    const [activeTask, setActiveTask] = useState<OrchestratedTask | null>(null);
    const [activePractice, setActivePractice] = useState<PracticeTask | null>(null);

    // Fetch the queue — uses prefetch cache if available (instant), else fetches live
    const fetchQueue = useCallback(async (skipCache = false) => {
        try {
            // Check prefetch cache first (populated by autonomous-preload on login)
            if (!skipCache) {
                const cached = getCachedData<DailyQueue>('mastery:plan');
                if (cached) {
                    console.log('[MasteryHub] Using prefetched plan data (instant load)');
                    setQueueData(cached);
                    setLoading(false);
                    return;
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
        setActiveTask(null);
        // Remove from queue locally
        setQueueData(prev => {
            if (!prev) return null;
            return {
                ...prev,
                queue: prev.queue.filter(t => t.data.id !== activeTask?.data.id)
            };
        });
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
            {/* Hero Header */}
            <div className="relative overflow-hidden border-b border-border/40">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/3 dark:from-primary/10 dark:to-primary/5" />
                <div className="absolute top-0 right-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
                
                <div className="relative max-w-5xl mx-auto px-4 py-8">
                    <div className="flex flex-col md:flex-row md:items-center gap-6">
                        {/* Left: Title + Meta */}
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                                    <GraduationCap className="h-5 w-5 text-primary" />
                                </div>
                                <div>
                                    <h1 className="text-2xl font-bold tracking-tight text-foreground">
                                        Mastery Hub
                                    </h1>
                                    <p className="text-sm text-muted-foreground">
                                        {queueData?.meta.termFocus || "Your adaptive learning command center"}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Right: Mastery Ring */}
                        {queueData?.meta?.totalSkills && (
                            <div className="flex items-center gap-4">
                                <div className="relative w-24 h-24">
                                    <svg className="w-24 h-24 -rotate-90" viewBox="0 0 100 100">
                                        <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" strokeWidth="6" className="text-border/50" />
                                        <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round"
                                            className="text-primary transition-all duration-1000 ease-out"
                                            strokeDasharray={circumference} strokeDashoffset={strokeDashoffset} />
                                    </svg>
                                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                                        <span className="text-xl font-bold">{masteryPercent}%</span>
                                        <span className="text-[10px] text-muted-foreground">mastery</span>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-sm font-medium">
                                        {queueData.meta.masteredSkills || 0} / {queueData.meta.totalSkills}
                                    </div>
                                    <div className="text-xs text-muted-foreground">skills verified</div>
                                    <Badge variant="secondary" className="mt-1 text-[10px]">
                                        {queueData.queue.length} tasks today
                                    </Badge>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Tab Navigation */}
            <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-lg border-b border-border/40">
                <div className="max-w-5xl mx-auto px-4">
                    <div className="flex gap-1">
                        {TABS.map(tab => {
                            const Icon = tab.icon;
                            const isActive = activeTab === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`relative flex items-center gap-2 px-5 py-3.5 text-sm font-medium transition-colors ${
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
            <div className="max-w-5xl mx-auto px-4 py-6">
                {/* ====== TAB: TODAY'S PLAN ====== */}
                {activeTab === 'plan' && (
                    <div className="space-y-6 stagger-children">
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
                                {/* Daily Stats Bar */}
                                <div className="grid grid-cols-3 gap-3">
                                    <div className="glass-card p-4">
                                        <div className="flex items-center gap-2 mb-2">
                                            <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                                                <Zap className="h-3.5 w-3.5 text-primary" />
                                            </div>
                                            <span className="text-xs text-muted-foreground font-medium">Focus</span>
                                        </div>
                                        <div className="text-lg font-bold truncate">{queueData?.meta.termFocus || "Foundation"}</div>
                                    </div>
                                    <div className="glass-card p-4">
                                        <div className="flex items-center gap-2 mb-2">
                                            <div className="w-7 h-7 rounded-lg bg-amber-500/10 flex items-center justify-center">
                                                <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
                                            </div>
                                            <span className="text-xs text-muted-foreground font-medium">Weaknesses</span>
                                        </div>
                                        <div className="text-lg font-bold text-amber-600 dark:text-amber-400">{queueData?.meta.witnessCount ?? 0}</div>
                                    </div>
                                    <div className="glass-card p-4">
                                        <div className="flex items-center gap-2 mb-2">
                                            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                                                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                                            </div>
                                            <span className="text-xs text-muted-foreground font-medium">Pacing</span>
                                        </div>
                                        <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{queueData?.meta.pacing || "On Track"}</div>
                                    </div>
                                </div>

                                {/* Execution Queue */}
                                <div>
                                    <div className="flex items-center gap-2 mb-4">
                                        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                                            Today&apos;s Queue
                                        </h2>
                                        <span className="text-xs text-muted-foreground">({queueData?.queue.length || 0})</span>
                                    </div>
                                    
                                    {(!queueData?.queue || queueData.queue.length === 0) ? (
                                        <div className="glass-card p-8 text-center">
                                            <div className="w-14 h-14 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-3">
                                                <CheckCircle2 className="h-7 w-7 text-emerald-500" />
                                            </div>
                                            <h3 className="font-semibold mb-1">All Clear</h3>
                                            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                                                You&apos;ve completed today&apos;s objectives. Check your{' '}
                                                <button onClick={() => setActiveTab('readiness')} className="text-primary font-medium hover:underline">Readiness</button>
                                                {' '}or start a{' '}
                                                <button onClick={() => setActiveTab('practice')} className="text-primary font-medium hover:underline">free practice</button>
                                                {' '}session.
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            {queueData.queue.map((task, idx) => (
                                                <button
                                                    key={idx}
                                                    onClick={() => handleStartTask(task)}
                                                    className={`w-full text-left group rounded-xl border transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 ${
                                                        task.type === 'WITNESS'
                                                            ? 'border-red-200/60 dark:border-red-900/40 bg-red-50/30 dark:bg-red-950/10 hover:border-red-300 dark:hover:border-red-800'
                                                            : 'border-border/60 bg-card hover:border-primary/30'
                                                    }`}
                                                >
                                                    <div className="flex items-center gap-4 p-4">
                                                        {/* Index */}
                                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                                                            task.type === 'WITNESS'
                                                                ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                                                                : 'bg-primary/10 text-primary'
                                                        }`}>
                                                            {idx + 1}
                                                        </div>
                                                        
                                                        {/* Content */}
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-2 mb-0.5">
                                                                {task.type === 'WITNESS' && (
                                                                    <span className="inline-flex items-center text-[10px] font-semibold text-red-600 dark:text-red-400 uppercase tracking-wider">
                                                                        <AlertCircle className="h-3 w-3 mr-1" /> Weakness
                                                                    </span>
                                                                )}
                                                                {task.type === 'SYLLABUS' && (
                                                                    <span className="text-[10px] font-semibold text-primary uppercase tracking-wider">Syllabus</span>
                                                                )}
                                                                <span className="text-[10px] text-muted-foreground font-mono">{task.data.unitId || "General"}</span>
                                                            </div>
                                                            <h3 className="font-medium text-sm text-foreground truncate">{task.data.title}</h3>
                                                            <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                                                                {task.data.description || "Mastery verification required"}
                                                            </p>
                                                        </div>
                                                        
                                                        {/* Arrow */}
                                                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <PlayCircle className="h-4 w-4 text-primary" />
                                                        </div>
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Quick Access */}
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2">
                                    {[
                                        { label: 'Readiness', icon: BarChart3, onClick: () => setActiveTab('readiness'), color: 'text-blue-500' },
                                        { label: 'Practice', icon: Target, onClick: () => setActiveTab('practice'), color: 'text-emerald-500' },
                                        { label: 'Study Notes', icon: BookOpen, href: '/study', color: 'text-amber-500' },
                                        { label: 'Mock Exams', icon: AlertCircle, href: '/exams', color: 'text-purple-500' },
                                    ].map((item) => {
                                        const Icon = item.icon;
                                        const inner = (
                                            <div className="glass-card p-4 flex flex-col items-center gap-2 cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 group">
                                                <Icon className={`h-5 w-5 ${item.color} group-hover:scale-110 transition-transform`} />
                                                <span className="text-xs font-medium text-muted-foreground group-hover:text-foreground transition-colors">{item.label}</span>
                                            </div>
                                        );
                                        return item.href
                                            ? <Link key={item.label} href={item.href}>{inner}</Link>
                                            : <div key={item.label} onClick={item.onClick}>{inner}</div>;
                                    })}
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
