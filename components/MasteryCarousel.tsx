'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CheckCircle2, Lock, ChevronRight, AlertTriangle, BookOpen, Loader2, ArrowRight } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
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
    
    // Fetch content
    useEffect(() => {
        const fetchContent = async () => {
            const token = await getIdToken();
            try {
                // Construct query params
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
            } catch (e) {
                console.error("Failed to load content", e);
            } finally {
                setLoading(false);
            }
        };
        fetchContent();
    }, [task, getIdToken]);

    const handleNext = () => {
        // NARRATIVE PHASE
        if (view === 'NARRATIVE') {
            if (currentSlide < (content?.narrativeSections?.length || 0) - 1) {
                setCurrentSlide(curr => curr + 1);
            } else {
                // End of Narrative
                // Check if we have an Exhibit to show
                if (content?.exhibit) {
                    setView('EXHIBIT');
                } else {
                    setView('ASSESSMENT');
                }
            }
        }
        // EXHIBIT PHASE
        else if (view === 'EXHIBIT') {
             setView('ASSESSMENT');
        }
    };

    if (loading) {
        return (
            <div className="h-[500px] flex flex-col items-center justify-center gap-4 text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin text-primary" /> 
                <p>Retrieving Senior Partner Briefing...</p>
            </div>
        );
    }
    
    if (!content) {
        return (
            <div className="p-8 text-center text-red-500 border border-red-200 rounded-lg bg-red-50">
                <AlertTriangle className="h-10 w-10 mx-auto mb-2" />
                <h3 className="font-bold">Mission Aborted</h3>
                <p>Intelligence Packet Corrupted.</p>
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
                                <p className="text-xs text-amber-700 uppercase tracking-widest font-semibold mt-1">
                                    Official Precedent
                                </p>
                            </div>
                        </div>
                        <Badge variant="outline" className="bg-white text-amber-800 border-amber-300 shadow-sm">
                            Read Only Mode
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
                            <AlertTriangle className="h-4 w-4" />
                            <span className="italic font-medium">Study this structure carefully. You cannot return.</span>
                        </div>
                        <Button 
                            onClick={handleNext} 
                            className="bg-amber-900 hover:bg-amber-800 text-white shadow-md transition-all hover:scale-105"
                            size="lg"
                        >
                            I Have Studied The Exhibit <ArrowRight className="ml-2 h-4 w-4" />
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
                    <Card className="w-full max-w-2xl mx-auto text-center py-16 border-green-200 bg-green-50/30">
                        <CardContent className="space-y-8">
                            <div className="relative">
                                <div className="absolute inset-0 bg-green-200 rounded-full blur-xl opacity-50 animate-pulse"></div>
                                <CheckCircle2 className="h-24 w-24 text-green-600 mx-auto relative z-10" />
                            </div>
                            <div>
                                <h2 className="text-3xl font-bold text-green-900">Module Verified</h2>
                                <p className="text-green-700 mt-2 text-lg">Mastery Protocol Concluded Successfully.</p>
                            </div>
                            <Button 
                                onClick={() => onComplete({ passed: true, score: 100 })} 
                                size="lg"
                                className="bg-green-600 hover:bg-green-700 text-white shadow-lg text-lg px-8 py-6 rounded-xl"
                            >
                                Return to Command Center
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            );
        }

        // Render Active Assessment Question
        return (
             <Card className="w-full max-w-3xl mx-auto mt-4 border-t-4 border-t-blue-600 shadow-2xl animate-in slide-in-from-right duration-300">
                <CardHeader className="bg-slate-50 border-b pb-6">
                    <div className="flex justify-between items-center mb-2">
                        <Badge variant="secondary" className="bg-blue-100 text-blue-700 hover:bg-blue-100">
                            Level {stackLevel} Clearance
                        </Badge>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Lock className="h-3 w-3" />
                            Gateway Active
                        </div>
                    </div>
                    <CardTitle className="text-xl">
                        {assessment.title || "Assessment Protocol"}
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
                                                setStackLevel(l => l + 1);
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
                        <div className="p-6 border-2 border-dashed rounded-lg bg-slate-50 text-center">
                             <p className="text-muted-foreground mb-4">Interactive module for {assessment.type} coming in next update.</p>
                             <Button onClick={() => setStackLevel(l => l + 1)} variant="secondary">
                                 Bypass (Simulation Mode)
                             </Button>
                        </div>
                    )}
                </CardContent>
                <CardFooter className="bg-slate-50 border-t p-4 text-center justify-center">
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Lock className="h-3 w-3" />
                         Next level locked until correct response provided.
                    </p>
                </CardFooter>
            </Card>
        );
    }

    // --- VIEW: NARRATIVE (Default) ---
    const currentText = (content?.narrativeSections || [])[currentSlide] || "Loading...";
    const isLastSlide = content?.narrativeSections ? currentSlide === content.narrativeSections.length - 1 : false;

    return (
        <Card className="max-w-4xl mx-auto h-[80vh] flex flex-col shadow-xl border-slate-200 dark:border-slate-800">
            <CardHeader className="bg-slate-50/80 dark:bg-slate-900/50 border-b pb-4 backdrop-blur supports-[backdrop-filter]:bg-slate-50/50">
                <div className="flex justify-between items-start">
                    <div>
                        <Badge variant="outline" className="mb-2 border-primary/20 text-primary bg-primary/5">
                            Senior Partner Briefing
                        </Badge>
                        <CardTitle className="text-2xl font-serif text-slate-900 dark:text-white">
                            {content.title || task.data.title || "Subject Matter Mastery"}
                        </CardTitle>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                        <div className="text-xs font-mono text-muted-foreground border px-2 py-1 rounded bg-white dark:bg-slate-950">
                            SLIDE {currentSlide + 1} / {content?.narrativeSections?.length || 1}
                        </div>
                    </div>
                </div>
                <Progress value={((currentSlide + 1) / (content?.narrativeSections?.length || 1)) * 100} className="h-1 mt-4" />
            </CardHeader>
            
            <CardContent className="flex-1 p-0 overflow-hidden relative bg-white dark:bg-zinc-950">
                <ScrollArea className="h-full">
                   <div className="prose prose-slate prose-lg max-w-none dark:prose-invert p-8 md:p-12 pb-32">
                        <ReactMarkdown>
                            {currentText}
                        </ReactMarkdown>
                   </div>
                </ScrollArea>
                
                {/* Floating Action Bar */}
                <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-white via-white/90 to-transparent dark:from-black dark:via-black/90 pt-20 flex justify-end">
                     <Button 
                        onClick={handleNext} 
                        size="lg" 
                        className="shadow-xl bg-primary hover:bg-primary/90 text-primary-foreground text-lg px-8 rounded-full transition-all hover:scale-105"
                    >
                        {isLastSlide ? (content?.exhibit ? "Proceed to Exhibit" : "Begin Assessment") : "Continue"} 
                        <ChevronRight className="ml-2 h-5 w-5" />
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}
