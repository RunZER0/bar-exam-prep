'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { ATP_UNITS } from '@/lib/constants/legal-content';
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
} from 'lucide-react';

interface TriviaQuestion {
  question: string;
  options: string[];
  correct: number; // index
  explanation: string;
}

type Section = 'menu' | 'playing' | 'results';

const QUIZ_MODES = [
  {
    id: 'quick',
    name: 'Quick Quiz',
    description: '5 rapid-fire questions from any unit',
    icon: Zap,
    color: 'bg-amber-500/10 text-amber-600',
    count: 5,
  },
  {
    id: 'challenge',
    name: 'Challenge Mode',
    description: '10 questions — can you get them all right?',
    icon: Trophy,
    color: 'bg-violet-500/10 text-violet-600',
    count: 10,
  },
  {
    id: 'blitz',
    name: 'Speed Blitz',
    description: '15 seconds per question. Think fast!',
    icon: Flame,
    color: 'bg-rose-500/10 text-rose-600',
    count: 8,
    timed: true,
  },
];

export default function QuizzesPage() {
  const { getIdToken } = useAuth();

  const [section, setSection] = useState<Section>('menu');
  const [selectedMode, setSelectedMode] = useState<string>('quick');
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

  const mode = QUIZ_MODES.find((m) => m.id === selectedMode)!;
  const unitName = selectedUnit === 'all' ? 'All Units' : ATP_UNITS.find((u) => u.id === selectedUnit)?.name || 'All Units';

  const startQuiz = useCallback(async () => {
    setLoading(true);
    setSection('playing');
    setCurrentIndex(0);
    setScore(0);
    setStreak(0);
    setBestStreak(0);
    setSelected(null);
    setRevealed(false);

    try {
      const token = await getIdToken();
      const unitInfo = selectedUnit !== 'all' ? ATP_UNITS.find((u) => u.id === selectedUnit) : null;
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          message: `Generate ${mode.count} trivia/quiz questions about Kenyan law${unitInfo ? ` specifically on ${unitInfo.name} covering ${unitInfo.statutes.join(', ')}` : ' across all ATP units'}.

Format as a JSON array:
[
  {
    "question": "What is...?",
    "options": ["A) ...", "B) ...", "C) ...", "D) ..."],
    "correct": 0,
    "explanation": "Brief explanation of the correct answer"
  }
]

Rules:
- Make questions fun and engaging, mixing straightforward recall with tricky scenarios
- Include questions about statutes, case law, legal principles, and procedures
- The "correct" field is the 0-based index of the correct option
- Keep explanations concise (1-2 sentences)
- Vary difficulty — some easy, some challenging
- Output ONLY the JSON array`,
          competencyType: 'research',
          context: { topicArea: unitInfo?.name || 'General Kenyan Law', quizMode: mode.id },
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
  }, [getIdToken, mode, selectedUnit]);

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

  const handleSelect = (index: number) => {
    if (revealed) return;
    setSelected(index);
    setRevealed(true);

    const q = questions[currentIndex];
    if (index === q.correct) {
      setScore((s) => s + 1);
      setStreak((s) => {
        const newStreak = s + 1;
        setBestStreak((b) => Math.max(b, newStreak));
        return newStreak;
      });
    } else {
      setStreak(0);
    }
  };

  const nextQuestion = () => {
    if (currentIndex >= questions.length - 1) {
      setSection('results');
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
      <div className="p-6 md:p-10 max-w-5xl mx-auto space-y-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Quizzes & Trivia</h1>
          <p className="text-muted-foreground mt-1">
            Test your knowledge with fun, fast-paced legal quizzes.
          </p>
        </div>

        {/* Mode selection */}
        <div>
          <h2 className="text-lg font-semibold mb-3">Choose a Mode</h2>
          <div className="grid sm:grid-cols-3 gap-3">
            {QUIZ_MODES.map((m) => {
              const Icon = m.icon;
              const active = selectedMode === m.id;
              return (
                <Card
                  key={m.id}
                  className={`cursor-pointer border-2 transition-all ${
                    active ? 'border-primary bg-primary/5' : 'hover:border-muted-foreground/30'
                  }`}
                  onClick={() => setSelectedMode(m.id)}
                >
                  <CardHeader className="pb-2">
                    <div className={`p-2 rounded-lg w-fit ${m.color}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <CardTitle className="text-sm mt-2">{m.name}</CardTitle>
                    <CardDescription className="text-xs">{m.description}</CardDescription>
                  </CardHeader>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Unit selection */}
        <div>
          <h2 className="text-lg font-semibold mb-3">Choose a Topic</h2>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedUnit('all')}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                selectedUnit === 'all'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              All Units
            </button>
            {ATP_UNITS.map((u) => (
              <button
                key={u.id}
                onClick={() => setSelectedUnit(u.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  selectedUnit === u.id
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                {u.name}
              </button>
            ))}
          </div>
        </div>

        <Button size="lg" onClick={startQuiz} className="gap-2">
          <Lightbulb className="h-5 w-5" />
          Start Quiz
          <ArrowRight className="h-4 w-4" />
        </Button>
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
    return (
      <div className="p-6 md:p-10 max-w-2xl mx-auto space-y-8 text-center">
        <div>
          <div className={`inline-flex items-center justify-center h-24 w-24 rounded-full text-3xl font-bold ${
            pct >= 80 ? 'bg-emerald-100 text-emerald-700' : pct >= 50 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
          }`}>
            {pct}%
          </div>
          <h2 className="text-2xl font-bold mt-4">
            {pct >= 80 ? 'Excellent!' : pct >= 60 ? 'Good Job!' : pct >= 40 ? 'Not Bad!' : 'Keep Going!'}
          </h2>
          <p className="text-muted-foreground mt-1">
            {score}/{questions.length} correct · {mode.name}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 max-w-xs mx-auto">
          <Card>
            <CardContent className="pt-4 pb-3 text-center">
              <Target className="h-5 w-5 mx-auto text-primary mb-1" />
              <p className="text-lg font-bold">{score}</p>
              <p className="text-xs text-muted-foreground">Correct</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 text-center">
              <Flame className="h-5 w-5 mx-auto text-orange-500 mb-1" />
              <p className="text-lg font-bold">{bestStreak}</p>
              <p className="text-xs text-muted-foreground">Best Streak</p>
            </CardContent>
          </Card>
        </div>

        <div className="flex gap-3 justify-center">
          <Button onClick={startQuiz} className="gap-2">
            <RotateCcw className="h-4 w-4" />
            Play Again
          </Button>
          <Button variant="outline" onClick={() => setSection('menu')}>
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium">
            {currentIndex + 1}/{questions.length}
          </span>
          {streak > 1 && (
            <span className="flex items-center gap-1 text-xs text-orange-600 font-medium">
              <Flame className="h-3.5 w-3.5" />
              {streak} streak
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium">{score} pts</span>
          {mode.timed && !revealed && (
            <span className={`flex items-center gap-1 text-sm font-mono ${
              questionTimer <= 5 ? 'text-red-600 font-bold' : ''
            }`}>
              <Clock className="h-4 w-4" />
              {questionTimer}s
            </span>
          )}
        </div>
      </div>

      {/* Progress */}
      <div className="flex gap-1">
        {questions.map((_, i) => (
          <div
            key={i}
            className={`h-1.5 flex-1 rounded-full ${
              i < currentIndex
                ? 'bg-primary'
                : i === currentIndex
                ? 'bg-primary/60'
                : 'bg-muted'
            }`}
          />
        ))}
      </div>

      {/* Question */}
      <Card className="border-2">
        <CardHeader>
          <CardTitle className="text-lg leading-relaxed">{q.question}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {q.options.map((option, i) => {
            let style = 'bg-muted/50 hover:bg-muted border-transparent';
            if (revealed) {
              if (i === q.correct) {
                style = 'bg-emerald-50 border-emerald-500 text-emerald-900';
              } else if (i === selected && i !== q.correct) {
                style = 'bg-red-50 border-red-500 text-red-900';
              } else {
                style = 'bg-muted/30 border-transparent opacity-60';
              }
            } else if (i === selected) {
              style = 'bg-primary/10 border-primary';
            }

            return (
              <button
                key={i}
                onClick={() => handleSelect(i)}
                disabled={revealed}
                className={`w-full text-left p-4 rounded-lg border-2 transition-all text-sm ${style}`}
              >
                <div className="flex items-center justify-between">
                  {option}
                  {revealed && i === q.correct && (
                    <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                  )}
                  {revealed && i === selected && i !== q.correct && (
                    <XCircle className="h-5 w-5 text-red-600 shrink-0" />
                  )}
                </div>
              </button>
            );
          })}
        </CardContent>
      </Card>

      {/* Explanation */}
      {revealed && (
        <div className="animate-fade-in bg-muted/50 rounded-lg p-4 text-sm">
          <p className="font-medium mb-1">
            {selected === q.correct ? '✓ Correct!' : '✗ Incorrect'}
          </p>
          <p className="text-muted-foreground">{q.explanation}</p>
        </div>
      )}

      {/* Next */}
      {revealed && (
        <div className="flex justify-end">
          <Button onClick={nextQuestion} className="gap-1">
            {currentIndex < questions.length - 1 ? 'Next Question' : 'See Results'}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
