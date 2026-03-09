'use client';

import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Crown, Sparkles, ArrowRight, X, Rocket, Check, ShoppingBag, Zap, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  PREMIUM_FEATURE_META,
  TIER_META,
  WEEKLY_LIMITS,
  ADDON_PRICES,
  formatPrice,
  type PremiumFeature,
  type SubscriptionTier,
} from '@/lib/constants/pricing';

interface FeatureGateProps {
  feature: PremiumFeature;
  currentTier?: SubscriptionTier;
  used?: number;
  limit?: number;
  addonRemaining?: number;
  onDismiss: () => void;
  /** Show as a full blocking overlay (default) or inline card */
  variant?: 'overlay' | 'inline';
}

// Legacy compat (expanded to cover all premium features)
interface TrialLimitReachedProps {
  feature: PremiumFeature;
  message?: string;
  onDismiss: () => void;
}

// Find the minimum tier that unlocks a feature with more capacity
function getRecommendedTier(feature: PremiumFeature, currentTier: SubscriptionTier): SubscriptionTier {
  const tiers: SubscriptionTier[] = ['light', 'standard', 'premium'];
  const currentIdx = tiers.indexOf(currentTier);

  for (let i = Math.max(currentIdx + 1, 0); i < tiers.length; i++) {
    if (WEEKLY_LIMITS[tiers[i]][feature] > (WEEKLY_LIMITS[currentTier]?.[feature] ?? 0)) {
      return tiers[i];
    }
  }
  return 'premium';
}

function FeatureGate({
  feature,
  currentTier = 'free_trial',
  used,
  limit,
  addonRemaining = 0,
  onDismiss,
  variant = 'overlay',
}: FeatureGateProps) {
  const router = useRouter();
  const meta = PREMIUM_FEATURE_META[feature];
  const recommendedTier = getRecommendedTier(feature, currentTier);
  const tierMeta = TIER_META[recommendedTier];
  const addonPrice = ADDON_PRICES[feature];
  const isTrial = currentTier === 'free_trial';

  const content = (
    <div className="relative w-full max-w-lg mx-4 overflow-hidden">
      {/* Card */}
      <div className="bg-card border border-border/60 rounded-3xl shadow-2xl backdrop-blur-xl">
        {/* Close button */}
        <button
          onClick={onDismiss}
          className="absolute top-5 right-5 p-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-all z-10"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Top section with logo and gradient */}
        <div className="relative px-8 pt-10 pb-8 text-center overflow-hidden">
          {/* Background gradient blob */}
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/8 via-transparent to-amber-500/8" />
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-32 bg-emerald-500/10 rounded-full blur-3xl" />

          {/* Logo */}
          <div className="relative inline-flex items-center justify-center mb-5">
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-400/20 to-teal-500/20 rounded-2xl blur-xl scale-150" />
            <div className="relative bg-card border border-border/50 rounded-2xl p-3 shadow-lg">
              <Image
                src="/favicon-32x32.png"
                alt="Ynai"
                width={40}
                height={40}
                className="rounded-lg"
              />
            </div>
          </div>

          {/* Feature icon and title */}
          <div className="relative">
            <div className="inline-flex items-center gap-2 bg-muted/60 border border-border/40 rounded-full px-4 py-1.5 mb-4">
              <Lock className="h-3.5 w-3.5 text-amber-500" />
              <span className="text-xs font-medium text-muted-foreground">
                {isTrial ? 'Trial limit reached' : 'Weekly limit reached'}
              </span>
            </div>
            <h2 className="text-xl font-bold mb-2">
              {meta.emoji} {meta.label}
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-sm mx-auto">
              {used !== undefined && limit !== undefined ? (
                <>You&apos;ve used <span className="font-semibold text-foreground">{used}/{limit}</span> {meta.label.toLowerCase()} sessions this week.</>
              ) : isTrial ? (
                <>You&apos;ve used all your free {meta.label.toLowerCase()} sessions.</>
              ) : (
                <>You&apos;ve reached your weekly {meta.label.toLowerCase()} limit.</>
              )}
            </p>
          </div>
        </div>

        {/* Actions section */}
        <div className="px-8 pb-8 space-y-4">
          {/* Upgrade card */}
          <div className="rounded-2xl border border-border/50 bg-gradient-to-br from-muted/30 to-muted/10 p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className={`p-1.5 rounded-lg bg-gradient-to-br ${tierMeta.gradient} text-white`}>
                <Rocket className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-semibold">{isTrial ? 'Subscribe' : 'Upgrade'} to {tierMeta.name}</p>
                <p className="text-xs text-muted-foreground">
                  Get {WEEKLY_LIMITS[recommendedTier][feature]} {meta.label.toLowerCase()} per week
                </p>
              </div>
            </div>
            <Button
              onClick={() => router.push('/subscribe')}
              className="w-full h-11 text-sm font-semibold gap-2 group bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white shadow-lg shadow-emerald-500/20"
            >
              <Crown className="h-4 w-4" />
              {isTrial ? 'View Plans' : `Upgrade to ${tierMeta.name}`}
              <ArrowRight className="h-4 w-4 opacity-70 group-hover:translate-x-0.5 transition-transform" />
            </Button>
          </div>

          {/* Add-on pass option */}
          {!isTrial && (
            <div className="rounded-2xl border border-border/50 bg-card p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-500">
                  <ShoppingBag className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold">Buy an add-on pass</p>
                  <p className="text-xs text-muted-foreground">
                    {formatPrice(addonPrice)} per extra {meta.label.toLowerCase()} session
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                onClick={() => router.push(`/subscribe?addon=${feature}`)}
                className="w-full h-10 text-sm font-medium gap-2"
              >
                <Zap className="h-4 w-4 text-amber-500" />
                Buy Extra Pass
              </Button>
            </div>
          )}

          {/* Dismiss */}
          <button
            onClick={onDismiss}
            className="w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors py-2"
          >
            {isTrial ? "I\u2019ll explore other features" : 'Continue with remaining features'}
          </button>
        </div>
      </div>
    </div>
  );

  if (variant === 'inline') {
    return content;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
      <div className="animate-in zoom-in-95 duration-300">
        {content}
      </div>
    </div>
  );
}

// Default export: backward-compatible wrapper for the old TrialLimitReached interface
export default function TrialLimitReached({ feature, message, onDismiss }: TrialLimitReachedProps) {
  return (
    <FeatureGate
      feature={feature as PremiumFeature}
      currentTier="free_trial"
      onDismiss={onDismiss}
    />
  );
}

// Named export: new feature gate with full tier support
export { FeatureGate };
