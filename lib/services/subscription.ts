/**
 * ═══════════════════════════════════════════════════════
 * Subscription & Feature Access Service — Tier-Based
 * ═══════════════════════════════════════════════════════
 *
 * Three paid tiers: Light / Standard / Premium
 * Each tier grants all basic features (unlimited) plus
 * weekly-limited premium features (drafting, oral, exams, research, clarify).
 *
 * Weekly limits reset every Monday 00:00 EAT.
 * Add-on passes can extend limits beyond the tier cap.
 */

import { db } from '@/lib/db';
import { users, featureUsage, addonPasses } from '@/lib/db/schema';
import { eq, and, sql, gt } from 'drizzle-orm';
import {
  type SubscriptionTier,
  type BillingPeriod,
  type PremiumFeature,
  type FeatureKey,
  WEEKLY_LIMITS,
  CUSTOM_WEEKLY_LIMIT,
  FREE_TRIAL_DAILY_LIMIT,
  CLARIFY_MODEL,
  isPremiumFeature,
  getWeekStart,
  periodToDays,
} from '@/lib/constants/pricing';

// Re-export types for backward compat
export type { SubscriptionTier, BillingPeriod, PremiumFeature, FeatureKey };

// Legacy type alias used by existing code
export type FeatureGate = FeatureKey;

export interface FeatureUsageInfo {
  feature: PremiumFeature;
  used: number;
  limit: number;
  addonRemaining: number;
  canUse: boolean;
}

export interface SubscriptionInfo {
  tier: SubscriptionTier;
  billingPeriod: BillingPeriod | null;
  status: string;
  isActive: boolean;
  isTrial: boolean;
  trialExpired: boolean;
  trialEndsAt: Date | null;
  subscriptionEndsAt: Date | null;
  /** Backward-compatible access check */
  canAccess: (feature: FeatureKey) => boolean;
  /** Detailed per-feature usage for premium features */
  featureUsage: Record<PremiumFeature, FeatureUsageInfo>;
  /** Which model to use for clarification */
  clarifyModel: string;
  /** Days remaining on current subscription */
  daysRemaining: number;
  /** Legacy usage object for backward compat */
  usage: {
    draftingUsed: number;
    draftingLimit: number;
    oralDevilUsed: number;
    oralDevilLimit: number;
    oralExamUsed: number;
    oralExamLimit: number;
  };
  // Legacy field for backward compat
  plan: string;
}

// ── Basic features — always accessible for any paid/trial user ──
const BASIC_FEATURES = new Set([
  'mastery_hub', 'study_hub', 'community', 'history',
  'dashboard', 'reports', 'legal_banter', 'quizzes', 'tutor',
  // Legacy aliases
  'mastery', 'study',
]);

/**
 * Get the full subscription info for a user.
 */
export async function getSubscriptionInfo(userId: string): Promise<SubscriptionInfo> {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: {
      subscriptionPlan: true,
      subscriptionStatus: true,
      subscriptionTier: true,
      billingPeriod: true,
      customFeatures: true,
      trialEndsAt: true,
      subscriptionEndsAt: true,
      trialDraftingUsed: true,
      trialOralDevilUsed: true,
      trialOralExamUsed: true,
      role: true,
    },
  });

  if (!user) {
    return defaultInfo();
  }

  // Admins always have full access
  if (user.role === 'admin') {
    return adminInfo();
  }

  const now = new Date();
  const tier = (user.subscriptionTier || 'free_trial') as SubscriptionTier;
  const billingPeriod = (user.billingPeriod || null) as BillingPeriod | null;
  const status = user.subscriptionStatus || 'trialing';
  const trialEndsAt = user.trialEndsAt ? new Date(user.trialEndsAt) : null;
  const subscriptionEndsAt = user.subscriptionEndsAt ? new Date(user.subscriptionEndsAt) : null;

  const isTrial = tier === 'free_trial';
  const trialExpired = isTrial && trialEndsAt ? now > trialEndsAt : false;
  const isPaidActive = !isTrial && (status === 'active' || status === 'trialing') &&
    (!subscriptionEndsAt || now < subscriptionEndsAt);
  const isActive = isPaidActive || (isTrial && !trialExpired);

  // Calculate days remaining
  let daysRemaining = 0;
  if (subscriptionEndsAt && now < subscriptionEndsAt) {
    daysRemaining = Math.ceil((subscriptionEndsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  }

  // Get weekly feature usage (paid users) or daily usage (trial users)
  const weekStart = getWeekStart(now);
  const weeklyUsage = await getWeeklyUsage(userId, weekStart);
  const addonCounts = await getAddonRemaining(userId);
  const dailyUsage = isTrial ? await getDailyUsage(userId, now) : {};

  // Build per-feature usage info
  const premiumFeatures: PremiumFeature[] = ['drafting', 'oral_exam', 'oral_devil', 'cle_exam', 'research', 'clarify'];
  const featureUsageMap = {} as Record<PremiumFeature, FeatureUsageInfo>;

  // Parse custom features for custom tier
  let userCustomFeatures: PremiumFeature[] = [];
  if (tier === 'custom' && user.customFeatures) {
    try {
      userCustomFeatures = JSON.parse(user.customFeatures) as PremiumFeature[];
    } catch { /* invalid JSON, treat as empty */ }
  }

  for (const feature of premiumFeatures) {
    let limit: number;
    let used: number;

    if (isTrial) {
      // Trial users: 2 sessions per feature PER DAY
      limit = FREE_TRIAL_DAILY_LIMIT;
      used = dailyUsage[feature] ?? 0;
    } else if (tier === 'custom') {
      limit = userCustomFeatures.includes(feature) ? CUSTOM_WEEKLY_LIMIT : 0;
      used = weeklyUsage[feature] ?? 0;
    } else {
      limit = WEEKLY_LIMITS[tier]?.[feature] ?? 0;
      used = weeklyUsage[feature] ?? 0;
    }

    const addonRemaining = addonCounts[feature] ?? 0;
    const canUse = (used < limit) || (addonRemaining > 0);

    featureUsageMap[feature] = { feature, used, limit, addonRemaining, canUse };
  }

  const canAccess = (feature: FeatureKey): boolean => {
    // Not active at all → only basic features during trial, nothing if expired
    if (!isActive) {
      if (trialExpired) return BASIC_FEATURES.has(feature);
      return false;
    }

    // Basic features → always yes
    if (BASIC_FEATURES.has(feature)) return true;

    // Premium features → check limits
    if (isPremiumFeature(feature)) {
      return featureUsageMap[feature].canUse;
    }

    // Unknown feature → deny (fail-closed for safety)
    return false;
  };

  // Legacy usage object
  const legacyUsage = {
    draftingUsed: featureUsageMap.drafting.used,
    draftingLimit: featureUsageMap.drafting.limit,
    oralDevilUsed: featureUsageMap.oral_devil.used,
    oralDevilLimit: featureUsageMap.oral_devil.limit,
    oralExamUsed: featureUsageMap.oral_exam.used,
    oralExamLimit: featureUsageMap.oral_exam.limit,
  };

  return {
    tier,
    billingPeriod,
    plan: isTrial ? 'free_trial' : (user.subscriptionPlan || 'free_trial'),
    status,
    isActive,
    isTrial,
    trialExpired,
    trialEndsAt,
    subscriptionEndsAt,
    canAccess,
    featureUsage: featureUsageMap,
    clarifyModel: CLARIFY_MODEL[tier] || 'gpt-5.2-mini',
    daysRemaining,
    usage: legacyUsage,
  };
}

/**
 * Increment usage for a premium feature.
 * For trial users: increments legacy trial counters.
 * For paid users: increments weekly feature_usage table.
 */
export async function incrementFeatureUsage(
  userId: string,
  feature: PremiumFeature,
): Promise<{ success: boolean; usedAddon: boolean }> {
  // Get user info to determine if trial
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { subscriptionTier: true, customFeatures: true },
  });

  const tier = (user?.subscriptionTier || 'free_trial') as SubscriptionTier;

  if (tier === 'free_trial') {
    // Trial user → use daily feature_usage table (2 per feature per day)
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const dailyUsage = await getDailyUsage(userId, new Date());
    const currentCount = dailyUsage[feature] ?? 0;
    if (currentCount < FREE_TRIAL_DAILY_LIMIT) {
      await upsertDailyUsage(userId, feature, today);
      return { success: true, usedAddon: false };
    }
    return { success: false, usedAddon: false };
  }

  // Paid user → use feature_usage table
  const weekStart = getWeekStart();
  let limit: number;
  if (tier === 'custom') {
    let userCustomFeatures: PremiumFeature[] = [];
    if (user?.customFeatures) {
      try { userCustomFeatures = JSON.parse(user.customFeatures) as PremiumFeature[]; } catch {}
    }
    limit = userCustomFeatures.includes(feature) ? CUSTOM_WEEKLY_LIMIT : 0;
  } else {
    limit = WEEKLY_LIMITS[tier]?.[feature] ?? 0;
  }

  // Get current usage
  const current = await db.query.featureUsage.findFirst({
    where: and(
      eq(featureUsage.userId, userId),
      eq(featureUsage.feature, feature),
      eq(featureUsage.weekStart, weekStart),
    ),
  });

  const currentCount = current?.usageCount ?? 0;

  if (currentCount < limit) {
    // Within tier limit — increment
    await upsertWeeklyUsage(userId, feature, weekStart);
    return { success: true, usedAddon: false };
  }

  // Over limit — try to consume an add-on pass
  const consumed = await consumeAddonPass(userId, feature);
  if (consumed) {
    return { success: true, usedAddon: true };
  }

  return { success: false, usedAddon: false };
}

/**
 * Legacy: Increment trial usage counter (for backward compatibility).
 */
export async function incrementTrialUsage(
  userId: string,
  feature: string,
) {
  const fieldMap: Record<string, string> = {
    drafting: 'trial_drafting_used',
    oral_devil: 'trial_oral_devil_used',
    oral_exam: 'trial_oral_exam_used',
  };

  const field = fieldMap[feature];
  if (!field) return;

  await db.execute(
    sql`UPDATE users SET ${sql.raw(field)} = COALESCE(${sql.raw(field)}, 0) + 1 WHERE id = ${userId}`
  );
}

/**
 * Activate a paid subscription after successful payment.
 */
export async function activateSubscription(
  userId: string,
  tier: SubscriptionTier,
  billingPeriod: BillingPeriod,
  paystackCustomerId?: string,
  paystackSubscriptionCode?: string,
  customFeatures?: PremiumFeature[],
) {
  const now = new Date();
  const days = periodToDays(billingPeriod);
  const endsAt = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

  const legacyPlan = billingPeriod as 'weekly' | 'monthly' | 'annual';

  await db.update(users).set({
    subscriptionTier: tier,
    billingPeriod,
    subscriptionPlan: legacyPlan,
    subscriptionStatus: 'active',
    subscriptionEndsAt: endsAt,
    ...(paystackCustomerId && { paystackCustomerId }),
    ...(paystackSubscriptionCode && { paystackSubscriptionCode }),
    ...(tier === 'custom' && customFeatures ? { customFeatures: JSON.stringify(customFeatures) } : {}),
    updatedAt: now,
  }).where(eq(users.id, userId));
}

/**
 * Upgrade a subscription: extend end date and set new tier.
 */
export async function upgradeSubscription(
  userId: string,
  newTier: SubscriptionTier,
  newPeriod: BillingPeriod,
) {
  const now = new Date();
  const days = periodToDays(newPeriod);
  const endsAt = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

  await db.update(users).set({
    subscriptionTier: newTier,
    billingPeriod: newPeriod,
    subscriptionPlan: newPeriod as any,
    subscriptionStatus: 'active',
    subscriptionEndsAt: endsAt,
    updatedAt: now,
  }).where(eq(users.id, userId));
}

/**
 * Cancel a subscription (access continues until period end).
 */
export async function cancelSubscription(userId: string) {
  await db.update(users).set({
    subscriptionStatus: 'cancelled',
    updatedAt: new Date(),
  }).where(eq(users.id, userId));
}

/**
 * Add purchased add-on passes.
 */
export async function addAddonPasses(
  userId: string,
  feature: PremiumFeature,
  quantity: number,
  price: number,
  paystackReference?: string,
) {
  await db.insert(addonPasses).values({
    userId,
    feature,
    quantity,
    remaining: quantity,
    price,
    paystackReference,
  });
}

// ══════════════════════════════════════
// Internal Helpers
// ══════════════════════════════════════

async function getWeeklyUsage(userId: string, weekStart: Date): Promise<Record<string, number>> {
  const rows = await db.query.featureUsage.findMany({
    where: and(
      eq(featureUsage.userId, userId),
      eq(featureUsage.weekStart, weekStart),
    ),
  });

  const result: Record<string, number> = {};
  for (const row of rows) {
    result[row.feature] = row.usageCount;
  }
  return result;
}

async function getAddonRemaining(userId: string): Promise<Record<string, number>> {
  const rows = await db.query.addonPasses.findMany({
    where: and(
      eq(addonPasses.userId, userId),
      gt(addonPasses.remaining, 0),
    ),
  });

  const result: Record<string, number> = {};
  for (const row of rows) {
    result[row.feature] = (result[row.feature] || 0) + row.remaining;
  }
  return result;
}

async function consumeAddonPass(userId: string, feature: string): Promise<boolean> {
  const pass = await db.query.addonPasses.findFirst({
    where: and(
      eq(addonPasses.userId, userId),
      eq(addonPasses.feature, feature),
      gt(addonPasses.remaining, 0),
    ),
    orderBy: (t, { asc }) => [asc(t.purchasedAt)],
  });

  if (!pass) return false;

  await db.update(addonPasses).set({
    remaining: pass.remaining - 1,
  }).where(eq(addonPasses.id, pass.id));

  return true;
}

async function upsertWeeklyUsage(userId: string, feature: string, weekStart: Date) {
  await db.execute(
    sql`INSERT INTO feature_usage (user_id, feature, week_start, usage_count, created_at, updated_at)
        VALUES (${userId}, ${feature}, ${weekStart}, 1, NOW(), NOW())
        ON CONFLICT (user_id, feature, week_start)
        DO UPDATE SET usage_count = feature_usage.usage_count + 1, updated_at = NOW()`
  );
}

/**
 * Get daily feature usage for trial users.
 * Uses the same feature_usage table but with a day-level granularity.
 * The week_start column stores the start-of-day for daily tracking.
 */
async function getDailyUsage(userId: string, now: Date): Promise<Record<string, number>> {
  const startOfDay = new Date(now);
  startOfDay.setUTCHours(0, 0, 0, 0);

  const rows = await db.query.featureUsage.findMany({
    where: and(
      eq(featureUsage.userId, userId),
      eq(featureUsage.weekStart, startOfDay),
    ),
  });

  const result: Record<string, number> = {};
  for (const row of rows) {
    result[row.feature] = row.usageCount;
  }
  return result;
}

async function upsertDailyUsage(userId: string, feature: string, startOfDay: Date) {
  await db.execute(
    sql`INSERT INTO feature_usage (user_id, feature, week_start, usage_count, created_at, updated_at)
        VALUES (${userId}, ${feature}, ${startOfDay}, 1, NOW(), NOW())
        ON CONFLICT (user_id, feature, week_start)
        DO UPDATE SET usage_count = feature_usage.usage_count + 1, updated_at = NOW()`
  );
}

function getTrialUsage(user: any, feature: PremiumFeature): number {
  switch (feature) {
    case 'drafting': return user.trialDraftingUsed ?? 0;
    case 'oral_devil': return user.trialOralDevilUsed ?? 0;
    case 'oral_exam': return user.trialOralExamUsed ?? 0;
    default: return 0;
  }
}

// ── Helpers ──

function defaultInfo(): SubscriptionInfo {
  const emptyUsage: Record<PremiumFeature, FeatureUsageInfo> = {
    drafting: { feature: 'drafting', used: 0, limit: 0, addonRemaining: 0, canUse: false },
    oral_exam: { feature: 'oral_exam', used: 0, limit: 0, addonRemaining: 0, canUse: false },
    oral_devil: { feature: 'oral_devil', used: 0, limit: 0, addonRemaining: 0, canUse: false },
    cle_exam: { feature: 'cle_exam', used: 0, limit: 0, addonRemaining: 0, canUse: false },
    research: { feature: 'research', used: 0, limit: 0, addonRemaining: 0, canUse: false },
    clarify: { feature: 'clarify', used: 0, limit: 0, addonRemaining: 0, canUse: false },
  };

  return {
    tier: 'free_trial',
    billingPeriod: null,
    plan: 'free_trial',
    status: 'expired',
    isActive: false,
    isTrial: true,
    trialExpired: true,
    trialEndsAt: null,
    subscriptionEndsAt: null,
    canAccess: (f) => BASIC_FEATURES.has(f),
    featureUsage: emptyUsage,
    clarifyModel: 'gpt-5.2-mini',
    daysRemaining: 0,
    usage: { draftingUsed: 0, draftingLimit: 3, oralDevilUsed: 0, oralDevilLimit: 2, oralExamUsed: 0, oralExamLimit: 2 },
  };
}

function adminInfo(): SubscriptionInfo {
  const unlimitedUsage: Record<PremiumFeature, FeatureUsageInfo> = {
    drafting: { feature: 'drafting', used: 0, limit: 999, addonRemaining: 0, canUse: true },
    oral_exam: { feature: 'oral_exam', used: 0, limit: 999, addonRemaining: 0, canUse: true },
    oral_devil: { feature: 'oral_devil', used: 0, limit: 999, addonRemaining: 0, canUse: true },
    cle_exam: { feature: 'cle_exam', used: 0, limit: 999, addonRemaining: 0, canUse: true },
    research: { feature: 'research', used: 0, limit: 999, addonRemaining: 0, canUse: true },
    clarify: { feature: 'clarify', used: 0, limit: 999, addonRemaining: 0, canUse: true },
  };

  return {
    tier: 'premium',
    billingPeriod: 'annual',
    plan: 'annual',
    status: 'active',
    isActive: true,
    isTrial: false,
    trialExpired: false,
    trialEndsAt: null,
    subscriptionEndsAt: null,
    canAccess: () => true,
    featureUsage: unlimitedUsage,
    clarifyModel: 'gpt-5.2',
    daysRemaining: 999,
    usage: { draftingUsed: 0, draftingLimit: 999, oralDevilUsed: 0, oralDevilLimit: 999, oralExamUsed: 0, oralExamLimit: 999 },
  };
}
