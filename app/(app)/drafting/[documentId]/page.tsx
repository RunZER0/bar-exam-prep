'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { getDocumentById } from '@/lib/constants/legal-content';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import {
  ArrowLeft,
  FileText,
  PenLine,
  BookOpen,
  Send,
  Loader2,
  AlertTriangle,
  Copy,
  Check,
  RotateCcw,
} from 'lucide-react';

type Mode = null | 'draft' | 'study';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  filtered?: boolean;
}

export default function DraftingDocumentPage() {
  const params = useParams();
  const router = useRouter();
  const { getIdToken } = useAuth();

  const docId = params.documentId as string;
  const doc = getDocumentById(docId);

  const [mode, setMode] = useState<Mode>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [sessionId] = useState(() => crypto.randomUUID());
  const [copied, setCopied] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (!doc) {
    return (
      <div className="p-6 md:p-10 max-w-4xl mx-auto">
        <Button variant="ghost" size="sm" onClick={() => router.push('/drafting')}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        <div className="text-center py-20">
          <FileText className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-muted-foreground">Document type not found.</p>
        </div>
      </div>
    );
  }

  const startMode = (selectedMode: Mode) => {
    setMode(selectedMode);
    if (selectedMode === 'study') {
      setMessages([
        {
          role: 'assistant',
          content: `## How to Draft: ${doc.name}\n\nI'll teach you how to properly draft a **${doc.name}** under Kenyan law.\n\n**${doc.description}**\n\nLet me start by explaining the key components, format, and legal requirements. Feel free to ask questions at any point.\n\nWhat aspect would you like to begin with?\n\n1. **Structure & Format** — The standard layout and sections\n2. **Legal Requirements** — Mandatory contents under Kenyan law\n3. **Common Mistakes** — Pitfalls to avoid\n4. **Sample Template** — A guided walkthrough with example\n\nJust type the number or ask any specific question.`,
        },
      ]);
    } else {
      setMessages([
        {
          role: 'assistant',
          content: `## Direct Drafting: ${doc.name}\n\nI'm ready to help you draft a **${doc.name}**.\n\n**${doc.description}**\n\nTo get started, please provide me with:\n\n- **The facts/scenario** for this document\n- **The parties involved**\n- **Any specific requirements** you need included\n\nI'll guide you through the drafting process step by step, ensuring the document meets Kenyan legal standards.\n\nDescribe your scenario and I'll help you draft it.`,
        },
      ]);
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || sending) return;

    const userMessage = input.trim();
    setInput('');
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
          competencyType: 'drafting',
          context: {
            documentType: doc.name,
            mode: mode,
            category: doc.category,
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

  // Mode selection screen
  if (!mode) {
    return (
      <div className="p-6 md:p-10 max-w-4xl mx-auto space-y-8">
        <Button variant="ghost" size="sm" onClick={() => router.push('/drafting')}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to Documents
        </Button>

        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
              {doc.category}
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold">{doc.name}</h1>
          <p className="text-muted-foreground mt-2 max-w-2xl">{doc.description}</p>
        </div>

        <div className="grid sm:grid-cols-2 gap-4 max-w-2xl">
          <Card
            className="cursor-pointer border-2 hover:border-primary transition-colors group"
            onClick={() => startMode('draft')}
          >
            <CardHeader>
              <div className="p-3 rounded-lg bg-primary/10 w-fit mb-2 group-hover:bg-primary/20 transition-colors">
                <PenLine className="h-6 w-6 text-primary" />
              </div>
              <CardTitle className="text-lg">Direct Drafting</CardTitle>
              <CardDescription>
                Provide your facts and I&apos;ll guide you through drafting a complete{' '}
                {doc.name.toLowerCase()} step by step.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card
            className="cursor-pointer border-2 hover:border-gray-500 transition-colors group"
            onClick={() => startMode('study')}
          >
            <CardHeader>
              <div className="p-3 rounded-lg bg-gray-500/10 dark:bg-gray-800 w-fit mb-2 group-hover:bg-gray-500/20 transition-colors">
                <BookOpen className="h-6 w-6 text-gray-600 dark:text-gray-400" />
              </div>
              <CardTitle className="text-lg">Study How to Draft</CardTitle>
              <CardDescription>
                Learn the structure, legal requirements, and best practices for
                drafting a{' '}
                {doc.name.toLowerCase()}.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </div>
    );
  }

  // Chat interface
  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] md:h-screen">
      {/* Top bar */}
      <div className="border-b px-4 md:px-6 py-3 flex items-center justify-between shrink-0 bg-card">
        <div className="flex items-center gap-3 min-w-0">
          <Button variant="ghost" size="sm" onClick={() => setMode(null)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">{doc.name}</p>
            <p className="text-xs text-muted-foreground">
              {mode === 'draft' ? 'Direct Drafting' : 'Study Mode'} ·{' '}
              {doc.category}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={copyLastResponse} disabled={messages.length < 2}>
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setMessages([]);
              startMode(mode);
            }}
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 md:px-6 py-6 space-y-6">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] md:max-w-[75%] rounded-2xl px-4 py-3 ${
                msg.role === 'user'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted'
              }`}
            >
              {msg.filtered && (
                <div className="flex items-center gap-1 text-xs text-amber-600 mb-2">
                  <AlertTriangle className="h-3 w-3" />
                  <span>Response was filtered for accuracy</span>
                </div>
              )}
              <div className={`prose-ai text-sm ${msg.role === 'user' ? 'text-primary-foreground' : ''}`}>
                {msg.content.split('\n').map((line, j) => {
                  if (line.startsWith('## ')) {
                    return <h3 key={j} className="text-base font-bold mt-2 mb-1">{line.slice(3)}</h3>;
                  }
                  if (line.startsWith('**') && line.endsWith('**')) {
                    return <p key={j} className="font-semibold mt-2">{line.slice(2, -2)}</p>;
                  }
                  if (line.startsWith('- ')) {
                    return <p key={j} className="ml-3">• {line.slice(2)}</p>;
                  }
                  if (/^\d+\.\s/.test(line)) {
                    return <p key={j} className="ml-3">{line}</p>;
                  }
                  if (line === '') return <br key={j} />;
                  // Bold within text
                  const parts = line.split(/(\*\*.*?\*\*)/g);
                  return (
                    <p key={j}>
                      {parts.map((part, k) =>
                        part.startsWith('**') && part.endsWith('**') ? (
                          <strong key={k}>{part.slice(2, -2)}</strong>
                        ) : (
                          <span key={k}>{part}</span>
                        )
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
                Generating response…
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t px-4 md:px-6 py-3 bg-card shrink-0">
        <div className="max-w-4xl mx-auto flex gap-2">
          <Textarea
            placeholder={
              mode === 'draft'
                ? 'Describe your facts and scenario…'
                : 'Ask a question about drafting this document…'
            }
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={2}
            className="resize-none flex-1"
          />
          <Button
            onClick={sendMessage}
            disabled={!input.trim() || sending}
            size="sm"
            className="self-end px-3"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground text-center mt-2">
          Always verify responses against primary legal sources before relying on them.
        </p>
      </div>
    </div>
  );
}
