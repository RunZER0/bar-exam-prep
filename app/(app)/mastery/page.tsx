'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Zap, BookOpen, AlertCircle, PlayCircle, CheckCircle2, BarChart3, Target, ArrowLeft, GraduationCap } from 'lucide-react';
import MasteryCarousel from '@/components/MasteryCarousel';
import ReadinessDashboard from '@/components/ReadinessDashboard';
import EmbeddedPracticePanel, { type PracticeTask } from '@/components/EmbeddedPracticePanel';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
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

    // Fetch the queue (Integrated Execution Engine)
    const fetchQueue = useCallback(async () => {
        try {
            setLoading(true);
            const token = await getIdToken();
            if (!token) return;
            
            const res = await fetch('/api/mastery/plan', {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setQueueData(data);
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
        // Refresh the whole queue to pick up mastery updates
        fetchQueue();
    };

    // ------- ACTIVE CAROUSEL VIEW -------
    if (activeTask) {
        return (
            <div className="container mx-auto py-8">
                <Button variant="ghost" className="mb-4" onClick={() => setActiveTask(null)}>
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Mastery Hub
                </Button>
                <MasteryCarousel task={activeTask} onComplete={handleCarouselComplete} />
            </div>
        );
    }

    // ------- LOADING -------
    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <span className="ml-3 text-muted-foreground">Loading Mastery Hub...</span>
            </div>
        );
    }

    return (
        <div className="container mx-auto py-6 space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
                        <GraduationCap className="h-8 w-8 text-primary" />
                        Mastery Hub
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        {queueData?.meta.termFocus || "Your adaptive learning command center"}
                    </p>
                </div>
                {queueData?.meta && (
                    <div className="flex items-center gap-3 text-sm">
                        {queueData.meta.totalSkills && (
                            <Badge variant="outline" className="text-xs">
                                {queueData.meta.masteredSkills || 0}/{queueData.meta.totalSkills} skills mastered
                            </Badge>
                        )}
                        <Badge variant="secondary" className="text-xs">
                            {queueData.queue.length} tasks today
                        </Badge>
                    </div>
                )}
            </div>

            {/* Tabs */}
            <div className="flex border-b">
                {TABS.map(tab => {
                    const Icon = tab.icon;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                                activeTab === tab.id
                                    ? 'border-primary text-primary'
                                    : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30'
                            }`}
                        >
                            <Icon className="h-4 w-4" />
                            {tab.label}
                        </button>
                    );
                })}
            </div>

            {/* ====== TAB: TODAY'S PLAN ====== */}
            {activeTab === 'plan' && (
                <div className="space-y-6">
                    {/* Active Practice Panel (inline) */}
                    {activePractice && (
                        <div className="space-y-2">
                            <EmbeddedPracticePanel
                                task={activePractice}
                                onComplete={handlePracticeComplete}
                                onClose={() => setActivePractice(null)}
                            />
                        </div>
                    )}

                    {/* Daily Briefing Cards */}
                    {!activePractice && (
                        <>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <Card>
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-sm font-medium text-muted-foreground">Daily Focus</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="text-2xl font-bold">{queueData?.meta.termFocus || "Foundation"}</div>
                                        <p className="text-xs text-muted-foreground mt-1">Syllabus Progression</p>
                                    </CardContent>
                                </Card>
                                <Card>
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-sm font-medium text-muted-foreground">Active Witnesses</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="text-2xl font-bold text-amber-600">{queueData?.meta.witnessCount ?? 0}</div>
                                        <p className="text-xs text-muted-foreground mt-1">Latent Weaknesses Detected</p>
                                    </CardContent>
                                </Card>
                                <Card>
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-sm font-medium text-muted-foreground">Pacing</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="text-2xl font-bold text-green-600">{queueData?.meta.pacing || "On Track"}</div>
                                        <p className="text-xs text-muted-foreground mt-1">Optimal Flow</p>
                                    </CardContent>
                                </Card>
                            </div>

                            {/* The Integrated Queue */}
                            <div className="space-y-4">
                                <h2 className="text-xl font-semibold flex items-center gap-2">
                                    <Zap className="h-5 w-5 text-yellow-500" />
                                    Today&apos;s Execution Queue
                                </h2>
                                
                                {(!queueData?.queue || queueData.queue.length === 0) ? (
                                    <Alert className="bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800">
                                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                                        <AlertTitle>All Clear</AlertTitle>
                                        <AlertDescription>
                                            You&apos;ve completed today&apos;s objectives. Check your <button onClick={() => setActiveTab('readiness')} className="underline font-medium">Readiness</button> or start a <button onClick={() => setActiveTab('practice')} className="underline font-medium">free practice</button> session.
                                        </AlertDescription>
                                    </Alert>
                                ) : (
                                    <div className="grid gap-3">
                                        {queueData.queue.map((task, idx) => (
                                            <Card key={idx} className={`border-l-4 transition-all hover:shadow-md ${
                                                task.type === 'WITNESS' 
                                                    ? 'border-l-red-500 bg-red-50/5 dark:bg-red-950/10' 
                                                    : 'border-l-blue-500'
                                            }`}>
                                                <CardContent className="flex items-center justify-between p-5">
                                                    <div className="space-y-1 flex-1 min-w-0">
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            {task.type === 'WITNESS' && <Badge variant="destructive" className="text-xs">Weakness</Badge>}
                                                            {task.type === 'SYLLABUS' && <Badge className="text-xs">Syllabus</Badge>}
                                                            {task.priority === 'HIGH' && <Badge variant="outline" className="text-xs border-amber-500 text-amber-600">High Priority</Badge>}
                                                            <span className="text-xs font-mono text-muted-foreground">{task.data.unitId || "General"}</span>
                                                        </div>
                                                        <h3 className="font-semibold text-base truncate">{task.data.title}</h3>
                                                        <p className="text-sm text-muted-foreground line-clamp-1">
                                                            {task.data.description || "Mastery verification required."}
                                                        </p>
                                                    </div>
                                                    <Button size="default" className="ml-4 flex-shrink-0" onClick={() => handleStartTask(task)}>
                                                        <PlayCircle className="mr-2 h-4 w-4" /> Start
                                                    </Button>
                                                </CardContent>
                                            </Card>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Quick Access Grid */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4">
                                <Button variant="outline" className="h-24 flex-col gap-2" onClick={() => setActiveTab('readiness')}>
                                    <BarChart3 className="h-6 w-6" />
                                    Readiness
                                </Button>
                                <Button variant="outline" className="h-24 flex-col gap-2" onClick={() => setActiveTab('practice')}>
                                    <Target className="h-6 w-6" />
                                    Free Practice
                                </Button>
                                <Link href="/study" className="contents">
                                    <Button variant="outline" className="h-24 flex-col gap-2">
                                        <BookOpen className="h-6 w-6" />
                                        Study Notes
                                    </Button>
                                </Link>
                                <Link href="/exams" className="contents">
                                    <Button variant="outline" className="h-24 flex-col gap-2">
                                        <AlertCircle className="h-6 w-6" />
                                        Mock Exams
                                    </Button>
                                </Link>
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
                        // Flatten unit data into skill list
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

    // Use practice items from queue if available, otherwise show skill-based picker
    const practiceItems = queueData?.practiceItems || [];

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-xl font-semibold">Free Practice</h2>
                <p className="text-sm text-muted-foreground mt-1">
                    Pick any skill to practice. Items are AI-generated and graded against real rubrics.
                </p>
            </div>

            {/* Format selector */}
            <div className="flex gap-2">
                {([
                    { value: 'written' as const, label: 'Written' },
                    { value: 'mcq' as const, label: 'MCQ' },
                    { value: 'short_answer' as const, label: 'Short Answer' },
                ]).map(fmt => (
                    <Button
                        key={fmt.value}
                        variant={selectedFormat === fmt.value ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setSelectedFormat(fmt.value)}
                    >
                        {fmt.label}
                    </Button>
                ))}
            </div>

            {/* Pre-built practice items from orchestrator */}
            {practiceItems.length > 0 && (
                <div className="space-y-3">
                    <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Recommended by AI</h3>
                    {practiceItems.map((item, idx) => (
                        <Card key={idx} className="hover:shadow-md transition-shadow cursor-pointer" 
                              onClick={() => onStartPractice(item)}>
                            <CardContent className="flex items-center justify-between p-4">
                                <div>
                                    <div className="font-medium">{item.skillName}</div>
                                    <div className="text-xs text-muted-foreground">{item.unitName} • {item.itemType}</div>
                                    {item.reason && <div className="text-xs text-muted-foreground mt-1">{item.reason}</div>}
                                </div>
                                <PlayCircle className="h-5 w-5 text-primary" />
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {/* All skills picker */}
            {loadingSkills ? (
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    <span className="ml-2 text-sm text-muted-foreground">Loading skills...</span>
                </div>
            ) : skills.length > 0 ? (
                <div className="space-y-2">
                    <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">All Skills</h3>
                    <div className="grid gap-2 max-h-[60vh] overflow-y-auto pr-2">
                        {skills
                            .sort((a, b) => a.pMastery - b.pMastery) // Weakest first
                            .map((skill) => (
                                <Card key={skill.skillId} className="hover:shadow-sm transition-shadow cursor-pointer"
                                      onClick={() => onStartPractice({
                                          id: skill.skillId,
                                          skillId: skill.skillId,
                                          skillName: skill.skillName,
                                          unitId: skill.unitId,
                                          unitName: skill.unitName,
                                          itemType: selectedFormat,
                                          mode: 'practice',
                                      })}>
                                    <CardContent className="flex items-center gap-4 p-3">
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                                            skill.pMastery >= 0.8 ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' :
                                            skill.pMastery >= 0.5 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300' :
                                            'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
                                        }`}>
                                            {Math.round(skill.pMastery * 100)}%
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="font-medium text-sm truncate">{skill.skillName}</div>
                                            <div className="text-xs text-muted-foreground">{skill.unitName}</div>
                                        </div>
                                        <PlayCircle className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                    </CardContent>
                                </Card>
                            ))}
                    </div>
                </div>
            ) : (
                <Card>
                    <CardContent className="p-8 text-center">
                        <Target className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                        <h3 className="font-semibold">Start from Today&apos;s Plan</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                            Complete tasks from your daily queue to unlock skill-level practice. 
                            Your progress will populate here as you work through the curriculum.
                        </p>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
