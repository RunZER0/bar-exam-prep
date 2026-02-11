'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { getUnitById } from '@/lib/constants/legal-content';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import {
  ArrowLeft,
  BookOpen,
  Send,
  Loader2,
  AlertTriangle,
  Copy,
  Check,
  RotateCcw,
  FileText,
  Scale,
  Lightbulb,
} from 'lucide-react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  filtered?: boolean;
}

const STUDY_PROMPTS = [
  { label: 'Key Concepts', prompt: 'Explain the key concepts and principles I need to know for this unit.', icon: Lightbulb },
  { label: 'Statutes', prompt: 'Walk me through the important statutes and their key provisions.', icon: FileText },
  { label: 'Case Law', prompt: 'What are the landmark Kenyan cases I should know for this unit?', icon: Scale },
  { label: 'Exam Tips', prompt: 'What are the most commonly tested areas and how should I approach exam questions?', icon: BookOpen },
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
  const [copied, setCopied] = useState(false);
  const [started, setStarted] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (!unit) {
    return (
      <div className="p-6 md:p-10 max-w-4xl mx-auto">
        <Button variant="ghost" size="sm" onClick={() => router.push('/study')}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        <div className="text-center py-20">
          <BookOpen className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-muted-foreground">Unit not found.</p>
        </div>
      </div>
    );
  }

  const startStudy = (prompt?: string) => {
    setStarted(true);
    const initial: Message = {
      role: 'assistant',
      content: `## ${unit.name}\n\n${unit.description}\n\n**Key Statutes:**\n${unit.statutes.map((s) => `- ${s}`).join('\n')}\n\nI'm ready to help you master this unit. Ask me anything about the concepts, statutes, case law, or exam strategies. What would you like to explore first?`,
    };
    setMessages([initial]);
    if (prompt) {
      setTimeout(() => sendMessage(prompt), 100);
    }
  };

  const sendMessage = async (overrideMessage?: string) => {
    const userMessage = overrideMessage || input.trim();
    if (!userMessage || sending) return;

    if (!overrideMessage) setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: userMessage }]);
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
          competencyType: 'research',
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
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: data.response,
          filtered: data.filtered,
        },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'Sorry, I encountered an error. Please try again.',
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const copyLastResponse = () => {
    const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant');
    if (lastAssistant) {
      navigator.clipboard.writeText(lastAssistant.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Landing for this unit
  if (!started) {
    return (
      <div className="p-6 md:p-10 max-w-4xl mx-auto space-y-8">
        <Button variant="ghost" size="sm" onClick={() => router.push('/study')}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to Units
        </Button>

        <div>
          <h1 className="text-2xl md:text-3xl font-bold">{unit.name}</h1>
          <p className="text-muted-foreground mt-2 max-w-2xl">{unit.description}</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Key Statutes & Legislation</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {unit.statutes.map((statute, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <FileText className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  {statute}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <div>
          <h2 className="text-lg font-semibold mb-3">Quick Start</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            {STUDY_PROMPTS.map((sp) => {
              const Icon = sp.icon;
              return (
                <Card
                  key={sp.label}
                  className="cursor-pointer border hover:border-primary/40 hover:shadow-sm transition-all"
                  onClick={() => startStudy(sp.prompt)}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4 text-primary" />
                      <CardTitle className="text-sm">{sp.label}</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <CardDescription className="text-xs">{sp.prompt}</CardDescription>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        <Button onClick={() => startStudy()} className="w-full sm:w-auto">
          <BookOpen className="h-4 w-4 mr-2" />
          Start Free Study Session
        </Button>
      </div>
    );
  }

  // Chat interface
  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] md:h-screen">
      {/* Top bar */}
      <div className="border-b px-4 md:px-6 py-3 flex items-center justify-between shrink-0 bg-card">
        <div className="flex items-center gap-3 min-w-0">
          <Button variant="ghost" size="sm" onClick={() => setStarted(false)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">{unit.name}</p>
            <p className="text-xs text-muted-foreground">Study Session</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={copyLastResponse} disabled={messages.length < 2}>
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => startStudy()}>
            <RotateCcw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 md:px-6 py-6 space-y-6">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] md:max-w-[75%] rounded-2xl px-4 py-3 ${
                msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'
              }`}
            >
              {msg.filtered && (
                <div className="flex items-center gap-1 text-xs text-amber-600 mb-2">
                  <AlertTriangle className="h-3 w-3" />
                  <span>Filtered for accuracy</span>
                </div>
              )}
              <div className={`prose-ai text-sm ${msg.role === 'user' ? 'text-primary-foreground' : ''}`}>
                {msg.content.split('\n').map((line, j) => {
                  if (line.startsWith('## ')) return <h3 key={j} className="text-base font-bold mt-2 mb-1">{line.slice(3)}</h3>;
                  if (line.startsWith('**') && line.endsWith('**')) return <p key={j} className="font-semibold mt-2">{line.slice(2, -2)}</p>;
                  if (line.startsWith('- ')) return <p key={j} className="ml-3">• {line.slice(2)}</p>;
                  if (/^\d+\.\s/.test(line)) return <p key={j} className="ml-3">{line}</p>;
                  if (line === '') return <br key={j} />;
                  const parts = line.split(/(\*\*.*?\*\*)/g);
                  return (
                    <p key={j}>
                      {parts.map((part, k) =>
                        part.startsWith('**') && part.endsWith('**')
                          ? <strong key={k}>{part.slice(2, -2)}</strong>
                          : <span key={k}>{part}</span>
                      )}
                    </p>
                  );
                })}
              </div>
            </div>
          </div>
        ))}

        {sending && (
          <div className="flex justify-start">
            <div className="bg-muted rounded-2xl px-4 py-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Generating…
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick prompt chips within chat */}
      {messages.length === 1 && (
        <div className="px-4 md:px-6 pb-2 flex flex-wrap gap-2">
          {STUDY_PROMPTS.map((sp) => (
            <button
              key={sp.label}
              onClick={() => sendMessage(sp.prompt)}
              className="px-3 py-1.5 rounded-full text-xs font-medium bg-muted text-muted-foreground hover:bg-muted/80 transition-colors"
            >
              {sp.label}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="border-t px-4 md:px-6 py-3 bg-card shrink-0">
        <div className="max-w-4xl mx-auto flex gap-2">
          <Textarea
            placeholder="Ask about this unit…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={2}
            className="resize-none flex-1"
          />
          <Button onClick={() => sendMessage()} disabled={!input.trim() || sending} size="sm" className="self-end px-3">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
