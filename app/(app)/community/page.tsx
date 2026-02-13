'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Input } from '@/components/ui/input';
import { ATP_UNITS } from '@/lib/constants/legal-content';
import Link from 'next/link';
import {
  Users,
  MessageCircle,
  Trophy,
  Calendar,
  Search,
  Crown,
  Medal,
  Clock,
  ArrowRight,
  BookOpen,
  UserPlus,
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
];

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

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Crown className="h-4 w-4 text-green-500" />;
    if (rank === 2) return <Medal className="h-4 w-4 text-gray-400" />;
    if (rank === 3) return <Medal className="h-4 w-4 text-gray-500" />;
    return null;
  };

  const filteredRooms = rooms.filter(room => 
    room.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    room.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredEvents = events.filter(event =>
    event.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    event.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const activeEvents = filteredEvents.filter(e => e.status === 'active');
  const upcomingEvents = filteredEvents.filter(e => e.status === 'upcoming');

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
        <div className="max-w-5xl mx-auto px-4 py-6">
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
            Community
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            Connect with fellow law students and participate in challenges
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4">
          <div className="flex gap-8">
            {[
              { id: 'rooms', label: 'Study Rooms', icon: MessageCircle },
              { id: 'events', label: 'Challenges', icon: Trophy },
              { id: 'rankings', label: 'Leaderboard', icon: Crown },
              { id: 'friends', label: 'Connections', icon: Users },
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as TabType)}
                  className={`flex items-center gap-2 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
                    activeTab === tab.id
                      ? 'border-green-600 text-green-600 dark:text-green-500'
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

      {/* Search Bar */}
      <div className="max-w-5xl mx-auto px-4 py-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder={`Search ${activeTab}...`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700"
          />
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 pb-12">
        {/* Study Rooms */}
        {activeTab === 'rooms' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                Study Rooms
              </h2>
              <span className="text-xs text-gray-400 dark:text-gray-500">
                {filteredRooms.length} rooms
              </span>
            </div>

            <div className="space-y-1">
              {filteredRooms.map((room) => (
                <Link
                  key={room.id}
                  href={`/community/rooms/${room.id}`}
                  className="flex items-center justify-between py-4 border-b border-border hover:bg-muted -mx-2 px-2 rounded transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center flex-shrink-0">
                      <BookOpen className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {room.name}
                        </h3>
                        {room.isJoined && (
                          <span className="text-xs text-green-600 dark:text-green-500">Joined</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {room.memberCount}
                        </span>
                        <span className="flex items-center gap-1">
                          <MessageCircle className="h-3 w-3" />
                          {room.messageCount}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {room.lastActivity}
                        </span>
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-gray-400 flex-shrink-0" />
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Events/Challenges */}
        {activeTab === 'events' && (
          <div className="space-y-8">
            {/* Active */}
            {activeEvents.length > 0 && (
              <section>
                <h2 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-4">
                  Active Challenges
                </h2>
                <div className="space-y-1">
                  {activeEvents.map((event) => (
                    <div
                      key={event.id}
                      className="flex items-center justify-between py-4 border-b border-gray-100 dark:border-gray-800"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                            {event.title}
                          </h3>
                          <span className="text-xs text-green-600 dark:text-green-500 bg-green-50 dark:bg-green-900/20 px-2 py-0.5 rounded">
                            Live
                          </span>
                          {event.isJoined && (
                            <span className="text-xs text-gray-500">• Enrolled</span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-1">
                          {event.description}
                        </p>
                        <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400 mt-2">
                          <span>{event.participantCount} participants</span>
                          <span>Ends {new Date(event.endsAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <button className={`text-sm font-medium px-4 py-2 rounded transition-colors flex-shrink-0 ml-4 ${
                        event.isJoined 
                          ? 'text-green-600 hover:text-green-700'
                          : 'bg-green-600 text-white hover:bg-green-700'
                      }`}>
                        {event.isJoined ? 'Continue' : 'Join'}
                        <ArrowRight className="h-4 w-4 inline ml-1" />
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Upcoming */}
            {upcomingEvents.length > 0 && (
              <section>
                <h2 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-4">
                  Upcoming
                </h2>
                <div className="space-y-1">
                  {upcomingEvents.map((event) => (
                    <div
                      key={event.id}
                      className="flex items-center justify-between py-4 border-b border-gray-100 dark:border-gray-800"
                    >
                      <div className="min-w-0 flex-1">
                        <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                          {event.title}
                        </h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          Starts {new Date(event.startsAt).toLocaleDateString()}
                        </p>
                      </div>
                      <button className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 flex-shrink-0 ml-4">
                        Set reminder
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {activeEvents.length === 0 && upcomingEvents.length === 0 && (
              <div className="text-center py-12">
                <Trophy className="h-10 w-10 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
                <p className="text-gray-500 dark:text-gray-400 text-sm">No challenges found</p>
              </div>
            )}
          </div>
        )}

        {/* Rankings */}
        {activeTab === 'rankings' && (
          <div className="space-y-6">
            {/* Prize Info */}
            <div className="py-4 border-b border-gray-100 dark:border-gray-800">
              <h2 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">
                Weekly Prizes
              </h2>
              <div className="flex gap-6 text-sm">
                <div className="flex items-center gap-2">
                  <Crown className="h-4 w-4 text-green-500" />
                  <span className="text-gray-900 dark:text-white font-medium">1st:</span>
                  <span className="text-gray-500">KES 500 off</span>
                </div>
                <div className="flex items-center gap-2">
                  <Medal className="h-4 w-4 text-gray-400" />
                  <span className="text-gray-900 dark:text-white font-medium">2nd:</span>
                  <span className="text-gray-500">KES 400 off</span>
                </div>
                <div className="flex items-center gap-2">
                  <Medal className="h-4 w-4 text-gray-500" />
                  <span className="text-gray-900 dark:text-white font-medium">3rd:</span>
                  <span className="text-gray-500">KES 300 off</span>
                </div>
              </div>
            </div>

            {/* Leaderboard Table */}
            <table className="w-full">
              <thead>
                <tr className="text-left text-xs text-gray-400 dark:text-gray-500 uppercase">
                  <th className="pb-3 font-medium w-12">Rank</th>
                  <th className="pb-3 font-medium">Student</th>
                  <th className="pb-3 font-medium text-right">Quizzes</th>
                  <th className="pb-3 font-medium text-right">Points</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {rankings.map((user) => (
                  <tr key={user.userId} className="border-t border-gray-100 dark:border-gray-800">
                    <td className="py-3">
                      <div className="flex items-center gap-2">
                        {getRankIcon(user.rank) || <span className="text-gray-500 w-4 text-center">{user.rank}</span>}
                      </div>
                    </td>
                    <td className="py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-sm font-medium text-gray-600 dark:text-gray-400">
                          {user.displayName.charAt(0)}
                        </div>
                        <span className="text-gray-900 dark:text-white font-medium">{user.displayName}</span>
                      </div>
                    </td>
                    <td className="py-3 text-right text-gray-500 dark:text-gray-400">
                      {user.quizzesCompleted}
                    </td>
                    <td className="py-3 text-right">
                      <span className="text-gray-900 dark:text-white font-medium">{user.totalPoints.toLocaleString()}</span>
                      {user.bonusEarned > 0 && (
                        <span className="text-green-600 text-xs ml-1">+{user.bonusEarned}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Friends/Connections */}
        {activeTab === 'friends' && (
          <div className="space-y-8">
            {/* Suggestions */}
            <section>
              <h2 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-4">
                Suggested Study Partners
              </h2>
              <div className="space-y-1">
                {friendSuggestions.map((suggestion) => (
                  <div
                    key={suggestion.id}
                    className="flex items-center justify-between py-4 border-b border-gray-100 dark:border-gray-800"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-sm font-medium text-gray-600 dark:text-gray-400">
                        {suggestion.displayName.charAt(0)}
                      </div>
                      <div>
                        <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                          {suggestion.displayName}
                        </h3>
                        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                          <span className="text-green-600">{suggestion.matchScore}% match</span>
                          {suggestion.mutualFriends > 0 && (
                            <span>• {suggestion.mutualFriends} mutual</span>
                          )}
                        </div>
                        <div className="flex gap-2 mt-1">
                          {suggestion.reasons.slice(0, 2).map((reason, i) => (
                            <span key={i} className="text-xs text-gray-400">{reason}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                    <button className="flex items-center gap-1 text-sm text-green-600 hover:text-green-700 font-medium">
                      <UserPlus className="h-4 w-4" />
                      Add
                    </button>
                  </div>
                ))}
              </div>
            </section>

            {/* My Connections */}
            <section>
              <h2 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-4">
                My Connections
              </h2>
              <div className="text-center py-8">
                <Users className="h-10 w-10 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
                <p className="text-gray-500 dark:text-gray-400 text-sm">
                  No connections yet. Add study partners from the suggestions above.
                </p>
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
