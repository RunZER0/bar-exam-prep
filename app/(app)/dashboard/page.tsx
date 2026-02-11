'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  FileText,
  BookOpen,
  ClipboardCheck,
  Lightbulb,
  Search,
  TrendingUp,
  Target,
  Clock,
  Award,
  ArrowRight,
  BarChart3,
} from 'lucide-react';

interface Stats {
  totalQuestionsAttempted: number;
  totalQuestionsCorrect: number;
  overallAccuracy: number;
}

const MODULES = [
  {
    href: '/drafting',
    label: 'Legal Drafting',
    description: 'Draft affidavits, pleadings, contracts and all legal documents with AI guidance.',
    icon: FileText,
    color: 'bg-emerald-500/10 text-emerald-600',
    borderColor: 'hover:border-emerald-500/40',
  },
  {
    href: '/study',
    label: 'Study',
    description: 'Deep dive into ATP units — Civil Litigation, Criminal Law, Conveyancing and more.',
    icon: BookOpen,
    color: 'bg-blue-500/10 text-blue-600',
    borderColor: 'hover:border-blue-500/40',
  },
  {
    href: '/exams',
    label: 'Examinations',
    description: 'Take full CLE-style exams by unit with timed conditions and grading.',
    icon: ClipboardCheck,
    color: 'bg-violet-500/10 text-violet-600',
    borderColor: 'hover:border-violet-500/40',
  },
  {
    href: '/quizzes',
    label: 'Quizzes & Trivia',
    description: 'Quick knowledge checks and fun trivia to reinforce your learning.',
    icon: Lightbulb,
    color: 'bg-amber-500/10 text-amber-600',
    borderColor: 'hover:border-amber-500/40',
  },
  {
    href: '/research',
    label: 'Research',
    description: 'AI-powered legal research with web search across statutes and case law.',
    icon: Search,
    color: 'bg-rose-500/10 text-rose-600',
    borderColor: 'hover:border-rose-500/40',
  },
];

export default function DashboardPage() {
  const { user, getIdToken } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [recentSessions, setRecentSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchProgress() {
      try {
        const token = await getIdToken();
        const res = await fetch('/api/progress', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setStats(data.statistics);
          setRecentSessions(data.sessions || []);
        }
      } catch (err) {
        console.error('Failed to fetch progress:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchProgress();
  }, [getIdToken]);

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">
          {greeting()}, {user?.displayName?.split(' ')[0] || 'Counsel'}
        </h1>
        <p className="text-muted-foreground mt-1">
          Continue your bar exam preparation journey.
        </p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10">
                <Target className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {loading ? '—' : stats?.totalQuestionsAttempted ?? 0}
                </p>
                <p className="text-xs text-muted-foreground">Questions Done</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <TrendingUp className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {loading ? '—' : `${stats?.overallAccuracy ?? 0}%`}
                </p>
                <p className="text-xs text-muted-foreground">Accuracy</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-violet-500/10">
                <Award className="h-5 w-5 text-violet-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {loading ? '—' : stats?.totalQuestionsCorrect ?? 0}
                </p>
                <p className="text-xs text-muted-foreground">Correct</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10">
                <Clock className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {loading ? '—' : recentSessions.length}
                </p>
                <p className="text-xs text-muted-foreground">Sessions</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Module cards */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Start Studying</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {MODULES.map((mod) => {
            const Icon = mod.icon;
            return (
              <Link key={mod.href} href={mod.href}>
                <Card
                  className={`group cursor-pointer border transition-all duration-200 ${mod.borderColor} hover:shadow-md`}
                >
                  <CardHeader className="pb-3">
                    <div className={`p-2.5 rounded-lg w-fit ${mod.color}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <CardTitle className="text-base mt-3 flex items-center justify-between">
                      {mod.label}
                      <ArrowRight className="h-4 w-4 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all text-muted-foreground" />
                    </CardTitle>
                    <CardDescription className="text-sm">
                      {mod.description}
                    </CardDescription>
                  </CardHeader>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Recent activity */}
      {recentSessions.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-4">Recent Activity</h2>
          <Card>
            <CardContent className="pt-5 divide-y">
              {recentSessions.slice(0, 5).map((session: any, i: number) => (
                <div
                  key={session.id || i}
                  className={`flex items-center justify-between py-3 ${i === 0 ? '' : ''}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="p-1.5 rounded bg-muted">
                      <BarChart3 className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-sm font-medium capitalize">
                        {session.competencyType} session
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Score: {session.score ?? '—'}%
                      </p>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {new Date(session.createdAt).toLocaleDateString()}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
