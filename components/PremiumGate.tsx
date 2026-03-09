'use client';

import { useFeatureAccess } from '@/contexts/SubscriptionContext';
import FeatureLockedScreen from '@/components/FeatureLockedScreen';
import EngagingLoader from '@/components/EngagingLoader';
import type { PremiumFeature } from '@/lib/constants/pricing';

interface PremiumGateProps {
  /** The premium feature to check access for */
  feature: PremiumFeature;
  /** Feature content rendered when access is granted */
  children: React.ReactNode;
  /** If true, always render children and show lock as overlay (for pages with both free and premium content) */
  overlay?: boolean;
}

/**
 * Wrap a premium feature page's content with this component.
 * If the user doesn't have access, shows the FeatureLockedScreen.
 * If loading, shows a brief loader.
 *
 * Usage:
 *   <PremiumGate feature="drafting">
 *     <DraftingPageContent />
 *   </PremiumGate>
 */
export default function PremiumGate({ feature, children, overlay }: PremiumGateProps) {
  const access = useFeatureAccess(feature);

  // Still loading subscription status — show a brief skeleton
  if (access.loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <EngagingLoader size="md" message="Checking access..." />
      </div>
    );
  }

  // User has access — render children
  if (access.allowed || access.canUse) {
    return <>{children}</>;
  }

  // Not active at all (expired trial, no subscription) or limit reached
  return (
    <FeatureLockedScreen
      feature={feature}
      tier={access.tier}
      used={access.used}
      limit={access.limit}
      addonRemaining={access.addonRemaining}
    />
  );
}

/**
 * Simple hook-based check that returns isLocked + usage info.
 * Use when you need more control over the locked UI.
 */
export function usePremiumGate(feature: PremiumFeature) {
  const access = useFeatureAccess(feature);
  return {
    isLocked: !access.loading && !access.allowed && !access.canUse,
    isLoading: access.loading,
    ...access,
  };
}
