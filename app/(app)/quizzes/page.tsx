'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
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
} from 'lucide-react';

interface TriviaQuestion {
  question: string;
  options: string[];
  correct: number; // index
  explanation: string;
  difficulty?: 'easy' | 'medium' | 'hard';
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
    gradient: 'from-indigo-500 to-purple-600',
    bgGlow: 'bg-indigo-500/20',
    count: 10,
    difficulty: 'Personalized',
    time: '~7 min',
    adaptive: true,
    isDefault: true,
  },
  {
    id: 'quick',
    name: 'Quick Quiz',
    description: '5 rapid-fire questions to warm up',
    icon: Zap,
    gradient: 'from-amber-500 to-orange-600',
    bgGlow: 'bg-amber-500/20',
    count: 5,
    difficulty: 'Mixed',
    time: '~3 min',
  },
  {
    id: 'challenge',
    name: 'Challenge Mode',
    description: '10 questions — test your mastery',
    icon: Trophy,
    gradient: 'from-violet-500 to-purple-600',
    bgGlow: 'bg-violet-500/20',
    count: 10,
    difficulty: 'Medium',
    time: '~8 min',
  },
  {
    id: 'blitz',
    name: 'Speed Blitz',
    description: '15 seconds per question. Think fast!',
    icon: Timer,
    gradient: 'from-rose-500 to-pink-600',
    bgGlow: 'bg-rose-500/20',
    count: 8,
    timed: true,
    difficulty: 'Hard',
    time: '~2 min',
  },
  {
    id: 'exam',
    name: 'Exam Simulation',
    description: '20 questions across all topics',
    icon: GraduationCap,
    gradient: 'from-emerald-500 to-teal-600',
    bgGlow: 'bg-emerald-500/20',
    count: 20,
    difficulty: 'Hard',
    time: '~15 min',
  },
  {
    id: 'random',
    name: 'Lucky Draw',
    description: 'Random mode, random topic — surprise!',
    icon: Shuffle,
    gradient: 'from-cyan-500 to-blue-600',
    bgGlow: 'bg-cyan-500/20',
    count: 7,
    random: true,
    difficulty: 'Mixed',
    time: '~5 min',
  },
  {
    id: 'legendary',
    name: 'Legendary',
    description: 'Only the toughest questions. No mercy.',
    icon: Sparkles,
    gradient: 'from-yellow-400 via-amber-500 to-orange-500',
    bgGlow: 'bg-yellow-500/30',
    count: 10,
    difficulty: 'Expert',
    time: '~10 min',
    legendary: true,
  },
];

export default function QuizzesPage() {
  const { getIdToken } = useAuth();
  const { setAuthToken, getPreloaded, afterQuizCompletion } = usePreloading();

  const [section, setSection] = useState<Section>('menu');
  const [selectedMode, setSelectedMode] = useState<string>('adaptive');
  const [selectedUnit, setSelectedUnit] = useState<string>('all');
  const [questions, setQuestions] = useState<TriviaQuestion[]>([]);
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
      case 'beginner':
        return 'mostly easy with some medium difficulty questions';
      case 'intermediate':
        return 'mostly medium with some challenging questions';
      case 'advanced':
        return 'mostly hard with some expert-level questions';
      case 'expert':
        return 'expert-level and tricky edge-case questions';
      default:
        return 'mixed difficulty';
    }
  };

  const getTopicFocus = (): string => {
    if (!userPerformance || selectedUnit !== 'all') return '';
    
    if (userPerformance.weakAreas.length > 0) {
      // Focus 60% on weak areas, 40% on general
      return `Focus about 60% of questions on these weak areas: ${userPerformance.weakAreas.slice(0, 3).join(', ')}. Mix in questions from other topics for variety.`;
    }
    return '';
  };

  const startQuiz = useCallback(async () => {
    setLoading(true);
    setSection('playing');
    setCurrentIndex(0);
    setScore(0);
    setStreak(0);
    setBestStreak(0);
    setSelected(null);
    setRevealed(false);
    setResponsesTracked([]);

    try {
      const token = await getIdToken();
      const unitInfo = selectedUnit !== 'all' ? ATP_UNITS.find((u) => u.id === selectedUnit) : null;
      
      // Try to use preloaded questions first for instant start
      const preloaded = await getPreloaded(selectedUnit !== 'all' ? selectedUnit : 'all', undefined, 'quiz');
      if (preloaded?.found && preloaded.content?.questions && Array.isArray(preloaded.content.questions) && preloaded.content.questions.length > 0) {
        console.log('Using preloaded quiz questions');
        setQuestions(preloaded.content.questions.slice(0, mode.count));
        setLoading(false);
        return;
      }
      
      // Build adaptive prompt
      let difficultyInstruction = '';
      let topicInstruction = '';
      
      if (mode.adaptive) {
        difficultyInstruction = getAdaptiveDifficulty();
        topicInstruction = getTopicFocus();
      } else if (mode.legendary) {
        difficultyInstruction = 'expert-level, tricky edge cases, and nuanced legal scenarios only';
      } else if (mode.id === 'blitz') {
        difficultyInstruction = 'quick-recall questions that can be answered in seconds';
      } else if (mode.id === 'exam') {
        difficultyInstruction = 'exam-style questions with realistic complexity';
      }  
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          message: `Generate ${mode.count} trivia/quiz questions about Kenyan law${unitInfo ? ` specifically on ${unitInfo.name} covering ${unitInfo.statutes.join(', ')}` : ' across all ATP units'}.

${difficultyInstruction ? `Difficulty: ${difficultyInstruction}.` : ''}
${topicInstruction}

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
- Make questions engaging, mixing straightforward recall with practical scenarios
- Include questions about statutes, case law, legal principles, and procedures
- The "correct" field is the 0-based index of the correct option
- EVERY explanation MUST cite a specific legal source (e.g., "Section 107(1) of the Evidence Act, Cap 80", "Article 50(2)(a) of the Constitution of Kenya 2010", "Republic v Mbugua [2019] eKLR")
- No vague references like "according to the law" - be specific
- Output ONLY the JSON array`,
          competencyType: 'research',
          context: { 
            topicArea: unitInfo?.name || 'General Kenyan Law', 
            quizMode: mode.id,
            userLevel: userPerformance?.currentLevel || 'unknown',
            weakAreas: userPerformance?.weakAreas || [],
          },
        }),
      });

      if (!res.ok) throw new Error('Failed');

      const data = await res.json();
      try {
        const content = data.response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        setQuestions(JSON.parse(content));
      } catch {
        // Fallback
        setQuestions([{
          question: 'What is the supreme law of Kenya?',
          options: ['A) Penal Code', 'B) Constitution of Kenya 2010', 'C) Judicature Act', 'D) Civil Procedure Act'],
          correct: 1,
          explanation: 'The Constitution of Kenya 2010 is the supreme law of the Republic.',
        }]);
      }
    } catch {
      setSection('menu');
    } finally {
      setLoading(false);
    }
  }, [getIdToken, mode, selectedUnit, userPerformance]);

  // Speed blitz timer
  useEffect(() => {
    if (section !== 'playing' || !mode.timed || revealed || loading) return;
    if (questionTimer <= 0) {
      // Time's up — count as wrong
      setRevealed(true);
      setStreak(0);
      return;
    }
    const interval = setInterval(() => setQuestionTimer((t) => t - 1), 1000);
    return () => clearInterval(interval);
  }, [section, mode.timed, revealed, questionTimer, loading]);

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

    // Track response for analytics
    setResponsesTracked((prev) => [...prev, { questionIndex: currentIndex, isCorrect }]);

    // Submit response to backend (non-blocking)
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
        }),
      }).catch(() => {}); // Ignore errors - this is fire-and-forget
    } catch {}
  };

  const nextQuestion = () => {
    if (currentIndex >= questions.length - 1) {
      setSection('results');
      // Trigger preloading of next quiz questions in background
      afterQuizCompletion(selectedUnit !== 'all' ? selectedUnit : 'all');
    } else {
      setCurrentIndex((i) => i + 1);
      setSelected(null);
      setRevealed(false);
      setQuestionTimer(15);
    }
  };

  // Menu
  if (section === 'menu') {
    return (
      <div className="p-6 md:p-10 max-w-6xl mx-auto space-y-10">
        {/* Header with gradient text */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-primary via-violet-500 to-primary bg-clip-text text-transparent">
            Quizzes & Trivia
          </h1>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Challenge yourself with fun, engaging quizzes. Pick a mode, choose a topic, and let&apos;s go!
          </p>
          {/* User level indicator */}
          {userPerformance && (
            <div className="flex items-center justify-center gap-2 mt-3">
              <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${
                userPerformance.currentLevel === 'expert' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' :
                userPerformance.currentLevel === 'advanced' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                userPerformance.currentLevel === 'intermediate' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
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

        {/* Mode selection - enhanced grid */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Choose Your Mode</h2>
            <span className="text-xs text-muted-foreground">{QUIZ_MODES.length} modes available</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {QUIZ_MODES.map((m) => {
              const Icon = m.icon;
              const active = selectedMode === m.id;
              return (
                <div
                  key={m.id}
                  onClick={() => setSelectedMode(m.id)}
                  className={`group relative cursor-pointer rounded-2xl p-[2px] transition-all duration-300 ${
                    active
                      ? `bg-gradient-to-br ${m.gradient} shadow-lg shadow-primary/20`
                      : 'bg-border hover:bg-gradient-to-br hover:' + m.gradient.replace('from-', 'hover:from-').replace('to-', 'hover:to-')
                  }`}
                >
                  <div className={`relative h-full rounded-2xl p-5 transition-all duration-300 ${
                    active ? 'bg-card/95' : 'bg-card hover:bg-card/95'
                  }`}>
                    {/* Glow effect */}
                    <div className={`absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 ${m.bgGlow} blur-xl -z-10`} />
                    
                    {/* Icon with gradient background */}
                    <div className={`inline-flex items-center justify-center h-12 w-12 rounded-xl bg-gradient-to-br ${m.gradient} text-white shadow-lg mb-4`}>
                      <Icon className="h-6 w-6" />
                    </div>

                    {/* Content */}
                    <h3 className="font-semibold text-base mb-1">{m.name}</h3>
                    <p className="text-sm text-muted-foreground mb-4">{m.description}</p>

                    {/* Stats row */}
                    <div className="flex items-center gap-3 text-xs">
                      <span className={`px-2 py-0.5 rounded-full ${
                        m.difficulty === 'Personalized' ? 'bg-indigo-500/10 text-indigo-600' :
                        m.difficulty === 'Easy' || m.difficulty === 'Mixed' ? 'bg-emerald-500/10 text-emerald-600' :
                        m.difficulty === 'Medium' ? 'bg-amber-500/10 text-amber-600' :
                        m.difficulty === 'Hard' ? 'bg-rose-500/10 text-rose-600' :
                        m.difficulty === 'Expert' ? 'bg-purple-500/10 text-purple-600' :
                        'bg-cyan-500/10 text-cyan-600'
                      }`}>
                        {m.difficulty}
                      </span>
                      <span className="text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {m.time}
                      </span>
                      <span className="text-muted-foreground">
                        {m.count} Q&apos;s
                      </span>
                    </div>

                    {/* Selected indicator */}
                    {active && (
                      <div className="absolute top-3 right-3">
                        <CheckCircle2 className={`h-5 w-5 text-transparent bg-gradient-to-br ${m.gradient} bg-clip-text`} style={{ color: 'rgb(var(--primary))' }} />
                      </div>
                    )}
                    
                    {/* Adaptive badge */}
                    {m.adaptive && (
                      <div className="absolute -top-1 -right-1 px-2 py-0.5 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 text-[10px] font-bold text-white shadow-lg">
                        🎯 RECOMMENDED
                      </div>
                    )}
                    
                    {/* Legendary badge */}
                    {m.legendary && (
                      <div className="absolute -top-1 -right-1 px-2 py-0.5 rounded-full bg-gradient-to-r from-yellow-400 to-amber-500 text-[10px] font-bold text-white shadow-lg">
                        ⚡ LEGENDARY
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Unit selection - pill style */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Choose a Topic</h2>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedUnit('all')}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                selectedUnit === 'all'
                  ? 'bg-gradient-to-r from-primary to-violet-500 text-white shadow-lg shadow-primary/25'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground'
              }`}
            >
              <span className="flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5" />
                All Topics
              </span>
            </button>
            {ATP_UNITS.map((u) => (
              <button
                key={u.id}
                onClick={() => setSelectedUnit(u.id)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                  selectedUnit === u.id
                    ? 'bg-gradient-to-r from-primary to-violet-500 text-white shadow-lg shadow-primary/25'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground'
                }`}
              >
                {u.name}
              </button>
            ))}
          </div>
        </div>

        {/* Start button - enhanced */}
        <div className="flex flex-col items-center gap-4 pt-4">
          <Button 
            size="lg" 
            onClick={startQuiz} 
            className="gap-3 px-8 py-6 text-lg font-semibold bg-gradient-to-r from-primary to-violet-600 hover:from-primary/90 hover:to-violet-600/90 shadow-xl shadow-primary/25 transition-all duration-300 hover:scale-[1.02]"
          >
            <Lightbulb className="h-6 w-6" />
            Start {mode.name}
            <ArrowRight className="h-5 w-5" />
          </Button>
          <p className="text-sm text-muted-foreground">
            {mode.count} questions · {unitName}
          </p>
        </div>
      </div>
    );
  }

  // Loading
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="font-medium">Generating quiz questions…</p>
        <p className="text-sm text-muted-foreground">{mode.name} · {unitName}</p>
      </div>
    );
  }

  // Results
  if (section === 'results') {
    const pct = questions.length > 0 ? Math.round((score / questions.length) * 100) : 0;
    const resultConfig = pct >= 80 
      ? { gradient: 'from-emerald-500 to-teal-500', emoji: '🎉', title: 'Outstanding!', subtitle: 'You crushed it!' }
      : pct >= 60 
      ? { gradient: 'from-amber-500 to-orange-500', emoji: '👏', title: 'Well Done!', subtitle: 'Great effort!' }
      : pct >= 40 
      ? { gradient: 'from-violet-500 to-purple-500', emoji: '💪', title: 'Not Bad!', subtitle: 'Keep practicing!' }
      : { gradient: 'from-rose-500 to-pink-500', emoji: '📚', title: 'Keep Going!', subtitle: 'Practice makes perfect!' };

    return (
      <div className="p-6 md:p-10 max-w-2xl mx-auto space-y-8 text-center">
        {/* Animated score circle */}
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
            {score}/{questions.length} correct · {mode.name}
          </p>
        </div>

        <div className="grid grid-cols-3 gap-4 max-w-md mx-auto">
          <Card className="border-2 border-emerald-500/20 bg-emerald-500/5">
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
          <Card className="border-2 border-violet-500/20 bg-violet-500/5">
            <CardContent className="pt-4 pb-3 text-center">
              <Star className="h-6 w-6 mx-auto text-violet-500 mb-2" />
              <p className="text-2xl font-bold text-violet-600">{questions.length - score}</p>
              <p className="text-xs text-muted-foreground">To Review</p>
            </CardContent>
          </Card>
        </div>

        <div className="flex gap-3 justify-center pt-4">
          <Button onClick={startQuiz} className="gap-2 bg-gradient-to-r from-primary to-violet-600 hover:from-primary/90 hover:to-violet-600/90 shadow-lg">
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

  // Playing
  const q = questions[currentIndex];
  if (!q) return null;

  return (
    <div className="p-6 md:p-10 max-w-3xl mx-auto space-y-6">
      {/* Header with mode indicator */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`p-1.5 rounded-lg bg-gradient-to-br ${mode.gradient} text-white`}>
            <mode.icon className="h-4 w-4" />
          </div>
          <span className="text-sm font-medium text-muted-foreground">
            Question {currentIndex + 1} of {questions.length}
          </span>
          {streak > 1 && (
            <span className="flex items-center gap-1 text-xs bg-orange-500/10 text-orange-600 font-medium px-2 py-0.5 rounded-full">
              <Flame className="h-3.5 w-3.5" />
              {streak} streak!
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold bg-gradient-to-r from-primary to-violet-500 bg-clip-text text-transparent">
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
        </div>
      </div>

      {/* Progress bar - gradient */}
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

      {/* Question card - enhanced */}
      <Card className="border-2 shadow-xl overflow-hidden">
        <div className={`h-1 bg-gradient-to-r ${mode.gradient}`} />
        <CardHeader className="pb-4">
          <CardTitle className="text-xl leading-relaxed">{q.question}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 pb-6">
          {q.options.map((option, i) => {
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
        </CardContent>
      </Card>

      {/* Explanation - enhanced */}
      {revealed && (
        <div className={`animate-fade-in rounded-xl p-5 border-2 ${
          selected === q.correct 
            ? 'bg-emerald-500/5 border-emerald-500/30' 
            : 'bg-rose-500/5 border-rose-500/30'
        }`}>
          <p className={`font-semibold mb-2 flex items-center gap-2 ${
            selected === q.correct ? 'text-emerald-600' : 'text-rose-600'
          }`}>
            {selected === q.correct ? (
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

      {/* Next button - enhanced */}
      {revealed && (
        <div className="flex justify-end pt-2">
          <Button 
            onClick={nextQuestion} 
            className={`gap-2 bg-gradient-to-r ${mode.gradient} hover:opacity-90 shadow-lg transition-all duration-200 hover:scale-[1.02]`}
          >
            {currentIndex < questions.length - 1 ? 'Next Question' : 'See Results'}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
