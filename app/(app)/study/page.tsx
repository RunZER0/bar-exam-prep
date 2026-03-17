'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useTimeTracker } from '@/lib/hooks/useTimeTracker';
import { ATP_UNITS } from '@/lib/constants/legal-content';
import { MarkdownRenderer } from '@/components/MarkdownRenderer';
import EngagingLoader from '@/components/EngagingLoader';
import {
  BookOpen, ChevronRight, ChevronDown, Loader2, Sparkles,
  GraduationCap, FileText, Scale, Shield, Briefcase,
  Building, Gavel, Users as UsersIcon, Building2, Handshake,
  PenTool, Mic, TrendingUp, Search, ArrowLeft, Clock,
  RefreshCw, MessageSquare, BookMarked,
  Layers, Star, Play, X, Lightbulb, Save, Trash2, Send,
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
  const [verbatimLoading, setVerbatimLoading] = useState(false);

  // Ask AI
  const [aiPrompt, setAiPrompt] = useState('');
  const aiInputRef = useRef<HTMLTextAreaElement>(null);

  // Syllabus nodes from DB
  const [syllabusNodes, setSyllabusNodes] = useState<Record<string, Array<{
    id: string; topicName: string; subtopicName: string | null;
    weekNumber: number; isHighYield: boolean; isDraftingNode: boolean;
    sectionReference: string | null; hasNotes: boolean;
  }>>>({});
  const [nodesTotal, setNodesTotal] = useState(0);
  const [nodesLoading, setNodesLoading] = useState(true);
  const [topicSearch, setTopicSearch] = useState('');

  // Saved Notes
  const [savedNotesIndex, setSavedNotesIndex] = useState<Array<{ key: string; skillName: string; unitName: string; savedAt: string }>>([]);
  const [viewingSavedNote, setViewingSavedNote] = useState<{ skillName: string; unitName: string; sections: any[]; savedAt: string } | null>(null);

  // Notes interactive Ask AI
  const [selectedNoteText, setSelectedNoteText] = useState('');
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);
  const [showNotesChat, setShowNotesChat] = useState(false);
  const [notesChatMode, setNotesChatMode] = useState<'chat' | 'quiz'>('chat');
  const [notesChatMessages, setNotesChatMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const [notesChatInput, setNotesChatInput] = useState('');
  const [notesChatLoading, setNotesChatLoading] = useState(false);
  const notesContainerRef = useRef<HTMLDivElement>(null);
  const notesChatEndRef = useRef<HTMLDivElement>(null);

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

  // Fetch syllabus nodes from DB on mount
  useEffect(() => {
    (async () => {
      try {
        const token = await getIdToken();
        const res = await fetch('/api/study/syllabus-nodes', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setSyllabusNodes(data.nodes || {});
          setNodesTotal(data.total || 0);
        }
      } catch { /* silent */ }
      finally { setNodesLoading(false); }
    })();
  }, [getIdToken]);

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

  const fetchVerbatimText = async () => {
    if (!caseOfDay?.id || verbatimLoading) return;
    setVerbatimLoading(true);
    try {
      const token = await getIdToken();
      const res = await fetch('/api/study/case-of-day', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ caseId: caseOfDay.id }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.full_text) {
          setCaseOfDay(prev => prev ? { ...prev, full_text: data.full_text, source_url: data.source_url || prev.source_url } : prev);
        }
        if (data.source_url && (!caseOfDay.source_url || !caseOfDay.source_url.startsWith('http'))) {
          setCaseOfDay(prev => prev ? { ...prev, source_url: data.source_url } : prev);
        }
      }
    } catch { /* silent */ }
    finally { setVerbatimLoading(false); }
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
    if (view === 'notes') { setView('browse'); setNotes(''); setNotesMeta(null); setShowNotesChat(false); }
    else if (view === 'error') { setView('browse'); setNotesError(null); }
    else if (view === 'ask-ai') setView('browse');
    else if (view === 'topics') setView('browse');
    else setView('browse');
  };

  /* ═══════════════════════════════════════
     NOTES INTERACTIVE SYSTEM
     ═══════════════════════════════════════ */
  const SECTION_ICONS = [BookOpen, FileText, Scale, Shield, Briefcase, Building, Gavel, GraduationCap];

  const notesSections = useMemo(() => {
    if (!notes) return [];
    const lines = notes.split('\n');
    const sections: { title: string; content: string }[] = [];
    let currentTitle = '';
    let currentLines: string[] = [];
    for (const line of lines) {
      const h2Match = line.match(/^##\s+(.+)/);
      if (h2Match) {
        if (currentTitle || currentLines.length > 0) {
          const content = currentLines.join('\n').trim();
          if (content) sections.push({ title: currentTitle || 'Overview', content });
        }
        currentTitle = h2Match[1].replace(/\*\*/g, '').replace(/[#]/g, '').trim();
        currentLines = [];
      } else {
        currentLines.push(line);
      }
    }
    if (currentTitle || currentLines.length > 0) {
      const content = currentLines.join('\n').trim();
      if (content) sections.push({ title: currentTitle || 'Overview', content });
    }
    return sections;
  }, [notes]);

  const handleNoteTextSelection = useCallback(() => {
    const selection = window.getSelection();
    const text = selection?.toString().trim();
    if (text && text.length > 5 && text.length < 500) {
      const range = selection?.getRangeAt(0);
      const rect = range?.getBoundingClientRect();
      if (rect) {
        setSelectedNoteText(text);
        setTooltipPos({ x: rect.left + rect.width / 2, y: rect.top + window.scrollY });
      }
    } else {
      setTooltipPos(null);
      setSelectedNoteText('');
    }
  }, []);

  const openNotesChat = useCallback((mode: 'chat' | 'quiz') => {
    const text = selectedNoteText;
    setNotesChatMode(mode);
    setNotesChatMessages([{
      role: 'user',
      content: mode === 'quiz'
        ? `Quiz me on this concept:\n\n"${text}"`
        : `Help me understand this:\n\n"${text}"`
    }]);
    setNotesChatInput('');
    setShowNotesChat(true);
    setTooltipPos(null);
    setSelectedNoteText('');
    setNotesChatLoading(true);
    getIdToken().then(token => {
      fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          message: mode === 'quiz'
            ? `I'm studying "${notesMeta?.topicName}". Quiz me on this: "${text}"`
            : `I'm studying "${notesMeta?.topicName}". Help me understand: "${text}"`,
          competencyType: 'clarification',
          context: { topicArea: notesMeta?.topicName },
        }),
      }).then(async res => {
        if (res.ok) {
          const data = await res.json();
          setNotesChatMessages(prev => [...prev, { role: 'assistant', content: data.response }]);
        } else {
          setNotesChatMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, something went wrong. Try again.' }]);
        }
      }).catch(() => {
        setNotesChatMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, something went wrong. Try again.' }]);
      }).finally(() => setNotesChatLoading(false));
    });
  }, [selectedNoteText, notesMeta, getIdToken]);

  const sendNotesChat = useCallback(async () => {
    if (!notesChatInput.trim() || notesChatLoading) return;
    const msg = notesChatInput.trim();
    setNotesChatInput('');
    setNotesChatMessages(prev => [...prev, { role: 'user', content: msg }]);
    setNotesChatLoading(true);
    try {
      const token = await getIdToken();
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          message: msg,
          competencyType: 'clarification',
          context: { topicArea: notesMeta?.topicName },
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setNotesChatMessages(prev => [...prev, { role: 'assistant', content: data.response }]);
      }
    } catch {} finally {
      setNotesChatLoading(false);
    }
  }, [notesChatInput, notesChatLoading, notesMeta, getIdToken]);

  // Close tooltip on click outside
  useEffect(() => {
    if (!tooltipPos) return;
    const handleClick = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('.notes-ask-tooltip')) {
        setTooltipPos(null);
        setSelectedNoteText('');
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [tooltipPos]);

  // Scroll chat to bottom
  useEffect(() => {
    notesChatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [notesChatMessages]);

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
    const hasSections = notesSections.length > 1;

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
          <div className="mb-4">
            <h1 className="text-2xl font-bold">{notesMeta?.topicName}</h1>
            {notesMeta?.unitName && (
              <p className="text-sm text-muted-foreground mt-1">{notesMeta.unitName}</p>
            )}
          </div>

          {/* Interactive tip */}
          <div className="mb-6 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary/5 border border-primary/10">
            <Sparkles className="h-3.5 w-3.5 text-primary/60 shrink-0" />
            <p className="text-xs text-primary/70">
              <strong>Tip:</strong> Highlight any text to ask AI for clarification or get quizzed on it.
            </p>
          </div>

          {/* Notes content — sectioned cards */}
          <div ref={notesContainerRef} onMouseUp={handleNoteTextSelection} className="space-y-4 selection:bg-primary/20">
            {hasSections ? notesSections.map((section, i) => {
              const SectionIcon = SECTION_ICONS[i % SECTION_ICONS.length];
              return (
                <div key={i} className="rounded-xl border border-border/30 bg-card/50 overflow-hidden transition-shadow hover:shadow-sm">
                  <div className="flex items-center gap-3 px-5 py-3 bg-muted/30 border-b border-border/20">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <SectionIcon className="h-4 w-4 text-primary/70" />
                    </div>
                    <h2 className="font-semibold text-base text-foreground">{section.title}</h2>
                  </div>
                  <div className="px-5 py-4 prose prose-sm dark:prose-invert max-w-none
                    prose-headings:font-bold prose-headings:text-foreground
                    prose-h3:text-base prose-h3:mt-4 prose-h3:mb-2
                    prose-blockquote:border-l-primary/40 prose-blockquote:bg-primary/5 prose-blockquote:py-1 prose-blockquote:px-4 prose-blockquote:rounded-r-lg
                    prose-strong:text-foreground
                    prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded
                    prose-li:marker:text-primary/60
                  ">
                    <MarkdownRenderer content={section.content} />
                  </div>
                </div>
              );
            }) : (
              /* Fallback: single card if no ## headings found */
              <div className="rounded-xl border border-border/30 bg-card/50 overflow-hidden">
                <div className="px-5 py-5 prose prose-sm dark:prose-invert max-w-none
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
              </div>
            )}
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

        {/* Ask AI Tooltip */}
        {selectedNoteText && tooltipPos && (
          <div
            className="notes-ask-tooltip fixed z-50 animate-in fade-in-0 zoom-in-95 duration-150"
            style={{ left: Math.min(tooltipPos.x, typeof window !== 'undefined' ? window.innerWidth - 240 : 400), top: tooltipPos.y - 45 }}
          >
            <div className="bg-primary text-primary-foreground rounded-lg shadow-lg px-3 py-2 flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              <button onClick={() => openNotesChat('chat')} className="text-sm font-medium hover:underline">Ask AI</button>
              <div className="w-px h-3 bg-primary-foreground/30" />
              <button onClick={() => openNotesChat('quiz')} className="text-sm font-medium hover:underline flex items-center gap-1">
                <GraduationCap className="h-3 w-3" /> Quiz Me
              </button>
              <button onClick={() => { setSelectedNoteText(''); setTooltipPos(null); }} className="ml-1 opacity-70 hover:opacity-100">
                <X className="h-3 w-3" />
              </button>
            </div>
            <div className="w-3 h-3 bg-primary rotate-45 absolute left-1/2 -translate-x-1/2 -bottom-1.5" />
          </div>
        )}

        {/* AI Chat Panel */}
        {showNotesChat && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 animate-in fade-in-0 duration-200">
            <div className="w-full max-w-2xl max-h-[80vh] flex flex-col bg-background rounded-xl shadow-2xl border overflow-hidden">
              {/* Chat Header */}
              <div className="flex items-center justify-between p-4 border-b bg-gradient-to-r from-primary/10 to-primary/5">
                <div className="flex items-center gap-2">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    notesChatMode === 'quiz' ? 'bg-orange-100 dark:bg-orange-900/40 text-orange-600' : 'bg-primary/20 text-primary'
                  }`}>
                    {notesChatMode === 'quiz' ? <GraduationCap className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm">{notesChatMode === 'quiz' ? 'Note Quiz' : 'Ask AI'}</h3>
                    <p className="text-xs text-muted-foreground">{notesMeta?.topicName}</p>
                  </div>
                </div>
                <button onClick={() => setShowNotesChat(false)} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {notesChatMessages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${
                      msg.role === 'user' ? 'bg-primary text-primary-foreground rounded-br-md' : 'bg-muted rounded-bl-md'
                    }`}>
                      {msg.role === 'assistant' ? <MarkdownRenderer content={msg.content} /> : <p className="text-sm whitespace-pre-wrap">{msg.content}</p>}
                    </div>
                  </div>
                ))}
                {notesChatLoading && (
                  <div className="flex justify-start">
                    <div className="rounded-2xl px-4 py-2.5 bg-muted rounded-bl-md">
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    </div>
                  </div>
                )}
                <div ref={notesChatEndRef} />
              </div>

              {/* Chat Input */}
              <div className="p-4 border-t">
                <div className="flex gap-2">
                  <input
                    value={notesChatInput}
                    onChange={e => setNotesChatInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendNotesChat(); } }}
                    placeholder="Ask a follow-up question..."
                    className="flex-1 px-4 py-2.5 rounded-xl bg-muted/20 border border-border/20 text-sm outline-none focus:ring-1 focus:ring-primary/20 transition-colors"
                    autoFocus
                  />
                  <button
                    onClick={sendNotesChat}
                    disabled={!notesChatInput.trim() || notesChatLoading}
                    className="px-3 py-2.5 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-40"
                  >
                    <Send className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
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
                    onClick={() => {
                      setCaseTab(t);
                      // Auto-fetch verbatim text when switching to that tab
                      if (t === 'verbatim' && caseOfDay && !caseOfDay.full_text && !verbatimLoading) {
                        setTimeout(fetchVerbatimText, 0);
                      }
                    }}
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
                    ) : verbatimLoading ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <div className="h-8 w-8 mx-auto mb-2 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                        <p className="text-xs">Fetching judgment from Kenya Law...</p>
                      </div>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        <FileText className="h-8 w-8 mx-auto mb-2 opacity-30" />
                        <p className="text-xs mb-3">Verbatim text not yet loaded for this case.</p>
                        <button
                          onClick={fetchVerbatimText}
                          className="px-4 py-2 rounded-lg bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors"
                        >
                          📖 Fetch Full Judgment from Kenya Law
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {caseOfDay.source_url && caseOfDay.source_url.startsWith('http') && (
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
              Syllabus Topics • {nodesLoading ? '...' : `${nodesTotal} nodes across ${ATP_UNITS.length} units`}
            </h2>

            {/* Search filter */}
            <div className="relative mb-2">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50" />
              <input
                type="text"
                value={topicSearch}
                onChange={e => setTopicSearch(e.target.value)}
                placeholder="Search topics..."
                className="w-full pl-8 pr-3 py-2 text-xs rounded-lg border border-border/30 bg-card/50 focus:outline-none focus:ring-1 focus:ring-primary/30 placeholder:text-muted-foreground/40"
              />
              {topicSearch && (
                <button onClick={() => setTopicSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2">
                  <X className="h-3 w-3 text-muted-foreground/50 hover:text-foreground" />
                </button>
              )}
            </div>

            <div className="space-y-1">
              {ATP_UNITS.map(unit => {
                const Icon = ICON_MAP[unit.icon] || BookOpen;
                // Map unit.id (atp-100) to DB unit_code (ATP100)
                const dbKey = unit.id.replace(/-/g, '').toUpperCase();
                const dbTopics = syllabusNodes[dbKey] || [];
                const isExpanded = expandedUnits.has(unit.id);

                // Filter topics by search
                const searchLower = topicSearch.toLowerCase();
                const filteredTopics = topicSearch
                  ? dbTopics.filter(t =>
                      t.topicName.toLowerCase().includes(searchLower) ||
                      (t.subtopicName && t.subtopicName.toLowerCase().includes(searchLower)) ||
                      (t.sectionReference && t.sectionReference.toLowerCase().includes(searchLower))
                    )
                  : dbTopics;

                // Auto-expand units with search matches
                const shouldExpand = isExpanded || (topicSearch && filteredTopics.length > 0);
                if (topicSearch && filteredTopics.length === 0) return null;

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
                        <span className="text-[10px] text-muted-foreground">
                          {topicSearch ? `${filteredTopics.length}/${dbTopics.length}` : dbTopics.length || (nodesLoading ? '...' : '0')}
                        </span>
                        <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground/40 transition-transform duration-200 ${shouldExpand ? 'rotate-180' : ''}`} />
                      </div>
                    </button>

                    {/* Topics Dropdown */}
                    {shouldExpand && filteredTopics.length > 0 && (
                      <div className="border-t border-border/20 bg-muted/20 animate-in fade-in slide-in-from-top-1 duration-200 max-h-[60vh] overflow-y-auto">
                        {filteredTopics.map((node, idx) => {
                          const displayName = node.subtopicName
                            ? `${node.topicName}: ${node.subtopicName}`
                            : node.topicName;
                          return (
                            <button
                              key={node.id}
                              onClick={() => {
                                setSelectedUnit(unit);
                                setSelectedTopic({ id: node.id, name: displayName, description: '' });
                                setNotesError(null);
                                setView('loading');
                                setNotesLoading(true);
                                getIdToken().then(token => {
                                  fetch('/api/study/notes', {
                                    method: 'POST',
                                    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                      nodeId: node.id,
                                      topicName: displayName,
                                      unitName: unit.name,
                                      unitId: unit.id,
                                      depth: 'standard',
                                      withAssessment: false,
                                    }),
                                  }).then(async res => {
                                    const data = await res.json().catch(() => ({}));
                                    if (res.ok && data.notes) {
                                      setNotes(data.notes);
                                      setNotesMeta({ topicName: data.topicName || displayName, unitName: data.unitName || unit.name });
                                      setAvailableTopics([]);
                                      setView('notes');
                                    } else {
                                      setNotesError(data.error || 'Failed to load notes. Please try again.');
                                      setView('error');
                                    }
                                  }).catch(() => {
                                    setNotesError('Network error. Please check your connection.');
                                    setView('error');
                                  }).finally(() => setNotesLoading(false));
                                }).catch(() => { setNotesError('Authentication error.'); setView('error'); setNotesLoading(false); });
                              }}
                              className="w-full flex items-center gap-2.5 px-3 py-2 pl-12 hover:bg-card/60 transition-colors group border-b border-border/10 last:border-0"
                            >
                              <div className="w-5 h-5 rounded-md bg-primary/5 flex items-center justify-center shrink-0 text-[9px] font-semibold text-primary/50 group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                                {idx + 1}
                              </div>
                              <div className="flex-1 text-left min-w-0">
                                <p className="text-xs font-medium group-hover:text-primary transition-colors truncate">{displayName}</p>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  {node.isHighYield && (
                                    <span className="text-[9px] px-1 py-0.5 rounded bg-amber-500/10 text-amber-600 font-medium">High Yield</span>
                                  )}
                                  {node.isDraftingNode && (
                                    <span className="text-[9px] px-1 py-0.5 rounded bg-blue-500/10 text-blue-600 font-medium">Drafting</span>
                                  )}
                                  {node.sectionReference && (
                                    <span className="text-[9px] text-muted-foreground/60 truncate">{node.sectionReference}</span>
                                  )}
                                </div>
                              </div>
                              {node.hasNotes ? (
                                <Play className="h-3 w-3 text-muted-foreground/20 group-hover:text-primary shrink-0 transition-colors" />
                              ) : (
                                <Sparkles className="h-3 w-3 text-muted-foreground/20 group-hover:text-amber-500 shrink-0 transition-colors" />
                              )}
                            </button>
                          );
                        })}
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
