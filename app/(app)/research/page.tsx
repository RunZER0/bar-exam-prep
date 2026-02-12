'use client';

import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { ATP_UNITS } from '@/lib/constants/legal-content';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { SmartChatInput } from '@/components/SmartChatInput';
import {
  Search,
  Loader2,
  AlertTriangle,
  Copy,
  Check,
  RotateCcw,
  BookOpen,
  Globe,
  FileText,
  Scale,
  ExternalLink,
  Lightbulb,
} from 'lucide-react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  filtered?: boolean;
  sources?: string[];
}

const RESEARCH_SUGGESTIONS = [
  {
    label: 'Statutory Interpretation',
    prompt: 'Explain the rules of statutory interpretation under Kenyan law with relevant case law.',
    icon: FileText,
  },
  {
    label: 'Constitutional Rights',
    prompt: 'What are the key provisions of the Bill of Rights under the Constitution of Kenya 2010?',
    icon: Scale,
  },
  {
    label: 'Land Law',
    prompt: 'Explain the process of land transfer under the Land Registration Act, 2012.',
    icon: BookOpen,
  },
  {
    label: 'Case Analysis',
    prompt: 'Analyze the significance of the Njoya v Attorney General case in Kenyan constitutional law.',
    icon: Lightbulb,
  },
];

export default function ResearchPage() {
  const { getIdToken } = useAuth();

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [sessionId] = useState(() => crypto.randomUUID());
  const [copied, setCopied] = useState(false);
  const [topicFilter, setTopicFilter] = useState('general');
  const [webSearchEnabled, setWebSearchEnabled] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (overrideMessage?: string) => {
    const userMessage = overrideMessage || input.trim();
    if (!userMessage || sending) return;

    if (!overrideMessage) setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: userMessage }]);
    setSending(true);

    const topicArea =
      topicFilter === 'general'
        ? 'General Kenyan Law'
        : ATP_UNITS.find((u) => u.id === topicFilter)?.name || 'General Kenyan Law';

    try {
      const token = await getIdToken();
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          message: webSearchEnabled
            ? `[Web search enabled] Research the following under Kenyan law, citing specific statutes, cases, and authoritative sources: ${userMessage}`
            : userMessage,
          competencyType: 'research',
          context: {
            topicArea,
            webSearchEnabled,
          },
          sessionId,
        }),
      });

      if (!res.ok) throw new Error('Failed');

      const data = await res.json();
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: data.response,
          filtered: data.filtered,
          sources: data.guardrails?.sources,
        },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Sorry, research failed. Please try again.' },
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
    const last = [...messages].reverse().find((m) => m.role === 'assistant');
    if (last) {
      navigator.clipboard.writeText(last.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const hasMessages = messages.length > 0;

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] md:h-screen">
      {/* Top bar */}
      <div className="border-b px-4 md:px-6 py-3 flex items-center justify-between shrink-0 bg-card">
        <div>
          <h1 className="text-base font-semibold">Legal Research</h1>
          <p className="text-xs text-muted-foreground">Research Kenyan statutes, case law & legal principles</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Web search toggle */}
          <button
            onClick={() => setWebSearchEnabled(!webSearchEnabled)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              webSearchEnabled
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground'
            }`}
          >
            <Globe className="h-3.5 w-3.5" />
            Web Search
          </button>

          <Button variant="ghost" size="sm" onClick={copyLastResponse} disabled={!hasMessages}>
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setMessages([])}
            disabled={!hasMessages}
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Topic filter bar */}
      <div className="border-b px-4 md:px-6 py-2 bg-card/50 overflow-x-auto shrink-0">
        <div className="flex gap-2 min-w-max">
          <button
            onClick={() => setTopicFilter('general')}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              topicFilter === 'general'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            General
          </button>
          {ATP_UNITS.map((u) => (
            <button
              key={u.id}
              onClick={() => setTopicFilter(u.id)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors whitespace-nowrap ${
                topicFilter === u.id
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              {u.name}
            </button>
          ))}
        </div>
      </div>

      {/* Empty state / Messages */}
      <div className="flex-1 overflow-y-auto px-4 md:px-6 py-6">
        {!hasMessages ? (
          <div className="max-w-2xl mx-auto mt-8 space-y-8">
            <div className="text-center">
              <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-primary/10 mb-4">
                <Search className="h-8 w-8 text-primary" />
              </div>
              <h2 className="text-xl font-bold">Legal Research Assistant</h2>
              <p className="text-muted-foreground mt-2 max-w-md mx-auto">
                Research Kenyan statutes, case law, and legal principles. Get answers with
                proper citations and references to authoritative sources.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              {RESEARCH_SUGGESTIONS.map((s) => {
                const Icon = s.icon;
                return (
                  <Card
                    key={s.label}
                    className="cursor-pointer border hover:border-primary/40 hover:shadow-sm transition-all"
                    onClick={() => sendMessage(s.prompt)}
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4 text-primary" />
                        <CardTitle className="text-sm">{s.label}</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <CardDescription className="text-xs">{s.prompt}</CardDescription>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto space-y-6">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] md:max-w-[80%] rounded-2xl px-4 py-3 ${
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
                      if (line.startsWith('### ')) return <h4 key={j} className="text-sm font-bold mt-2 mb-1">{line.slice(4)}</h4>;
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
                  {msg.sources && msg.sources.length > 0 && (
                    <div className="mt-3 pt-2 border-t border-muted-foreground/10">
                      <p className="text-xs font-medium text-muted-foreground mb-1">Sources:</p>
                      <div className="flex flex-wrap gap-1">
                        {msg.sources.map((src, j) => (
                          <span
                            key={j}
                            className="inline-flex items-center gap-1 text-xs bg-background px-2 py-0.5 rounded"
                          >
                            <ExternalLink className="h-2.5 w-2.5" />
                            {src}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {sending && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-2xl px-4 py-3">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Researching…
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input - ChatGPT Style */}
      <div className="border-t px-4 md:px-6 py-4 bg-card shrink-0">
        <div className="max-w-4xl mx-auto">
          <SmartChatInput
            value={input}
            onChange={setInput}
            onSend={() => sendMessage()}
            isLoading={sending}
            placeholder="Ask a legal research question…"
            suggestions={[
              { label: 'Statutory Interpretation', prompt: 'Explain the rules of statutory interpretation under Kenyan law' },
              { label: 'Constitutional Rights', prompt: 'What are the key provisions of the Bill of Rights?' },
              { label: 'Land Law', prompt: 'Explain land transfer under the Land Registration Act' },
              { label: 'Case Analysis', prompt: 'Analyze the Njoya v Attorney General case' },
            ]}
            onSuggestionClick={(prompt) => sendMessage(prompt)}
          />
          <p className="text-[10px] text-muted-foreground/60 text-center mt-1">
            {webSearchEnabled ? 'Web search enabled · ' : ''}Verify all responses against primary sources
          </p>
        </div>
      </div>
    </div>
  );
}
