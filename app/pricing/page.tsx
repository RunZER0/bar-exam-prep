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
  CUSTOM_FEATURE_PRICES,
  CUSTOM_WEEKLY_LIMIT,
  formatPrice,
  calculateCustomPrice,
  type SubscriptionTier,
  type BillingPeriod,
  type PremiumFeature,
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

  const customPrice = useMemo(
    () => calculateCustomPrice(selectedCustomFeatures, period),
    [selectedCustomFeatures, period],
  );

  const toggleCustomFeature = (f: PremiumFeature) => {
    setSelectedCustomFeatures(prev =>
      prev.includes(f) ? prev.filter(x => x !== f) : [...prev, f],
    );
  };

  const handleSelect = (tier: string) => {
    window.location.href = `/subscribe?plan=${tier}&period=${period}`;
  };

  const handleCustomContinue = () => {
    const features = selectedCustomFeatures.join(',');
    window.location.href = `/subscribe?plan=custom&period=${period}&features=${features}`;
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
                          <span className="text-[10px] bg-amber-500/10 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 rounded font-medium">GPT-5.2</span>
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
                  Pick only the premium features you need &mdash; basic features always included
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
              <p className="text-xs text-muted-foreground mt-4 mb-5">
                Select the features you want. Each gives you {CUSTOM_WEEKLY_LIMIT} sessions per week. Basic features (Mastery Hub, Study, Quizzes, etc.) are always included free.
              </p>

              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
                {PREMIUM_FEATURES.map(feature => {
                  const fMeta = PREMIUM_FEATURE_META[feature];
                  const selected = selectedCustomFeatures.includes(feature);
                  const featurePrice = CUSTOM_FEATURE_PRICES[feature][period];

                  return (
                    <button
                      key={feature}
                      onClick={() => toggleCustomFeature(feature)}
                      className={`relative rounded-xl border p-4 text-left transition-all ${
                        selected
                          ? 'border-violet-500 bg-violet-500/5 ring-2 ring-violet-500/20'
                          : 'border-border/50 hover:border-border'
                      }`}
                    >
                      {/* Selection indicator */}
                      <div className={`absolute top-3 right-3 h-5 w-5 rounded-full flex items-center justify-center transition-all ${
                        selected ? 'bg-violet-500' : 'border-2 border-muted-foreground/30'
                      }`}>
                        {selected && <Check className="h-3 w-3 text-white" />}
                      </div>

                      <div className="text-xl mb-2">{fMeta.emoji}</div>
                      <h4 className="font-semibold text-sm mb-0.5">{fMeta.label}</h4>
                      <p className="text-xs text-muted-foreground mb-2">{fMeta.description}</p>
                      <div className="flex items-baseline gap-1">
                        <span className="text-sm font-bold">{formatPrice(featurePrice)}</span>
                        <span className="text-xs text-muted-foreground">/{PERIODS.find(p => p.id === period)?.shortLabel}</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {CUSTOM_WEEKLY_LIMIT} sessions/week
                      </p>
                    </button>
                  );
                })}
              </div>

              {/* Custom package summary */}
              <div className="bg-muted/30 rounded-xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium mb-1">
                    Your Custom Package
                    {selectedCustomFeatures.length > 0 && (
                      <span className="text-muted-foreground font-normal ml-1">
                        ({selectedCustomFeatures.length} feature{selectedCustomFeatures.length !== 1 ? 's' : ''})
                      </span>
                    )}
                  </p>
                  {selectedCustomFeatures.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Select at least one feature above</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {selectedCustomFeatures.map(f => (
                        <span key={f} className="text-xs bg-violet-500/10 text-violet-600 dark:text-violet-400 px-2 py-0.5 rounded-full font-medium">
                          {PREMIUM_FEATURE_META[f].emoji} {PREMIUM_FEATURE_META[f].label}
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
                      <span className="text-xs text-muted-foreground"> /{PERIODS.find(p => p.id === period)?.shortLabel}</span>
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

              {/* Value comparison note */}
              {selectedCustomFeatures.length >= 4 && customPrice > 0 && (
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-3 flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5" />
                  Tip: The {customPrice >= TIER_PRICES.premium[period] ? 'Premium' : customPrice >= TIER_PRICES.standard[period] ? 'Standard' : 'Light'} tier might be better value with more sessions per feature!
                </p>
              )}
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
                      {CUSTOM_WEEKLY_LIMIT}/wk
                    </td>
                  </tr>
                ))}
                <tr className="bg-muted/20">
                  <td className="p-3 font-medium">Clarify AI Model</td>
                  <td className="text-center p-3 text-xs text-muted-foreground">GPT-4o Mini</td>
                  <td className="text-center p-3 text-xs text-muted-foreground">GPT-4o Mini</td>
                  <td className="text-center p-3 text-xs font-semibold text-amber-600 dark:text-amber-400">GPT-5.2</td>
                  <td className="text-center p-3 text-xs text-muted-foreground">GPT-4o Mini</td>
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
              Yes! Every new account gets a 3-day free trial with limited premium access (3 drafts, 2 oral exams, 2 Devil&apos;s Advocate). No card required.
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
              If you only need specific premium features (e.g., just Legal Research and Oral Exams), you can build a custom package instead of paying for a full tier. Each feature gets {CUSTOM_WEEKLY_LIMIT} sessions per week, and basic features are always included.
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
