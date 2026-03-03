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

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { MarkdownRenderer } from '@/components/MarkdownRenderer';
import { 
  Sparkles, X, Send, BookOpen, Lightbulb, 
  Loader2, MessageCircle,
  GraduationCap, FileText, Scale
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
  unitName: string;
  sections: StudySection[];
  onClose?: () => void;
  onProceed: () => void;
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
            <div className="flex justify-start">
              <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-3">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  <span className="text-sm text-muted-foreground">Thinking...</span>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-4 border-t">
          <div className="flex gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Ask a follow-up question..."
              className="min-h-[44px] max-h-32 resize-none"
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

export default function InteractiveStudyNotes({
  skillName,
  unitName,
  sections,
  onClose,
  onProceed,
}: InteractiveStudyNotesProps) {
  const slides = useMemo(
    () => sections.slice(0, Math.max(1, Math.min(sections.length, 10))),
    [sections]
  );
  const [slideIndex, setSlideIndex] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(slides[0]?.id || null);
  const [selectedText, setSelectedText] = useState('');
  const [tooltipPosition, setTooltipPosition] = useState<{ x: number; y: number } | null>(null);
  const [showAIChat, setShowAIChat] = useState(false);
  const [aiChatText, setAIChatText] = useState('');
  const notesRef = useRef<HTMLDivElement>(null);

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
                    <MarkdownRenderer content={currentSection.content} />
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

        {/* Proceed Button */}
        <Button 
          onClick={onProceed}
          className="w-full h-12 text-base font-semibold bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 shadow-lg"
          size="lg"
        >
          <MessageCircle className="h-5 w-5 mr-2" />
          Start the exercises
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
    </>
  );
}
