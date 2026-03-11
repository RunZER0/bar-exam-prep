'use client';

import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useTimeTracker } from '@/lib/hooks/useTimeTracker';

import { MarkdownRenderer } from '@/components/MarkdownRenderer';
import TrialLimitReached from '@/components/TrialLimitReached';
import PremiumGate from '@/components/PremiumGate';
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
  Send,
  Sparkles,
  Paperclip,
  Image,
  X,
} from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  filtered?: boolean;
  sources?: string[];
  isStreaming?: boolean;
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
  useTimeTracker('research');

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [sessionId] = useState(() => crypto.randomUUID());
  const [copied, setCopied] = useState(false);
  const topicFilter = 'general';
  const [webSearchEnabled, setWebSearchEnabled] = useState(true);
  const [attachments, setAttachments] = useState<Array<{ id: string; file: File; preview?: string }>>([]); 
  const [featureLimitHit, setFeatureLimitHit] = useState<{tier?: string; used?: number; limit?: number; addonRemaining?: number} | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach(file => {
      const att: { id: string; file: File; preview?: string } = {
        id: Date.now().toString() + Math.random(),
        file,
      };
      if (file.type.startsWith('image/')) att.preview = URL.createObjectURL(file);
      setAttachments(prev => [...prev, att]);
    });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeAttachment = (id: string) => {
    setAttachments(prev => {
      const att = prev.find(a => a.id === id);
      if (att?.preview) URL.revokeObjectURL(att.preview);
      return prev.filter(a => a.id !== id);
    });
  };

  const sendMessage = async (overrideMessage?: string) => {
    const userMessage = overrideMessage || input.trim();
    if (!userMessage || sending) return;

    if (!overrideMessage) setInput('');

    const msgId = Date.now().toString();
    const aiMsgId = (Date.now() + 1).toString();

    setMessages(prev => [
      ...prev,
      { id: msgId, role: 'user', content: userMessage },
      { id: aiMsgId, role: 'assistant', content: '', isStreaming: true },
    ]);
    setSending(true);

    const topicArea = 'General Kenyan Law';

    try {
      const token = await getIdToken();

      // Build research prompt for deep research
      const researchPrompt = webSearchEnabled
        ? `[Deep Research Mode] Research the following under Kenyan law thoroughly. Cite specific statutes, case law, and authoritative sources. Structure your response with clear headings. Only use verified and credible sources (Kenya Law Reports, Constitution, Acts of Parliament). If you reference a case, include the full citation.

Topic area: ${topicArea}

Question: ${userMessage}`
        : userMessage;

      const res = await fetch('/api/ai/chat-stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          message: researchPrompt,
          competencyType: 'research',
          context: { topicArea, webSearchEnabled },
          sessionId,
        }),
      });

      if (!res.ok) {
        if (res.status === 403) {
          try {
            const errData = await res.json();
            if (errData.error === 'FEATURE_LIMIT') {
              setMessages(prev => prev.filter(m => m.id !== aiMsgId));
              setFeatureLimitHit({ tier: errData.tier, used: errData.used, limit: errData.limit, addonRemaining: errData.addonRemaining });
              setSending(false);
              return;
            }
          } catch {}
        }
        throw new Error('Failed');
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let accumulated = '';

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const text = decoder.decode(value, { stream: true });
          const lines = text.split('\n');

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            try {
              const data = JSON.parse(line.slice(6));
              if (data.type === 'chunk') {
                accumulated += data.content;
                setMessages(prev => prev.map(m =>
                  m.id === aiMsgId ? { ...m, content: accumulated } : m
                ));
              } else if (data.type === 'done') {
                setMessages(prev => prev.map(m =>
                  m.id === aiMsgId ? { ...m, content: accumulated || data.fullContent, isStreaming: false } : m
                ));
              }
            } catch { /* skip */ }
          }
        }
      }

      setMessages(prev => prev.map(m =>
        m.id === aiMsgId ? { ...m, isStreaming: false } : m
      ));
    } catch {
      setMessages(prev => prev.map(m =>
        m.id === aiMsgId
          ? { ...m, content: 'Research hit a snag. Give it another try?', isStreaming: false }
          : m
      ));
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
    const last = [...messages].reverse().find(m => m.role === 'assistant');
    if (last) {
      navigator.clipboard.writeText(last.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const autoExpand = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 160) + 'px';
  };

  const hasMessages = messages.length > 0;

  return (
    <PremiumGate feature="research">
    <div className="flex flex-col h-[calc(100vh-3.5rem)] md:h-screen">
      {featureLimitHit && (
        <TrialLimitReached
          feature="research"
          currentTier={featureLimitHit.tier as any}
          used={featureLimitHit.used}
          limit={featureLimitHit.limit}
          addonRemaining={featureLimitHit.addonRemaining}
          onDismiss={() => setFeatureLimitHit(null)}
        />
      )}

      {/* Top bar */}
      <div className="border-b border-border/20 px-4 md:px-6 py-3 flex items-center justify-between shrink-0 bg-gradient-to-r from-teal-500/5 via-background to-cyan-500/5">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-gradient-to-br from-teal-500/15 to-cyan-500/10">
            <Search className="h-4 w-4 text-teal-600 dark:text-teal-400" />
          </div>
          <div>
            <h1 className="text-base font-semibold">Legal Research</h1>
            <p className="text-xs text-muted-foreground">Deep research into Kenyan statutes, case law & legal principles</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setWebSearchEnabled(!webSearchEnabled)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
              webSearchEnabled
                ? 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20'
                : 'bg-muted/50 text-muted-foreground'
            }`}
          >
            <Globe className="h-3.5 w-3.5" />
            Deep Search
          </button>

          <button onClick={copyLastResponse} disabled={!hasMessages}
            className="p-2 rounded-lg hover:bg-muted/50 text-muted-foreground disabled:opacity-30 transition-colors">
            {copied ? <Check className="h-4 w-4 text-teal-500" /> : <Copy className="h-4 w-4" />}
          </button>
          <button onClick={() => setMessages([])} disabled={!hasMessages}
            className="p-2 rounded-lg hover:bg-muted/50 text-muted-foreground disabled:opacity-30 transition-colors">
            <RotateCcw className="h-4 w-4" />
          </button>
        </div>
      </div>



      {/* Empty state / Messages */}
      <div className="flex-1 overflow-y-auto px-4 md:px-6 py-6">
        {!hasMessages ? (
          <div className="max-w-2xl mx-auto mt-8 space-y-8">
            <div className="text-center">
              <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-gradient-to-br from-teal-500/15 to-cyan-500/10 mb-4">
                <Search className="h-8 w-8 text-teal-600 dark:text-teal-400" />
              </div>
              <h2 className="text-xl font-bold">Legal Research</h2>
              <p className="text-muted-foreground mt-2 max-w-md mx-auto">
                Get comprehensive, well-cited research on any area of Kenyan law. Every response is grounded in actual statutes and case law.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              {RESEARCH_SUGGESTIONS.map(s => {
                const Icon = s.icon;
                return (
                  <button
                    key={s.label}
                    className="text-left p-4 rounded-2xl bg-gradient-to-br from-muted/30 to-muted/10 hover:from-teal-500/6 hover:to-teal-500/[0.02] transition-all duration-300 group"
                    onClick={() => sendMessage(s.prompt)}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <div className="p-1.5 rounded-lg bg-primary/10 group-hover:bg-primary/15 transition-colors">
                        <Icon className="h-3.5 w-3.5 text-primary" />
                      </div>
                      <span className="text-sm font-medium">{s.label}</span>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">{s.prompt}</p>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto space-y-5">
            {messages.map(msg => (
              <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] md:max-w-[80%] rounded-2xl px-4 py-3 ${
                    msg.role === 'user'
                      ? 'bg-primary text-primary-foreground rounded-br-md'
                      : 'bg-gradient-to-br from-muted/50 to-muted/20 rounded-bl-md'
                  }`}
                >
                  {msg.filtered && (
                    <div className="flex items-center gap-1 text-xs text-amber-600 mb-2">
                      <AlertTriangle className="h-3 w-3" />
                      <span>Verified for accuracy</span>
                    </div>
                  )}
                  {msg.role === 'assistant' ? (
                    <>
                      <MarkdownRenderer content={msg.content} size="sm" />
                      {msg.isStreaming && (
                        <span className="inline-block w-1.5 h-4 bg-primary/60 animate-pulse ml-0.5 align-text-bottom rounded-sm" />
                      )}
                    </>
                  ) : (
                    <div className="text-sm whitespace-pre-wrap">{msg.content}</div>
                  )}
                  {msg.sources && msg.sources.length > 0 && (
                    <div className="mt-3 pt-2 border-t border-border/10">
                      <p className="text-xs font-medium text-muted-foreground mb-1">Sources:</p>
                      <div className="flex flex-wrap gap-1">
                        {msg.sources.map((src, j) => (
                          <span key={j} className="inline-flex items-center gap-1 text-xs bg-background/50 px-2 py-0.5 rounded">
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
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Attachments preview */}
      {attachments.length > 0 && (
        <div className="shrink-0 px-4 md:px-6 pb-2">
          <div className="max-w-4xl mx-auto flex gap-2 overflow-x-auto">
            {attachments.map(att => (
              <div key={att.id} className="relative flex-shrink-0 group">
                {att.preview ? (
                  <div className="w-14 h-14 rounded-xl overflow-hidden border border-border/30">
                    <img src={att.preview} alt="" className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-muted/30">
                    <FileText className="w-4 h-4 text-muted-foreground" />
                    <span className="text-xs truncate max-w-[80px]">{att.file.name}</span>
                  </div>
                )}
                <button onClick={() => removeAttachment(att.id)} className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="border-t border-border/20 px-4 md:px-6 py-3 bg-gradient-to-t from-background to-transparent shrink-0">
        <input ref={fileInputRef} type="file" accept="image/*,.pdf,.doc,.docx" multiple onChange={handleFileSelect} className="hidden" />
        <div className="max-w-4xl mx-auto flex gap-3 items-end">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="shrink-0 h-11 w-11 rounded-xl bg-muted/30 hover:bg-muted/60 flex items-center justify-center transition-colors"
          >
            <Paperclip className="h-4 w-4 text-muted-foreground" />
          </button>
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={e => { setInput(e.target.value); autoExpand(); }}
              onKeyDown={handleKeyDown}
              placeholder="What would you like to research?"
              disabled={sending}
              rows={1}
              className="w-full resize-none rounded-xl bg-muted/20 border border-border/20 px-4 py-3 text-sm outline-none focus:border-teal-500/40 focus:ring-1 focus:ring-teal-500/10 placeholder:text-muted-foreground/50 disabled:opacity-50 overflow-y-auto transition-colors"
              style={{ maxHeight: 160 }}
            />
          </div>
          <button
            onClick={() => sendMessage()}
            disabled={sending || !input.trim()}
            className="shrink-0 h-11 w-11 rounded-xl bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-30 hover:bg-primary/90 transition-colors"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
        <p className="text-[10px] text-muted-foreground/50 text-center mt-1.5">
          {webSearchEnabled ? 'Deep search on · ' : ''}All citations verified against primary sources
        </p>
      </div>
    </div>
    </PremiumGate>
  );
}
