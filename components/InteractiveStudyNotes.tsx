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

import { useState, useRef, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { MarkdownRenderer } from '@/components/MarkdownRenderer';
import { 
  Sparkles, X, Send, BookOpen, Lightbulb, 
  ChevronDown, ChevronUp, Loader2, MessageCircle,
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

function AskAITooltip({ selectedText, position, onAskAI, onClose }: AskAITooltipProps) {
  return (
    <div 
      className="fixed z-50 animate-in fade-in-0 zoom-in-95 duration-150"
      style={{ 
        left: Math.min(position.x, window.innerWidth - 160), 
        top: position.y - 45 
      }}
    >
      <div className="bg-primary text-primary-foreground rounded-lg shadow-lg px-3 py-2 flex items-center gap-2">
        <Sparkles className="h-4 w-4" />
        <button 
          onClick={onAskAI}
          className="text-sm font-medium hover:underline"
        >
          Ask AI about this
        </button>
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
}

function AIChatPanel({ initialText, skillName, onClose }: AIChatPanelProps) {
  const { getIdToken } = useAuth();
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([
    { role: 'user', content: `Help me understand this:\n\n"${initialText}"` }
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
            message: `I'm studying "${skillName}". Help me understand this concept:\n\n"${initialText}"`,
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
  }, [initialText, skillName, getIdToken]);

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
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-sm">Ask AI</h3>
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
  const [expandedId, setExpandedId] = useState<string | null>(sections[0]?.id || null);
  const [selectedText, setSelectedText] = useState('');
  const [tooltipPosition, setTooltipPosition] = useState<{ x: number; y: number } | null>(null);
  const [showAIChat, setShowAIChat] = useState(false);
  const [aiChatText, setAIChatText] = useState('');
  const notesRef = useRef<HTMLDivElement>(null);

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

  const getSectionIcon = (index: number) => {
    const icons = [GraduationCap, FileText, Scale, BookOpen];
    const Icon = icons[index % icons.length];
    return <Icon className="h-5 w-5" />;
  };

  return (
    <>
      <div className="space-y-4">
        {/* Header Card */}
        <Card className="bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-blue-950/30 dark:via-indigo-950/30 dark:to-purple-950/30 border-blue-200/50 dark:border-blue-800/50">
          <CardContent className="p-5">
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
                </div>
                <h2 className="font-bold text-lg text-foreground">{skillName}</h2>
                <p className="text-sm text-muted-foreground">{unitName}</p>
              </div>
            </div>
            
            <p className="mt-4 text-sm text-blue-800 dark:text-blue-200 bg-blue-100/50 dark:bg-blue-900/30 rounded-lg px-3 py-2">
              <Lightbulb className="h-4 w-4 inline mr-2 text-amber-500" />
              <strong>Tip:</strong> Highlight any text to ask AI for clarification
            </p>
          </CardContent>
        </Card>

        {/* Notes Sections */}
        <div 
          ref={notesRef}
          onMouseUp={handleMouseUp}
          className="space-y-3"
        >
          {sections.map((section, index) => (
            <Card 
              key={section.id}
              className={`transition-all duration-300 ${
                expandedId === section.id 
                  ? 'ring-2 ring-primary/20 shadow-md' 
                  : 'hover:shadow-sm'
              }`}
            >
              <button
                onClick={() => setExpandedId(expandedId === section.id ? null : section.id)}
                className="w-full p-4 text-left flex items-center gap-3 hover:bg-muted/50 transition-colors rounded-t-lg"
              >
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                  expandedId === section.id 
                    ? 'bg-primary text-primary-foreground' 
                    : 'bg-muted text-muted-foreground'
                }`}>
                  {getSectionIcon(index)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`font-medium line-clamp-2 ${
                    expandedId === section.id ? 'text-primary' : ''
                  }`}>
                    {section.title}
                  </p>
                  {section.source && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {section.source}
                    </p>
                  )}
                </div>
                {expandedId === section.id ? (
                  <ChevronUp className="h-5 w-5 text-primary flex-shrink-0" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                )}
              </button>
              
              {expandedId === section.id && (
                <CardContent className="pt-0 pb-4 px-4 animate-in slide-in-from-top-2 duration-200">
                  <div className="pl-13 border-l-2 border-primary/20 ml-5">
                    <div className="prose prose-sm dark:prose-invert max-w-none pl-4 text-foreground/90 selection:bg-primary/20">
                      <MarkdownRenderer content={section.content} />
                    </div>
                    
                    {section.examTips && (
                      <div className="mt-4 ml-4 p-3 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 rounded-lg border border-amber-200/50 dark:border-amber-800/50">
                        <div className="flex items-start gap-2">
                          <Lightbulb className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="text-xs font-semibold text-amber-800 dark:text-amber-200 mb-1">
                              Exam Tip
                            </p>
                            <p className="text-sm text-amber-700 dark:text-amber-300">
                              {section.examTips}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              )}
            </Card>
          ))}
        </div>

        {/* Proceed Button */}
        <Button 
          onClick={onProceed}
          className="w-full h-12 text-base font-semibold bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 shadow-lg"
          size="lg"
        >
          <MessageCircle className="h-5 w-5 mr-2" />
          I'm Ready for the Question
        </Button>
      </div>

      {/* Ask AI Tooltip */}
      {tooltipPosition && selectedText && (
        <div className="ask-ai-tooltip">
          <AskAITooltip
            selectedText={selectedText}
            position={tooltipPosition}
            onAskAI={handleAskAI}
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
          initialText={aiChatText}
          skillName={skillName}
          onClose={() => setShowAIChat(false)}
        />
      )}
    </>
  );
}
