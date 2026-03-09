'use client';

import { useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  Lock,
  Crown,
  ArrowRight,
  ShoppingBag,
  Zap,
  Rocket,
  Sparkles,
  Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  PREMIUM_FEATURE_META,
  TIER_META,
  WEEKLY_LIMITS,
  ADDON_PRICES,
  TIER_PRICES,
  formatPrice,
  type PremiumFeature,
  type SubscriptionTier,
} from '@/lib/constants/pricing';

const TIER_ICONS: Record<string, typeof Zap> = { Zap, Crown, Rocket, Sparkles };

interface FeatureLockedScreenProps {
  /** Which premium feature is locked */
  feature: PremiumFeature;
  /** User's current tier */
  tier?: SubscriptionTier;
  /** Weekly usage (used / limit) */
  used?: number;
  limit?: number;
  /** Addon passes remaining */
  addonRemaining?: number;
  /** Whether to show a compact inline variant */
  inline?: boolean;
}

function getNextTier(current: SubscriptionTier): SubscriptionTier {
  const order: SubscriptionTier[] = ['free_trial', 'light', 'standard', 'premium'];
  const idx = order.indexOf(current);
  return idx < order.length - 1 ? order[idx + 1] : 'premium';
}

function getUpgradeBenefits(feature: PremiumFeature, fromTier: SubscriptionTier, toTier: SubscriptionTier): string {
  if (toTier === 'custom') return '';
  const fromLimit = WEEKLY_LIMITS[fromTier as Exclude<SubscriptionTier, 'custom'>]?.[feature] ?? 0;
  const toLimit = WEEKLY_LIMITS[toTier as Exclude<SubscriptionTier, 'custom'>]?.[feature] ?? 0;
  if (toLimit === 0) return '';
  return `${fromLimit} → ${toLimit} per week`;
}

export default function FeatureLockedScreen({
  feature,
  tier = 'free_trial',
  used,
  limit,
  addonRemaining = 0,
  inline = false,
}: FeatureLockedScreenProps) {
  const router = useRouter();
  const meta = PREMIUM_FEATURE_META[feature];
  const nextTier = getNextTier(tier);
  const nextMeta = TIER_META[nextTier];
  const NextIcon = TIER_ICONS[nextMeta.icon] || Zap;
  const isTrial = tier === 'free_trial';
  const isLimitReached = !isTrial && used !== undefined && limit !== undefined && used >= limit;
  const isNotSubscribed = isTrial;
  const addonPrice = ADDON_PRICES[feature];
  const upgradeBenefit = getUpgradeBenefits(feature, tier, nextTier);
  const monthlyPrice = nextTier !== 'custom' ? TIER_PRICES[nextTier].monthly : 0;

  // Premium feature comparison for the tier cards
  const tierFeatures = nextTier !== 'custom' ? WEEKLY_LIMITS[nextTier] : null;

  const content = (
    <div className={`w-full ${inline ? '' : 'flex items-center justify-center min-h-[calc(100vh-5rem)] p-4 sm:p-6'}`}>
      <div className="max-w-lg w-full mx-auto">
        {/* Main card */}
        <div className="relative bg-card/90 backdrop-blur-2xl border border-border/40 rounded-3xl shadow-2xl overflow-hidden">
          {/* Animated gradient background */}
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute -top-24 -left-24 w-72 h-72 bg-emerald-500/10 rounded-full blur-3xl animate-pulse" />
            <div className="absolute -bottom-24 -right-24 w-72 h-72 bg-amber-500/8 rounded-full blur-3xl animate-pulse [animation-delay:1s]" />
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/[0.03] via-transparent to-violet-500/[0.03]" />
          </div>

          <div className="relative">
            {/* Header section */}
            <div className="px-8 pt-10 pb-6 text-center">
              {/* Logo */}
              <div className="inline-flex items-center justify-center mb-6">
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-br from-emerald-400/30 to-teal-500/30 rounded-2xl blur-xl scale-150" />
                  <div className="relative bg-card border border-border/50 rounded-2xl p-4 shadow-lg">
                    <Image
                      src="/favicon-32x32.png"
                      alt="Ynai"
                      width={48}
                      height={48}
                      className="rounded-lg"
                    />
                  </div>
                </div>
              </div>

              {/* Lock badge */}
              <div className="inline-flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded-full px-4 py-1.5 mb-5">
                <Lock className="h-3.5 w-3.5 text-amber-500" />
                <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 tracking-wide uppercase">
                  {isNotSubscribed ? 'Premium Feature' : isLimitReached ? 'Weekly Limit Reached' : 'Feature Locked'}
                </span>
              </div>

              {/* Feature title */}
              <h2 className="text-2xl font-bold mb-2">
                <span className="mr-2">{meta.emoji}</span>
                {meta.label}
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed max-w-sm mx-auto mb-2">
                {meta.description}
              </p>

              {/* Usage indicator */}
              {isLimitReached && used !== undefined && limit !== undefined && (
                <div className="mt-4 mx-auto max-w-xs">
                  <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
                    <span>Weekly usage</span>
                    <span className="font-semibold text-foreground">{used}/{limit} used</span>
                  </div>
                  <div className="h-2 bg-muted/50 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-amber-500 to-red-500 rounded-full transition-all duration-500"
                      style={{ width: '100%' }}
                    />
                  </div>
                  {addonRemaining > 0 && (
                    <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1.5">
                      +{addonRemaining} add-on pass{addonRemaining !== 1 ? 'es' : ''} available
                    </p>
                  )}
                </div>
              )}

              {isNotSubscribed && (
                <p className="mt-3 text-xs text-muted-foreground max-w-sm mx-auto leading-relaxed">
                  {isTrial
                    ? 'This feature requires a paid subscription. Choose a plan to unlock.'
                    : 'Upgrade your plan to access this feature.'
                  }
                </p>
              )}
            </div>

            {/* Divider */}
            <div className="mx-8 h-px bg-gradient-to-r from-transparent via-border to-transparent" />

            {/* Action section */}
            <div className="px-8 py-6 space-y-4">
              {/* Upgrade card */}
              <button
                onClick={() => router.push('/subscribe')}
                className="w-full group rounded-2xl border border-border/50 bg-gradient-to-br from-muted/30 to-muted/10 p-5 text-left hover:border-emerald-500/30 hover:shadow-lg hover:shadow-emerald-500/5 transition-all duration-300"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className={`p-2 rounded-xl bg-gradient-to-br ${nextMeta.gradient} text-white shadow-md`}>
                    <NextIcon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold">
                      {isNotSubscribed ? 'Subscribe' : 'Upgrade'} to {nextMeta.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {upgradeBenefit ? `${meta.label}: ${upgradeBenefit}` : `Unlock ${meta.label.toLowerCase()}`}
                    </p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-emerald-500 group-hover:translate-x-0.5 transition-all shrink-0" />
                </div>

                {/* Tier highlights */}
                {tierFeatures && (
                  <div className="grid grid-cols-2 gap-1.5 mt-3 pt-3 border-t border-border/30">
                    {Object.entries(tierFeatures).slice(0, 4).map(([f, lim]) => (
                      <div key={f} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Check className="h-3 w-3 text-emerald-500 shrink-0" />
                        <span>{lim} {PREMIUM_FEATURE_META[f as PremiumFeature]?.label}</span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-3 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Starting at</span>
                  <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                    {formatPrice(monthlyPrice)}/mo
                  </span>
                </div>
              </button>

              {/* Add-on pass option (only for paid users who hit limits) */}
              {!isNotSubscribed && (
                <button
                  onClick={() => router.push(`/subscribe?addon=${feature}`)}
                  className="w-full group rounded-2xl border border-border/50 bg-card p-5 text-left hover:border-amber-500/30 hover:shadow-lg hover:shadow-amber-500/5 transition-all duration-300"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-amber-500/10 text-amber-500">
                      <ShoppingBag className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold">Buy an add-on pass</p>
                      <p className="text-xs text-muted-foreground">
                        {formatPrice(addonPrice)} per extra {meta.label.toLowerCase()} session
                      </p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-amber-500 group-hover:translate-x-0.5 transition-all shrink-0" />
                  </div>
                </button>
              )}

              {/* Custom package nudge */}
              <button
                onClick={() => router.push('/pricing#custom')}
                className="w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors py-2"
              >
                Or build a <span className="font-medium text-violet-500">custom package</span> with just the features you need
              </button>
            </div>
          </div>
        </div>

        {/* Bottom note */}
        <p className="text-center text-xs text-muted-foreground mt-6 max-w-xs mx-auto leading-relaxed">
          All plans include unlimited access to Mastery Hub, Study, Quizzes, Community, and more.
        </p>
      </div>
    </div>
  );

  return content;
}
