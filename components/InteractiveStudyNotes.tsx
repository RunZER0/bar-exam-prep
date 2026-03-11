'use client';

/**
 * Interactive Study Notes Component
 * 
 * Features:
 * - Clean, intuitive display of study notes
 * - Text selection brings up "Ask AI" tooltip
 * - Clicking opens in-context AI chat with highlighted text
 * - Expandable sections with beautiful styling
 */

import { useState, useRef, useEffect, useCallback, useMemo, Fragment } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { MarkdownRenderer } from '@/components/MarkdownRenderer';
import AiThinkingIndicator from '@/components/AiThinkingIndicator';
import { parseCitations, CitationLink, StatutePanel, type ParsedCitation } from '@/lib/citations';
import { 
  Sparkles, X, Send, BookOpen, Lightbulb, 
  Loader2, MessageCircle, Save, Check,
  GraduationCap, FileText, Scale, Stamp,
  Mic, MicOff, Paperclip, Image as ImageIcon,
} from 'lucide-react';

// ============================================
// TYPES
// ============================================

export interface StudySection {
  id: string;
  title: string;
  content: string;
  source?: string;
  examTips?: string;
}

interface InteractiveStudyNotesProps {
  skillName: string;
  skillId?: string;
  unitName: string;
  sections: StudySection[];
  onClose?: () => void;
  onProceed: () => void;
  learned?: boolean;
  cached?: boolean;
}

// ============================================
// ASK AI TOOLTIP COMPONENT
// ============================================

interface AskAITooltipProps {
  selectedText: string;
  position: { x: number; y: number };
  onAskAI: () => void;
  onClose: () => void;
}

function AskAITooltip({ selectedText, position, onAskAI, onQuizMe, onClose }: AskAITooltipProps & { onQuizMe?: () => void }) {
  return (
    <div 
      className="fixed z-50 animate-in fade-in-0 zoom-in-95 duration-150"
      style={{ 
        left: Math.min(position.x, window.innerWidth - 220), 
        top: position.y - 45 
      }}
    >
      <div className="bg-primary text-primary-foreground rounded-lg shadow-lg px-3 py-2 flex items-center gap-2">
        <Sparkles className="h-4 w-4" />
        <button 
          onClick={onAskAI}
          className="text-sm font-medium hover:underline"
        >
          Ask AI
        </button>
        {onQuizMe && (
          <>
            <div className="w-px h-3 bg-primary-foreground/30" />
            <button 
              onClick={onQuizMe}
              className="text-sm font-medium hover:underline flex items-center gap-1"
            >
              <GraduationCap className="h-3 w-3" />
              Quiz Me
            </button>
          </>
        )}
        <button 
          onClick={onClose}
          className="ml-1 opacity-70 hover:opacity-100"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
      <div 
        className="w-3 h-3 bg-primary rotate-45 absolute left-1/2 -translate-x-1/2 -bottom-1.5"
      />
    </div>
  );
}

// ============================================
// AI CHAT PANEL
// ============================================

interface AIChatPanelProps {
  initialText: string;
  skillName: string;
  onClose: () => void;
  mode?: 'chat' | 'quiz';
}

function AIChatPanel({ initialText, skillName, onClose, mode = 'chat' }: AIChatPanelProps) {
  const { getIdToken } = useAuth();
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([
    { 
      role: 'user', 
      content: mode === 'quiz' 
        ? `Quiz me on this concept:\n\n"${initialText}"` 
        : `Help me understand this:\n\n"${initialText}"` 
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [attachments, setAttachments] = useState<Array<{ id: string; file: File; type: string; preview?: string }>>([]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const newAtts = Array.from(files).map(file => ({
      id: crypto.randomUUID(),
      file,
      type: file.type.startsWith('image/') ? 'image' as const : 'document' as const,
      ...(file.type.startsWith('image/') ? { preview: URL.createObjectURL(file) } : {}),
    }));
    setAttachments(prev => [...prev, ...newAtts]);
    e.target.value = '';
  }, []);

  const removeAttachment = useCallback((id: string) => {
    setAttachments(prev => prev.filter(a => a.id !== id));
  }, []);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        try {
          const token = await getIdToken();
          const formData = new FormData();
          formData.append('audio', audioBlob, 'recording.webm');
          const res = await fetch('/api/transcribe', {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
            body: formData,
          });
          if (res.ok) {
            const data = await res.json();
            if (data.text) setInput(prev => prev ? prev + ' ' + data.text : data.text);
          }
        } catch (err) { console.error('Transcription failed:', err); }
      };
      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      recordingIntervalRef.current = setInterval(() => setRecordingTime(t => t + 1), 1000);
    } catch (err) { console.error('Mic access denied:', err); }
  }, [getIdToken]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    if (recordingIntervalRef.current) { clearInterval(recordingIntervalRef.current); recordingIntervalRef.current = null; }
  }, []);

  // Auto-send first message
  useEffect(() => {
    const askAI = async () => {
      try {
        const token = await getIdToken();
        const response = await fetch('/api/ai/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            message: mode === 'quiz'
              ? `I'm studying "${skillName}". Please generate a short quiz question based on this text to test my understanding: "${initialText}"`
              : `I'm studying "${skillName}". Help me understand this concept:\n\n"${initialText}"`,
            competencyType: 'clarification',
            context: { topicArea: skillName },
          }),
        });

        if (response.ok) {
          const data = await response.json();
          setMessages(prev => [...prev, { role: 'assistant', content: data.response }]);
        } else {
          setMessages(prev => [...prev, { 
            role: 'assistant', 
            content: 'Sorry, I encountered an error. Please try again.' 
          }]);
        }
      } catch (error) {
        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: 'Sorry, I encountered an error. Please try again.' 
        }]);
      } finally {
        setLoading(false);
      }
    };
    
    askAI();
  }, [initialText, skillName, getIdToken, mode]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    
    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setLoading(true);

    try {
      const token = await getIdToken();
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          message: userMessage,
          competencyType: 'clarification',
          context: { topicArea: skillName },
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setMessages(prev => [...prev, { role: 'assistant', content: data.response }]);
      }
    } catch (error) {
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: 'Sorry, I encountered an error. Please try again.' 
      }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 animate-in fade-in-0 duration-200">
      <Card className="w-full max-w-2xl max-h-[80vh] flex flex-col bg-background shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-gradient-to-r from-primary/10 to-primary/5">
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
              mode === 'quiz' ? 'bg-orange-100 text-orange-600' : 'bg-primary/20 text-primary'
            }`}>
              {mode === 'quiz' ? <GraduationCap className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
            </div>
            <div>
              <h3 className="font-semibold text-sm">{mode === 'quiz' ? 'Note Quiz' : 'Ask AI'}</h3>
              <p className="text-xs text-muted-foreground">{skillName}</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((msg, i) => (
            <div 
              key={i} 
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div 
                className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${
                  msg.role === 'user' 
                    ? 'bg-primary text-primary-foreground rounded-br-md' 
                    : 'bg-muted rounded-bl-md'
                }`}
              >
                {msg.role === 'assistant' ? (
                  <MarkdownRenderer content={msg.content} />
                ) : (
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                )}
              </div>
            </div>
          ))}
          {loading && (
            <AiThinkingIndicator variant="inline" messageSet="thinking" />
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-4 border-t">
          {/* Attachment Preview */}
          {attachments.length > 0 && (
            <div className="flex gap-2 mb-2 flex-wrap">
              {attachments.map(att => (
                <div key={att.id} className="relative group">
                  {att.type === 'image' && att.preview ? (
                    <img src={att.preview} alt="" className="h-14 w-14 rounded-lg object-cover border" />
                  ) : (
                    <div className="h-14 w-14 rounded-lg border bg-muted flex items-center justify-center">
                      <FileText className="h-5 w-5 text-muted-foreground" />
                    </div>
                  )}
                  <button onClick={() => removeAttachment(att.id)} className="absolute -top-1.5 -right-1.5 bg-destructive text-destructive-foreground rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <input ref={fileInputRef} type="file" className="hidden" accept="image/*,.pdf,.doc,.docx,.txt" multiple onChange={handleFileSelect} />
          <div className="flex gap-2 items-end">
            <div className="flex items-center gap-0.5 shrink-0">
              <button
                className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                title="Attach file"
                onClick={() => fileInputRef.current?.click()}
              >
                <Paperclip className="h-4 w-4" />
              </button>
              <button
                className={`p-1.5 rounded-lg transition-colors ${isRecording ? 'bg-red-500/15 text-red-500' : 'hover:bg-muted text-muted-foreground hover:text-foreground'}`}
                title="Voice input"
                onClick={isRecording ? stopRecording : startRecording}
              >
                {isRecording ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </button>
              {isRecording && (
                <span className="text-xs text-red-500 font-mono">{Math.floor(recordingTime / 60)}:{String(recordingTime % 60).padStart(2, '0')}</span>
              )}
            </div>
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                const el = e.target;
                el.style.height = 'auto';
                el.style.height = Math.min(el.scrollHeight, 128) + 'px';
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Ask a follow-up question..."
              className="flex-1 min-h-[44px] max-h-32 resize-none rounded-xl bg-muted/20 border border-border/20 px-3 py-2.5 text-sm outline-none focus:ring-1 focus:ring-primary/20 transition-colors"
              rows={1}
            />
            <Button 
              onClick={handleSend} 
              disabled={!input.trim() || loading}
              size="icon"
              className="h-11 w-11"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

/* ---- Citation-aware Markdown: renders text with clickable legal citations ---- */
function CitationMarkdown({ content, onCitationClick }: { content: string; onCitationClick: (c: ParsedCitation) => void }) {
  // Split content into lines and render each with citation detection
  const lines = content.split('\n');
  return (
    <div className="space-y-2">
      {lines.map((line, i) => {
        const trimmed = line.trim();
        if (!trimmed) return <br key={i} />;

        // Headers
        const h3 = trimmed.match(/^###\s+(.*)/);
        if (h3) return <h3 key={i} className="text-base font-semibold mt-3 mb-1.5"><RenderCitationText text={h3[1]} onCitationClick={onCitationClick} /></h3>;
        const h2 = trimmed.match(/^##\s+(.*)/);
        if (h2) return <h2 key={i} className="text-lg font-semibold mt-4 mb-2"><RenderCitationText text={h2[1]} onCitationClick={onCitationClick} /></h2>;
        const h1 = trimmed.match(/^#\s+(.*)/);
        if (h1) return <h1 key={i} className="text-xl font-bold mt-4 mb-2"><RenderCitationText text={h1[1]} onCitationClick={onCitationClick} /></h1>;

        // List items
        const li = trimmed.match(/^[-*+]\s+(.*)/);
        if (li) return <li key={i} className="leading-relaxed ml-5 list-disc"><RenderCitationText text={li[1]} onCitationClick={onCitationClick} /></li>;

        // Blockquote
        if (trimmed.startsWith('>')) {
          return (
            <blockquote key={i} className="border-l-4 border-primary/40 pl-4 py-1 bg-muted/30 rounded-r-lg italic text-muted-foreground">
              <RenderCitationText text={trimmed.replace(/^>\s*/, '')} onCitationClick={onCitationClick} />
            </blockquote>
          );
        }

        // Regular paragraph
        return <p key={i} className="mb-2 leading-relaxed"><RenderCitationText text={trimmed} onCitationClick={onCitationClick} /></p>;
      })}
    </div>
  );
}

function RenderCitationText({ text, onCitationClick }: { text: string; onCitationClick: (c: ParsedCitation) => void }) {
  const citations = parseCitations(text);
  if (citations.length === 0) {
    // Still apply bold/italic
    return <>{applyInlineFormatting(text)}</>;
  }
  const parts: React.ReactNode[] = [];
  let last = 0;
  citations.forEach((c, i) => {
    if (c.startIndex > last) parts.push(<Fragment key={`t${i}`}>{applyInlineFormatting(text.slice(last, c.startIndex))}</Fragment>);
    parts.push(<CitationLink key={`c${i}`} text={c.fullMatch} type={c.type} onClick={() => onCitationClick(c)} />);
    last = c.endIndex;
  });
  if (last < text.length) parts.push(<Fragment key="tail">{applyInlineFormatting(text.slice(last))}</Fragment>);
  return <>{parts}</>;
}

function applyInlineFormatting(text: string): React.ReactNode {
  // Bold and italic inline
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={i} className="font-semibold text-foreground">{part.slice(2, -2)}</strong>;
    if (part.startsWith('*') && part.endsWith('*')) return <em key={i}>{part.slice(1, -1)}</em>;
    return part;
  });
}

export default function InteractiveStudyNotes({
  skillName,
  skillId,
  unitName,
  sections,
  onClose,
  onProceed,
  learned: initialLearned,
  cached,
}: InteractiveStudyNotesProps) {
  const { getIdToken } = useAuth();
  const slides = useMemo(
    () => sections.slice(0, Math.max(1, Math.min(sections.length, 15))),
    [sections]
  );
  const [slideIndex, setSlideIndex] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(slides[0]?.id || null);
  const [selectedText, setSelectedText] = useState('');
  const [tooltipPosition, setTooltipPosition] = useState<{ x: number; y: number } | null>(null);
  const [showAIChat, setShowAIChat] = useState(false);
  const [aiChatText, setAIChatText] = useState('');
  const [showSavePrompt, setShowSavePrompt] = useState(false);
  const [notesSaved, setNotesSaved] = useState(false);
  const [isLearned, setIsLearned] = useState(initialLearned || false);
  const [stampLoading, setStampLoading] = useState(false);
  const [activeCitation, setActiveCitation] = useState<ParsedCitation | null>(null);
  const notesRef = useRef<HTMLDivElement>(null);

  // Check if notes were already saved
  useEffect(() => {
    const key = `saved-notes-${unitName}-${skillName}`;
    if (typeof window !== 'undefined' && localStorage.getItem(key)) {
      setNotesSaved(true);
    }
  }, [unitName, skillName]);

  const handleSaveNotes = useCallback(() => {
    const key = `saved-notes-${unitName}-${skillName}`;
    const notesData = {
      skillName,
      unitName,
      sections: sections.map(s => ({ id: s.id, title: s.title, content: s.content, source: s.source, examTips: s.examTips })),
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem(key, JSON.stringify(notesData));
    
    // Also maintain an index of all saved notes
    const indexKey = 'saved-notes-index';
    const existing = JSON.parse(localStorage.getItem(indexKey) || '[]') as Array<{ key: string; skillName: string; unitName: string; savedAt: string }>;
    const filtered = existing.filter(e => e.key !== key);
    filtered.push({ key, skillName, unitName, savedAt: notesData.savedAt });
    localStorage.setItem(indexKey, JSON.stringify(filtered));
    
    setNotesSaved(true);
    setShowSavePrompt(false);
  }, [unitName, skillName, sections]);

  const handleStampLearned = useCallback(async () => {
    if (!skillId || stampLoading) return;
    setStampLoading(true);
    try {
      const token = await getIdToken();
      await fetch('/api/mastery/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ skillId, action: isLearned ? 'unlearn' : 'learn' }),
      });
      setIsLearned(!isLearned);
    } catch (err) {
      console.error('Stamp error:', err);
      setIsLearned(!isLearned); // Optimistic toggle
    } finally {
      setStampLoading(false);
    }
  }, [skillId, isLearned, stampLoading, getIdToken]);

  const handleProceedClick = useCallback(() => {
    if (!notesSaved) {
      setShowSavePrompt(true);
    } else {
      onProceed();
    }
  }, [notesSaved, onProceed]);

  useEffect(() => {
    setExpandedId(slides[slideIndex]?.id || null);
  }, [slideIndex, slides]);

  // Handle text selection
  const handleMouseUp = useCallback(() => {
    const selection = window.getSelection();
    const text = selection?.toString().trim();
    
    if (text && text.length > 5 && text.length < 500) {
      const range = selection?.getRangeAt(0);
      const rect = range?.getBoundingClientRect();
      
      if (rect) {
        setSelectedText(text);
        setTooltipPosition({ 
          x: rect.left + rect.width / 2, 
          y: rect.top + window.scrollY 
        });
      }
    } else {
      setTooltipPosition(null);
      setSelectedText('');
    }
  }, []);

  // Close tooltip on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (tooltipPosition && !(e.target as HTMLElement).closest('.ask-ai-tooltip')) {
        setTooltipPosition(null);
        setSelectedText('');
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [tooltipPosition]);

  const handleAskAI = () => {
    setAIChatText(selectedText);
    setShowAIChat(true);
    setTooltipPosition(null);
    setSelectedText('');
  };

  const handleQuizMe = () => {
    setAIChatText(`QUIZ_ME:${selectedText}`); // Special prefix to trigger quiz mode
    setShowAIChat(true);
    setTooltipPosition(null);
    setSelectedText('');
  };

  const getSectionIcon = (index: number) => {
    const icons = [GraduationCap, FileText, Scale, BookOpen];
    const Icon = icons[index % icons.length];
    return <Icon className="h-5 w-5" />;
  };

  const goPrev = () => setSlideIndex((prev) => Math.max(0, prev - 1));
  const goNext = () => setSlideIndex((prev) => Math.min(slides.length - 1, prev + 1));
  const progressPercent = Math.round(((slideIndex + 1) / (slides.length || 1)) * 100);
  const currentSection = slides[slideIndex];

  return (
    <>
      <div className="space-y-4">
        {/* Header Card */}
        <Card className="bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-blue-950/30 dark:via-indigo-950/30 dark:to-purple-950/30 border-blue-200/50 dark:border-blue-800/50">
          <CardContent className="p-5 space-y-4">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg">
                <BookOpen className="h-6 w-6 text-white" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/50 px-2 py-0.5 rounded-full">
                    Step 1 of 2
                  </span>
                  <span className="text-xs text-muted-foreground">Study First</span>
                  <span className="text-xs font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                    Slide {slideIndex + 1} of {slides.length}
                  </span>
                </div>
                <h2 className="font-bold text-lg text-foreground">{skillName}</h2>
                <p className="text-sm text-muted-foreground">{unitName}</p>
              </div>
              {skillId && (
                <button
                  onClick={handleStampLearned}
                  disabled={stampLoading}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                    isLearned
                      ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 ring-1 ring-green-300 dark:ring-green-700'
                      : 'bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary'
                  }`}
                  title={isLearned ? 'Marked as learned — click to undo' : 'Mark as learned'}
                >
                  {stampLoading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : isLearned ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : (
                    <Stamp className="h-3.5 w-3.5" />
                  )}
                  {isLearned ? 'Learned' : 'Mark Learned'}
                </button>
              )}
            </div>

            <div className="flex items-center gap-3">
              <div className="flex-1 h-2 rounded-full bg-primary/10 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-primary to-primary/70 transition-all"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <span className="text-xs font-medium text-muted-foreground w-16 text-right">{progressPercent}%</span>
            </div>

            <p className="text-sm text-blue-800 dark:text-blue-200 bg-blue-100/50 dark:bg-blue-900/30 rounded-lg px-3 py-2">
              <Lightbulb className="h-4 w-4 inline mr-2 text-amber-500" />
              <strong>Tip:</strong> Highlight any text to ask AI for clarification. Use Next to advance slide-by-slide.
            </p>
          </CardContent>
        </Card>

        {/* Notes Sections */}
        <div 
          ref={notesRef}
          onMouseUp={handleMouseUp}
          className="space-y-3"
        >
          {currentSection && (
            <Card 
              key={currentSection.id}
              className={`transition-all duration-300 ${
                expandedId === currentSection.id 
                  ? 'ring-2 ring-primary/20 shadow-md' 
                  : 'hover:shadow-sm'
              }`}
            >
              <div className="w-full p-4 flex items-center gap-3 bg-muted/30 rounded-t-lg">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                  expandedId === currentSection.id 
                    ? 'bg-primary text-primary-foreground' 
                    : 'bg-muted text-muted-foreground'
                }`}>
                  {getSectionIcon(slideIndex)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-primary line-clamp-2">
                    Slide {slideIndex + 1}: {currentSection.title}
                  </p>
                  {currentSection.source && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {currentSection.source}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{slideIndex + 1}/{slides.length}</span>
                </div>
              </div>

              <CardContent className="pt-0 pb-4 px-4 animate-in slide-in-from-top-2 duration-200">
                <div className="pl-1 border-l-2 border-primary/20 ml-1">
                  <div className="prose prose-sm dark:prose-invert max-w-none pl-3 text-foreground/90 selection:bg-primary/20">
                    <CitationMarkdown content={currentSection.content} onCitationClick={(c) => setActiveCitation(c)} />
                  </div>

                  {currentSection.examTips && (
                    <div className="mt-4 ml-3 p-3 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 rounded-lg border border-amber-200/50 dark:border-amber-800/50">
                      <div className="flex items-start gap-2">
                        <Lightbulb className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-xs font-semibold text-amber-800 dark:text-amber-200 mb-1">
                            Exam Tip
                          </p>
                          <p className="text-sm text-amber-700 dark:text-amber-300">
                            {currentSection.examTips}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="mt-4 ml-3 flex flex-col gap-3 rounded-lg border border-border/60 bg-muted/30 p-3">
                    <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                      <MessageCircle className="h-4 w-4 text-primary" />
                      Quick follow-up on this slide
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-muted-foreground">
                      <span>1) What is the key rule here?</span>
                      <span>2) How would it apply to a simple fact pattern?</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="secondary" onClick={() => { setSelectedText(currentSection.content.slice(0, 240)); setAIChatText(currentSection.content.slice(0, 240)); setShowAIChat(true); }}>
                        Ask AI about this slide
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setExpandedId(currentSection.id)}>
                        Re-read slide
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Slide navigation */}
          <div className="flex items-center justify-between gap-3">
            <Button variant="outline" size="sm" onClick={goPrev} disabled={slideIndex === 0}>
              Prev slide
            </Button>
            <div className="flex items-center gap-2 flex-1 justify-center">
              {slides.map((s, idx) => (
                <button
                  key={s.id}
                  onClick={() => setSlideIndex(idx)}
                  className={`h-2.5 rounded-full transition-all ${
                    idx === slideIndex ? 'w-8 bg-primary' : 'w-4 bg-muted'
                  }`}
                  aria-label={`Go to slide ${idx + 1}`}
                />
              ))}
            </div>
            <Button variant="outline" size="sm" onClick={goNext} disabled={slideIndex === slides.length - 1}>
              Next slide
            </Button>
          </div>
        </div>

        {/* Save Notes Prompt */}
        {showSavePrompt && (
          <div className="rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 border border-amber-200/50 dark:border-amber-800/50 p-4 space-y-3 animate-in fade-in slide-in-from-bottom-3 duration-300">
            <div className="flex items-center gap-2">
              <Save className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <p className="text-sm font-medium text-amber-800 dark:text-amber-300">Save these notes for later?</p>
            </div>
            <p className="text-xs text-amber-700/80 dark:text-amber-400/70">
              You can revisit saved notes anytime from the study page without fetching them again.
            </p>
            <div className="flex gap-2">
              <Button
                onClick={handleSaveNotes}
                size="sm"
                className="flex-1 bg-amber-600 hover:bg-amber-700 text-white"
              >
                <Save className="h-3.5 w-3.5 mr-1.5" />
                Save Notes
              </Button>
              <Button
                onClick={() => { setShowSavePrompt(false); onProceed(); }}
                variant="outline"
                size="sm"
                className="flex-1"
              >
                Skip & Continue
              </Button>
            </div>
          </div>
        )}

        {/* Proceed Button */}
        <Button 
          onClick={handleProceedClick}
          className="w-full h-12 text-base font-semibold bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 shadow-lg"
          size="lg"
        >
          {notesSaved ? (
            <>
              <Check className="h-5 w-5 mr-2 text-green-200" />
              Notes Saved — Start Exercises
            </>
          ) : (
            <>
              <MessageCircle className="h-5 w-5 mr-2" />
              Start the exercises
            </>
          )}
        </Button>
      </div>

      {/* Ask AI Tooltip */}
      {tooltipPosition && selectedText && (
        <div className="ask-ai-tooltip">
          <AskAITooltip
            selectedText={selectedText}
            position={tooltipPosition}
            onAskAI={handleAskAI}
            onQuizMe={handleQuizMe}
            onClose={() => {
              setTooltipPosition(null);
              setSelectedText('');
            }}
          />
        </div>
      )}

      {/* AI Chat Modal */}
      {showAIChat && (
        <AIChatPanel
          initialText={aiChatText.startsWith('QUIZ_ME:') ? aiChatText.replace('QUIZ_ME:', '') : aiChatText}
          skillName={skillName}
          onClose={() => setShowAIChat(false)}
          mode={aiChatText.startsWith('QUIZ_ME:') ? 'quiz' : 'chat'}
        />
      )}

      {/* Statute / Case Law Panel */}
      <StatutePanel citation={activeCitation} onClose={() => setActiveCitation(null)} getIdToken={getIdToken} />
    </>
  );
}
