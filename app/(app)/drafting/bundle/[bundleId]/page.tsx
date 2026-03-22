'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useTimeTracker } from '@/lib/hooks/useTimeTracker';
import { useSidebar } from '@/contexts/SidebarContext';
import { getBundleById, getDocumentById } from '@/lib/constants/legal-content';
import PremiumGate from '@/components/PremiumGate';
import TrialLimitReached from '@/components/TrialLimitReached';
import EngagingLoader from '@/components/EngagingLoader';
import { Button } from '@/components/ui/button';
import {
  ArrowLeft, PackageOpen, CheckCircle2, Send, Loader2,
  RotateCcw, AlertCircle, PenLine, ChevronRight,
  Bold, Italic, Underline as UnderlineIcon, AlignLeft, AlignCenter,
  AlignRight, Indent, Outdent, List, ListOrdered, Save, Check,
} from 'lucide-react';

/* ── Types ── */
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
  categories: { structure: number; substance: number; legalAccuracy: number; language: number; formatting: number };
  annotations: GradeAnnotation[];
  strengths: string[];
  improvements: string[];
}

interface DocDraft {
  docId: string;
  draft: string;
  locked: boolean;
  grade?: GradeResult;
}

type BundlePhase = 'setup' | 'drafting' | 'grading' | 'results';

const AUTOSAVE_INTERVAL = 5000;

function sanitizeScenario(raw: string): string {
  let text = (raw || '')
    .replace(/^SCENARIO:\s*/i, '')
    .replace(/\*\*/g, '')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^>\s?/gm, '')
    .replace(/^---+$/gm, '')
    .replace(/\u2014/g, '-')
    .trim();
  const forbiddenMarkers = [
    /\n\s*PROPER LEGAL STRUCTURE/i, /\n\s*PRACTICAL EXAM GUIDANCE/i,
    /\n\s*TEMPLATE/i, /\n\s*DRAFTING TEMPLATE/i,
    /\n\s*If you want,? I can/i, /\n\s*Show Drafting Hints/i,
  ];
  for (const marker of forbiddenMarkers) {
    const m = text.match(marker);
    if (m && m.index !== undefined) text = text.slice(0, m.index).trim();
  }
  return text;
}

/* ── Formatting toolbar button ── */
function ToolBtn({ icon: Icon, title, onClick }: { icon: typeof Bold; title: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} title={title}
      className="p-1.5 rounded hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors">
      <Icon className="h-3.5 w-3.5" />
    </button>
  );
}

/* ── Annotated redlined draft ── */
function AnnotatedDraft({ text, annotations, activeIdx, onSelect }: {
  text: string; annotations: GradeAnnotation[]; activeIdx: number | null; onSelect: (i: number | null) => void;
}) {
  if (!annotations || annotations.length === 0) return <span>{text}</span>;
  const found = annotations
    .map((a, i) => { const pos = text.indexOf(a.text); return pos >= 0 ? { ...a, i, start: pos, end: pos + a.text.length } : null; })
    .filter(Boolean)
    .sort((a, b) => a!.start - b!.start) as Array<GradeAnnotation & { i: number; start: number; end: number }>;
  const segs: JSX.Element[] = [];
  let cursor = 0;
  for (const ann of found) {
    if (ann.start < cursor) continue;
    if (ann.start > cursor) segs.push(<span key={'t-' + cursor}>{text.slice(cursor, ann.start)}</span>);
    const isActive = activeIdx === ann.i;
    const col = ann.severity === 'good' ? 'green' : ann.severity === 'error' ? 'red' : 'amber';
    const glow = col === 'green' ? 'rgba(74,222,128,0.12)' : col === 'red' ? 'rgba(248,113,113,0.12)' : 'rgba(251,191,36,0.12)';
    const activeGlow = col === 'green' ? 'rgba(74,222,128,0.22)' : col === 'red' ? 'rgba(248,113,113,0.22)' : 'rgba(251,191,36,0.22)';
    const border = col === 'green' ? 'rgba(74,222,128,0.4)' : col === 'red' ? 'rgba(248,113,113,0.4)' : 'rgba(251,191,36,0.4)';
    const activeBorder = col === 'green' ? 'rgba(74,222,128,0.7)' : col === 'red' ? 'rgba(248,113,113,0.7)' : 'rgba(251,191,36,0.7)';
    segs.push(
      <span key={'a-' + ann.i} onClick={() => onSelect(isActive ? null : ann.i)}
        className="cursor-pointer transition-all duration-200 rounded-sm"
        style={{ borderBottom: '1.5px solid ' + (isActive ? activeBorder : border), backgroundColor: isActive ? activeGlow : glow, boxShadow: isActive ? '0 0 8px ' + activeGlow : 'none' }}>
        {text.slice(ann.start, ann.end)}
      </span>
    );
    cursor = ann.end;
  }
  if (cursor < text.length) segs.push(<span key={'t-' + cursor}>{text.slice(cursor)}</span>);
  return <>{segs}</>;
}

/* ====== MAIN BUNDLE PAGE ====== */
export default function BundlePage() {
  const params = useParams();
  const router = useRouter();
  const { getIdToken } = useAuth();
  useTimeTracker('drafting');
  const { setCollapsed } = useSidebar();
  const bundleId = params.bundleId as string;
  const bundle = getBundleById(bundleId);

  const bundleDocs = bundle
    ? bundle.documents.map(dId => getDocumentById(dId)).filter(Boolean) as { id: string; name: string; description: string; category: string }[]
    : [];

  const [phase, setPhase] = useState<BundlePhase>('setup');
  const [scenario, setScenario] = useState<string | null>(null);
  const [loadingScenario, setLoadingScenario] = useState(false);
  const [currentDocIdx, setCurrentDocIdx] = useState(0);
  const [docDrafts, setDocDrafts] = useState<DocDraft[]>(() =>
    bundleDocs.map(d => ({ docId: d.id, draft: '', locked: false }))
  );
  const [grading, setGrading] = useState(false);
  const [gradingDocIdx, setGradingDocIdx] = useState(-1);
  const [activeAnns, setActiveAnns] = useState<Record<number, number | null>>({});
  const [featureLimitHit, setFeatureLimitHit] = useState<any>(null);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [showResumeDialog, setShowResumeDialog] = useState(false);
  const savedStateSnapshotRef = useRef<any>(null);

  const draftRef = useRef<HTMLDivElement>(null);
  const storageKey = `ynai-bundle-${bundleId}`;

  // Collapse sidebar during active drafting
  useEffect(() => {
    if (phase === 'drafting') setCollapsed(true);
    return () => setCollapsed(false);
  }, [phase, setCollapsed]);

  // ── Load saved state from localStorage on mount ──
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        const hasProgress = parsed.scenario && parsed.docDrafts?.some((d: any) => d.draft?.trim() || d.locked);
        if (hasProgress) {
          savedStateSnapshotRef.current = parsed;
          setShowResumeDialog(true);
          return;
        }
      }
    } catch { /* ignore corrupt storage */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleResume = () => {
    const parsed = savedStateSnapshotRef.current;
    if (!parsed) return;
    if (parsed.scenario) setScenario(parsed.scenario);
    if (parsed.docDrafts && Array.isArray(parsed.docDrafts)) {
      setDocDrafts(prev => prev.map((dd, i) => ({
        ...dd,
        draft: parsed.docDrafts[i]?.draft || '',
        locked: parsed.docDrafts[i]?.locked || false,
      })));
    }
    if (parsed.currentDocIdx !== undefined) setCurrentDocIdx(parsed.currentDocIdx);
    setPhase('drafting');
    setShowResumeDialog(false);
  };

  const handleStartNew = () => {
    try { localStorage.removeItem(storageKey); } catch {}
    savedStateSnapshotRef.current = null;
    setShowResumeDialog(false);
  };

  // ── Auto-save every 5 seconds during drafting ──
  useEffect(() => {
    if (phase !== 'drafting') return;
    const interval = setInterval(() => {
      try {
        const currentText = draftRef.current?.innerText || '';
        const updatedDrafts = docDrafts.map((dd, i) =>
          i === currentDocIdx && !dd.locked ? { ...dd, draft: currentText } : dd
        );
        const state = {
          scenario,
          docDrafts: updatedDrafts.map(dd => ({ docId: dd.docId, draft: dd.draft, locked: dd.locked })),
          currentDocIdx,
        };
        localStorage.setItem(storageKey, JSON.stringify(state));
        setLastSaved(new Date());
      } catch { /* storage full or unavailable */ }
    }, AUTOSAVE_INTERVAL);
    return () => clearInterval(interval);
  }, [phase, scenario, docDrafts, currentDocIdx, storageKey]);

  // Sync contentEditable → state
  const syncDraft = useCallback(() => {
    const text = draftRef.current?.innerText || '';
    setDocDrafts(prev => prev.map((dd, i) =>
      i === currentDocIdx ? { ...dd, draft: text } : dd
    ));
  }, [currentDocIdx]);

  // Load draft into contentEditable when switching docs
  useEffect(() => {
    if (draftRef.current && phase === 'drafting') {
      const currentDraft = docDrafts[currentDocIdx];
      if (currentDraft && !currentDraft.locked) {
        draftRef.current.innerText = currentDraft.draft;
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentDocIdx, phase]);

  if (!bundle) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <PackageOpen className="h-16 w-16 text-muted-foreground/30" />
        <h1 className="text-xl font-semibold">Bundle not found</h1>
        <Button variant="outline" onClick={() => router.push('/drafting')}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Drafting
        </Button>
      </div>
    );
  }

  const currentDoc = bundleDocs[currentDocIdx];
  const lockedCount = docDrafts.filter(d => d.locked).length;
  const allLocked = lockedCount === bundleDocs.length;

  /* ── Generate bundle scenario ── */
  const generateScenario = async () => {
    setLoadingScenario(true);
    try {
      const token = await getIdToken();
      const docNames = bundleDocs.map((d, i) => `${i + 1}. ${d.name}`).join('\n');
      const prompt = [
        `Generate a realistic, detailed exam-style scenario for drafting a COMPLETE BUNDLE of legal documents under Kenyan law.`,
        '',
        `BUNDLE: "${bundle.name}"`,
        `DOCUMENTS TO BE DRAFTED (in order):`,
        docNames,
        '',
        `REQUIREMENTS:`,
        `- Create ONE cohesive factual scenario that requires ALL the listed documents.`,
        `- Include specific facts: full names, dates, amounts (in Kshs), locations in Kenya, case details.`,
        `- The scenario must be self-contained with enough facts for the student to draft EVERY document in the bundle.`,
        `- List 4-6 key issues the student should address across the documents.`,
        `- Under 400 words.`,
        `- Begin directly with the facts.`,
        '',
        `STRICT RULES:`,
        `- Output ONLY the factual scenario and issues.`,
        `- Do NOT include drafting templates, structures, sample headings, or legal form examples.`,
        `- Do NOT include guidance, coaching, or hints.`,
        `- Output PLAIN TEXT only. No markdown.`,
        `- Use regular hyphens (-) instead of em dashes.`,
      ].join('\n');

      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({
          message: prompt,
          competencyType: 'drafting',
          context: { documentType: bundle.name, mode: 'scenario-generate' },
        }),
      });
      if (!res.ok) {
        if (res.status === 403) {
          const errData = await res.json();
          if (errData.error === 'FREE_TRIAL_LIMIT' || errData.error === 'FEATURE_LIMIT') {
            setFeatureLimitHit({ tier: errData.tier, used: errData.used, limit: errData.limit, addonRemaining: errData.addonRemaining });
            return;
          }
        }
        throw new Error('Failed to generate scenario');
      }
      const data = await res.json();
      const clean = sanitizeScenario(data.response);
      setScenario(clean);
      setPhase('drafting');
    } catch {
      const docList = bundleDocs.map(d => d.name).join(', ');
      setScenario(
        `James Ochieng, a businessman residing in Kilimani, Nairobi, seeks legal representation regarding a commercial dispute. ` +
        `On 10th January 2026, he entered into a supply agreement with Mombasa Traders Ltd worth Kshs 4,500,000 for importation of electronic goods. ` +
        `He paid 50% (Kshs 2,250,000) via bank transfer to their account at Kenya Commercial Bank. ` +
        `The goods were to be delivered to his warehouse at Industrial Area, Nairobi by 1st February 2026. ` +
        `No delivery was made. His demand letter dated 15th February 2026 received no response. ` +
        `The company's registered office is at Kenyatta Avenue, Mombasa. ` +
        `The directors are Peter Kimani (Managing Director) and Sarah Wambui (Secretary).\n\n` +
        `You are instructed to prepare the following documents: ${docList}.\n\n` +
        `Key Issues:\n` +
        `1) Jurisdiction and forum for the suit\n` +
        `2) Breach of contract and remedies available\n` +
        `3) Whether specific performance or damages should be sought\n` +
        `4) Evidentiary requirements and documentation\n` +
        `5) Interim/interlocutory relief considerations`
      );
      setPhase('drafting');
    } finally {
      setLoadingScenario(false);
    }
  };

  /* ── Lock current document and move to next ── */
  const lockAndNext = () => {
    syncDraft();
    setDocDrafts(prev => prev.map((dd, i) =>
      i === currentDocIdx ? { ...dd, draft: draftRef.current?.innerText || dd.draft, locked: true } : dd
    ));
    if (currentDocIdx < bundleDocs.length - 1) {
      setCurrentDocIdx(currentDocIdx + 1);
    }
  };

  /* ── Unlock a document for editing ── */
  const unlockDoc = (idx: number) => {
    setDocDrafts(prev => prev.map((dd, i) => i === idx ? { ...dd, locked: false } : dd));
    setCurrentDocIdx(idx);
  };

  /* ── Submit all drafts for grading ── */
  const submitAll = async () => {
    syncDraft();
    const finalDrafts = docDrafts.map((dd, i) =>
      i === currentDocIdx ? { ...dd, draft: draftRef.current?.innerText || dd.draft, locked: true } : dd
    );
    setDocDrafts(finalDrafts);
    setPhase('grading');
    setGrading(true);

    const token = await getIdToken();
    const graded: DocDraft[] = [...finalDrafts];

    for (let i = 0; i < bundleDocs.length; i++) {
      setGradingDocIdx(i);
      try {
        const res = await fetch('/api/drafting/grade', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
          body: JSON.stringify({
            draft: graded[i].draft,
            documentType: bundleDocs[i].name,
            scenario: scenario || '',
          }),
        });
        const data = await res.json();
        if (res.ok) {
          graded[i] = { ...graded[i], grade: {
            overallScore: data.overallScore ?? 0,
            grade: data.grade ?? '?',
            summary: data.summary ?? '',
            categories: data.categories ?? { structure: 0, substance: 0, legalAccuracy: 0, language: 0, formatting: 0 },
            annotations: data.annotations ?? [],
            strengths: data.strengths ?? [],
            improvements: data.improvements ?? [],
          }};
        } else {
          graded[i] = { ...graded[i], grade: {
            overallScore: 0, grade: '?', summary: data.error || 'Grading failed.',
            categories: { structure: 0, substance: 0, legalAccuracy: 0, language: 0, formatting: 0 },
            annotations: [], strengths: [], improvements: [],
          }};
        }
      } catch {
        graded[i] = { ...graded[i], grade: {
          overallScore: 0, grade: '?', summary: 'Grading failed. Please try again.',
          categories: { structure: 0, substance: 0, legalAccuracy: 0, language: 0, formatting: 0 },
          annotations: [], strengths: [], improvements: [],
        }};
      }
    }

    setDocDrafts(graded);
    setGrading(false);
    setGradingDocIdx(-1);
    setPhase('results');
    try { localStorage.removeItem(storageKey); } catch {}
  };

  /* ── Restart entire bundle ── */
  const restart = () => {
    setPhase('setup');
    setScenario(null);
    setCurrentDocIdx(0);
    setDocDrafts(bundleDocs.map(d => ({ docId: d.id, draft: '', locked: false })));
    setActiveAnns({});
    try { localStorage.removeItem(storageKey); } catch {}
  };

  const execCmd = (cmd: string, val?: string) => {
    document.execCommand(cmd, false, val);
    draftRef.current?.focus();
  };

  /* ════════ SETUP PHASE ════════ */
  if (phase === 'setup') {
    if (loadingScenario) {
      return (
        <PremiumGate feature="drafting">
          <div className="flex items-center justify-center min-h-[70vh]">
            <EngagingLoader size="lg" message="Generating your scenario — this typically takes 15–30 seconds…" />
          </div>
        </PremiumGate>
      );
    }
    return (
      <PremiumGate feature="drafting">
        {/* Resume / Start New dialog */}
        {showResumeDialog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-background rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-5 animate-in zoom-in-95 duration-200">
              <div className="flex flex-col items-center gap-2 text-center">
                <div className="p-3 bg-white dark:bg-zinc-900 rounded-2xl shadow border border-primary/20 mb-1">
                  <img src="/favicon-32x32.png" alt="Ynai" className="w-10 h-10" />
                </div>
                <h3 className="text-lg font-bold">Welcome back</h3>
                <p className="text-sm text-muted-foreground">
                  You have unfinished work on <strong className="text-foreground">{bundle.name}</strong>.
                  {savedStateSnapshotRef.current?.currentDocIdx !== undefined && (
                    <> You were on document {Math.min((savedStateSnapshotRef.current.currentDocIdx ?? 0) + 1, bundleDocs.length)} of {bundleDocs.length}.</>
                  )}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={handleStartNew}
                  className="py-3 px-4 rounded-xl border border-border/40 hover:bg-muted/40 transition-colors text-sm font-medium"
                >
                  Start New
                </button>
                <button
                  onClick={handleResume}
                  className="py-3 px-4 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-colors text-sm font-medium"
                >
                  Resume
                </button>
              </div>
            </div>
          </div>
        )}
        <div className="p-6 md:p-10 max-w-4xl mx-auto space-y-8 animate-content-enter">
          {featureLimitHit && (
            <TrialLimitReached
              feature="drafting"
              currentTier={featureLimitHit.tier}
              used={featureLimitHit.used}
              limit={featureLimitHit.limit}
              addonRemaining={featureLimitHit.addonRemaining}
              onDismiss={() => setFeatureLimitHit(null)}
            />
          )}

          <button onClick={() => router.push('/drafting')}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" /> Back to Drafting
          </button>

          <div className="flex items-start gap-4">
            <div className="p-3 rounded-xl bg-primary/10 shrink-0">
              <PackageOpen className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">{bundle.name}</h1>
              <p className="text-muted-foreground mt-1 text-sm">{bundle.description}</p>
              <div className="flex items-center gap-3 mt-3 text-xs text-muted-foreground">
                <span className="bg-muted px-2 py-0.5 rounded-full">{bundle.category}</span>
                <span>{bundleDocs.length} documents</span>
              </div>
            </div>
          </div>

          <div className="bg-muted/50 border rounded-xl p-5 space-y-3">
            <h3 className="font-semibold text-sm">How Bundle Drafting Works</h3>
            <ol className="list-decimal list-inside space-y-1.5 text-sm text-muted-foreground">
              <li>A <strong>single scenario</strong> is generated covering all documents in this bundle</li>
              <li>Draft each document <strong>sequentially</strong> - lock it in, then move to the next</li>
              <li>Your work is <strong>auto-saved every 5 seconds</strong> so nothing is lost</li>
              <li>After all documents are locked, <strong>submit the entire bundle</strong> for grading</li>
              <li>Each document gets its own detailed grade and redline feedback</li>
            </ol>
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Documents You&apos;ll Draft</h3>
            {bundleDocs.map((doc, i) => (
              <div key={doc.id} className="flex items-center gap-3 p-3 rounded-lg border border-border/30 bg-card/30">
                <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground">
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{doc.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{doc.description}</p>
                </div>
              </div>
            ))}
          </div>

          <Button onClick={generateScenario} disabled={loadingScenario} size="lg" className="w-full gap-2">
            <PenLine className="h-4 w-4" /> Start Bundle Drafting
          </Button>
        </div>
      </PremiumGate>
    );
  }

  /* ════════ GRADING PHASE ════════ */
  if (phase === 'grading') {
    return (
      <PremiumGate feature="drafting">
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
          <EngagingLoader size="lg" message={
            gradingDocIdx >= 0 && gradingDocIdx < bundleDocs.length
              ? `Grading ${bundleDocs[gradingDocIdx].name} (${gradingDocIdx + 1}/${bundleDocs.length})...`
              : 'Preparing grades...'
          } />
          <div className="flex items-center gap-2">
            {bundleDocs.map((_, i) => (
              <div key={i} className={`h-2 w-8 rounded-full transition-colors duration-300 ${
                i < gradingDocIdx ? 'bg-emerald-500' : i === gradingDocIdx ? 'bg-primary animate-pulse' : 'bg-muted'
              }`} />
            ))}
          </div>
        </div>
      </PremiumGate>
    );
  }

  /* ════════ RESULTS PHASE ════════ */
  if (phase === 'results') {
    const avgScore = docDrafts.reduce((sum, dd) => sum + (dd.grade?.overallScore ?? 0), 0) / bundleDocs.length;
    const avgGrade = avgScore >= 90 ? 'A' : avgScore >= 80 ? 'B+' : avgScore >= 70 ? 'B'
      : avgScore >= 60 ? 'C+' : avgScore >= 50 ? 'C' : avgScore >= 40 ? 'D' : 'F';

    return (
      <PremiumGate feature="drafting">
        <div className="p-6 md:p-10 max-w-6xl mx-auto space-y-8 animate-content-enter">
          <button onClick={() => router.push('/drafting')}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" /> Back to Drafting
          </button>

          <div className="text-center space-y-2">
            <h1 className="text-2xl font-bold">{bundle.name} — Results</h1>
            <div className="flex items-center justify-center gap-4 mt-4">
              <div className={`text-5xl font-bold ${avgScore >= 70 ? 'text-green-600' : avgScore >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
                {avgGrade}
              </div>
              <div className="text-left">
                <p className="text-2xl font-bold">{Math.round(avgScore)}%</p>
                <p className="text-xs text-muted-foreground">Bundle Average</p>
              </div>
            </div>
          </div>

          <div className="bg-muted/30 border border-border/30 rounded-xl p-4">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Scenario</h3>
            <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground/80">{scenario}</p>
          </div>

          {bundleDocs.map((doc, i) => {
            const dd = docDrafts[i];
            const grade = dd.grade;
            if (!grade) return null;
            const annIdx = activeAnns[i] ?? null;

            return (
              <div key={doc.id} className="border border-border/30 rounded-xl overflow-hidden">
                <div className="bg-card/50 px-5 py-3 border-b border-border/20 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-bold ${
                      grade.overallScore >= 70 ? 'bg-green-500/15 text-green-600'
                      : grade.overallScore >= 50 ? 'bg-amber-500/15 text-amber-600'
                      : 'bg-red-500/15 text-red-600'
                    }`}>
                      {grade.grade}
                    </div>
                    <div>
                      <p className="text-sm font-semibold">{doc.name}</p>
                      <p className="text-xs text-muted-foreground">{grade.overallScore}% — {grade.summary.slice(0, 80)}{grade.summary.length > 80 ? '...' : ''}</p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col md:flex-row">
                  <div className="flex-1 p-5 overflow-x-auto">
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Your Draft — Redlined</h4>
                    <div className="rounded-lg border border-border/20 p-4 bg-card/20 text-sm leading-relaxed whitespace-pre-wrap font-mono max-h-96 overflow-y-auto">
                      <AnnotatedDraft text={dd.draft} annotations={grade.annotations} activeIdx={annIdx}
                        onSelect={(idx) => setActiveAnns(prev => ({ ...prev, [i]: idx }))} />
                    </div>
                  </div>

                  <div className="w-full md:w-72 shrink-0 md:border-l border-t md:border-t-0 border-border/20 p-5 bg-card/10 space-y-4">
                    <div className="space-y-2">
                      {Object.entries(grade.categories).map(([k, v]) => (
                        <div key={k}>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="capitalize">{k === 'legalAccuracy' ? 'Legal Accuracy' : k}</span>
                            <span className="font-medium">{v}%</span>
                          </div>
                          <div className="w-full bg-muted rounded-full h-1.5">
                            <div className={`h-1.5 rounded-full transition-all ${v >= 70 ? 'bg-green-500' : v >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                              style={{ width: v + '%' }} />
                          </div>
                        </div>
                      ))}
                    </div>

                    {grade.strengths.length > 0 && (
                      <div>
                        <h5 className="text-xs font-semibold text-green-600 uppercase tracking-wider mb-1.5">Strengths</h5>
                        <ul className="space-y-1">
                          {grade.strengths.map((s, si) => (
                            <li key={si} className="text-xs flex items-start gap-1.5">
                              <CheckCircle2 className="h-3 w-3 text-green-500 mt-0.5 shrink-0" /> {s}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {grade.improvements.length > 0 && (
                      <div>
                        <h5 className="text-xs font-semibold text-amber-600 uppercase tracking-wider mb-1.5">Improvements</h5>
                        <ul className="space-y-1">
                          {grade.improvements.map((s, si) => (
                            <li key={si} className="text-xs flex items-start gap-1.5">
                              <AlertCircle className="h-3 w-3 text-amber-500 mt-0.5 shrink-0" /> {s}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {annIdx !== null && grade.annotations[annIdx] && (
                      <div className="rounded-lg bg-muted/40 p-3">
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className={`w-2 h-2 rounded-full ${
                            grade.annotations[annIdx].severity === 'good' ? 'bg-green-500'
                            : grade.annotations[annIdx].severity === 'error' ? 'bg-red-500' : 'bg-amber-500'
                          }`} />
                          <span className="text-xs font-medium capitalize">{grade.annotations[annIdx].category}</span>
                        </div>
                        <p className="text-xs text-foreground/80">{grade.annotations[annIdx].comment}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          <div className="flex justify-center gap-3 pt-4">
            <Button variant="outline" onClick={restart} className="gap-1.5">
              <RotateCcw className="h-4 w-4" /> Try Again
            </Button>
            <Button variant="outline" onClick={() => router.push('/drafting')}>
              <ArrowLeft className="h-4 w-4 mr-2" /> All Documents
            </Button>
          </div>
        </div>
      </PremiumGate>
    );
  }

  /* ════════ DRAFTING PHASE ════════ */
  const currentDraft = docDrafts[currentDocIdx];

  return (
    <PremiumGate feature="drafting">
      <div className="flex flex-col h-[calc(100vh-3.5rem)] bg-background animate-content-enter">
        {featureLimitHit && (
          <TrialLimitReached
            feature="drafting"
            currentTier={featureLimitHit.tier}
            used={featureLimitHit.used}
            limit={featureLimitHit.limit}
            addonRemaining={featureLimitHit.addonRemaining}
            onDismiss={() => setFeatureLimitHit(null)}
          />
        )}

        {/* Top bar */}
        <div className="border-b border-border/20 bg-card/40 px-4 py-2.5 shrink-0">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={() => { syncDraft(); setPhase('setup'); }}
                className="p-1.5 rounded-lg hover:bg-muted transition-colors">
                <ArrowLeft className="h-4 w-4" />
              </button>
              <div>
                <p className="text-sm font-semibold">{bundle.name}</p>
                <p className="text-xs text-muted-foreground">
                  Document {currentDocIdx + 1}/{bundleDocs.length}: {currentDoc?.name}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {lastSaved && (
                <span className="text-[10px] text-muted-foreground/60 flex items-center gap-1">
                  <Save className="h-3 w-3" />
                  Saved {lastSaved.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
              )}
              <span className="text-xs text-muted-foreground">
                {lockedCount}/{bundleDocs.length} locked
              </span>
              {allLocked ? (
                <Button size="sm" onClick={submitAll} disabled={grading} className="gap-1.5">
                  {grading ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Grading...</> : <><Send className="h-3.5 w-3.5" /> Submit Bundle</>}
                </Button>
              ) : currentDraft && !currentDraft.locked ? (
                <Button size="sm" onClick={lockAndNext} className="gap-1.5">
                  <Check className="h-3.5 w-3.5" />
                  {currentDocIdx < bundleDocs.length - 1 ? 'Lock & Next' : 'Lock Last'}
                </Button>
              ) : null}
            </div>
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* Left panel: Scenario + Document tabs */}
          <div className="w-72 md:w-80 shrink-0 border-r border-border/20 flex flex-col bg-card/10">
            <div className="border-b border-border/20 p-3 space-y-1.5 max-h-52 overflow-y-auto">
              {bundleDocs.map((doc, i) => {
                const dd = docDrafts[i];
                const isCurrent = i === currentDocIdx;
                return (
                  <button key={doc.id}
                    onClick={() => { if (isCurrent) return; syncDraft(); setCurrentDocIdx(i); }}
                    className={`w-full text-left flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs transition-all ${
                      isCurrent ? 'bg-primary/10 border border-primary/30 font-medium'
                      : dd.locked ? 'bg-emerald-500/5 border border-emerald-500/20'
                      : 'hover:bg-muted/50 border border-transparent'
                    }`}>
                    {dd.locked ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                    ) : (
                      <div className={`h-4 w-4 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                        isCurrent ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                      }`}>{i + 1}</div>
                    )}
                    <span className="truncate">{doc.name}</span>
                    {dd.draft.length > 0 && !dd.locked && (
                      <span className="ml-auto text-[10px] text-muted-foreground">{dd.draft.length}ch</span>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="flex-1 p-4 overflow-y-auto">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Shared Scenario
              </h3>
              <div className="text-sm leading-relaxed whitespace-pre-wrap text-foreground/85">
                {scenario}
              </div>
              <div className="mt-4 pt-3 border-t border-border/20">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                  Now Drafting
                </h4>
                <p className="text-sm font-medium">{currentDoc?.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{currentDoc?.description}</p>
              </div>
            </div>
          </div>

          {/* Editor area */}
          <div className="flex-1 flex flex-col">
            {currentDraft?.locked ? (
              <div className="flex-1 flex flex-col items-center justify-center p-8">
                <CheckCircle2 className="h-12 w-12 text-emerald-500 mb-4" />
                <h3 className="text-lg font-semibold mb-1">Draft Locked</h3>
                <p className="text-sm text-muted-foreground mb-4 text-center max-w-md">
                  Your draft for <strong>{currentDoc?.name}</strong> has been locked in.
                  {currentDocIdx < bundleDocs.length - 1
                    ? ' Move to the next document or unlock to edit.'
                    : allLocked
                    ? ' All documents are locked — submit the bundle for grading.'
                    : ' Unlock to make changes.'}
                </p>
                <div className="flex gap-3">
                  <Button variant="outline" size="sm" onClick={() => unlockDoc(currentDocIdx)} className="gap-1.5">
                    <RotateCcw className="h-3.5 w-3.5" /> Unlock & Edit
                  </Button>
                  {currentDocIdx < bundleDocs.length - 1 && (
                    <Button size="sm" onClick={() => setCurrentDocIdx(currentDocIdx + 1)} className="gap-1.5">
                      Next Document <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  {allLocked && (
                    <Button size="sm" onClick={submitAll} className="gap-1.5">
                      <Send className="h-3.5 w-3.5" /> Submit Bundle
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <>
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

                <div
                  ref={draftRef}
                  contentEditable
                  suppressContentEditableWarning
                  onInput={syncDraft}
                  data-placeholder={`Begin drafting your ${currentDoc?.name.toLowerCase() || 'document'} here...\n\nRefer to the scenario on the left. Include all required legal elements.`}
                  className="flex-1 w-full px-8 py-6 text-sm leading-relaxed bg-background focus:outline-none font-mono overflow-y-auto empty:before:content-[attr(data-placeholder)] empty:before:text-muted-foreground/40"
                  autoFocus
                />
              </>
            )}
          </div>
        </div>
      </div>
    </PremiumGate>
  );
}
