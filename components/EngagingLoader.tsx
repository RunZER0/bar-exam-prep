'use client';

import { useState, useEffect, useMemo } from 'react';
import Image from 'next/image';

// ──────────────────────────────────────────────
// Fun facts, famous case quotes, and legal trivia
// Rotates every 4 seconds to keep the user entertained
// ──────────────────────────────────────────────

const FUN_FACTS: { text: string; category: 'fact' | 'quote' | 'trivia' }[] = [
  // Famous case quotes
  { text: '"Justice delayed is justice denied." — William E. Gladstone', category: 'quote' },
  { text: '"The law is reason, free from passion." — Aristotle', category: 'quote' },
  { text: '"Injustice anywhere is a threat to justice everywhere." — Martin Luther King Jr.', category: 'quote' },
  { text: '"The life of the law has not been logic; it has been experience." — Oliver Wendell Holmes Jr.', category: 'quote' },
  { text: '"Where there is a right, there is a remedy." — Legal Maxim (Ubi jus ibi remedium)', category: 'quote' },
  { text: '"No one is above the law, and no one is below it." — Theodore Roosevelt', category: 'quote' },
  { text: '"Let the decision stand." — Stare Decisis', category: 'quote' },
  { text: '"He who comes to equity must come with clean hands." — Equity Maxim', category: 'quote' },
  { text: '"An accused person is presumed innocent until proven guilty." — Woolmington v DPP [1935]', category: 'quote' },
  { text: '"The Constitution is the supreme law of Kenya." — Article 2, Constitution of Kenya 2010', category: 'quote' },

  // Exciting legal facts
  { text: 'Kenya\'s Constitution of 2010 is one of the most progressive in the world, with a detailed Bill of Rights spanning 45 articles.', category: 'fact' },
  { text: 'The doctrine of "stare decisis" means lower courts must follow decisions of higher courts — binding precedent keeps the law consistent.', category: 'fact' },
  { text: 'Under Kenyan law, a contract requires: offer, acceptance, consideration, capacity, and intention to create legal relations.', category: 'fact' },
  { text: 'The Advocates Act (Cap 16) governs legal practice in Kenya. Only admitted advocates can appear in the High Court.', category: 'fact' },
  { text: 'In Kenya, land law is governed by the Constitution, the Land Act 2012, the Land Registration Act 2012, and the Community Land Act 2016.', category: 'fact' },
  { text: 'The IRAC method (Issue, Rule, Application, Conclusion) is the gold standard for legal analysis in Kenyan bar exams.', category: 'fact' },
  { text: 'Article 50 of the Kenya Constitution guarantees the right to a fair trial, including the right to legal representation.', category: 'fact' },
  { text: 'The Kenya School of Law ATP has 9 core units covering everything from Civil Litigation to Professional Ethics.', category: 'fact' },
  { text: 'A tort is a civil wrong — unlike a crime, it gives rise to a private cause of action for damages.', category: 'fact' },
  { text: 'In Kenya, appeals from the High Court go to the Court of Appeal, and from there to the Supreme Court on matters of constitutional interpretation.', category: 'fact' },

  // Fun trivia
  { text: 'The word "advocate" comes from the Latin "advocatus" meaning "one called to aid."', category: 'trivia' },
  { text: 'Kenya\'s Supreme Court was established in 2011, making it one of the newest apex courts in the Commonwealth.', category: 'trivia' },
  { text: 'The longest trial in history lasted 7 years — McMartin preschool case in the USA (1987-1990).', category: 'trivia' },
  { text: '"Res ipsa loquitur" — the thing speaks for itself. Used when negligence is so obvious it doesn\'t need proving.', category: 'trivia' },
  { text: 'The Magna Carta (1215) is considered the foundation of the rule of law — it limited the power of the English king.', category: 'trivia' },
  { text: 'Habeas corpus literally means "you shall have the body" — it protects against unlawful detention.', category: 'trivia' },
  { text: 'In Donoghue v Stevenson [1932], a snail in a bottle of ginger beer established the modern law of negligence and the neighbor principle.', category: 'trivia' },
  { text: 'The average ATP student who practices 30 minutes daily outperforms 80% of peers who cram.', category: 'trivia' },
  { text: 'An affidavit is a written statement confirmed by oath — making a false one is the crime of perjury.', category: 'trivia' },
  { text: 'Equity was developed because common law was too rigid — the Chancellor\'s court provided "fairness" remedies like injunctions.', category: 'trivia' },
];

const CATEGORY_LABELS = {
  fact: '📚 Did You Know?',
  quote: '⚖️ Legal Wisdom',
  trivia: '💡 Fun Trivia',
};

interface EngagingLoaderProps {
  /** Optional override message shown below the logo */
  message?: string;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Whether to show the fun facts carousel */
  showFacts?: boolean;
}

export default function EngagingLoader({ 
  message, 
  size = 'md',
  showFacts = true,
}: EngagingLoaderProps) {
  // Shuffle facts on mount so each load is different
  const shuffledFacts = useMemo(() => {
    const copy = [...FUN_FACTS];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }, []);

  const [factIndex, setFactIndex] = useState(0);
  const [fadeIn, setFadeIn] = useState(true);

  useEffect(() => {
    if (!showFacts) return;
    const interval = setInterval(() => {
      setFadeIn(false);
      setTimeout(() => {
        setFactIndex(prev => (prev + 1) % shuffledFacts.length);
        setFadeIn(true);
      }, 600); // fade-out duration
    }, 8000); // rotate every 8 seconds — slow enough to read & appreciate
    return () => clearInterval(interval);
  }, [showFacts, shuffledFacts.length]);

  const currentFact = shuffledFacts[factIndex];

  const sizeConfig = {
    sm: { logo: 32, container: 'py-6', text: 'text-xs', factWidth: 'max-w-xs' },
    md: { logo: 48, container: 'py-12', text: 'text-sm', factWidth: 'max-w-md' },
    lg: { logo: 64, container: 'min-h-[60vh]', text: 'text-sm', factWidth: 'max-w-lg' },
  }[size];

  return (
    <div className={`flex flex-col items-center justify-center ${sizeConfig.container} px-4`}>
      {/* Animated Logo */}
      <div className="relative">
        {/* Pulse ring */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-20 h-20 rounded-full bg-primary/10 animate-ping" style={{ animationDuration: '2s' }} />
        </div>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-16 h-16 rounded-full bg-primary/5 animate-pulse" />
        </div>
        
        {/* Logo with gentle float */}
        <div className="relative z-10 animate-bounce" style={{ animationDuration: '3s', animationTimingFunction: 'ease-in-out' }}>
          <div className="p-3 bg-white dark:bg-zinc-900 rounded-2xl shadow-lg border border-primary/20">
            <Image
              src="/favicon-32x32.png"
              alt="Ynai"
              width={sizeConfig.logo}
              height={sizeConfig.logo}
              className="shrink-0"
              priority
            />
          </div>
        </div>
      </div>

      {/* Brand name */}
      <h2 className="mt-6 text-lg font-bold text-foreground tracking-tight">
        Ynai
      </h2>
      
      {/* Loading indicator bar */}
      <div className="mt-3 w-32 h-1 bg-muted rounded-full overflow-hidden">
        <div className="h-full bg-primary rounded-full animate-loading-bar" />
      </div>
      
      {/* Status message */}
      {message && (
        <p className="mt-3 text-xs text-muted-foreground animate-pulse">
          {message}
        </p>
      )}

      {/* Fun facts carousel */}
      {showFacts && currentFact && (
        <div className={`mt-8 ${sizeConfig.factWidth} text-center`}>
          <span className="text-xs font-medium text-primary/70 uppercase tracking-wider">
            {CATEGORY_LABELS[currentFact.category]}
          </span>
          <p 
            className={`mt-2 ${sizeConfig.text} text-muted-foreground leading-relaxed transition-opacity duration-400 ${
              fadeIn ? 'opacity-100' : 'opacity-0'
            }`}
          >
            {currentFact.text}
          </p>
        </div>
      )}
    </div>
  );
}
