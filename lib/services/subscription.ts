/**
 * Subscription & Trial Limit Service
 *
 * Free trial (3 days):
 *   - Mastery Hub: unlimited
 *   - Legal Drafting: up to 3 documents
 *   - Oral AI: 1 Devil's Advocate session + 1 Oral Exam session
 *
 * Paid plans: unlimited everything
 */

import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export type SubscriptionTier = 'free_trial' | 'weekly' | 'monthly' | 'annual';
export type FeatureGate = 'drafting' | 'oral_devil' | 'oral_exam' | 'mastery' | 'study' | 'quizzes';

const TRIAL_LIMITS = {
  drafting: 3,       // 3 documents
  oral_devil: 1,     // 1 Devil's Advocate session
  oral_exam: 1,      // 1 Oral Exam session
} as const;

export interface SubscriptionInfo {
  plan: SubscriptionTier;
  status: string;
  isActive: boolean;          // paid plan currently active
  isTrial: boolean;           // in free trial
  trialExpired: boolean;      // trial has ended
  trialEndsAt: Date | null;
  subscriptionEndsAt: Date | null;
  /** Whether the user can access a given feature */
  canAccess: (feature: FeatureGate) => boolean;
  /** Usage counters for trial */
  usage: {
    draftingUsed: number;
    draftingLimit: number;
    oralDevilUsed: number;
    oralDevilLimit: number;
    oralExamUsed: number;
    oralExamLimit: number;
  };
}

/**
 * Get the full subscription info for a user.
 */
export async function getSubscriptionInfo(userId: string): Promise<SubscriptionInfo> {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: {
      subscriptionPlan: true,
      subscriptionStatus: true,
      trialEndsAt: true,
      subscriptionEndsAt: true,
      trialDraftingUsed: true,
      trialOralDevilUsed: true,
      trialOralExamUsed: true,
      role: true,
    },
  });

  if (!user) {
    // Shouldn't happen — middleware guarantees user exists
    return defaultInfo();
  }

  // Admins always have full access
  if (user.role === 'admin') {
    return adminInfo();
  }

  const now = new Date();
  const plan = (user.subscriptionPlan || 'free_trial') as SubscriptionTier;
  const status = user.subscriptionStatus || 'trialing';
  const trialEndsAt = user.trialEndsAt ? new Date(user.trialEndsAt) : null;
  const subscriptionEndsAt = user.subscriptionEndsAt ? new Date(user.subscriptionEndsAt) : null;

  const isTrial = plan === 'free_trial';
  const trialExpired = isTrial && trialEndsAt ? now > trialEndsAt : false;
  const isPaidActive = !isTrial && (status === 'active' || status === 'trialing') &&
    (!subscriptionEndsAt || now < subscriptionEndsAt);
  const isActive = isPaidActive || (isTrial && !trialExpired);

  const usage = {
    draftingUsed: user.trialDraftingUsed ?? 0,
    draftingLimit: TRIAL_LIMITS.drafting,
    oralDevilUsed: user.trialOralDevilUsed ?? 0,
    oralDevilLimit: TRIAL_LIMITS.oral_devil,
    oralExamUsed: user.trialOralExamUsed ?? 0,
    oralExamLimit: TRIAL_LIMITS.oral_exam,
  };

  const canAccess = (feature: FeatureGate): boolean => {
    // Paid → unlimited
    if (isPaidActive) return true;

    // Trial expired → nothing except mastery
    if (trialExpired) {
      return feature === 'mastery' || feature === 'study' || feature === 'quizzes';
    }

    // Active trial — check per-feature limits
    switch (feature) {
      case 'mastery':
      case 'study':
      case 'quizzes':
        return true; // unlimited
      case 'drafting':
        return usage.draftingUsed < TRIAL_LIMITS.drafting;
      case 'oral_devil':
        return usage.oralDevilUsed < TRIAL_LIMITS.oral_devil;
      case 'oral_exam':
        return usage.oralExamUsed < TRIAL_LIMITS.oral_exam;
      default:
        return true;
    }
  };

  return {
    plan,
    status,
    isActive,
    isTrial,
    trialExpired,
    trialEndsAt,
    subscriptionEndsAt,
    canAccess,
    usage,
  };
}

/**
 * Increment a trial usage counter after a feature is used.
 */
export async function incrementTrialUsage(
  userId: string,
  feature: 'drafting' | 'oral_devil' | 'oral_exam'
) {
  const field = {
    drafting: 'trial_drafting_used',
    oral_devil: 'trial_oral_devil_used',
    oral_exam: 'trial_oral_exam_used',
  }[feature] as 'trial_drafting_used' | 'trial_oral_devil_used' | 'trial_oral_exam_used';

  // Use raw SQL increment to avoid race conditions
  await db.execute(
    `UPDATE users SET ${field} = COALESCE(${field}, 0) + 1 WHERE id = '${userId}'`
  );
}

/**
 * Activate a paid subscription after successful payment.
 */
export async function activateSubscription(
  userId: string,
  plan: 'weekly' | 'monthly' | 'annual',
  paystackCustomerId?: string,
  paystackSubscriptionCode?: string,
) {
  const now = new Date();
  let endsAt = new Date(now);

  switch (plan) {
    case 'weekly':
      endsAt.setDate(endsAt.getDate() + 7);
      break;
    case 'monthly':
      endsAt.setMonth(endsAt.getMonth() + 1);
      break;
    case 'annual':
      endsAt.setFullYear(endsAt.getFullYear() + 1);
      break;
  }

  await db.update(users).set({
    subscriptionPlan: plan,
    subscriptionStatus: 'active',
    subscriptionEndsAt: endsAt,
    ...(paystackCustomerId && { paystackCustomerId }),
    ...(paystackSubscriptionCode && { paystackSubscriptionCode }),
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

// ── Helpers ──

function defaultInfo(): SubscriptionInfo {
  return {
    plan: 'free_trial',
    status: 'expired',
    isActive: false,
    isTrial: true,
    trialExpired: true,
    trialEndsAt: null,
    subscriptionEndsAt: null,
    canAccess: () => false,
    usage: { draftingUsed: 0, draftingLimit: 3, oralDevilUsed: 0, oralDevilLimit: 1, oralExamUsed: 0, oralExamLimit: 1 },
  };
}

function adminInfo(): SubscriptionInfo {
  return {
    plan: 'annual',
    status: 'active',
    isActive: true,
    isTrial: false,
    trialExpired: false,
    trialEndsAt: null,
    subscriptionEndsAt: null,
    canAccess: () => true,
    usage: { draftingUsed: 0, draftingLimit: 999, oralDevilUsed: 0, oralDevilLimit: 999, oralExamUsed: 0, oralExamLimit: 999 },
  };
}
