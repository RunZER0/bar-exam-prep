'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useTimeTracker } from '@/lib/hooks/useTimeTracker';
import {
  History, FileText, BookOpen, Coffee, MessageCircleQuestion,
  Search, Clock, MessageSquare, Trash2,
  Brain, Award, Calendar, TrendingUp,
  ChevronRight, Loader2, Mic, ClipboardCheck, Target,
  Lightbulb, Users, LayoutDashboard, Navigation,
} from 'lucide-react';

/* ═══════════════════════════════════════
   TYPES
   ═══════════════════════════════════════ */
interface Activity {
  id: string;
  type: 'chat' | 'study' | 'milestone' | 'oral' | 'quiz' | 'challenge' | 'practice' | 'visit';
  title: string;
  category: string;
  date: string;
  meta: Record<string, any>;
}

/* ═══════════════════════════════════════
   SECTION CONFIG — icons + colors
   ═══════════════════════════════════════ */
const TYPE_CONFIG: Record<string, { icon: typeof FileText; color: string; bg: string; label: string }> = {
  mastery:        { icon: Target,                 color: 'text-emerald-600', bg: 'bg-emerald-500/10', label: 'Mastery Hub' },
  dashboard:      { icon: LayoutDashboard,        color: 'text-indigo-600',  bg: 'bg-indigo-500/10',  label: 'Dashboard' },
  progress:       { icon: TrendingUp,             color: 'text-cyan-600',    bg: 'bg-cyan-500/10',    label: 'My Progress' },
  drafting:       { icon: FileText,               color: 'text-blue-600',    bg: 'bg-blue-500/10',    label: 'Legal Drafting' },
  study:          { icon: BookOpen,               color: 'text-purple-600',  bg: 'bg-purple-500/10',  label: 'Study' },
  exams:          { icon: ClipboardCheck,          color: 'text-rose-600',    bg: 'bg-rose-500/10',    label: 'Examinations' },
  'oral-exams':   { icon: Mic,                    color: 'text-orange-600',  bg: 'bg-orange-500/10',  label: 'Oral Exams' },
  quizzes:        { icon: Lightbulb,              color: 'text-amber-600',   bg: 'bg-amber-500/10',   label: 'Quizzes' },
  community:      { icon: Users,                  color: 'text-pink-600',    bg: 'bg-pink-500/10',    label: 'Community' },
  research:       { icon: Search,                 color: 'text-green-600',   bg: 'bg-green-500/10',   label: 'Research' },
  clarify:        { icon: MessageCircleQuestion,   color: 'text-violet-600',  bg: 'bg-violet-500/10',  label: 'Clarification' },
  clarification:  { icon: MessageCircleQuestion,   color: 'text-violet-600',  bg: 'bg-violet-500/10',  label: 'Clarification' },
  banter:         { icon: Coffee,                 color: 'text-amber-600',   bg: 'bg-amber-500/10',   label: 'Legal Banter' },
  oral:           { icon: Mic,                    color: 'text-orange-600',  bg: 'bg-orange-500/10',  label: 'Oral Exam' },
  written:        { icon: FileText,               color: 'text-blue-600',    bg: 'bg-blue-500/10',    label: 'Written' },
  chat:           { icon: MessageSquare,          color: 'text-gray-600',    bg: 'bg-gray-500/10',    label: 'Chat' },
  milestone:      { icon: Award,                  color: 'text-emerald-600', bg: 'bg-emerald-500/10', label: 'Milestone' },
  quiz:           { icon: Lightbulb,              color: 'text-amber-600',   bg: 'bg-amber-500/10',   label: 'Quiz' },
  challenge:      { icon: Users,                  color: 'text-pink-600',    bg: 'bg-pink-500/10',    label: 'Challenge' },
  practice:       { icon: Brain,                  color: 'text-teal-600',    bg: 'bg-teal-500/10',    label: 'Practice' },
  visit:          { icon: Navigation,              color: 'text-sky-600',     bg: 'bg-sky-500/10',     label: 'Page Visit' },
};

const FILTERS = [
  { id: 'all',       label: 'All Activity' },
  { id: 'chat',      label: 'Conversations' },
  { id: 'study',     label: 'Study' },
  { id: 'oral',      label: 'Oral Exams' },
  { id: 'quiz',      label: 'Quizzes' },
  { id: 'challenge', label: 'Challenges' },
  { id: 'practice',  label: 'Practice' },
  { id: 'milestone', label: 'Milestones' },
  { id: 'visit',     label: 'Visits' },
];

/* ═══════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════ */
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  // Display in Nairobi time
  return date.toLocaleDateString('en-KE', { month: 'short', day: 'numeric', year: days > 365 ? 'numeric' : undefined, timeZone: 'Africa/Nairobi' });
}

function formatFullDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-KE', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', timeZone: 'Africa/Nairobi',
  });
}

/** Convert a UTC date to Nairobi time (EAT, UTC+3) date string */
function toNairobiDateKey(dateStr: string): string {
  const d = new Date(dateStr);
  // Shift to EAT (UTC+3) before extracting the date
  const eat = new Date(d.getTime() + 3 * 60 * 60 * 1000);
  return eat.toISOString().split('T')[0];
}

function groupByDate(activities: Activity[]): Record<string, Activity[]> {
  const groups: Record<string, Activity[]> = {};
  for (const a of activities) {
    const key = toNairobiDateKey(a.date);
    if (!groups[key]) groups[key] = [];
    groups[key].push(a);
  }
  return groups;
}

function dateLabel(dateKey: string): string {
  const d = new Date(dateKey + 'T00:00:00');
  // Compare against today in Nairobi time (EAT, UTC+3)
  const nowUtc = new Date();
  const nairobiNow = new Date(nowUtc.getTime() + 3 * 60 * 60 * 1000);
  const todayStr = nairobiNow.toISOString().split('T')[0];
  const todayDate = new Date(todayStr + 'T00:00:00');
  const diff = Math.round((todayDate.getTime() - d.getTime()) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (diff < 7) return d.toLocaleDateString('en-KE', { weekday: 'long' });
  return d.toLocaleDateString('en-KE', { month: 'long', day: 'numeric', year: diff > 365 ? 'numeric' : undefined });
}

/* ═══════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════ */
export default function HistoryPage() {
  const router = useRouter();
  const { getIdToken } = useAuth();
  useTimeTracker('history');
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadHistory = async () => {
    try {
      const token = await getIdToken();
      const headers = { Authorization: `Bearer ${token}` };

      // Fetch real activity data
      const historyRes = await fetch('/api/history', { headers });
      const historyData = historyRes.ok ? await historyRes.json() : { activities: [] };

      const allActivities = (historyData.activities || [])
        .sort((a: Activity, b: Activity) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 200);

      setActivities(allActivities);
    } catch (err) {
      console.error('Failed to load history:', err);
    } finally {
      setLoading(false);
    }
  };

  const deleteChat = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const token = await getIdToken();
      await fetch(`/api/chat/sessions/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      setActivities(prev => prev.filter(a => a.id !== id));
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  const filtered = activities.filter(a => {
    const matchesFilter = filter === 'all' || a.type === filter;
    const matchesSearch = !searchQuery ||
      a.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.category.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const grouped = groupByDate(filtered);
  const dateKeys = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-3.5rem)] bg-background">
        <div className="text-center space-y-3">
          <Loader2 className="h-6 w-6 mx-auto animate-spin text-primary/50" />
          <p className="text-sm text-muted-foreground">Loading your activity...</p>
        </div>
      </div>
    );
  }

  // Summary stats
  const totalCount = activities.length;
  const oralCount = activities.filter(a => a.type === 'oral').length;
  const quizCount = activities.filter(a => a.type === 'quiz').length;
  const visitMinutes = activities.filter(a => a.type === 'visit').reduce((s, a) => s + (a.meta.minutes || 0), 0);

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-background">
      <div className="max-w-4xl mx-auto px-4 md:px-6 py-6 md:py-8 space-y-6">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-primary/10">
              <History className="h-5 w-5 text-primary" />
            </div>
            Your Journey
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Your real study activity — conversations, exams, quizzes, and challenges
          </p>
        </div>

        {/* Quick Stats */}
        {totalCount > 0 && (
          <div className="grid grid-cols-4 gap-3">
            <div className="rounded-xl bg-primary/5 border border-primary/10 p-4 text-center">
              <p className="text-2xl font-bold text-primary">{totalCount}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Activities</p>
            </div>
            <div className="rounded-xl bg-sky-500/5 border border-sky-500/10 p-4 text-center">
              <p className="text-2xl font-bold text-sky-600">{visitMinutes >= 60 ? `${Math.round(visitMinutes / 60)}h` : `${visitMinutes}m`}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Time Tracked</p>
            </div>
            <div className="rounded-xl bg-orange-500/5 border border-orange-500/10 p-4 text-center">
              <p className="text-2xl font-bold text-orange-600">{oralCount}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Oral Exams</p>
            </div>
            <div className="rounded-xl bg-amber-500/5 border border-amber-500/10 p-4 text-center">
              <p className="text-2xl font-bold text-amber-600">{quizCount}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Quizzes</p>
            </div>
          </div>
        )}

        {/* Search + Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search activities..."
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-card/50 border border-border/20 text-sm outline-none focus:ring-1 focus:ring-primary/20 placeholder:text-muted-foreground/50"
            />
          </div>
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
            {FILTERS.map(f => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                  filter === f.id
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-muted/40'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Activity timeline */}
        {dateKeys.length === 0 ? (
          <div className="text-center py-16 space-y-3">
            <History className="h-12 w-12 mx-auto text-muted-foreground/20" />
            <h3 className="text-lg font-medium text-muted-foreground">No activity yet</h3>
            <p className="text-sm text-muted-foreground/70 max-w-sm mx-auto">
              Start studying, take a quiz, or explore any section and your activity will appear here
            </p>
            <div className="flex justify-center gap-2 pt-2">
              <button
                onClick={() => router.push('/study')}
                className="px-4 py-2 rounded-xl bg-primary/10 text-primary text-sm font-medium hover:bg-primary/15 transition-colors"
              >
                Start Studying
              </button>
              <button
                onClick={() => router.push('/drafting')}
                className="px-4 py-2 rounded-xl bg-muted/40 text-foreground text-sm font-medium hover:bg-muted/60 transition-colors"
              >
                Start Drafting
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {dateKeys.map(dateKey => (
              <div key={dateKey}>
                <div className="flex items-center gap-2 mb-2">
                  <Calendar className="h-3.5 w-3.5 text-muted-foreground/50" />
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    {dateLabel(dateKey)}
                  </h3>
                  <div className="flex-1 h-px bg-border/15" />
                  <span className="text-[10px] text-muted-foreground/40">
                    {grouped[dateKey].length} activit{grouped[dateKey].length === 1 ? 'y' : 'ies'}
                  </span>
                </div>

                <div className="space-y-1.5 ml-2 pl-4 border-l-2 border-border/10">
                  {grouped[dateKey].map(activity => {
                    const config = TYPE_CONFIG[activity.category] || TYPE_CONFIG[activity.type] || TYPE_CONFIG.research;
                    const Icon = config.icon;

                    return (
                      <div
                        key={activity.id}
                        onClick={() => {
                          if (activity.type === 'chat') router.push(`/history/${activity.id}`);
                        }}
                        className="group flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors cursor-pointer hover:bg-card/60"
                      >
                        <div className="relative -ml-[25px] mr-1">
                          <div className={`w-2 h-2 rounded-full ${config.bg} ring-2 ring-background`} />
                        </div>

                        <div className={`p-2 rounded-lg ${config.bg} shrink-0`}>
                          <Icon className={`h-4 w-4 ${config.color}`} />
                        </div>

                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{activity.title}</p>
                          <div className="flex items-center gap-3 text-[11px] text-muted-foreground mt-0.5">
                            <span className="capitalize">{config.label}</span>
                            {activity.type === 'chat' && activity.meta.messageCount > 0 && (
                              <span className="flex items-center gap-1">
                                <MessageSquare className="h-2.5 w-2.5" />
                                {activity.meta.messageCount} msgs
                              </span>
                            )}
                            {activity.type === 'study' && activity.meta.minutes > 0 && (
                              <span className="flex items-center gap-1">
                                <Clock className="h-2.5 w-2.5" />
                                {activity.meta.minutes}m
                              </span>
                            )}
                            {activity.type === 'study' && activity.meta.score != null && (
                              <span className="flex items-center gap-1">
                                <TrendingUp className="h-2.5 w-2.5" />
                                {Math.round(Number(activity.meta.score) * 100)}%
                              </span>
                            )}
                            {activity.type === 'milestone' && (
                              <span className="flex items-center gap-1">
                                <Award className="h-2.5 w-2.5" />
                                {activity.meta.phase}
                              </span>
                            )}
                            {activity.type === 'oral' && (
                              <>
                                {activity.meta.unitName && <span>{activity.meta.unitName}</span>}
                                {activity.meta.duration > 0 && (
                                  <span className="flex items-center gap-1">
                                    <Clock className="h-2.5 w-2.5" />
                                    {Math.round(activity.meta.duration / 60)}m
                                  </span>
                                )}
                                {activity.meta.score != null && (
                                  <span className="flex items-center gap-1">
                                    <TrendingUp className="h-2.5 w-2.5" />
                                    {activity.meta.score}/20
                                  </span>
                                )}
                              </>
                            )}
                            {activity.type === 'quiz' && (
                              <>
                                <span>{activity.meta.correctCount}/{activity.meta.questionCount} correct</span>
                                {activity.meta.unitName && <span>{activity.meta.unitName}</span>}
                              </>
                            )}
                            {activity.type === 'challenge' && (
                              <>
                                {activity.meta.score != null && activity.meta.score > 0 && (
                                  <span className="flex items-center gap-1">
                                    <TrendingUp className="h-2.5 w-2.5" />
                                    {activity.meta.score} pts
                                  </span>
                                )}
                                {activity.meta.questionsAnswered > 0 && (
                                  <span>{activity.meta.correctAnswers}/{activity.meta.questionsAnswered} correct</span>
                                )}
                              </>
                            )}
                            {activity.type === 'practice' && (
                              <>
                                <span>{activity.meta.completedQuestions}/{activity.meta.totalQuestions} done</span>
                                {activity.meta.score != null && (
                                  <span className="flex items-center gap-1">
                                    <TrendingUp className="h-2.5 w-2.5" />
                                    {activity.meta.score}%
                                  </span>
                                )}
                              </>
                            )}
                            {activity.type === 'visit' && activity.meta.minutes > 0 && (
                              <span className="flex items-center gap-1">
                                <Clock className="h-2.5 w-2.5" />
                                {activity.meta.minutes}m spent
                              </span>
                            )}
                            <span>{formatDate(activity.date)}</span>
                          </div>
                        </div>

                        {activity.type === 'chat' && (
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={(e) => deleteChat(activity.id, e)}
                              className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                              title="Delete"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/30" />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}


