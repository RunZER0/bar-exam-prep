'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useTimeTracker } from '@/lib/hooks/useTimeTracker';
import { useSearchParams, useRouter } from 'next/navigation';
import { MarkdownRenderer } from '@/components/MarkdownRenderer';
import TrialLimitReached from '@/components/TrialLimitReached';
import PremiumGate from '@/components/PremiumGate';
import { 
  MessageCircleQuestion, Send, Image, Mic, MicOff, 
  X, FileText, Paperclip, StopCircle, Sparkles, Loader2,
  PanelLeftClose, PanelLeftOpen, Plus, Trash2, Clock, Search, MessageSquare
} from 'lucide-react';

type Attachment = {
  id: string;
  type: 'image' | 'audio' | 'document';
  file: File;
  preview?: string;
  duration?: number;
  transcription?: string;
};

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  isStreaming?: boolean;
  attachments?: { type: string; name: string; url?: string }[];
};

type ConversationItem = {
  id: string;
  title: string;
  competencyType: string;
  lastMessageAt: string;
  createdAt: string;
  messageCount: number;
};

function timeAgo(dateString: string): string {
  const diff = Date.now() - new Date(dateString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return new Date(dateString).toLocaleDateString('en-KE', { month: 'short', day: 'numeric' });
}

export default function ClarifyPage() {
  const { getIdToken } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  useTimeTracker('clarify');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [sessionId, setSessionId] = useState(() => searchParams.get('session') || crypto.randomUUID());
  const [featureLimitHit, setFeatureLimitHit] = useState<{tier?: string; used?: number; limit?: number; addonRemaining?: number} | null>(null);

  // Chat history sidebar state
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loadingConversations, setLoadingConversations] = useState(false);
  const [loadingSession, setLoadingSession] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSessionId, setActiveSessionId] = useState<string | null>(searchParams.get('session'));
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const conversationsLoadedRef = useRef(false);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    return () => {
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
    };
  }, []);

  // Load conversation from URL param on mount
  useEffect(() => {
    const urlSession = searchParams.get('session');
    if (urlSession && !conversationsLoadedRef.current) {
      loadConversation(urlSession);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch conversations list
  const loadConversations = useCallback(async () => {
    try {
      setLoadingConversations(true);
      const token = await getIdToken();
      const res = await fetch('/api/chat/sessions?type=clarification', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setConversations(data.sessions || []);
      }
    } catch (e) {
      console.error('Failed to load conversations:', e);
    } finally {
      setLoadingConversations(false);
      conversationsLoadedRef.current = true;
    }
  }, [getIdToken]);

  // Load conversations when sidebar opens
  useEffect(() => {
    if (sidebarOpen && !conversationsLoadedRef.current) {
      loadConversations();
    }
  }, [sidebarOpen, loadConversations]);

  // Load a past conversation
  const loadConversation = async (convId: string) => {
    try {
      setLoadingSession(true);
      const token = await getIdToken();
      const res = await fetch(`/api/chat/sessions/${convId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      
      setActiveSessionId(convId);
      setSessionId(convId);
      setMessages(data.messages.map((m: any) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        attachments: m.attachments || [],
        isStreaming: false,
      })));
      setInput('');
      setAttachments([]);
      
      // Update URL without full navigation
      window.history.replaceState(null, '', `/clarify?session=${convId}`);
      
      // Close sidebar on mobile
      if (window.innerWidth < 768) {
        setSidebarOpen(false);
      }
    } catch (e) {
      console.error('Failed to load conversation:', e);
    } finally {
      setLoadingSession(false);
    }
  };

  // Start a new chat
  const startNewChat = () => {
    const newId = crypto.randomUUID();
    setSessionId(newId);
    setActiveSessionId(null);
    setMessages([]);
    setInput('');
    setAttachments([]);
    window.history.replaceState(null, '', '/clarify');
    if (window.innerWidth < 768) {
      setSidebarOpen(false);
    }
  };

  // Delete a conversation
  const deleteConversation = async (convId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const token = await getIdToken();
      await fetch(`/api/chat/sessions/${convId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      setConversations(prev => prev.filter(c => c.id !== convId));
      
      // If we deleted the active conversation, start fresh
      if (convId === activeSessionId) {
        startNewChat();
      }
    } catch (e) {
      console.error('Failed to delete conversation:', e);
    }
  };

  const filteredConversations = searchQuery.trim()
    ? conversations.filter(c => c.title.toLowerCase().includes(searchQuery.toLowerCase()))
    : conversations;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach(file => {
      const type = file.type.startsWith('image/') ? 'image' 
        : file.type.startsWith('audio/') ? 'audio' 
        : 'document';
      
      const attachment: Attachment = {
        id: Date.now().toString() + Math.random(),
        type,
        file,
      };

      if (type === 'image') {
        attachment.preview = URL.createObjectURL(file);
      }

      setAttachments(prev => [...prev, attachment]);
    });

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeAttachment = (id: string) => {
    setAttachments(prev => {
      const att = prev.find(a => a.id === id);
      if (att?.preview) {
        URL.revokeObjectURL(att.preview);
      }
      return prev.filter(a => a.id !== id);
    });
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const audioFile = new File([audioBlob], `voice-note-${Date.now()}.webm`, { type: 'audio/webm' });
        const duration = recordingTime;
        
        // Transcribe the audio
        try {
          const token = await getIdToken();
          const formData = new FormData();
          formData.append('audio', audioFile);
          
          const response = await fetch('/api/transcribe', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: formData,
          });
          
          const data = await response.json();
          
          if (data.text) {
            // Add transcribed text directly to input for convenience
            setInput(prev => prev + (prev ? ' ' : '') + data.text);
          }
          
          // Also add as attachment for reference
          setAttachments(prev => [...prev, {
            id: Date.now().toString(),
            type: 'audio',
            file: audioFile,
            duration,
            transcription: data.text || undefined,
          }]);
        } catch (error) {
          console.error('Transcription error:', error);
          // Add without transcription if it fails
          setAttachments(prev => [...prev, {
            id: Date.now().toString(),
            type: 'audio',
            file: audioFile,
            duration,
          }]);
        }

        stream.getTracks().forEach(track => track.stop());
        setRecordingTime(0);
      };

      mediaRecorder.start();
      setIsRecording(true);

      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (error) {
      console.error('Error accessing microphone:', error);
      alert('Could not access microphone. Please check permissions.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const sendMessage = async () => {
    if ((!input.trim() && attachments.length === 0) || isLoading) return;

    const userAttachments = attachments.map(a => ({
      type: a.type,
      name: a.file.name,
    }));

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim() || 'Help me understand this:',
      attachments: userAttachments,
    };

    setMessages(prev => [...prev, userMessage]);
    const currentInput = input;
    const currentAttachments = [...attachments];
    setInput('');
    setAttachments([]);
    setIsLoading(true);

    // Create streaming AI message placeholder
    const aiMsgId = (Date.now() + 1).toString();
    setMessages(prev => [...prev, {
      id: aiMsgId,
      role: 'assistant',
      content: '',
      isStreaming: true,
    }]);

    try {
      const token = await getIdToken();
      
      // Prepare attachment data
      const attachmentData = await Promise.all(currentAttachments.map(async (att) => {
        if (att.type === 'image') {
          return new Promise<any>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => {
              resolve({
                type: att.type,
                fileName: att.file.name,
                dataUrl: reader.result,
              });
            };
            reader.readAsDataURL(att.file);
          });
        }
        if (att.type === 'audio') {
          return {
            type: att.type,
            fileName: att.file.name,
            transcription: att.transcription || `[Voice note: ${att.duration || 0}s]`,
          };
        }
        // Documents (PDF, DOCX, DOC, TXT) — extract text server-side
        try {
          const fd = new FormData();
          fd.append('file', att.file);
          const extractRes = await fetch('/api/extract-document', {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
            body: fd,
          });
          if (extractRes.ok) {
            const extractData = await extractRes.json();
            if (extractData.text) {
              return { type: att.type, fileName: att.file.name, content: extractData.text };
            }
          }
        } catch (e) { console.error('Document extraction failed:', e); }
        // Fallback: try reading as text
        try {
          const text = await att.file.text();
          return { type: att.type, fileName: att.file.name, content: text.substring(0, 12000) };
        } catch {
          return { type: att.type, fileName: att.file.name };
        }
      }));
      
      let enhancedMessage = currentInput;
      if (currentAttachments.length > 0) {
        const attachmentDescriptions = currentAttachments.map(a => {
          if (a.type === 'image') return `[Image: ${a.file.name}]`;
          if (a.type === 'audio') return `[Voice note: ${a.file.name}${a.transcription ? ` — "${a.transcription}"` : ''}]`;
          return `[Document: ${a.file.name}]`;
        }).join(' ');
        enhancedMessage = `${attachmentDescriptions}\n\n${currentInput || 'Help me understand this.'}`;
      }

      // Use streaming endpoint
      const response = await fetch('/api/ai/chat-stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          message: enhancedMessage,
          competencyType: 'clarification',
          sessionId,
          attachments: attachmentData.length > 0 ? attachmentData : undefined,
          context: { source: 'clarify-page' },
        }),
      });

      if (!response.ok) {
        if (response.status === 403) {
          try {
            const errData = await response.json();
            if (errData.error === 'FEATURE_LIMIT') {
              setMessages(prev => prev.filter(m => m.id !== aiMsgId));
              setFeatureLimitHit({ tier: errData.tier, used: errData.used, limit: errData.limit, addonRemaining: errData.addonRemaining });
              setIsLoading(false);
              return;
            }
          } catch {}
        }
        throw new Error('Failed');
      }

      const reader = response.body?.getReader();
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
            } catch { /* skip malformed lines */ }
          }
        }
      }

      // Ensure streaming flag is removed
      setMessages(prev => prev.map(m => 
        m.id === aiMsgId ? { ...m, isStreaming: false } : m
      ));
      // Mark this session as active so it highlights in sidebar
      if (!activeSessionId) {
        setActiveSessionId(sessionId);
        window.history.replaceState(null, '', `/clarify?session=${sessionId}`);
      }
    } catch (error) {
      console.error('Chat error:', error);
      setMessages(prev => prev.map(m => 
        m.id === aiMsgId 
          ? { ...m, content: 'Sorry, something went wrong. Could you try that again?', isStreaming: false }
          : m
      ));
    } finally {
      setIsLoading(false);
      // Refresh conversation list to show the new/updated conversation
      if (conversationsLoadedRef.current) {
        loadConversations();
      }
    }
  };

  return (
    <PremiumGate feature="clarify">
    <div className="flex h-[calc(100vh-4rem)] md:h-screen">
      
      {/* === SIDEBAR: Chat History === */}
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/40 z-30 md:hidden" 
          onClick={() => setSidebarOpen(false)} 
        />
      )}

      <div
        className={`
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:-translate-x-full'}
          fixed md:relative z-40 md:z-auto
          w-72 h-full
          bg-card border-r border-border/20
          flex flex-col
          transition-transform duration-200 ease-in-out
          ${sidebarOpen ? 'md:w-72 md:min-w-[18rem]' : 'md:w-0 md:min-w-0 md:overflow-hidden md:border-r-0'}
        `}
      >
        {/* Sidebar header */}
        <div className="shrink-0 p-3 border-b border-border/20">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-foreground">Conversations</h3>
            <button 
              onClick={() => setSidebarOpen(false)} 
              className="p-1.5 rounded-lg hover:bg-muted/40 transition-colors"
              title="Close sidebar"
            >
              <PanelLeftClose className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
          <button
            onClick={startNewChat}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-primary/10 hover:bg-primary/15 text-primary text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Chat
          </button>
        </div>

        {/* Search */}
        <div className="shrink-0 px-3 pt-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search chats..."
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg bg-muted/20 border border-border/20 outline-none focus:ring-1 focus:ring-primary/20"
            />
          </div>
        </div>

        {/* Conversations list */}
        <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {loadingConversations ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="text-center py-8 px-3">
              <MessageSquare className="w-8 h-8 mx-auto text-muted-foreground/30 mb-2" />
              <p className="text-xs text-muted-foreground">
                {searchQuery ? 'No matching conversations' : 'No conversations yet'}
              </p>
              <p className="text-[10px] text-muted-foreground/50 mt-1">
                Start a chat and it will appear here
              </p>
            </div>
          ) : (
            filteredConversations.map(conv => (
              <button
                key={conv.id}
                onClick={() => loadConversation(conv.id)}
                className={`group w-full text-left px-3 py-2.5 rounded-xl transition-colors relative ${
                  activeSessionId === conv.id
                    ? 'bg-primary/10 text-primary'
                    : 'hover:bg-muted/30 text-foreground'
                }`}
              >
                <p className="text-xs font-medium truncate pr-6">{conv.title}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <Clock className="w-2.5 h-2.5 text-muted-foreground/50" />
                  <span className="text-[10px] text-muted-foreground/60">{timeAgo(conv.lastMessageAt)}</span>
                  <span className="text-[10px] text-muted-foreground/40">·</span>
                  <span className="text-[10px] text-muted-foreground/60">{conv.messageCount} msgs</span>
                </div>
                <button
                  onClick={(e) => deleteConversation(conv.id, e)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md opacity-0 group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive transition-all"
                  title="Delete"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </button>
            ))
          )}
        </div>
      </div>

      {/* === MAIN CHAT AREA === */}
      <div className="flex-1 flex flex-col min-w-0">
      {featureLimitHit && (
        <TrialLimitReached
          feature="clarify"
          currentTier={featureLimitHit.tier as any}
          used={featureLimitHit.used}
          limit={featureLimitHit.limit}
          addonRemaining={featureLimitHit.addonRemaining}
          onDismiss={() => setFeatureLimitHit(null)}
        />
      )}

      {/* Header */}
      <div className="shrink-0 border-b border-border/20 bg-gradient-to-r from-violet-500/5 via-background to-purple-500/5 px-4 md:px-6 py-4">
        <div className="flex items-center gap-3 max-w-4xl mx-auto">
          {!sidebarOpen && (
            <button
              onClick={() => { setSidebarOpen(true); }}
              className="p-2 rounded-xl hover:bg-muted/40 transition-colors"
              title="Chat history"
            >
              <PanelLeftOpen className="w-4 h-4 text-muted-foreground" />
            </button>
          )}
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-violet-500/15 to-purple-500/10">
            <MessageCircleQuestion className="w-5 h-5 text-violet-600 dark:text-violet-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold">Get Clarification</h1>
            <p className="text-xs text-muted-foreground truncate">
              Ask questions, upload screenshots, or record voice notes
            </p>
          </div>
          {messages.length > 0 && (
            <button
              onClick={startNewChat}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary/10 hover:bg-primary/15 text-primary text-xs font-medium transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">New Chat</span>
            </button>
          )}
        </div>
      </div>

      {/* Loading overlay for session load */}
      {loadingSession && (
        <div className="absolute inset-0 bg-background/60 z-20 flex items-center justify-center">
          <div className="text-center space-y-2">
            <Loader2 className="w-5 h-5 animate-spin text-primary mx-auto" />
            <p className="text-xs text-muted-foreground">Loading conversation...</p>
          </div>
        </div>
      )}

      {/* Chat area */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-violet-500/15 to-purple-500/10 flex items-center justify-center mb-6">
                <Sparkles className="w-10 h-10 text-violet-500" />
              </div>
              <h2 className="text-2xl font-bold mb-2">Need Help Understanding Something?</h2>
              <p className="text-muted-foreground max-w-md mb-10">
                Upload a screenshot of confusing material, record a voice note with your question, 
                or simply type what you need clarified.
              </p>
              
              <div className="grid grid-cols-3 gap-4 w-full max-w-sm">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="group flex flex-col items-center gap-3 p-5 rounded-2xl bg-gradient-to-br from-sky-500/8 to-sky-500/3 hover:from-sky-500/15 hover:to-sky-500/8 transition-all duration-300"
                >
                  <div className="p-3 rounded-xl bg-sky-500/10 group-hover:scale-110 transition-transform">
                    <Image className="w-5 h-5 text-sky-500" />
                  </div>
                  <span className="text-sm font-medium">Screenshot</span>
                </button>
                <button
                  onClick={startRecording}
                  className="group flex flex-col items-center gap-3 p-5 rounded-2xl bg-gradient-to-br from-rose-500/8 to-rose-500/3 hover:from-rose-500/15 hover:to-rose-500/8 transition-all duration-300"
                >
                  <div className="p-3 rounded-xl bg-rose-500/10 group-hover:scale-110 transition-transform">
                    <Mic className="w-5 h-5 text-rose-500" />
                  </div>
                  <span className="text-sm font-medium">Voice Note</span>
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="group flex flex-col items-center gap-3 p-5 rounded-2xl bg-gradient-to-br from-amber-500/8 to-amber-500/3 hover:from-amber-500/15 hover:to-amber-500/8 transition-all duration-300"
                >
                  <div className="p-3 rounded-xl bg-amber-500/10 group-hover:scale-110 transition-transform">
                    <FileText className="w-5 h-5 text-amber-500" />
                  </div>
                  <span className="text-sm font-medium">Document</span>
                </button>
              </div>
            </div>
          ) : (
            <>
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`}
                >
                  <div
                    className={`max-w-[85%] md:max-w-[75%] px-4 py-3 rounded-2xl ${
                      message.role === 'user'
                        ? 'bg-primary text-primary-foreground rounded-br-md'
                        : 'bg-gradient-to-br from-muted/50 to-muted/20 rounded-bl-md'
                    }`}
                  >
                    {message.attachments && message.attachments.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-2">
                        {message.attachments.map((att, i) => (
                          <div 
                            key={i} 
                            className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs ${
                              message.role === 'user' ? 'bg-white/10' : 'bg-muted'
                            }`}
                          >
                            {att.type === 'image' && <Image className="w-3 h-3" />}
                            {att.type === 'audio' && <Mic className="w-3 h-3" />}
                            {att.type === 'document' && <FileText className="w-3 h-3" />}
                            <span className="truncate max-w-[100px]">{att.name}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {message.role === 'assistant' ? (
                      <>
                        <MarkdownRenderer content={message.content} size="sm" />
                        {message.isStreaming && (
                          <span className="inline-block w-1.5 h-4 bg-primary/60 animate-pulse ml-0.5 align-text-bottom rounded-sm" />
                        )}
                      </>
                    ) : (
                      <div className="prose-ai text-sm whitespace-pre-wrap">{message.content}</div>
                    )}
                  </div>
                </div>
              ))}
              
              <div ref={messagesEndRef} />
            </>
          )}
        </div>
      </div>

      {/* Recording indicator */}
      {isRecording && (
        <div className="shrink-0 px-4 pb-2">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center justify-center gap-4 p-4 rounded-xl bg-red-500/10 border border-red-500/20">
              <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
              <span className="text-sm font-medium text-red-500">Recording: {formatTime(recordingTime)}</span>
              <button
                onClick={stopRecording}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 text-white text-sm hover:bg-red-700 transition-colors"
              >
                <StopCircle className="w-4 h-4" />
                Stop
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Attachments preview */}
      {attachments.length > 0 && (
        <div className="shrink-0 px-4 pb-2">
          <div className="max-w-4xl mx-auto">
            <div className="flex gap-2 overflow-x-auto no-scrollbar py-1">
              {attachments.map((att) => (
                <div key={att.id} className="relative flex-shrink-0 group">
                  {att.type === 'image' && att.preview ? (
                    <div className="relative w-16 h-16 rounded-xl overflow-hidden border border-border">
                      <img src={att.preview} alt="" className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-border bg-card">
                      {att.type === 'audio' ? <Mic className="w-4 h-4 text-red-500" /> : <FileText className="w-4 h-4 text-gray-500" />}
                      <span className="text-xs truncate max-w-[80px]">{att.file.name}</span>
                    </div>
                  )}
                  <button
                    onClick={() => removeAttachment(att.id)}
                    className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Input */}
      <div className="shrink-0 border-t border-border/20 bg-gradient-to-t from-background to-transparent p-4">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,audio/*,.pdf,.doc,.docx"
          multiple
          onChange={handleFileSelect}
          className="hidden"
        />
        
        <div className="flex gap-3 max-w-4xl mx-auto">
          <div className="flex gap-1.5">
            <button
              type="button"
              className="shrink-0 h-11 w-11 rounded-xl bg-muted/30 hover:bg-muted/60 flex items-center justify-center transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <Paperclip className="w-4 h-4 text-muted-foreground" />
            </button>
            <button
              type="button"
              className={`shrink-0 h-11 w-11 rounded-xl flex items-center justify-center transition-colors ${isRecording ? 'bg-red-500/15 text-red-500' : 'bg-muted/30 hover:bg-muted/60 text-muted-foreground'}`}
              onClick={isRecording ? stopRecording : startRecording}
            >
              {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>
          </div>
          <textarea
            value={input}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => {
              setInput(e.target.value);
              const el = e.target;
              el.style.height = 'auto';
              el.style.height = Math.min(el.scrollHeight, 128) + 'px';
            }}
            placeholder="What do you need help understanding?"
            disabled={isLoading}
            className="flex-1 min-h-[44px] max-h-32 resize-none rounded-xl bg-muted/20 border border-border/20 focus:border-violet-500/40 px-3 py-2.5 text-sm outline-none focus:ring-1 focus:ring-violet-500/15 transition-colors"
            rows={1}
            onKeyDown={(e: React.KeyboardEvent<HTMLTextAreaElement>) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
          />
          <button 
            onClick={sendMessage} 
            disabled={isLoading || (!input.trim() && attachments.length === 0)}
            className="shrink-0 h-11 w-11 rounded-xl bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-40 hover:bg-primary/90 transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
    {/* End main chat area */}
    </div>
    </PremiumGate>
  );
}
