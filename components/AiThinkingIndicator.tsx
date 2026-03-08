'use client';

import { useState, useEffect } from 'react';

/**
 * Animated AI thinking indicator — replaces boring spinners
 * with a pulsing dots animation + cycling contextual messages.
 *
 * Variants:
 *   - inline: compact chat bubble (for chat UIs)
 *   - card:   centered card with icon (for grading / full-panel waits)
 *   - minimal: just the dots (for buttons / tight spaces)
 */

const THINKING_MESSAGES = [
  'Thinking...',
  'Analyzing...',
  'Connecting the dots...',
  'Reviewing the law...',
  'Almost there...',
  'Putting it together...',
  'Reasoning through this...',
];

const GRADING_MESSAGES = [
  'Reading your answer...',
  'Checking against the rubric...',
  'Cross-referencing case law...',
  'Evaluating your reasoning...',
  'Scoring your response...',
  'Almost done...',
];

const RESEARCH_MESSAGES = [
  'Searching legal sources...',
  'Checking statutes...',
  'Finding relevant case law...',
  'Building your answer...',
  'Synthesizing findings...',
];

type MessageSet = 'thinking' | 'grading' | 'research';

const MESSAGE_SETS: Record<MessageSet, string[]> = {
  thinking: THINKING_MESSAGES,
  grading: GRADING_MESSAGES,
  research: RESEARCH_MESSAGES,
};

interface AiThinkingIndicatorProps {
  variant?: 'inline' | 'card' | 'minimal';
  messageSet?: MessageSet;
  /** Custom static message (overrides cycling) */
  message?: string;
  /** Custom className for the outer wrapper */
  className?: string;
}

function PulsingDots({ size = 'md' }: { size?: 'sm' | 'md' }) {
  const dotSize = size === 'sm' ? 'w-1.5 h-1.5' : 'w-2 h-2';
  return (
    <div className="flex items-center gap-1">
      {[0, 1, 2].map(i => (
        <span
          key={i}
          className={`${dotSize} rounded-full bg-primary animate-bounce`}
          style={{ animationDelay: `${i * 150}ms`, animationDuration: '0.8s' }}
        />
      ))}
    </div>
  );
}

function WaveBar() {
  return (
    <div className="flex items-end gap-[3px] h-4">
      {[0, 1, 2, 3, 4].map(i => (
        <span
          key={i}
          className="w-[3px] rounded-full bg-primary/60"
          style={{
            animation: 'wave 1.2s ease-in-out infinite',
            animationDelay: `${i * 0.1}s`,
            height: '40%',
          }}
        />
      ))}
      <style jsx>{`
        @keyframes wave {
          0%, 100% { height: 30%; opacity: 0.4; }
          50% { height: 100%; opacity: 1; }
        }
      `}</style>
    </div>
  );
}

export default function AiThinkingIndicator({
  variant = 'inline',
  messageSet = 'thinking',
  message,
  className = '',
}: AiThinkingIndicatorProps) {
  const [msgIndex, setMsgIndex] = useState(0);
  const [fade, setFade] = useState(true);
  const messages = MESSAGE_SETS[messageSet];

  useEffect(() => {
    if (message) return; // Static message, no cycling
    const timer = setInterval(() => {
      setFade(false);
      setTimeout(() => {
        setMsgIndex(prev => (prev + 1) % messages.length);
        setFade(true);
      }, 200);
    }, 2500);
    return () => clearInterval(timer);
  }, [message, messages.length]);

  const displayMsg = message || messages[msgIndex];

  if (variant === 'minimal') {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <PulsingDots size="sm" />
      </div>
    );
  }

  if (variant === 'card') {
    return (
      <div className={`flex items-center justify-center py-12 ${className}`}>
        <div className="text-center space-y-3">
          {/* Animated brain/wave */}
          <div className="relative w-12 h-12 mx-auto">
            <div className="absolute inset-0 rounded-full bg-primary/5 animate-ping" style={{ animationDuration: '2s' }} />
            <div className="absolute inset-0 rounded-full bg-primary/10 animate-pulse" />
            <div className="absolute inset-0 flex items-center justify-center">
              <WaveBar />
            </div>
          </div>
          <p className={`text-sm text-muted-foreground transition-opacity duration-200 ${fade ? 'opacity-100' : 'opacity-0'}`}>
            {displayMsg}
          </p>
        </div>
      </div>
    );
  }

  // variant === 'inline' (chat bubble style)
  return (
    <div className={`flex justify-start ${className}`}>
      <div className="bg-muted/50 rounded-2xl rounded-tl-md px-4 py-3 border border-border/30">
        <div className="flex items-center gap-2.5">
          <WaveBar />
          <span className={`text-sm text-muted-foreground transition-opacity duration-200 ${fade ? 'opacity-100' : 'opacity-0'}`}>
            {displayMsg}
          </span>
        </div>
      </div>
    </div>
  );
}
