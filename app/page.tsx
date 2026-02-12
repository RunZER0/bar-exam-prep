'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  FileText,
  BookOpen,
  ClipboardCheck,
  Lightbulb,
  Search,
  Star,
  Award,
  ArrowRight,
  CheckCircle,
} from 'lucide-react';

const FEATURES = [
  {
    icon: FileText,
    title: 'Legal Drafting',
    desc: 'Draft affidavits, pleadings, contracts and 40+ document types with intelligent assistance.',
  },
  {
    icon: BookOpen,
    title: 'All 9 ATP Units',
    desc: 'From Civil Litigation to Commercial Transactions - complete coverage of the KSL curriculum.',
  },
  {
    icon: ClipboardCheck,
    title: 'Exam Simulations',
    desc: 'Take timed CLE-style exams with intelligent grading and detailed feedback.',
  },
  {
    icon: Lightbulb,
    title: 'Quizzes & Practice',
    desc: 'Reinforce your knowledge with quick quizzes and speed challenges across all units.',
  },
  {
    icon: Search,
    title: 'Legal Research',
    desc: 'Research Kenyan statutes, case law and legal principles with smart search tools.',
  },
  {
    icon: Award,
    title: 'Track Progress',
    desc: 'Monitor your preparation with streaks, weekly reports and performance analytics.',
  },
];

const TESTIMONIALS = [
  {
    name: 'Wanjiku Mwangi',
    role: 'KSL (26/27)',
    content: 'This platform is exactly what I needed. The interface is so clean and the study materials are well organized. A game changer for my bar prep!',
    rating: 5,
  },
  {
    name: 'Brian Ochieng',
    role: 'KSL (26/27)',
    content: 'The exam simulations feel just like the real thing and the instant feedback helps me understand where I need to improve.',
    rating: 5,
  },
  {
    name: 'Amina Hassan',
    role: 'KSL (26/27)',
    content: 'Finally a platform built specifically for Kenyan law students. The drafting module has been incredibly helpful.',
    rating: 5,
  },
  {
    name: 'Kevin Mutua',
    role: 'KSL (26/27)',
    content: 'The quiz feature is addictive in the best way. I find myself studying more because the platform makes it engaging.',
    rating: 5,
  },
];

const UNITS = [
  'Civil Litigation',
  'Criminal Litigation',
  'Probate & Administration',
  'Legal Writing',
  'Trial Advocacy',
  'Professional Ethics',
  'Practice Management',
  'Conveyancing',
  'Commercial Transactions',
];

export default function Home() {
  const router = useRouter();
  const { user, loading, signInWithGoogle, signInWithEmail, signUpWithEmail } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setAuthLoading(true);
    try {
      if (isSignUp) {
        await signUpWithEmail(email, password);
      } else {
        await signInWithEmail(email, password);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setAuthLoading(true);
    try {
      await signInWithGoogle();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setAuthLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#0a0a0b]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-zinc-500">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#0a0a0b] text-zinc-100">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 bg-[#0a0a0b]/80 backdrop-blur-xl border-b border-zinc-800/50">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Image
              src="/favicon-32x32.png"
              alt="Ynai Logo"
              width={36}
              height={36}
              className="shrink-0"
              priority
            />
            <span className="font-bold text-2xl tracking-tight">Ynai</span>
          </div>
          <div className="flex items-center gap-6">
            <span className="text-sm text-zinc-500 hidden md:block">
              Kenya Bar Exam Preparation
            </span>
            <a href="/about" className="text-sm text-zinc-400 hover:text-emerald-400 transition-colors hidden sm:block">About Us</a>
            <a href="/pricing" className="text-sm text-zinc-400 hover:text-emerald-400 transition-colors hidden sm:block">Pricing</a>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden">
        {/* Gradient orbs */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-emerald-600/5 rounded-full blur-3xl" />
        </div>

        <div className="max-w-6xl mx-auto px-4 pt-16 pb-20 md:pt-24 md:pb-28 relative">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
            {/* Left - copy */}
            <div className="space-y-8">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                <Image
                  src="/favicon-32x32.png"
                  alt="Ynai Logo"
                  width={16}
                  height={16}
                  className="shrink-0"
                />
                <span className="text-sm font-medium text-emerald-400">For Kenya School of Law Students</span>
              </div>
              
              <div>
                <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold leading-[1.1] tracking-tight">
                  <span className="text-emerald-400">Ynai</span>
                </h1>
                <p className="text-xl md:text-2xl text-zinc-400 mt-4 max-w-lg">
                  Your path to passing the Kenya Bar Exam starts here.
                </p>
              </div>
              
              <p className="text-zinc-500 leading-relaxed max-w-lg">
                The complete preparation platform for Kenyan law students. Study all 9 ATP units, practice with exam simulations, draft legal documents and track your progress.
              </p>

              {/* ATP Units pills */}
              <div className="flex flex-wrap gap-2">
                {UNITS.map((unit) => (
                  <span
                    key={unit}
                    className="px-3 py-1.5 text-xs font-medium bg-zinc-800/50 border border-zinc-700/50 rounded-full text-zinc-400"
                  >
                    {unit}
                  </span>
                ))}
              </div>
            </div>

            {/* Right - auth card */}
            <div className="lg:max-w-md lg:ml-auto w-full">
              <div className="bg-zinc-900/50 backdrop-blur-xl rounded-2xl p-6 md:p-8 border border-zinc-800/50">
                <div className="text-center mb-6">
                  <h2 className="text-xl font-semibold text-zinc-100">
                    {isSignUp ? 'Create your account' : 'Welcome back'}
                  </h2>
                  <p className="text-sm text-zinc-500 mt-1">
                    {isSignUp
                      ? 'Join and start your bar exam preparation'
                      : 'Sign in to continue your preparation'}
                  </p>
                </div>

                <div className="space-y-4">
                  <Button
                    variant="outline"
                    className="w-full h-12 bg-zinc-800/50 border-zinc-700/50 hover:bg-zinc-800 hover:border-zinc-600 text-zinc-200"
                    onClick={handleGoogleSignIn}
                    disabled={authLoading}
                  >
                    <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                    </svg>
                    Continue with Google
                  </Button>

                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t border-zinc-800" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-zinc-900/50 px-3 text-zinc-600">or</span>
                    </div>
                  </div>

                  <form onSubmit={handleEmailAuth} className="space-y-3">
                    <Input
                      type="email"
                      placeholder="Email address"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="h-12 bg-zinc-800/50 border-zinc-700/50 focus:border-emerald-500/50 text-zinc-100 placeholder:text-zinc-600"
                    />
                    <Input
                      type="password"
                      placeholder="Password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="h-12 bg-zinc-800/50 border-zinc-700/50 focus:border-emerald-500/50 text-zinc-100 placeholder:text-zinc-600"
                    />
                    {error && <p className="text-sm text-red-400">{error}</p>}
                    <Button type="submit" className="w-full h-12 bg-emerald-600 hover:bg-emerald-500 text-white" disabled={authLoading}>
                      {authLoading ? (
                        <div className="h-4 w-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                      ) : isSignUp ? (
                        'Create Account'
                      ) : (
                        'Sign In'
                      )}
                    </Button>
                  </form>

                  <p className="text-center text-sm text-zinc-500">
                    <button
                      onClick={() => {
                        setIsSignUp(!isSignUp);
                        setError('');
                      }}
                      className="text-emerald-400 hover:text-emerald-300 font-medium"
                    >
                      {isSignUp
                        ? 'Already have an account? Sign in'
                        : "Don't have an account? Sign up"}
                    </button>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="border-t border-zinc-800/50 bg-zinc-900/30">
        <div className="max-w-6xl mx-auto px-4 py-20 md:py-24">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold text-zinc-100">
              Everything you need to succeed
            </h2>
            <p className="text-zinc-500 mt-3 max-w-xl mx-auto">
              Designed specifically for Kenya School of Law students preparing for the Advocates Training Programme examinations.
            </p>
          </div>
          
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map((f) => {
              const Icon = f.icon;
              return (
                <div 
                  key={f.title} 
                  className="group p-6 rounded-2xl bg-zinc-800/30 border border-zinc-800/50 hover:border-zinc-700/50 hover:bg-zinc-800/50 transition-all duration-300"
                >
                  <div className="p-3 rounded-xl bg-emerald-500/10 w-fit mb-4 border border-emerald-500/20">
                    <Icon className="h-5 w-5 text-emerald-400" />
                  </div>
                  <h3 className="font-semibold text-zinc-100 mb-2">{f.title}</h3>
                  <p className="text-sm text-zinc-500 leading-relaxed">{f.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="border-t border-zinc-800/50">
        <div className="max-w-6xl mx-auto px-4 py-20 md:py-24">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold text-zinc-100">
              What students are saying
            </h2>
            <p className="text-zinc-500 mt-3">
              Hear from KSL students who are using Ynai for their preparation.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-5">
            {TESTIMONIALS.map((t, i) => (
              <div 
                key={i} 
                className="p-6 rounded-2xl bg-zinc-800/30 border border-zinc-800/50"
              >
                <div className="flex gap-1 mb-4">
                  {[...Array(t.rating)].map((_, j) => (
                    <Star key={j} className="h-4 w-4 fill-amber-400 text-amber-400" />
                  ))}
                </div>
                <p className="text-zinc-400 leading-relaxed mb-4">{t.content}</p>
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                    <span className="text-sm font-semibold text-emerald-400">
                      {t.name.split(' ').map(n => n[0]).join('')}
                    </span>
                  </div>
                  <div>
                    <p className="font-medium text-zinc-200 text-sm">{t.name}</p>
                    <p className="text-xs text-zinc-500">{t.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-zinc-800/50 bg-zinc-900/30">
        <div className="max-w-3xl mx-auto px-4 py-20 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-zinc-100 mb-4">
            Ready to start your preparation?
          </h2>
          <p className="text-zinc-500 mb-8 max-w-lg mx-auto">
            Join other KSL students who are using Ynai to prepare for the bar examination. Create your free account today.
          </p>
          <Button 
            size="lg" 
            className="px-8 h-12 bg-emerald-600 hover:bg-emerald-500 text-white gap-2"
            onClick={() => {
              setIsSignUp(true);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          >
            Get Started Free
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-800/50 bg-[#0a0a0b]">
        <div className="max-w-6xl mx-auto px-4 py-12">
          {/* Top section - 5 columns */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-8 pb-10 border-b border-zinc-800/50">
            {/* Brand */}
            <div className="col-span-2">
              <div className="flex items-center gap-3 mb-4">
                <Image
                  src="/favicon-32x32.png"
                  alt="Ynai Logo"
                  width={32}
                  height={32}
                  className="shrink-0"
                />
                <span className="font-bold text-xl">Ynai</span>
              </div>
              <p className="text-sm text-zinc-500 leading-relaxed">
                Kenya Bar Exam Preparation Platform. Empowering KSL students to excel in their ATP examinations.
              </p>
            </div>

            {/* Platform */}
            <div>
              <h4 className="font-medium text-zinc-200 text-sm mb-4">Platform</h4>
              <ul className="space-y-3 text-sm text-zinc-500">
                <li><a href="#" className="hover:text-zinc-300 transition-colors">Study Materials</a></li>
                <li><a href="#" className="hover:text-zinc-300 transition-colors">Practice Exams</a></li>
                <li><a href="#" className="hover:text-zinc-300 transition-colors">Legal Drafting</a></li>
              </ul>
            </div>

            {/* Resources */}
            <div>
              <h4 className="font-medium text-zinc-200 text-sm mb-4">Resources</h4>
              <ul className="space-y-3 text-sm text-zinc-500">
                <li><a href="/about" className="hover:text-zinc-300 transition-colors">About Us</a></li>
                <li><a href="/pricing" className="hover:text-zinc-300 transition-colors">Pricing</a></li>
                <li><a href="#" className="hover:text-zinc-300 transition-colors">Contact</a></li>
              </ul>
            </div>

            {/* Legal */}
            <div>
              <h4 className="font-medium text-zinc-200 text-sm mb-4">Legal</h4>
              <ul className="space-y-3 text-sm text-zinc-500">
                <li><a href="/privacy" className="hover:text-zinc-300 transition-colors">Privacy Policy</a></li>
                <li><a href="/terms" className="hover:text-zinc-300 transition-colors">Terms of Service</a></li>
                <li><a href="/disclaimer" className="hover:text-zinc-300 transition-colors">Disclaimer</a></li>
              </ul>
            </div>
          </div>

          {/* Bottom section */}
          <div className="pt-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <p className="text-sm text-zinc-600">
              © 2026 Ynai. All rights reserved.
            </p>
            <p className="text-sm text-zinc-600">
              Ynai is an independent platform and is not officially affiliated with the Kenya School of Law or Council of Legal Education.
            </p>
          </div>
        </div>
      </footer>
    </main>
  );
}
