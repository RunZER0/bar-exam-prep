'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { getUnitById } from '@/lib/constants/legal-content';
import { Button } from '@/components/ui/button';
import { SmartChatInput } from '@/components/SmartChatInput';
import {
  ArrowLeft,
  BookOpen,
  Loader2,
  AlertTriangle,
  Copy,
  Check,
  RotateCcw,
  FileText,
  Scale,
  Lightbulb,
  Sparkles,
  GraduationCap,
  Library,
  ChevronDown,
  Bookmark,
} from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  filtered?: boolean;
  sources?: {
    provisions: Array<{ title: string; source: string; section: string }>;
    cases: Array<{ name: string; citation: string }>;
  };
  timestamp: Date;
}

interface SmartSuggestion {
  topic: string;
  reason: string;
  prompt: string;
}

const QUICK_PROMPTS = [
  { label: 'Key Concepts', prompt: 'Explain the fundamental concepts and principles I need to master for this unit.', icon: Lightbulb },
  { label: 'Important Statutes', prompt: 'Walk me through the key statutory provisions and their practical applications.', icon: FileText },
  { label: 'Landmark Cases', prompt: 'What are the essential Kenyan cases I should know? Explain each ratio decidendi.', icon: Scale },
  { label: 'Exam Strategy', prompt: 'What topics are frequently examined and how should I approach bar exam questions?', icon: GraduationCap },
];

export default function StudyUnitPage() {
  const params = useParams();
  const router = useRouter();
  const { getIdToken } = useAuth();

  const unitId = params.unitId as string;
  const unit = getUnitById(unitId);

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [sessionId] = useState(() => crypto.randomUUID());
  const [copied, setCopied] = useState<string | null>(null);
  const [smartSuggestions, setSmartSuggestions] = useState<SmartSuggestion[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [showSources, setShowSources] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  useEffect(() => {
    if (unit) {
      loadSmartSuggestions();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unit?.id]);

  const loadSmartSuggestions = async () => {
    if (!unit) return;
    setLoadingSuggestions(true);
    try {
      const token = await getIdToken();
      const res = await fetch('/api/ai/suggestions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          unitId: unit.id,
          unitName: unit.name,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setSmartSuggestions(data.suggestions || []);
      }
    } catch (err) {
      console.error('Failed to load suggestions:', err);
    } finally {
      setLoadingSuggestions(false);
    }
  };

  const sendMessage = useCallback(async (overrideMessage?: string) => {
    if (!unit) return;
    const userMessage = overrideMessage || input.trim();
    if (!userMessage || sending) return;

    if (!overrideMessage) setInput('');
    
    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: userMessage,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setSending(true);

    try {
      const token = await getIdToken();
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          message: userMessage,
          competencyType: 'study',
          context: {
            topicArea: unit.name,
            unitId: unit.id,
            statutes: unit.statutes,
          },
          sessionId,
        }),
      });

      if (!res.ok) throw new Error('Failed to get response');

      const data = await res.json();
      
      const assistantMsg: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: data.response,
        filtered: data.filtered,
        sources: data.sources,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      const errorMsg: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: 'I encountered an error processing your request. Please try again.',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setSending(false);
    }
  }, [input, sending, unit, sessionId, getIdToken]);

  const copyToClipboard = (messageId: string, content: string) => {
    navigator.clipboard.writeText(content);
    setCopied(messageId);
    setTimeout(() => setCopied(null), 2000);
  };

  const resetChat = () => {
    setMessages([]);
    setInput('');
  };

  if (!unit) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="text-center">
          <BookOpen className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Unit Not Found</h2>
          <p className="text-muted-foreground mb-4">The study unit you&apos;re looking for doesn&apos;t exist.</p>
          <Button onClick={() => router.push('/study')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Study
          </Button>
        </div>
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex flex-col h-[calc(100vh-3.5rem)] md:h-screen">
        <div className="border-b px-4 md:px-6 py-3 flex items-center gap-3 shrink-0 bg-card/50 backdrop-blur-sm">
          <Button variant="ghost" size="sm" onClick={() => router.push('/study')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded">
                {unit.code}
              </span>
              <h1 className="text-sm font-semibold truncate">{unit.name}</h1>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 md:px-6 py-8">
          <div className="max-w-2xl mx-auto space-y-8">
            <div className="text-center space-y-4">
              <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center mx-auto">
                <Sparkles className="h-8 w-8 text-primary" />
              </div>
              <div>
                <h2 className="text-2xl md:text-3xl font-bold mb-2">Study {unit.name}</h2>
                <p className="text-muted-foreground max-w-lg mx-auto">
                  {unit.description}
                </p>
              </div>
            </div>

            <div className="bg-muted/30 rounded-2xl p-4 border border-border/50">
              <div className="flex items-center gap-2 mb-3">
                <Library className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold">Key Statutes & Legislation</h3>
              </div>
              <div className="flex flex-wrap gap-2">
                {unit.statutes.map((statute, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-full bg-background border border-border/50 text-foreground/80"
                  >
                    <FileText className="h-3 w-3 text-primary" />
                    {statute}
                  </span>
                ))}
              </div>
            </div>

            {(loadingSuggestions || smartSuggestions.length > 0) && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Lightbulb className="h-4 w-4 text-amber-500" />
                  <h3 className="text-sm font-semibold">Smart Study Suggestions</h3>
                  {loadingSuggestions && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
                  {smartSuggestions.map((suggestion, i) => (
                    <button
                      key={i}
                      onClick={() => sendMessage(suggestion.prompt)}
                      className="text-left p-4 rounded-xl bg-muted/50 border border-border/50 hover:border-primary/50 hover:bg-muted/80 transition-all group"
                    >
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <span className="text-sm font-medium group-hover:text-primary transition-colors">
                          {suggestion.topic}
                        </span>
                        <Sparkles className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {suggestion.reason}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-3">
              <h3 className="text-sm font-semibold">Quick Start</h3>
              <div className="grid sm:grid-cols-2 gap-3">
                {QUICK_PROMPTS.map((qp) => {
                  const Icon = qp.icon;
                  return (
                    <button
                      key={qp.label}
                      onClick={() => sendMessage(qp.prompt)}
                      className="flex items-center gap-3 p-4 rounded-xl bg-muted/50 border border-border/50 hover:border-primary/50 hover:bg-muted/80 transition-all text-left group"
                    >
                      <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                        <Icon className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <span className="text-sm font-medium group-hover:text-primary transition-colors">
                          {qp.label}
                        </span>
                        <p className="text-xs text-muted-foreground line-clamp-1">
                          {qp.prompt}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <div className="shrink-0 border-t bg-card/50 backdrop-blur-sm px-4 md:px-6 py-4">
          <div className="max-w-2xl mx-auto">
            <SmartChatInput
              value={input}
              onChange={setInput}
              onSend={() => sendMessage()}
              isLoading={sending}
              placeholder={`Ask anything about ${unit.name}...`}
              suggestions={QUICK_PROMPTS.slice(0, 3).map(qp => ({ label: qp.label, prompt: qp.prompt }))}
              onSuggestionClick={(prompt) => sendMessage(prompt)}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] md:h-screen">
      <div className="border-b px-4 md:px-6 py-3 flex items-center justify-between shrink-0 bg-card/50 backdrop-blur-sm">
        <div className="flex items-center gap-3 min-w-0">
          <Button variant="ghost" size="sm" onClick={() => router.push('/study')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded">
                {unit.code}
              </span>
              <h1 className="text-sm font-semibold truncate">{unit.name}</h1>
            </div>
            <p className="text-xs text-muted-foreground">{messages.length} messages</p>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={resetChat} className="text-muted-foreground hover:text-foreground">
          <RotateCcw className="h-4 w-4 mr-1" />
          <span className="hidden sm:inline">New Chat</span>
        </Button>
      </div>

      <div ref={chatContainerRef} className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 md:px-6 py-6 space-y-6">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[90%] md:max-w-[85%] ${msg.role === 'user' ? '' : 'w-full'}`}>
                {msg.role === 'user' && (
                  <div className="bg-primary text-primary-foreground rounded-2xl rounded-tr-md px-4 py-3">
                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  </div>
                )}

                {msg.role === 'assistant' && (
                  <div className="space-y-3">
                    {msg.filtered && (
                      <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        <span>Response filtered for accuracy - showing verified information only</span>
                      </div>
                    )}

                    <div className="bg-muted/50 rounded-2xl rounded-tl-md px-4 py-3 border border-border/50">
                      <div className="prose prose-sm dark:prose-invert max-w-none">
                        {msg.content.split('\n').map((line, j) => {
                          if (line.startsWith('## ')) {
                            return <h3 key={j} className="text-base font-bold mt-4 mb-2 first:mt-0">{line.slice(3)}</h3>;
                          }
                          if (line.startsWith('### ')) {
                            return <h4 key={j} className="text-sm font-semibold mt-3 mb-1.5">{line.slice(4)}</h4>;
                          }
                          if (line.startsWith('**') && line.endsWith('**')) {
                            return <p key={j} className="font-semibold mt-3 mb-1">{line.slice(2, -2)}</p>;
                          }
                          if (line.startsWith('- ')) {
                            return <p key={j} className="ml-3 my-0.5">• {parseInlineFormatting(line.slice(2))}</p>;
                          }
                          if (/^\d+\.\s/.test(line)) {
                            return <p key={j} className="ml-3 my-0.5">{parseInlineFormatting(line)}</p>;
                          }
                          if (line === '') return <br key={j} />;
                          return <p key={j} className="my-1">{parseInlineFormatting(line)}</p>;
                        })}
                      </div>
                    </div>

                    {msg.sources && (msg.sources.provisions.length > 0 || msg.sources.cases.length > 0) && (
                      <div className="space-y-2">
                        <button
                          onClick={() => setShowSources(showSources === msg.id ? null : msg.id)}
                          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <Library className="h-3.5 w-3.5" />
                          <span>{msg.sources.provisions.length + msg.sources.cases.length} sources referenced</span>
                          <ChevronDown className={`h-3 w-3 transition-transform ${showSources === msg.id ? 'rotate-180' : ''}`} />
                        </button>

                        {showSources === msg.id && (
                          <div className="bg-muted/30 rounded-xl p-3 space-y-2 border border-border/30">
                            {msg.sources.provisions.map((p, i) => (
                              <div key={i} className="flex items-start gap-2 text-xs">
                                <FileText className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                                <div>
                                  <span className="font-medium">{p.section}</span>
                                  <span className="text-muted-foreground"> - {p.title}</span>
                                </div>
                              </div>
                            ))}
                            {msg.sources.cases.map((c, i) => (
                              <div key={i} className="flex items-start gap-2 text-xs">
                                <Scale className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                                <div>
                                  <span className="font-medium">{c.name}</span>
                                  <span className="text-muted-foreground"> {c.citation}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(msg.id, msg.content)}
                        className="h-7 px-2 text-muted-foreground hover:text-foreground"
                      >
                        {copied === msg.id ? (
                          <><Check className="h-3.5 w-3.5 mr-1" /><span className="text-xs">Copied</span></>
                        ) : (
                          <><Copy className="h-3.5 w-3.5 mr-1" /><span className="text-xs">Copy</span></>
                        )}
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 px-2 text-muted-foreground hover:text-foreground">
                        <Bookmark className="h-3.5 w-3.5 mr-1" />
                        <span className="text-xs">Save</span>
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}

          {sending && (
            <div className="flex justify-start">
              <div className="bg-muted/50 rounded-2xl rounded-tl-md px-4 py-3 border border-border/50">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <div className="flex gap-1">
                    <span className="h-2 w-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="h-2 w-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="h-2 w-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                  <span>Researching and generating response...</span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      <div className="shrink-0 border-t bg-card/50 backdrop-blur-sm px-4 md:px-6 py-4">
        <div className="max-w-3xl mx-auto">
          <SmartChatInput
            value={input}
            onChange={setInput}
            onSend={() => sendMessage()}
            isLoading={sending}
            placeholder={`Continue studying ${unit.name}...`}
          />
        </div>
      </div>
    </div>
  );
}

function parseInlineFormatting(text: string): React.ReactNode {
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return parts.map((part, k) =>
    part.startsWith('**') && part.endsWith('**')
      ? <strong key={k}>{part.slice(2, -2)}</strong>
      : <span key={k}>{part}</span>
  );
}