'use client';

import Link from 'next/link';
import { Scale, ArrowLeft, Check, Sparkles, Shield, Clock, Zap } from 'lucide-react';

const PLANS = [
  {
    name: 'Weekly',
    price: 500,
    period: 'week',
    description: 'Perfect for trying things out',
    features: [
      'Full access to study materials',
      'AI tutoring & explanations',
      'Practice questions & quizzes',
      'Progress tracking',
      'Legal drafting practice',
    ],
    popular: false,
    savings: null,
  },
  {
    name: 'Monthly',
    price: 1500,
    period: 'month',
    description: 'Most popular choice for focused prep',
    features: [
      'Everything in Weekly',
      'Priority AI responses',
      'Detailed analytics',
      'Exam simulations',
      'Chat history access',
    ],
    popular: true,
    savings: '25% cheaper than weekly',
  },
  {
    name: 'Annual',
    price: 15000,
    period: 'year',
    description: 'Best value for serious preparation',
    features: [
      'Everything in Monthly',
      'Exclusive study guides',
      'Early access to new features',
      'Priority support',
      'Community access',
    ],
    popular: false,
    savings: 'Save over 40% vs weekly',
  },
];

const BENEFITS = [
  {
    icon: Zap,
    title: 'AI-Powered Learning',
    description: 'Get instant explanations tailored to Kenyan law',
  },
  {
    icon: Clock,
    title: 'Study Anytime',
    description: 'Access materials 24/7 on any device',
  },
  {
    icon: Shield,
    title: 'Cancel Anytime',
    description: 'No long-term commitments, pause when you need',
  },
];

export default function PricingPage() {
  const handleSelectPlan = (planName: string) => {
    // Redirect to home page where they can login/signup
    // After auth, they can complete payment
    window.location.href = '/?plan=' + planName.toLowerCase();
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center gap-4">
          <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <div className="p-2 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
              <Scale className="h-5 w-5 text-emerald-500" />
            </div>
            <span className="font-bold text-lg">Ynai</span>
          </Link>
          <div className="flex-1" />
          <Link 
            href="/" 
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <section className="max-w-6xl mx-auto px-6 py-16 text-center">
        <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-4 py-1.5 mb-6">
          <Sparkles className="h-4 w-4 text-emerald-500" />
          <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">Simple, transparent pricing</span>
        </div>
        <h1 className="text-4xl font-bold mb-4">
          Invest in Your <span className="text-emerald-500">Legal Career</span>
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Choose the plan that fits your preparation timeline. All plans include full platform access.
        </p>
      </section>

      {/* Pricing Cards */}
      <section className="max-w-6xl mx-auto px-6 pb-16">
        <div className="grid md:grid-cols-3 gap-6">
          {PLANS.map((plan, index) => (
            <div
              key={index}
              className={`relative bg-card border rounded-2xl p-6 flex flex-col ${
                plan.popular 
                  ? 'border-emerald-500 ring-2 ring-emerald-500/20 scale-105' 
                  : 'border-border/50'
              }`}
            >
              {/* Popular Badge */}
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="bg-emerald-500 text-white text-xs font-semibold px-3 py-1 rounded-full">
                    Most Popular
                  </span>
                </div>
              )}

              {/* Plan Header */}
              <div className="text-center mb-6">
                <h3 className="text-lg font-semibold mb-2">{plan.name}</h3>
                <div className="flex items-baseline justify-center gap-1">
                  <span className="text-sm text-muted-foreground">KES</span>
                  <span className="text-4xl font-bold">{plan.price.toLocaleString()}</span>
                  <span className="text-muted-foreground">/{plan.period}</span>
                </div>
                <p className="text-sm text-muted-foreground mt-2">{plan.description}</p>
                {plan.savings && (
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium mt-2">
                    {plan.savings}
                  </p>
                )}
              </div>

              {/* Features */}
              <ul className="space-y-3 mb-6 flex-1">
                {plan.features.map((feature, featureIndex) => (
                  <li key={featureIndex} className="flex items-start gap-3">
                    <Check className="h-5 w-5 text-emerald-500 shrink-0" />
                    <span className="text-sm text-muted-foreground">{feature}</span>
                  </li>
                ))}
              </ul>

              {/* CTA Button */}
              <button
                onClick={() => handleSelectPlan(plan.name)}
                className={`w-full py-3 px-4 rounded-xl font-medium transition-colors ${
                  plan.popular
                    ? 'bg-emerald-500 hover:bg-emerald-600 text-white'
                    : 'bg-muted hover:bg-muted/80 text-foreground'
                }`}
              >
                Get Started
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Benefits Section */}
      <section className="bg-muted/30 border-y border-border/50">
        <div className="max-w-6xl mx-auto px-6 py-16">
          <h2 className="text-2xl font-bold text-center mb-12">All Plans Include</h2>
          <div className="grid sm:grid-cols-3 gap-8">
            {BENEFITS.map((benefit, index) => (
              <div key={index} className="text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 bg-emerald-500/10 rounded-xl mb-4">
                  <benefit.icon className="h-6 w-6 text-emerald-500" />
                </div>
                <h3 className="font-semibold mb-2">{benefit.title}</h3>
                <p className="text-sm text-muted-foreground">{benefit.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="max-w-4xl mx-auto px-6 py-16">
        <h2 className="text-2xl font-bold text-center mb-8">Pricing FAQ</h2>
        <div className="space-y-6">
          <div>
            <h3 className="font-semibold mb-2">Can I switch plans?</h3>
            <p className="text-muted-foreground text-sm">
              Yes! You can upgrade or downgrade your plan at any time. Changes take effect at the start of your next billing period.
            </p>
          </div>
          <div>
            <h3 className="font-semibold mb-2">What payment methods do you accept?</h3>
            <p className="text-muted-foreground text-sm">
              We accept M-Pesa, Airtel Money, credit/debit cards, and bank transfers. All payments are secure and encrypted.
            </p>
          </div>
          <div>
            <h3 className="font-semibold mb-2">Is there a free trial?</h3>
            <p className="text-muted-foreground text-sm">
              New users get limited access to explore the platform. Subscribe to unlock full features including AI tutoring and all study materials.
            </p>
          </div>
          <div>
            <h3 className="font-semibold mb-2">What's your refund policy?</h3>
            <p className="text-muted-foreground text-sm">
              If you're not satisfied within the first 7 days, contact us for a full refund – no questions asked.
            </p>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="max-w-4xl mx-auto px-6 py-16 text-center">
        <h2 className="text-2xl font-bold mb-4">Ready to Start Preparing?</h2>
        <p className="text-muted-foreground mb-8">
          Join thousands of KSL students already using Ynai to prepare for the bar exam.
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
