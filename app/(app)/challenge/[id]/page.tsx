'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import EngagingLoader from '@/components/EngagingLoader';
import {
  ArrowLeft, Loader2, Trophy, Send, Clock, BookOpen,
  Zap, Target, FileText, Search, Shield, CheckCircle2,
  AlertTriangle, Star, Crown, Medal, Award, Users,
} from 'lucide-react';

const UNIT_NAMES: Record<string, string> = {
  'atp-100': 'Civil Litigation', 'atp-101': 'Criminal Litigation',
  'atp-102': 'Probate and Administration', 'atp-103': 'Legal Writing and Drafting',
  'atp-104': 'Trial Advocacy', 'atp-105': 'Professional Ethics',
  'atp-106': 'Legal Practice Management', 'atp-107': 'Conveyancing',
  'atp-108': 'Commercial Transactions',
};

interface Question {
  question: string;
  type: 'mcq' | 'short_answer' | 'drafting';
  options?: string[];
  points?: number;
}

interface GradeResult {
  questionIndex: number;
  question: string;
  userAnswer: string;
  correct: boolean;
  pointsEarned: number;
  pointsPossible: number;
  feedback: string;
}

export default function ChallengePage() {
  const router = useRouter();
  const params = useParams();
  const challengeId = params.id as string;
  const { getIdToken } = useAuth();

  // Challenge data
  const [challenge, setChallenge] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Taking the challenge
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [results, setResults] = useState<{
    totalScore: number;
    totalPossible: number;
    percentage: number;
    results: GradeResult[];
  } | null>(null);
  const [alreadyCompleted, setAlreadyCompleted] = useState(false);

  // Timer
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [timerActive, setTimerActive] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Anti-cheat
  const [tabSwitches, setTabSwitches] = useState(0);
  const [warningShown, setWarningShown] = useState(false);
  const startTimeRef = useRef<number>(0);

  const apiFetch = useCallback(async (url: string, opts: RequestInit = {}) => {
    const token = await getIdToken();
    return fetch(url, {
      ...opts,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...opts.headers },
    });
  }, [getIdToken]);

  // Load challenge data
  useEffect(() => {
    const loadChallenge = async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      try {
        const res = await apiFetch(`/api/community/events?eventId=${challengeId}`, { signal: controller.signal });
        if (!res.ok) throw new Error('Failed to load');
        const data = await res.json();
        const allEvents = [...(data.events || []), ...(data.aiChallenges || []), ...(data.communityChallenges || [])];
        const found = allEvents.find((e: any) => e.id === challengeId) || null;
        if (!found) {
          setError('Challenge not found');
          return;
        }
        setChallenge(found);

        // Check if already completed
        if (found.hasCompleted) {
          setAlreadyCompleted(true);
        }
        
        // Auto-join if not joined
        if (!found.isJoined && !found.hasCompleted) {
          await apiFetch('/api/community/events', {
            method: 'POST',
            body: JSON.stringify({ action: 'join', eventId: challengeId }),
          });
        }

        // Start timer if not completed
        if (!found.hasCompleted) {
          startTimeRef.current = Date.now();
          setTimerActive(true);
        }
      } catch {
        setError('Failed to load challenge');
      } finally {
        clearTimeout(timeout);
        setLoading(false);
      }
    };
    loadChallenge();
  }, [challengeId, apiFetch]);

  // Timer
  useEffect(() => {
    if (timerActive) {
      timerRef.current = setInterval(() => {
        setTimeElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }, 1000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [timerActive]);

  // Anti-cheat: tab visibility change tracking
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden && timerActive && !results) {
        setTabSwitches(prev => {
          const next = prev + 1;
          if (next >= 3 && !warningShown) {
            setWarningShown(true);
          }
          return next;
        });
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [timerActive, results, warningShown]);

  // Prevent context menu / right-click during active challenge
  useEffect(() => {
    const handler = (e: Event) => {
      if (timerActive && !results) e.preventDefault();
    };
    document.addEventListener('contextmenu', handler);
    return () => document.removeEventListener('contextmenu', handler);
  }, [timerActive, results]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const submitAnswers = async () => {
    if (submitting || alreadyCompleted) return;
    
    const questions = (challenge?.challengeContent || []) as Question[];
    const answeredCount = Object.keys(answers).length;
    if (answeredCount === 0) return;
    
    // Confirmation if not all answered
    if (answeredCount < questions.length) {
      if (!confirm(`You answered ${answeredCount}/${questions.length} questions. Submit anyway?`)) return;
    }

    setSubmitting(true);
    setTimerActive(false);
    try {
      const res = await apiFetch('/api/community/events', {
        method: 'POST',
        body: JSON.stringify({
          action: 'grade',
          eventId: challengeId,
          answers,
          metadata: {
            timeSpent: timeElapsed,
            tabSwitches,
          },
        }),
      });
      const data = await res.json();
      if (data.alreadyGraded) {
        setAlreadyCompleted(true);
        setResults({
          totalScore: data.previousScore,
          totalPossible: 50,
          percentage: Math.round((data.previousScore / 50) * 100),
          results: [],
        });
      } else if (data.success) {
        setResults({
          totalScore: data.totalScore,
          totalPossible: data.totalPossible,
          percentage: data.percentage,
          results: data.results || [],
        });
      } else {
        alert(data.error || 'Failed to submit');
      }
    } catch {
      alert('Failed to submit answers. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // --- RENDER ---

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-3.5rem)] bg-background">
        <EngagingLoader size="md" showFacts={false} message="Loading challenge assessment..." />
      </div>
    );
  }

  if (error || !challenge) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-3.5rem)] bg-background gap-4">
        <AlertTriangle className="h-8 w-8 text-muted-foreground/30" />
        <p className="text-muted-foreground">{error || 'Challenge not found'}</p>
        <button
          onClick={() => router.push('/community')}
          className="px-4 py-2 rounded-xl bg-primary/10 text-primary text-sm font-medium hover:bg-primary/15"
        >
          Back to Community
        </button>
      </div>
    );
  }

  const questions = (challenge.challengeContent || []) as Question[];
  const typeLabels: Record<string, string> = {
    trivia: 'Multiple Choice', drafting: 'Drafting', research: 'Short Answer',
    reading: 'Reading', quiz_marathon: 'Quiz Marathon',
  };
  const typeIcons: Record<string, typeof Zap> = {
    trivia: Zap, reading: BookOpen, quiz_marathon: Target, drafting: FileText, research: Search,
  };
  const TypeIcon = typeIcons[challenge.type] || Zap;
  const totalPossiblePoints = questions.reduce((sum: number, q: Question) => sum + (q.points || 10), 0);

  return (
    <div className="min-h-[calc(100vh-3.5rem)] md:min-h-screen bg-background">
      {/* Anti-cheat warning */}
      {warningShown && !results && (
        <div className="sticky top-0 z-50 bg-red-500/10 border-b border-red-500/20 px-4 py-2">
          <div className="max-w-3xl mx-auto flex items-center gap-2 text-red-600 dark:text-red-400">
            <Shield className="h-4 w-4 shrink-0" />
            <p className="text-xs font-medium">
              You&apos;ve switched tabs {tabSwitches} times. This is being recorded. Focus on the challenge!
            </p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="sticky top-0 z-40 border-b border-border/20 bg-background/95 backdrop-blur-sm">
        <div className="max-w-3xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <button
                onClick={() => router.push('/community')}
                className="p-2 rounded-xl hover:bg-muted/40 transition-colors shrink-0"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <TypeIcon className="h-4 w-4 text-primary shrink-0" />
                  <h1 className="text-sm font-semibold truncate">{challenge.title}</h1>
                </div>
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                  <span className="px-1.5 py-0.5 rounded-md bg-primary/10 text-primary font-medium">
                    {typeLabels[challenge.type] || challenge.type}
                  </span>
                  {challenge.unitId && UNIT_NAMES[challenge.unitId] && (
                    <span>{UNIT_NAMES[challenge.unitId]}</span>
                  )}
                  <span>{questions.length} questions · {totalPossiblePoints} pts</span>
                </div>
              </div>
            </div>

            {/* Timer + anti-cheat */}
            <div className="flex items-center gap-2 shrink-0">
              {tabSwitches > 0 && !results && (
                <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-red-500/10 text-red-500 text-[10px] font-medium">
                  <Shield className="h-3 w-3" />
                  {tabSwitches}
                </div>
              )}
              {!results && (
                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-mono font-medium ${
                  timerActive ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                }`}>
                  <Clock className="h-3.5 w-3.5" />
                  {formatTime(timeElapsed)}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto p-4 md:p-6">
        {/* ===== ALREADY COMPLETED STATE ===== */}
        {alreadyCompleted && !results && (
          <div className="text-center py-16 space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center mx-auto">
              <CheckCircle2 className="h-8 w-8 text-emerald-500" />
            </div>
            <h2 className="text-lg font-bold">Already Completed</h2>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              You&apos;ve already submitted answers for this challenge. Each challenge can only be taken once.
            </p>
            {challenge.userScore != null && (
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500/10 text-amber-600 font-medium text-sm">
                <Star className="h-4 w-4" />
                You scored {challenge.userScore} points
              </div>
            )}
            <div>
              <button
                onClick={() => router.push('/community')}
                className="px-6 py-2.5 rounded-xl bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90"
              >
                Back to Challenges
              </button>
            </div>
          </div>
        )}

        {/* ===== RESULTS VIEW ===== */}
        {results && (
          <div className="space-y-6 animate-fade-in">
            {/* Score card */}
            <div className="text-center py-8 space-y-4">
              <div className={`w-20 h-20 rounded-full mx-auto flex items-center justify-center ${
                results.percentage >= 70 ? 'bg-emerald-500/15' : results.percentage >= 40 ? 'bg-amber-500/15' : 'bg-red-500/15'
              }`}>
                <span className={`text-2xl font-bold ${
                  results.percentage >= 70 ? 'text-emerald-500' : results.percentage >= 40 ? 'text-amber-500' : 'text-red-500'
                }`}>
                  {results.percentage}%
                </span>
              </div>
              <div>
                <h2 className="text-xl font-bold">
                  {results.percentage >= 70 ? 'Excellent Work!' : results.percentage >= 40 ? 'Good Attempt!' : 'Keep Practicing!'}
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  You scored <span className="font-semibold text-foreground">{results.totalScore}</span> out of {results.totalPossible} points
                </p>
              </div>
              <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {formatTime(timeElapsed)}</span>
                <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {challenge.participantCount} participants</span>
              </div>
              <p className="text-[11px] text-primary font-medium">
                +{results.totalScore} points added to your weekly ranking
              </p>
            </div>

            {/* Per-question breakdown */}
            {results.results.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Question Breakdown
                </h3>
                {results.results.map((r, i) => (
                  <div
                    key={i}
                    className={`rounded-xl border p-4 space-y-2 ${
                      r.correct
                        ? 'bg-emerald-500/5 border-emerald-500/20'
                        : 'bg-red-500/5 border-red-500/20'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                          r.correct ? 'bg-emerald-500/20 text-emerald-600' : 'bg-red-500/20 text-red-600'
                        }`}>
                          {r.correct ? '✓' : '✗'}
                        </span>
                        <p className="text-xs font-medium">Q{i + 1}. {r.question}</p>
                      </div>
                      <span className={`text-xs font-bold ${r.correct ? 'text-emerald-500' : 'text-red-500'}`}>
                        {r.pointsEarned}/{r.pointsPossible}
                      </span>
                    </div>
                    {r.userAnswer && (
                      <p className="text-[11px] text-muted-foreground pl-8">
                        <span className="font-medium">Your answer:</span> {r.userAnswer}
                      </p>
                    )}
                    <p className="text-[11px] pl-8 text-muted-foreground">{r.feedback}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Back button */}
            <div className="flex justify-center gap-3 pt-4">
              <button
                onClick={() => router.push('/community')}
                className="px-6 py-2.5 rounded-xl bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90"
              >
                Back to Challenges
              </button>
            </div>
          </div>
        )}

        {/* ===== QUESTION FORM ===== */}
        {!results && !alreadyCompleted && (
          <div className="space-y-4">
            {/* Challenge description */}
            <div className="p-4 rounded-xl bg-card/40 border border-border/20 space-y-2">
              <p className="text-sm text-muted-foreground">{challenge.description}</p>
              <div className="flex items-center gap-3 text-[10px] text-muted-foreground pt-1">
                <span className="flex items-center gap-1">
                  <Shield className="h-3 w-3" />
                  One attempt only — answers are final
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Time tracked
                </span>
              </div>
            </div>

            {/* Questions */}
            {questions.length === 0 ? (
              <div className="text-center py-12 space-y-3">
                <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary/40" />
                <p className="text-sm text-muted-foreground">Questions are loading. Refresh in a moment.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {questions.map((q: Question, qi: number) => (
                  <div
                    key={qi}
                    className="rounded-xl border border-border/20 bg-card/50 p-4 space-y-3 transition-all"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2">
                        <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                          {qi + 1}
                        </span>
                        <p className="text-sm font-medium leading-relaxed">{q.question}</p>
                      </div>
                      <span className="text-[10px] text-muted-foreground font-medium shrink-0 px-2 py-0.5 bg-muted rounded-full">
                        {q.points || 10} pts
                      </span>
                    </div>

                    {/* MCQ */}
                    {q.type === 'mcq' && q.options && (
                      <div className="space-y-1.5 pl-8">
                        {q.options.map((opt: string, oi: number) => {
                          const letter = String.fromCharCode(65 + oi);
                          const selected = (answers[qi] || '') === letter;
                          return (
                            <button
                              key={oi}
                              onClick={() => setAnswers(prev => ({ ...prev, [qi]: letter }))}
                              className={`w-full text-left text-sm px-3 py-2.5 rounded-xl transition-all ${
                                selected
                                  ? 'bg-primary/10 text-primary font-medium border-2 border-primary/30 shadow-sm'
                                  : 'bg-muted/20 text-muted-foreground hover:bg-muted/40 border-2 border-transparent'
                              }`}
                            >
                              <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full mr-2 text-xs font-bold ${
                                selected ? 'bg-primary text-primary-foreground' : 'bg-muted'
                              }`}>
                                {letter}
                              </span>
                              {opt}
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {/* Short answer */}
                    {(q.type === 'short_answer') && (
                      <div className="pl-8">
                        <textarea
                          value={answers[qi] || ''}
                          onChange={e => setAnswers(prev => ({ ...prev, [qi]: e.target.value }))}
                          placeholder="Write your answer here..."
                          rows={3}
                          className="w-full text-sm px-3 py-2.5 rounded-xl bg-background border border-border/30 placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 resize-none transition-colors"
                        />
                      </div>
                    )}

                    {/* Drafting */}
                    {q.type === 'drafting' && (
                      <div className="pl-8">
                        <textarea
                          value={answers[qi] || ''}
                          onChange={e => setAnswers(prev => ({ ...prev, [qi]: e.target.value }))}
                          placeholder="Draft your legal document here..."
                          rows={6}
                          className="w-full text-sm px-3 py-2.5 rounded-xl bg-background border border-border/30 placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 resize-none transition-colors font-mono"
                        />
                      </div>
                    )}

                    {/* Answered indicator */}
                    {answers[qi] && (
                      <div className="pl-8 flex items-center gap-1 text-[10px] text-emerald-500 font-medium">
                        <CheckCircle2 className="h-3 w-3" />
                        Answered
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Submit bar */}
            {questions.length > 0 && (
              <div className="sticky bottom-0 bg-background/95 backdrop-blur-sm border-t border-border/20 -mx-4 md:-mx-6 px-4 md:px-6 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">
                      {Object.keys(answers).length}/{questions.length}
                    </span>
                    {' '}answered
                  </div>
                  <button
                    onClick={submitAnswers}
                    disabled={submitting || Object.keys(answers).length === 0}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 disabled:opacity-40 transition-colors"
                  >
                    {submitting ? (
                      <><Loader2 className="h-4 w-4 animate-spin" /> Grading...</>
                    ) : (
                      <><Send className="h-4 w-4" /> Submit Answers</>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
