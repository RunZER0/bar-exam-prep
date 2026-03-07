'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useTimeTracker } from '@/lib/hooks/useTimeTracker';
import { ATP_UNITS, TOPICS_BY_UNIT } from '@/lib/constants/legal-content';
import { MarkdownRenderer } from '@/components/MarkdownRenderer';
import {
  BookOpen, ChevronRight, ChevronDown, Loader2, Sparkles,
  GraduationCap, Zap, FileText, Scale, Shield, Briefcase,
  Building, Gavel, Users as UsersIcon, Building2, Handshake,
  PenTool, Mic, TrendingUp, Search, ArrowLeft, Clock,
  CheckCircle2, Brain, RefreshCw, MessageSquare, BookMarked,
  Layers, Star, Play, X, Lightbulb, Save, Trash2,
} from 'lucide-react';

/* ═══════════════════════════════════════
   ICON MAP
   ═══════════════════════════════════════ */
const ICON_MAP: Record<string, any> = {
  Gavel, Scale, FileText, Shield, Building, Briefcase,
  Users: UsersIcon, BookOpen, Building2, Handshake, PenTool, Mic, TrendingUp,
};

const DEPTH_OPTIONS = [
  { id: 'refresher', label: 'Refresher', desc: 'Quick recap — key points only', icon: Zap, color: 'text-amber-500 bg-amber-500/10 border-amber-500/30' },
  { id: 'standard', label: 'Standard', desc: 'Comprehensive coverage', icon: BookOpen, color: 'text-blue-500 bg-blue-500/10 border-blue-500/30' },
  { id: 'indepth', label: 'In-Depth', desc: 'Exhaustive exam-level detail', icon: Brain, color: 'text-purple-500 bg-purple-500/10 border-purple-500/30' },
] as const;

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

type ViewState = 'browse' | 'topics' | 'configure' | 'loading' | 'notes' | 'ask-ai';

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
  const [depth, setDepth] = useState<'refresher' | 'standard' | 'indepth'>('standard');
  const [withAssessment, setWithAssessment] = useState(false);
  const [notes, setNotes] = useState('');
  const [notesLoading, setNotesLoading] = useState(false);
  const [notesMeta, setNotesMeta] = useState<{ topicName: string; unitName: string; depth: string } | null>(null);

  // Case of the Day
  const [caseOfDay, setCaseOfDay] = useState<CaseOfDay | null>(null);
  const [caseExpanded, setCaseExpanded] = useState(false);
  const [caseLoading, setCaseLoading] = useState(true);

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
    setView('configure');
  };

  const generateNotes = async (customPrompt?: string) => {
    setView('loading');
    setNotesLoading(true);
    try {
      const token = await getIdToken();
      const res = await fetch('/api/study/notes', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topicName: customPrompt ? undefined : selectedTopic?.name,
          unitName: selectedUnit?.name,
          unitId: selectedUnit?.id,
          depth,
          withAssessment,
          customPrompt,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setNotes(data.notes);
        setNotesMeta({ topicName: data.topicName, unitName: data.unitName, depth: data.depth });
        setView('notes');
      } else {
        setView('browse');
      }
    } catch {
      setView('browse');
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
    else if (view === 'configure') setView('browse');
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
            <div className="flex items-center gap-2">
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                notesMeta?.depth === 'refresher' ? 'bg-amber-500/10 text-amber-600' :
                notesMeta?.depth === 'indepth' ? 'bg-purple-500/10 text-purple-600' :
                'bg-blue-500/10 text-blue-600'
              }`}>{notesMeta?.depth}</span>
              {withAssessment && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-600">
                  + Assessment
                </span>
              )}
            </div>
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
              <RefreshCw className="h-4 w-4" /> Regenerate Notes
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
        <div className="text-center space-y-4 animate-in fade-in duration-300">
          <div className="relative w-16 h-16 mx-auto">
            <div className="absolute inset-0 rounded-full border-2 border-primary/20" />
            <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-primary animate-spin" />
            <Sparkles className="absolute inset-0 m-auto h-6 w-6 text-primary animate-pulse" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">Generating Your Notes</h3>
            <p className="text-sm text-muted-foreground mt-1">
              {depth === 'indepth' ? 'Preparing exhaustive coverage...' :
               depth === 'refresher' ? 'Building a quick refresher...' :
               'Crafting comprehensive notes...'}
            </p>
          </div>
          <div className="flex items-center justify-center gap-1.5 pt-2">
            {[0, 1, 2].map(i => (
              <div key={i} className="w-2 h-2 rounded-full bg-primary/40 animate-bounce" style={{ animationDelay: `${i * 150}ms` }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  /* ═══════════════════════════════════════
     CONFIGURE VIEW (depth + assessment)
     ═══════════════════════════════════════ */
  if (view === 'configure') {
    return (
      <div className="min-h-screen bg-background animate-in fade-in slide-in-from-right-4 duration-300">
        <div className="max-w-2xl mx-auto px-4 py-8">
          <button onClick={goBack} className="group flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors">
            <ArrowLeft className="h-4 w-4 group-hover:-translate-x-0.5 transition-transform" />
            Back
          </button>

          <div className="text-center mb-8">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <GraduationCap className="h-7 w-7 text-primary" />
            </div>
            <h1 className="text-xl font-bold">{selectedTopic?.name}</h1>
            <p className="text-sm text-muted-foreground mt-1">{selectedUnit?.name} • {selectedUnit?.code}</p>
          </div>

          {/* Depth Selection */}
          <div className="mb-8">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Study Depth</h3>
            <div className="space-y-2">
              {DEPTH_OPTIONS.map(opt => {
                const Icon = opt.icon;
                const selected = depth === opt.id;
                return (
                  <button
                    key={opt.id}
                    onClick={() => setDepth(opt.id as any)}
                    className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all duration-200 text-left ${
                      selected
                        ? `${opt.color} scale-[1.02] shadow-sm`
                        : 'border-border/30 hover:border-border/60'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${selected ? 'bg-current/[0.08]' : 'bg-muted'}`}>
                      <Icon className={`h-5 w-5 ${selected ? '' : 'text-muted-foreground'}`} />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-sm">{opt.label}</p>
                      <p className="text-xs text-muted-foreground">{opt.desc}</p>
                    </div>
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                      selected ? 'border-current bg-current/20' : 'border-border/40'
                    }`}>
                      {selected && <div className="w-2 h-2 rounded-full bg-current" />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Assessment Toggle */}
          <div className="mb-8">
            <button
              onClick={() => setWithAssessment(!withAssessment)}
              className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all duration-200 ${
                withAssessment
                  ? 'border-emerald-500/40 bg-emerald-500/5 shadow-sm'
                  : 'border-border/30 hover:border-border/60'
              }`}
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                withAssessment ? 'bg-emerald-500/10' : 'bg-muted'
              }`}>
                <CheckCircle2 className={`h-5 w-5 ${withAssessment ? 'text-emerald-500' : 'text-muted-foreground'}`} />
              </div>
              <div className="flex-1 text-left">
                <p className="font-medium text-sm">Include Assessment</p>
                <p className="text-xs text-muted-foreground">Questions mixed into notes + final assessment</p>
              </div>
              <div className={`w-10 h-6 rounded-full transition-colors relative ${
                withAssessment ? 'bg-emerald-500' : 'bg-muted-foreground/20'
              }`}>
                <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                  withAssessment ? 'translate-x-4' : 'translate-x-0.5'
                }`} />
              </div>
            </button>
          </div>

          {/* Generate Button */}
          <button
            onClick={() => generateNotes()}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
          >
            <Sparkles className="h-4 w-4" />
            Generate Study Notes
          </button>
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
              Tell the AI what you want to study and it will generate tailored study materials
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
              {DEPTH_OPTIONS.map(opt => (
                <button
                  key={opt.id}
                  onClick={() => setDepth(opt.id as any)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    depth === opt.id ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
              <button
                onClick={() => setWithAssessment(!withAssessment)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  withAssessment ? 'bg-emerald-500/10 text-emerald-600' : 'text-muted-foreground hover:bg-muted'
                }`}
              >
                {withAssessment ? '✓ Assessment' : '+ Assessment'}
              </button>
            </div>

            <button
              onClick={handleAskAi}
              disabled={!aiPrompt.trim()}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Sparkles className="h-4 w-4" />
              Generate Notes
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
              <div className="px-6 pt-6 pb-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-700 dark:text-amber-400 uppercase tracking-wider">
                        📚 Case of the Day
                      </span>
                      <span className="text-[10px] text-muted-foreground">{new Date(caseOfDay.date).toLocaleDateString('en-KE', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
                    </div>
                    <h2 className="text-lg font-bold text-foreground">{caseOfDay.case_name}</h2>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {caseOfDay.citation} • {caseOfDay.court} ({caseOfDay.year})
                    </p>
                  </div>
                  <button onClick={() => setCaseExpanded(false)} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
                    <X className="h-4 w-4 text-muted-foreground" />
                  </button>
                </div>

                {/* Keywords */}
                {caseOfDay.keywords?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {caseOfDay.keywords.map((kw, i) => (
                      <span key={i} className="px-2 py-0.5 rounded-full text-[10px] bg-amber-500/8 text-amber-700 dark:text-amber-400 border border-amber-500/10">
                        {kw}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Summary (always shown) */}
              {caseOfDay.summary && (
                <div className="mx-6 mb-4 p-4 rounded-xl bg-amber-500/5 border border-amber-500/10">
                  <h4 className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Lightbulb className="h-3.5 w-3.5" /> Quick Summary
                  </h4>
                  <p className="text-sm text-foreground/80 leading-relaxed">{caseOfDay.summary}</p>
                </div>
              )}

              {/* Verbatim Case Text */}
              {caseOfDay.full_text && (
                <div className="mx-6 mb-4">
                  <details className="group rounded-xl border border-amber-500/15 overflow-hidden">
                    <summary className="flex items-center justify-between cursor-pointer px-4 py-3 bg-amber-500/5 hover:bg-amber-500/8 transition-colors">
                      <h4 className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                        <FileText className="h-3.5 w-3.5" /> Full Case Text
                      </h4>
                      <ChevronDown className="h-4 w-4 text-amber-600 dark:text-amber-400 transition-transform group-open:rotate-180" />
                    </summary>
                    <div className="px-4 py-4 max-h-96 overflow-y-auto">
                      <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap font-mono">
                        {caseOfDay.full_text}
                      </p>
                    </div>
                  </details>
                </div>
              )}

              {/* Detailed Breakdown */}
              <div className="px-6 pb-6 space-y-4">
                <CaseSection title="Facts" content={caseOfDay.facts} />
                <CaseSection title="Issue" content={caseOfDay.issue} />
                <CaseSection title="Holding" content={caseOfDay.holding} />
                <CaseSection title="Ratio Decidendi" content={caseOfDay.ratio} highlight />
                <CaseSection title="Significance" content={caseOfDay.significance} />

                {caseOfDay.source_url && (
                  <a
                    href={caseOfDay.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-xs text-primary hover:underline mt-2"
                  >
                    Read full judgment on Kenya Law →
                  </a>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Course Outlines - Accordion */}
        <div>
          {/* Saved Notes */}
          {savedNotesIndex.length > 0 && (
            <div className="mb-6">
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                <Save className="h-3.5 w-3.5" />
                Saved Notes • {savedNotesIndex.length}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {savedNotesIndex.slice().reverse().map(note => (
                  <div
                    key={note.key}
                    className="group flex items-center gap-3 p-3 rounded-xl border border-border/30 hover:border-primary/30 transition-all cursor-pointer"
                    onClick={() => openSavedNote(note.key)}
                  >
                    <div className="w-9 h-9 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
                      <BookMarked className="h-4 w-4 text-amber-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{note.skillName}</p>
                      <p className="text-[10px] text-muted-foreground">{note.unitName} • {new Date(note.savedAt).toLocaleDateString()}</p>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteSavedNote(note.key); }}
                      className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-500/10 transition-all"
                      title="Delete saved note"
                    >
                      <Trash2 className="h-3.5 w-3.5 text-red-500" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
            <Layers className="h-3.5 w-3.5" />
            Course Outlines • {ATP_UNITS.length} Units
          </h2>

          <div className="space-y-1.5">
            {ATP_UNITS.map(unit => {
              const Icon = ICON_MAP[unit.icon] || BookOpen;
              const topics = TOPICS_BY_UNIT[unit.id] || [];
              const isExpanded = expandedUnits.has(unit.id);

              return (
                <div key={unit.id} className="rounded-xl border border-border/30 overflow-hidden transition-all">
                  {/* Unit Header */}
                  <button
                    onClick={() => toggleUnit(unit.id)}
                    className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-card/60 transition-colors"
                  >
                    <div className="w-9 h-9 rounded-lg bg-primary/8 flex items-center justify-center shrink-0">
                      <Icon className="h-4.5 w-4.5 text-primary/70" />
                    </div>
                    <div className="flex-1 text-left min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-sm">{unit.name}</h3>
                        <span className="text-[10px] text-muted-foreground px-1.5 py-0.5 bg-muted rounded">{unit.code}</span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">{unit.description}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] text-muted-foreground">{topics.length} topics</span>
                      <ChevronDown className={`h-4 w-4 text-muted-foreground/40 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                    </div>
                  </button>

                  {/* Topics Dropdown */}
                  {isExpanded && topics.length > 0 && (
                    <div className="border-t border-border/20 bg-muted/20 animate-in fade-in slide-in-from-top-1 duration-200">
                      {topics.map((topic, idx) => (
                        <button
                          key={topic.id}
                          onClick={() => selectTopic(unit, topic)}
                          className="w-full flex items-center gap-3 px-4 py-3 pl-16 hover:bg-card/60 transition-colors group border-b border-border/10 last:border-0"
                        >
                          <div className="w-6 h-6 rounded-md bg-primary/5 flex items-center justify-center shrink-0 text-[10px] font-semibold text-primary/50 group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                            {idx + 1}
                          </div>
                          <div className="flex-1 text-left min-w-0">
                            <p className="text-sm font-medium group-hover:text-primary transition-colors">{topic.name}</p>
                            <p className="text-[11px] text-muted-foreground truncate">{topic.description}</p>
                          </div>
                          <Play className="h-3.5 w-3.5 text-muted-foreground/20 group-hover:text-primary shrink-0 transition-colors" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════
   CASE SECTION COMPONENT
   ═══════════════════════════════════════ */
function CaseSection({ title, content, highlight }: { title: string; content: string; highlight?: boolean }) {
  return (
    <div className={`${highlight ? 'p-4 rounded-xl bg-primary/5 border border-primary/10' : ''}`}>
      <h4 className={`text-xs font-semibold uppercase tracking-wider mb-1.5 ${
        highlight ? 'text-primary' : 'text-muted-foreground'
      }`}>{title}</h4>
      <p className="text-sm text-foreground/85 leading-relaxed">{content}</p>
    </div>
  );
}
