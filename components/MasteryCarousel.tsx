'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CheckCircle2, ChevronRight, AlertTriangle, BookOpen, ArrowRight } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import EngagingLoader from '@/components/EngagingLoader';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';

// Types
interface CarouselProps {
    task: any; // The orchestrated task
    onComplete: (result: any) => void;
}

export default function MasteryCarousel({ task, onComplete }: CarouselProps) {
    const { getIdToken } = useAuth();
    const [loading, setLoading] = useState(true);
    const [content, setContent] = useState<any>(null);
    
    // View State Management
    const [view, setView] = useState<'NARRATIVE' | 'EXHIBIT' | 'ASSESSMENT' | 'COMPLETE'>('NARRATIVE');
    
    // Sub-states
    const [currentSlide, setCurrentSlide] = useState(0); // For Narrative
    const [stackLevel, setStackLevel] = useState(1);     // For Assessment
    const [mcqAnswer, setMcqAnswer] = useState<number | null>(null);
    const [mcqPassed, setMcqPassed] = useState(false);

    // Session persistence key
    const cacheKey = `mastery_session_${task.data.id}`;

    // Save progress to sessionStorage
    const saveProgress = (updates?: { v?: string; s?: number; l?: number }) => {
        try {
            const state = {
                view: updates?.v || view,
                currentSlide: updates?.s ?? currentSlide,
                stackLevel: updates?.l ?? stackLevel,
                content: content,
                timestamp: Date.now(),
            };
            sessionStorage.setItem(cacheKey, JSON.stringify(state));
        } catch { /* quota exceeded - ignore */ }
    };
    
    // Fetch content (with session cache)
    useEffect(() => {
        const fetchContent = async () => {
            // Check for cached session first
            try {
                const cached = sessionStorage.getItem(cacheKey);
                if (cached) {
                    const state = JSON.parse(cached);
                    // Use cache if less than 2 hours old
                    if (state.content && Date.now() - state.timestamp < 2 * 60 * 60 * 1000) {
                        setContent(state.content);
                        setView(state.view || 'NARRATIVE');
                        setCurrentSlide(state.currentSlide || 0);
                        setStackLevel(state.stackLevel || 1);
                        setLoading(false);
                        return;
                    }
                }
            } catch { /* parsing error - fetch fresh */ }

            const token = await getIdToken();
            try {
                const params = new URLSearchParams({
                    skillId: task.data.id,
                    type: task.type
                });
                
                const res = await fetch(`/api/mastery/content?${params}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                
                if (!res.ok) throw new Error("Failed to fetch content");
                
                const data = await res.json();
                setContent(data);

                // Cache the fresh content
                try {
                    sessionStorage.setItem(cacheKey, JSON.stringify({
                        view: 'NARRATIVE', currentSlide: 0, stackLevel: 1,
                        content: data, timestamp: Date.now(),
                    }));
                } catch { /* ignore */ }
            } catch (e) {
                console.error("Failed to load content", e);
            } finally {
                setLoading(false);
            }
        };
        fetchContent();
    }, [task, getIdToken, cacheKey]);

    const handleNext = () => {
        // NARRATIVE PHASE
        if (view === 'NARRATIVE') {
            if (currentSlide < (content?.narrativeSections?.length || 0) - 1) {
                const next = currentSlide + 1;
                setCurrentSlide(next);
                saveProgress({ s: next });
            } else {
                // End of Narrative
                if (content?.exhibit) {
                    setView('EXHIBIT');
                    saveProgress({ v: 'EXHIBIT' });
                } else {
                    setView('ASSESSMENT');
                    saveProgress({ v: 'ASSESSMENT' });
                }
            }
        }
        // EXHIBIT PHASE
        else if (view === 'EXHIBIT') {
             setView('ASSESSMENT');
             saveProgress({ v: 'ASSESSMENT' });
        }
    };

    if (loading) {
        return <EngagingLoader size="md" message="Preparing your study materials..." />;
    }
    
    if (!content) {
        return (
            <div className="p-8 text-center border border-border rounded-xl bg-card">
                <AlertTriangle className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
                <h3 className="font-semibold text-sm">Unable to load content</h3>
                <p className="text-xs text-muted-foreground mt-1">Please try again or select a different topic.</p>
            </div>
        );
    }

    // --- VIEW: GOLDEN EXHIBIT ---
    if (view === 'EXHIBIT' && content.exhibit) {
        return (
            <div className="animate-in fade-in duration-500">
                <Card className="w-full max-w-5xl mx-auto h-[75vh] flex flex-col border-amber-400 bg-amber-50/30 shadow-lg">
                    <CardHeader className="border-b bg-amber-100/50 flex flex-row items-center justify-between pb-4 pt-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-amber-200 rounded-full">
                                <BookOpen className="h-5 w-5 text-amber-900" />
                            </div>
                            <div>
                                <CardTitle className="text-amber-900 text-xl font-serif">
                                    {content.exhibit.title}
                                </CardTitle>
                                <p className="text-xs text-amber-700 uppercase tracking-wider font-medium mt-1">
                                    Source Material
                                </p>
                            </div>
                        </div>
                        <Badge variant="outline" className="bg-white text-amber-800 border-amber-300 shadow-sm text-[10px]">
                            Reference
                        </Badge>
                    </CardHeader>
                    
                    <CardContent className="flex-1 p-0 overflow-hidden relative bg-white dark:bg-zinc-950">
                        <ScrollArea className="h-full">
                            <div className="p-8 max-w-4xl mx-auto">
                                <div className="prose prose-sm md:prose-base max-w-none dark:prose-invert font-serif border p-12 shadow-sm bg-white text-black min-h-[500px] mx-auto">
                                    <ReactMarkdown>{content.exhibit.content}</ReactMarkdown>
                                </div>
                            </div>
                        </ScrollArea>
                    </CardContent>
                    
                    <CardFooter className="p-4 border-t bg-amber-50/80 backdrop-blur flex justify-between items-center">
                        <div className="flex items-center gap-2 text-sm text-amber-800">
                            <span className="text-xs">Review this material before the assessment</span>
                        </div>
                        <Button 
                            onClick={handleNext} 
                            className="bg-amber-900 hover:bg-amber-800 text-white shadow-md"
                            size="default"
                        >
                            Continue to Assessment <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                    </CardFooter>
                </Card>
            </div>
        );
    }
    
    // --- VIEW: ASSESSMENT ---
    if (view === 'ASSESSMENT') {
        // Find current level assessment
        const assessment = content.stack?.stack?.find((s: any) => s.level === stackLevel);
        
        // If no more assessments, we are done
        if (!assessment) {
            return (
                <div className="animate-in zoom-in duration-300">
                    <Card className="w-full max-w-2xl mx-auto text-center py-12 border-emerald-200/60 dark:border-emerald-900/40 bg-emerald-50/20 dark:bg-emerald-950/10">
                        <CardContent className="space-y-6">
                            <div className="relative">
                                <div className="absolute inset-0 bg-emerald-200 rounded-full blur-xl opacity-40 animate-pulse"></div>
                                <CheckCircle2 className="h-16 w-16 text-emerald-600 mx-auto relative z-10" />
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold">Topic Complete</h2>
                                <p className="text-muted-foreground mt-1">Well done - you've mastered this section.</p>
                            </div>
                            <Button 
                                onClick={() => {
                                    // Clear session cache on completion
                                    try { sessionStorage.removeItem(cacheKey); } catch {}
                                    onComplete({ passed: true, score: 100 });
                                }} 
                                size="lg"
                                className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-md px-8 py-5 rounded-xl"
                            >
                                Back to Mastery Hub
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            );
        }

        // Render Active Assessment Question
        return (
             <Card className="w-full max-w-3xl mx-auto mt-4 border-t-2 border-t-primary shadow-lg animate-in slide-in-from-right duration-300">
                <CardHeader className="bg-card border-b pb-5">
                    <div className="flex justify-between items-center mb-2">
                        <Badge variant="secondary" className="bg-primary/10 text-primary hover:bg-primary/10">
                            Question {stackLevel}
                        </Badge>
                    </div>
                    <CardTitle className="text-lg">
                        {assessment.title || "Assessment"}
                    </CardTitle>
                </CardHeader>
                
                <CardContent className="space-y-8 pt-8 px-8">
                    <div className="prose prose-lg dark:prose-invert max-w-none">
                        <p className="font-medium text-lg leading-relaxed text-slate-800 dark:text-slate-200">
                            {assessment.question}
                        </p>
                    </div>
                    
                    {assessment.type === 'MCQ' && (
                        <div className="grid gap-4">
                            {assessment.options.map((opt: string, idx: number) => (
                                <Button 
                                    key={idx} 
                                    variant={mcqAnswer === idx ? (mcqPassed ? "default" : "destructive") : "outline"}
                                    className={cn(
                                        "justify-start h-auto py-5 px-6 text-left text-base transition-all hover:border-blue-300 hover:bg-blue-50/50", 
                                        mcqPassed && idx === assessment.correctIndex && "bg-green-600 text-white hover:bg-green-700 ring-2 ring-green-600 ring-offset-2 border-transparent",
                                        mcqAnswer === idx && !mcqPassed && "ring-2 ring-red-200 ring-offset-1"
                                    )}
                                    onClick={() => {
                                        if (mcqPassed) return;
                                        setMcqAnswer(idx);
                                        if (idx === assessment.correctIndex) {
                                            setMcqPassed(true);
                                            // Auto advance
                                            setTimeout(() => {
                                                setMcqPassed(false);
                                                setMcqAnswer(null);
                                                const nextLevel = stackLevel + 1;
                                                setStackLevel(nextLevel);
                                                saveProgress({ l: nextLevel });
                                            }, 1200);
                                        }
                                    }}
                                    disabled={mcqPassed}
                                >
                                    <span className="mr-4 flex-shrink-0 w-6 h-6 rounded-full border flex items-center justify-center text-xs font-mono text-muted-foreground">
                                        {String.fromCharCode(65+idx)}
                                    </span>
                                    {opt}
                                </Button>
                            ))}
                        </div>
                    )}
                    
                    {/* Fallback for other types for now */}
                    {assessment.type !== 'MCQ' && (
                        <div className="p-6 border-2 border-dashed rounded-lg bg-muted/30 text-center">
                             <p className="text-muted-foreground mb-4 text-sm">{assessment.type} questions coming soon.</p>
                             <Button onClick={() => setStackLevel(l => l + 1)} variant="secondary" size="sm">
                                 Skip
                             </Button>
                        </div>
                    )}
                </CardContent>
                <CardFooter className="bg-muted/30 border-t p-3 text-center justify-center">
                    <p className="text-[11px] text-muted-foreground">
                         Select the correct answer to continue
                    </p>
                </CardFooter>
            </Card>
        );
    }

    // --- VIEW: NARRATIVE (Default) ---
    const currentText = (content?.narrativeSections || [])[currentSlide] || "Loading...";
    const isLastSlide = content?.narrativeSections ? currentSlide === content.narrativeSections.length - 1 : false;

    return (
        <Card className="max-w-4xl mx-auto h-[80vh] flex flex-col shadow-md border-border/60">
            <CardHeader className="bg-card border-b pb-3 pt-4">
                <div className="flex justify-between items-center">
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                            <BookOpen className="h-4 w-4 text-primary flex-shrink-0" />
                            <span className="text-xs font-medium text-primary">Study Notes</span>
                            <span className="text-[10px] text-muted-foreground">-</span>
                            <span className="text-[10px] text-muted-foreground">
                                {currentSlide + 1} of {content?.narrativeSections?.length || 1}
                            </span>
                        </div>
                        <CardTitle className="text-lg font-semibold truncate">
                            {content.title || task.data.title || "Study Material"}
                        </CardTitle>
                    </div>
                </div>
                <Progress value={((currentSlide + 1) / (content?.narrativeSections?.length || 1)) * 100} className="h-1 mt-3" />
            </CardHeader>
            
            <CardContent className="flex-1 p-0 overflow-hidden relative bg-background">
                <ScrollArea className="h-full">
                   <div className="prose prose-sm md:prose-base max-w-none dark:prose-invert p-6 md:p-8 pb-28 prose-headings:text-foreground prose-p:text-foreground/90 prose-strong:text-foreground">
                        <ReactMarkdown>
                            {currentText}
                        </ReactMarkdown>
                   </div>
                </ScrollArea>
                
                {/* Floating Action Bar */}
                <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-background via-background/95 to-transparent pt-16 flex justify-end">
                     <Button 
                        onClick={handleNext} 
                        size="default" 
                        className="shadow-md bg-primary hover:bg-primary/90 text-primary-foreground px-6 rounded-lg transition-all"
                    >
                        {isLastSlide ? (content?.exhibit ? "View Exhibit" : "Start Assessment") : "Continue"} 
                        <ChevronRight className="ml-1.5 h-4 w-4" />
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}
