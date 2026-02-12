'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ATP_UNITS } from '@/lib/constants/legal-content';
import Link from 'next/link';
import {
  Users,
  MessageCircle,
  Trophy,
  Calendar,
  Search,
  Plus,
  Crown,
  Medal,
  Award,
  Flame,
  Clock,
  ArrowRight,
  BookOpen,
  Star,
  UserPlus,
  CheckCircle,
  Zap,
  Target,
  Sparkles,
  Hash,
  TrendingUp,
  Gift,
  ChevronRight,
} from 'lucide-react';

type TabType = 'rooms' | 'events' | 'rankings' | 'friends';

interface StudyRoom {
  id: string;
  name: string;
  description: string;
  unitId: string | null;
  roomType: 'official' | 'custom';
  memberCount: number;
  messageCount: number;
  isJoined: boolean;
  lastActivity: string;
  coverImage?: string;
}

interface CommunityEvent {
  id: string;
  title: string;
  description: string;
  type: 'trivia' | 'reading' | 'quiz_marathon' | 'drafting' | 'research';
  status: 'upcoming' | 'active' | 'completed';
  participantCount: number;
  startsAt: string;
  endsAt: string;
  rewards: { position: number; reward: string; value: number }[];
  isJoined: boolean;
}

interface RankingUser {
  rank: number;
  userId: string;
  displayName: string;
  photoURL?: string;
  totalPoints: number;
  quizzesCompleted: number;
  bonusEarned: number;
}

interface FriendSuggestion {
  id: string;
  userId: string;
  displayName: string;
  photoURL?: string;
  matchScore: number;
  reasons: string[];
  mutualFriends: number;
}

// Mock data for study rooms - in production this comes from API
const OFFICIAL_ROOMS: StudyRoom[] = ATP_UNITS.slice(0, 9).map((unit) => ({
  id: `official-${unit.id}`,
  name: unit.name,
  description: `Discuss all things ${unit.name}. Ask questions, share insights, and help each other succeed.`,
  unitId: unit.id,
  roomType: 'official',
  memberCount: Math.floor(Math.random() * 200) + 50,
  messageCount: Math.floor(Math.random() * 1000) + 100,
  isJoined: Math.random() > 0.5,
  lastActivity: '2 hours ago',
}));

// Mock events data
const MOCK_EVENTS: CommunityEvent[] = [
  {
    id: '1',
    title: 'Weekly Constitutional Law Challenge',
    description: 'Test your knowledge of the Constitution of Kenya 2010. Top 3 win discounts!',
    type: 'trivia',
    status: 'active',
    participantCount: 156,
    startsAt: new Date().toISOString(),
    endsAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
    rewards: [
      { position: 1, reward: 'KES 500 off subscription', value: 500 },
      { position: 2, reward: 'KES 400 off subscription', value: 400 },
      { position: 3, reward: 'KES 300 off subscription', value: 300 },
    ],
    isJoined: false,
  },
  {
    id: '2',
    title: 'Land Law Reading Marathon',
    description: 'Complete 5 study sessions on Land Law this week and earn bonus points!',
    type: 'reading',
    status: 'active',
    participantCount: 89,
    startsAt: new Date().toISOString(),
    endsAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
    rewards: [
      { position: 1, reward: 'KES 500 off subscription', value: 500 },
      { position: 2, reward: 'KES 400 off subscription', value: 400 },
      { position: 3, reward: 'KES 300 off subscription', value: 300 },
    ],
    isJoined: true,
  },
  {
    id: '3',
    title: 'Criminal Procedure Quiz Blitz',
    description: 'Answer 50 questions in under 30 minutes. Only for the brave!',
    type: 'quiz_marathon',
    status: 'upcoming',
    participantCount: 45,
    startsAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
    endsAt: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString(),
    rewards: [
      { position: 1, reward: 'KES 500 off subscription', value: 500 },
      { position: 2, reward: 'KES 400 off subscription', value: 400 },
      { position: 3, reward: 'KES 300 off subscription', value: 300 },
    ],
    isJoined: false,
  },
  {
    id: '4',
    title: 'Legal Drafting Championship',
    description: 'Draft a perfect affidavit and have it reviewed by peers. Best drafts win!',
    type: 'drafting',
    status: 'upcoming',
    participantCount: 32,
    startsAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
    endsAt: new Date(Date.now() + 12 * 24 * 60 * 60 * 1000).toISOString(),
    rewards: [
      { position: 1, reward: 'KES 500 off subscription', value: 500 },
      { position: 2, reward: 'KES 400 off subscription', value: 400 },
      { position: 3, reward: 'KES 300 off subscription', value: 300 },
    ],
    isJoined: false,
  },
  {
    id: '5',
    title: 'Evidence Law Deep Dive',
    description: 'Master the Evidence Act with this intensive research challenge.',
    type: 'research',
    status: 'active',
    participantCount: 67,
    startsAt: new Date().toISOString(),
    endsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    rewards: [
      { position: 1, reward: 'KES 500 off subscription', value: 500 },
      { position: 2, reward: 'KES 400 off subscription', value: 400 },
      { position: 3, reward: 'KES 300 off subscription', value: 300 },
    ],
    isJoined: true,
  },
];

// Mock rankings
const MOCK_RANKINGS: RankingUser[] = [
  { rank: 1, userId: '1', displayName: 'Sarah Wanjiku', totalPoints: 4250, quizzesCompleted: 45, bonusEarned: 500 },
  { rank: 2, userId: '2', displayName: 'John Kamau', totalPoints: 3980, quizzesCompleted: 42, bonusEarned: 400 },
  { rank: 3, userId: '3', displayName: 'Grace Adhiambo', totalPoints: 3720, quizzesCompleted: 39, bonusEarned: 300 },
  { rank: 4, userId: '4', displayName: 'Peter Omondi', totalPoints: 3450, quizzesCompleted: 36, bonusEarned: 0 },
  { rank: 5, userId: '5', displayName: 'Mary Njeri', totalPoints: 3200, quizzesCompleted: 34, bonusEarned: 0 },
  { rank: 6, userId: '6', displayName: 'David Mwangi', totalPoints: 2980, quizzesCompleted: 31, bonusEarned: 0 },
  { rank: 7, userId: '7', displayName: 'Faith Atieno', totalPoints: 2750, quizzesCompleted: 29, bonusEarned: 0 },
  { rank: 8, userId: '8', displayName: 'James Kipchoge', totalPoints: 2520, quizzesCompleted: 27, bonusEarned: 0 },
  { rank: 9, userId: '9', displayName: 'Ann Wambui', totalPoints: 2300, quizzesCompleted: 25, bonusEarned: 0 },
  { rank: 10, userId: '10', displayName: 'Michael Otieno', totalPoints: 2100, quizzesCompleted: 23, bonusEarned: 0 },
];

const MOCK_FRIEND_SUGGESTIONS: FriendSuggestion[] = [
  { id: '1', userId: '1', displayName: 'Sarah Wanjiku', matchScore: 95, reasons: ['Same weak areas', 'Similar study schedule'], mutualFriends: 3 },
  { id: '2', userId: '2', displayName: 'John Kamau', matchScore: 88, reasons: ['Both studying Land Law', 'Same target exam date'], mutualFriends: 2 },
  { id: '3', userId: '3', displayName: 'Grace Adhiambo', matchScore: 82, reasons: ['Complementary strengths', 'Active in same rooms'], mutualFriends: 1 },
];

export default function CommunityPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('rooms');
  const [searchQuery, setSearchQuery] = useState('');
  const [rooms, setRooms] = useState<StudyRoom[]>(OFFICIAL_ROOMS);
  const [events, setEvents] = useState<CommunityEvent[]>(MOCK_EVENTS);
  const [rankings, setRankings] = useState<RankingUser[]>(MOCK_RANKINGS);
  const [friendSuggestions, setFriendSuggestions] = useState<FriendSuggestion[]>(MOCK_FRIEND_SUGGESTIONS);
  const [loading, setLoading] = useState(false);

  const getEventTypeIcon = (type: string) => {
    switch (type) {
      case 'trivia': return Zap;
      case 'reading': return BookOpen;
      case 'quiz_marathon': return Target;
      case 'drafting': return MessageCircle;
      case 'research': return Search;
      default: return Calendar;
    }
  };

  const getEventTypeColor = (type: string) => {
    switch (type) {
      case 'trivia': return 'from-amber-500 to-orange-500';
      case 'reading': return 'from-blue-500 to-cyan-500';
      case 'quiz_marathon': return 'from-rose-500 to-pink-500';
      case 'drafting': return 'from-emerald-500 to-teal-500';
      case 'research': return 'from-violet-500 to-purple-500';
      default: return 'from-gray-500 to-gray-600';
    }
  };

  const getRankBadge = (rank: number) => {
    if (rank === 1) return <Crown className="h-5 w-5 text-yellow-500" />;
    if (rank === 2) return <Medal className="h-5 w-5 text-gray-400" />;
    if (rank === 3) return <Medal className="h-5 w-5 text-amber-600" />;
    return <span className="w-5 h-5 flex items-center justify-center text-sm font-bold text-muted-foreground">{rank}</span>;
  };

  const filteredRooms = rooms.filter(room => 
    room.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    room.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredEvents = events.filter(event =>
    event.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    event.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 text-white">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-8">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
              <Users className="h-7 w-7" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold">Community</h1>
              <p className="text-white/80">Connect, learn, and grow together</p>
            </div>
          </div>

          {/* Stats bar */}
          <div className="flex flex-wrap gap-6 mt-6">
            <div className="flex items-center gap-2">
              <Hash className="h-4 w-4 text-white/60" />
              <span className="text-sm">{rooms.length} Study Rooms</span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-white/60" />
              <span className="text-sm">{events.filter(e => e.status === 'active').length} Active Challenges</span>
            </div>
            <div className="flex items-center gap-2">
              <UserPlus className="h-4 w-4 text-white/60" />
              <span className="text-sm">{friendSuggestions.length} Friend Suggestions</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="sticky top-0 z-10 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 md:px-6">
          <div className="flex gap-1 overflow-x-auto">
            {[
              { id: 'rooms', label: 'Study Rooms', icon: MessageCircle },
              { id: 'events', label: 'Challenges', icon: Trophy },
              { id: 'rankings', label: 'Rankings', icon: Crown },
              { id: 'friends', label: 'Friends', icon: Users },
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as TabType)}
                  className={`flex items-center gap-2 px-4 py-3.5 text-sm font-medium whitespace-nowrap transition-colors border-b-2 ${
                    activeTab === tab.id
                      ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                      : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Search & Actions Bar */}
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-4">
        <div className="flex gap-4 flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder={`Search ${activeTab}...`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          {activeTab === 'rooms' && (
            <Button className="gap-2 bg-indigo-500 hover:bg-indigo-600">
              <Plus className="h-4 w-4" />
              Create Room
            </Button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 md:px-6 pb-12">
        {/* Study Rooms Tab */}
        {activeTab === 'rooms' && (
          <div className="space-y-6">
            {/* Official Rooms Section */}
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-indigo-500" />
                Official Study Rooms
              </h2>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredRooms.filter(r => r.roomType === 'official').map((room) => (
                  <Link href={`/community/rooms/${room.id}`} key={room.id}>
                    <Card className="hover:border-indigo-500/50 hover:shadow-lg transition-all cursor-pointer group">
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <div className="p-2 bg-indigo-500/10 rounded-lg">
                            <BookOpen className="h-5 w-5 text-indigo-500" />
                          </div>
                          {room.isJoined && (
                            <span className="text-xs bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 px-2 py-0.5 rounded-full">
                              Joined
                            </span>
                          )}
                        </div>
                        <CardTitle className="text-base mt-3 group-hover:text-indigo-600 transition-colors">
                          {room.name}
                        </CardTitle>
                        <CardDescription className="text-sm line-clamp-2">
                          {room.description}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Users className="h-3.5 w-3.5" />
                            {room.memberCount}
                          </span>
                          <span className="flex items-center gap-1">
                            <MessageCircle className="h-3.5 w-3.5" />
                            {room.messageCount}
                          </span>
                          <span className="flex items-center gap-1 ml-auto">
                            <Clock className="h-3.5 w-3.5" />
                            {room.lastActivity}
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Events/Challenges Tab */}
        {activeTab === 'events' && (
          <div className="space-y-6">
            {/* Active Challenges */}
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <Flame className="h-5 w-5 text-orange-500" />
                Active Challenges
              </h2>
              <div className="grid md:grid-cols-2 gap-4">
                {filteredEvents.filter(e => e.status === 'active').map((event) => {
                  const Icon = getEventTypeIcon(event.type);
                  return (
                    <Card key={event.id} className="overflow-hidden group hover:shadow-lg transition-all">
                      <div className={`h-2 bg-gradient-to-r ${getEventTypeColor(event.type)}`} />
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div className={`p-2 rounded-lg bg-gradient-to-br ${getEventTypeColor(event.type)} text-white`}>
                            <Icon className="h-5 w-5" />
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                              Live
                            </span>
                            {event.isJoined && (
                              <CheckCircle className="h-4 w-4 text-emerald-500" />
                            )}
                          </div>
                        </div>
                        <CardTitle className="text-base mt-3">{event.title}</CardTitle>
                        <CardDescription>{event.description}</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center justify-between mb-4">
                          <span className="text-sm text-muted-foreground flex items-center gap-1">
                            <Users className="h-4 w-4" />
                            {event.participantCount} participants
                          </span>
                          <span className="text-sm text-muted-foreground">
                            Ends {new Date(event.endsAt).toLocaleDateString()}
                          </span>
                        </div>
                        <div className="flex gap-2 mb-4">
                          {event.rewards.slice(0, 3).map((reward, i) => (
                            <div key={i} className="flex items-center gap-1 text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-2 py-1 rounded-full">
                              {i === 0 && <Crown className="h-3 w-3" />}
                              {i === 1 && <Medal className="h-3 w-3" />}
                              {i === 2 && <Award className="h-3 w-3" />}
                              KES {reward.value}
                            </div>
                          ))}
                        </div>
                        <Button 
                          className={`w-full ${event.isJoined ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-indigo-500 hover:bg-indigo-600'}`}
                        >
                          {event.isJoined ? 'Continue Challenge' : 'Join Challenge'}
                          <ArrowRight className="h-4 w-4 ml-2" />
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>

            {/* Upcoming Challenges */}
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <Calendar className="h-5 w-5 text-blue-500" />
                Upcoming Challenges
              </h2>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredEvents.filter(e => e.status === 'upcoming').map((event) => {
                  const Icon = getEventTypeIcon(event.type);
                  return (
                    <Card key={event.id} className="group hover:shadow-lg transition-all">
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <div className={`p-2 rounded-lg bg-gradient-to-br ${getEventTypeColor(event.type)} text-white`}>
                            <Icon className="h-5 w-5" />
                          </div>
                          <span className="text-xs text-muted-foreground">
                            Starts {new Date(event.startsAt).toLocaleDateString()}
                          </span>
                        </div>
                        <CardTitle className="text-sm mt-3">{event.title}</CardTitle>
                        <CardDescription className="text-xs line-clamp-2">{event.description}</CardDescription>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <Button variant="outline" size="sm" className="w-full">
                          Set Reminder
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Rankings Tab */}
        {activeTab === 'rankings' && (
          <div className="space-y-6">
            {/* Weekly Prizes Banner */}
            <Card className="bg-gradient-to-r from-amber-500/10 via-yellow-500/10 to-orange-500/10 border-amber-500/20">
              <CardContent className="pt-6">
                <div className="flex items-center gap-4 mb-4">
                  <div className="p-3 bg-gradient-to-br from-amber-500 to-orange-500 rounded-xl text-white">
                    <Gift className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">Weekly Prizes</h3>
                    <p className="text-sm text-muted-foreground">Top 3 get subscription discounts!</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center p-4 bg-white dark:bg-gray-800 rounded-xl">
                    <Crown className="h-8 w-8 text-yellow-500 mx-auto mb-2" />
                    <p className="font-bold text-lg">KES 500</p>
                    <p className="text-xs text-muted-foreground">1st Place</p>
                  </div>
                  <div className="text-center p-4 bg-white dark:bg-gray-800 rounded-xl">
                    <Medal className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                    <p className="font-bold text-lg">KES 400</p>
                    <p className="text-xs text-muted-foreground">2nd Place</p>
                  </div>
                  <div className="text-center p-4 bg-white dark:bg-gray-800 rounded-xl">
                    <Medal className="h-8 w-8 text-amber-600 mx-auto mb-2" />
                    <p className="font-bold text-lg">KES 300</p>
                    <p className="text-xs text-muted-foreground">3rd Place</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Leaderboard */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-indigo-500" />
                  This Week&apos;s Leaderboard
                </CardTitle>
                <CardDescription>Rankings reset every Monday</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {rankings.map((user, idx) => (
                    <div
                      key={user.userId}
                      className={`flex items-center gap-4 p-3 rounded-xl transition-colors ${
                        idx < 3 
                          ? 'bg-gradient-to-r from-amber-500/5 to-orange-500/5 border border-amber-500/20' 
                          : 'hover:bg-muted/50'
                      }`}
                    >
                      <div className="w-8 flex justify-center">
                        {getRankBadge(user.rank)}
                      </div>
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white font-medium">
                        {user.displayName.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 dark:text-white truncate">
                          {user.displayName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {user.quizzesCompleted} quizzes completed
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-gray-900 dark:text-white">
                          {user.totalPoints.toLocaleString()} pts
                        </p>
                        {user.bonusEarned > 0 && (
                          <p className="text-xs text-emerald-600 dark:text-emerald-400">
                            +KES {user.bonusEarned} bonus
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Friends Tab */}
        {activeTab === 'friends' && (
          <div className="space-y-6">
            {/* AI Friend Suggestions */}
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-amber-500" />
                AI-Suggested Study Partners
                <span className="text-xs bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 px-2 py-0.5 rounded-full ml-2">
                  Based on your interests
                </span>
              </h2>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {friendSuggestions.map((suggestion) => (
                  <Card key={suggestion.id} className="hover:shadow-lg transition-all">
                    <CardContent className="pt-6">
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white font-medium text-lg">
                          {suggestion.displayName.charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 dark:text-white">
                            {suggestion.displayName}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <div className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                              <Star className="h-3 w-3 fill-current" />
                              {suggestion.matchScore}% match
                            </div>
                            {suggestion.mutualFriends > 0 && (
                              <span className="text-xs text-muted-foreground">
                                • {suggestion.mutualFriends} mutual
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {suggestion.reasons.map((reason, i) => (
                          <span key={i} className="text-xs bg-muted px-2 py-1 rounded-full">
                            {reason}
                          </span>
                        ))}
                      </div>
                      <div className="mt-4 flex gap-2">
                        <Button size="sm" className="flex-1 gap-1 bg-indigo-500 hover:bg-indigo-600">
                          <UserPlus className="h-3.5 w-3.5" />
                          Add Friend
                        </Button>
                        <Button size="sm" variant="outline" className="flex-1">
                          View Profile
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            {/* My Friends List */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-indigo-500" />
                  My Friends
                </CardTitle>
                <CardDescription>Connect and study together</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="font-medium">No friends yet</p>
                  <p className="text-sm mt-1">Add study partners from the suggestions above!</p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
