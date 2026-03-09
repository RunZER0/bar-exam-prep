'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext';
import type {
  SubscriptionTier,
  BillingPeriod,
  PremiumFeature,
  FeatureKey,
} from '@/lib/constants/pricing';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface FeatureUsageInfo {
  used: number;
  limit: number;
  addonRemaining: number;
  canUse: boolean;
}

export interface SubscriptionState {
  /** Current tier */
  tier: SubscriptionTier;
  billingPeriod: BillingPeriod | null;
  plan: string;
  status: string;
  isActive: boolean;
  isTrial: boolean;
  trialExpired: boolean;
  trialEndsAt: string | null;
  subscriptionEndsAt: string | null;
  daysRemaining: number;
  clarifyModel: string;
  /** Quick access check: does the user have access to this feature right now? */
  canAccess: Record<string, boolean>;
  /** Detailed usage per premium feature */
  featureUsage: Record<PremiumFeature, FeatureUsageInfo>;
  /** Legacy usage fields */
  usage: {
    draftingUsed: number;
    draftingLimit: number;
    oralDevilUsed: number;
    oralDevilLimit: number;
    oralExamUsed: number;
    oralExamLimit: number;
  };
  /** Whether data is still loading */
  loading: boolean;
  /** Force refresh from server */
  refresh: () => Promise<void>;
}

const EMPTY_USAGE: FeatureUsageInfo = { used: 0, limit: 0, addonRemaining: 0, canUse: false };

const DEFAULT_STATE: SubscriptionState = {
  tier: 'free_trial',
  billingPeriod: null,
  plan: 'free_trial',
  status: 'trialing',
  isActive: false,
  isTrial: true,
  trialExpired: false,
  trialEndsAt: null,
  subscriptionEndsAt: null,
  daysRemaining: 0,
  clarifyModel: 'gpt-4o-mini',
  canAccess: {},
  featureUsage: {
    drafting: EMPTY_USAGE,
    oral_exam: EMPTY_USAGE,
    oral_devil: EMPTY_USAGE,
    cle_exam: EMPTY_USAGE,
    research: EMPTY_USAGE,
    clarify: EMPTY_USAGE,
  },
  usage: {
    draftingUsed: 0, draftingLimit: 0,
    oralDevilUsed: 0, oralDevilLimit: 0,
    oralExamUsed: 0, oralExamLimit: 0,
  },
  loading: true,
  refresh: async () => {},
};

const SubscriptionContext = createContext<SubscriptionState>(DEFAULT_STATE);

// ─────────────────────────────────────────────
// Provider
// ─────────────────────────────────────────────

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const { user, getIdToken } = useAuth();
  const [state, setState] = useState<SubscriptionState>(DEFAULT_STATE);
  const fetchedRef = useRef(false);

  const fetchStatus = useCallback(async () => {
    if (!user) {
      setState({ ...DEFAULT_STATE, loading: false, refresh: fetchStatus });
      return;
    }

    try {
      const token = await getIdToken();
      if (!token) {
        setState({ ...DEFAULT_STATE, loading: false, refresh: fetchStatus });
        return;
      }

      const res = await fetch('/api/payments/status', {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });

      if (!res.ok) {
        console.warn('[Subscription] Failed to fetch status:', res.status);
        setState(prev => ({ ...prev, loading: false, refresh: fetchStatus }));
        return;
      }

      const data = await res.json();

      setState({
        tier: data.tier || 'free_trial',
        billingPeriod: data.billingPeriod || null,
        plan: data.plan || 'free_trial',
        status: data.status || 'trialing',
        isActive: data.isActive ?? false,
        isTrial: data.isTrial ?? true,
        trialExpired: data.trialExpired ?? false,
        trialEndsAt: data.trialEndsAt || null,
        subscriptionEndsAt: data.subscriptionEndsAt || null,
        daysRemaining: data.daysRemaining ?? 0,
        clarifyModel: data.clarifyModel || 'gpt-4o-mini',
        canAccess: data.canAccess || {},
        featureUsage: data.featureUsage || DEFAULT_STATE.featureUsage,
        usage: data.usage || DEFAULT_STATE.usage,
        loading: false,
        refresh: fetchStatus,
      });
    } catch (err) {
      console.error('[Subscription] Error fetching status:', err);
      setState(prev => ({ ...prev, loading: false, refresh: fetchStatus }));
    }
  }, [user, getIdToken]);

  // Fetch on user change
  useEffect(() => {
    fetchedRef.current = false;
    fetchStatus();
  }, [user?.uid, fetchStatus]);

  // Re-fetch when window regains focus (user might have just completed payment)
  useEffect(() => {
    const handleFocus = () => {
      fetchStatus();
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [fetchStatus]);

  return (
    <SubscriptionContext.Provider value={state}>
      {children}
    </SubscriptionContext.Provider>
  );
}

// ─────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────

/**
 * Access the subscription state from any component.
 *
 * Usage:
 *   const { tier, canAccess, featureUsage, loading, refresh } = useSubscription();
 *   if (!canAccess.drafting) return <FeatureLockedScreen feature="drafting" />;
 */
export function useSubscription(): SubscriptionState {
  return useContext(SubscriptionContext);
}

/**
 * Quick check: can the user use a specific premium feature?
 * Returns { allowed, usage, loading }.
 */
export function useFeatureAccess(feature: PremiumFeature) {
  const sub = useSubscription();
  const usage = sub.featureUsage[feature] || EMPTY_USAGE;
  return {
    allowed: sub.canAccess[feature] ?? false,
    canUse: usage.canUse,
    used: usage.used,
    limit: usage.limit,
    addonRemaining: usage.addonRemaining,
    tier: sub.tier,
    isTrial: sub.isTrial,
    isActive: sub.isActive,
    loading: sub.loading,
    refresh: sub.refresh,
  };
}
