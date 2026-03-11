/**
 * ═══════════════════════════════════════════════════════
 * Ynai Pricing System — Three Tiers + Custom + Add-ons
 * ═══════════════════════════════════════════════════════
 *
 * Tiers:  Light → Standard → Premium   (+ Custom à-la-carte)
 * Periods: weekly / monthly / annual
 *
 * Formula:
 *   Weekly  = Monthly ÷ 3
 *   Annual  = Monthly × 8
 *
 * Drafting special rule:
 *   Per-document: max 2 attempts with feedback per day (not rolling)
 */

// ── Tier IDs ──
export type SubscriptionTier = 'free_trial' | 'light' | 'standard' | 'premium' | 'custom';
export type BillingPeriod = 'weekly' | 'monthly' | 'annual';

// ── Premium Feature Keys ──
export type PremiumFeature =
  | 'drafting'
  | 'oral_exam'
  | 'oral_devil'
  | 'cle_exam'
  | 'research'
  | 'clarify';

// ── Basic Feature Keys (unlimited for all paid tiers) ──
export type BasicFeature =
  | 'mastery_hub'
  | 'study_hub'
  | 'community'
  | 'history'
  | 'dashboard'
  | 'reports'
  | 'legal_banter'
  | 'quizzes'
  | 'tutor';

export type FeatureKey = PremiumFeature | BasicFeature;

// All premium feature keys in display order
export const PREMIUM_FEATURES: PremiumFeature[] = [
  'drafting', 'oral_exam', 'oral_devil', 'cle_exam', 'research', 'clarify',
];

// ── Prices (KES) ──
export const TIER_PRICES: Record<Exclude<SubscriptionTier, 'custom'>, Record<BillingPeriod, number>> = {
  free_trial: { weekly: 0, monthly: 0, annual: 0 },
  light:    { weekly: 500,  monthly: 1_500,  annual: 12_000 },
  standard: { weekly: 700,  monthly: 2_000,  annual: 16_000 },
  premium:  { weekly: 850,  monthly: 2_500,  annual: 20_000 },
};

// ── Weekly Limits Per Premium Feature Per Tier ──
// 0 = not available
export const WEEKLY_LIMITS: Record<Exclude<SubscriptionTier, 'custom'>, Record<PremiumFeature, number>> = {
  free_trial: {
    drafting:   2,
    oral_exam:  2,
    oral_devil: 2,
    cle_exam:   2,
    research:   2,
    clarify:    2,
  },
  light: {
    drafting:   3,
    oral_exam:  2,
    oral_devil: 2,
    cle_exam:   3,
    research:   3,   // +40% (was 2)
    clarify:    5,   // +60% (was 3)
  },
  standard: {
    drafting:   4,
    oral_exam:  4,
    oral_devil: 4,
    cle_exam:   4,
    research:   6,   // +40% (was 4)
    clarify:    6,   // +60% (was 4)
  },
  premium: {
    drafting:   6,
    oral_exam:  6,
    oral_devil: 6,
    cle_exam:   6,
    research:   8,   // +40% (was 6)
    clarify:    10,  // +60% (was 6)
  },
};

// ── Free Trial Daily Limit ──
// Trial users get this many sessions of EACH premium feature PER DAY (not weekly)
export const FREE_TRIAL_DAILY_LIMIT = 2;

// ── Drafting Daily Attempt Cap ──
// Each document gets this many attempts with feedback PER DAY (not rolling)
export const DAILY_DRAFT_ATTEMPTS = 2;

// ── Clarify Model Per Tier ──
// Light + Standard + Custom use the mini model; Premium uses the full model
export const CLARIFY_MODEL: Record<SubscriptionTier, string> = {
  free_trial: 'gpt-4o-mini',
  light:      'gpt-4o-mini',
  standard:   'gpt-4o-mini',
  premium:    'gpt-5.2',
  custom:     'gpt-4o-mini',
};

// ── Add-on Pass Prices (per single-feature pass, KES) ──
// Each pass grants +1 usage for that feature in the current week
export const ADDON_PRICES: Record<PremiumFeature, number> = {
  drafting:   100,
  oral_exam:  100,
  oral_devil: 100,
  cle_exam:   80,
  research:   80,
  clarify:    50,
};

// Bulk add-on packs (better value)
export const ADDON_PACKS: { id: string; name: string; feature: PremiumFeature; quantity: number; price: number }[] = [
  { id: 'drafting_5',   name: '5 Extra Drafts',            feature: 'drafting',   quantity: 5, price: 400 },
  { id: 'oral_exam_5',  name: '5 Extra Oral Exams',        feature: 'oral_exam',  quantity: 5, price: 400 },
  { id: 'oral_devil_5', name: "5 Extra Devil's Advocate",  feature: 'oral_devil', quantity: 5, price: 400 },
  { id: 'cle_exam_5',   name: '5 Extra CLE Exams',         feature: 'cle_exam',   quantity: 5, price: 350 },
  { id: 'research_5',   name: '5 Extra Research',          feature: 'research',   quantity: 5, price: 350 },
  { id: 'clarify_5',    name: '5 Extra Clarifications',    feature: 'clarify',    quantity: 5, price: 200 },
];

// ── Custom Package: Per-Session Prices (KES) ──
// Users pick which features, how many sessions per week, and for how long.
// Price = per-session cost × sessions/week × weeks
export const CUSTOM_PER_SESSION_PRICE: Record<PremiumFeature, number> = {
  drafting:   40,
  oral_exam:  35,
  oral_devil: 35,
  cle_exam:   30,
  research:   35,
  clarify:    25,
};

// Duration options available for custom packages
export const CUSTOM_DURATION_OPTIONS: { id: string; label: string; weeks: number; discount: number }[] = [
  { id: '1w', label: '1 Week', weeks: 1, discount: 0 },
  { id: '2w', label: '2 Weeks', weeks: 2, discount: 0 },
  { id: '1m', label: '1 Month', weeks: 4, discount: 0.05 },
  { id: '2m', label: '2 Months', weeks: 8, discount: 0.10 },
  { id: '3m', label: '3 Months', weeks: 12, discount: 0.15 },
];

// Min/max sessions per week per feature
export const CUSTOM_MIN_SESSIONS = 1;
export const CUSTOM_MAX_SESSIONS = 50;

// Legacy: still used by some code that only needs a default custom limit
export const CUSTOM_WEEKLY_LIMIT = 3;

// ── Legacy: CUSTOM_FEATURE_PRICES (backward compat) ──
// Computed from per-session price × CUSTOM_WEEKLY_LIMIT sessions per week.
// weekly = perSession × CUSTOM_WEEKLY_LIMIT, monthly = weekly × 3, annual = monthly × 8
function buildLegacyCustomPrices(): Record<PremiumFeature, Record<BillingPeriod, number>> {
  const result = {} as Record<PremiumFeature, Record<BillingPeriod, number>>;
  for (const f of PREMIUM_FEATURES) {
    const weekly = CUSTOM_PER_SESSION_PRICE[f] * CUSTOM_WEEKLY_LIMIT;
    result[f] = { weekly, monthly: weekly * 3, annual: weekly * 3 * 8 };
  }
  return result;
}
export const CUSTOM_FEATURE_PRICES: Record<PremiumFeature, Record<BillingPeriod, number>> = buildLegacyCustomPrices();

// ── Feature Display Metadata ──
export const PREMIUM_FEATURE_META: Record<PremiumFeature, { label: string; emoji: string; description: string; route: string }> = {
  drafting: {
    label: 'Legal Drafting',
    emoji: '📝',
    description: 'Progressive legal document drafting with AI grading',
    route: '/drafting',
  },
  oral_exam: {
    label: 'Oral Examination',
    emoji: '🎤',
    description: 'Mock oral exam sessions with AI panelists',
    route: '/oral-exams',
  },
  oral_devil: {
    label: "Devil's Advocate",
    emoji: '⚔️',
    description: 'Aggressive cross-examination practice',
    route: '/oral-exams',
  },
  cle_exam: {
    label: 'CLE Exams',
    emoji: '📋',
    description: 'Council of Legal Education exam practice',
    route: '/exams',
  },
  research: {
    label: 'Legal Research',
    emoji: '🔍',
    description: 'Deep legal research with cited authorities',
    route: '/research',
  },
  clarify: {
    label: 'Get Clarification',
    emoji: '💡',
    description: 'One-on-one AI clarification on tricky topics',
    route: '/clarify',
  },
};

// ── Tier Display Metadata ──
export const TIER_META: Record<SubscriptionTier, {
  name: string;
  description: string;
  color: string;        // tailwind color stem, e.g. 'emerald'
  gradient: string;     // tailwind gradient classes
  icon: string;         // lucide icon name
}> = {
  free_trial: {
    name: 'Free Trial',
    description: '3-day trial with limited access',
    color: 'gray',
    gradient: 'from-gray-400 to-gray-500',
    icon: 'Sparkles',
  },
  light: {
    name: 'Light',
    description: 'Essential bar prep tools',
    color: 'sky',
    gradient: 'from-sky-400 to-blue-500',
    icon: 'Zap',
  },
  standard: {
    name: 'Standard',
    description: 'Serious preparation with extra sessions',
    color: 'amber',
    gradient: 'from-amber-400 to-orange-500',
    icon: 'Crown',
  },
  premium: {
    name: 'Premium',
    description: 'Maximum access with the smartest AI',
    color: 'emerald',
    gradient: 'from-emerald-400 to-teal-500',
    icon: 'Rocket',
  },
  custom: {
    name: 'Custom',
    description: 'Pick exactly the features you need',
    color: 'violet',
    gradient: 'from-violet-400 to-purple-500',
    icon: 'Settings',
  },
};

// ── Basic Features (all paid tiers get these) ──
export const BASIC_FEATURES: { key: BasicFeature; label: string }[] = [
  { key: 'mastery_hub', label: 'Mastery Hub' },
  { key: 'study_hub', label: 'Study Hub' },
  { key: 'community', label: 'Community' },
  { key: 'history', label: 'Chat History' },
  { key: 'dashboard', label: 'Dashboard & Analytics' },
  { key: 'reports', label: 'Progress Reports' },
  { key: 'legal_banter', label: 'Legal Banter (unlimited)' },
  { key: 'quizzes', label: 'Quizzes & Practice' },
  { key: 'tutor', label: 'AI Tutor' },
];

// ── Helper: Format price for display ──
export function formatPrice(amount: number): string {
  return `KES ${amount.toLocaleString()}`;
}

// ── Helper: Get price for a tier + period ──
export function getTierPrice(tier: SubscriptionTier, period: BillingPeriod): number {
  if (tier === 'custom') return 0; // Custom uses sum of selected features
  return TIER_PRICES[tier][period];
}

// ── Helper: Get weekly limit for a feature on a tier ──
export function getWeeklyLimit(
  tier: SubscriptionTier,
  feature: PremiumFeature,
  customFeatures?: PremiumFeature[],
  customSessionsPerWeek?: Record<PremiumFeature, number>,
): number {
  if (tier === 'custom') {
    if (!customFeatures?.includes(feature)) return 0;
    return customSessionsPerWeek?.[feature] ?? CUSTOM_WEEKLY_LIMIT;
  }
  return WEEKLY_LIMITS[tier]?.[feature] ?? 0;
}

// ── Helper: Calculate total custom package price ──
// Flexible formula: per-session cost × sessions/week × weeks × (1 - discount)
export interface CustomPackageSelection {
  feature: PremiumFeature;
  sessionsPerWeek: number;
}

export function calculateCustomPackagePrice(
  selections: CustomPackageSelection[],
  durationWeeks: number,
  discountPercent: number = 0,
): number {
  const subtotal = selections.reduce((sum, s) => {
    const perSession = CUSTOM_PER_SESSION_PRICE[s.feature] || 0;
    return sum + (perSession * s.sessionsPerWeek * durationWeeks);
  }, 0);
  return Math.round(subtotal * (1 - discountPercent));
}

// ── Legacy: Calculate custom price from feature list + billing period ──
// (backward compat — used by pricing page, subscribe page, payments API)
export function calculateCustomPrice(
  features: PremiumFeature[],
  period: BillingPeriod,
): number {
  return features.reduce((sum, f) => sum + CUSTOM_FEATURE_PRICES[f][period], 0);
}

// ── Helper: Calculate upgrade cost (prorated) ──
export function calculateUpgradeCost(
  currentTier: SubscriptionTier,
  currentPeriod: BillingPeriod,
  targetTier: SubscriptionTier,
  targetPeriod: BillingPeriod,
  daysRemaining: number,
): number {
  if (currentTier === 'free_trial') {
    // No credit for free trial
    if (targetTier === 'custom') return 0; // custom handled separately
    return TIER_PRICES[targetTier][targetPeriod];
  }

  const currentTotal = currentTier === 'custom' ? 0 : TIER_PRICES[currentTier][currentPeriod];
  const targetTotal = targetTier === 'custom' ? 0 : TIER_PRICES[targetTier][targetPeriod];

  // Calculate the per-day rate of the current plan
  const totalDays = currentPeriod === 'weekly' ? 7 : currentPeriod === 'monthly' ? 30 : 365;
  const dailyRate = currentTotal / totalDays;
  const unusedCredit = Math.floor(dailyRate * daysRemaining);

  // The user pays the difference: new plan cost minus unused credit
  const diff = targetTotal - unusedCredit;
  return Math.max(diff, 0);
}

// ── Helper: Period in days ──
export function periodToDays(period: BillingPeriod): number {
  switch (period) {
    case 'weekly': return 7;
    case 'monthly': return 30;
    case 'annual': return 365;
  }
}

// ── Helper: Compute Monday-based week start ──
export function getWeekStart(date: Date = new Date()): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun, 1=Mon, ...
  const diff = day === 0 ? 6 : day - 1; // days since Monday
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

// ── Helper: Is a feature a premium (limited) feature? ──
export function isPremiumFeature(feature: string): feature is PremiumFeature {
  return ['drafting', 'oral_exam', 'oral_devil', 'cle_exam', 'research', 'clarify'].includes(feature);
}

// ── Helper: Map route path to premium feature(s) ──
// Used by the gating system to determine which feature a page requires.
export const ROUTE_TO_FEATURE: Record<string, PremiumFeature | PremiumFeature[]> = {
  '/drafting':   'drafting',
  '/oral-exams': ['oral_exam', 'oral_devil'],
  '/exams':      'cle_exam',
  '/research':   'research',
  '/clarify':    'clarify',
};

// ── Helper: Check if any feature in a list is accessible ──
export function anyFeatureAccessible(
  tier: SubscriptionTier,
  features: PremiumFeature | PremiumFeature[],
  usageMap?: Record<string, { canUse: boolean }>,
): boolean {
  const list = Array.isArray(features) ? features : [features];
  if (!usageMap) return true;
  return list.some(f => usageMap[f]?.canUse);
}
