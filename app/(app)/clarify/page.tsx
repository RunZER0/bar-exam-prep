'use client';

import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { MarkdownRenderer } from '@/components/MarkdownRenderer';
import { 
  MessageCircleQuestion, Send, Image, Mic, MicOff, 
  X, FileText, Paperclip, StopCircle, Sparkles
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
  attachments?: { type: string; name: string; url?: string }[];
};

export default function ClarifyPage() {
  const { getIdToken } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [sessionId] = useState(() => crypto.randomUUID()); // Session for context awareness
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);

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
      content: input.trim() || 'Please help me understand this:',
      attachments: userAttachments,
    };

    setMessages(prev => [...prev, userMessage]);
    const currentInput = input;
    const currentAttachments = [...attachments];
    setInput('');
    setAttachments([]);
    setIsLoading(true);

    try {
      const token = await getIdToken();
      
      // Prepare attachment data for context-aware AI
      const attachmentData = await Promise.all(currentAttachments.map(async (att) => {
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
        if (att.type === 'audio') {
          return {
            type: att.type,
            fileName: att.file.name,
            transcription: att.transcription || `[Voice note: ${att.duration || 0}s]`,
          };
        }
        return { type: att.type, fileName: att.file.name };
      }));
      
      let enhancedMessage = currentInput;
      if (currentAttachments.length > 0) {
        const attachmentDescriptions = currentAttachments.map(a => {
          if (a.type === 'image') return `[User attached an image: ${a.file.name}]`;
          if (a.type === 'audio') return `[User attached a voice note: ${a.file.name}, duration: ${a.duration}s]`;
          return `[User attached a document: ${a.file.name}]`;
        }).join(' ');
        enhancedMessage = `${attachmentDescriptions}\n\n${currentInput || 'Please help me understand this.'}`;
      }

      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          message: enhancedMessage,
          competencyType: 'clarification',
          sessionId, // Context-aware session
          attachments: attachmentData.length > 0 ? attachmentData : undefined,
          context: {
            source: 'clarify-page',
            hasAttachments: attachmentData.length > 0,
          },
        }),
      });

      if (!response.ok) throw new Error('Failed to get response');

      const data = await response.json();
      
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.response,
      };

      setMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      console.error('Chat error:', error);
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'I apologize, but I encountered an error processing your request. Please try again.',
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] md:h-screen">
      {/* Header */}
      <div className="shrink-0 border-b border-border/50 bg-card/50 backdrop-blur-xl px-6 py-4">
        <div className="flex items-center gap-4 max-w-4xl mx-auto">
          <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20">
            <MessageCircleQuestion className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-semibold">Get Clarification</h1>
            <p className="text-sm text-muted-foreground">
              Ask questions, upload screenshots, or record voice notes
            </p>
          </div>
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 flex items-center justify-center mb-6">
                <Sparkles className="w-10 h-10 text-primary" />
              </div>
              <h2 className="text-2xl font-bold mb-2">Need Help Understanding Something?</h2>
              <p className="text-muted-foreground max-w-md mb-10">
                Upload a screenshot of confusing material, record a voice note with your question, 
                or simply type what you need clarified.
              </p>
              
              <div className="grid grid-cols-3 gap-4 w-full max-w-sm">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="group flex flex-col items-center gap-3 p-5 rounded-2xl border border-border/50 bg-card hover:bg-accent hover:border-primary/30 transition-all duration-300"
                >
                  <div className="p-3 rounded-xl bg-gray-500/10 border border-gray-500/20 group-hover:scale-110 transition-transform">
                    <Image className="w-5 h-5 text-gray-500" />
                  </div>
                  <span className="text-sm font-medium">Screenshot</span>
                </button>
                <button
                  onClick={startRecording}
                  className="group flex flex-col items-center gap-3 p-5 rounded-2xl border border-border/50 bg-card hover:bg-accent hover:border-primary/30 transition-all duration-300"
                >
                  <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 group-hover:scale-110 transition-transform">
                    <Mic className="w-5 h-5 text-red-500" />
                  </div>
                  <span className="text-sm font-medium">Voice Note</span>
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="group flex flex-col items-center gap-3 p-5 rounded-2xl border border-border/50 bg-card hover:bg-accent hover:border-primary/30 transition-all duration-300"
                >
                  <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 group-hover:scale-110 transition-transform">
                    <FileText className="w-5 h-5 text-emerald-500" />
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
                        : 'bg-card border border-border/50 rounded-bl-md'
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
                      <MarkdownRenderer content={message.content} size="sm" />
                    ) : (
                      <div className="prose-ai text-sm whitespace-pre-wrap">{message.content}</div>
                    )}
                  </div>
                </div>
              ))}
              
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-card border border-border/50 px-4 py-3 rounded-2xl rounded-bl-md">
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
      </div>

      {/* Recording indicator */}
      {isRecording && (
        <div className="shrink-0 px-4 pb-2">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center justify-center gap-4 p-4 rounded-xl bg-red-500/10 border border-red-500/20">
              <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
              <span className="text-sm font-medium text-red-500">Recording: {formatTime(recordingTime)}</span>
              <Button
                size="sm"
                variant="destructive"
                onClick={stopRecording}
                className="gap-1.5"
              >
                <StopCircle className="w-4 h-4" />
                Stop
              </Button>
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
      <div className="shrink-0 border-t border-border/50 bg-card/50 backdrop-blur-xl p-4">
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
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="shrink-0 h-11 w-11 rounded-xl border-border/50 hover:border-border"
              onClick={() => fileInputRef.current?.click()}
            >
              <Paperclip className="w-4 h-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className={`shrink-0 h-11 w-11 rounded-xl border-border/50 hover:border-border ${isRecording ? 'text-red-500 border-red-500/50' : ''}`}
              onClick={isRecording ? stopRecording : startRecording}
            >
              {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </Button>
          </div>
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="What do you need help understanding?"
            disabled={isLoading}
            className="flex-1 min-h-[44px] max-h-32 resize-none rounded-xl bg-background border-border/50 focus:border-primary/50"
            rows={1}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
          />
          <Button 
            onClick={sendMessage} 
            disabled={isLoading || (!input.trim() && attachments.length === 0)}
            className="shrink-0 h-11 w-11 rounded-xl"
            size="icon"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
