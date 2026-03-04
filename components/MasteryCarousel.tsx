'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CheckCircle2, ChevronRight, ChevronLeft, AlertTriangle, BookOpen, ArrowRight, Copy, Sparkles, X, Loader2, RefreshCw } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import EngagingLoader from '@/components/EngagingLoader';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';

// Types
interface CarouselProps {
    task: any;
    onComplete: (result: any) => void;
}

// ============================================
// TEXT SELECTION TOOLBAR
// ============================================
interface SelectionToolbarProps {
    position: { x: number; y: number } | null;
    selectedText: string;
    onCopy: () => void;
    onRephrase: () => void;
    onAskAI: () => void;
    onClose: () => void;
    isLoading: boolean;
}

function SelectionToolbar({ position, selectedText, onCopy, onRephrase, onAskAI, onClose, isLoading }: SelectionToolbarProps) {
    if (!position || !selectedText) return null;

    return (
        <div
            className="fixed z-50 animate-in fade-in zoom-in-95 duration-150"
            style={{ left: position.x, top: position.y }}
        >
            <div className="bg-popover border border-border rounded-lg shadow-lg p-1 flex items-center gap-0.5">
                <button
                    onClick={onCopy}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    title="Copy"
                >
                    <Copy className="h-3 w-3" />
                    Copy
                </button>
                <div className="w-px h-4 bg-border" />
                <button
                    onClick={onRephrase}
                    disabled={isLoading}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium text-primary hover:bg-primary/10 transition-colors disabled:opacity-50"
                    title="Rephrase in simpler language"
                >
                    {isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                    Simplify
                </button>
                <div className="w-px h-4 bg-border" />
                <button
                    onClick={onAskAI}
                    disabled={isLoading}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium text-primary hover:bg-primary/10 transition-colors disabled:opacity-50"
                    title="Ask AI about this"
                >
                    <Sparkles className="h-3 w-3" />
                    Explain
                </button>
                <div className="w-px h-4 bg-border" />
                <button
                    onClick={onClose}
                    className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                >
                    <X className="h-3 w-3" />
                </button>
            </div>
        </div>
    );
}

// ============================================
// AI EXPLANATION PANEL (inline, not modal)
// ============================================
function AIExplanation({ text, onClose }: { text: string; onClose: () => void }) {
    return (
        <div className="mx-6 mb-4 mt-2 p-4 rounded-lg border border-primary/20 bg-primary/5 animate-in slide-in-from-top-2 duration-200">
            <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-primary" />
                    <span className="text-xs font-semibold text-primary">AI Explanation</span>
                </div>
                <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-0.5">
                    <X className="h-3.5 w-3.5" />
                </button>
            </div>
            <div className="text-sm text-foreground/90 leading-relaxed prose prose-sm max-w-none dark:prose-invert">
                <ReactMarkdown>{text}</ReactMarkdown>
            </div>
        </div>
    );
}

export default function MasteryCarousel({ task, onComplete }: CarouselProps) {
    const { getIdToken } = useAuth();
    const [loading, setLoading] = useState(true);
    const [content, setContent] = useState<any>(null);
    
    // View State Management
    const [view, setView] = useState<'NARRATIVE' | 'EXHIBIT' | 'ASSESSMENT' | 'COMPLETE'>('NARRATIVE');
    
    // Sub-states
    const [currentSlide, setCurrentSlide] = useState(0);
    const [stackLevel, setStackLevel] = useState(1);
    const [mcqAnswer, setMcqAnswer] = useState<number | null>(null);
    const [mcqPassed, setMcqPassed] = useState(false);

    // Text selection state
    const [selectionPos, setSelectionPos] = useState<{ x: number; y: number } | null>(null);
    const [selectedText, setSelectedText] = useState('');
    const [aiExplanation, setAiExplanation] = useState<string | null>(null);
    const [aiLoading, setAiLoading] = useState(false);
    const narrativeRef = useRef<HTMLDivElement>(null);

    // Sections with possible rephrase replacements
    const [rephrased, setRephrased] = useState<Map<string, string>>(new Map());

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

    // Handle text selection in narrative
    const handleMouseUp = useCallback(() => {
        const sel = window.getSelection();
        const text = sel?.toString().trim();
        if (text && text.length > 3) {
            const range = sel?.getRangeAt(0);
            if (range) {
                const rect = range.getBoundingClientRect();
                setSelectedText(text);
                setSelectionPos({
                    x: Math.min(rect.left + rect.width / 2 - 100, window.innerWidth - 280),
                    y: rect.top - 48,
                });
            }
        } else {
            // Small delay so toolbar click can register before clearing
            setTimeout(() => {
                if (!aiLoading) {
                    setSelectionPos(null);
                    setSelectedText('');
                }
            }, 200);
        }
    }, [aiLoading]);

    const handleCopy = useCallback(() => {
        navigator.clipboard.writeText(selectedText);
        setSelectionPos(null);
        setSelectedText('');
    }, [selectedText]);

    const handleRephrase = useCallback(async () => {
        if (!selectedText || aiLoading) return;
        setAiLoading(true);
        try {
            const token = await getIdToken();
            const res = await fetch('/api/ai/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({
                    message: `Rephrase the following legal text in simpler, clearer language while preserving all legal accuracy and meaning. Return ONLY the rephrased text, nothing else.\n\nOriginal:\n"${selectedText}"`,
                    intent: 'study',
                }),
            });
            if (res.ok) {
                const data = await res.json();
                const simplified = data.response || data.content || '';
                if (simplified) {
                    // Replace the text in the current section content
                    const sections = [...(content?.narrativeSections || [])];
                    const current = sections[currentSlide] || '';
                    // Try to find and replace the selected text in the section
                    if (current.includes(selectedText)) {
                        sections[currentSlide] = current.replace(selectedText, simplified);
                        setContent({ ...content, narrativeSections: sections });
                        setRephrased(prev => new Map(prev).set(selectedText, simplified));
                    } else {
                        // If exact match fails (markdown formatting), show as explanation
                        setAiExplanation(`**Simplified:** ${simplified}`);
                    }
                }
            }
        } catch (e) {
            console.error('Rephrase failed:', e);
        } finally {
            setAiLoading(false);
            setSelectionPos(null);
            setSelectedText('');
        }
    }, [selectedText, aiLoading, getIdToken, content, currentSlide]);

    const handleAskAI = useCallback(async () => {
        if (!selectedText || aiLoading) return;
        setAiLoading(true);
        setSelectionPos(null);
        try {
            const token = await getIdToken();
            const res = await fetch('/api/ai/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({
                    message: `A law student studying for the Kenya Bar Exam highlighted this text and wants a clear explanation:\n\n"${selectedText}"\n\nContext: They are studying "${task.data.title || content?.title || 'Kenyan law'}". Give a concise, helpful explanation. Use examples if it helps. Keep it under 150 words.`,
                    intent: 'study',
                }),
            });
            if (res.ok) {
                const data = await res.json();
                setAiExplanation(data.response || data.content || 'No explanation available.');
            }
        } catch (e) {
            console.error('Ask AI failed:', e);
            setAiExplanation('Could not get an explanation right now. Please try again.');
        } finally {
            setAiLoading(false);
            setSelectedText('');
        }
    }, [selectedText, aiLoading, getIdToken, task, content]);

    const clearSelection = useCallback(() => {
        setSelectionPos(null);
        setSelectedText('');
        window.getSelection()?.removeAllRanges();
    }, []);
    
    // Fetch content (with session cache)
    useEffect(() => {
        const fetchContent = async () => {
            try {
                const cached = sessionStorage.getItem(cacheKey);
                if (cached) {
                    const state = JSON.parse(cached);
                    if (state.content && Date.now() - state.timestamp < 2 * 60 * 60 * 1000) {
                        setContent(state.content);
                        setView(state.view || 'NARRATIVE');
                        setCurrentSlide(state.currentSlide || 0);
                        setStackLevel(state.stackLevel || 1);
                        setLoading(false);
                        return;
                    }
                }
            } catch { /* fetch fresh */ }

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

    // Navigation
    const handleNext = () => {
        if (view === 'NARRATIVE') {
            if (currentSlide < (content?.narrativeSections?.length || 0) - 1) {
                const next = currentSlide + 1;
                setCurrentSlide(next);
                setAiExplanation(null);
                saveProgress({ s: next });
            } else {
                if (content?.exhibit) {
                    setView('EXHIBIT');
                    saveProgress({ v: 'EXHIBIT' });
                } else {
                    setView('ASSESSMENT');
                    saveProgress({ v: 'ASSESSMENT' });
                }
                setAiExplanation(null);
            }
        } else if (view === 'EXHIBIT') {
             setView('ASSESSMENT');
             setAiExplanation(null);
             saveProgress({ v: 'ASSESSMENT' });
        }
    };

    const handleBack = () => {
        if (view === 'NARRATIVE' && currentSlide > 0) {
            const prev = currentSlide - 1;
            setCurrentSlide(prev);
            setAiExplanation(null);
            saveProgress({ s: prev });
        } else if (view === 'EXHIBIT') {
            // Go back to last narrative slide
            setView('NARRATIVE');
            const lastSlide = (content?.narrativeSections?.length || 1) - 1;
            setCurrentSlide(lastSlide);
            setAiExplanation(null);
            saveProgress({ v: 'NARRATIVE', s: lastSlide });
        } else if (view === 'ASSESSMENT' && stackLevel === 1) {
            // Go back to exhibit or last narrative slide
            if (content?.exhibit) {
                setView('EXHIBIT');
                saveProgress({ v: 'EXHIBIT' });
            } else {
                setView('NARRATIVE');
                const lastSlide = (content?.narrativeSections?.length || 1) - 1;
                setCurrentSlide(lastSlide);
                saveProgress({ v: 'NARRATIVE', s: lastSlide });
            }
            setAiExplanation(null);
        }
    };

    const canGoBack = (view === 'NARRATIVE' && currentSlide > 0) ||
        view === 'EXHIBIT' ||
        (view === 'ASSESSMENT' && stackLevel === 1);

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
                        <button 
                            onClick={handleBack}
                            className="flex items-center gap-1 text-xs text-amber-700 hover:text-amber-900 transition-colors"
                        >
                            <ChevronLeft className="h-3.5 w-3.5" />
                            Back to notes
                        </button>
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
                <CardHeader className="bg-card border-b pb-4">
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                            {canGoBack && (
                                <button onClick={handleBack} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                                    <ChevronLeft className="h-4 w-4" />
                                </button>
                            )}
                            <Badge variant="secondary" className="bg-primary/10 text-primary hover:bg-primary/10">
                                Question {stackLevel}
                            </Badge>
                        </div>
                        <span className="text-[10px] text-muted-foreground">
                            {stackLevel} of {content.stack?.stack?.length || 3}
                        </span>
                    </div>
                    <CardTitle className="text-base leading-snug">
                        {assessment.title || "Assessment"}
                    </CardTitle>
                </CardHeader>
                
                <CardContent className="pt-5 px-5 pb-4">
                    {/* Question text - proper wrapping for long scenarios */}
                    <div className="mb-5">
                        <p className="text-sm leading-relaxed text-foreground">
                            {assessment.question}
                        </p>
                    </div>
                    
                    {/* MCQ Options - proper text wrapping */}
                    {assessment.type === 'MCQ' && (
                        <div className="space-y-2.5">
                            {assessment.options.map((opt: string, idx: number) => {
                                const isSelected = mcqAnswer === idx;
                                const isCorrect = idx === assessment.correctIndex;
                                const showCorrect = mcqPassed && isCorrect;
                                const showWrong = isSelected && !mcqPassed && mcqAnswer !== null;
                                
                                return (
                                    <button
                                        key={idx}
                                        onClick={() => {
                                            if (mcqPassed) return;
                                            setMcqAnswer(idx);
                                            if (isCorrect) {
                                                setMcqPassed(true);
                                                setTimeout(() => {
                                                    setMcqPassed(false);
                                                    setMcqAnswer(null);
                                                    const nextLevel = stackLevel + 1;
                                                    setStackLevel(nextLevel);
                                                    saveProgress({ l: nextLevel });
                                                }, 1500);
                                            }
                                        }}
                                        disabled={mcqPassed}
                                        className={cn(
                                            "w-full text-left flex items-start gap-3 p-3.5 rounded-lg border transition-all duration-150",
                                            !isSelected && !showCorrect && "border-border/60 bg-card hover:border-primary/30 hover:bg-primary/5",
                                            showCorrect && "border-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 ring-1 ring-emerald-400",
                                            showWrong && "border-red-300 bg-red-50/50 dark:bg-red-950/20",
                                            isSelected && !showWrong && !showCorrect && "border-primary/40 bg-primary/5",
                                        )}
                                    >
                                        <span className={cn(
                                            "flex-shrink-0 w-6 h-6 rounded-full border flex items-center justify-center text-[11px] font-medium mt-0.5",
                                            showCorrect && "bg-emerald-500 border-emerald-500 text-white",
                                            showWrong && "bg-red-400 border-red-400 text-white",
                                            !showCorrect && !showWrong && "text-muted-foreground border-border",
                                        )}>
                                            {showCorrect ? '✓' : showWrong ? '✗' : String.fromCharCode(65 + idx)}
                                        </span>
                                        <span className="text-sm leading-relaxed text-foreground/90 whitespace-normal">
                                            {opt}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                    
                    {/* Explanation after correct answer */}
                    {mcqPassed && assessment.explanation && (
                        <div className="mt-4 p-3 rounded-lg bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/50 dark:border-emerald-800/30 animate-in fade-in duration-300">
                            <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400 mb-1">Why this is correct:</p>
                            <p className="text-xs text-emerald-600 dark:text-emerald-300/80 leading-relaxed">{assessment.explanation}</p>
                        </div>
                    )}
                    
                    {/* Fallback for non-MCQ types */}
                    {assessment.type !== 'MCQ' && (
                        <div className="p-5 border border-dashed rounded-lg bg-muted/30 text-center">
                             <p className="text-muted-foreground mb-3 text-sm">{assessment.type} questions coming soon.</p>
                             <Button onClick={() => { const nl = stackLevel + 1; setStackLevel(nl); saveProgress({ l: nl }); }} variant="secondary" size="sm">
                                 Skip
                             </Button>
                        </div>
                    )}
                </CardContent>
                <CardFooter className="bg-muted/30 border-t px-5 py-2.5 justify-center">
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
        <>
        <SelectionToolbar
            position={selectionPos}
            selectedText={selectedText}
            onCopy={handleCopy}
            onRephrase={handleRephrase}
            onAskAI={handleAskAI}
            onClose={clearSelection}
            isLoading={aiLoading}
        />
        <Card className="max-w-4xl mx-auto h-[80vh] flex flex-col shadow-md border-border/60">
            <CardHeader className="bg-card border-b pb-3 pt-4">
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                        {currentSlide > 0 && (
                            <button onClick={handleBack} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors flex-shrink-0">
                                <ChevronLeft className="h-4 w-4" />
                            </button>
                        )}
                        <BookOpen className="h-4 w-4 text-primary flex-shrink-0" />
                        <span className="text-xs font-medium text-primary">Study Notes</span>
                        <span className="text-[10px] text-muted-foreground">-</span>
                        <span className="text-[10px] text-muted-foreground">
                            {currentSlide + 1} of {content?.narrativeSections?.length || 1}
                        </span>
                    </div>
                </div>
                <CardTitle className="text-lg font-semibold truncate mt-1">
                    {content.title || task.data.title || "Study Material"}
                </CardTitle>
                <Progress value={((currentSlide + 1) / (content?.narrativeSections?.length || 1)) * 100} className="h-1 mt-3" />
            </CardHeader>
            
            {/* AI Explanation Panel */}
            {aiExplanation && (
                <AIExplanation text={aiExplanation} onClose={() => setAiExplanation(null)} />
            )}
            
            <CardContent className="flex-1 p-0 overflow-hidden relative bg-background">
                <ScrollArea className="h-full">
                   <div 
                        ref={narrativeRef}
                        onMouseUp={handleMouseUp}
                        className="prose prose-sm md:prose-base max-w-none dark:prose-invert p-6 md:p-8 pb-28 prose-headings:text-foreground prose-p:text-foreground/90 prose-strong:text-foreground select-text cursor-text"
                   >
                        <ReactMarkdown>
                            {currentText}
                        </ReactMarkdown>
                   </div>
                </ScrollArea>
                
                {/* Floating Action Bar */}
                <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-background via-background/95 to-transparent pt-16 flex items-center justify-between">
                    <div className="flex-shrink-0">
                        {currentSlide > 0 && (
                            <Button 
                                onClick={handleBack}
                                variant="ghost"
                                size="sm"
                                className="text-muted-foreground hover:text-foreground"
                            >
                                <ChevronLeft className="h-4 w-4 mr-1" />
                                Back
                            </Button>
                        )}
                    </div>
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
        </>
    );
}
