'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { getUnitById } from '@/lib/constants/legal-content';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import {
  ArrowLeft, ArrowRight, Clock, CheckCircle2, XCircle, Loader2, BarChart3,
  RotateCcw, BookOpen, Lightbulb, ChevronDown, ChevronUp, Trophy, Target,
  Brain, TrendingUp, AlertTriangle, Sparkles, GraduationCap, FileText,
} from 'lucide-react';

// ============================================================
// TYPES
// ============================================================

type ExamType = 'abcd' | 'cle';
type PaperSize = 'mini' | 'semi' | 'full';

interface Question {
  id: string;
  question: string;
  options?: string[];
  marks: number;
  topic?: string;
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

const PAPER_CONFIG: Record<ExamType, Record<PaperSize, { marks: number; questions: number; time: number }>> = {
  abcd: {
    mini: { marks: 15, questions: 15, time: 20 },
    semi: { marks: 30, questions: 30, time: 40 },
    full: { marks: 60, questions: 60, time: 90 },
  },
  cle: {
    mini: { marks: 15, questions: 2, time: 30 },
    semi: { marks: 30, questions: 4, time: 60 },
    full: { marks: 60, questions: 6, time: 180 },
  },
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

  const unitId = params.unitId as string;
  const examType = (searchParams.get('type') || 'abcd') as ExamType;
  const paperSize = (searchParams.get('paper') || 'semi') as PaperSize;
  
  const unit = getUnitById(unitId);
  const config = PAPER_CONFIG[examType]?.[paperSize] || PAPER_CONFIG.abcd.semi;

  const [phase, setPhase] = useState<'loading' | 'exam' | 'submitting' | 'results'>('loading');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(config.time * 60);
  const [result, setResult] = useState<ExamResult | null>(null);
  const [error, setError] = useState('');
  const [expandedFeedback, setExpandedFeedback] = useState<string | null>(null);

  // Generate exam questions
  useEffect(() => {
    async function generateExam() {
      if (!unit) return;
      try {
        const token = await getIdToken();
        
        const marksPerQuestion = examType === 'abcd' ? 1 : Math.floor(config.marks / config.questions);
        
        const prompt = examType === 'abcd'
          ? `Generate ${config.questions} multiple choice questions for a ${paperSize} paper exam on ${unit.name} (Kenyan Law).

Format as JSON array:
[
  {
    "id": "q1",
    "question": "Question text?",
    "options": ["A) option1", "B) option2", "C) option3", "D) option4"],
    "marks": 1,
    "topic": "Sub-topic name"
  }
]

Rules:
- Each question worth 1 mark
- Reference Kenyan statutes: ${unit.statutes.join(', ')}
- Mix difficulty levels (easy, medium, hard)
- Cover different sub-topics of ${unit.name}
- Output ONLY valid JSON array`
          : `Generate ${config.questions} essay/problem questions for a CLE standard ${paperSize} paper exam on ${unit.name} (Kenyan Law).

Format as JSON array:
[
  {
    "id": "q1",
    "question": "Problem/essay question text requiring detailed legal analysis...",
    "marks": ${marksPerQuestion},
    "topic": "Sub-topic name"
  }
]

Rules:
- Questions should require IRAC analysis
- Include hypothetical scenarios where applicable
- Reference Kenyan statutes: ${unit.statutes.join(', ')}
- Questions should test application, analysis, and legal writing
- Each question worth ${marksPerQuestion} marks
- Total marks: ${config.marks}
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

        if (!res.ok) throw new Error('Failed to generate exam');

        const data = await res.json();
        let parsed: Question[];
        
        try {
          const content = data.response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
          parsed = JSON.parse(content);
        } catch {
          // Fallback questions
          const marksPerQ = examType === 'abcd' ? 1 : Math.floor(config.marks / config.questions);
          parsed = Array.from({ length: config.questions }, (_, i) => ({
            id: `q${i + 1}`,
            question: `Question ${i + 1} for ${unit.name}. (Question generation failed - please try again)`,
            options: examType === 'abcd' ? ['A) Option 1', 'B) Option 2', 'C) Option 3', 'D) Option 4'] : undefined,
            marks: marksPerQ,
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
  }, [unit, examType, paperSize, config, getIdToken]);

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
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) {
      return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const currentQ = questions[currentIndex];
  const answeredCount = Object.keys(answers).length;

  const handleSubmit = useCallback(async () => {
    setPhase('submitting');
    try {
      const token = await getIdToken();

      const gradingPrompt = examType === 'abcd'
        ? `Grade this multiple choice exam on ${unit?.name}. 

Questions and answers:
${questions.map((q, i) => `
Q${i + 1} (${q.marks} mark): ${q.question}
Options: ${q.options?.join(', ')}
Student answered: ${answers[q.id] || '(not answered)'}
`).join('\n')}

Respond with ONLY valid JSON:
{
  "score": <total marks earned>,
  "totalMarks": ${config.marks},
  "percentage": <percentage>,
  "overallFeedback": "General feedback on performance",
  "feedback": [
    {
      "questionId": "q1",
      "correct": true/false,
      "score": 0 or 1,
      "maxScore": 1,
      "explanation": "Why correct/incorrect",
      "correctAnswer": "The correct option"
    }
  ],
  "challengingConcepts": [
    {
      "topic": "Topic student struggled with",
      "description": "Brief explanation of the concept",
      "studyResources": ["Resource 1", "Resource 2"]
    }
  ]
}`
        : `Grade this CLE standard essay exam on ${unit?.name} using detailed rubric grading.

Questions and answers:
${questions.map((q, i) => `
Q${i + 1} (${q.marks} marks): ${q.question}
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

      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          message: gradingPrompt,
          competencyType: 'research',
          context: {
            topicArea: unit?.name,
            examGrading: true,
            examType,
          },
        }),
      });

      if (!res.ok) throw new Error('Grading failed');

      const data = await res.json();
      try {
        const content = data.response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const graded = JSON.parse(content);
        graded.grade = getGrade(graded.percentage);
        setResult(graded);
      } catch {
        setResult({
          score: 0,
          totalMarks: config.marks,
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
    } catch {
      setError('Failed to grade exam. Please try again.');
      setPhase('exam');
    }
  }, [answers, questions, unit, config, examType, getIdToken]);

  // ============================================================
  // RENDER: Not found
  // ============================================================
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

  // ============================================================
  // RENDER: Loading
  // ============================================================
  if (phase === 'loading') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="relative">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <div className="absolute inset-0 flex items-center justify-center">
            <Sparkles className="h-5 w-5 text-primary animate-pulse" />
          </div>
        </div>
        <div className="text-center">
          <p className="font-medium text-lg">Generating your exam…</p>
          <p className="text-sm text-muted-foreground mt-1">
            {unit.name} · {examType === 'abcd' ? 'Multiple Choice' : 'CLE Standard'} · {config.questions} questions
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

  // ============================================================
  // RENDER: Submitting
  // ============================================================
  if (phase === 'submitting') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="relative">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <div className="absolute inset-0 flex items-center justify-center">
            <Brain className="h-5 w-5 text-primary animate-pulse" />
          </div>
        </div>
        <div className="text-center">
          <p className="font-medium text-lg">AI is grading your exam…</p>
          <p className="text-sm text-muted-foreground mt-1">
            {examType === 'cle' && 'Analyzing your answers using detailed rubric…'}
          </p>
        </div>
      </div>
    );
  }

  // ============================================================
  // RENDER: Results
  // ============================================================
  if (phase === 'results' && result) {
    const gradeColors: Record<string, string> = {
      A: 'from-emerald-500 to-green-600',
      B: 'from-blue-500 to-cyan-600',
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
              <span>{examType === 'abcd' ? 'ABCD' : 'CLE'} {paperSize.charAt(0).toUpperCase() + paperSize.slice(1)}</span>
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
              {result.percentage >= 70 ? '🎉 Excellent work!' : result.percentage >= 50 ? '💪 Good effort!' : '📚 Keep studying!'}
            </p>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-6 -mt-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <Card className="bg-card shadow-lg border-0">
              <CardContent className="pt-6 text-center">
                <Trophy className="h-6 w-6 mx-auto text-amber-500 mb-2" />
                <p className="text-2xl font-bold">{result.score}</p>
                <p className="text-xs text-muted-foreground">Marks Earned</p>
              </CardContent>
            </Card>
            <Card className="bg-card shadow-lg border-0">
              <CardContent className="pt-6 text-center">
                <Target className="h-6 w-6 mx-auto text-blue-500 mb-2" />
                <p className="text-2xl font-bold">{result.totalMarks}</p>
                <p className="text-xs text-muted-foreground">Total Marks</p>
              </CardContent>
            </Card>
            <Card className="bg-card shadow-lg border-0">
              <CardContent className="pt-6 text-center">
                <CheckCircle2 className="h-6 w-6 mx-auto text-emerald-500 mb-2" />
                <p className="text-2xl font-bold">{result.feedback.filter(f => f.correct).length}</p>
                <p className="text-xs text-muted-foreground">Correct</p>
              </CardContent>
            </Card>
            <Card className="bg-card shadow-lg border-0">
              <CardContent className="pt-6 text-center">
                <Brain className="h-6 w-6 mx-auto text-purple-500 mb-2" />
                <p className="text-2xl font-bold">{result.challengingConcepts?.length || 0}</p>
                <p className="text-xs text-muted-foreground">Areas to Study</p>
              </CardContent>
            </Card>
          </div>

          {/* Overall Feedback */}
          <Card className="mb-8 bg-card shadow-lg border-0">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                AI Feedback
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">{result.overallFeedback}</p>
            </CardContent>
          </Card>

          {/* Challenging Concepts - Tabs */}
          {result.challengingConcepts && result.challengingConcepts.length > 0 && (
            <Card className="mb-8 bg-gradient-to-br from-amber-500/10 to-orange-500/5 border-amber-500/20 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
                  <Lightbulb className="h-5 w-5" />
                  Concepts to Review
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4">
                  {result.challengingConcepts.map((concept, i) => (
                    <div key={i} className="p-4 rounded-xl bg-card border">
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-semibold">{concept.topic}</h4>
                          <p className="text-sm text-muted-foreground mt-1">{concept.description}</p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="gap-1 text-primary"
                          onClick={() => router.push(`/study/${unitId}`)}
                        >
                          <BookOpen className="h-4 w-4" />
                          Study
                        </Button>
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
              </CardContent>
            </Card>
          )}

          {/* Question Review */}
          <Card className="shadow-lg border-0">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Question Review
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {questions.map((q, i) => {
                const fb = result.feedback.find((f) => f.questionId === q.id);
                const isExpanded = expandedFeedback === q.id;
                const isCLE = examType === 'cle';

                return (
                  <div
                    key={q.id}
                    className={`rounded-xl border-2 overflow-hidden transition-all ${
                      fb?.correct ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-red-500/30 bg-red-500/5'
                    }`}
                  >
                    {/* Question Header */}
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

                    {/* Expanded Content */}
                    {isExpanded && (
                      <div className="px-4 pb-4 pt-0 border-t space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
                        {/* Student Answer */}
                        <div className="bg-muted/50 rounded-lg p-3 mt-4">
                          <p className="text-xs font-medium text-muted-foreground mb-1">Your Answer</p>
                          <p className="text-sm">{answers[q.id] || <span className="italic text-muted-foreground">Not answered</span>}</p>
                        </div>

                        {/* Correct Answer (MCQ) */}
                        {!isCLE && fb?.correctAnswer && (
                          <div className="bg-emerald-500/10 rounded-lg p-3">
                            <p className="text-xs font-medium text-emerald-600 mb-1">Correct Answer</p>
                            <p className="text-sm font-medium">{fb.correctAnswer}</p>
                          </div>
                        )}

                        {/* Rubric Breakdown (CLE) */}
                        {isCLE && fb?.rubricBreakdown && (
                          <div className="grid grid-cols-2 gap-3">
                            {Object.entries(fb.rubricBreakdown).map(([key, rubric]) => {
                              const percentage = (rubric.score / rubric.maxScore) * 100;
                              return (
                                <div key={key} className="bg-muted/30 rounded-lg p-3">
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
                        <div className="bg-blue-500/10 rounded-lg p-3">
                          <p className="text-xs font-medium text-blue-600 mb-1">Explanation</p>
                          <p className="text-sm text-muted-foreground">{fb?.explanation}</p>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex gap-4 mt-8">
            <Button onClick={() => router.push('/exams')} size="lg" className="flex-1 gap-2">
              <RotateCcw className="h-4 w-4" />
              Take Another Exam
            </Button>
            <Button variant="outline" size="lg" onClick={() => router.push('/dashboard')}>
              Dashboard
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================
  // RENDER: Exam in progress
  // ============================================================
  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] md:h-screen">
      {/* Top Bar */}
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
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold">{unit.name}</p>
              <span className={`text-xs px-2 py-0.5 rounded-full ${
                examType === 'abcd' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-blue-500/10 text-blue-600'
              }`}>
                {examType === 'abcd' ? 'ABCD' : 'CLE'}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">{paperSize.charAt(0).toUpperCase() + paperSize.slice(1)} Paper · {config.marks} marks</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs text-muted-foreground hidden sm:block">
            {answeredCount}/{questions.length} answered
          </span>
          <div className={`flex items-center gap-1.5 text-sm font-mono font-semibold px-3 py-1.5 rounded-lg ${
            timeLeft < 300 ? 'bg-red-500/10 text-red-600' : 
            timeLeft < 600 ? 'bg-amber-500/10 text-amber-600' : 
            'bg-muted'
          }`}>
            <Clock className="h-4 w-4" />
            {formatTime(timeLeft)}
          </div>
        </div>
      </div>

      {/* Question Area */}
      <div className="flex-1 overflow-y-auto p-6 md:p-10">
        <div className="max-w-3xl mx-auto space-y-6">
          {/* Progress Bar */}
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
                title={`Question ${i + 1}${answers[q.id] ? ' (answered)' : ''}`}
              />
            ))}
          </div>

          {/* Question Info */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium">
                Question {currentIndex + 1} of {questions.length}
              </span>
              {currentQ?.topic && (
                <span className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground">
                  {currentQ.topic}
                </span>
              )}
            </div>
            <span className="text-sm font-medium text-primary">
              {currentQ?.marks} {currentQ?.marks === 1 ? 'mark' : 'marks'}
            </span>
          </div>

          {/* Question Text */}
          <h2 className="text-lg md:text-xl font-semibold leading-relaxed">
            {currentQ?.question}
          </h2>

          {/* MCQ Options */}
          {examType === 'abcd' && currentQ?.options && (
            <div className="space-y-3">
              {currentQ.options.map((option, i) => {
                const isSelected = answers[currentQ.id] === option;
                return (
                  <button
                    key={i}
                    onClick={() => setAnswers((prev) => ({ ...prev, [currentQ.id]: option }))}
                    className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                      isSelected
                        ? 'border-primary bg-primary/5 shadow-sm'
                        : 'border-transparent bg-muted/50 hover:bg-muted hover:border-muted-foreground/20'
                    }`}
                  >
                    <span className={isSelected ? 'font-medium' : ''}>{option}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* CLE Text Area */}
          {examType === 'cle' && (
            <div className="space-y-2">
              <Textarea
                placeholder="Write your answer here using IRAC format where applicable…"
                value={answers[currentQ?.id] || ''}
                onChange={(e) => setAnswers((prev) => ({ ...prev, [currentQ.id]: e.target.value }))}
                rows={12}
                className="resize-none text-base leading-relaxed"
              />
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Use IRAC: Issue, Rule, Application, Conclusion</span>
                <span>{(answers[currentQ?.id] || '').length} characters</span>
              </div>
            </div>
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
                className="bg-emerald-600 hover:bg-emerald-700 gap-2"
              >
                <FileText className="h-4 w-4" />
                Submit Exam
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
