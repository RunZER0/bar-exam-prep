'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { getUnitById } from '@/lib/constants/legal-content';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import {
  ArrowLeft,
  ArrowRight,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  BarChart3,
  RotateCcw,
} from 'lucide-react';

interface Question {
  id: string;
  type: 'multiple_choice' | 'essay';
  question: string;
  options?: string[];
  topic: string;
}

interface Answer {
  questionId: string;
  answer: string;
}

interface ExamResult {
  score: number;
  total: number;
  feedback: { questionId: string; correct: boolean; explanation: string }[];
}

const EXAM_CONFIG: Record<string, { questions: number; time: number }> = {
  beginner: { questions: 15, time: 30 },
  intermediate: { questions: 25, time: 60 },
  advanced: { questions: 40, time: 90 },
};

export default function ExamSessionPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { getIdToken } = useAuth();

  const unitId = params.unitId as string;
  const difficulty = searchParams.get('difficulty') || 'intermediate';
  const unit = getUnitById(unitId);
  const config = EXAM_CONFIG[difficulty] || EXAM_CONFIG.intermediate;

  const [phase, setPhase] = useState<'loading' | 'exam' | 'submitting' | 'results'>('loading');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(config.time * 60); // seconds
  const [result, setResult] = useState<ExamResult | null>(null);
  const [error, setError] = useState('');

  // Generate exam questions via AI
  useEffect(() => {
    async function generateExam() {
      if (!unit) return;
      try {
        const token = await getIdToken();
        const res = await fetch('/api/ai/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            message: `Generate a ${difficulty} level exam for ${unit.name} with ${config.questions} questions. 
            
Format your response as a valid JSON array with this exact structure:
[
  {
    "id": "q1",
    "type": "multiple_choice",
    "question": "Question text here",
    "options": ["A) option 1", "B) option 2", "C) option 3", "D) option 4"],
    "topic": "${unit.name}"
  }
]

Rules:
- Include ${Math.floor(config.questions * 0.7)} multiple choice questions and ${Math.ceil(config.questions * 0.3)} essay questions
- Essay questions should have "type": "essay" and no "options" field
- All questions must be based on Kenyan law and the ${unit.name} curriculum
- Reference specific statutes: ${unit.statutes.join(', ')}
- Questions should test practical application, not just recall
- Output ONLY the JSON array, nothing else`,
            competencyType: 'research',
            context: {
              topicArea: unit.name,
              examGeneration: true,
            },
          }),
        });

        if (!res.ok) throw new Error('Failed to generate exam');

        const data = await res.json();
        // Try to parse the AI response as JSON
        let parsed: Question[];
        try {
          const content = data.response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
          parsed = JSON.parse(content);
        } catch {
          // Fallback: generate basic questions
          parsed = Array.from({ length: config.questions }, (_, i) => ({
            id: `q${i + 1}`,
            type: i < Math.floor(config.questions * 0.7) ? 'multiple_choice' as const : 'essay' as const,
            question: `Question ${i + 1} for ${unit.name} (${difficulty} level) — This question could not be generated. Please try again.`,
            options: i < Math.floor(config.questions * 0.7)
              ? ['A) Option 1', 'B) Option 2', 'C) Option 3', 'D) Option 4']
              : undefined,
            topic: unit.name,
          }));
        }

        setQuestions(parsed);
        setPhase('exam');
      } catch (err) {
        setError('Failed to generate exam. Please try again.');
      }
    }

    generateExam();
  }, [unit, difficulty, config.questions, getIdToken]);

  // Countdown timer
  useEffect(() => {
    if (phase !== 'exam') return;
    if (timeLeft <= 0) {
      handleSubmit();
      return;
    }
    const interval = setInterval(() => setTimeLeft((t) => t - 1), 1000);
    return () => clearInterval(interval);
  }, [phase, timeLeft]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const currentQ = questions[currentIndex];
  const answeredCount = Object.keys(answers).length;

  const handleSubmit = useCallback(async () => {
    setPhase('submitting');
    try {
      const token = await getIdToken();
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          message: `Grade this exam. Here are the questions and student answers:

${questions.map((q, i) => `
Question ${i + 1} (${q.type}): ${q.question}
${q.options ? `Options: ${q.options.join(', ')}` : ''}
Student Answer: ${answers[q.id] || '(not answered)'}
`).join('\n')}

Respond with ONLY a valid JSON object:
{
  "score": <number of correct answers>,
  "total": ${questions.length},
  "feedback": [
    {
      "questionId": "q1",
      "correct": true/false,
      "explanation": "Brief explanation of the correct answer"
    }
  ]
}

For essay questions, grade on a pass/fail basis based on legal accuracy and completeness.
Output ONLY the JSON, nothing else.`,
          competencyType: 'research',
          context: {
            topicArea: unit?.name,
            examGrading: true,
          },
        }),
      });

      if (!res.ok) throw new Error('Grading failed');

      const data = await res.json();
      try {
        const content = data.response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const graded = JSON.parse(content);
        setResult(graded);
      } catch {
        setResult({
          score: 0,
          total: questions.length,
          feedback: questions.map((q) => ({
            questionId: q.id,
            correct: false,
            explanation: 'Grading could not be completed automatically. Review your answers manually.',
          })),
        });
      }
      setPhase('results');
    } catch {
      setError('Failed to grade exam. Please try again.');
      setPhase('exam');
    }
  }, [answers, questions, unit, getIdToken]);

  if (!unit) {
    return (
      <div className="p-6 md:p-10 max-w-4xl mx-auto">
        <Button variant="ghost" size="sm" onClick={() => router.push('/exams')}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        <p className="text-center py-20 text-muted-foreground">Unit not found.</p>
      </div>
    );
  }

  // Loading state
  if (phase === 'loading') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <div className="text-center">
          <p className="font-medium">Generating your exam…</p>
          <p className="text-sm text-muted-foreground mt-1">
            {unit.name} · {difficulty} level · {config.questions} questions
          </p>
        </div>
        {error && (
          <div className="text-center">
            <p className="text-sm text-destructive">{error}</p>
            <Button variant="outline" size="sm" className="mt-2" onClick={() => router.push('/exams')}>
              Go Back
            </Button>
          </div>
        )}
      </div>
    );
  }

  // Submitting
  if (phase === 'submitting') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="font-medium">Grading your exam…</p>
      </div>
    );
  }

  // Results
  if (phase === 'results' && result) {
    const pct = Math.round((result.score / result.total) * 100);
    return (
      <div className="p-6 md:p-10 max-w-4xl mx-auto space-y-8">
        <Button variant="ghost" size="sm" onClick={() => router.push('/exams')}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to Exams
        </Button>

        <div className="text-center">
          <div className={`inline-flex items-center justify-center h-20 w-20 rounded-full text-2xl font-bold ${
            pct >= 70 ? 'bg-emerald-100 text-emerald-700' : pct >= 50 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
          }`}>
            {pct}%
          </div>
          <h2 className="text-xl font-bold mt-4">
            {pct >= 70 ? 'Well Done!' : pct >= 50 ? 'Good Effort' : 'Keep Practicing'}
          </h2>
          <p className="text-muted-foreground mt-1">
            {result.score}/{result.total} correct · {unit.name} · {difficulty}
          </p>
        </div>

        <div className="space-y-4">
          <h3 className="font-semibold flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Question Review
          </h3>
          {questions.map((q, i) => {
            const fb = result.feedback.find((f) => f.questionId === q.id);
            return (
              <Card key={q.id} className={`border-l-4 ${fb?.correct ? 'border-l-emerald-500' : 'border-l-red-500'}`}>
                <CardHeader className="pb-2">
                  <div className="flex items-start gap-2">
                    {fb?.correct ? (
                      <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <CardTitle className="text-sm">Q{i + 1}. {q.question}</CardTitle>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="text-sm space-y-2">
                  <p>
                    <span className="font-medium">Your answer:</span>{' '}
                    {answers[q.id] || <span className="text-muted-foreground italic">Not answered</span>}
                  </p>
                  {fb?.explanation && (
                    <p className="text-muted-foreground bg-muted/50 p-3 rounded-lg">
                      {fb.explanation}
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="flex gap-3">
          <Button onClick={() => router.push('/exams')}>
            <RotateCcw className="h-4 w-4 mr-2" />
            Take Another Exam
          </Button>
          <Button variant="outline" onClick={() => router.push('/dashboard')}>
            Dashboard
          </Button>
        </div>
      </div>
    );
  }

  // Exam in progress
  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] md:h-screen">
      {/* Top bar with timer */}
      <div className="border-b px-4 md:px-6 py-3 flex items-center justify-between shrink-0 bg-card">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              if (confirm('Are you sure? Your progress will be lost.')) {
                router.push('/exams');
              }
            }}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <p className="text-sm font-semibold">{unit.name}</p>
            <p className="text-xs text-muted-foreground capitalize">{difficulty} Exam</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs text-muted-foreground">
            {answeredCount}/{questions.length} answered
          </span>
          <div className={`flex items-center gap-1 text-sm font-mono font-semibold ${
            timeLeft < 300 ? 'text-red-600' : timeLeft < 600 ? 'text-amber-600' : ''
          }`}>
            <Clock className="h-4 w-4" />
            {formatTime(timeLeft)}
          </div>
        </div>
      </div>

      {/* Question */}
      <div className="flex-1 overflow-y-auto p-6 md:p-10">
        <div className="max-w-3xl mx-auto space-y-6">
          {/* Progress bar */}
          <div className="flex gap-1">
            {questions.map((q, i) => (
              <button
                key={q.id}
                onClick={() => setCurrentIndex(i)}
                className={`h-2 flex-1 rounded-full transition-colors ${
                  i === currentIndex
                    ? 'bg-primary'
                    : answers[q.id]
                    ? 'bg-primary/40'
                    : 'bg-muted'
                }`}
              />
            ))}
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              Question {currentIndex + 1} of {questions.length}
            </span>
            <span className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground capitalize">
              {currentQ?.type.replace('_', ' ')}
            </span>
          </div>

          <h2 className="text-lg font-semibold leading-relaxed">
            {currentQ?.question}
          </h2>

          {/* MCQ options */}
          {currentQ?.type === 'multiple_choice' && currentQ.options && (
            <div className="space-y-2">
              {currentQ.options.map((option, i) => {
                const isSelected = answers[currentQ.id] === option;
                return (
                  <button
                    key={i}
                    onClick={() =>
                      setAnswers((prev) => ({ ...prev, [currentQ.id]: option }))
                    }
                    className={`w-full text-left p-4 rounded-lg border-2 transition-all text-sm ${
                      isSelected
                        ? 'border-primary bg-primary/5 font-medium'
                        : 'border-transparent bg-muted/50 hover:bg-muted'
                    }`}
                  >
                    {option}
                  </button>
                );
              })}
            </div>
          )}

          {/* Essay answer */}
          {currentQ?.type === 'essay' && (
            <Textarea
              placeholder="Write your answer here…"
              value={answers[currentQ.id] || ''}
              onChange={(e) =>
                setAnswers((prev) => ({ ...prev, [currentQ.id]: e.target.value }))
              }
              rows={8}
              className="resize-none"
            />
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between pt-4">
            <Button
              variant="outline"
              disabled={currentIndex === 0}
              onClick={() => setCurrentIndex((i) => i - 1)}
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Previous
            </Button>

            {currentIndex < questions.length - 1 ? (
              <Button onClick={() => setCurrentIndex((i) => i + 1)}>
                Next
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <Button
                onClick={() => {
                  if (answeredCount < questions.length) {
                    if (!confirm(`You've answered ${answeredCount}/${questions.length} questions. Submit anyway?`)) {
                      return;
                    }
                  }
                  handleSubmit();
                }}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                Submit Exam
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
