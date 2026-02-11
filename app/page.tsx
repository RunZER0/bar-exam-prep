'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Scale,
  FileText,
  BookOpen,
  ClipboardCheck,
  Lightbulb,
  Search,
  Star,
  CheckCircle2,
  Users,
  Award,
  Quote,
} from 'lucide-react';

const FEATURES = [
  {
    icon: FileText,
    title: 'Legal Drafting',
    desc: 'Draft affidavits, pleadings, contracts and 40+ document types with intelligent assistance.',
  },
  {
    icon: BookOpen,
    title: 'Comprehensive ATP Coverage',
    desc: 'Study all 9 ATP units from Civil Litigation to Professional Ethics with structured lessons.',
  },
  {
    icon: ClipboardCheck,
    title: 'Exam Simulations',
    desc: 'Take timed CLE-style exams with automatic intelligent grading and detailed feedback.',
  },
  {
    icon: Lightbulb,
    title: 'Quizzes and Practice',
    desc: 'Reinforce your knowledge with quick quizzes and speed challenges across all units.',
  },
  {
    icon: Search,
    title: 'Legal Research',
    desc: 'Research Kenyan statutes, case law and legal principles with smart search tools.',
  },
  {
    icon: Award,
    title: 'Track Your Progress',
    desc: 'Monitor your preparation with streaks, weekly reports and performance analytics.',
  },
];

const TESTIMONIALS = [
  {
    name: 'Wanjiku Mwangi',
    role: 'KSL Student, Year 1',
    content: 'This platform is exactly what I needed. The interface is so clean and the study materials are well organized. Definitely a game changer for my bar prep!',
    rating: 5,
  },
  {
    name: 'Brian Ochieng',
    role: 'KSL Student, Year 2',
    content: 'I love how easy it is to use. The exam simulations feel just like the real thing and the instant feedback helps me understand where I need to improve.',
    rating: 5,
  },
  {
    name: 'Amina Hassan',
    role: 'KSL Student, Year 1',
    content: 'Finally a platform built specifically for Kenyan law students. The drafting module has been incredibly helpful for my practical skills.',
    rating: 5,
  },
  {
    name: 'Kevin Mutua',
    role: 'KSL Student, Year 2',
    content: 'The quiz feature is addictive in the best way possible. I find myself studying more because the platform makes it engaging and fun.',
    rating: 5,
  },
];

const STATS = [
  { value: '9', label: 'ATP Units Covered' },
  { value: '40+', label: 'Document Templates' },
  { value: '1000+', label: 'Practice Questions' },
  { value: '24/7', label: 'Study Access' },
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
      <div className="flex items-center justify-center min-h-screen bg-stone-50">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-stone-500">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-stone-50">
      {/* Navbar */}
      <nav className="sticky top-0 z-30 bg-stone-50/90 backdrop-blur-md border-b border-stone-200/60">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-primary/10 rounded-lg">
              <Scale className="h-5 w-5 text-primary" />
            </div>
            <span className="font-semibold text-lg text-stone-800">Ynai</span>
          </div>
          <span className="text-sm text-stone-500 hidden sm:block">
            Kenya Bar Exam Preparation
          </span>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-4 pt-12 pb-16 md:pt-20 md:pb-24">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left - copy */}
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/8 border border-primary/15">
              <Scale className="h-3.5 w-3.5 text-primary" />
              <span className="text-xs font-medium text-primary">For Kenya School of Law Students</span>
            </div>
            
            <h1 className="text-4xl md:text-5xl lg:text-[3.25rem] font-bold leading-[1.15] text-stone-900">
              Your path to passing the Bar Exam starts here
            </h1>
            
            <p className="text-lg text-stone-600 leading-relaxed max-w-xl">
              The complete preparation platform for Kenyan law students. Study all ATP units, practice with exam simulations, draft legal documents and track your progress - all in one place.
            </p>

            {/* Stats row */}
            <div className="flex flex-wrap gap-6 pt-2">
              {STATS.map((stat) => (
                <div key={stat.label} className="text-center">
                  <p className="text-2xl font-bold text-stone-800">{stat.value}</p>
                  <p className="text-xs text-stone-500">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Right - auth card */}
          <div className="lg:max-w-md lg:ml-auto w-full">
            <div className="bg-white rounded-2xl p-6 md:p-8 shadow-sm border border-stone-200/60">
              <div className="text-center mb-6">
                <h2 className="text-xl font-semibold text-stone-800">
                  {isSignUp ? 'Create your account' : 'Welcome back'}
                </h2>
                <p className="text-sm text-stone-500 mt-1">
                  {isSignUp
                    ? 'Join and start your bar exam preparation'
                    : 'Sign in to continue your preparation'}
                </p>
              </div>

              <div className="space-y-4">
                <Button
                  variant="outline"
                  className="w-full h-11 bg-white border-stone-200 hover:bg-stone-50 text-stone-700"
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
                    <span className="w-full border-t border-stone-200" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-white px-3 text-stone-400">or</span>
                  </div>
                </div>

                <form onSubmit={handleEmailAuth} className="space-y-3">
                  <Input
                    type="email"
                    placeholder="Email address"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="h-11 bg-stone-50/50 border-stone-200 focus:border-primary"
                  />
                  <Input
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="h-11 bg-stone-50/50 border-stone-200 focus:border-primary"
                  />
                  {error && <p className="text-sm text-red-600">{error}</p>}
                  <Button type="submit" className="w-full h-11" disabled={authLoading}>
                    {authLoading ? (
                      <div className="h-4 w-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    ) : isSignUp ? (
                      'Create Account'
                    ) : (
                      'Sign In'
                    )}
                  </Button>
                </form>

                <p className="text-center text-sm text-stone-500">
                  <button
                    onClick={() => {
                      setIsSignUp(!isSignUp);
                      setError('');
                    }}
                    className="text-primary hover:underline font-medium"
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
      </section>

      {/* Features */}
      <section className="bg-white border-y border-stone-200/60">
        <div className="max-w-6xl mx-auto px-4 py-16 md:py-20">
          <div className="text-center mb-12">
            <h2 className="text-2xl md:text-3xl font-bold text-stone-800">
              Everything you need to succeed
            </h2>
            <p className="text-stone-500 mt-2 max-w-xl mx-auto">
              Designed specifically for Kenya School of Law students preparing for the Advocates Training Programme examinations.
            </p>
          </div>
          
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((f) => {
              const Icon = f.icon;
              return (
                <div 
                  key={f.title} 
                  className="group p-6 rounded-xl bg-stone-50/50 border border-stone-100 hover:border-stone-200 hover:bg-stone-50 transition-all duration-200"
                >
                  <div className="p-2.5 rounded-lg bg-primary/8 w-fit mb-4">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="font-semibold text-stone-800 mb-2">{f.title}</h3>
                  <p className="text-sm text-stone-500 leading-relaxed">{f.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="max-w-6xl mx-auto px-4 py-16 md:py-20">
        <div className="text-center mb-12">
          <h2 className="text-2xl md:text-3xl font-bold text-stone-800">
            What students are saying
          </h2>
          <p className="text-stone-500 mt-2">
            Hear from KSL students who are using Ynai for their preparation.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-6">
          {TESTIMONIALS.map((t, i) => (
            <div 
              key={i} 
              className="p-6 rounded-xl bg-white border border-stone-200/60"
            >
              <div className="flex gap-1 mb-4">
                {[...Array(t.rating)].map((_, j) => (
                  <Star key={j} className="h-4 w-4 fill-amber-400 text-amber-400" />
                ))}
              </div>
              <p className="text-stone-600 leading-relaxed mb-4">{t.content}</p>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-sm font-semibold text-primary">
                    {t.name.split(' ').map(n => n[0]).join('')}
                  </span>
                </div>
                <div>
                  <p className="font-medium text-stone-800 text-sm">{t.name}</p>
                  <p className="text-xs text-stone-500">{t.role}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="bg-stone-100/50 border-y border-stone-200/60">
        <div className="max-w-3xl mx-auto px-4 py-16 text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-stone-800 mb-4">
            Ready to start your preparation?
          </h2>
          <p className="text-stone-500 mb-6 max-w-lg mx-auto">
            Join other KSL students who are using Ynai to prepare for the bar examination. Create your free account today.
          </p>
          <Button 
            size="lg" 
            className="px-8"
            onClick={() => {
              setIsSignUp(true);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          >
            Get Started Free
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-stone-50 border-t border-stone-200/60">
        <div className="max-w-6xl mx-auto px-4 py-10">
          {/* Top section */}
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-8 pb-8 border-b border-stone-200/60">
            <div className="max-w-sm">
              <div className="flex items-center gap-2.5 mb-3">
                <div className="p-1.5 bg-primary/10 rounded-lg">
                  <Scale className="h-5 w-5 text-primary" />
                </div>
                <span className="font-semibold text-lg text-stone-800">Ynai</span>
              </div>
              <p className="text-sm text-stone-500 leading-relaxed">
                Kenya Bar Exam Preparation Platform. Empowering Kenya School of Law students to excel in their Advocates Training Programme examinations.
              </p>
            </div>

            <div className="flex gap-12">
              <div>
                <h4 className="font-medium text-stone-800 text-sm mb-3">Platform</h4>
                <ul className="space-y-2 text-sm text-stone-500">
                  <li><a href="#" className="hover:text-stone-700">Study Materials</a></li>
                  <li><a href="#" className="hover:text-stone-700">Practice Exams</a></li>
                  <li><a href="#" className="hover:text-stone-700">Legal Drafting</a></li>
                  <li><a href="#" className="hover:text-stone-700">Progress Tracking</a></li>
                </ul>
              </div>
              <div>
                <h4 className="font-medium text-stone-800 text-sm mb-3">Legal</h4>
                <ul className="space-y-2 text-sm text-stone-500">
                  <li><a href="/privacy" className="hover:text-stone-700">Privacy Policy</a></li>
                  <li><a href="/terms" className="hover:text-stone-700">Terms of Service</a></li>
                  <li><a href="/disclaimer" className="hover:text-stone-700">Disclaimer</a></li>
                </ul>
              </div>
            </div>
          </div>

          {/* Bottom section */}
          <div className="pt-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <p className="text-xs text-stone-400">
              © 2026 Ynai. All rights reserved.
            </p>
            <p className="text-xs text-stone-400">
              Ynai is an independent platform and is not officially affiliated with the Kenya School of Law or Council of Legal Education.
            </p>
          </div>
        </div>
      </footer>
    </main>
  );
}
