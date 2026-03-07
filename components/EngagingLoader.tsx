'use client';

import { useState, useEffect, useMemo } from 'react';
import Image from 'next/image';

// ──────────────────────────────────────────────
// Fun facts, famous case quotes, and legal trivia
// Rotates every 4 seconds to keep the user entertained
// ──────────────────────────────────────────────

const FUN_FACTS: { text: string; category: 'fact' | 'quote' | 'trivia' | 'platform' | 'cognition' | 'joke' }[] = [
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

  // Legal jokes & puns 😂
  { text: 'Why did the lawyer bring a ladder to court? Because they wanted to take their case to a higher court! 😂', category: 'joke' },
  { text: 'What\'s the difference between a lawyer and a herd of buffalo? The lawyer charges more. 🦬', category: 'joke' },
  { text: 'A man walks into a bar… exam. Just kidding, nobody walks INTO a bar exam willingly. 📚', category: 'joke' },
  { text: 'Why don\'t lawyers ever go to the beach? Because cats keep trying to bury them in the sand. 🏖️', category: 'joke' },
  { text: 'I told my friend I was studying tort law. He said, "That sounds delicious." I said, "No, that\'s torte." 🎂', category: 'joke' },
  { text: 'What do you call a lawyer who doesn\'t chase ambulances? Retired. 🚑', category: 'joke' },
  { text: 'Why did the judge go to the dentist? To get to the root of the problem. 🦷⚖️', category: 'joke' },
  { text: 'My study group said I had no precedent for skipping class. I cited "The Case of I Overslept v. My Alarm Clock." ⏰', category: 'joke' },
  { text: 'How does an attorney sleep? First they lie on one side, then they lie on the other. 😴', category: 'joke' },
  { text: 'What\'s the difference between a good lawyer and a great lawyer? A good lawyer knows the law. A great lawyer knows the judge. 🤝', category: 'joke' },
  { text: 'Breaking: Law student discovers "brief" is just a fancy word for "please summarize these 400 pages by tomorrow." 📄', category: 'joke' },
  { text: 'Why are lawyers bad at math? They always want to argue about the terms. ➕⚖️', category: 'joke' },
  { text: 'The law of diminishing returns: The more you study, the less you remember the night before the exam. 🧠', category: 'joke' },
  { text: 'Pro tip: If you can\'t dazzle them with brilliance, baffle them with Latin maxims. Res ipsa loquitur! 🎩', category: 'joke' },
  { text: 'A criminal\'s best asset is his lie-ability. ⚖️😄', category: 'joke' },
  { text: 'How many law students does it take to change a lightbulb? "It depends." — Every law professor ever. 💡', category: 'joke' },
  { text: 'My moot court partner ghosted me. I guess they couldn\'t handle the objection. 👻', category: 'joke' },
  { text: 'Why do bar exam students make great friends? They\'re always prepared for cross-examination. 🍻', category: 'joke' },
  { text: 'What\'s a lawyer\'s favorite drink? Subpoena colada. 🍹', category: 'joke' },
  { text: 'I tried to sue the airline for losing my luggage. I lost my case. ✈️', category: 'joke' },
  { text: 'Studying for the bar exam is like running a marathon — except the finish line keeps moving and everyone\'s judging you. 🏃‍♂️', category: 'joke' },
  { text: 'Why did the contract go to therapy? It had too many issues with consideration. 💔', category: 'joke' },
  { text: 'My professor said "this will be on the exam." That was 3 hours ago. He\'s still talking. 😅', category: 'joke' },
  { text: 'You know you\'re a law student when you argue with the waiter about the "terms and conditions" of the menu. 🍽️', category: 'joke' },

  // Exciting legal facts
  { text: 'Kenya\'s Constitution of 2010 is one of the most progressive in the world, with a detailed Bill of Rights spanning 45 articles.', category: 'fact' },
  { text: 'The doctrine of "stare decisis" means lower courts must follow decisions of higher courts — binding precedent keeps the law consistent.', category: 'fact' },
  { text: 'Under Kenyan law, a contract requires: offer, acceptance, consideration, capacity, and intention to create legal relations.', category: 'fact' },
  { text: 'The Advocates Act (Cap 16) governs legal practice in Kenya. Only admitted advocates can appear in the High Court.', category: 'fact' },
  { text: 'In Kenya, land law is governed by the Constitution, the Land Act 2012, the Land Registration Act 2012, and the Community Land Act 2016.', category: 'fact' },
  { text: 'The IRAC method (Issue, Rule, Application, Conclusion) is the gold standard for legal analysis in Kenyan bar exams.', category: 'fact' },
  { text: 'Article 50 of the Kenya Constitution guarantees the right to a fair trial, including the right to legal representation.', category: 'fact' },
  { text: 'A tort is a civil wrong — unlike a crime, it gives rise to a private cause of action for damages.', category: 'fact' },
  { text: 'In Kenya, appeals from the High Court go to the Court of Appeal, and from there to the Supreme Court on matters of constitutional interpretation.', category: 'fact' },

  // Fun trivia
  { text: 'The word "advocate" comes from the Latin "advocatus" meaning "one called to aid."', category: 'trivia' },
  { text: 'Kenya\'s Supreme Court was established in 2011, making it one of the newest apex courts in the Commonwealth.', category: 'trivia' },
  { text: '"Res ipsa loquitur" — the thing speaks for itself. Used when negligence is so obvious it doesn\'t need proving.', category: 'trivia' },
  { text: 'The Magna Carta (1215) is considered the foundation of the rule of law — it limited the power of the English king.', category: 'trivia' },
  { text: 'Habeas corpus literally means "you shall have the body" — it protects against unlawful detention.', category: 'trivia' },
  { text: 'In Donoghue v Stevenson [1932], a snail in a bottle of ginger beer established the modern law of negligence and the neighbor principle.', category: 'trivia' },
  { text: 'An affidavit is a written statement confirmed by oath — making a false one is the crime of perjury.', category: 'trivia' },
  { text: 'Equity was developed because common law was too rigid — the Chancellor\'s court provided "fairness" remedies like injunctions.', category: 'trivia' },

  // Platform discovery — teach users about Ynai features
  { text: 'Tip: Click on any statute citation in your study notes to read the exact verbatim text from Kenya Law.', category: 'platform' },
  { text: 'Tip: Highlight any text in your study notes and choose "Simplify" to get a clearer explanation instantly.', category: 'platform' },
  { text: 'Tip: Switch between Slide view and Reader view using the toggle in the study header — Reader mode shows everything on one page.', category: 'platform' },
  { text: 'Tip: The Mastery Hub adapts daily — it tracks what you\'ve covered and surfaces topics that need attention.', category: 'platform' },
  { text: 'Tip: Your study materials are generated fresh based on the KSL syllabus, Kenyan statutes, and real case law from Kenya Law.', category: 'platform' },
  { text: 'Tip: Use the floating chat bubble to ask any legal question — it has context from your current study session.', category: 'platform' },
  { text: 'Tip: Try the Legal Drafting section to practice writing affidavits, pleadings, and opinions with AI feedback.', category: 'platform' },
  { text: 'Tip: Your Readiness tab shows a breakdown of your mastery level across all 9 ATP units.', category: 'platform' },
  { text: 'Tip: Checkpoint questions appear between study slides — they test application, not just recall.', category: 'platform' },
  { text: 'Ynai covers all 9 KSL ATP courses: Civil Litigation, Criminal Litigation, Property Law, Commercial Transactions, Family Law, Professional Ethics, Public Law, Tax, and Legal Writing.', category: 'platform' },

  // Cognition & study science
  { text: 'Studies show that testing yourself (active recall) is 3x more effective than re-reading your notes.', category: 'cognition' },
  { text: 'Spaced repetition — reviewing material at increasing intervals — is proven to boost long-term retention by up to 200%.', category: 'cognition' },
  { text: 'The "testing effect": students who take practice tests remember 50% more than those who only re-study.', category: 'cognition' },
  { text: 'Taking short breaks every 25-30 minutes (Pomodoro) keeps your brain fresh and improves focus during study sessions.', category: 'cognition' },
  { text: 'Writing summaries in your own words (elaborative interrogation) strengthens connections in memory.', category: 'cognition' },
  { text: 'Research shows 30 minutes of focused daily practice outperforms 3-hour weekend cramming sessions.', category: 'cognition' },
  { text: 'The "generation effect": information you work to generate or apply is remembered better than information you passively receive.', category: 'cognition' },
  { text: 'Sleep consolidates memory — reviewing notes before bed can improve recall the next day by up to 20%.', category: 'cognition' },
];

const CATEGORY_LABELS: Record<string, string> = {
  fact: '📚 Did You Know?',
  quote: '⚖️ Legal Wisdom',
  trivia: '💡 Fun Trivia',
  platform: '🎯 Ynai Tip',
  cognition: '🧠 Study Science',
  joke: '😂 Legal Humor',
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
