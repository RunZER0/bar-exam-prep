'use client';

import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Lock, ArrowRight, Zap, Crown, Rocket } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSubscription } from '@/contexts/SubscriptionContext';
import EngagingLoader from '@/components/EngagingLoader';
import { TIER_META, TIER_PRICES, formatPrice } from '@/lib/constants/pricing';

interface BasicFeatureGateProps {
  children: React.ReactNode;
}

/**
 * Wraps pages that provide "basic" features (mastery hub, study hub,
 * quizzes, community, banter, tutor). Custom-package users do NOT
 * get these — they must upgrade to a general tier.
 */
export default function BasicFeatureGate({ children }: BasicFeatureGateProps) {
  const { tier, loading } = useSubscription();
  const router = useRouter();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <EngagingLoader size="md" message="Checking access..." />
      </div>
    );
  }

  // Only block custom-tier users; all general tiers + trial get basic features
  if (tier !== 'custom') {
    return <>{children}</>;
  }

  const TIER_ICONS: Record<string, typeof Zap> = { Zap, Crown, Rocket };

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-5rem)] p-4 sm:p-6">
      <div className="max-w-lg w-full mx-auto">
        <div className="relative bg-card/90 backdrop-blur-2xl border border-border/40 rounded-3xl shadow-2xl overflow-hidden">
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute -top-24 -left-24 w-72 h-72 bg-violet-500/10 rounded-full blur-3xl animate-pulse" />
            <div className="absolute -bottom-24 -right-24 w-72 h-72 bg-emerald-500/8 rounded-full blur-3xl animate-pulse [animation-delay:1s]" />
          </div>

          <div className="relative px-8 pt-10 pb-8 text-center">
            <div className="inline-flex items-center justify-center mb-6">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-br from-violet-400/30 to-purple-500/30 rounded-2xl blur-xl scale-150" />
                <div className="relative bg-card border border-border/50 rounded-2xl p-4 shadow-lg">
                  <Image src="/favicon-32x32.png" alt="Ynai" width={48} height={48} className="rounded-lg" />
                </div>
              </div>
            </div>

            <div className="inline-flex items-center gap-2 bg-violet-500/10 border border-violet-500/20 rounded-full px-4 py-1.5 mb-5">
              <Lock className="h-3.5 w-3.5 text-violet-500" />
              <span className="text-xs font-semibold text-violet-600 dark:text-violet-400 tracking-wide uppercase">
                General Plan Feature
              </span>
            </div>

            <h2 className="text-2xl font-bold mb-2">Included in General Plans</h2>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-sm mx-auto mb-6">
              This feature is included in all general subscription tiers. Your custom package only covers the premium features you selected.
            </p>

            <div className="mx-auto h-px bg-gradient-to-r from-transparent via-border to-transparent mb-6" />

            <div className="space-y-3">
              {(['light', 'standard', 'premium'] as const).map((t) => {
                const meta = TIER_META[t];
                const Icon = TIER_ICONS[meta.icon] || Zap;
                return (
                  <button
                    key={t}
                    onClick={() => router.push(`/subscribe?plan=${t}&period=monthly`)}
                    className="w-full group rounded-2xl border border-border/50 bg-gradient-to-br from-muted/30 to-muted/10 p-4 text-left hover:border-emerald-500/30 hover:shadow-lg transition-all duration-300"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-xl bg-gradient-to-br ${meta.gradient} text-white shadow-md`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold">{meta.name}</p>
                        <p className="text-xs text-muted-foreground">{meta.description}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                          {formatPrice(TIER_PRICES[t].monthly)}<span className="text-xs font-normal text-muted-foreground">/mo</span>
                        </p>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-emerald-500 transition-all shrink-0" />
                    </div>
                  </button>
                );
              })}
            </div>

            <p className="mt-5 text-xs text-muted-foreground">
              General plans include unlimited access to Mastery Hub, Study Hub, Quizzes, Community, Legal Banter, and more — plus weekly premium feature sessions.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
