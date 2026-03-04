'use client';

import { useState, useEffect, useRef, useCallback, Fragment, useMemo } from 'react';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
    CheckCircle2, ChevronRight, ChevronLeft, AlertTriangle,
    BookOpen, ArrowRight, Copy, Sparkles, X, Loader2,
    RefreshCw, Maximize2, Minimize2, Scale
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import EngagingLoader from '@/components/EngagingLoader';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';

/* ================================================================
   TYPES
   ================================================================ */
interface CarouselProps {
    task: any;
    onComplete: (result: any) => void;
}

/* ================================================================
   CITATION DETECTION  —  Kenyan legal citation patterns
   ================================================================ */
// Statute pattern: "section 45(1) of the Companies Act, 2015" etc.
const STATUTE_RE =
    /(?:(?:[Ss]ection|s\.|[Aa]rt(?:icle)?\.?\s*|[Rr]ule|[Rr]egulation|[Oo]rder|[Ss]chedule|[Pp]art)\s+[\dIVXLCDM]+(?:\([^)]*\))*(?:\([^)]*\))?(?:\s+of\s+(?:the\s+)?)?)?(?:the\s+)?((?:[A-Z][A-Za-z''\u2019]+[\s,()-]*)+(?:Act|Regulations?|Rules?|Order|Code|Constitution|Ordinance)(?:,?\s*(?:Cap\.?\s*\d+|No\.?\s*\d+(?:\s+of\s+\d{4})?|\d{4}))?)(?:\s*[-\u2013]\s*((?:Part|Chapter|Section|Schedule|Division)\s+[IVXLCDM\d]+(?:\s*\([^)]*\))?))?/g;

// Case law pattern: "Case Name [Year] eKLR" or "Case Name (Year) KLR ..."
const CASE_RE =
    /([A-Z][A-Za-z''.\-]+(?:\s+(?:v|vs?\.?|&|and)\s+[A-Z][A-Za-z''.\-]+(?:\s+[A-Za-z''.\-]+)*)?)\s+(\[\d{4}\]\s*eKLR|\(\d{4}\)\s*(?:\d+\s+)?KLR\s*[\d\s]*|\[\d{4}\]\s*\d*\s*(?:EA|KLR)\s*\d*)/g;

// Inline "section NN(N)" references (without full Act name)
const SECTION_INLINE_RE =
    /[Ss]ection\s+\d+(?:\([^)]*\))*/g;

type CitationType = 'statute' | 'case' | 'section';

interface ParsedCitation {
    fullMatch: string;
    statute: string;
    section?: string;
    startIndex: number;
    endIndex: number;
    type: CitationType;
}

function parseCitations(text: string): ParsedCitation[] {
    const results: ParsedCitation[] = [];
    const occupied = new Set<number>();

    const claim = (start: number, end: number): boolean => {
        for (let i = start; i < end; i++) if (occupied.has(i)) return false;
        for (let i = start; i < end; i++) occupied.add(i);
        return true;
    };

    // 1) Statutes (longest matches first)
    const sRe = new RegExp(STATUTE_RE.source, STATUTE_RE.flags);
    let m: RegExpExecArray | null;
    while ((m = sRe.exec(text)) !== null) {
        if (!claim(m.index, m.index + m[0].length)) continue;
        results.push({ fullMatch: m[0], statute: m[1] || m[0], section: m[2] || undefined, startIndex: m.index, endIndex: m.index + m[0].length, type: 'statute' });
    }

    // 2) Case law
    const cRe = new RegExp(CASE_RE.source, CASE_RE.flags);
    while ((m = cRe.exec(text)) !== null) {
        if (!claim(m.index, m.index + m[0].length)) continue;
        results.push({ fullMatch: m[0], statute: m[1] || m[0], section: m[2] || undefined, startIndex: m.index, endIndex: m.index + m[0].length, type: 'case' });
    }

    // 3) Inline section refs (only if not already part of a statute match)
    const iRe = new RegExp(SECTION_INLINE_RE.source, SECTION_INLINE_RE.flags);
    while ((m = iRe.exec(text)) !== null) {
        if (!claim(m.index, m.index + m[0].length)) continue;
        results.push({ fullMatch: m[0], statute: m[0], startIndex: m.index, endIndex: m.index + m[0].length, type: 'section' });
    }

    return results.sort((a, b) => a.startIndex - b.startIndex);
}

/* ================================================================
   CITATION LINK  —  clickable amber-styled inline token
   ================================================================ */
function CitationLink({ text, onClick, type }: { text: string; onClick: () => void; type: CitationType }) {
    const isCase = type === 'case';
    return (
        <button
            onClick={(e) => { e.stopPropagation(); onClick(); }}
            className={cn(
                "citation-link inline underline decoration-[1.5px] underline-offset-2 transition-colors cursor-pointer bg-transparent border-none p-0 m-0 text-left leading-inherit font-semibold",
                isCase
                    ? "italic text-teal-700 dark:text-teal-400 decoration-teal-400/40 dark:decoration-teal-500/30 hover:text-teal-900 dark:hover:text-teal-300 hover:decoration-teal-600"
                    : "text-amber-700 dark:text-amber-400 decoration-amber-400/50 dark:decoration-amber-500/40 hover:text-amber-900 dark:hover:text-amber-300 hover:decoration-amber-600"
            )}
            title={isCase ? `View case: ${text}` : `View statute: ${text}`}
        >
            {text}
        </button>
    );
}

/* ================================================================
   TEXT-WITH-CITATIONS  —  renders plain text with citation hotspots
   ================================================================ */
function TextWithCitations({ children, onCitationClick }: { children: string; onCitationClick: (c: ParsedCitation) => void }) {
    if (typeof children !== 'string') return <>{children}</>;
    const citations = parseCitations(children);
    if (citations.length === 0) return <>{children}</>;
    const parts: React.ReactNode[] = [];
    let last = 0;
    citations.forEach((c, i) => {
        if (c.startIndex > last) parts.push(<Fragment key={`t${i}`}>{children.slice(last, c.startIndex)}</Fragment>);
        parts.push(<CitationLink key={`c${i}`} text={c.fullMatch} type={c.type} onClick={() => onCitationClick(c)} />);
        last = c.endIndex;
    });
    if (last < children.length) parts.push(<Fragment key="tail">{children.slice(last)}</Fragment>);
    return <>{parts}</>;
}

/* ================================================================
   STATUTE SIDE-PANEL  —  shows verbatim statute section
   ================================================================ */
function StatutePanel({ citation, onClose, getIdToken }: { citation: ParsedCitation | null; onClose: () => void; getIdToken: () => Promise<string | null> }) {
    const [content, setContent] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(false);

    useEffect(() => {
        if (!citation) return;
        let cancelled = false;
        setLoading(true); setContent(null); setError(false);
        (async () => {
            try {
                const token = await getIdToken();
                const res = await fetch('/api/ai/chat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                    body: JSON.stringify({
                        message: citation.type === 'case'
                            ? `You are a Kenyan legal reference tool. The user clicked on this case citation: "${citation.fullMatch}".\n\nProvide:\n1. Full case name, court, and citation\n2. Brief facts (2-3 sentences)\n3. The key legal issue(s)\n4. The holding/ratio decidendi - what the court decided and why\n5. The principle of law established\n\nBe concise and accurate. If you are unsure of the exact details, state that clearly.`
                            : `You are a Kenyan legal reference tool. The user clicked on this citation: "${citation.fullMatch}".\n\nProvide the VERBATIM text of this statutory provision as it appears in Kenyan law:\n1. Full title of the Act/Regulation\n2. The specific Part/Section heading\n3. The verbatim section text with all sub-sections numbered (1),(2),(a),(b),(i),(ii)\n4. If you do not have the exact verbatim text, give the closest accurate paraphrase and note that.\n\nUse proper legal formatting.`,
                        intent: 'study',
                    }),
                });
                if (!res.ok) throw new Error();
                const data = await res.json();
                if (!cancelled) setContent(data.response || data.content || 'Unable to retrieve statute text.');
            } catch { if (!cancelled) setError(true); } finally { if (!cancelled) setLoading(false); }
        })();
        return () => { cancelled = true; };
    }, [citation, getIdToken]);

    if (!citation) return null;
    return (
        <div className="fixed inset-0 z-50 flex animate-in fade-in duration-200">
            <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
            <div className="relative ml-auto w-full max-w-lg bg-card border-l border-border shadow-2xl flex flex-col h-full animate-in slide-in-from-right duration-300">
                {/* Header */}
                <div className={cn(
                    "flex items-center justify-between p-4 border-b",
                    citation.type === 'case' ? "bg-teal-50/80 dark:bg-teal-950/20" : "bg-amber-50/80 dark:bg-amber-950/20"
                )}>
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                        <Scale className={cn("h-4 w-4 flex-shrink-0", citation.type === 'case' ? "text-teal-700 dark:text-teal-400" : "text-amber-700 dark:text-amber-400")} />
                        <div className="min-w-0">
                            <p className={cn("text-[10px] uppercase tracking-widest font-medium mb-0.5", citation.type === 'case' ? "text-teal-600/60 dark:text-teal-400/50" : "text-amber-600/60 dark:text-amber-400/50")}>
                                {citation.type === 'case' ? 'Case Law' : 'Statute'}
                            </p>
                            <h3 className={cn("text-sm font-bold truncate", citation.type === 'case' ? "text-teal-900 dark:text-teal-300 italic" : "text-amber-900 dark:text-amber-300")}>{citation.statute}</h3>
                            {citation.section && <p className="text-[11px] text-muted-foreground/70 mt-0.5">{citation.section}</p>}
                        </div>
                    </div>
                    <button onClick={onClose} className={cn("p-1.5 rounded-lg transition-colors flex-shrink-0", citation.type === 'case' ? "hover:bg-teal-200/50 dark:hover:bg-teal-800/30 text-teal-700 dark:text-teal-400" : "hover:bg-amber-200/50 dark:hover:bg-amber-800/30 text-amber-700 dark:text-amber-400")}>
                        <X className="h-4 w-4" />
                    </button>
                </div>
                {/* Body */}
                <ScrollArea className="flex-1">
                    <div className="p-5 sm:p-6">
                        {loading && (
                            <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
                                <Loader2 className="h-6 w-6 animate-spin text-amber-600" />
                                <p className="text-sm">Retrieving statute text&hellip;</p>
                            </div>
                        )}
                        {error && (
                            <div className="text-center py-16 text-muted-foreground">
                                <AlertTriangle className="h-6 w-6 mx-auto mb-2 text-amber-500" />
                                <p className="text-sm">Could not retrieve the statute. Try again later.</p>
                            </div>
                        )}
                        {content && (
                            <div className="statute-content prose prose-sm max-w-none dark:prose-invert prose-headings:text-amber-900 dark:prose-headings:text-amber-300 prose-strong:text-amber-800 dark:prose-strong:text-amber-400">
                                <ReactMarkdown>{content}</ReactMarkdown>
                            </div>
                        )}
                    </div>
                </ScrollArea>
                <div className="px-4 py-2.5 border-t bg-muted/30 text-center">
                    <p className="text-[10px] text-muted-foreground">Source: Kenya Law Reports &middot; Always verify with the official gazette</p>
                </div>
            </div>
        </div>
    );
}

/* ================================================================
   SELECTION TOOLBAR  —  floating popup on text highlight
   ================================================================ */
function SelectionToolbar({ position, selectedText, onCopy, onSimplify, onAskAI, onClose, isLoading }: {
    position: { x: number; y: number } | null; selectedText: string;
    onCopy: () => void; onSimplify: () => void; onAskAI: () => void; onClose: () => void; isLoading: boolean;
}) {
    if (!position || !selectedText) return null;
    return (
        <div className="fixed z-[60] animate-in fade-in zoom-in-95 duration-150" style={{ left: position.x, top: position.y }}>
            <div className="bg-popover border border-border rounded-xl shadow-xl p-1.5 flex items-center gap-1">
                <button onClick={onCopy} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" title="Copy">
                    <Copy className="h-3.5 w-3.5" /> Copy
                </button>
                <div className="w-px h-5 bg-border" />
                <button onClick={onSimplify} disabled={isLoading} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-amber-700 dark:text-amber-400 hover:bg-amber-100/50 dark:hover:bg-amber-900/20 transition-colors disabled:opacity-50" title="Simplify">
                    {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} Simplify
                </button>
                <div className="w-px h-5 bg-border" />
                <button onClick={onAskAI} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100/50 dark:hover:bg-emerald-900/20 transition-colors" title="Ask AI">
                    <Sparkles className="h-3.5 w-3.5" /> Ask AI
                </button>
                <div className="w-px h-5 bg-border" />
                <button onClick={onClose} className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                    <X className="h-3.5 w-3.5" />
                </button>
            </div>
        </div>
    );
}

/* ================================================================
   CUSTOM MARKDOWN COMPONENTS  —  warm palette + citation detection
   ================================================================ */
function processChildren(children: any, onCite: (c: ParsedCitation) => void): React.ReactNode {
    if (typeof children === 'string') return <TextWithCitations onCitationClick={onCite}>{children}</TextWithCitations>;
    if (Array.isArray(children)) return children.map((ch: any, i: number) => typeof ch === 'string' ? <TextWithCitations key={i} onCitationClick={onCite}>{ch}</TextWithCitations> : ch);
    return children;
}

function useMdComponents(onCite: (c: ParsedCitation) => void) {
    return useMemo(() => ({
        h1: ({ children, ...p }: any) => <h1 className="text-2xl font-bold text-amber-900 dark:text-amber-200 mt-7 mb-3 border-b border-amber-200/30 dark:border-amber-800/25 pb-2" {...p}>{children}</h1>,
        h2: ({ children, ...p }: any) => <h2 className="text-xl font-bold text-amber-800 dark:text-amber-300 mt-6 mb-2.5" {...p}>{children}</h2>,
        h3: ({ children, ...p }: any) => <h3 className="text-lg font-semibold text-orange-800 dark:text-orange-300 mt-5 mb-2" {...p}>{children}</h3>,
        h4: ({ children, ...p }: any) => <h4 className="text-base font-semibold text-stone-800 dark:text-stone-300 mt-4 mb-1.5" {...p}>{children}</h4>,
        p: ({ children, ...p }: any) => {
            const txt = typeof children === 'string' ? children : Array.isArray(children) ? children.map((c: any) => typeof c === 'string' ? c : '').join('') : '';
            if (/exam\s+pitfall/i.test(txt)) {
                return (
                    <div className="my-4 p-4 rounded-xl border-l-4 border-rose-400 dark:border-rose-500 bg-rose-50/50 dark:bg-rose-950/15" {...p}>
                        <p className="text-[15px] leading-[1.75] text-rose-900 dark:text-rose-200">{processChildren(children, onCite)}</p>
                    </div>
                );
            }
            return <p className="text-[15px] leading-[1.85] text-foreground/90 mb-3.5" {...p}>{processChildren(children, onCite)}</p>;
        },
        strong: ({ children, ...p }: any) => {
            const text = typeof children === 'string' ? children : '';
            const cites = text ? parseCitations(text) : [];
            if (cites.length > 0 && cites[0].fullMatch.length > text.length * 0.4) {
                return <CitationLink text={text} type={cites[0].type} onClick={() => onCite(cites[0])} />;
            }
            return <strong className="font-bold text-foreground" {...p}>{children}</strong>;
        },
        em: ({ children, ...p }: any) => {
            const text = typeof children === 'string' ? children : '';
            if (/exam\s+pitfall/i.test(text)) return <span className="font-semibold text-rose-700 dark:text-rose-400 not-italic" {...p}>{children}</span>;
            return <em className="text-stone-600 dark:text-stone-400" {...p}>{children}</em>;
        },
        ul: ({ children, ...p }: any) => <ul className="my-3 ml-1 space-y-2 list-none" {...p}>{children}</ul>,
        ol: ({ children, ...p }: any) => <ol className="my-3 ml-1 space-y-2 list-decimal list-inside" {...p}>{children}</ol>,
        li: ({ children, ...p }: any) => (
            <li className="text-[15px] leading-relaxed text-foreground/85 pl-4 relative before:content-[''] before:absolute before:left-0 before:top-[11px] before:w-1.5 before:h-1.5 before:rounded-full before:bg-amber-400 dark:before:bg-amber-600" {...p}>
                {processChildren(children, onCite)}
            </li>
        ),
        blockquote: ({ children, ...p }: any) => (
            <blockquote className="my-4 pl-4 border-l-[3px] border-amber-300 dark:border-amber-700 bg-amber-50/30 dark:bg-amber-950/10 py-2.5 pr-3 rounded-r-lg text-stone-700 dark:text-stone-300 italic" {...p}>{children}</blockquote>
        ),
        hr: () => <hr className="my-6 border-t border-amber-200/30 dark:border-amber-800/15" />,
    }), [onCite]);
}

/* ================================================================
   MAIN CAROUSEL
   ================================================================ */
export default function MasteryCarousel({ task, onComplete }: CarouselProps) {
    const { getIdToken } = useAuth();
    const [loading, setLoading] = useState(true);
    const [content, setContent] = useState<any>(null);

    // View + sub-state
    const [view, setView] = useState<'NARRATIVE' | 'EXHIBIT' | 'ASSESSMENT' | 'COMPLETE'>('NARRATIVE');
    const [currentSlide, setCurrentSlide] = useState(0);
    const [stackLevel, setStackLevel] = useState(1);
    const [mcqAnswer, setMcqAnswer] = useState<number | null>(null);
    const [mcqPassed, setMcqPassed] = useState(false);

    // Fullscreen
    const [isMaximized, setIsMaximized] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    // Text selection
    const [selectionPos, setSelectionPos] = useState<{ x: number; y: number } | null>(null);
    const [selectedText, setSelectedText] = useState('');
    const [aiLoading, setAiLoading] = useState(false);
    const narrativeRef = useRef<HTMLDivElement>(null);

    // Statute panel
    const [activeCitation, setActiveCitation] = useState<ParsedCitation | null>(null);

    // Session cache
    const cacheKey = `mastery_session_${task.data.id}`;

    const saveProgress = useCallback((updates?: { v?: string; s?: number; l?: number }) => {
        try {
            sessionStorage.setItem(cacheKey, JSON.stringify({
                view: updates?.v || view,
                currentSlide: updates?.s ?? currentSlide,
                stackLevel: updates?.l ?? stackLevel,
                content, timestamp: Date.now(),
            }));
        } catch { /* quota */ }
    }, [cacheKey, view, currentSlide, stackLevel, content]);

    /* ---- Text Selection ---- */
    const handleMouseUp = useCallback(() => {
        const sel = window.getSelection();
        const text = sel?.toString().trim();
        if (text && text.length > 3) {
            const range = sel?.getRangeAt(0);
            if (range) {
                const rect = range.getBoundingClientRect();
                setSelectedText(text);
                setSelectionPos({
                    x: Math.min(rect.left + rect.width / 2 - 130, window.innerWidth - 340),
                    y: Math.max(rect.top - 54, 8),
                });
            }
        } else {
            setTimeout(() => { if (!aiLoading) { setSelectionPos(null); setSelectedText(''); } }, 200);
        }
    }, [aiLoading]);

    const handleCopy = useCallback(() => {
        navigator.clipboard.writeText(selectedText);
        setSelectionPos(null); setSelectedText('');
    }, [selectedText]);

    const handleSimplify = useCallback(async () => {
        if (!selectedText || aiLoading) return;
        setAiLoading(true);
        try {
            const token = await getIdToken();
            const res = await fetch('/api/ai/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ message: `Rephrase the following legal text in simpler, clearer language while preserving all legal accuracy and meaning. Return ONLY the rephrased text.\n\n"${selectedText}"`, intent: 'study' }),
            });
            if (res.ok) {
                const data = await res.json();
                const simple = data.response || data.content || '';
                if (simple) {
                    const secs = [...(content?.narrativeSections || [])];
                    const cur = secs[currentSlide] || '';
                    if (cur.includes(selectedText)) {
                        secs[currentSlide] = cur.replace(selectedText, simple);
                        setContent({ ...content, narrativeSections: secs });
                    }
                }
            }
        } catch (e) { console.error('Simplify failed:', e); }
        finally { setAiLoading(false); setSelectionPos(null); setSelectedText(''); }
    }, [selectedText, aiLoading, getIdToken, content, currentSlide]);

    // Ask AI → opens FloatingChat with prefilled prompt
    const handleAskAI = useCallback(() => {
        if (!selectedText) return;
        const prompt = `Explain this in the context of Kenyan law:\n\n"${selectedText}"`;
        window.dispatchEvent(new CustomEvent('ynai:openChat', { detail: { prefill: prompt } }));
        setSelectionPos(null); setSelectedText('');
        window.getSelection()?.removeAllRanges();
    }, [selectedText]);

    const clearSelection = useCallback(() => {
        setSelectionPos(null); setSelectedText('');
        window.getSelection()?.removeAllRanges();
    }, []);

    /* ---- Citation Click ---- */
    const handleCitationClick = useCallback((c: ParsedCitation) => { setActiveCitation(c); }, []);

    /* ---- Fullscreen ---- */
    const toggleMaximize = useCallback(() => setIsMaximized(p => !p), []);

    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') { if (activeCitation) setActiveCitation(null); else if (isMaximized) setIsMaximized(false); }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [isMaximized, activeCitation]);

    /* ---- Fetch Content ---- */
    useEffect(() => {
        const load = async () => {
            try {
                const cached = sessionStorage.getItem(cacheKey);
                if (cached) {
                    const s = JSON.parse(cached);
                    if (s.content && Date.now() - s.timestamp < 2 * 3600_000) {
                        setContent(s.content); setView(s.view || 'NARRATIVE');
                        setCurrentSlide(s.currentSlide || 0); setStackLevel(s.stackLevel || 1);
                        setLoading(false); return;
                    }
                }
            } catch { /* fresh */ }
            const token = await getIdToken();
            try {
                const params = new URLSearchParams({ skillId: task.data.id, type: task.type });
                const res = await fetch(`/api/mastery/content?${params}`, { headers: { Authorization: `Bearer ${token}` } });
                if (!res.ok) throw new Error();
                const data = await res.json();
                setContent(data);
                try { sessionStorage.setItem(cacheKey, JSON.stringify({ view: 'NARRATIVE', currentSlide: 0, stackLevel: 1, content: data, timestamp: Date.now() })); } catch {}
            } catch (e) { console.error('Failed to load content', e); }
            finally { setLoading(false); }
        };
        load();
    }, [task, getIdToken, cacheKey]);

    /* ---- Navigation ---- */
    const handleNext = useCallback(() => {
        if (view === 'NARRATIVE') {
            if (currentSlide < (content?.narrativeSections?.length || 0) - 1) {
                const n = currentSlide + 1; setCurrentSlide(n); saveProgress({ s: n });
            } else {
                const next = content?.exhibit ? 'EXHIBIT' : 'ASSESSMENT';
                setView(next as any); saveProgress({ v: next });
            }
        } else if (view === 'EXHIBIT') {
            setView('ASSESSMENT'); saveProgress({ v: 'ASSESSMENT' });
        }
    }, [view, currentSlide, content, saveProgress]);

    const handleBack = useCallback(() => {
        if (view === 'NARRATIVE' && currentSlide > 0) {
            const p = currentSlide - 1; setCurrentSlide(p); saveProgress({ s: p });
        } else if (view === 'EXHIBIT') {
            setView('NARRATIVE');
            const last = (content?.narrativeSections?.length || 1) - 1;
            setCurrentSlide(last); saveProgress({ v: 'NARRATIVE', s: last });
        } else if (view === 'ASSESSMENT' && stackLevel === 1) {
            if (content?.exhibit) { setView('EXHIBIT'); saveProgress({ v: 'EXHIBIT' }); }
            else { setView('NARRATIVE'); const last = (content?.narrativeSections?.length || 1) - 1; setCurrentSlide(last); saveProgress({ v: 'NARRATIVE', s: last }); }
        }
    }, [view, currentSlide, content, stackLevel, saveProgress]);

    const canGoBack = (view === 'NARRATIVE' && currentSlide > 0) || view === 'EXHIBIT' || (view === 'ASSESSMENT' && stackLevel === 1);

    // Markdown components (memoised per citation handler)
    const mdComponents = useMdComponents(handleCitationClick);

    /* ---- Loading / Error ---- */
    if (loading) return <EngagingLoader size="md" message="Preparing your study materials..." />;
    if (!content) {
        return (
            <div className="p-8 text-center border border-border rounded-xl bg-card">
                <AlertTriangle className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
                <h3 className="font-semibold text-sm">Unable to load content</h3>
                <p className="text-xs text-muted-foreground mt-1">Please try again or select a different topic.</p>
            </div>
        );
    }

    // Shared container class
    const wrap = isMaximized ? 'fixed inset-0 z-40 bg-background flex flex-col p-0' : 'w-full px-2 sm:px-3';
    const cardHeight = isMaximized ? 'h-full' : 'h-[calc(100vh-100px)]';

    /* ============================================================
       VIEW: EXHIBIT
       ============================================================ */
    if (view === 'EXHIBIT' && content.exhibit) {
        return (
            <div ref={containerRef} className={wrap}>
                <div className={cn('animate-in fade-in duration-500 flex flex-col', cardHeight)}>
                    <Card className="flex-1 flex flex-col border-amber-400/50 dark:border-amber-700/40 bg-card shadow-lg overflow-hidden rounded-xl">
                        <div className="flex items-center justify-between px-4 py-3 border-b bg-amber-50/80 dark:bg-amber-950/30">
                            <div className="flex items-center gap-3 min-w-0">
                                <div className="p-1.5 bg-amber-200 dark:bg-amber-800 rounded-lg"><BookOpen className="h-4 w-4 text-amber-900 dark:text-amber-200" /></div>
                                <div className="min-w-0">
                                    <h2 className="text-base font-semibold text-amber-900 dark:text-amber-200 truncate">{content.exhibit.title}</h2>
                                    <p className="text-[10px] text-amber-700/60 dark:text-amber-400/50 uppercase tracking-widest font-medium">Source Material</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button onClick={toggleMaximize} className="p-1.5 rounded-md hover:bg-amber-200/60 dark:hover:bg-amber-800/40 text-amber-700 dark:text-amber-400 transition-colors">
                                    {isMaximized ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                                </button>
                                <Badge variant="outline" className="bg-white dark:bg-zinc-900 text-amber-800 dark:text-amber-400 border-amber-300 dark:border-amber-700 text-[10px]">Reference</Badge>
                            </div>
                        </div>
                        <div className="flex-1 overflow-hidden">
                            <ScrollArea className="h-full">
                                <div className="p-5 sm:p-8 lg:p-10">
                                    <div className="prose prose-sm md:prose-base max-w-none dark:prose-invert font-serif border border-amber-200/30 dark:border-amber-800/20 p-6 sm:p-10 shadow-sm bg-white dark:bg-zinc-950 rounded-lg min-h-[400px]">
                                        <ReactMarkdown>{content.exhibit.content}</ReactMarkdown>
                                    </div>
                                </div>
                            </ScrollArea>
                        </div>
                        <div className="px-4 py-3 border-t bg-amber-50/60 dark:bg-amber-950/20 flex justify-between items-center">
                            <button onClick={handleBack} className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-sm text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors font-medium">
                                <ChevronLeft className="h-4 w-4" /> Back
                            </button>
                            <Button onClick={handleNext} className="bg-amber-800 hover:bg-amber-700 dark:bg-amber-700 dark:hover:bg-amber-600 text-white shadow-md px-5" size="default">
                                Continue to Assessment <ArrowRight className="ml-2 h-4 w-4" />
                            </Button>
                        </div>
                    </Card>
                </div>
            </div>
        );
    }

    /* ============================================================
       VIEW: ASSESSMENT
       ============================================================ */
    if (view === 'ASSESSMENT') {
        const assessment = content.stack?.stack?.find((s: any) => s.level === stackLevel);
        if (!assessment) {
            return (
                <div ref={containerRef} className={wrap}>
                    <div className="animate-in zoom-in duration-300 flex items-center justify-center min-h-[60vh]">
                        <Card className="w-full max-w-lg text-center py-12 border-emerald-200/60 dark:border-emerald-900/40 bg-emerald-50/20 dark:bg-emerald-950/10 rounded-xl">
                            <CardContent className="space-y-6">
                                <div className="relative"><div className="absolute inset-0 bg-emerald-200 rounded-full blur-xl opacity-40 animate-pulse" /><CheckCircle2 className="h-16 w-16 text-emerald-600 mx-auto relative z-10" /></div>
                                <div><h2 className="text-2xl font-bold">Topic Complete</h2><p className="text-muted-foreground mt-1">Well done - you&apos;ve covered this section.</p></div>
                                <Button onClick={() => { try { sessionStorage.removeItem(cacheKey); } catch {} onComplete({ passed: true, score: 100 }); }} size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-md px-8 py-5 rounded-xl">Back to Mastery Hub</Button>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            );
        }
        return (
            <div ref={containerRef} className={wrap}>
                <div className={cn('animate-in slide-in-from-right duration-300 flex flex-col', cardHeight)}>
                    <Card className="flex-1 flex flex-col border-t-2 border-t-primary shadow-lg overflow-hidden rounded-xl">
                        <div className="px-5 py-4 border-b bg-card">
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                    {canGoBack && <button onClick={handleBack} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"><ChevronLeft className="h-4 w-4" /></button>}
                                    <Badge variant="secondary" className="bg-primary/10 text-primary">Question {stackLevel}</Badge>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] text-muted-foreground tabular-nums">{stackLevel} of {content.stack?.stack?.length || 3}</span>
                                    <button onClick={toggleMaximize} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground transition-colors">{isMaximized ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}</button>
                                </div>
                            </div>
                            <h3 className="text-base font-semibold leading-snug text-foreground">{assessment.title || 'Assessment'}</h3>
                        </div>
                        <div className="flex-1 overflow-hidden">
                            <ScrollArea className="h-full">
                                <div className="p-5 sm:p-6">
                                    <p className="text-[15px] leading-[1.8] text-foreground/90 mb-5">{assessment.question}</p>
                                    {assessment.type === 'MCQ' && (
                                        <div className="space-y-3">
                                            {assessment.options.map((opt: string, idx: number) => {
                                                const isSelected = mcqAnswer === idx;
                                                const isCorrect = idx === assessment.correctIndex;
                                                const showCorrect = mcqPassed && isCorrect;
                                                const showWrong = isSelected && !mcqPassed && mcqAnswer !== null;
                                                return (
                                                    <button key={idx} onClick={() => {
                                                        if (mcqPassed) return; setMcqAnswer(idx);
                                                        if (isCorrect) { setMcqPassed(true); setTimeout(() => { setMcqPassed(false); setMcqAnswer(null); const nl = stackLevel + 1; setStackLevel(nl); saveProgress({ l: nl }); }, 1800); }
                                                    }} disabled={mcqPassed}
                                                        className={cn(
                                                            'w-full text-left flex items-start gap-3 p-4 rounded-xl border-2 transition-all duration-200',
                                                            !isSelected && !showCorrect && 'border-border/40 bg-card hover:border-amber-300/60 hover:bg-amber-50/30 dark:hover:bg-amber-950/10',
                                                            showCorrect && 'border-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 ring-1 ring-emerald-400',
                                                            showWrong && 'border-red-300 bg-red-50/50 dark:bg-red-950/20',
                                                            isSelected && !showWrong && !showCorrect && 'border-primary/40 bg-primary/5',
                                                        )}>
                                                        <span className={cn(
                                                            'flex-shrink-0 w-7 h-7 rounded-full border-2 flex items-center justify-center text-xs font-bold mt-0.5',
                                                            showCorrect && 'bg-emerald-500 border-emerald-500 text-white',
                                                            showWrong && 'bg-red-400 border-red-400 text-white',
                                                            !showCorrect && !showWrong && 'text-muted-foreground border-border/60',
                                                        )}>{showCorrect ? '✓' : showWrong ? '✗' : String.fromCharCode(65 + idx)}</span>
                                                        <span className="text-sm leading-relaxed text-foreground/90 whitespace-normal pt-0.5">{opt}</span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    )}
                                    {mcqPassed && assessment.explanation && (
                                        <div className="mt-5 p-4 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/50 dark:border-emerald-800/30 animate-in fade-in duration-300">
                                            <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 mb-1.5">Why this is correct:</p>
                                            <p className="text-sm text-emerald-600 dark:text-emerald-300/80 leading-relaxed">{assessment.explanation}</p>
                                        </div>
                                    )}
                                    {assessment.type !== 'MCQ' && (
                                        <div className="p-6 border border-dashed rounded-xl bg-muted/30 text-center">
                                            <p className="text-muted-foreground mb-3 text-sm">{assessment.type} questions coming soon.</p>
                                            <Button onClick={() => { const nl = stackLevel + 1; setStackLevel(nl); saveProgress({ l: nl }); }} variant="secondary" size="sm">Skip</Button>
                                        </div>
                                    )}
                                </div>
                            </ScrollArea>
                        </div>
                        <div className="px-5 py-3 border-t bg-muted/20 text-center"><p className="text-[11px] text-muted-foreground">Select the correct answer to continue</p></div>
                    </Card>
                </div>
            </div>
        );
    }

    /* ============================================================
       VIEW: NARRATIVE  (Study Notes)
       ============================================================ */
    const currentText = (content?.narrativeSections || [])[currentSlide] || 'Loading...';
    const totalSlides = content?.narrativeSections?.length || 1;
    const isLastSlide = currentSlide === totalSlides - 1;
    const progressPct = ((currentSlide + 1) / totalSlides) * 100;

    return (
        <div ref={containerRef} className={wrap}>
            {/* Selection Toolbar */}
            <SelectionToolbar position={selectionPos} selectedText={selectedText} onCopy={handleCopy} onSimplify={handleSimplify} onAskAI={handleAskAI} onClose={clearSelection} isLoading={aiLoading} />

            {/* Statute Side Panel */}
            <StatutePanel citation={activeCitation} onClose={() => setActiveCitation(null)} getIdToken={getIdToken} />

            {/* Study Notes Card */}
            <div className={cn('flex flex-col animate-in fade-in duration-400', cardHeight)}>
                <Card className="flex-1 flex flex-col shadow-lg border-border/50 overflow-hidden rounded-xl bg-card">
                    {/* ---- HEADER ---- */}
                    <div className="px-4 py-3 border-b bg-gradient-to-r from-amber-50/60 via-orange-50/20 to-transparent dark:from-amber-950/20 dark:via-transparent">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 min-w-0">
                                <BookOpen className="h-4 w-4 text-amber-700 dark:text-amber-400 flex-shrink-0" />
                                <span className="text-xs font-semibold text-amber-800 dark:text-amber-300">Study Notes</span>
                                <span className="text-muted-foreground text-xs mx-0.5">&middot;</span>
                                <span className="text-xs text-muted-foreground tabular-nums">{currentSlide + 1} of {totalSlides}</span>
                            </div>
                            <button onClick={toggleMaximize} className="p-1.5 rounded-md hover:bg-amber-100 dark:hover:bg-amber-900/30 text-muted-foreground hover:text-amber-700 dark:hover:text-amber-400 transition-colors" title={isMaximized ? 'Exit full screen' : 'Full screen'}>
                                {isMaximized ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                            </button>
                        </div>
                        <h2 className="text-lg font-bold text-foreground mt-1.5 truncate">{content.title || task.data.title || 'Study Material'}</h2>
                        <Progress value={progressPct} className="h-1 mt-2.5 bg-amber-100 dark:bg-amber-950/40 [&>div]:bg-amber-500 dark:[&>div]:bg-amber-600" />
                    </div>

                    {/* ---- CONTENT ---- */}
                    <div className="flex-1 overflow-hidden relative">
                        <ScrollArea className="h-full">
                            <div ref={narrativeRef} onMouseUp={handleMouseUp} className="p-5 sm:p-6 lg:p-8 pb-32 select-text cursor-text">
                                <ReactMarkdown components={mdComponents}>{currentText}</ReactMarkdown>
                            </div>
                        </ScrollArea>

                        {/* ---- BOTTOM ACTION BAR ---- */}
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-card via-card/98 to-transparent pt-12 pb-4 px-4 flex items-center justify-between">
                            <div>
                                {canGoBack ? (
                                    <button onClick={handleBack} className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors">
                                        <ChevronLeft className="h-4 w-4" /> Back
                                    </button>
                                ) : <div />}
                            </div>
                            <Button onClick={handleNext} size="default" className="shadow-md bg-emerald-600 hover:bg-emerald-500 dark:bg-emerald-700 dark:hover:bg-emerald-600 text-white px-6 py-2.5 rounded-xl transition-all font-medium">
                                {isLastSlide ? (content?.exhibit ? 'View Exhibit' : 'Start Assessment') : 'Continue'}
                                <ChevronRight className="ml-1.5 h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                </Card>
            </div>
        </div>
    );
}
