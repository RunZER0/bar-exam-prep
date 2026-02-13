'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';
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
  ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

const PLANS = [
  {
    id: 'weekly',
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
    gradient: 'from-gray-500 to-gray-600',
    icon: Zap,
  },
  {
    id: 'monthly',
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
    gradient: 'from-amber-500 to-orange-500',
    savings: '25% cheaper than weekly',
    icon: Crown,
  },
  {
    id: 'annual',
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
    gradient: 'from-green-500 to-emerald-500',
    savings: 'Save over 40% vs weekly',
    icon: Rocket,
  },
];

const PAYMENT_METHODS = [
  { id: 'mpesa', name: 'M-Pesa', description: 'Kenya', popular: true },
  { id: 'card', name: 'Card', description: 'Visa/Mastercard', popular: false },
  { id: 'paypal', name: 'PayPal', description: 'International', popular: false },
];

export default function SubscribePage() {
  const { user } = useAuth();
  const [selectedPlan, setSelectedPlan] = useState('monthly');
  const [selectedPayment, setSelectedPayment] = useState('mpesa');
  const [processing, setProcessing] = useState(false);
  const [step, setStep] = useState<'plan' | 'payment' | 'confirm'>('plan');

  const plan = PLANS.find((p) => p.id === selectedPlan)!;

  const handleSubscribe = async () => {
    setProcessing(true);
    // Simulate processing - in production this would redirect to payment gateway
    setTimeout(() => {
      setProcessing(false);
      setStep('confirm');
    }, 2000);
  };

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20 rounded-full px-4 py-1.5 mb-4">
            <Crown className="h-4 w-4 text-amber-500" />
            <span className="text-sm font-medium text-amber-600 dark:text-amber-400">Upgrade Your Plan</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-2">
            Unlock Your Full Potential
          </h1>
          <p className="text-gray-600 dark:text-gray-400 max-w-xl mx-auto">
            Get unlimited access to AI tutoring, practice exams, and personalized study plans
          </p>
        </div>

        {step === 'plan' && (
          <>
            {/* Plans Grid */}
            <div className="grid md:grid-cols-3 gap-6 mb-8">
              {PLANS.map((p) => {
                const Icon = p.icon;
                const isSelected = selectedPlan === p.id;
                return (
                  <div
                    key={p.id}
                    onClick={() => setSelectedPlan(p.id)}
                    className={`relative cursor-pointer rounded-2xl overflow-hidden transition-all duration-300 ${
                      isSelected 
                        ? 'ring-2 ring-amber-500 shadow-lg shadow-amber-500/20 scale-[1.02]' 
                        : 'ring-1 ring-gray-200 dark:ring-gray-700 hover:ring-gray-300 dark:hover:ring-gray-600'
                    }`}
                  >
                    {/* Popular badge */}
                    {p.popular && (
                      <div className="absolute top-0 left-0 right-0 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs font-semibold text-center py-1">
                        Most Popular
                      </div>
                    )}
                    
                    <div className={`bg-white dark:bg-gray-800 p-6 ${p.popular ? 'pt-9' : ''}`}>
                      {/* Plan icon */}
                      <div className={`inline-flex items-center justify-center h-12 w-12 rounded-xl bg-gradient-to-br ${p.gradient} text-white shadow-lg mb-4`}>
                        <Icon className="h-6 w-6" />
                      </div>

                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">{p.name}</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{p.description}</p>

                      {/* Price */}
                      <div className="flex items-baseline gap-1 mb-4">
                        <span className="text-sm text-gray-500">KES</span>
                        <span className="text-3xl font-bold text-gray-900 dark:text-white">
                          {p.price.toLocaleString()}
                        </span>
                        <span className="text-gray-500">/{p.period}</span>
                      </div>

                      {p.savings && (
                        <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium mb-4">
                          {p.savings}
                        </p>
                      )}

                      {/* Features */}
                      <ul className="space-y-2">
                        {p.features.map((feature, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400">
                            <Check className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                            {feature}
                          </li>
                        ))}
                      </ul>

                      {/* Selection indicator */}
                      {isSelected && (
                        <div className="absolute top-3 right-3">
                          <div className="h-6 w-6 rounded-full bg-amber-500 flex items-center justify-center">
                            <Check className="h-4 w-4 text-white" />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Continue button */}
            <div className="flex justify-center">
              <Button
                onClick={() => setStep('payment')}
                size="lg"
                className="gap-2 px-8 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 shadow-lg shadow-amber-500/25"
              >
                Continue with {plan.name}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </>
        )}

        {step === 'payment' && (
          <div className="max-w-lg mx-auto">
            {/* Order summary */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 mb-6">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Order Summary</h3>
              <div className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-gray-700">
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">{plan.name} Plan</p>
                  <p className="text-sm text-gray-500">Billed {plan.period}ly</p>
                </div>
                <p className="font-semibold text-gray-900 dark:text-white">
                  KES {plan.price.toLocaleString()}
                </p>
              </div>
              <div className="flex items-center justify-between pt-3">
                <p className="font-semibold text-gray-900 dark:text-white">Total</p>
                <p className="font-bold text-lg text-gray-900 dark:text-white">
                  KES {plan.price.toLocaleString()}
                </p>
              </div>
            </div>

            {/* Payment methods */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 mb-6">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Payment Method</h3>
              <div className="space-y-3">
                {PAYMENT_METHODS.map((method) => (
                  <button
                    key={method.id}
                    onClick={() => setSelectedPayment(method.id)}
                    className={`w-full flex items-center justify-between p-4 rounded-xl border-2 transition-all ${
                      selectedPayment === method.id
                        ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/20'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <CreditCard className="h-5 w-5 text-gray-500" />
                      <div className="text-left">
                        <p className="font-medium text-gray-900 dark:text-white">{method.name}</p>
                        <p className="text-xs text-gray-500">{method.description}</p>
                      </div>
                    </div>
                    {selectedPayment === method.id && (
                      <div className="h-5 w-5 rounded-full bg-amber-500 flex items-center justify-center">
                        <Check className="h-3 w-3 text-white" />
                      </div>
                    )}
                    {method.popular && selectedPayment !== method.id && (
                      <span className="text-xs bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 px-2 py-0.5 rounded-full">
                        Popular
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Account info */}
            <div className="bg-muted rounded-xl p-4 border border-border mb-6">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-gray-500 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-300">
                    Subscribing as {user?.email}
                  </p>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                    Your subscription will be activated immediately after payment
                  </p>
                </div>
              </div>
            </div>

            {/* Buttons */}
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setStep('plan')}
                className="flex-1"
              >
                Back
              </Button>
              <Button
                onClick={handleSubscribe}
                disabled={processing}
                className="flex-1 gap-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600"
              >
                {processing ? (
                  <>Processing...</>
                ) : (
                  <>
                    Pay KES {plan.price.toLocaleString()}
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {step === 'confirm' && (
          <div className="max-w-lg mx-auto text-center">
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 border border-gray-200 dark:border-gray-700">
              <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 text-white mb-6">
                <Check className="h-8 w-8" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                You&apos;re All Set!
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Your {plan.name} subscription is now active. Enjoy full access to all premium features.
              </p>
              <div className="bg-muted rounded-xl p-4 mb-6">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Plan</span>
                  <span className="font-medium text-gray-900 dark:text-white">{plan.name}</span>
                </div>
                <div className="flex items-center justify-between text-sm mt-2">
                  <span className="text-gray-500">Amount</span>
                  <span className="font-medium text-gray-900 dark:text-white">KES {plan.price.toLocaleString()}/{plan.period}</span>
                </div>
              </div>
              <Link href="/dashboard">
                <Button className="w-full gap-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600">
                  Go to Dashboard
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        )}

        {/* Benefits section */}
        {step === 'plan' && (
          <div className="mt-16">
            <h2 className="text-xl font-semibold text-center text-gray-900 dark:text-white mb-8">
              Why Upgrade?
            </h2>
            <div className="grid md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="inline-flex items-center justify-center h-12 w-12 rounded-xl bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 mb-4">
                  <Sparkles className="h-6 w-6" />
                </div>
                <h3 className="font-medium text-gray-900 dark:text-white mb-2">AI-Powered Learning</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Get instant explanations tailored to Kenyan law
                </p>
              </div>
              <div className="text-center">
                <div className="inline-flex items-center justify-center h-12 w-12 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 mb-4">
                  <Clock className="h-6 w-6" />
                </div>
                <h3 className="font-medium text-gray-900 dark:text-white mb-2">Study Anytime</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Access materials 24/7 on any device
                </p>
              </div>
              <div className="text-center">
                <div className="inline-flex items-center justify-center h-12 w-12 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 mb-4">
                  <Shield className="h-6 w-6" />
                </div>
                <h3 className="font-medium text-gray-900 dark:text-white mb-2">Cancel Anytime</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  No long-term commitments, pause when you need
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
