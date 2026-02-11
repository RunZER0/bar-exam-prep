'use client';

import { useRef, useEffect, useState, KeyboardEvent } from 'react';
import { Send, Loader2, Sparkles, Mic, Paperclip, ArrowUp, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface SmartChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
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
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isFocused, setIsFocused] = useState(false);

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
      if (value.trim() && !isLoading && !disabled) {
        onSend();
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

      {/* Main input container - ChatGPT style */}
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
              className="h-9 w-9 shrink-0 text-muted-foreground hover:text-foreground"
              disabled={disabled}
            >
              <Mic className="h-4 w-4" />
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
              onClick={onSend}
              disabled={!value.trim() || disabled || isLoading}
              size="sm"
              className={cn(
                'h-9 w-9 shrink-0 rounded-xl transition-all duration-200',
                value.trim() && !disabled
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
        onClick={onSend}
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
