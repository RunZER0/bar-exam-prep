'use client';

import { useState, useRef, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { MarkdownRenderer } from '@/components/MarkdownRenderer';
import { 
  MessageCircle, X, Send, Loader2, Sparkles, 
  Paperclip, Mic, MicOff, Image, FileText 
} from 'lucide-react';

interface Attachment {
  id: string;
  type: 'image' | 'audio' | 'document';
  file: File;
  preview?: string;
  transcription?: string;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  attachments?: { type: string; name: string }[];
}

// Pages where chat should be disabled to prevent cheating
const RESTRICTED_PATHS = [
  '/exams/',
  '/quizzes',
];

export default function FloatingChat() {
  const pathname = usePathname();
  const { getIdToken } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId] = useState(() => crypto.randomUUID()); // Session for context awareness
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Check if we're on a restricted page
  const isRestricted = RESTRICTED_PATHS.some(path => pathname.includes(path));

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when chat opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Cleanup recording on unmount
  useEffect(() => {
    return () => {
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
    };
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach(file => {
      const type = file.type.startsWith('image/') ? 'image' 
        : file.type.startsWith('audio/') ? 'audio' 
        : 'document';
      
      const attachment: Attachment = {
        id: crypto.randomUUID(),
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
        const audioFile = new File([audioBlob], `voice-${Date.now()}.webm`, { type: 'audio/webm' });
        
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
            // Add transcribed text directly to input
            setInput(prev => prev + (prev ? ' ' : '') + data.text);
          } else {
            // Add as audio attachment if transcription fails
            setAttachments(prev => [...prev, {
              id: crypto.randomUUID(),
              type: 'audio',
              file: audioFile,
            }]);
          }
        } catch (error) {
          console.error('Transcription error:', error);
          setAttachments(prev => [...prev, {
            id: crypto.randomUUID(),
            type: 'audio',
            file: audioFile,
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

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if ((!input.trim() && attachments.length === 0) || isLoading) return;

    const userAttachments = attachments.map(a => ({
      type: a.type,
      name: a.file.name,
    }));

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: input.trim() || 'Please help with this:',
      timestamp: new Date(),
      attachments: userAttachments.length > 0 ? userAttachments : undefined,
    };

    setMessages(prev => [...prev, userMessage]);
    
    // Prepare attachment data for API
    const attachmentData = await Promise.all(attachments.map(async (att) => {
      if (att.type === 'image') {
        // Convert image to data URL for vision context
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
      return { type: att.type, fileName: att.file.name };
    }));
    
    const currentInput = input;
    setInput('');
    setAttachments([]);
    setIsLoading(true);

    try {
      const token = await getIdToken();
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          message: currentInput || 'Please help with this:',
          competencyType: 'clarification',
          sessionId, // Context-aware session
          attachments: attachmentData.length > 0 ? attachmentData : undefined,
          context: {
            source: 'floating-chat',
            currentPage: pathname,
            hasAttachments: attachmentData.length > 0,
          },
        }),
      });

      const data = await response.json();

      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: data.response || data.error || 'Sorry, I could not process your request.',
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Chat error:', error);
      setMessages(prev => [...prev, {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: 'Sorry, something went wrong. Please try again.',
        timestamp: new Date(),
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // Don't render on restricted pages
  if (isRestricted) {
    return null;
  }

  return (
    <>
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.pdf,.doc,.docx,.txt"
        onChange={handleFileSelect}
        className="hidden"
        multiple
      />

      {/* Floating Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`
          fixed bottom-6 right-6 z-50
          w-14 h-14 rounded-full
          bg-emerald-500 hover:bg-emerald-600
          text-white shadow-lg hover:shadow-xl
          flex items-center justify-center
          transition-all duration-300 ease-out
          ${isOpen ? 'scale-0 opacity-0' : 'scale-100 opacity-100'}
        `}
        aria-label="Open quick help chat"
      >
        <MessageCircle className="h-6 w-6" />
        <span className="absolute -top-1 -right-1 w-4 h-4 bg-amber-400 rounded-full flex items-center justify-center">
          <Sparkles className="h-2.5 w-2.5 text-amber-900" />
        </span>
      </button>

      {/* Chat Panel */}
      <div
        className={`
          fixed bottom-6 right-6 z-50
          w-[400px] max-w-[calc(100vw-3rem)]
          bg-card border border-border/50 rounded-2xl shadow-2xl
          flex flex-col
          transition-all duration-300 ease-out origin-bottom-right
          ${isOpen ? 'scale-100 opacity-100' : 'scale-0 opacity-0 pointer-events-none'}
        `}
        style={{ height: 'min(600px, calc(100vh - 6rem))' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/50 bg-muted/30 rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="p-1.5 bg-emerald-500/10 rounded-lg">
              <Sparkles className="h-4 w-4 text-emerald-500" />
            </div>
            <div>
              <h3 className="font-semibold text-sm">Quick Help</h3>
              <p className="text-xs text-muted-foreground">Ask anything about your studies</p>
            </div>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="p-1.5 hover:bg-muted rounded-lg transition-colors"
            aria-label="Close chat"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center px-4">
              <div className="p-3 bg-emerald-500/10 rounded-xl mb-3">
                <MessageCircle className="h-6 w-6 text-emerald-500" />
              </div>
              <h4 className="font-medium mb-1">Need quick help?</h4>
              <p className="text-sm text-muted-foreground mb-4">
                Ask questions, attach screenshots, or use voice notes.
              </p>
              <div className="space-y-2 w-full">
                {[
                  'Explain consideration in contract law',
                  'What is res judicata?',
                  'Difference between tort and crime',
                ].map((suggestion, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setInput(suggestion);
                      inputRef.current?.focus();
                    }}
                    className="w-full text-left text-xs px-3 py-2 bg-muted/50 hover:bg-muted rounded-lg transition-colors text-muted-foreground hover:text-foreground"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`}
                >
                  <div
                    className={`
                      max-w-[90%] px-3 py-2 rounded-2xl
                      ${msg.role === 'user'
                        ? 'bg-emerald-500 text-white rounded-br-md'
                        : 'bg-muted rounded-bl-md'
                      }
                    `}
                  >
                    {msg.attachments && msg.attachments.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-2">
                        {msg.attachments.map((att, i) => (
                          <span 
                            key={i} 
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs ${
                              msg.role === 'user' 
                                ? 'bg-emerald-600/50' 
                                : 'bg-background/50'
                            }`}
                          >
                            {att.type === 'image' && <Image className="h-3 w-3" />}
                            {att.type === 'document' && <FileText className="h-3 w-3" />}
                            {att.type === 'audio' && <Mic className="h-3 w-3" />}
                            {att.name}
                          </span>
                        ))}
                      </div>
                    )}
                    {msg.role === 'assistant' ? (
                      <MarkdownRenderer content={msg.content} size="sm" />
                    ) : (
                      <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                    )}
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-muted px-4 py-2 rounded-2xl rounded-bl-md">
                    <div className="flex items-center gap-2">
                      <div className="dot-pulse flex gap-1">
                        <span className="w-2 h-2 bg-primary rounded-full"></span>
                        <span className="w-2 h-2 bg-primary rounded-full"></span>
                        <span className="w-2 h-2 bg-primary rounded-full"></span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Attachments preview */}
        {attachments.length > 0 && (
          <div className="px-3 py-2 border-t border-border/50">
            <div className="flex flex-wrap gap-2">
              {attachments.map((att) => (
                <div 
                  key={att.id}
                  className="relative group flex items-center gap-1.5 px-2 py-1 bg-muted rounded-lg text-xs"
                >
                  {att.type === 'image' && att.preview && (
                    <img src={att.preview} alt="" className="h-6 w-6 rounded object-cover" />
                  )}
                  {att.type === 'image' && !att.preview && <Image className="h-4 w-4" />}
                  {att.type === 'document' && <FileText className="h-4 w-4" />}
                  {att.type === 'audio' && <Mic className="h-4 w-4" />}
                  <span className="max-w-[80px] truncate">{att.file.name}</span>
                  <button
                    onClick={() => removeAttachment(att.id)}
                    className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-destructive/20 rounded transition-opacity"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recording indicator */}
        {isRecording && (
          <div className="px-3 py-2 border-t border-border/50 bg-red-500/10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                <span className="text-sm text-red-500">Recording... {formatTime(recordingTime)}</span>
              </div>
              <button
                onClick={stopRecording}
                className="p-1.5 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
              >
                <MicOff className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* Input */}
        <form onSubmit={handleSubmit} className="p-3 border-t border-border/50">
          <div className="flex items-end gap-2">
            {/* Attachment button */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isRecording}
              className="p-2 hover:bg-muted rounded-lg transition-colors text-muted-foreground hover:text-foreground disabled:opacity-50"
            >
              <Paperclip className="h-4 w-4" />
            </button>
            
            {/* Voice button */}
            <button
              type="button"
              onClick={isRecording ? stopRecording : startRecording}
              className={`p-2 rounded-lg transition-colors ${
                isRecording 
                  ? 'bg-red-500 text-white hover:bg-red-600' 
                  : 'hover:bg-muted text-muted-foreground hover:text-foreground'
              }`}
            >
              {isRecording ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </button>

            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask a question..."
              rows={1}
              disabled={isRecording}
              className="flex-1 resize-none bg-muted/50 border border-border/50 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 max-h-24 disabled:opacity-50"
              style={{ minHeight: '40px' }}
            />
            <button
              type="submit"
              disabled={(!input.trim() && attachments.length === 0) || isLoading || isRecording}
              className="p-2.5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl transition-colors"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Backdrop for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  );
}
