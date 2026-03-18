'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { useAuth } from '@/contexts/AuthContext';
import { useTimeTracker } from '@/lib/hooks/useTimeTracker';
import { useSidebar } from '@/contexts/SidebarContext';
import { getUnitById } from '@/lib/constants/legal-content';
import { usePreloading } from '@/lib/services/preloading';
import { MarkdownRenderer } from '@/components/MarkdownRenderer';
import AiThinkingIndicator from '@/components/AiThinkingIndicator';
import {
  ArrowLeft, ArrowRight, Clock, CheckCircle2, XCircle, Loader2, BarChart3,
  RotateCcw, BookOpen, Lightbulb, ChevronDown, ChevronUp, Trophy, Target,
  Brain, TrendingUp, AlertTriangle, Sparkles, GraduationCap, FileText, Zap,
  PanelLeftClose, PanelLeftOpen, Lock, Bold, Italic, Underline as UnderlineIcon,
  AlignLeft, AlignCenter, AlignRight, Indent, Outdent, List, ListOrdered,
} from 'lucide-react';
import TrialLimitReached from '@/components/TrialLimitReached';
import PremiumGate, { usePremiumGate } from '@/components/PremiumGate';
import FeatureLockedScreen from '@/components/FeatureLockedScreen';

// ============================================================
// TYPES
// ============================================================

type ExamType = 'cle';
type PaperSize = 'mini' | 'semi' | 'full';

interface Question {
  id: string;
  question: string;
  options?: string[];
  marks: number;
  topic?: string;
  isCompulsory?: boolean;
}

interface RubricScore {
  score: number;
  maxScore: number;
  feedback: string;
}

interface QuestionFeedback {
  questionId: string;
  correct: boolean;
  score: number;
  maxScore: number;
  explanation: string;
  correctAnswer?: string;
  rubricBreakdown?: {
    legalKnowledge: RubricScore;
    analysis: RubricScore;
    structure: RubricScore;
    writing: RubricScore;
  };
}

interface ExamResult {
  score: number;
  totalMarks: number;
  percentage: number;
  feedback: QuestionFeedback[];
  challengingConcepts: {
    topic: string;
    description: string;
    studyResources?: string[];
  }[];
  overallFeedback: string;
  grade: string;
}

// ============================================================
// CONFIGURATION
// ============================================================

const PAPER_CONFIG: Record<PaperSize, {
  marks: number; totalGenerated: number; compulsoryMarks: number;
  optionalMarks: number; optionalCount: number; optionalChoose: number; time: number;
}> = {
  mini: { marks: 15, totalGenerated: 4, compulsoryMarks: 5, optionalMarks: 5, optionalCount: 3, optionalChoose: 2, time: 30 },
  semi: { marks: 30, totalGenerated: 5, compulsoryMarks: 10, optionalMarks: 10, optionalCount: 4, optionalChoose: 2, time: 60 },
  full: { marks: 60, totalGenerated: 6, compulsoryMarks: 20, optionalMarks: 10, optionalCount: 5, optionalChoose: 4, time: 180 },
};

const getGrade = (percentage: number): string => {
  if (percentage >= 80) return 'A';
  if (percentage >= 70) return 'B';
  if (percentage >= 60) return 'C';
  if (percentage >= 50) return 'D';
  return 'F';
};

// ============================================================
// MAIN COMPONENT
// ============================================================

export default function ExamSessionPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { getIdToken } = useAuth();
  useTimeTracker('exams');
  const { setCollapsed } = useSidebar();
  const { setAuthToken, getPreloadedExam, onExamStart, onExamComplete } = usePreloading();

  const unitId = params.unitId as string;
  const examType: ExamType = 'cle';
  const paperSize = (searchParams.get('paper') || 'semi') as PaperSize;
  
  const unit = getUnitById(unitId);
  const config = PAPER_CONFIG[paperSize] || PAPER_CONFIG.semi;
  const configMarks = config.marks;
  const configTime = config.time;

  const [phase, setPhase] = useState<'loading' | 'exam' | 'submitting' | 'results'>('loading');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(config.time * 60);
  const [selectedOptionals, setSelectedOptionals] = useState<Set<string>>(new Set());
  const [result, setResult] = useState<ExamResult | null>(null);
  const [error, setError] = useState('');
  const [expandedFeedback, setExpandedFeedback] = useState<string | null>(null);
  const [usedPreload, setUsedPreload] = useState(false);
  const [sidebarHidden, setSidebarHidden] = useState(false);
  const [showFeatureGate, setShowFeatureGate] = useState<{tier?: string; used?: number; limit?: number; addonRemaining?: number} | null>(null);
  const [slideDirection, setSlideDirection] = useState<'right' | 'left'>('right');
  const [draftSaved, setDraftSaved] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const autoSubmitRef = useRef(false);
  const loadedRef = useRef(false);
  const editorRef = useRef<HTMLDivElement | null>(null);

  const execCmd = (cmd: string, val?: string) => {
    document.execCommand(cmd, false, val);
    editorRef.current?.focus();
  };

  // Collapse sidebar on mount for focused exam view, restore on unmount
  useEffect(() => {
    setCollapsed(true);
    return () => setCollapsed(false);
  }, [setCollapsed]);

  // Auto-save answers to localStorage every time they change
  const draftKey = `exam-draft-${unitId}-${paperSize}`;
  useEffect(() => {
    if (phase !== 'exam' || Object.keys(answers).length === 0) return;
    try {
      localStorage.setItem(draftKey, JSON.stringify({ answers, currentIndex, timeLeft, savedAt: Date.now() }));
      setDraftSaved(true);
      const t = setTimeout(() => setDraftSaved(false), 1500);
      return () => clearTimeout(t);
    } catch {}
  }, [answers, currentIndex, phase]);

  // Restore saved draft on load
  useEffect(() => {
    if (phase !== 'exam' || Object.keys(answers).length > 0) return;
    try {
      const saved = localStorage.getItem(draftKey);
      if (saved) {
        const data = JSON.parse(saved);
        // Only restore if saved within last 4 hours
        if (data.savedAt && Date.now() - data.savedAt < 4 * 3600000) {
          if (data.answers && Object.keys(data.answers).length > 0) {
            setAnswers(data.answers);
            if (typeof data.currentIndex === 'number') setCurrentIndex(data.currentIndex);
            if (typeof data.timeLeft === 'number' && data.timeLeft > 0) setTimeLeft(data.timeLeft);
          }
        } else {
          localStorage.removeItem(draftKey);
        }
      }
    } catch {}
  }, [phase]);

  // Generate exam questions - Try preloaded first, then generate
  useEffect(() => {
    if (loadedRef.current) return; // Prevent multiple loads
    
    async function loadExam() {
      if (!unit) return;
      loadedRef.current = true;
      try {
        const token = await getIdToken();
        if (!token) throw new Error('Not authenticated');
        
        setAuthToken(token);

        // ── CLE exam feature gate ──
        const statusRes = await fetch('/api/payments/status', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (statusRes.ok) {
          const statusData = await statusRes.json();
          const canUse = statusData.canAccess?.cle_exam;
          if (canUse === false) {
            const fu = statusData.featureUsage?.cle_exam;
            setShowFeatureGate({ tier: statusData.tier, used: fu?.used, limit: fu?.limit, addonRemaining: fu?.addonRemaining });
            setPhase('loading');
            return;
          }
          // Increment CLE exam usage via dedicated endpoint
          const recordRes = await fetch('/api/exams/record-usage', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          });
          if (recordRes.status === 403) {
            const errData = await recordRes.json().catch(() => ({}));
            setShowFeatureGate({ tier: errData.tier, used: errData.used, limit: errData.limit, addonRemaining: errData.addonRemaining });
            setPhase('loading');
            return;
          }
        }
        
        // 1. First, try to get preloaded questions (instant load!)
        const preloaded = await getPreloadedExam(unitId, examType, paperSize);
        
        if (preloaded.found && preloaded.content) {
          console.log('Using preloaded exam questions!');
          setUsedPreload(true);
          const normalized = (preloaded.content as Question[]).slice(0, config.totalGenerated).map((q, i) => ({
            ...q,
            isCompulsory: i === 0,
            marks: i === 0 ? config.compulsoryMarks : config.optionalMarks,
          }));
          setQuestions(normalized);
          setPhase('exam');
          
          // Notify service that exam started (triggers next exam preload)
          onExamStart(unitId, examType, paperSize);
          return;
        }
        
        // 2. No preload available - generate using AI
        console.log('No preload available, generating...');
        const prompt = `Generate ${config.totalGenerated} questions for a CLE standard ${paperSize} paper exam on ${unit.name} (Kenyan Law).

STRUCTURE:
- QUESTION 1 (COMPULSORY, ${config.compulsoryMarks} marks): A scenario-based question. Present a complex, realistic legal scenario, then pose sub-parts labeled (a), (b), (c) etc. Each sub-part has its own mark allocation that sums to exactly ${config.compulsoryMarks} marks. Sub-parts should test: identification of issues, application of law, advising parties, or drafting.
- QUESTIONS 2-${config.totalGenerated} (OPTIONAL, ${config.optionalMarks} marks each): ${config.optionalCount} standalone essay questions testing DIFFERENT topic areas within ${unit.name}. Students choose ${config.optionalChoose} to answer.

Format as JSON array:
[
  {
    "id": "q1",
    "question": "Read the scenario below and answer ALL parts.\\n\\n[Detailed legal scenario with parties, facts, and context]\\n\\n(a) [Sub-question] (X marks)\\n(b) [Sub-question] (Y marks)\\n(c) [Sub-question] (Z marks)...",
    "marks": ${config.compulsoryMarks},
    "topic": "Sub-topic name",
    "isCompulsory": true
  },
  {
    "id": "q2",
    "question": "Essay question requiring IRAC analysis...",
    "marks": ${config.optionalMarks},
    "topic": "Different sub-topic",
    "isCompulsory": false
  }
]

Rules:
- Q1 MUST be a rich scenario with sub-parts totaling EXACTLY ${config.compulsoryMarks} marks
- Q2-Q${config.totalGenerated} are independent essays, each worth ${config.optionalMarks} marks
- Each question should test a DIFFERENT topic within ${unit.name}
- Questions should require IRAC analysis
- Include hypothetical scenarios where applicable
- Reference Kenyan statutes: ${unit.statutes.join(', ')}
- Total marks: ${config.marks} (${config.compulsoryMarks} + ${config.optionalChoose}×${config.optionalMarks})
- Output ONLY valid JSON array`;

        const res = await fetch('/api/ai/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            message: prompt,
            competencyType: 'research',
            context: {
              topicArea: unit.name,
              examGeneration: true,
              examType,
              paperSize,
            },
          }),
        });

        if (!res.ok) throw new Error('Failed to prepare exam');

        const data = await res.json();
        let parsed: Question[];
        
        try {
          let content = data.response || '';
          // Strip markdown code fences
          content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
          // Try to find JSON array in the response
          const arrStart = content.indexOf('[');
          const arrEnd = content.lastIndexOf(']');
          if (arrStart !== -1 && arrEnd !== -1) {
            content = content.slice(arrStart, arrEnd + 1);
          }
          parsed = JSON.parse(content);
          // Validate: ensure we got the right number and each has required fields
          if (!Array.isArray(parsed) || parsed.length === 0) throw new Error('Invalid format');
          parsed = parsed.slice(0, config.totalGenerated).map((q, i) => ({
            id: q.id || `q${i + 1}`,
            question: q.question || `Question ${i + 1}`,
            marks: i === 0 ? config.compulsoryMarks : config.optionalMarks,
            topic: q.topic || unit.name,
            isCompulsory: i === 0,
          }));
        } catch {
          // Fallback questions
          parsed = Array.from({ length: config.totalGenerated }, (_, i) => ({
            id: `q${i + 1}`,
            question: i === 0
              ? `Compulsory question for ${unit.name}. (Question generation failed - please try again)`
              : `Optional question ${i} for ${unit.name}. (Question generation failed - please try again)`,
            marks: i === 0 ? config.compulsoryMarks : config.optionalMarks,
            topic: unit.name,
            isCompulsory: i === 0,
          }));
        }

        setQuestions(parsed);
        setPhase('exam');
        
        // Notify service that exam started (triggers next exam preload)
        onExamStart(unitId, examType, paperSize);
      } catch (err) {
        setError('Couldn\'t prepare your exam. Please try again.');
      }
    }

    loadExam();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unitId, examType, paperSize]);

  // Countdown timer with auto-submit
  useEffect(() => {
    if (phase !== 'exam') return;
    if (timeLeft <= 0 && !autoSubmitRef.current) {
      autoSubmitRef.current = true;
      handleSubmit();
      return;
    }
    const interval = setInterval(() => setTimeLeft((t) => t - 1), 1000);
    return () => clearInterval(interval);
  }, [phase, timeLeft]);

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) {
      return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const currentQ = questions[currentIndex];
  const activeQuestions = questions.filter((q, i) => i === 0 || selectedOptionals.has(q.id));
  const answeredCount = activeQuestions.filter(q => answers[q.id]?.trim()).length;
  const totalToAnswer = 1 + config.optionalChoose;
  const isCurrentActive = currentIndex === 0 || selectedOptionals.has(currentQ?.id);

  useEffect(() => {
    if (!currentQ?.id || !editorRef.current) return;
    const val = answers[currentQ.id] || '';
    if (editorRef.current.innerText !== val) {
      editorRef.current.innerText = val;
    }
  }, [currentQ?.id, answers]);

  const navigateTo = (idx: number) => {
    if (idx === currentIndex) return;
    setSlideDirection(idx > currentIndex ? 'right' : 'left');
    setCurrentIndex(idx);
  };

  const toggleOptional = (qId: string) => {
    setSelectedOptionals(prev => {
      const next = new Set(prev);
      if (next.has(qId)) {
        next.delete(qId);
      } else if (next.size < config.optionalChoose) {
        next.add(qId);
      }
      return next;
    });
  };

  const handleSubmit = useCallback(async () => {
    setPhase('submitting');
    try {
      const token = await getIdToken();

      const activeQs = questions.filter((q, i) => i === 0 || selectedOptionals.has(q.id));
      const gradingPrompt = `Grade this CLE standard essay exam on ${unit?.name} using detailed rubric grading.

This is a ${paperSize} paper: Q1 is compulsory (${config.compulsoryMarks} marks), plus ${config.optionalChoose} chosen optional questions (${config.optionalMarks} marks each). Total: ${config.marks} marks.

Questions and answers:
${activeQs.map((q, i) => `
Q${i + 1}${q.isCompulsory ? ' [COMPULSORY]' : ' [OPTIONAL]'} (${q.marks} marks): ${q.question}
Student answer: ${answers[q.id] || '(not answered)'}
`).join('\n')}

Grade each essay using this rubric (each out of 25% of question marks):
1. Legal Knowledge & Accuracy: Understanding of Kenyan law, correct citations
2. Analysis & Application: IRAC method, application to facts
3. Structure & Organization: Logical flow, clear arguments
4. Legal Writing: Professional language, clarity

Respond with ONLY valid JSON:
{
  "score": <total marks earned>,
  "totalMarks": ${config.marks},
  "percentage": <percentage>,
  "overallFeedback": "Comprehensive feedback on overall performance",
  "feedback": [
    {
      "questionId": "q1",
      "correct": <true if score >= 50% of marks>,
      "score": <marks earned>,
      "maxScore": <question marks>,
      "explanation": "Detailed feedback",
      "rubricBreakdown": {
        "legalKnowledge": { "score": <earned>, "maxScore": <25% of q marks>, "feedback": "..." },
        "analysis": { "score": <earned>, "maxScore": <25% of q marks>, "feedback": "..." },
        "structure": { "score": <earned>, "maxScore": <25% of q marks>, "feedback": "..." },
        "writing": { "score": <earned>, "maxScore": <25% of q marks>, "feedback": "..." }
      }
    }
  ],
  "challengingConcepts": [
    {
      "topic": "Concept student needs to study",
      "description": "What they should focus on",
      "studyResources": ["Relevant statute", "Key case"]
    }
  ]
}`;

      const res = await fetch('/api/exams/grade', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          gradingPrompt,
        }),
      });

      if (!res.ok) throw new Error('Grading failed');

      const data = await res.json();
      let examPercentage = 0;
      try {
        let content = data.response || '';
        content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        // Find JSON object in response
        const objStart = content.indexOf('{');
        const objEnd = content.lastIndexOf('}');
        if (objStart !== -1 && objEnd !== -1) {
          content = content.slice(objStart, objEnd + 1);
        }
        const graded = JSON.parse(content);
        graded.grade = getGrade(graded.percentage || 0);
        examPercentage = graded.percentage || 0;
        setResult(graded);
      } catch {
        setResult({
          score: 0,
          totalMarks: configMarks,
          percentage: 0,
          grade: 'F',
          overallFeedback: 'Automatic grading failed. Please review your answers manually.',
          feedback: questions.map((q) => ({
            questionId: q.id,
            correct: false,
            score: 0,
            maxScore: q.marks,
            explanation: 'Could not grade automatically.',
          })),
          challengingConcepts: [],
        });
      }
      setPhase('results');
      
      // Clear saved draft on successful submission
      try { localStorage.removeItem(draftKey); } catch {}
      
      // Notify preloading service about exam completion
      // This triggers preloading of next exam with updated user progress
      onExamComplete(unitId, examType, paperSize, result || undefined);

      // Record exam result to progress tracking
      try {
        const token2 = await getIdToken();
        await fetch('/api/exams/record', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token2}` },
          body: JSON.stringify({
            unitId,
            examType,
            paperSize,
            score: examPercentage,
            totalMarks: configMarks,
            questionsAnswered: answeredCount,
            totalQuestions: totalToAnswer,
          }),
        }).catch(() => {}); // silent fail — don't block UI
      } catch {} // Ignore recording errors
    } catch {
      setError('Failed to grade exam. Please try again.');
      setPhase('exam');
    }
  }, [answers, questions, unit, configMarks, examType, unitId, paperSize, getIdToken, onExamComplete, selectedOptionals, config]);

  // ============================================================
  // PREMIUM GATE CHECK
  // ============================================================
  const examGate = usePremiumGate('cle_exam');
  if (!examGate.isLoading && examGate.isLocked) {
    return (
      <FeatureLockedScreen
        feature="cle_exam"
        tier={examGate.tier}
        used={examGate.used}
        limit={examGate.limit}
        addonRemaining={examGate.addonRemaining}
      />
    );
  }

  // ============================================================
  // RENDER: Not found
  // ============================================================
  if (!unit) {
    return (
      <div className="p-6 md:p-10 max-w-4xl mx-auto">
        <button onClick={() => router.push('/exams')} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <p className="text-center py-20 text-muted-foreground">Unit not found.</p>
      </div>
    );
  }

  // ============================================================
  // RENDER: Loading
  // ============================================================
  if (phase === 'loading') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        {showFeatureGate ? (
          <TrialLimitReached
            feature="cle_exam"
            currentTier={showFeatureGate.tier as any}
            used={showFeatureGate.used}
            limit={showFeatureGate.limit}
            addonRemaining={showFeatureGate.addonRemaining}
            onDismiss={() => {
              setShowFeatureGate(null);
              router.push('/exams');
            }}
          />
        ) : (
          <>
            <div className="relative w-16 h-16 mx-auto">
              <div className="absolute inset-0 rounded-2xl bg-primary/10 animate-ping opacity-30" />
              <div className="relative h-16 w-16 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                <Image src="/favicon-32x32.png" alt="Ynai" width={32} height={32} className="animate-pulse" />
              </div>
            </div>
            <div className="text-center">
              <p className="font-medium text-lg">Preparing your exam…</p>
              <p className="text-sm text-muted-foreground mt-1">
                {unit.name} · CLE · Q1 compulsory + choose {config.optionalChoose}/{config.optionalCount}
              </p>
            </div>
            <div className="w-48 h-1.5 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full animate-[loading_2s_ease-in-out_infinite]" style={{ width: '60%' }} />
            </div>
          </>
        )}
        {error && (
          <div className="text-center">
            <p className="text-sm text-destructive">{error}</p>
            <button onClick={() => router.push('/exams')} className="mt-2 px-4 py-1.5 rounded-lg text-sm border border-border/30 hover:bg-muted/40 transition-colors">
              Go Back
            </button>
          </div>
        )}
      </div>
    );
  }

  // ============================================================
  // RENDER: Submitting
  // ============================================================
  if (phase === 'submitting') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <AiThinkingIndicator variant="card" messageSet="grading" />
        <p className="text-sm text-muted-foreground">
          {examType === 'cle' && 'Analyzing your answers using detailed rubric…'}
        </p>
      </div>
    );
  }

  // ============================================================
  // RENDER: Results
  // ============================================================
  if (phase === 'results' && result) {
    const gradeColors: Record<string, string> = {
      A: 'from-emerald-500 to-green-600',
      B: 'from-green-500 to-emerald-600',
      C: 'from-amber-500 to-yellow-600',
      D: 'from-orange-500 to-red-500',
      F: 'from-red-600 to-rose-700',
    };

    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 pb-10">
        {/* Hero Section */}
        <div className={`bg-gradient-to-br ${gradeColors[result.grade]} text-white py-12 px-6`}>
          <div className="max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm rounded-full px-4 py-1.5 text-sm mb-6">
              <GraduationCap className="h-4 w-4" />
              <span>{unit.name}</span>
              <span className="opacity-60">·</span>
              <span>CLE {paperSize.charAt(0).toUpperCase() + paperSize.slice(1)}</span>
            </div>
            
            <div className="flex items-center justify-center gap-8">
              <div className="text-center">
                <div className="text-6xl md:text-8xl font-bold">{result.grade}</div>
                <p className="text-white/80 mt-2">Grade</p>
              </div>
              <div className="h-20 w-px bg-white/30" />
              <div className="text-center">
                <div className="text-4xl md:text-5xl font-bold">{result.percentage}%</div>
                <p className="text-white/80 mt-2">{result.score}/{result.totalMarks} marks</p>
              </div>
            </div>

            <p className="mt-6 text-lg text-white/90 max-w-2xl mx-auto">
              {result.percentage >= 70 ? 'Excellent work!' : result.percentage >= 50 ? 'Good effort — keep going!' : 'Keep studying, you\'ll get there!'}
            </p>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-6 -mt-6">
          {/* Stats tiles */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[
              { icon: Trophy, value: result.score, label: 'Marks Earned', color: 'text-amber-500' },
              { icon: Target, value: result.totalMarks, label: 'Total Marks', color: 'text-green-500' },
              { icon: CheckCircle2, value: result.feedback.filter(f => f.correct).length, label: 'Correct', color: 'text-emerald-500' },
              { icon: Brain, value: result.challengingConcepts?.length || 0, label: 'Areas to Study', color: 'text-stone-500' },
            ].map((s) => {
              const Icon = s.icon;
              return (
                <div key={s.label} className="rounded-2xl bg-background shadow-lg p-5 text-center">
                  <Icon className={`h-6 w-6 mx-auto ${s.color} mb-2`} />
                  <p className="text-2xl font-bold">{s.value}</p>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                </div>
              );
            })}
          </div>

          {/* Overall Feedback */}
          <div className="mb-8 rounded-2xl bg-background shadow-lg p-6">
            <h3 className="flex items-center gap-2 font-semibold mb-3">
              <Sparkles className="h-5 w-5 text-primary" />
              Feedback
            </h3>
            <p className="text-muted-foreground">{result.overallFeedback}</p>
          </div>

          {/* Challenging Concepts */}
          {result.challengingConcepts && result.challengingConcepts.length > 0 && (
            <div className="mb-8 rounded-2xl bg-gradient-to-br from-amber-500/8 to-transparent p-6">
              <h3 className="flex items-center gap-2 font-semibold text-amber-700 dark:text-amber-400 mb-4">
                <Lightbulb className="h-5 w-5" />
                Concepts to Review
              </h3>
              <div className="grid gap-4">
                {result.challengingConcepts.map((concept, i) => (
                  <div key={i} className="p-4 rounded-xl bg-background/80">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-semibold">{concept.topic}</h4>
                        <p className="text-sm text-muted-foreground mt-1">{concept.description}</p>
                      </div>
                      <button
                        className="flex items-center gap-1 text-xs text-primary hover:underline"
                        onClick={() => router.push(`/study/${unitId}`)}
                      >
                        <BookOpen className="h-3.5 w-3.5" />
                        Study
                      </button>
                    </div>
                    {concept.studyResources && concept.studyResources.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {concept.studyResources.map((resource, j) => (
                          <span key={j} className="text-xs px-2 py-1 rounded-full bg-muted">
                            {resource}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Question Review with Redlining for CLE */}
          <div className="rounded-2xl bg-background shadow-lg overflow-hidden">
            <div className="p-6 border-b border-border/20">
              <h3 className="flex items-center gap-2 font-semibold">
                <BarChart3 className="h-5 w-5" />
                Question Review
              </h3>
            </div>
            <div className="p-6 space-y-4">
              {questions.map((q, i) => {
                const fb = result.feedback.find((f) => f.questionId === q.id);
                const isExpanded = expandedFeedback === q.id;
                const isCLE = examType === 'cle';

                return (
                  <div
                    key={q.id}
                    className={`rounded-xl overflow-hidden transition-all ${
                      fb?.correct
                        ? 'bg-gradient-to-r from-emerald-500/6 to-transparent'
                        : 'bg-gradient-to-r from-red-500/6 to-transparent'
                    }`}
                  >
                    <button
                      onClick={() => setExpandedFeedback(isExpanded ? null : q.id)}
                      className="w-full p-4 flex items-start gap-3 text-left"
                    >
                      <div className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${
                        fb?.correct ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'
                      }`}>
                        {fb?.correct ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium">Q{i + 1}</span>
                          <div className="flex items-center gap-2">
                            <span className={`text-sm font-semibold ${
                              fb?.correct ? 'text-emerald-600' : 'text-red-600'
                            }`}>
                              {fb?.score}/{fb?.maxScore}
                            </span>
                            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{q.question}</p>
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="px-4 pb-4 pt-0 space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
                        {/* Student Answer with RedLining for CLE */}
                        <div className="bg-muted/30 rounded-xl p-4 mt-2">
                          <p className="text-xs font-medium text-muted-foreground mb-2">Your Answer</p>
                          {isCLE ? (
                            <div className="text-sm leading-relaxed whitespace-pre-wrap border-l-2 border-amber-500/40 pl-3">
                              {answers[q.id] || <span className="italic text-muted-foreground">Not answered</span>}
                            </div>
                          ) : (
                            <p className="text-sm">{answers[q.id] || <span className="italic text-muted-foreground">Not answered</span>}</p>
                          )}
                        </div>

                        {/* Correct Answer (MCQ) */}
                        {!isCLE && fb?.correctAnswer && (
                          <div className="bg-emerald-500/8 rounded-xl p-4">
                            <p className="text-xs font-medium text-emerald-600 mb-1">Correct Answer</p>
                            <p className="text-sm font-medium">{fb.correctAnswer}</p>
                          </div>
                        )}

                        {/* Rubric Breakdown (CLE) — Redline scores */}
                        {isCLE && fb?.rubricBreakdown && (
                          <div className="grid grid-cols-2 gap-3">
                            {Object.entries(fb.rubricBreakdown).map(([key, rubric]) => {
                              const percentage = (rubric.score / rubric.maxScore) * 100;
                              return (
                                <div key={key} className="bg-muted/20 rounded-xl p-3">
                                  <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs font-medium capitalize">
                                      {key.replace(/([A-Z])/g, ' $1').trim()}
                                    </span>
                                    <span className={`text-xs font-bold ${
                                      percentage >= 70 ? 'text-emerald-600' :
                                      percentage >= 50 ? 'text-amber-600' : 'text-red-600'
                                    }`}>
                                      {rubric.score}/{rubric.maxScore}
                                    </span>
                                  </div>
                                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                                    <div
                                      className={`h-full rounded-full transition-all ${
                                        percentage >= 70 ? 'bg-emerald-500' :
                                        percentage >= 50 ? 'bg-amber-500' : 'bg-red-500'
                                      }`}
                                      style={{ width: `${percentage}%` }}
                                    />
                                  </div>
                                  <p className="text-xs text-muted-foreground mt-2">{rubric.feedback}</p>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Explanation */}
                        <div className="bg-emerald-500/6 rounded-xl p-4">
                          <p className="text-xs font-medium text-emerald-600 mb-1">Explanation</p>
                          <p className="text-sm text-muted-foreground">{fb?.explanation}</p>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-4 mt-8">
            <button
              onClick={() => router.push('/exams')}
              className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground font-medium flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors"
            >
              <RotateCcw className="h-4 w-4" />
              Take Another Exam
            </button>
            <button
              onClick={() => router.push('/dashboard')}
              className="py-3 px-6 rounded-xl border border-border/30 hover:bg-muted/40 transition-colors font-medium"
            >
              Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================
  // RENDER: Exam in progress
  // ============================================================
  
  // Timer color logic
  const timerUrgent = timeLeft < 300;
  const timerWarn = timeLeft < 600 && !timerUrgent;
  const timerPercent = (timeLeft / (config.time * 60)) * 100;

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] md:h-screen">
      {/* Exit confirmation toast */}
      {showExitConfirm && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-black/30 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-background border border-border shadow-2xl rounded-2xl p-6 max-w-sm mx-4 animate-in slide-in-from-top-4 duration-300">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <h3 className="font-semibold text-sm">Leave this exam?</h3>
                <p className="text-xs text-muted-foreground">Your progress will be lost</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              You&apos;ve answered {answeredCount}/{totalToAnswer} questions. Leaving now means your work won&apos;t be graded.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowExitConfirm(false)}
                className="flex-1 py-2 px-3 rounded-xl border border-border/30 text-sm font-medium hover:bg-muted/40 transition-colors"
              >
                Keep Writing
              </button>
              <button
                onClick={() => router.push('/exams')}
                className="flex-1 py-2 px-3 rounded-xl bg-red-500/10 text-red-600 text-sm font-medium hover:bg-red-500/20 transition-colors"
              >
                Leave Exam
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Submit confirmation toast */}
      {showSubmitConfirm && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-black/30 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-background border border-border shadow-2xl rounded-2xl p-6 max-w-sm mx-4 animate-in slide-in-from-top-4 duration-300">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <h3 className="font-semibold text-sm">Submit incomplete exam?</h3>
                <p className="text-xs text-muted-foreground">{answeredCount}/{totalToAnswer} questions answered</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              You have {totalToAnswer - answeredCount} unanswered question{totalToAnswer - answeredCount !== 1 ? 's' : ''}. Submit anyway?
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowSubmitConfirm(false)}
                className="flex-1 py-2 px-3 rounded-xl border border-border/30 text-sm font-medium hover:bg-muted/40 transition-colors"
              >
                Keep Writing
              </button>
              <button
                onClick={() => { setShowSubmitConfirm(false); handleSubmit(); }}
                className="flex-1 py-2 px-3 rounded-xl bg-emerald-600/90 text-white text-sm font-medium hover:bg-emerald-700/90 transition-colors"
              >
                Submit Now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Top Bar - Aesthetic timer */}
      <div className="px-4 md:px-6 py-3 flex items-center justify-between shrink-0 bg-background border-b border-border/20">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowExitConfirm(true)}
            className="p-2 rounded-lg hover:bg-muted/50 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold">{unit.name}</p>
              <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-stone-500/10 text-stone-600 dark:bg-stone-400/10 dark:text-stone-400">
                CLE
              </span>
            </div>
            <p className="text-[10px] text-muted-foreground">{answeredCount}/{totalToAnswer} answered · {selectedOptionals.size}/{config.optionalChoose} selected</p>
          </div>
        </div>

        {/* Aesthetic timer with ring */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSidebarHidden(s => !s)}
            className="p-2 rounded-lg hover:bg-muted/50 transition-colors text-muted-foreground hidden md:flex"
            title={sidebarHidden ? 'Show sidebar' : 'Hide sidebar for full view'}
          >
            {sidebarHidden ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </button>
          <div className={`relative flex items-center gap-2 px-4 py-2 rounded-2xl transition-all ${
            timerUrgent ? 'bg-red-500/10' : timerWarn ? 'bg-amber-500/10' : 'bg-muted/40'
          }`}>
            {/* Mini progress ring */}
            <div className="relative h-7 w-7">
              <svg className="h-7 w-7 -rotate-90" viewBox="0 0 28 28">
                <circle cx="14" cy="14" r="12" fill="none" strokeWidth="2" className="stroke-muted/30" />
                <circle
                  cx="14" cy="14" r="12" fill="none" strokeWidth="2"
                  strokeDasharray={`${2 * Math.PI * 12}`}
                  strokeDashoffset={`${2 * Math.PI * 12 * (1 - timerPercent / 100)}`}
                  strokeLinecap="round"
                  className={`transition-all duration-1000 ${
                    timerUrgent ? 'stroke-red-500' : timerWarn ? 'stroke-amber-500' : 'stroke-primary'
                  }`}
                />
              </svg>
              <Clock className={`absolute inset-0 m-auto h-3 w-3 ${
                timerUrgent ? 'text-red-500' : timerWarn ? 'text-amber-500' : 'text-muted-foreground'
              }`} />
            </div>
            <span className={`text-sm font-mono font-semibold tabular-nums ${
              timerUrgent ? 'text-red-600 animate-pulse' : timerWarn ? 'text-amber-600' : ''
            }`}>
              {formatTime(timeLeft)}
            </span>
          </div>
        </div>
      </div>

      {/* Main content — CLE Drafting Format: 1/3 question | 2/3 writing */}
        <div className="flex-1 flex overflow-hidden">
          {/* Question sidebar — retractable, shows full current question */}
          <div className={`border-r border-border/20 bg-muted/10 flex flex-col transition-all duration-300 shrink-0 ${
            sidebarHidden ? 'w-0 overflow-hidden' : 'w-1/3 min-w-[280px] max-w-[420px]'
          }`}>
            {/* Current question — full display */}
            <div className="p-5 border-b border-border/20 bg-gradient-to-b from-primary/5 to-transparent">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-primary">
                    Q{currentIndex + 1}
                  </span>
                  {currentIndex === 0 ? (
                    <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-rose-500/10 text-rose-600 font-bold uppercase">Compulsory</span>
                  ) : isCurrentActive ? (
                    <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-bold uppercase">Selected</span>
                  ) : (
                    <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground font-bold uppercase">Optional</span>
                  )}
                </div>
                <span className="text-xs font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                  {currentQ?.marks} marks
                </span>
              </div>
              <div className="prose prose-sm dark:prose-invert max-w-none max-h-[34vh] overflow-y-auto pr-1">
                <p className="text-sm leading-relaxed font-medium text-foreground">
                  {currentQ?.question}
                </p>
              </div>
              {currentQ?.topic && (
                <span className="inline-block mt-3 text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                  {currentQ.topic}
                </span>
              )}
            </div>

            {/* Question navigator */}
            <div className="p-3 border-b border-border/20">
              <p className="text-[10px] font-medium text-muted-foreground px-1">All Questions</p>
              <p className="text-[10px] text-primary/80 px-1 mt-1">
                Q1 compulsory · Choose {config.optionalChoose} of {config.optionalCount} optional ({selectedOptionals.size}/{config.optionalChoose} selected)
              </p>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
              {questions.map((q, i) => {
                const isComp = i === 0;
                const isSelected = isComp || selectedOptionals.has(q.id);
                return (
                  <div key={q.id} className="flex items-start gap-1">
                    {!isComp && (
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleOptional(q.id); }}
                        className={`mt-3 w-[18px] h-[18px] rounded border-[1.5px] flex items-center justify-center shrink-0 transition-colors ${
                          isSelected
                            ? 'border-primary bg-primary text-primary-foreground'
                            : selectedOptionals.size >= config.optionalChoose
                              ? 'border-muted-foreground/15 cursor-not-allowed'
                              : 'border-muted-foreground/30 hover:border-primary/60'
                        }`}
                        disabled={!isSelected && selectedOptionals.size >= config.optionalChoose}
                        title={isSelected ? 'Deselect this question' : selectedOptionals.size >= config.optionalChoose ? `Already selected ${config.optionalChoose} questions` : 'Select this question'}
                      >
                        {isSelected && <CheckCircle2 className="h-2.5 w-2.5" />}
                      </button>
                    )}
                    <button
                      onClick={() => navigateTo(i)}
                      className={`flex-1 text-left p-3 rounded-xl transition-all text-sm ${
                        i === currentIndex
                          ? 'bg-primary/8 ring-1 ring-primary/20'
                          : isSelected && answers[q.id]
                            ? 'bg-emerald-500/5 hover:bg-emerald-500/10'
                            : !isSelected
                              ? 'opacity-40 hover:opacity-60'
                              : 'hover:bg-muted/40'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                          i === currentIndex ? 'bg-primary text-primary-foreground' :
                          isSelected && answers[q.id] ? 'bg-emerald-500/10 text-emerald-600' :
                          'bg-muted text-muted-foreground'
                        }`}>
                          {i + 1}
                        </span>
                        <span className="truncate text-xs">{q.question.slice(0, 50)}…</span>
                        {isComp && (
                          <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-rose-500/10 text-rose-600 font-bold shrink-0 uppercase">
                            Required
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1 ml-8">
                        <span className="text-[10px] text-muted-foreground">{q.marks} marks</span>
                        {isSelected && answers[q.id] && (
                          <span className="text-[10px] text-emerald-600">{(answers[q.id] || '').length} chars</span>
                        )}
                      </div>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Main writing/drafting area — takes 2/3 width */}
          <div className="flex-1 flex flex-col min-w-0">
            <div key={currentIndex} className="flex-1 flex flex-col overflow-hidden animate-in fade-in duration-200">
              {/* Compact question reference (visible when sidebar hidden) */}
              {sidebarHidden && (
                <div className="p-4 border-b border-border/20 shrink-0 bg-muted/20">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        Q{currentIndex + 1}
                      </span>
                      {currentIndex === 0 && <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-rose-500/10 text-rose-600 font-bold uppercase">Compulsory</span>}
                    </div>
                    <span className="text-xs font-medium text-primary">{currentQ?.marks} marks</span>
                  </div>
                  <h2 className="text-sm font-semibold leading-relaxed">
                    {currentQ?.question}
                  </h2>
                </div>
              )}

              {/* Premium Writing Area */}
              <div className="flex-1 flex flex-col overflow-hidden">
                {isCurrentActive ? (<>
                {/* Formatting toolbar */}
                <div className="px-6 py-2 border-b border-border/10 flex items-center gap-0.5 bg-muted/5 shrink-0 overflow-x-auto">
                  <button type="button" onClick={() => execCmd('bold')} title="Bold" className="p-1.5 rounded hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors">
                    <Bold className="h-3.5 w-3.5" />
                  </button>
                  <button type="button" onClick={() => execCmd('italic')} title="Italic" className="p-1.5 rounded hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors">
                    <Italic className="h-3.5 w-3.5" />
                  </button>
                  <button type="button" onClick={() => execCmd('underline')} title="Underline" className="p-1.5 rounded hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors">
                    <UnderlineIcon className="h-3.5 w-3.5" />
                  </button>
                  <div className="w-px h-4 bg-border/30 mx-1" />
                  <button type="button" onClick={() => execCmd('justifyLeft')} title="Align Left" className="p-1.5 rounded hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors">
                    <AlignLeft className="h-3.5 w-3.5" />
                  </button>
                  <button type="button" onClick={() => execCmd('justifyCenter')} title="Align Center" className="p-1.5 rounded hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors">
                    <AlignCenter className="h-3.5 w-3.5" />
                  </button>
                  <button type="button" onClick={() => execCmd('justifyRight')} title="Align Right" className="p-1.5 rounded hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors">
                    <AlignRight className="h-3.5 w-3.5" />
                  </button>
                  <div className="w-px h-4 bg-border/30 mx-1" />
                  <button type="button" onClick={() => execCmd('indent')} title="Indent" className="p-1.5 rounded hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors">
                    <Indent className="h-3.5 w-3.5" />
                  </button>
                  <button type="button" onClick={() => execCmd('outdent')} title="Outdent" className="p-1.5 rounded hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors">
                    <Outdent className="h-3.5 w-3.5" />
                  </button>
                  <div className="w-px h-4 bg-border/30 mx-1" />
                  <button type="button" onClick={() => execCmd('insertUnorderedList')} title="Bullet List" className="p-1.5 rounded hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors">
                    <List className="h-3.5 w-3.5" />
                  </button>
                  <button type="button" onClick={() => execCmd('insertOrderedList')} title="Numbered List" className="p-1.5 rounded hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors">
                    <ListOrdered className="h-3.5 w-3.5" />
                  </button>
                  <div className="flex-1" />
                  <span className="text-[10px] tabular-nums text-muted-foreground/60">
                    {((answers[currentQ?.id] || '').match(/\S+/g) || []).length} words
                  </span>
                </div>

                {/* Drafting editor */}
                <div className="flex-1 p-6 overflow-y-auto">
                  <div
                    ref={editorRef}
                    contentEditable
                    suppressContentEditableWarning
                    onInput={() => {
                      const value = editorRef.current?.innerText || '';
                      if (!currentQ?.id) return;
                      setAnswers((prev) => ({ ...prev, [currentQ.id]: value }));
                    }}
                    data-placeholder="Write your answer here using IRAC format where applicable."
                    className="w-full h-full min-h-[300px] bg-transparent text-base leading-relaxed outline-none font-[system-ui] whitespace-pre-wrap break-words empty:before:content-[attr(data-placeholder)] empty:before:text-muted-foreground/40"
                    style={{ tabSize: 4 }}
                  />
                </div>
                </>) : (
                  <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center p-8">
                    <Lock className="h-10 w-10 text-muted-foreground/20" />
                    <div>
                      <p className="font-medium text-muted-foreground">Question not selected</p>
                      <p className="text-sm text-muted-foreground/60 mt-1">
                        Select this question to answer it. You can choose {config.optionalChoose} of {config.optionalCount} optional questions.
                      </p>
                    </div>
                    {selectedOptionals.size < config.optionalChoose && (
                      <button
                        onClick={() => toggleOptional(currentQ.id)}
                        className="px-4 py-2 rounded-xl bg-primary/10 text-primary text-sm font-medium hover:bg-primary/15 transition-colors"
                      >
                        Select This Question
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Bottom bar */}
              <div className="px-6 py-3 border-t border-border/20 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="hidden md:inline">IRAC: Issue, Rule, Application, Conclusion</span>
                  <span className="text-muted-foreground/40 hidden md:inline">|</span>
                  <span>{((answers[currentQ?.id] || '').match(/\S+/g) || []).length} words · {(answers[currentQ?.id] || '').length} chars</span>
                  {draftSaved && (
                    <span className="flex items-center gap-1 text-emerald-600 animate-in fade-in duration-300">
                      <CheckCircle2 className="h-3 w-3" /> Draft saved
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    disabled={currentIndex === 0}
                    onClick={() => navigateTo(currentIndex - 1)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border/30 hover:bg-muted/40 disabled:opacity-30 transition-colors text-xs font-medium"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    Prev
                  </button>
                  {currentIndex < questions.length - 1 ? (
                    <button
                      onClick={() => navigateTo(currentIndex + 1)}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors text-xs font-medium"
                    >
                      Next
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        if (selectedOptionals.size < config.optionalChoose) return;
                        if (answeredCount < totalToAnswer) {
                          setShowSubmitConfirm(true);
                          return;
                        }
                        handleSubmit();
                      }}
                      disabled={selectedOptionals.size < config.optionalChoose}
                      className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        selectedOptionals.size < config.optionalChoose
                          ? 'bg-muted text-muted-foreground cursor-not-allowed'
                          : 'bg-emerald-600/90 text-white hover:bg-emerald-700/90'
                      }`}
                      title={selectedOptionals.size < config.optionalChoose ? `Select ${config.optionalChoose - selectedOptionals.size} more optional question(s)` : undefined}
                    >
                      <FileText className="h-3.5 w-3.5" />
                      {selectedOptionals.size < config.optionalChoose
                        ? `Select ${config.optionalChoose - selectedOptionals.size} more`
                        : 'Submit'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
    </div>
  );
}
