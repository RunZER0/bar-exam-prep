'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useTimeTracker } from '@/lib/hooks/useTimeTracker';
import { ATP_UNITS } from '@/lib/constants/legal-content';
import { usePreloading } from '@/lib/services/preloading';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Lightbulb,
  Zap,
  Trophy,
  Clock,
  CheckCircle2,
  XCircle,
  ArrowRight,
  RotateCcw,
  Loader2,
  Star,
  Target,
  Flame,
  Sparkles,
  GraduationCap,
  Shuffle,
  Timer,
  Brain,
  TrendingUp,
  Infinity,
  X,
  ChevronRight,
  ChevronLeft,
  StopCircle,
  ListOrdered,
  PenLine,
  ArrowUpDown,
  GripVertical,
} from 'lucide-react';

/* ── Question types ── */
interface TriviaQuestion {
  question: string;
  options: string[];
  correct: number; // index
  explanation: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  questionType?: 'mcq' | 'ordering' | 'text-entry';
  // For ordering questions
  correctOrder?: number[];
  // For text-entry questions
  acceptableAnswers?: string[];
}

interface UserPerformance {
  overallMastery: number;
  currentLevel: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  weakAreas: string[];
  strongAreas: string[];
  totalQuizzes: number;
}

type Section = 'menu' | 'playing' | 'results';

const QUIZ_MODES = [
  {
    id: 'adaptive',
    name: 'Adaptive Mode',
    description: 'AI adapts difficulty to your level',
    icon: Brain,
    gradient: 'from-green-500 to-emerald-600',
    bgGlow: 'bg-green-500/10',
    difficulty: 'Personalized',
    adaptive: true,
    isDefault: true,
  },
  {
    id: 'smartdrill',
    name: 'SmartDrill',
    description: 'Ordering, fill-ins & MCQs — deep mastery',
    icon: ListOrdered,
    gradient: 'from-violet-500 to-indigo-600',
    bgGlow: 'bg-violet-500/15',
    difficulty: 'Mixed',
    smartdrill: true,
  },
  {
    id: 'challenge',
    name: 'Challenge Mode',
    description: 'Test your mastery with tough questions',
    icon: Trophy,
    gradient: 'from-gray-500 to-gray-600',
    bgGlow: 'bg-gray-500/20',
    difficulty: 'Medium',
  },
  {
    id: 'blitz',
    name: 'Speed Blitz',
    description: '15 seconds per question. Think fast!',
    icon: Timer,
    gradient: 'from-rose-500 to-pink-600',
    bgGlow: 'bg-rose-500/20',
    timed: true,
    difficulty: 'Hard',
  },
  {
    id: 'exam',
    name: 'Exam Simulation',
    description: 'Comprehensive exam-style questions',
    icon: GraduationCap,
    gradient: 'from-emerald-500 to-teal-600',
    bgGlow: 'bg-emerald-500/10',
    difficulty: 'Hard',
  },
  {
    id: 'random',
    name: 'Lucky Draw',
    description: 'Random mode, random topic — surprise!',
    icon: Shuffle,
    gradient: 'from-gray-400 to-gray-600',
    bgGlow: 'bg-gray-500/20',
    random: true,
    difficulty: 'Mixed',
  },
];

/* ── Question count presets ── */
const SLIDER_MIN = 5;
const SLIDER_MAX = 50;

/* ── Context-aware loading messages per mode ── */
const LOADING_MESSAGES: Record<string, string[]> = {
  adaptive: [
    "Analysing your mastery profile to calibrate difficulty…",
    "Looking at where you shine and where you stumble…",
    "Crafting questions that push your boundaries just right…",
    "Your AI mentor is setting up a personalised challenge…",
    "Reviewing your weak spots so we can strengthen them…",
    "Building a quiz that grows with you — hold tight…",
  ],
  smartdrill: [
    "Mixing ordering, fill-ins & MCQs for deep mastery…",
    "Preparing a SmartDrill session — think McGraw-Hill, but better…",
    "Creating questions that test recall, sequencing & application…",
    "Your SmartDrill is loading — ordering steps, filling blanks…",
    "Assembling a varied question mix for maximum retention…",
  ],
  challenge: [
    "Pulling together a proper challenge — no easy passes here…",
    "Your opponent today? The Kenyan Bar itself. Let's go…",
    "Setting up questions that separate the good from the great…",
    "Challenge mode engaged — only real mastery survives this…",
  ],
  blitz: [
    "15 seconds per question. Warming up your reflexes…",
    "Speed Blitz loading — your brain better be caffeinated ☕…",
    "Tick-tock. Rapid-fire recall questions incoming…",
    "Fast-twitch legal knowledge mode activated…",
  ],
  exam: [
    "Simulating a full exam environment — settle in…",
    "Creating exam-grade questions across all ATP units…",
    "Your mock exam is being assembled by AI examiners…",
    "Think of this as a dress rehearsal for the real thing…",
  ],
  random: [
    "Rolling the dice… let's see what topic fate picks…",
    "Lady Justice is blindfolded — and so is your topic selector…",
    "Surprise! Let's see if you know a bit of everything…",
    "Random draw in progress — could be anything…",
  ],
};

export default function QuizzesPage() {
  const { getIdToken } = useAuth();
  useTimeTracker('quizzes');
  const { setAuthToken, getPreloaded, afterQuizCompletion } = usePreloading();

  const [section, setSection] = useState<Section>('menu');
  const [selectedMode, setSelectedMode] = useState<string>('adaptive');
  const [selectedUnit, setSelectedUnit] = useState<string>('all');
  const [questionCount, setQuestionCount] = useState<number>(10);
  const [isInfinityMode, setIsInfinityMode] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [modalStep, setModalStep] = useState<1 | 2 | 3>(1);
  const [questions, setQuestions] = useState<TriviaQuestion[]>([]);
  const [quizSessionId, setQuizSessionId] = useState<string>('');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [questionTimer, setQuestionTimer] = useState(15);
  const [userPerformance, setUserPerformance] = useState<UserPerformance | null>(null);
  const [responsesTracked, setResponsesTracked] = useState<Array<{ questionIndex: number; isCorrect: boolean }>>([]);
  const [loadingMoreQuestions, setLoadingMoreQuestions] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [totalAnswered, setTotalAnswered] = useState(0); // Running counter for infinity mode
  // SmartDrill state
  const [dragOrder, setDragOrder] = useState<number[]>([]);
  const [textAnswer, setTextAnswer] = useState('');
  const [orderRevealed, setOrderRevealed] = useState(false);
  const [textRevealed, setTextRevealed] = useState(false);
  const dragItemRef = useRef<number | null>(null);

  // Initialize preloading with auth token
  useEffect(() => {
    const initPreload = async () => {
      try {
        const token = await getIdToken();
        if (token) {
          setAuthToken(token);
        }
      } catch (err) {
        console.error('Failed to initialize preloading:', err);
      }
    };
    initPreload();
  }, [getIdToken, setAuthToken]);

  const mode = QUIZ_MODES.find((m) => m.id === selectedMode)!;
  const unitName = selectedUnit === 'all' ? 'All Units' : ATP_UNITS.find((u) => u.id === selectedUnit)?.name || 'All Units';
  const effectiveCount = isInfinityMode ? 10 : questionCount; // For infinity, generate 10 at a time

  // Cycling loading message
  useEffect(() => {
    if (!loading) return;
    const msgs = LOADING_MESSAGES[selectedMode] || LOADING_MESSAGES.adaptive;
    setLoadingMessage(msgs[Math.floor(Math.random() * msgs.length)]);
    const interval = setInterval(() => {
      setLoadingMessage(msgs[Math.floor(Math.random() * msgs.length)]);
    }, 3000);
    return () => clearInterval(interval);
  }, [loading, selectedMode]);

  // Fetch user performance on mount
  useEffect(() => {
    const fetchPerformance = async () => {
      try {
        const token = await getIdToken();
        const res = await fetch('/api/progress', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setUserPerformance({
            overallMastery: data.overallMastery,
            currentLevel: data.currentLevel,
            weakAreas: data.weakAreas?.map((a: { name: string }) => a.name) || [],
            strongAreas: data.strongAreas?.map((a: { name: string }) => a.name) || [],
            totalQuizzes: data.totalQuizzes,
          });
        }
      } catch (err) {
        console.error('Failed to fetch performance:', err);
      }
    };
    fetchPerformance();
  }, [getIdToken]);

  const getAdaptiveDifficulty = (): string => {
    if (!userPerformance) return 'mixed difficulty';
    switch (userPerformance.currentLevel) {
      case 'beginner': return 'mostly easy with some medium difficulty questions';
      case 'intermediate': return 'mostly medium with some challenging questions';
      case 'advanced': return 'mostly hard with some expert-level questions';
      case 'expert': return 'expert-level and tricky edge-case questions';
      default: return 'mixed difficulty';
    }
  };

  const getTopicFocus = (): string => {
    if (!userPerformance || selectedUnit !== 'all') return '';
    if (userPerformance.weakAreas.length > 0) {
      return `Focus about 60% of questions on these weak areas: ${userPerformance.weakAreas.slice(0, 3).join(', ')}. Mix in questions from other topics for variety.`;
    }
    return '';
  };

  const buildPrompt = (count: number) => {
    const unitInfo = selectedUnit !== 'all' ? ATP_UNITS.find((u) => u.id === selectedUnit) : null;
    let difficultyInstruction = '';
    let topicInstruction = '';

    if (mode.adaptive) {
      difficultyInstruction = getAdaptiveDifficulty();
      topicInstruction = getTopicFocus();
    } else if (mode.id === 'blitz') {
      difficultyInstruction = 'quick-recall questions that can be answered in seconds';
    } else if (mode.id === 'exam') {
      difficultyInstruction = 'exam-style questions with realistic complexity';
    }

    // SmartDrill mode — mix question types
    if (mode.id === 'smartdrill') {
      return `Generate ${count} varied questions about Kenyan law${unitInfo ? ` specifically on ${unitInfo.name} covering ${unitInfo.statutes.join(', ')}` : ' across all ATP units'}.

These are for POSTGRADUATE Kenya School of Law bar exam candidates. Make them CHALLENGING - not textbook definitions.

Create a MIX of these question types:
1. **MCQ** (multiple choice) — standard 4-option questions
2. **Ordering** — give 4-5 items the student must arrange in the correct order (e.g., steps in a procedure, hierarchy of courts, chronological order of events)
3. **Text Entry** — short answer fill-in-the-blank questions where the student types a specific legal term, section number, or short phrase

Format as a JSON array with these fields:
[
  {
    "question": "What is...?",
    "questionType": "mcq",
    "options": ["A) ...", "B) ...", "C) ...", "D) ..."],
    "correct": 0,
    "explanation": "Cite specific legal source",
    "difficulty": "easy|medium|hard"
  },
  {
    "question": "Arrange the following steps in the correct order for filing a civil suit:",
    "questionType": "ordering",
    "options": ["File a plaint", "Serve the defendant", "Pay court fees", "Enter appearance"],
    "correctOrder": [2, 0, 3, 1],
    "correct": 0,
    "explanation": "Under Order V of the Civil Procedure Rules...",
    "difficulty": "medium"
  },
  {
    "question": "Under the Constitution of Kenya 2010, the Bill of Rights is found in Chapter ____.",
    "questionType": "text-entry",
    "options": [],
    "acceptableAnswers": ["Four", "4", "Chapter Four", "Chapter 4"],
    "correct": 0,
    "explanation": "The Bill of Rights is in Chapter Four (Articles 19-59) of the Constitution of Kenya 2010.",
    "difficulty": "easy"
  }
]

Rules:
- Aim for roughly 40% MCQ, 30% ordering, 30% text-entry
- Use realistic fact patterns and procedural scenarios - NOT textbook definitions
- EVERY explanation MUST cite a specific legal source
- For ordering: "correctOrder" is the array of original indices in the correct sequence
- For text-entry: "acceptableAnswers" lists all acceptable answer variations (case-insensitive matching will be used)
- Questions must be at CLE bar exam standard - these students have LLB degrees
- Output ONLY the JSON array`;
    }

    return `Generate ${count} trivia/quiz questions about Kenyan law${unitInfo ? ` specifically on ${unitInfo.name} covering ${unitInfo.statutes.join(', ')}` : ' across all ATP units'}.

${difficultyInstruction ? `Difficulty: ${difficultyInstruction}.` : ''}
${topicInstruction}
${unitInfo ? `Focus on: ${unitInfo.name}. Key statutes: ${unitInfo.statutes.join(', ')}.` : 'Cover a MIX of ATP units: Civil Litigation, Criminal Litigation, Conveyancing, Probate, Commercial Transactions, Legal Ethics, Family Law, Legal Writing, Oral Advocacy.'}

Format as a JSON array:
[
  {
    "question": "What is...?",
    "options": ["A) ...", "B) ...", "C) ...", "D) ..."],
    "correct": 0,
    "explanation": "Must cite specific legal source - e.g., Section X of Act, Article Y of Constitution, Case Name [Year] eKLR",
    "difficulty": "easy|medium|hard"
  }
]

Rules:
- These are for POSTGRADUATE Kenya School of Law bar exam candidates - make them CHALLENGING
- Use realistic fact patterns, client scenarios, and procedural problems - NOT textbook definitions
- Test APPLICATION of law: "A client comes to you with..." or "During cross-examination, opposing counsel..."
- Include procedural questions: filing deadlines, court fees, service requirements, limitation periods
- Reference SPECIFIC statute sections, constitutional articles, and case names
- Distractors must be plausible legal answers requiring careful analysis to eliminate
- NEVER ask questions a secondary school student could answer - these students have LLB degrees
- The "correct" field is the 0-based index of the correct option
- EVERY explanation MUST cite a specific legal source (e.g., "Section 107(1) of the Evidence Act, Cap 80", "Article 50(2)(a) of the Constitution of Kenya 2010", "Republic v Mbugua [2019] eKLR")
- No vague references like "according to the law" - be specific
- Output ONLY the JSON array`;
  };

  const fetchQuestions = async (count: number, append = false): Promise<TriviaQuestion[]> => {
    const token = await getIdToken();
    const unitInfo = selectedUnit !== 'all' ? ATP_UNITS.find((u) => u.id === selectedUnit) : null;

    const res = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        message: buildPrompt(count),
        competencyType: 'research',
        context: {
          topicArea: unitInfo?.name || 'General Kenyan Law',
          quizMode: mode.id,
          quizGeneration: true,
          userLevel: userPerformance?.currentLevel || 'unknown',
          weakAreas: userPerformance?.weakAreas || [],
        },
      }),
    });

    if (!res.ok) throw new Error('Failed');
    const data = await res.json();
    const content = data.response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(content) as TriviaQuestion[];
    // Ensure questionType is set
    return parsed.map((q) => ({
      ...q,
      questionType: q.questionType || 'mcq',
    }));
  };

  /* ── Streaming quiz fetch — first question shows instantly ── */
  const fetchQuestionsStreaming = async (count: number, onFirstQuestion: () => void): Promise<number> => {
    const token = await getIdToken();
    const res = await fetch('/api/ai/quiz-stream', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        prompt: buildPrompt(count),
        count,
      }),
    });

    if (!res.ok) throw new Error('Failed');

    const reader = res.body?.getReader();
    const decoder = new TextDecoder();
    let questionCount = 0;

    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const text = decoder.decode(value, { stream: true });
        const lines = text.split('\n');
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.type === 'question' && data.question) {
              setQuestions((prev) => [...prev, data.question]);
              questionCount++;
              if (questionCount === 1) {
                onFirstQuestion();
              }
            }
          } catch { /* skip partial */ }
        }
      }
    }

    return questionCount;
  };

  const startQuiz = useCallback(async () => {
    setLoading(true);
    setSection('playing');
    setShowModal(false);
    setCurrentIndex(0);
    setScore(0);
    setStreak(0);
    setBestStreak(0);
    setSelected(null);
    setRevealed(false);
    setResponsesTracked([]);
    setDragOrder([]);
    setTextAnswer('');
    setOrderRevealed(false);
    setTextRevealed(false);
    setTotalAnswered(0);
    setQuestions([]); // Clear for streaming
    setQuizSessionId(crypto.randomUUID());

    try {
      const unitKey = selectedUnit !== 'all' ? selectedUnit : 'all';
      
      // Try preloaded questions first (instant start)
      const preloaded = await getPreloaded(unitKey, undefined, 'quiz');
      if (preloaded?.found && preloaded.content?.questions?.length > 0) {
        const qs = preloaded.content.questions.slice(0, effectiveCount).map((q: any) => ({
          ...q,
          questionType: q.questionType || 'mcq',
        }));
        setQuestions(qs);
        setLoading(false);
        return;
      }

      // Use streaming API — first question shows instantly, rest arrive in background
      const streamedCount = await fetchQuestionsStreaming(effectiveCount, () => {
        // Called when the very first question arrives
        setLoading(false);
      });

      // If streaming delivered too few questions (< 3), supplement with batch fallback
      if (streamedCount === 0) {
        // No questions at all — try batch
        const qs = await fetchQuestions(effectiveCount);
        setQuestions(qs);
        setLoading(false);
      } else if (streamedCount < 3) {
        // Partial streaming — supplement with batch (don't replace, append)
        try {
          const supplement = await fetchQuestions(Math.max(effectiveCount - streamedCount, 5));
          setQuestions((prev) => [...prev, ...supplement]);
        } catch { /* at least we have some questions */ }
        setLoading(false);
      }
    } catch {
      setQuestions([
        {
          question: 'A client instructs you to file a plaint in the High Court challenging an administrative decision. Under Order 53 of the Civil Procedure Rules, what must be obtained before leave to apply for judicial review is granted?',
          options: ['A) A certificate of urgency signed by the Attorney General', 'B) Leave of the court obtained ex parte, supported by a verifying affidavit', 'C) Written consent of all respondents to the proceedings', 'D) A mandatory pre-action mediation certificate under Section 59B of the CPA'],
          correct: 1,
          explanation: 'Under Order 53 Rule 1 of the Civil Procedure Rules, an application for judicial review requires leave of the court, which is obtained ex parte and must be supported by a statement and verifying affidavit setting out the grounds and relief sought.',
          questionType: 'mcq',
          difficulty: 'hard',
        },
        {
          question: 'During cross-examination, opposing counsel objects to a question on the basis that it is a leading question. Under what circumstances does Section 143 of the Evidence Act (Cap 80) permit leading questions in cross-examination?',
          options: ['A) Only when the witness is declared hostile by the court', 'B) Leading questions are generally permitted in cross-examination as of right', 'C) Only with prior written leave of the court for each question', 'D) Only when the witness is an expert witness giving opinion evidence'],
          correct: 1,
          explanation: 'Section 143 of the Evidence Act (Cap 80) provides that leading questions may be asked in cross-examination as a matter of right, unlike in examination-in-chief where they are restricted under Section 141.',
          questionType: 'mcq',
          difficulty: 'hard',
        },
        {
          question: 'A vendor executes a transfer of land registered under the Registration of Titles Act (RTA) but the purchaser delays registration. Before registration occurs, a third party obtains a charging order over the same property. Who has priority?',
          options: ['A) The purchaser, because equity regards as done that which ought to be done', 'B) The third party with the charging order, because under Section 23 of the RTA the register is conclusive', 'C) The vendor, because title only passes on completion of full payment', 'D) Neither - the matter must be referred to the National Land Commission for adjudication'],
          correct: 1,
          explanation: 'Under Section 23 of the Registration of Titles Act (Cap 281), the certificate of title is conclusive evidence of proprietorship. The registered interest prevails over unregistered equitable interests (Obiero v Opiyo [1972] EA 227).',
          questionType: 'mcq',
          difficulty: 'hard',
        },
        {
          question: 'Your client is charged with robbery with violence under Section 296(2) of the Penal Code. At trial, the prosecution relies solely on identification evidence from a single witness under difficult conditions. What principle from the Court of Appeal must the trial court apply?',
          options: ['A) The Andan v R principle requiring corroboration of confession evidence', 'B) The Abdalla Bin Wendo principle on dying declarations', 'C) The Turnbull guidelines as adopted in Wamunga v Republic requiring the court to warn itself of the dangers of conviction on disputed identification', 'D) The Woolmington v DPP presumption of innocence only'],
          correct: 2,
          explanation: 'In Wamunga v Republic [1989] KLR 424, the Court of Appeal adopted the Turnbull guidelines, holding that where identification is in issue, the court must warn itself of the special need for caution, examine the circumstances of identification (lighting, distance, duration), and consider if there is supporting evidence.',
          questionType: 'mcq',
          difficulty: 'hard',
        },
        {
          question: 'A testator executes a will leaving all property to a charitable trust. The testator\'s spouse, who was not provided for, files a claim under the Law of Succession Act (Cap 160). Under Section 26, what is the court\'s power regarding the disposition?',
          options: ['A) The court has no power to interfere with a validly executed will', 'B) The court may order reasonable provision for the dependant from the net estate, varying the will as necessary', 'C) The court can only award maintenance from the income, not the capital, of the estate', 'D) The spouse must first apply to the Public Trustee for mediation before court intervention'],
          correct: 1,
          explanation: 'Section 26 of the Law of Succession Act (Cap 160) empowers the court to make reasonable provision for a dependant from the net estate where the disposition by will does not make such provision, regardless of the testator\'s wishes.',
          questionType: 'mcq',
          difficulty: 'hard',
        },
      ]);
      setLoading(false);
    }
  }, [getIdToken, mode, selectedUnit, userPerformance, effectiveCount, isInfinityMode]);

  // Infinity mode — load more questions when nearing the end
  const loadMoreQuestions = useCallback(async () => {
    if (loadingMoreQuestions) return;
    setLoadingMoreQuestions(true);
    try {
      const newQs = await fetchQuestions(10);
      setQuestions((prev) => [...prev, ...newQs]);
    } catch {
      // Silent fail
    } finally {
      setLoadingMoreQuestions(false);
    }
  }, [getIdToken, mode, selectedUnit, userPerformance, loadingMoreQuestions]);

  // Speed blitz timer
  useEffect(() => {
    if (section !== 'playing' || !mode?.timed || revealed || loading) return;
    if (questionTimer <= 0) {
      setRevealed(true);
      setStreak(0);
      return;
    }
    const interval = setInterval(() => setQuestionTimer((t) => t - 1), 1000);
    return () => clearInterval(interval);
  }, [section, mode?.timed, revealed, questionTimer, loading]);

  // Initialize drag order when reaching an ordering question
  useEffect(() => {
    const q = questions[currentIndex];
    if (q?.questionType === 'ordering' && dragOrder.length === 0) {
      // Shuffle the items
      const indices = q.options.map((_, i) => i);
      for (let i = indices.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [indices[i], indices[j]] = [indices[j], indices[i]];
      }
      setDragOrder(indices);
    }
  }, [currentIndex, questions]);

  const handleSelect = async (index: number) => {
    if (revealed) return;
    setSelected(index);
    setRevealed(true);

    const q = questions[currentIndex];
    const isCorrect = index === q.correct;
    
    if (isCorrect) {
      setScore((s) => s + 1);
      setStreak((s) => {
        const newStreak = s + 1;
        setBestStreak((b) => Math.max(b, newStreak));
        return newStreak;
      });
    } else {
      setStreak(0);
    }

    setResponsesTracked((prev) => [...prev, { questionIndex: currentIndex, isCorrect }]);
    setTotalAnswered((t) => t + 1);

    try {
      const token = await getIdToken();
      fetch('/api/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          questionText: q.question,
          userAnswer: q.options[index],
          correctAnswer: q.options[q.correct],
          isCorrect,
          difficulty: q.difficulty || 'medium',
          topicArea: unitName,
          quizMode: mode.id,
          sessionId: quizSessionId,
          questionNumber: currentIndex + 1,
          options: q.options,
          explanation: q.explanation,
        }),
      }).catch(() => {});
    } catch {}
  };

  /* ── SmartDrill: ordering submission ── */
  const handleOrderSubmit = async () => {
    if (orderRevealed) return;
    setOrderRevealed(true);
    setRevealed(true);

    const q = questions[currentIndex];
    const correctOrder = q.correctOrder || [];
    const isCorrect = JSON.stringify(dragOrder) === JSON.stringify(correctOrder);

    if (isCorrect) {
      setScore((s) => s + 1);
      setStreak((s) => {
        const newStreak = s + 1;
        setBestStreak((b) => Math.max(b, newStreak));
        return newStreak;
      });
    } else {
      setStreak(0);
    }
    setResponsesTracked((prev) => [...prev, { questionIndex: currentIndex, isCorrect }]);
    setTotalAnswered((t) => t + 1);

    try {
      const token = await getIdToken();
      fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          questionText: q.question,
          userAnswer: dragOrder.map((i) => q.options[i]).join(' → '),
          correctAnswer: correctOrder.map((i) => q.options[i]).join(' → '),
          isCorrect,
          difficulty: q.difficulty || 'medium',
          topicArea: unitName,
          quizMode: mode.id,
          sessionId: quizSessionId,
          questionNumber: currentIndex + 1,
          options: q.options,
          explanation: q.explanation,
        }),
      }).catch(() => {});
    } catch {}
  };

  /* ── SmartDrill: text-entry submission ── */
  const handleTextSubmit = async () => {
    if (textRevealed) return;
    setTextRevealed(true);
    setRevealed(true);

    const q = questions[currentIndex];
    const acceptable = q.acceptableAnswers || [];
    const isCorrect = acceptable.some(
      (a) => a.toLowerCase().trim() === textAnswer.toLowerCase().trim()
    );

    if (isCorrect) {
      setScore((s) => s + 1);
      setStreak((s) => {
        const newStreak = s + 1;
        setBestStreak((b) => Math.max(b, newStreak));
        return newStreak;
      });
    } else {
      setStreak(0);
    }
    setResponsesTracked((prev) => [...prev, { questionIndex: currentIndex, isCorrect }]);
    setTotalAnswered((t) => t + 1);

    try {
      const token = await getIdToken();
      fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          questionText: q.question,
          userAnswer: textAnswer,
          correctAnswer: acceptable[0] || '',
          isCorrect,
          difficulty: q.difficulty || 'medium',
          topicArea: unitName,
          quizMode: mode.id,
          sessionId: quizSessionId,
          questionNumber: currentIndex + 1,
          options: [],
          explanation: q.explanation,
        }),
      }).catch(() => {});
    } catch {}
  };

  /* ── Ordering drag helpers ── */
  const moveOrderItem = (fromIdx: number, toIdx: number) => {
    if (orderRevealed) return;
    setDragOrder((prev) => {
      const copy = [...prev];
      const [moved] = copy.splice(fromIdx, 1);
      copy.splice(toIdx, 0, moved);
      return copy;
    });
  };

  const nextQuestion = () => {
    const isLast = currentIndex >= questions.length - 1;

    if (isInfinityMode) {
      // In infinity mode, always advance — load more if running low
      if (currentIndex >= questions.length - 3) {
        loadMoreQuestions();
      }
      setCurrentIndex((i) => i + 1);
      setSelected(null);
      setRevealed(false);
      setQuestionTimer(15);
      setDragOrder([]);
      setTextAnswer('');
      setOrderRevealed(false);
      setTextRevealed(false);
      return;
    }

    if (isLast) {
      setSection('results');
      afterQuizCompletion(selectedUnit !== 'all' ? selectedUnit : 'all');
    } else {
      setCurrentIndex((i) => i + 1);
      setSelected(null);
      setRevealed(false);
      setQuestionTimer(15);
      setDragOrder([]);
      setTextAnswer('');
      setOrderRevealed(false);
      setTextRevealed(false);
    }
  };

  /* ── Infinity mode — terminate quiz ── */
  const terminateQuiz = () => {
    // Trim questions to what the user actually answered
    setQuestions((prev) => prev.slice(0, currentIndex + (revealed ? 1 : 0)));
    setSection('results');
    afterQuizCompletion(selectedUnit !== 'all' ? selectedUnit : 'all');
  };

  /* ── Open the quiz setup modal ── */
  const openSetupModal = () => {
    setModalStep(1);
    setShowModal(true);
  };

  // ═══════════════════════════════════
  //  RENDER: MENU
  // ═══════════════════════════════════
  if (section === 'menu') {
    return (
      <>
        <div className="p-6 md:p-10 max-w-4xl mx-auto space-y-10">
          {/* Header */}
          <div className="text-center space-y-2">
            <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-primary via-green-500 to-primary bg-clip-text text-transparent">
              Quizzes & Trivia
            </h1>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Challenge yourself with fun, engaging quizzes. Pick a mode, choose a topic, and let&apos;s go!
            </p>
            {userPerformance && (
              <div className="flex items-center justify-center gap-2 mt-3">
                <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${
                  userPerformance.currentLevel === 'beginner'
                    ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                    : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                }`}>
                  <TrendingUp className="h-3 w-3" />
                  {userPerformance.currentLevel.charAt(0).toUpperCase() + userPerformance.currentLevel.slice(1)} Level
                </div>
                <span className="text-xs text-muted-foreground">
                  {userPerformance.overallMastery}% Mastery
                </span>
              </div>
            )}
          </div>

          {/* Big CTA */}
          <div className="flex flex-col items-center gap-6 pt-4">
            <Button
              size="lg"
              onClick={openSetupModal}
              className="gap-3 px-10 py-7 text-lg font-semibold bg-gradient-to-r from-primary to-emerald-600 hover:from-primary/90 hover:to-emerald-600/90 shadow-xl shadow-primary/25 transition-all duration-300 hover:scale-[1.02] rounded-2xl"
            >
              <Lightbulb className="h-6 w-6" />
              Take a Quiz
              <ArrowRight className="h-5 w-5" />
            </Button>
            <p className="text-sm text-muted-foreground">
              Choose your mode, topic & question count in one quick step
            </p>
          </div>

          {/* Mode preview cards (non-interactive, just informational) */}
          <div className="space-y-4 pt-4">
            <h2 className="text-lg font-semibold text-center">Available Modes</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {QUIZ_MODES.map((m) => {
                const Icon = m.icon;
                return (
                  <div key={m.id} className="group relative rounded-2xl p-[1px] bg-border">
                    <div className="rounded-2xl p-4 bg-card h-full">
                      <div className={`inline-flex items-center justify-center h-10 w-10 rounded-xl bg-gradient-to-br ${m.gradient} text-white shadow mb-3`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <h3 className="font-semibold text-sm mb-0.5">{m.name}</h3>
                      <p className="text-xs text-muted-foreground">{m.description}</p>
                      {m.adaptive && (
                        <div className="mt-2 inline-block px-2 py-0.5 rounded-full bg-gradient-to-r from-green-500 to-emerald-500 text-[9px] font-bold text-white">
                          RECOMMENDED
                        </div>
                      )}
                      {m.smartdrill && (
                        <div className="mt-2 inline-block px-2 py-0.5 rounded-full bg-gradient-to-r from-violet-500 to-indigo-500 text-[9px] font-bold text-white">
                          NEW
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ═══ SETUP MODAL ═══ */}
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowModal(false)} />
            
            {/* Modal */}
            <div className="relative w-full max-w-lg bg-card border border-border/50 rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
              {/* Progress indicator */}
              <div className="flex gap-1 px-6 pt-5">
                {[1, 2, 3].map((s) => (
                  <div
                    key={s}
                    className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                      s <= modalStep ? 'bg-gradient-to-r from-primary to-emerald-500' : 'bg-muted'
                    }`}
                  />
                ))}
              </div>

              {/* Header */}
              <div className="flex items-center justify-between px-6 pt-4 pb-2">
                <div>
                  <h2 className="text-lg font-bold">
                    {modalStep === 1 ? 'Choose Your Mode' : modalStep === 2 ? 'Pick a Topic' : 'Question Count'}
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Step {modalStep} of 3
                  </p>
                </div>
                <button
                  onClick={() => setShowModal(false)}
                  className="p-2 hover:bg-muted rounded-xl transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Body */}
              <div className="px-6 py-4 max-h-[60vh] overflow-y-auto">
                {/* Step 1: Mode */}
                {modalStep === 1 && (
                  <div className="grid grid-cols-1 gap-3">
                    {QUIZ_MODES.map((m) => {
                      const Icon = m.icon;
                      const active = selectedMode === m.id;
                      return (
                        <button
                          key={m.id}
                          onClick={() => setSelectedMode(m.id)}
                          className={`relative w-full text-left rounded-2xl p-4 border-2 transition-all duration-200 ${
                            active
                              ? 'border-primary bg-primary/5 shadow-lg shadow-primary/10'
                              : 'border-border hover:border-primary/30 hover:bg-muted/50'
                          }`}
                        >
                          <div className="flex items-center gap-4">
                            <div className={`flex items-center justify-center h-11 w-11 rounded-xl bg-gradient-to-br ${m.gradient} text-white shadow`}>
                              <Icon className="h-5 w-5" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <h3 className="font-semibold text-sm">{m.name}</h3>
                                {m.adaptive && (
                                  <span className="px-1.5 py-0.5 rounded-full bg-green-500/10 text-green-600 text-[9px] font-bold">RECOMMENDED</span>
                                )}
                                {m.smartdrill && (
                                  <span className="px-1.5 py-0.5 rounded-full bg-violet-500/10 text-violet-600 text-[9px] font-bold">NEW</span>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground mt-0.5">{m.description}</p>
                            </div>
                            {active && <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Step 2: Unit/Topic */}
                {modalStep === 2 && (
                  <div className="grid grid-cols-1 gap-2">
                    <button
                      onClick={() => setSelectedUnit('all')}
                      className={`flex items-center gap-3 w-full text-left rounded-xl p-3.5 border-2 transition-all duration-200 ${
                        selectedUnit === 'all'
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/30 hover:bg-muted/50'
                      }`}
                    >
                      <Sparkles className="h-4 w-4 text-primary shrink-0" />
                      <span className="font-medium text-sm flex-1">All Topics</span>
                      {selectedUnit === 'all' && <CheckCircle2 className="h-4 w-4 text-primary" />}
                    </button>
                    {ATP_UNITS.map((u) => (
                      <button
                        key={u.id}
                        onClick={() => setSelectedUnit(u.id)}
                        className={`flex items-center gap-3 w-full text-left rounded-xl p-3.5 border-2 transition-all duration-200 ${
                          selectedUnit === u.id
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:border-primary/30 hover:bg-muted/50'
                        }`}
                      >
                        <span className="font-medium text-sm flex-1">{u.name}</span>
                        {selectedUnit === u.id && <CheckCircle2 className="h-4 w-4 text-primary" />}
                      </button>
                    ))}
                  </div>
                )}

                {/* Step 3: Question Count — Sleek Slider */}
                {modalStep === 3 && (
                  <div className="space-y-6">
                    {/* Infinity toggle */}
                    <button
                      onClick={() => setIsInfinityMode(!isInfinityMode)}
                      className={`w-full flex items-center justify-between rounded-2xl p-4 border-2 transition-all duration-200 ${
                        isInfinityMode
                          ? 'border-primary bg-primary/5 shadow-lg shadow-primary/10'
                          : 'border-border hover:border-primary/30 hover:bg-muted/50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Infinity className={`h-6 w-6 ${isInfinityMode ? 'text-primary' : 'text-muted-foreground'}`} />
                        <div className="text-left">
                          <span className="font-bold text-sm">Endless Mode</span>
                          <p className="text-[10px] text-muted-foreground">Questions never stop — terminate anytime</p>
                        </div>
                      </div>
                      <div className={`h-6 w-11 rounded-full transition-colors duration-200 relative ${isInfinityMode ? 'bg-primary' : 'bg-muted'}`}>
                        <div className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ${isInfinityMode ? 'translate-x-5' : 'translate-x-0.5'}`} />
                      </div>
                    </button>

                    {/* Slider — only visible when NOT infinity */}
                    {!isInfinityMode && (
                      <div className="space-y-4 px-1">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-muted-foreground">Questions</span>
                          <span className="text-3xl font-bold bg-gradient-to-r from-primary to-emerald-500 bg-clip-text text-transparent">
                            {questionCount}
                          </span>
                        </div>
                        <input
                          type="range"
                          min={SLIDER_MIN}
                          max={SLIDER_MAX}
                          step={5}
                          value={questionCount}
                          onChange={(e) => setQuestionCount(Number(e.target.value))}
                          className="w-full h-2 bg-muted rounded-full appearance-none cursor-pointer accent-primary
                            [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:w-6
                            [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-gradient-to-br [&::-webkit-slider-thumb]:from-primary [&::-webkit-slider-thumb]:to-emerald-500
                            [&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:shadow-primary/30 [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white
                            [&::-webkit-slider-thumb]:cursor-grab [&::-webkit-slider-thumb]:active:cursor-grabbing
                            [&::-moz-range-thumb]:h-6 [&::-moz-range-thumb]:w-6 [&::-moz-range-thumb]:rounded-full
                            [&::-moz-range-thumb]:bg-gradient-to-br [&::-moz-range-thumb]:from-primary [&::-moz-range-thumb]:to-emerald-500
                            [&::-moz-range-thumb]:shadow-lg [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white
                            [&::-moz-range-thumb]:cursor-grab"
                          style={{
                            background: `linear-gradient(to right, hsl(var(--primary)) 0%, hsl(var(--primary)) ${((questionCount - SLIDER_MIN) / (SLIDER_MAX - SLIDER_MIN)) * 100}%, hsl(var(--muted)) ${((questionCount - SLIDER_MIN) / (SLIDER_MAX - SLIDER_MIN)) * 100}%, hsl(var(--muted)) 100%)`,
                          }}
                        />
                        <div className="flex justify-between text-[10px] text-muted-foreground font-medium">
                          <span>{SLIDER_MIN}</span>
                          <span>15</span>
                          <span>25</span>
                          <span>35</span>
                          <span>{SLIDER_MAX}</span>
                        </div>
                      </div>
                    )}

                    {isInfinityMode && (
                      <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                        <Infinity className="h-4 w-4 text-amber-600 shrink-0" />
                        <p className="text-xs text-amber-700 dark:text-amber-400">
                          Questions keep coming until you press <strong>Terminate</strong>. You&apos;ll get a full report with your total score.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between px-6 py-4 border-t border-border/50 bg-muted/20">
                {modalStep > 1 ? (
                  <Button variant="ghost" size="sm" onClick={() => setModalStep((s) => (s - 1) as 1 | 2 | 3)} className="gap-1">
                    <ChevronLeft className="h-4 w-4" /> Back
                  </Button>
                ) : (
                  <div />
                )}
                {modalStep < 3 ? (
                  <Button size="sm" onClick={() => setModalStep((s) => (s + 1) as 1 | 2 | 3)} className="gap-1 bg-gradient-to-r from-primary to-emerald-600 hover:from-primary/90 hover:to-emerald-600/90">
                    Next <ChevronRight className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    onClick={startQuiz}
                    className="gap-2 bg-gradient-to-r from-primary to-emerald-600 hover:from-primary/90 hover:to-emerald-600/90 shadow-lg"
                  >
                    <Lightbulb className="h-4 w-4" />
                    Start {mode.name}
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  // ═══════════════════════════════════
  //  RENDER: LOADING (personality-filled)
  // ═══════════════════════════════════
  if (loading) {
    const ModeIcon = mode.icon;
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 px-6">
        {/* Animated mode icon */}
        <div className={`relative p-5 rounded-3xl bg-gradient-to-br ${mode.gradient} text-white shadow-2xl animate-pulse`}>
          <ModeIcon className="h-10 w-10" />
          <div className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-card flex items-center justify-center">
            <Loader2 className="h-3 w-3 animate-spin text-primary" />
          </div>
        </div>

        {/* Mode & topic label */}
        <div className="text-center space-y-1">
          <h2 className={`text-xl font-bold bg-gradient-to-r ${mode.gradient} bg-clip-text text-transparent`}>
            {mode.name}
          </h2>
          <p className="text-xs text-muted-foreground">{unitName} · {isInfinityMode ? 'Endless' : `${questionCount} questions`}</p>
        </div>

        {/* Personality message — fades & cycles */}
        <div className="max-w-sm text-center animate-fade-in" key={loadingMessage}>
          <p className="text-sm font-medium text-muted-foreground italic leading-relaxed">
            &ldquo;{loadingMessage}&rdquo;
          </p>
        </div>

        {/* Pulsing dots */}
        <div className="flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className={`h-2 w-2 rounded-full bg-gradient-to-r ${mode.gradient}`}
              style={{ animation: `pulse 1.4s ease-in-out ${i * 0.2}s infinite` }}
            />
          ))}
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════
  //  RENDER: RESULTS
  // ═══════════════════════════════════
  if (section === 'results') {
    const totalAnswered = responsesTracked.length || questions.length;
    const pct = totalAnswered > 0 ? Math.round((score / totalAnswered) * 100) : 0;
    const resultConfig = pct >= 80 
      ? { gradient: 'from-emerald-500 to-teal-500', emoji: '🎉', title: 'Outstanding!', subtitle: 'You crushed it!' }
      : pct >= 60 
      ? { gradient: 'from-amber-500 to-orange-500', emoji: '👏', title: 'Well Done!', subtitle: 'Great effort!' }
      : pct >= 40 
      ? { gradient: 'from-gray-500 to-gray-600', emoji: '💪', title: 'Not Bad!', subtitle: 'Keep practicing!' }
      : { gradient: 'from-rose-500 to-pink-500', emoji: '📚', title: 'Keep Going!', subtitle: 'Practice makes perfect!' };

    return (
      <div className="p-6 md:p-10 max-w-2xl mx-auto space-y-8 text-center">
        <div className="relative inline-block">
          <div className={`relative inline-flex items-center justify-center h-32 w-32 rounded-full bg-gradient-to-br ${resultConfig.gradient} text-white shadow-2xl`}>
            <span className="text-4xl font-bold">{pct}%</span>
          </div>
          <span className="absolute -top-2 -right-2 text-4xl animate-bounce">{resultConfig.emoji}</span>
        </div>

        <div>
          <h2 className={`text-3xl font-bold bg-gradient-to-r ${resultConfig.gradient} bg-clip-text text-transparent`}>
            {resultConfig.title}
          </h2>
          <p className="text-muted-foreground mt-1">{resultConfig.subtitle}</p>
          <p className="text-sm text-muted-foreground mt-2">
            {score}/{totalAnswered} correct · {mode.name}
            {isInfinityMode && ' · Endless Mode'}
          </p>
        </div>

        <div className="grid grid-cols-3 gap-4 max-w-md mx-auto">
          <Card className="border border-emerald-500/15 bg-emerald-500/3">
            <CardContent className="pt-4 pb-3 text-center">
              <Target className="h-6 w-6 mx-auto text-emerald-500 mb-2" />
              <p className="text-2xl font-bold text-emerald-600">{score}</p>
              <p className="text-xs text-muted-foreground">Correct</p>
            </CardContent>
          </Card>
          <Card className="border-2 border-orange-500/20 bg-orange-500/5">
            <CardContent className="pt-4 pb-3 text-center">
              <Flame className="h-6 w-6 mx-auto text-orange-500 mb-2" />
              <p className="text-2xl font-bold text-orange-600">{bestStreak}</p>
              <p className="text-xs text-muted-foreground">Best Streak</p>
            </CardContent>
          </Card>
          <Card className="border-2 border-gray-500/20 bg-gray-500/5">
            <CardContent className="pt-4 pb-3 text-center">
              <Star className="h-6 w-6 mx-auto text-gray-500 mb-2" />
              <p className="text-2xl font-bold text-gray-600">{totalAnswered - score}</p>
              <p className="text-xs text-muted-foreground">To Review</p>
            </CardContent>
          </Card>
        </div>

        <div className="flex gap-3 justify-center pt-4">
          <Button onClick={startQuiz} className="gap-2 bg-gradient-to-r from-primary to-emerald-600 hover:from-primary/90 hover:to-emerald-600/90 shadow-lg">
            <RotateCcw className="h-4 w-4" />
            Play Again
          </Button>
          <Button variant="outline" onClick={() => setSection('menu')} className="gap-2">
            Change Mode
          </Button>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════
  //  RENDER: PLAYING
  // ═══════════════════════════════════
  const q = questions[currentIndex];
  if (!q) {
    // Possibly waiting for more questions in infinity mode
    if (isInfinityMode && loadingMoreQuestions) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="font-medium">Loading more questions…</p>
        </div>
      );
    }
    return null;
  }

  const qType = q.questionType || 'mcq';

  return (
    <div className="p-6 md:p-10 max-w-3xl mx-auto space-y-6">
      {/* Header with mode indicator */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`p-1.5 rounded-lg bg-gradient-to-br ${mode.gradient} text-white`}>
            <mode.icon className="h-4 w-4" />
          </div>
          <span className="text-sm font-medium text-muted-foreground">
            {isInfinityMode
              ? `Question ${currentIndex + 1}`
              : `Question ${currentIndex + 1} of ${questions.length}`}
          </span>
          {streak > 1 && (
            <span className="flex items-center gap-1 text-xs bg-orange-500/10 text-orange-600 font-medium px-2 py-0.5 rounded-full">
              <Flame className="h-3.5 w-3.5" />
              {streak} streak!
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold bg-gradient-to-r from-primary to-emerald-500 bg-clip-text text-transparent">
            {score} pts
          </span>
          {mode.timed && !revealed && (
            <span className={`flex items-center gap-1 text-sm font-mono px-2 py-0.5 rounded-lg ${
              questionTimer <= 5 ? 'bg-red-500/10 text-red-600 font-bold animate-pulse' : 'bg-muted text-muted-foreground'
            }`}>
              <Clock className="h-4 w-4" />
              {questionTimer}s
            </span>
          )}
          {/* Infinity terminate button */}
          {isInfinityMode && (
            <Button
              variant="outline"
              size="sm"
              onClick={terminateQuiz}
              className="gap-1.5 text-rose-600 border-rose-200 hover:bg-rose-50 dark:border-rose-800 dark:hover:bg-rose-900/20"
            >
              <StopCircle className="h-4 w-4" />
              Terminate
            </Button>
          )}
        </div>
      </div>

      {/* Progress bar */}
      {!isInfinityMode && (
        <div className="flex gap-1 h-2 bg-muted rounded-full overflow-hidden">
          {questions.map((_, i) => (
            <div
              key={i}
              className={`flex-1 transition-all duration-300 ${
                i < currentIndex
                  ? `bg-gradient-to-r ${mode.gradient}`
                  : i === currentIndex
                  ? `bg-gradient-to-r ${mode.gradient} opacity-60`
                  : 'bg-transparent'
              }`}
            />
          ))}
        </div>
      )}
      {isInfinityMode && (
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-primary to-emerald-500 animate-pulse rounded-full" style={{ width: '100%' }} />
        </div>
      )}

      {/* Question type badge for SmartDrill */}
      {mode.id === 'smartdrill' && (
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
            qType === 'mcq' ? 'bg-blue-500/10 text-blue-600' :
            qType === 'ordering' ? 'bg-violet-500/10 text-violet-600' :
            'bg-amber-500/10 text-amber-600'
          }`}>
            {qType === 'mcq' && <><Target className="h-3 w-3" /> Multiple Choice</>}
            {qType === 'ordering' && <><ArrowUpDown className="h-3 w-3" /> Ordering</>}
            {qType === 'text-entry' && <><PenLine className="h-3 w-3" /> Fill-in</>}
          </span>
        </div>
      )}

      {/* Question card */}
      <Card className="border-2 shadow-xl overflow-hidden">
        <div className={`h-1 bg-gradient-to-r ${mode.gradient}`} />
        <CardHeader className="pb-4">
          <CardTitle className="text-xl leading-relaxed">{q.question}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 pb-6">
          {/* ── MCQ OPTIONS ── */}
          {qType === 'mcq' && q.options.map((option, i) => {
            let style = 'bg-muted/50 hover:bg-muted border-transparent hover:border-muted-foreground/20';
            let iconEl = null;
            
            if (revealed) {
              if (i === q.correct) {
                style = 'bg-emerald-500/10 border-emerald-500 text-emerald-900 dark:text-emerald-300';
                iconEl = <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />;
              } else if (i === selected && i !== q.correct) {
                style = 'bg-red-500/10 border-red-500 text-red-900 dark:text-red-300';
                iconEl = <XCircle className="h-5 w-5 text-red-500 shrink-0" />;
              } else {
                style = 'bg-muted/20 border-transparent opacity-50';
              }
            } else if (i === selected) {
              style = `bg-gradient-to-r ${mode.gradient} bg-opacity-10 border-primary/50`;
            }

            return (
              <button
                key={i}
                onClick={() => handleSelect(i)}
                disabled={revealed}
                className={`w-full text-left p-4 rounded-xl border-2 transition-all duration-200 text-sm font-medium ${style}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span>{option}</span>
                  {iconEl}
                </div>
              </button>
            );
          })}

          {/* ── ORDERING ── */}
          {qType === 'ordering' && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground mb-3">Drag or use arrows to arrange in the correct order:</p>
              {dragOrder.map((itemIdx, posIdx) => {
                const correctOrder = q.correctOrder || [];
                const isCorrectPos = orderRevealed && correctOrder[posIdx] === itemIdx;
                const isWrongPos = orderRevealed && correctOrder[posIdx] !== itemIdx;

                return (
                  <div
                    key={itemIdx}
                    className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all duration-200 ${
                      orderRevealed
                        ? isCorrectPos
                          ? 'border-emerald-500 bg-emerald-500/10'
                          : 'border-red-500/50 bg-red-500/5'
                        : 'border-border bg-muted/30 hover:bg-muted/50'
                    }`}
                  >
                    <span className="text-xs font-bold text-muted-foreground w-5">{posIdx + 1}.</span>
                    <span className="flex-1 text-sm font-medium">{q.options[itemIdx]}</span>
                    {!orderRevealed && (
                      <div className="flex flex-col gap-0.5">
                        <button
                          onClick={() => posIdx > 0 && moveOrderItem(posIdx, posIdx - 1)}
                          disabled={posIdx === 0}
                          className="p-0.5 hover:bg-muted rounded disabled:opacity-20"
                        >
                          <ChevronLeft className="h-3.5 w-3.5 rotate-90" />
                        </button>
                        <button
                          onClick={() => posIdx < dragOrder.length - 1 && moveOrderItem(posIdx, posIdx + 1)}
                          disabled={posIdx === dragOrder.length - 1}
                          className="p-0.5 hover:bg-muted rounded disabled:opacity-20"
                        >
                          <ChevronRight className="h-3.5 w-3.5 rotate-90" />
                        </button>
                      </div>
                    )}
                    {orderRevealed && isCorrectPos && <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />}
                    {orderRevealed && isWrongPos && <XCircle className="h-5 w-5 text-red-400 shrink-0" />}
                  </div>
                );
              })}
              {!orderRevealed && (
                <Button
                  onClick={handleOrderSubmit}
                  className={`w-full mt-3 gap-2 bg-gradient-to-r ${mode.gradient} hover:opacity-90`}
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Submit Order
                </Button>
              )}
              {orderRevealed && q.correctOrder && (
                <div className="mt-3 p-3 rounded-xl bg-muted/30 border border-border">
                  <p className="text-xs font-medium text-muted-foreground mb-1">Correct order:</p>
                  <ol className="list-decimal list-inside text-sm space-y-0.5">
                    {q.correctOrder.map((idx, i) => (
                      <li key={i}>{q.options[idx]}</li>
                    ))}
                  </ol>
                </div>
              )}
            </div>
          )}

          {/* ── TEXT ENTRY ── */}
          {qType === 'text-entry' && (
            <div className="space-y-3">
              <div className="relative">
                <input
                  type="text"
                  value={textAnswer}
                  onChange={(e) => setTextAnswer(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !textRevealed && handleTextSubmit()}
                  disabled={textRevealed}
                  placeholder="Type your answer…"
                  className={`w-full px-4 py-3 rounded-xl border-2 text-sm font-medium transition-all duration-200 bg-muted/30 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary ${
                    textRevealed
                      ? (q.acceptableAnswers || []).some((a) => a.toLowerCase().trim() === textAnswer.toLowerCase().trim())
                        ? 'border-emerald-500 bg-emerald-500/10'
                        : 'border-red-500 bg-red-500/10'
                      : 'border-border'
                  }`}
                />
              </div>
              {!textRevealed && (
                <Button
                  onClick={handleTextSubmit}
                  disabled={!textAnswer.trim()}
                  className={`w-full gap-2 bg-gradient-to-r ${mode.gradient} hover:opacity-90`}
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Submit Answer
                </Button>
              )}
              {textRevealed && (
                <div className={`p-3 rounded-xl border ${
                  (q.acceptableAnswers || []).some((a) => a.toLowerCase().trim() === textAnswer.toLowerCase().trim())
                    ? 'bg-emerald-500/5 border-emerald-500/30'
                    : 'bg-rose-500/5 border-rose-500/30'
                }`}>
                  <p className="text-xs font-medium text-muted-foreground">
                    Accepted answers: {(q.acceptableAnswers || []).join(', ')}
                  </p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Explanation */}
      {revealed && (
        <div className={`animate-fade-in rounded-xl p-5 border-2 ${
          (qType === 'mcq' && selected === q.correct) ||
          (qType === 'ordering' && JSON.stringify(dragOrder) === JSON.stringify(q.correctOrder || [])) ||
          (qType === 'text-entry' && (q.acceptableAnswers || []).some((a) => a.toLowerCase().trim() === textAnswer.toLowerCase().trim()))
            ? 'bg-emerald-500/5 border-emerald-500/30' 
            : 'bg-rose-500/5 border-rose-500/30'
        }`}>
          <p className={`font-semibold mb-2 flex items-center gap-2 ${
            (qType === 'mcq' && selected === q.correct) ||
            (qType === 'ordering' && JSON.stringify(dragOrder) === JSON.stringify(q.correctOrder || [])) ||
            (qType === 'text-entry' && (q.acceptableAnswers || []).some((a) => a.toLowerCase().trim() === textAnswer.toLowerCase().trim()))
              ? 'text-emerald-600' : 'text-rose-600'
          }`}>
            {((qType === 'mcq' && selected === q.correct) ||
              (qType === 'ordering' && JSON.stringify(dragOrder) === JSON.stringify(q.correctOrder || [])) ||
              (qType === 'text-entry' && (q.acceptableAnswers || []).some((a) => a.toLowerCase().trim() === textAnswer.toLowerCase().trim()))) ? (
              <>
                <CheckCircle2 className="h-5 w-5" />
                Correct!
              </>
            ) : (
              <>
                <XCircle className="h-5 w-5" />
                Incorrect
              </>
            )}
          </p>
          <p className="text-sm text-muted-foreground">{q.explanation}</p>
        </div>
      )}

      {/* Next / Loading more indicator */}
      {revealed && (
        <div className="flex justify-end pt-2 gap-3">
          {loadingMoreQuestions && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              Loading more…
            </div>
          )}
          <Button 
            onClick={nextQuestion} 
            className={`gap-2 bg-gradient-to-r ${mode.gradient} hover:opacity-90 shadow-lg transition-all duration-200 hover:scale-[1.02]`}
          >
            {!isInfinityMode && currentIndex < questions.length - 1
              ? 'Next Question'
              : !isInfinityMode
              ? 'See Results'
              : 'Next Question'}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
