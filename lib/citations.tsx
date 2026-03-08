'use client';

import { useState, useEffect, Fragment } from 'react';
import { CheckCircle2, X, ExternalLink, Loader2, AlertTriangle, Scale } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { cn } from '@/lib/utils';

/* ================================================================
   CITATION DETECTION — Kenyan legal citation patterns
   ================================================================ */

// Statute: "section 45(1) of the Companies Act, 2015" etc.
export const STATUTE_RE =
    /(?:(?:[Ss]ection|s\.|[Aa]rt(?:icle)?\.?\s*|[Rr]ule|[Rr]egulation|[Oo]rder|[Ss]chedule|[Pp]art)\s+[\dIVXLCDM]+(?:\([^)]*\))*(?:\([^)]*\))?(?:\s+of\s+(?:the\s+)?)?)?(?:the\s+)?((?:[A-Z][A-Za-z''\u2019]+[\s,()-]*)+(?:Act|Regulations?|Rules?|Order|Code|Constitution|Ordinance)(?:,?\s*(?:Cap\.?\s*\d+|No\.?\s*\d+(?:\s+of\s+\d{4})?|\d{4}))?)(?:\s*[-\u2013]\s*((?:Part|Chapter|Section|Schedule|Division)\s+[IVXLCDM\d]+(?:\s*\([^)]*\))?))?/g;

// Case law: "Case Name [Year] eKLR" or "Case Name (Year) KLR"
export const CASE_RE =
    /([A-Z][A-Za-z''.\-]+(?:\s+(?:v|vs?\.?|&|and)\s+[A-Z][A-Za-z''.\-]+(?:\s+[A-Za-z''.\-]+)*)?)\s+(\[\d{4}\]\s*eKLR|\(\d{4}\)\s*(?:\d+\s+)?KLR\s*[\d\s]*|\[\d{4}\]\s*\d*\s*(?:EA|KLR)\s*\d*)/g;

// Inline "section NN(N)" references
export const SECTION_INLINE_RE = /[Ss]ection\s+\d+(?:\([^)]*\))*/g;

export type CitationType = 'statute' | 'case' | 'section';

export interface ParsedCitation {
    fullMatch: string;
    statute: string;
    section?: string;
    startIndex: number;
    endIndex: number;
    type: CitationType;
}

export function parseCitations(text: string): ParsedCitation[] {
    const results: ParsedCitation[] = [];
    const occupied = new Set<number>();

    const claim = (start: number, end: number): boolean => {
        for (let i = start; i < end; i++) if (occupied.has(i)) return false;
        for (let i = start; i < end; i++) occupied.add(i);
        return true;
    };

    // 1) Statutes
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

    // 3) Inline section refs
    const iRe = new RegExp(SECTION_INLINE_RE.source, SECTION_INLINE_RE.flags);
    while ((m = iRe.exec(text)) !== null) {
        if (!claim(m.index, m.index + m[0].length)) continue;
        results.push({ fullMatch: m[0], statute: m[0], startIndex: m.index, endIndex: m.index + m[0].length, type: 'section' });
    }

    return results.sort((a, b) => a.startIndex - b.startIndex);
}

/* ================================================================
   CITATION LINK — clickable amber-styled inline token
   ================================================================ */
export function CitationLink({ text, onClick, type }: { text: string; onClick: () => void; type: CitationType }) {
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
            title={isCase ? `View on Kenya Law: ${text}` : `View statute: ${text}`}
        >
            {text}
            {isCase && <ExternalLink className="inline-block h-3 w-3 ml-0.5 mb-0.5 opacity-60" />}
        </button>
    );
}

/* ================================================================
   TEXT-WITH-CITATIONS — renders text with clickable citation hotspots
   ================================================================ */
export function TextWithCitations({ children, onCitationClick }: { children: string; onCitationClick: (c: ParsedCitation) => void }) {
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
   STATUTE SIDE-PANEL — shows verbatim statute or case law info
   ================================================================ */
export function StatutePanel({ citation, onClose, getIdToken }: { citation: ParsedCitation | null; onClose: () => void; getIdToken: () => Promise<string | null> }) {
    const [content, setContent] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(false);
    const [sourceInfo, setSourceInfo] = useState<{ name?: string; chapter?: string; url?: string; isVerbatim: boolean } | null>(null);

    useEffect(() => {
        if (!citation) return;
        let cancelled = false;
        setLoading(true); setContent(null); setError(false); setSourceInfo(null);
        (async () => {
            try {
                /* Phase 1: Supabase verbatim lookup (statutes/sections) */
                if (citation.type !== 'case') {
                    try {
                        const lookupRes = await fetch('/api/citations/lookup', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ type: 'statute', name: citation.statute, fullMatch: citation.fullMatch }),
                        });
                        const lookupData = await lookupRes.json();
                        if (lookupData.found) {
                            if (lookupData.excerpt || lookupData.fullText) {
                                if (!cancelled) {
                                    setContent(lookupData.excerpt || lookupData.fullText);
                                    setSourceInfo({ name: lookupData.name, chapter: lookupData.chapter, url: lookupData.url, isVerbatim: true });
                                    setLoading(false);
                                }
                                return;
                            }
                            if (lookupData.url && !cancelled) {
                                setSourceInfo({ name: lookupData.name, chapter: lookupData.chapter, url: lookupData.url, isVerbatim: false });
                            }
                        }
                    } catch { /* continue to AI */ }
                }

                /* Phase 1b: Case law — look up Kenya Law URL */
                if (citation.type === 'case') {
                    try {
                        const lookupRes = await fetch('/api/citations/lookup', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ type: 'case', name: citation.statute, fullMatch: citation.fullMatch }),
                        });
                        const lookupData = await lookupRes.json();
                        if (lookupData.found && lookupData.url) {
                            if (!cancelled) {
                                setSourceInfo({ name: lookupData.title, url: lookupData.url, isVerbatim: false });
                            }
                        }
                    } catch { /* continue */ }
                }

                /* Phase 2: AI fallback */
                const token = await getIdToken();
                const res = await fetch('/api/ai/chat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                    body: JSON.stringify({
                        message: citation.type === 'case'
                            ? `You are a Kenyan legal reference tool. The user clicked on this case citation: "${citation.fullMatch}".\n\nProvide:\n1. Full case name, court, and citation\n2. Brief facts (2-3 sentences)\n3. The key legal issue(s)\n4. The holding/ratio decidendi\n5. The principle of law established\n\nBe concise and accurate.`
                            : `You are a Kenyan legal reference tool. The user clicked on this citation: "${citation.fullMatch}".\n\nProvide the VERBATIM text of this statutory provision as it appears in Kenyan law:\n1. Full title of the Act/Regulation\n2. The specific Part/Section heading\n3. The verbatim section text with all sub-sections\n4. If you do not have the exact verbatim text, note that.\n\nUse proper legal formatting.`,
                        intent: 'study',
                    }),
                });
                if (!res.ok) throw new Error();
                const data = await res.json();
                if (!cancelled) setContent(data.response || data.content || 'Unable to retrieve text.');
            } catch { if (!cancelled) setError(true); } finally { if (!cancelled) setLoading(false); }
        })();
        return () => { cancelled = true; };
    }, [citation, getIdToken]);

    if (!citation) return null;
    const isVerbatim = sourceInfo?.isVerbatim ?? false;

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
                                {citation.type === 'case' ? 'Case Law' : isVerbatim ? 'Verbatim Statute' : 'Statute'}
                            </p>
                            <h3 className={cn("text-sm font-bold truncate", citation.type === 'case' ? "text-teal-900 dark:text-teal-300 italic" : "text-amber-900 dark:text-amber-300")}>
                                {sourceInfo?.name || citation.statute}
                            </h3>
                            {sourceInfo?.chapter && <p className="text-[11px] text-muted-foreground/70 mt-0.5">Cap. {sourceInfo.chapter}</p>}
                            {!sourceInfo?.chapter && citation.section && <p className="text-[11px] text-muted-foreground/70 mt-0.5">{citation.section}</p>}
                        </div>
                    </div>
                    <button onClick={onClose} className={cn("p-1.5 rounded-lg transition-colors flex-shrink-0", citation.type === 'case' ? "hover:bg-teal-200/50 dark:hover:bg-teal-800/30 text-teal-700 dark:text-teal-400" : "hover:bg-amber-200/50 dark:hover:bg-amber-800/30 text-amber-700 dark:text-amber-400")}>
                        <X className="h-4 w-4" />
                    </button>
                </div>
                {isVerbatim && (
                    <div className="px-5 pt-3">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-700/40">
                            <CheckCircle2 className="h-3 w-3" /> Verbatim from Kenya Law
                        </span>
                    </div>
                )}
                <div className="flex-1 overflow-y-auto">
                    <div className="p-5 sm:p-6">
                        {loading && (
                            <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
                                <Loader2 className="h-6 w-6 animate-spin text-amber-600" />
                                <p className="text-sm">Retrieving text&hellip;</p>
                            </div>
                        )}
                        {error && (
                            <div className="text-center py-16 text-muted-foreground">
                                <AlertTriangle className="h-6 w-6 mx-auto mb-2 text-amber-500" />
                                <p className="text-sm">Could not retrieve the text. Try again later.</p>
                            </div>
                        )}
                        {content && isVerbatim && (
                            <div className="text-[13px] leading-[1.85] whitespace-pre-wrap font-serif text-foreground/90 border border-amber-200/30 dark:border-amber-800/20 bg-amber-50/20 dark:bg-amber-950/10 rounded-lg p-4 sm:p-5">
                                {content}
                            </div>
                        )}
                        {content && !isVerbatim && (
                            <div className="prose prose-sm max-w-none dark:prose-invert">
                                <ReactMarkdown>{content}</ReactMarkdown>
                            </div>
                        )}
                    </div>
                </div>
                <div className="px-4 py-2.5 border-t bg-muted/30">
                    {sourceInfo?.url ? (
                        <a href={sourceInfo.url} target="_blank" rel="noopener noreferrer"
                           className="flex items-center justify-center gap-1.5 text-xs font-medium text-amber-700 dark:text-amber-400 hover:text-amber-900 dark:hover:text-amber-300 hover:underline transition-colors">
                            <ExternalLink className="h-3 w-3" /> View full text on Kenya Law
                        </a>
                    ) : (
                        <p className="text-[10px] text-muted-foreground text-center">Source: Kenya Law Reports</p>
                    )}
                </div>
            </div>
        </div>
    );
}
