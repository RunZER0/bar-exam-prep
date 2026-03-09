'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import {
  Crown,
  Check,
  Sparkles,
  Zap,
  Shield,
  Clock,
  ArrowRight,
  CreditCard,
  Star,
  Rocket,
  AlertCircle,
  ShoppingBag,
  X,
  ChevronDown,
  Settings,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  TIER_PRICES,
  TIER_META,
  WEEKLY_LIMITS,
  BASIC_FEATURES,
  PREMIUM_FEATURE_META,
  PREMIUM_FEATURES,
  ADDON_PRICES,
  ADDON_PACKS,
  CUSTOM_FEATURE_PRICES,
  CUSTOM_WEEKLY_LIMIT,
  formatPrice,
  calculateCustomPrice,
  type SubscriptionTier,
  type BillingPeriod,
  type PremiumFeature,
} from '@/lib/constants/pricing';

const TIER_ICONS: Record<string, typeof Zap> = { Zap, Crown, Rocket, Sparkles, Settings };

const TIERS: (Exclude<SubscriptionTier, 'custom' | 'free_trial'>)[] = ['light', 'standard', 'premium'];
const PERIODS: { id: BillingPeriod; label: string; shortLabel: string }[] = [
  { id: 'weekly', label: 'Weekly', shortLabel: 'wk' },
  { id: 'monthly', label: 'Monthly', shortLabel: 'mo' },
  { id: 'annual', label: 'Annual', shortLabel: 'yr' },
];

export default function SubscribePage() {
  const { user, getIdToken } = useAuth();
  const searchParams = useSearchParams();
  const [selectedTier, setSelectedTier] = useState<SubscriptionTier>('standard');
  const [selectedPeriod, setSelectedPeriod] = useState<BillingPeriod>('monthly');
  const [selectedCustomFeatures, setSelectedCustomFeatures] = useState<PremiumFeature[]>([]);
  const [processing, setProcessing] = useState(false);
  const [step, setStep] = useState<'plan' | 'payment' | 'confirm' | 'addon'>('plan');
  const [error, setError] = useState<string | null>(null);
  const [currentSub, setCurrentSub] = useState<any>(null);
  const [showAddons, setShowAddons] = useState(false);

  // Parse plan/period/features from URL params
  useEffect(() => {
    const plan = searchParams.get('plan');
    const period = searchParams.get('period');
    const features = searchParams.get('features');
    if (plan && ['light', 'standard', 'premium', 'custom'].includes(plan)) {
      setSelectedTier(plan as SubscriptionTier);
    }
    if (period && ['weekly', 'monthly', 'annual'].includes(period)) {
      setSelectedPeriod(period as BillingPeriod);
    }
    if (features) {
      const parsed = features.split(',').filter(f =>
        PREMIUM_FEATURES.includes(f as PremiumFeature)
      ) as PremiumFeature[];
      if (parsed.length > 0) setSelectedCustomFeatures(parsed);
    }
  }, [searchParams]);

  const customPrice = useMemo(
    () => calculateCustomPrice(selectedCustomFeatures, selectedPeriod),
    [selectedCustomFeatures, selectedPeriod],
  );

  const effectivePrice = selectedTier === 'custom' ? customPrice : TIER_PRICES[selectedTier][selectedPeriod];

  // Check for addon query param
  useEffect(() => {
    const addon = searchParams.get('addon');
    if (addon) {
      setStep('addon');
      setShowAddons(true);
    }
  }, [searchParams]);

  // Load current subscription status
  useEffect(() => {
    const loadStatus = async () => {
      try {
        const token = await getIdToken();
        const res = await fetch('/api/payments/status', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          setCurrentSub(await res.json());
        }
      } catch {}
    };
    loadStatus();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Check for callback from Paystack redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get('ref') || params.get('reference') || params.get('trxref');
    if (ref) {
      verifyPayment(ref);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reset "processing" if the user returns via browser back-button (bfcache)
  useEffect(() => {
    const handlePageShow = (e: PageTransitionEvent) => {
      if (e.persisted) setProcessing(false);
    };
    window.addEventListener('pageshow', handlePageShow);
    return () => window.removeEventListener('pageshow', handlePageShow);
  }, []);

  const isUpgrade = currentSub?.isActive && !currentSub?.isTrial && currentSub?.tier !== 'free_trial';
  const price = effectivePrice;

  const verifyPayment = async (reference: string) => {
    setProcessing(true);
    setError(null);
    try {
      const token = await getIdToken();
      const res = await fetch(`/api/payments/verify?reference=${encodeURIComponent(reference)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.verified) {
        setStep('confirm');
      } else {
        setError(data.message || 'Payment could not be verified. Please contact support.');
        setStep('payment');
      }
    } catch {
      setError('Payment verification failed. Your payment may still be processing.');
      setStep('payment');
    } finally {
      setProcessing(false);
    }
  };

  const handleSubscribe = async () => {
    setProcessing(true);
    setError(null);
    try {
      const token = await getIdToken();
      const res = await fetch('/api/payments/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          tier: selectedTier,
          period: selectedPeriod,
          ...(selectedTier === 'custom' && { customFeatures: selectedCustomFeatures }),
          callbackUrl: `${window.location.origin}/subscribe`,
        }),
      });
      const data = await res.json();

      // Handle free upgrade
      if (data.freeUpgrade) {
        setStep('confirm');
        setProcessing(false);
        return;
      }

      if (data.authorization_url) {
        window.location.href = data.authorization_url;
        setTimeout(() => setProcessing(false), 10000);
      } else {
        setError(data.error || 'Failed to initialize payment.');
        setProcessing(false);
      }
    } catch {
      setError('Something went wrong. Please try again.');
      setProcessing(false);
    }
  };

  const handleBuyAddon = async (feature: PremiumFeature, quantity: number = 1) => {
    setProcessing(true);
    setError(null);
    try {
      const token = await getIdToken();
      const res = await fetch('/api/payments/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          addon: { feature, quantity },
          callbackUrl: `${window.location.origin}/subscribe`,
        }),
      });
      const data = await res.json();
      if (data.authorization_url) {
        window.location.href = data.authorization_url;
        setTimeout(() => setProcessing(false), 10000);
      } else {
        setError(data.error || 'Failed to initialize payment.');
        setProcessing(false);
      }
    } catch {
      setError('Something went wrong. Please try again.');
      setProcessing(false);
    }
  };

  const handleBuyPack = async (packId: string) => {
    setProcessing(true);
    setError(null);
    try {
      const token = await getIdToken();
      const res = await fetch('/api/payments/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          addonPack: packId,
          callbackUrl: `${window.location.origin}/subscribe`,
        }),
      });
      const data = await res.json();
      if (data.authorization_url) {
        window.location.href = data.authorization_url;
        setTimeout(() => setProcessing(false), 10000);
      } else {
        setError(data.error || 'Failed to initialize payment.');
        setProcessing(false);
      }
    } catch {
      setError('Something went wrong. Please try again.');
      setProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-500/20 rounded-full px-4 py-1.5 mb-4">
            <Crown className="h-4 w-4 text-emerald-500" />
            <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
              {isUpgrade ? 'Upgrade Your Plan' : 'Choose Your Plan'}
            </span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold mb-3">
            {isUpgrade ? 'Upgrade for More Power' : 'Invest in Your Legal Career'}
          </h1>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Three tiers to match your preparation intensity, or build a custom package. All plans include unlimited basic study features.
          </p>

          {/* Period toggle */}
          <div className="mt-6 inline-flex items-center bg-muted/50 rounded-xl p-1 border border-border/50">
            {PERIODS.map(p => (
              <button
                key={p.id}
                onClick={() => setSelectedPeriod(p.id)}
                className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${
                  selectedPeriod === p.id
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {p.label}
                {p.id === 'annual' && (
                  <span className="ml-1.5 text-xs text-emerald-500 font-semibold">Save 33%</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {step === 'plan' && (
          <>
            {/* Tier cards */}
            <div className="grid md:grid-cols-3 gap-5 mb-10">
              {TIERS.map((tier) => {
                const meta = TIER_META[tier];
                const Icon = TIER_ICONS[meta.icon] || Zap;
                const tierPrice = TIER_PRICES[tier][selectedPeriod];
                const isSelected = selectedTier === tier;
                const isPopular = tier === 'standard';
                const isCurrent = currentSub?.tier === tier;
                const limits = WEEKLY_LIMITS[tier];

                return (
                  <div
                    key={tier}
                    onClick={() => !isCurrent && setSelectedTier(tier)}
                    className={`relative rounded-2xl overflow-hidden transition-all duration-300 ${
                      isCurrent
                        ? 'ring-2 ring-emerald-500/50 opacity-80 cursor-default'
                        : isSelected
                          ? 'ring-2 ring-emerald-500 shadow-lg shadow-emerald-500/15 scale-[1.02] cursor-pointer'
                          : 'ring-1 ring-border hover:ring-border/80 cursor-pointer'
                    }`}
                  >
                    {/* Popular badge */}
                    {isPopular && (
                      <div className={`bg-gradient-to-r ${meta.gradient} text-white text-xs font-semibold text-center py-1.5`}>
                        Most Popular
                      </div>
                    )}
                    {isCurrent && (
                      <div className="bg-emerald-500 text-white text-xs font-semibold text-center py-1.5">
                        Current Plan
                      </div>
                    )}

                    <div className={`bg-card p-6 ${isPopular || isCurrent ? '' : 'pt-6'}`}>
                      {/* Tier icon */}
                      <div className={`inline-flex items-center justify-center h-11 w-11 rounded-xl bg-gradient-to-br ${meta.gradient} text-white shadow-md mb-4`}>
                        <Icon className="h-5 w-5" />
                      </div>

                      <h3 className="text-lg font-bold mb-1">{meta.name}</h3>
                      <p className="text-xs text-muted-foreground mb-4">{meta.description}</p>

                      {/* Price */}
                      <div className="flex items-baseline gap-1 mb-5">
                        <span className="text-xs text-muted-foreground">KES</span>
                        <span className="text-3xl font-bold">{tierPrice.toLocaleString()}</span>
                        <span className="text-muted-foreground text-sm">/{PERIODS.find(p => p.id === selectedPeriod)?.shortLabel}</span>
                      </div>

                      {/* Basic features */}
                      <div className="mb-4">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Unlimited Basics</p>
                        <div className="flex flex-wrap gap-1.5">
                          {BASIC_FEATURES.slice(0, 5).map(f => (
                            <span key={f.key} className="text-xs bg-muted/60 text-muted-foreground px-2 py-0.5 rounded-md">
                              {f.label}
                            </span>
                          ))}
                          <span className="text-xs text-muted-foreground">+{BASIC_FEATURES.length - 5} more</span>
                        </div>
                      </div>

                      {/* Premium features with limits */}
                      <div className="space-y-2 mb-5">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Weekly Limits</p>
                        {PREMIUM_FEATURES.map(feature => {
                          const fMeta = PREMIUM_FEATURE_META[feature];
                          const limit = limits[feature];
                          return (
                            <div key={feature} className="flex items-center gap-2 text-sm">
                              <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                              <span className="text-foreground/80">
                                {limit} {fMeta.label}
                              </span>
                              {feature === 'clarify' && tier === 'premium' && (
                                <span className="text-[10px] bg-amber-500/10 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 rounded font-medium">
                                  GPT-5.2
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* Selection indicator */}
                      {isSelected && !isCurrent && (
                        <div className="absolute top-3 right-3">
                          <div className="h-6 w-6 rounded-full bg-emerald-500 flex items-center justify-center">
                            <Check className="h-4 w-4 text-white" />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Custom Package Builder */}
            <div className={`mb-8 border rounded-2xl overflow-hidden transition-all ${
              selectedTier === 'custom' ? 'border-violet-500 ring-2 ring-violet-500/20' : 'border-border/50'
            }`}>
              <button
                onClick={() => setSelectedTier(selectedTier === 'custom' ? 'standard' : 'custom')}
                className="w-full flex items-center justify-between p-5 hover:bg-muted/30 transition-colors bg-card"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-gradient-to-br from-violet-400 to-purple-500 text-white shadow-md">
                    <Settings className="h-5 w-5" />
                  </div>
                  <div className="text-left">
                    <h3 className="font-bold">Build Custom Package</h3>
                    <p className="text-xs text-muted-foreground">Pick only the premium features you need</p>
                  </div>
                </div>
                <div className={`h-6 w-6 rounded-full flex items-center justify-center ${
                  selectedTier === 'custom' ? 'bg-violet-500' : 'border-2 border-muted-foreground/30'
                }`}>
                  {selectedTier === 'custom' && <Check className="h-4 w-4 text-white" />}
                </div>
              </button>

              {selectedTier === 'custom' && (
                <div className="px-5 pb-5 border-t border-border/30 bg-card">
                  <p className="text-xs text-muted-foreground mt-4 mb-4">
                    Each feature gives you {CUSTOM_WEEKLY_LIMIT} sessions/week. Basic features always included.
                  </p>
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2.5 mb-4">
                    {PREMIUM_FEATURES.map(feature => {
                      const fMeta = PREMIUM_FEATURE_META[feature];
                      const selected = selectedCustomFeatures.includes(feature);
                      const featurePrice = CUSTOM_FEATURE_PRICES[feature][selectedPeriod];
                      return (
                        <button
                          key={feature}
                          onClick={() => setSelectedCustomFeatures(prev =>
                            prev.includes(feature) ? prev.filter(x => x !== feature) : [...prev, feature]
                          )}
                          className={`relative rounded-xl border p-3.5 text-left transition-all ${
                            selected
                              ? 'border-violet-500 bg-violet-500/5 ring-1 ring-violet-500/20'
                              : 'border-border/50 hover:border-border'
                          }`}
                        >
                          <div className={`absolute top-2.5 right-2.5 h-4 w-4 rounded-full flex items-center justify-center ${
                            selected ? 'bg-violet-500' : 'border-2 border-muted-foreground/30'
                          }`}>
                            {selected && <Check className="h-2.5 w-2.5 text-white" />}
                          </div>
                          <span className="text-lg">{fMeta.emoji}</span>
                          <p className="font-semibold text-xs mt-1">{fMeta.label}</p>
                          <p className="text-xs font-bold text-violet-600 dark:text-violet-400 mt-0.5">
                            {formatPrice(featurePrice)}/{PERIODS.find(p => p.id === selectedPeriod)?.shortLabel}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                  {selectedCustomFeatures.length > 0 && (
                    <div className="flex items-center justify-between bg-violet-500/5 rounded-xl p-3">
                      <div className="flex flex-wrap gap-1">
                        {selectedCustomFeatures.map(f => (
                          <span key={f} className="text-[10px] bg-violet-500/10 text-violet-600 dark:text-violet-400 px-1.5 py-0.5 rounded-full font-medium">
                            {PREMIUM_FEATURE_META[f].emoji} {PREMIUM_FEATURE_META[f].label}
                          </span>
                        ))}
                      </div>
                      <span className="text-sm font-bold shrink-0 ml-3">{formatPrice(customPrice)}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button
                onClick={() => setStep('payment')}
                disabled={currentSub?.tier === selectedTier || (selectedTier === 'custom' && selectedCustomFeatures.length === 0)}
                size="lg"
                className={`gap-2 px-8 text-white shadow-lg ${
                  selectedTier === 'custom'
                    ? 'bg-gradient-to-r from-violet-500 to-purple-500 hover:from-violet-600 hover:to-purple-600 shadow-violet-500/20'
                    : 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 shadow-emerald-500/20'
                }`}
              >
                {selectedTier === 'custom'
                  ? (selectedCustomFeatures.length === 0 ? 'Select Features' : `Get Custom — ${formatPrice(customPrice)}`)
                  : (isUpgrade ? `Upgrade to ${TIER_META[selectedTier].name}` : `Get ${TIER_META[selectedTier].name}`)
                }
                <ArrowRight className="h-4 w-4" />
              </Button>

              {currentSub?.isActive && !currentSub?.isTrial && (
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => { setShowAddons(true); setStep('addon'); }}
                  className="gap-2"
                >
                  <ShoppingBag className="h-4 w-4 text-amber-500" />
                  Buy Add-on Passes
                </Button>
              )}
            </div>

            {/* Feature comparison table (collapsed) */}
            <div className="mt-12">
              <button
                onClick={() => setShowAddons(!showAddons)}
                className="flex items-center gap-2 mx-auto text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <ChevronDown className={`h-4 w-4 transition-transform ${showAddons ? 'rotate-180' : ''}`} />
                Compare all features
              </button>

              {showAddons && (
                <div className="mt-6 overflow-x-auto">
                  <table className="w-full text-sm border border-border/50 rounded-xl overflow-hidden">
                    <thead>
                      <tr className="bg-muted/30">
                        <th className="text-left p-3 font-medium">Feature</th>
                        {TIERS.map(t => (
                          <th key={t} className="text-center p-3 font-semibold">{TIER_META[t].name}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {BASIC_FEATURES.map((f, i) => (
                        <tr key={f.key} className={i % 2 === 0 ? 'bg-card' : 'bg-muted/10'}>
                          <td className="p-3 text-muted-foreground">{f.label}</td>
                          {TIERS.map(t => (
                            <td key={t} className="text-center p-3">
                              <Check className="h-4 w-4 text-emerald-500 mx-auto" />
                            </td>
                          ))}
                        </tr>
                      ))}
                      {PREMIUM_FEATURES.map((f, i) => (
                        <tr key={f} className={(BASIC_FEATURES.length + i) % 2 === 0 ? 'bg-card' : 'bg-muted/10'}>
                          <td className="p-3 font-medium">
                            {PREMIUM_FEATURE_META[f].emoji} {PREMIUM_FEATURE_META[f].label}
                          </td>
                          {TIERS.map(t => (
                            <td key={t} className="text-center p-3 font-semibold">
                              {WEEKLY_LIMITS[t][f]}/wk
                            </td>
                          ))}
                        </tr>
                      ))}
                      <tr className="bg-muted/20">
                        <td className="p-3 font-medium">Clarify AI Model</td>
                        <td className="text-center p-3 text-xs text-muted-foreground">GPT-4o Mini</td>
                        <td className="text-center p-3 text-xs text-muted-foreground">GPT-4o Mini</td>
                        <td className="text-center p-3 text-xs font-semibold text-amber-600 dark:text-amber-400">GPT-5.2</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}

        {/* ── Add-on Passes ── */}
        {step === 'addon' && (
          <div className="max-w-3xl mx-auto">
            <button onClick={() => setStep('plan')} className="text-sm text-muted-foreground hover:text-foreground mb-6 flex items-center gap-1">
              <ArrowRight className="h-3 w-3 rotate-180" /> Back to plans
            </button>

            <h2 className="text-xl font-bold mb-6">Add-on Passes</h2>
            <p className="text-sm text-muted-foreground mb-8">
              Need extra sessions beyond your weekly limit? Buy individual passes or save with bulk packs.
            </p>

            {/* Individual passes */}
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
              {PREMIUM_FEATURES.map(feature => {
                const meta = PREMIUM_FEATURE_META[feature];
                return (
                  <div key={feature} className="bg-card border border-border/50 rounded-xl p-5">
                    <div className="text-2xl mb-2">{meta.emoji}</div>
                    <h3 className="font-semibold text-sm mb-1">{meta.label}</h3>
                    <p className="text-xs text-muted-foreground mb-3">{meta.description}</p>
                    <div className="flex items-baseline gap-1 mb-3">
                      <span className="text-lg font-bold">{formatPrice(ADDON_PRICES[feature])}</span>
                      <span className="text-xs text-muted-foreground">/pass</span>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleBuyAddon(feature)}
                      disabled={processing}
                      className="w-full text-xs"
                    >
                      Buy 1 Pass
                    </Button>
                  </div>
                );
              })}
            </div>

            {/* Bulk packs */}
            <h3 className="text-lg font-semibold mb-4">Bulk Packs (Save More)</h3>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
              {ADDON_PACKS.map(pack => {
                const meta = PREMIUM_FEATURE_META[pack.feature];
                return (
                  <div key={pack.id} className="bg-card border border-amber-500/20 rounded-xl p-5">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-lg">{meta.emoji}</span>
                      <span className="text-xs bg-amber-500/10 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded-full font-medium">
                        Save {Math.round((1 - pack.price / (ADDON_PRICES[pack.feature] * pack.quantity)) * 100)}%
                      </span>
                    </div>
                    <h3 className="font-semibold text-sm mb-1">{pack.name}</h3>
                    <div className="flex items-baseline gap-1 mb-3">
                      <span className="text-lg font-bold">{formatPrice(pack.price)}</span>
                      <span className="text-xs text-muted-foreground line-through">
                        {formatPrice(ADDON_PRICES[pack.feature] * pack.quantity)}
                      </span>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => handleBuyPack(pack.id)}
                      disabled={processing}
                      className="w-full text-xs bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white"
                    >
                      Buy Pack
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Payment Step ── */}
        {step === 'payment' && (
          <div className="max-w-lg mx-auto">
            {/* Order summary */}
            <div className="bg-card rounded-xl p-6 border border-border/50 mb-6">
              <h3 className="font-semibold mb-4">Order Summary</h3>
              <div className="flex items-center justify-between py-3 border-b border-border/30">
                <div>
                  <p className="font-medium">
                    {selectedTier === 'custom' ? 'Custom Package' : `${TIER_META[selectedTier].name} Plan`}
                  </p>
                  <p className="text-sm text-muted-foreground">Billed {selectedPeriod}ly</p>
                  {selectedTier === 'custom' && selectedCustomFeatures.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {selectedCustomFeatures.map(f => (
                        <span key={f} className="text-[10px] bg-violet-500/10 text-violet-600 dark:text-violet-400 px-1.5 py-0.5 rounded-full font-medium">
                          {PREMIUM_FEATURE_META[f].emoji} {PREMIUM_FEATURE_META[f].label}
                        </span>
                      ))}
                    </div>
                  )}
                  {isUpgrade && selectedTier !== 'custom' && (
                    <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">
                      Upgrade from {TIER_META[currentSub.tier as SubscriptionTier]?.name || 'current plan'}
                    </p>
                  )}
                </div>
                <p className="font-semibold">{formatPrice(price)}</p>
              </div>
              <div className="flex items-center justify-between pt-3">
                <p className="font-semibold">Total</p>
                <p className="font-bold text-lg">{formatPrice(price)}</p>
              </div>
            </div>

            {/* Payment method */}
            <div className="bg-card rounded-xl p-6 border border-border/50 mb-6">
              <h3 className="font-semibold mb-4">Payment Method</h3>
              <div className="flex items-center gap-3 p-4 rounded-xl border-2 border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20">
                <CreditCard className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">Card / M-Pesa</p>
                  <p className="text-xs text-muted-foreground">Visa, Mastercard, M-Pesa via Paystack</p>
                </div>
                <div className="ml-auto h-5 w-5 rounded-full bg-emerald-500 flex items-center justify-center">
                  <Check className="h-3 w-3 text-white" />
                </div>
              </div>
            </div>

            {/* Account info */}
            <div className="bg-muted/40 rounded-xl p-4 border border-border/30 mb-6">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Subscribing as {user?.email}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    You&apos;ll be redirected to Paystack for secure payment
                  </p>
                </div>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 mb-6">
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              </div>
            )}

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep('plan')} className="flex-1">
                Back
              </Button>
              <Button
                onClick={handleSubscribe}
                disabled={processing}
                className="flex-1 gap-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white"
              >
                {processing ? 'Processing...' : (
                  <>Pay {formatPrice(price)} <ArrowRight className="h-4 w-4" /></>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* ── Confirmation ── */}
        {step === 'confirm' && (
          <div className="max-w-lg mx-auto text-center">
            <div className="bg-card rounded-2xl p-8 border border-border/50">
              <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 text-white mb-6">
                <Check className="h-8 w-8" />
              </div>
              <h2 className="text-2xl font-bold mb-2">You&apos;re All Set!</h2>
              <p className="text-muted-foreground mb-6">
                Your {TIER_META[selectedTier].name} subscription is now active. Enjoy your premium features.
              </p>
              <div className="bg-muted/40 rounded-xl p-4 mb-6 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Tier</span>
                  <span className="font-medium">{TIER_META[selectedTier].name}</span>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-muted-foreground">Billing</span>
                  <span className="font-medium capitalize">{selectedPeriod}</span>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-muted-foreground">Amount</span>
                  <span className="font-medium">{formatPrice(price)}</span>
                </div>
              </div>
              <Link href="/dashboard">
                <Button className="w-full gap-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white">
                  Go to Dashboard <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        )}

        {/* ── Why Upgrade section ── */}
        {step === 'plan' && (
          <div className="mt-16">
            <h2 className="text-xl font-semibold text-center mb-8">Why Choose Ynai?</h2>
            <div className="grid md:grid-cols-3 gap-6">
              {[
                { icon: Sparkles, title: 'AI-Powered Learning', desc: 'Get instant explanations tailored to Kenyan law', color: 'emerald' },
                { icon: Clock, title: 'Study Anytime', desc: 'Access materials 24/7 on any device', color: 'sky' },
                { icon: Shield, title: 'Cancel Anytime', desc: 'No long-term commitments, pause when you need', color: 'amber' },
              ].map((b, i) => (
                <div key={i} className="text-center">
                  <div className={`inline-flex items-center justify-center h-12 w-12 rounded-xl bg-${b.color}-500/10 text-${b.color}-500 mb-4`}>
                    <b.icon className="h-6 w-6" />
                  </div>
                  <h3 className="font-medium mb-2">{b.title}</h3>
                  <p className="text-sm text-muted-foreground">{b.desc}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
