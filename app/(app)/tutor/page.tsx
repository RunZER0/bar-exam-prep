'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  BookOpen, Brain, Calendar, CheckCircle2, ChevronRight, Clock,
  Flame, GraduationCap, Lightbulb, Play, RefreshCw, Scale, Sparkles,
  Target, Timer, TrendingUp, Trophy, Zap, BookMarked, FileText,
  HelpCircle, BarChart3, ArrowRight, Star, Award
} from 'lucide-react';
import Link from 'next/link';

// Types
interface StudyItem {
  id: string;
  type: 'reading' | 'case_study' | 'practice_questions' | 'quiz' | 'review' | 'drafting' | 'research';
  title: string;
  description: string;
  unitName: string;
  estimatedMinutes: number;
  priority: 1 | 2 | 3;
  status: 'pending' | 'in_progress' | 'completed';
  caseReference?: string;
  rationale: string;
}

interface TodayStats {
  itemsCompleted: number;
  itemsTotal: number;
  minutesStudied: number;
  minutesGoal: number;
  reviewsDue: number;
  streakDays: number;
}

interface CaseRecommendation {
  name: string;
  citation: string;
  topic: string;
  unitName: string;
  rationale: string;
}

// Mock data - will be replaced with API calls
const MOCK_TODAY_ITEMS: StudyItem[] = [
  {
    id: '1',
    type: 'review',
    title: 'Daily Spaced Repetition Review',
    description: 'Review your due cards from all subjects. 12 cards due today.',
    unitName: 'All Areas',
    estimatedMinutes: 15,
    priority: 1,
    status: 'pending',
    rationale: 'Spaced repetition ensures you don\'t forget what you\'ve learned.',
  },
  {
    id: '2',
    type: 'case_study',
    title: 'Anarita Karimi Njeru v Republic',
    description: 'Analyze this landmark constitutional petition case. Focus on the ratio decidendi.',
    unitName: 'Civil Litigation',
    estimatedMinutes: 30,
    priority: 1,
    status: 'pending',
    caseReference: '[1979] KLR 154',
    rationale: 'Foundation case for constitutional petitions - critical for ATP 100.',
  },
  {
    id: '3',
    type: 'reading',
    title: 'Civil Procedure Rules, 2010 - Part III',
    description: 'Study the provisions on interlocutory applications and chambers proceedings.',
    unitName: 'Civil Litigation',
    estimatedMinutes: 25,
    priority: 2,
    status: 'pending',
    rationale: 'Understanding procedure is essential for practice.',
  },
  {
    id: '4',
    type: 'practice_questions',
    title: 'Civil Procedure Practice Questions',
    description: 'Answer 10 practice questions on pleadings and interlocutory applications.',
    unitName: 'Civil Litigation',
    estimatedMinutes: 20,
    priority: 2,
    status: 'pending',
    rationale: 'Active recall strengthens your understanding.',
  },
];

const MOCK_STATS: TodayStats = {
  itemsCompleted: 1,
  itemsTotal: 4,
  minutesStudied: 15,
  minutesGoal: 90,
  reviewsDue: 12,
  streakDays: 7,
};

const MOCK_CASES: CaseRecommendation[] = [
  {
    name: 'Anarita Karimi Njeru v Republic',
    citation: '[1979] KLR 154',
    topic: 'Constitutional Petitions',
    unitName: 'Civil Litigation',
    rationale: 'Establishes the standard for constitutional petition pleadings.',
  },
  {
    name: 'Shah v Mbogo',
    citation: '[1967] EA 116',
    topic: 'Setting Aside Default Judgment',
    unitName: 'Civil Litigation',
    rationale: 'Key case on principles for setting aside ex-parte orders.',
  },
];

const ITEM_ICONS: Record<StudyItem['type'], React.ElementType> = {
  reading: BookOpen,
  case_study: Scale,
  practice_questions: FileText,
  quiz: Brain,
  review: RefreshCw,
  drafting: FileText,
  research: Lightbulb,
};

const ITEM_COLORS: Record<StudyItem['type'], string> = {
  reading: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  case_study: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
  practice_questions: 'bg-green-500/10 text-green-500 border-green-500/20',
  quiz: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
  review: 'bg-pink-500/10 text-pink-500 border-pink-500/20',
  drafting: 'bg-cyan-500/10 text-cyan-500 border-cyan-500/20',
  research: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
};

export default function TutorDashboard() {
  const { user } = useAuth();
  const [todayItems, setTodayItems] = useState<StudyItem[]>(MOCK_TODAY_ITEMS);
  const [stats, setStats] = useState<TodayStats>(MOCK_STATS);
  const [cases, setCases] = useState<CaseRecommendation[]>(MOCK_CASES);
  const [activeItem, setActiveItem] = useState<StudyItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [greeting, setGreeting] = useState('');

  useEffect(() => {
    // Generate time-based greeting
    const hour = new Date().getHours();
    if (hour < 12) setGreeting('Good morning');
    else if (hour < 17) setGreeting('Good afternoon');
    else setGreeting('Good evening');

    // TODO: Fetch actual data from API
    setIsLoading(false);
  }, []);

  const handleStartItem = (item: StudyItem) => {
    setActiveItem(item);
    // Update status
    setTodayItems(prev => prev.map(i => 
      i.id === item.id ? { ...i, status: 'in_progress' } : i
    ));
  };

  const handleCompleteItem = (itemId: string) => {
    setTodayItems(prev => prev.map(i => 
      i.id === itemId ? { ...i, status: 'completed' } : i
    ));
    setStats(prev => ({
      ...prev,
      itemsCompleted: prev.itemsCompleted + 1,
    }));
    setActiveItem(null);
  };

  const progressPercentage = (stats.itemsCompleted / stats.itemsTotal) * 100;
  const timePercentage = (stats.minutesStudied / stats.minutesGoal) * 100;

  const pendingItems = todayItems.filter(i => i.status === 'pending');
  const completedItems = todayItems.filter(i => i.status === 'completed');

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground">Loading your study plan...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20">
      {/* Header with Greeting */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-yellow-500" />
          <span className="text-sm font-medium text-muted-foreground">AI Tutor Mode</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold">
          {greeting}, {user?.displayName?.split(' ')[0] || 'Advocate'}!
        </h1>
        <p className="text-muted-foreground">
          Here&apos;s your personalized study plan for today. Let&apos;s make progress together.
        </p>
      </div>

      {/* Quick Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="bg-gradient-to-br from-orange-500/10 to-orange-500/5 border-orange-500/20">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-orange-500/20 flex items-center justify-center">
                <Flame className="w-5 h-5 text-orange-500" />
              </div>
              <div>
                <div className="text-2xl font-bold">{stats.streakDays}</div>
                <div className="text-xs text-muted-foreground">Day Streak</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-500/10 to-green-500/5 border-green-500/20">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-green-500" />
              </div>
              <div>
                <div className="text-2xl font-bold">{stats.itemsCompleted}/{stats.itemsTotal}</div>
                <div className="text-xs text-muted-foreground">Tasks Done</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 border-blue-500/20">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                <Timer className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <div className="text-2xl font-bold">{stats.minutesStudied}m</div>
                <div className="text-xs text-muted-foreground">/ {stats.minutesGoal}m goal</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-pink-500/10 to-pink-500/5 border-pink-500/20">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-pink-500/20 flex items-center justify-center">
                <RefreshCw className="w-5 h-5 text-pink-500" />
              </div>
              <div>
                <div className="text-2xl font-bold">{stats.reviewsDue}</div>
                <div className="text-xs text-muted-foreground">Reviews Due</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Progress Bar */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Today&apos;s Progress</span>
            <span className="text-sm text-muted-foreground">{Math.round(progressPercentage)}%</span>
          </div>
          <div className="h-3 bg-secondary rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-primary to-primary/70 transition-all duration-500"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
          <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
            <span>{stats.itemsCompleted} of {stats.itemsTotal} tasks</span>
            <span>{stats.minutesStudied} of {stats.minutesGoal} minutes</span>
          </div>
        </CardContent>
      </Card>

      {/* Main Content Grid */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Today's Tasks - Main Column */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Calendar className="w-5 h-5 text-primary" />
              Today&apos;s Study Plan
            </h2>
            <span className="text-sm text-muted-foreground">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </span>
          </div>

          {/* Active Item (if any) */}
          {activeItem && (
            <Card className="border-2 border-primary bg-primary/5 animate-pulse-slow">
              <CardContent className="pt-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="px-2 py-0.5 rounded-full bg-primary/20 text-primary text-xs font-medium flex items-center gap-1">
                        <Play className="w-3 h-3" />
                        In Progress
                      </span>
                      <span className="text-xs text-muted-foreground">{activeItem.unitName}</span>
                    </div>
                    <h3 className="font-semibold text-lg">{activeItem.title}</h3>
                    <p className="text-sm text-muted-foreground mt-1">{activeItem.description}</p>
                    {activeItem.caseReference && (
                      <p className="text-sm text-primary mt-2 font-mono">{activeItem.caseReference}</p>
                    )}
                  </div>
                  <Button onClick={() => handleCompleteItem(activeItem.id)} className="gap-2">
                    <CheckCircle2 className="w-4 h-4" />
                    Mark Complete
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Pending Items */}
          <div className="space-y-3">
            {pendingItems.map((item, index) => {
              const Icon = ITEM_ICONS[item.type];
              const colorClass = ITEM_COLORS[item.type];
              
              return (
                <Card 
                  key={item.id} 
                  className={`transition-all hover:shadow-md cursor-pointer ${
                    item.id === activeItem?.id ? 'ring-2 ring-primary' : ''
                  }`}
                  onClick={() => !activeItem && handleStartItem(item)}
                >
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-start gap-4">
                      <div className={`w-10 h-10 rounded-xl ${colorClass} border flex items-center justify-center flex-shrink-0`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">
                            {item.unitName}
                          </span>
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {item.estimatedMinutes} min
                          </span>
                          {item.priority === 1 && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/10 text-red-500">
                              Priority
                            </span>
                          )}
                        </div>
                        <h3 className="font-medium mt-1">{item.title}</h3>
                        <p className="text-sm text-muted-foreground line-clamp-1 mt-0.5">
                          {item.description}
                        </p>
                      </div>

                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="flex-shrink-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStartItem(item);
                        }}
                      >
                        <Play className="w-4 h-4" />
                      </Button>
                    </div>
                    
                    {/* AI Rationale */}
                    <div className="mt-3 pt-3 border-t flex items-start gap-2">
                      <Lightbulb className="w-4 h-4 text-yellow-500 flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-muted-foreground">{item.rationale}</p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Completed Items */}
          {completedItems.length > 0 && (
            <div className="space-y-3 mt-6">
              <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                Completed Today
              </h3>
              {completedItems.map((item) => {
                const Icon = ITEM_ICONS[item.type];
                return (
                  <Card key={item.id} className="bg-muted/30 opacity-70">
                    <CardContent className="pt-3 pb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center">
                          <CheckCircle2 className="w-4 h-4 text-green-500" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium line-through opacity-70">{item.title}</p>
                          <p className="text-xs text-muted-foreground">{item.unitName}</p>
                        </div>
                        <span className="text-xs text-green-600">+{item.estimatedMinutes} min</span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Cases to Read */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <BookMarked className="w-4 h-4 text-purple-500" />
                Cases for Today
              </CardTitle>
              <CardDescription>
                Key cases scheduled in your plan
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {cases.map((caseItem, index) => (
                <div key={index} className="p-3 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-sm">{caseItem.name}</p>
                      <p className="text-xs text-muted-foreground font-mono">{caseItem.citation}</p>
                    </div>
                    <Scale className="w-4 h-4 text-purple-500 flex-shrink-0" />
                  </div>
                  <div className="mt-2 flex items-center gap-2 flex-wrap">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-500">
                      {caseItem.topic}
                    </span>
                    <span className="text-xs text-muted-foreground">{caseItem.unitName}</span>
                  </div>
                </div>
              ))}
              <Link href="/research">
                <Button variant="ghost" size="sm" className="w-full gap-2 mt-2">
                  Research more cases
                  <ArrowRight className="w-3 h-3" />
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Spaced Repetition Card */}
          {stats.reviewsDue > 0 && (
            <Card className="bg-gradient-to-br from-pink-500/10 to-pink-500/5 border-pink-500/20">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-pink-500/20 flex items-center justify-center">
                    <RefreshCw className="w-5 h-5 text-pink-500" />
                  </div>
                  <div>
                    <h3 className="font-semibold">Spaced Repetition</h3>
                    <p className="text-sm text-muted-foreground">{stats.reviewsDue} cards due</p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mb-4">
                  Review these concepts to strengthen your memory. Our SM-2 algorithm ensures optimal retention.
                </p>
                <Button className="w-full gap-2">
                  <RefreshCw className="w-4 h-4" />
                  Start Review Session
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Weekly Progress */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-blue-500" />
                This Week
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, i) => {
                  const isToday = i === new Date().getDay() - 1;
                  const isPast = i < new Date().getDay() - 1;
                  const percentage = isPast ? Math.random() * 40 + 60 : isToday ? 30 : 0;
                  
                  return (
                    <div key={day} className="flex items-center gap-3">
                      <span className={`text-xs w-8 ${isToday ? 'font-bold text-primary' : 'text-muted-foreground'}`}>
                        {day}
                      </span>
                      <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all ${
                            isToday ? 'bg-primary' : isPast ? 'bg-green-500' : 'bg-muted'
                          }`}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      {isPast && <CheckCircle2 className="w-3 h-3 text-green-500" />}
                      {isToday && <span className="text-xs text-primary font-medium">Today</span>}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Link href="/quizzes">
                <Button variant="outline" size="sm" className="w-full justify-start gap-2">
                  <Brain className="w-4 h-4 text-orange-500" />
                  Take a Quick Quiz
                </Button>
              </Link>
              <Link href="/drafting">
                <Button variant="outline" size="sm" className="w-full justify-start gap-2">
                  <FileText className="w-4 h-4 text-cyan-500" />
                  Practice Drafting
                </Button>
              </Link>
              <Link href="/clarify">
                <Button variant="outline" size="sm" className="w-full justify-start gap-2">
                  <HelpCircle className="w-4 h-4 text-purple-500" />
                  Ask a Question
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Motivational Footer */}
      <Card className="bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20">
        <CardContent className="py-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                <Trophy className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold">You&apos;re making great progress!</h3>
                <p className="text-sm text-muted-foreground">Complete today&apos;s tasks to maintain your {stats.streakDays}-day streak.</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Next milestone:</span>
              <span className="px-3 py-1 rounded-full bg-primary/20 text-primary font-medium text-sm flex items-center gap-1">
                <Star className="w-3 h-3" />
                10-Day Streak
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Custom animation */}
      <style jsx global>{`
        @keyframes pulse-slow {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.8; }
        }
        .animate-pulse-slow {
          animation: pulse-slow 2s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
