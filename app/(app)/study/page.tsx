'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useTimeTracker } from '@/lib/hooks/useTimeTracker';
import { ATP_UNITS, TOPICS_BY_UNIT } from '@/lib/constants/legal-content';
import { MarkdownRenderer } from '@/components/MarkdownRenderer';
import EngagingLoader from '@/components/EngagingLoader';
import {
  BookOpen, ChevronRight, ChevronDown, Loader2, Sparkles,
  GraduationCap, FileText, Scale, Shield, Briefcase,
  Building, Gavel, Users as UsersIcon, Building2, Handshake,
  PenTool, Mic, TrendingUp, Search, ArrowLeft, Clock,
  RefreshCw, MessageSquare, BookMarked,
  Layers, Star, Play, X, Lightbulb, Save, Trash2,
} from 'lucide-react';

/* ═══════════════════════════════════════
   ICON MAP
   ═══════════════════════════════════════ */
const ICON_MAP: Record<string, any> = {
  Gavel, Scale, FileText, Shield, Building, Briefcase,
  Users: UsersIcon, BookOpen, Building2, Handshake, PenTool, Mic, TrendingUp,
};

/* ═══════════════════════════════════════
   TYPES
   ═══════════════════════════════════════ */
interface CaseOfDay {
  id: string;
  date: string;
  case_name: string;
  citation: string;
  court: string;
  year: number;
  unit_id: string;
  facts: string;
  issue: string;
  holding: string;
  ratio: string;
  significance: string;
  full_text: string | null;
  source_url: string | null;
  summary: string | null;
  keywords: string[];
}

type ViewState = 'browse' | 'topics' | 'loading' | 'notes' | 'ask-ai' | 'error';

/* ═══════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════ */
export default function StudyPage() {
  const router = useRouter();
  const { getIdToken } = useAuth();
  useTimeTracker('study');

  const [view, setView] = useState<ViewState>('browse');
  const [selectedUnit, setSelectedUnit] = useState<typeof ATP_UNITS[number] | null>(null);
  const [selectedTopic, setSelectedTopic] = useState<{ id: string; name: string; description: string } | null>(null);
  const [expandedUnits, setExpandedUnits] = useState<Set<string>>(new Set());
  const [notes, setNotes] = useState('');
  const [notesLoading, setNotesLoading] = useState(false);
  const [notesMeta, setNotesMeta] = useState<{ topicName: string; unitName: string } | null>(null);
  const [notesError, setNotesError] = useState<string | null>(null);
  const [availableTopics, setAvailableTopics] = useState<{ nodeId: string; name: string }[]>([]);

  // Case of the Day
  const [caseOfDay, setCaseOfDay] = useState<CaseOfDay | null>(null);
  const [caseExpanded, setCaseExpanded] = useState(false);
  const [caseLoading, setCaseLoading] = useState(true);
  const [caseTab, setCaseTab] = useState<'summary' | 'analysis' | 'verbatim'>('summary');

  // Ask AI
  const [aiPrompt, setAiPrompt] = useState('');
  const aiInputRef = useRef<HTMLTextAreaElement>(null);

  // Saved Notes
  const [savedNotesIndex, setSavedNotesIndex] = useState<Array<{ key: string; skillName: string; unitName: string; savedAt: string }>>([]);
  const [viewingSavedNote, setViewingSavedNote] = useState<{ skillName: string; unitName: string; sections: any[]; savedAt: string } | null>(null);

  // Load saved notes index from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const index = JSON.parse(localStorage.getItem('saved-notes-index') || '[]');
      setSavedNotesIndex(index);
    }
  }, []);

  const deleteSavedNote = useCallback((key: string) => {
    localStorage.removeItem(key);
    const index = JSON.parse(localStorage.getItem('saved-notes-index') || '[]') as typeof savedNotesIndex;
    const updated = index.filter(n => n.key !== key);
    localStorage.setItem('saved-notes-index', JSON.stringify(updated));
    setSavedNotesIndex(updated);
    if (viewingSavedNote) setViewingSavedNote(null);
  }, [viewingSavedNote]);

  const openSavedNote = useCallback((key: string) => {
    const data = localStorage.getItem(key);
    if (data) {
      const parsed = JSON.parse(data);
      setViewingSavedNote(parsed);
    }
  }, []);

  // Fetch case of the day on mount
  useEffect(() => {
    fetchCaseOfDay();
  }, []);

  const fetchCaseOfDay = async () => {
    setCaseLoading(true);
    try {
      const token = await getIdToken();
      const res = await fetch('/api/study/case-of-day', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setCaseOfDay(data.case);
      }
    } catch { /* silent */ }
    finally { setCaseLoading(false); }
  };

  const toggleUnit = (unitId: string) => {
    setExpandedUnits(prev => {
      const next = new Set(prev);
      if (next.has(unitId)) next.delete(unitId);
      else next.add(unitId);
      return next;
    });
  };

  const selectTopic = (unit: typeof ATP_UNITS[number], topic: { id: string; name: string; description: string }) => {
    setSelectedUnit(unit);
    setSelectedTopic(topic);
    setNotesError(null);
    setView('loading');
    setNotesLoading(true);
    getIdToken().then(token => {
      fetch('/api/study/notes', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topicName: topic.name,
          unitName: unit.name,
          unitId: unit.id,
          depth: 'standard',
          withAssessment: false,
        }),
      }).then(async res => {
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.notes) {
          setNotes(data.notes);
          setNotesMeta({ topicName: data.topicName, unitName: data.unitName });
          setAvailableTopics([]);
          setView('notes');
        } else if (data.availableTopics && data.availableTopics.length > 0) {
          // No direct match — show available topics from this unit
          setAvailableTopics(data.availableTopics);
          setNotesError(data.error || 'Topic not found. Select from available topics below.');
          setView('error');
        } else {
          setAvailableTopics([]);
          setNotesError(data.error || 'Failed to load notes. Please try again.');
          setView('error');
        }
      }).catch(() => {
        setNotesError('Network error. Please check your connection and try again.');
        setView('error');
      }).finally(() => setNotesLoading(false));
    }).catch(() => { setNotesError('Authentication error. Please refresh the page.'); setView('error'); setNotesLoading(false); });
  };

  // Select a topic by nodeId (used when picking from available topics)
  const selectTopicByNodeId = (nodeId: string, topicName: string) => {
    setNotesError(null);
    setAvailableTopics([]);
    setView('loading');
    setNotesLoading(true);
    getIdToken().then(token => {
      fetch('/api/study/notes', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nodeId,
          topicName,
          unitName: selectedUnit?.name,
          unitId: selectedUnit?.id,
          depth: 'standard',
          withAssessment: false,
        }),
      }).then(async res => {
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.notes) {
          setNotes(data.notes);
          setNotesMeta({ topicName: data.topicName, unitName: data.unitName });
          setView('notes');
        } else {
          setNotesError(data.error || 'Failed to load notes. Please try again.');
          setView('error');
        }
      }).catch(() => {
        setNotesError('Network error. Please check your connection and try again.');
        setView('error');
      }).finally(() => setNotesLoading(false));
    }).catch(() => { setNotesError('Authentication error.'); setView('error'); setNotesLoading(false); });
  };

  const generateNotes = async (customPrompt?: string) => {
    setView('loading');
    setNotesLoading(true);
    setNotesError(null);
    try {
      const token = await getIdToken();
      const res = await fetch('/api/study/notes', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topicName: customPrompt ? undefined : selectedTopic?.name,
          unitName: selectedUnit?.name,
          unitId: selectedUnit?.id,
          depth: 'standard',
          withAssessment: false,
          customPrompt,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.notes) {
          setNotes(data.notes);
          setNotesMeta({ topicName: data.topicName, unitName: data.unitName });
          setView('notes');
        } else {
          setNotesError('Notes came back empty. Try again.');
          setView('error');
        }
      } else {
        setNotesError('Failed to generate notes. Please try again.');
        setView('error');
      }
    } catch {
      setNotesError('Network error. Please check your connection.');
      setView('error');
    } finally {
      setNotesLoading(false);
    }
  };

  const handleAskAi = () => {
    if (!aiPrompt.trim()) return;
    setSelectedTopic({ id: 'custom', name: aiPrompt.trim(), description: '' });
    generateNotes(aiPrompt.trim());
    setAiPrompt('');
  };

  const goBack = () => {
    if (viewingSavedNote) { setViewingSavedNote(null); return; }
    if (view === 'notes') { setView('browse'); setNotes(''); setNotesMeta(null); }
    else if (view === 'error') { setView('browse'); setNotesError(null); }
    else if (view === 'ask-ai') setView('browse');
    else if (view === 'topics') setView('browse');
    else setView('browse');
  };

  /* ═══════════════════════════════════════
     SAVED NOTE VIEWER
     ═══════════════════════════════════════ */
  if (viewingSavedNote) {
    return (
      <div className="min-h-screen bg-background animate-in fade-in duration-300">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between mb-6">
            <button onClick={goBack} className="group flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="h-4 w-4 group-hover:-translate-x-0.5 transition-transform" />
              Back to Study
            </button>
            <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/10 text-amber-600">
              <Save className="h-3 w-3" />
              Saved {new Date(viewingSavedNote.savedAt).toLocaleDateString()}
            </span>
          </div>
          <div className="mb-8">
            <h1 className="text-2xl font-bold">{viewingSavedNote.skillName}</h1>
            <p className="text-sm text-muted-foreground mt-1">{viewingSavedNote.unitName}</p>
          </div>
          <div className="space-y-6">
            {viewingSavedNote.sections.map((section: any, i: number) => (
              <div key={section.id || i} className="rounded-xl border border-border/30 p-5">
                <h3 className="font-semibold text-lg mb-3">{section.title}</h3>
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <MarkdownRenderer content={section.content} />
                </div>
                {section.examTips && (
                  <div className="mt-4 p-3 rounded-lg bg-amber-500/5 border border-amber-500/10">
                    <p className="text-xs font-semibold text-amber-600 mb-1 flex items-center gap-1">
                      <Lightbulb className="h-3 w-3" /> Exam Tips
                    </p>
                    <p className="text-sm text-muted-foreground">{section.examTips}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  /* ═══════════════════════════════════════
     NOTES VIEW
     ═══════════════════════════════════════ */
  if (view === 'notes' && notes) {
    return (
      <div className="min-h-screen bg-background animate-in fade-in duration-300">
        <div className="max-w-4xl mx-auto px-4 py-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <button onClick={goBack} className="group flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="h-4 w-4 group-hover:-translate-x-0.5 transition-transform" />
              Back to Study
            </button>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-500/10 text-blue-600">
              Study Notes
            </span>
          </div>

          {/* Title */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold">{notesMeta?.topicName}</h1>
            {notesMeta?.unitName && (
              <p className="text-sm text-muted-foreground mt-1">{notesMeta.unitName}</p>
            )}
          </div>

          {/* Notes content */}
          <div className="prose prose-sm dark:prose-invert max-w-none 
            prose-headings:font-bold prose-headings:text-foreground
            prose-h2:text-xl prose-h2:mt-8 prose-h2:mb-4 prose-h2:pb-2 prose-h2:border-b prose-h2:border-border/30
            prose-h3:text-lg prose-h3:mt-6 prose-h3:mb-3
            prose-blockquote:border-l-primary/40 prose-blockquote:bg-primary/5 prose-blockquote:py-1 prose-blockquote:px-4 prose-blockquote:rounded-r-lg
            prose-strong:text-foreground
            prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded
            prose-li:marker:text-primary/60
          ">
            <MarkdownRenderer content={notes} />
          </div>

          {/* Regenerate button */}
          <div className="mt-10 pt-6 border-t border-border/30 flex justify-center">
            <button
              onClick={() => generateNotes()}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary/10 text-primary text-sm font-medium hover:bg-primary/15 transition-colors"
            >
              <RefreshCw className="h-4 w-4" /> Get Fresh Notes
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ═══════════════════════════════════════
     LOADING VIEW
     ═══════════════════════════════════════ */
  if (view === 'loading') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <EngagingLoader size="lg" message="Getting your notes ready..." />
      </div>
    );
  }

  /* ═══════════════════════════════════════
     ERROR VIEW
     ═══════════════════════════════════════ */
  if (view === 'error') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center space-y-4 animate-in fade-in duration-300 max-w-lg w-full">
          <div className="w-14 h-14 mx-auto rounded-full bg-red-500/10 flex items-center justify-center">
            <X className="h-6 w-6 text-red-500" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">
              {availableTopics.length > 0 ? 'Topic Not Found' : 'Something Went Wrong'}
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              {notesError || 'Failed to load notes.'}
            </p>
          </div>

          {/* Show available topics when the backend returns them */}
          {availableTopics.length > 0 && (
            <div className="mt-4 text-left bg-muted/50 rounded-xl p-4 max-h-64 overflow-y-auto">
              <p className="text-xs text-muted-foreground mb-2 font-medium">Available topics in this unit:</p>
              <div className="space-y-1">
                {availableTopics.map((t, i) => (
                  <button
                    key={t.nodeId}
                    onClick={() => selectTopicByNodeId(t.nodeId, t.name)}
                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-primary/10 text-sm text-foreground transition-colors flex items-center gap-2 group"
                  >
                    <BookOpen className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary" />
                    <span className="line-clamp-1">{t.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-2 justify-center">
            {availableTopics.length === 0 && (
              <button
                onClick={() => {
                  if (selectedUnit && selectedTopic) {
                    selectTopic(selectedUnit, selectedTopic);
                  } else {
                    goBack();
                  }
                }}
                className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors flex items-center gap-1.5"
              >
                <RefreshCw className="h-3.5 w-3.5" /> Try Again
              </button>
            )}
            <button
              onClick={goBack}
              className="px-4 py-2 rounded-xl bg-muted text-foreground text-sm font-medium hover:bg-muted/80 transition-colors"
            >
              Go Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ═══════════════════════════════════════
     ASK AI VIEW
     ═══════════════════════════════════════ */
  if (view === 'ask-ai') {
    return (
      <div className="min-h-screen bg-background animate-in fade-in duration-300">
        <div className="max-w-2xl mx-auto px-4 py-8">
          <button onClick={goBack} className="group flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors">
            <ArrowLeft className="h-4 w-4 group-hover:-translate-x-0.5 transition-transform" />
            Back
          </button>

          <div className="text-center mb-8">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500/20 to-blue-500/20 flex items-center justify-center mx-auto mb-4">
              <MessageSquare className="h-7 w-7 text-primary" />
            </div>
            <h1 className="text-xl font-bold">Ask AI to Prepare Notes</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Tell the AI what you want to study and it will prepare tailored study materials for you
            </p>
          </div>

          <div className="space-y-4">
            <textarea
              ref={aiInputRef}
              value={aiPrompt}
              onChange={e => setAiPrompt(e.target.value)}
              placeholder="e.g., 'I want to study the rules of evidence for cross-examination in criminal trials' or 'Explain res judicata with all landmark cases'"
              className="w-full h-32 px-4 py-3 rounded-xl bg-card border border-border/30 text-sm resize-none outline-none focus:ring-2 focus:ring-primary/20 placeholder:text-muted-foreground/50"
              autoFocus
            />

            {/* Quick depth + assessment selections */}
            <div className="flex gap-2 flex-wrap">
              <span className="px-3 py-1.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
                Standard Depth
              </span>
            </div>

            <button
              onClick={handleAskAi}
              disabled={!aiPrompt.trim()}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Sparkles className="h-4 w-4" />
              Get Notes
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ═══════════════════════════════════════
     BROWSE VIEW (main page)
     ═══════════════════════════════════════ */
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border/40 bg-card/50">
        <div className="max-w-5xl mx-auto px-4 py-5">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-primary/10">
                  <BookOpen className="h-5 w-5 text-primary" />
                </div>
                Study
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Self-paced learning — pick a topic, choose your depth, get tailored notes
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* Quick Actions */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            onClick={() => setView('ask-ai')}
            className="group flex items-center gap-3 p-4 rounded-xl border border-border/30 bg-gradient-to-r from-violet-500/5 to-blue-500/5 hover:border-primary/30 transition-all"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500/20 to-blue-500/20 flex items-center justify-center shrink-0">
              <MessageSquare className="h-5 w-5 text-primary" />
            </div>
            <div className="text-left">
              <p className="font-medium text-sm">Ask AI</p>
              <p className="text-xs text-muted-foreground">Tell the AI what you want to study</p>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground/30 ml-auto group-hover:text-primary transition-colors" />
          </button>

          <button
            onClick={() => setCaseExpanded(!caseExpanded)}
            className="group flex items-center gap-3 p-4 rounded-xl border border-border/30 bg-gradient-to-r from-amber-500/5 to-orange-500/5 hover:border-amber-500/30 transition-all"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center shrink-0">
              <Scale className="h-5 w-5 text-amber-600" />
            </div>
            <div className="text-left flex-1 min-w-0">
              <p className="font-medium text-sm">Case of the Day</p>
              <p className="text-xs text-muted-foreground truncate">
                {caseLoading ? 'Loading...' : caseOfDay?.case_name || 'No case today'}
              </p>
            </div>
            <ChevronDown className={`h-4 w-4 text-muted-foreground/30 transition-transform ${caseExpanded ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {/* Case of the Day (expanded) */}
        {caseExpanded && caseOfDay && (
          <div className="animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="rounded-2xl border border-amber-500/20 bg-gradient-to-br from-amber-50/50 via-background to-orange-50/30 dark:from-amber-950/20 dark:via-background dark:to-orange-950/10 overflow-hidden">
              {/* Case Header */}
              <div className="px-4 pt-4 pb-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-700 dark:text-amber-400 uppercase tracking-wider">
                        📚 Case of the Day
                      </span>
                      <span className="text-[10px] text-muted-foreground">{new Date(caseOfDay.date).toLocaleDateString('en-KE', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                    </div>
                    <h2 className="text-sm font-bold text-foreground leading-snug">{caseOfDay.case_name}</h2>
                    <p className="text-xs text-muted-foreground">
                      {caseOfDay.citation} • {caseOfDay.court} ({caseOfDay.year})
                    </p>
                  </div>
                  <button onClick={() => setCaseExpanded(false)} className="p-1 rounded-lg hover:bg-muted transition-colors shrink-0">
                    <X className="h-4 w-4 text-muted-foreground" />
                  </button>
                </div>

                {/* Keywords */}
                {caseOfDay.keywords?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {caseOfDay.keywords.map((kw, i) => (
                      <span key={i} className="px-1.5 py-0.5 rounded-full text-[9px] bg-amber-500/8 text-amber-700 dark:text-amber-400 border border-amber-500/10">
                        {kw}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* View Tabs: Summary | Case Analysis | Verbatim Text */}
              <div className="flex gap-1 mx-4 mb-2 bg-muted/40 rounded-lg p-0.5">
                {(['summary', 'analysis', 'verbatim'] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => setCaseTab(t)}
                    className={`flex-1 px-3 py-1.5 rounded-md text-[11px] font-medium transition-colors ${
                      caseTab === t ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {t === 'summary' ? 'Summary' : t === 'analysis' ? 'Case Analysis' : 'Verbatim Text'}
                  </button>
                ))}
              </div>

              <div className="px-4 pb-4">
                {/* SUMMARY TAB */}
                {caseTab === 'summary' && (
                  <div className="space-y-2">
                    {caseOfDay.summary && (
                      <div className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/10">
                        <p className="text-xs text-foreground/80 leading-relaxed">
                          <Lightbulb className="h-3 w-3 inline mr-1 text-amber-600" />
                          {caseOfDay.summary}
                        </p>
                      </div>
                    )}
                    <div className="p-3 rounded-lg bg-primary/5 border border-primary/10">
                      <h4 className="text-[10px] font-semibold text-primary uppercase tracking-wider mb-1">Ratio Decidendi</h4>
                      <p className="text-xs text-foreground/85 leading-relaxed">{caseOfDay.ratio}</p>
                    </div>
                    <div>
                      <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-0.5">Holding</h4>
                      <p className="text-xs text-foreground/85 leading-relaxed">{caseOfDay.holding}</p>
                    </div>
                    <div>
                      <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-0.5">Significance</h4>
                      <p className="text-xs text-foreground/85 leading-relaxed">{caseOfDay.significance}</p>
                    </div>
                  </div>
                )}

                {/* ANALYSIS TAB */}
                {caseTab === 'analysis' && (
                  <div className="space-y-2">
                    <div>
                      <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-0.5">Facts</h4>
                      <p className="text-xs text-foreground/85 leading-relaxed">{caseOfDay.facts}</p>
                    </div>
                    <div>
                      <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-0.5">Issue</h4>
                      <p className="text-xs text-foreground/85 leading-relaxed">{caseOfDay.issue}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-primary/5 border border-primary/10">
                      <h4 className="text-[10px] font-semibold text-primary uppercase tracking-wider mb-1">Ratio Decidendi</h4>
                      <p className="text-xs text-foreground/85 leading-relaxed">{caseOfDay.ratio}</p>
                    </div>
                    <div>
                      <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-0.5">Holding</h4>
                      <p className="text-xs text-foreground/85 leading-relaxed">{caseOfDay.holding}</p>
                    </div>
                    <div>
                      <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-0.5">Significance</h4>
                      <p className="text-xs text-foreground/85 leading-relaxed">{caseOfDay.significance}</p>
                    </div>
                  </div>
                )}

                {/* VERBATIM TEXT TAB */}
                {caseTab === 'verbatim' && (
                  <div>
                    {caseOfDay.full_text ? (
                      <div className="p-4 rounded-lg bg-muted/30 border border-border/30 max-h-[60vh] overflow-y-auto">
                        <p className="text-xs text-foreground/85 leading-[1.8] whitespace-pre-wrap font-serif">
                          {caseOfDay.full_text}
                        </p>
                      </div>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        <FileText className="h-8 w-8 mx-auto mb-2 opacity-30" />
                        <p className="text-xs">Verbatim text not yet available for this case.</p>
                      </div>
                    )}
                  </div>
                )}

                {caseOfDay.source_url && (
                  <a
                    href={caseOfDay.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-[11px] text-primary hover:underline pt-2"
                  >
                    📖 Read full judgment on Kenya Law →
                  </a>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Course Outlines & Saved Notes — hidden when case is expanded */}
        {!caseExpanded && (
          <div>
            {/* Saved Notes */}
            {savedNotesIndex.length > 0 && (
              <div className="mb-4">
                <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-2">
                  <Save className="h-3.5 w-3.5" />
                  Saved Notes • {savedNotesIndex.length}
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {savedNotesIndex.slice().reverse().map(note => (
                    <div
                      key={note.key}
                      className="group flex items-center gap-2.5 p-2.5 rounded-lg border border-border/30 hover:border-primary/30 transition-all cursor-pointer"
                      onClick={() => openSavedNote(note.key)}
                    >
                      <div className="w-7 h-7 rounded-md bg-amber-500/10 flex items-center justify-center shrink-0">
                        <BookMarked className="h-3.5 w-3.5 text-amber-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{note.skillName}</p>
                        <p className="text-[10px] text-muted-foreground">{note.unitName}</p>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteSavedNote(note.key); }}
                        className="p-1 rounded-md opacity-0 group-hover:opacity-100 hover:bg-red-500/10 transition-all"
                        title="Delete"
                      >
                        <Trash2 className="h-3 w-3 text-red-500" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-2">
              <Layers className="h-3.5 w-3.5" />
              Course Outlines • {ATP_UNITS.length} Units
            </h2>

            <div className="space-y-1">
              {ATP_UNITS.map(unit => {
                const Icon = ICON_MAP[unit.icon] || BookOpen;
                const topics = TOPICS_BY_UNIT[unit.id] || [];
                const isExpanded = expandedUnits.has(unit.id);

                return (
                  <div key={unit.id} className="rounded-lg border border-border/30 overflow-hidden transition-all">
                    {/* Unit Header - compact */}
                    <button
                      onClick={() => toggleUnit(unit.id)}
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-card/60 transition-colors"
                    >
                      <div className="w-7 h-7 rounded-md bg-primary/8 flex items-center justify-center shrink-0">
                        <Icon className="h-3.5 w-3.5 text-primary/70" />
                      </div>
                      <div className="flex-1 text-left min-w-0">
                        <div className="flex items-center gap-1.5">
                          <h3 className="font-medium text-xs">{unit.name}</h3>
                          <span className="text-[9px] text-muted-foreground px-1 py-0.5 bg-muted rounded">{unit.code}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-[10px] text-muted-foreground">{topics.length}</span>
                        <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground/40 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                      </div>
                    </button>

                    {/* Topics Dropdown */}
                    {isExpanded && topics.length > 0 && (
                      <div className="border-t border-border/20 bg-muted/20 animate-in fade-in slide-in-from-top-1 duration-200">
                        {topics.map((topic, idx) => (
                          <button
                            key={topic.id}
                            onClick={() => selectTopic(unit, topic)}
                            className="w-full flex items-center gap-2.5 px-3 py-2 pl-12 hover:bg-card/60 transition-colors group border-b border-border/10 last:border-0"
                          >
                            <div className="w-5 h-5 rounded-md bg-primary/5 flex items-center justify-center shrink-0 text-[9px] font-semibold text-primary/50 group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                              {idx + 1}
                            </div>
                            <div className="flex-1 text-left min-w-0">
                              <p className="text-xs font-medium group-hover:text-primary transition-colors truncate">{topic.name}</p>
                            </div>
                            <Play className="h-3 w-3 text-muted-foreground/20 group-hover:text-primary shrink-0 transition-colors" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════
   CASE SECTION COMPONENT
   ═══════════════════════════════════════ */
// CaseSection kept for backwards compatibility but no longer used in main view
function CaseSection({ title, content, highlight }: { title: string; content: string; highlight?: boolean }) {
  return (
    <div className={`${highlight ? 'p-3 rounded-lg bg-primary/5 border border-primary/10' : ''}`}>
      <h4 className={`text-[10px] font-semibold uppercase tracking-wider mb-0.5 ${
        highlight ? 'text-primary' : 'text-muted-foreground'
      }`}>{title}</h4>
      <p className="text-xs text-foreground/85 leading-relaxed">{content}</p>
    </div>
  );
}
