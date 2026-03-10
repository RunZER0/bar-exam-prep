'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  ArrowLeft, Check, Sparkles, Shield, Clock, Zap, Crown, Rocket, Settings,
  ChevronDown, ChevronUp, ArrowRight,
} from 'lucide-react';
import {
  TIER_PRICES,
  TIER_META,
  WEEKLY_LIMITS,
  BASIC_FEATURES,
  PREMIUM_FEATURE_META,
  PREMIUM_FEATURES,
  CUSTOM_PER_SESSION_PRICE,
  CUSTOM_DURATION_OPTIONS,
  CUSTOM_MIN_SESSIONS,
  CUSTOM_MAX_SESSIONS,
  formatPrice,
  calculateCustomPackagePrice,
  type SubscriptionTier,
  type BillingPeriod,
  type PremiumFeature,
  type CustomPackageSelection,
} from '@/lib/constants/pricing';

const TIERS: (Exclude<SubscriptionTier, 'custom' | 'free_trial'>)[] = ['light', 'standard', 'premium'];
const PERIODS: { id: BillingPeriod; label: string; shortLabel: string }[] = [
  { id: 'weekly', label: 'Weekly', shortLabel: 'wk' },
  { id: 'monthly', label: 'Monthly', shortLabel: 'mo' },
  { id: 'annual', label: 'Annual', shortLabel: 'yr' },
];
const TIER_ICONS: Record<string, typeof Zap> = { Zap, Crown, Rocket, Sparkles, Settings };

const BENEFITS = [
  { icon: Zap, title: 'AI-Powered Learning', description: 'Get instant explanations tailored to Kenyan law' },
  { icon: Clock, title: 'Study Anytime', description: 'Access materials 24/7 on any device' },
  { icon: Shield, title: 'Cancel Anytime', description: 'No long-term commitments, pause when you need' },
];

export default function PricingPage() {
  const [period, setPeriod] = useState<BillingPeriod>('monthly');
  const [showComparison, setShowComparison] = useState(false);
  const [showCustomBuilder, setShowCustomBuilder] = useState(false);
  const [selectedCustomFeatures, setSelectedCustomFeatures] = useState<PremiumFeature[]>([]);
  const [customSessions, setCustomSessions] = useState<Record<string, number>>({});
  const [customDurationId, setCustomDurationId] = useState('1m');

  const customDuration = CUSTOM_DURATION_OPTIONS.find(d => d.id === customDurationId) || CUSTOM_DURATION_OPTIONS[2];

  const customSelections: CustomPackageSelection[] = useMemo(
    () => selectedCustomFeatures.map(f => ({
      feature: f,
      sessionsPerWeek: customSessions[f] || 3,
    })),
    [selectedCustomFeatures, customSessions],
  );

  const customPrice = useMemo(
    () => calculateCustomPackagePrice(customSelections, customDuration.weeks, customDuration.discount),
    [customSelections, customDuration],
  );

  const toggleCustomFeature = (f: PremiumFeature) => {
    setSelectedCustomFeatures(prev => {
      if (prev.includes(f)) return prev.filter(x => x !== f);
      // Default to 3 sessions/week when adding
      if (!customSessions[f]) setCustomSessions(s => ({ ...s, [f]: 3 }));
      return [...prev, f];
    });
  };

  const updateSessions = (f: PremiumFeature, val: number) => {
    const clamped = Math.max(CUSTOM_MIN_SESSIONS, Math.min(CUSTOM_MAX_SESSIONS, val));
    setCustomSessions(s => ({ ...s, [f]: clamped }));
  };

  const handleSelect = (tier: string) => {
    window.location.href = `/subscribe?plan=${tier}&period=${period}`;
  };

  const handleCustomContinue = () => {
    const featuresParam = customSelections.map(s => `${s.feature}:${s.sessionsPerWeek}`).join(',');
    window.location.href = `/subscribe?plan=custom&duration=${customDurationId}&features=${featuresParam}`;
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center gap-4">
          <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <Image src="/favicon-32x32.png" alt="Ynai Logo" width={28} height={28} className="shrink-0" />
            <span className="font-bold text-lg">Ynai</span>
          </Link>
          <div className="flex-1" />
          <Link href="/" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 py-16 text-center">
        <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-4 py-1.5 mb-6">
          <Sparkles className="h-4 w-4 text-emerald-500" />
          <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">Simple, transparent pricing</span>
        </div>
        <h1 className="text-4xl font-bold mb-4">
          Invest in Your <span className="text-emerald-500">Legal Career</span>
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
          Three tiers to match your preparation intensity, plus the option to build your own custom package. All plans include unlimited basic study features.
        </p>

        {/* Period toggle */}
        <div className="inline-flex items-center bg-muted/50 rounded-xl p-1 border border-border/50">
          {PERIODS.map(p => (
            <button
              key={p.id}
              onClick={() => setPeriod(p.id)}
              className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${
                period === p.id
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {p.label}
              {p.id === 'annual' && <span className="ml-1.5 text-xs text-emerald-500 font-semibold">Save 33%</span>}
            </button>
          ))}
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="max-w-6xl mx-auto px-6 pb-8">
        <div className="grid md:grid-cols-3 gap-6">
          {TIERS.map((tier) => {
            const meta = TIER_META[tier];
            const Icon = TIER_ICONS[meta.icon] || Zap;
            const price = TIER_PRICES[tier][period];
            const isPopular = tier === 'standard';
            const limits = WEEKLY_LIMITS[tier];

            return (
              <div
                key={tier}
                className={`relative bg-card border rounded-2xl p-6 flex flex-col transition-all ${
                  isPopular ? 'border-emerald-500 ring-2 ring-emerald-500/20 scale-[1.03]' : 'border-border/50 hover:border-border'
                }`}
              >
                {isPopular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="bg-emerald-500 text-white text-xs font-semibold px-3 py-1 rounded-full">Most Popular</span>
                  </div>
                )}

                <div className="text-center mb-6">
                  <div className={`inline-flex items-center justify-center h-12 w-12 rounded-xl bg-gradient-to-br ${meta.gradient} text-white shadow-md mb-4`}>
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 className="text-lg font-bold mb-1">{meta.name}</h3>
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="text-sm text-muted-foreground">KES</span>
                    <span className="text-4xl font-bold">{price.toLocaleString()}</span>
                    <span className="text-muted-foreground">/{PERIODS.find(p => p.id === period)?.shortLabel}</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">{meta.description}</p>
                </div>

                {/* Basic features */}
                <div className="mb-4">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Unlimited Basics</p>
                  <ul className="space-y-1.5">
                    {BASIC_FEATURES.slice(0, 4).map(f => (
                      <li key={f.key} className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                        {f.label}
                      </li>
                    ))}
                    <li className="text-xs text-muted-foreground pl-5">+{BASIC_FEATURES.length - 4} more</li>
                  </ul>
                </div>

                {/* Premium features */}
                <div className="space-y-2 mb-6 flex-1">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Weekly Premium</p>
                  {PREMIUM_FEATURES.map(feature => {
                    const fMeta = PREMIUM_FEATURE_META[feature];
                    return (
                      <div key={feature} className="flex items-center gap-2 text-sm">
                        <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                        <span>{limits[feature]} {fMeta.label}</span>
                        {feature === 'clarify' && tier === 'premium' && (
                          <span className="text-[10px] bg-amber-500/10 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 rounded font-medium">Advanced AI</span>
                        )}
                      </div>
                    );
                  })}
                </div>

                <button
                  onClick={() => handleSelect(tier)}
                  className={`w-full py-3 px-4 rounded-xl font-medium transition-colors ${
                    isPopular
                      ? 'bg-emerald-500 hover:bg-emerald-600 text-white'
                      : 'bg-muted hover:bg-muted/80 text-foreground'
                  }`}
                >
                  Get Started
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {/* Custom Package Builder */}
      <section id="custom" className="max-w-6xl mx-auto px-6 pb-16">
        <div className="bg-card border border-violet-500/20 rounded-2xl overflow-hidden">
          <button
            onClick={() => setShowCustomBuilder(!showCustomBuilder)}
            className="w-full flex items-center justify-between p-6 hover:bg-muted/30 transition-colors"
          >
            <div className="flex items-center gap-4">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-violet-400 to-purple-500 text-white shadow-md">
                <Settings className="h-5 w-5" />
              </div>
              <div className="text-left">
                <h3 className="text-lg font-bold">Build Your Own Package</h3>
                <p className="text-sm text-muted-foreground">
                  Pick features, choose session quantities &amp; duration &mdash; pay only for what you need
                </p>
              </div>
            </div>
            {showCustomBuilder
              ? <ChevronUp className="h-5 w-5 text-muted-foreground" />
              : <ChevronDown className="h-5 w-5 text-muted-foreground" />
            }
          </button>

          {showCustomBuilder && (
            <div className="px-6 pb-6 border-t border-border/30">
              {/* Duration picker */}
              <div className="mt-5 mb-6">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Duration</p>
                <div className="flex flex-wrap gap-2">
                  {CUSTOM_DURATION_OPTIONS.map(d => (
                    <button
                      key={d.id}
                      onClick={() => setCustomDurationId(d.id)}
                      className={`relative px-4 py-2 rounded-lg text-sm font-medium transition-all border ${
                        customDurationId === d.id
                          ? 'border-violet-500 bg-violet-500/10 text-violet-700 dark:text-violet-300 ring-2 ring-violet-500/20'
                          : 'border-border/50 text-muted-foreground hover:border-border hover:text-foreground'
                      }`}
                    >
                      {d.label}
                      {d.discount > 0 && (
                        <span className="ml-1.5 text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5 rounded font-semibold">
                          -{Math.round(d.discount * 100)}%
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Feature selection with session controls */}
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Select Features &amp; Sessions/Week</p>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
                {PREMIUM_FEATURES.map(feature => {
                  const fMeta = PREMIUM_FEATURE_META[feature];
                  const selected = selectedCustomFeatures.includes(feature);
                  const sessions = customSessions[feature] || 3;
                  const perSession = CUSTOM_PER_SESSION_PRICE[feature];
                  const featureTotal = perSession * sessions * customDuration.weeks * (1 - customDuration.discount);

                  return (
                    <div
                      key={feature}
                      className={`relative rounded-xl border p-4 transition-all ${
                        selected
                          ? 'border-violet-500 bg-violet-500/5 ring-2 ring-violet-500/20'
                          : 'border-border/50 hover:border-border'
                      }`}
                    >
                      {/* Toggle header */}
                      <button
                        onClick={() => toggleCustomFeature(feature)}
                        className="w-full text-left"
                      >
                        <div className={`absolute top-3 right-3 h-5 w-5 rounded-full flex items-center justify-center transition-all ${
                          selected ? 'bg-violet-500' : 'border-2 border-muted-foreground/30'
                        }`}>
                          {selected && <Check className="h-3 w-3 text-white" />}
                        </div>

                        <div className="text-xl mb-1.5">{fMeta.emoji}</div>
                        <h4 className="font-semibold text-sm mb-0.5">{fMeta.label}</h4>
                        <p className="text-xs text-muted-foreground mb-1">{fMeta.description}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {formatPrice(perSession)}/session
                        </p>
                      </button>

                      {/* Session count stepper (only when selected) */}
                      {selected && (
                        <div className="mt-3 pt-3 border-t border-border/30">
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-muted-foreground">Sessions/week</span>
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => updateSessions(feature, sessions - 1)}
                                disabled={sessions <= CUSTOM_MIN_SESSIONS}
                                className="h-7 w-7 rounded-md bg-muted hover:bg-muted/80 flex items-center justify-center text-sm font-bold disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                              >
                                −
                              </button>
                              <input
                                type="number"
                                min={CUSTOM_MIN_SESSIONS}
                                max={CUSTOM_MAX_SESSIONS}
                                value={sessions}
                                onChange={e => updateSessions(feature, parseInt(e.target.value) || CUSTOM_MIN_SESSIONS)}
                                className="w-12 h-7 text-center text-sm font-semibold rounded-md border border-border/50 bg-background [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              />
                              <button
                                onClick={() => updateSessions(feature, sessions + 1)}
                                disabled={sessions >= CUSTOM_MAX_SESSIONS}
                                className="h-7 w-7 rounded-md bg-muted hover:bg-muted/80 flex items-center justify-center text-sm font-bold disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                              >
                                +
                              </button>
                            </div>
                          </div>
                          <p className="text-xs text-right text-violet-600 dark:text-violet-400 font-medium mt-1">
                            {formatPrice(Math.round(featureTotal))} for {customDuration.label.toLowerCase()}
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Custom package summary */}
              <div className="bg-muted/30 rounded-xl p-5">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium mb-1">
                      Your Custom Package
                      {selectedCustomFeatures.length > 0 && (
                        <span className="text-muted-foreground font-normal ml-1">
                          &bull; {customDuration.label}
                          {customDuration.discount > 0 && (
                            <span className="text-emerald-600 dark:text-emerald-400 ml-1">
                              ({Math.round(customDuration.discount * 100)}% off)
                            </span>
                          )}
                        </span>
                      )}
                    </p>
                    {selectedCustomFeatures.length === 0 ? (
                      <p className="text-xs text-muted-foreground">Select at least one feature above</p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {customSelections.map(s => (
                          <span key={s.feature} className="text-xs bg-violet-500/10 text-violet-600 dark:text-violet-400 px-2 py-0.5 rounded-full font-medium">
                            {PREMIUM_FEATURE_META[s.feature].emoji} {PREMIUM_FEATURE_META[s.feature].label} &times;{s.sessionsPerWeek}/wk
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-4 shrink-0">
                    <div className="text-right">
                      <span className="text-xs text-muted-foreground block">Total</span>
                      <span className="text-xl font-bold">
                        {customPrice > 0 ? formatPrice(customPrice) : '—'}
                      </span>
                      {customPrice > 0 && (
                        <span className="text-xs text-muted-foreground block">for {customDuration.label.toLowerCase()}</span>
                      )}
                    </div>
                    <button
                      onClick={handleCustomContinue}
                      disabled={selectedCustomFeatures.length === 0}
                      className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-violet-500 to-purple-500 hover:from-violet-600 hover:to-purple-600 text-white font-medium text-sm disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-2"
                    >
                      Continue <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Per-session breakdown (when features selected) */}
                {customSelections.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-border/30">
                    <p className="text-[10px] text-muted-foreground">
                      {customSelections.map(s => {
                        const perSession = CUSTOM_PER_SESSION_PRICE[s.feature];
                        return `${PREMIUM_FEATURE_META[s.feature].label}: ${s.sessionsPerWeek} × ${formatPrice(perSession)} × ${customDuration.weeks}wk`;
                      }).join(' + ')}
                      {customDuration.discount > 0 && ` − ${Math.round(customDuration.discount * 100)}% discount`}
                    </p>
                  </div>
                )}
              </div>

              {/* Basic features note */}
              <p className="text-xs text-muted-foreground mt-3 flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                Basic features (Mastery Hub, Study Hub, Quizzes, Community, etc.) are always included &mdash; no extra charge.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Full comparison table */}
      <section className="max-w-6xl mx-auto px-6 pb-16">
        <button
          onClick={() => setShowComparison(!showComparison)}
          className="flex items-center gap-2 mx-auto text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          {showComparison ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          Compare all features in detail
        </button>

        {showComparison && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border border-border/50 rounded-xl overflow-hidden">
              <thead>
                <tr className="bg-muted/30">
                  <th className="text-left p-3 font-medium">Feature</th>
                  {TIERS.map(t => (
                    <th key={t} className="text-center p-3 font-semibold">{TIER_META[t].name}</th>
                  ))}
                  <th className="text-center p-3 font-semibold text-violet-600 dark:text-violet-400">Custom</th>
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
                    <td className="text-center p-3">
                      <Check className="h-4 w-4 text-emerald-500 mx-auto" />
                    </td>
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
                    <td className="text-center p-3 text-violet-600 dark:text-violet-400 font-semibold">
                      Custom
                    </td>
                  </tr>
                ))}
                <tr className="bg-muted/20">
                  <td className="p-3 font-medium">Clarify AI Quality</td>
                  <td className="text-center p-3 text-xs text-muted-foreground">Standard</td>
                  <td className="text-center p-3 text-xs text-muted-foreground">Standard</td>
                  <td className="text-center p-3 text-xs font-semibold text-amber-600 dark:text-amber-400">Advanced</td>
                  <td className="text-center p-3 text-xs text-muted-foreground">Standard</td>
                </tr>
                <tr className="bg-muted/20">
                  <td className="p-3 font-medium">Add-on Passes</td>
                  {TIERS.map(t => (
                    <td key={t} className="text-center p-3">
                      <Check className="h-4 w-4 text-emerald-500 mx-auto" />
                    </td>
                  ))}
                  <td className="text-center p-3">
                    <Check className="h-4 w-4 text-emerald-500 mx-auto" />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Benefits */}
      <section className="bg-muted/30 border-y border-border/50">
        <div className="max-w-6xl mx-auto px-6 py-16">
          <h2 className="text-2xl font-bold text-center mb-12">All Plans Include</h2>
          <div className="grid sm:grid-cols-3 gap-8">
            {BENEFITS.map((b, i) => (
              <div key={i} className="text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 bg-emerald-500/10 rounded-xl mb-4">
                  <b.icon className="h-6 w-6 text-emerald-500" />
                </div>
                <h3 className="font-semibold mb-2">{b.title}</h3>
                <p className="text-sm text-muted-foreground">{b.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="max-w-4xl mx-auto px-6 py-16">
        <h2 className="text-2xl font-bold text-center mb-8">Pricing FAQ</h2>
        <div className="space-y-6">
          <div>
            <h3 className="font-semibold mb-2">Can I switch plans?</h3>
            <p className="text-muted-foreground text-sm">
              Yes! You can upgrade at any time and only pay the difference. For example, upgrading from Light (KES 1,500) to Standard (KES 2,000) costs just KES 500. Your new tier activates instantly.
            </p>
          </div>
          <div>
            <h3 className="font-semibold mb-2">What payment methods do you accept?</h3>
            <p className="text-muted-foreground text-sm">
              We accept M-Pesa, credit/debit cards (Visa, Mastercard), and mobile money. All payments are secure via Paystack.
            </p>
          </div>
          <div>
            <h3 className="font-semibold mb-2">Is there a free trial?</h3>
            <p className="text-muted-foreground text-sm">
              Yes! Every new account gets a 3-day free trial with access to all premium features &mdash; 2 sessions per feature per day. No card required.
            </p>
          </div>
          <div>
            <h3 className="font-semibold mb-2">What are add-on passes?</h3>
            <p className="text-muted-foreground text-sm">
              If you hit your weekly limit on a premium feature, you can buy individual add-on passes to get extra sessions without upgrading your entire tier. Available as singles or discounted 5-packs.
            </p>
          </div>
          <div>
            <h3 className="font-semibold mb-2">What is a custom package?</h3>
            <p className="text-muted-foreground text-sm">
              Instead of a fixed tier, you can pick exactly which premium features you want, set how many sessions per week for each, and choose a duration (1 week to 3 months). Longer durations get discounts up to 15%. Basic features are always included free.
            </p>
          </div>
          <div>
            <h3 className="font-semibold mb-2">What&apos;s your refund policy?</h3>
            <p className="text-muted-foreground text-sm">
              If you&apos;re not satisfied within the first 7 days, contact us for a full refund &mdash; no questions asked.
            </p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-4xl mx-auto px-6 py-16 text-center">
        <h2 className="text-2xl font-bold mb-4">Ready to Start Preparing?</h2>
        <p className="text-muted-foreground mb-8">
          Join KSL students already using Ynai to prepare for the bar exam.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white font-medium px-6 py-3 rounded-xl transition-colors"
        >
          Get Started Now
        </Link>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 py-8">
        <div className="max-w-6xl mx-auto px-6 text-center text-sm text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} Ynai. All rights reserved.</p>
          <div className="flex items-center justify-center gap-4 mt-4">
            <Link href="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-foreground transition-colors">Terms</Link>
            <Link href="/disclaimer" className="hover:text-foreground transition-colors">Disclaimer</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
