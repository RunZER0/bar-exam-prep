'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { MarkdownRenderer } from '@/components/MarkdownRenderer';
import {
  ArrowLeft, Loader2, MessageCircleQuestion, Search, FileText,
  Mic, Trash2, Pencil, Check, X,
} from 'lucide-react';

interface ChatMessage {
  id: string;
  role: string;
  content: string;
  attachments?: { type: string; url: string; name: string }[];
  createdAt: string;
}

interface SessionDetail {
  id: string;
  title: string;
  competencyType: string;
  context: string | null;
  createdAt: string;
  lastMessageAt: string;
}

const TYPE_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  clarification: { label: 'Clarification', color: 'text-violet-600', bg: 'bg-violet-500/10' },
  research: { label: 'Research', color: 'text-green-600', bg: 'bg-green-500/10' },
  drafting: { label: 'Drafting', color: 'text-blue-600', bg: 'bg-blue-500/10' },
  study: { label: 'Study', color: 'text-purple-600', bg: 'bg-purple-500/10' },
  oral: { label: 'Oral', color: 'text-orange-600', bg: 'bg-orange-500/10' },
  banter: { label: 'Banter', color: 'text-amber-600', bg: 'bg-amber-500/10' },
  general: { label: 'Chat', color: 'text-gray-600', bg: 'bg-gray-500/10' },
};

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-KE', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function ChatDetailPage() {
  const router = useRouter();
  const params = useParams();
  const sessionId = params.id as string;
  const { getIdToken } = useAuth();

  const [session, setSession] = useState<SessionDetail | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState('');
  const [deleting, setDeleting] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadSession = async () => {
    try {
      setLoading(true);
      const token = await getIdToken();
      const res = await fetch(`/api/chat/sessions/${sessionId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        setError(res.status === 404 ? 'Conversation not found' : 'Failed to load conversation');
        return;
      }

      const data = await res.json();
      setSession(data.session);
      setMessages(data.messages);
      setTitleInput(data.session.title);
    } catch {
      setError('Failed to load conversation');
    } finally {
      setLoading(false);
    }
  };

  const updateTitle = async () => {
    if (!titleInput.trim() || !session) return;
    try {
      const token = await getIdToken();
      await fetch(`/api/chat/sessions/${sessionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ title: titleInput.trim() }),
      });
      setSession(prev => prev ? { ...prev, title: titleInput.trim() } : prev);
      setEditingTitle(false);
    } catch {
      // Silent
    }
  };

  const deleteSession = async () => {
    if (!confirm('Delete this conversation? This cannot be undone.')) return;
    setDeleting(true);
    try {
      const token = await getIdToken();
      await fetch(`/api/chat/sessions/${sessionId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      router.push('/history');
    } catch {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-3.5rem)] bg-background">
        <div className="text-center space-y-3">
          <Loader2 className="h-6 w-6 mx-auto animate-spin text-primary/50" />
          <p className="text-sm text-muted-foreground">Loading conversation...</p>
        </div>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-3.5rem)] bg-background gap-4">
        <p className="text-muted-foreground">{error || 'Conversation not found'}</p>
        <button
          onClick={() => router.push('/history')}
          className="px-4 py-2 rounded-xl bg-primary/10 text-primary text-sm font-medium hover:bg-primary/15"
        >
          Back to History
        </button>
      </div>
    );
  }

  const typeConfig = TYPE_CONFIG[session.competencyType] || TYPE_CONFIG.general;

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] md:h-screen bg-background">
      {/* Header */}
      <div className="shrink-0 border-b border-border/20 px-4 md:px-6 py-3">
        <div className="max-w-4xl mx-auto flex items-center gap-3">
          <button
            onClick={() => router.push('/history')}
            className="p-2 rounded-xl hover:bg-muted/40 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>

          <div className="flex-1 min-w-0">
            {editingTitle ? (
              <div className="flex items-center gap-2">
                <input
                  value={titleInput}
                  onChange={e => setTitleInput(e.target.value)}
                  className="flex-1 text-sm font-semibold bg-muted/20 border border-border/30 rounded-lg px-2 py-1 outline-none focus:ring-1 focus:ring-primary/30"
                  onKeyDown={e => { if (e.key === 'Enter') updateTitle(); if (e.key === 'Escape') setEditingTitle(false); }}
                  autoFocus
                />
                <button onClick={updateTitle} className="p-1 rounded hover:bg-primary/10"><Check className="h-3.5 w-3.5 text-primary" /></button>
                <button onClick={() => setEditingTitle(false)} className="p-1 rounded hover:bg-muted/40"><X className="h-3.5 w-3.5" /></button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-semibold truncate">{session.title}</h1>
                <button onClick={() => setEditingTitle(true)} className="p-1 rounded hover:bg-muted/40 opacity-50 hover:opacity-100">
                  <Pencil className="h-3 w-3" />
                </button>
              </div>
            )}
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
              <span className={`px-1.5 py-0.5 rounded-md ${typeConfig.bg} ${typeConfig.color} font-medium`}>
                {typeConfig.label}
              </span>
              <span>{formatDate(session.createdAt)}</span>
              <span>{messages.length} messages</span>
            </div>
          </div>

          <button
            onClick={deleteSession}
            disabled={deleting}
            className="p-2 rounded-xl hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
            title="Delete conversation"
          >
            {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-4">
          {messages.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-muted-foreground">No messages in this conversation</p>
            </div>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`}
              >
                <div
                  className={`max-w-[85%] md:max-w-[75%] px-4 py-3 rounded-2xl ${
                    msg.role === 'user'
                      ? 'bg-primary text-primary-foreground rounded-br-md'
                      : 'bg-gradient-to-br from-muted/50 to-muted/20 rounded-bl-md'
                  }`}
                >
                  {msg.attachments && msg.attachments.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-2">
                      {msg.attachments.map((att, i) => (
                        <div
                          key={i}
                          className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs ${
                            msg.role === 'user' ? 'bg-white/10' : 'bg-muted'
                          }`}
                        >
                          {att.type === 'image' && <FileText className="w-3 h-3" />}
                          {att.type === 'audio' && <Mic className="w-3 h-3" />}
                          {att.type === 'document' && <FileText className="w-3 h-3" />}
                          <span className="truncate max-w-[100px]">{att.name}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {msg.role === 'assistant' ? (
                    <MarkdownRenderer content={msg.content} size="sm" />
                  ) : (
                    <div className="prose-ai text-sm whitespace-pre-wrap">{msg.content}</div>
                  )}
                  <div className={`text-[10px] mt-1.5 ${msg.role === 'user' ? 'text-primary-foreground/50' : 'text-muted-foreground/50'}`}>
                    {new Date(msg.createdAt).toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>
    </div>
  );
}
