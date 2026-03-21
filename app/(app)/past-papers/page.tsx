'use client';

import { useState, useEffect, useCallback } from 'react';
import { ATP_UNITS } from '@/lib/constants/legal-content';
import { useAuth } from '@/contexts/AuthContext';
import {
  Gavel, Scale, FileText, Shield, Building, Briefcase, Users, BookOpen,
  Building2, Handshake, Calculator, PenTool, ArrowLeft, ChevronRight,
  Search, Filter, BarChart3, Eye, Sparkles, Loader2, X, TrendingUp,
  Calendar, Hash, ChevronDown, AlertCircle, CheckCircle, Clock,
} from 'lucide-react';

const ICON_MAP: Record<string, any> = {
  Gavel, Scale, FileText, Shield, Building, Briefcase,
  Users, BookOpen, Building2, Handshake, Calculator, PenTool,
};

// ── Types ──

interface Paper {
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

interface Question {
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

// ── Views ──

type View = 'browse' | 'paper' | 'analysis';

export default function PastPapersPage() {
  const { getIdToken } = useAuth();

  // State
  const [view, setView] = useState<View>('browse');
  const [papers, setPapers] = useState<Paper[]>([]);
  const [topicFrequency, setTopicFrequency] = useState<Record<string, number>>({});
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedUnit, setSelectedUnit] = useState<string>('');
  const [selectedYear, setSelectedYear] = useState<string>('');

  // Paper viewer
  const [activePaper, setActivePaper] = useState<Paper | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [paperLoading, setPaperLoading] = useState(false);

  // AI generated similar question
  const [generatingFor, setGeneratingFor] = useState<string | null>(null);
  const [generated, setGenerated] = useState<Record<string, GeneratedQuestion>>({});

  // Model answer toggle
  const [showAnswer, setShowAnswer] = useState<Record<string, boolean>>({});

  // ── Fetch papers ──
  const fetchPapers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedUnit) params.set('unitId', selectedUnit);
      if (selectedYear) params.set('year', selectedYear);

      const res = await fetch(`/api/past-papers?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setPapers(data.papers || []);
      setTopicFrequency(data.topicFrequency || {});
      setAvailableYears(data.availableYears || []);
    } catch (err) {
      console.error('Failed to fetch past papers:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedUnit, selectedYear]);

  useEffect(() => { fetchPapers(); }, [fetchPapers]);

  // ── Open a paper ──
  const openPaper = async (paper: Paper) => {
    setPaperLoading(true);
    setActivePaper(paper);
    setView('paper');
    try {
      const res = await fetch(`/api/past-papers?paperId=${paper.id}`);
      if (!res.ok) throw new Error('Failed to fetch paper');
      const data = await res.json();
      setQuestions(data.questions || []);
    } catch (err) {
      console.error('Failed to fetch paper questions:', err);
    } finally {
      setPaperLoading(false);
    }
  };

  // ── Generate similar question ──
  const generateSimilar = async (question: Question) => {
    setGeneratingFor(question.id);
    try {
      const token = await getIdToken();
      const res = await fetch('/api/past-papers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: 'similar_question',
          questionText: question.questionText,
          unitName: activePaper?.unitName,
          topics: question.topics,
          marks: question.marks,
          questionType: question.questionType,
        }),
      });
      if (!res.ok) throw new Error('Failed to generate');
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

  // ── Helpers ──
  const sortedTopics = Object.entries(topicFrequency)
    .sort(([, a], [, b]) => b - a);
  const maxFrequency = sortedTopics.length > 0 ? sortedTopics[0][1] : 1;

  const unitName = selectedUnit
    ? ATP_UNITS.find(u => u.id === selectedUnit)?.name || selectedUnit
    : 'All Units';

  // Group papers by year
  const papersByYear = papers.reduce<Record<number, Paper[]>>((acc, p) => {
    (acc[p.year] = acc[p.year] || []).push(p);
    return acc;
  }, {});

  const sortedYears = Object.keys(papersByYear).map(Number).sort((a, b) => b - a);

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-8">
      {/* ── Header ── */}
      {view === 'browse' || view === 'analysis' ? (
        <>
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold">Past Papers</h1>
              <p className="text-muted-foreground mt-1">
                Browse KSL past examination papers from 2010 to 2025
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setView('browse')}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                  view === 'browse'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                }`}
              >
                <Eye className="h-4 w-4" />
                Browse
              </button>
              <button
                onClick={() => setView('analysis')}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                  view === 'analysis'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                }`}
              >
                <BarChart3 className="h-4 w-4" />
                Topic Analysis
              </button>
            </div>
          </div>

          {/* ── Filters ── */}
          <div className="flex flex-wrap gap-3">
            <div className="relative">
              <select
                value={selectedUnit}
                onChange={(e) => setSelectedUnit(e.target.value)}
                className="appearance-none pl-9 pr-8 py-2.5 rounded-xl bg-card border border-border/30 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
              >
                <option value="">All Units</option>
                {ATP_UNITS.map(u => (
                  <option key={u.id} value={u.id}>{u.code} — {u.name}</option>
                ))}
              </select>
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            </div>
            <div className="relative">
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="appearance-none pl-9 pr-8 py-2.5 rounded-xl bg-card border border-border/30 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
              >
                <option value="">All Years</option>
                {availableYears.map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            </div>

            {(selectedUnit || selectedYear) && (
              <button
                onClick={() => { setSelectedUnit(''); setSelectedYear(''); }}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-muted-foreground hover:bg-muted/60 transition-colors"
              >
                <X className="h-3.5 w-3.5" />
                Clear filters
              </button>
            )}
          </div>
        </>
      ) : (
        /* Paper header */
        <div className="flex items-center gap-3">
          <button
            onClick={() => { setView('browse'); setActivePaper(null); setQuestions([]); setGenerated({}); setShowAnswer({}); }}
            className="p-2 rounded-xl hover:bg-muted/60 transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <p className="text-xs text-muted-foreground font-medium">{activePaper?.unitName}</p>
            <h1 className="text-xl md:text-2xl font-bold">
              {activePaper?.year} {activePaper?.sitting !== 'main' ? `(${activePaper?.sitting})` : ''} Past Paper
            </h1>
          </div>
        </div>
      )}

      {/* ── Loading ── */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary/60" />
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════
           BROWSE VIEW
         ════════════════════════════════════════════════════════════════════ */}
      {!loading && view === 'browse' && (
        <>
          {papers.length === 0 ? (
            <div className="text-center py-20 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-40" />
              <p className="text-lg font-medium">No past papers found</p>
              <p className="text-sm mt-1">Past papers will appear here once they are uploaded.</p>
            </div>
          ) : (
            <>
              {/* Quick stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { icon: FileText, value: papers.length.toString(), label: 'Papers', gradient: 'from-emerald-500/6 to-transparent', iconBg: 'bg-emerald-500/10', iconColor: 'text-emerald-600' },
                  { icon: Calendar, value: availableYears.length > 0 ? `${availableYears[availableYears.length - 1]}–${availableYears[0]}` : '—', label: 'Year Range', gradient: 'from-sky-500/6 to-transparent', iconBg: 'bg-sky-500/10', iconColor: 'text-sky-600' },
                  { icon: Hash, value: sortedTopics.length.toString(), label: 'Topics Covered', gradient: 'from-violet-500/6 to-transparent', iconBg: 'bg-violet-500/10', iconColor: 'text-violet-600' },
                  { icon: TrendingUp, value: sortedTopics.length > 0 ? sortedTopics[0][0].slice(0, 18) : '—', label: 'Most Tested', gradient: 'from-amber-500/6 to-transparent', iconBg: 'bg-amber-500/10', iconColor: 'text-amber-600' },
                ].map(s => {
                  const Icon = s.icon;
                  return (
                    <div key={s.label} className={`rounded-2xl bg-gradient-to-br ${s.gradient} p-5`}>
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-xl ${s.iconBg}`}>
                          <Icon className={`h-4 w-4 ${s.iconColor}`} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-lg font-bold truncate">{s.value}</p>
                          <p className="text-xs text-muted-foreground">{s.label}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Papers by year */}
              <div className="space-y-8">
                {sortedYears.map(year => (
                  <div key={year}>
                    <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      {year}
                    </h2>
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {papersByYear[year].map(paper => {
                        const unit = ATP_UNITS.find(u => u.id === paper.unitId);
                        const Icon = unit ? (ICON_MAP[unit.icon] || BookOpen) : BookOpen;
                        return (
                          <button
                            key={paper.id}
                            onClick={() => openPaper(paper)}
                            className="group text-left rounded-xl p-4 bg-gradient-to-br from-muted/40 to-transparent hover:from-primary/6 hover:to-transparent transition-all duration-300 border border-transparent hover:border-primary/10"
                          >
                            <div className="flex items-start gap-3">
                              <div className="p-2 rounded-lg bg-primary/8 shrink-0">
                                <Icon className="h-4 w-4 text-primary" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">
                                  {unit?.code || paper.unitId}
                                </p>
                                <p className="font-medium text-sm truncate">{paper.unitName}</p>
                                <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                                  {paper.totalMarks && <span>{paper.totalMarks} marks</span>}
                                  <span>{paper.questionCount} questions</span>
                                  {paper.sitting !== 'main' && (
                                    <span className="px-1.5 py-0.5 bg-amber-500/10 text-amber-600 rounded text-[10px] font-medium">
                                      {paper.sitting}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-60 transition-opacity shrink-0 mt-1" />
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}

      {/* ════════════════════════════════════════════════════════════════════
           TOPIC ANALYSIS VIEW
         ════════════════════════════════════════════════════════════════════ */}
      {!loading && view === 'analysis' && (
        <div className="space-y-6">
          {sortedTopics.length === 0 ? (
            <div className="text-center py-20 text-muted-foreground">
              <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-40" />
              <p className="text-lg font-medium">No topic data yet</p>
              <p className="text-sm mt-1">Topic analysis will appear once past papers are uploaded.</p>
            </div>
          ) : (
            <>
              <div className="rounded-2xl p-6 bg-gradient-to-br from-violet-500/5 via-violet-400/3 to-transparent">
                <h3 className="text-lg font-semibold mb-1">Topic Frequency Analysis</h3>
                <p className="text-sm text-muted-foreground mb-6">
                  How often each topic has been tested across {papers.length} papers
                  {selectedUnit ? ` in ${unitName}` : ''}
                  {selectedYear ? ` (${selectedYear})` : ''}
                </p>
                <div className="space-y-3">
                  {sortedTopics.slice(0, 30).map(([topic, freq]) => (
                    <div key={topic} className="flex items-center gap-3">
                      <span className="text-sm font-medium w-[200px] md:w-[300px] truncate shrink-0" title={topic}>
                        {topic}
                      </span>
                      <div className="flex-1 h-6 bg-muted/30 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-violet-500 to-purple-500 rounded-full transition-all duration-500 flex items-center justify-end pr-2"
                          style={{ width: `${Math.max((freq / maxFrequency) * 100, 8)}%` }}
                        >
                          <span className="text-[10px] font-bold text-white">
                            {freq}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                {sortedTopics.length > 30 && (
                  <p className="text-xs text-muted-foreground mt-4">
                    Showing top 30 of {sortedTopics.length} topics
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════
           PAPER VIEWER
         ════════════════════════════════════════════════════════════════════ */}
      {view === 'paper' && activePaper && (
        <div className="space-y-6">
          {/* Paper info */}
          <div className="rounded-2xl p-5 bg-gradient-to-br from-stone-500/5 via-stone-400/3 to-transparent flex flex-wrap items-center gap-4 text-sm">
            {activePaper.paperCode && (
              <span className="text-muted-foreground">
                <span className="font-medium text-foreground">{activePaper.paperCode}</span>
              </span>
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
            <div className="space-y-6">
              {questions.map((q) => {
                const qKey = q.id;
                const gen = generated[qKey];
                return (
                  <div key={qKey} className="rounded-2xl border border-border/20 overflow-hidden">
                    {/* Question header */}
                    <div className="flex items-start justify-between p-5 bg-card/40">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <span className="text-xs font-bold text-primary bg-primary/8 px-2 py-0.5 rounded-md">
                            Q{q.questionNumber}{q.subPart ? `(${q.subPart})` : ''}
                          </span>
                          {q.marks && (
                            <span className="text-xs text-muted-foreground">
                              {q.marks} marks
                            </span>
                          )}
                          {q.isCompulsory && (
                            <span className="text-[10px] font-medium px-1.5 py-0.5 bg-red-500/10 text-red-600 rounded">
                              Compulsory
                            </span>
                          )}
                          {q.questionType && q.questionType !== 'essay' && (
                            <span className="text-[10px] font-medium px-1.5 py-0.5 bg-sky-500/10 text-sky-600 rounded capitalize">
                              {q.questionType}
                            </span>
                          )}
                        </div>
                        {/* Topics */}
                        {q.topics.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mb-3">
                            {q.topics.map(t => (
                              <span key={t} className="text-[10px] px-2 py-0.5 bg-violet-500/8 text-violet-600 dark:text-violet-400 rounded-full font-medium">
                                {t}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Question text */}
                    <div className="px-5 py-4 border-t border-border/10">
                      <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap">
                        {q.questionText}
                      </div>
                    </div>

                    {/* Model Answer toggle */}
                    {q.modelAnswer && (
                      <div className="border-t border-border/10">
                        <button
                          onClick={() => setShowAnswer(prev => ({ ...prev, [qKey]: !prev[qKey] }))}
                          className="w-full px-5 py-3 text-left text-sm font-medium text-emerald-600 hover:bg-emerald-500/5 transition-colors flex items-center gap-2"
                        >
                          <CheckCircle className="h-4 w-4" />
                          {showAnswer[qKey] ? 'Hide' : 'Show'} Model Answer
                        </button>
                        {showAnswer[qKey] && (
                          <div className="px-5 pb-5 prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap">
                            {q.modelAnswer}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Generate Similar */}
                    <div className="border-t border-border/10 px-5 py-3 flex items-center gap-3">
                      <button
                        onClick={() => generateSimilar(q)}
                        disabled={generatingFor === qKey}
                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium bg-primary/8 text-primary hover:bg-primary/15 transition-colors disabled:opacity-50"
                      >
                        {generatingFor === qKey ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Sparkles className="h-3.5 w-3.5" />
                        )}
                        {generatingFor === qKey ? 'Generating...' : 'Generate Similar Question'}
                      </button>
                    </div>

                    {/* Generated similar question */}
                    {gen && (
                      <div className="border-t border-primary/10 bg-primary/3 px-5 py-4 space-y-3">
                        <div className="flex items-center gap-2 text-sm font-medium text-primary">
                          <Sparkles className="h-4 w-4" />
                          AI-Generated Practice Question
                          {gen.marks && <span className="text-xs text-muted-foreground">({gen.marks} marks)</span>}
                        </div>
                        <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap">
                          {gen.question}
                        </div>
                        {gen.topicsCovered?.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {gen.topicsCovered.map(t => (
                              <span key={t} className="text-[10px] px-2 py-0.5 bg-primary/10 text-primary rounded-full font-medium">
                                {t}
                              </span>
                            ))}
                          </div>
                        )}
                        {gen.modelAnswer && (
                          <details className="group">
                            <summary className="text-sm font-medium text-emerald-600 cursor-pointer hover:underline flex items-center gap-1.5">
                              <CheckCircle className="h-3.5 w-3.5" />
                              View Model Answer
                            </summary>
                            <div className="mt-2 prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap">
                              {gen.modelAnswer}
                            </div>
                          </details>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
