'use client';

import { useRef, useEffect, useState, useCallback, KeyboardEvent } from 'react';
import { Send, Loader2, Sparkles, Mic, Paperclip, ArrowUp, Square, X, FileText, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';

export interface Attachment {
  id: string;
  file: File;
  type: 'image' | 'audio' | 'document';
  preview?: string;
  transcription?: string;
}

interface SmartChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: (attachments?: Attachment[]) => void;
  onStop?: () => void;
  isLoading?: boolean;
  placeholder?: string;
  suggestions?: Array<{ label: string; prompt: string }>;
  onSuggestionClick?: (prompt: string) => void;
  showAttachment?: boolean;
  showVoice?: boolean;
  className?: string;
  maxHeight?: number;
  disabled?: boolean;
}

export function SmartChatInput({
  value,
  onChange,
  onSend,
  onStop,
  isLoading = false,
  placeholder = 'Ask anything...',
  suggestions = [],
  onSuggestionClick,
  showAttachment = false,
  showVoice = false,
  className,
  maxHeight = 200,
  disabled = false,
}: SmartChatInputProps) {
  const { getIdToken } = useAuth();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [attachments, setAttachments] = useState<Attachment[]>([]);

  // Cleanup recording on unmount
  useEffect(() => {
    return () => {
      if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
    };
  }, []);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      const newHeight = Math.min(textarea.scrollHeight, maxHeight);
      textarea.style.height = `${newHeight}px`;
    }
  }, [value, maxHeight]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if ((value.trim() || attachments.length > 0) && !isLoading && !disabled) {
        onSend(attachments.length > 0 ? attachments : undefined);
        setAttachments([]);
      }
    }
  };

  const handleSuggestionClick = (prompt: string) => {
    if (onSuggestionClick) {
      onSuggestionClick(prompt);
    } else {
      onChange(prompt);
      textareaRef.current?.focus();
    }
  };

  // ---- File Upload ----
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach(file => {
      const type: Attachment['type'] = file.type.startsWith('image/') ? 'image'
        : file.type.startsWith('audio/') ? 'audio' : 'document';
      const att: Attachment = { id: `${Date.now()}-${Math.random()}`, file, type };
      if (type === 'image') att.preview = URL.createObjectURL(file);
      setAttachments(prev => [...prev, att]);
    });
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  const removeAttachment = useCallback((id: string) => {
    setAttachments(prev => {
      const a = prev.find(x => x.id === id);
      if (a?.preview) URL.revokeObjectURL(a.preview);
      return prev.filter(x => x.id !== id);
    });
  }, []);

  // ---- Voice Recording ----
  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (e: BlobEvent) => audioChunksRef.current.push(e.data);
      recorder.onstop = async () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const audioFile = new File([blob], `voice-${Date.now()}.webm`, { type: 'audio/webm' });
        try {
          const token = await getIdToken();
          const fd = new FormData();
          fd.append('audio', audioFile);
          const res = await fetch('/api/transcribe', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd });
          const data = await res.json();
          if (data.text) onChange(value + (value ? ' ' : '') + data.text);
        } catch (e) { console.error('Transcription error:', e); }
        stream.getTracks().forEach(t => t.stop());
        setRecordingTime(0);
      };

      recorder.start();
      setIsRecording(true);
      recordingIntervalRef.current = setInterval(() => setRecordingTime(p => p + 1), 1000);
    } catch (e) { console.error('Mic error:', e); }
  }, [getIdToken, onChange]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
    }
  }, [isRecording]);

  const formatRecTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  const showSuggestions = suggestions.length > 0 && !value.trim() && isFocused;

  return (
    <div className={cn('relative w-full', className)}>
      {/* Suggestions chips */}
      {showSuggestions && (
        <div className="absolute bottom-full left-0 right-0 mb-2 flex flex-wrap gap-2 px-1">
          {suggestions.map((suggestion, index) => (
            <button
              key={index}
              onClick={() => handleSuggestionClick(suggestion.prompt)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full 
                         bg-muted/80 text-muted-foreground hover:bg-muted hover:text-foreground
                         transition-all duration-200 border border-border/50 hover:border-border
                         backdrop-blur-sm"
            >
              <Sparkles className="h-3 w-3 text-primary" />
              {suggestion.label}
            </button>
          ))}
        </div>
      )}

      {/* Attachment previews */}
      {attachments.length > 0 && (
        <div className="flex gap-2 overflow-x-auto px-2 pb-2 no-scrollbar">
          {attachments.map(att => (
            <div key={att.id} className="relative flex-shrink-0 group">
              {att.preview ? (
                <div className="w-14 h-14 rounded-xl overflow-hidden border border-border/30">
                  <img src={att.preview} alt="" className="w-full h-full object-cover" />
                </div>
              ) : (
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-muted/30 border border-border/30">
                  {att.type === 'audio' ? <Mic className="w-3.5 h-3.5 text-red-500" /> : <FileText className="w-3.5 h-3.5 text-muted-foreground" />}
                  <span className="text-xs truncate max-w-[60px]">{att.file.name}</span>
                </div>
              )}
              <button onClick={() => removeAttachment(att.id)} className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Hidden file input */}
      {showAttachment && (
        <input ref={fileInputRef} type="file" accept="image/*,.pdf,.doc,.docx" multiple onChange={handleFileSelect} className="hidden" />
      )}

      {/* Main input container */}
      <div
        className={cn(
          'relative flex items-end gap-2 rounded-2xl',
          'bg-muted/50 border border-border/50',
          'transition-all duration-200',
          isFocused && 'border-primary/50 bg-muted/80 shadow-lg shadow-primary/5',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
      >
        {/* Attachment button */}
        {showAttachment && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-9 w-9 shrink-0 ml-1 mb-1.5 text-muted-foreground hover:text-foreground"
            disabled={disabled || isLoading}
            onClick={() => fileInputRef.current?.click()}
          >
            <Paperclip className="h-4 w-4" />
          </Button>
        )}

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setTimeout(() => setIsFocused(false), 200)}
          placeholder={placeholder}
          disabled={disabled || isLoading}
          rows={1}
          className={cn(
            'flex-1 min-h-[44px] py-3 px-4 bg-transparent border-0',
            'text-sm text-foreground placeholder:text-muted-foreground',
            'focus:outline-none focus:ring-0 resize-none',
            'scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent',
            !showAttachment && 'pl-4',
            disabled && 'cursor-not-allowed'
          )}
          style={{ maxHeight: `${maxHeight}px` }}
        />

        {/* Right side buttons */}
        <div className="flex items-center gap-1 mr-1.5 mb-1.5">
          {/* Voice button */}
          {showVoice && !isLoading && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={cn(
                'shrink-0 text-muted-foreground hover:text-foreground',
                isRecording ? 'h-9 px-2 gap-1.5 text-red-500 hover:text-red-600' : 'h-9 w-9'
              )}
              disabled={disabled}
              onClick={isRecording ? stopRecording : startRecording}
            >
              {isRecording ? (
                <>
                  <Square className="h-3.5 w-3.5 fill-current" />
                  <span className="text-xs font-medium">{formatRecTime(recordingTime)}</span>
                </>
              ) : (
                <Mic className="h-4 w-4" />
              )}
            </Button>
          )}

          {/* Send/Stop button */}
          {isLoading && onStop ? (
            <Button
              type="button"
              onClick={onStop}
              size="sm"
              className="h-9 w-9 shrink-0 rounded-xl bg-primary hover:bg-primary/90"
            >
              <Square className="h-3.5 w-3.5 fill-current" />
            </Button>
          ) : (
            <Button
              type="button"
              onClick={() => { onSend(attachments.length > 0 ? attachments : undefined); setAttachments([]); }}
              disabled={(!value.trim() && attachments.length === 0) || disabled || isLoading}
              size="sm"
              className={cn(
                'h-9 w-9 shrink-0 rounded-xl transition-all duration-200',
                (value.trim() || attachments.length > 0) && !disabled
                  ? 'bg-primary hover:bg-primary/90 text-primary-foreground'
                  : 'bg-muted-foreground/20 text-muted-foreground cursor-not-allowed'
              )}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ArrowUp className="h-4 w-4" />
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Helper text */}
      <p className="text-[10px] text-muted-foreground/60 text-center mt-2">
        Press Enter to send, Shift+Enter for new line
      </p>
    </div>
  );
}

// Floating variant for overlay use
export function FloatingChatInput(props: SmartChatInputProps) {
  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 w-full max-w-2xl px-4 z-50">
      <SmartChatInput {...props} />
    </div>
  );
}

// Compact variant for sidebars
export function CompactChatInput({
  value,
  onChange,
  onSend,
  isLoading = false,
  placeholder = 'Quick question...',
  disabled = false,
}: Pick<SmartChatInputProps, 'value' | 'onChange' | 'onSend' | 'isLoading' | 'placeholder' | 'disabled'>) {
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (value.trim() && !isLoading && !disabled) {
        onSend();
      }
    }
  };

  return (
    <div className="flex items-center gap-2 p-2 rounded-xl bg-muted/50 border border-border/50">
      <Sparkles className="h-4 w-4 text-primary shrink-0" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled || isLoading}
        className="flex-1 bg-transparent text-sm border-0 focus:outline-none focus:ring-0 placeholder:text-muted-foreground disabled:cursor-not-allowed"
      />
      <Button
        type="button"
        onClick={() => onSend()}
        disabled={!value.trim() || disabled || isLoading}
        size="sm"
        variant="ghost"
        className="h-7 w-7 p-0"
      >
        {isLoading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Send className="h-3.5 w-3.5" />
        )}
      </Button>
    </div>
  );
}
