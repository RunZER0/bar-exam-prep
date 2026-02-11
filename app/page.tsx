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
  Shield,
  ChevronRight,
} from 'lucide-react';

const FEATURES = [
  {
    icon: FileText,
    title: 'Legal Drafting',
    desc: 'Draft affidavits, pleadings, contracts and 40+ legal document types with AI guidance.',
    color: 'bg-emerald-500/10 text-emerald-600',
  },
  {
    icon: BookOpen,
    title: 'ATP Study',
    desc: 'Deep dive into all 12 ATP units — from Civil Litigation to ADR.',
    color: 'bg-blue-500/10 text-blue-600',
  },
  {
    icon: ClipboardCheck,
    title: 'CLE-Style Exams',
    desc: 'Timed exams matching actual bar exam format with AI grading.',
    color: 'bg-violet-500/10 text-violet-600',
  },
  {
    icon: Lightbulb,
    title: 'Quizzes & Trivia',
    desc: 'Quick-fire questions and speed challenges to reinforce learning.',
    color: 'bg-amber-500/10 text-amber-600',
  },
  {
    icon: Search,
    title: 'AI Research',
    desc: 'Research Kenyan statutes and case law with AI and web search.',
    color: 'bg-rose-500/10 text-rose-600',
  },
  {
    icon: Shield,
    title: 'Guardrailed AI',
    desc: 'Every response validated for Kenyan law accuracy — no hallucinations.',
    color: 'bg-teal-500/10 text-teal-600',
  },
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
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">Loading…</p>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-green-50/80 via-white to-white">
      {/* Navbar */}
      <nav className="border-b bg-white/80 backdrop-blur sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Scale className="h-6 w-6 text-primary" />
            <span className="font-bold text-lg">Ynai</span>
          </div>
          <span className="text-xs text-muted-foreground hidden sm:block">
            Kenya Bar Exam Preparation Platform
          </span>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-4 pt-16 pb-12 md:pt-24 md:pb-16">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left — copy */}
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium mb-6">
              <Scale className="h-3.5 w-3.5" />
              Kenya Bar Exam Preparation Platform
            </div>
            <h1 className="text-4xl md:text-5xl font-bold leading-tight text-gray-900">
              Master the Bar Exam with{' '}
              <span className="text-primary">AI-Powered</span> Precision
            </h1>
            <p className="text-lg text-muted-foreground mt-4 max-w-lg">
              The complete platform for Kenyan law students. Draft legal documents,
              study all ATP units, take CLE-style exams, and research with
              guardrailed AI — all in one place.
            </p>

            {/* Feature pills */}
            <div className="flex flex-wrap gap-2 mt-6">
              {['44+ Document Types', '12 ATP Units', 'Timed Exams', 'AI Research'].map(
                (pill) => (
                  <span
                    key={pill}
                    className="px-3 py-1 rounded-full bg-muted text-xs font-medium text-muted-foreground"
                  >
                    {pill}
                  </span>
                )
              )}
            </div>
          </div>

          {/* Right — auth card */}
          <div className="lg:max-w-md lg:ml-auto w-full">
            <Card className="shadow-lg border-0 bg-white">
              <CardHeader className="text-center pb-4">
                <CardTitle className="text-xl">
                  {isSignUp ? 'Create Your Account' : 'Welcome Back'}
                </CardTitle>
                <CardDescription>
                  {isSignUp
                    ? 'Join and start preparing for the bar exam'
                    : 'Sign in to continue your preparation'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button
                  variant="outline"
                  className="w-full h-11"
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
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-white px-2 text-muted-foreground">or</span>
                  </div>
                </div>

                <form onSubmit={handleEmailAuth} className="space-y-3">
                  <Input
                    type="email"
                    placeholder="Email address"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="h-11"
                  />
                  <Input
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="h-11"
                  />
                  {error && <p className="text-sm text-destructive">{error}</p>}
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

                <p className="text-center text-sm text-muted-foreground">
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
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Features grid */}
      <section className="max-w-6xl mx-auto px-4 py-16">
        <div className="text-center mb-10">
          <h2 className="text-2xl md:text-3xl font-bold">
            Everything You Need to Pass
          </h2>
          <p className="text-muted-foreground mt-2">
            Built for the Kenyan ATP curriculum, powered by AI, verified for accuracy.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map((f) => {
            const Icon = f.icon;
            return (
              <Card key={f.title} className="border hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className={`p-2.5 rounded-lg w-fit ${f.color}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <CardTitle className="text-base mt-3">{f.title}</CardTitle>
                  <CardDescription className="text-sm">{f.desc}</CardDescription>
                </CardHeader>
              </Card>
            );
          })}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-muted/30">
        <div className="max-w-6xl mx-auto px-4 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm">
            <Scale className="h-4 w-4 text-primary" />
            <span className="font-semibold">Ynai</span>
            <span className="text-muted-foreground">· Kenya Bar Exam Preparation Platform</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Empowering Kenya School of Law students to excel in CLE examinations
          </p>
        </div>
      </footer>
    </main>
  );
}
