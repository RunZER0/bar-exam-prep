'use client';

import { useRouter } from 'next/navigation';
import { Crown, Sparkles, ArrowRight, X, Rocket, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface TrialLimitReachedProps {
  feature: 'drafting' | 'oral_devil' | 'oral_exam';
  message?: string;
  onDismiss: () => void;
}

const FEATURE_LABELS: Record<string, { title: string; emoji: string; encouragement: string; perks: string[] }> = {
  drafting: {
    title: 'Legal Drafting',
    emoji: '📝',
    encouragement: "You've been putting in real work on your drafting skills — that's the kind of effort that passes exams.",
    perks: [
      'Unlimited drafting sessions across all document types',
      'AI-graded practice with redline annotations',
      'Step-by-step guided lessons for every document',
    ],
  },
  oral_devil: {
    title: "Devil's Advocate",
    emoji: '⚔️',
    encouragement: "Facing a Devil's Advocate takes courage. The fact you're here means you're serious about being ready.",
    perks: [
      "Unlimited Devil's Advocate sessions",
      'Session recordings you can download and review',
      'AI that adapts to push you to your limits',
    ],
  },
  oral_exam: {
    title: 'Oral Examination',
    emoji: '🎤',
    encouragement: "You showed up and faced the panel — that alone puts you ahead of most candidates. Keep that energy going.",
    perks: [
      'Unlimited oral exam sessions with 3-panelist boards',
      'Downloadable session recordings (7-day retention)',
      'Detailed performance summaries and scoring',
    ],
  },
};

export default function TrialLimitReached({ feature, message, onDismiss }: TrialLimitReachedProps) {
  const router = useRouter();
  const info = FEATURE_LABELS[feature] || FEATURE_LABELS.drafting;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="relative w-full max-w-md mx-4 bg-card border border-border rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
        {/* Close button */}
        <button
          onClick={onDismiss}
          className="absolute top-4 right-4 p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors z-10"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Header gradient */}
        <div className="bg-gradient-to-br from-primary/15 via-primary/5 to-transparent px-6 pt-8 pb-6 text-center">
          <div className="text-4xl mb-3">{info.emoji}</div>
          <h2 className="text-xl font-bold mb-2">
            You&apos;ve Used Your Free {info.title} Session
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed max-w-sm mx-auto">
            {info.encouragement}
          </p>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-5">
          {/* What you unlock */}
          <div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-primary uppercase tracking-wide mb-3">
              <Crown className="h-3.5 w-3.5" />
              What you unlock with a subscription
            </div>
            <ul className="space-y-2.5">
              {info.perks.map((perk, i) => (
                <li key={i} className="flex items-start gap-2.5 text-sm">
                  <Check className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                  <span className="text-foreground/90">{perk}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Pricing hint */}
          <div className="rounded-xl bg-muted/50 px-4 py-3 text-center">
            <p className="text-xs text-muted-foreground">
              Plans start at <span className="font-semibold text-foreground">KES 500/week</span>
              {' '}— less than a lunch.
            </p>
          </div>

          {/* CTA */}
          <div className="space-y-2.5">
            <Button
              onClick={() => router.push('/subscribe')}
              className="w-full h-11 text-sm font-semibold gap-2 group"
            >
              <Rocket className="h-4 w-4 group-hover:animate-bounce" />
              Upgrade & Keep Going
              <ArrowRight className="h-4 w-4 opacity-70 group-hover:translate-x-0.5 transition-transform" />
            </Button>
            <button
              onClick={onDismiss}
              className="w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors py-1.5"
            >
              Maybe later — I&apos;ll explore other free features
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
