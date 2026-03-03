'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Zap, BookOpen, AlertCircle, PlayCircle, CheckCircle2 } from 'lucide-react';
import MasteryCarousel from '@/components/MasteryCarousel';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

// Types to match MasteryOrchestrator output
interface OrchestratedTask {
    type: 'SYLLABUS' | 'WITNESS';
    priority: string;
    data: {
        id: string; // skillId or witnessId
        title: string;
        description?: string;
        unitId?: string;
        severityWeight?: number;
    };
}

interface DailyQueue {
    date: string;
    queue: OrchestratedTask[];
    meta: {
        termFocus: string;
        witnessCount: number;
        pacing: string;
    };
}

export default function MasteryPage() {
    const { getIdToken } = useAuth();
    const [queueData, setQueueData] = useState<DailyQueue | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTask, setActiveTask] = useState<OrchestratedTask | null>(null);

    // Fetch the queue (Integrated Execution Engine)
    useEffect(() => {
        const fetchQueue = async () => {
            try {
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
        };
        fetchQueue();
    }, [getIdToken]);

    const handleStartTask = (task: OrchestratedTask) => {
        setActiveTask(task);
    };

    const handleTaskComplete = (result: Record<string, unknown>) => {
        // Logic to update local state (remove item from queue)
        // And trigger backend update (p_mastery, witness_severity)
        console.log("Task completed", result);
        setActiveTask(null);
        // Refresh queue
        setQueueData(prev => {
            if (!prev) return null;
            return {
                ...prev,
                queue: prev.queue.filter(t => t.data.id !== activeTask?.data.id)
            };
        });
    };

    if (activeTask) {
        return (
            <div className="container mx-auto py-8">
                <Button variant="ghost" className="mb-4" onClick={() => setActiveTask(null)}>
                    &larr; Back to Command Center
                </Button>
                <MasteryCarousel task={activeTask} onComplete={handleTaskComplete} />
            </div>
        );
    }

    if (loading) {
        return <div className="flex items-center justify-center min-h-screen">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="ml-2">Initializing Senior Partner Protocol...</span>
        </div>;
    }

    return (
        <div className="container mx-auto py-8 space-y-8">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Mastery Command Center</h1>
                <p className="text-muted-foreground mt-2">
                    {queueData?.meta.termFocus || "Phase 1: Foundation"}
                </p>
            </div>

            {/* Daily Briefing / Meta */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Daily Focus</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">Civil & Criminal</div>
                        <p className="text-xs text-muted-foreground">Syllabus Progression</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Active Witnesses</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-amber-600">{queueData?.meta.witnessCount}</div>
                        <p className="text-xs text-muted-foreground">Latent Weaknesses Detected</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Pacing Status</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-600">{queueData?.meta.pacing}</div>
                        <p className="text-xs text-muted-foreground">Optimal Flow</p>
                    </CardContent>
                </Card>
            </div>

            {/* The Integrated Queue */}
            <div className="space-y-4">
                <h2 className="text-xl font-semibold flex items-center gap-2">
                    <Zap className="h-5 w-5 text-yellow-500" />
                    Today&apos;s Execution Queue
                </h2>
                
                {queueData?.queue.length === 0 ? (
                     <Alert className="bg-green-50 border-green-200">
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                        <AlertTitle>All Clear</AlertTitle>
                        <AlertDescription>
                            You have completed today&apos;s scheduled objectives. Review active witnesses or start a free-practice session.
                        </AlertDescription>
                    </Alert>
                ) : (
                    <div className="grid gap-4">
                        {queueData?.queue.map((task, idx) => (
                            <Card key={idx} className={`border-l-4 ${task.type === 'WITNESS' ? 'border-l-red-500 bg-red-50/10' : 'border-l-blue-500'}`}>
                                <CardContent className="flex items-center justify-between p-6">
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                            {task.type === 'WITNESS' && <Badge variant="destructive">Hammering Protocol</Badge>}
                                            {task.priority === 'HIGH' && task.type !== 'WITNESS' && <Badge>High Priority</Badge>}
                                            <span className="text-sm font-mono text-muted-foreground">{task.data.unitId || "General"}</span>
                                        </div>
                                        <h3 className="font-semibold text-lg">{task.data.title}</h3>
                                        <p className="text-sm text-muted-foreground line-clamp-1">
                                            {task.data.description || "Mastery verification required."}
                                        </p>
                                    </div>
                                    <Button size="lg" onClick={() => handleStartTask(task)}>
                                        <PlayCircle className="mr-2 h-5 w-5" /> Start
                                    </Button>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </div>
            
            {/* Quick Access Grid */}
             <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
                <Button variant="outline" className="h-24 flex-col gap-2" disabled>
                    <BookOpen className="h-6 w-6" />
                    Deep Dives
                </Button>
                 <Button variant="outline" className="h-24 flex-col gap-2" disabled>
                    <AlertCircle className="h-6 w-6" />
                    Weakness Log
                </Button>
            </div>
        </div>
    );
}
