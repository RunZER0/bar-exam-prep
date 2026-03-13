'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useTimeTracker } from '@/lib/hooks/useTimeTracker';
import { useSidebar } from '@/contexts/SidebarContext';
import { getDocumentById } from '@/lib/constants/legal-content';
import { Button } from '@/components/ui/button';
import { MarkdownRenderer } from '@/components/MarkdownRenderer';
import EngagingLoader from '@/components/EngagingLoader';
import TrialLimitReached from '@/components/TrialLimitReached';
import PremiumGate, { usePremiumGate } from '@/components/PremiumGate';
import FeatureLockedScreen from '@/components/FeatureLockedScreen';
import {
  ArrowLeft, FileText, PenLine, GraduationCap, Send, Loader2,
  Check, ChevronRight, ChevronLeft, Timer, TimerOff, RotateCcw,
  AlertCircle, CheckCircle2, ClipboardCheck, Sparkles, BookOpenCheck,
  Bold, Italic, Underline as UnderlineIcon, AlignLeft, AlignCenter, AlignRight, Indent, Outdent, List, ListOrdered, Lightbulb,
} from 'lucide-react';

type PageMode = null | 'learn' | 'practice';
type TimingChoice = 'timed' | 'untimed';
type LearnCompletion = null | 'aided' | 'unaided';

interface LearnSection {
  id: string;
  title: string;
  content: string;
  checkpoint?: { question: string; type: string; hint?: string };
}

interface GradeAnnotation {
  category: string;
  severity: 'good' | 'needs-improvement' | 'error';
  text: string;
  comment: string;
}

interface GradeResult {
  overallScore: number;
  grade: string;
  summary: string;
  categories: {
    structure: number;
    substance: number;
    legalAccuracy: number;
    language: number;
    formatting: number;
  };
  annotations: GradeAnnotation[];
  strengths: string[];
  improvements: string[];
}

/* ── Auto-expanding textarea hook ── */
function useAutoExpand(maxRows: number = 6) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const adjust = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    const lineH = parseInt(getComputedStyle(el).lineHeight) || 20;
    const max = lineH * maxRows;
    el.style.height = Math.min(el.scrollHeight, max) + 'px';
    el.style.overflowY = el.scrollHeight > max ? 'auto' : 'hidden';
  }, [maxRows]);
  return { ref, adjust };
}

/* ====== MAIN PAGE ====== */

export default function DraftingDocumentPage() {
  const params = useParams();
  const router = useRouter();
  const { getIdToken } = useAuth();
  useTimeTracker('drafting');
  const { setCollapsed } = useSidebar();
  const docId = params.documentId as string;
  const doc = getDocumentById(docId);
  const [mode, setMode] = useState<PageMode>(null);
  const [showTrialLimit, setShowTrialLimit] = useState<{tier?: string; used?: number; limit?: number; addonRemaining?: number} | null>(null);

  // Premium gate check
  const draftGate = usePremiumGate('drafting');

  // Collapse sidebar when a mode is active, restore on unmount or back
  useEffect(() => {
    if (mode) setCollapsed(true);
    return () => setCollapsed(false);
  }, [mode, setCollapsed]);

  // Show locked screen if no access
  if (!draftGate.isLoading && draftGate.isLocked) {
    return (
      <FeatureLockedScreen
        feature="drafting"
        tier={draftGate.tier}
        used={draftGate.used}
        limit={draftGate.limit}
        addonRemaining={draftGate.addonRemaining}
      />
    );
  }

  if (!doc) {
    return (
      <div className="p-6 md:p-10 max-w-5xl mx-auto">
        <Button variant="ghost" size="sm" onClick={() => router.push('/drafting')}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        <div className="text-center py-20">
          <FileText className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-muted-foreground">Document type not found.</p>
        </div>
      </div>
    );
  }

  if (!mode) {
    return (
      <div className="p-6 md:p-10 max-w-5xl mx-auto space-y-8 animate-content-enter">
        <Button variant="ghost" size="sm" onClick={() => router.push('/drafting')}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to Documents
        </Button>
        <div>
          <div className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1">
            {doc.category}
          </div>
          <h1 className="text-2xl md:text-3xl font-bold">{doc.name}</h1>
          <p className="text-muted-foreground mt-2 max-w-2xl">{doc.description}</p>
        </div>
        <div className="grid sm:grid-cols-2 gap-4 max-w-2xl">
          <button
            onClick={() => setMode('learn')}
            className="text-left p-6 rounded-2xl border border-border/40 hover:border-primary/30 transition-all group bg-card/50"
          >
            <div className="p-3 rounded-lg bg-primary/10 w-fit mb-3 group-hover:bg-primary/15 transition-colors">
              <GraduationCap className="h-6 w-6 text-primary" />
            </div>
            <h3 className="text-lg font-semibold mb-1">Learn to Draft</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Step-by-step guided lessons with practice checkpoints at each stage. Self-paced.
            </p>
          </button>
          <button
            onClick={() => setMode('practice')}
            className="text-left p-6 rounded-2xl border border-border/40 hover:border-primary/30 transition-all group bg-card/50"
          >
            <div className="p-3 rounded-lg bg-primary/10 w-fit mb-3 group-hover:bg-primary/15 transition-colors">
              <PenLine className="h-6 w-6 text-primary" />
            </div>
            <h3 className="text-lg font-semibold mb-1">Draft Now</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Jump into drafting. Choose timed or untimed. Submit for detailed grading with redline annotations.
            </p>
          </button>
        </div>
      </div>
    );
  }

  if (mode === 'learn') {
    return (
      <>
        <LearnModePanel doc={doc} onBack={() => setMode(null)} onPractice={() => setMode('practice')} getIdToken={getIdToken} onTrialLimit={(data?: any) => setShowTrialLimit(data || {})} />
        {showTrialLimit && <TrialLimitReached feature="drafting" currentTier={showTrialLimit.tier as any} used={showTrialLimit.used} limit={showTrialLimit.limit} addonRemaining={showTrialLimit.addonRemaining} onDismiss={() => { setShowTrialLimit(null); setMode(null); }} />}
      </>
    );
  }
  return (
    <>
      <PracticeModePanel doc={doc} onBack={() => setMode(null)} getIdToken={getIdToken} onTrialLimit={(data?: any) => setShowTrialLimit(data || {})} />
      {showTrialLimit && <TrialLimitReached feature="drafting" currentTier={showTrialLimit.tier as any} used={showTrialLimit.used} limit={showTrialLimit.limit} addonRemaining={showTrialLimit.addonRemaining} onDismiss={() => { setShowTrialLimit(null); setMode(null); }} />}
    </>
  );
}

function sanitizeExamScenario(raw: string): string {
  let text = (raw || '')
    .replace(/^SCENARIO:\s*/i, '')
    .replace(/\*\*/g, '')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^>\s?/gm, '')
    .replace(/^---+$/gm, '')
    .replace(/\u2014/g, '-')
    .trim();

  const forbiddenMarkers = [
    /\n\s*PROPER LEGAL STRUCTURE/i,
    /\n\s*PRACTICAL EXAM GUIDANCE/i,
    /\n\s*TEMPLATE/i,
    /\n\s*DRAFTING TEMPLATE/i,
    /\n\s*If you want,? I can/i,
    /\n\s*Show Drafting Hints/i,
  ];

  for (const marker of forbiddenMarkers) {
    const m = text.match(marker);
    if (m && m.index !== undefined) {
      text = text.slice(0, m.index).trim();
    }
  }

  return text;
}

/* ====== LEARN MODE ====== */

function LearnModePanel({
  doc,
  onBack,
  onPractice,
  getIdToken,
  onTrialLimit,
}: {
  doc: { id: string; name: string; description: string; category: string };
  onBack: () => void;
  onPractice: () => void;
  getIdToken: () => Promise<string | null>;
  onTrialLimit: (data?: any) => void;
}) {
  const [sections, setSections] = useState<LearnSection[]>([]);
  const [idx, setIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [cpAns, setCpAns] = useState('');
  const [cpFb, setCpFb] = useState<string | null>(null);
  const [cpOk, setCpOk] = useState<boolean | null>(null);
  const [evaling, setEvaling] = useState(false);
  const [done, setDone] = useState<Set<number>>(new Set());
  const [lessonComplete, setLessonComplete] = useState(false);
  const [loadingCheckpoint, setLoadingCheckpoint] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const cpTextarea = useAutoExpand(6);

  // Generate a checkpoint question for the current section (LIVE with GPT-5.2)
  const generateCheckpoint = useCallback(async (section: LearnSection, sectionIdx: number) => {
    if (section.checkpoint) return; // Already has one
    setLoadingCheckpoint(true);
    try {
      const token = await getIdToken();
      const cpPrompt = [
        'Generate ONE checkpoint question for a drafting lesson section.',
        '',
        'DOCUMENT TYPE: "' + doc.name + '"',
        'SECTION TITLE: "' + section.title + '"',
        'SECTION CONTENT (first 2000 chars): "' + section.content.slice(0, 2000) + '"',
        '',
        'Return ONLY valid JSON (no markdown fences):',
        '{"question": "A practical task for the student", "type": "identify", "hint": "A helpful hint"}',
        '',
        'The question should be a realistic task: identify facts, draft a paragraph, explain a requirement, etc.',
        'Make it specific to the content of this section under Kenyan law.',
      ].join('\n');

      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({
          message: cpPrompt,
          competencyType: 'drafting',
          context: { documentType: doc.name, mode: 'checkpoint-generate' },
        }),
      });
      if (res.ok) {
        const data = await res.json();
        try {
          const raw = data.response;
          const m = raw.match(/\{[\s\S]*\}/);
          const parsed = m ? JSON.parse(m[0]) : JSON.parse(raw);
          setSections(prev => prev.map((s, i) =>
            i === sectionIdx ? { ...s, checkpoint: parsed } : s
          ));
        } catch {
          // Could not parse — section just won't have a checkpoint
        }
      }
    } catch {
      // Non-critical — section works without checkpoint
    } finally {
      setLoadingCheckpoint(false);
    }
  }, [doc, getIdToken]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const token = await getIdToken();

        // ── STEP 1: Try fetching pre-built manual ──
        let prebuiltSections: LearnSection[] | null = null;
        try {
          const manualRes = await fetch('/api/drafting/manual?documentId=' + encodeURIComponent(doc.id), {
            headers: { Authorization: 'Bearer ' + token },
          });
          if (manualRes.ok) {
            const manualData = await manualRes.json();
            if (manualData.prebuilt && Array.isArray(manualData.sections)) {
              prebuiltSections = manualData.sections.map((s: any, i: number) => ({
                id: s.id || `section-${i + 1}`,
                title: s.title || `Section ${i + 1}`,
                content: s.content || '',
                // No checkpoint — will be generated live per section
              }));
            }
          }
        } catch {
          // Pre-built fetch failed — fall through to live generation
        }

        if (cancelled) return;

        if (prebuiltSections && prebuiltSections.length > 0) {
          // ── Pre-built manual found — use it ──
          setSections(prebuiltSections);
          setLoading(false);
          return;
        }

        // ── STEP 2: Fallback — generate live (original behavior) ──
        const prompt = [
          'Generate a comprehensive step-by-step guide to drafting a "' + doc.name + '" under Kenyan law.',
          '',
          'Return ONLY a JSON array (no markdown fences). Each element:',
          '{',
          '  "id": "section-1",',
          '  "title": "Section Title",',
          '  "content": "Detailed markdown explaining this step with examples from Kenyan practice...",',
          '  "checkpoint": {',
          '    "question": "A practice task for the student",',
          '    "type": "identify",',
          '    "hint": "A helpful hint"',
          '  }',
          '}',
          '',
          'Cover 5-7 sections:',
          '1. Purpose and when this document is used in Kenya',
          '2. Facts and parties with a mini case scenario',
          '3. Structure and format requirements',
          '4. Key legal provisions and mandatory contents',
          '5. Drafting the opening/introductory parts',
          '6. Drafting the substantive body',
          '7. Closing, verification, and filing requirements',
          '',
          'Each checkpoint: realistic task (identify facts, draft a paragraph, explain a requirement).',
        ].join('\n');

        const res = await fetch('/api/ai/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
          body: JSON.stringify({
            message: prompt,
            competencyType: 'drafting',
            context: { documentType: doc.name, mode: 'learn-generate', category: doc.category },
          }),
        });
        if (!res.ok) {
          if (res.status === 403) {
            const errData = await res.json();
            if (errData.error === 'FREE_TRIAL_LIMIT' || errData.error === 'FEATURE_LIMIT') { onTrialLimit({ tier: errData.tier, used: errData.used, limit: errData.limit, addonRemaining: errData.addonRemaining }); return; }
          }
          throw new Error('fetch failed');
        }
        const data = await res.json();
        if (cancelled) return;
        let parsed: LearnSection[];
        try {
          const raw = data.response;
          const m = raw.match(/\[[\s\S]*\]/);
          parsed = m ? JSON.parse(m[0]) : JSON.parse(raw);
        } catch {
          parsed = [{ id: 'section-1', title: 'Drafting a ' + doc.name, content: data.response }];
        }
        setSections(parsed);
      } catch (err) {
        console.error(err);
        setSections([{
          id: 'error',
          title: 'Content Generation',
          content: 'Preparing your guide to drafting a **' + doc.name + '**. Please retry.',
        }]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [doc, getIdToken]);

  // Generate checkpoint for the current section (live with GPT-5.2)
  useEffect(() => {
    if (sections.length > 0 && sections[idx] && !sections[idx].checkpoint && !loading) {
      generateCheckpoint(sections[idx], idx);
    }
  }, [idx, sections, loading, generateCheckpoint]);

  const evalCp = async () => {
    if (!cpAns.trim() || !sections[idx]?.checkpoint) return;
    setEvaling(true);
    setCpFb(null);
    setCpOk(null);
    try {
      const token = await getIdToken();
      const sec = sections[idx];
      const evalPrompt = [
        'Evaluate this student answer to a drafting checkpoint.',
        '',
        'DOCUMENT TYPE: "' + doc.name + '"',
        'SECTION: "' + sec.title + '"',
        'QUESTION: "' + (sec.checkpoint?.question || '') + '"',
        'ANSWER: "' + cpAns + '"',
        '',
        'Evaluate if the answer shows understanding. Be encouraging but honest.',
        'Give specific feedback on strengths and gaps. Under 150 words.',
        'End with exactly "VERDICT: PASS" or "VERDICT: NEEDS_REVIEW".',
      ].join('\n');

      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({
          message: evalPrompt,
          competencyType: 'drafting',
          context: { documentType: doc.name, mode: 'checkpoint-eval' },
        }),
      });
      const data = await res.json();
      const txt = data.response;
      const passed = txt.includes('VERDICT: PASS');
      setCpOk(passed);
      setCpFb(txt.replace(/VERDICT:\s*(PASS|NEEDS_REVIEW)/g, '').trim());
      if (passed) setDone(prev => new Set([...prev, idx]));
    } catch {
      setCpFb('Unable to evaluate right now.');
    } finally {
      setEvaling(false);
    }
  };

  const nav = (i: number) => {
    setIdx(i);
    setCpAns('');
    setCpFb(null);
    setCpOk(null);
    scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (loading) {
    return <EngagingLoader size="lg" message={'Preparing your guide to drafting a ' + doc.name + '...'} />;
  }

  /* ── Lesson complete: prompt to draft full document ── */
  if (lessonComplete) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-3.5rem)] bg-background animate-content-enter">
        <div className="max-w-lg mx-auto text-center px-6 py-16 space-y-6">
          <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto">
            <BookOpenCheck className="h-8 w-8 text-green-600" />
          </div>
          <div>
            <h2 className="text-2xl font-bold mb-2">Lesson Complete!</h2>
            <p className="text-muted-foreground leading-relaxed">
              You have learned how to draft a <strong>{doc.name}</strong> step by step.
              Now put it all together — draft the full document from start to finish.
            </p>
          </div>
          <div className="space-y-3 max-w-sm mx-auto">
            <button
              onClick={onPractice}
              className="w-full p-4 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
            >
              <PenLine className="h-4 w-4" /> Draft Now — Full Document
            </button>
            <button
              onClick={onBack}
              className="w-full p-3 rounded-xl text-sm text-muted-foreground hover:bg-muted transition-colors"
            >
              Back to Document Selection
            </button>
          </div>
        </div>
      </div>
    );
  }

  const sec = sections[idx];
  const isLast = idx === sections.length - 1;
  const hasCp = !!sec?.checkpoint;
  const canNext = !hasCp || done.has(idx);

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] bg-background animate-content-enter">
      <div className="border-b border-border/20 bg-card/40 px-4 py-3 shrink-0">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={onBack} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate">Learn: {doc.name}</p>
              <p className="text-xs text-muted-foreground">
                Step {idx + 1} of {sections.length}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {sections.map((_, i) => (
              <button
                key={i}
                onClick={() => nav(i)}
                className={'w-2.5 h-2.5 rounded-full transition-colors ' +
                  (i === idx
                    ? 'bg-primary'
                    : done.has(i)
                    ? 'bg-green-500'
                    : 'bg-muted-foreground/20'
                  )}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <nav className="hidden md:flex w-56 shrink-0 border-r border-border/20 flex-col overflow-y-auto py-4 px-3 gap-0.5">
          {sections.map((s, i) => (
            <button
              key={i}
              onClick={() => nav(i)}
              className={'text-left px-3 py-2 rounded-lg text-sm transition-colors ' +
                (i === idx
                  ? 'bg-primary/10 text-primary font-medium'
                  : 'text-muted-foreground hover:bg-muted'
                )}
            >
              <div className="flex items-center gap-2">
                {done.has(i) ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
                ) : (
                  <span className="w-3.5 h-3.5 rounded-full border border-current text-[10px] flex items-center justify-center shrink-0">
                    {i + 1}
                  </span>
                )}
                <span className="truncate">{s.title}</span>
              </div>
            </button>
          ))}
        </nav>

        <div ref={scrollRef} className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
            {sec && (
              <>
                <h2 className="text-xl font-bold mb-6">{sec.title}</h2>
                <div className="text-sm leading-relaxed">
                  <MarkdownRenderer content={sec.content} size="sm" />
                </div>

                {hasCp && (
                  <div className="mt-8 rounded-xl bg-muted/30 p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <ClipboardCheck className="h-4 w-4 text-primary" />
                      <h3 className="text-sm font-semibold">Practice Checkpoint</h3>
                    </div>
                    <p className="text-sm mb-2">{sec.checkpoint!.question}</p>
                    {sec.checkpoint!.hint && (
                      <p className="text-xs text-muted-foreground italic mb-3">
                        Hint: {sec.checkpoint!.hint}
                      </p>
                    )}
                    <textarea
                      ref={cpTextarea.ref}
                      value={cpAns}
                      onChange={(e) => { setCpAns(e.target.value); cpTextarea.adjust(); }}
                      rows={2}
                      placeholder="Type your answer here..."
                      className="w-full rounded-lg bg-background/80 px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-primary/20 border-0 transition-all"
                      style={{ overflow: 'hidden' }}
                    />
                    <div className="flex items-center gap-3 mt-3">
                      <Button size="sm" onClick={evalCp} disabled={!cpAns.trim() || evaling}>
                        {evaling ? (
                          <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />Evaluating...</>
                        ) : (
                          'Submit Answer'
                        )}
                      </Button>
                      {cpOk !== null && (
                        <span className={'text-xs font-medium flex items-center gap-1 ' + (cpOk ? 'text-green-600' : 'text-amber-600')}>
                          {cpOk ? (
                            <><CheckCircle2 className="h-3.5 w-3.5" /> Passed</>
                          ) : (
                            <><AlertCircle className="h-3.5 w-3.5" /> Review and retry</>
                          )}
                        </span>
                      )}
                    </div>
                    {cpFb && (
                      <div className={'mt-3 rounded-lg p-3 text-sm ' + (cpOk ? 'bg-green-500/5' : 'bg-amber-500/5')}>
                        <MarkdownRenderer content={cpFb} size="sm" />
                      </div>
                    )}
                  </div>
                )}

                {!hasCp && loadingCheckpoint && (
                  <div className="mt-8 rounded-xl bg-muted/30 p-5 animate-pulse">
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                      <span className="text-sm text-muted-foreground">Preparing checkpoint question...</span>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between mt-8 pt-6 border-t border-border/20">
                  <Button variant="ghost" size="sm" onClick={() => nav(idx - 1)} disabled={idx === 0}>
                    <ChevronLeft className="h-4 w-4 mr-1" /> Previous
                  </Button>
                  {isLast ? (
                    <Button size="sm" onClick={() => setLessonComplete(true)} className="gap-1.5">
                      <Check className="h-4 w-4" /> Complete Lesson
                    </Button>
                  ) : (
                    <Button size="sm" onClick={() => nav(idx + 1)} disabled={!canNext} className="gap-1.5">
                      Next Step <ChevronRight className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ====== PRACTICE MODE ====== */

function PracticeModePanel({
  doc,
  onBack,
  getIdToken,
  onTrialLimit,
}: {
  doc: { id: string; name: string; description: string; category: string };
  onBack: () => void;
  getIdToken: () => Promise<string | null>;
  onTrialLimit: (data?: any) => void;
}) {
  const [timing, setTiming] = useState<TimingChoice | null>(null);
  const [scenario, setScenario] = useState<string | null>(null);
  const [useOwnCase, setUseOwnCase] = useState(false);
  const [loadingScn, setLoadingScn] = useState(false);
  const [draft, setDraft] = useState('');
  const [timeLeft, setTimeLeft] = useState(0);
  const [timerOn, setTimerOn] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [grading, setGrading] = useState(false);
  const [grade, setGrade] = useState<GradeResult | null>(null);
  const [activeAnn, setActiveAnn] = useState<number | null>(null);
  const ivRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoSubmitRef = useRef(false);
  const [timeExpired, setTimeExpired] = useState(false);
  const draftRef = useRef<HTMLDivElement>(null);
  const MINS = 45;

  useEffect(() => {
    if (timerOn && timeLeft > 0) {
      ivRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) { setTimerOn(false); setTimeExpired(true); return 0; }
          return prev - 1;
        });
      }, 1000);
    }
    return () => { if (ivRef.current) clearInterval(ivRef.current); };
  }, [timerOn, timeLeft]);

  // Auto-submit when timer expires (same pattern as exams page)
  useEffect(() => {
    if (timeExpired && !submitted && !autoSubmitRef.current) {
      autoSubmitRef.current = true;
      submitDraft();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeExpired, submitted]);

  const fmtTime = (s: number) => Math.floor(s / 60) + ':' + (s % 60).toString().padStart(2, '0');

  const start = async (choice: TimingChoice) => {
    setTiming(choice);

    // If user wants to use their own case, skip AI scenario generation
    if (useOwnCase) {
      setScenario(null); // No preset scenario — user drafts from their own facts
      if (choice === 'timed') {
        setTimeLeft(MINS * 60);
        setTimerOn(true);
      }
      return;
    }

    setLoadingScn(true);
    try {
      const token = await getIdToken();
      const scenarioPrompt = [
        'Generate a realistic exam-style scenario for drafting a "' + doc.name + '" under Kenyan law.',
        '',
        'Provide specific facts: names, dates, amounts, locations in Kenya.',
        'Self-contained with all information needed. 3-5 key issues. Under 250 words.',
        'Begin directly with the facts.',
        '',
        'STRICT EXAM MODE RULES (MANDATORY):',
        '- Output ONLY the factual scenario and issues for drafting.',
        '- Do NOT include drafting templates, structures, sample headings, or legal form examples.',
        '- Do NOT include guidance, coaching, hints, examiner notes, or follow-up offers.',
        '- Do NOT include phrases like "If you want, I can draft..." or "Show Drafting Hints".',
        '- Output PLAIN TEXT only. No markdown, no bullet symbols except numbered issues as "1)" "2)".',
        '- Use regular hyphens (-) instead of em dashes. Never use the character \u2014.',
      ].join('\n');

      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({
          message: scenarioPrompt,
          competencyType: 'drafting',
          context: { documentType: doc.name, mode: 'scenario-generate' },
        }),
      });
      if (!res.ok) {
        if (res.status === 403) {
          const errData = await res.json();
          if (errData.error === 'FREE_TRIAL_LIMIT' || errData.error === 'FEATURE_LIMIT') { onTrialLimit({ tier: errData.tier, used: errData.used, limit: errData.limit, addonRemaining: errData.addonRemaining }); return; }
        }
        throw new Error('fetch failed');
      }
      const data = await res.json();
      // Strip any leftover markdown formatting from AI
      const cleanScenario = sanitizeExamScenario(data.response);
      setScenario(cleanScenario);
      if (choice === 'timed') {
        setTimeLeft(MINS * 60);
        setTimerOn(true);
      }
    } catch {
      // Fallback: provide a generic but real scenario instead of leaving it empty
      const fallbackScenarios: Record<string, string> = {
        pleadings: `John Mwangi of Nairobi wishes to sue ABC Enterprises Ltd for breach of contract. On 15th January 2026, he entered into a supply agreement worth Kshs 2,500,000 for delivery of construction materials to his site in Kiambu County. The materials were to be delivered by 1st February 2026. Despite paying 60% upfront (Kshs 1,500,000), no delivery was made. He has demanded a refund through a demand letter dated 10th February 2026-but received no response.\n\nKey Issues:\n1) Whether the court has jurisdiction over this matter\n2) The appropriate remedies available\n3) Whether specific performance or damages should be sought`,
        affidavits: `Mary Wanjiku Kamau, a businesswoman residing in Westlands, Nairobi, needs to swear an affidavit in support of her application for an injunction. Her neighbour, Peter Otieno, has begun constructing a commercial building that encroaches 3 metres onto her property (LR No. 1234/5678). She has a valid title deed and a recent survey report from a licensed surveyor confirming the encroachment. Construction began on 1st March 2026 despite her written objections.\n\nKey Issues:\n1) The facts to be deposed\n2) The documents to be exhibited\n3) The prayers sought in the main application`,
        default: `Amina Hassan, an advocate of the High Court of Kenya, has been instructed by her client David Kipchoge, a retired civil servant residing in Eldoret, Uasin Gishu County. Mr. Kipchoge purchased a commercial plot (Plot LR No. 7890) in Eldoret Town on 5th December 2025 for Kshs 8,000,000 from Estate of the Late Samuel Cheruiyot. The vendor's representative, Jane Cheruiyot (administratrix), executed the sale agreement but has since refused to complete the transfer, claiming the Land Control Board consent was defective.\n\nKey Issues:\n1) The validity of the sale agreement\n2) The enforceability of the Land Control Board consent\n3) The appropriate legal remedies available\n4) Whether specific performance can be ordered`,
      };
      const category = doc.category?.toLowerCase() || '';
      const fb = fallbackScenarios[category] || fallbackScenarios.default;
      setScenario(fb);
      if (choice === 'timed') {
        setTimeLeft(MINS * 60);
        setTimerOn(true);
      }
    } finally {
      setLoadingScn(false);
    }
  };

  const submitDraft = async () => {
    if (!draft.trim()) return;
    setSubmitted(true);
    setGrading(true);
    setTimerOn(false);
    try {
      const token = await getIdToken();
      const gradePrompt = [
        'Grade this student draft of a "' + doc.name + '" under Kenyan law.',
        '',
        'SCENARIO:',
        scenario || '',
        '',
        'STUDENT DRAFT:',
        draft,
        '',
        'Return ONLY a JSON object (no markdown fences):',
        '{',
        '  "overallScore": 72,',
        '  "grade": "B",',
        '  "summary": "One-paragraph assessment...",',
        '  "categories": { "structure": 75, "substance": 70, "legalAccuracy": 68, "language": 80, "formatting": 65 },',
        '  "annotations": [{ "category": "structure", "severity": "needs-improvement", "text": "exact phrase from the draft", "comment": "Specific feedback" }],',
        '  "strengths": ["Good identification of parties"],',
        '  "improvements": ["Missing verification clause"]',
        '}',
        '',
        'Provide 5-10 annotations pointing to EXACT phrases from the draft.',
        'Be constructive and thorough.',
      ].join('\n');

      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({
          message: gradePrompt,
          competencyType: 'drafting',
          context: { documentType: doc.name, mode: 'grade' },
        }),
      });
      const data = await res.json();
      let parsed: GradeResult;
      try {
        const m = data.response.match(/\{[\s\S]*\}/);
        parsed = m ? JSON.parse(m[0]) : JSON.parse(data.response);
      } catch {
        parsed = {
          overallScore: 0, grade: '?', summary: data.response,
          categories: { structure: 0, substance: 0, legalAccuracy: 0, language: 0, formatting: 0 },
          annotations: [], strengths: [], improvements: [],
        };
      }
      setGrade(parsed);
    } catch {
      setGrade({
        overallScore: 0, grade: '?', summary: 'Grading failed. Please try again.',
        categories: { structure: 0, substance: 0, legalAccuracy: 0, language: 0, formatting: 0 },
        annotations: [], strengths: [], improvements: [],
      });
    } finally {
      setGrading(false);
    }
  };

  const redraft = () => {
    setSubmitted(false); setGrade(null); setActiveAnn(null);
    setTimeExpired(false); autoSubmitRef.current = false;
    if (timing === 'timed') { setTimeLeft(MINS * 60); setTimerOn(true); }
  };

  const newScenario = () => {
    setTiming(null); setScenario(null); setDraft('');
    setSubmitted(false); setGrade(null); setActiveAnn(null);
    setTimeExpired(false); autoSubmitRef.current = false;
  };

  /* ── Formatting commands for contentEditable ── */
  const execCmd = (cmd: string, val?: string) => {
    document.execCommand(cmd, false, val);
    draftRef.current?.focus();
  };

  /* timing selection */
  if (!timing) {
    return (
      <div className="p-6 md:p-10 max-w-5xl mx-auto space-y-8 animate-content-enter">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Draft: {doc.name}</h1>
          <p className="text-muted-foreground mt-1 max-w-2xl">{doc.description}</p>
        </div>
        <div className="max-w-lg space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Choose your mode</h2>
          <button
            onClick={() => start('timed')}
            className="w-full text-left p-5 rounded-xl border border-border/40 hover:border-primary/30 transition-all bg-card/50"
          >
            <div className="flex items-center gap-3">
              <Timer className="h-5 w-5 text-primary" />
              <div>
                <h3 className="font-semibold">Timed — {MINS} minutes</h3>
                <p className="text-sm text-muted-foreground">Exam conditions. A countdown runs while you draft.</p>
              </div>
            </div>
          </button>
          <button
            onClick={() => start('untimed')}
            className="w-full text-left p-5 rounded-xl border border-border/40 hover:border-primary/30 transition-all bg-card/50"
          >
            <div className="flex items-center gap-3">
              <TimerOff className="h-5 w-5 text-muted-foreground" />
              <div>
                <h3 className="font-semibold">Untimed — No pressure</h3>
                <p className="text-sm text-muted-foreground">Take your time. Focus on quality and learning.</p>
              </div>
            </div>
          </button>

          {/* Use own case toggle */}
          <div className="pt-3 border-t border-border/30">
            <label className="flex items-center justify-between cursor-pointer group">
              <div>
                <p className="text-sm font-medium">Use my own case scenario</p>
                <p className="text-xs text-muted-foreground">Skip the generated scenario and draft from your own facts</p>
              </div>
              <button
                onClick={() => setUseOwnCase(!useOwnCase)}
                className={`relative w-10 h-5 rounded-full transition-colors ${
                  useOwnCase ? 'bg-primary' : 'bg-muted-foreground/30'
                }`}
              >
                <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                  useOwnCase ? 'translate-x-5' : ''
                }`} />
              </button>
            </label>
          </div>
        </div>
      </div>
    );
  }

  if (loadingScn) return <EngagingLoader size="lg" message="Setting up your drafting scenario..." />;

  /* grade results */
  if (submitted && grade && !grading) {
    return (
      <div className="flex flex-col h-[calc(100vh-3.5rem)] bg-background animate-content-enter">
        <div className="border-b border-border/20 bg-card/40 px-4 py-3 shrink-0">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={newScenario} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
                <ArrowLeft className="h-4 w-4" />
              </button>
              <div>
                <p className="text-sm font-semibold">Grading: {doc.name}</p>
                <p className="text-xs text-muted-foreground">Detailed feedback and redlining</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={redraft} className="gap-1.5">
                <RotateCcw className="h-3.5 w-3.5" /> Redraft
              </Button>
              <Button variant="outline" size="sm" onClick={newScenario}>New Scenario</Button>
            </div>
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* annotated draft */}
          <div className="flex-1 overflow-y-auto p-6">
            <div className="max-w-2xl mx-auto">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Your Draft — Redlined
              </h3>
              <div className="rounded-xl border border-border/30 p-5 bg-card/40 text-sm leading-relaxed whitespace-pre-wrap font-mono">
                <AnnotatedDraft text={draft} annotations={grade.annotations} activeIdx={activeAnn} onSelect={setActiveAnn} />
              </div>
            </div>
          </div>

          {/* grade sidebar */}
          <div className="w-80 lg:w-96 shrink-0 border-l border-border/20 overflow-y-auto p-5 bg-card/20">
            <div className="text-center mb-6">
              <div className={'text-5xl font-bold ' + (grade.overallScore >= 70 ? 'text-green-600' : grade.overallScore >= 50 ? 'text-amber-600' : 'text-red-600')}>
                {grade.grade}
              </div>
              <div className="text-2xl font-bold mt-1">{grade.overallScore}%</div>
            </div>

            <p className="text-sm text-muted-foreground mb-5">{grade.summary}</p>

            <div className="space-y-2.5 mb-6">
              {Object.entries(grade.categories).map(([k, v]) => (
                <div key={k}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="capitalize">{k === 'legalAccuracy' ? 'Legal Accuracy' : k}</span>
                    <span className="font-medium">{v}%</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-1.5">
                    <div
                      className={'h-1.5 rounded-full transition-all ' + (v >= 70 ? 'bg-green-500' : v >= 50 ? 'bg-amber-500' : 'bg-red-500')}
                      style={{ width: v + '%' }}
                    />
                  </div>
                </div>
              ))}
            </div>

            {grade.strengths.length > 0 && (
              <div className="mb-5">
                <h4 className="text-xs font-semibold text-green-600 uppercase tracking-wider mb-2">Strengths</h4>
                <ul className="space-y-1">
                  {grade.strengths.map((s, i) => (
                    <li key={i} className="text-xs flex items-start gap-1.5">
                      <CheckCircle2 className="h-3 w-3 text-green-500 mt-0.5 shrink-0" /> {s}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {grade.improvements.length > 0 && (
              <div className="mb-5">
                <h4 className="text-xs font-semibold text-amber-600 uppercase tracking-wider mb-2">Needs Improvement</h4>
                <ul className="space-y-1">
                  {grade.improvements.map((s, i) => (
                    <li key={i} className="text-xs flex items-start gap-1.5">
                      <AlertCircle className="h-3 w-3 text-amber-500 mt-0.5 shrink-0" /> {s}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {activeAnn !== null && grade.annotations[activeAnn] && (
              <div className="mt-4 rounded-lg bg-muted/40 p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className={'w-2 h-2 rounded-full ' + (
                    grade.annotations[activeAnn].severity === 'good' ? 'bg-green-500'
                    : grade.annotations[activeAnn].severity === 'error' ? 'bg-red-500'
                    : 'bg-amber-500'
                  )} />
                  <span className="text-xs font-medium capitalize">{grade.annotations[activeAnn].category}</span>
                </div>
                <p className="text-xs text-foreground/80">{grade.annotations[activeAnn].comment}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  /* drafting workspace */
  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] bg-background animate-content-enter">
      <div className="border-b border-border/20 bg-card/40 px-4 py-3 shrink-0">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={newScenario} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div>
              <p className="text-sm font-semibold">{doc.name}</p>
              <p className="text-xs text-muted-foreground">{timing === 'timed' ? 'Timed' : 'Untimed'} Drafting</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {timing === 'timed' && (
              <div className={'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-mono font-medium ' + (timeExpired ? 'bg-red-500/15 text-red-600 animate-pulse' : timeLeft < 300 ? 'bg-red-500/10 text-red-600' : 'bg-muted')}>
                <Timer className="h-3.5 w-3.5" />
                {timeExpired ? "Time's up!" : fmtTime(timeLeft)}
              </div>
            )}
            <span className="text-xs text-muted-foreground">{draft.length} chars</span>
            <Button size="sm" onClick={submitDraft} disabled={!draft.trim() || grading} className="gap-1.5">
              {grading ? (
                <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Grading...</>
              ) : (
                <><Send className="h-3.5 w-3.5" /> Submit</>
              )}
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Scenario panel */}
        <div className="w-72 md:w-80 shrink-0 border-r border-border/20 p-5 overflow-y-auto bg-card/10">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            {scenario ? 'Scenario' : 'Own Case'}
          </h3>
          <div className="text-sm leading-relaxed whitespace-pre-wrap text-foreground/85">
            {scenario || 'You chose to use your own case scenario. Draft your ' + doc.name.toLowerCase() + ' based on facts you are familiar with. Include all required legal elements and Kenyan law references.'}
          </div>

        </div>

        {/* Editor area with formatting toolbar */}
        <div className="flex-1 flex flex-col">
          {/* Formatting toolbar */}
          <div className="shrink-0 border-b border-border/15 bg-card/20 px-4 py-1.5 flex items-center gap-0.5 overflow-x-auto">
            <ToolBtn icon={Bold} title="Bold" onClick={() => execCmd('bold')} />
            <ToolBtn icon={Italic} title="Italic" onClick={() => execCmd('italic')} />
            <ToolBtn icon={UnderlineIcon} title="Underline" onClick={() => execCmd('underline')} />
            <div className="w-px h-4 bg-border/30 mx-1" />
            <ToolBtn icon={AlignLeft} title="Align Left" onClick={() => execCmd('justifyLeft')} />
            <ToolBtn icon={AlignCenter} title="Align Center" onClick={() => execCmd('justifyCenter')} />
            <ToolBtn icon={AlignRight} title="Align Right" onClick={() => execCmd('justifyRight')} />
            <div className="w-px h-4 bg-border/30 mx-1" />
            <ToolBtn icon={Indent} title="Indent" onClick={() => execCmd('indent')} />
            <ToolBtn icon={Outdent} title="Outdent" onClick={() => execCmd('outdent')} />
            <div className="w-px h-4 bg-border/30 mx-1" />
            <ToolBtn icon={List} title="Bullet List" onClick={() => execCmd('insertUnorderedList')} />
            <ToolBtn icon={ListOrdered} title="Numbered List" onClick={() => execCmd('insertOrderedList')} />
          </div>

          {/* Content-editable draft area */}
          <div
            ref={draftRef}
            contentEditable
            suppressContentEditableWarning
            onInput={() => setDraft(draftRef.current?.innerText || '')}
            data-placeholder={'Begin drafting your ' + doc.name.toLowerCase() + ' here...\n\nInclude all required elements: heading, parties, body, closing, and any required legal formalities.'}
            className="flex-1 w-full px-8 py-6 text-sm leading-relaxed bg-background focus:outline-none font-mono overflow-y-auto empty:before:content-[attr(data-placeholder)] empty:before:text-muted-foreground/40"
            autoFocus
          />
        </div>
      </div>
    </div>
  );
}

/* ====== ANNOTATED DRAFT (Redlining) ====== */

function AnnotatedDraft({
  text,
  annotations,
  activeIdx,
  onSelect,
}: {
  text: string;
  annotations: GradeAnnotation[];
  activeIdx: number | null;
  onSelect: (i: number | null) => void;
}) {
  if (!annotations || annotations.length === 0) return <span>{text}</span>;

  const found = annotations
    .map((a, i) => {
      const pos = text.indexOf(a.text);
      return pos >= 0 ? { ...a, i, start: pos, end: pos + a.text.length } : null;
    })
    .filter(Boolean)
    .sort((a, b) => a!.start - b!.start) as Array<GradeAnnotation & { i: number; start: number; end: number }>;

  const segs: JSX.Element[] = [];
  let cursor = 0;

  for (const ann of found) {
    if (ann.start < cursor) continue;
    if (ann.start > cursor) {
      segs.push(<span key={'t-' + cursor}>{text.slice(cursor, ann.start)}</span>);
    }
    const isActive = activeIdx === ann.i;
    const col = ann.severity === 'good' ? 'green' : ann.severity === 'error' ? 'red' : 'amber';

    // Subtle glow instead of bright background
    const glowColor = col === 'green' ? 'rgba(74,222,128,0.12)' : col === 'red' ? 'rgba(248,113,113,0.12)' : 'rgba(251,191,36,0.12)';
    const activeGlow = col === 'green' ? 'rgba(74,222,128,0.22)' : col === 'red' ? 'rgba(248,113,113,0.22)' : 'rgba(251,191,36,0.22)';
    const borderColor = col === 'green' ? 'rgba(74,222,128,0.4)' : col === 'red' ? 'rgba(248,113,113,0.4)' : 'rgba(251,191,36,0.4)';
    const activeBorder = col === 'green' ? 'rgba(74,222,128,0.7)' : col === 'red' ? 'rgba(248,113,113,0.7)' : 'rgba(251,191,36,0.7)';

    segs.push(
      <span
        key={'a-' + ann.i}
        onClick={() => onSelect(isActive ? null : ann.i)}
        className="cursor-pointer transition-all duration-200 rounded-sm"
        style={{
          borderBottom: '1.5px solid ' + (isActive ? activeBorder : borderColor),
          backgroundColor: isActive ? activeGlow : glowColor,
          boxShadow: isActive ? '0 0 8px ' + activeGlow : 'none',
          padding: '0 1px',
        }}
      >
        {ann.text}
      </span>
    );
    cursor = ann.end;
  }

  if (cursor < text.length) {
    segs.push(<span key={'t-' + cursor}>{text.slice(cursor)}</span>);
  }

  return <>{segs}</>;
}

/* ====== FORMATTING TOOLBAR BUTTON ====== */
function ToolBtn({ icon: Icon, title, onClick }: { icon: typeof Bold; title: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="p-1.5 rounded hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors"
    >
      <Icon className="h-3.5 w-3.5" />
    </button>
  );
}
