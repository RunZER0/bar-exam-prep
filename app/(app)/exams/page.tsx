'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { ATP_UNITS } from '@/lib/constants/legal-content';
import { useAuth } from '@/contexts/AuthContext';
import { usePreloading } from '@/lib/services/preloading';
import {
  Gavel, Scale, FileText, Shield, Building, Briefcase, Users, BookOpen,
  Building2, Handshake, Calculator, ClipboardCheck, Clock, ArrowRight, X,
  PenTool, CheckCircle, Sparkles, GraduationCap, Timer,
  FileQuestion, Edit3, ChevronRight, Target, Zap, Award, ArrowLeft,
  ScrollText, Filter, BarChart3, Eye, Loader2, TrendingUp,
  Calendar, Hash, ChevronDown, Brain, MessageCircle, Send,
  AlertTriangle, Lightbulb, Percent, PieChart, ArrowUpRight, ArrowDownRight,
  Minus, Layers, Bold, Italic, Underline as UnderlineIcon,
  AlignLeft, AlignCenter, AlignRight, List, ListOrdered,
  CheckCircle2, PenLine, RotateCcw,
} from 'lucide-react';
import PremiumGate from '@/components/PremiumGate';
import { useSubscription } from '@/contexts/SubscriptionContext';
import FeatureLockedScreen from '@/components/FeatureLockedScreen';
import EngagingLoader from '@/components/EngagingLoader';

const ICON_MAP: Record<string, any> = {
  Gavel, Scale, FileText, Shield, Building, Briefcase,
  Users, BookOpen, Building2, Handshake, Calculator, PenTool,
};

// ============================================================
// PAST PAPER TYPES
// ============================================================

interface PastPaperEntry {
  id: string;
  unitId: string;
  unitName: string;
  year: number;
  sitting: string;
  paperCode: string | null;
  totalMarks: number | null;
  duration: string | null;
  questionCount: number;
}

interface PastQuestion {
  id: string;
  questionNumber: number;
  subPart: string | null;
  questionText: string;
  marks: number | null;
  isCompulsory: boolean;
  topics: string[];
  difficulty: string | null;
  questionType: string;
  modelAnswer: string | null;
}

interface GeneratedQuestion {
  question: string;
  marks: number;
  questionType: string;
  modelAnswer: string;
  topicsCovered: string[];
}

// ============================================================
// DEEP ANALYSIS TYPES
// ============================================================

interface AnalysisReport {
  summary: { totalPapers: number; totalQuestions: number; yearRange: string; unitsAnalyzed: number; sittingsAnalyzed: number };
  topicAnalysis: {
    globalTopTopics: { topic: string; frequency: number; percentage: number; trend: string; peakYear: number }[];
    byUnit: Record<string, { unitName: string; topTopics: { topic: string; frequency: number; trend: string }[]; uniqueTopics: string[]; topicDiversity: number }>;
  };
  yearOverYearTrends: {
    topicShifts: { fromTopic: string; toTopic: string; shiftYear: number; unit: string; description: string }[];
    emergingTopics: { topic: string; firstAppeared: number; growthRate: string; units: string[] }[];
    decliningTopics: { topic: string; lastAppeared: number; previousFrequency: number }[];
    yearlyComplexity: { year: number; avgMarksPerQ: number; problemRatio: number; draftingRatio: number; essayRatio: number }[];
  };
  questionTypePatterns: {
    overallDistribution: Record<string, number>;
    byUnit: Record<string, Record<string, number>>;
    byYear: Record<string, Record<string, number>>;
    compulsoryPatterns: { topicsMostCompulsory: { topic: string; count: number }[]; avgCompulsoryMarks: number; compulsoryTypeBreakdown: Record<string, number> };
  };
  difficultyAnalysis: {
    overallDistribution: Record<string, number>;
    byUnit: Record<string, Record<string, number>>;
    trendByYear: { year: number; hardPercentage: number; mediumPercentage: number }[];
  };
  marksAllocation: {
    commonMarksValues: { marks: number; frequency: number }[];
    avgMarksCompulsory: number;
    avgMarksOptional: number;
    byUnit: Record<string, { avgTotal: number; avgCompulsory: number; avgOptional: number }>;
  };
  crossUnitInsights: {
    sharedTopics: { topic: string; units: string[]; frequency: number }[];
    unitSpecificTopics: { topic: string; unit: string; frequency: number }[];
    correlations: { description: string; units: string[]; pattern: string }[];
  };
  predictiveInsights: {
    highProbabilityTopics: { topic: string; unit: string; probability: string; reasoning: string; lastTested: number }[];
    cyclicalPatterns: { pattern: string; cycle: string; nextExpected: string; confidence: string }[];
    examinerBehavior: { observation: string; evidence: string; implication: string }[];
  };
  examStructureAnalysis: {
    commonFormats: { format: string; frequency: number; description: string }[];
    instructionPatterns: { pattern: string; occurrences: number }[];
    timingTrends: { avgDuration: number; avgQuestionsPerPaper: number; avgMarksPerPaper: number };
  };
  studentGuidance: {
    mustPrepareTopics: { topic: string; unit: string; reason: string; priority: string }[];
    safeToDeprioritize: { topic: string; reason: string }[];
    strategicAdvice: string[];
  };
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

// ============================================================
// EXAM CONFIGURATION
// ============================================================

type ExamType = 'cle';
type PaperSize = 'mini' | 'semi' | 'full';

interface ExamConfig {
  marks: number;
  totalGenerated: number;
  compulsoryMarks: number;
  optionalMarks: number;
  optionalCount: number;
  optionalChoose: number;
  time: number; // minutes
  label: string;
}

const PAPER_SIZES: Record<ExamType, Record<PaperSize, ExamConfig>> = {
  cle: {
    mini: { marks: 15, totalGenerated: 4, compulsoryMarks: 5, optionalMarks: 5, optionalCount: 3, optionalChoose: 2, time: 30, label: 'Mini Paper' },
    semi: { marks: 30, totalGenerated: 5, compulsoryMarks: 10, optionalMarks: 10, optionalCount: 4, optionalChoose: 2, time: 60, label: 'Semi Paper' },
    full: { marks: 60, totalGenerated: 6, compulsoryMarks: 20, optionalMarks: 10, optionalCount: 5, optionalChoose: 4, time: 180, label: 'Full Paper (CLE Standard)' },
  },
};

// ============================================================
// ANIMATED MODAL COMPONENT
// ============================================================

interface AnimatedModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

function AnimatedModal({ isOpen, onClose, children, size = 'md' }: AnimatedModalProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsAnimating(true);
        });
      });
    } else {
      setIsAnimating(false);
      const timeout = setTimeout(() => setIsVisible(false), 300);
      return () => clearTimeout(timeout);
    }
  }, [isOpen]);

  if (!isVisible) return null;

  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ease-out ${
          isAnimating ? 'opacity-100' : 'opacity-0'
        }`}
      />

      {/* Modal */}
      <div
        className={`
          relative bg-background rounded-2xl shadow-2xl shadow-black/20 w-full ${sizeClasses[size]}
          overflow-hidden transition-all duration-300 ease-out origin-center max-h-[90vh] flex flex-col
          ${isAnimating ? 'scale-100 opacity-100 translate-y-0' : 'scale-95 opacity-0 translate-y-4'}
        `}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

// ============================================================
// GRADE INTERFACES + HELPER COMPONENTS (for question attempts)
// ============================================================

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

function AnnotatedDraftQ({ text, annotations, activeIdx, onSelect }: {
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

function ToolBtnQ({ icon: Icon, title, onClick }: { icon: any; title: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} title={title}
      className="p-1.5 rounded hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors">
      <Icon className="h-3.5 w-3.5" />
    </button>
  );
}

// ============================================================
// MAIN COMPONENT
// ============================================================

// ============================================================
// MAIN COMPONENT — TWO-TAB LAYOUT
// ============================================================

type PageTab = 'practice' | 'past-papers';
type PastPapersView = 'browse' | 'paper' | 'analysis' | 'deep-analysis';

export default function ExamsPage() {
  const router = useRouter();
  const { getIdToken } = useAuth();
  const { setAuthToken, onExamsPageVisit } = usePreloading();
  const { tier } = useSubscription();
  const isPaidTier = tier !== 'free_trial';
  
  // ── Top-level tab ──
  const [activeTab, setActiveTab] = useState<PageTab>('practice');

  // ── Practice exam selection flow ──
  const [step, setStep] = useState<'paper' | 'unit' | 'confirm'>('paper');
  const selectedType: ExamType = 'cle';
  const [selectedPaper, setSelectedPaper] = useState<PaperSize | null>(null);
  const [selectedUnit, setSelectedUnit] = useState<typeof ATP_UNITS[number] | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  // ── Past papers state ──
  const [ppView, setPpView] = useState<PastPapersView>('browse');
  const [papers, setPapers] = useState<PastPaperEntry[]>([]);
  const [topicFrequency, setTopicFrequency] = useState<Record<string, number>>({});
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [ppLoading, setPpLoading] = useState(false);
  const [ppFilterUnit, setPpFilterUnit] = useState('');
  const [ppFilterYear, setPpFilterYear] = useState('');
  const [activePaper, setActivePaper] = useState<PastPaperEntry | null>(null);
  const [questions, setQuestions] = useState<PastQuestion[]>([]);
  const [paperLoading, setPaperLoading] = useState(false);
  const [generatingFor, setGeneratingFor] = useState<string | null>(null);
  const [generated, setGenerated] = useState<Record<string, GeneratedQuestion>>({});
  const [showAnswer, setShowAnswer] = useState<Record<string, boolean>>({});

  // ── Deep analysis state ──
  const [analysisReport, setAnalysisReport] = useState<AnalysisReport | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisGenerating, setAnalysisGenerating] = useState(false);
  const [analysisChatMessages, setAnalysisChatMessages] = useState<ChatMessage[]>([]);
  const [analysisChatInput, setAnalysisChatInput] = useState('');
  const [analysisChatLoading, setAnalysisChatLoading] = useState(false);
  const [analysisAskCount, setAnalysisAskCount] = useState(0);
  const [analysisSection, setAnalysisSection] = useState<'overview' | 'topics' | 'trends' | 'predictions' | 'guidance' | 'chat'>('overview');

  // ── Immersive question attempt ──
  const [paperActionModal, setPaperActionModal] = useState<PastPaperEntry | null>(null);
  const [examModeActive, setExamModeActive] = useState(false);
  const [attemptQuestion, setAttemptQuestion] = useState<{
    questionText: string; marks: number | null; questionType: string; unitName: string;
  } | null>(null);
  const [attemptPhase, setAttemptPhase] = useState<'drafting' | 'grading' | 'results'>('drafting');
  const [attemptGrade, setAttemptGrade] = useState<GradeResult | null>(null);
  const [attemptActiveAnn, setAttemptActiveAnn] = useState<number | null>(null);
  const [attemptDraftText, setAttemptDraftText] = useState('');
  const attemptDraftRef = useRef<HTMLDivElement>(null);

  // Trigger preloading when page loads
  useEffect(() => {
    async function initPreloading() {
      try {
        const token = await getIdToken();
        if (token) {
          setAuthToken(token);
          onExamsPageVisit();
        }
      } catch (error) {
        console.error('Failed to init preloading:', error);
      }
    }
    initPreloading();
  }, [getIdToken, setAuthToken, onExamsPageVisit]);

  // ── Past papers fetch ──
  const fetchPapers = useCallback(async () => {
    setPpLoading(true);
    try {
      const params = new URLSearchParams();
      if (ppFilterUnit) params.set('unitId', ppFilterUnit);
      if (ppFilterYear) params.set('year', ppFilterYear);
      const res = await fetch(`/api/past-papers?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setPapers(data.papers || []);
      setTopicFrequency(data.topicFrequency || {});
      setAvailableYears(data.availableYears || []);
    } catch (err) {
      console.error('Failed to fetch past papers:', err);
    } finally {
      setPpLoading(false);
    }
  }, [ppFilterUnit, ppFilterYear]);

  useEffect(() => {
    if (activeTab === 'past-papers') fetchPapers();
  }, [activeTab, fetchPapers]);

  const openPaper = async (paper: PastPaperEntry) => {
    setPaperLoading(true);
    setActivePaper(paper);
    setPpView('paper');
    try {
      const res = await fetch(`/api/past-papers?paperId=${paper.id}`);
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      setQuestions(data.questions || []);
    } catch (err) {
      console.error('Failed to fetch questions:', err);
    } finally {
      setPaperLoading(false);
    }
  };

  const generateSimilar = async (question: PastQuestion) => {
    setGeneratingFor(question.id);
    try {
      const token = await getIdToken();
      const res = await fetch('/api/past-papers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          action: 'similar_question',
          questionText: question.questionText,
          unitName: activePaper?.unitName,
          topics: question.topics,
          marks: question.marks,
          questionType: question.questionType,
        }),
      });
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      if (data.generatedQuestion) {
        setGenerated(prev => ({ ...prev, [question.id]: data.generatedQuestion }));
      }
    } catch (err) {
      console.error('Failed to generate similar question:', err);
    } finally {
      setGeneratingFor(null);
    }
  };

  // ── Deep analysis functions ──
  const fetchAnalysis = useCallback(async () => {
    setAnalysisLoading(true);
    try {
      const res = await fetch('/api/past-papers/analysis');
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      if (data.report) setAnalysisReport(data.report as AnalysisReport);
    } catch (err) {
      console.error('Failed to fetch analysis:', err);
    } finally {
      setAnalysisLoading(false);
    }
  }, []);

  useEffect(() => {
    if (ppView === 'deep-analysis' && !analysisReport && !analysisLoading) fetchAnalysis();
  }, [ppView, analysisReport, analysisLoading, fetchAnalysis]);

  const generateAnalysis = async () => {
    setAnalysisGenerating(true);
    try {
      const token = await getIdToken();
      const res = await fetch('/api/past-papers/analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'generate' }),
      });
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      if (data.report) setAnalysisReport(data.report as AnalysisReport);
    } catch (err) {
      console.error('Failed to generate analysis:', err);
    } finally {
      setAnalysisGenerating(false);
    }
  };

  const sendAnalysisChat = async () => {
    if (!analysisChatInput.trim() || analysisChatLoading) return;
    const userMsg: ChatMessage = { role: 'user', content: analysisChatInput.trim() };
    setAnalysisChatMessages(prev => [...prev, userMsg]);
    setAnalysisChatInput('');
    setAnalysisChatLoading(true);
    try {
      const token = await getIdToken();
      const res = await fetch('/api/past-papers/analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          action: 'followup',
          question: userMsg.content,
          conversationHistory: analysisChatMessages,
          askCount: analysisAskCount,
        }),
      });
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      setAnalysisChatMessages(prev => [...prev, { role: 'assistant', content: data.answer }]);
      setAnalysisAskCount(data.askCount || analysisAskCount + 1);
    } catch (err) {
      setAnalysisChatMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, I couldn\'t process that request. Please try again.' }]);
    } finally {
      setAnalysisChatLoading(false);
    }
  };

  // ── Immersive question attempt helpers ──
  const startAttempt = (questionText: string, marks: number | null, questionType: string, unitName: string) => {
    setAttemptQuestion({ questionText, marks, questionType, unitName });
    setAttemptPhase('drafting');
    setAttemptGrade(null);
    setAttemptDraftText('');
    setAttemptActiveAnn(null);
    setTimeout(() => { if (attemptDraftRef.current) attemptDraftRef.current.innerText = ''; }, 50);
  };

  const submitAttempt = async () => {
    const text = attemptDraftRef.current?.innerText || '';
    setAttemptDraftText(text);
    setAttemptPhase('grading');
    try {
      const token = await getIdToken();
      const res = await fetch('/api/drafting/grade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          draft: text,
          documentType: attemptQuestion?.questionType || 'essay question',
          scenario: attemptQuestion?.questionText || '',
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setAttemptGrade({
          overallScore: data.overallScore ?? 0,
          grade: data.grade ?? '?',
          summary: data.summary ?? '',
          categories: data.categories ?? { structure: 0, substance: 0, legalAccuracy: 0, language: 0, formatting: 0 },
          annotations: data.annotations ?? [],
          strengths: data.strengths ?? [],
          improvements: data.improvements ?? [],
        });
      }
    } catch { /* silent */ }
    setAttemptPhase('results');
  };

  const execAttemptCmd = (cmd: string, val?: string) => {
    document.execCommand(cmd, false, val);
    attemptDraftRef.current?.focus();
  };

  // ── Practice exam helpers ──
  const openModal = () => {
    setStep('paper');
    setSelectedPaper(null);
    setSelectedUnit(null);
    setModalOpen(true);
  };
  const closeModal = () => setModalOpen(false);
  const handlePaperSelect = (size: PaperSize) => { setSelectedPaper(size); setStep('unit'); };
  const handleUnitSelect = (unit: typeof ATP_UNITS[number]) => { setSelectedUnit(unit); setStep('confirm'); };
  const handleStartExam = () => {
    if (selectedUnit && selectedPaper) {
      router.push(`/exams/${selectedUnit.id}?type=${selectedType}&paper=${selectedPaper}`);
    }
  };
  const goBack = () => {
    if (step === 'confirm') setStep('unit');
    else if (step === 'unit') setStep('paper');
    else closeModal();
  };
  const config = selectedPaper ? PAPER_SIZES[selectedType][selectedPaper] : null;

  // ── Past papers helpers ──
  const sortedTopics = Object.entries(topicFrequency).sort(([, a], [, b]) => b - a);
  const maxFrequency = sortedTopics.length > 0 ? sortedTopics[0][1] : 1;
  const papersByYear = papers.reduce<Record<number, PastPaperEntry[]>>((acc, p) => {
    (acc[p.year] = acc[p.year] || []).push(p);
    return acc;
  }, {});
  const sortedYears = Object.keys(papersByYear).map(Number).sort((a, b) => b - a);

  return (
    <PremiumGate feature="cle_exam">
    <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-8">

      {/* ────────────────────────────────────────────────────────
          HEADER + TAB SWITCHER
         ──────────────────────────────────────────────────────── */}
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Examinations</h1>
            <p className="text-muted-foreground mt-1">
              {activeTab === 'practice'
                ? 'Test your mastery under timed conditions'
                : ppView === 'paper'
                  ? `${activePaper?.unitName} — ${activePaper?.year}`
                  : 'Browse KSL past examination papers (2010–2025)'
              }
            </p>
          </div>
          {activeTab === 'practice' && (
            <button
              onClick={openModal}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors"
            >
              <Sparkles className="h-4 w-4" />
              Start New Exam
            </button>
          )}
          {activeTab === 'past-papers' && ppView === 'paper' && (
            <button
              onClick={() => { setPpView('browse'); setActivePaper(null); setQuestions([]); setGenerated({}); setShowAnswer({}); setExamModeActive(false); }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-muted/50 hover:bg-muted transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Papers
            </button>
          )}
        </div>

        {/* Tab bar */}
        {!(activeTab === 'past-papers' && ppView === 'paper') && (
          <div className="flex items-center gap-1 p-1 rounded-2xl bg-muted/30 w-fit">
            {([
              { key: 'practice' as PageTab, label: 'Practice Exams', icon: Edit3 },
              { key: 'past-papers' as PageTab, label: 'Past Papers', icon: ScrollText },
            ]).map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => { setActiveTab(tab.key); if (tab.key === 'past-papers') setPpView('browse'); }}
                  className={`
                    relative flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all duration-300
                    ${isActive
                      ? 'bg-background text-foreground shadow-sm shadow-black/5'
                      : 'text-muted-foreground hover:text-foreground'
                    }
                  `}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ════════════════════════════════════════════════════════════════
           PRACTICE EXAMS TAB
         ════════════════════════════════════════════════════════════════ */}
      {activeTab === 'practice' && (
        <div className="space-y-10 animate-in fade-in duration-300">
          {/* Quick Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { icon: Target, value: '60', label: 'Max Marks', gradient: 'from-emerald-500/6 to-transparent', iconBg: 'bg-emerald-500/10', iconColor: 'text-emerald-600' },
              { icon: Timer, value: '3h', label: 'CLE Time', gradient: 'from-sky-500/6 to-transparent', iconBg: 'bg-sky-500/10', iconColor: 'text-sky-600' },
              { icon: FileQuestion, value: '3', label: 'Paper Sizes', gradient: 'from-violet-500/6 to-transparent', iconBg: 'bg-violet-500/10', iconColor: 'text-violet-600' },
              { icon: GraduationCap, value: '12', label: 'ATP Units', gradient: 'from-amber-500/6 to-transparent', iconBg: 'bg-amber-500/10', iconColor: 'text-amber-600' },
            ].map((stat) => {
              const Icon = stat.icon;
              return (
                <div key={stat.label} className={`rounded-2xl bg-gradient-to-br ${stat.gradient} p-5`}>
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-xl ${stat.iconBg}`}>
                      <Icon className={`h-4 w-4 ${stat.iconColor}`} />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{stat.value}</p>
                      <p className="text-xs text-muted-foreground">{stat.label}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* CLE Exam Format */}
          <div className="rounded-2xl p-6 bg-gradient-to-br from-stone-500/5 via-stone-400/3 to-transparent dark:from-stone-400/5 dark:via-stone-400/3">
            <div className="flex items-start gap-4 mb-5">
              <div className="p-3 rounded-xl bg-stone-500/8 dark:bg-stone-400/8">
                <Edit3 className="h-6 w-6 text-stone-600 dark:text-stone-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">CLE Standard Written Exam</h3>
                <p className="text-sm text-muted-foreground">Written exam format with AI-powered grading and detailed feedback</p>
              </div>
            </div>
            <div className="grid sm:grid-cols-3 gap-3">
              {(['mini', 'semi', 'full'] as PaperSize[]).map((size) => {
                const cfg = PAPER_SIZES.cle[size];
                return (
                  <button
                    key={size}
                    onClick={() => { setSelectedPaper(size); setStep('unit'); setModalOpen(true); }}
                    className="group text-left p-4 rounded-xl bg-card/40 hover:bg-card/80 border border-border/20 hover:border-primary/20 transition-all"
                  >
                    <p className="font-medium text-sm">{cfg.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{cfg.marks} marks · Q1 + choose {cfg.optionalChoose}/{cfg.optionalCount} · {cfg.time} min</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ATP Units Grid */}
          <div>
            <h2 className="text-lg font-semibold mb-4">Available Units</h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {ATP_UNITS.map((unit) => {
                const Icon = ICON_MAP[unit.icon] || BookOpen;
                return (
                  <button
                    key={unit.id}
                    className="group text-left rounded-xl p-4 bg-gradient-to-br from-muted/40 to-transparent hover:from-primary/6 hover:to-transparent transition-all duration-300"
                    onClick={() => { setSelectedUnit(unit); setStep('paper'); setModalOpen(true); }}
                  >
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-primary/8 shrink-0">
                        <Icon className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">{(unit as any).code}</p>
                        <p className="font-medium text-sm truncate">{unit.name}</p>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-60 transition-opacity shrink-0 mt-1" />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════
           PAST PAPERS TAB
         ════════════════════════════════════════════════════════════════ */}
      {activeTab === 'past-papers' && (
        <div className="animate-in fade-in duration-300">
          {!isPaidTier ? (
            <FeatureLockedScreen feature="cle_exam" tier={tier} inline />
          ) : (
          <>
          {/* ── Browse / Analysis sub-navigation ── */}
          {ppView !== 'paper' && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center gap-3">
                {/* Sub-view pills */}
                <div className="flex gap-1.5 p-0.5 rounded-xl bg-muted/20">
                  {[
                    { key: 'browse' as PastPapersView, label: 'Browse', icon: Eye },
                    { key: 'analysis' as PastPapersView, label: 'Topic Analysis', icon: BarChart3 },
                    { key: 'deep-analysis' as PastPapersView, label: 'Deep Analysis', icon: Brain },
                  ].map(v => {
                    const Icon = v.icon;
                    return (
                      <button
                        key={v.key}
                        onClick={() => setPpView(v.key)}
                        className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
                          ppView === v.key
                            ? 'bg-background text-foreground shadow-sm'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        {v.label}
                      </button>
                    );
                  })}
                </div>

                {/* Filters — only for Browse & Topic Analysis views */}
                {(ppView === 'browse' || ppView === 'analysis') && (
                <div className="flex flex-wrap gap-2 ml-auto">
                  <div className="relative">
                    <select
                      value={ppFilterUnit}
                      onChange={(e) => setPpFilterUnit(e.target.value)}
                      className="appearance-none pl-8 pr-7 py-1.5 rounded-lg bg-card border border-border/20 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
                    >
                      <option value="">All Units</option>
                      {ATP_UNITS.map(u => (
                        <option key={u.id} value={u.id}>{u.code} — {u.name}</option>
                      ))}
                    </select>
                    <Filter className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none" />
                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none" />
                  </div>
                  <div className="relative">
                    <select
                      value={ppFilterYear}
                      onChange={(e) => setPpFilterYear(e.target.value)}
                      className="appearance-none pl-8 pr-7 py-1.5 rounded-lg bg-card border border-border/20 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
                    >
                      <option value="">All Years</option>
                      {availableYears.map(y => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                    <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none" />
                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none" />
                  </div>
                  {(ppFilterUnit || ppFilterYear) && (
                    <button
                      onClick={() => { setPpFilterUnit(''); setPpFilterYear(''); }}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-medium text-muted-foreground hover:bg-muted/40 transition-colors"
                    >
                      <X className="h-3 w-3" />
                      Clear
                    </button>
                  )}
                </div>
                )}
              </div>
            </div>
          )}

          {/* Loading */}
          {ppLoading && (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-primary/60" />
            </div>
          )}

          {/* ── BROWSE VIEW ── */}
          {!ppLoading && ppView === 'browse' && (
            <div className="space-y-8 mt-6">
              {papers.length === 0 ? (
                <div className="text-center py-20">
                  <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-muted/60 to-muted/20 flex items-center justify-center mb-4">
                    <ScrollText className="h-8 w-8 text-muted-foreground/40" />
                  </div>
                  <p className="text-lg font-medium text-muted-foreground">No past papers yet</p>
                  <p className="text-sm text-muted-foreground/70 mt-1">Papers will appear here once uploaded</p>
                </div>
              ) : (
                <>
                  {/* Stats ribbon */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { icon: ScrollText, value: papers.length.toString(), label: 'Papers', gradient: 'from-emerald-500/6 to-transparent', iconBg: 'bg-emerald-500/10', iconColor: 'text-emerald-600' },
                      { icon: Calendar, value: availableYears.length > 0 ? `${availableYears[availableYears.length - 1]}–${availableYears[0]}` : '—', label: 'Year Range', gradient: 'from-sky-500/6 to-transparent', iconBg: 'bg-sky-500/10', iconColor: 'text-sky-600' },
                      { icon: Hash, value: sortedTopics.length.toString(), label: 'Topics Covered', gradient: 'from-violet-500/6 to-transparent', iconBg: 'bg-violet-500/10', iconColor: 'text-violet-600' },
                      { icon: TrendingUp, value: sortedTopics.length > 0 ? sortedTopics[0][0].slice(0, 18) : '—', label: 'Most Tested', gradient: 'from-amber-500/6 to-transparent', iconBg: 'bg-amber-500/10', iconColor: 'text-amber-600' },
                    ].map(s => {
                      const Icon = s.icon;
                      return (
                        <div key={s.label} className={`rounded-2xl bg-gradient-to-br ${s.gradient} p-4`}>
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-xl ${s.iconBg}`}>
                              <Icon className={`h-4 w-4 ${s.iconColor}`} />
                            </div>
                            <div className="min-w-0">
                              <p className="text-lg font-bold truncate">{s.value}</p>
                              <p className="text-[10px] text-muted-foreground">{s.label}</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Papers grouped by year */}
                  {sortedYears.map(year => (
                    <div key={year}>
                      <div className="flex items-center gap-2 mb-3">
                        <div className="h-px flex-1 bg-border/20" />
                        <span className="text-xs font-bold text-muted-foreground tracking-widest uppercase">{year}</span>
                        <div className="h-px flex-1 bg-border/20" />
                      </div>
                      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {papersByYear[year].map(paper => {
                          const unit = ATP_UNITS.find(u => u.id === paper.unitId);
                          const Icon = unit ? (ICON_MAP[unit.icon] || BookOpen) : BookOpen;
                          return (
                            <button
                              key={paper.id}
                              onClick={() => setPaperActionModal(paper)}
                              className="group text-left rounded-2xl p-4 bg-gradient-to-br from-muted/30 to-transparent hover:from-primary/5 hover:to-transparent border border-transparent hover:border-primary/10 transition-all duration-300 hover:shadow-md hover:shadow-primary/5"
                            >
                              <div className="flex items-start gap-3">
                                <div className="p-2.5 rounded-xl bg-primary/6 group-hover:bg-primary/12 transition-colors shrink-0">
                                  <Icon className="h-4 w-4 text-primary" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">{unit?.code || paper.unitId}</p>
                                  <p className="font-medium text-sm truncate mt-0.5">{paper.unitName}</p>
                                  <div className="flex items-center gap-2.5 mt-2 text-[10px] text-muted-foreground">
                                    {paper.totalMarks && (
                                      <span className="flex items-center gap-0.5">
                                        <Hash className="h-2.5 w-2.5" />{paper.totalMarks}m
                                      </span>
                                    )}
                                    <span>{paper.questionCount} Qs</span>
                                    {paper.sitting !== 'main' && (
                                      <span className="px-1.5 py-0.5 bg-amber-500/10 text-amber-600 rounded text-[9px] font-semibold uppercase">
                                        {paper.sitting}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <ChevronRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-primary/60 transition-colors shrink-0 mt-0.5" />
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}

          {/* ── TOPIC ANALYSIS VIEW ── */}
          {!ppLoading && ppView === 'analysis' && (
            <div className="mt-6">
              {sortedTopics.length === 0 ? (
                <div className="text-center py-20">
                  <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-muted/60 to-muted/20 flex items-center justify-center mb-4">
                    <BarChart3 className="h-8 w-8 text-muted-foreground/40" />
                  </div>
                  <p className="text-lg font-medium text-muted-foreground">No topic data yet</p>
                  <p className="text-sm text-muted-foreground/70 mt-1">Topic analysis appears once papers are uploaded</p>
                </div>
              ) : (
                <div className="rounded-2xl p-6 bg-gradient-to-br from-violet-500/4 via-transparent to-transparent">
                  <div className="mb-6">
                    <h3 className="text-lg font-semibold">Topic Frequency</h3>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      How often each topic has been tested across {papers.length} paper{papers.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <div className="space-y-2.5">
                    {sortedTopics.slice(0, 30).map(([topic, freq], i) => (
                      <div key={topic} className="group flex items-center gap-3">
                        <span className="text-[10px] font-bold text-muted-foreground/40 w-5 text-right tabular-nums">{i + 1}</span>
                        <span className="text-sm font-medium w-[180px] md:w-[280px] truncate shrink-0" title={topic}>
                          {topic}
                        </span>
                        <div className="flex-1 h-7 bg-muted/15 rounded-lg overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-violet-500/80 to-purple-400/60 rounded-lg transition-all duration-700 ease-out flex items-center justify-end pr-2.5"
                            style={{ width: `${Math.max((freq / maxFrequency) * 100, 10)}%` }}
                          >
                            <span className="text-[10px] font-bold text-white drop-shadow-sm">
                              {freq}×
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  {sortedTopics.length > 30 && (
                    <p className="text-xs text-muted-foreground mt-4 text-center">
                      Showing top 30 of {sortedTopics.length} topics
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── DEEP ANALYSIS VIEW ── */}
          {ppView === 'deep-analysis' && (
            <div className="mt-6">
              {analysisLoading && (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="h-8 w-8 animate-spin text-primary/60" />
                </div>
              )}

              {!analysisLoading && !analysisReport && (
                <div className="text-center py-16 space-y-4">
                  <div className="mx-auto flex flex-col items-center gap-2 mb-6">
                    <Image src="/favicon-32x32.png" alt="Ynai" width={40} height={40} className="rounded-lg" />
                    <span className="text-xs font-semibold tracking-widest uppercase text-primary/70">Study Smart</span>
                  </div>
                  <h3 className="text-xl font-bold">Deep Pattern Analysis</h3>
                  <p className="text-sm text-muted-foreground max-w-md mx-auto">
                    Generate a comprehensive AI-powered analysis of all past papers — topic trends, prediction insights, cross-unit patterns, and strategic study guidance.
                  </p>
                  <button
                    onClick={generateAnalysis}
                    disabled={analysisGenerating}
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-medium hover:from-indigo-600 hover:to-purple-600 transition-all disabled:opacity-60"
                  >
                    {analysisGenerating ? (
                      <><Loader2 className="h-4 w-4 animate-spin" />Analyzing {papers.length || '…'} papers…</>
                    ) : (
                      <><Brain className="h-4 w-4" />Generate Deep Analysis</>
                    )}
                  </button>
                  {analysisGenerating && (
                    <p className="text-xs text-muted-foreground animate-pulse">This may take 30–60 seconds. The AI is analyzing every pattern across all papers.</p>
                  )}
                </div>
              )}

              {!analysisLoading && analysisReport && (
                <div className="space-y-6">
                  {/* Ynai Branding Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Image src="/favicon-32x32.png" alt="Ynai" width={28} height={28} className="rounded-md" />
                      <div>
                        <h3 className="text-sm font-bold leading-none">Ynai Deep Analysis</h3>
                        <p className="text-[10px] font-medium tracking-widest uppercase text-primary/60 mt-0.5">Study Smart</p>
                      </div>
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      {analysisReport.summary?.totalPapers || '—'} papers &middot; {analysisReport.summary?.yearRange || '2018–2025'}
                    </div>
                  </div>

                  {/* Section Navigation */}
                  <div className="flex flex-wrap gap-1.5 p-1 rounded-xl bg-muted/15">
                    {[
                      { key: 'overview' as const, label: 'Overview', icon: Layers },
                      { key: 'topics' as const, label: 'Topics', icon: BarChart3 },
                      { key: 'trends' as const, label: 'Trends', icon: TrendingUp },
                      { key: 'predictions' as const, label: 'Predictions', icon: Lightbulb },
                      { key: 'guidance' as const, label: 'Study Guide', icon: Target },
                      { key: 'chat' as const, label: 'Ask AI', icon: MessageCircle },
                    ].map(s => {
                      const Icon = s.icon;
                      return (
                        <button
                          key={s.key}
                          onClick={() => setAnalysisSection(s.key)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                            analysisSection === s.key
                              ? 'bg-background text-foreground shadow-sm'
                              : 'text-muted-foreground hover:text-foreground'
                          }`}
                        >
                          <Icon className="h-3.5 w-3.5" />
                          {s.label}
                        </button>
                      );
                    })}
                  </div>

                  {/* ── OVERVIEW Section ── */}
                  {analysisSection === 'overview' && (
                    <div className="space-y-6 animate-in fade-in duration-300">
                      {/* Summary stats */}
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                        {[
                          { label: 'Papers', value: analysisReport.summary.totalPapers, icon: ScrollText, color: 'emerald' },
                          { label: 'Questions', value: analysisReport.summary.totalQuestions, icon: Hash, color: 'sky' },
                          { label: 'Units', value: analysisReport.summary.unitsAnalyzed, icon: Layers, color: 'violet' },
                          { label: 'Sittings', value: analysisReport.summary.sittingsAnalyzed, icon: Calendar, color: 'amber' },
                          { label: 'Year Range', value: analysisReport.summary.yearRange, icon: Clock, color: 'rose' },
                        ].map(s => {
                          const Icon = s.icon;
                          return (
                            <div key={s.label} className={`rounded-2xl bg-gradient-to-br from-${s.color}-500/6 to-transparent p-4`}>
                              <div className={`p-2 rounded-xl bg-${s.color}-500/10 w-fit mb-2`}>
                                <Icon className={`h-4 w-4 text-${s.color}-600`} />
                              </div>
                              <p className="text-lg font-bold">{s.value}</p>
                              <p className="text-[10px] text-muted-foreground">{s.label}</p>
                            </div>
                          );
                        })}
                      </div>

                      {/* Question Type Distribution */}
                      {analysisReport.questionTypePatterns?.overallDistribution && (
                        <div className="rounded-2xl p-6 bg-gradient-to-br from-sky-500/4 to-transparent">
                          <h3 className="text-base font-semibold mb-4 flex items-center gap-2">
                            <PieChart className="h-4 w-4 text-sky-500" /> Question Type Distribution
                          </h3>
                          <div className="grid grid-cols-3 gap-4">
                            {Object.entries(analysisReport.questionTypePatterns.overallDistribution).map(([type, count]) => {
                              const total = Object.values(analysisReport.questionTypePatterns.overallDistribution).reduce((a, b) => a + b, 0);
                              const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                              const colors: Record<string, string> = { essay: 'from-blue-500 to-blue-400', problem: 'from-amber-500 to-orange-400', drafting: 'from-emerald-500 to-green-400' };
                              return (
                                <div key={type} className="text-center">
                                  <div className="relative w-20 h-20 mx-auto mb-2">
                                    <svg className="w-20 h-20 -rotate-90" viewBox="0 0 36 36">
                                      <circle cx="18" cy="18" r="15.5" fill="none" stroke="currentColor" className="text-muted/20" strokeWidth="3" />
                                      <circle cx="18" cy="18" r="15.5" fill="none" stroke="url(#grad)" strokeWidth="3" strokeDasharray={`${pct} ${100 - pct}`} strokeLinecap="round" />
                                      <defs><linearGradient id="grad"><stop offset="0%" stopColor="var(--color-primary)" /><stop offset="100%" stopColor="var(--color-primary)" /></linearGradient></defs>
                                    </svg>
                                    <span className="absolute inset-0 flex items-center justify-center text-sm font-bold">{pct}%</span>
                                  </div>
                                  <p className="text-sm font-medium capitalize">{type}</p>
                                  <p className="text-[10px] text-muted-foreground">{count} questions</p>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Difficulty Distribution */}
                      {analysisReport.difficultyAnalysis?.overallDistribution && (
                        <div className="rounded-2xl p-6 bg-gradient-to-br from-amber-500/4 to-transparent">
                          <h3 className="text-base font-semibold mb-4 flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4 text-amber-500" /> Difficulty Distribution
                          </h3>
                          <div className="space-y-3">
                            {Object.entries(analysisReport.difficultyAnalysis.overallDistribution).map(([level, count]) => {
                              const total = Object.values(analysisReport.difficultyAnalysis.overallDistribution).reduce((a, b) => a + b, 0);
                              const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                              const colors: Record<string, string> = { easy: 'from-green-500/70 to-green-400/50', medium: 'from-amber-500/70 to-yellow-400/50', hard: 'from-red-500/70 to-rose-400/50' };
                              return (
                                <div key={level} className="flex items-center gap-3">
                                  <span className="text-xs font-medium w-16 capitalize">{level}</span>
                                  <div className="flex-1 h-6 bg-muted/15 rounded-lg overflow-hidden">
                                    <div
                                      className={`h-full bg-gradient-to-r ${colors[level] || 'from-gray-500 to-gray-400'} rounded-lg flex items-center justify-end pr-2`}
                                      style={{ width: `${Math.max(pct, 5)}%` }}
                                    >
                                      <span className="text-[10px] font-bold text-white drop-shadow-sm">{pct}%</span>
                                    </div>
                                  </div>
                                  <span className="text-xs text-muted-foreground w-12 text-right">{count}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Marks Allocation */}
                      {analysisReport.marksAllocation && (
                        <div className="rounded-2xl p-6 bg-gradient-to-br from-violet-500/4 to-transparent">
                          <h3 className="text-base font-semibold mb-4 flex items-center gap-2">
                            <Hash className="h-4 w-4 text-violet-500" /> Marks Allocation
                          </h3>
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
                            <div className="p-3 rounded-xl bg-violet-500/6">
                              <p className="text-2xl font-bold">{analysisReport.marksAllocation.avgMarksCompulsory}</p>
                              <p className="text-[10px] text-muted-foreground">Avg. Compulsory Marks</p>
                            </div>
                            <div className="p-3 rounded-xl bg-sky-500/6">
                              <p className="text-2xl font-bold">{analysisReport.marksAllocation.avgMarksOptional}</p>
                              <p className="text-[10px] text-muted-foreground">Avg. Optional Marks</p>
                            </div>
                            {analysisReport.examStructureAnalysis?.timingTrends && (
                              <div className="p-3 rounded-xl bg-emerald-500/6">
                                <p className="text-2xl font-bold">{analysisReport.examStructureAnalysis.timingTrends.avgQuestionsPerPaper}</p>
                                <p className="text-[10px] text-muted-foreground">Avg. Questions/Paper</p>
                              </div>
                            )}
                          </div>
                          {analysisReport.marksAllocation.commonMarksValues?.length > 0 && (
                            <div>
                              <p className="text-xs font-medium text-muted-foreground mb-2">Most Common Mark Values</p>
                              <div className="flex flex-wrap gap-2">
                                {analysisReport.marksAllocation.commonMarksValues.slice(0, 8).map(m => (
                                  <span key={m.marks} className="px-3 py-1.5 rounded-lg bg-violet-500/8 text-sm font-medium">
                                    {m.marks}m <span className="text-muted-foreground text-[10px]">({m.frequency}x)</span>
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Exam Structure */}
                      {analysisReport.examStructureAnalysis?.commonFormats?.length > 0 && (
                        <div className="rounded-2xl p-6 bg-gradient-to-br from-stone-500/4 to-transparent">
                          <h3 className="text-base font-semibold mb-4 flex items-center gap-2">
                            <FileText className="h-4 w-4 text-stone-500" /> Exam Structure Patterns
                          </h3>
                          <div className="space-y-2">
                            {analysisReport.examStructureAnalysis.commonFormats.map((f, i) => (
                              <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-muted/8">
                                <span className="text-[10px] font-bold text-muted-foreground bg-muted/30 px-2 py-0.5 rounded mt-0.5">{f.frequency}x</span>
                                <div>
                                  <p className="text-sm font-medium">{f.format}</p>
                                  <p className="text-xs text-muted-foreground">{f.description}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ── TOPICS Section ── */}
                  {analysisSection === 'topics' && (
                    <div className="space-y-6 animate-in fade-in duration-300">
                      {/* Global Top Topics */}
                      {analysisReport.topicAnalysis?.globalTopTopics?.length > 0 && (
                        <div className="rounded-2xl p-6 bg-gradient-to-br from-indigo-500/4 to-transparent">
                          <h3 className="text-base font-semibold mb-1">Most Tested Topics</h3>
                          <p className="text-xs text-muted-foreground mb-4">Ranked by frequency across all papers</p>
                          <div className="space-y-2">
                            {analysisReport.topicAnalysis.globalTopTopics.slice(0, 25).map((t, i) => {
                              const maxF = analysisReport.topicAnalysis.globalTopTopics[0]?.frequency || 1;
                              const TrendIcon = t.trend === 'rising' ? ArrowUpRight : t.trend === 'declining' ? ArrowDownRight : Minus;
                              const trendColor = t.trend === 'rising' ? 'text-emerald-500' : t.trend === 'declining' ? 'text-red-400' : 'text-muted-foreground';
                              return (
                                <div key={t.topic} className="group flex items-center gap-3">
                                  <span className="text-[10px] font-bold text-muted-foreground/40 w-5 text-right">{i + 1}</span>
                                  <span className="text-sm font-medium w-[160px] md:w-[240px] truncate shrink-0" title={t.topic}>{t.topic}</span>
                                  <div className="flex-1 h-7 bg-muted/10 rounded-lg overflow-hidden">
                                    <div
                                      className="h-full bg-gradient-to-r from-indigo-500/70 to-purple-400/50 rounded-lg flex items-center justify-end pr-2 transition-all duration-700"
                                      style={{ width: `${Math.max((t.frequency / maxF) * 100, 8)}%` }}
                                    >
                                      <span className="text-[10px] font-bold text-white drop-shadow-sm">{t.frequency}×</span>
                                    </div>
                                  </div>
                                  <TrendIcon className={`h-3.5 w-3.5 ${trendColor} shrink-0`} />
                                  {t.percentage > 0 && <span className="text-[10px] text-muted-foreground w-10 text-right">{t.percentage}%</span>}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Per-Unit Topic Breakdown */}
                      {analysisReport.topicAnalysis?.byUnit && (
                        <div className="rounded-2xl p-6 bg-gradient-to-br from-emerald-500/4 to-transparent">
                          <h3 className="text-base font-semibold mb-4">Topic Breakdown by Unit</h3>
                          <div className="grid md:grid-cols-2 gap-4">
                            {Object.entries(analysisReport.topicAnalysis.byUnit).map(([unitId, data]) => (
                              <div key={unitId} className="p-4 rounded-xl bg-muted/8 border border-border/10">
                                <div className="flex items-center justify-between mb-3">
                                  <h4 className="text-sm font-semibold">{data.unitName}</h4>
                                  <span className="text-[10px] text-muted-foreground bg-muted/30 px-2 py-0.5 rounded">{data.topicDiversity} topics</span>
                                </div>
                                <div className="space-y-1.5">
                                  {data.topTopics?.slice(0, 5).map(t => {
                                    const maxF = data.topTopics[0]?.frequency || 1;
                                    const TrendIcon = t.trend === 'rising' ? ArrowUpRight : t.trend === 'declining' ? ArrowDownRight : Minus;
                                    const trendColor = t.trend === 'rising' ? 'text-emerald-500' : t.trend === 'declining' ? 'text-red-400' : 'text-muted-foreground/40';
                                    return (
                                      <div key={t.topic} className="flex items-center gap-2">
                                        <span className="text-[11px] w-[120px] md:w-[160px] truncate" title={t.topic}>{t.topic}</span>
                                        <div className="flex-1 h-4 bg-muted/15 rounded overflow-hidden">
                                          <div className="h-full bg-emerald-500/50 rounded" style={{ width: `${Math.max((t.frequency / maxF) * 100, 10)}%` }} />
                                        </div>
                                        <span className="text-[10px] text-muted-foreground w-6 text-right">{t.frequency}</span>
                                        <TrendIcon className={`h-3 w-3 ${trendColor}`} />
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Cross-Unit Shared Topics */}
                      {analysisReport.crossUnitInsights?.sharedTopics?.length > 0 && (
                        <div className="rounded-2xl p-6 bg-gradient-to-br from-pink-500/4 to-transparent">
                          <h3 className="text-base font-semibold mb-1">Cross-Unit Topics</h3>
                          <p className="text-xs text-muted-foreground mb-4">Topics tested across multiple units</p>
                          <div className="space-y-2">
                            {analysisReport.crossUnitInsights.sharedTopics.slice(0, 12).map((t, i) => (
                              <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-muted/8">
                                <span className="text-sm font-medium shrink-0">{t.topic}</span>
                                <div className="flex flex-wrap gap-1 flex-1">
                                  {t.units?.map(u => (
                                    <span key={u} className="text-[9px] px-1.5 py-0.5 bg-pink-500/8 text-pink-600 rounded-full">{u}</span>
                                  ))}
                                </div>
                                <span className="text-[10px] font-medium text-muted-foreground bg-muted/20 px-2 py-0.5 rounded shrink-0">{t.frequency}×</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ── TRENDS Section ── */}
                  {analysisSection === 'trends' && (
                    <div className="space-y-6 animate-in fade-in duration-300">
                      {/* Emerging Topics */}
                      {analysisReport.yearOverYearTrends?.emergingTopics?.length > 0 && (
                        <div className="rounded-2xl p-6 bg-gradient-to-br from-emerald-500/4 to-transparent">
                          <h3 className="text-base font-semibold mb-1 flex items-center gap-2">
                            <ArrowUpRight className="h-4 w-4 text-emerald-500" /> Emerging Topics
                          </h3>
                          <p className="text-xs text-muted-foreground mb-4">Topics gaining prominence in recent exams</p>
                          <div className="grid md:grid-cols-2 gap-3">
                            {analysisReport.yearOverYearTrends.emergingTopics.map((t, i) => (
                              <div key={i} className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/10">
                                <div className="flex items-start justify-between mb-2">
                                  <p className="text-sm font-semibold">{t.topic}</p>
                                  <span className="text-[10px] px-2 py-0.5 bg-emerald-500/15 text-emerald-600 rounded-full font-medium">{t.growthRate}</span>
                                </div>
                                <p className="text-xs text-muted-foreground">First appeared: <span className="font-medium text-foreground">{t.firstAppeared}</span></p>
                                {t.units?.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mt-2">
                                    {t.units.map(u => <span key={u} className="text-[9px] px-1.5 py-0.5 bg-muted/30 rounded">{u}</span>)}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Declining Topics */}
                      {analysisReport.yearOverYearTrends?.decliningTopics?.length > 0 && (
                        <div className="rounded-2xl p-6 bg-gradient-to-br from-red-500/4 to-transparent">
                          <h3 className="text-base font-semibold mb-1 flex items-center gap-2">
                            <ArrowDownRight className="h-4 w-4 text-red-400" /> Declining Topics
                          </h3>
                          <p className="text-xs text-muted-foreground mb-4">Topics that have faded from recent papers</p>
                          <div className="space-y-2">
                            {analysisReport.yearOverYearTrends.decliningTopics.map((t, i) => (
                              <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-red-500/4">
                                <ArrowDownRight className="h-3.5 w-3.5 text-red-400 shrink-0" />
                                <span className="text-sm font-medium flex-1">{t.topic}</span>
                                <span className="text-[10px] text-muted-foreground">last: {t.lastAppeared}</span>
                                <span className="text-[10px] text-muted-foreground">was {t.previousFrequency}×</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Topic Shifts */}
                      {analysisReport.yearOverYearTrends?.topicShifts?.length > 0 && (
                        <div className="rounded-2xl p-6 bg-gradient-to-br from-amber-500/4 to-transparent">
                          <h3 className="text-base font-semibold mb-4 flex items-center gap-2">
                            <TrendingUp className="h-4 w-4 text-amber-500" /> Topic Shifts
                          </h3>
                          <div className="space-y-3">
                            {analysisReport.yearOverYearTrends.topicShifts.map((s, i) => (
                              <div key={i} className="p-3 rounded-xl bg-muted/8">
                                <div className="flex items-center gap-2 text-sm mb-1">
                                  <span className="text-red-400 line-through text-xs">{s.fromTopic}</span>
                                  <ArrowRight className="h-3 w-3 text-muted-foreground" />
                                  <span className="text-emerald-600 font-medium text-xs">{s.toTopic}</span>
                                  <span className="text-[10px] text-muted-foreground ml-auto">{s.shiftYear} · {s.unit}</span>
                                </div>
                                <p className="text-xs text-muted-foreground">{s.description}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Yearly Complexity Trend */}
                      {analysisReport.yearOverYearTrends?.yearlyComplexity?.length > 0 && (
                        <div className="rounded-2xl p-6 bg-gradient-to-br from-sky-500/4 to-transparent">
                          <h3 className="text-base font-semibold mb-4 flex items-center gap-2">
                            <BarChart3 className="h-4 w-4 text-sky-500" /> Yearly Complexity Trend
                          </h3>
                          <div className="space-y-1">
                            {analysisReport.yearOverYearTrends.yearlyComplexity.map(y => (
                              <div key={y.year} className="flex items-center gap-3">
                                <span className="text-xs font-medium w-10">{y.year}</span>
                                <div className="flex-1 flex gap-0.5 h-6">
                                  <div className="bg-blue-500/50 rounded-l h-full" style={{ width: `${y.essayRatio * 100}%` }} title={`Essay: ${Math.round(y.essayRatio * 100)}%`} />
                                  <div className="bg-amber-500/50 h-full" style={{ width: `${y.problemRatio * 100}%` }} title={`Problem: ${Math.round(y.problemRatio * 100)}%`} />
                                  <div className="bg-emerald-500/50 rounded-r h-full" style={{ width: `${y.draftingRatio * 100}%` }} title={`Drafting: ${Math.round(y.draftingRatio * 100)}%`} />
                                </div>
                                <span className="text-[10px] text-muted-foreground w-14 text-right">{y.avgMarksPerQ?.toFixed?.(1) || '?'}m avg</span>
                              </div>
                            ))}
                            <div className="flex gap-4 mt-3 text-[10px] text-muted-foreground">
                              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-blue-500/50" />Essay</span>
                              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-500/50" />Problem</span>
                              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-500/50" />Drafting</span>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Examiner Behavior */}
                      {analysisReport.predictiveInsights?.examinerBehavior?.length > 0 && (
                        <div className="rounded-2xl p-6 bg-gradient-to-br from-purple-500/4 to-transparent">
                          <h3 className="text-base font-semibold mb-4 flex items-center gap-2">
                            <Eye className="h-4 w-4 text-purple-500" /> Examiner Behavior Patterns
                          </h3>
                          <div className="space-y-3">
                            {analysisReport.predictiveInsights.examinerBehavior.map((b, i) => (
                              <div key={i} className="p-4 rounded-xl bg-purple-500/5 border border-purple-500/8">
                                <p className="text-sm font-medium mb-1">{b.observation}</p>
                                <p className="text-xs text-muted-foreground mb-2">Evidence: {b.evidence}</p>
                                <p className="text-xs text-purple-600 dark:text-purple-400 font-medium">Implication: {b.implication}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ── PREDICTIONS Section ── */}
                  {analysisSection === 'predictions' && (
                    <div className="space-y-6 animate-in fade-in duration-300">
                      {/* High Probability Topics */}
                      {analysisReport.predictiveInsights?.highProbabilityTopics?.length > 0 && (
                        <div className="rounded-2xl p-6 bg-gradient-to-br from-amber-500/4 to-transparent">
                          <h3 className="text-base font-semibold mb-1 flex items-center gap-2">
                            <Lightbulb className="h-4 w-4 text-amber-500" /> High Probability Topics for Next Exam
                          </h3>
                          <p className="text-xs text-muted-foreground mb-4">Based on cyclical patterns and recent absences</p>
                          <div className="space-y-3">
                            {analysisReport.predictiveInsights.highProbabilityTopics.map((t, i) => (
                              <div key={i} className={`p-4 rounded-xl border ${
                                t.probability === 'high' ? 'bg-amber-500/5 border-amber-500/15' : 'bg-muted/5 border-border/10'
                              }`}>
                                <div className="flex items-start justify-between mb-2">
                                  <div>
                                    <p className="text-sm font-semibold">{t.topic}</p>
                                    <p className="text-[10px] text-muted-foreground">{t.unit}</p>
                                  </div>
                                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase ${
                                    t.probability === 'high' ? 'bg-amber-500/15 text-amber-600' : 'bg-sky-500/15 text-sky-600'
                                  }`}>{t.probability}</span>
                                </div>
                                <p className="text-xs text-muted-foreground">{t.reasoning}</p>
                                <p className="text-[10px] text-muted-foreground mt-1">Last tested: <span className="font-medium text-foreground">{t.lastTested}</span></p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Cyclical Patterns */}
                      {analysisReport.predictiveInsights?.cyclicalPatterns?.length > 0 && (
                        <div className="rounded-2xl p-6 bg-gradient-to-br from-indigo-500/4 to-transparent">
                          <h3 className="text-base font-semibold mb-4 flex items-center gap-2">
                            <TrendingUp className="h-4 w-4 text-indigo-500" /> Cyclical Patterns
                          </h3>
                          <div className="space-y-3">
                            {analysisReport.predictiveInsights.cyclicalPatterns.map((p, i) => (
                              <div key={i} className="p-4 rounded-xl bg-indigo-500/5 border border-indigo-500/8">
                                <p className="text-sm font-medium mb-1">{p.pattern}</p>
                                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                  <span>Cycle: <span className="text-foreground font-medium">{p.cycle}</span></span>
                                  <span>Next: <span className="text-foreground font-medium">{p.nextExpected}</span></span>
                                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                    p.confidence === 'high' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-amber-500/10 text-amber-600'
                                  }`}>{p.confidence} confidence</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Cross-Unit Correlations */}
                      {analysisReport.crossUnitInsights?.correlations?.length > 0 && (
                        <div className="rounded-2xl p-6 bg-gradient-to-br from-rose-500/4 to-transparent">
                          <h3 className="text-base font-semibold mb-4 flex items-center gap-2">
                            <Layers className="h-4 w-4 text-rose-500" /> Cross-Unit Correlations
                          </h3>
                          <div className="space-y-2">
                            {analysisReport.crossUnitInsights.correlations.map((c, i) => (
                              <div key={i} className="p-3 rounded-xl bg-muted/8">
                                <p className="text-sm font-medium">{c.description}</p>
                                <div className="flex items-center gap-2 mt-1.5">
                                  <div className="flex gap-1">
                                    {c.units?.map(u => <span key={u} className="text-[9px] px-1.5 py-0.5 bg-rose-500/8 text-rose-600 rounded-full">{u}</span>)}
                                  </div>
                                  <span className="text-[10px] text-muted-foreground">{c.pattern}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ── GUIDANCE Section ── */}
                  {analysisSection === 'guidance' && (
                    <div className="space-y-6 animate-in fade-in duration-300">
                      {/* Must-Prepare Topics */}
                      {analysisReport.studentGuidance?.mustPrepareTopics?.length > 0 && (
                        <div className="rounded-2xl p-6 bg-gradient-to-br from-red-500/4 to-transparent">
                          <h3 className="text-base font-semibold mb-1 flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4 text-red-500" /> Must-Prepare Topics
                          </h3>
                          <p className="text-xs text-muted-foreground mb-4">Topics you cannot afford to skip</p>
                          <div className="space-y-2">
                            {analysisReport.studentGuidance.mustPrepareTopics.map((t, i) => (
                              <div key={i} className={`flex items-start gap-3 p-3 rounded-xl ${
                                t.priority === 'critical' ? 'bg-red-500/6 border border-red-500/15' :
                                t.priority === 'high' ? 'bg-amber-500/5 border border-amber-500/10' :
                                'bg-muted/8 border border-border/10'
                              }`}>
                                <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider mt-0.5 shrink-0 ${
                                  t.priority === 'critical' ? 'bg-red-500/15 text-red-600' :
                                  t.priority === 'high' ? 'bg-amber-500/15 text-amber-600' :
                                  'bg-sky-500/10 text-sky-600'
                                }`}>{t.priority}</span>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-semibold">{t.topic}</p>
                                  <p className="text-[10px] text-muted-foreground">{t.unit}</p>
                                  <p className="text-xs text-muted-foreground mt-1">{t.reason}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Safe to Deprioritize */}
                      {analysisReport.studentGuidance?.safeToDeprioritize?.length > 0 && (
                        <div className="rounded-2xl p-6 bg-gradient-to-br from-green-500/4 to-transparent">
                          <h3 className="text-base font-semibold mb-4 flex items-center gap-2">
                            <CheckCircle className="h-4 w-4 text-green-500" /> Can Deprioritize (if time-constrained)
                          </h3>
                          <div className="space-y-2">
                            {analysisReport.studentGuidance.safeToDeprioritize.map((t, i) => (
                              <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-green-500/4">
                                <CheckCircle className="h-3.5 w-3.5 text-green-500 mt-0.5 shrink-0" />
                                <div>
                                  <p className="text-sm font-medium">{t.topic}</p>
                                  <p className="text-xs text-muted-foreground">{t.reason}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Strategic Advice */}
                      {analysisReport.studentGuidance?.strategicAdvice?.length > 0 && (
                        <div className="rounded-2xl p-6 bg-gradient-to-br from-indigo-500/4 to-transparent">
                          <h3 className="text-base font-semibold mb-4 flex items-center gap-2">
                            <Sparkles className="h-4 w-4 text-indigo-500" /> Strategic Study Advice
                          </h3>
                          <div className="space-y-2">
                            {analysisReport.studentGuidance.strategicAdvice.map((advice, i) => (
                              <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-indigo-500/4">
                                <span className="text-[10px] font-bold text-indigo-500 bg-indigo-500/10 w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                                <p className="text-sm">{advice}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ── CHAT Section ── */}
                  {analysisSection === 'chat' && (
                    <div className="space-y-4 animate-in fade-in duration-300">
                      <div className="rounded-2xl p-5 bg-gradient-to-br from-indigo-500/4 to-transparent">
                        <h3 className="text-base font-semibold mb-1 flex items-center gap-2">
                          <MessageCircle className="h-4 w-4 text-indigo-500" /> Ask About the Analysis
                        </h3>
                        <p className="text-xs text-muted-foreground">
                          Ask follow-up questions about any pattern, trend, or prediction.
                          {analysisAskCount < 3 && <span className="text-indigo-500 ml-1">({3 - analysisAskCount} premium responses remaining)</span>}
                        </p>
                      </div>

                      {/* Chat messages */}
                      <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
                        {analysisChatMessages.length === 0 && (
                          <div className="text-center py-10">
                            <Brain className="h-10 w-10 text-muted-foreground/20 mx-auto mb-3" />
                            <p className="text-sm text-muted-foreground">Ask a question to start…</p>
                            <div className="flex flex-wrap gap-2 justify-center mt-4">
                              {[
                                'Which topics are most likely to appear next?',
                                'What patterns exist for Civil Litigation?',
                                'How has exam difficulty changed over the years?',
                                'What should I prioritize for the next sitting?',
                              ].map(q => (
                                <button
                                  key={q}
                                  onClick={() => { setAnalysisChatInput(q); }}
                                  className="text-[11px] px-3 py-1.5 rounded-lg bg-muted/30 hover:bg-muted/50 text-muted-foreground transition-colors text-left"
                                >
                                  {q}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {analysisChatMessages.map((msg, i) => (
                          <div
                            key={i}
                            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                          >
                            <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                              msg.role === 'user'
                                ? 'bg-primary text-primary-foreground rounded-br-sm'
                                : 'bg-muted/30 rounded-bl-sm'
                            }`}>
                              <div className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</div>
                            </div>
                          </div>
                        ))}

                        {analysisChatLoading && (
                          <div className="flex justify-start">
                            <div className="bg-muted/30 rounded-2xl rounded-bl-sm px-4 py-3">
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                Analyzing…
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Chat input */}
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={analysisChatInput}
                          onChange={(e) => setAnalysisChatInput(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendAnalysisChat()}
                          placeholder="Ask about patterns, predictions, or topics…"
                          className="flex-1 px-4 py-2.5 rounded-xl bg-card border border-border/20 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                        />
                        <button
                          onClick={sendAnalysisChat}
                          disabled={!analysisChatInput.trim() || analysisChatLoading}
                          className="px-4 py-2.5 rounded-xl bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
                        >
                          <Send className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── PAPER VIEWER ── */}
          {ppView === 'paper' && activePaper && (
            <div className="space-y-6">
              {/* Exam mode banner */}
              {examModeActive && (
                <div className="flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-primary/8 border border-primary/20">
                  <Timer className="h-4 w-4 text-primary shrink-0" />
                  <p className="text-sm font-medium flex-1">Exam Mode — model answers hidden. Use &ldquo;Attempt Question&rdquo; to answer and get AI redline feedback.</p>
                  <button onClick={() => setExamModeActive(false)} className="text-xs text-muted-foreground hover:text-foreground transition-colors shrink-0">Exit Exam Mode</button>
                </div>
              )}
              {/* Paper info card */}
              <div className="rounded-2xl p-5 bg-gradient-to-r from-primary/4 via-transparent to-transparent flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
                {activePaper.paperCode && (
                  <span className="font-semibold text-primary">{activePaper.paperCode}</span>
                )}
                {activePaper.totalMarks && (
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Hash className="h-3.5 w-3.5" /> {activePaper.totalMarks} marks
                  </span>
                )}
                {activePaper.duration && (
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" /> {activePaper.duration}
                  </span>
                )}
                <span className="text-muted-foreground">
                  {questions.length} questions
                </span>
              </div>

              {paperLoading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="h-6 w-6 animate-spin text-primary/60" />
                </div>
              ) : (
                <div className="space-y-5">
                  {questions.map((q) => {
                    const gen = generated[q.id];
                    return (
                      <div key={q.id} className="rounded-2xl border border-border/15 overflow-hidden hover:border-border/30 transition-colors">
                        {/* Question header */}
                        <div className="px-5 pt-5 pb-3">
                          <div className="flex items-center gap-2 mb-2.5 flex-wrap">
                            <span className="text-xs font-bold text-primary bg-primary/8 px-2.5 py-1 rounded-lg">
                              Q{q.questionNumber}{q.subPart ? `(${q.subPart})` : ''}
                            </span>
                            {q.marks && (
                              <span className="text-[10px] font-medium text-muted-foreground bg-muted/40 px-2 py-0.5 rounded-md">
                                {q.marks} marks
                              </span>
                            )}
                            {q.isCompulsory && (
                              <span className="text-[10px] font-semibold px-2 py-0.5 bg-red-500/8 text-red-500 rounded-md uppercase tracking-wide">
                                Compulsory
                              </span>
                            )}
                            {q.questionType && q.questionType !== 'essay' && (
                              <span className="text-[10px] font-medium px-2 py-0.5 bg-sky-500/8 text-sky-600 rounded-md capitalize">
                                {q.questionType}
                              </span>
                            )}
                          </div>
                          {q.topics.length > 0 && (
                            <div className="flex flex-wrap gap-1 mb-3">
                              {q.topics.map(t => (
                                <span key={t} className="text-[9px] px-2 py-0.5 bg-violet-500/6 text-violet-600 dark:text-violet-400 rounded-full font-medium">
                                  {t}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Question body */}
                        <div className="px-5 pb-4">
                          <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap leading-relaxed">
                            {q.questionText}
                          </div>
                        </div>

                        {/* Model Answer */}
                        {q.modelAnswer && !examModeActive && (
                          <div className="border-t border-border/10">
                            <button
                              onClick={() => setShowAnswer(prev => ({ ...prev, [q.id]: !prev[q.id] }))}
                              className="w-full px-5 py-2.5 text-left text-xs font-semibold text-emerald-600 hover:bg-emerald-500/4 transition-colors flex items-center gap-2"
                            >
                              <CheckCircle className="h-3.5 w-3.5" />
                              {showAnswer[q.id] ? 'Hide' : 'Show'} Model Answer
                            </button>
                            {showAnswer[q.id] && (
                              <div className="px-5 pb-5 prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap">
                                {q.modelAnswer}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Actions */}
                        <div className="border-t border-border/8 px-5 py-2.5 bg-muted/5 flex items-center gap-2 flex-wrap">
                          <button
                            onClick={() => startAttempt(q.questionText, q.marks, q.questionType, activePaper?.unitName || '')}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium bg-emerald-500/8 text-emerald-600 hover:bg-emerald-500/14 transition-colors"
                          >
                            <PenLine className="h-3 w-3" />
                            Attempt Question
                          </button>
                          <button
                            onClick={() => generateSimilar(q)}
                            disabled={generatingFor === q.id}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium bg-primary/6 text-primary hover:bg-primary/12 transition-colors disabled:opacity-50"
                          >
                            {generatingFor === q.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Sparkles className="h-3 w-3" />
                            )}
                            {generatingFor === q.id ? 'Generating…' : 'Get Similar Question'}
                          </button>
                        </div>

                        {/* AI Generated Question */}
                        {gen && (
                          <div className="border-t border-primary/8 bg-gradient-to-b from-primary/3 to-transparent px-5 py-4 space-y-3">
                            <div className="flex items-center gap-2 text-xs font-semibold text-primary">
                              <Sparkles className="h-3.5 w-3.5" />
                              AI-Generated Practice Question
                              {gen.marks && <span className="text-muted-foreground font-normal">({gen.marks} marks)</span>}
                            </div>
                            <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap">
                              {gen.question}
                            </div>
                            {gen.topicsCovered?.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {gen.topicsCovered.map(t => (
                                  <span key={t} className="text-[9px] px-2 py-0.5 bg-primary/8 text-primary rounded-full font-medium">
                                    {t}
                                  </span>
                                ))}
                              </div>
                            )}
                            {gen.modelAnswer && (
                              <details className="group">
                                <summary className="text-xs font-semibold text-emerald-600 cursor-pointer hover:underline flex items-center gap-1.5">
                                  <CheckCircle className="h-3 w-3" />
                                  View Model Answer
                                </summary>
                                <div className="mt-2 prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap">
                                  {gen.modelAnswer}
                                </div>
                              </details>
                            )}
                            <button
                              onClick={() => startAttempt(gen.question, gen.marks, gen.questionType, activePaper?.unitName || '')}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium bg-emerald-500/8 text-emerald-600 hover:bg-emerald-500/14 transition-colors mt-1"
                            >
                              <PenLine className="h-3 w-3" />
                              Attempt this Question
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
          </>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════
           EXAM SELECTION MODAL (shared)
         ════════════════════════════════════════════════════════════════ */}
      <AnimatedModal isOpen={modalOpen} onClose={closeModal} size="lg">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border/30">
          <div className="flex items-center gap-3">
            {step !== 'paper' && (
              <button onClick={goBack} className="p-2 -ml-2 rounded-lg hover:bg-muted/60 transition-colors">
                <ArrowLeft className="h-5 w-5" />
              </button>
            )}
            <div>
              <p className="text-xs text-muted-foreground font-medium">
                Step {step === 'paper' ? 1 : step === 'unit' ? 2 : 3} of 3
              </p>
              <h3 className="font-semibold">
                {step === 'paper' && 'Select Paper Size'}
                {step === 'unit' && 'Select ATP Unit'}
                {step === 'confirm' && 'Confirm & Start'}
              </h3>
            </div>
          </div>
          <button onClick={closeModal} className="p-2 rounded-lg hover:bg-muted/60 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Progress dots */}
        <div className="px-6 pt-4">
          <div className="flex gap-2">
            {[1, 2, 3].map((s) => {
              const stepIndex = step === 'paper' ? 1 : step === 'unit' ? 2 : 3;
              return (
                <div key={s} className={`h-1 flex-1 rounded-full transition-all duration-300 ${s <= stepIndex ? 'bg-primary' : 'bg-muted/60'}`} />
              );
            })}
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto">
          {/* Step 1: Paper Size */}
          {step === 'paper' && (
            <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-stone-500/10 text-stone-600 dark:bg-stone-400/10 dark:text-stone-400">
                  CLE Standard
                </span>
                <span>Select your exam type</span>
              </div>
              {/* Real Past Paper shortcut */}
              <button
                onClick={() => { setActiveTab('past-papers'); closeModal(); }}
                className="w-full p-4 rounded-2xl bg-gradient-to-r from-sky-500/8 to-transparent hover:from-sky-500/14 text-left transition-all duration-200 hover:shadow-md"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="p-2.5 rounded-xl bg-sky-500/15 text-sky-600">
                      <ScrollText className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-semibold">Take a Real Past Paper</p>
                      <p className="text-sm text-muted-foreground">97 real CLE papers (2018–2025) — attempt under exam conditions</p>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </div>
              </button>
              <div className="flex items-center gap-2">
                <div className="h-px flex-1 bg-border/20" />
                <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">or generate AI exam</span>
                <div className="h-px flex-1 bg-border/20" />
              </div>
              <div className="grid gap-3">
                {(['mini', 'semi', 'full'] as PaperSize[]).map((size) => {
                  const cfg = PAPER_SIZES[selectedType][size];
                  const gradients = {
                    mini: 'from-amber-500/8 to-transparent hover:from-amber-500/14 hover:shadow-amber-500/5',
                    semi: 'from-sky-500/8 to-transparent hover:from-sky-500/14 hover:shadow-sky-500/5',
                    full: 'from-rose-500/8 to-transparent hover:from-rose-500/14 hover:shadow-rose-500/5',
                  };
                  const iconColors = {
                    mini: 'bg-amber-500/15 text-amber-600',
                    semi: 'bg-sky-500/15 text-sky-600',
                    full: 'bg-rose-500/15 text-rose-600',
                  };
                  return (
                    <button
                      key={size}
                      onClick={() => handlePaperSelect(size)}
                      className={`w-full p-4 rounded-2xl bg-gradient-to-r ${gradients[size]} text-left transition-all duration-200 hover:shadow-md`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className={`p-2.5 rounded-xl ${iconColors[size]}`}>
                            {size === 'mini' && <Zap className="h-5 w-5" />}
                            {size === 'semi' && <Target className="h-5 w-5" />}
                            {size === 'full' && <Award className="h-5 w-5" />}
                          </div>
                          <div>
                            <p className="font-semibold">{cfg.label}</p>
                            <p className="text-sm text-muted-foreground">
                              Q1 ({cfg.compulsoryMarks}m) + choose {cfg.optionalChoose} of {cfg.optionalCount} · {cfg.marks} marks
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="flex items-center gap-1 text-sm font-medium text-muted-foreground">
                            <Clock className="h-4 w-4" />
                            {cfg.time} min
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Step 2: Unit Selection */}
          {step === 'unit' && (
            <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-stone-500/10 text-stone-600 dark:bg-stone-400/10 dark:text-stone-400">
                  CLE Standard
                </span>
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-muted/60">
                  {config?.label}
                </span>
                <span>Select ATP unit</span>
              </div>
              <div className="grid grid-cols-2 gap-2 max-h-80 overflow-y-auto pr-2">
                {ATP_UNITS.map((unit) => {
                  const Icon = ICON_MAP[unit.icon] || BookOpen;
                  return (
                    <button
                      key={unit.id}
                      onClick={() => handleUnitSelect(unit)}
                      className="p-3 rounded-xl bg-gradient-to-r from-muted/30 to-transparent hover:from-primary/8 text-left transition-all duration-200"
                    >
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4 text-primary shrink-0" />
                        <div className="min-w-0">
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{(unit as any).code}</p>
                          <p className="text-sm font-medium truncate">{unit.name}</p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Step 3: Confirmation */}
          {step === 'confirm' && selectedUnit && config && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="text-center py-4">
                <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/15 to-primary/5 flex items-center justify-center mb-4">
                  <CheckCircle className="h-8 w-8 text-primary" />
                </div>
                <h4 className="font-semibold text-lg">Ready to Start?</h4>
                <p className="text-sm text-muted-foreground mt-1">Review your exam settings below</p>
              </div>
              <div className="rounded-2xl bg-gradient-to-br from-muted/40 to-transparent p-5 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Exam Type</span>
                  <span className="font-medium px-2 py-0.5 rounded-full text-xs bg-stone-500/10 text-stone-600 dark:bg-stone-400/10 dark:text-stone-400">CLE Standard</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Paper Size</span>
                  <span className="font-medium">{config.label}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Unit</span>
                  <span className="font-medium">{selectedUnit.name}</span>
                </div>
                <div className="border-t border-border/20 pt-3 mt-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Structure</span>
                    <span className="font-medium">Q1 compulsory + choose {config.optionalChoose}/{config.optionalCount}</span>
                  </div>
                  <div className="flex justify-between text-sm mt-1">
                    <span className="text-muted-foreground">Total Marks</span>
                    <span className="font-medium">{config.marks}</span>
                  </div>
                  <div className="flex justify-between text-sm mt-1">
                    <span className="text-muted-foreground">Time Limit</span>
                    <span className="font-medium flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      {config.time} minutes
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={goBack} className="flex-1 py-2.5 rounded-xl border border-border/30 hover:bg-muted/40 transition-colors font-medium text-sm">
                  Back
                </button>
                <button onClick={handleStartExam} className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-colors font-medium text-sm flex items-center justify-center gap-2">
                  Start Exam
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </AnimatedModal>

      {/* ── PAPER ACTION MODAL — Browse vs Take as Exam ── */}
      <AnimatedModal isOpen={paperActionModal !== null} onClose={() => setPaperActionModal(null)} size="sm">
        {paperActionModal && (() => {
          const pUnit = ATP_UNITS.find(u => u.id === paperActionModal.unitId);
          const PAIcon = pUnit ? (ICON_MAP[pUnit.icon] || BookOpen) : BookOpen;
          return (
            <div className="p-6 space-y-5">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-primary/8 shrink-0">
                  <PAIcon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">{pUnit?.code || paperActionModal.unitId}</p>
                  <p className="font-semibold">{paperActionModal.unitName}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {paperActionModal.year} · {paperActionModal.questionCount} questions{paperActionModal.totalMarks ? ` · ${paperActionModal.totalMarks} marks` : ''}
                  </p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">How would you like to approach this paper?</p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => { openPaper(paperActionModal); setExamModeActive(false); setPaperActionModal(null); }}
                  className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-muted/30 hover:bg-muted/50 transition-colors text-center"
                >
                  <Eye className="h-5 w-5 text-muted-foreground" />
                  <span className="text-sm font-medium">Browse Paper</span>
                  <span className="text-[10px] text-muted-foreground">Read questions &amp; model answers</span>
                </button>
                <button
                  onClick={() => { openPaper(paperActionModal); setExamModeActive(true); setPaperActionModal(null); }}
                  className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-primary/8 hover:bg-primary/14 transition-colors text-center border border-primary/15"
                >
                  <Timer className="h-5 w-5 text-primary" />
                  <span className="text-sm font-medium text-primary">Take as Exam</span>
                  <span className="text-[10px] text-muted-foreground">Answer questions, get feedback</span>
                </button>
              </div>
            </div>
          );
        })()}
      </AnimatedModal>

      {/* ── IMMERSIVE QUESTION ATTEMPT OVERLAY ── */}
      {attemptQuestion && (
        <div className="fixed inset-0 z-[60] bg-background flex flex-col">
          {/* Top bar */}
          <div className="border-b border-border/20 bg-card/40 px-4 py-2.5 shrink-0">
            <div className="max-w-7xl mx-auto flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button onClick={() => setAttemptQuestion(null)} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
                  <ArrowLeft className="h-4 w-4" />
                </button>
                <div>
                  <p className="text-sm font-semibold">Question Attempt — {attemptQuestion.unitName}</p>
                  <p className="text-xs text-muted-foreground capitalize">
                    {attemptQuestion.questionType}{attemptQuestion.marks ? ` · ${attemptQuestion.marks} marks` : ''}
                  </p>
                </div>
              </div>
              {attemptPhase === 'drafting' && (
                <button onClick={submitAttempt}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
                  <Send className="h-3.5 w-3.5" /> Submit for Feedback
                </button>
              )}
              {attemptPhase === 'results' && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => { setAttemptPhase('drafting'); setAttemptGrade(null); if (attemptDraftRef.current) attemptDraftRef.current.innerText = ''; }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium bg-muted/40 hover:bg-muted transition-colors">
                    <RotateCcw className="h-3.5 w-3.5" /> Try Again
                  </button>
                  <button onClick={() => setAttemptQuestion(null)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium bg-muted/40 hover:bg-muted transition-colors">
                    <X className="h-3.5 w-3.5" /> Close
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Drafting phase */}
          {attemptPhase === 'drafting' && (
            <div className="flex-1 flex overflow-hidden">
              <div className="w-72 md:w-80 shrink-0 border-r border-border/20 flex flex-col bg-card/10">
                <div className="p-5 flex-1 overflow-y-auto">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Question</h3>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{attemptQuestion.questionText}</p>
                </div>
              </div>
              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="border-b border-border/15 px-4 py-1.5 flex items-center gap-0.5 bg-card/20 shrink-0">
                  <ToolBtnQ icon={Bold} title="Bold" onClick={() => execAttemptCmd('bold')} />
                  <ToolBtnQ icon={Italic} title="Italic" onClick={() => execAttemptCmd('italic')} />
                  <ToolBtnQ icon={UnderlineIcon} title="Underline" onClick={() => execAttemptCmd('underline')} />
                  <div className="w-px h-4 bg-border mx-1" />
                  <ToolBtnQ icon={AlignLeft} title="Align Left" onClick={() => execAttemptCmd('justifyLeft')} />
                  <ToolBtnQ icon={AlignCenter} title="Center" onClick={() => execAttemptCmd('justifyCenter')} />
                  <ToolBtnQ icon={AlignRight} title="Align Right" onClick={() => execAttemptCmd('justifyRight')} />
                  <div className="w-px h-4 bg-border mx-1" />
                  <ToolBtnQ icon={List} title="Bullet List" onClick={() => execAttemptCmd('insertUnorderedList')} />
                  <ToolBtnQ icon={ListOrdered} title="Numbered List" onClick={() => execAttemptCmd('insertOrderedList')} />
                </div>
                <div className="flex-1 overflow-auto p-8">
                  <div
                    ref={attemptDraftRef}
                    contentEditable
                    suppressContentEditableWarning
                    className="min-h-full outline-none text-sm leading-relaxed font-[Georgia,serif] whitespace-pre-wrap empty:before:content-[attr(data-placeholder)] empty:before:text-muted-foreground/40 empty:before:pointer-events-none"
                    data-placeholder="Begin your answer here…"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Grading phase */}
          {attemptPhase === 'grading' && (
            <div className="flex-1 flex items-center justify-center">
              <EngagingLoader size="lg" message="Analyzing your answer and marking…" />
            </div>
          )}

          {/* Results phase */}
          {attemptPhase === 'results' && (
            <div className="flex-1 flex overflow-hidden">
              <div className="flex-1 p-6 overflow-y-auto space-y-4">
                {attemptGrade ? (
                  <>
                    <div className="flex items-center gap-4">
                      <div className={`text-4xl font-bold ${attemptGrade.overallScore >= 70 ? 'text-green-600' : attemptGrade.overallScore >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
                        {attemptGrade.grade}
                      </div>
                      <div>
                        <p className="text-xl font-bold">{attemptGrade.overallScore}%</p>
                        <p className="text-xs text-muted-foreground">{attemptGrade.summary.slice(0, 120)}</p>
                      </div>
                    </div>
                    <div className="rounded-xl border border-border/20 p-5 bg-card/20 text-sm leading-relaxed whitespace-pre-wrap font-mono max-h-[55vh] overflow-y-auto">
                      <AnnotatedDraftQ
                        text={attemptDraftText}
                        annotations={attemptGrade.annotations}
                        activeIdx={attemptActiveAnn}
                        onSelect={setAttemptActiveAnn}
                      />
                    </div>
                  </>
                ) : (
                  <div className="text-center py-10">
                    <p className="text-muted-foreground">Grading failed — please try again.</p>
                  </div>
                )}
              </div>
              {attemptGrade && (
                <div className="w-72 shrink-0 border-l border-border/20 bg-card/10 p-5 space-y-4 overflow-y-auto">
                  <div className="space-y-2">
                    {Object.entries(attemptGrade.categories).map(([k, v]) => (
                      <div key={k}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="capitalize">{k === 'legalAccuracy' ? 'Legal Accuracy' : k}</span>
                          <span className="font-medium">{v}%</span>
                        </div>
                        <div className="w-full bg-muted rounded-full h-1.5">
                          <div className={`h-1.5 rounded-full ${v >= 70 ? 'bg-green-500' : v >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                            style={{ width: v + '%' }} />
                        </div>
                      </div>
                    ))}
                  </div>
                  {attemptActiveAnn !== null && attemptGrade.annotations[attemptActiveAnn] && (
                    <div className="rounded-lg bg-muted/40 p-3">
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className={`w-2 h-2 rounded-full ${
                          attemptGrade.annotations[attemptActiveAnn].severity === 'good' ? 'bg-green-500'
                          : attemptGrade.annotations[attemptActiveAnn].severity === 'error' ? 'bg-red-500' : 'bg-amber-500'
                        }`} />
                        <span className="text-xs font-medium capitalize">{attemptGrade.annotations[attemptActiveAnn].category}</span>
                      </div>
                      <p className="text-xs text-foreground/80">{attemptGrade.annotations[attemptActiveAnn].comment}</p>
                    </div>
                  )}
                  {attemptGrade.strengths.length > 0 && (
                    <div>
                      <h5 className="text-xs font-semibold text-green-600 uppercase tracking-wider mb-1.5">Strengths</h5>
                      <ul className="space-y-1">
                        {attemptGrade.strengths.map((s, i) => (
                          <li key={i} className="text-xs flex items-start gap-1.5">
                            <CheckCircle2 className="h-3 w-3 text-green-500 mt-0.5 shrink-0" /> {s}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {attemptGrade.improvements.length > 0 && (
                    <div>
                      <h5 className="text-xs font-semibold text-amber-600 uppercase tracking-wider mb-1.5">Improvements</h5>
                      <ul className="space-y-1">
                        {attemptGrade.improvements.map((s, i) => (
                          <li key={i} className="text-xs flex items-start gap-1.5">
                            <AlertTriangle className="h-3 w-3 text-amber-500 mt-0.5 shrink-0" /> {s}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

    </div>
    </PremiumGate>
  );
}
